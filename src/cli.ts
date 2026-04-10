#!/usr/bin/env node

import * as fs from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';

import { CLIOptions, TestType, SupportedLanguage, TestFramework, TestGenConfig, GenerationResult } from './types.js';
import { resolveConfig, createSampleConfig } from './config/index.js';
import { detectLanguage, detectFramework, logger, setLogLevel, findSourceFiles, shouldAnalyze } from './utils/index.js';
import { analyzeSource } from './analyzers/index.js';
import { generateTestSuite, formatResults } from './generators/index.js';
import { predictCoverage, formatCoverageReport } from './coverage.js';
import { generateMutants, calculateMutationScore, formatMutationReport } from './mutation/index.js';
import { FileWatcher } from './watcher/index.js';
import { IncrementalCache } from './incremental.js';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('ai-testgen')
  .description('AI-powered test generator - Stop writing tests, start generating them')
  .version(VERSION);

program
  .command('generate')
  .description('Generate test suites for source files')
  .argument('<source>', 'Source file or directory to analyze')
  .option('-o, --output <dir>', 'Output directory for test files')
  .option('-c, --config <path>', 'Path to config file')
  .option('-l, --language <lang>', 'Force language (typescript|javascript|python|go)')
  .option('-f, --framework <fw>', 'Force test framework (jest|vitest|pytest|go-test)')
  .option('--no-ai', 'Disable AI generation, use only AST analysis')
  .option('--dry-run', 'Show what would be generated without writing files')
  .option('--types <types>', 'Test types to generate (unit,integration,edge-case,mock-setup)', 'unit,edge-case')
  .option('--coverage', 'Show coverage prediction')
  .option('--mutation', 'Run mutation testing')
  .option('-v, --verbose', 'Verbose output')
  .action(async (source: string, options: Partial<CLIOptions> = {}) => {
    await runGenerate(source, options);
  });

program
  .command('init')
  .description('Create a sample .aitestgen.yml configuration file')
  .action(() => {
    const outputPath = path.join(process.cwd(), '.aitestgen.yml');
    createSampleConfig(outputPath);
    console.log(chalk.green(`  Created configuration file: ${outputPath}`));
    console.log(chalk.gray('  Edit the file to customize test generation settings.'));
  });

program
  .command('watch')
  .description('Watch for file changes and auto-generate tests')
  .argument('<source>', 'Directory to watch')
  .option('-o, --output <dir>', 'Output directory for test files')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-ai', 'Disable AI generation')
  .option('-v, --verbose', 'Verbose output')
  .action(async (source: string, options: Partial<CLIOptions> = {}) => {
    await runWatch(source, options);
  });

program
  .command('mutation')
  .description('Run mutation testing on source files')
  .argument('<source>', 'Source file to mutate')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (source: string, options: Partial<CLIOptions> = {}) => {
    await runMutation(source, options);
  });

program
  .command('analyze')
  .description('Analyze source code without generating tests')
  .argument('<source>', 'Source file to analyze')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (source: string, options: Partial<CLIOptions> = {}) => {
    await runAnalyze(source, options);
  });

async function runGenerate(source: string, options: Partial<CLIOptions>): Promise<void> {
  const startTime = Date.now();
  const sourcePath = path.resolve(source);
  const cliOptions = normalizeOptions(options);

  if (cliOptions.verbose) setLogLevel('debug');

  const config = resolveConfig(
    { watch: { enabled: false }, incremental: { enabled: false } } as Partial<TestGenConfig>,
    path.dirname(sourcePath),
  );

  console.log(chalk.bold.blue('\n  AI-TestGen') + chalk.gray(` v${VERSION}`));
  console.log(chalk.gray('  Stop writing tests. Start generating them.\n'));

  const spinner = ora('Finding source files...').start();

  try {
    const isDir = fs.statSync(sourcePath).isDirectory();
    let files: string[];

    if (isDir) {
      files = await findSourceFiles(
        config.include.length > 0 ? config.include : ['**/*.{ts,tsx,js,jsx,py,go}'],
        sourcePath,
        config.exclude,
      );
    } else {
      files = [sourcePath];
    }

    files = files.filter((f) => shouldAnalyze(f, config.exclude));

    if (files.length === 0) {
      spinner.warn('No source files found to analyze.');
      return;
    }

    spinner.text = `Analyzing ${files.length} file(s)...`;

    // Incremental mode
    if (cliOptions.incremental || config.incremental.enabled) {
      const cache = new IncrementalCache(config);
      await cache.initialize();
      const filesToProcess = cache.getChangedFiles(files);
      spinner.text = `Incremental mode: ${filesToProcess.length}/${files.length} files changed`;

      const incrResults: GenerationResult[] = [];
      for (const file of filesToProcess) {
        const result = await processFile(file, cliOptions, config, spinner);
        if (result) {
          incrResults.push(result);
          cache.markGenerated(file, result.testFile);
        }
      }

      if (incrResults.length === 0) {
        spinner.succeed('All files up to date. No changes detected.');
        return;
      }

      spinner.succeed(`Generated ${incrResults.length} test suite(s)`);
      console.log(formatResults(incrResults));
      printSummary(incrResults, startTime);
      return;
    }

    // Process all files
    const results: GenerationResult[] = [];
    for (const file of files) {
      const result = await processFile(file, cliOptions, config, spinner);
      if (result) results.push(result);
    }

    if (results.length === 0) {
      spinner.warn('No tests were generated.');
      return;
    }

    spinner.succeed(`Generated ${results.length} test suite(s)`);
    console.log(formatResults(results));

    if (cliOptions.coverage) {
      for (const result of results) {
        try {
          const analysis = analyzeSource(result.sourceFile, detectLanguage(result.sourceFile));
          const prediction = predictCoverage(analysis, result.testSuite);
          console.log(formatCoverageReport(prediction));
        } catch {
          // Skip coverage for individual files that fail
        }
      }
    }

    if (cliOptions.mutation) {
      spinner.start('Running mutation testing...');
      for (const result of results) {
        try {
          const analysis = analyzeSource(result.sourceFile, detectLanguage(result.sourceFile));
          const mutants = generateMutants(result.sourceFile, analysis);
          const mutationResult = calculateMutationScore(
            mutants.map((m) => ({ ...m, status: 'survived' as const })),
          );
          console.log(formatMutationReport(mutationResult));
        } catch {
          // Skip mutation for files that fail
        }
      }
    }

    printSummary(results, startTime);
  } catch (err) {
    spinner.fail('Generation failed');
    console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    if (cliOptions.verbose && err instanceof Error && err.stack) {
      console.error(chalk.gray(err.stack));
    }
    process.exit(1);
  }
}

async function processFile(
  file: string,
  cliOptions: CLIOptions,
  config: TestGenConfig,
  spinner: ReturnType<typeof ora>,
): Promise<GenerationResult | null> {
  try {
    spinner.text = `Analyzing: ${path.basename(file)}`;

    const language = cliOptions.language ?? detectLanguage(file);
    const framework = cliOptions.framework ?? detectFramework(language, path.dirname(file));

    const analysis = analyzeSource(file, language);
    const result = await generateTestSuite(analysis, framework, config, cliOptions);

    if (cliOptions.dryRun) {
      console.log(chalk.gray(`\n  [DRY RUN] Would generate: ${result.testFile}`));
      console.log(chalk.gray(`  ${result.testSuite.testCases.length} test cases | ~${result.testSuite.coverageEstimate}% coverage`));
    } else {
      console.log(chalk.green(`  Generated: ${path.basename(result.testFile)}`) +
        chalk.gray(` (${result.testSuite.testCases.length} tests, ~${result.testSuite.coverageEstimate}% coverage, ${result.usedAI ? 'AI' : 'AST'})`));
    }

    return result;
  } catch (err) {
    logger.warn(`Skipped ${path.basename(file)}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function runWatch(source: string, options: Partial<CLIOptions>): Promise<void> {
  const sourcePath = path.resolve(source);
  const cliOptions = normalizeOptions(options);

  if (cliOptions.verbose) setLogLevel('debug');

  const config = resolveConfig(
    { watch: { enabled: true } } as Partial<TestGenConfig>,
    sourcePath,
  );

  console.log(chalk.bold.blue('\n  AI-TestGen Watch Mode'));
  console.log(chalk.gray(`  Watching: ${sourcePath}\n`));

  const watcher = new FileWatcher(config, async (events) => {
    console.log(chalk.cyan(`\n  ${events.length} file(s) changed`));

    for (const event of events) {
      if (event.eventType === 'unlink') continue;

      try {
        const language = detectLanguage(event.filePath);
        const framework = detectFramework(language, path.dirname(event.filePath));
        const analysis = analyzeSource(event.filePath, language);
        const result = await generateTestSuite(analysis, framework, config, cliOptions);
        console.log(chalk.green(`  Updated: ${path.basename(result.testFile)}`) +
          chalk.gray(` (${result.testSuite.testCases.length} tests)`));
      } catch (err) {
        console.error(chalk.red(`  Error processing ${event.filePath}: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  });

  watcher.start([sourcePath]);

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n  Stopping watch mode...'));
    watcher.stop();
    process.exit(0);
  });
}

async function runMutation(source: string, options: Partial<CLIOptions>): Promise<void> {
  const sourcePath = path.resolve(source);
  const cliOptions = normalizeOptions(options);

  if (cliOptions.verbose) setLogLevel('debug');

  console.log(chalk.bold.blue('\n  AI-TestGen Mutation Testing'));
  console.log(chalk.gray(`  Source: ${sourcePath}\n`));

  const spinner = ora('Generating mutants...').start();

  try {
    const language = detectLanguage(sourcePath);
    const analysis = analyzeSource(sourcePath, language);

    const mutants = generateMutants(sourcePath, analysis);
    spinner.text = `Generated ${mutants.length} mutants. Analyzing...`;

    const result = calculateMutationScore(
      mutants.map((m) => ({ ...m, status: 'survived' as const })),
    );

    spinner.succeed(`Generated ${mutants.length} mutants`);
    console.log(formatMutationReport(result));
    console.log(chalk.gray('\n  Note: Run generated tests against each mutant for accurate kill/survive scores.'));
  } catch (err) {
    spinner.fail('Mutation testing failed');
    console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

async function runAnalyze(source: string, options: Partial<CLIOptions>): Promise<void> {
  const sourcePath = path.resolve(source);
  const cliOptions = normalizeOptions(options);

  if (cliOptions.verbose) setLogLevel('debug');

  console.log(chalk.bold.blue('\n  AI-TestGen Analysis'));
  console.log(chalk.gray(`  Source: ${sourcePath}\n`));

  try {
    const language = detectLanguage(sourcePath);
    const analysis = analyzeSource(sourcePath, language);

    console.log(chalk.bold('  Language: ') + analysis.language);
    console.log(chalk.bold('  Lines of code: ') + analysis.linesOfCode);
    console.log(chalk.bold('  Cyclomatic complexity: ') + analysis.cyclomaticComplexity);
    console.log('');

    if (analysis.functions.length > 0) {
      console.log(chalk.bold('  Functions:'));
      for (const fn of analysis.functions) {
        const exported = fn.isExported ? chalk.green(' [exported]') : '';
        const isAsync = fn.isAsync ? chalk.yellow(' [async]') : '';
        console.log(`    - ${fn.name}(${fn.params.map((p) => p.name).join(', ')})${fn.returnType ? ': ' + fn.returnType : ''}${exported}${isAsync}`);
        console.log(chalk.gray(`      Complexity: ${fn.complexity} | Lines: ${fn.startLine}-${fn.endLine}`));
      }
      console.log('');
    }

    if (analysis.classes.length > 0) {
      console.log(chalk.bold('  Classes:'));
      for (const cls of analysis.classes) {
        console.log(`    - ${cls.name}${cls.extends ? ' extends ' + cls.extends : ''}`);
        console.log(chalk.gray(`      Methods: ${cls.methods.map((m) => m.name).join(', ') || 'none'}`));
        console.log(chalk.gray(`      Properties: ${cls.properties.map((p) => p.name).join(', ') || 'none'}`));
      }
      console.log('');
    }

    if (analysis.interfaces.length > 0) {
      console.log(chalk.bold('  Interfaces:'));
      for (const iface of analysis.interfaces) {
        console.log(`    - ${iface.name}`);
      }
      console.log('');
    }

    if (analysis.imports.length > 0) {
      console.log(chalk.bold('  Dependencies:'));
      for (const imp of analysis.imports) {
        console.log(`    - ${imp.modulePath}: ${imp.namedImports.join(', ') || (imp.defaultImport ?? 'default')}`);
      }
      console.log('');
    }

    console.log(chalk.bold('  Exports: ') + analysis.exports.length);
    console.log(chalk.bold('  Functions: ') + analysis.functions.length);
    console.log(chalk.bold('  Classes: ') + analysis.classes.length);
    console.log(chalk.bold('  Interfaces: ') + analysis.interfaces.length);
  } catch (err) {
    console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }
}

function normalizeOptions(options: Partial<CLIOptions>): CLIOptions {
  return {
    source: options.source ?? '',
    output: options.output,
    config: options.config,
    language: options.language as SupportedLanguage | undefined,
    framework: options.framework as TestFramework | undefined,
    watch: options.watch ?? false,
    incremental: options.incremental ?? false,
    verbose: options.verbose ?? false,
    dryRun: options.dryRun ?? false,
    noAI: options.noAI ?? false,
    types: options.types ?? ['unit', 'edge-case'] as TestType[],
    coverage: options.coverage ?? false,
    mutation: options.mutation ?? false,
  };
}

function printSummary(
  results: GenerationResult[],
  startTime: number,
): void {
  const totalDuration = Date.now() - startTime;
  const totalTests = results.reduce((sum, r) => sum + r.testSuite.testCases.length, 0);
  const avgCoverage = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.testSuite.coverageEstimate, 0) / results.length)
    : 0;

  console.log('');
  console.log(chalk.bold('  Summary'));
  console.log(chalk.gray('  ----------------------------------------'));
  console.log(`  ${chalk.green('Files analyzed:')} ${results.length}`);
  console.log(`  ${chalk.green('Tests generated:')} ${totalTests}`);
  console.log(`  ${chalk.green('Avg coverage:')} ~${avgCoverage}%`);
  console.log(`  ${chalk.green('Total time:')} ${totalDuration}ms`);
  console.log('');
}

program.parse();

import {
  SourceAnalysis,
  TestSuite,
  TestFramework,
  TestGenConfig,
  GenerationResult,
  CLIOptions,
} from '../types.js';
import { generateJsTsTestSuite } from './js-ts-generator.js';
import { generatePythonTestSuite } from './python-generator.js';
import { generateGoTestSuite } from './go-generator.js';
import { generateWithAI, buildAISuite } from './ai-generator.js';
import { buildTestFilePath } from '../utils/language.js';
import { writeFile } from '../utils/file.js';
import * as path from 'path';

export async function generateTestSuite(
  analysis: SourceAnalysis,
  framework: TestFramework,
  config: TestGenConfig,
  options: CLIOptions,
): Promise<GenerationResult> {
  const startTime = Date.now();
  let suite: TestSuite;
  let usedAI = false;

  // Try AI generation first if enabled
  if (config.ai.enabled && config.ai.provider !== 'none' && !options.noAI) {
    try {
      const generatedCode = await generateWithAI(analysis, framework, config);
      suite = buildAISuite(generatedCode, analysis, framework);
      usedAI = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`AI generation failed, falling back to AST-based: ${errorMessage}`);
      suite = generateLocalSuite(analysis, framework, config);
    }
  } else {
    suite = generateLocalSuite(analysis, framework, config);
  }

  // Determine output path
  const testFilePath = buildTestFilePath(
    analysis.filePath,
    options.output ?? config.outputDir,
    analysis.language,
    framework,
  );
  suite.filePath = testFilePath;

  // Get the final code
  const code = suite.imports[0] ?? '';

  if (!options.dryRun) {
    writeFile(testFilePath, code);
  }

  return {
    sourceFile: analysis.filePath,
    testFile: testFilePath,
    testSuite: suite,
    duration: Date.now() - startTime,
    usedAI,
  };
}

function generateLocalSuite(
  analysis: SourceAnalysis,
  framework: TestFramework,
  config: TestGenConfig,
): TestSuite {
  const maxTests = config.generation.maxTestsPerFunction;

  switch (analysis.language) {
    case 'typescript':
    case 'javascript':
      return generateJsTsTestSuite(analysis, framework, maxTests);
    case 'python':
      return generatePythonTestSuite(analysis, framework, maxTests);
    case 'go':
      return generateGoTestSuite(analysis, framework, maxTests);
    case 'rust':
      throw new Error('Rust test generation requires AI mode. Enable AI in your configuration.');
    default:
      throw new Error(`Unsupported language: ${analysis.language}`);
  }
}

export function formatResults(results: GenerationResult[]): string {
  const lines: string[] = [];
  let totalTests = 0;
  let totalDuration = 0;
  let totalCoverage = 0;

  for (const result of results) {
    totalTests += result.testSuite.testCases.length;
    totalDuration += result.duration;
    totalCoverage += result.testSuite.coverageEstimate;
  }

  const avgCoverage = results.length > 0 ? Math.round(totalCoverage / results.length) : 0;

  lines.push('');
  lines.push(`  Files analyzed: ${results.length}`);
  lines.push(`  Tests generated: ${totalTests}`);
  lines.push(`  Avg coverage estimate: ${avgCoverage}%`);
  lines.push(`  Total time: ${totalDuration}ms`);
  lines.push(`  AI assisted: ${results.some((r) => r.usedAI) ? 'Yes' : 'No'}`);
  lines.push('');

  for (const result of results) {
    lines.push(`  ${path.basename(result.testFile)}`);
    lines.push(`    ${result.testSuite.testCases.length} tests | ~${result.testSuite.coverageEstimate}% coverage | ${result.duration}ms`);
  }

  return lines.join('\n');
}

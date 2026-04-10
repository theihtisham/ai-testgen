import * as path from 'path';
import * as fs from 'fs';
import { SupportedLanguage, TestFramework } from '../types.js';
import { LANGUAGE_EXTENSIONS, LANGUAGE_FRAMEWORKS } from '../config/defaults.js';

export function detectLanguage(filePath: string): SupportedLanguage {
  const ext = path.extname(filePath).toLowerCase();
  const language = LANGUAGE_EXTENSIONS[ext];
  if (!language) {
    throw new Error(`Unsupported file extension: ${ext}. Supported: ${Object.keys(LANGUAGE_EXTENSIONS).join(', ')}`);
  }
  return language;
}

export function detectFramework(language: SupportedLanguage, projectDir: string): TestFramework {
  const frameworks = LANGUAGE_FRAMEWORKS[language];
  if (frameworks.length === 0) {
    throw new Error(`No test framework support for language: ${language}`);
  }

  // Check for framework-specific config files
  if (language === 'typescript' || language === 'javascript') {
    const vitestConfig = ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts'].find(
      (f) => fs.existsSync(path.join(projectDir, f)),
    );
    if (vitestConfig) return 'vitest';

    const jestConfig = ['jest.config.ts', 'jest.config.js', 'jest.config.mjs'].find(
      (f) => fs.existsSync(path.join(projectDir, f)),
    );
    if (jestConfig) return 'jest';

    // Check package.json for dependencies
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps['vitest']) return 'vitest';
      if (allDeps['jest']) return 'jest';
    }

    return 'vitest'; // default for JS/TS
  }

  if (language === 'python') return 'pytest';
  if (language === 'go') return 'go-test';

  return frameworks[0]!;
}

export function getTestFileExtension(language: SupportedLanguage): string {
  const map: Record<SupportedLanguage, string> = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    go: 'go',
    rust: 'rs',
  };
  return map[language];
}

export function buildTestFilePath(
  sourceFilePath: string,
  outputDir: string,
  language: SupportedLanguage,
  framework: TestFramework,
): string {
  const dir = path.dirname(sourceFilePath);
  const ext = path.extname(sourceFilePath);
  const baseName = path.basename(sourceFilePath, ext);
  const testExt = getTestFileExtension(language);

  let testFileName: string;
  if (framework === 'pytest') {
    testFileName = `test_${baseName}.py`;
  } else if (framework === 'go-test') {
    testFileName = `${baseName}_test.go`;
  } else {
    testFileName = `${baseName}.test.${testExt}`;
  }

  if (outputDir === '__tests__' || outputDir.startsWith('./') || outputDir.startsWith('../')) {
    const testDir = path.resolve(path.dirname(sourceFilePath), outputDir);
    return path.join(testDir, testFileName);
  }

  return path.join(dir, testFileName);
}

export function isTestFile(filePath: string): boolean {
  const base = path.basename(filePath);
  return (
    base.includes('.test.') ||
    base.includes('.spec.') ||
    base.startsWith('test_') ||
    base.endsWith('_test.go')
  );
}

export function shouldAnalyze(filePath: string, excludePatterns: string[]): boolean {
  if (isTestFile(filePath)) return false;

  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const pattern of excludePatterns) {
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    if (new RegExp(regex).test(normalizedPath)) {
      return false;
    }
  }
  return true;
}

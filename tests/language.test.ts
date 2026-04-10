import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  detectFramework,
  buildTestFilePath,
  isTestFile,
  shouldAnalyze,
} from '../src/utils/language.js';

describe('Language Detection', () => {
  describe('detectLanguage', () => {
    it('detects TypeScript files', () => {
      expect(detectLanguage('src/app.ts')).toBe('typescript');
      expect(detectLanguage('src/component.tsx')).toBe('typescript');
    });

    it('detects JavaScript files', () => {
      expect(detectLanguage('src/app.js')).toBe('javascript');
      expect(detectLanguage('src/component.jsx')).toBe('javascript');
      expect(detectLanguage('src/module.mjs')).toBe('javascript');
      expect(detectLanguage('src/common.cjs')).toBe('javascript');
    });

    it('detects Python files', () => {
      expect(detectLanguage('src/main.py')).toBe('python');
    });

    it('detects Go files', () => {
      expect(detectLanguage('src/main.go')).toBe('go');
    });

    it('detects Rust files', () => {
      expect(detectLanguage('src/main.rs')).toBe('rust');
    });

    it('throws for unsupported extensions', () => {
      expect(() => detectLanguage('src/file.java')).toThrow('Unsupported file extension');
    });
  });

  describe('buildTestFilePath', () => {
    it('generates correct test file paths for JS/TS', () => {
      const result = buildTestFilePath('src/utils.ts', '__tests__', 'typescript', 'vitest');
      expect(result).toContain('utils.test.ts');
    });

    it('generates correct test file paths for Python', () => {
      const result = buildTestFilePath('src/utils.py', '__tests__', 'python', 'pytest');
      expect(result).toContain('test_utils.py');
    });

    it('generates correct test file paths for Go', () => {
      const result = buildTestFilePath('src/utils.go', '__tests__', 'go', 'go-test');
      expect(result).toContain('utils_test.go');
    });
  });

  describe('isTestFile', () => {
    it('identifies test files correctly', () => {
      expect(isTestFile('app.test.ts')).toBe(true);
      expect(isTestFile('app.spec.ts')).toBe(true);
      expect(isTestFile('test_app.py')).toBe(true);
      expect(isTestFile('app_test.go')).toBe(true);
    });

    it('does not mark source files as test files', () => {
      expect(isTestFile('app.ts')).toBe(false);
      expect(isTestFile('utils.py')).toBe(false);
      expect(isTestFile('main.go')).toBe(false);
    });
  });

  describe('shouldAnalyze', () => {
    it('excludes files matching patterns', () => {
      expect(shouldAnalyze('src/node_modules/foo.ts', ['node_modules/**'])).toBe(false);
      expect(shouldAnalyze('src/dist/bundle.js', ['dist/**'])).toBe(false);
      expect(shouldAnalyze('src/types.d.ts', ['**/*.d.ts'])).toBe(false);
    });

    it('includes files not matching patterns', () => {
      expect(shouldAnalyze('src/app.ts', ['node_modules/**'])).toBe(true);
      expect(shouldAnalyze('src/utils.ts', ['dist/**'])).toBe(true);
    });

    it('excludes test files', () => {
      expect(shouldAnalyze('src/app.test.ts', [])).toBe(false);
      expect(shouldAnalyze('src/app.spec.ts', [])).toBe(false);
    });
  });
});

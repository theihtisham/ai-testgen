import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, resolveConfig, findConfig, createSampleConfig } from '../src/config/loader.js';
import { DEFAULT_CONFIG, LANGUAGE_EXTENSIONS, LANGUAGE_FRAMEWORKS } from '../src/config/defaults.js';

describe('Configuration', () => {
  describe('DEFAULT_CONFIG', () => {
    it('has all required top-level fields', () => {
      expect(DEFAULT_CONFIG.version).toBe('1.0.0');
      expect(DEFAULT_CONFIG.language).toBe('auto');
      expect(DEFAULT_CONFIG.framework).toBe('auto');
      expect(DEFAULT_CONFIG.outputDir).toBe('__tests__');
      expect(DEFAULT_CONFIG.coverage.target).toBe(90);
      expect(DEFAULT_CONFIG.ai.enabled).toBe(false);
      expect(DEFAULT_CONFIG.ai.privacyMode).toBe(true);
      expect(DEFAULT_CONFIG.generation.unitTests).toBe(true);
      expect(DEFAULT_CONFIG.generation.integrationTests).toBe(true);
      expect(DEFAULT_CONFIG.generation.edgeCaseTests).toBe(true);
      expect(DEFAULT_CONFIG.generation.mockGeneration).toBe(true);
    });

    it('has sensible defaults for all sections', () => {
      expect(DEFAULT_CONFIG.exclude).toContain('node_modules/**');
      expect(DEFAULT_CONFIG.watch.debounceMs).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.generation.maxTestsPerFunction).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.ai.temperature).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.ai.temperature).toBeLessThanOrEqual(1);
    });
  });

  describe('LANGUAGE_EXTENSIONS', () => {
    it('maps all supported extensions', () => {
      expect(LANGUAGE_EXTENSIONS['.ts']).toBe('typescript');
      expect(LANGUAGE_EXTENSIONS['.tsx']).toBe('typescript');
      expect(LANGUAGE_EXTENSIONS['.js']).toBe('javascript');
      expect(LANGUAGE_EXTENSIONS['.jsx']).toBe('javascript');
      expect(LANGUAGE_EXTENSIONS['.py']).toBe('python');
      expect(LANGUAGE_EXTENSIONS['.go']).toBe('go');
      expect(LANGUAGE_EXTENSIONS['.rs']).toBe('rust');
    });

    it('covers all 5 supported languages', () => {
      const languages = new Set(Object.values(LANGUAGE_EXTENSIONS));
      expect(languages.has('typescript')).toBe(true);
      expect(languages.has('javascript')).toBe(true);
      expect(languages.has('python')).toBe(true);
      expect(languages.has('go')).toBe(true);
      expect(languages.has('rust')).toBe(true);
    });
  });

  describe('LANGUAGE_FRAMEWORKS', () => {
    it('maps correct frameworks for each language', () => {
      expect(LANGUAGE_FRAMEWORKS.typescript).toContain('jest');
      expect(LANGUAGE_FRAMEWORKS.typescript).toContain('vitest');
      expect(LANGUAGE_FRAMEWORKS.javascript).toContain('jest');
      expect(LANGUAGE_FRAMEWORKS.python).toContain('pytest');
      expect(LANGUAGE_FRAMEWORKS.go).toContain('go-test');
    });
  });

  describe('loadConfig', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-config-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('loads YAML config files', () => {
      const configPath = path.join(tempDir, '.aitestgen.yml');
      fs.writeFileSync(configPath, `
language: typescript
framework: vitest
outputDir: tests
coverage:
  target: 95
ai:
  enabled: true
  provider: openai
`);
      const config = loadConfig(configPath);
      expect(config.language).toBe('typescript');
      expect(config.framework).toBe('vitest');
      expect(config.outputDir).toBe('tests');
      expect(config.coverage.target).toBe(95);
      expect(config.ai.enabled).toBe(true);
    });

    it('loads JSON config files', () => {
      const configPath = path.join(tempDir, '.aitestgen.json');
      fs.writeFileSync(configPath, JSON.stringify({
        language: 'python',
        framework: 'pytest',
        outputDir: 'tests',
      }));
      const config = loadConfig(configPath);
      expect(config.language).toBe('python');
      expect(config.framework).toBe('pytest');
      expect(config.outputDir).toBe('tests');
    });

    it('merges with defaults for missing fields', () => {
      const configPath = path.join(tempDir, '.aitestgen.yml');
      fs.writeFileSync(configPath, 'language: go');
      const config = loadConfig(configPath);
      expect(config.language).toBe('go');
      expect(config.version).toBe('1.0.0'); // from defaults
      expect(config.coverage.target).toBe(90); // from defaults
    });
  });

  describe('findConfig', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-find-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('finds config in the current directory', () => {
      const configPath = path.join(tempDir, '.aitestgen.yml');
      fs.writeFileSync(configPath, 'language: typescript');
      const found = findConfig(tempDir);
      expect(found).toBe(configPath);
    });

    it('finds config in parent directories', () => {
      const childDir = path.join(tempDir, 'src', 'lib');
      fs.mkdirSync(childDir, { recursive: true });
      const configPath = path.join(tempDir, '.aitestgen.yml');
      fs.writeFileSync(configPath, 'language: typescript');
      const found = findConfig(childDir);
      expect(found).toBe(configPath);
    });

    it('returns null when no config is found', () => {
      const found = findConfig(os.tmpdir());
      expect(found).toBeNull();
    });
  });

  describe('createSampleConfig', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-sample-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('creates a valid YAML config file', () => {
      const outputPath = path.join(tempDir, '.aitestgen.yml');
      createSampleConfig(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      const config = loadConfig(outputPath);
      expect(config.ai.enabled).toBe(true);
      expect(config.generation.unitTests).toBe(true);
    });
  });
});

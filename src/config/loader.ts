import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TestGenConfig } from '../types.js';
import { DEFAULT_CONFIG } from './defaults.js';

const CONFIG_FILENAMES = ['.aitestgen.yml', '.aitestgen.yaml', '.aitestgen.json'];

export function findConfig(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;

  while (current !== root) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = path.join(current, filename);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    current = path.dirname(current);
  }
  return null;
}

export function loadConfig(configPath: string): TestGenConfig {
  const ext = path.extname(configPath);
  const raw = fs.readFileSync(configPath, 'utf-8');

  let parsed: Record<string, unknown>;
  if (ext === '.json') {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } else {
    parsed = yaml.load(raw) as Record<string, unknown>;
  }

  return deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    parsed,
  ) as unknown as TestGenConfig;
}

export function resolveConfig(
  cliOverrides: Partial<TestGenConfig>,
  projectDir: string,
): TestGenConfig {
  const configPath = cliOverrides['config' as keyof typeof cliOverrides] as string | undefined;
  const foundPath = configPath ?? findConfig(projectDir);
  const base = foundPath ? loadConfig(foundPath) : { ...DEFAULT_CONFIG };

  return deepMerge(
    base as unknown as Record<string, unknown>,
    cliOverrides as unknown as Record<string, unknown>,
  ) as unknown as TestGenConfig;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      isPlainObject(sourceVal) &&
      isPlainObject(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSampleConfig(outputPath: string): void {
  const sample: Record<string, unknown> = {
    version: '1.0.0',
    language: 'auto',
    framework: 'auto',
    outputDir: '__tests__',
    coverage: { target: 90, strict: false },
    ai: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      apiKeyEnv: 'OPENAI_API_KEY',
      maxTokens: 4096,
      temperature: 0.2,
      privacyMode: true,
    },
    generation: {
      unitTests: true,
      integrationTests: true,
      edgeCaseTests: true,
      mockGeneration: true,
      mutationTesting: false,
      maxTestsPerFunction: 10,
      includeComments: true,
    },
    exclude: ['node_modules/**', 'dist/**', 'coverage/**'],
    include: ['src/**/*.{ts,tsx,js,jsx}'],
  };

  const content = yaml.dump(sample, { indent: 2, lineWidth: 100 });
  fs.writeFileSync(outputPath, content, 'utf-8');
}

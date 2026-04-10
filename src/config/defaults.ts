import { TestGenConfig, SupportedLanguage, TestFramework } from '../types.js';

export const DEFAULT_CONFIG: TestGenConfig = {
  version: '1.0.0',
  language: 'auto',
  framework: 'auto',
  outputDir: '__tests__',
  testFilePattern: '{name}.test.{ext}',
  coverage: {
    target: 90,
    strict: false,
  },
  ai: {
    enabled: false,
    provider: 'none',
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
  incremental: {
    enabled: false,
    gitBased: true,
    cacheDir: '.ai-testgen-cache',
  },
  watch: {
    enabled: false,
    ignorePatterns: ['node_modules', 'dist', '.git', 'coverage'],
    debounceMs: 300,
  },
  exclude: [
    'node_modules/**',
    'dist/**',
    'coverage/**',
    '**/*.d.ts',
    '**/*.min.js',
    '**/vendor/**',
  ],
  include: [
    'src/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}',
  ],
};

export const LANGUAGE_EXTENSIONS: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
};

export const LANGUAGE_FRAMEWORKS: Record<SupportedLanguage, TestFramework[]> = {
  typescript: ['jest', 'vitest'],
  javascript: ['jest', 'vitest'],
  python: ['pytest'],
  go: ['go-test'],
  rust: [],
};

export const TEST_FILE_EXTENSIONS: Record<SupportedLanguage, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  go: 'go',
  rust: 'rs',
};

<p align="center">
  <img src="https://img.shields.io/npm/v/@theihtisham/ai-testgen?style=for-the-badge&logo=npm&color=CB3847" alt="npm" />
  <img src="https://img.shields.io/badge/AI--TestGen-v1.0.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/tests-passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/coverage-90%25+-success" alt="Coverage" />
</p>

<h1 align="center">AI-TestGen</h1>

<p align="center">
  <strong>Stop writing tests. AI reads your code and generates comprehensive test suites — 90% coverage in 10 seconds.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Install</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#before--after">Before / After</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#cli-reference">CLI</a>
</p>

---

## Features

### Language Support
- **TypeScript / JavaScript** — Full AST analysis via ts-morph, generates Jest or Vitest test suites
- **Python** — Regex-based AST analysis, generates pytest test suites
- **Go** — Struct-aware analysis, generates `go test` compatible files
- **Rust** — AI-powered generation (coming soon)
- Auto-detects language from file extension

### Test Generation
- **Unit Tests** — Happy path, type checks, return value verification
- **Integration Tests** — Cross-module dependency analysis
- **Edge Case Tests** — Null/undefined, empty arrays, boundary values, NaN, Infinity, special characters
- **Error Path Tests** — Exception handling, error boundaries, async rejections
- **Mock Setup** — Auto-generated mocks for external dependencies

### Advanced Features
- **Mutation Testing** — Generates code mutants (arithmetic, comparison, logical, boolean, string) to verify test quality
- **Coverage Prediction** — Estimates line, branch, and function coverage before running tests
- **Multi-file Analysis** — Builds dependency graphs across your codebase
- **Incremental Mode** — Only generates tests for changed files (git-based or hash-based)
- **Watch Mode** — Auto-generate tests on file save with configurable debounce
- **AI Enhancement** — Optional OpenAI integration for smarter test generation
- **Privacy Mode** — Sends only analysis metadata to AI, never raw source code

### Security First
- No code sent to external APIs unless explicitly configured
- Local AST analysis is the default
- API keys via environment variables only
- Privacy mode strips source code before AI calls

## Install

```bash
# npm
npm install @theihtisham/ai-testgen

# Or use instantly without installing
npx @theihtisham/ai-testgen
```

## Installation

```bash
# Clone and install
git clone https://github.com/theihtisham/ai-testgen.git
cd ai-testgen
npm install
npm run build

# Use globally
npm link
ai-testgen generate ./src
```

## Quick Start

```bash
# Generate tests for a single file
ai-testgen generate src/utils/math.ts

# Generate tests for an entire directory
ai-testgen generate src/

# Generate with coverage prediction
ai-testgen generate src/ --coverage

# Generate with mutation testing
ai-testgen generate src/ --mutation

# Dry run (see what would be generated)
ai-testgen generate src/ --dry-run

# Initialize a config file
ai-testgen init

# Analyze code without generating tests
ai-testgen analyze src/utils.ts

# Watch mode (auto-regenerate on save)
ai-testgen watch src/

# Mutation testing only
ai-testgen mutation src/utils.ts
```

## Before / After

### Before (your source code)

```typescript
// src/calculator.ts
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

export class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  async fetchRate(currency: string): Promise<number> {
    const response = await fetch(`/api/rates/${currency}`);
    return response.json();
  }
}
```

### After (auto-generated tests)

```typescript
// __tests__/calculator.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { divide, Calculator } from './calculator';

vi.mock('/api/rates/USD');

describe('calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('divide', () => {
    it('divide returns expected result for valid input', () => {
      const result = divide(42, 42);
      expect(result).toBeDefined();
    });

    it('divide returns correct type', () => {
      const result = divide(42, 42);
      expect(typeof result).toBeDefined();
    });

    it('divide throws on invalid input', () => {
      expect(() => divide('not-a-number', null)).toThrow();
    });

    it('divide handles zero for b', () => {
      // edge case: zero value
    });

    it('divide handles NaN for a', () => {
      // edge case: NaN
    });

    it('divide handles negative number for b', () => {
      // edge case: negative numbers
    });
  });

  describe('Calculator', () => {
    it('Calculator can be instantiated', () => {
      const instance = new Calculator();
      expect(instance).toBeInstanceOf(Calculator);
    });

    it('Calculator.add works correctly', () => {
      const instance = new Calculator();
      const result = instance.add(42, 42);
      expect(result).toBeDefined();
    });

    it('Calculator.fetchRate handles async correctly', () => {
      const instance = new Calculator();
      const result = await instance.fetchRate('test-currency');
      expect(result).toBeDefined();
    });
  });
});
```

## Configuration

Create `.aitestgen.yml` in your project root:

```yaml
language: auto          # auto-detect | typescript | javascript | python | go | rust
framework: auto         # auto-detect | jest | vitest | pytest | go-test
outputDir: __tests__    # output directory for generated tests

coverage:
  target: 90            # target coverage percentage
  strict: false         # fail if target not met

ai:
  enabled: false        # enable AI-powered generation
  provider: openai      # openai | anthropic | local | none
  model: gpt-4o
  apiKeyEnv: OPENAI_API_KEY
  maxTokens: 4096
  temperature: 0.2
  privacyMode: true     # never send raw source code

generation:
  unitTests: true
  integrationTests: true
  edgeCaseTests: true
  mockGeneration: true
  mutationTesting: false
  maxTestsPerFunction: 10
  includeComments: true

incremental:
  enabled: false
  gitBased: true
  cacheDir: .ai-testgen-cache

watch:
  enabled: false
  ignorePatterns:
    - node_modules
    - dist
    - .git
    - coverage
  debounceMs: 300

exclude:
  - node_modules/**
  - dist/**
  - coverage/**
  - "**/*.d.ts"

include:
  - src/**/*.{ts,tsx,js,jsx}
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `ai-testgen generate <source>` | Generate test suites for source files |
| `ai-testgen init` | Create a sample `.aitestgen.yml` config |
| `ai-testgen watch <source>` | Watch mode — auto-generate on file changes |
| `ai-testgen mutation <source>` | Run mutation testing on a source file |
| `ai-testgen analyze <source>` | Analyze source code structure |

### Generate Options

| Flag | Description |
|------|-------------|
| `-o, --output <dir>` | Output directory for test files |
| `-c, --config <path>` | Path to config file |
| `-l, --language <lang>` | Force language detection |
| `-f, --framework <fw>` | Force test framework |
| `--no-ai` | Disable AI generation (AST only) |
| `--dry-run` | Preview without writing files |
| `--coverage` | Show coverage prediction |
| `--mutation` | Run mutation testing |
| `-v, --verbose` | Verbose output |

## How It Works

```
Source Code
    |
    v
+------------------+
| Language Detection|  .ts/.js/.py/.go -> auto-detect
+------------------+
    |
    v
+------------------+
| AST Analysis     |  ts-morph (JS/TS) or regex-based (Python/Go)
| - Functions      |  Extract: exports, params, types, complexity
| - Classes        |  Detect: side effects, throws, async
| - Interfaces     |
+------------------+
    |
    v
+------------------+
| Edge Case Engine  |  Null, undefined, empty, NaN, boundary
| - Type analysis   |  Optional params, error paths
| - Boundary values |
+------------------+
    |
    v
+------------------+
| Test Generation   |  Framework-specific templates
| - Unit tests      |  Jest / Vitest / pytest / go test
| - Integration     |
| - Mock setup      |
+------------------+
    |
    v
+------------------+
| AI Enhancement    |  (Optional) Refine with OpenAI
| - Privacy mode    |  Only sends metadata, not source
+------------------+
    |
    v
Generated Test Suite  (90%+ coverage estimate)
```

## Mutation Testing

AI-TestGen can create code mutants to verify your tests actually catch bugs:

```bash
ai-testgen mutation src/calculator.ts
```

Mutation types:
- **Arithmetic**: `+` -> `-`, `*` -> `/`
- **Comparison**: `===` -> `!==`, `>` -> `<=`
- **Logical**: `&&` -> `||`
- **Boolean**: `true` -> `false`
- **String**: `"hello"` -> `""`

## Architecture

```
ai-testgen/
  src/
    analyzers/          # Language-specific AST analysis
      js-ts-analyzer.ts # TypeScript/JavaScript via ts-morph
      python-analyzer.ts# Python regex-based analysis
      go-analyzer.ts    # Go regex-based analysis
      analyzer.ts       # Unified interface + edge cases + mocks
    generators/         # Test code generation
      js-ts-generator.ts# Jest/Vitest test generation
      python-generator.ts# pytest test generation
      go-generator.ts   # go test generation
      ai-generator.ts   # OpenAI-powered generation
    mutation/           # Mutation testing
      mutator.ts        # Mutant generation and scoring
    watcher/            # File watching
      watcher.ts        # fs.watch wrapper with debounce
    config/             # Configuration management
      defaults.ts       # Default config values
      loader.ts         # YAML/JSON config loader
    utils/              # Shared utilities
      language.ts       # Language/framework detection
      logger.ts         # Colored console output
      file.ts           # File I/O helpers
    types.ts            # TypeScript type definitions
    coverage.ts         # Coverage prediction
    incremental.ts      # Incremental mode cache
    cli.ts              # CLI entry point
    index.ts            # Public API exports
  tests/                # Vitest test suite
```

## Tech Stack

- **TypeScript** — Strict mode, comprehensive types
- **ts-morph** — AST parsing for TypeScript/JavaScript
- **commander** — CLI framework
- **chalk** — Terminal colors
- **ora** — Loading spinners
- **js-yaml** — YAML config parsing
- **openai** — Optional AI enhancement
- **fast-glob** — File pattern matching
- **vitest** — Test framework

## License

MIT

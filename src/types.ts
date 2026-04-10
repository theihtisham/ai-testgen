// --- Language & Framework Types ---

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust';

export type TestFramework =
  | 'jest'
  | 'vitest'
  | 'pytest'
  | 'go-test';

export type TestType = 'unit' | 'integration' | 'edge-case' | 'mock-setup';

// --- AST Analysis Types ---

export interface FunctionParam {
  name: string;
  type: string | null;
  optional: boolean;
  defaultValue: string | null;
}

export interface AnalyzedFunction {
  name: string;
  isAsync: boolean;
  isExported: boolean;
  params: FunctionParam[];
  returnType: string | null;
  throws: string[];
  complexity: number;
  hasSideEffects: boolean;
  startLine: number;
  endLine: number;
}

export interface AnalyzedClass {
  name: string;
  isExported: boolean;
  constructorParams: FunctionParam[];
  methods: AnalyzedFunction[];
  properties: ClassProperty[];
  implements: string[];
  extends: string | null;
}

export interface ClassProperty {
  name: string;
  type: string | null;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
}

export interface AnalyzedInterface {
  name: string;
  isExported: boolean;
  properties: { name: string; type: string | null; optional: boolean }[];
  methods: { name: string; params: FunctionParam[]; returnType: string | null }[];
}

export interface AnalyzedExport {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'default';
  filePath: string;
}

export interface SourceAnalysis {
  filePath: string;
  language: SupportedLanguage;
  functions: AnalyzedFunction[];
  classes: AnalyzedClass[];
  interfaces: AnalyzedInterface[];
  exports: AnalyzedExport[];
  imports: ImportInfo[];
  dependencies: string[];
  linesOfCode: number;
  cyclomaticComplexity: number;
}

export interface ImportInfo {
  modulePath: string;
  namedImports: string[];
  defaultImport: string | null;
  isTypeOnly: boolean;
}

// --- Test Generation Types ---

export interface TestCase {
  name: string;
  type: TestType;
  description: string;
  code: string;
  expectedBehavior: string;
  inputDescription: string;
  tags: string[];
}

export interface MockDefinition {
  moduleName: string;
  mockName: string;
  setup: string;
  teardown: string | null;
  implementations: Record<string, string>;
}

export interface TestSuite {
  filePath: string;
  sourceFilePath: string;
  language: SupportedLanguage;
  framework: TestFramework;
  testCases: TestCase[];
  mocks: MockDefinition[];
  imports: string[];
  setupCode: string;
  teardownCode: string;
  coverageEstimate: number;
}

export interface GenerationResult {
  sourceFile: string;
  testFile: string;
  testSuite: TestSuite;
  duration: number;
  usedAI: boolean;
}

// --- Mutation Testing Types ---

export interface Mutant {
  id: string;
  sourceFile: string;
  line: number;
  column: number;
  originalCode: string;
  mutatedCode: string;
  type: MutationType;
  status: 'pending' | 'killed' | 'survived' | 'timeout' | 'error';
}

export type MutationType =
  | 'arithmetic-operator'
  | 'comparison-operator'
  | 'logical-operator'
  | 'conditional-expression'
  | 'string-literal'
  | 'boolean-literal'
  | 'negate-condition'
  | 'remove-statement'
  | 'return-value';

export interface MutationResult {
  total: number;
  killed: number;
  survived: number;
  timeout: number;
  errors: number;
  mutationScore: number;
  mutants: Mutant[];
}

// --- Configuration Types ---

export interface TestGenConfig {
  version: string;
  language: SupportedLanguage | 'auto';
  framework: TestFramework | 'auto';
  outputDir: string;
  testFilePattern: string;
  coverage: {
    target: number;
    strict: boolean;
  };
  ai: {
    enabled: boolean;
    provider: 'openai' | 'anthropic' | 'local' | 'none';
    model: string;
    apiKeyEnv: string;
    maxTokens: number;
    temperature: number;
    privacyMode: boolean;
  };
  generation: {
    unitTests: boolean;
    integrationTests: boolean;
    edgeCaseTests: boolean;
    mockGeneration: boolean;
    mutationTesting: boolean;
    maxTestsPerFunction: number;
    includeComments: boolean;
  };
  incremental: {
    enabled: boolean;
    gitBased: boolean;
    cacheDir: string;
  };
  watch: {
    enabled: boolean;
    ignorePatterns: string[];
    debounceMs: number;
  };
  exclude: string[];
  include: string[];
}

// --- Watch Mode Types ---

export interface FileChangeEvent {
  filePath: string;
  eventType: 'add' | 'change' | 'unlink';
  timestamp: number;
}

// --- Coverage Prediction Types ---

export interface CoveragePrediction {
  filePath: string;
  estimatedLineCoverage: number;
  estimatedBranchCoverage: number;
  estimatedFunctionCoverage: number;
  uncoveredPaths: string[];
  suggestions: string[];
}

// --- CLI Types ---

export interface CLIOptions {
  source: string;
  output?: string;
  config?: string;
  language?: SupportedLanguage;
  framework?: TestFramework;
  watch: boolean;
  incremental: boolean;
  verbose: boolean;
  dryRun: boolean;
  noAI: boolean;
  types: TestType[];
  coverage: boolean;
  mutation: boolean;
}

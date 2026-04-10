import {
  SourceAnalysis,
  TestSuite,
  TestCase,
  TestFramework,
  AnalyzedFunction,
} from '../types.js';
import { detectEdgeCases } from '../analyzers/analyzer.js';

export function generateGoTestSuite(
  analysis: SourceAnalysis,
  _framework: TestFramework,
  maxTestsPerFunction: number,
): TestSuite {
  const testCases: TestCase[] = [];

  for (const fn of analysis.functions) {
    if (!fn.isExported) continue;
    testCases.push(...generateGoFunctionTests(fn));
    if (testCases.length > maxTestsPerFunction * analysis.functions.length) break;
  }

  for (const fn of analysis.functions) {
    if (!fn.isExported) continue;
    const edgeCases = detectEdgeCases(fn).slice(0, 2);
    testCases.push(...edgeCases);
  }

  const code = renderGoTestSuite(analysis, testCases);

  return {
    filePath: '',
    sourceFilePath: analysis.filePath,
    language: 'go',
    framework: 'go-test',
    testCases,
    mocks: [],
    imports: [code],
    setupCode: '',
    teardownCode: '',
    coverageEstimate: estimateGoCoverage(analysis, testCases),
  };
}

function generateGoFunctionTests(fn: AnalyzedFunction): TestCase[] {
  const cases: TestCase[] = [];

  cases.push({
    name: `Test${fn.name}`,
    type: 'unit',
    description: `Test ${fn.name} with valid input`,
    code: renderGoTestFunction(fn, 'happy'),
    expectedBehavior: 'Returns expected result',
    inputDescription: 'Valid input',
    tags: ['unit'],
  });

  if (fn.returnType && fn.returnType.includes('error')) {
    cases.push({
      name: `Test${fn.name}Error`,
      type: 'unit',
      description: `Test ${fn.name} returns error for invalid input`,
      code: renderGoTestFunction(fn, 'error'),
      expectedBehavior: 'Returns error',
      inputDescription: 'Invalid input',
      tags: ['unit', 'error'],
    });
  }

  return cases;
}

function renderGoTestFunction(fn: AnalyzedFunction, testType: string): string {
  const args = fn.params.map((p) => generateGoMockValue(p)).join(', ');
  const lines: string[] = [];

  lines.push(`func Test${fn.name}${testType === 'error' ? 'Error' : ''}(t *testing.T) {`);

  if (testType === 'happy') {
    if (fn.returnType && fn.returnType.includes('error')) {
      lines.push(`  result, err := ${fn.name}(${args})`);
      lines.push('  if err != nil {');
      lines.push('    t.Fatalf("unexpected error: %v", err)');
      lines.push('  }');
      lines.push('  if result == nil {');
      lines.push('    t.Error("expected non-nil result")');
      lines.push('  }');
    } else if (fn.returnType) {
      lines.push(`  result := ${fn.name}(${args})`);
      lines.push('  if result == nil {');
      lines.push('    t.Error("expected non-nil result")');
      lines.push('  }');
    } else {
      lines.push(`  ${fn.name}(${args})`);
    }
  } else {
    lines.push(`  _, err := ${fn.name}(${generateGoInvalidArgs(fn)})`);
    lines.push('  if err == nil {');
    lines.push('    t.Error("expected error, got nil")');
    lines.push('  }');
  }

  lines.push('}');
  return lines.join('\n');
}

function generateGoMockValue(param: { type: string | null; name: string }): string {
  if (!param.type) return 'nil';

  const t = param.type;
  if (t.includes('string')) return '"test"';
  if (t.includes('int')) return '42';
  if (t.includes('float')) return '3.14';
  if (t.includes('bool')) return 'true';
  if (t.includes('[]byte')) return '[]byte("test")';
  if (t.includes('[]')) return 'nil';
  if (t.includes('map')) return 'nil';
  if (t.includes('context')) return 'context.Background()';
  if (t.includes('error')) return 'nil';
  if (t.includes('io.Reader')) return 'strings.NewReader("test")';
  if (t.includes('time.Duration')) return 'time.Second';

  return 'nil';
}

function generateGoInvalidArgs(fn: AnalyzedFunction): string {
  return fn.params
    .map((p) => {
      if (p.type?.includes('string')) return '""';
      if (p.type?.includes('int')) return '-1';
      return 'nil';
    })
    .join(', ');
}

function renderGoTestSuite(analysis: SourceAnalysis, testCases: TestCase[]): string {
  const lines: string[] = [];

  lines.push(`package ${getGoPackageName(analysis.filePath)}`);
  lines.push('');
  lines.push('import (');
  lines.push('  "testing"');

  const needsContext = testCases.some((tc) => tc.code?.includes('context.'));
  const needsStrings = testCases.some((tc) => tc.code?.includes('strings.'));
  const needsTime = testCases.some((tc) => tc.code?.includes('time.'));

  if (needsContext) lines.push('  "context"');
  if (needsStrings) lines.push('  "strings"');
  if (needsTime) lines.push('  "time"');

  lines.push(')');
  lines.push('');

  for (const test of testCases) {
    if (test.code) {
      lines.push(test.code);
    } else {
      lines.push(`func ${test.name}(t *testing.T) {`);
      lines.push(`  // ${test.description}`);
      lines.push(`  // Expected: ${test.expectedBehavior}`);
      lines.push('  t.Skip("placeholder test")');
      lines.push('}');
    }
    lines.push('');
  }

  return lines.join('\n');
}

function getGoPackageName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const dir = parts.length > 1 ? parts[parts.length - 2] : 'main';
  return dir ?? 'main';
}

function estimateGoCoverage(analysis: SourceAnalysis, testCases: TestCase[]): number {
  const exportedFunctions = analysis.functions.filter((f) => f.isExported).length;
  if (exportedFunctions === 0) return 0;
  const testedFunctions = new Set(testCases.map((tc) => tc.name.replace(/^Test/, '').replace(/Error$/, '')));
  const coveredRatio = Math.min(testedFunctions.size / exportedFunctions, 1);
  return Math.min(Math.round(coveredRatio * 80 + 10), 100);
}

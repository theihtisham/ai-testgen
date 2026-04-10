import {
  SourceAnalysis,
  TestSuite,
  TestCase,
  TestFramework,
  AnalyzedFunction,
  AnalyzedClass,
} from '../types.js';
import { detectEdgeCases, detectMocks } from '../analyzers/analyzer.js';

export function generatePythonTestSuite(
  analysis: SourceAnalysis,
  _framework: TestFramework,
  maxTestsPerFunction: number,
): TestSuite {
  const testCases: TestCase[] = [];
  const mocks = detectMocks(analysis);

  // Generate unit tests for each function
  for (const fn of analysis.functions) {
    if (!fn.isExported) continue;
    testCases.push(...generatePythonFunctionTests(fn));
    if (testCases.length > maxTestsPerFunction * analysis.functions.length) break;
  }

  // Generate class tests
  for (const cls of analysis.classes) {
    testCases.push(...generatePythonClassTests(cls));
  }

  // Generate edge case tests
  for (const fn of analysis.functions) {
    if (!fn.isExported) continue;
    const edgeCases = detectEdgeCases(fn).slice(0, 3);
    testCases.push(...edgeCases);
  }

  const code = renderPythonTestSuite(analysis, testCases, mocks);

  return {
    filePath: '',
    sourceFilePath: analysis.filePath,
    language: 'python',
    framework: 'pytest',
    testCases,
    mocks,
    imports: [code],
    setupCode: '',
    teardownCode: '',
    coverageEstimate: estimatePythonCoverage(analysis, testCases),
  };
}

function generatePythonFunctionTests(fn: AnalyzedFunction): TestCase[] {
  const cases: TestCase[] = [];

  cases.push({
    name: `test_${fn.name}_returns_expected`,
    type: 'unit',
    description: `Test basic invocation of ${fn.name}`,
    code: `def test_${fn.name}_returns_expected():\n    result = ${fn.name}(${generatePythonArgs(fn)})\n    assert result is not None`,
    expectedBehavior: 'Returns expected result',
    inputDescription: 'Valid input',
    tags: ['unit'],
  });

  if (fn.isAsync) {
    cases.push({
      name: `test_${fn.name}_async`,
      type: 'unit',
      description: `Test async ${fn.name}`,
      code: `import pytest\n\n@pytest.mark.asyncio\nasync def test_${fn.name}_async():\n    result = await ${fn.name}(${generatePythonArgs(fn)})\n    assert result is not None`,
      expectedBehavior: 'Async resolves correctly',
      inputDescription: 'Valid input',
      tags: ['unit', 'async'],
    });
  }

  if (fn.throws.length > 0) {
    cases.push({
      name: `test_${fn.name}_raises_error`,
      type: 'unit',
      description: `Test ${fn.name} raises on invalid input`,
      code: `def test_${fn.name}_raises_error():\n    with pytest.raises(Exception):\n        ${fn.name}(${generatePythonInvalidArgs(fn)})`,
      expectedBehavior: 'Raises expected exception',
      inputDescription: 'Invalid input',
      tags: ['unit', 'error'],
    });
  }

  return cases;
}

function generatePythonClassTests(cls: AnalyzedClass): TestCase[] {
  const cases: TestCase[] = [];

  cases.push({
    name: `test_${cls.name}_instantiation`,
    type: 'unit',
    description: `Test ${cls.name} can be instantiated`,
    code: `def test_${cls.name}_instantiation():\n    instance = ${cls.name}(${cls.constructorParams.map(() => 'None').join(', ')})\n    assert instance is not None`,
    expectedBehavior: 'Instance is created',
    inputDescription: 'Constructor args',
    tags: ['unit', 'constructor'],
  });

  for (const method of cls.methods.slice(0, 5)) {
    if (method.name.startsWith('_')) continue;
    cases.push({
      name: `test_${cls.name}_${method.name}`,
      type: 'unit',
      description: `Test ${cls.name}.${method.name}`,
      code: `def test_${cls.name}_${method.name}():\n    instance = ${cls.name}()\n    result = instance.${method.name}(${method.params.map(() => 'None').join(', ')})\n    assert result is not None`,
      expectedBehavior: 'Method works correctly',
      inputDescription: 'Valid input',
      tags: ['unit', 'method'],
    });
  }

  return cases;
}

function generatePythonArgs(fn: AnalyzedFunction): string {
  return fn.params
    .map((p) => {
      if (!p.type) return "'test'";
      if (p.type.includes('str')) return "'test'";
      if (p.type.includes('int') || p.type.includes('float')) return '42';
      if (p.type.includes('bool')) return 'True';
      if (p.type.includes('list') || p.type.includes('List')) return '[]';
      if (p.type.includes('dict') || p.type.includes('Dict')) return '{}';
      return 'None';
    })
    .join(', ');
}

function generatePythonInvalidArgs(fn: AnalyzedFunction): string {
  return fn.params
    .map((p) => {
      if (p.type?.includes('int')) return "'not-a-number'";
      if (p.type?.includes('str')) return '12345';
      if (p.type?.includes('list')) return "'not-a-list'";
      return 'None';
    })
    .join(', ');
}

function renderPythonTestSuite(
  analysis: SourceAnalysis,
  testCases: TestCase[],
  _mocks: import('../types.js').MockDefinition[],
): string {
  const lines: string[] = [];
  const baseName = analysis.filePath.replace(/\.py$/, '').split('/').pop() ?? 'module';

  lines.push('"""');
  lines.push(`Auto-generated test suite for ${analysis.filePath}`);
  lines.push('Generated by AI-TestGen');
  lines.push(` ${testCases.length} test cases`);
  lines.push('"""');
  lines.push('');
  lines.push('import pytest');
  lines.push(`from ${baseName} import *`);
  lines.push('');

  // Group by target
  const grouped = new Map<string, TestCase[]>();
  for (const tc of testCases) {
    const target = tc.name.split('_').slice(0, 3).join('_') ?? 'general';
    const existing = grouped.get(target) ?? [];
    existing.push(tc);
    grouped.set(target, existing);
  }

  for (const [_target, tests] of grouped) {
    for (const test of tests) {
      if (test.code) {
        lines.push(test.code);
      } else {
        lines.push(`def ${test.name}():`);
        lines.push(`    # ${test.description}`);
        lines.push(`    # Expected: ${test.expectedBehavior}`);
        lines.push(`    assert True  # placeholder`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function estimatePythonCoverage(analysis: SourceAnalysis, testCases: TestCase[]): number {
  const exportedFunctions = analysis.functions.filter((f) => f.isExported).length;
  const classMethods = analysis.classes.reduce((sum, cls) => sum + cls.methods.length, 0);
  const totalTestable = exportedFunctions + classMethods;
  if (totalTestable === 0) return 0;

  const uniqueTargets = new Set(testCases.map((tc) => tc.name));
  const coveredRatio = Math.min(uniqueTargets.size / totalTestable, 1);
  return Math.min(Math.round(coveredRatio * 75 + 15), 100);
}

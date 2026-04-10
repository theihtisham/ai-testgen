import {
  SourceAnalysis,
  TestSuite,
  TestCase,
  MockDefinition,
  TestFramework,
  AnalyzedFunction,
  AnalyzedClass,
} from '../types.js';
import { detectEdgeCases, detectMocks } from '../analyzers/analyzer.js';

export function generateJsTsTestSuite(
  analysis: SourceAnalysis,
  framework: TestFramework,
  maxTestsPerFunction: number,
): TestSuite {
  const testCases: TestCase[] = [];
  const mocks = detectMocks(analysis);

  for (const fn of analysis.functions) {
    if (!fn.isExported) continue;
    testCases.push(...generateFunctionUnitTests(fn, framework));
    if (testCases.length > maxTestsPerFunction * analysis.functions.length) break;
  }

  for (const cls of analysis.classes) {
    testCases.push(...generateClassUnitTests(cls, framework));
  }

  for (const fn of analysis.functions) {
    if (!fn.isExported) continue;
    const edgeCases = detectEdgeCases(fn).slice(0, 3);
    testCases.push(...edgeCases);
  }

  const imports = generateImports(analysis, framework, mocks);
  const setupCode = generateSetup(mocks, framework);
  const teardownCode = generateTeardown(mocks, framework);

  const code = renderTestSuite(analysis, testCases, imports, setupCode, teardownCode);

  return {
    filePath: '',
    sourceFilePath: analysis.filePath,
    language: analysis.language,
    framework,
    testCases,
    mocks,
    imports: [code],
    setupCode,
    teardownCode,
    coverageEstimate: estimateCoverage(analysis, testCases),
  };
}

function generateFunctionUnitTests(fn: AnalyzedFunction, _framework: TestFramework): TestCase[] {
  const cases: TestCase[] = [];

  cases.push({
    name: `${fn.name} returns expected result for valid input`,
    type: 'unit',
    description: `Test basic invocation of ${fn.name}`,
    code: generateFunctionTestCode(fn, 'happy-path'),
    expectedBehavior: 'Returns the expected result',
    inputDescription: 'Valid input parameters',
    tags: ['unit', 'happy-path'],
  });

  if (fn.returnType) {
    cases.push({
      name: `${fn.name} returns correct type`,
      type: 'unit',
      description: `Verify return type of ${fn.name}`,
      code: generateFunctionTestCode(fn, 'type-check'),
      expectedBehavior: `Return value should be of type ${fn.returnType}`,
      inputDescription: 'Standard input',
      tags: ['unit', 'type-check'],
    });
  }

  if (fn.isAsync) {
    cases.push({
      name: `${fn.name} resolves with expected value`,
      type: 'unit',
      description: `Test that ${fn.name} async resolves correctly`,
      code: generateFunctionTestCode(fn, 'async-resolve'),
      expectedBehavior: 'Promise resolves with expected value',
      inputDescription: 'Valid input',
      tags: ['unit', 'async'],
    });
  }

  if (fn.throws.length > 0) {
    cases.push({
      name: `${fn.name} throws on invalid input`,
      type: 'unit',
      description: `Test that ${fn.name} throws for invalid input`,
      code: generateFunctionTestCode(fn, 'throws'),
      expectedBehavior: 'Should throw an error',
      inputDescription: 'Invalid input',
      tags: ['unit', 'error'],
    });
  }

  return cases;
}

function generateClassUnitTests(cls: AnalyzedClass, _framework: TestFramework): TestCase[] {
  const cases: TestCase[] = [];

  cases.push({
    name: `${cls.name} can be instantiated`,
    type: 'unit',
    description: `Test ${cls.name} constructor`,
    code: generateClassTestCode(cls, 'constructor'),
    expectedBehavior: 'Instance should be created successfully',
    inputDescription: 'Constructor arguments',
    tags: ['unit', 'constructor'],
  });

  for (const method of cls.methods.slice(0, 5)) {
    cases.push({
      name: `${cls.name}.${method.name} works correctly`,
      type: 'unit',
      description: `Test ${cls.name}.${method.name} method`,
      code: generateClassTestCode(cls, method.name),
      expectedBehavior: 'Method should work as expected',
      inputDescription: `Valid input for ${method.name}`,
      tags: ['unit', 'method'],
    });

    if (method.isAsync) {
      cases.push({
        name: `${cls.name}.${method.name} handles async correctly`,
        type: 'unit',
        description: `Test async behavior of ${cls.name}.${method.name}`,
        code: generateClassTestCode(cls, `${method.name}-async`),
        expectedBehavior: 'Should resolve/reject correctly',
        inputDescription: 'Valid input for async method',
        tags: ['unit', 'async'],
      });
    }
  }

  return cases;
}

function generateFunctionTestCode(fn: AnalyzedFunction, testType: string): string {
  const args = fn.params
    .filter((p) => p.name !== 'self' && p.name !== 'cls')
    .map((p) => generateMockValue(p))
    .join(', ');

  switch (testType) {
    case 'happy-path':
      if (fn.isAsync) {
        return `const result = await ${fn.name}(${args});\n    expect(result).toBeDefined();`;
      }
      return `const result = ${fn.name}(${args});\n    expect(result).toBeDefined();`;

    case 'type-check':
      return `const result = ${fn.isAsync ? 'await ' : ''}${fn.name}(${args});\n    expect(typeof result).toBeDefined();`;

    case 'async-resolve':
      return `await expect(${fn.name}(${args})).resolves.toBeDefined();`;

    case 'throws':
      return `expect(() => ${fn.name}(${generateInvalidArgs(fn)})).toThrow();`;

    default:
      return `const result = ${fn.isAsync ? 'await ' : ''}${fn.name}(${args});\n    expect(result).toBeDefined();`;
  }
}

function generateClassTestCode(cls: AnalyzedClass, methodOrType: string): string {
  const constructorArgs = cls.constructorParams
    .map((p) => generateMockValue(p))
    .join(', ');

  if (methodOrType === 'constructor') {
    return `const instance = new ${cls.name}(${constructorArgs});\n    expect(instance).toBeInstanceOf(${cls.name});`;
  }

  const method = cls.methods.find((m) => m.name === methodOrType);
  if (!method) {
    return `const instance = new ${cls.name}(${constructorArgs});\n    expect(instance).toBeDefined();`;
  }

  const methodArgs = method.params
    .map((p) => generateMockValue(p))
    .join(', ');
  const awaitPrefix = method.isAsync ? 'await ' : '';

  return `const instance = new ${cls.name}(${constructorArgs});\n    const result = ${awaitPrefix}instance.${method.name}(${methodArgs});\n    expect(result).toBeDefined();`;
}

function generateMockValue(param: { type: string | null; name: string }): string {
  if (!param.type) return `'${param.name}-value'`;

  const t = param.type;

  if (t.includes('string') || t.includes('String')) return `'test-${param.name}'`;
  if (t.includes('number') || t.includes('Number')) return '42';
  if (t.includes('boolean') || t.includes('Boolean')) return 'true';
  if (t.includes('Array') || t.includes('[]')) return '[]';
  if (t.includes('Promise')) return 'Promise.resolve({})';
  if (t.includes('Date')) return 'new Date()';
  if (t.includes('Record') || t.includes('{') || t.includes('object')) return '{}';
  if (t.includes('null')) return 'null';
  if (t.includes('undefined')) return 'undefined';
  if (t.includes('void')) return 'undefined';
  if (t.includes('Function') || t.includes('() =>')) return 'jest.fn()';
  if (t.includes('RegExp')) return '/test/';
  if (t.includes('Map')) return 'new Map()';
  if (t.includes('Set')) return 'new Set()';
  if (t.includes('Error')) return "new Error('test error')";
  if (t.includes('Buffer')) return "Buffer.from('test')";

  return '{} as any';
}

function generateInvalidArgs(fn: AnalyzedFunction): string {
  return fn.params
    .map((p) => {
      if (p.type?.includes('string')) return '123';
      if (p.type?.includes('number')) return "'not-a-number'";
      if (p.type?.includes('boolean')) return "'not-a-bool'";
      if (p.type?.includes('Array') || p.type?.includes('[]')) return "'not-an-array'";
      return 'null';
    })
    .join(', ');
}

function generateImports(
  analysis: SourceAnalysis,
  framework: TestFramework,
  mocks: MockDefinition[],
): string {
  const lines: string[] = [];

  if (framework === 'jest') {
    lines.push("import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';");
  } else {
    lines.push("import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';");
  }

  for (const mock of mocks) {
    if (framework === 'jest') {
      lines.push(`jest.mock('${mock.moduleName}');`);
    } else {
      lines.push(`vi.mock('${mock.moduleName}');`);
    }
  }

  const sourcePath = './' + analysis.filePath.replace(/\.ts$/, '').replace(/\.js$/, '');
  const exportedNames = analysis.functions
    .filter((f) => f.isExported)
    .map((f) => f.name);
  const classNames = analysis.classes.map((c) => c.name);

  const allImports = [...exportedNames, ...classNames];
  if (allImports.length > 0) {
    lines.push(`import { ${allImports.join(', ')} } from '${sourcePath}';`);
  } else {
    lines.push(`import * as subject from '${sourcePath}';`);
  }

  return lines.join('\n');
}

function generateSetup(mocks: MockDefinition[], framework: TestFramework): string {
  if (mocks.length === 0) return '';

  const fn = framework === 'jest' ? 'jest' : 'vi';
  const lines: string[] = [];

  for (const mock of mocks) {
    for (const implValue of Object.values(mock.implementations)) {
      lines.push(`const ${mock.mockName} = ${fn}.fn()${implValue.includes('jest.fn()') ? '' : ''};`);
    }
  }

  return lines.join('\n  ');
}

function generateTeardown(mocks: MockDefinition[], framework: TestFramework): string {
  if (mocks.length === 0) return '';
  const fn = framework === 'jest' ? 'jest' : 'vi';
  return `${fn}.clearAllMocks();`;
}

function renderTestSuite(
  analysis: SourceAnalysis,
  testCases: TestCase[],
  imports: string,
  setupCode: string,
  teardownCode: string,
): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Auto-generated test suite for ${analysis.filePath}`);
  lines.push(' * Generated by AI-TestGen');
  lines.push(` * ${testCases.length} test cases | ~${estimateCoverage(analysis, testCases)}% coverage estimate`);
  lines.push(' */');
  lines.push('');

  lines.push(imports);
  lines.push('');

  lines.push(`describe('${pathBasename(analysis.filePath)}', () => {`);

  if (setupCode.trim()) {
    lines.push('  beforeEach(() => {');
    lines.push(`    ${setupCode}`);
    lines.push('  });');
    lines.push('');
  }

  if (teardownCode.trim()) {
    lines.push('  afterEach(() => {');
    lines.push(`    ${teardownCode}`);
    lines.push('  });');
    lines.push('');
  }

  const grouped = groupTestsByTarget(testCases);

  for (const [target, tests] of grouped) {
    lines.push(`  describe('${target}', () => {`);
    for (const test of tests) {
      lines.push(`    it('${test.name}', () => {`);
      if (test.code) {
        lines.push(`      ${test.code}`);
      } else {
        lines.push(`      // TODO: Implement test for: ${test.inputDescription}`);
        lines.push(`      // Expected: ${test.expectedBehavior}`);
        lines.push(`      expect(true).toBe(true); // placeholder`);
      }
      lines.push('    });');
      lines.push('');
    }
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');

  return lines.join('\n');
}

function groupTestsByTarget(testCases: TestCase[]): Map<string, TestCase[]> {
  const groups = new Map<string, TestCase[]>();
  for (const tc of testCases) {
    const target = tc.name.split(' ')[0] ?? 'general';
    const existing = groups.get(target) ?? [];
    existing.push(tc);
    groups.set(target, existing);
  }
  return groups;
}

function pathBasename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? filePath;
}

function estimateCoverage(analysis: SourceAnalysis, testCases: TestCase[]): number {
  const exportedFunctions = analysis.functions.filter((f) => f.isExported).length;
  const classMethods = analysis.classes.reduce((sum, cls) => sum + cls.methods.length, 0);
  const totalTestable = exportedFunctions + classMethods;
  if (totalTestable === 0) return 0;

  const uniqueTargets = new Set(testCases.map((tc) => tc.name.split(' ')[0]));
  const coveredRatio = Math.min(uniqueTargets.size / totalTestable, 1);
  const edgeCaseBonus = testCases.filter((tc) => tc.type === 'edge-case').length > 0 ? 5 : 0;

  return Math.min(Math.round(coveredRatio * 80 + edgeCaseBonus + 10), 100);
}

import { describe, it, expect } from 'vitest';
import { predictCoverage, formatCoverageReport } from '../src/coverage.js';
import { SourceAnalysis, TestSuite, CoveragePrediction } from '../src/types.js';

function createMockAnalysis(): SourceAnalysis {
  return {
    filePath: '/src/utils.ts',
    language: 'typescript',
    functions: [
      {
        name: 'add',
        isAsync: false,
        isExported: true,
        params: [
          { name: 'a', type: 'number', optional: false, defaultValue: null },
          { name: 'b', type: 'number', optional: false, defaultValue: null },
        ],
        returnType: 'number',
        throws: [],
        complexity: 1,
        hasSideEffects: false,
        startLine: 1,
        endLine: 3,
      },
      {
        name: 'divide',
        isAsync: false,
        isExported: true,
        params: [
          { name: 'a', type: 'number', optional: false, defaultValue: null },
          { name: 'b', type: 'number', optional: false, defaultValue: null },
        ],
        returnType: 'number',
        throws: ['Error'],
        complexity: 3,
        hasSideEffects: false,
        startLine: 5,
        endLine: 10,
      },
      {
        name: 'formatName',
        isAsync: false,
        isExported: true,
        params: [
          { name: 'first', type: 'string', optional: false, defaultValue: null },
          { name: 'last', type: 'string', optional: true, defaultValue: "''" },
        ],
        returnType: 'string',
        throws: [],
        complexity: 2,
        hasSideEffects: false,
        startLine: 12,
        endLine: 16,
      },
    ],
    classes: [
      {
        name: 'Calculator',
        isExported: true,
        constructorParams: [],
        methods: [
          {
            name: 'round',
            isAsync: false,
            isExported: false,
            params: [
              { name: 'value', type: 'number', optional: false, defaultValue: null },
            ],
            returnType: 'number',
            throws: [],
            complexity: 1,
            hasSideEffects: false,
            startLine: 20,
            endLine: 22,
          },
        ],
        properties: [],
        implements: [],
        extends: null,
      },
    ],
    interfaces: [],
    exports: [
      { name: 'add', type: 'function', filePath: '/src/utils.ts' },
      { name: 'divide', type: 'function', filePath: '/src/utils.ts' },
      { name: 'formatName', type: 'function', filePath: '/src/utils.ts' },
      { name: 'Calculator', type: 'class', filePath: '/src/utils.ts' },
    ],
    imports: [],
    dependencies: [],
    linesOfCode: 30,
    cyclomaticComplexity: 7,
  };
}

function createMockSuite(testedNames: string[]): TestSuite {
  return {
    filePath: '/tests/utils.test.ts',
    sourceFilePath: '/src/utils.ts',
    language: 'typescript',
    framework: 'vitest',
    testCases: testedNames.map((name) => ({
      name: `${name} test`,
      type: 'unit' as const,
      description: `Test ${name}`,
      code: '',
      expectedBehavior: 'Works',
      inputDescription: 'Valid input',
      tags: ['unit'],
    })),
    mocks: [],
    imports: [],
    setupCode: '',
    teardownCode: '',
    coverageEstimate: 80,
  };
}

describe('Coverage Prediction', () => {
  it('predicts coverage for fully tested code', () => {
    const analysis = createMockAnalysis();
    const suite = createMockSuite(['add', 'divide', 'formatName', 'round']);
    const prediction = predictCoverage(analysis, suite);

    expect(prediction.estimatedFunctionCoverage).toBeGreaterThan(50);
  });

  it('reports uncovered paths', () => {
    const analysis = createMockAnalysis();
    const suite = createMockSuite(['add']);
    const prediction = predictCoverage(analysis, suite);

    expect(prediction.uncoveredPaths.length).toBeGreaterThan(0);
    expect(prediction.uncoveredPaths.some((p) => p.includes('divide'))).toBe(true);
  });

  it('suggests additional tests for uncovered code', () => {
    const analysis = createMockAnalysis();
    const suite = createMockSuite(['add']);
    const prediction = predictCoverage(analysis, suite);

    expect(prediction.suggestions.length).toBeGreaterThan(0);
  });

  it('identifies untested error paths', () => {
    const analysis = createMockAnalysis();
    const suite = createMockSuite(['add', 'divide', 'formatName']);
    const prediction = predictCoverage(analysis, suite);

    // divide throws but we have no error test
    expect(prediction.suggestions.some((s) => s.includes('error path') || s.includes('error'))).toBe(true);
  });

  it('identifies untested optional parameters', () => {
    const analysis = createMockAnalysis();
    const suite = createMockSuite(['add', 'divide']);
    const prediction = predictCoverage(analysis, suite);

    // formatName has optional 'last' param
    expect(
      prediction.suggestions.some((s) => s.includes('formatName') && s.includes('optional')),
    ).toBe(true);
  });

  it('provides coverage percentages between 0 and 100', () => {
    const analysis = createMockAnalysis();
    const suite = createMockSuite(['add']);
    const prediction = predictCoverage(analysis, suite);

    expect(prediction.estimatedLineCoverage).toBeGreaterThanOrEqual(0);
    expect(prediction.estimatedLineCoverage).toBeLessThanOrEqual(100);
    expect(prediction.estimatedBranchCoverage).toBeGreaterThanOrEqual(0);
    expect(prediction.estimatedBranchCoverage).toBeLessThanOrEqual(100);
    expect(prediction.estimatedFunctionCoverage).toBeGreaterThanOrEqual(0);
    expect(prediction.estimatedFunctionCoverage).toBeLessThanOrEqual(100);
  });

  describe('formatCoverageReport', () => {
    it('formats a readable coverage report', () => {
      const prediction: CoveragePrediction = {
        filePath: '/src/utils.ts',
        estimatedLineCoverage: 85,
        estimatedBranchCoverage: 72,
        estimatedFunctionCoverage: 90,
        uncoveredPaths: ['divide error path'],
        suggestions: ['Add error path test for divide'],
      };

      const report = formatCoverageReport(prediction);
      expect(report).toContain('85%');
      expect(report).toContain('72%');
      expect(report).toContain('90%');
      expect(report).toContain('divide error path');
      expect(report).toContain('Add error path test');
    });
  });
});

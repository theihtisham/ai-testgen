import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateJsTsTestSuite } from '../src/generators/js-ts-generator.js';
import { generatePythonTestSuite } from '../src/generators/python-generator.js';
import { generateGoTestSuite } from '../src/generators/go-generator.js';
import { SourceAnalysis, TestFramework } from '../src/types.js';

function createTypeScriptAnalysis(): SourceAnalysis {
  return {
    filePath: '/src/math.ts',
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
        throws: ['Error("Division by zero")'],
        complexity: 2,
        hasSideEffects: false,
        startLine: 5,
        endLine: 9,
      },
      {
        name: 'fetchData',
        isAsync: true,
        isExported: true,
        params: [
          { name: 'url', type: 'string', optional: false, defaultValue: null },
        ],
        returnType: 'Promise<string>',
        throws: [],
        complexity: 1,
        hasSideEffects: true,
        startLine: 11,
        endLine: 14,
      },
    ],
    classes: [
      {
        name: 'Calculator',
        isExported: true,
        constructorParams: [
          { name: 'precision', type: 'number', optional: true, defaultValue: '2' },
        ],
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
            startLine: 18,
            endLine: 20,
          },
        ],
        properties: [
          { name: 'precision', type: 'number', visibility: 'public', isStatic: false, isReadonly: false },
        ],
        implements: [],
        extends: null,
      },
    ],
    interfaces: [
      {
        name: 'CalculatorOptions',
        isExported: true,
        properties: [
          { name: 'precision', type: 'number', optional: true },
        ],
        methods: [],
      },
    ],
    exports: [
      { name: 'add', type: 'function', filePath: '/src/math.ts' },
      { name: 'divide', type: 'function', filePath: '/src/math.ts' },
      { name: 'Calculator', type: 'class', filePath: '/src/math.ts' },
    ],
    imports: [
      { modulePath: 'lodash', namedImports: ['round'], defaultImport: null, isTypeOnly: false },
    ],
    dependencies: ['lodash'],
    linesOfCode: 30,
    cyclomaticComplexity: 5,
  };
}

function createPythonAnalysis(): SourceAnalysis {
  return {
    filePath: '/src/math.py',
    language: 'python',
    functions: [
      {
        name: 'add',
        isAsync: false,
        isExported: true,
        params: [
          { name: 'a', type: 'int', optional: false, defaultValue: null },
          { name: 'b', type: 'int', optional: false, defaultValue: null },
        ],
        returnType: 'int',
        throws: [],
        complexity: 1,
        hasSideEffects: false,
        startLine: 1,
        endLine: 2,
      },
    ],
    classes: [
      {
        name: 'Calculator',
        isExported: true,
        constructorParams: [
          { name: 'precision', type: 'int', optional: true, defaultValue: '2' },
        ],
        methods: [
          {
            name: 'round',
            isAsync: false,
            isExported: false,
            params: [
              { name: 'value', type: 'float', optional: false, defaultValue: null },
            ],
            returnType: 'float',
            throws: [],
            complexity: 1,
            hasSideEffects: false,
            startLine: 6,
            endLine: 7,
          },
        ],
        properties: [
          { name: 'precision', type: 'int', visibility: 'public', isStatic: false, isReadonly: false },
        ],
        implements: [],
        extends: null,
      },
    ],
    interfaces: [],
    exports: [
      { name: 'add', type: 'function', filePath: '/src/math.py' },
      { name: 'Calculator', type: 'class', filePath: '/src/math.py' },
    ],
    imports: [],
    dependencies: [],
    linesOfCode: 15,
    cyclomaticComplexity: 2,
  };
}

function createGoAnalysis(): SourceAnalysis {
  return {
    filePath: '/src/math.go',
    language: 'go',
    functions: [
      {
        name: 'Add',
        isAsync: false,
        isExported: true,
        params: [
          { name: 'a', type: 'int', optional: false, defaultValue: null },
          { name: 'b', type: 'int', optional: false, defaultValue: null },
        ],
        returnType: 'int',
        throws: [],
        complexity: 1,
        hasSideEffects: false,
        startLine: 3,
        endLine: 5,
      },
      {
        name: 'Divide',
        isAsync: false,
        isExported: true,
        params: [
          { name: 'a', type: 'int', optional: false, defaultValue: null },
          { name: 'b', type: 'int', optional: false, defaultValue: null },
        ],
        returnType: '(int, error)',
        throws: [],
        complexity: 2,
        hasSideEffects: false,
        startLine: 7,
        endLine: 11,
      },
    ],
    classes: [],
    interfaces: [],
    exports: [
      { name: 'Add', type: 'function', filePath: '/src/math.go' },
      { name: 'Divide', type: 'function', filePath: '/src/math.go' },
    ],
    imports: [],
    dependencies: [],
    linesOfCode: 15,
    cyclomaticComplexity: 3,
  };
}

describe('Test Generation', () => {
  describe('TypeScript/JavaScript Generator', () => {
    it('generates a complete test suite', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);

      expect(suite.language).toBe('typescript');
      expect(suite.framework).toBe('vitest');
      expect(suite.testCases.length).toBeGreaterThan(0);
      expect(suite.coverageEstimate).toBeGreaterThan(0);
    });

    it('generates test code as a string', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);
      const code = suite.imports[0]!;

      expect(code).toContain('describe');
      expect(code).toContain('it(');
      expect(code).toContain('expect');
    });

    it('includes import statements', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);
      const code = suite.imports[0]!;

      expect(code).toContain('import');
      expect(code).toContain('vitest');
    });

    it('generates tests for exported functions', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);

      const functionTests = suite.testCases.filter((tc) => tc.type === 'unit');
      expect(functionTests.length).toBeGreaterThan(0);
    });

    it('generates edge case tests', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);

      const edgeCases = suite.testCases.filter((tc) => tc.type === 'edge-case');
      expect(edgeCases.length).toBeGreaterThan(0);
    });

    it('generates class tests', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);

      const classTests = suite.testCases.filter((tc) => tc.name.includes('Calculator'));
      expect(classTests.length).toBeGreaterThan(0);
    });

    it('supports jest framework', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'jest', 10);
      const code = suite.imports[0]!;

      expect(code).toContain('@jest/globals');
    });

    it('supports vitest framework', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);
      const code = suite.imports[0]!;

      expect(code).toContain('vitest');
    });

    it('generates setup and teardown code', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);

      // Should have some form of setup (mocks)
      expect(suite.setupCode).toBeDefined();
      expect(suite.teardownCode).toBeDefined();
    });
  });

  describe('Python Generator', () => {
    it('generates a pytest test suite', () => {
      const analysis = createPythonAnalysis();
      const suite = generatePythonTestSuite(analysis, 'pytest', 10);

      expect(suite.language).toBe('python');
      expect(suite.framework).toBe('pytest');
      expect(suite.testCases.length).toBeGreaterThan(0);
    });

    it('generates valid Python test code', () => {
      const analysis = createPythonAnalysis();
      const suite = generatePythonTestSuite(analysis, 'pytest', 10);
      const code = suite.imports[0]!;

      expect(code).toContain('import pytest');
      expect(code).toContain('def test_');
    });

    it('generates class tests', () => {
      const analysis = createPythonAnalysis();
      const suite = generatePythonTestSuite(analysis, 'pytest', 10);

      const classTests = suite.testCases.filter((tc) => tc.name.includes('Calculator'));
      expect(classTests.length).toBeGreaterThan(0);
    });
  });

  describe('Go Generator', () => {
    it('generates a Go test suite', () => {
      const analysis = createGoAnalysis();
      const suite = generateGoTestSuite(analysis, 'go-test', 10);

      expect(suite.language).toBe('go');
      expect(suite.framework).toBe('go-test');
      expect(suite.testCases.length).toBeGreaterThan(0);
    });

    it('generates valid Go test code', () => {
      const analysis = createGoAnalysis();
      const suite = generateGoTestSuite(analysis, 'go-test', 10);
      const code = suite.imports[0]!;

      expect(code).toContain('package ');
      expect(code).toContain('import');
      expect(code).toContain('testing');
      expect(code).toContain('func Test');
    });

    it('generates error tests for functions returning error', () => {
      const analysis = createGoAnalysis();
      const suite = generateGoTestSuite(analysis, 'go-test', 10);

      const errorTests = suite.testCases.filter((tc) => tc.name.includes('Error'));
      expect(errorTests.length).toBeGreaterThan(0);
    });
  });

  describe('Coverage Estimation', () => {
    it('provides a coverage estimate between 0 and 100', () => {
      const analysis = createTypeScriptAnalysis();
      const suite = generateJsTsTestSuite(analysis, 'vitest', 10);

      expect(suite.coverageEstimate).toBeGreaterThanOrEqual(0);
      expect(suite.coverageEstimate).toBeLessThanOrEqual(100);
    });

    it('higher test count generally means higher coverage', () => {
      const analysis = createTypeScriptAnalysis();
      const suite1 = generateJsTsTestSuite(analysis, 'vitest', 3);
      const suite2 = generateJsTsTestSuite(analysis, 'vitest', 20);

      // More tests per function should not decrease coverage estimate
      expect(suite2.testCases.length).toBeGreaterThanOrEqual(suite1.testCases.length);
    });
  });
});

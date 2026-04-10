import {
  SourceAnalysis,
  SupportedLanguage,
  AnalyzedFunction,
  TestCase,
  MockDefinition,
} from '../types.js';
import { analyzeTsSource } from './js-ts-analyzer.js';
import { analyzePythonSource } from './python-analyzer.js';
import { analyzeGoSource } from './go-analyzer.js';

export function analyzeSource(filePath: string, language: SupportedLanguage): SourceAnalysis {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return analyzeTsSource(filePath, language);
    case 'python':
      return analyzePythonSource(filePath);
    case 'go':
      return analyzeGoSource(filePath);
    case 'rust':
      throw new Error('Rust analysis is not yet supported. Use AI mode for Rust files.');
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

export function detectEdgeCases(fn: AnalyzedFunction): TestCase[] {
  const cases: TestCase[] = [];

  for (const param of fn.params) {
    if (param.optional) {
      cases.push({
        name: `${fn.name} handles undefined ${param.name}`,
        type: 'edge-case',
        description: `Test that ${fn.name} gracefully handles undefined ${param.name}`,
        code: '',
        expectedBehavior: 'Should handle undefined parameter without throwing',
        inputDescription: `${param.name} is undefined`,
        tags: ['edge-case', 'undefined', param.name],
      });
    }

    if (param.type && (param.type.includes('string') || param.type.includes('String'))) {
      cases.push(
        createEdgeCase(fn.name, param.name, 'empty string', '""', 'Should handle empty string input'),
        createEdgeCase(fn.name, param.name, 'very long string', '"a".repeat(10000)', 'Should handle very long string'),
        createEdgeCase(fn.name, param.name, 'string with special characters', '"\\n\\t\\0\\r"', 'Should handle special characters'),
      );
    }

    if (param.type && (param.type.includes('number') || param.type.includes('Number'))) {
      cases.push(
        createEdgeCase(fn.name, param.name, 'zero', '0', 'Should handle zero value'),
        createEdgeCase(fn.name, param.name, 'negative number', '-1', 'Should handle negative numbers'),
        createEdgeCase(fn.name, param.name, 'very large number', 'Number.MAX_SAFE_INTEGER', 'Should handle large numbers'),
        createEdgeCase(fn.name, param.name, 'NaN', 'NaN', 'Should handle NaN'),
        createEdgeCase(fn.name, param.name, 'Infinity', 'Infinity', 'Should handle Infinity'),
      );
    }

    if (param.type && (param.type.includes('Array') || param.type.includes('[]'))) {
      cases.push(
        createEdgeCase(fn.name, param.name, 'empty array', '[]', 'Should handle empty array'),
        createEdgeCase(fn.name, param.name, 'array with single element', '[item]', 'Should handle single-element array'),
        createEdgeCase(fn.name, param.name, 'very large array', 'Array(10000).fill(item)', 'Should handle large arrays'),
      );
    }

    if (param.type && (param.type.includes('object') || param.type.includes('Object') || param.type.includes('{'))) {
      cases.push(
        createEdgeCase(fn.name, param.name, 'empty object', '{}', 'Should handle empty object'),
        createEdgeCase(fn.name, param.name, 'null', 'null', 'Should handle null'),
      );
    }
  }

  if (fn.throws.length > 0) {
    for (const throws of fn.throws) {
      cases.push({
        name: `${fn.name} throws for invalid input`,
        type: 'edge-case',
        description: `Test that ${fn.name} throws when given invalid input`,
        code: '',
        expectedBehavior: `Should throw ${throws}`,
        inputDescription: 'Invalid input that triggers error',
        tags: ['edge-case', 'error-path'],
      });
    }
  }

  if (fn.isAsync) {
    cases.push({
      name: `${fn.name} handles rejection`,
      type: 'edge-case',
      description: `Test that ${fn.name} properly handles promise rejection`,
      code: '',
      expectedBehavior: 'Should handle promise rejection gracefully',
      inputDescription: 'Input that causes promise rejection',
      tags: ['edge-case', 'async'],
    });
  }

  return cases;
}

function createEdgeCase(
  fnName: string,
  paramName: string,
  caseName: string,
  value: string,
  expected: string,
): TestCase {
  return {
    name: `${fnName} handles ${caseName} for ${paramName}`,
    type: 'edge-case',
    description: `Test ${fnName} with ${caseName} for parameter ${paramName}`,
    code: '',
    expectedBehavior: expected,
    inputDescription: `${paramName} = ${value}`,
    tags: ['edge-case', caseName.replace(/\s+/g, '-')],
  };
}

export function detectMocks(analysis: SourceAnalysis): MockDefinition[] {
  const mocks: MockDefinition[] = [];

  for (const imp of analysis.imports) {
    if (imp.isTypeOnly) continue;

    if (!imp.modulePath.startsWith('.') && imp.namedImports.length > 0) {
      for (const named of imp.namedImports) {
        const isLikelyDependency =
          !imp.modulePath.startsWith('node:') &&
          !['path', 'fs', 'os', 'util', 'events', 'stream', 'http', 'https', 'crypto'].includes(
            imp.modulePath,
          );

        if (isLikelyDependency) {
          mocks.push({
            moduleName: imp.modulePath,
            mockName: `mock${named.charAt(0).toUpperCase() + named.slice(1)}`,
            setup: `jest.mock('${imp.modulePath}');`,
            teardown: null,
            implementations: {
              [named]: `jest.fn()`,
            },
          });
        }
      }
    }
  }

  return mocks;
}

export interface DependencyGraph {
  files: Map<string, string[]>;
  reverse: Map<string, string[]>;
}

export function buildDependencyGraph(analyses: SourceAnalysis[]): DependencyGraph {
  const files = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();

  for (const analysis of analyses) {
    const deps: string[] = [];
    for (const dep of analysis.dependencies) {
      if (dep.startsWith('.')) {
        deps.push(dep);
        const rev = reverse.get(dep) ?? [];
        rev.push(analysis.filePath);
        reverse.set(dep, rev);
      }
    }
    files.set(analysis.filePath, deps);
  }

  return { files, reverse };
}

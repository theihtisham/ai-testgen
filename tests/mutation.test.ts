import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generateMutants,
  applyMutant,
  calculateMutationScore,
} from '../src/mutation/mutator.js';

describe('Mutation Testing', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-mutation-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateMutants', () => {
    it('generates arithmetic operator mutants for TypeScript', () => {
      const filePath = path.join(tempDir, 'math.ts');
      fs.writeFileSync(filePath, `
export function add(a: number, b: number): number {
  return a + b;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 4,
        cyclomaticComplexity: 1,
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some((m) => m.type === 'arithmetic-operator')).toBe(true);
    });

    it('generates comparison operator mutants', () => {
      const filePath = path.join(tempDir, 'compare.ts');
      fs.writeFileSync(filePath, `
export function isGreater(a: number, b: number): boolean {
  return a > b;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 4,
        cyclomaticComplexity: 1,
      });

      expect(mutants.some((m) => m.type === 'comparison-operator')).toBe(true);
    });

    it('generates logical operator mutants', () => {
      const filePath = path.join(tempDir, 'logic.ts');
      fs.writeFileSync(filePath, `
export function isValid(a: boolean, b: boolean): boolean {
  return a && b;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 4,
        cyclomaticComplexity: 1,
      });

      expect(mutants.some((m) => m.type === 'logical-operator')).toBe(true);
    });

    it('generates boolean literal mutants', () => {
      const filePath = path.join(tempDir, 'bool.ts');
      fs.writeFileSync(filePath, `
export function alwaysTrue(): boolean {
  return true;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 4,
        cyclomaticComplexity: 1,
      });

      expect(mutants.some((m) => m.type === 'boolean-literal')).toBe(true);
    });

    it('generates string literal mutants', () => {
      const filePath = path.join(tempDir, 'string.ts');
      fs.writeFileSync(filePath, `
export function greet(name: string): string {
  return "Hello, " + name;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 4,
        cyclomaticComplexity: 1,
      });

      expect(mutants.some((m) => m.type === 'string-literal')).toBe(true);
    });

    it('generates Python-specific mutants', () => {
      const filePath = path.join(tempDir, 'math.py');
      fs.writeFileSync(filePath, `
def is_valid(a: int, b: int) -> bool:
    return a > 0 and b > 0
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'python',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 3,
        cyclomaticComplexity: 1,
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some((m) => m.type === 'comparison-operator' || m.type === 'logical-operator')).toBe(true);
    });

    it('skips comment lines', () => {
      const filePath = path.join(tempDir, 'commented.ts');
      fs.writeFileSync(filePath, `
// This is a comment
export function add(a: number, b: number): number {
  return a + b;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 5,
        cyclomaticComplexity: 1,
      });

      // Should not generate mutants for the comment line
      for (const mutant of mutants) {
        expect(mutant.line).not.toBe(1);
      }
    });

    it('skips import lines', () => {
      const filePath = path.join(tempDir, 'imports.ts');
      fs.writeFileSync(filePath, `import { something } from 'module';
export function add(a: number, b: number): number {
  return a + b;
}
`);
      const mutants = generateMutants(filePath, {
        filePath,
        language: 'typescript',
        functions: [],
        classes: [],
        interfaces: [],
        exports: [],
        imports: [],
        dependencies: [],
        linesOfCode: 4,
        cyclomaticComplexity: 1,
      });

      for (const mutant of mutants) {
        expect(mutant.line).not.toBe(1);
      }
    });
  });

  describe('applyMutant', () => {
    it('correctly applies a mutation to source code', () => {
      const source = `return a + b;`;
      const mutant = {
        id: 'test-1',
        sourceFile: 'test.ts',
        line: 1,
        column: 9,
        originalCode: '+',
        mutatedCode: '-',
        type: 'arithmetic-operator' as const,
        status: 'pending' as const,
      };

      const mutated = applyMutant(source, mutant);
      expect(mutated).toBe('return a - b;');
    });

    it('only modifies the specified line', () => {
      const source = `line one\nreturn a + b;\nline three`;
      const mutant = {
        id: 'test-1',
        sourceFile: 'test.ts',
        line: 2,
        column: 9,
        originalCode: '+',
        mutatedCode: '-',
        type: 'arithmetic-operator' as const,
        status: 'pending' as const,
      };

      const mutated = applyMutant(source, mutant);
      const lines = mutated.split('\n');
      expect(lines[0]).toBe('line one');
      expect(lines[1]).toBe('return a - b;');
      expect(lines[2]).toBe('line three');
    });
  });

  describe('calculateMutationScore', () => {
    it('calculates correct scores', () => {
      const mutants = [
        { id: '1', sourceFile: '', line: 1, column: 0, originalCode: '+', mutatedCode: '-', type: 'arithmetic-operator' as const, status: 'killed' as const },
        { id: '2', sourceFile: '', line: 2, column: 0, originalCode: '+', mutatedCode: '-', type: 'arithmetic-operator' as const, status: 'killed' as const },
        { id: '3', sourceFile: '', line: 3, column: 0, originalCode: '+', mutatedCode: '-', type: 'arithmetic-operator' as const, status: 'survived' as const },
        { id: '4', sourceFile: '', line: 4, column: 0, originalCode: '+', mutatedCode: '-', type: 'arithmetic-operator' as const, status: 'survived' as const },
      ];

      const result = calculateMutationScore(mutants);
      expect(result.total).toBe(4);
      expect(result.killed).toBe(2);
      expect(result.survived).toBe(2);
      expect(result.mutationScore).toBe(50);
    });

    it('handles empty mutant list', () => {
      const result = calculateMutationScore([]);
      expect(result.total).toBe(0);
      expect(result.mutationScore).toBe(0);
    });

    it('handles all killed', () => {
      const mutants = [
        { id: '1', sourceFile: '', line: 1, column: 0, originalCode: '+', mutatedCode: '-', type: 'arithmetic-operator' as const, status: 'killed' as const },
        { id: '2', sourceFile: '', line: 2, column: 0, originalCode: '+', mutatedCode: '-', type: 'arithmetic-operator' as const, status: 'killed' as const },
      ];

      const result = calculateMutationScore(mutants);
      expect(result.mutationScore).toBe(100);
    });
  });
});

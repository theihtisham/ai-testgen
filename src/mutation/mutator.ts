import {
  Mutant,
  MutationType,
  MutationResult,
  SourceAnalysis,
  SupportedLanguage,
} from '../types.js';
import { readFile } from '../utils/file.js';

// Mutations stored as [search, replacement] pairs.
// We use indexOf-based matching to avoid regex backtracking issues.
const ARITHMETIC_MUTATIONS: [string, string][] = [
  ['+', '-'],
  ['-', '+'],
  ['*', '/'],
  ['/', '*'],
  ['%', '*'],
  ['**', '*'],
];

const COMPARISON_MUTATIONS: [string, string][] = [
  ['===', '!=='],
  ['!==', '==='],
  ['==', '!='],
  ['!=', '=='],
  ['>', '<='],
  ['<', '>='],
  ['>=', '<'],
  ['<=', '>'],
];

const LOGICAL_MUTATIONS: [string, string][] = [
  ['&&', '||'],
  ['||', '&&'],
];

const PYTHON_COMPARISON_MUTATIONS: Record<string, string> = {
  '==': '!=',
  '!=': '==',
  '>': '<=',
  '<': '>=',
  '>=': '<',
  '<=': '>',
  'is': 'is not',
  'is not': 'is',
  'in': 'not in',
};

const PYTHON_LOGICAL_MUTATIONS: Record<string, string> = {
  'and': 'or',
  'or': 'and',
};

export function generateMutants(
  filePath: string,
  analysis: SourceAnalysis,
): Mutant[] {
  const mutants: Mutant[] = [];
  const content = readFile(filePath);
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    const trimmed = line.trim();

    // Skip comments, strings, empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed === '') {
      continue;
    }

    // Skip import lines
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      continue;
    }

    if (analysis.language === 'python') {
      mutants.push(...generatePythonMutants(line, lineIndex, filePath));
    } else {
      mutants.push(...generateJsTsStyleMutants(line, lineIndex, filePath, analysis.language));
    }
  }

  return mutants;
}

function generateJsTsStyleMutants(
  line: string,
  lineIndex: number,
  filePath: string,
  _language: SupportedLanguage,
): Mutant[] {
  const mutants: Mutant[] = [];
  let mutantId = 0;
  const MAX_MUTANTS_PER_LINE = 10;

  // Arithmetic operators — use indexOf to avoid regex backtracking
  for (const [op, replacement] of ARITHMETIC_MUTATIONS) {
    const idx = line.indexOf(op);
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, op, replacement,
        'arithmetic-operator', mutantId++,
      ));
    }
    if (mutantId >= MAX_MUTANTS_PER_LINE) break;
  }

  // Comparison operators — check longest first to avoid partial matches
  for (const [op, replacement] of COMPARISON_MUTATIONS) {
    if (mutantId >= MAX_MUTANTS_PER_LINE) break;
    const idx = line.indexOf(op);
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, op, replacement,
        'comparison-operator', mutantId++,
      ));
    }
  }

  // Logical operators
  for (const [op, replacement] of LOGICAL_MUTATIONS) {
    if (mutantId >= MAX_MUTANTS_PER_LINE) break;
    const idx = line.indexOf(op);
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, op, replacement,
        'logical-operator', mutantId++,
      ));
    }
  }

  // Boolean literal mutations
  if (mutantId < MAX_MUTANTS_PER_LINE && /\btrue\b/.test(line)) {
    const idx = line.indexOf('true');
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, 'true', 'false',
        'boolean-literal', mutantId++,
      ));
    }
  }
  if (mutantId < MAX_MUTANTS_PER_LINE && /\bfalse\b/.test(line)) {
    const idx = line.indexOf('false');
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, 'false', 'true',
        'boolean-literal', mutantId++,
      ));
    }
  }

  // String literal mutations
  if (mutantId < MAX_MUTANTS_PER_LINE) {
    const stringMatches = [...line.matchAll(/(["'`])(?:(?!\1).)*\1/g)];
    for (const sm of stringMatches) {
      if (mutantId >= MAX_MUTANTS_PER_LINE) break;
      if (sm.index !== undefined && sm[0]!.length > 2) {
        const original = sm[0]!;
        const quote = original[0]!;
        const mutated = `${quote}${quote}`;
        mutants.push(createMutant(
          filePath, lineIndex, sm.index, original, mutated,
          'string-literal', mutantId++,
        ));
      }
    }
  }

  return mutants;
}

function generatePythonMutants(
  line: string,
  lineIndex: number,
  filePath: string,
): Mutant[] {
  const mutants: Mutant[] = [];
  let mutantId = 0;
  const MAX_MUTANTS_PER_LINE = 10;

  // Comparison operators
  for (const [op, replacement] of Object.entries(PYTHON_COMPARISON_MUTATIONS)) {
    if (mutantId >= MAX_MUTANTS_PER_LINE) break;
    const idx = line.indexOf(op);
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, op, replacement,
        'comparison-operator', mutantId++,
      ));
    }
  }

  // Logical operators
  for (const [op, replacement] of Object.entries(PYTHON_LOGICAL_MUTATIONS)) {
    if (mutantId >= MAX_MUTANTS_PER_LINE) break;
    const idx = line.indexOf(op);
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, op, replacement,
        'logical-operator', mutantId++,
      ));
    }
  }

  // Boolean mutations
  if (mutantId < MAX_MUTANTS_PER_LINE && /\bTrue\b/.test(line)) {
    const idx = line.indexOf('True');
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, 'True', 'False',
        'boolean-literal', mutantId++,
      ));
    }
  }
  if (mutantId < MAX_MUTANTS_PER_LINE && /\bFalse\b/.test(line)) {
    const idx = line.indexOf('False');
    if (idx >= 0) {
      mutants.push(createMutant(
        filePath, lineIndex, idx, 'False', 'True',
        'boolean-literal', mutantId++,
      ));
    }
  }

  // Arithmetic
  for (const [op, replacement] of ARITHMETIC_MUTATIONS) {
    if (mutantId >= MAX_MUTANTS_PER_LINE) break;
    if (line.includes(op)) {
      const idx = line.indexOf(op);
      mutants.push(createMutant(
        filePath, lineIndex, idx, op, replacement,
        'arithmetic-operator', mutantId++,
      ));
    }
  }

  return mutants;
}

function createMutant(
  filePath: string,
  line: number,
  column: number,
  originalCode: string,
  mutatedCode: string,
  type: MutationType,
  id: number,
): Mutant {
  return {
    id: `mutant-${line}-${column}-${id}`,
    sourceFile: filePath,
    line: line + 1,
    column,
    originalCode,
    mutatedCode,
    type,
    status: 'pending',
  };
}

export function applyMutant(sourceContent: string, mutant: Mutant): string {
  const lines = sourceContent.split('\n');
  const line = lines[mutant.line - 1];
  if (!line) return sourceContent;

  // Replace first occurrence on the line
  const before = line.substring(0, mutant.column);
  const after = line.substring(mutant.column + mutant.originalCode.length);
  lines[mutant.line - 1] = before + mutant.mutatedCode + after;

  return lines.join('\n');
}

export function calculateMutationScore(results: Mutant[]): MutationResult {
  const killed = results.filter((m) => m.status === 'killed').length;
  const survived = results.filter((m) => m.status === 'survived').length;
  const timeout = results.filter((m) => m.status === 'timeout').length;
  const errors = results.filter((m) => m.status === 'error').length;
  const total = results.length;

  return {
    total,
    killed,
    survived,
    timeout,
    errors,
    mutationScore: total > 0 ? Math.round((killed / total) * 100) : 0,
    mutants: results,
  };
}

export function formatMutationReport(result: MutationResult): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('  Mutation Testing Report');
  lines.push('  ======================');
  lines.push(`  Total mutants:    ${result.total}`);
  lines.push(`  Killed:           ${result.killed}`);
  lines.push(`  Survived:         ${result.survived}`);
  lines.push(`  Timeout:          ${result.timeout}`);
  lines.push(`  Errors:           ${result.errors}`);
  lines.push(`  Mutation score:   ${result.mutationScore}%`);
  lines.push('');

  if (result.survived > 0) {
    lines.push('  Survived mutants (tests may be insufficient):');
    for (const m of result.mutants.filter((m) => m.status === 'survived').slice(0, 10)) {
      lines.push(`    [${m.type}] ${m.sourceFile}:${m.line} | ${m.originalCode} -> ${m.mutatedCode}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

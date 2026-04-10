import * as fs from 'fs';
import {
  SourceAnalysis,
  AnalyzedFunction,
  AnalyzedClass,
  AnalyzedExport,
  ImportInfo,
  FunctionParam,
  ClassProperty,
} from '../types.js';

export function analyzePythonSource(filePath: string): SourceAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  return {
    filePath,
    language: 'python',
    functions: extractPythonFunctions(content),
    classes: extractPythonClasses(content),
    interfaces: [],
    exports: extractPythonExports(content),
    imports: extractPythonImports(content),
    dependencies: extractPythonImports(content).map((imp) => imp.modulePath),
    linesOfCode: lines.length,
    cyclomaticComplexity: calculatePythonComplexity(content),
  };
}

function extractPythonFunctions(content: string): AnalyzedFunction[] {
  const functions: AnalyzedFunction[] = [];
  const funcRegex = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/gm;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    const indent = match[1]!.length;
    const name = match[2]!;
    const paramsStr = match[3] ?? '';
    const returnType = match[4]?.trim() ?? null;
    const isAsync = content.substring(match.index, match.index + 20).includes('async');

    const params = parsePythonParams(paramsStr);

    const startLine = content.substring(0, match.index).split('\n').length;
    const body = extractPythonBody(content, match.index);
    const endLine = startLine + body.split('\n').length - 1;

    functions.push({
      name,
      isAsync,
      isExported: indent === 0,
      params,
      returnType,
      throws: extractPythonRaises(body),
      complexity: calculatePythonComplexity(body),
      hasSideEffects: detectPythonSideEffects(body),
      startLine,
      endLine,
    });
  }

  return functions;
}

function extractPythonClasses(content: string): AnalyzedClass[] {
  const classes: AnalyzedClass[] = [];
  const classRegex = /^class\s+(\w+)(?:\(([^)]+)\))?\s*:/gm;
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(content)) !== null) {
    const name = match[1]!;
    const bases = match[2]?.split(',').map((s) => s.trim()) ?? [];
    const startLine = content.substring(0, match.index).split('\n').length;
    const body = extractPythonBody(content, match.index);

    const methods = extractPythonMethods(body, startLine);
    const constructorParams = methods.find((m) => m.name === '__init__')?.params ?? [];

    classes.push({
      name,
      isExported: true,
      constructorParams,
      methods,
      properties: extractPythonProperties(body),
      implements: [],
      extends: bases[0] ?? null,
    });
  }

  return classes;
}

function extractPythonMethods(body: string, baseLine: number): AnalyzedFunction[] {
  const methods: AnalyzedFunction[] = [];
  const methodRegex = /^\s+(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/gm;
  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(body)) !== null) {
    const name = match[1]!;
    const paramsStr = match[2] ?? '';
    const returnType = match[3]?.trim() ?? null;
    const isAsync = body.substring(match.index, match.index + 30).includes('async');

    const params = parsePythonParams(paramsStr);
    const methodBody = extractPythonBody(body, match.index);
    const methodStartLine = baseLine + body.substring(0, match.index).split('\n').length;

    methods.push({
      name,
      isAsync,
      isExported: false,
      params,
      returnType,
      throws: extractPythonRaises(methodBody),
      complexity: calculatePythonComplexity(methodBody),
      hasSideEffects: detectPythonSideEffects(methodBody),
      startLine: methodStartLine,
      endLine: methodStartLine + methodBody.split('\n').length - 1,
    });
  }

  return methods;
}

function extractPythonProperties(body: string): ClassProperty[] {
  const props: ClassProperty[] = [];
  const selfAssignRegex = /self\.(\w+)\s*=/g;
  let match: RegExpExecArray | null;

  while ((match = selfAssignRegex.exec(body)) !== null) {
    const name = match[1]!;
    if (!props.some((p) => p.name === name)) {
      props.push({
        name,
        type: null,
        visibility: 'public',
        isStatic: false,
        isReadonly: false,
      });
    }
  }

  return props;
}

function parsePythonParams(paramsStr: string): FunctionParam[] {
  if (!paramsStr.trim()) return [];

  return paramsStr.split(',').map((param): FunctionParam => {
    const trimmed = param.trim();
    if (!trimmed || trimmed === 'self' || trimmed === 'cls') {
      return { name: trimmed || 'self', type: null, optional: true, defaultValue: null };
    }

    const hasDefault = trimmed.includes('=');
    const hasType = trimmed.includes(':');

    let name = trimmed;
    let type: string | null = null;
    let defaultValue: string | null = null;

    if (hasType) {
      const parts = trimmed.split(':');
      name = parts[0]!.trim();
      const rest = parts.slice(1).join(':').trim();
      if (rest.includes('=')) {
        const typeParts = rest.split('=');
        type = typeParts[0]!.trim();
        defaultValue = typeParts.slice(1).join('=').trim();
      } else {
        type = rest;
      }
    } else if (hasDefault) {
      const parts = trimmed.split('=');
      name = parts[0]!.trim();
      defaultValue = parts.slice(1).join('=').trim();
    }

    return {
      name,
      type,
      optional: hasDefault || trimmed.startsWith('*'),
      defaultValue,
    };
  }).filter((p) => p.name !== 'self' && p.name !== 'cls');
}

function extractPythonBody(content: string, startIndex: number): string {
  const afterMatch = content.substring(startIndex);
  const bodyLines = afterMatch.split('\n');
  if (bodyLines.length <= 1) return '';

  let baseIndent = 0;
  for (let i = 1; i < bodyLines.length; i++) {
    const indentMatch = bodyLines[i]!.match(/^(\s*)\S/);
    if (indentMatch) {
      baseIndent = indentMatch[1]!.length;
      break;
    }
  }

  const result: string[] = [];
  for (let i = 1; i < bodyLines.length; i++) {
    const line = bodyLines[i]!;
    if (line.trim() === '') {
      result.push(line);
      continue;
    }
    const indentMatch = line.match(/^(\s*)\S/);
    if (indentMatch && indentMatch[1]!.length >= baseIndent && baseIndent > 0) {
      result.push(line);
    } else if (indentMatch && indentMatch[1]!.length < baseIndent && baseIndent > 0) {
      break;
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function extractPythonRaises(body: string): string[] {
  const raises: string[] = [];
  const raiseRegex = /raise\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = raiseRegex.exec(body)) !== null) {
    if (!raises.includes(match[1]!)) {
      raises.push(match[1]!);
    }
  }
  return raises;
}

function calculatePythonComplexity(code: string): number {
  let complexity = 1;
  const patterns = [
    /\bif\b/g,
    /\belif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bexcept\b/g,
    /\band\b/g,
    /\bor\b/g,
    /\bnot\b/g,
    /\bwith\b/g,
  ];
  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function detectPythonSideEffects(code: string): boolean {
  const patterns = [
    /\bprint\(/,
    /\bopen\(/,
    /\bos\.\w+/,
    /\brequests\.\w+/,
    /\brandom\.\w+/,
    /\bdatetime\.\w+/,
    /\bdb\.\w+/,
    /\.append\(/,
    /\.extend\(/,
  ];
  return patterns.some((p) => p.test(code));
}

function extractPythonExports(content: string): AnalyzedExport[] {
  const exports: AnalyzedExport[] = [];
  const funcRegex = /^(?:async\s+)?def\s+(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push({ name: match[1]!, type: 'function', filePath: '' });
  }
  const classRegex = /^class\s+(\w+)/gm;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push({ name: match[1]!, type: 'class', filePath: '' });
  }
  return exports;
}

function extractPythonImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex = /^import\s+(\S+)|^from\s+(\S+)\s+import\s+(.+)/gm;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push({
        modulePath: match[1],
        namedImports: [],
        defaultImport: null,
        isTypeOnly: false,
      });
    } else if (match[2] && match[3]) {
      imports.push({
        modulePath: match[2],
        namedImports: match[3].split(',').map((s) => s.trim()),
        defaultImport: null,
        isTypeOnly: false,
      });
    }
  }
  return imports;
}

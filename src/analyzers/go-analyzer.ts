import * as fs from 'fs';
import {
  SourceAnalysis,
  AnalyzedFunction,
  AnalyzedInterface,
  AnalyzedExport,
  ImportInfo,
  FunctionParam,
} from '../types.js';

export function analyzeGoSource(filePath: string): SourceAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  return {
    filePath,
    language: 'go',
    functions: extractGoFunctions(content),
    classes: [],
    interfaces: extractGoInterfaces(content),
    exports: extractGoExports(content),
    imports: extractGoImports(content),
    dependencies: extractGoImports(content).map((imp) => imp.modulePath),
    linesOfCode: lines.length,
    cyclomaticComplexity: calculateGoComplexity(content),
  };
}

function extractGoFunctions(content: string): AnalyzedFunction[] {
  const functions: AnalyzedFunction[] = [];
  // Match: func [receiver] name(params) [returnType] {
  const funcRegex = /^func\s+(?:\(\w+\s+\*?\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)\s*(.*?)\s*\{/gm;
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1]!;
    const paramsStr = match[2] ?? '';
    const returnTypeRaw = match[3]?.trim() ?? '';
    // Strip surrounding parens from return type if present
    const returnTypes = returnTypeRaw
      ? (returnTypeRaw.startsWith('(') && returnTypeRaw.endsWith(')')
        ? returnTypeRaw.slice(1, -1).trim()
        : returnTypeRaw)
      : null;

    const params = parseGoParams(paramsStr);
    const startLine = content.substring(0, match.index).split('\n').length;
    const body = extractGoBody(content, match.index);
    const endLine = startLine + body.split('\n').length - 1;
    const isExported = name[0] === name[0]!.toUpperCase();

    functions.push({
      name,
      isAsync: false,
      isExported,
      params,
      returnType: returnTypes,
      throws: [],
      complexity: calculateGoComplexity(body),
      hasSideEffects: detectGoSideEffects(body),
      startLine,
      endLine,
    });
  }

  return functions;
}

function parseGoParams(paramsStr: string): FunctionParam[] {
  if (!paramsStr.trim()) return [];

  const params: FunctionParam[] = [];
  const parts = paramsStr.split(',');
  let pendingNames: string[] = [];
  let pendingType: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(/\s+/);
    if (tokens.length === 1) {
      pendingNames.push(tokens[0]!);
    } else {
      pendingNames.push(tokens[0]!);
      pendingType = tokens.slice(1).join(' ');
      for (const name of pendingNames) {
        params.push({ name, type: pendingType, optional: false, defaultValue: null });
      }
      pendingNames = [];
      pendingType = null;
    }
  }

  if (pendingNames.length > 0) {
    for (const name of pendingNames) {
      params.push({ name, type: pendingType, optional: false, defaultValue: null });
    }
  }

  return params;
}

function extractGoBody(content: string, startIndex: number): string {
  const afterMatch = content.substring(startIndex);
  let braceCount = 0;
  let bodyStart = -1;

  for (let i = 0; i < afterMatch.length; i++) {
    if (afterMatch[i] === '{') {
      if (braceCount === 0) bodyStart = i + 1;
      braceCount++;
    } else if (afterMatch[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        return afterMatch.substring(bodyStart > 0 ? bodyStart : 0, i);
      }
    }
  }

  return afterMatch.substring(bodyStart > 0 ? bodyStart : 0);
}

function extractGoInterfaces(content: string): AnalyzedInterface[] {
  const interfaces: AnalyzedInterface[] = [];
  const ifaceRegex = /type\s+(\w+)\s+interface\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ifaceRegex.exec(content)) !== null) {
    const name = match[1]!;
    const body = match[2] ?? '';
    const methods: { name: string; params: FunctionParam[]; returnType: string | null }[] = [];

    const methodRegex = /(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\))?/g;
    let m: RegExpExecArray | null;
    while ((m = methodRegex.exec(body)) !== null) {
      methods.push({
        name: m[1]!,
        params: parseGoParams(m[2] ?? ''),
        returnType: m[3]?.trim() ?? null,
      });
    }

    interfaces.push({
      name,
      isExported: name[0] === name[0]!.toUpperCase(),
      properties: [],
      methods,
    });
  }

  return interfaces;
}

function extractGoExports(content: string): AnalyzedExport[] {
  const exports: AnalyzedExport[] = [];
  const funcRegex = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1]!;
    if (name[0] === name[0]!.toUpperCase()) {
      exports.push({ name, type: 'function', filePath: '' });
    }
  }
  return exports;
}

function extractGoImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const singleImport = /^import\s+"([^"]+)"/gm;
  let match: RegExpExecArray | null;
  while ((match = singleImport.exec(content)) !== null) {
    imports.push({
      modulePath: match[1]!,
      namedImports: [],
      defaultImport: null,
      isTypeOnly: false,
    });
  }

  const multiImport = /import\s*\(([^)]+)\)/gs;
  while ((match = multiImport.exec(content)) !== null) {
    const block = match[1] ?? '';
    const blockLines = block.split('\n');
    for (const line of blockLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      const importMatch = trimmed.match(/"([^"]+)"/);
      if (importMatch) {
        imports.push({
          modulePath: importMatch[1]!,
          namedImports: [],
          defaultImport: null,
          isTypeOnly: false,
        });
      }
    }
  }

  return imports;
}

function calculateGoComplexity(code: string): number {
  let complexity = 1;
  const patterns = [
    /\bif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bcase\b/g,
    /\bswitch\b/g,
    /\bselect\b/g,
    /&&/g,
    /\|\|/g,
    /\brange\b/g,
  ];
  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function detectGoSideEffects(code: string): boolean {
  const patterns = [
    /\bfmt\.\w+\(/,
    /\bos\.\w+/,
    /\bio\.\w+/,
    /\bhttp\.\w+/,
    /\brand\.\w+/,
    /\btime\.\w+/,
    /\blog\.\w+/,
    /\bappend\(/,
  ];
  return patterns.some((p) => p.test(code));
}

import * as fs from 'fs';
import {
  Project,
  SourceFile,
  SyntaxKind,
  FunctionDeclaration,
  MethodDeclaration,
  VariableDeclaration,
  ArrowFunction,
  FunctionExpression,
  Block,
  Node,
} from 'ts-morph';
import {
  SourceAnalysis,
  AnalyzedFunction,
  AnalyzedClass,
  AnalyzedInterface,
  AnalyzedExport,
  ImportInfo,
  FunctionParam,
  ClassProperty,
  SupportedLanguage,
} from '../types.js';

export function analyzeTsSource(
  filePath: string,
  language: SupportedLanguage,
): SourceAnalysis {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      strict: true,
      noEmit: true,
    },
  });

  let sourceFile: SourceFile;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    sourceFile = project.createSourceFile(filePath, content);
  } catch {
    sourceFile = project.createSourceFile(filePath, '');
  }

  const functions = extractFunctions(sourceFile);
  const classes = extractClasses(sourceFile);
  const interfaces = extractInterfaces(sourceFile);
  const exports = extractExports(sourceFile);
  const imports = extractImports(sourceFile);
  const result = {
    filePath,
    language,
    functions,
    classes,
    interfaces,
    exports,
    imports,
    dependencies: imports.map((imp) => imp.modulePath),
    linesOfCode: sourceFile.getEndLineNumber() - sourceFile.getStartLineNumber() + 1,
    cyclomaticComplexity: calculateFileComplexity(sourceFile),
  };

  // Free memory
  project.removeSourceFile(sourceFile);

  return result;
}

function extractFunctions(sourceFile: SourceFile): AnalyzedFunction[] {
  const functions: AnalyzedFunction[] = [];

  sourceFile.getFunctions().forEach((fn) => {
    functions.push(analyzeFunctionDeclaration(fn));
  });

  sourceFile.getVariableDeclarations().forEach((varDecl) => {
    const initializer = varDecl.getInitializer();
    if (initializer) {
      if (
        initializer.getKind() === SyntaxKind.ArrowFunction ||
        initializer.getKind() === SyntaxKind.FunctionExpression
      ) {
        functions.push(analyzeVariableFunction(varDecl, initializer as ArrowFunction | FunctionExpression));
      }
    }
  });

  return functions;
}

function analyzeFunctionDeclaration(fn: FunctionDeclaration): AnalyzedFunction {
  const params = fn.getParameters().map(paramToInfo);
  const returnType = fn.getReturnTypeNode()?.getText() ?? null;
  const isAsync = fn.isAsync();
  const isExported = fn.isExported();
  const body = fn.getBody();
  const bodyText = getBodyText(body);

  return {
    name: fn.getName() ?? 'anonymous',
    isAsync,
    isExported,
    params,
    returnType,
    throws: extractThrowsFromBody(body),
    complexity: calculateComplexity(bodyText),
    hasSideEffects: detectSideEffects(bodyText),
    startLine: fn.getStartLineNumber(),
    endLine: fn.getEndLineNumber(),
  };
}

function analyzeVariableFunction(
  varDecl: VariableDeclaration,
  fn: ArrowFunction | FunctionExpression,
): AnalyzedFunction {
  const params = fn.getParameters().map(paramToInfo);
  const returnType = fn.getReturnTypeNode()?.getText() ?? null;
  const isAsync = fn.isAsync();
  const body = fn.getBody();
  const bodyText = getBodyText(body);

  return {
    name: varDecl.getName(),
    isAsync,
    isExported: isVarExported(varDecl),
    params,
    returnType,
    throws: extractThrowsFromBody(body),
    complexity: calculateComplexity(bodyText),
    hasSideEffects: detectSideEffects(bodyText),
    startLine: fn.getStartLineNumber(),
    endLine: fn.getEndLineNumber(),
  };
}

function paramToInfo(param: import('ts-morph').ParameterDeclaration): FunctionParam {
  return {
    name: param.getName(),
    type: param.getTypeNode()?.getText() ?? null,
    optional: param.isOptional(),
    defaultValue: param.getInitializer()?.getText() ?? null,
  };
}

function isVarExported(varDecl: VariableDeclaration): boolean {
  const statement = varDecl.getVariableStatement();
  return statement?.isExported() ?? false;
}

function extractClasses(sourceFile: SourceFile): AnalyzedClass[] {
  return sourceFile.getClasses().map((cls) => {
    const name = cls.getName() ?? 'AnonymousClass';
    const isExported = cls.isExported();
    const extendsClass = cls.getExtends()?.getText() ?? null;
    const implementsInterfaces = cls.getImplements().map((imp) => imp.getText());

    const constructorParams = cls.getConstructors().flatMap((ctor) =>
      ctor.getParameters().map(paramToInfo),
    );

    const methods = cls.getMethods().map((method) => analyzeMethod(method));

    const properties: ClassProperty[] = cls.getProperties().map((prop) => ({
      name: prop.getName(),
      type: prop.getTypeNode()?.getText() ?? null,
      visibility: (prop.getScope() as 'public' | 'private' | 'protected') ?? 'public',
      isStatic: prop.isStatic(),
      isReadonly: prop.isReadonly(),
    }));

    return {
      name,
      isExported,
      constructorParams,
      methods,
      properties,
      implements: implementsInterfaces,
      extends: extendsClass,
    };
  });
}

function analyzeMethod(method: MethodDeclaration): AnalyzedFunction {
  const params = method.getParameters().map(paramToInfo);
  const returnType = method.getReturnTypeNode()?.getText() ?? null;
  const body = method.getBody();
  const bodyText = body?.getText() ?? '';

  return {
    name: method.getName(),
    isAsync: method.isAsync(),
    isExported: false,
    params,
    returnType,
    throws: extractThrowsFromBody(body),
    complexity: calculateComplexity(bodyText),
    hasSideEffects: detectSideEffects(bodyText),
    startLine: method.getStartLineNumber(),
    endLine: method.getEndLineNumber(),
  };
}

function extractInterfaces(sourceFile: SourceFile): AnalyzedInterface[] {
  return sourceFile.getInterfaces().map((iface) => ({
    name: iface.getName(),
    isExported: iface.isExported(),
    properties: iface.getProperties().map((prop) => ({
      name: prop.getName(),
      type: prop.getTypeNode()?.getText() ?? null,
      optional: prop.hasQuestionToken(),
    })),
    methods: iface.getMethods().map((method) => ({
      name: method.getName(),
      params: method.getParameters().map(paramToInfo),
      returnType: method.getReturnTypeNode()?.getText() ?? null,
    })),
  }));
}

function extractExports(sourceFile: SourceFile): AnalyzedExport[] {
  const exports: AnalyzedExport[] = [];

  sourceFile.getExportDeclarations().forEach((expDecl) => {
    const moduleSpecifier = expDecl.getModuleSpecifierValue();
    if (!moduleSpecifier) return;
    expDecl.getNamedExports().forEach((named) => {
      exports.push({
        name: named.getName(),
        type: 'constant',
        filePath: moduleSpecifier,
      });
    });
  });

  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport) {
    exports.push({
      name: defaultExport.getName() ?? 'default',
      type: 'default',
      filePath: sourceFile.getFilePath().toString(),
    });
  }

  return exports;
}

function extractImports(sourceFile: SourceFile): ImportInfo[] {
  return sourceFile.getImportDeclarations().map((imp) => ({
    modulePath: imp.getModuleSpecifierValue(),
    namedImports: imp.getNamedImports().map((ni) => ni.getName()),
    defaultImport: imp.getDefaultImport()?.getText() ?? null,
    isTypeOnly: imp.isTypeOnly(),
  }));
}

function getBodyText(body: Node | undefined): string {
  if (!body) return '';
  if (body instanceof Block) {
    return body.getText();
  }
  return body.getText();
}

function extractThrowsFromBody(body: Node | undefined): string[] {
  if (!body) return [];
  const throws: string[] = [];

  body.getDescendantsOfKind(SyntaxKind.ThrowStatement).forEach((throwStmt) => {
    const expr = throwStmt.getExpression();
    if (expr) {
      throws.push(expr.getText());
    }
  });

  return throws;
}

function calculateComplexity(code: string): number {
  let complexity = 1;
  const patterns = [
    /\bif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /&&/g,
    /\|\|/g,
    /\?\?/g,
    /\?\./g,
    /\?[^.]/g,
  ];
  for (const pattern of patterns) {
    const matches = code.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function calculateFileComplexity(sourceFile: SourceFile): number {
  const text = sourceFile.getFullText();
  return calculateComplexity(text);
}

function detectSideEffects(code: string): boolean {
  const sideEffectPatterns = [
    /\bconsole\.\w+\(/,
    /\bprocess\.\w+/,
    /\bfs\.\w+\(/,
    /\bfetch\(/,
    /\baxios\.\w+\(/,
    /\bMath\.random\(/,
    /\bDate\.now\(/,
    /\bnew Date\(/,
    /\.push\(/,
    /\.splice\(/,
    /\.sort\(/,
    /\bdocument\.\w+/,
    /\bwindow\.\w+/,
  ];
  return sideEffectPatterns.some((pattern) => pattern.test(code));
}

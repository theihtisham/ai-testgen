import * as fs from 'fs';
import OpenAI from 'openai';
import {
  SourceAnalysis,
  TestSuite,
  TestFramework,
  TestGenConfig,
} from '../types.js';
import { detectEdgeCases } from '../analyzers/analyzer.js';

export async function generateWithAI(
  analysis: SourceAnalysis,
  framework: TestFramework,
  config: TestGenConfig,
): Promise<string> {
  if (!config.ai.enabled || config.ai.provider === 'none') {
    throw new Error('AI generation is not enabled in configuration');
  }

  const apiKey = process.env[config.ai.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `AI API key not found. Set the ${config.ai.apiKeyEnv} environment variable.`,
    );
  }

  const client = new OpenAI({ apiKey, baseURL: getBaseURL(config) });

  const prompt = buildPrompt(analysis, framework, config);

  const response = await client.chat.completions.create({
    model: config.ai.model,
    messages: [
      {
        role: 'system',
        content: getSystemPrompt(framework),
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: config.ai.maxTokens,
    temperature: config.ai.temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned empty response');
  }

  // Extract code from markdown code blocks if present
  const codeBlockMatch = content.match(/```(?:typescript|javascript|python|go|tsx|jsx)?\n([\s\S]*?)```/);
  return codeBlockMatch?.[1]?.trim() ?? content.trim();
}

function getBaseURL(config: TestGenConfig): string | undefined {
  if (config.ai.provider === 'openai') return undefined; // uses default
  if (config.ai.provider === 'anthropic') return 'https://api.anthropic.com/v1';
  return undefined;
}

function getSystemPrompt(framework: TestFramework): string {
  const frameworkName = framework === 'go-test' ? 'Go testing' : framework;
  return `You are an expert test engineer. Generate comprehensive, well-structured test suites using ${frameworkName}.
Follow these rules:
- Use the appropriate testing patterns and best practices for ${frameworkName}
- Include edge cases: null/undefined/nil, empty inputs, boundary values
- Mock external dependencies properly
- Include descriptive test names and comments
- Handle both happy path and error cases
- Return ONLY the test code, no explanations outside code comments`;
}

function buildPrompt(
  analysis: SourceAnalysis,
  framework: TestFramework,
  config: TestGenConfig,
): string {
  const parts: string[] = [];

  parts.push(`Generate a complete test suite for the following ${analysis.language} source file.`);
  parts.push(`Use the ${framework} testing framework.`);
  parts.push('');

  if (config.ai.privacyMode) {
    // Send only analysis metadata, not full source
    parts.push('## Source Code Analysis');
    parts.push(`File: ${analysis.filePath}`);
    parts.push(`Language: ${analysis.language}`);
    parts.push(`Lines of code: ${analysis.linesOfCode}`);
    parts.push('');

    parts.push('## Exported Functions');
    for (const fn of analysis.functions.filter((f) => f.isExported)) {
      const params = fn.params.map((p) => `${p.name}${p.type ? ': ' + p.type : ''}`).join(', ');
      parts.push(`- ${fn.name}(${params})${fn.returnType ? ': ' + fn.returnType : ''}${fn.isAsync ? ' [async]' : ''}`);
      if (fn.throws.length > 0) {
        parts.push(`  Throws: ${fn.throws.join(', ')}`);
      }
    }
    parts.push('');

    parts.push('## Classes');
    for (const cls of analysis.classes) {
      parts.push(`- ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}`);
      for (const method of cls.methods) {
        const params = method.params.map((p) => `${p.name}${p.type ? ': ' + p.type : ''}`).join(', ');
        parts.push(`  - ${method.name}(${params})${method.returnType ? ': ' + method.returnType : ''}`);
      }
    }
    parts.push('');

    parts.push('## Interfaces');
    for (const iface of analysis.interfaces) {
      parts.push(`- ${iface.name}`);
      for (const prop of iface.properties) {
        parts.push(`  - ${prop.name}${prop.type ? ': ' + prop.type : ''}${prop.optional ? '?' : ''}`);
      }
    }
    parts.push('');

    parts.push('## Imports');
    for (const imp of analysis.imports) {
      parts.push(`- ${imp.modulePath}: ${imp.namedImports.join(', ') || 'default'}`);
    }
    parts.push('');

    parts.push('## Edge Cases to Cover');
    const edgeCases = analysis.functions.flatMap((fn) => detectEdgeCases(fn)).slice(0, 10);
    for (const ec of edgeCases) {
      parts.push(`- ${ec.name}: ${ec.expectedBehavior}`);
    }
  } else {
    // Send full source code (not recommended for proprietary code)
    parts.push('## Source Code');
    parts.push('```' + analysis.language);
    try {
      const source = fs.readFileSync(analysis.filePath, 'utf-8');
      parts.push(source);
    } catch {
      parts.push('(Could not read source file)');
    }
    parts.push('```');
  }

  parts.push('');
  parts.push('Generate tests that achieve at least 90% code coverage.');

  return parts.join('\n');
}

export function buildAISuite(
  generatedCode: string,
  analysis: SourceAnalysis,
  framework: TestFramework,
): TestSuite {
  return {
    filePath: '',
    sourceFilePath: analysis.filePath,
    language: analysis.language,
    framework,
    testCases: [],
    mocks: [],
    imports: [generatedCode],
    setupCode: '',
    teardownCode: '',
    coverageEstimate: 90, // AI-generated tests target 90%+
  };
}

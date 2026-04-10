import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { analyzeSource, detectEdgeCases, detectMocks } from '../src/analyzers/analyzer.js';
import { analyzePythonSource } from '../src/analyzers/python-analyzer.js';
import { analyzeGoSource } from '../src/analyzers/go-analyzer.js';

describe('Source Analysis', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-analyze-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('TypeScript/JavaScript Analysis', () => {
    it('analyzes a simple exported function', () => {
      const filePath = path.join(tempDir, 'math.ts');
      fs.writeFileSync(filePath, `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`);
      const analysis = analyzeSource(filePath, 'typescript');
      expect(analysis.language).toBe('typescript');
      expect(analysis.functions.length).toBeGreaterThanOrEqual(2);
      expect(analysis.functions.some((f) => f.name === 'add')).toBe(true);
      expect(analysis.functions.some((f) => f.name === 'multiply')).toBe(true);
    });

    it('analyzes exported classes with methods', () => {
      const filePath = path.join(tempDir, 'service.ts');
      fs.writeFileSync(filePath, `
export class UserService {
  private users: Map<string, string> = new Map();

  addUser(id: string, name: string): void {
    this.users.set(id, name);
  }

  getUser(id: string): string | undefined {
    return this.users.get(id);
  }

  async fetchUser(id: string): Promise<string> {
    return this.users.get(id) ?? 'unknown';
  }
}
`);
      const analysis = analyzeSource(filePath, 'typescript');
      expect(analysis.classes.length).toBe(1);
      expect(analysis.classes[0]!.name).toBe('UserService');
      expect(analysis.classes[0]!.methods.length).toBeGreaterThanOrEqual(2);
    });

    it('detects exported arrow functions', () => {
      const filePath = path.join(tempDir, 'utils.ts');
      fs.writeFileSync(filePath, `
export const formatName = (first: string, last: string): string => {
  return first + ' ' + last;
};

export const parseJSON = (input: string): unknown => {
  return JSON.parse(input);
};
`);
      const analysis = analyzeSource(filePath, 'typescript');
      expect(analysis.functions.length).toBeGreaterThanOrEqual(1);
    });

    it('analyzes interfaces', () => {
      const filePath = path.join(tempDir, 'types.ts');
      fs.writeFileSync(filePath, `
export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface Repository<T> {
  findById(id: string): T | undefined;
  save(entity: T): void;
}
`);
      const analysis = analyzeSource(filePath, 'typescript');
      expect(analysis.interfaces.length).toBeGreaterThanOrEqual(1);
    });

    it('detects imports and dependencies', () => {
      const filePath = path.join(tempDir, 'imports.ts');
      fs.writeFileSync(filePath, `
import { useState, useEffect } from 'react';
import * as fs from 'fs';
import type { Config } from './config';

export function useConfig(): Config | null {
  return null;
}
`);
      const analysis = analyzeSource(filePath, 'typescript');
      expect(analysis.imports.length).toBeGreaterThanOrEqual(1);
      expect(analysis.dependencies).toContain('react');
    });

    it('calculates cyclomatic complexity', () => {
      const filePath = path.join(tempDir, 'complex.ts');
      fs.writeFileSync(filePath, `
export function complexFunction(x: number): string {
  if (x > 0) {
    if (x > 10) {
      return 'big';
    } else {
      return 'small';
    }
  } else if (x === 0) {
    return 'zero';
  } else {
    for (let i = 0; i < 10; i++) {
      if (i === x) return 'found';
    }
    return 'negative';
  }
}
`);
      const analysis = analyzeSource(filePath, 'typescript');
      const complexFn = analysis.functions.find((f) => f.name === 'complexFunction');
      expect(complexFn).toBeDefined();
      expect(complexFn!.complexity).toBeGreaterThan(1);
    });

    it('detects async functions', () => {
      const filePath = path.join(tempDir, 'async.ts');
      fs.writeFileSync(filePath, `
export async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}
`);
      const analysis = analyzeSource(filePath, 'typescript');
      const asyncFn = analysis.functions.find((f) => f.name === 'fetchData');
      expect(asyncFn).toBeDefined();
      expect(asyncFn!.isAsync).toBe(true);
    });
  });

  describe('Python Analysis', () => {
    it('analyzes Python functions', () => {
      const filePath = path.join(tempDir, 'math.py');
      fs.writeFileSync(filePath, `
def add(a: int, b: int) -> int:
    return a + b

def greet(name: str) -> str:
    return f"Hello, {name}"

async def fetch_data(url: str) -> dict:
    return {}
`);
      const analysis = analyzePythonSource(filePath);
      expect(analysis.language).toBe('python');
      expect(analysis.functions.length).toBeGreaterThanOrEqual(2);
      expect(analysis.functions.some((f) => f.name === 'add')).toBe(true);
      expect(analysis.functions.some((f) => f.name === 'greet')).toBe(true);
    });

    it('analyzes Python classes', () => {
      const filePath = path.join(tempDir, 'service.py');
      fs.writeFileSync(filePath, `
class UserService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.connected = False

    def connect(self):
        self.connected = True

    def get_user(self, user_id: str) -> dict:
        if not self.connected:
            raise ConnectionError("Not connected")
        return {"id": user_id}
`);
      const analysis = analyzePythonSource(filePath);
      expect(analysis.classes.length).toBe(1);
      expect(analysis.classes[0]!.name).toBe('UserService');
      expect(analysis.classes[0]!.methods.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts Python imports', () => {
      const filePath = path.join(tempDir, 'imports.py');
      fs.writeFileSync(filePath, `
import os
import sys
from typing import List, Optional
from collections import defaultdict

def process(items: List[str]) -> None:
    pass
`);
      const analysis = analyzePythonSource(filePath);
      expect(analysis.imports.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Go Analysis', () => {
    it('analyzes Go functions', () => {
      const filePath = path.join(tempDir, 'math.go');
      fs.writeFileSync(filePath, `package math

func Add(a, b int) int {
    return a + b
}

func Multiply(a, b int) int {
    return a * b
}

func Divide(a, b int) (int, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}
`);
      const analysis = analyzeGoSource(filePath);
      expect(analysis.language).toBe('go');
      expect(analysis.functions.length).toBeGreaterThanOrEqual(2);
      expect(analysis.functions.some((f) => f.name === 'Add')).toBe(true);
    });

    it('analyzes Go interfaces', () => {
      const filePath = path.join(tempDir, 'repo.go');
      fs.writeFileSync(filePath, `package repo

type Repository interface {
    FindById(id string) (interface{}, error)
    Save(entity interface{}) error
    Delete(id string) error
}
`);
      const analysis = analyzeGoSource(filePath);
      expect(analysis.interfaces.length).toBe(1);
      expect(analysis.interfaces[0]!.name).toBe('Repository');
    });

    it('extracts Go imports', () => {
      const filePath = path.join(tempDir, 'main.go');
      fs.writeFileSync(filePath, `package main

import (
    "fmt"
    "net/http"
    "strings"
)

func main() {
    fmt.Println("hello")
}
`);
      const analysis = analyzeGoSource(filePath);
      expect(analysis.imports.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Edge Case Detection', () => {
  it('detects edge cases for optional parameters', () => {
    const edgeCases = detectEdgeCases({
      name: 'processData',
      isAsync: false,
      isExported: true,
      params: [
        { name: 'data', type: 'string', optional: true, defaultValue: null },
        { name: 'count', type: 'number', optional: false, defaultValue: null },
      ],
      returnType: 'string',
      throws: [],
      complexity: 1,
      hasSideEffects: false,
      startLine: 1,
      endLine: 5,
    });

    expect(edgeCases.length).toBeGreaterThan(0);
    expect(edgeCases.some((ec) => ec.name.includes('undefined'))).toBe(true);
  });

  it('detects numeric edge cases', () => {
    const edgeCases = detectEdgeCases({
      name: 'calculate',
      isAsync: false,
      isExported: true,
      params: [
        { name: 'value', type: 'number', optional: false, defaultValue: null },
      ],
      returnType: 'number',
      throws: [],
      complexity: 1,
      hasSideEffects: false,
      startLine: 1,
      endLine: 3,
    });

    expect(edgeCases.some((ec) => ec.name.includes('zero'))).toBe(true);
    expect(edgeCases.some((ec) => ec.inputDescription.includes('NaN'))).toBe(true);
  });

  it('detects array edge cases', () => {
    const edgeCases = detectEdgeCases({
      name: 'processItems',
      isAsync: false,
      isExported: true,
      params: [
        { name: 'items', type: 'string[]', optional: false, defaultValue: null },
      ],
      returnType: 'void',
      throws: [],
      complexity: 1,
      hasSideEffects: false,
      startLine: 1,
      endLine: 3,
    });

    expect(edgeCases.some((ec) => ec.name.includes('empty array'))).toBe(true);
  });

  it('detects error path edge cases', () => {
    const edgeCases = detectEdgeCases({
      name: 'validate',
      isAsync: false,
      isExported: true,
      params: [
        { name: 'input', type: 'string', optional: false, defaultValue: null },
      ],
      returnType: 'boolean',
      throws: ['ValidationError'],
      complexity: 2,
      hasSideEffects: false,
      startLine: 1,
      endLine: 5,
    });

    expect(edgeCases.some((ec) => ec.tags.includes('error-path'))).toBe(true);
  });

  it('detects async edge cases', () => {
    const edgeCases = detectEdgeCases({
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
      startLine: 1,
      endLine: 5,
    });

    expect(edgeCases.some((ec) => ec.tags.includes('async'))).toBe(true);
  });
});

describe('Mock Detection', () => {
  it('detects external module mocks', () => {
    const analysis = {
      filePath: 'src/app.ts',
      language: 'typescript' as const,
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [
        {
          modulePath: 'axios',
          namedImports: ['axios'],
          defaultImport: null,
          isTypeOnly: false,
        },
        {
          modulePath: 'lodash',
          namedImports: ['debounce'],
          defaultImport: null,
          isTypeOnly: false,
        },
      ],
      dependencies: ['axios', 'lodash'],
      linesOfCode: 10,
      cyclomaticComplexity: 1,
    };

    const mocks = detectMocks(analysis);
    expect(mocks.length).toBeGreaterThanOrEqual(1);
  });

  it('skips type-only imports', () => {
    const analysis = {
      filePath: 'src/types.ts',
      language: 'typescript' as const,
      functions: [],
      classes: [],
      interfaces: [],
      exports: [],
      imports: [
        {
          modulePath: './types',
          namedImports: ['User'],
          defaultImport: null,
          isTypeOnly: true,
        },
      ],
      dependencies: [],
      linesOfCode: 5,
      cyclomaticComplexity: 1,
    };

    const mocks = detectMocks(analysis);
    expect(mocks.length).toBe(0);
  });
});

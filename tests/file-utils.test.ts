import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readFile,
  writeFile,
  fileExists,
  getRelativePath,
  ensureDir,
  getFileHash,
  hashString,
} from '../src/utils/file.js';

describe('File Utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-file-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('reads file contents', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'hello world');
      expect(readFile(filePath)).toBe('hello world');
    });

    it('throws for non-existent files', () => {
      expect(() => readFile(path.join(tempDir, 'missing.txt'))).toThrow('File not found');
    });
  });

  describe('writeFile', () => {
    it('writes file contents', () => {
      const filePath = path.join(tempDir, 'output.txt');
      writeFile(filePath, 'test content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('test content');
    });

    it('creates directories as needed', () => {
      const filePath = path.join(tempDir, 'nested', 'deep', 'output.txt');
      writeFile(filePath, 'nested content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('nested content');
    });
  });

  describe('fileExists', () => {
    it('returns true for existing files', () => {
      const filePath = path.join(tempDir, 'exists.txt');
      fs.writeFileSync(filePath, 'content');
      expect(fileExists(filePath)).toBe(true);
    });

    it('returns false for non-existent files', () => {
      expect(fileExists(path.join(tempDir, 'missing.txt'))).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('computes relative paths between files', () => {
      const from = '/src/components/App.tsx';
      const to = '/src/utils/helpers.ts';
      const rel = getRelativePath(from, to);
      expect(rel).toBe('../utils/helpers.ts');
    });

    it('prefixes with ./ for same-directory files', () => {
      const from = '/src/App.tsx';
      const to = '/src/utils.ts';
      const rel = getRelativePath(from, to);
      expect(rel).toBe('./utils.ts');
    });
  });

  describe('ensureDir', () => {
    it('creates directories recursively', () => {
      const dirPath = path.join(tempDir, 'a', 'b', 'c');
      ensureDir(dirPath);
      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it('does not throw for existing directories', () => {
      expect(() => ensureDir(tempDir)).not.toThrow();
    });
  });

  describe('getFileHash', () => {
    it('returns consistent hashes for same content', () => {
      const filePath1 = path.join(tempDir, 'file1.txt');
      const filePath2 = path.join(tempDir, 'file2.txt');
      fs.writeFileSync(filePath1, 'same content');
      fs.writeFileSync(filePath2, 'same content');

      expect(getFileHash(filePath1)).toBe(getFileHash(filePath2));
    });

    it('returns different hashes for different content', () => {
      const filePath1 = path.join(tempDir, 'file1.txt');
      const filePath2 = path.join(tempDir, 'file2.txt');
      fs.writeFileSync(filePath1, 'content A');
      fs.writeFileSync(filePath2, 'content B');

      expect(getFileHash(filePath1)).not.toBe(getFileHash(filePath2));
    });
  });

  describe('hashString', () => {
    it('returns consistent hash for same input', () => {
      expect(hashString('test')).toBe(hashString('test'));
    });

    it('returns different hash for different input', () => {
      expect(hashString('test1')).not.toBe(hashString('test2'));
    });
  });
});

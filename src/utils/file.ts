import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

export function readFile(filePath: string): string {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }
  return fs.readFileSync(absolute, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const absolute = path.resolve(filePath);
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absolute, content, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

export async function findSourceFiles(
  patterns: string[],
  cwd: string,
  excludePatterns: string[],
): Promise<string[]> {
  const results = await fg(patterns, {
    cwd,
    absolute: true,
    ignore: excludePatterns,
    onlyFiles: true,
  });
  return results.sort();
}

export function getRelativePath(from: string, to: string): string {
  let rel = path.relative(path.dirname(from), to).replace(/\\/g, '/');
  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }
  return rel;
}

export function ensureDir(dirPath: string): void {
  const absolute = path.resolve(dirPath);
  if (!fs.existsSync(absolute)) {
    fs.mkdirSync(absolute, { recursive: true });
  }
}

export function getFileHash(filePath: string): string {
  const content = readFile(filePath);
  return hashString(content);
}

export function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function readJsonFile<T>(filePath: string): T {
  const content = readFile(filePath);
  return JSON.parse(content) as T;
}

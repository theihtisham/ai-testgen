import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { TestGenConfig } from './types.js';
import { ensureDir, readFile, writeFile, getFileHash } from './utils/file.js';
import { logger } from './utils/logger.js';

interface CacheEntry {
  filePath: string;
  hash: string;
  lastGenerated: number;
  testFilePath: string;
}

export class IncrementalCache {
  private cacheDir: string;
  private cache: Map<string, CacheEntry> = new Map();
  private gitBased: boolean;

  constructor(config: TestGenConfig) {
    this.cacheDir = path.resolve(config.incremental.cacheDir);
    this.gitBased = config.incremental.gitBased;
  }

  async initialize(): Promise<void> {
    ensureDir(this.cacheDir);
    this.loadCache();
  }

  getChangedFiles(allFiles: string[]): string[] {
    if (this.gitBased) {
      return this.getGitChangedFiles(allFiles);
    }
    return this.getHashChangedFiles(allFiles);
  }

  private getGitChangedFiles(allFiles: string[]): string[] {
    try {
      const output = execSync('git diff --name-only HEAD', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const changedRelPaths = output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const cwd = process.cwd();
      const changedAbsPaths = new Set(
        changedRelPaths.map((rel) => path.resolve(cwd, rel)),
      );

      // Also check files that aren't cached yet
      const uncached = allFiles.filter((f) => !this.cache.has(f));

      return [...new Set([...uncached, ...allFiles.filter((f) => changedAbsPaths.has(f))])];
    } catch {
      // Git not available, fall back to hash-based
      return this.getHashChangedFiles(allFiles);
    }
  }

  private getHashChangedFiles(allFiles: string[]): string[] {
    const changed: string[] = [];

    for (const filePath of allFiles) {
      const cached = this.cache.get(filePath);
      if (!cached) {
        changed.push(filePath);
        continue;
      }

      try {
        const currentHash = getFileHash(filePath);
        if (currentHash !== cached.hash) {
          changed.push(filePath);
        }
      } catch {
        // File might have been deleted
        changed.push(filePath);
      }
    }

    return changed;
  }

  markGenerated(filePath: string, testFilePath: string): void {
    try {
      const hash = getFileHash(filePath);
      this.cache.set(filePath, {
        filePath,
        hash,
        lastGenerated: Date.now(),
        testFilePath,
      });
      this.saveCache();
    } catch {
      logger.warn(`Failed to update cache for ${filePath}`);
    }
  }

  private loadCache(): void {
    const cacheFile = path.join(this.cacheDir, 'incremental-cache.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const data = JSON.parse(readFile(cacheFile)) as CacheEntry[];
        for (const entry of data) {
          this.cache.set(entry.filePath, entry);
        }
        logger.debug(`Loaded ${this.cache.size} cache entries`);
      } catch {
        logger.warn('Failed to load incremental cache, starting fresh');
      }
    }
  }

  private saveCache(): void {
    const cacheFile = path.join(this.cacheDir, 'incremental-cache.json');
    const data = Array.from(this.cache.values());
    writeFile(cacheFile, JSON.stringify(data, null, 2));
  }

  clear(): void {
    this.cache.clear();
    const cacheFile = path.join(this.cacheDir, 'incremental-cache.json');
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  }
}

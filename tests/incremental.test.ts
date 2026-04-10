import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IncrementalCache } from '../src/incremental.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';

describe('Incremental Cache', () => {
  let tempDir: string;
  let cacheDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testgen-incr-'));
    cacheDir = path.join(tempDir, 'cache');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes and creates cache directory', async () => {
    const config = { ...DEFAULT_CONFIG, incremental: { ...DEFAULT_CONFIG.incremental, cacheDir } };
    const cache = new IncrementalCache(config);
    await cache.initialize();
    expect(fs.existsSync(cacheDir)).toBe(true);
  });

  it('reports all files as changed on first run', async () => {
    const config = { ...DEFAULT_CONFIG, incremental: { ...DEFAULT_CONFIG.incremental, cacheDir, gitBased: false } };
    const cache = new IncrementalCache(config);
    await cache.initialize();

    const files = [
      path.join(tempDir, 'file1.ts'),
      path.join(tempDir, 'file2.ts'),
    ];
    for (const f of files) {
      fs.writeFileSync(f, 'content');
    }

    const changed = cache.getChangedFiles(files);
    expect(changed).toHaveLength(2);
  });

  it('marks files as generated', async () => {
    const config = { ...DEFAULT_CONFIG, incremental: { ...DEFAULT_CONFIG.incremental, cacheDir, gitBased: false } };
    const cache = new IncrementalCache(config);
    await cache.initialize();

    const filePath = path.join(tempDir, 'file1.ts');
    fs.writeFileSync(filePath, 'content');
    cache.markGenerated(filePath, 'file1.test.ts');

    const changed = cache.getChangedFiles([filePath]);
    expect(changed).toHaveLength(0);
  });

  it('detects changed files after modification', async () => {
    const config = { ...DEFAULT_CONFIG, incremental: { ...DEFAULT_CONFIG.incremental, cacheDir, gitBased: false } };
    const cache = new IncrementalCache(config);
    await cache.initialize();

    const filePath = path.join(tempDir, 'file1.ts');
    fs.writeFileSync(filePath, 'original content');
    cache.markGenerated(filePath, 'file1.test.ts');

    // Modify the file
    fs.writeFileSync(filePath, 'modified content');

    const changed = cache.getChangedFiles([filePath]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toBe(filePath);
  });

  it('persists cache across instances', async () => {
    const config = { ...DEFAULT_CONFIG, incremental: { ...DEFAULT_CONFIG.incremental, cacheDir, gitBased: false } };

    // First instance
    const cache1 = new IncrementalCache(config);
    await cache1.initialize();

    const filePath = path.join(tempDir, 'file1.ts');
    fs.writeFileSync(filePath, 'content');
    cache1.markGenerated(filePath, 'file1.test.ts');

    // Second instance
    const cache2 = new IncrementalCache(config);
    await cache2.initialize();

    const changed = cache2.getChangedFiles([filePath]);
    expect(changed).toHaveLength(0); // Not changed since last generation
  });

  it('clears cache properly', async () => {
    const config = { ...DEFAULT_CONFIG, incremental: { ...DEFAULT_CONFIG.incremental, cacheDir, gitBased: false } };
    const cache = new IncrementalCache(config);
    await cache.initialize();

    const filePath = path.join(tempDir, 'file1.ts');
    fs.writeFileSync(filePath, 'content');
    cache.markGenerated(filePath, 'file1.test.ts');

    cache.clear();

    const changed = cache.getChangedFiles([filePath]);
    expect(changed).toHaveLength(1); // Should be changed after clear
  });
});

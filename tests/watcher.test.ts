import { describe, it, expect } from 'vitest';
import { FileWatcher } from '../src/watcher/watcher.js';
import { DEFAULT_CONFIG, TestGenConfig } from '../src/types.js';

describe('FileWatcher', () => {
  it('can be created without errors', () => {
    const config: TestGenConfig = {
      ...DEFAULT_CONFIG,
      watch: {
        enabled: true,
        ignorePatterns: ['node_modules'],
        debounceMs: 100,
      },
    };

    const callback = async () => {};
    const watcher = new FileWatcher(config, callback);
    expect(watcher.isRunning()).toBe(false);
  });

  it('stop is safe when not running', () => {
    const config: TestGenConfig = {
      ...DEFAULT_CONFIG,
      watch: {
        enabled: true,
        ignorePatterns: [],
        debounceMs: 100,
      },
    };

    const callback = async () => {};
    const watcher = new FileWatcher(config, callback);
    expect(() => watcher.stop()).not.toThrow();
  });
});

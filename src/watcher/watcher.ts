import * as fs from 'fs';
import * as path from 'path';
import { FileChangeEvent, TestGenConfig } from '../types.js';
import { logger } from '../utils/logger.js';

type FileWatcherCallback = (events: FileChangeEvent[]) => Promise<void>;

export class FileWatcher {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private pendingEvents: FileChangeEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private ignorePatterns: string[];
  private callback: FileWatcherCallback;
  private running = false;

  constructor(config: TestGenConfig, callback: FileWatcherCallback) {
    this.debounceMs = config.watch.debounceMs;
    this.ignorePatterns = config.watch.ignorePatterns;
    this.callback = callback;
  }

  start(directories: string[]): void {
    if (this.running) return;
    this.running = true;

    for (const dir of directories) {
      const absoluteDir = path.resolve(dir);
      if (!fs.existsSync(absoluteDir)) {
        logger.warn(`Watch directory does not exist: ${absoluteDir}`);
        continue;
      }

      try {
        const watcher = fs.watch(
          absoluteDir,
          { recursive: true },
          (eventType, filename) => {
            if (!filename) return;
            if (this.shouldIgnore(filename)) return;

            const filePath = path.join(absoluteDir, filename);

            this.pendingEvents.push({
              filePath,
              eventType: eventType as FileChangeEvent['eventType'],
              timestamp: Date.now(),
            });

            this.debouncedNotify();
          },
        );

        this.watchers.set(absoluteDir, watcher);
        logger.info(`Watching: ${absoluteDir}`);
      } catch (err) {
        logger.error(`Failed to watch ${absoluteDir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  stop(): void {
    this.running = false;
    for (const [dir, watcher] of this.watchers) {
      watcher.close();
      logger.debug(`Stopped watching: ${dir}`);
    }
    this.watchers.clear();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private shouldIgnore(filename: string): boolean {
    const normalized = filename.replace(/\\/g, '/');
    return this.ignorePatterns.some((pattern) => {
      return normalized.includes(pattern) || normalized.match(
        new RegExp(pattern.replace(/\*/g, '.*')),
      ) !== null;
    });
  }

  private debouncedNotify(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const events = [...this.pendingEvents];
      this.pendingEvents = [];
      if (events.length > 0) {
        this.callback(events).catch((err) => {
          logger.error(`Watch callback error: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    }, this.debounceMs);
  }
}

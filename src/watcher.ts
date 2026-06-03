/**
 * File Watcher
 * Monitors a directory for new JUnit XML files and triggers analysis
 * Supports CI mode with command execution on changes
 */

import chokidar from 'chokidar';
import * as path from 'path';
import { globSync } from 'glob';

interface WatcherOptions {
  directory: string;
  interval?: number;
  onNewFile: (filePath: string) => Promise<void>;
  onRunCommand?: () => Promise<void>;
}

export class FileWatcher {
  private options: WatcherOptions;
  private processedFiles: Set<string> = new Set();

  constructor(options: WatcherOptions) {
    this.options = {
      interval: 10000,
      ...options,
    };
  }

  async start(): Promise<void> {
    const { directory, interval } = this.options;

    // First, process any existing XML files
    const existing = globSync('**/*.xml', { cwd: directory, absolute: true });
    for (const file of existing) {
      if (!this.processedFiles.has(file)) {
        this.processedFiles.add(file);
        await this.options.onNewFile(file);
      }
    }

    // Then watch for new files
    const watcher = chokidar.watch('**/*.xml', {
      cwd: directory,
      ignoreInitial: true,
      persistent: true,
      usePolling: true,
      interval: interval,
    });

    watcher.on('add', async (filePath) => {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(directory, filePath);
      if (!this.processedFiles.has(absolutePath)) {
        this.processedFiles.add(absolutePath);
        await this.options.onNewFile(absolutePath);
      }
    });

    // If exec command is provided, run it periodically
    if (this.options.onRunCommand) {
      const runAndWatch = async () => {
        await this.options.onRunCommand!();
        // After command runs, check for new files
        const newFiles = globSync('**/*.xml', { cwd: directory, absolute: true });
        for (const file of newFiles) {
          if (!this.processedFiles.has(file)) {
            this.processedFiles.add(file);
            await this.options.onNewFile(file);
          }
        }
        setTimeout(runAndWatch, interval);
      };
      await runAndWatch();
    }

    // Keep process alive
    return new Promise(() => {});
  }
}

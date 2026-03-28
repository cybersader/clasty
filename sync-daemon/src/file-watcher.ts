/**
 * File Watcher
 *
 * Watches the vault directory for changes using chokidar (wraps inotify on Linux).
 * Triggers CRDT sync on file modifications.
 */

import chokidar, { FSWatcher } from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import { YjsManager } from './yjs-manager.js';
import { AuditLogger } from './audit-logger.js';

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private vaultPath: string;
  private yjsManager: YjsManager;
  private auditLogger: AuditLogger;
  private watchedFiles: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private ignorePatterns: string[] = [
    '**/.obsidian/workspace*.json',  // Workspace state (changes constantly)
    '**/.trash/**',
    '**/node_modules/**',
    '**/.git/**',
    '**/*.tmp',
    '**/.*!'  // Obsidian swap files
  ];

  constructor(vaultPath: string, yjsManager: YjsManager, auditLogger: AuditLogger) {
    this.vaultPath = vaultPath;
    this.yjsManager = yjsManager;
    this.auditLogger = auditLogger;
  }

  async start(): Promise<void> {
    console.log(`Starting file watcher on: ${this.vaultPath}`);

    this.watcher = chokidar.watch(this.vaultPath, {
      persistent: true,
      ignoreInitial: false,  // Process existing files on startup
      ignored: this.ignorePatterns,
      awaitWriteFinish: {
        stabilityThreshold: 200,  // Wait for file to be stable
        pollInterval: 100
      },
      usePolling: false,  // Use native events (inotify on Linux)
      atomic: true  // Handle atomic writes (temp file + rename)
    });

    this.watcher
      .on('add', (filePath) => this.onFileAdd(filePath))
      .on('change', (filePath) => this.onFileChange(filePath))
      .on('unlink', (filePath) => this.onFileDelete(filePath))
      .on('error', (error) => console.error('Watcher error:', error))
      .on('ready', () => {
        console.log(`Watching ${this.watchedFiles.size} files`);
      });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  getWatchedCount(): number {
    return this.watchedFiles.size;
  }

  private isMarkdownFile(filePath: string): boolean {
    return filePath.endsWith('.md');
  }

  private getRelativePath(filePath: string): string {
    return path.relative(this.vaultPath, filePath);
  }

  private debounce(filePath: string, callback: () => void, delay: number = 100): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    this.debounceTimers.set(filePath, setTimeout(() => {
      this.debounceTimers.delete(filePath);
      callback();
    }, delay));
  }

  private async onFileAdd(filePath: string): Promise<void> {
    this.watchedFiles.add(filePath);

    if (!this.isMarkdownFile(filePath)) {
      return;  // Only sync markdown files for now
    }

    const relativePath = this.getRelativePath(filePath);
    console.log(`File added: ${relativePath}`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      await this.yjsManager.updateDocument(relativePath, content);
      this.auditLogger.logFileCreate(relativePath);
    } catch (err) {
      console.error(`Error reading new file ${relativePath}:`, err);
    }
  }

  private async onFileChange(filePath: string): Promise<void> {
    if (!this.isMarkdownFile(filePath)) {
      return;
    }

    const relativePath = this.getRelativePath(filePath);

    // Debounce rapid changes (e.g., during typing)
    this.debounce(filePath, async () => {
      console.log(`File changed: ${relativePath}`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        await this.yjsManager.updateDocument(relativePath, content);
        this.auditLogger.logFileModify(relativePath);
      } catch (err) {
        console.error(`Error reading changed file ${relativePath}:`, err);
      }
    });
  }

  private async onFileDelete(filePath: string): Promise<void> {
    this.watchedFiles.delete(filePath);

    if (!this.isMarkdownFile(filePath)) {
      return;
    }

    const relativePath = this.getRelativePath(filePath);
    console.log(`File deleted: ${relativePath}`);

    await this.yjsManager.deleteDocument(relativePath);
    this.auditLogger.logFileDelete(relativePath);
  }

  /**
   * Called by YjsManager when a remote change comes in.
   * Writes the new content to the filesystem.
   */
  async writeFromCrdt(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, relativePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file (will trigger 'change' event, but we'll detect it's same content)
    await fs.writeFile(fullPath, content, 'utf-8');
    console.log(`Wrote CRDT update to: ${relativePath}`);
  }
}

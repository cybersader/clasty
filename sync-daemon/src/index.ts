/**
 * Obsidian CRDT Sync Daemon
 *
 * Watches the vault filesystem and syncs changes via Yjs CRDT.
 * Runs alongside Obsidian in the same container.
 */

import express from 'express';
import { FileWatcher } from './file-watcher.js';
import { YjsManager } from './yjs-manager.js';
import { AuditLogger } from './audit-logger.js';

const VAULT_PATH = process.env.VAULT_PATH || '/config/vaults';
const SYNC_SERVER_URL = process.env.SYNC_SERVER_URL || 'ws://localhost:1234';
const PORT = parseInt(process.env.SYNC_DAEMON_PORT || '3001', 10);
const USER_ID = process.env.USER_ID || 'anonymous';

async function main() {
  console.log('=== Obsidian Sync Daemon ===');
  console.log(`Vault path: ${VAULT_PATH}`);
  console.log(`Sync server: ${SYNC_SERVER_URL}`);
  console.log(`User ID: ${USER_ID}`);

  // Initialize components
  const auditLogger = new AuditLogger(USER_ID);
  const yjsManager = new YjsManager(SYNC_SERVER_URL, auditLogger);
  const fileWatcher = new FileWatcher(VAULT_PATH, yjsManager, auditLogger);

  // Connect to sync server
  await yjsManager.connect();

  // Start watching files
  await fileWatcher.start();

  // Simple HTTP API for health checks and status
  const app = express();

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      connected: yjsManager.isConnected(),
      watchedFiles: fileWatcher.getWatchedCount()
    });
  });

  app.get('/status', (req, res) => {
    res.json({
      vaultPath: VAULT_PATH,
      syncServer: SYNC_SERVER_URL,
      userId: USER_ID,
      documents: yjsManager.getDocumentList()
    });
  });

  app.listen(PORT, () => {
    console.log(`Sync daemon API listening on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await fileWatcher.stop();
    await yjsManager.disconnect();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

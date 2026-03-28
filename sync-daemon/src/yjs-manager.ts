/**
 * Yjs Manager
 *
 * Manages Yjs documents (one per markdown file) and syncs them with
 * the central y-websocket server.
 */

import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as syncProtocol from 'y-protocols/sync.js';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { AuditLogger } from './audit-logger.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface DocumentState {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  lastContent: string;
}

export class YjsManager {
  private serverUrl: string;
  private auditLogger: AuditLogger;
  private ws: WebSocket | null = null;
  private documents: Map<string, DocumentState> = new Map();
  private connected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private fileWatcher: { writeFromCrdt: (path: string, content: string) => Promise<void> } | null = null;

  constructor(serverUrl: string, auditLogger: AuditLogger) {
    this.serverUrl = serverUrl;
    this.auditLogger = auditLogger;
  }

  setFileWatcher(fileWatcher: { writeFromCrdt: (path: string, content: string) => Promise<void> }): void {
    this.fileWatcher = fileWatcher;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to sync server: ${this.serverUrl}`);

      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        console.log('Connected to sync server');
        this.connected = true;
        resolve();

        // Sync all existing documents
        for (const [path, state] of this.documents) {
          this.sendSync(path, state.doc);
        }
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from sync server');
        this.connected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        if (!this.connected) {
          reject(err);
        }
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDocumentList(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Update a document with new content from the filesystem.
   * This is called when a local file changes.
   */
  async updateDocument(path: string, content: string): Promise<void> {
    let state = this.documents.get(path);

    if (!state) {
      // Create new document
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);
      state = { doc, awareness, lastContent: '' };
      this.documents.set(path, state);

      // Listen for remote updates
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'local') {
          this.onRemoteUpdate(path, doc);
        }
      });
    }

    // Skip if content hasn't changed (prevents echo from our own writes)
    if (state.lastContent === content) {
      return;
    }

    const ytext = state.doc.getText('content');

    // Apply the change locally
    state.doc.transact(() => {
      // Simple replace strategy for now
      // TODO: Use diff-match-patch for smarter merging
      ytext.delete(0, ytext.length);
      ytext.insert(0, content);
    }, 'local');

    state.lastContent = content;

    // Sync to server
    if (this.connected) {
      this.sendSync(path, state.doc);
    }
  }

  /**
   * Delete a document (when file is deleted).
   */
  async deleteDocument(path: string): Promise<void> {
    const state = this.documents.get(path);
    if (state) {
      state.doc.destroy();
      this.documents.delete(path);
    }
    // TODO: Notify server about deletion
  }

  /**
   * Handle a remote update from the sync server.
   */
  private onRemoteUpdate(path: string, doc: Y.Doc): void {
    const ytext = doc.getText('content');
    const content = ytext.toString();

    const state = this.documents.get(path);
    if (state && state.lastContent !== content) {
      state.lastContent = content;

      // Write to filesystem
      if (this.fileWatcher) {
        this.fileWatcher.writeFromCrdt(path, content);
      }

      this.auditLogger.logRemoteSync(path);
    }
  }

  /**
   * Send sync message to server.
   */
  private sendSync(path: string, doc: Y.Doc): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const encoder = encoding.createEncoder();

    // Encode room name (file path) as prefix
    encoding.writeVarString(encoder, path);

    // Sync step 1
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);

    this.ws.send(encoding.toUint8Array(encoder));
  }

  /**
   * Handle incoming message from server.
   */
  private handleMessage(data: Buffer): void {
    const decoder = decoding.createDecoder(new Uint8Array(data));

    // Decode room name (file path)
    const path = decoding.readVarString(decoder);
    const messageType = decoding.readVarUint(decoder);

    let state = this.documents.get(path);
    if (!state) {
      // Document doesn't exist locally - create it
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);
      state = { doc, awareness, lastContent: '' };
      this.documents.set(path, state);

      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'local') {
          this.onRemoteUpdate(path, doc);
        }
      });
    }

    switch (messageType) {
      case MESSAGE_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarString(encoder, path);
        encoding.writeVarUint(encoder, MESSAGE_SYNC);

        const syncType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          state.doc,
          'remote'
        );

        if (encoding.length(encoder) > 1 + path.length) {
          this.ws?.send(encoding.toUint8Array(encoder));
        }
        break;
      }

      case MESSAGE_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          state.awareness,
          decoding.readVarUint8Array(decoder),
          'remote'
        );
        break;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    console.log('Scheduling reconnect in 5 seconds...');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (err) {
        console.error('Reconnect failed:', err);
        this.scheduleReconnect();
      }
    }, 5000);
  }
}

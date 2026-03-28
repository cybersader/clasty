# Plugin-Only CRDT Sync Design

## Overview

A pure Obsidian plugin approach to CRDT-based sync that works **without any server infrastructure**. This solves both:

1. **SMB Share Conflicts**: Multiple users editing files on shared network drives
2. **Web Collaboration**: (With optional server mode) Real-time sync in browser-based Obsidian

## Key Insight

CRDT doesn't require a central server. Each client can:
1. Maintain its own CRDT state
2. Store state in hidden files alongside content
3. Merge states when files sync (via SMB, Dropbox, etc.)
4. Automatically resolve all conflicts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSIDIAN CLIENT A                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   CRDT Sync Plugin                         │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │  File Hook   │  │  CRDT Engine │  │  State Manager │   │  │
│  │  │              │  │    (Yjs)     │  │                │   │  │
│  │  │  Intercepts  │  │              │  │  Reads/writes  │   │  │
│  │  │  open/save   │──│  Y.Doc per   │──│  .crdt/ files  │   │  │
│  │  │  operations  │  │  markdown    │  │                │   │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘   │  │
│  │                           │                                │  │
│  │                    ┌──────┴──────┐                         │  │
│  │                    ▼             ▼                         │  │
│  │             ┌───────────┐  ┌───────────┐                   │  │
│  │             │ File Sync │  │  Server   │ (optional)        │  │
│  │             │  (.crdt/) │  │   Sync    │                   │  │
│  │             └───────────┘  └───────────┘                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Files on disk:                                                 │
│  /vault/                                                        │
│  ├── notes/                                                     │
│  │   └── project.md           ◄── Readable markdown            │
│  └── .crdt/                   ◄── Hidden CRDT state            │
│      └── notes/                                                 │
│          ├── project.md.a1b2.yjs  ◄── Client A's state         │
│          └── project.md.c3d4.yjs  ◄── Client B's state (synced)│
└─────────────────────────────────────────────────────────────────┘
                              │
              SMB / Dropbox / Syncthing / OneDrive / Git
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    OBSIDIAN CLIENT B                            │
│                                                                 │
│  Same structure, sees all .crdt files after sync                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## User Identification

Each Obsidian client gets a unique ID:

```typescript
interface ClientIdentity {
  clientId: string;      // UUID generated on first install
  displayName?: string;  // Optional: user's name for attribution
  machineId?: string;    // Optional: machine fingerprint
}

// Generated once, stored in plugin settings
// Example: { clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

Options for ID generation:
1. **Random UUID** (default) - Simple, works everywhere
2. **Machine ID hash** - Same ID if reinstall on same machine
3. **User email hash** - Ties to user identity (requires configuration)
4. **Obsidian Sync ID** - Reuse existing identity if using Obsidian Sync

## CRDT State Storage

### File Structure

```
/vault/
├── .crdt/                          # Hidden folder (add to .gitignore if needed)
│   ├── _meta/
│   │   ├── clients.json            # Known clients and display names
│   │   └── last-merge.json         # Timestamps of last successful merges
│   └── {relative-path}/
│       └── {filename}.{clientId}.yjs
│
├── notes/
│   ├── project.md                  # Actual content (always readable)
│   └── ...
└── .obsidian/
    └── plugins/
        └── crdt-sync/
            └── data.json           # Plugin settings (clientId stored here)
```

### State File Format

Each `.yjs` file contains:

```typescript
interface CrdtStateFile {
  // Binary Yjs state (Y.encodeStateAsUpdate)
  state: Uint8Array;

  // Metadata header (first 256 bytes, JSON)
  metadata: {
    version: 1;
    clientId: string;
    lastModified: number;      // Unix timestamp
    contentHash: string;       // SHA-256 of rendered content
    sequenceNumber: number;    // Logical clock value
  };
}
```

## Core Operations

### On File Open

```typescript
async onFileOpen(file: TFile): Promise<void> {
  const relativePath = file.path;

  // 1. Find all CRDT state files for this note
  const stateFiles = await this.findStateFiles(relativePath);

  // 2. Create or load our Y.Doc
  let doc = this.activeDocs.get(relativePath);
  if (!doc) {
    doc = new Y.Doc();
    this.activeDocs.set(relativePath, doc);
  }

  // 3. Merge all remote states
  for (const stateFile of stateFiles) {
    const state = await this.vault.readBinary(stateFile.path);
    const update = this.extractYjsState(state);
    Y.applyUpdate(doc, update);
  }

  // 4. Check if merged content differs from file
  const currentContent = await this.vault.read(file);
  const mergedContent = doc.getText('content').toString();

  if (mergedContent && mergedContent !== currentContent) {
    // Content was updated by remote changes
    await this.vault.modify(file, mergedContent);
    new Notice('File updated with remote changes');
  } else if (!mergedContent && currentContent) {
    // First time: initialize CRDT from existing content
    doc.getText('content').insert(0, currentContent);
  }

  // 5. Start observing changes
  this.observeDoc(doc, relativePath);
}
```

### On File Save

```typescript
async onFileSave(file: TFile, content: string): Promise<void> {
  const relativePath = file.path;
  const doc = this.activeDocs.get(relativePath);

  if (!doc) {
    // No active doc - just save normally
    return;
  }

  // 1. Get current CRDT content
  const ytext = doc.getText('content');
  const crdtContent = ytext.toString();

  // 2. Compute diff and apply to CRDT
  if (content !== crdtContent) {
    doc.transact(() => {
      const patches = this.computePatches(crdtContent, content);
      this.applyPatches(ytext, patches);
    }, this.clientId);
  }

  // 3. Save our CRDT state
  const statePath = this.getStatePath(relativePath, this.clientId);
  const state = this.encodeStateWithMetadata(doc);
  await this.ensureDirectoryExists(statePath);
  await this.vault.adapter.writeBinary(statePath, state);

  // 4. Log for audit
  this.auditLog.push({
    timestamp: Date.now(),
    clientId: this.clientId,
    file: relativePath,
    operation: 'save',
    sequenceNumber: this.getSequenceNumber(doc)
  });
}
```

### Background Merge Check

```typescript
// Periodically check for new remote states
async backgroundMergeCheck(): Promise<void> {
  for (const [path, doc] of this.activeDocs) {
    const stateFiles = await this.findStateFiles(path);

    for (const stateFile of stateFiles) {
      // Skip our own state file
      if (stateFile.clientId === this.clientId) continue;

      // Check if we've already merged this version
      const lastMerged = this.lastMergedVersions.get(stateFile.path);
      const currentMtime = stateFile.mtime;

      if (!lastMerged || currentMtime > lastMerged) {
        // New remote changes - merge them
        const state = await this.vault.readBinary(stateFile.path);
        const update = this.extractYjsState(state);
        Y.applyUpdate(doc, update);

        this.lastMergedVersions.set(stateFile.path, currentMtime);

        // Update file content if changed
        const file = this.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          const currentContent = await this.vault.read(file);
          const mergedContent = doc.getText('content').toString();

          if (mergedContent !== currentContent) {
            await this.vault.modify(file, mergedContent);
            new Notice(`${file.basename} updated from ${stateFile.clientName || 'another user'}`);
          }
        }
      }
    }
  }
}
```

## Diff and Patch

Using `diff-match-patch` for efficient CRDT updates:

```typescript
import DiffMatchPatch from 'diff-match-patch';

class PatchManager {
  private dmp = new DiffMatchPatch();

  computePatches(oldContent: string, newContent: string): Patch[] {
    return this.dmp.patch_make(oldContent, newContent);
  }

  applyPatches(ytext: Y.Text, patches: Patch[]): void {
    // Convert patches to Yjs operations
    let offset = 0;

    for (const patch of patches) {
      for (const [op, text] of patch.diffs) {
        const position = patch.start1 + offset;

        if (op === -1) {
          // Delete
          ytext.delete(position, text.length);
          offset -= text.length;
        } else if (op === 1) {
          // Insert
          ytext.insert(position, text);
          offset += text.length;
        }
        // op === 0: no change, just advance
      }
    }
  }
}
```

## Conflict Resolution

CRDT handles conflicts automatically, but we can provide visibility:

```typescript
interface ConflictInfo {
  file: string;
  timestamp: number;
  authors: string[];      // Client IDs or display names
  divergencePoint: number; // Sequence number where branches diverged
  resolution: 'auto-merged' | 'user-review-needed';
}

// Detect when multiple clients edited simultaneously
function detectConflicts(doc: Y.Doc): ConflictInfo | null {
  const stateVector = Y.encodeStateVector(doc);
  // Analyze state vector for concurrent edits
  // Most cases: auto-merged successfully
  // Edge cases: flag for user review
}
```

## Optional Server Mode

For real-time sync (useful in web/Kasm scenario):

```typescript
interface SyncConfig {
  mode: 'file-only' | 'server-preferred' | 'server-required';
  serverUrl?: string;
  fallbackToFile: boolean;
}

class HybridSync {
  private fileSync: FileSyncManager;
  private serverSync?: ServerSyncManager;

  constructor(config: SyncConfig) {
    this.fileSync = new FileSyncManager();

    if (config.serverUrl) {
      this.serverSync = new ServerSyncManager(config.serverUrl);
    }
  }

  async sync(doc: Y.Doc, path: string): Promise<void> {
    // Try server first if available
    if (this.serverSync?.connected) {
      await this.serverSync.sync(doc, path);
    }

    // Always sync to files as backup/primary
    await this.fileSync.sync(doc, path);
  }
}
```

## Handling Binary Files

Same approach as daemon architecture - hash references:

```typescript
interface BinaryReference {
  hash: string;           // SHA-256 of file content
  originalName: string;   // Original filename
  mimeType: string;
  size: number;
}

// Store binaries in .crdt/_blobs/
// Reference in markdown: ![image](crdt://sha256:abc123)
// On render: resolve to actual blob path
```

## Plugin Settings UI

```typescript
interface PluginSettings {
  // Identity
  clientId: string;
  displayName: string;

  // Sync behavior
  syncMode: 'file-only' | 'server-preferred';
  serverUrl: string;

  // Performance
  backgroundCheckInterval: number; // ms, default 5000
  debounceDelay: number;           // ms, default 500

  // Storage
  crdtFolderName: string;          // default '.crdt'
  maxStateHistory: number;         // How many old states to keep

  // UI
  showSyncStatus: boolean;
  showConflictNotifications: boolean;
  showLastEditedBy: boolean;
}
```

## Advantages Over Daemon Approach

| Aspect | Plugin-Only | Daemon |
|--------|-------------|--------|
| **Deployment** | Install plugin, done | Docker stack + config |
| **SMB Shares** | Native support | Not designed for this |
| **Offline** | Full support | Partial |
| **Server Dependency** | None | Required |
| **Real-time** | No (sync-interval based) | Yes |
| **Enterprise IT** | Minimal involvement | Requires infrastructure |

## Use Cases

### 1. SMB Share Team Vault

```
Corporate file server (SMB):
\\fileserver\shared\team-vault\

Users:
- Alice: Obsidian + CRDT plugin, ClientID: alice-abc
- Bob: Obsidian + CRDT plugin, ClientID: bob-xyz
- Carol: Obsidian WITHOUT plugin (sees plain .md files)

Result:
- Alice and Bob get conflict-free sync
- Carol can still read/edit (no CRDT, but doesn't break anything)
- .crdt folder syncs automatically via SMB
```

### 2. Dropbox Family Vault

```
Dropbox shared folder:
/Dropbox/Family/shared-vault/

Family members on different devices:
- Mom's laptop: plugin installed
- Dad's desktop: plugin installed
- Kid's iPad: Obsidian mobile (no plugin yet)

Result:
- Mom and Dad get conflict-free sync
- Kid sees plain files (mobile plugin could come later)
```

### 3. Web/Kasm Enterprise

```
Kasm-based Obsidian:
- Multiple users in browser
- Plugin in server-preferred mode
- y-websocket server for real-time
- File-based sync as backup

Result:
- Real-time collaboration when server up
- Graceful fallback to file sync if server down
```

## Implementation Phases

### Phase 1: Core Plugin
- [x] Design document (this file)
- [ ] Plugin scaffolding (main.ts, manifest.json)
- [ ] Client ID generation and settings
- [ ] Yjs integration
- [ ] File-based state storage
- [ ] Basic merge on file open

### Phase 2: Robust Sync
- [ ] Background merge checking
- [ ] Diff-match-patch integration
- [ ] Conflict detection and notification
- [ ] Audit logging

### Phase 3: UX Polish
- [ ] Status bar indicator
- [ ] "Last edited by" display
- [ ] Settings UI
- [ ] Conflict resolution UI

### Phase 4: Server Mode (Optional)
- [ ] WebSocket client
- [ ] Server discovery
- [ ] Hybrid sync logic

## Open Questions

1. **State file cleanup**: How long to keep old client states? Auto-cleanup after X days of inactivity?

2. **Large vaults**: Performance with 10,000+ files? Lazy loading of Y.Docs?

3. **Binary handling**: Store in .crdt/_blobs or external? Size limits?

4. **Mobile support**: Obsidian mobile plugin API limitations?

5. **Encryption**: Encrypt .crdt files? (Useful for Dropbox/cloud sync)

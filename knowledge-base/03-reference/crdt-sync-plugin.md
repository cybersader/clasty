# CRDT Sync Plugin

Status: **Completed** (core functionality)

---

## Overview

Obsidian plugin providing conflict-free sync using CRDT (Yjs). Supports three modes:
- **File-only**: Sync via SMB/Dropbox/cloud storage
- **Hybrid**: Server when available, file fallback
- **Server-only**: Real-time WebSocket sync

---

## Location

`obsidian-plugin/`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Plugin entry, settings, file hooks |
| `src/crdt-state-manager.ts` | Read/write .crdt state files |
| `src/file-sync-manager.ts` | Debounced save handling |
| `src/presence-manager.ts` | Track who's editing what |
| `src/identity.ts` | Client ID generation |
| `manifest.json` | Plugin metadata |
| `package.json` | Dependencies (Yjs, diff-match-patch) |

---

## Features

### Implemented

- [x] Yjs CRDT integration
- [x] File-based state storage (.crdt folder)
- [x] Background merge checking
- [x] Presence awareness (status bar)
- [x] Editing nudge suggestions
- [x] Settings UI for all modes
- [x] WebSocket server connection
- [x] Client ID generation

### Pending

- [ ] diff-match-patch for efficient updates
- [ ] Conflict visualization UI
- [ ] Mobile support
- [ ] Binary file handling

---

## How It Works

### File-Only Mode

```
User edits project.md
       ↓
Plugin updates Y.Doc
       ↓
Plugin saves .crdt/project.md.{clientId}.yjs
       ↓
SMB/Dropbox syncs to other clients
       ↓
Other client opens project.md
       ↓
Plugin merges all .yjs files
       ↓
project.md updated with merged content
```

### Hybrid Mode

Same as file-only, plus:
- Connect to WebSocket server
- Real-time updates when server available
- Fall back to file sync when disconnected

---

## Configuration

```typescript
interface CrdtSyncSettings {
  clientId: string;           // Auto-generated UUID
  displayName: string;        // User's name
  syncMode: 'file-only' | 'hybrid' | 'server-only';
  serverUrl: string;          // ws://host:port
  backgroundCheckInterval: number;  // ms (default 3000)
  debounceDelay: number;      // ms (default 500)
  crdtFolderName: string;     // default '.crdt'
  showPresence: boolean;
  showPresenceNudge: boolean;
  showSyncStatus: boolean;
  showConflictNotifications: boolean;
}
```

---

## Related

- [Plugin-Only Sync Design](plugin-only-sync.md)
- [Architecture](../areas/architecture.md)
- [Decision: Hybrid Plugin Modes](../resources/decisions/decision-log.md#decision-004-hybrid-plugin-modes-file--server)

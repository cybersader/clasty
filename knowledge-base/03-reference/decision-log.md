# Decision Log

This document captures all significant architectural and technical decisions made during the project, along with the rationale and alternatives considered.

---

## Decision Template

```
### [DECISION-XXX] Title
**Date**: YYYY-MM-DD
**Status**: Accepted / Superseded / Deprecated
**Context**: What led to this decision?
**Decision**: What was decided?
**Rationale**: Why this choice?
**Alternatives Considered**: What else was evaluated?
**Consequences**: What are the implications?
```

---

## Decisions

### [DECISION-001] Use Yjs for CRDT Implementation

**Date**: 2024-12-18
**Status**: Accepted

**Context**: Need a CRDT library for conflict-free real-time sync between multiple Obsidian instances.

**Decision**: Use Yjs as the CRDT library.

**Rationale**:
- Battle-tested (used by Notion, Figma, etc.)
- Excellent TypeScript support
- Well-documented with active community
- y-websocket provides simple sync transport
- Works well with text content (markdown)

**Alternatives Considered**:
| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| Automerge | True CRDT, Rust core | Heavier, more complex API | Overkill for text sync |
| OctoBase | Native binary support | Newer, less proven | Risk of instability |
| Obsidian LiveSync | Built for Obsidian | Uses CouchDB revision trees (NOT true CRDT) | Conflict resolution not guaranteed |

**Consequences**:
- Need to handle binary files separately (MinIO for storage)
- Must implement diff-match-patch for efficient text updates
- WebSocket transport required for real-time mode

---

### [DECISION-002] RBAC at Vault Level, Not File Level

**Date**: 2024-12-18
**Status**: Accepted

**Context**: Enterprise needs access control for sensitive vaults. Options: control access per-file or per-vault.

**Decision**: Implement RBAC at vault mount time. If a user can mount a vault, they have full access to it.

**Rationale**:
- Dramatically simpler implementation
- Works with Obsidian's filesystem-based architecture
- Mount-time control is enforceable at container level
- File-level RBAC would fight Obsidian's design (it expects full filesystem access)

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| File-level permissions | Would require hiding files in UI, complex permission checks on every operation, fights Obsidian's architecture |
| Cerbos policies | Considered for file-level, but decided vault-level is sufficient |
| FUSE overlay filesystem | Complex, performance overhead, maintenance burden |

**Consequences**:
- Vaults must be organized by access level (can't have mixed permissions within a vault)
- Mount orchestration service needed to control what gets mounted
- Simpler audit logging (vault access, not per-file)

---

### [DECISION-003] External Sync Daemon vs Obsidian Plugin

**Date**: 2024-12-18
**Status**: Accepted

**Context**: Need to sync file changes between Obsidian and CRDT system. Options: plugin inside Obsidian, or external daemon.

**Decision**: Use external sync daemon as primary, with optional plugin for enhancements.

**Rationale**:
- Obsidian's file cache causes timing issues (file on disk vs in-memory)
- Plugin crashes can crash Obsidian
- Daemon reads directly from filesystem after Obsidian writes (CLOSE_WRITE events)
- More reliable and debuggable

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Plugin-only | Timing issues with Obsidian's file cache, crashes affect app |
| Obsidian Relay approach | Good reference, but daemon is more robust |

**Consequences**:
- Daemon runs alongside Obsidian in container
- Uses inotify/chokidar for file watching
- Optional plugin can provide presence awareness and UI enhancements

---

### [DECISION-004] Hybrid Plugin Modes (File + Server)

**Date**: 2024-12-19
**Status**: Accepted

**Context**: Need to support both enterprise (server-based) and individual (SMB/cloud sync) use cases.

**Decision**: Single plugin with three modes: file-only, hybrid, server-only.

**Rationale**:
- Progressive adoption: start with file-only, add server when ready
- Same underlying problem: SMB conflicts = web collaboration conflicts
- Plugin-only mode enables zero-infrastructure adoption
- Hybrid mode provides best of both worlds

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Separate plugins | Duplicate code, confusing for users |
| Server-only | Requires infrastructure, limits adoption |
| File-only | No real-time capability for enterprise |

**Consequences**:
- Plugin stores CRDT state in `.crdt/` folder
- Settings UI allows mode selection
- Server mode requires y-websocket endpoint

---

### [DECISION-005] Binary Files via Hash References to MinIO

**Date**: 2024-12-18
**Status**: Accepted

**Context**: CRDT struggles with large binary files (images, PDFs). Need a solution for attachments.

**Decision**: Store binaries in MinIO, reference by hash in CRDT.

**Rationale**:
- CRDTs are inefficient for large binary blobs
- Content-addressable storage (hash = filename) enables deduplication
- MinIO is S3-compatible, self-hosted
- Only hash syncs via CRDT, actual bytes stored once

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Full binary in CRDT | Huge state, slow sync, memory issues |
| Git LFS style | Adds complexity, not designed for CRDT |
| Skip binary sync | Users expect attachments to sync |

**Consequences**:
- Markdown references like `![image](crdt://sha256:abc123)`
- Need resolver to map hash to MinIO URL
- Binary upload/download handled separately from CRDT

---

### [DECISION-006] Per-Client CRDT State Files

**Date**: 2024-12-19
**Status**: Accepted

**Context**: For file-only sync mode, need to store CRDT state somewhere that syncs via SMB/Dropbox.

**Decision**: Store per-client state files: `.crdt/{path}.{clientId}.yjs`

**Rationale**:
- Each client owns one file - no write conflicts
- SMB/Dropbox syncs both files without creating conflict copies
- On open: merge all `.yjs` files
- CRDT math ensures merge is deterministic

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Single shared state file | SMB/Dropbox creates conflict copies |
| Operation log (JSONL) | Grows unbounded, needs compaction |
| Per-client folders | Harder to find all states for a file |

**Consequences**:
- Client ID generated on first plugin install
- `.crdt/` folder should be in `.obsidianignore` to hide from file explorer
- State files are binary Yjs encoding (compact)

---

## Pending Decisions

### [DECISION-TBD] VNC Gateway Selection

**Status**: Under Evaluation

**Options**:
- Kasm Workspaces (enterprise, licensing cost)
- Apache Guacamole (open source, simpler)
- Selkies/GStreamer (WebRTC, lower latency)

**Evaluation Criteria**:
- SSO integration
- Session management
- Scaling capability
- Licensing cost
- Latency

---

### [DECISION-TBD] Kubernetes vs Docker Compose for Production

**Status**: Deferred

**Context**: POC uses docker-compose. Production may need Kubernetes.

**Considerations**:
- Scaling sync servers
- Session persistence
- Container orchestration
- Complexity vs capability

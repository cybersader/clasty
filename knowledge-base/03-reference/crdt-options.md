# CRDT Options Research

Comparison of CRDT libraries considered for this project.

---

## Selection: Yjs

**Chosen for**: Battle-tested, TypeScript support, good documentation, y-websocket transport.

---

## Options Evaluated

### Yjs (Selected)

**Website**: https://docs.yjs.dev/

**Pros**:
- Used by Notion, Figma, Liveblocks
- Excellent TypeScript support
- Active community and development
- y-websocket provides simple WebSocket sync
- y-protocols for awareness (presence)
- Well-documented with examples

**Cons**:
- Binary files need separate handling
- State grows with edit history (can compact)

**Key Features**:
- Y.Doc per document
- Y.Text for text content
- Awareness protocol for presence
- Multiple providers (WebSocket, WebRTC, etc.)

---

### Automerge

**Website**: https://automerge.org/

**Pros**:
- True CRDT with mathematical guarantees
- Rust core with WASM bindings
- Strong academic backing
- Good for complex data structures

**Cons**:
- Heavier than Yjs
- More complex API
- Overkill for text sync

**Why Not Chosen**: Yjs is simpler and sufficient for text/markdown sync.

---

### OctoBase (AFFiNE)

**Website**: https://github.com/toeverything/OctoBase

**Pros**:
- Native binary file support
- Built for block-based editors
- Used by AFFiNE

**Cons**:
- Newer, less proven
- Tied to AFFiNE ecosystem
- Less documentation

**Why Not Chosen**: Risk of instability, less community support.

---

### Obsidian LiveSync (CouchDB)

**Website**: https://github.com/vrtmrz/obsidian-livesync

**Pros**:
- Built specifically for Obsidian
- Active development
- Self-hosted with CouchDB

**Cons**:
- NOT true CRDT (uses CouchDB revision trees)
- Conflict resolution not guaranteed
- Requires CouchDB infrastructure

**Why Not Chosen**: Not a true CRDT, conflicts possible.

---

### Relay Plugin (Yjs-based)

**Website**: https://github.com/No-Instructions/Relay

**Pros**:
- Obsidian plugin using Yjs
- Solved "file on disk" problem with diff-match-patch
- Good reference implementation

**Cons**:
- Plugin-based (timing issues with file cache)
- Less control over sync architecture

**Why Referenced**: Good example of Yjs + Obsidian integration. Borrowed diff-match-patch approach.

---

## Key Learnings

1. **File on disk problem**: Obsidian's file cache causes timing issues. Solution: diff-match-patch to reconcile CRDT state with filesystem.

2. **Binary handling**: All CRDTs struggle with large binaries. Solution: store by hash in object storage, sync only references.

3. **Awareness protocol**: Yjs y-protocols provides presence (who's editing) out of the box.

4. **State growth**: CRDT state grows with edit history. Can compact periodically.

---

## Resources

- [Yjs Documentation](https://docs.yjs.dev/)
- [CRDT Primer](https://crdt.tech/)
- [Automerge Performance](https://automerge.org/docs/performance/)
- [Relay Plugin Source](https://github.com/No-Instructions/Relay)

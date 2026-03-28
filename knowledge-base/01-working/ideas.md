# Ideation & Ideas

Raw ideas, future possibilities, and "what if" thoughts captured during development.

---

## Format

```
### [IDEA-XXX] Title
**Date**: YYYY-MM-DD
**Status**: Captured / Exploring / Implementing / Parked
**Description**: What's the idea?
**Potential**: What could this enable?
**Challenges**: What makes this hard?
```

---

## Active Ideas

### [IDEA-001] CRDT Solves Both Web and SMB Conflicts

**Date**: 2024-12-19
**Status**: Implementing

**Description**: The same CRDT approach that enables web collaboration also solves SMB share conflicts. These are fundamentally the same problem - concurrent edits need merging, not overwriting.

**Potential**:
- Plugin-only mode for SMB users (no infrastructure needed)
- Dropbox/OneDrive/iCloud users get conflict-free sync
- Progressive adoption from individual to enterprise

**Challenges**:
- Sync latency depends on file sync speed (not real-time)
- Users need to install plugin on all clients

---

### [IDEA-002] Presence Awareness with "Nudge"

**Date**: 2024-12-19
**Status**: Implementing

**Description**: Show users when others are editing the same file, and suggest editing in a different section to avoid collisions.

**Potential**:
- Better UX when multiple users on same file
- Reduces unnecessary CRDT merges
- Educational - teaches users about collaboration

**Challenges**:
- Need to track cursor positions
- Nudge suggestions need to be helpful, not annoying
- File-only mode has delayed presence updates

---

### [IDEA-003] Progressive Adoption Path

**Date**: 2024-12-19
**Status**: Implementing

**Description**: Design the system so users can start simple and add complexity as needed:
1. File-only (just install plugin)
2. Hybrid (add server for real-time)
3. Full enterprise (VNC + SSO + audit)

**Potential**:
- Lower barrier to entry
- Users grow into enterprise features
- Same codebase serves all use cases

**Challenges**:
- Settings UI needs to be clear
- Documentation for each level

---

### [IDEA-004] AFFiNE as Alternative

**Date**: 2024-12-18
**Status**: Parked

**Description**: AFFiNE is CRDT-native from the ground up. Could be a better long-term solution than wrapping Obsidian.

**Potential**:
- No VNC needed (native web)
- Built-in collaboration
- Modern architecture

**Challenges**:
- Not Obsidian (different UX, different plugins)
- Less mature than Obsidian
- Users already invested in Obsidian

**Decision**: Park for now, evaluate after POC. Obsidian has massive plugin ecosystem.

---

### [IDEA-005] Obsidian Mobile Plugin

**Date**: 2024-12-19
**Status**: Captured

**Description**: Extend the CRDT sync plugin to work on Obsidian Mobile.

**Potential**:
- Full sync across desktop, mobile, and web
- Unified experience

**Challenges**:
- Mobile plugin API limitations
- Background sync on mobile is tricky
- Battery/performance concerns

---

### [IDEA-006] Conflict Resolution UI

**Date**: 2024-12-18
**Status**: Captured

**Description**: When CRDT merges happen, provide a UI to show what was merged and allow manual adjustments.

**Potential**:
- Transparency about what changed
- Manual override when needed
- Educational about CRDT

**Challenges**:
- CRDT merges are usually invisible (that's the point)
- UI complexity
- When to show vs auto-accept

---

### [IDEA-007] Vault Templates for Enterprise

**Date**: 2024-12-19
**Status**: Captured

**Description**: Pre-configured vault templates with structure, plugins, and settings for enterprise use cases.

**Potential**:
- Faster onboarding
- Consistent setup across teams
- Best practices built-in

**Challenges**:
- One size doesn't fit all
- Plugin compatibility
- Update management

---

### [IDEA-008] CRDT Operation History for Audit

**Date**: 2024-12-19
**Status**: Captured

**Description**: Instead of just storing merged state, store the operation log to see who changed what when.

**Potential**:
- Full audit trail
- "Blame" functionality
- Undo individual user's changes

**Challenges**:
- Storage grows unbounded
- Needs compaction strategy
- Privacy considerations

---

## Parked Ideas

### [IDEA-P01] Browser Extension for Quick Capture

**Description**: Browser extension that clips content directly to Obsidian vault via CRDT sync.

**Why Parked**: Focus on core sync first. Can add later.

---

### [IDEA-P02] AI Integration

**Description**: AI-powered features like summarization, tagging, linking suggestions.

**Why Parked**: Out of scope for POC. Obsidian has AI plugins already.

---

## Rejected Ideas

### [IDEA-R01] File-Level RBAC

**Description**: Control access at the file level, not vault level.

**Why Rejected**: Fights Obsidian's architecture. Would need to hide files in UI, check permissions on every operation. Vault-level is simpler and sufficient.

---

### [IDEA-R02] Native Web Obsidian Port

**Description**: Port Obsidian to run natively in browser.

**Why Rejected**: Obsidian depends on Node.js filesystem APIs. Would need to rewrite core. VNC approach preserves full plugin compatibility.

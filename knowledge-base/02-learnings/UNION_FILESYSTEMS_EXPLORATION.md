### User

## Essentially trying to create a system where, on the fly, we could have a mount orchestrator that takes all of the relevant folders in the hierarhical system and bind them so that OBsidian can only a folder and the person only has access to what they've been given permission. Granted, lots of stuff probably breaks. Help me think through this problem though please. Give me architectural options.

The Core Tension

The architecture says: one vault = one permission boundary. But there are two things fighting each other:

1. Obsidian only opens one vault at a time. You can't link between vaults, search across vaults, or see a unified graph. So if you split content  
	into many small permission-scoped vaults (engineering-vault, finance-vault, project-x-vault...), the user experience degrades badly — constant  
	vault switching, no cross-linking, no unified knowledge graph.
2. Organizational access patterns aren't hierarchical — they're a graph. An engineer on Project Alpha might need: engineering docs +  
	project-alpha docs + company wiki. A marketer on the same project needs: marketing docs + project-alpha docs + company wiki. You can't represent  
	that matrix of permissions in a single folder tree with a single mount point.

So you're stuck:

- Few big vaults = good UX (linking, search, graph) but too-permissive access
- Many small vaults = proper RBAC but terrible UX (no cross-linking, vault switching)

The decision log even acknowledges the consequence: "Vaults must be organized by access level (can't have mixed permissions within a vault)" —  
but doesn't really grapple with how limiting that is in practice.

A Better Model: Composite Vault via Bind Mounts

Instead of "mount a vault," the orchestrator could assemble a per-user vault from multiple authorized folders:

Engineer on Project Alpha sees:  
/user-vault/ <- Obsidian opens this ONE vault  
.obsidian/ <- Per-user config  
engineering/ <- bind mount from shared storage  
project-alpha/ <- bind mount from shared storage  
wiki/ <- bind mount from shared storage  
personal/ <- private space

Marketer on Project Alpha sees:  
/user-vault/  
.obsidian/  
marketing/ <- bind mount  
project-alpha/ <- bind mount (same source!)  
wiki/ <- bind mount  
personal/

Each subfolder is an independently-mountable permission boundary. The orchestrator assembles the user's personalized vault at session start. To  
Obsidian, it's one vault — full linking, search, and graph across everything the user can access.

Cross-links pointing to content the user can't see just become dead links (the file literally isn't mounted). That's a graceful degradation, not  
a security hole.

What This Doesn't Solve

You're still constrained by the tree structure problem. If content naturally belongs to both "engineering" and "project-alpha," you have to pick  
one folder or duplicate it. The content organization must be designed around access boundaries rather than conceptual taxonomy. That's a real  
tradeoff — but it's inherent to any filesystem-based permission model.

Bottom Line

The current architecture's "vault-level RBAC" is actually too coarse. Folder-level RBAC via composite bind mounts is a more flexible middle  
ground between "whole vault or nothing" and the rejected "file-level permissions" approach. It keeps the simplicity (mount-time enforcement, no  
runtime checks) while being much more granular.

Want me to explore this composite mount approach further and update the architecture docs? Or are you thinking about this differently?

---

MORE CONTEXT BELOW

Pasted Text 1

### AI

# Composite Vault via Bind Mounts: Deep Analysis

This is a genuinely hard problem. The composite bind mount idea is the right direction, but there are several layers of breakage to think through. Let me lay out the full landscape.

---

## What Breaks (And How Badly)

### 1\. Cross-Mount File Moves — **Critical**

On Linux, `rename()` doesn't work across filesystem boundaries. If `engineering/` and `project-alpha/` are separate bind mounts, dragging a file between them in Obsidian triggers `EXDEV` (cross-device link). Most apps fall back to copy+delete, but:

- Obsidian may or may not handle `EXDEV` gracefully (Electron/Node.js `fs.rename` does *not* automatically fall back — it throws)
- Copy+delete is non-atomic — if the process dies mid-operation, you lose data
- CRDT sees a **delete** in one sync room and a **create** in another — the history/attribution breaks

**Severity**: High. Users will try to reorganize files. It will fail or behave strangely.

### 2\. `.obsidian/` Configuration — **Critical**

The `.obsidian/` folder stores workspace state, plugin configs, hotkeys, themes. Many plugins reference vault paths:

- **Templater**: `template folder: engineering/templates` — breaks if not mounted
- **Daily Notes**: `folder: personal/daily` — breaks if path doesn't exist
- **Dataview**: queries across the vault — silently returns partial results if folders are missing
- **Workspace layouts**: references to open files — dead references if those files aren't mounted

This means `.obsidian/` must be **per-user** and **aware of what's mounted**.

### 3\. New File Creation — **Medium**

`Ctrl+N` creates a file in the vault root or a configured folder. If the root is a scaffold of mount points with no writable layer, where does the file go? Obsidian will error or silently fail.

### 4\. CRDT Sync Granularity — **Architectural**

Current design: one vault = one Yjs room. With composite vaults:

- `engineering/` must sync to all engineering users
- `project-alpha/` must sync to all project-alpha users
- `personal/` must sync only to that user's devices

The sync daemon needs **per-folder room awareness**, not per-vault. This is a significant redesign.

### 5\. Search and Graph — **Cosmetic but Noticeable**

- Search returns results only from mounted folders — this is fine, arguably a feature
- Graph shows only mounted content — also fine
- But users will notice inconsistency: "Alice says there's a note about X, but I can't find it" — because it's in a folder they can't see

### 6\. Obsidian Indexing — **Medium**

When a user's group membership changes and new folders appear at next login, Obsidian has to re-index. For large vaults this can take time and causes the "vault has changed" warnings.

---

## Architectural Options

### Option A: Docker Bind Mounts (Most Straightforward)

The orchestrator spins up a container per user with specific bind mounts.

text

\# Orchestrator generates this per-user
docker run \\
  -v /shared/engineering:/vault/engineering:rw \\
  -v /shared/project-alpha:/vault/project-alpha:rw \\
  -v /shared/wiki:/vault/wiki:ro \\
  -v /users/alice/.obsidian:/vault/.obsidian:rw \\
  -v /users/alice/personal:/vault/personal:rw \\
  -v /users/alice/inbox:/vault/inbox:rw \\   # writable root-level folder
  obsidian-container

text

/vault/                          ← Obsidian opens this
├── .obsidian/                   ← Per-user (own bind mount)
├── inbox/                       ← Writable space for new files
├── personal/                    ← User-only
├── engineering/                 ← Shared, from /shared/engineering
├── project-alpha/               ← Shared, from /shared/project-alpha
└── wiki/                        ← Read-only shared

| Aspect | Assessment |
| --- | --- |
| Security | **Strong** — kernel-enforced, no runtime checks |
| Cross-mount moves | **Broken** — `EXDEV` on `rename()` across mounts |
| Dynamic permission changes | **Requires container restart** |
| Complexity | Low-medium |
| CRDT impact | Per-folder sync rooms needed |

**Mitigation for `EXDEV`**: A FUSE shim or inotify-based daemon that intercepts failed renames and performs copy+delete. Or patch Obsidian's file operations via a plugin that wraps `fs.rename` with a cross-device fallback.

---

### Option B: MergerFS (Union Filesystem)

Use [mergerfs](https://github.com/trapexit/mergerfs) to combine multiple source directories into a single mount point. MergerFS is FUSE-based but mature and production-tested.

bash

```
# Orchestrator runs this inside the container at session start
mergerfs \
  /users/alice/personal:/shared/engineering:/shared/project-alpha:/shared/wiki \
  /vault \
  -o defaults,allow_other,use_ino,category.create=mfs
```

text

/vault/                          ← Unified view
├── README.md                    ← Could be from any source
├── engineering-doc.md           ← From /shared/engineering
├── project-plan.md              ← From /shared/project-alpha
└── ...

| Aspect | Assessment |
| --- | --- |
| Security | **Medium** — permission enforcement is at mergerfs config level |
| Cross-mount moves | **Works!** — mergerfs handles cross-branch moves transparently |
| Dynamic permission changes | **Can remount without full restart** |
| Complexity | Medium (FUSE dependency) |
| Folder structure | **Flat** — all content merges into one namespace (naming collisions possible) |

**Big problem**: MergerFS merges everything into a flat namespace. If `engineering/` has `README.md` and `wiki/` has `README.md`, you get a collision. You'd need to either:

- Keep the subfolder structure (mergerfs supports this with `branches`)
- Enforce unique naming conventions

**Better variant**: Use mergerfs in **branch mode** where each source appears as a subfolder (essentially what bind mounts do, but with cross-branch move support).

---

### Option C: Symlinks in a Scaffold Directory

Create a directory per user with symlinks to permitted shared folders.

bash

```
# Orchestrator script at session start
mkdir -p /vault/alice
ln -s /shared/engineering    /vault/alice/engineering
ln -s /shared/project-alpha  /vault/alice/project-alpha
ln -s /shared/wiki           /vault/alice/wiki
cp -r /templates/.obsidian   /vault/alice/.obsidian  # per-user config
mkdir -p /vault/alice/personal
```

| Aspect | Assessment |
| --- | --- |
| Security | **Weak** — symlinks are visible, user could potentially resolve them to discover paths |
| Cross-mount moves | **Same EXDEV problem** — symlinks don't change the underlying filesystem boundary |
| Dynamic permission changes | **Easy** — just add/remove symlinks, no restart |
| Complexity | Low |
| Container requirement | **None** — works on bare metal too |

**Important**: Obsidian follows symlinks just fine for reading. But in a Docker container, symlinks pointing outside the container's filesystem won't resolve unless the targets are also mounted. So this is really only useful **inside** a container where the shared storage is already available, or on bare metal.

---

### Option D: OverlayFS with Writable Upper Layer

Use OverlayFS to present a merged read-only view of permitted folders, with a per-user writable upper layer.

bash

```
mount -t overlay overlay \
  -o lowerdir=/shared/engineering:/shared/project-alpha:/shared/wiki,\
     upperdir=/users/alice/upper,\
     workdir=/users/alice/work \
  /vault
```

| Aspect | Assessment |
| --- | --- |
| Security | **Strong** — kernel-level |
| Cross-mount moves | **Works** — overlayfs handles this internally |
| Writes to shared folders | **Problem** — writes go to the upper layer, not to the shared source |
| Dynamic permission changes | Remount needed |
| Complexity | Medium-high |

**Critical flaw**: OverlayFS's copy-on-write semantics mean that when Alice edits a file from `engineering/`, the edit goes to her **upper layer**, not to the shared `engineering/` source. Other users never see the change. This defeats the entire purpose of shared editing.

You could reverse it (shared writable layers), but OverlayFS doesn't support multiple writable layers.

**Verdict**: OverlayFS is wrong for this use case. It's designed for container image layering, not shared collaboration.

---

### Option E: Custom FUSE Filesystem

Build a custom FUSE filesystem that:

- Presents a unified directory tree from multiple sources
- Handles cross-source moves transparently
- Enforces read/write permissions per-subtree
- Supports dynamic reconfiguration

| Aspect | Assessment |
| --- | --- |
| Security | **Maximum** — you control everything |
| Cross-mount moves | **Works** — you implement the logic |
| Dynamic permissions | **Works** — update config, no remount |
| Complexity | **Very high** — you're building a filesystem |
| Performance | FUSE overhead on every file operation |

This is the "if you have unlimited engineering budget" option. Probably not worth it unless you're building a product.

---

### Option F: Bind Mounts + Patched File Operations (Recommended Hybrid)

This is Option A (Docker bind mounts) **plus** a solution for the cross-mount move problem:

text

/vault/                          ← Obsidian opens this
├── .obsidian/                   ← Per-user
├── \_inbox/                      ← Writable, for new files
├── engineering/                 ← Bind mount
├── project-alpha/               ← Bind mount
├── wiki/                        ← Bind mount (read-only)
└── personal/                    ← Bind mount (user-only)

**Cross-mount move solution**: An Obsidian plugin that overrides the default file move behavior:

typescript

```
// Plugin intercepts file move events
this.app.vault.on('rename', async (file, oldPath) => {
  // If rename fails with EXDEV, do copy+delete
  // Emit events to sync daemon for proper CRDT handling
});
```

Or, at the daemon level, a wrapper around Node.js `fs` that catches `EXDEV` and does `copyFile` + `unlink`:

typescript

```
// In the container's entrypoint or as a LD_PRELOAD shim
async function safeRename(oldPath: string, newPath: string) {
  try {
    await fs.rename(oldPath, newPath);
  } catch (err) {
    if (err.code === 'EXDEV') {
      await fs.copyFile(oldPath, newPath);
      await fs.unlink(oldPath);
    } else {
      throw err;
    }
  }
}
```

**CRDT handling for cross-boundary moves**:

1. Sync daemon detects delete in `engineering/` room
2. Sync daemon detects create in `project-alpha/` room
3. Correlation logic (same content hash + timing) identifies it as a move
4. Other clients in both rooms see the move propagated correctly

| Aspect | Assessment |
| --- | --- |
| Security | **Strong** — kernel-enforced bind mounts |
| Cross-mount moves | **Handled** — via plugin or daemon shim |
| Dynamic permissions | Requires container restart (or exec into container to add mounts) |
| Complexity | Medium |
| CRDT impact | Per-folder sync rooms, move correlation logic |

---

## The CRDT Sync Redesign

Regardless of which option you pick, the sync architecture needs to change from **per-vault rooms** to **per-folder rooms**:

text

Current:
  Yjs Room: "vault-engineering"  ← one room per vault

Needed:
  Yjs Room: "folder-engineering"     ← one room per permission boundary
  Yjs Room: "folder-project-alpha"
  Yjs Room: "folder-wiki"
  Yjs Room: "folder-alice-personal"  ← user-scoped

The sync daemon in each container connects to **multiple rooms** based on what's mounted:

text

┌─────────────────────────────────────────────────────┐
│  Alice's Container                                   │
│                                                      │
│  Sync Daemon                                         │
│  ├── watches /vault/engineering/    → Room: eng      │
│  ├── watches /vault/project-alpha/  → Room: proj-a   │
│  ├── watches /vault/wiki/           → Room: wiki     │
│  └── watches /vault/personal/       → Room: alice    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Bob's Container                                     │
│                                                      │
│  Sync Daemon                                         │
│  ├── watches /vault/marketing/      → Room: mktg     │
│  ├── watches /vault/project-alpha/  → Room: proj-a   │ ← same room!
│  └── watches /vault/wiki/           → Room: wiki     │ ← same room!
└─────────────────────────────────────────────────────┘

The sync daemon config becomes:

yaml

```
# Generated by orchestrator at session start
sync:
  folders:
    - path: /vault/engineering
      room: folder-engineering
      readOnly: false
    - path: /vault/project-alpha
      room: folder-project-alpha
      readOnly: false
    - path: /vault/wiki
      room: folder-wiki
      readOnly: true
    - path: /vault/personal
      room: user-alice-personal
      readOnly: false
```

---

## The `.obsidian/` Management Problem

This deserves its own strategy. Options:

### A. Fully Per-User (Simplest)

Each user gets their own `.obsidian/`. IT pushes a base template on first login. Users can customize.

**Problem**: Plugin configs that reference paths may point to unmounted folders. Templater, Daily Notes, etc. need path configs that match the user's mounted folders.

**Fix**: Orchestrator generates/patches `.obsidian/` config at session start:

typescript

```
// orchestrator generates this
const obsidianConfig = {
  ...baseConfig,
  dailyNotes: {
    folder: mountedFolders.includes('personal') 
      ? 'personal/daily' 
      : '_inbox/daily'
  },
  templates: {
    folder: mountedFolders.includes('engineering')
      ? 'engineering/_templates'
      : '_inbox/_templates'
  }
};
```

### B. Managed Config (More Control)

Orchestrator fully generates `.obsidian/` every session. Users can't customize plugins/themes.

**Tradeoff**: Less user freedom, but guarantees consistency.

### C. Layered Config

Base config (IT-managed) + user overrides. Orchestrator merges them at session start, removing invalid path references.

---

## The Cross-Link Problem

When Alice links to `[[engineering/api-design]]` and Bob doesn't have `engineering/` mounted:

- Bob sees a dead link (purple/unresolved in Obsidian)
- Bob can't navigate to it
- Bob's graph doesn't show it

**This is actually fine**. It's the same as linking to a page that doesn't exist yet. Obsidian handles this gracefully. The question is whether it's **confusing** — Bob sees references to things he can't access.

**Optional enhancement**: A plugin that detects unresolved links and checks whether they point to a known-but-unmounted folder, showing a tooltip like "This note is in the Engineering folder (you don't have access)" instead of just showing a dead link.

---

## Recommendation

**Option F (Bind Mounts + Patched Move Operations)** is the best balance of security, simplicity, and compatibility:

1. **Orchestrator** assembles per-user Docker mounts from permission config
2. **Sync daemon** connects to per-folder Yjs rooms
3. **Move shim** (plugin or daemon-level) handles `EXDEV` for cross-mount moves
4. **Config generator** creates per-user `.obsidian/` with valid paths
5. **`_inbox/` folder** provides a writable root-level space for new files

The main tradeoff you're accepting: **container restart required for permission changes**. This is probably acceptable since group membership changes aren't frequent, and a "re-login to see updated access" workflow is normal in enterprise tools.

The architectural change with the biggest ripple effect is the **per-folder CRDT sync rooms**. That touches the sync daemon, the Yjs server topology, and the plugin's sync logic. But it's a clean abstraction — each folder is an independent sync domain — and it's actually more correct than the current per-vault model.

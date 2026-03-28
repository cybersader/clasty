# Architecture Documentation

This document provides thorough documentation of the three-layer architecture for browser-based Obsidian with CRDT sync and enterprise access control.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Layer 1: VNC/Desktop Gateway](#layer-1-vncdesktop-gateway)
3. [Layer 2: CRDT Sync Engine](#layer-2-crdt-sync-engine)
4. [Layer 3: Authentication & Mount Orchestration](#layer-3-authentication--mount-orchestration)
5. [Data Flow](#data-flow)
6. [Design Decisions & Rationale](#design-decisions--rationale)
7. [Alternatives Considered](#alternatives-considered)
8. [Security Considerations](#security-considerations)
9. [Scalability](#scalability)

---

## Executive Summary

### The Problem

Obsidian is a powerful knowledge management tool, but it has limitations for enterprise use:

1. **No native web version**: Obsidian requires a desktop application because it depends on direct filesystem access
2. **No real-time collaboration**: Multiple users editing the same file creates conflicts
3. **No enterprise access control**: No built-in RBAC, SSO, or audit logging

### The Solution

A three-layer architecture that wraps Obsidian with enterprise capabilities:

| Layer | Purpose | Key Technology |
|-------|---------|----------------|
| **Layer 1** | Browser access to Obsidian desktop | VNC gateway (Kasm/Guacamole) |
| **Layer 2** | Conflict-free real-time sync | CRDT (Yjs) |
| **Layer 3** | Authentication & access control | IdP + mount orchestration |

### Key Architectural Insight

**RBAC is enforced at vault mount time, not file level.**

This dramatically simplifies the architecture. Instead of building complex file-level permission checks (which fight Obsidian's design), we control *which vaults a user can access* when their session starts. If a user can mount a vault, they have full access to it.

---

## Layer 1: VNC/Desktop Gateway

### Purpose

Provide browser-based access to Obsidian without requiring users to install the desktop application.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                        │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │              VNC/WebSocket Client                   │    │
│   │         (HTML5 Canvas + JavaScript)                 │    │
│   └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     VNC GATEWAY SERVER                       │
│                                                              │
│   Options:                                                   │
│   - Kasm Workspaces (enterprise, SSO, session management)   │
│   - Apache Guacamole (simpler, open source)                 │
│   - Selkies/GStreamer (WebRTC, lower latency)               │
│   - noVNC + custom orchestration (DIY)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ VNC Protocol
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    OBSIDIAN CONTAINER                        │
│                                                              │
│   ┌─────────────────┐  ┌─────────────────────────────────┐  │
│   │  X11 / Xvfb     │  │         Obsidian App            │  │
│   │  (Display)      │──│  - Electron-based               │  │
│   └─────────────────┘  │  - Full plugin support          │  │
│                        │  - Native file operations       │  │
│                        └─────────────────────────────────┘  │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Sync Daemon (Layer 2)                   │   │
│   │  - Runs alongside Obsidian                          │   │
│   │  - Watches filesystem                               │   │
│   │  - Syncs via CRDT                                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   Mounted Vaults:                                            │
│   /vaults/team-a     ← Docker volume or SMB share           │
│   /vaults/private    ← User-specific vault                  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Options

| Technology | Pros | Cons | Best For |
|------------|------|------|----------|
| **Kasm Workspaces** | Enterprise SSO, session persistence, scaling | Licensing cost, complexity | Enterprise deployment |
| **Apache Guacamole** | Free, simple, well-documented | Less session management | Small teams, POC |
| **Selkies/GStreamer** | WebRTC (lower latency), GPU support | Newer, less documentation | Performance-critical |
| **noVNC + Docker** | Full control, no vendor lock-in | DIY orchestration | Custom requirements |

### Container Architecture

The Obsidian container runs:

1. **X11/Xvfb**: Virtual display server
2. **VNC Server**: Exposes the display over VNC protocol
3. **Obsidian**: The actual application
4. **Sync Daemon**: Our custom CRDT sync service (Layer 2)
5. **Supervisor**: Process manager to run all of the above

```dockerfile
# Simplified Dockerfile structure
FROM linuxserver/obsidian:latest

# Add sync daemon dependencies
RUN apt-get install -y nodejs inotify-tools supervisor

# Copy sync daemon
COPY sync-daemon/ /opt/sync-daemon/

# Supervisor manages both Obsidian and sync daemon
COPY supervisord.conf /etc/supervisor/conf.d/
```

### Session Persistence

When a user disconnects and reconnects:

1. **Kasm/Guacamole**: Can resume existing session (configurable)
2. **Container state**: Preserved via Docker volumes
3. **Vault data**: Persisted in mounted volumes (survives container restart)
4. **Sync state**: CRDT ensures no data loss even if container restarts

### Why VNC Instead of Native Web?

Obsidian cannot run natively in a browser because:

1. **Filesystem dependency**: Obsidian's core architecture relies on Node.js `fs` module for direct file access
2. **Plugin ecosystem**: 1000+ plugins expect a real filesystem
3. **Electron architecture**: Obsidian is built on Electron, not designed for browser

VNC provides a pragmatic solution: run the real Obsidian desktop app and stream the UI to the browser.

---

## Layer 2: CRDT Sync Engine

### Purpose

Enable real-time, conflict-free collaboration between multiple users editing the same vault.

### What is a CRDT?

**CRDT** = Conflict-free Replicated Data Type

A data structure that can be modified independently on multiple devices, then merged automatically without conflicts.

```
Traditional Sync (conflicts):
  User A: "Hello World" → "Hello Earth"
  User B: "Hello World" → "Hello Mars"
  Merge: CONFLICT! Which version wins?

CRDT Sync (no conflicts):
  User A: Insert "Earth" at position 6, delete "World"
  User B: Insert "Mars" at position 6, delete "World"
  Merge: "Hello EarthMars" (both operations applied)

  (With smarter CRDT: "Hello Earth and Mars")
```

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         YJS SYNC SERVER                           │
│                        (y-websocket)                              │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │                    Room: "vault-engineering"             │    │
│   │                                                          │    │
│   │   Y.Doc: "README.md"     Y.Doc: "Meeting-Notes.md"      │    │
│   │   Y.Doc: "Project-A.md"  Y.Doc: "Ideas.md"              │    │
│   │   ...                                                    │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│   Persistence: Saves state to disk for recovery                  │
└──────────────────────────────────────────────────────────────────┘
           │                              │
           │ WebSocket                    │ WebSocket
           ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│  SYNC DAEMON (A)    │        │  SYNC DAEMON (B)    │
│                     │        │                     │
│  ┌───────────────┐  │        │  ┌───────────────┐  │
│  │ File Watcher  │  │        │  │ File Watcher  │  │
│  │ (inotify)     │  │        │  │ (inotify)     │  │
│  └───────┬───────┘  │        │  └───────┬───────┘  │
│          │          │        │          │          │
│  ┌───────▼───────┐  │        │  ┌───────▼───────┐  │
│  │ Yjs Manager   │  │        │  │ Yjs Manager   │  │
│  │ (Y.Doc cache) │  │        │  │ (Y.Doc cache) │  │
│  └───────────────┘  │        │  └───────────────┘  │
│          │          │        │          │          │
│          ▼          │        │          ▼          │
│  /vaults/engineering│        │  /vaults/engineering│
│  ├── README.md      │        │  ├── README.md      │
│  ├── Meeting-Notes  │        │  ├── Meeting-Notes  │
│  └── ...            │        │  └── ...            │
└─────────────────────┘        └─────────────────────┘
         │                              │
         ▼                              ▼
   Obsidian (User A)             Obsidian (User B)
```

### Sync Flow

#### Local Edit → Remote Sync

```
1. User A edits file in Obsidian
   └─► Obsidian writes to filesystem

2. inotify detects CLOSE_WRITE event
   └─► File watcher triggers

3. Sync daemon reads file content
   └─► Compares with cached Y.Doc content

4. If different, update Y.Doc
   └─► Yjs generates update message

5. Send update to Yjs server via WebSocket
   └─► Server broadcasts to other connected clients

6. User B's sync daemon receives update
   └─► Updates local Y.Doc
   └─► Writes new content to filesystem

7. User B sees changes in Obsidian
```

#### Conflict Resolution

```
Scenario: User A and User B edit the same line simultaneously

1. User A types: "The quick brown fox"
2. User B types: "The slow red cat"
   (Both started from: "The [cursor here]")

3. CRDT merge result: "The quick brown foxslow red cat"
   (Both insertions preserved, may need manual cleanup)

Better scenario with character-level CRDT:
1. User A changes "quick" to "fast"
2. User B changes "fox" to "dog"
3. CRDT merge: "The fast brown dog"
   (Non-overlapping edits merge cleanly)
```

### Why Yjs?

| Library | Pros | Cons |
|---------|------|------|
| **Yjs** | Battle-tested, TypeScript, active community | Text-only (binaries need workaround) |
| **Automerge** | JSON-native, Rust performance | Larger bundle, different API |
| **Loro** | Newer, better binary support | Less mature |
| **OctoBase** | Built for note apps (AFFiNE) | Heavier, more opinionated |

We chose **Yjs** because:
1. Proven in production (Notion, Coda use similar)
2. Excellent TypeScript support
3. Simple y-websocket server
4. Active development and community

### Handling Binary Files

CRDTs are designed for text. Binary files (images, PDFs) create problems:

```
Problem:
- 5MB image = millions of CRDT operations
- Sync overhead becomes huge
- Memory usage explodes

Solution: Reference-based approach
- Store binary files in external object storage (MinIO/S3)
- In CRDT, store only the reference: ![image](sha256:abc123...)
- Sync the reference, not the binary
- Fetch binary from object store when needed
```

```
┌─────────────────────────────────────────────────────────────────┐
│                       BINARY HANDLING                            │
│                                                                  │
│   Obsidian Vault:                                                │
│   /vaults/team-a/                                                │
│   ├── README.md          ← Synced via CRDT                      │
│   ├── _attachments/                                              │
│   │   ├── image-abc.png  ← Stored in MinIO, hash in CRDT        │
│   │   └── doc-xyz.pdf    ← Stored in MinIO, hash in CRDT        │
│                                                                  │
│   MinIO/S3:                                                      │
│   bucket: vault-attachments                                      │
│   ├── sha256:abc123... → image-abc.png (actual bytes)           │
│   └── sha256:xyz789... → doc-xyz.pdf (actual bytes)             │
└─────────────────────────────────────────────────────────────────┘
```

### Why Daemon Instead of Plugin?

We run the sync logic as a **separate daemon** rather than an Obsidian plugin because:

| Approach | Pros | Cons |
|----------|------|------|
| **Obsidian Plugin** | Direct access to Obsidian API, knows when files change | Timing issues with file cache, plugin can crash Obsidian |
| **External Daemon** | Isolated, can't crash Obsidian, filesystem is source of truth | Slight delay detecting changes, no Obsidian API access |

The **Relay plugin** developers discovered that Obsidian's internal file caching creates timing issues where the plugin sees stale data. An external daemon using inotify avoids this by reading directly from the filesystem after Obsidian has finished writing.

We use a **hybrid approach**:
1. **Daemon** (primary): Watches filesystem via inotify, handles sync
2. **Plugin** (optional enhancement): Can emit events to daemon for faster notification

---

## Layer 3: Authentication & Mount Orchestration

### Purpose

Control who can access which vaults, integrate with enterprise identity providers, and maintain audit logs.

### Key Design Decision: Vault-Level RBAC

```
❌ File-level RBAC (rejected):
   - Check permissions on every file read/write
   - Complex to implement (Obsidian doesn't support this)
   - Performance overhead
   - Plugin would need to hide files in UI

✅ Vault-level RBAC (chosen):
   - Control which vaults are mounted at session start
   - Simple: if you can access a vault, you have full access
   - No runtime permission checks needed
   - Works with Obsidian's architecture
```

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER LOGIN FLOW                           │
│                                                                   │
│  1. User navigates to Obsidian portal                            │
│     └─► Redirected to Authentik for SSO                          │
│                                                                   │
│  2. User authenticates (LDAP, SAML, OIDC, etc.)                  │
│     └─► Authentik returns JWT with user info + groups            │
│                                                                   │
│  3. Mount Orchestrator receives JWT                              │
│     └─► Extracts user groups: ["engineering", "platform"]        │
│     └─► Looks up vault permissions config                        │
│     └─► Determines: user can access [eng-vault, company-wiki]    │
│                                                                   │
│  4. Session container starts                                      │
│     └─► Only permitted vaults are mounted                        │
│     └─► Audit log: "user@corp.com accessed eng-vault"            │
│                                                                   │
│  5. User sees only their permitted vaults in Obsidian            │
└──────────────────────────────────────────────────────────────────┘
```

### Vault Permissions Configuration

```yaml
# config/vault-permissions.yaml

vaults:
  # Engineering team vault
  - name: engineering
    storage:
      type: docker_volume  # or "smb"
      path: /vaults/engineering
      # smb_path: //fileserver.corp.com/engineering
    allowed_groups:
      - engineering
      - devops
      - platform
    sync_room: "vault-engineering"  # Yjs room name

  # Finance vault (restricted)
  - name: finance
    storage:
      type: smb
      smb_path: //fileserver.corp.com/finance
      credentials_secret: finance-smb-creds
    allowed_groups:
      - finance
      - executives

  # Company-wide knowledge base
  - name: wiki
    storage:
      type: docker_volume
      path: /vaults/wiki
    allowed_groups:
      - all-employees  # Everyone gets access

# Group mappings (from Identity Provider)
groups:
  engineering:
    source: ldap
    ldap_dn: CN=Engineering,OU=Groups,DC=corp,DC=example,DC=com

  all-employees:
    source: ldap
    ldap_dn: CN=Domain Users,CN=Users,DC=corp,DC=example,DC=com
```

### Identity Provider Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTHENTIK (IdP)                             │
│                                                                  │
│   Supports:                                                      │
│   ├── LDAP/Active Directory sync                                │
│   ├── SAML 2.0 (for legacy apps)                                │
│   ├── OIDC/OAuth2 (for modern apps)                             │
│   └── Social login (Google, GitHub, etc.)                       │
│                                                                  │
│   User Flow:                                                     │
│   1. User enters username/password                               │
│   2. Authentik validates against AD/LDAP                        │
│   3. Authentik issues JWT with:                                  │
│      {                                                           │
│        "sub": "user@corp.com",                                   │
│        "groups": ["engineering", "platform"],                    │
│        "name": "John Developer",                                 │
│        "email": "john@corp.com"                                  │
│      }                                                           │
│   4. JWT sent to VNC gateway and mount orchestrator             │
└─────────────────────────────────────────────────────────────────┘
```

### Audit Logging

Every action is logged for compliance:

```json
{"timestamp":"2024-12-19T10:30:00Z","userId":"user@corp.com","action":"vault_access","vault":"engineering","details":{"source":"session_start"}}
{"timestamp":"2024-12-19T10:30:15Z","userId":"user@corp.com","action":"create","vault":"engineering","path":"Meeting-Notes/2024-12-19.md"}
{"timestamp":"2024-12-19T10:31:42Z","userId":"user@corp.com","action":"modify","vault":"engineering","path":"README.md"}
{"timestamp":"2024-12-19T10:32:00Z","userId":"user@corp.com","action":"remote_sync","vault":"engineering","path":"Project-Status.md","details":{"source":"crdt_server"}}
```

Log destinations:
- **Stdout**: Docker logs, ship to aggregator
- **File**: Rotate with logrotate
- **SIEM**: Stream to Splunk, ELK, Datadog

---

## Data Flow

### Complete Request Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                 │
│                                                                                 │
│   USER                                                                          │
│     │                                                                           │
│     │ 1. Navigate to https://obsidian.corp.com                                 │
│     ▼                                                                           │
│   ┌─────────────┐                                                               │
│   │  Authentik  │ 2. SSO login (OIDC)                                          │
│   └──────┬──────┘                                                               │
│          │ 3. JWT with groups                                                   │
│          ▼                                                                      │
│   ┌─────────────────┐                                                           │
│   │ Mount           │ 4. Check vault permissions                               │
│   │ Orchestrator    │ 5. Mount permitted vaults                                │
│   └────────┬────────┘                                                           │
│            │ 6. Start container with mounts                                     │
│            ▼                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐              │
│   │                    OBSIDIAN CONTAINER                        │              │
│   │                                                              │              │
│   │   ┌──────────┐     ┌─────────────┐     ┌───────────────┐   │              │
│   │   │ Obsidian │◄───►│ Filesystem  │◄───►│ Sync Daemon   │   │              │
│   │   │   App    │     │ /vaults/*   │     │ (inotify+Yjs) │   │              │
│   │   └──────────┘     └─────────────┘     └───────┬───────┘   │              │
│   │                                                 │            │              │
│   └─────────────────────────────────────────────────┼────────────┘              │
│                                                     │                           │
│            7. User edits file                       │ 8. Sync via WebSocket    │
│                                                     ▼                           │
│                                          ┌─────────────────┐                    │
│                                          │   Yjs Server    │                    │
│                                          │   (CRDT hub)    │                    │
│                                          └────────┬────────┘                    │
│                                                   │ 9. Broadcast to others      │
│                                                   ▼                             │
│                                          Other user's containers                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions & Rationale

### Decision 1: VNC vs Native Web

**Choice**: VNC gateway
**Rationale**: Obsidian's plugin ecosystem (1000+ plugins) is a major value proposition. A native web port would break most plugins. VNC lets us run the real Obsidian with all plugins intact.

### Decision 2: External Sync Daemon vs Obsidian Plugin

**Choice**: External daemon (primary) + optional plugin
**Rationale**: Discovered that Obsidian's internal file caching causes timing issues. External daemon using inotify reads directly from filesystem, avoiding stale data issues.

### Decision 3: Vault-Level vs File-Level RBAC

**Choice**: Vault-level RBAC
**Rationale**: File-level RBAC fights Obsidian's architecture. It would require hiding files in the UI, intercepting all file operations, and complex permission checking. Vault-level RBAC is enforced by the filesystem mount itself - if you can't mount a vault, you can't access any files in it.

### Decision 4: Yjs vs Other CRDTs

**Choice**: Yjs
**Rationale**: Best TypeScript support, simple server (y-websocket), active community. Automerge is powerful but heavier. Loro is promising but newer.

### Decision 5: Docker Volumes + SMB (not just one)

**Choice**: Support both
**Rationale**: Docker volumes are simple for POC/small teams. SMB shares integrate with existing enterprise infrastructure (AD permissions, backup systems).

---

## Alternatives Considered

### Alternative 1: AFFiNE Instead of Obsidian

AFFiNE is a CRDT-native note app with built-in collaboration.

| Aspect | Obsidian + Our Architecture | AFFiNE |
|--------|----------------------------|--------|
| Plugin ecosystem | 1000+ plugins | Limited |
| Local-first | Yes (with sync) | Yes (native) |
| Real-time collab | Via our Layer 2 | Built-in |
| Markdown compatibility | Native | Mostly compatible |
| Enterprise features | Via our Layer 3 | Limited |

**Verdict**: Obsidian has a stronger ecosystem. AFFiNE is worth watching for future.

### Alternative 2: Obsidian LiveSync Instead of Custom CRDT

LiveSync is an existing Obsidian plugin for sync.

| Aspect | Our CRDT Daemon | LiveSync |
|--------|-----------------|----------|
| Architecture | External daemon | Obsidian plugin |
| Sync method | Yjs CRDT | CouchDB replication |
| Scalability | Designed for multi-user | Struggles at 300+ files |
| Timing issues | Avoided (inotify) | Has timing issues |
| Enterprise features | Built for it | Not designed for enterprise |

**Verdict**: LiveSync is for personal use. We need enterprise-grade from the start.

### Alternative 3: File-Level Permissions via Plugin

We considered a plugin that hides files based on user permissions.

**Problems**:
1. User can disable plugin and see all files
2. Plugin can't truly hide files from filesystem
3. Sync would still include hidden files
4. Complex to implement reliably

**Verdict**: Vault-level RBAC via mount control is simpler and more secure.

---

## Security Considerations

### Authentication Security

- All auth via OIDC/SAML (no password handling in our code)
- JWT tokens with expiration
- Session tokens scoped to specific vaults

### Network Security

- All traffic over HTTPS/WSS
- VNC stream encrypted
- Sync WebSocket encrypted

### Data Security

- Vaults stored in Docker volumes or SMB shares (existing security)
- CRDT server stores only document state (not full files)
- Binary attachments in MinIO with bucket policies

### Access Control Security

- Mount orchestration enforces vault access
- User cannot access vault not in their mount list
- Audit logs capture all access

### Container Security

- Non-root user in container
- Read-only filesystem where possible
- Network isolation between user containers

---

## Scalability

### Horizontal Scaling

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
   │ VNC Gateway │    │ VNC Gateway │    │ VNC Gateway │
   │   Node 1    │    │   Node 2    │    │   Node 3    │
   └─────────────┘    └─────────────┘    └─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Yjs Server    │  (can also be clustered)
                    │   Cluster       │
                    └─────────────────┘
```

### Bottlenecks & Solutions

| Bottleneck | Solution |
|------------|----------|
| VNC gateway | Add more nodes, sticky sessions |
| Yjs server | Redis adapter for multi-node |
| MinIO | Clustered MinIO or switch to S3 |
| Vault storage | SMB shares on scalable NAS |

### Limits

- **Users per vault**: Tested up to 10 concurrent editors (POC target)
- **Vault size**: 1000+ files should work (Yjs is efficient)
- **Latency**: VNC adds ~50-200ms depending on network

---

## Summary

This architecture provides:

1. **Browser access** to full Obsidian desktop experience via VNC
2. **Real-time collaboration** via Yjs CRDT sync
3. **Enterprise access control** via vault-level RBAC at mount time
4. **Audit logging** for compliance

The key insight is that RBAC at the vault (mount) level is much simpler than file-level permissions and works with, not against, Obsidian's architecture.

---

## Alternative: Plugin-Only CRDT Sync

In addition to the full VNC + daemon architecture, there is a **simpler plugin-only approach** that works for scenarios where infrastructure is not available or desired.

### When to Use Plugin-Only

| Scenario | Plugin-Only | Full Architecture |
|----------|-------------|-------------------|
| SMB share conflicts | Best choice | Overkill |
| Dropbox/OneDrive sync issues | Best choice | Overkill |
| Web/browser access | Not applicable | Required |
| Real-time collaboration | Sync-interval based | Sub-second |
| Enterprise deployment | User-installed | IT-controlled |

### How Plugin-Only Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSIDIAN CLIENT A                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   CRDT Sync Plugin                         │  │
│  │                                                            │  │
│  │  On File Open:                                             │  │
│  │  1. Find all .crdt state files for this note              │  │
│  │  2. Merge all states into local Y.Doc                     │  │
│  │  3. Update file if merged content differs                 │  │
│  │                                                            │  │
│  │  On File Save:                                             │  │
│  │  1. Apply diff to local Y.Doc                             │  │
│  │  2. Save our state to .crdt/{path}.{clientId}.yjs         │  │
│  │  3. Background: check for new remote states               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Files:                                                         │
│  /vault/notes/project.md                 ← Readable content    │
│  /vault/.crdt/notes/project.md.abc.yjs   ← Our CRDT state     │
│  /vault/.crdt/notes/project.md.xyz.yjs   ← Synced from Bob    │
└─────────────────────────────────────────────────────────────────┘
                              │
              SMB / Dropbox / Syncthing / OneDrive
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    OBSIDIAN CLIENT B                            │
│                                                                 │
│  Same structure - sees all .crdt files after file sync         │
│  Merges on file open, saves own state on file save             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Differences

| Aspect | Plugin-Only | Full Architecture |
|--------|-------------|-------------------|
| Sync Transport | File system (SMB, cloud sync) | WebSocket |
| Sync Latency | Depends on file sync (minutes) | Real-time (seconds) |
| Server Required | No | Yes (y-websocket) |
| User Identification | Client ID per plugin install | Same |
| CRDT Storage | Hidden .crdt folder | Daemon manages |
| Works Offline | Fully | Partially |

### Implementation

The plugin-only approach is implemented in `/obsidian-plugin/`. See `/docs/plugin-only-sync.md` for detailed design.

### Hybrid Mode

The plugin can operate in **hybrid mode**:
- Primary: File-based CRDT sync (always works)
- Optional: Connect to y-websocket server for real-time sync
- Fallback: If server unavailable, continue with file-based sync

This provides the best of both worlds: enterprise teams can deploy the full VNC + server stack for real-time web collaboration, while smaller teams or individuals can use just the plugin for SMB/cloud sync conflict resolution.

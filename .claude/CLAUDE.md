# Obsidian-in-Browser

## Project Overview

Browser-based Obsidian with CRDT sync and enterprise access control. Three-layer architecture:

1. **VNC Gateway** (Kasm/Guacamole/Selkies) — stream Obsidian desktop to browser
2. **CRDT Sync** (Yjs) — conflict-free real-time collaboration
3. **Mount Orchestration** — vault-level RBAC via composite bind mounts per user

**Status:** POC Phase (sync daemon + plugin + Docker container implemented; orchestrator + auth pending)

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `knowledge-base/` | Project knowledge base (temperature gradient system) |
| `docker/obsidian-kasm/` | Custom Docker image (linuxserver/obsidian + sync daemon) |
| `sync-daemon/` | Node.js Yjs CRDT sync service (inotify + WebSocket) |
| `obsidian-plugin/` | Obsidian CRDT sync plugin (file + server modes) |
| `orchestrator/` | Mount orchestration service (pending) |
| `config/` | Vault permission configuration (YAML) |
| `policies/` | Authorization policies (pending) |
| `tests/` | Integration tests (pending) |
| `vaults/demo/` | Demo vault for testing |

## Build & Run

```bash
# Start all services (Obsidian VNC + Yjs server + MinIO)
docker-compose up -d

# Access Obsidian at https://localhost:3001

# Build sync daemon
cd sync-daemon && bun install && bun run build

# Build Obsidian plugin
cd obsidian-plugin && bun install && bun run build
```

## Knowledge Base

The `knowledge-base/` uses a temperature gradient system:

| Zone | Path | What Goes Here |
|------|------|---------------|
| HOT | `00-inbox/` | Quick captures, unprocessed |
| WARM | `01-working/` | Active drafts, in-progress work |
| COOL | `02-learnings/` | Distilled insights (SCREAMING_SNAKE_CASE) |
| COLD | `03-reference/` | Stable docs, architecture, decisions |
| FROZEN | `04-archive/` | Completed, rarely consulted |

**Start here for architecture:** `knowledge-base/03-reference/ARCHITECTURE_COMPONENTS.md`

## Key Design Decisions

- **RBAC at folder-mount level** — composite bind mounts per user, not file-level permissions
- **Yjs for CRDT** — battle-tested, TypeScript, y-websocket transport
- **External sync daemon** — avoids Obsidian file cache timing issues
- **Hybrid plugin modes** — file-only, hybrid, server-only
- **Per-folder CRDT rooms** — required for composite vault approach

See `knowledge-base/03-reference/decision-log.md` for full rationale.

## Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `session-log` | Create dated documents capturing learnings and decisions | End of research/decision sessions, or `/session-log` |

## Git Rules

- NEVER include AI attribution in commits (no Co-Authored-By)
- Commit as the human developer only

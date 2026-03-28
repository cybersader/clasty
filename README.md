# Obsidian-in-Browser

CRDT-based sync for Obsidian that solves two problems:
1. **Browser access**: Run Obsidian in the browser via VNC with enterprise SSO
2. **Conflict resolution**: Automatic conflict-free sync for SMB shares, Dropbox, etc.

## Two Approaches

### 1. Full Architecture (Enterprise/Web)

```
Browser → VNC Gateway → Obsidian Container
                              ↕
                        CRDT Sync Daemon
                              ↕
                        Yjs Server
                              ↕
                        Other Users
```

Best for: Web-based access, real-time collaboration, enterprise deployment.

### 2. Plugin-Only (SMB/Cloud Sync)

```
Obsidian Desktop     ←→     .crdt/ folder     ←→     Obsidian Desktop
    (Alice)            SMB/Dropbox/Syncthing           (Bob)
```

Best for: SMB share conflicts, Dropbox/OneDrive sync, no infrastructure needed.

## Key Design Decisions

- **Vault-level RBAC**: Access control at mount time, not file level
- **CRDT sync**: Yjs for conflict-free collaboration
- **Dual mode**: Plugin works standalone OR with server for real-time
- **Storage flexibility**: Docker volumes for POC, SMB shares for enterprise

## Quick Start

```bash
# Clone and start
docker-compose up -d

# Access Obsidian at http://localhost:6080
```

## Components

| Component | Purpose | Approach |
|-----------|---------|----------|
| `docker/obsidian-kasm/` | Obsidian + sync daemon container | Full Architecture |
| `sync-daemon/` | Yjs-based CRDT sync service | Full Architecture |
| `obsidian-plugin/` | CRDT sync plugin with file-based and server modes | Both |
| `orchestrator/` | Mount orchestration based on user permissions | Full Architecture |
| `config/` | Vault permission configuration | Full Architecture |

## Development

```bash
# Build sync daemon
cd sync-daemon && bun install && bun run build

# Build Obsidian plugin
cd obsidian-plugin && bun install && bun run build

# Build and run containers
docker-compose up --build
```

## Documentation

Documentation lives in `knowledge-base/` organized by temperature gradient (hot → cold):

- [Architecture Components Analysis](knowledge-base/03-reference/ARCHITECTURE_COMPONENTS.md) - Component catalog, comparison tables, reference architectures
- [Architecture](knowledge-base/03-reference/architecture.md) - Full system design
- [Plugin-Only Sync](knowledge-base/03-reference/plugin-only-sync.md) - Simpler file-based approach
- [Decision Log](knowledge-base/03-reference/decision-log.md) - All architectural decisions with rationale
- [Knowledge Base README](knowledge-base/README.md) - How the KB is organized

## License

MIT

# Obsidian in Enterprise

> Browser-based Obsidian with CRDT sync and enterprise access control. Stream Obsidian via VNC, collaborate in real-time with Yjs, and control vault access at the folder level.

**[Documentation](https://cybersader.github.io/obsidian-in-enterprise)** · [Architecture](knowledge-base/03-reference/ARCHITECTURE_COMPONENTS.md) · [Decision Log](knowledge-base/03-reference/decision-log.md) · [Contributing](docs-site/src/content/docs/contributing/how-to-contribute.md)

## The Problem

Organizations want Obsidian for knowledge management but face blockers: no browser access, no real-time collaboration, no role-based access control, and data sovereignty concerns with local installs.

## Three-Layer Architecture

```
Browser → VNC Gateway (Kasm) → Obsidian Container
                                      ↕
                                CRDT Sync Daemon (Yjs)
                                      ↕
                                Other Users' Containers

Mount Orchestrator: JWT claims → per-user bind mounts → composite vault
```

**Layer 1 — VNC Gateway**: Kasm Workspaces streams Obsidian desktop to the browser. Full experience, zero installs.

**Layer 2 — CRDT Sync**: Yjs-based real-time collaboration. Multiple users edit simultaneously with automatic conflict resolution.

**Layer 3 — Mount Orchestration**: Translates user identity + group membership into per-user Docker bind mounts. Each user's vault is assembled from only the folders they're authorized to access.

## Quick Start

```bash
git clone https://github.com/cybersader/obsidian-in-enterprise.git
cd obsidian-in-enterprise
cp .env.example .env
docker-compose up -d
# Obsidian at https://localhost:3001
```

### Multi-Instance Testing

```bash
docker-compose -f docker-compose.test.yml up -d
# Alice: https://localhost:3101
# Bob:   https://localhost:3201
```

## Components

| Component | Purpose |
|-----------|---------|
| `docker/obsidian-kasm/` | Custom Obsidian container with sync daemon |
| `sync-daemon/` | Node.js Yjs CRDT sync service (inotify + WebSocket) |
| `obsidian-plugin/` | Obsidian plugin with file-based and server sync modes |
| `orchestrator/` | Mount orchestration service (pending) |
| `config/` | Vault permission configuration (YAML) |
| `knowledge-base/` | Project knowledge base (temperature gradient system) |
| `docs-site/` | Astro Starlight documentation site |

## Documentation

The [documentation site](https://cybersader.github.io/obsidian-in-enterprise) is built from the knowledge base using Astro Starlight with the `starlight-obsidian` plugin. All content lives in this repo — no Obsidian installation needed to contribute.

The knowledge base uses a **temperature gradient** system:

| Zone | Path | Content |
|------|------|---------|
| HOT | `00-inbox/` | Quick captures |
| WARM | `01-working/` | Active research and decisions |
| COOL | `02-learnings/` | Distilled insights (SCREAMING_SNAKE_CASE) |
| COLD | `03-reference/` | Stable architecture docs |
| FROZEN | `04-archive/` | Completed research |

Key docs:
- [Architecture Components](knowledge-base/03-reference/ARCHITECTURE_COMPONENTS.md) — Component catalog with comparison tables and mermaid diagrams
- [Decision Log](knowledge-base/03-reference/decision-log.md) — All architectural decisions with rationale
- [Knowledge Base Guide](knowledge-base/README.md) — How the KB is organized

## Contributing

1. Click **"Edit page"** on any documentation page, or edit markdown files directly on GitHub
2. Submit a pull request
3. The docs site rebuilds automatically on merge

See the [contributing guide](docs-site/src/content/docs/contributing/how-to-contribute.md) for details.

## Development

```bash
# Sync daemon
cd sync-daemon && bun install && bun run build

# Obsidian plugin
cd obsidian-plugin && bun install && bun run build

# Documentation site
cd docs-site && bun install && bun run dev
```

## Status

**POC Phase** — Sync daemon, Obsidian plugin, and Docker container are implemented. Mount orchestrator and auth integration are pending.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

This means you can use, modify, and distribute this software freely, but if you run a modified version as a network service, you must make your source code available to users of that service.

**Commercial licensing** is available for organizations that need different terms. Contact the maintainer for details.

**Contributing** requires signing our [Contributor License Agreement](CLA.md), which allows the project to be offered under dual licensing.

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by [Obsidian](https://obsidian.md/) or Dynalist Inc. "Obsidian" is a trademark of Dynalist Inc. This is an independent, community-driven project that builds infrastructure around the Obsidian application.

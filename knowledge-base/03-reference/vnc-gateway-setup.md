# VNC Gateway Setup

Status: **In Progress** (POC working, production selection pending)

---

## Overview

Layer 1 of the architecture - browser-based access to Obsidian desktop via VNC streaming.

---

## Current State

### POC (Working)

Using linuxserver/obsidian Docker image with built-in KasmVNC.

```yaml
# docker-compose.yml
obsidian:
  image: lscr.io/linuxserver/obsidian:latest
  ports:
    - "6080:3000"  # Web UI
  volumes:
    - ./vaults/demo:/vaults/demo
```

Access at: http://localhost:6080

### Production (Pending)

Need to select between:
- Kasm Workspaces (enterprise)
- Apache Guacamole (open source)
- Selkies (WebRTC)

See [VNC Options Research](../resources/research/vnc-options.md)

---

## Location

`docker/obsidian-kasm/`

---

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Custom Obsidian image |
| `entrypoint.sh` | Container startup script |
| `supervisord.conf` | Process management |

---

## Architecture

```
Browser
   ↓ HTTPS/WSS
VNC Gateway (Kasm/Guacamole)
   ↓ VNC Protocol
Obsidian Container
   ├── X11/Xvfb (display)
   ├── VNC Server
   ├── Obsidian App
   └── Sync Daemon
```

---

## Tasks

### Completed

- [x] Basic Docker image
- [x] docker-compose for local testing
- [x] Sync daemon integration
- [x] Vault mounting

### In Progress

- [ ] VNC gateway selection
- [ ] SSO integration
- [ ] Session persistence

### Pending

- [ ] Production deployment
- [ ] Scaling configuration
- [ ] Load balancing

---

## Considerations

### Session Persistence

How to handle:
- User reconnects to same session
- Session timeout
- Multiple tabs

### Storage

Options:
- Docker volumes (simple)
- SMB/CIFS shares (enterprise)
- Both (Docker for state, SMB for content)

### Networking

- WebSocket for VNC
- WebSocket for CRDT sync
- Object storage access (MinIO)

---

## Related

- [Architecture](../areas/architecture.md)
- [VNC Options](../resources/research/vnc-options.md)
- [Security](../areas/security.md)

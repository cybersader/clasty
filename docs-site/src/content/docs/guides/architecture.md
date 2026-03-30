---
title: Architecture Overview
description: High-level architecture of the three-layer system.
---

## System Diagram

```mermaid
graph TD
    User["Browser"] -->|HTTPS| VNC["VNC Gateway<br/>(Kasm Workspaces)"]
    VNC -->|launches| Container["Obsidian Container<br/>(linuxserver/obsidian)"]
    Container -->|reads/writes| Vault["/vault/<br/>(composite bind mounts)"]
    Container -->|contains| Daemon["Sync Daemon"]
    Daemon -->|WebSocket| YJS["Yjs Server"]

    Auth["Auth / IdP<br/>(Authentik)"] -->|JWT claims| Orchestrator["Mount Orchestrator"]
    Orchestrator -->|bind mount config| VNC
    Orchestrator -->|.obsidian/ config| Container
    Orchestrator -->|room config| Daemon

    Storage["Shared Storage<br/>(SMB/NFS/Docker volumes)"] -->|provides folders| Vault
```

## Layers

### Layer 1: VNC Gateway

Kasm Workspaces manages containerized Obsidian sessions. Each user gets their own container with a VNC stream to the browser. Kasm handles SSO, session lifecycle, and DLP controls.

### Layer 2: CRDT Sync

A Yjs-based sync system enables real-time collaboration. The sync daemon watches the filesystem for changes and propagates them via WebSocket to a central Yjs server. Each shared folder maps to a separate CRDT room, enabling per-folder sync granularity.

### Layer 3: Mount Orchestration

The mount orchestrator translates user identity (JWT claims + group membership) into Docker bind mounts. Each user's vault is a composite of only the folders they're authorized to access. This provides RBAC without file-level permission complexity.

## Deep Dive

For the full component catalog with comparison tables, tradeoffs, and alternative architectures, see the [Architecture Components](/knowledge-base/03-reference/architecture_components/) page in the Knowledge Base.

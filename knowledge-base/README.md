---
date created: 2026-02-14
date modified: 2026-02-14
temperature: reference
tags:
  - meta
  - knowledge-base
---

# Obsidian-in-Browser Knowledge Base

This knowledge base follows the **temperature gradient** system for organizing project knowledge.

## Temperature Zones

```
HOT                                                                        COLD
---------------------------------------------------------------------------
  00-inbox/   01-working/   02-learnings/   03-reference/   04-archive/
      |            |              |               |              |
    today      this week     permanent        stable            done
```

| Zone | Folder | Temperature | Content | Lifespan |
|------|--------|-------------|---------|----------|
| Capture | `00-inbox/` | HOT | Quick captures, unprocessed notes | Hours-days |
| Active | `01-working/` | WARM | Drafts, active synthesis, roadmaps | Days-weeks |
| Insights | `02-learnings/` | COOL | Distilled insights, explorations | Permanent |
| Stable | `03-reference/` | COLD | Architecture docs, decision logs, guides | Permanent |
| Filed | `04-archive/` | FROZEN | Completed research, link collections | Long-term |

## How Content Flows

- Content matures from hot to cold, never the reverse
- Direct paths are fine: a clear insight can skip inbox and go straight to `02-learnings/`
- Files in `02-learnings/` use SCREAMING_SNAKE_CASE for searchability
- Files in `03-reference/` are kebab-case (stable, frequently linked)

## Current Contents

### 01-working/ (Active)
- `mount-orchestration.md` — Mount orchestrator service design (not started)
- `ideas.md` — Active ideas and future possibilities
- `2026-02-14-kasm-mount-orchestration-decisions.md` — Kasm integration patterns, compound rules analysis, Storage Mappings vs custom orchestrator
- `2026-03-28-multi-instance-sync-testing.md` — Multi-instance testing methods (Docker, Tailscale, shared filesystem)
- `docs-site-theme-status.md` — Starlight theme status, blocker details, and custom CSS fallback plan

### 02-learnings/ (Distilled)
- `MOUNTING_PERMISSION_BOUNDARY_PROBLEM.md` — Core tension: vault-level RBAC vs composite mounts
- `UNION_FILESYSTEMS_EXPLORATION.md` — Options A-F for filesystem composition
- `VNC_KASM_RBAC_EXPLORATION.md` — Full enterprise architecture with Kasm
- `VNC_TROUBLESHOOTING_FINDINGS.md` — Selkies config, HTTPS, hardening discoveries

### 03-reference/ (Stable)
- `ARCHITECTURE_COMPONENTS.md` — Component catalog with comparison tables and mermaid diagrams
- `architecture.md` — Three-layer architecture design
- `security.md` — Threat model and compliance
- `decision-log.md` — All architectural decisions with rationale
- `crdt-options.md` — CRDT library evaluation (Yjs chosen)
- `vnc-options.md` — VNC gateway comparison
- `crdt-sync-plugin.md` — Plugin implementation design
- `plugin-only-sync.md` — File-based CRDT sync design
- `vnc-gateway-setup.md` — VNC/container setup guide
- `testing.md` — Test approach

### 04-archive/ (Filed)
- `forum-threads.md` — Obsidian forum and GitHub project links

## See Also

- [[KNOWLEDGE_BASE_PHILOSOPHY]] in `.claude/` for the full philosophy
- [[ARCHITECTURE_COMPONENTS]] for the component analysis (start here for architecture decisions)

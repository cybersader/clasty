---
date created: 2026-02-14
date modified: 2026-02-14
temperature: working
tags:
  - session-log
  - decisions
  - kasm
  - mount-orchestration
  - rbac
related:
  - "[[ARCHITECTURE_COMPONENTS]]"
  - "[[mount-orchestration]]"
  - "[[VNC_KASM_RBAC_EXPLORATION]]"
  - "[[UNION_FILESYSTEMS_EXPLORATION]]"
---

# 2026-02-14 — Kasm + Mount Orchestration Decisions

## Context

Investigating how components 3.4 (Filesystem Composition) and 3.5 (Mount Orchestrator) from [[ARCHITECTURE_COMPONENTS]] concretely integrate with Kasm Workspaces. This is the hardest part of the architecture to visualize working in practice.

## Key Discovery: Kasm Has Native Mount Primitives

Kasm Workspaces provides three mechanisms that cover most of what a Mount Orchestrator would do:

### 1. Storage Mappings

- First-class feature for attaching Docker volumes to session containers
- Can be placed on **User**, **Group**, or **Workspace** objects
- Kasm **merges all mappings** from user + groups + workspace at session launch
- Variable substitution: `{username}`, `{user_id}`, `{image_id}`
- Read-only enforcement available at group level
- Volumes created at session start, destroyed at termination

### 2. Docker Run Config Override

- JSON blob on Workspace definition, passed to Docker `Container.run()` API
- Mirrors Docker SDK for Python kwargs — can inject arbitrary bind mounts
- Supports `{username}` and `{user_id}` substitution
- **Limitation:** per-Workspace only, not per-User or per-Group
- Useful for static mounts all users of a workspace share (e.g., wiki)

### 3. Docker Exec Config

- Runs commands inside container at lifecycle points: `first_launch`, `go`, `assign`
- Cannot add bind mounts (those are Docker-level, set at creation)
- CAN: generate `.obsidian/` config, write sync daemon config, symlink/reorganize

## Kasm Integration Patterns

### Pattern A: Kasm-Native (No Custom Orchestrator)

```
Admin Setup (one-time):
  1. Create Storage Provider → "Host Path" type
  2. Per group: create Storage Mappings
     - Group "engineering" → /shared/engineering → /vault/engineering (rw)
     - Group "all-employees" → /shared/wiki → /vault/wiki (ro)
  3. Per user template: /users/{username}/personal → /vault/personal
  4. Docker Exec Config: startup script auto-discovers mounts, configures Obsidian + sync

Runtime:
  User SSO → Kasm resolves groups → merges Storage Mappings → container launches → first_launch configures
```

Pros: No custom service. RBAC in Kasm admin UI. Group membership = vault permissions.
Cons: Manual admin work per new folder. No compound rules. Startup script must introspect mounts.

### Pattern B: Custom Mount Orchestrator + Kasm API

```
Runtime:
  User SSO → Kasm creates session → webhook/API to Orchestrator
  → Orchestrator reads JWT + vault-permissions.yaml
  → Generates Docker run config with exact bind mounts
  → Calls Kasm API to set session-specific config
  → Container launches → Exec Config finalizes config
```

Pros: Full programmatic control. Single source of truth (vault-permissions.yaml). Complex rules.
Cons: Custom service to build. Kasm API may not support per-session config injection.

### Pattern C: Hybrid (Recommended Phasing)

- **POC:** Docker Run Config Override for static mounts + `{username}` for personal
- **Team Pilot:** Group-based Storage Mappings for department folders
- **Enterprise:** Add Orchestrator if group-based hits limits

## Decision: Pursue Both Approaches

**DECISION-PENDING-003: Mount Integration Strategy**

Build the custom orchestrator but ALSO test Kasm-native Storage Mappings to understand their limits empirically. Rationale:

1. We'll need the orchestrator eventually for compound rules (see below)
2. Testing Kasm-native first gives us a fallback and baseline
3. The orchestrator's permission logic is useful even if Kasm handles the mount injection
4. Understanding Kasm's native limits lets us scope the orchestrator correctly

## Compound Rules: Why Kasm Groups Aren't Enough

Kasm's native model: **user is in group → gets these mounts** (purely additive/union).

Enterprise access patterns require **intersection** (compound rules), not just union. Real examples:

### Where Compound Rules Exist in Enterprise AD/NTFS

| Scenario | Rule | Why Union Fails |
|----------|------|-----------------|
| M&A deal rooms | legal AND executive | Either group alone shouldn't have access |
| Departmental HR | HR AND specific-department | HR sees eng HR files, not marketing HR files |
| Compliance/audit | auditors AND regional-scope | Auditor can audit EMEA, not APAC |
| Project escalation | project-team AND finance | Budget/contracts need both memberships |
| Cross-functional | project-group AND department | Only dept members assigned to that project |
| Client vaults | external-consultant AND engagement-scope | Scoped to their engagement only |

### How AD/NTFS Handle This Natively

- **NTFS ACLs** support compound expressions — an ACE can require membership in multiple groups
- **AD nested groups** express hierarchy — `project-alpha-admins` contains `engineering-leads`
- **AD dynamic groups** (Azure AD) use attribute-based rules — `department == "legal" AND title contains "VP"`
- **Conditional Access Policies** (Azure AD) layer additional conditions (location, device, time)

### What We Lose With Docker Bind Mounts

Docker bind mounts are binary: mounted or not. No ACL granularity. The orchestrator must evaluate compound rules BEFORE mount time and translate the result to a flat list of mounts. This is the core job of component 3.5.

### When Kasm-Native Breaks Down (Tipping Points)

1. **> 5 shared folders with mixed read/write permissions** — need separate groups per access level per folder
2. **Same folder, different access levels** — wiki-editors (rw) vs wiki-readers (ro) requires two groups that must not overlap
3. **Non-admin users need to manage access** — Kasm requires admin UI changes
4. **AD groups don't map 1:1 to vault folders** — almost every real org; need translation layer
5. **Temporal access** — contractor access windows, project lifecycles
6. **Derived permissions** — access to project-alpha implies access to project-alpha-resources

### Proposed vault-permissions.yaml Extension for Compound Rules

```yaml
folders:
  - name: engineering
    path: /shared/engineering
    access:
      - groups: [engineering]
        mode: rw
      - groups: [all-employees]
        mode: ro

  - name: deal-room-acme
    path: /shared/deals/acme
    access:
      - groups: [legal, executive]  # AND — must be in BOTH
        mode: rw
        compound: all              # "all" = AND, "any" = OR (default)

  - name: hr-engineering
    path: /shared/hr/engineering
    access:
      - groups: [hr, engineering]
        compound: all
        mode: rw
      - groups: [hr]
        mode: ro                   # HR can read all dept HR, but edit only their dept

  - name: wiki
    path: /shared/wiki
    access:
      - groups: [wiki-editors]
        mode: rw
      - groups: [all-employees]
        mode: ro
```

## EXDEV Shim: Independent of Kasm

The EXDEV cross-mount problem (Linux `rename()` fails across filesystem boundaries) exists regardless of how mounts get created. Whether Kasm Storage Mappings or a custom orchestrator injects bind mounts, `/vault/engineering` and `/vault/marketing` are separate mount points.

The shim lives in the **sync daemon** or **Obsidian plugin**, inside the container. It's completely independent of Kasm. The container startup script (`first_launch`) ensures it's active.

## What's Custom vs What Kasm Provides

| Need | Kasm Provides | Custom Code Needed |
|------|---------------|-------------------|
| Per-user personal folder | `{username}` variable in Storage Mapping | None |
| Group-based shared folders | Group-level Storage Mappings | Admin setup only |
| Read-only enforcement | Group setting `read_only_user_storage_mappings` | None |
| Composite vault assembly | Merges User + Group + Workspace mappings | None |
| .obsidian/ config generation | Exec Config (`first_launch` hook) | Startup shell script |
| Sync daemon room config | Exec Config (`first_launch` hook) | Startup shell script |
| EXDEV cross-mount shim | Nothing | Plugin/daemon logic |
| Compound permission rules | Nothing beyond group membership | Mount Orchestrator |
| Dynamic per-session overrides | Possibly via Developer API | Mount Orchestrator |
| Temporal/expiring access | Nothing | Mount Orchestrator |

## Open Questions

- [ ] Does Kasm's Developer API support per-session config injection, or only per-workspace?
- [ ] Can Storage Mappings use host-path bind mounts directly, or only Docker volumes with drivers?
- [ ] What's the performance overhead of rclone-based Storage Providers vs raw bind mounts?
- [ ] How does Kasm handle conflicting mappings (same target path from user + group)?
- [ ] Can Exec Config scripts access the user's JWT claims for runtime decisions?

## Next Steps

1. **POC Test A:** Set up Kasm with group-based Storage Mappings, measure admin overhead
2. **POC Test B:** Build minimal orchestrator that generates Docker run configs
3. **Compare:** Which approach requires less ongoing admin work for N folders × M groups?
4. **Document:** Results feed into [[ARCHITECTURE_COMPONENTS]] update

## Sources

- [Kasm Storage Mappings](https://docs.kasm.com/docs/latest/guide/persistent_data/storage_mappings/index.html)
- [Kasm Workspaces & Docker Run Config Override](https://kasm.com/docs/latest/guide/workspaces.html)
- [Kasm Volume Mapping](https://www.kasmweb.com/docs/latest/guide/persistent_data/volume_mapping.html)
- [Kasm Developer API](https://www.kasmweb.com/docs/latest/developers/developer_api.html)

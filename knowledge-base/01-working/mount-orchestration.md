# Mount Orchestration Service

Status: **Pending** (not started)

---

## Overview

Layer 3 component - controls which vaults are mounted for each user based on their groups/permissions.

---

## Key Concept

**RBAC at vault mount time, not file level.**

When a user connects:
1. Authenticate via IdP (Authentik)
2. Get user's groups from JWT/OIDC claims
3. Check config: which vaults can this user access?
4. Mount only permitted vaults
5. Start Obsidian session with those vaults

---

## Location

`orchestrator/` (to be created)

---

## Planned Structure

```
orchestrator/
├── package.json
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts           # Service entry
    ├── auth.ts            # OIDC/JWT validation
    ├── vault-permissions.ts  # Permission checking
    ├── mount-manager.ts   # Docker/SMB mounting
    └── audit-logger.ts    # Access logging
```

---

## Configuration

```yaml
# config/vault-permissions.yaml
vaults:
  - name: engineering
    path: /vaults/engineering
    smb: //fileserver/engineering  # Optional SMB
    allowed_groups:
      - engineering
      - devops

  - name: finance
    path: /vaults/finance
    allowed_groups:
      - finance
      - executives

  - name: wiki
    path: /vaults/wiki
    allowed_groups:
      - all-employees
```

---

## Flow

```
User → Authentik SSO → JWT with groups
                          ↓
               Mount Orchestrator
                          ↓
            Check vault-permissions.yaml
                          ↓
         Mount permitted vaults to container
                          ↓
              Start Obsidian session
                          ↓
              Log access to audit log
```

---

## Tasks

### Design

- [ ] API design (REST or event-driven?)
- [ ] Integration with Kasm/Guacamole
- [ ] SMB mounting approach

### Implementation

- [ ] Auth validation
- [ ] Permission checking
- [ ] Docker volume mounting
- [ ] SMB share mounting
- [ ] Audit logging

### Testing

- [ ] Unit tests for permission logic
- [ ] Integration tests with IdP
- [ ] End-to-end session tests

---

## Considerations

### Storage Options

| Option | Pros | Cons |
|--------|------|------|
| Docker volumes | Simple, fast | Less enterprise |
| SMB shares | AD-integrated | Network dependency |
| Both | Flexible | Complexity |

### IdP Integration

Options:
- Authentik (open source, recommended)
- Keycloak (more complex)
- Azure AD (cloud-native)

### Scaling

For multiple orchestrator instances:
- Need shared state for session tracking
- Redis for session store?

---

## Related

- [Architecture](../areas/architecture.md)
- [Decision: Vault-Level RBAC](../resources/decisions/decision-log.md#decision-002-rbac-at-vault-level-not-file-level)
- [Security](../areas/security.md)

# Security Considerations

Ongoing security concerns and mitigations for the project.

---

## Threat Model

### Assets

1. **Vault content** - User knowledge bases
2. **Credentials** - SSO tokens, session data
3. **Infrastructure** - Servers, containers

### Threat Actors

1. **Unauthorized external** - Internet attackers
2. **Unauthorized internal** - Employees without access
3. **Authorized but malicious** - Insider threats

---

## Security Layers

### Layer 1: VNC Gateway

| Concern | Mitigation |
|---------|------------|
| Session hijacking | SSO with MFA, session timeouts |
| VNC protocol exposure | HTTPS/WSS only, no raw VNC |
| Container escape | Hardened base images, no root |

### Layer 2: CRDT Sync

| Concern | Mitigation |
|---------|------------|
| Data interception | TLS for WebSocket transport |
| State file tampering | Signed CRDT states (future) |
| DoS via large updates | Size limits, rate limiting |

### Layer 3: Mount Orchestration

| Concern | Mitigation |
|---------|------------|
| Unauthorized vault access | JWT validation, group checking |
| Privilege escalation | Vault-level RBAC, no file-level |
| Audit evasion | Immutable audit logs |

---

## Authentication & Authorization

### SSO Integration

- Use OIDC/SAML with enterprise IdP
- MFA required for sensitive vaults
- Short session timeouts

### RBAC Model

```
User → IdP Groups → Vault Permissions → Mount Control
```

No file-level permissions by design. See [Decision-002](../resources/decisions/decision-log.md#decision-002-rbac-at-vault-level-not-file-level).

---

## Data Protection

### At Rest

- Vault files on encrypted storage
- CRDT state files alongside content
- Secrets in secure vault (HashiCorp Vault?)

### In Transit

- TLS 1.3 for all connections
- WebSocket over HTTPS (WSS)
- No plaintext protocols

### Backups

- Regular vault backups
- Point-in-time recovery via CRDT history
- Backup encryption

---

## Plugin Security

### Obsidian Plugins

| Risk | Mitigation |
|------|------------|
| Malicious plugins | Curated plugin list, no auto-update |
| Plugin network access | Firewall rules per plugin (ideal) |
| Data exfiltration | Network monitoring, DLP |

### Plugin Management

Options:
1. **Whitelist approach** - Only approved plugins
2. **Block GitHub** - No plugin downloads, manual install
3. **Review process** - Audit before approval

See [Obsidian Setup for Corporate](cyberbase vault) for detailed approach.

---

## Audit Logging

### Events to Log

- Vault access (mount)
- File operations (create, modify, delete)
- Authentication events
- Failed access attempts

### Log Format

```json
{
  "timestamp": "2024-12-20T00:00:00Z",
  "event": "vault_access",
  "userId": "user@example.com",
  "vaultId": "engineering",
  "action": "mount",
  "result": "success",
  "clientIp": "10.0.0.1"
}
```

### Log Storage

- Structured JSON logs
- Ship to SIEM (Splunk, Elastic, etc.)
- Retention per compliance requirements

---

## Compliance Considerations

### SOC 2

- Access controls (RBAC)
- Audit logging
- Encryption in transit/at rest
- Incident response

### GDPR

- Data minimization
- Right to deletion (purge from CRDT?)
- Data export capability

### HIPAA (if applicable)

- BAA with cloud providers
- Access logging
- Encryption requirements

---

## Open Questions

1. **CRDT state signing** - How to verify state integrity?
2. **Binary file encryption** - Encrypt in MinIO?
3. **Key management** - Where to store encryption keys?
4. **Plugin isolation** - Can we sandbox plugins?

---

## Related

- [Architecture](architecture.md)
- [Mount Orchestration](../projects/mount-orchestration.md)
- [Decision Log](../resources/decisions/decision-log.md)

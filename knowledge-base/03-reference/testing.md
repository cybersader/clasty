# Testing Approach

Testing strategy for the project.

---

## Test Levels

### Unit Tests

**Scope**: Individual functions and classes

**Location**: `*/tests/unit/`

**Tools**: Jest/Vitest

**Focus**:
- CRDT state manager
- Permission checking
- Audit logger

### Integration Tests

**Scope**: Component interactions

**Location**: `*/tests/integration/`

**Tools**: Jest + Docker

**Focus**:
- Sync daemon ↔ Yjs server
- Plugin ↔ state files
- Orchestrator ↔ IdP

### End-to-End Tests

**Scope**: Full user flows

**Location**: `tests/e2e/`

**Tools**: Playwright (for web UI)

**Focus**:
- Two users editing simultaneously
- Vault access control
- Session persistence

---

## Test Scenarios

### CRDT Sync

| Scenario | Expected |
|----------|----------|
| User A edits, User B opens | B sees A's changes |
| Both edit same paragraph | Merged content |
| Both edit different sections | Both changes preserved |
| Large file sync | Completes in < 5s |
| Binary attachment | Synced via MinIO |

### Access Control

| Scenario | Expected |
|----------|----------|
| User with access | Vault mounts |
| User without access | Vault not visible |
| User group changes | Access reflects on next session |
| Invalid token | Access denied |

### Presence

| Scenario | Expected |
|----------|----------|
| User opens file | Others see presence |
| User closes file | Presence clears |
| User moves cursor | Position updates |

---

## Testing Obsidian Plugin

### Challenge

Obsidian can't be automated headlessly. Plugin testing requires:
1. Build plugin
2. Install in test vault
3. Open Obsidian
4. Test manually

### Approach

1. **Unit test core logic** - State manager, identity, sync logic
2. **Mock Obsidian API** - For integration tests
3. **Manual testing** - For UI and file hooks
4. **Debug log file** - For persistent debugging

### Test Vault

Location: `obsidian-plugin/test-vault/`

Pre-configured with:
- Sample markdown files
- Plugin enabled
- Debug logging on

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run sync-daemon tests
        run: cd sync-daemon && npm test
      - name: Run orchestrator tests
        run: cd orchestrator && npm test
```

### Pre-commit Hooks

- Lint (ESLint)
- Type check (tsc)
- Unit tests

---

## Test Data

### Sample Vaults

| Vault | Purpose |
|-------|---------|
| demo | Basic testing |
| large-vault | Performance testing (1000+ files) |
| conflict-test | Conflict resolution scenarios |

### User Accounts

| User | Groups | Purpose |
|------|--------|---------|
| alice | engineering | Standard user |
| bob | engineering, devops | Multi-group |
| carol | finance | Different department |
| admin | all | Admin testing |

---

## Performance Testing

### Metrics

- Sync latency (target: < 5s)
- VNC latency (target: < 200ms)
- File open time (target: < 1s)
- Memory usage (target: < 500MB/user)

### Tools

- k6 for load testing
- Grafana for monitoring

---

## Known Limitations

1. **No headless Obsidian** - Can't automate plugin UI tests
2. **VNC testing** - Requires visual verification
3. **CRDT determinism** - Hard to test edge cases

---

## Related

- [Architecture](architecture.md)
- [Security](security.md)
- [Plugin Project](../projects/crdt-sync-plugin.md)

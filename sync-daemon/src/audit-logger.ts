/**
 * Audit Logger
 *
 * Logs all file operations for compliance and debugging.
 * Outputs structured JSON logs that can be shipped to a SIEM.
 */

interface AuditEvent {
  timestamp: string;
  userId: string;
  action: 'create' | 'modify' | 'delete' | 'remote_sync' | 'vault_access';
  path?: string;
  vault?: string;
  details?: Record<string, unknown>;
}

export class AuditLogger {
  private userId: string;
  private vaultName?: string;

  constructor(userId: string, vaultName?: string) {
    this.userId = userId;
    this.vaultName = vaultName;
  }

  private log(event: Omit<AuditEvent, 'timestamp' | 'userId'>): void {
    const auditEvent: AuditEvent = {
      timestamp: new Date().toISOString(),
      userId: this.userId,
      vault: this.vaultName,
      ...event
    };

    // Output as JSON line (easily parseable by log aggregators)
    console.log(JSON.stringify(auditEvent));
  }

  logVaultAccess(vaultName: string): void {
    this.vaultName = vaultName;
    this.log({
      action: 'vault_access',
      vault: vaultName,
      details: { type: 'session_start' }
    });
  }

  logFileCreate(path: string): void {
    this.log({
      action: 'create',
      path,
      details: { source: 'local' }
    });
  }

  logFileModify(path: string): void {
    this.log({
      action: 'modify',
      path,
      details: { source: 'local' }
    });
  }

  logFileDelete(path: string): void {
    this.log({
      action: 'delete',
      path,
      details: { source: 'local' }
    });
  }

  logRemoteSync(path: string): void {
    this.log({
      action: 'remote_sync',
      path,
      details: { source: 'crdt_server' }
    });
  }
}

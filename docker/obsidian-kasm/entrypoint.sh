#!/bin/bash
set -e

echo "=== Obsidian-in-Browser Container ==="
echo "Sync Server: ${SYNC_SERVER_URL:-ws://localhost:1234}"
echo "Vault Path: ${VAULT_PATH:-/config/vaults}"

# Ensure vault directory exists
mkdir -p "${VAULT_PATH:-/config/vaults}"

# Wait for sync server if configured
if [ -n "$SYNC_SERVER_URL" ]; then
    echo "Waiting for sync server..."
    # Simple wait - in production, use proper health check
    sleep 2
fi

# Start supervisor (manages both Obsidian and sync daemon)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

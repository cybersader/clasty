# Obsidian container with CRDT sync daemon
# Based on linuxserver/obsidian for stability

FROM linuxserver/obsidian:latest

# Install additional dependencies for sync daemon
RUN apt-get update && apt-get install -y \
    curl \
    inotify-tools \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (for sync daemon)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /opt/sync-daemon /var/log/supervisor

# Copy sync daemon
COPY sync-daemon/ /opt/sync-daemon/
WORKDIR /opt/sync-daemon
RUN npm install --production

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment variables
ENV SYNC_SERVER_URL=ws://yjs-server:1234
ENV VAULT_PATH=/config/vaults
ENV SYNC_DAEMON_PORT=3000

# Expose ports
# 3000 - VNC web interface (from base image)
# 3001 - Sync daemon API
EXPOSE 3000 3001

ENTRYPOINT ["/entrypoint.sh"]

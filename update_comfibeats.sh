#!/bin/bash

# Comfi Beats Update Script
# This script pulls the latest changes from GitHub, updates dependencies,
# enforces non-root file ownership, and restarts the service.

set -e

APP_DIR="${APP_DIR:-/opt/comfibeats}"
SERVICE_USER="comfibeats"
SERVICE_GROUP="comfibeats"

echo "🚀 Starting Comfi Beats update..."

if [ -d "$APP_DIR" ] && [ "$(pwd)" != "$APP_DIR" ]; then
    cd "$APP_DIR"
fi

# 1. Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull

# 2. Re-enforce file permissions for unprivileged user
echo "🔒 Ensuring correct permissions for $SERVICE_USER..."
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR" 2>/dev/null || true
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/playlists" "$APP_DIR/audio" 2>/dev/null || true
[ -f "$APP_DIR/guild_settings.json" ] && chmod 664 "$APP_DIR/guild_settings.json" 2>/dev/null || true

# 3. Sync dependencies and deploy slash commands
echo "📦 Syncing environment with bun..."
bun install

echo "🚀 Deploying slash commands..."
bun deploy-commands.js

# 4. Copy updated service file if changed
if [ -f "$APP_DIR/comfibeats.service" ]; then
    echo "📄 Updating /etc/systemd/system/comfibeats.service..."
    cp "$APP_DIR/comfibeats.service" /etc/systemd/system/
    systemctl daemon-reload
fi

# 5. Restart the service
echo "🔄 Restarting comfibeats.service..."
systemctl restart comfibeats.service

echo "✅ Update complete! Service restarted."
systemctl status comfibeats.service --no-pager

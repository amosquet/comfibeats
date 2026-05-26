#!/bin/bash

# Comfi Beats Update Script
# This script pulls the latest changes from GitHub and restarts the service.

set -e

echo "Searching for updates..."

# 1. Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull

# 2. Sync dependencies (in case package.json changed)
echo "📦 Syncing environment with bun..."
bun install

# 3. Deploy slash commands
echo "🚀 Deploying slash commands..."
bun deploy-commands.js

# 4. Restart the service
echo "🔄 Restarting comfibeats.service..."
systemctl restart comfibeats.service

echo "✅ Update complete! Service restarted."
systemctl status comfibeats.service --no-pager

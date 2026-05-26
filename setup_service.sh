#!/bin/bash

# Comfi Beats Service Setup Script for Root User
# This script automates the installation of the Comfi Beats systemd service.

set -e

echo "🚀 Starting Comfi Beats service setup..."

# 1. Sync dependencies
echo "📦 Installing dependencies with bun..."
bun install

# 2. Deploy slash commands
echo "🚀 Deploying slash commands..."
bun deploy-commands.js

# 3. Copy the service file
echo "📄 Copying comfibeats.service to /etc/systemd/system/..."
cp comfibeats.service /etc/systemd/system/

# 4. Reload systemd
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# 5. Enable the service
echo "📌 Enabling comfibeats.service..."
systemctl enable comfibeats.service

# 6. Start the service
echo "▶️ Starting comfibeats.service..."
systemctl start comfibeats.service

echo "✅ Setup complete! Service is now active and enabled."
systemctl status comfibeats.service --no-pager

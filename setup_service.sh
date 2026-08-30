#!/bin/bash

# Comfi Beats Service Setup Script
# This script automates the installation of the Comfi Beats systemd service
# running under the unprivileged 'comfibeats' system user.

set -e

APP_DIR="${APP_DIR:-/opt/comfibeats}"
SERVICE_USER="comfibeats"
SERVICE_GROUP="comfibeats"

echo "🚀 Starting Comfi Beats service setup..."

# 1. Ensure unprivileged system user and group exist
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
    echo "👤 Creating unprivileged system user '$SERVICE_USER'..."
    useradd -r -m -d "/home/$SERVICE_USER" -s /bin/bash "$SERVICE_USER" || true
else
    echo "👤 User '$SERVICE_USER' already exists."
fi

# 2. Setup application directory in /opt/comfibeats if not current dir
if [ "$(pwd)" != "$APP_DIR" ]; then
    echo "📁 Copying files to application directory $APP_DIR..."
    mkdir -p "$APP_DIR"
    cp -R ./* "$APP_DIR"/ || true
fi

# 3. Ensure required directories and config file exist
mkdir -p "$APP_DIR/playlists" "$APP_DIR/audio"
if [ ! -f "$APP_DIR/guild_settings.json" ]; then
    if [ -f "$APP_DIR/guild_settings.json.example" ]; then
        echo "{}" > "$APP_DIR/guild_settings.json"
    else
        echo "{}" > "$APP_DIR/guild_settings.json"
    fi
fi

# 4. Set appropriate permissions for the comfibeats user
echo "🔒 Configuring permissions for $SERVICE_USER..."
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR" "/home/$SERVICE_USER" 2>/dev/null || true
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/playlists" "$APP_DIR/audio" 2>/dev/null || true
chmod 664 "$APP_DIR/guild_settings.json" 2>/dev/null || true

# 5. Install dependencies and deploy slash commands
echo "📦 Installing dependencies with bun..."
if [ "$(pwd)" = "$APP_DIR" ]; then
    bun install
    echo "🚀 Deploying slash commands..."
    bun deploy-commands.js
else
    cd "$APP_DIR"
    bun install
    echo "🚀 Deploying slash commands..."
    bun deploy-commands.js
fi

# 6. Copy the systemd service file
echo "📄 Copying comfibeats.service to /etc/systemd/system/..."
cp "$APP_DIR/comfibeats.service" /etc/systemd/system/

# 7. Reload systemd daemon
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# 8. Enable the service
echo "📌 Enabling comfibeats.service..."
systemctl enable comfibeats.service

# 9. Start or restart the service
echo "▶️ Starting comfibeats.service..."
systemctl restart comfibeats.service || systemctl start comfibeats.service

echo "✅ Setup complete! Service is now active and running under unprivileged user '$SERVICE_USER'."
systemctl status comfibeats.service --no-pager

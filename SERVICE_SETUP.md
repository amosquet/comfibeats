# Comfi Beats Service Setup

Instructions for setting up and managing the Comfi Beats Discord bot as a hardened systemd service under an unprivileged `comfibeats` user in `/opt/comfibeats`.

## Prerequisites

- Linux host running systemd (e.g. Debian, Ubuntu, Arch, Rocky)
- [Bun](https://bun.sh/) runtime installed (`~/.bun/bin/bun` or `/usr/local/bin/bun`)
- Git

## Installation (Automated)

The easiest way to set everything up is using the provided setup script:

```bash
chmod +x setup_service.sh
sudo ./setup_service.sh
```

This script will:
1. Create the dedicated `comfibeats` system user and group.
2. Configure `/opt/comfibeats` with restrictive permissions.
3. Install dependencies via `bun install`.
4. Deploy Discord slash commands via `bun deploy-commands.js`.
5. Install and enable the hardened `comfibeats.service` unit with sandbox protections (`ProtectSystem=strict`, `NoNewPrivileges=true`, `PrivateTmp=true`).
6. Start the service.

## Installation (Manual)

If you prefer to set up manually:

1. **Create the system user:**
   ```bash
   sudo useradd -r -m -d /home/comfibeats -s /bin/bash comfibeats
   ```

2. **Setup application directory:**
   ```bash
   sudo mkdir -p /opt/comfibeats
   sudo cp -R ./* /opt/comfibeats/
   sudo chown -R comfibeats:comfibeats /opt/comfibeats /home/comfibeats
   ```

3. **Install dependencies & deploy commands:**
   ```bash
   cd /opt/comfibeats
   bun install
   bun deploy-commands.js
   ```

4. **Copy the service unit:**
   ```bash
   sudo cp comfibeats.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable comfibeats.service
   sudo systemctl start comfibeats.service
   ```

## Management

- **Update Comfi Beats:**
  Pulls the latest code from GitHub, ensures correct permissions, syncs dependencies, and restarts the service.

  ```bash
  chmod +x update_comfibeats.sh
  sudo ./update_comfibeats.sh
  ```

  Alternatively, if you are the bot owner, you can trigger the update directly from Discord using the `/update` slash command.

- **Check Status:**
  ```bash
  sudo systemctl status comfibeats.service
  ```

- **Restart Service:**
  ```bash
  sudo systemctl restart comfibeats.service
  ```

- **Stop Service:**
  ```bash
  sudo systemctl stop comfibeats.service
  ```

- **View Logs (Real-time):**
  ```bash
  journalctl -u comfibeats.service -f
  ```

- **Disable Auto-start:**
  ```bash
  sudo systemctl disable comfibeats.service
  ```

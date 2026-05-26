# Comfi Beats Service Setup

Instructions for setting up and managing the Comfi Beats Discord bot as a systemd service on a Proxmox Arch container (running as root).

## Installation

1.  **Sync the dependencies:**
    ```bash
    bun install
    ```

2.  **Copy the service file to the systemd directory:**
    ```bash
    cp comfibeats.service /etc/systemd/system/
    ```

3.  **Reload systemd to recognize the new service:**
    ```bash
    systemctl daemon-reload
    ```

4.  **Enable the service to start at boot:**
    ```bash
    systemctl enable comfibeats.service
    ```

5.  **Start the service now:**
    ```bash
    systemctl start comfibeats.service
    ```

## Management

- **Update Comfi Beats:**
  Pulls the latest code from GitHub, syncs dependencies, and restarts the service.

  ```bash
  chmod +x update_comfibeats.sh
  ./update_comfibeats.sh
  ```

- **Check Status:**
  ```bash
  systemctl status comfibeats.service
  ```

- **Restart Service:**
  ```bash
  systemctl restart comfibeats.service
  ```

- **Stop Service:**
  ```bash
  systemctl stop comfibeats.service
  ```

- **View Logs (Real-time):**
  ```bash
  journalctl -u comfibeats.service -f
  ```

- **Disable Auto-start:**
  ```bash
  systemctl disable comfibeats.service
  ```

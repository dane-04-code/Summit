export const INSTALL_SCRIPT = `#!/bin/sh
# Summit Connector installer
# Usage: curl -fsSL https://get.summitapp.dev/connect | sh
set -e

RELAY_URL="wss://relay.summitapp.dev"
REPO="dane-04-code/agentchat"
TAG="connector-latest"
if [ -w "/usr/local/bin" ]; then
  INSTALL_PATH="/usr/local/bin/summit-connector"
else
  mkdir -p "\${HOME}/.local/bin"
  INSTALL_PATH="\${HOME}/.local/bin/summit-connector"
fi
CONFIG_DIR="\${HOME}/.summit"
LOG_FILE="\${CONFIG_DIR}/connector.log"
SERVICE_NAME="summit-connector"

# ── Platform ──────────────────────────────────────────────────────────────────
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "\${ARCH}" in
  x86_64)        ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: \${ARCH}"; exit 1 ;;
esac

# ── Download binary ───────────────────────────────────────────────────────────
echo "▸ Downloading connector (\${OS}/\${ARCH})..."
curl -fsSL \\
  "https://github.com/\${REPO}/releases/download/\${TAG}/connector-\${OS}-\${ARCH}" \\
  -o "\${INSTALL_PATH}"
chmod +x "\${INSTALL_PATH}"
echo "▸ Installed to \${INSTALL_PATH}"

# ── Detect Hermes config ──────────────────────────────────────────────────────
: "\${HERMES_BASE_URL:=http://localhost:8642}"

if [ -z "\${HERMES_API_KEY}" ]; then
  for env_file in \\
    "\${HOME}/.hermes/.env" \\
    "/etc/hermes/.env" \\
    "\${HOME}/.hermes/config" \\
    "/opt/hermes/.env"; do
    if [ -f "\${env_file}" ]; then
      key=$(grep -E '^(API_SERVER_KEY|HERMES_API_KEY)=' "\${env_file}" 2>/dev/null \\
            | head -1 | sed 's/^[^=]*=//' | tr -d '"'"'"')
      if [ -n "\${key}" ]; then
        HERMES_API_KEY="\${key}"
        echo "▸ API key found in \${env_file}"
        break
      fi
    fi
  done
fi

if [ -z "\${HERMES_API_KEY}" ]; then
  echo ""
  echo "ERROR: Could not find your Hermes API key automatically."
  echo ""
  echo "Re-run with your key set:"
  echo "  HERMES_API_KEY=your-key curl -fsSL https://get.summitapp.dev/connect | sh"
  exit 1
fi

# ── Write config ──────────────────────────────────────────────────────────────
mkdir -p "\${CONFIG_DIR}"
chmod 700 "\${CONFIG_DIR}"
printf 'RELAY_URL=%s\\nHERMES_BASE_URL=%s\\nHERMES_API_KEY=%s\\n' \\
  "\${RELAY_URL}" "\${HERMES_BASE_URL}" "\${HERMES_API_KEY}" \\
  > "\${CONFIG_DIR}/connector.env"
chmod 600 "\${CONFIG_DIR}/connector.env"

# ── Start connector ───────────────────────────────────────────────────────────
USE_SYSTEMD=0
if command -v systemctl > /dev/null 2>&1 && [ -d /etc/systemd/system ] && [ "$(id -u)" = "0" ]; then
  USE_SYSTEMD=1
fi

if [ "\${USE_SYSTEMD}" = "1" ]; then
  cat > "/etc/systemd/system/\${SERVICE_NAME}.service" << UNIT
[Unit]
Description=Summit Connector
After=network.target

[Service]
EnvironmentFile=\${CONFIG_DIR}/connector.env
ExecStart=\${INSTALL_PATH}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now "\${SERVICE_NAME}"
  echo "▸ Running as systemd service — will restart automatically on failure."
  echo "▸ Waiting for pairing code..."
  i=0; code=""
  while [ "\${i}" -lt 30 ] && [ -z "\${code}" ]; do
    code=$(journalctl -u "\${SERVICE_NAME}" -n 50 --no-pager 2>/dev/null \\
           | grep -o 'Pairing code: [0-9]*' | tail -1)
    [ -z "\${code}" ] && sleep 1
    i=$((i + 1))
  done
else
  pkill -f summit-connector 2>/dev/null || true
  sleep 1
  RELAY_URL="\${RELAY_URL}" HERMES_BASE_URL="\${HERMES_BASE_URL}" \\
    HERMES_API_KEY="\${HERMES_API_KEY}" \\
    nohup "\${INSTALL_PATH}" > "\${LOG_FILE}" 2>&1 &
  CONNECTOR_PID=$!
  echo "▸ Connector started (PID: \${CONNECTOR_PID})"
  echo "▸ Waiting for pairing code..."
  i=0; code=""
  while [ "\${i}" -lt 30 ] && [ -z "\${code}" ]; do
    code=$(grep -o 'Pairing code: [0-9]*' "\${LOG_FILE}" 2>/dev/null | tail -1)
    [ -z "\${code}" ] && sleep 1
    i=$((i + 1))
  done
fi

if [ -z "\${code}" ]; then
  echo ""
  echo "ERROR: Timed out waiting for pairing code."
  if [ "\${USE_SYSTEMD}" = "1" ]; then
    journalctl -u "\${SERVICE_NAME}" -n 20 --no-pager
  else
    cat "\${LOG_FILE}" 2>/dev/null || true
  fi
  exit 1
fi

digits=$(echo "\${code}" | grep -o '[0-9]*')
echo ""
echo "┌──────────────────────────┐"
printf "│   Pairing code: %s   │\\n" "\${digits}"
echo "└──────────────────────────┘"
echo ""
echo "Enter this code in the Summit app to connect."
`;

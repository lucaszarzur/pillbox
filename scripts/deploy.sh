#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="root@168.231.91.167"
VPS_PATH="/opt/pillbox"
VPS_NODE_PATH="/root/.nvm/versions/node/v21.0.0/bin"
PM2_APP="pillbox"

target="${1:-}"

usage() {
  echo "uso: $0 <local|vps>"
  exit 1
}

case "$target" in
  local)
    echo "==> build local"
    npm run build
    ;;
  vps)
    echo "==> deploy na VPS ($VPS_HOST:$VPS_PATH)"
    ssh "$VPS_HOST" "export PATH=$VPS_NODE_PATH:\$PATH && cd $VPS_PATH && git pull && npm run build && pm2 restart $PM2_APP"
    ;;
  *)
    usage
    ;;
esac

echo "==> ok"

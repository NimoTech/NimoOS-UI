#!/usr/bin/env bash
# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。
# 注意:首次需确保 /var/lib/nimoos/www/app/ 存在且对 nimo 可写
#   sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www/app
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
rsync -a --delete dist/ /var/lib/nimoos/www/app/
echo "Deployed to /var/lib/nimoos/www/app/  →  http://<host>/app/#/"

#!/usr/bin/env bash
# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。
# 注意:首次需确保 /var/lib/nimoos/www/app/ 存在且对 nimo 可写
#   sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www/app
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
# protect assets/*:保留旧哈希 chunk——部署前已打开的标签页仍会按旧 index.html 懒加载
# 旧哈希文件,删掉会让"点开预览/懒路由"404 且不可自愈(表现为点击没反应,必须手动刷新)。
# 陈旧 chunk 由下面的 find 按 mtime 清理(每次构建产物都是新 mtime,只会清到真正的旧版本)。
rsync -a --delete --filter='protect assets/*' dist/ /var/lib/nimoos/www/app/
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
echo "Deployed to /var/lib/nimoos/www/app/  →  http://<host>/app/#/"

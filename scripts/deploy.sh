#!/usr/bin/env bash
# 构建 NimoOS-New-UI 并部署到 Gateway 的 /app/ 静态目录。
# 注意:首次需确保 /var/lib/nimoos/www/app/ 存在且对 nimo 可写
#   sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www /var/lib/nimoos/www/app
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
# protect assets/*:保留旧哈希 chunk——部署前已打开的标签页仍会按旧 index.html 懒加载
# 旧哈希文件,删掉会让"点开预览/懒路由"404 且不可自愈(表现为点击没反应,必须手动刷新)。
# 陈旧 chunk 由下面的 find 按 mtime 清理(每次构建产物都是新 mtime,只会清到真正的旧版本)。
rsync -a --delete --filter='protect assets/*' dist/ /var/lib/nimoos/www/app/
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
# 本应用挂在 /app/ 下,根目录不属于它 —— 补一个 / → /app/ 的重定向页,
# 让只部署了本应用的机器上,输入 / 也能落到应用里。
# 脚本自带覆盖守卫:根目录已有别的首页时一字不动(详见脚本头部注释)。
# 本脚本开头已 `cd "$(dirname "$0")/.."`,所以这里的相对路径就是仓库根。
./scripts/write-root-redirect.sh /var/lib/nimoos/www
echo "Deployed to /var/lib/nimoos/www/app/  →  http://<host>/app/#/"

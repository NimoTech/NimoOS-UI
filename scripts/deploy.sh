#!/usr/bin/env bash
# Build the app and deploy to the Gateway's /app/ static directory.
# Note: on first use, make sure /var/lib/nimoos/www/app/ exists and is writable by nimo
#   sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www /var/lib/nimoos/www/app
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
# protect assets/*: keep old hashed chunks — tabs opened before the deploy still lazy-load
# old hashed files per the old index.html; deleting them makes "open preview / lazy route" 404
# with no self-healing (clicks appear dead until a manual refresh).
# Stale chunks are cleaned by the find below by mtime (each build's output has a fresh mtime, so only truly old versions get removed).
rsync -a --delete --filter='protect assets/*' dist/ /var/lib/nimoos/www/app/
find /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
# This app is mounted under /app/; the www root does not belong to it — add a / → /app/
# redirect page so that on machines with only this app deployed, typing / still lands in the app.
# The script has its own overwrite guard: if the root already has another homepage, it touches nothing (see the script's header comment).
# This script already did `cd "$(dirname "$0")/.."` at the top, so relative paths here are the repo root.
./scripts/write-root-redirect.sh /var/lib/nimoos/www
echo "Deployed to /var/lib/nimoos/www/app/  →  http://<host>/app/#/"

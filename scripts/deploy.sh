#!/usr/bin/env bash
# Build the app and deploy to the Gateway's www root. This app owns the site root since
# 2026-08-29 (the Vue 2 panel is retired); the URL is http://<host>/#/.
# Note: on first use, make sure /var/lib/nimoos/www/ exists and is writable by nimo
#   sudo mkdir -p /var/lib/nimoos/www && sudo chown nimo:nimo /var/lib/nimoos/www
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
# protect assets/*: keep old hashed chunks — tabs opened before the deploy still lazy-load
# old hashed files per the old index.html; deleting them makes "open preview / lazy route"
# 404 with no self-healing (clicks appear dead until a manual refresh). Stale chunks are
# cleaned by the find below by mtime (each build's output has a fresh mtime, so only truly
# old versions get removed).
# protect app/**: the legacy /app/ mount. Tabs opened before the move to the root still
# lazy-load /app/assets/* — keep those files aging out on the same mtime schedule, and let
# write-app-redirect.sh (below) turn /app/ itself into a redirect to /. Once no clients
# have week-old tabs left, the whole app/ directory can be removed by hand.
# --delete also clears everything the retired Vue 2 panel left at the root (css/ fonts/
# js/ ui/ and its hashed root-level chunks) on the first deploy after the move.
rsync -a --delete --filter='protect assets/*' --filter='protect app/**' --filter='protect app' dist/ /var/lib/nimoos/www/
find /var/lib/nimoos/www/assets /var/lib/nimoos/www/app/assets -type f -mtime +14 -delete 2>/dev/null || true
# Old bookmarks and home-screen shortcuts still point at /app/#/… — keep that path working
# as a redirect that carries the hash over (see the script's own header).
./scripts/write-app-redirect.sh /var/lib/nimoos/www
# The Gateway's components probe reads www/version.json to report "NimoOS UI";
# without it the UI shows as offline in the system-status tab. Written after the
# rsync above on purpose: that rsync --deletes unmanaged files at the www root,
# so this file must be (re)created last on every deploy.
if [ -f ../NimoOS-Build/release/versions.conf ] && [ -f ../NimoOS-Build/release/lib/version_inject.sh ]; then
  # shellcheck disable=SC1091
  source ../NimoOS-Build/release/versions.conf
  source ../NimoOS-Build/release/lib/version_inject.sh
  FULL_VERSION="$(resolve_full_version)"
else
  FULL_VERSION="dev+0.g$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi
printf '{"version":"%s"}\n' "$FULL_VERSION" > /var/lib/nimoos/www/version.json
echo "Deployed to /var/lib/nimoos/www/  →  http://<host>/#/  (version.json: $FULL_VERSION)"

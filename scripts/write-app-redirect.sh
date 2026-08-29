#!/usr/bin/env bash
# Write a static "/app/ → /" redirect page into the legacy /app/ mount.
#
# Why it exists: this app used to be mounted under /app/ (the Vue 2 panel owned the site
# root). Since 2026-08-29 the app is served at the root, but bookmarks, home-screen
# shortcuts and open tabs still point at /app/#/…. This page carries the query string and
# hash over verbatim, so /app/#/files lands on /#/files.
#
# No overwrite guard, deliberately (unlike the retired write-root-redirect.sh, which wrote
# into a root it did not own): /app/ has only ever belonged to this app, so whatever
# index.html sits there is ours to replace.
#
# Note: the redirect target check is deliberately NOT a pipeline — under `set -o pipefail`,
# `grep -q` exiting early SIGPIPEs the upstream (this repo has hit that trap before).
set -euo pipefail

WWW_ROOT="${1:?usage: write-app-redirect.sh <www-root>}"
MARKER='nimoos-app-redirect'
APP_DIR="$WWW_ROOT/app"
TARGET="$APP_DIR/index.html"

if [ ! -d "$WWW_ROOT" ] || [ ! -w "$WWW_ROOT" ]; then
	echo "error: $WWW_ROOT does not exist or is not writable by current user; cannot write redirect page." >&2
	echo "Please first run: sudo mkdir -p $WWW_ROOT && sudo chown $(id -un):$(id -gn) $WWW_ROOT" >&2
	exit 1
fi
mkdir -p "$APP_DIR"

# Atomic write: the gateway is serving this directory, so `cat > target` has a window where
# the file is truncated but not yet fully written. Write a temp file first, then mv into
# place (same directory ⇒ same filesystem ⇒ mv is an atomic rename). mktemp gives each
# invocation its own name, so two concurrent deploys cannot truncate each other's temp file;
# the trap cleans up if cat fails midway (after a successful mv the rm is a no-op).
tmp="$(mktemp "$APP_DIR/.index.html.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 644 "$tmp"  # mktemp creates files as 0600 by default; without chmod the gateway cannot read it

# The two fallback paths are asymmetric: with JS, the script carries the query string/hash
# over verbatim; the meta refresh inside <noscript> can only land on the homepage — meta
# refresh has no runtime variables available, a hard limitation rather than an oversight.
cat > "$tmp" <<EOF
<!doctype html>
<!-- $MARKER -->
<meta charset="utf-8">
<title>NimoOS</title>
<script>location.replace('/' + location.search + location.hash)</script>
<noscript><meta http-equiv="refresh" content="0;url=/"></noscript>
EOF
mv -f "$tmp" "$TARGET"

echo "wrote: $TARGET"

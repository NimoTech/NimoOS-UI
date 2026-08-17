#!/usr/bin/env bash
# Write a static "/ → /app/" redirect page into the www root.
#
# Why it exists: this app is mounted under /app/ (hash routing), and the www root does not
# belong to it. On machines with only this app deployed, typing / lands in a directory with
# no index.html. This page adds that hop, carrying the query string and hash over verbatim,
# so old bookmarks like /?a=1#/files still land correctly.
#
# 🔴 Overwrite guard: the www root may already host ANOTHER app's homepage; overwriting it
#    would kill that app. So we only write in two cases: (1) the file does not exist;
#    (2) the file was written by this script last time (first 5 lines contain MARKER).
#    The marker sits on line 2 (line 1 is the doctype), hence the criterion is "first 5 lines", not "the first line".
#
# Note: the check is deliberately NOT written as `head -n 5 … | grep -q …` — under
#    `set -o pipefail`, `grep -q` exits on first match and sends SIGPIPE to the upstream
#    head, failing the whole pipeline (this repo has hit that trap before).
#    A variable + case match is used instead; no pipeline anywhere.
set -euo pipefail

WWW_ROOT="${1:?usage: write-root-redirect.sh <www-root>}"
MARKER='nimoos-new-ui-redirect'
TARGET="$WWW_ROOT/index.html"

# Target machines often only have permissions set up on the app subdirectory (the install
# doc historically only chowned that layer), so the www root itself may be root:root.
# Discovering that here would surface as a bare `Permission denied` and abort the whole
# deploy script (rsync already succeeded, but the operator only sees "deploy failed").
# Check upfront and print an actionable fix instead of letting mktemp/cat trip over permissions.
if [ ! -d "$WWW_ROOT" ] || [ ! -w "$WWW_ROOT" ]; then
	echo "error: $WWW_ROOT does not exist or is not writable by current user; cannot write redirect page." >&2
	echo "Please first run: sudo mkdir -p $WWW_ROOT && sudo chown $(id -un):$(id -gn) $WWW_ROOT" >&2
	exit 1
fi

if [ -e "$TARGET" ]; then
	head5="$(head -n 5 "$TARGET")"
	case "$head5" in
		*"$MARKER"*) : ;;  # written by this script last time; safe to overwrite
		*)
			echo "skip: $TARGET already exists and was not written by this script (root directory has another homepage); not overwriting"
			exit 0
			;;
	esac
fi

# Atomic write: the gateway is serving this directory, so `cat > target` has a window where
# the file is truncated but not yet fully written. Write a temp file first, then mv into
# place (same directory ⇒ same filesystem ⇒ mv is an atomic rename).
#
# The temp file name must not be fixed (it used to be "$TARGET.tmp"): with two concurrent
# deploys reaching this point, the later one truncates the same-named temp file the earlier
# one is still writing, and the earlier one then mv's a 0-byte index.html into place.
# mktemp assigns each invocation its own file name, eliminating that race.
# The trap is a cleanup backstop: if cat fails midway (e.g. disk full), we must not leave a
# .tmp file in the www root — the gateway would serve it as a regular static file. After a
# successful mv the temp file is no longer at its original path, so the rm -f in the trap is a safe no-op.
tmp="$(mktemp "$WWW_ROOT/.index.html.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 644 "$tmp"  # mktemp creates files as 0600 by default; without chmod the gateway cannot read it

# The two fallback paths written below are asymmetric: with JS, the script carries the
# query string/hash over verbatim; the meta refresh inside <noscript> can only land on the
# /app/ homepage and cannot get the query string/hash — meta refresh has no runtime
# variables available, a hard limitation rather than an oversight. Without JS, bookmark-style deep links break.
cat > "$tmp" <<EOF
<!doctype html>
<!-- $MARKER -->
<meta charset="utf-8">
<title>NimoOS</title>
<script>location.replace('/app/' + location.search + location.hash)</script>
<noscript><meta http-equiv="refresh" content="0;url=/app/"></noscript>
EOF
mv -f "$tmp" "$TARGET"

echo "wrote: $TARGET"

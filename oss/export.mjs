#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  DELETE, SERVICE_DELETE, REPLACE, PATCH, SERVICE_PATCH,
  NEW_UI, PREVIEW_OUT, PUBLISH_OUT, OSS_DIR, DIRTY_ALLOW,
} from './manifest.mjs'
import { checkClean, applyDelete, applyReplace, applyPatch } from './apply.mjs'
import { scanTree, isExpectedSkip } from './forbidden.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }

// ── 0. Parameter validation ─────────────────────────────────────────────────────
// 🔴 This runs before everything; it's the fix for the 2026-08-08 incident. The parsing back then had only the two helpers above:
// `flag()` was `argv.includes()`, `opt()` was `indexOf()` — **unknown parameters didn't error, equivalent to not passing them**.
// So `node oss/export.mjs --help` (just wanting to see what parameters exist) went through the entire default path:
// output directory = real public repo, commit = enabled ⇒ rsync --delete overwrites public repo + `git commit --amend`
// changes its HEAD. The script did error at the end (`rev-list --count` line), but that was after the commit —
// **response came too late, equivalent to not triggering**.
//
// So the rules here are two, both required:
//   ① Unknown parameter → exit immediately, don't enter any flow (whitelist, not blacklist);
//   ② Dangerous action (write public repo + commit) only happens with explicit --publish, default exports to temp preview dir.
// Behavior is locked down by oss/cli-args.test.mjs, where "without --publish don't init repo" and "with --publish init repo"
// **must exist as a pair** — either alone can't distinguish "default off" from "permanently off".
const VALUE_FLAGS = new Set(['--out'])          // value follows; that value doesn't participate in unknown param checking
const BOOL_FLAGS = new Set([
  '--publish', '--skip-guard', '--no-commit', '--keep-temp', '--allow-dirty-oss', '--help', '-h',
])

const USAGE = `Usage: node oss/export.mjs [options]

  Without --publish: export to temp preview directory (${PREVIEW_OUT}), write to disk only—no repo init, no commit.
                     No matter how you run it, it never touches the public repo; use this to check what the manifest changed.
  With --publish   : export to public repo (${PUBLISH_OUT}), rsync --delete overwrites it
                     and git commit --amends into zero-history single commit. **This is the publish action.**

Options:
  --publish            Publish mode. Without it, the public repo won't change a single byte.
  --out <dir>          Specify output directory, overriding the two defaults above.
  --no-commit          Even with --publish, only write to disk—don't commit.
  --skip-guard         Skip step 5 leak guard. Development-only; forbidden in official release.
  --allow-dirty-oss    Allow uncommitted changes under oss/. Development-only; forbidden in official release.
  --keep-temp          Keep intermediate temp directory after writing; useful for debugging "what did the manifest change".
  -h, --help           Show this help.

Unknown parameters are always rejected — the 2026-08-08 incident was exactly \`--help\` being treated as "no params",
so it really did overwrite and commit the public repo using defaults. See oss/README.md and oss/cli-args.test.mjs.`

for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (VALUE_FLAGS.has(a)) {
    if (i + 1 >= argv.length) {
      console.error(`[oss] Failed: ${a} missing value after it.\n\n${USAGE}`)
      process.exit(1)
    }
    i++                                          // skip its value
    continue
  }
  if (BOOL_FLAGS.has(a)) continue
  console.error(`[oss] Failed: unknown parameter ${a}. To prevent mistakes, refusing to proceed.\n\n${USAGE}`)
  process.exit(1)
}

if (flag('--help') || flag('-h')) {
  console.log(USAGE)
  process.exit(0)
}

const PUBLISH = flag('--publish')
const OUT = path.resolve(opt('--out', PUBLISH ? PUBLISH_OUT : PREVIEW_OUT))
const SKIP_GUARD = flag('--skip-guard')
// Default don't commit: only with explicit --publish does it init repo and commit; --no-commit can still turn it off.
const NO_COMMIT = !PUBLISH || flag('--no-commit')
const KEEP_TEMP = flag('--keep-temp')
const ALLOW_DIRTY_OSS = flag('--allow-dirty-oss')

const log = (m) => console.log(`[oss] ${m}`)
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()

// T14(B1): wrap entire main flow in try/catch — this project's rule is "error messages are the product"
// (see diagnostic text in each throw in apply.mjs); expected failures like hitting guard/stale manifest,
// visible to operator, **shouldn't include a raw Node stack trace**, which is noise and obscures carefully
// crafted diagnostic text. Only at outermost layer print err.message + exit(1) as fallback; throw Error
// normally inside, unified catch turns it into a quiet failure exit.
try {
// ── 1. Pre-flight checks ──────────────────────────────────────────────────
log('1/6 Pre-flight checks')
// --allow-dirty-oss is only for oss/ self's development iteration testing (T6-T14 repeatedly appends
// data to manifest.mjs, adds files to oss/), doesn't weaken checkClean/DIRTY_ALLOW semantics themselves —
// just additionally allows lines with paths under oss/ in git status at the call site. Reason: manifest.mjs
// describes the "delete/change actions" themselves; when oss/ has uncommitted changes and rest of source is clean,
// `git archive HEAD` still retrieves the real HEAD content, only the "manifest" is new — this inconsistency
// is harmless during development iteration. For official release (T15) never use this flag: then manifest.mjs
// must exactly match the source version that `git archive HEAD` retrieves; any uncommitted changes under oss/
// should be caught first.
//
// T14(B5): rename lines in `git status --porcelain` look like: `R  oss/foo.mjs -> src/moved.ts`
// — the old /^.{2}\s+oss\//` only looks at the first path immediately after "status+space" (rename's old path),
// and if old path falls under oss/, it lets the whole line through regardless of where new path goes. If we really
// move a file from oss/ to src/, the actual uncommitted change on src/ would be silently passed by this regex,
// making checkClean pointless. Use a regex that "consumes the whole line": allow content before " -> " (old path)
// to be any non-" -> " text, but if the line truly contains " -> " (indicating rename/copy), the new path after
// must also start with oss/ to pass; if new path moved out of oss/, regex won't match line-end, falls back to "not exempted".
// Lowest-priority dev flag (T15 doesn't use), but since we're fixing it, fix it right, don't leave it half-done.
const OSS_RENAME_SAFE = /^.{2}\s+oss\/(?:(?!\s->\s).)*(?:\s->\s+oss\/.*)?$/
const dirtyAllowNewUi = ALLOW_DIRTY_OSS ? [...DIRTY_ALLOW, OSS_RENAME_SAFE] : DIRTY_ALLOW
checkClean(NEW_UI, dirtyAllowNewUi)
const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
log(`  New-UI ${headNewUi.slice(0, 8)} (shared package already inlined, no second repo)`)

// ── 2. Source extraction (git archive HEAD) ──────────────────────────────
// 🔴 This used to say ".git / node_modules / dist / .superpowers / tmlab are automatically excluded" —
// **that statement was wrong, and it's exactly the mechanism that let 437 design-doc leaks hide for months**
// (SP8-P6-T8 real test: output tree hits 977 leaks, of which 437 came from packages/service/.superpowers/**).
// Changed to accurate:
//
//   `git archive HEAD` has only two exclusion bases —
//     ① **Files not tracked by git** (.git itself, node_modules/, dist/, scripts/tmlab/ all fall here:
//        first three in .gitignore, tmlab is also `git ls-files | grep tmlab` = 0 items);
//     ② Paths marked `export-ignore` in `.gitattributes` — **this repo has no .gitattributes file**
//        (confirmed by test), so this basis effectively doesn't exist here.
//
//   ⇒ **All tracked files go into output tree**, only explicit manifest deletion stops them. `.superpowers/` is exactly
//     this case: since 2026-08-05 design docs in git became mandatory, and here we have **two** independently-tracked
//     design directories — New-UI root's `.superpowers/`, and `packages/service/.superpowers/`
//     (before SP13 inlining was independent repo `NimoOS-Service`'s own designs; after inlining came into this tree
//     in the same `archive`, but it's **its own copy**, not mixed with root `.superpowers/`).
//     **The old phrase "each repo's designs" is no longer accurate (now only archive one repo), but the conclusion holds**:
//     still need **two separate manifest entries** to remove both:
//       · New-UI root → '.superpowers' in `DELETE` table of manifest.mjs
//       · `packages/service/` subdirectory → '.superpowers' in `SERVICE_DELETE` table
//         (added SP8-P6-T8, was missing before; SP13 inlining just changed its base dir from "another archive root"
//         to "subdirectory in the same tree", entry itself stays the same)
//     Missing either one won't cause anyone to report an error — only leak-guard word hits are the fallback, and
//     when the word list happens to have no forbiddings, it silently goes public. **⚠️ Specific consequence**: if
//     someone reasons "now there's only one repo" and deletes the `SERVICE_DELETE` '.superpowers' entry, 437 lines
//     of design content go straight into public output tree, and `forbidden.mjs` word list has no forbiddings for it,
//     **leak guard won't trigger** — that's exactly the kind of accident this comment is meant to prevent early.
//     tree.test.mjs therefore has two additional **directory-existence** assertions (independent of word list),
//     see the "both design directories must not enter output tree" test case there.
log('2/6 Source extraction')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-export-'))
// try starts here (after mkdtempSync, before first possible-failure op archiveInto), covers source extraction +
// applying manifest + writing to disk — otherwise source extraction phase (e.g., sibling NimoOS-Service doesn't exist/archive fails)
// would leave tmp directory in /tmp if finally cleanup can't run.
try {
  const archiveInto = (repo, dest) => {
    fs.mkdirSync(dest, { recursive: true })
    execFileSync('sh', ['-c', `git -C '${repo}' archive HEAD | tar -x -C '${dest}'`])
  }
  archiveInto(NEW_UI, tmp)
  // After SP13 inlining, packages/service/ is already in New-UI's own archive; no second repo needed.
  // This variable is kept: SERVICE_DELETE / SERVICE_PATCH tables below still use it as base dir.
  const svcDir = path.join(tmp, 'packages/service')

  // ── 3. Apply manifest: fixed order DELETE → REPLACE → PATCH ──────────────
  log(`3/6 Apply manifest (DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length})`)
  applyDelete(tmp, DELETE)
  applyDelete(svcDir, SERVICE_DELETE)
  applyReplace(tmp, REPLACE, path.join(OSS_DIR, 'files'))
  applyPatch(tmp, PATCH)
  applyPatch(svcDir, SERVICE_PATCH)

  // ── 4. Inline shared package ── Since SP13, private repo is already in inlined form (package.json hardcodes
  //    file:packages/service, package entry points to TS source), output tree is naturally correct, no rewrites needed.
  //    Previously this section had: one file: path rewrite + two lockfile replaceAll + two "anchor not found" guards.

  // ── 4.5 Recalculate lockfile (SP8-P6-T7 fix wave 1 · Important 2) ────────
  // Background: manifest will **remove package.json dependencies** starting here (AI-exclusive 4 tiptap +
  // dompurify + @types/dompurify). The section above only rewrites file: path; the specifiers removed from the
  // importers section stay as-is — so output tree's pnpm-lock.yaml conflicts with package.json:
  //   · `CI=true pnpm install` (CI env frozen-lockfile defaults true) directly
  //     ERR_PNPM_OUTDATED_LOCKFILE — for a **public repo** that means "clone and can't install".
  //     Output repo tracks pnpm-lock.yaml (root + packages/service each one).
  //   · Plus packages/snapshots section has ~150 lines of metadata for removed packages, weak signal leaks
  //     "private version has a rich-text editor".
  // Fix: two choices (patch importers section anchors / recalculate here). Chose recalculate:
  //   ① Anchor patch can only fix importers, can't remove 150 lines in packages/snapshots; recalc fixes both.
  //   ② Hand-written lockfile anchors become useless after one dep upgrade, can't "block manual smuggling" —
  //      forbidden.mjs switched to "shape rules" for pnpm-lock.yaml instead of exact anchors, same reasoning.
  // --lockfile-only: only calculate dep graph, don't write node_modules. --no-frozen-lockfile explicitly set,
  // otherwise pnpm will refuse updates when run in CI because default frozen (the default we're fixing).
  // Always throw on failure: if lockfile can't be calculated, don't release; never silently write drifted lockfile to disk.
  log('4.5/6 Recalculate lockfile (package.json dependencies already modified by manifest)')
  try {
    execFileSync('pnpm', ['install', '--lockfile-only', '--no-frozen-lockfile',
                          '--prefer-offline', '--ignore-scripts'],
      { cwd: tmp, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, CI: '' } })
  } catch (e) {
    throw new Error(
      'pnpm install --lockfile-only failed; output tree lockfile will be inconsistent with package.json.\n' +
      `pnpm output:\n${(e.stdout || '') + (e.stderr || '')}`,
    )
  }

  // ── 5. Leak guard (runs on temp directory; if it hits, nothing reaches disk) ────
  // scanTree leaves a marker word: '__skipped__' for each skip (no content scan performed) (see
  // scanTree comment in forbidden.mjs). Skips fall into two categories, handled differently:
  //   · Expected (binary / symlink) — legitimate binary resources (icons etc.) exist long-term in this tree,
  //     doesn't count as leak, can't leave guard permanently silent, but must print+log, never silently drop
  //     ("never silent" rule).
  //   · Unexpected (read failure / stat failure / directory read failure / exceeds size limit) — these situations
  //     themselves are abnormal (text file that should be scanned can't be read, or size is unusually large),
  //     must make people stop and look, not same as "this is a PNG icon", so still fatal.
  // isExpectedSkip (imported from forbidden.mjs, T14/B2) precisely matches only SKIP_REASON_SYMLINK /
  // SKIP_REASON_BINARY (two fixed strings, no dynamic content); other skip reasons (size exceeded, various
  // failures, strings with err.message etc. dynamic content) all fall into "unexpected" branch. Classification
  // logic shares the same named constant with actual text written in scanTree (not each hardcoded separately
  // and manually synced) — forbidden.test.mjs has unit test locking down this function's classification,
  // tree.test.mjs with --skip-guard completely bypasses this logic, not covered.
  let skipReportLines = []
  if (SKIP_GUARD) {
    log('5/6 Leak guard — skipped with --skip-guard (development-only; no files scanned)')
    skipReportLines = ['(this export used --skip-guard; leak guard and skip list both not executed)']
  } else {
    log('5/6 Leak guard')
    const findings = scanTree(tmp)
    const skipped = findings.filter((f) => f.word === '__skipped__')
    const leaks = findings.filter((f) => f.word !== '__skipped__')
    const expectedSkips = skipped.filter((f) => isExpectedSkip(f.excerpt))
    const unexpectedSkips = skipped.filter((f) => !isExpectedSkip(f.excerpt))

    if (expectedSkips.length) {
      log(`  ⚠ ${expectedSkips.length} files not scanned (binary/symlink, expected, not counted as leak):`)
      for (const f of expectedSkips) {
        const line = `⚠ Not scanned: ${f.file} — ${f.excerpt}`
        log(`    ${line}`)
        skipReportLines.push(line)
      }
    }

    if (unexpectedSkips.length) {
      for (const f of unexpectedSkips) console.error(`  ✗ ${f.file} [${f.word}] ${f.excerpt}`)
      throw new Error(
        `Leak guard hit ${unexpectedSkips.length} unexpected skips (read failure/stat failure/size limit/directory read failure); ` +
        `nothing goes to disk. These files are themselves abnormal and need manual review — can't treat like "this is a binary icon".`,
      )
    }

    if (leaks.length) {
      for (const f of leaks.slice(0, 60)) console.error(`  ✗ ${f.file}:${f.line} [${f.word}] ${f.excerpt}`)
      throw new Error(`Leak guard hit ${leaks.length} locations; nothing goes to disk. ` +
        `Only two fixes: real leak → add to manifest; false positive → add **precise whitelist** to forbidden.mjs — forbidden to relax word list.`)
    }
    log(`  Zero real leaks (${expectedSkips.length} expected skips logged, see above and .export-report.txt)`)
  }

  // ── 6. Write to disk + zero-history commit ────────────────────────────
  log('6/6 Write to disk')
  // --out guard: if target directory exists and is non-empty but doesn't look like prior export output,
  // refuse to rsync --delete to empty it — prevents user accidentally pointing to a regular directory,
  // and having its contents silently wiped as soon as output is written.
  // "looks like prior export output" is judged by existence of .git or .export-report.txt; this way
  // repeated exports to the same output directory (idempotence requirement) aren't affected, only blocks
  // "this looks like something else."
  if (fs.existsSync(OUT)) {
    const outEntries = fs.readdirSync(OUT)
    if (outEntries.length > 0) {
      const looksLikePriorExport = outEntries.includes('.git') || outEntries.includes('.export-report.txt')
      if (!looksLikePriorExport) {
        throw new Error(
          `--out ${OUT} exists and is non-empty, but doesn't look like prior export output (has neither .git nor .export-report.txt).\n` +
          `Refuse to rsync --delete it — if you really want to use this directory, clear it yourself first.`,
        )
      }
    }
  }
  fs.mkdirSync(OUT, { recursive: true })
  // T15(e): --exclude node_modules — source extraction (git archive) naturally doesn't include node_modules;
  // if we don't exclude, --delete would wipe the `pnpm install`'ed node_modules in --out every time,
  // forcing reinstall after every export. **Deliberately don't exclude dist/** — opposite reason:
  // dist is build output, also not in source extraction range, letting it be wiped each time is right,
  // otherwise stale dist from a previous build (not matching current source) would be mistaken for
  // "this build's output" and run through checkpoint 5 (dist scan), making scan results not representative
  // of this change's reality.
  execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', 'node_modules', `${tmp}/`, `${OUT}/`])
  fs.writeFileSync(
    path.join(OUT, '.export-report.txt'),
    `NimoOS-New-UI HEAD: ${headNewUi} (shared package already inlined)\n` +
    `DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length}\n` +
    `Leak guard skip list (expected, binary/symlink):\n` +
    (skipReportLines.length ? skipReportLines.map((l) => `  ${l}`).join('\n') + '\n' : '  (none)\n') +
    `⚠️ This file contains private repo commit hash; it's in .gitignore and doesn't go into git.\n`,
  )
  if (!NO_COMMIT) {
    // Cross-task ordering dependency (explicit check new to this task, not in brief): .export-report.txt
    // only stays out of zero-history repo if it's excluded in output tree's .gitignore; otherwise
    // `git add -A` below would mistakenly commit it. That .gitignore line is a patch Task 7 adds;
    // before then it must trigger, can't silently drop it.
    const gitignorePath = path.join(OUT, '.gitignore')
    const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
    if (!gitignore.split('\n').some((l) => l.trim() === '.export-report.txt')) {
      throw new Error(
        '.export-report.txt will be mistakenly committed by git add -A: the output tree .gitignore does not have this line yet.\n' +
        'Task 7 .gitignore patch not landed; the report file would be mistakenly committed — land that patch first, or use --no-commit to skip the commit.', )
    }
    if (!fs.existsSync(path.join(OUT, '.git'))) git(OUT, 'init', '-b', 'main')
    execFileSync('git', ['-C', OUT, 'add', '-A'])
    const has = execFileSync('sh', ['-c', `git -C '${OUT}' rev-list --count HEAD 2>/dev/null || echo 0`],
      { encoding: 'utf8' }).trim() !== '0'
    execFileSync('git', ['-C', OUT, 'commit', ...(has ? ['--amend'] : []), '--no-edit',
      ...(has ? [] : ['-m', 'NimoOS Web UI'])], { stdio: 'pipe' })
    const n = git(OUT, 'rev-list', '--count', 'HEAD')
    if (n !== '1') throw new Error(`Zero-history broken: rev-list --count HEAD = ${n}, must be 1`)
  }
  log(`Complete → ${OUT}`)
} finally {
  if (KEEP_TEMP) log(`Temp directory kept: ${tmp}`)
  else fs.rmSync(tmp, { recursive: true, force: true })
}
} catch (err) {
  console.error(`[oss] Failed: ${err.message}`)
  process.exit(1)
}

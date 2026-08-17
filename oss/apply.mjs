import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/** Working tree must be clean. Allowlist is a long-term exception (the 3 design-export deletions). */
export function checkClean(repoDir, allowlist = []) {
  const out = execFileSync('git', ['-C', repoDir, 'status', '--porcelain'], { encoding: 'utf8' })
  const dirty = out.split('\n').filter(Boolean).filter((l) => !allowlist.some((re) => re.test(l)))
  if (dirty.length) {
    throw new Error(`${repoDir} working tree not clean; export aborted:\n${dirty.join('\n')}`)
  }
}

/**
 * Manifest path data is hand-written, can't trust it's naturally safe: after parsing
 * must stay within baseDir, otherwise typos like one extra `../` in relative depth would let
 * applyDelete/applyReplace actually delete/read files outside the target tree. Absolute paths always rejected
 * (manifest not allowed to bypass baseDir and point directly at system paths). Returns resolved absolute path;
 * caller uses it directly for subsequent I/O.
 */
function assertSafeRelPath(baseDir, rel, context) {
  if (path.isAbsolute(rel)) {
    throw new Error(`${context}: is absolute path ${JSON.stringify(rel)} — manifest paths must be relative; can't directly reference filesystem absolute paths`)
  }
  const base = path.resolve(baseDir)
  const abs = path.resolve(base, rel)
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error(
      `${context}: path out of bounds; ${JSON.stringify(rel)} resolves to ${abs}\n` +
      `not within ${base} — this path in manifest is wrong (wrong relative depth?); export script refuses to write outside target tree.`,
    )
  }
  return abs
}

export function applyDelete(root, paths) {
  for (const rel of paths) {
    const abs = assertSafeRelPath(root, rel, `DELETE ${rel}`)
    if (!fs.existsSync(abs)) {
      throw new Error(`DELETE manifest stale: ${rel} doesn't exist (deleted or renamed in private main; update manifest.mjs)`)
    }
    fs.rmSync(abs, { recursive: true, force: true })
  }
}

export function applyReplace(root, entries, ossDir) {
  for (const { path: rel, from, privateSha256 } of entries) {
    const abs = assertSafeRelPath(root, rel, `REPLACE target ${rel}`)
    const srcAbs = assertSafeRelPath(ossDir, from, `REPLACE source ${from}`)
    if (!fs.existsSync(abs)) throw new Error(`REPLACE target doesn't exist: ${rel}`)
    const actual = sha256(fs.readFileSync(abs, 'utf8'))
    if (actual !== privateSha256) {
      throw new Error(
        `Private repo's ${rel} changed (sha256 ${actual.slice(0, 12)}… ≠ pinned ${privateSha256.slice(0, 12)}…).\n` +
        `Review whether oss/files/${from} needs sync, then update privateSha256 in manifest.mjs to new value.\n` +
        `⚠️ Forbidden to delete hash pin to make script pass — that makes this path a silent failure again.`,
      )
    }
    if (!fs.existsSync(srcAbs)) {
      throw new Error(
        `REPLACE source file missing: oss/files/${from} (manifest entry path=${rel}, from=${from})\n` +
        `Add this file to oss/files/, or check if the from in this manifest entry is wrong.`,
      )
    }
    fs.copyFileSync(srcAbs, abs)
  }
}

export function applyPatch(root, entries) {
  for (const { path: rel, find, replace } of entries) {
    // T14(B3): when find is undefined/null (manifest entry field name mistyped, e.g. `finf:` or missing find),
    // used to fall straight into text.split(find) throwing native TypeError ("The \"searchString\" argument must be of type string") —
    // this diagnostic is completely inconsistent with "designed diagnostic text" style elsewhere in project; person mistyping
    // field name has to guess. Bundled into single "this is design intent, not failure" diagnostic, combined with existing empty-string check.
    if (typeof find !== 'string' || find === '') {
      throw new Error(`Anchor missing or not string: ${rel} (find=${JSON.stringify(find)}) — problem in this manifest entry: ` +
        `either field name misspelled (e.g. something other than find), or find is empty string — empty can't uniquely locate anything`)
    }
    const abs = assertSafeRelPath(root, rel, `PATCH ${rel}`)
    if (!fs.existsSync(abs)) throw new Error(`PATCH target doesn't exist: ${rel}`)
    const text = fs.readFileSync(abs, 'utf8')
    const hits = text.split(find).length - 1
    if (hits === 0) {
      throw new Error(
        `Anchor no match: ${rel}\nLooking for: ${JSON.stringify(find.slice(0, 120))}\n` +
        `This is design intent, not failure — check what those lines changed to on private side, update anchor in manifest.mjs.`,
      )
    }
    if (hits !== 1) {
      throw new Error(`Anchor matches ${hits} times in ${rel}, must be exactly 1 (otherwise replace causes damage): ${JSON.stringify(find.slice(0, 120))}`)
    }
    // Use function form of replace value, not string overload of text.replace(find, replace):
    // String.prototype.replace string overload interprets $&/$`/$'/$1 etc. as special patterns
    // (e.g., $& becomes "the matched text"). This project's replace is TS/Vue/CSS code snippets,
    // which may contain these sequences anytime (even if not today); once hit it's silent mis-replacement —
    // exactly the "silent failure" this project abhors. Function form's return value always written as-is
    // literal; no pattern interpretation.
    fs.writeFileSync(abs, text.replace(find, () => replace))
  }
}

// Global @keyframes uniqueness guard.
//
// Why this exists: `@keyframes` names are NOT scoped by CSS selectors — they
// live in one flat, page-wide namespace. Vue SFC `<style scoped>` blocks are
// the one exception, because the SFC compiler rewrites keyframe names with a
// per-component hash, so two `scoped` blocks can safely reuse the same
// literal name without colliding at runtime.
//
// This branch (2026-08-11 photos Vue2-parity reskin, final-review Critical#1)
// shipped exactly the collision this guard prevents: `photos.scss` and
// `photos-smartview.scss` both defined a *global*, non-scoped `@keyframes
// pulse` for a small breathing dot — completely unrelated to the
// pre-existing global `pulse` keyframes in `src/styles/theme.css` (a
// box-shadow glow used by `AiWidget.vue`'s orb). Because keyframe names
// ignore selector/file scoping, whichever declaration came last in document
// order silently won and hijacked the AI widget's orb animation. The fix
// renamed the parity-side keyframes to `photos-pulse`; this test makes sure
// nobody reintroduces a same-named, differently-defined `@keyframes` in any
// of the non-scoped sources that ship together on the same page.
//
// Scope collected:
//   (a) src/styles/*.css                        — global stylesheet(s)
//   (b) src/ai/styles/**/*.scss (if present)     — AI area's global styles
//   (c) src/photos/styles/vue2-parity/*.scss     — the Vue2-parity source of truth
//   (d) <style> blocks WITHOUT `scoped` in src/**/*.vue — scoped blocks are
//       exempt (SFC compiler hashes their keyframe names, see above)
//
// Tightened 2026-08-13 (plan-C task 1): this guard USED to tolerate
// duplicate names as long as their bodies were byte-for-byte identical
// (after whitespace normalization) — that carve-out existed solely because
// `photos.scss` internally `@import`ed `photos-smartview.scss`, so the
// merged output of `photos.scss` alone contained the `photos-pulse`
// keyframes twice, verbatim, as a side effect of that internal @import.
// That @import has now been deleted (see index.ts and the deletion-site
// comment in photos-smartview.scss) — `photos-pulse` is physically defined
// exactly once now, in photos.scss:203. With the only legitimate duplicate
// gone, there is no longer any known-benign case for a repeated
// `@keyframes` name, so this guard now treats ANY duplicate name as an
// offender, same-body or not — a same-body duplicate is redundant CSS at
// best and an early symptom of a copy-paste/re-import mistake at worst, and
// a different-body duplicate is the actual hijack scenario this guard
// exists to catch.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

interface KeyframeHit {
  name: string
  body: string
  file: string
}

// Extracts every `@keyframes <name> { ... }` block from `text`, brace-matching
// the body so nested `{ 0% { ... } 100% { ... } }` stops don't confuse it.
function extractKeyframes(text: string, file: string): KeyframeHit[] {
  const out: KeyframeHit[] = []
  const re = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let depth = 1
    let i = re.lastIndex
    const start = i
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      i++
    }
    out.push({ name: m[1], body: text.slice(start, i - 1), file })
    re.lastIndex = i
  }
  return out
}

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(full, exts))
    else if (exts.some((ext) => e.name.endsWith(ext))) out.push(full)
  }
  return out
}

function readRel(full: string): { rel: string; text: string } {
  return {
    rel: path.relative(SRC_DIR, full).split(path.sep).join('/'),
    text: fs.readFileSync(full, 'utf8'),
  }
}

// (a) global .css directly under src/styles/ (not recursive — matches "*.css").
const cssFiles = fs
  .readdirSync(path.join(SRC_DIR, 'styles'), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.css'))
  .map((e) => readRel(path.join(SRC_DIR, 'styles', e.name)))

// (b) src/ai/styles/**/*.scss, only if the dir exists.
const aiStylesFiles = listFiles(path.join(SRC_DIR, 'ai', 'styles'), ['.scss']).map(readRel)

// (c) the Vue2-parity source of truth.
const parityFiles = listFiles(path.join(SRC_DIR, 'photos', 'styles', 'vue2-parity'), ['.scss']).map(
  readRel,
)

// (d) <style> blocks WITHOUT `scoped` in every .vue file. Scoped blocks are
// exempt (see header comment) — the SFC compiler hashes their keyframe names.
function unscopedStyleBlocks(rel: string, src: string): string {
  const blocks: string[] = []
  const re = /<style([^>]*)>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const attrs = m[1]
    if (/\bscoped\b/.test(attrs)) continue
    blocks.push(m[2])
  }
  return blocks.join('\n')
}

const vueRaw = import.meta.glob('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const vueUnscopedFiles = Object.entries(vueRaw)
  .map(([p, text]) => ({
    rel: p.replace(/^\.\.\//, '').replace(/\\/g, '/'),
    text: unscopedStyleBlocks(p, text),
  }))
  .filter((f) => f.text.trim().length > 0)

const allSources: Array<{ rel: string; text: string }> = [
  ...cssFiles,
  ...aiStylesFiles,
  ...parityFiles,
  ...vueUnscopedFiles,
]

describe('global @keyframes name-uniqueness guard (prevents a recurrence of pulse hijacking theme.css)', () => {
  it('scanned at least the expected number of sources (the guard must not silently scan nothing)', () => {
    expect(cssFiles.length).toBeGreaterThan(0)
    expect(parityFiles.length).toBeGreaterThan(0)
  })

  it('@keyframes names are globally unique across non-scoped sources (any duplicate name counts as a collision / hijack risk)', () => {
    const byName = new Map<string, KeyframeHit[]>()
    for (const { rel, text } of allSources) {
      for (const hit of extractKeyframes(text, rel)) {
        const list = byName.get(hit.name) ?? []
        list.push(hit)
        byName.set(hit.name, list)
      }
    }

    // Tightened 2026-08-13 (plan-C task 1): no more same-body tolerance —
    // see header comment for why. Any name defined 2+ times across the
    // non-scoped sources is now an offender outright, regardless of body.
    const offenders: string[] = []
    for (const [name, hits] of byName) {
      if (hits.length < 2) continue
      offenders.push(
        `  @keyframes ${name} is defined more than once in the following files (a name must be globally unique; when the bodies differ, whichever loads last silently overrides the earlier one):\n` +
          hits.map((h) => `    - ${h.file}`).join('\n'),
      )
    }

    expect(
      offenders,
      `\nFound @keyframes name collisions (different files define different animations under the same name — this is exactly what this guard exists to prevent
Recurrence of Critical#1: parity's pulse once hijacked theme.css's global pulse / AiWidget's orb breathing animation this same way):\n${offenders.join(
        '\n',
      )}`,
    ).toEqual([])
  })
})

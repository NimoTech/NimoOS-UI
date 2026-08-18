// Convention guard (see CLAUDE.md / docs/THEMING.md §0): every visible color in New-UI must go through a theme token.
// Scans every .vue <style> block and .css file (except theme.css — that's where tokens are defined),
// and fails if it finds a bare color literal (#hex / rgb()/rgba()/hsl()) outside of var(--token, …).
//
// Allowed:  color: var(--fg)          / background: var(--card-bg, #fff)  (token drives the theme, fallback is fine)
// Allowed:  color: #fff /* theme-exception: icon overlaid on a thumbnail, skin-independent */  (comment on the value line or the line above)
// Fails:  color: #fff               (bare literal, not routed through a token)
//
// Registered exemption (owner's call 2026-08-11, see docs/superpowers/specs/2026-08-11-photos-vue2-parity-reskin-design.md §4):
// src/photos/styles/vue2-parity/*.scss is the pixel source of truth from the old Vue2 repo, with its own .photos-root-scoped token system,
// so the whole directory is exempt from this guard. The current scan surface (.vue style blocks + .css) doesn't include .scss anyway; if .scss is ever brought into scope,
// this directory's exclusion must be kept.
/// <reference types="node" />
// Explicitly reference node types here instead of adding "node" to tsconfig's types array.
// 🔴 [SP8-P6 T10 correction] The original comment's closing claim — "this only applies to this file" — **is wrong**: `/// <reference types="…" />`
// is a **program-level** directive — it pulls the whole `@types/node` package (including the `declare var process`
// / `NodeJS.Timeout` global declarations in `globals.d.ts`) into the entire compilation program, visible to **all** source files, not just this one.
// Proof (T10 two-way probe): create a new file that neither imports `node:` nor has the reference, containing only
// `export const b = process.platform` → `vue-tsc --noEmit` exits 0; adding to the same file
// `const wrong: number = 'string'` → TS2322 exit 2 ⇒ the earlier exit 0 wasn't a vacuous pass.
// Current scan: **7** files across the repo carry this directive (`/usr/bin/grep -rln 'reference types="node"' src`),
// so that "global pollution" was already happening anyway. Keeping this line is still the right call (this file genuinely needs node:fs,
// and doesn't depend on some other file's reference), but **stop citing "it only applies to this file" as the reason**.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const HEX = /#[0-9a-fA-F]{3,8}\b/
const FUNC = /\b(rgba?|hsla?)\s*\(/

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Recursively collect .css files. **Can't use import.meta.glob to read .css** — `?raw` is always an empty string for .css under vitest
// (CSS goes through the side-effect module pipeline) — the glob keys are there but every value is ''. This once left the .css half of this guard spinning in the void:
// keys present, content all empty, so any .css "passed". .vue's ?raw works fine, so that half still uses glob.
function listCss(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listCss(full))
    else if (e.name.endsWith('.css')) out.push(full)
  }
  return out
}

const cssFiles: Record<string, string> = Object.fromEntries(
  listCss(SRC_DIR).map((full) => [
    '../' + path.relative(SRC_DIR, full).split(path.sep).join('/'),
    fs.readFileSync(full, 'utf8'),
  ]),
)

// .vue still goes through Vite's raw-import (relative to this file = src/styles/, so ../** = src/**).
const files: Record<string, string> = {
  ...(import.meta.glob('../**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...cssFiles,
}

// Strip out the whole var(...) span (including nested fallbacks), so the token name and fallback literal inside it don't count toward the scan.
function stripVar(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s.startsWith('var(', i)) {
      let depth = 0
      let j = i + 3
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++
        else if (s[j] === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
      }
      i = j
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

// For .vue, only take the <style> blocks; for .css, take the whole file. Returns [absolute line number, line text][].
function styleLines(rel: string, src: string): Array<[number, string]> {
  const out: Array<[number, string]> = []
  if (rel.endsWith('.css')) {
    src.split('\n').forEach((l, i) => out.push([i + 1, l]))
    return out
  }
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const startLine = src.slice(0, m.index).split('\n').length
    m[1].split('\n').forEach((l, i) => out.push([startLine + i, l]))
  }
  return out
}

// Final review Minor 11: the `<style…>(.*?)</style>` pattern above is a **non-greedy** match — the moment someone writes a literal style opening tag
// in a JS comment (or a template attribute), extraction runs from that fake opening tag all the way to the real closing tag at the end of the file,
// swallowing the whole script + template as one style block. Two consequences: ① anyone who later writes a literal
// #hex in a comment in these files gets blocked by an incomprehensible error; ② `theme-exception` appearing in a script comment opens an exemption
// window (exempt=true until the next `;` or `}`), and every subsequent line inside that window is waved through unconditionally — the guard silently
// stops working on these files. This round's scan hit 4 files (ClusterActionDialog / PersonRelGraph / PersonPlacesTab /
// PhotosTrash) — they happened to be passing at the time (not a false pass), but both hazards were real.
// Fix: rewrite the comment so it doesn't form a tag (write it as prose, e.g. "style block"); this test pins that down.
describe('style-block extraction is not polluted by a fake opening tag in a comment (Minor 11)', () => {
  for (const [path, src] of Object.entries(files)) {
    const rel = path.replace(/^\.\.\//, '').replace(/\\/g, '/')
    if (!rel.endsWith('.vue')) continue
    it(`${rel} extracted style block doesn't contain <script / <template`, () => {
      const text = styleLines(rel, src).map(([, l]) => l).join('\n')
      expect(text, `${rel} — style-block extraction ran out of bounds; check for a literal style opening tag written in a comment/attribute`)
        .not.toMatch(/<script[\s>]|<template[\s>]/)
    })
  }
})

describe('color-token guard (§0 convention: colors always go through var(--token))', () => {
  for (const [path, src] of Object.entries(files)) {
    const rel = path.replace(/^\.\.\//, '').replace(/\\/g, '/')
    // Token-definition files: bare literals are their whole job. theme.sp9.css is the SP9 shard (spec §4.3), exempt for the same reason.
    if (rel === 'styles/theme.css' || rel === 'styles/theme.sp9.css') continue
    it(`${rel} has no bare color literals`, () => {
      const lines = styleLines(rel, src)
      const offenders: string[] = []
      // The theme-exception exemption covers "until the current declaration ends" (the next ; or }),
      // covering multi-line values (e.g. multi-layer radial-gradient backgrounds), and also supports the comment being on the line above the value.
      let exempt = false
      lines.forEach(([n, line]) => {
        if (line.includes('theme-exception')) exempt = true
        if (!exempt) {
          const bare = stripVar(line)
          if (HEX.test(bare) || FUNC.test(bare)) offenders.push(`  L${n}: ${line.trim()}`)
        }
        if (line.includes(';') || line.includes('}')) exempt = false
      })
      expect(
        offenders,
        `\n${rel} found bare color literals (change to var(--token) or add /* theme-exception: reason */):\n${offenders.join('\n')}`,
      ).toEqual([])
    })
  }
})

// A cheap guard (a sibling pitfall from review I1): color-scheme is not a color literal, so the color-token guard above
// can't catch it at all — but its effect is equivalent to pinning down a single theme: `color-scheme: dark` forces the browser to render
// that element's native controls (date/time/number/select/scrollbars, etc.) in dark colors, regardless of New-UI's
// data-theme. That's exactly how I1 slipped through (PlacesFilterMenu.vue once hardcoded `color-scheme: dark`).
// `color-scheme: light dark` (dual value, handing the choice back to the browser/system) is not covered here — it's allowed.
// theme.css's own :root / :root[data-theme="light"] pair is the correct use of this convention (the theme block itself
// is where colors are "assigned per theme as tokens"), so the whole file is exempt, same as color-token guard's existing exemption above.
describe('a single-value color-scheme must go through the theme-exception exemption (guards against an I1-style regression)', () => {
  const COLOR_SCHEME_RE = /color-scheme\s*:\s*([^;{}]+)/i
  for (const [path, src] of Object.entries(files)) {
    const rel = path.replace(/^\.\.\//, '').replace(/\\/g, '/')
    if (rel === 'styles/theme.css') continue
    it(`${rel} — single-value color-scheme (dark or light, not light dark) must carry a theme-exception comment`, () => {
      const lines = styleLines(rel, src)
      const offenders: string[] = []
      let exempt = false
      lines.forEach(([n, line]) => {
        if (line.includes('theme-exception')) exempt = true
        const m = COLOR_SCHEME_RE.exec(line)
        if (m) {
          const tokens = m[1].trim().split(/\s+/)
          const isSingleValue = tokens.length === 1 && (tokens[0] === 'dark' || tokens[0] === 'light')
          if (isSingleValue && !exempt) offenders.push(`  L${n}: ${line.trim()}`)
        }
        if (line.includes(';') || line.includes('}')) exempt = false
      })
      expect(
        offenders,
        `\n${rel} found an un-exempted single-value color-scheme (this pins a single theme's native control colors — either
delete this line and let it cascade from the root, or add /* theme-exception: reason */):\n${offenders.join('\n')}`,
      ).toEqual([])
    })
  }
})

// ── Comment-integrity guard (a real defect exposed by SP9-P8 acceptance testing on 2026-08-05: an entire rule swallowed by a comment) ──────
//
// Incident: the header blurb in `src/kvm/styles/kvm.css` wrote `os-*/category-*`,
// `--kvm-modal-*/--kvm-field-*/` — **the `*/` closed the block comment early**. The prose after it was then parsed as CSS,
// and CSS's error recovery eats everything up to the end of the next `{...}` block ⇒ the rule right after it,
// `.kvm-page { display:flex; height:100vh; position:relative; z-index:1 }`, **got dropped entirely**.
// The result: the KVM page only occupied the top half of the viewport with the background glow bleeding through — the owner spotted it immediately.
//
// **Why none of this repo's existing guards catch it**:
//   · `kvmStyles.test.ts`'s class-name allowlist / bare-color scan both regex the **source text** — the source text is entirely correct,
//     what's wrong is "after parsing, the rule is gone" — regex has zero power to detect that.
//   · This file's color scan has the same blind spot (and deliberately doesn't strip comments).
//   · `pnpm exec vue-tsc --noEmit` doesn't look at CSS; `pnpm build` won't fail just because one rule got dropped.
//   ⇒ this class of defect can only be caught by "looking at the rendered result" or "stripping comments per CSS rules and seeing what's left".
//
// Detection method (parser-independent, so it doesn't rely on jsdom's CSSOM): strip `/* … */` **non-greedily** per CSS semantics
// (the first `*/` closes it, matching the browser), then check whether any line starting with `*` leaked outside — that's exactly
// the " * explanatory text" continuation line from inside a block comment leaking outside the comment. `* { … }` universal selectors are an exception.
// SP16 Task 12: this guard's corpus previously covered only those 5 standalone `.css` files (the color scan already covered `.vue`,
// this half just hadn't caught up). The same defect can happen in any `.vue`'s `<style>` block, and all five gates would be equally blind to it —
// the "KVM page only took up half the screen" incident from SP9 was exactly this shape.
//
// **Cannot** just swap the loop source for `files`: the " * continuation line" inside JS block comments in a `.vue`'s `<script>` is extremely
// common, and would drown this check in false positives. Only scan `<style>` blocks.
const commentCorpus: Record<string, string> = { ...cssFiles }
for (const [rel, src] of Object.entries(files)) {
  if (!rel.endsWith('.vue')) continue
  const blocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  if (blocks.length) commentCorpus[rel] = blocks.join('\n')
}

describe('CSS comment integrity (guards against "a */ written inside a comment swallowing the rule after it")', () => {
  for (const [rel, src] of Object.entries(commentCorpus)) {
    it(`${rel} — block comments are not closed early by their own content`, () => {
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '')
      const leaked: string[] = []
      stripped.split('\n').forEach((line, i) => {
        const t = line.trim()
        // A genuine universal selector is allowed through: `*` is immediately followed by selector syntax characters (`{ , : . # [ > + ~`),
        // e.g. `* {` / `*,` / `*::-webkit-scrollbar` / `* > .x`.
        // Leaked prose, by contrast, has `*` followed by text/CJK characters/parentheses, e.g. " * the 23 tokens used …".
        if (t.startsWith('*') && !/^\*\s*[{,:.#[>+~]/.test(t)) leaked.push(`  L${i + 1}: ${t.slice(0, 100)}`)
        // SP16 Task 12 added a second shape: the check above only recognizes "a block comment's ` * continuation line` leaking outside",
        // i.e. the shape of a multi-line comment. When a **single-line** comment contains `*/`, the leaked residue doesn't start with `*`
        // (e.g. `/* tokens: --a-*/--b-* */` leaves `--b-* */` after stripping), and the check above is blind to it —
        // but it swallows the following rule just the same. Verified in a real browser: that rule vanishes entirely from cssRules,
        // leaving only the one after it. Whatever `*/` remains after a clean strip must be an orphaned closer with no opening,
        // which makes a cheap and accurate signal.
        else if (t.includes('*/')) leaked.push(`  L${i + 1}: ${t.slice(0, 100)}`)
      })
      expect(
        leaked,
        `\n${rel}: a block comment was closed early by a */ inside its own content — the rule after it gets swallowed by CSS error recovery.
Split the */ inside the comment (e.g. \`os-* / category-*\`, with spaces around the slash):\n${leaked.join('\n')}`,
      ).toEqual([])
    })
  }
})

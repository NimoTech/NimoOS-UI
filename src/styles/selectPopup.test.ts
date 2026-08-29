/// <reference types="node" />
// Repo-wide guard: the native <select> element's **popup list** must not end up unreadable —
// background and text collapsing to the same pale tone — because of an author-supplied background.
//
// Incident (2026-08-05 SP9-P8 acceptance testing, spotted by the owner at a glance): under the dark
// theme, every dropdown on the settings page became unreadable — background and text washed out to
// the same pale tone. The root cause **is not** a missing color-scheme — theme.css's root already has
// `color-scheme: dark`. The real cause is that
// `.set-select` sets its own `background: var(--chip-bg)`, and under the dark theme `--chip-bg` is
// **a semi-transparent, pale-toned linear-gradient**. **The moment an author assigns a background to
// a <select>, Chrome carries it over to the popup list**,
// and the `option` elements inside a popup list are bound by two hard constraints:
//   1. **native `option` elements do not render gradients** — supplying one is the same as supplying
//      nothing, and it falls back to the browser's default **pale background**;
//   2. **translucency then stacks on top of that default pale background** — stacking an 8%–26% pale
//      tint on top of it lands you back at essentially the same pale color.
// Both roads lead to "a light background plus a --fg that's nearly the same tone" = unreadable. And
// **an author-specified background takes priority over color-scheme**,
// so the root-level declaration cannot save it. The fix is to explicitly give `option` / `optgroup` a
// **solid** background and text color.
//
// ⚠️ The criterion is "the background is a gradient or translucent", not "whether there is a
//    background at all" —
//    a **solid, dark** background like `background: #2a2a2a` gets carried over to the popup list
//    as-is, rendering as a dark background with light text,
//    which is perfectly fine (KVM's `.cv-select-native` is exactly this case and needs no fix).
//    The first version of this guard, written on 2026-08-06, flagged "has a background" as the
//    criterion and called out those 4 spots too — that was a false positive.
//
// Why this guard is needed: none of the existing gates catch this class of problem —
//   · color-guard / each area's *Styles.test.ts only check "is there a bare color literal" —
//     anything routed through a token is waved through;
//   · vue-tsc does not look at CSS;
//   · vitest runs on jsdom, which does not do real cascade computation, let alone render a native
//     dropdown's popup list.
// When fixing the settings page, only 3 identical spots in the storage area were found at first
// (debt D49); running this guard is what turned up 7 more in the apps area —
// **this shape spreads by copy-paste, and manual grep cannot count them all.**
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// .css/.scss must be read with node:fs — `?raw` is always an empty string for stylesheets under
// vitest (color-guard has the same comment at the top, and that half of the guard once spun
// entirely in the void because of it). .vue's ?raw works fine, so it goes through glob.
function listStyles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listStyles(full))
    else if (/\.(css|scss)$/.test(e.name)) out.push(full)
  }
  return out
}

const vueFiles = import.meta.glob('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Strip comments per CSS semantics (non-greedy, the first */ closes it, matching the browser) —
// otherwise an example selector inside a comment would be treated as a rule.
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

const styleFiles = listStyles(SRC_DIR)

// Repo-wide CSS corpus = every .css/.scss + every .vue's <style> block.
// Cross-file matching is necessary: `.set-select`'s background is written in settings.css, while
// the element itself lives in GeneralPanel.vue's template, so looking at a single file alone would
// never line them up.
const CSS_CORPUS =
  styleFiles.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n') +
  '\n' +
  Object.values(vueFiles)
    .flatMap((src) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]))
    .map(stripComments)
    .join('\n')

const RULES = CSS_CORPUS.match(/[^{}]+\{[^{}]*\}/g) ?? []
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const selectorOf = (rule: string) => rule.slice(0, rule.indexOf('{'))
const bodyOf = (rule: string) => rule.slice(rule.indexOf('{'))

/**
 * Repo-wide token-definition table: token name → [{ value, theme scope }].
 *
 * ⚠️ Must carry a scope, otherwise expanding `var()` bleeds across themes — this has actually
 * bitten us: one area wrote `--bg-elevated: var(--card-bg)` **only inside the
 * `:root[data-theme="light"] …` block**, where `--card-bg` is a paper tone; without scoping,
 * the **dark theme**'s `--card-bg` (a gradient) would get pulled in too,
 * and two otherwise-fine dropdowns would be misreported as defects.
 * (This file's comments deliberately avoid naming specific areas — the open-source export's leak
 * guard scans source by a word list, and naming those area names would get this blocked.)
 */
type Scope = 'light' | 'dark' | 'base'
const scopeOf = (selector: string): Scope =>
  /data-theme=['"]?light/.test(selector) ? 'light' : /data-theme=['"]?dark/.test(selector) ? 'dark' : 'base'

const TOKEN_DEFS = new Map<string, { value: string; scope: Scope }[]>()
for (const rule of RULES) {
  const scope = scopeOf(selectorOf(rule))
  for (const m of bodyOf(rule).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const list = TOKEN_DEFS.get(m[1]) ?? []
    list.push({ value: m[2].trim(), scope })
    TOKEN_DEFS.set(m[1], list)
  }
}

/** Resolve a background value into the "candidate values that actually land on the popup list" (expand var() layer by layer, once per theme block). */
function resolve(value: string, scope: Scope = 'base', depth = 0): string[] {
  const token = value.match(/^var\((--[a-z0-9-]+)/)
  if (!token || depth > 4) return [value]
  const all = TOKEN_DEFS.get(token[1])
  if (!all?.length) return [value]
  // Same scope takes priority; only fall back to base when the same scope has no definition (theme.css's :root is base).
  const sameScope = all.filter((d) => d.scope === scope)
  const picked = sameScope.length ? sameScope : scope === 'base' ? all : all.filter((d) => d.scope === 'base')
  return (picked.length ? picked : all).flatMap((d) => resolve(d.value, d.scope, depth + 1))
}

const HAS_ALPHA = /rgba?\([^)]*,\s*(0?\.\d+|0)\s*\)|hsla?\([^)]*,\s*(0?\.\d+|0)\s*\)/
/** Gradient = option does not render it at all (falls back to the default pale background); translucent = stacks on top of that pale background. Either way it collapses to an unreadable pale-on-pale result. */
const isRisky = (v: string) => /gradient|\btransparent\b/.test(v) || HAS_ALPHA.test(v)

/** Whether the author-specified background on this class, once expanded, resolves to a "gradient / translucent" value. */
function riskyBackground(cls: string): string | null {
  const hit = new RegExp(`\\.${esc(cls)}(?![\\w-])`)
  for (const rule of RULES) {
    if (!hit.test(selectorOf(rule))) continue
    const scope = scopeOf(selectorOf(rule))
    for (const decl of bodyOf(rule).matchAll(/\bbackground(?:-color)?\s*:\s*([^;}]+)/g)) {
      const bad = resolve(decl[1].trim(), scope).find(isRisky)
      if (bad) return bad
    }
  }
  return null
}

/** Whether the corpus assigns a background color to `.cls`'s option (`.cls option { background-color: … }`). */
const hasOptionBackground = (cls: string) =>
  RULES.some(
    (r) =>
      new RegExp(`\\.${esc(cls)}(?![\\w-])\\s+option(?![\\w-])`).test(selectorOf(r)) &&
      /background-color\s*:/.test(bodyOf(r)),
  )

const hasOptgroup = (cls: string) =>
  RULES.some((r) => new RegExp(`\\.${esc(cls)}(?![\\w-])\\s+optgroup(?![\\w-])`).test(selectorOf(r)))

/** Every <select> in every .vue template, along with its static class list. */
const selects: { file: string; classes: string[] }[] = []
for (const [file, src] of Object.entries(vueFiles)) {
  const styleAt = src.indexOf('<style')
  const template = styleAt === -1 ? src : src.slice(0, styleAt)
  // Attribute values can contain a `>` (e.g. `v-if="a.length > 1"`), which would truncate
  // /<select\b[^>]*>/; matching must be quote-aware and skip `>` inside quotes to extract the tag
  // correctly (an element in console-svc was missed for a whole release cycle because of this).
  for (const m of template.matchAll(/<select\b(?:"[^"]*"|'[^']*'|[^>])*>/g)) {
    const cls = m[0].match(/\sclass="([^"]*)"/)
    // Known boundary (not silent): only static classes are considered. An element with
    // `<select :class="…">` and no static class counts as classes: [] and is skipped — no such
    // usage exists anywhere in the repo today; if one shows up, dynamic-class handling needs to
    // be added here.
    const classes = (cls?.[1] ?? '').split(/\s+/).filter(Boolean).filter((c) => !c.includes('{'))
    selects.push({ file, classes })
  }
}

describe('native <select> popup-list readability (2026-08-05 P8: dark theme collapsing to unreadable pale-on-pale)', () => {
  it('the whole repo scans at least 10 <select> elements (guards against the check spinning on nothing)', () => {
    // A parameterized guard must prove it is not an empty loop — if templates are ever rewritten
    // to use custom dropdowns and this count drops, this reminds you to re-evaluate whether this
    // file still has coverage, instead of letting it silently stay passing.
    expect(selects.length).toBeGreaterThanOrEqual(10)
  })

  it('a <select> whose author background is a gradient or translucent must explicitly pin option to a solid background', () => {
    const bad: string[] = []
    for (const { file, classes } of selects) {
      if (!classes.length) continue
      // The criterion applies to "any class on the element" — the background may come from a
      // different class: e.g. <select class="cs-input cs-select">, where the background is on
      // .cs-input and .cs-select only adds appearance:auto. Looking only at the select-specific
      // class would miss it.
      const risky = classes.map((c) => [c, riskyBackground(c)] as const).find(([, v]) => v)
      if (!risky) continue
      if (!classes.some(hasOptionBackground)) {
        bad.push(`  ${file}  class="${classes.join(' ')}"  ← .${risky[0]} background = ${risky[1]}`)
      }
    }
    expect(
      bad,
      'Chrome carries the author background over to the popup list: a gradient does not render at all (it falls back to the default pale background), and translucency then stacks on top of that pale background,\n' +
        'either way you land on a light background with equally light text, which is unreadable. Fix: add to one of the classes\n' +
        '  option, optgroup { background-color: var(--set-option-bg); color: var(--set-option-fg); }\n' +
        bad.join('\n'),
    ).toEqual([])
  })

  it('anywhere option gets a background color, optgroup must be covered too', () => {
    const bad: string[] = []
    for (const { file, classes } of selects) {
      const withOption = classes.filter(hasOptionBackground)
      if (!withOption.length) continue
      if (!withOption.some(hasOptgroup)) bad.push(`  ${file}  class="${classes.join(' ')}"`)
    }
    expect(bad, 'A group heading (optgroup) does not inherit the background color from option, and will still collapse to pale-on-pale:\n' + bad.join('\n')).toEqual([])
  })

  it('the background-color token used by option has a value in both themes, and both are solid colors', () => {
    const themeSrc = styleFiles
      .filter((f) => /theme[.\w-]*\.css$/.test(f))
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n')
    const tokens = new Set<string>()
    for (const rule of RULES) {
      if (!/\soption(?![\w-])/.test(selectorOf(rule))) continue
      const t = bodyOf(rule).match(/background-color:\s*var\((--[a-z0-9-]+)\)/)
      if (t) tokens.add(t[1])
    }
    expect(tokens.size, 'no option rule specifies a background color via a token — this assertion would be vacuous').toBeGreaterThan(0)
    for (const token of tokens) {
      const defs = [...themeSrc.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
      expect(defs.length, `${token} must have a value in both :root and :root[data-theme='light']`).toBe(2)
      for (const v of defs) {
        expect(v, `${token} = ${v} — option does not render gradients, and translucency lets the pale background show through, so it must be a solid color`).not.toMatch(
          /gradient|\btransparent\b/,
        )
        expect(v, `${token} = ${v} — translucency stacks on top of the popup list's default pale background`).not.toMatch(HAS_ALPHA)
      }
    }
  })
})

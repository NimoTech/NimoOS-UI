import { describe, it, expect } from 'vitest'
// SP8-P5c Task 2b — `parser-styles.scss` dedicated guard (governance §6.4-5, plugging guard gaps ②⑤).
//
// [Why we must create this file] `parser-styles.scss` was **completely unprotected** before this batch:
//   Gap ② `src/styles/color-guard.test.ts` only globs `../**/*.vue` and `../**/*.css`, **does not scan `.scss`**
//          (already proven with RED probe in P3a) → bare color literals cannot enter its view;
//   Gap ⑤ `knowledgeStyles.test.ts` only reads `./knowledge.scss` as a single source file → cannot cover this file.
// So this file takes on 4 hard constraints as regression guards ((a)(b)(c)(d), see the four describe blocks below)
// + 1 whitelist/element-selector set equality (PARSER_WHITELIST_70 from Appendix D §D.0 / §D.2 and 9 element selector registry).
//
// Environmental pitfalls are copied verbatim from `knowledgeStyles.test.ts` header comment,
// recording three existing solutions (not stepping on new traps):
// ① This repo's package.json is "type": "module" → __dirname is unavailable in ESM, use
//    import.meta.url + fileURLToPath instead (precedent: P5b T11).
// ② Type declarations for node:fs / node:path / node:url come from `@types/node`. Already installed in this repo
//    (brought in with SP8-P6 merge from master), `pnpm exec vue-tsc --noEmit` (one of the three command gates)
//    passes directly, **does not need** @ts-expect-error suppression — the few suppression lines
//    that existed on sp8-ai branch were deleted during merge.
// ③ 🔴 **Do not use Vite's `?raw` import to replace node:fs** — vitest's built-in CSSEnablerPlugin
//    replaces all css/scss with an empty string (ignoring the query string), and `?raw` import
//    would cause every assertion below to "falsely pass" on **empty string** (`expect('').not.toMatch(...)` is always true,
//    `expect([]).toEqual([...])` would be red but not truly testing the source file).
//    Fall back to node:fs to read the source file directly.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rawSource: string = readFileSync(resolve(__dirname, './parser-styles.scss'), 'utf8')

// Strip comments — same established technique as knowledgeStyles.test.ts / settingsStyles.test.ts: block + line comments.
// Only for "selector/property structure" assertions (prevent comment-mentioned selector names from colliding);
// 🔴 Color scan (assertion a) **must run on unstripped rawSource** — governance §6 / R5 requires
// no color literals even in comments; stripping comments before scanning would exempt that half
// (already proven with RED probe on 2026-07-31 review of knowledgeStyles.test.ts:
// "comment with bare color 8/8 all pass" hole).
function stripComments(scss: string): string {
  return scss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}
const css = stripComments(rawSource)

// Same as above, but replace comment content with **equivalent spaces** and preserve newlines → line numbers align with source.
// For assertions that need to "report true line numbers in failure messages" (`stripComments` would eat newlines
// in multi-line comments, making line numbers from it smaller than the source, which would mislead reviews
// to the wrong line — that itself is a distortion).
function blankComments(scss: string): string {
  return scss
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (_m: string, indent: string) => indent)
}
const cssKeepLines = blankComments(rawSource)

// Three selectors allowed to appear at column 0 (governance §6.1 landing constraint 2 + §6.4-5 criterion b, **after K31 correction**).
// `.parser-app` carries only K22's three structural properties; the two page sections each have their own scope per K23, same-name classes not merged.
//
// 🔴 [K31, coordinator decision 2026-08-03 — these three constants themselves constitute a drift-prevention assertion]
// The two page sections are **descendant** selectors `.parser-app .parser-status-page`, **not** compound
// selectors `.parser-app.parser-status-page`: `.parser-app` is the **outer wrapper element** (K22's scroll container),
// page root class on the **inner element**, template is `<div class="parser-app"><div class="parser-status-page">…</div></div>`.
// If squeezed into one element, it must be both blueprint's `max-width: 900px; margin: 0 auto` and K22's `overflow-y: auto`
// → scrollbar lands at the right edge of the 900px centered column (middle of viewport on wide screens),
// but Vue2 scrolls the entire page with scrollbar at the viewport's right edge,
// **user-visible interface is not 1:1**. K22 cites two precedents (`.area-shell`+`.area-body`, `.knowledge-app`+`.k-scroll`)
// that were already two elements. → Whoever changes scss back to compound form, assertions (b) and (d) below
// will simultaneously report red precisely (already tested with RED probe).
const ROOT_SELECTOR = '.parser-app'
const SCOPE_STATUS = '.parser-app .parser-status-page'
const SCOPE_TEST = '.parser-app .parser-test-page'
const TOP_LEVEL_SELECTORS = [ROOT_SELECTOR, SCOPE_STATUS, SCOPE_TEST]

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Extract entire block of text from "selector { on its own line (zero indent) to its paired }".
// 🔴 Start criterion uses `^…$` (multiline mode) **line-start/line-end anchoring**, not substring search —
// learned from I-2 incident in knowledgeStyles.test.ts: `indexOf` would collide with the exact same selector string
// quoted in comments (this file's header comment literally contains `.parser-app .parser-status-page`).
// Strip comments first, then anchor at line start — double insurance.
// End position uses **brace balancing** (this file's two page sections have nested rules inside;
// knowledgeStyles' simplified "next `\n}`" approach would cut incorrectly here).
function blockOf(text: string, selector: string): string {
  const anchored = new RegExp(`^${escapeForRegExp(selector)} \\{$`, 'm')
  const m = anchored.exec(text)
  expect(m, `cannot find top-level rule \`${selector} {\` (line-start/end anchor, excluded same-name references in comments)`).not.toBeNull()
  const start = m!.index
  const open = text.indexOf('{', start)
  let depth = 0
  let i = open
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  expect(depth, `\`${selector}\` braces not balanced`).toBe(0)
  return text.slice(start, i)
}

// Extract all "rule heads" from scss (the selector part of `selector {`).
// Regex criterion: text from the previous `{` / `}` / `;` / line-start to the next `{`,
// excluding `(` and `)` — excluding `(` prevents values like `grid-template-columns: repeat(2, 1fr)`
// from being mistaken for selectors; `;` as a separator correctly splits "multiple declarations on one line + nested rule at end"
// (this file has a lot of this formatting, 1:1 following blueprint).
// After each match, set lastIndex back to that `{` because it is also the leading separator for the next rule.
function ruleHeads(scss: string): string[] {
  const out: string[] = []
  const re = /(?:^|[{};])([^{};()]*)\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(scss))) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    if (sel) out.push(sel)
    re.lastIndex = m.index + m[0].length - 1
  }
  return out
}

// ---------------------------------------------------------------------------
// (a) Zero color literals throughout (including comments)
// ---------------------------------------------------------------------------
// Regex criterion = `color-guard.test.ts`'s two HEX/FUNC + modern CSS color functions + **complete CSS named color list**
// (T2a review method ② used 100 complete named-color list for manual scanning; here we solidify it into
// a resident assertion and expand to 148 per CSS Color 4 named-color list — strict superset of those 100).
// `transparent` **does not count** as a color literal (P5a T11 set criterion: it is a keyword, not
// "a color hardcoded"), so not in the list; this file tests zero instances of `transparent`.
// 🔴 Named colors use **case-sensitive** matching: CSS keywords are always lowercase, and case-insensitive matching
// would flag Chinese words like "RED probe" as the named color red (T2a review method ② got 2 false positives,
// handled by manual exclusion; resident assertions cannot rely on manual exclusion, so use lowercase criterion —
// same as knowledgeStyles.test.ts:370-377).
// 🔴 Both sides use `(?<![\w-])` / `(?![\w-])` negative lookahead: JS `\b` holds equally at letter↔hyphen boundary,
// `/\bwhite\b/` would collide with perfectly legal `white-space: nowrap` (this file has 4 instances of `white-space`).
const CSS_NAMED_COLORS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white',
  'whitesmoke', 'yellow', 'yellowgreen',
]

describe('parser-styles.scss — (a) Zero color literals throughout (including comments) (Gap ②: color-guard does not scan .scss)', () => {
  it('Zero #hex', () => {
    expect(rawSource, 'contains #hex color literal').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('Zero functional color values (rgb/rgba/hsl/hsla/lab/lch/oklab/oklch/hwb/color()/color-mix())', () => {
    expect(rawSource, 'contains rgb()/rgba()').not.toMatch(/\brgba?\s*\(/)
    expect(rawSource, 'contains hsl()/hsla()').not.toMatch(/\bhsla?\s*\(/)
    expect(rawSource, 'contains lab()').not.toMatch(/\blab\s*\(/)
    expect(rawSource, 'contains lch()').not.toMatch(/\blch\s*\(/)
    expect(rawSource, 'contains oklab()').not.toMatch(/\boklab\s*\(/)
    expect(rawSource, 'contains oklch()').not.toMatch(/\boklch\s*\(/)
    expect(rawSource, 'contains hwb()').not.toMatch(/\bhwb\s*\(/)
    expect(rawSource, 'contains color()').not.toMatch(/\bcolor\s*\(/)
    expect(rawSource, 'contains color-mix()').not.toMatch(/\bcolor-mix\s*\(/)
    expect(rawSource, 'contains device-cmyk()').not.toMatch(/\bdevice-cmyk\s*\(/)
  })

  it(`Zero CSS named colors (${CSS_NAMED_COLORS.length} complete list, including white/black; transparent does not count)`, () => {
    const offenders: string[] = []
    rawSource.split('\n').forEach((line, i) => {
      for (const name of CSS_NAMED_COLORS) {
        if (new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(line)) {
          offenders.push(`  L${i + 1} [${name}]: ${line.trim()}`)
        }
      }
    })
    expect(offenders, `contains CSS named colors (change to var(--token)):\n${offenders.join('\n')}`).toEqual([])
  })

  it('Zero theme-exception escape (governance §6: disabled this period)', () => {
    expect(rawSource, 'contains theme-exception escape').not.toContain('theme-exception')
  })

  it('Zero residual dummy token dead references (Appendix B §B.9 self-check ⑦: no var(--ns-color-*, …) shell allowed)', () => {
    expect(rawSource, 'left over dummy token name from Vue2 unused throughout repo').not.toContain('ns-color')
  })
})

// ---------------------------------------------------------------------------
// (b) Zero top-level bare selectors
// ---------------------------------------------------------------------------
// Criterion (governance §6.4-5 original): **selectors starting at column 0 may only be those three**.
// The 60+ bare class names in the blueprint (`.card` `.row` `.hint` `.error` `.empty` …) and 9 element selectors
// are isolated by `scoped` in Vue2, must be explicitly scoped when moved to New-UI's global scss (K9),
// otherwise they leak across the entire site — especially `.card` conflicts with `.agent-app .card`
// at `agent-styles.scss:529`, and element selectors like `h2`/`li`/`input` at the top level affect the entire site.
describe('parser-styles.scss — (b) Zero top-level bare selectors (K9; column 0 allows only those three)', () => {
  // Only look at "lines where column 0 is non-whitespace, not `}`, not `/`":
  //   - `}` is block end, not a selector;
  //   - `/` can only be block comment start `/*` (continuation lines in this file are always indented as ` * `,
  //     ending with ` */`, so continuation gets filtered by "starts with whitespace",
  //     **not** by allowing `*` — this way if someone actually writes a universal selector
  //     `* { … }` at top level, it will still be caught by the assertion below).
  const topLevelLines: Array<[number, string]> = rawSource
    .split('\n')
    .map((l, i): [number, string] => [i + 1, l])
    .filter(([, l]) => l.trim() !== '' && !/^[\s}/]/.test(l))

  it('Rule heads at column 0 are exactly those three selectors (order and count locked)', () => {
    const heads = topLevelLines.map(([, l]) => l.replace(/\s*\{\s*$/, '').trim())
    expect(heads, `unexpected selectors at column 0:\n${topLevelLines.map(([n, l]) => `  L${n}: ${l}`).join('\n')}`).toEqual(
      TOP_LEVEL_SELECTORS,
    )
  })

  it('Each line at column 0 is a complete single-line form "selector + space + {" (declBlockRange anchor depends on it)', () => {
    for (const [n, line] of topLevelLines) {
      expect(line, `L${n} top-level rule head is not single-line \`selector {\` form: ${line}`).toMatch(/^\S.*\S \{$/)
    }
  })
})

// ---------------------------------------------------------------------------
// (c) `.parser-app` block zero color properties + **whole file** zero `--x:` declarations
// ---------------------------------------------------------------------------
// Plug governance §6.1 landing constraint 1: token declaration layer entirely in `knowledge.scss`
// (K21 has expanded the selector of those two blocks by adding `.parser-app` as comma item each),
// `.parser-app` scope root **only** handles K22's three structural properties.
// Once someone adds a token declaration here, it becomes a source of drift:
// "same token declared in two places"; once someone writes color properties here,
// it bypasses each page's own scope and affects both pages simultaneously.
//
// 🔴 [Governance §6.4.3, residual gap found by T2b review "gap hunt" testing, decision 2026-08-03 to close this period]
// The original version **entirely** only scanned inside `.parser-app` block (governance §6.4-5(c) exact text).
// Review probe G wrote `--sneaky-token: …` into **page scope** (`.parser-app .parser-status-page`)
// → **18/18 all pass, escapes all guards**: (a) only scans color literals, (b) only checks column 0,
// (d) only counts `.card`/`.page-header`, (e) only checks class and element names — none sees
// "a new token declaration added".
// But **K21's semantics is "`parser-styles.scss` zero token declarations", not "only `.parser-app` block zero token declarations"**
// → decision: **`--x:` half expands scanning range to whole file** (expand range = larger scan, not relaxed assertion).
// 🔴 **Color properties half still only targets `.parser-app` block** — the two page scopes of course need
// to write color properties, cannot expand together.
const COLOR_PROPERTIES = [
  'color',
  'background',
  'background-color',
  'background-image',
  'border',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline',
  'outline-color',
  'box-shadow',
  'text-shadow',
  'text-decoration-color',
  'caret-color',
  'column-rule-color',
  'accent-color',
  'fill',
  'stroke',
  'color-scheme',
]

describe('parser-styles.scss — (c) .parser-app block carries only K22 three lines + whole file zero token declarations', () => {
  // 🔴 `blockOf` contains `expect`, must be called inside `it` — if in describe body will throw
  // during **collection phase**, error lands at file level not on some test case, failure message becomes distorted
  // (P5a same-family lesson: guards must name exactly).
  const rootBody = () => blockOf(css, ROOT_SELECTOR)

  it('Declarations are exactly three: height / height / overflow-y (K22, not one more not one less)', () => {
    const body = rootBody()
    const props = [...body.matchAll(/^\s*(--[\w-]+|[a-zA-Z-]+)\s*:/gm)].map((m) => m[1])
    expect(props, `.parser-app block declaration list changed:\n${body}`).toEqual(['height', 'height', 'overflow-y'])
  })

  // 🔴 Governance §6.4.3: range = **whole file** (after stripping comments), not just `.parser-app` block — see section header.
  // Criterion given by line, failure message must specify line number (per §9 "guards must name exactly").
  // Note: **references** like `var(--accent)` / `var(--accent-soft)` won't be mistaken: after `--x` comes `)` or `,`,
  // not `:` — only true **declarations** (`--x: value`) match.
  it('🔴 Whole file zero `--x:` token declarations (K21: token declaration layer only in knowledge.scss)', () => {
    const offenders: string[] = []
    cssKeepLines.split('\n').forEach((line, i) => {
      const m = line.match(/--[\w-]+\s*:/)
      if (m) offenders.push(`  L${i + 1} [${m[0]}]: ${line.trim()}`)
    })
    expect(
      offenders,
      `parser-styles.scss contains token declarations (token declaration layer only in knowledge.scss's two blocks):\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('`.parser-app` block zero `--x:` (subset of whole-file check, kept separate for easier location)', () => {
    const body = rootBody()
    expect(body, `.parser-app block contains token declarations:\n${body}`).not.toMatch(/--[\w-]+\s*:/)
  })

  it('Zero color properties', () => {
    const body = rootBody()
    const offenders: string[] = []
    for (const prop of COLOR_PROPERTIES) {
      if (new RegExp(`(?:^|[;{\\s])${escapeForRegExp(prop)}\\s*:`).test(body)) offenders.push(prop)
    }
    expect(offenders, `.parser-app block contains color properties: ${offenders.join(', ')}`).toEqual([])
  })

  it('Zero nested rules (not a page section, all in-page rules belong to the two page scopes)', () => {
    const body = rootBody()
    expect(body.slice(body.indexOf('{') + 1), '.parser-app block contains nested rules').not.toContain('{')
  })
})

// ---------------------------------------------------------------------------
// (d) Both page scopes exist, and `.card` / `.page-header` each have a copy in both scopes
// ---------------------------------------------------------------------------
// Plug K23 (prevent "casually merging same-name classes into one shared segment").
// C-2 testing in Appendix B §B.1: of the two blueprints, only `.card` / `.page-header` / `.page-header h2`
// have identical complete paths (declarations identical verbatim); other same-name classes
// (`.row` / `h3` / `li` / `.hint` / `.empty` / `.toggle`) differ in parent card or declarations —
// merging = interface not 1:1. The 3 "identical verbatim" ones also keep one copy each per K23
// (wherever it is, move it there).
describe('parser-styles.scss — (d) K23: both page scopes are separate segments, same-name classes not merged', () => {
  // Same as (c): `blockOf` contains `expect`, always evaluated inside `it`.
  const scopeBody = (scope: string) => blockOf(css, scope)

  it('Both scopes exist and each carries blueprint page shell declarations (padding / max-width / margin)', () => {
    for (const scope of [SCOPE_STATUS, SCOPE_TEST]) {
      expect(scopeBody(scope), `${scope} missing padding`).toMatch(/^\s*padding: 16px;$/m)
      expect(scopeBody(scope), `${scope} missing max-width`).toMatch(/^\s*max-width: 900px;$/m)
      expect(scopeBody(scope), `${scope} missing margin`).toMatch(/^\s*margin: 0 auto;$/m)
    }
  })

  it('`.card` has exactly one copy in each scope', () => {
    for (const scope of [SCOPE_STATUS, SCOPE_TEST]) {
      const hits = scopeBody(scope).match(/^[ \t]+\.card\s*\{/gm) || []
      expect(hits.length, `\`.card {\` rule under ${scope} should be exactly 1, found ${hits.length}`).toBe(1)
    }
  })

  it('`.page-header` (with nested `h2`) has exactly one copy in each scope', () => {
    for (const scope of [SCOPE_STATUS, SCOPE_TEST]) {
      const hits = scopeBody(scope).match(/^[ \t]+\.page-header\s*\{/gm) || []
      expect(hits.length, `\`.page-header {\` rule under ${scope} should be exactly 1, found ${hits.length}`).toBe(1)
      expect(scopeBody(scope), `${scope}'s .page-header missing nested h2`).toMatch(/\.page-header \{[\s\S]*?\bh2 \{/)
    }
  })

  it('Each scope holds its own page-specific classes, not merged', () => {
    // Status page exclusive (blueprint parser-styles.scss) / Test page exclusive (blueprint ParserTest.vue inline style)
    for (const only of ['.control-card', '.queue-card', '.folders-card', '.failures-card', '.refresh-btn']) {
      expect(scopeBody(SCOPE_STATUS), `${SCOPE_STATUS} missing ${only}`).toContain(`${only} `)
      expect(scopeBody(SCOPE_TEST), `${SCOPE_TEST} should not have ${only}`).not.toContain(`${only} `)
    }
    for (const only of ['.upload-card', '.docling-card', '.scored-card', '.chunks-card', '.back-link']) {
      expect(scopeBody(SCOPE_TEST), `${SCOPE_TEST} missing ${only}`).toContain(`${only} `)
      expect(scopeBody(SCOPE_STATUS), `${SCOPE_STATUS} should not have ${only}`).not.toContain(`${only} `)
    }
  })
})

// ---------------------------------------------------------------------------
// (e) Class whitelist and element selector registry (Appendix D §D.0 / §D.2)
// ---------------------------------------------------------------------------
// Appendix D §D.2: ParserStatus (31 classes) + ParserTest (44 classes) deduped = **70**,
// T0 bidirectional diff: "70/70 all defined in blueprint scss; scss has no class unused by template".
// This assertion is **set equality**, guarding both "moved too few" and "moved too many"
// (someone casually adding a New-UI-specific class will immediately fail).
// ⚠️ `parser-app` **does not enter** this registry — it is New-UI's token scope root (K21/K22),
// not a blueprint template class; same treatment as governance §6.4-2 decision on `knowledgeStyles.test.ts`
// (use exclusion condition, not enter registry and mess up the count).
// `parser-status-page` / `parser-test-page` already in these 70.
const PARSER_WHITELIST_70 = [
  'active', 'back-link', 'card', 'checkbox',
  'chunk-head', 'chunk-item', 'chunk-list', 'chunk-ref',
  'chunk-text', 'chunks-card', 'clear-btn', 'concurrency-row',
  'control-card', 'device-row', 'docling-card', 'docling-md',
  'dot', 'dropzone', 'emb-label', 'emb-preview',
  'empty', 'error', 'error-box', 'failure-list',
  'failures-card', 'file-meta', 'folder-bar', 'folder-count',
  'folder-list', 'folder-path', 'folder-row', 'folders-card',
  'has', 'header-actions', 'help-card', 'hint',
  'hint-line', 'kv', 'ok-hint', 'page-header',
  'param', 'params-row', 'parser-status-page', 'parser-test-page',
  'path', 'pause-btn', 'paused', 'pick-btn',
  'query-input', 'queue-card', 'radio', 'rank-line',
  'rank-no', 'rank-text', 'refresh-btn', 'rerank-score',
  'reset-btn', 'resolved-hint', 'row', 'score',
  'scored-card', 'scored-list', 'small', 'status-text',
  'submit-btn', 'test-link', 'toggle', 'unreachable',
  'upload-card', 'warn',
]

// Scope root classes (New-UI side, not blueprint template classes) — use exclusion condition, see ⚠️ above.
const SCOPE_ROOT_CLASSES = ['parser-app']

// 9 element selectors registered at end of Appendix D §D.2: `h2` (one per page) · `h3` (three places) · `b` (.queue-card .kv b) ·
// `li` (two places) · `p` (.help-card p) · `em` (two places) · `strong` (.file-meta strong) · `input` (.param input) ·
// `code` (.emb-preview code). 🔴 In New-UI they must all be nested in scope (K9), bare `h2 { }` leaks across the entire site
// — this set equality assertion simultaneously guards "no extra element selectors leak out".
const PARSER_ELEMENT_SELECTORS = ['b', 'code', 'em', 'h2', 'h3', 'input', 'li', 'p', 'strong']

describe('parser-styles.scss — (e) Class whitelist 70 + element selectors 9 (Appendix D §D.2, set equality)', () => {
  const heads = ruleHeads(css)

  it('Set of class names in file === PARSER_WHITELIST_70 (excluding scope root .parser-app)', () => {
    const found = new Set<string>()
    for (const head of heads) {
      for (const c of head.match(/\.[a-zA-Z][\w-]*/g) || []) {
        const name = c.slice(1)
        if (!SCOPE_ROOT_CLASSES.includes(name)) found.add(name)
      }
    }
    expect([...found].sort(), 'class name set inconsistent with 70 items in Appendix D §D.2').toEqual([...PARSER_WHITELIST_70].sort())
    expect(PARSER_WHITELIST_70.length, 'whitelist constant name drifted from actual count (constant name itself is drift-prevention assertion)').toBe(70)
  })

  it('Set of element selectors in file === 9 registered in Appendix D §D.2', () => {
    const found = new Set<string>()
    for (const head of heads) {
      for (const part of head.split(',')) {
        for (const token of part.trim().split(/[\s>+~]+/)) {
          // Strip pseudo-classes/pseudo-elements (e.g. `li:first-child` → `li`), only pure tag names count as element selectors
          const bare = token.replace(/::?[a-zA-Z-]+(\([^)]*\))?$/, '')
          if (/^[a-z][a-z0-9]*$/.test(bare)) found.add(bare)
        }
      }
    }
    expect([...found].sort(), 'element selector set inconsistent with 9 registered in Appendix D §D.2').toEqual(
      [...PARSER_ELEMENT_SELECTORS].sort(),
    )
  })

  it('N15 same-family guard: `k-*` / `k2-*` / `kn-*` / `fb-*` classes from knowledge area not allowed (belong to knowledge.scss)', () => {
    expect(css, 'parser-styles.scss mixed in knowledge.scss classes').not.toMatch(/\.k(?:2|n)?-[a-z0-9-]+/)
    expect(css, 'parser-styles.scss mixed in FolderBrowser classes').not.toMatch(/\.fb(?:-[a-z0-9-]+)?[\s.,:{]/)
  })
})

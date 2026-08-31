import { describe, it, expect } from 'vitest'
// Encountered two environment differences during implementation, both only changed
// "how to read the file", did not change any assertion content:
// ① Original brief used resolve(__dirname, ...); this repo's package.json is "type": "module",
//    __dirname is unavailable under ESM, changed to equivalent usage of import.meta.url + fileURLToPath.
// ② ⚠️ 【This is historical context from 2026-07-30 P2a, now superseded — jump directly to the
//    "Correction" note at the end of this section for current status, don't use this
//    section to judge today's environment】
//    This repo's tsconfig.json "types" only has ["vite/client","vitest/globals"], @types/node
//    not installed — node:fs / node:path / node:url have no type declarations, `pnpm exec
//    vue-tsc --noEmit` (one of the three task gate commands) reports TS2307.
//    Attempted to switch to Vite static `?raw` import as replacement for node:fs (following
//    the import.meta.glob precedent in src/styles/color-guard.test.ts), but actual behavior
//    differs: vitest's built-in CSSEnablerPlugin (the `vitest:css-disable` transform in
//    node_modules/vitest, enforce:"pre") whenever id matches css/scss extension and
//    `test.css.include` does not explicitly include that file, replaces the entire content with
//    an empty string — **ignores the `?raw`/`?url` query string**, clears it before the
//    assetPlugin's actual raw read. Testing confirms color-guard.test.ts's existing `?raw` glob
//    hits this same pitfall for .css files (tested THEME_LEN=0), but its bare color scan doesn't
//    error on empty string, and this pre-existing false-negative is unrelated to this task;
//    fixing it requires touching `src/styles/color-guard.test.ts`, which is not in the 4 files
//    allowed to be modified in this task, so it's not being fixed. To resolve this without
//    modifying vite.config.ts (adding test.css.include), installing @types/node, or touching
//    tsconfig.json/package.json, reverted to the node:fs approach, using `@ts-expect-error` to
//    suppress the three lines of type errors about missing module declarations (runtime validity
//    already verified, see vitest actual test results below); after module resolution failure the
//    inferred type degrades to any, so the two subsequent filter callback parameters are
//    explicitly annotated `l: string` to satisfy noImplicitAny.
//    🔴 【Correction — the ② section above is historical context, now superseded】
//    After merging, this repo now has `@types/node` (devDependencies ^26.1.2). The tsconfig
//    `types` array still only lists `["vite/client","vitest/globals"]`, but that only controls
//    **global** type auto-imports; **explicit module imports** like `node:fs` still resolve the
//    module declarations from @types/node ⇒ vue-tsc passes directly, the `@ts-expect-error`
//    suppression line in this file was already removed at merge time.
//    🔴 **This item itself was corrected once (T10 re-review caught it, leaving a record)**:
//    I initially wrote here "conversely, global `process` and such still have no types" —
//    **that was wrong**. The entire repo has 7 files that write `/// <reference types="node" />`,
//    that directive is **program-level**, pulling `@types/node/globals.d.ts` (containing
//    `declare var process`) into the entire compilation program ⇒ global `process` **does have
//    types**. Bidirectional probe verification: a new file with neither `node:` import nor
//    reference, writing `export const b = process.platform` → `vue-tsc --noEmit` exit 0; same
//    file adding `const wrong: number = 'string'` → TS2322 exit 2 (proves the probe actually
//    entered the compilation program). The comment in `knowledge/views/DashboardView.test.ts`
//    about globalThis narrowing has **also been corrected** accordingly. Lesson: when correcting
//    someone else's outdated comments, don't casually write down a new assertion you haven't
//    verified. Conclusion unchanged: still using node:fs, still not using `?raw` (the
//    CSSEnablerPlugin pitfall is unrelated to types). Also: the "color-guard.test.ts's `?raw`
//    glob idle on .css" mentioned above **has already been fixed** (now .css uses node:fs, only
//    .vue keeps glob); the remaining gap is it **doesn't include `.scss`** — opened ticket I3
//    this cycle, see docs/vue3-migration-roadmap.md.
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Style file is a mechanical port with no runtime behavior to test. This guard
// only does two things: ① pin down the architectural rule "no duplicate token definitions in this
// file" ② pin down that selector bases haven't been renamed. Visual 1:1 verification is the
// responsibility of reviewers doing line-by-line diff against Vue2 source + user acceptance at :5288,
// not this test's responsibility.

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// Secondary review gap — previously the `toContain` assertion on `.mcp-label`/
// `.mcp-reveal-warn` only checked substrings, but the fix's own **comment** contains the backtick-
// quoted class names (`` `.mcp-label` ``), so deleting the actual CSS rule and leaving only the
// comment would still pass the assertion (confirmed via RED probe testing). Here at fixture level
// we uniformly strip comments (`//` whole-line comments + `/* … */` block comments) before
// asserting, so all `toContain` checks in this file can only be satisfied by actual declarations,
// not by class names/strings mentioned in comments colliding with the pattern.
// Only strip "entire line starting with //" line comments (convention in this file, line comments
// never follow real code), not do global replacement of "//" anywhere in a line — in the
// `.set-select` rule `background-image: url("data:image/svg+xml,... http://www.w3.org/2000/svg")`
// the data URI itself contains `//`, which is not a comment and cannot be cut.
function stripComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('settings-styles.scss', () => {
  const css = stripComments(read('./settings-styles.scss'))

  it('no duplicate token definitions (tokens can only come from .agent-app scope in tokens.scss)', () => {
    const declarations = css.split('\n').filter((l: string) => /^\s*--[a-z-]+\s*:/.test(l))
    expect(declarations).toEqual([])
  })

  it('preserve .set-app grid base and two-column widths', () => {
    expect(css).toContain('grid-template-columns: 258px 1fr')
  })

  it('preserve section anchor styles for stack mode', () => {
    expect(css).toContain('.set-stack-item')
    expect(css).toContain('scroll-margin-top')
  })

  it('preserve iconified navbar for 720px narrow screen', () => {
    expect(css).toContain('@media (max-width: 720px)')
    expect(css).toContain('grid-template-columns: 60px 1fr')
  })

  // Review gap — McpTokensSection.vue uses .mcp-label/.mcp-reveal-warn but the
  // component has no <style> block; first landing missed collecting the corresponding rules from
  // Vue2 McpTokensSection.vue:245/246, after adding them to this file use these two assertions
  // to pin down selectors won't be silently deleted again. Assert selectors **immediately followed
  // by a `{`** (not bare substring), and `.mcp-reveal-warn` indeed carries `color: var(--danger)`
  // declaration — just deleting the rule and leaving the comment would first fail because the
  // fixture-level stripComments() above already couldn't find the comment, the `{`/declaration
  // assertions here are a second safeguard (even if stripComments is weakened later, bare rule
  // deletion would still fail). Still **only proves selector and its declaration exist**, not a
  // word-for-word comparison of all values (that part is the responsibility of reviewers doing
  // line-by-line diff against Vue2 source, the established division of labor in this file's
  // header comment).
  it('preserve .mcp-label / .mcp-reveal-warn from McpTokensSection modal (Vue2 :245/246 scoped styles migration)', () => {
    expect(css).toContain('.mcp-label {')
    expect(css).toContain('.mcp-reveal-warn {')
    expect(css).toContain('color: var(--danger)')
  })

  // ChannelsSection.vue likewise follows the "zero <style> block" convention
  // (same division of labor as Task 10's .mcp-label/.mcp-reveal-warn), .chan-* rules from Vue2
  // sections/ChannelsSection.vue:387-410 scoped (`.chan-x`/`.chan-x:hover` already incorporated
  // by SkModal's `.sk-x`, not being ported) migrated to this file. Same two safeguards as above:
  // selector immediately followed by `{` (not bare substring, won't be hit by backtick-quoted
  // class names in comments), and catch one real declaration (`.chan-type-opt[data-active="true"]`
  // with `border-color: var(--accent)`) proving the rule body is still there, not just an empty
  // selector shell. Feedback from an earlier review — Vue2's .px-open
  // background is `--accent-softer`, under light theme this extremely light accent color is nearly
  // invisible, user's exact words: "can't see there's a button". Changed to solid accent color +
  // white text (`--text-on-accent` only available on solid accent backgrounds, which is exactly
  // what we have here, conforming to existing conventions). **Intentionally diverging from Vue2
  // visual 1:1, already registered in ObservabilitySection.test.ts case 20 and the project log.**
  it('.px-open is solid accent color button (user decision to diverge from Vue2 accent-softer)', () => {
    const at = css.indexOf('.px-open {')
    expect(at, 'cannot find .px-open rule').toBeGreaterThanOrEqual(0)
    const rule = css.slice(at, css.indexOf('}', at))
    expect(rule).toContain('background: var(--accent)')
    expect(rule).toContain('color: var(--text-on-accent)')
    // Reverse: cannot keep the old extremely light background color
    expect(rule).not.toContain('--accent-softer')
  })

  it('preserve .chan-* from ChannelsSection (Vue2 :387-410 scoped styles migration)', () => {
    for (const sel of [
      '.chan-bot {', '.chan-model-lbl {', '.chan-switch {', '.chan-modal-warn {',
      '.chan-modal-hint {', '.chan-type-row {', '.chan-type-opt {',
      // User 2026-07-30 decision: newly added inline error for bot addition failure (replaces Vue2 danger toast)
      '.chan-field-err {',
      '.chan-type-opt[data-active="true"] {', '.chan-field-hint {', '.chan-invite {',
      // Settings parity 2026-08-24: Feishu card status lines (Vue2 :510-511)
      '.chan-lark-degraded {', '.chan-lark-connecting {',
    ]) {
      expect(css).toContain(sel)
    }
    expect(css).toContain('border-color: var(--accent)')
  })
})

// A reported bug ("light mode up/down arrows for iteration count
// have black background plate") — root cause not a wrong value, but **scope missing `color-scheme`**:
// `src/styles/theme.css` only declares `color-scheme: dark` at `:root` (New-UI default blue/dark
// theme) and `light` at `:root[data-theme="light"]`; meanwhile the AI area created its own nested
// theme scope (`SettingsPage.vue:362` / `AgentPage.vue:295` place `data-theme` on the `.agent-app`
// container, don't touch `<html>`). `color-scheme` is an inheritable property, the AI area doesn't
// declare its own, so light AI pages under global dark theme inherit `dark` → browser draws native
// control **internals** using dark UA palette (`input[type=number]` up/down arrow plates, native
// checkboxes, text cursor, etc.), resulting in a black arrow plate hanging on light input boxes.
// Vue2 has no such issue: the old app globally has no `color-scheme: dark` (only one Photos scoped),
// UA defaults to drawing light, so this is a New-UI-specific regression (from the combination of
// global dark default + nested theme scope), not a porting divergence. This guard pins down "AI
// area's two theme blocks each declare their own color-scheme" — if anyone deletes it, it turns red.
function blockOf(css: string, selector: string, fromEnd = false): string {
  // fromEnd: `.ai-toast-scope {` appears in the **selector lists** of both theme blocks too
  // (`.agent-app,\n.ai-toast-scope {`), searching from the start hits that entire token block.
  // The standalone `.ai-toast-scope` override block is appended at the end of the file, so
  // searching backward is what finds it.
  const at = fromEnd ? css.lastIndexOf(selector) : css.indexOf(selector)
  expect(at, `cannot find selector ${selector} in tokens.scss`).toBeGreaterThanOrEqual(0)
  const rest = css.slice(at + selector.length)
  const end = rest.indexOf('\n}')
  expect(end, `rule body for ${selector} not closed`).toBeGreaterThan(0)
  return rest.slice(0, end)
}

describe('tokens.scss — AI area nested theme scope must bring its own color-scheme', () => {
  const css = stripComments(read('./tokens.scss'))

  it('.agent-app (light base) declares color-scheme: light', () => {
    expect(blockOf(css, '.agent-app,\n.ai-toast-scope {')).toContain('color-scheme: light')
  })

  it('.agent-app[data-theme="dark"] declares color-scheme: dark', () => {
    expect(blockOf(css, '.agent-app[data-theme="dark"],\n.ai-toast-scope[data-theme="dark"] {'))
      .toContain('color-scheme: dark')
  })

  // 【Per an earlier review round】AI area toast scope (`.ai-toast-scope`) must ① get the full
  // set of AI tokens (by being in selector lists of both theme blocks) ② override toast's own
  // ones, otherwise AppToast continues using global blue-dark theme's semi-transparent white
  // background + white text, invisible on AI light pages. See root cause explanation in
  // aiTheme.test.ts.
  it('.ai-toast-scope in selector lists of AI both theme blocks (to get full set of AI tokens)', () => {
    expect(css).toContain('.agent-app,\n.ai-toast-scope {')
    expect(css).toContain('.agent-app[data-theme="dark"],\n.ai-toast-scope[data-theme="dark"] {')
  })

  it('.ai-toast-scope overrides toast background/foreground colors, all using AI tokens (no bare colors)', () => {
    const rule = blockOf(css, '.ai-toast-scope {', true)
    for (const decl of ['--toast-bg:', '--toast-fg:', '--toast-warn-bg:', '--toast-warn-fg:',
      '--toast-danger-bg:', '--toast-danger-fg:', '--chip-border:']) {
      expect(rule, `.ai-toast-scope missing ${decl}`).toContain(decl)
    }
    // Values must reference AI tokens, cannot hardcode color literals
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rule).not.toMatch(/rgba?\(/)
  })
})

describe('sk-shared.scss', () => {
  const css = stripComments(read('./sk-shared.scss'))

  it('export 6 generic classes that settings area depends on', () => {
    for (const sel of [
      '.sk-section', '.sk-section-head', '.sk-section-title',
      '.sk-section-hint', '.sk-section-body', '.sk-btn',
    ]) {
      expect(css).toContain(sel)
    }
  })

  it('no duplicate token definitions', () => {
    const declarations = css.split('\n').filter((l: string) => /^\s*--[a-z-]+\s*:/.test(l))
    expect(declarations).toEqual([])
  })

  it('export two groups of classes for modal shell and form fields', () => {
    for (const sel of [
      '.sk-modal-bg', '.sk-modal', '.sk-modal-head', '.sk-modal-title',
      '.sk-modal-body', '.sk-modal-foot', '.sk-field', '.sk-field-label', '.sk-field-hint',
    ]) {
      expect(css).toContain(sel)
    }
  })

  it('preserve two entry animation keyframes', () => {
    expect(css).toContain('@keyframes sk-fade-in')
    expect(css).toContain('@keyframes sk-pop')
  })

  // Inline error bar used when AddSkillModal's pre-submit local validation is hit,
  // precedent .chan-field-err (settings-styles.scss:234).
  it('export inline error class .sk-field-err, uses --danger token no bare colors', () => {
    const at = css.indexOf('.sk-field-err {')
    expect(at, 'cannot find .sk-field-err rule').toBeGreaterThanOrEqual(0)
    const rule = css.slice(at, css.indexOf('}', at))
    expect(rule).toContain('color: var(--danger)')
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(rule).not.toMatch(/rgba?\(/)
  })
})

// Cycle-end review guard I1 — `.empty-title`/`.empty-sub` and `.agent-app .empty-title`/
// `.agent-app .empty-sub` from `agent-styles.scss` have specificity collision (see three-item
// comment block at skills-styles.scss:424-450). New-UI-specific regression, not Vue2 divergence:
// Vue2 baseline `Settings/Settings.vue:2` root node only has `class="set-app"`, no `agent-app`,
// these two rules never meet in Vue2; New-UI `SettingsPage.vue:371` root node is `agent-app set-app`,
// both rules hit the same empty-state element simultaneously, at equal specificity solely depend
// on import order in `router/index.ts` to win by luck, and properties not declared in agent-styles
// (letter-spacing/margin/color) leak through directly.
//
// Rather than hardcoding the two magic numbers "(0,2,0)/(0,3,0)", wrote a minimal SCSS nested
// parser that counts class numbers in selector chains from **actual source code of both files**,
// then compares them — if anyone later changes agent-styles.scss's nesting levels, or anyone
// deletes the `.sk-detail` prefix in skills-styles.scss and reverts, this guard automatically
// calculates the wrong comparison result and turns red, doesn't depend on any hardcoded prior
// knowledge numbers.
describe('skills-styles.scss — .empty-title/.empty-sub empty-state styles (cycle-end review guard I1)', () => {
  const css = stripComments(read('./skills-styles.scss'))
  const agentCss = stripComments(read('./agent-styles.scss'))

  function classCount(selector: string): number {
    return (selector.match(/\.[a-zA-Z][\w-]*/g) || []).length
  }

  // Given CSS full text and target selector (must exactly equal the selector of some nested rule,
  // e.g. '.empty-title'), scan `{`/`}` maintaining a "current nesting selector stack", return the
  // entire selector chain from outermost to itself when hit. Used to calculate the "actually
  // effective" nested specificity, not just looking at the selector text on that one line.
  function ancestorChain(text: string, targetSelector: string): string[] {
    const stack: string[] = []
    let i = 0
    while (i < text.length) {
      const ch = text[i]
      if (ch === '{') {
        let j = i - 1
        while (j >= 0 && /\s/.test(text[j])) j--
        const end = j + 1
        while (j >= 0 && text[j] !== '{' && text[j] !== '}') j--
        const selector = text.slice(j + 1, end).trim()
        stack.push(selector)
        if (selector === targetSelector) return [...stack]
        i++
        continue
      }
      if (ch === '}') {
        stack.pop()
        i++
        continue
      }
      i++
    }
    throw new Error(`cannot find nested rule ${targetSelector} in CSS`)
  }

  function nestedSpecificity(text: string, targetSelector: string): number {
    return ancestorChain(text, targetSelector).reduce((sum, sel) => sum + classCount(sel), 0)
  }

  it('.empty-title actual nested specificity in skills-styles.scss higher than agent-styles.scss version', () => {
    const skillsSpec = nestedSpecificity(css, '.empty-title')
    const agentSpec = nestedSpecificity(agentCss, '.empty-title')
    expect(agentSpec, 'agent-styles.scss .empty-title nested specificity').toBe(2) // known baseline (0,2,0), verify parser itself reads correctly
    expect(skillsSpec, 'skills-styles.scss .empty-title nested specificity must deterministically exceed agent-styles').toBeGreaterThan(agentSpec)
  })

  it('.empty-sub actual nested specificity in skills-styles.scss higher than agent-styles.scss version', () => {
    const skillsSpec = nestedSpecificity(css, '.empty-sub')
    const agentSpec = nestedSpecificity(agentCss, '.empty-sub')
    expect(agentSpec, 'agent-styles.scss .empty-sub nested specificity').toBe(2)
    expect(skillsSpec, 'skills-styles.scss .empty-sub nested specificity must deterministically exceed agent-styles').toBeGreaterThan(agentSpec)
  })

  it('.empty-title explicitly neutralizes letter-spacing/margin that agent-styles leaks (Vue2 has neither, revert to defaults)', () => {
    const outerAt = css.indexOf('.sk-detail .sk-detail-empty-inner {')
    expect(outerAt, 'cannot find deterministically winning .sk-detail .sk-detail-empty-inner override block').toBeGreaterThanOrEqual(0)
    const rest = css.slice(outerAt)
    const titleAt = rest.indexOf('.empty-title {')
    expect(titleAt).toBeGreaterThanOrEqual(0)
    const titleRule = rest.slice(titleAt, rest.indexOf('}', titleAt))
    expect(titleRule).toContain('font-size: 15px')
    expect(titleRule).toContain('color: var(--text-primary)')
    expect(titleRule).toContain('letter-spacing: normal')
    expect(titleRule).toContain('margin: 0')
  })

  it('.empty-sub explicitly neutralizes color/margin that agent-styles leaks (Vue2 has no own color—inherits parent --text-tertiary; no margin)', () => {
    const outerAt = css.indexOf('.sk-detail .sk-detail-empty-inner {')
    expect(outerAt).toBeGreaterThanOrEqual(0)
    const rest = css.slice(outerAt)
    const subAt = rest.indexOf('.empty-sub {')
    expect(subAt).toBeGreaterThanOrEqual(0)
    const subRule = rest.slice(subAt, rest.indexOf('}', subAt))
    expect(subRule).toContain('font-size: 13px')
    expect(subRule).toContain('max-width: 320px')
    expect(subRule).toContain('color: inherit')
    expect(subRule).toContain('margin: 0')
  })
})

// 2026-08-20 — the `+ Add header` / `+ Add variable` buttons in the MCP
// add/edit modal (`McpServerModal.vue`, class `.mcp-kv-add`) rendered as plain
// body text. Root cause is the same one the `.set-app .sk-add-btn` rule
// upstream in skills-styles.scss already works around: `settings-styles.scss`
// resets EVERY `<button>` inside `.set-app` (background/border/color/cursor/
// font), and that compiled selector `.set-app button` at (0,1,1) outranks a
// bare single-class rule at (0,1,0). The three declarations that decide
// whether the element reads as a button at all -- its background, its accent
// foreground, and its smaller/heavier font -- were being thrown away, and on a
// newly-added server that button is the only interactive element in the
// headers/env field (both lists start empty), so there was nothing else to
// suggest it could be clicked.
//
// Guarded by comparing specificity computed from both real files rather than
// by pinning the selector text: any future rule that reintroduces the problem
// (or any change to the reset's own specificity) is caught, and a rewrite that
// solves it a different way -- an id, an attribute selector, deeper nesting --
// passes without edits here.
describe('mcp-styles.scss — .mcp-kv-add outranks the .set-app button reset', () => {
  const mcpCss = stripComments(read('./mcp-styles.scss'))
  const settingsCss = stripComments(read('./settings-styles.scss'))

  /** CSS specificity as [ids, classes+attributes+pseudo-classes, types], the
   *  three components that decide the cascade for these two rules. */
  function specificity(chain: string[]): [number, number, number] {
    const joined = chain.join(' ')
    const ids = (joined.match(/#[\w-]+/g) || []).length
    const classes = (joined.match(/\.[a-zA-Z][\w-]*|\[[^\]]+\]|:[a-z-]+\(/g) || []).length
    const types = (joined.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length
    return [ids, classes, types]
  }

  function beats(a: [number, number, number], b: [number, number, number]): boolean {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i]
    }
    return false // equal specificity is decided by import order — not good enough
  }

  /** The ancestor chain of the nested rule whose body declares `decl`. When
   *  `selector` is given, only a rule with exactly that own selector counts --
   *  `background: transparent` appears in several unrelated rules, and the one
   *  this guard is about is the bare `button` reset nested in `.set-app`. */
  function chainDeclaring(text: string, decl: string, selector?: string): string[] {
    const stack: string[] = []
    let i = 0
    while (i < text.length) {
      const ch = text[i]
      if (ch === '{') {
        let j = i - 1
        while (j >= 0 && /\s/.test(text[j])) j--
        const end = j + 1
        while (j >= 0 && text[j] !== '{' && text[j] !== '}') j--
        stack.push(text.slice(j + 1, end).trim())
        const close = text.indexOf('}', i)
        const body = text.slice(i + 1, close === -1 ? undefined : close)
        const own = stack[stack.length - 1]
        if (body.includes(decl) && (!selector || own === selector)) return [...stack]
        i++
        continue
      }
      if (ch === '}') {
        stack.pop()
        i++
        continue
      }
      i++
    }
    throw new Error(`no rule declaring "${decl}" found`)
  }

  it('the reset really is the (0,1,1) blanket rule this guard assumes', () => {
    const chain = chainDeclaring(settingsCss, 'background: transparent', 'button')
    expect(chain.join(' ')).toContain('.set-app')
    expect(specificity(chain)).toEqual([0, 1, 1])
  })

  it('the accent background survives — without it the button has no shape', () => {
    const kv = specificity(chainDeclaring(mcpCss, 'background: var(--accent-softer)'))
    const reset = specificity(chainDeclaring(settingsCss, 'background: transparent', 'button'))
    expect(beats(kv, reset), `.mcp-kv-add ${kv} must outrank .set-app button ${reset}`).toBe(true)
  })

  it('the accent foreground and the 12px/500 font survive too', () => {
    const reset = specificity(chainDeclaring(settingsCss, 'background: transparent', 'button'))
    for (const decl of ['color: var(--accent)', 'font-size: 12px', 'font-weight: 500']) {
      const kv = specificity(chainDeclaring(mcpCss, decl))
      expect(beats(kv, reset), `the rule declaring "${decl}" ${kv} must outrank ${reset}`).toBe(true)
    }
  })
})

// Fix wave D (D2, owner acceptance 2026-08-26 -- reveal-time scale stutter): source-pin test for
// the FIRST of the two mismatches this fix wave investigated -- "does the promoted depth-0 strip's
// box coincide EXACTLY with the revealed `.tm-fwin--active` box". Both TimeMachineDepthStack.vue's
// `.tm-depth-stack` and TimeMachineStage.vue's `.tm-fwin--active` derive their on-screen rect from
// the SAME source values (TM_RAIL_WIDTH+TM_STEPPER_BAND=280px right gutter, the 80px bottom band,
// the same transform-origin fraction, the same TM_WINDOW_SCALE), but each file expresses them
// through a DIFFERENT CSS mechanism (`.tm-stage__hold--active`'s `padding-right`/`padding-bottom`
// vs `.tm-depth-stack`'s `right`/`bottom`) -- nothing at the type level stops the two from drifting
// apart if either literal is ever edited alone. jsdom applies no CSS at all (every layout metric
// reads 0/auto), so this reads the components' own source text and diffs the literal values
// directly -- same technique TimeMachineStage.test.ts's own B1 background-token test and
// TimeMachineStepper.test.ts/TimeMachineRail.test.ts already use for their own CSS-literal
// regression guards. A real-browser pixel comparison is still the only way to catch a mismatch this
// test's own inputs (the two source files) do not encode -- see this fix wave's own report for the
// residual-risk note.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { parseCssRules } from '../../styles/__tests__/cssCascade'

const DIR = path.dirname(fileURLToPath(import.meta.url))

function styleBlock(file: string): string {
  const src = readFileSync(path.resolve(DIR, file), 'utf8')
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error(`no <style> block found in ${file}`)
  // Strip comments first (same reasoning Breadcrumb.test.ts's own extractStyle gives): a comment
  // mentioning a property name/value above a rule would otherwise pollute a naive substring match.
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

function ruleBody(css: string, selector: string): string {
  const rule = parseCssRules(css).find((r) => r.selectors.includes(selector))
  if (!rule) throw new Error(`no rule found for selector ${selector}`)
  return rule.body
}

function decl(body: string, prop: string): string {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`)
  const m = re.exec(body)
  if (!m) throw new Error(`no ${prop} declaration found in rule body: ${body}`)
  return m[1].trim()
}

const stageCss = styleBlock('./TimeMachineStage.vue')
const depthStackCss = styleBlock('./TimeMachineDepthStack.vue')

describe('Time Machine depth-stack vs real window: geometry identity (fix wave D, D2)', () => {
  it('.tm-depth-stack\'s right gutter matches .tm-stage__hold--active\'s padding-right (same 280px reserved band)', () => {
    const holdBody = ruleBody(stageCss, '.tm-stage__hold--active')
    const stackBody = ruleBody(depthStackCss, '.tm-depth-stack')
    expect(decl(stackBody, 'right')).toBe(decl(holdBody, 'padding-right'))
  })

  it('.tm-depth-stack\'s bottom gap matches .tm-stage__hold--active\'s padding-bottom (same 80px reserved band)', () => {
    const holdBody = ruleBody(stageCss, '.tm-stage__hold--active')
    const stackBody = ruleBody(depthStackCss, '.tm-depth-stack')
    expect(decl(stackBody, 'bottom')).toBe(decl(holdBody, 'padding-bottom'))
  })

  it('.tm-depth-stack starts flush at the stage\'s own top-left, matching .tm-fwin--active\'s implicit (0,0) origin', () => {
    const stackBody = ruleBody(depthStackCss, '.tm-depth-stack')
    // .tm-fwin--active has no top/left offset of its own -- its box starts at its parent
    // (.tm-stage__hold--active)'s own content-box origin, which itself has no padding-top/
    // padding-left (only padding-right/padding-bottom, asserted above), i.e. (0,0). The
    // depth-stack must start at the exact same point for the two boxes to coincide.
    expect(decl(stackBody, 'top')).toBe('0')
    expect(decl(stackBody, 'left')).toBe('0')
    const holdBody = ruleBody(stageCss, '.tm-stage__hold--active')
    expect(holdBody).not.toMatch(/padding-top\s*:/)
    expect(holdBody).not.toMatch(/padding-left\s*:/)
  })

  it('.tm-depth-stack and .tm-fwin--active scale around the IDENTICAL transform-origin fraction', () => {
    const stackBody = ruleBody(depthStackCss, '.tm-depth-stack')
    const fwinBody = ruleBody(stageCss, '.tm-fwin--active')
    expect(decl(stackBody, 'transform-origin')).toBe(decl(fwinBody, 'transform-origin'))
  })

  it('.tm-depth-strip (the depth-0 slot\'s own box) and .tm-fwin--active round the same corner radius (no seam at the swap)', () => {
    // Compared against `.tm-depth-strip`, not `.tm-depth-stack`: the stack is only the OUTER
    // wrapper that carries the shared TM_WINDOW_SCALE transform (paired with `.tm-fwin--active`
    // itself above) -- the individual strip is the element that actually paints a window-shaped
    // box, the layer whose depth-0 pose is `{x:0,y:0,scaleX:1,scaleY:1}` (identity, resolveSlotPose)
    // and therefore the one that must visually coincide with the real, revealed `.tm-fwin--active`.
    const stripBody = ruleBody(depthStackCss, '.tm-depth-strip')
    const fwinBody = ruleBody(stageCss, '.tm-fwin--active')
    expect(decl(stripBody, 'border-radius')).toBe(decl(fwinBody, 'border-radius'))
  })

  // Fix wave F (Ruling F'-1, owner acceptance 2026-08-26): the third paint mismatch this file's
  // own D2/F sequence found at the reveal swap -- the depth-0 strip used to carry a dedicated,
  // WEAKER `--tm-depth-shadow` token while the real, revealed `.tm-fwin--active` carries a
  // stronger `--tm-fwin-shadow` -- since the strip sits pixel-for-pixel underneath the fwin (the
  // border-radius/geometry tests above) and is only ever exposed mid-travel (the fwin is opaque
  // and occludes it completely the rest of the time), that weaker shadow was visibly REPLACED by
  // the stronger one the instant the fwin's opacity snapped back at reveal -- a "shadow suddenly
  // appears" pop. Fixed by retiring `--tm-depth-shadow` outright (theme.css's own comment on
  // `--tm-fwin-shadow` has the full trace on why retiring, not aliasing, was the right call) and
  // pointing `.tm-depth-strip` at the SAME `--tm-fwin-shadow` token `.tm-fwin--active` uses -- so
  // the strongest test is "do both reference the identical token", immune to either value ever
  // being edited in isolation.
  it('.tm-depth-strip and .tm-fwin--active share the SAME box-shadow token (no shadow pop at the reveal swap)', () => {
    const stripBody = ruleBody(depthStackCss, '.tm-depth-strip')
    const fwinBody = ruleBody(stageCss, '.tm-fwin--active')
    expect(decl(stripBody, 'box-shadow')).toBe(decl(fwinBody, 'box-shadow'))
    expect(decl(stripBody, 'box-shadow')).toBe('var(--tm-fwin-shadow)')
  })

  it('the retired --tm-depth-shadow token is gone from theme.css and no longer referenced by any live declaration', () => {
    // Comments (theme.css's own Ruling F'-1 trace, this file's own comments above) are allowed to
    // still mention the retired token BY NAME (history/rationale) -- stripped here (same technique
    // tmTokens.test.ts's own `stripComments` uses) so only a LIVE `--tm-depth-shadow:` declaration
    // would fail this check, not the prose explaining why it no longer exists.
    const themeCssCodeOnly = readFileSync(path.resolve(DIR, '../../styles/theme.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    expect(themeCssCodeOnly).not.toMatch(/--tm-depth-shadow\s*:/)
    expect(depthStackCss).not.toMatch(/var\(--tm-depth-shadow\)/)
    expect(stageCss).not.toMatch(/var\(--tm-depth-shadow\)/)
  })

  it('neither .tm-depth-strip nor .tm-fwin--active declares outline/filter (no other paint divergence at the swap)', () => {
    const stripBody = ruleBody(depthStackCss, '.tm-depth-strip')
    const fwinBody = ruleBody(stageCss, '.tm-fwin--active')
    for (const body of [stripBody, fwinBody]) {
      expect(body).not.toMatch(/(?:^|;)\s*outline\s*:/)
      expect(body).not.toMatch(/(?:^|;)\s*filter\s*:/)
    }
  })

  // Fix wave D (D2, second mismatch investigated): a CSS `transition` on `.tm-fwin`/
  // `.tm-fwin--active` (or an ancestor) would replay at the exact instant `.tm-fwin--traveling` is
  // removed (reveal), on top of GSAP's own tween of the depth-0 strip -- two independent, unrelated
  // animations landing on the SAME frame is itself a stutter, even with the geometry above already
  // proven identical. Confirmed by source inspection: no rule targeting any of these three selectors
  // declares `transition` (the ONLY `transition` declarations this file has are on the gear button
  // and the bottom-bar restore button, both irrelevant to the fwin/depth-stack swap) -- this test
  // pins that invariant so a future edit cannot silently reintroduce one.
  it('.tm-fwin / .tm-fwin--active / .tm-stage__hold--active declare no `transition` (GSAP/inline-style only, no CSS transition to replay at reveal)', () => {
    for (const selector of ['.tm-fwin', '.tm-fwin--active', '.tm-stage__hold--active']) {
      const body = ruleBody(stageCss, selector)
      expect(body, `${selector} must not declare transition`).not.toMatch(/(?:^|;)\s*transition\s*:/)
    }
  })

  it('.tm-depth-stack / .tm-depth-strip declare no `transition` (GSAP is the only writer of their transform, per this file\'s own header comment)', () => {
    for (const selector of ['.tm-depth-stack', '.tm-depth-strip']) {
      const body = ruleBody(depthStackCss, selector)
      expect(body, `${selector} must not declare transition`).not.toMatch(/(?:^|;)\s*transition\s*:/)
    }
  })

  it('both scale bindings reference the SAME TM_WINDOW_SCALE import, not a duplicated literal', () => {
    const stageSrc = readFileSync(path.resolve(DIR, './TimeMachineStage.vue'), 'utf8')
    const depthStackSrc = readFileSync(path.resolve(DIR, './TimeMachineDepthStack.vue'), 'utf8')
    expect(stageSrc).toMatch(/from\s+['"]\.\.\/util\/timeMachineMath['"][^\n]*\bTM_WINDOW_SCALE\b|\bTM_WINDOW_SCALE\b[^\n]*from\s+['"]\.\.\/util\/timeMachineMath['"]/)
    expect(depthStackSrc).toMatch(/from\s+['"]\.\.\/util\/timeMachineMath['"][^\n]*\bTM_WINDOW_SCALE\b|\bTM_WINDOW_SCALE\b[^\n]*from\s+['"]\.\.\/util\/timeMachineMath['"]/)
    // Both bind the SAME imported constant via a template literal (`scale(${TM_WINDOW_SCALE})`),
    // not a hardcoded "0.82" -- a hardcoded duplicate could silently drift from the shared source.
    expect(stageSrc).toMatch(/scale\(\$\{TM_WINDOW_SCALE\}\)/)
    expect(depthStackSrc).toMatch(/scale\(\$\{TM_WINDOW_SCALE\}\)/)
  })
})

// Fix wave E (E2, owner acceptance 2026-08-26): source-pin test for the STATIC content-identity
// half of the owner's binding rule (Ruling E-1', see timeMachineMath.ts's own resolveSlotPose
// comment) -- "at rest (scale 1, pre-ancestor-scale), the replica's chrome rows must be
// pixel-identical to the real window's". D2's own tests above already pin the two windows'
// GEOMETRY (box/origin/radius); these pin the CONTENT inside them -- font-size/padding/gap for the
// breadcrumb row and the list-head row, the two rows this fix wave's own audit found still
// drifting (this file's own "final-fix-report.md", "Fix wave E" section has the full before/after
// trace). Rather than comparing literal values directly (D2's own approach, still correct there
// since those pairs have no natural single source to point at), THESE pairs now share actual
// theme.css tokens (`--tm-topbar-padding`/`--tm-crumb-*`/`--tm-list-head-padding`/
// `--tm-item-count-font-size`) -- so the strongest test is "do both sides reference the SAME
// token", which is immune to a future edit that changes the token's OWN value (both consumers
// follow it automatically) while still catching the actual failure mode this fix wave hit: one
// side quietly reverting to (or never adopting) the shared token and drifting back to its own
// private literal.
describe('Time Machine breadcrumb/list-head chrome: real vs replica content identity (fix wave E, E2)', () => {
  const themeCss = readFileSync(path.resolve(DIR, '../../styles/theme.css'), 'utf8')
  const breadcrumbCss = styleBlock('../components/Breadcrumb.vue')
  const filesCss = styleBlock('../../views/Files.vue')
  const previewCss = styleBlock('./SnapshotPreviewWindow.vue')

  it('every shared chrome-metric token this test relies on is actually declared in theme.css', () => {
    for (const token of [
      '--tm-topbar-padding',
      '--tm-crumb-font-size',
      '--tm-crumb-padding',
      '--tm-crumb-gap',
      '--tm-crumb-sep-font-size',
      '--tm-list-head-padding',
      '--tm-item-count-font-size',
    ]) {
      expect(themeCss, `theme.css must declare ${token}`).toMatch(new RegExp(`${token}\\s*:`))
    }
  })

  it('the real breadcrumb (.crumb) and the replica (.tm-preview-window__crumb) share the SAME font-size/padding tokens', () => {
    const realBody = ruleBody(breadcrumbCss, '.crumb')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__crumb')
    expect(decl(replicaBody, 'font-size')).toBe(decl(realBody, 'font-size'))
    expect(decl(replicaBody, 'font-size')).toBe('var(--tm-crumb-font-size)')
    expect(decl(replicaBody, 'padding')).toBe(decl(realBody, 'padding'))
    expect(decl(replicaBody, 'padding')).toBe('var(--tm-crumb-padding)')
  })

  it('the real breadcrumb row (.breadcrumb) and the replica (.tm-preview-window__crumbs) share the SAME gap token', () => {
    const realBody = ruleBody(breadcrumbCss, '.breadcrumb')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__crumbs')
    expect(decl(replicaBody, 'gap')).toBe(decl(realBody, 'gap'))
    expect(decl(replicaBody, 'gap')).toBe('var(--tm-crumb-gap)')
  })

  it('the real separator (.crumb-sep) and the replica (.tm-preview-window__crumb-sep) share the SAME font-size token', () => {
    const realBody = ruleBody(breadcrumbCss, '.crumb-sep')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__crumb-sep')
    expect(decl(replicaBody, 'font-size')).toBe(decl(realBody, 'font-size'))
    expect(decl(replicaBody, 'font-size')).toBe('var(--tm-crumb-sep-font-size)')
  })

  it('the real topbar (.files-topbar) and the replica chrome row (.tm-preview-window__chrome) share the SAME padding token', () => {
    const realBody = ruleBody(filesCss, '.files-topbar')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__chrome')
    expect(decl(replicaBody, 'padding')).toBe(decl(realBody, 'padding'))
    expect(decl(replicaBody, 'padding')).toBe('var(--tm-topbar-padding)')
  })

  it('the real list-head (.files-list-head) and the replica row2 (.tm-preview-window__row2) share the SAME padding token AND the same border-top', () => {
    const realBody = ruleBody(filesCss, '.files-list-head')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__row2')
    expect(decl(replicaBody, 'padding')).toBe(decl(realBody, 'padding'))
    expect(decl(replicaBody, 'padding')).toBe('var(--tm-list-head-padding)')
    expect(decl(replicaBody, 'border-top')).toBe(decl(realBody, 'border-top'))
  })

  it('the real item count (.files-item-count) and the replica count (.tm-preview-window__count) share the SAME font-size token', () => {
    const realBody = ruleBody(filesCss, '.files-item-count')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__count')
    expect(decl(replicaBody, 'font-size')).toBe(decl(realBody, 'font-size'))
    expect(decl(replicaBody, 'font-size')).toBe('var(--tm-item-count-font-size)')
  })

  it('the replica grid container (.tm-preview-window__grid) declares NO vertical padding, matching the real .file-grid chain\'s own zero', () => {
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__grid')
    expect(decl(replicaBody, 'padding')).toBe('0')
  })

  // Fix wave E (E2 follow-up, owner acceptance 2026-08-26): the item-count NUMBER used to render
  // at one weight in the replica while the real window bolded it via `<i18n-t>`'s own `#n` slot
  // (Fix wave C) -- see the template's own comment above `.tm-preview-window__row2` for the full
  // trace. Pinned two ways: the MARKUP shape (both use `<i18n-t keypath="tmItemCount">` with a
  // `<strong>` inside the `#n` slot template, not a plain interpolated string) and the CSS weight/
  // color declared on the resulting `strong` element.
  it('the real count (.files-item-count) and the replica count (.tm-preview-window__count) both bold the number via <i18n-t>\'s #n slot, not a plain interpolated string', () => {
    const filesSrc = readFileSync(path.resolve(DIR, '../../views/Files.vue'), 'utf8')
    const previewSrc = readFileSync(path.resolve(DIR, './SnapshotPreviewWindow.vue'), 'utf8')
    const i18nTBoldRe = /<i18n-t[^>]*keypath="tmItemCount"[^>]*>\s*<template #n><strong>/
    expect(filesSrc, 'Files.vue must bold the tmItemCount number via <i18n-t>/#n/<strong>').toMatch(i18nTBoldRe)
    expect(previewSrc, 'SnapshotPreviewWindow.vue must bold the tmItemCount number via <i18n-t>/#n/<strong>').toMatch(i18nTBoldRe)
  })

  it('the real count\'s bold number (.files-item-count strong) and the replica\'s (.tm-preview-window__count strong) share the SAME font-weight/color', () => {
    const realBody = ruleBody(filesCss, '.files-item-count strong')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__count strong')
    expect(decl(replicaBody, 'font-weight')).toBe(decl(realBody, 'font-weight'))
    expect(decl(replicaBody, 'color')).toBe(decl(realBody, 'color'))
  })

  // Fix wave E (E2 follow-up, owner acceptance 2026-08-26, cross-file truncation mismatch): the
  // real listing container (.files-listwrap, scrolls when content overflows) and its replica
  // structural counterpart (.tm-preview-window__body, never scrolls -- 24-row cap) must reserve
  // the IDENTICAL scrollbar gutter unconditionally, or a folder that makes the real one scroll
  // resolves a narrower `auto-fill`/flex-basis content width than the replica ever does, landing
  // different ellipsis truncation points between the two (the owner's own repro: the same long
  // filename truncated at a different character count in each). See each file's own comment on
  // this declaration for the full trace and the accepted minor visual change to the plain Files
  // view (a folder that fits without scrolling now still reserves a small gutter strip).
  it('the real listing container (.files-listwrap) and its replica counterpart (.tm-preview-window__body) both reserve a stable scrollbar gutter', () => {
    const realBody = ruleBody(filesCss, '.files-listwrap')
    const replicaBody = ruleBody(previewCss, '.tm-preview-window__body')
    expect(decl(realBody, 'scrollbar-gutter')).toBe('stable')
    expect(decl(replicaBody, 'scrollbar-gutter')).toBe('stable')
  })
})

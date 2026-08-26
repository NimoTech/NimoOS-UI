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

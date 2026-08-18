import { describe, it, expect } from 'vitest'
import ringSrc from './widgets/RingGauge.vue?raw'
import dockAppSrc from './DockApp.vue?raw'

// Source-text guards, in the pattern tileSizing.test.ts established. Everything
// asserted here is layout or input behaviour that jsdom cannot observe -- it does
// no layout at all, and getBoundingClientRect is always 0 -- and that `pnpm build`
// cannot observe either, because a wrong-but-valid declaration compiles fine. The
// evidence for each was gathered in real Chromium (see the batch design doc); these
// assertions only keep the declarations from quietly going missing again.
//
// `?raw` on a .vue file yields the real source. It does NOT for .css in this repo's
// vitest (always an empty string -- color-guard.test.ts and theme.sp9.test.ts read
// those through node:fs instead). Both files here are .vue.

/** Declarations only: a guard must not be satisfiable by explanatory prose. */
const stripComments = (src: string) =>
  src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('RingGauge centring (source guard)', () => {
  const src = stripComments(ringSrc)

  // The label's ink sat 7.52px left of the ring's centre on a 57px ring: <s> is
  // display:block, so its box is as wide as the percentage above it, and the
  // default `start` alignment left the ink flush against that box's left edge.
  it('keeps text-align: center on the ring text block', () => {
    expect(src).toMatch(/text-align\s*:\s*center/)
  })

  // Without it the text block is 31px tall for a Latin label and 33px for a CJK
  // one -- both taller than the hole -- so the number pressed out onto the colour
  // band, and the Processor card's two rings spilled by different amounts.
  it('pins line-height: 1 on the ring text block', () => {
    expect(src).toMatch(/line-height\s*:\s*1\b/)
  })

  // The hole percentage must live in exactly one place. It used to exist twice:
  // once in the inline data-driven gradient and once in a hardcoded 68%/84%
  // three-colour CSS default that only arc=false ever selected. Two copies is how
  // a ring gets resized in one of them and not the other.
  it('states the hole percentage exactly once', () => {
    const hole = src.match(/var\(--ring-hole\)\s+(\d+(?:\.\d+)?)%/g)
    expect(hole).toHaveLength(1)
    const pct = /var\(--ring-hole\)\s+(\d+(?:\.\d+)?)%/.exec(src)![1]
    expect(src.match(new RegExp(pct.replace('.', '\\.') + '%', 'g'))).toHaveLength(1)
  })

  it('does not bring back the meaningless 68%/84% conic default', () => {
    expect(src).not.toMatch(/68%/)
    expect(src).not.toMatch(/84%/)
  })
})

describe('DockApp native-drag suppression (source guard)', () => {
  const src = stripComments(dockAppSrc)

  // The reported symptom -- a no-drop cursor, and dropping on a browser tab
  // navigating to the icon URL -- is the browser's own image drag taking over the
  // gesture. All three declarations are needed: draggable="false" alone is bypassed
  // once a text selection exists, which PhotoImageViewer.vue:221 records after
  // hitting it. HomeDock.test.ts asserts the attribute through a real mount; the
  // two CSS halves have no observable effect in jsdom, hence this guard.
  it('sets draggable="false" on the icon image', () => {
    expect(src).toMatch(/draggable="false"/)
  })
  it('disables the webkit user-drag on the icon image', () => {
    expect(src).toMatch(/-webkit-user-drag\s*:\s*none/)
  })
  it('disables text selection on the dock button', () => {
    expect(src).toMatch(/(^|[^-])user-select\s*:\s*none/m)
    expect(src).toMatch(/-webkit-user-select\s*:\s*none/)
  })
})

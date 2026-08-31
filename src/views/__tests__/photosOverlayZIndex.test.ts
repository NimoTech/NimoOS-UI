// Guard against a class of bug that turned out NOT
// to be the cause of a previously reported symptom, but is a real risk worth locking down anyway.
//
// Hypothesis (disproven by investigation): `.photos-root .app` gained
// `position: relative; z-index: 1` (the aurora
// bleed-through fix). Every `position: fixed` overlay that renders as a *sibling* of `.app`
// inside `.photos-root` (the lightbox, confirm/create/picker scrims, the edit-mode select bar,
// the export toast) must carry its own explicit `z-index` well above that `1`, or it would stack
// *underneath* `.app` and silently paint invisible/inert -- state flips (jsdom would see it), but
// nothing appears on screen. Reading every one of these rules found each already declares an
// explicit z-index (100-300) -- the hypothesis did not hold for the reported symptom -- but nothing
// currently prevents a future edit from stripping one of these values back to nothing/`auto`,
// silently reproducing the exact failure mode the hypothesis described. This is that guard.
//
// Text-scan, not rendered-DOM: jsdom does not compute cascade/paint order (same rationale as
// color-guard.test.ts / photosLayoutHeightCap.test.ts / photosGlassSurfaces.test.ts), so this
// reads the real source files directly via node:fs rather than mounting anything.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(rel: string): string {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
  expect(text.length, `${rel} read as empty -- the way this file is loaded has stopped working`).toBeGreaterThan(0)
  return text
}

/** All occurrences of a selector's rule body (a class can appear more than once, e.g. the
 *  lightbox has both a component-scoped copy and a parity global copy -- both must pass). */
function ruleBodies(text: string, selector: string): string[] {
  const bodies: string[] = []
  let from = 0
  for (;;) {
    const i = text.indexOf(selector, from)
    if (i === -1) break
    const open = text.indexOf('{', i)
    const close = text.indexOf('}', open)
    if (open === -1 || close === -1) break
    bodies.push(text.slice(open + 1, close))
    from = close + 1
  }
  return bodies
}

const MIN_Z = 100

// Each entry: [selector text as it appears in source, files it may be declared in] -- every
// sibling-of-`.app` overlay the Photos pages render.
// The ".lightbox (component-scoped)" entry that used to live here is retired --
// PhotoLightbox.vue's own local `.lightbox { ... }` rule (position:fixed + z-index:200) was
// deleted once the lightbox actually nests inside `.photos-root` (byte-duplicate of the very
// ".lightbox (parity)" entry below; see PhotoLightbox.vue's scoped-style retirement note). The
// ">= 100" floor this whole guard protects is unaffected -- parity's own copy still carries it,
// and it's the only copy left to carry it.
const OVERLAYS: Array<{ name: string; selector: string; files: string[] }> = [
  { name: '.lightbox (parity)', selector: '.photos-root .lightbox {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.lb-confirm-scrim', selector: '.photos-root .lb-confirm-scrim {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.sv-modal-scrim', selector: '.photos-root .sv-modal-scrim {', files: ['photos/styles/vue2-parity/photos-smartview.scss'] },
  { name: '.albums-modal-scrim', selector: '.photos-root .albums-modal-scrim {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.album-picker-overlay', selector: '.photos-root .album-picker-overlay {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.picker-scrim', selector: '.picker-scrim {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.sv-select-bar', selector: '.photos-root .sv-select-bar {', files: ['photos/styles/vue2-parity/photos-smartview.scss'] },
  { name: '.sv-toast', selector: '.photos-root .sv-toast {', files: ['photos/styles/vue2-parity/photos-smartview.scss'] },
  // These three previously carried Vue2's original low z-index values
  // (50/50/60) as dead CSS -- nothing consumed them yet. Bumped below alongside the components
  // that finally use them, normalized to this codebase's existing overlay/menu tiers rather than
  // kept at Vue2's raw numbers (see photos-people.scss:1330 (rule start) / :1338 (z-index)'s
  // own precedent for `.cluster-menu`).
  { name: '.nimo-pop', selector: '.photos-root .nimo-pop {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.chat-drawer', selector: '.photos-root .chat-drawer {', files: ['photos/styles/vue2-parity/photos.scss'] },
  { name: '.nimo-mp-list', selector: '.photos-root .nimo-mp-list {', files: ['photos/styles/vue2-parity/photos.scss'] },
  // PhotosFavorites.vue's save-as-album
  // naming modal scrim -- originally a New-UI-only bespoke `.favsave-scrim` living in the
  // component's own `<style scoped>`; later re-skinned the template onto Vue2
  // PhotosFavoritesView.vue's own `.fav-modal-scrim` anchor, whose rule (bare selector, matching
  // Vue2's own lack of a `.photos-root`-equivalent wrapper) already lived in parity photos.scss
  // byte-exact and unused. Same subtree rule as every other overlay in this table (nests as a
  // `.photos-root` descendant, see the component's template).
  { name: '.fav-modal-scrim', selector: '.fav-modal-scrim {', files: ['photos/styles/vue2-parity/photos.scss'] },
  // The Favorites slideshow overlay -- parity-sourced (photos.scss), bare
  // top-level selector (no `.photos-root ` prefix, same shape as `.picker-scrim` above), already
  // carries z-index: 400 (well above the 100 floor and above every other overlay in this table).
  { name: '.fav-slideshow', selector: '.fav-slideshow {', files: ['photos/styles/vue2-parity/photos.scss'] },
  // PhotosTrash.vue's confirm modal scrim -- parity-sourced (photos.scss), bare
  // top-level selector (no `.photos-root ` prefix, same shape as `.picker-scrim`/`.fav-slideshow`
  // above). Its re-shell deleted PhotosTrash.vue's own local duplicate of this rule
  // (redundant with the globally-imported parity copy), so the only surviving declaration lives
  // in the parity file, not the component's own `<style scoped>`.
  { name: '.trash-modal-scrim', selector: '.trash-modal-scrim {', files: ['photos/styles/vue2-parity/photos.scss'] },
]

describe('sibling-of-.app overlays keep an explicit z-index above .app\'s own (1)', () => {
  for (const { name, selector, files } of OVERLAYS) {
    it(`${name} declares position:fixed with an explicit numeric z-index >= ${MIN_Z}`, () => {
      const bodies = files.flatMap((f) => ruleBodies(read(f), selector))
      expect(bodies.length, `rule ${selector} not found in ${files.join(', ')}`).toBeGreaterThan(0)
      for (const body of bodies) {
        expect(body, `${selector} is missing position:fixed`).toMatch(/position\s*:\s*fixed/)
        const m = /z-index\s*:\s*(-?\d+)/.exec(body)
        expect(m, `${selector} has no explicit numeric z-index (or degraded to auto) -- exactly the failure shape the hypothesis above describes`).not.toBeNull()
        expect(Number(m?.[1])).toBeGreaterThanOrEqual(MIN_Z)
      }
    })
  }

  it(".app itself stays at z-index:1 (the floor every overlay above must clear)", () => {
    const body = ruleBodies(read('photos/styles/vue2-parity/photos.scss'), '.photos-root .app {')[0]
    expect(body).toMatch(/position\s*:\s*relative/)
    expect(body).toMatch(/z-index\s*:\s*1\b/)
  })
})

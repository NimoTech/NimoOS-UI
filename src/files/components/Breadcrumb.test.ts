import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Breadcrumb from './Breadcrumb.vue'
import { parseCssRules } from '../../styles/__tests__/cssCascade'

const opts = { global: { stubs: { FavoriteStar: true } } }

const SELF_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'Breadcrumb.vue')

function extractStyle(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('style block not found')
  // Strip comments first: parseCssRules treats everything before a `{` as the
  // selector, so a comment sitting above a rule would otherwise get folded into it.
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

// Cascade-aware guard: a plain source-text regex on `.crumb`
// cannot distinguish the bare class selector from a type-qualified one like
// `button.crumb` — the current-segment <span> only avoids the pointer cursor
// because no rule matching it (by both tag and class) declares `cursor: pointer`.
// This walks every selector of every rule and requires a leading type name (if
// any) to match the element's actual tag, so it reflects real CSS matching
// instead of doing a substring match that a same-named-but-differently-scoped
// rule elsewhere in the file could silently satisfy.
function selectorMatchesElement(selector: string, tag: string, classes: string[]): boolean {
  const bare = selector.replace(/:[\w-]+(?:\([^)]*\))?/g, '')
  const typeMatch = /^([a-zA-Z][\w-]*)/.exec(bare)
  const type = typeMatch ? typeMatch[1] : null
  if (type && type.toLowerCase() !== tag.toLowerCase()) return false
  const classHits = bare.match(/\.[\w-]+/g) ?? []
  return classHits.length > 0 && classHits.every((c) => classes.includes(c.slice(1)))
}

function hasCursorPointerForElement(css: string, tag: string, classes: string[]): boolean {
  return parseCssRules(css).some(
    (rule) => /cursor:\s*pointer/.test(rule.body) && rule.selectors.some((s) => selectorMatchesElement(s, tag, classes)),
  )
}

describe('Breadcrumb', () => {
  it('renders clickable segments from the virtual path', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    expect(w.findAll('.crumb').map((c) => c.text())).toEqual(['NimoOS-HD', 'Documents', 'Reports'])
  })

  it('emits navigate with the accumulated VIRTUAL path (never a real /DATA path)', async () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    await w.findAll('.crumb')[1].trigger('click') // "Documents"
    const ev = w.emitted('navigate')
    expect(ev).toBeTruthy()
    expect(ev![0][0]).toBe('/NimoOS-HD/Documents')
    expect(ev![0][0]).not.toContain('/DATA')
  })

  it('renders a favorite star for the current folder', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents', currentRealPath: '/DATA/Documents' }, ...opts })
    expect(w.find('.crumb-star').exists()).toBe(true)
  })

  // Snapshots are read-only -- Vue2's own
  // GirdView.vue hides the favorite affordance while `isInSnapshot` ("never while browsing a
  // snapshot"). The caller passes `browse.isSnapshotView` as `hideFavorite`; this also restores
  // front/back parity with SnapshotPreviewWindow.vue's hand-copied breadcrumb, which never had a
  // star to begin with.
  it('hides the favorite star when hideFavorite is set (snapshot view)', () => {
    const w = mount(Breadcrumb, {
      props: { virtualPath: '/NimoOS-HD/Documents', currentRealPath: '/DATA/Documents', hideFavorite: true },
      ...opts,
    })
    expect(w.find('.crumb-star').exists()).toBe(false)
  })

  it('still shows the favorite star when hideFavorite is false/unset (normal browsing)', () => {
    const w = mount(Breadcrumb, {
      props: { virtualPath: '/NimoOS-HD/Documents', currentRealPath: '/DATA/Documents', hideFavorite: false },
      ...opts,
    })
    expect(w.find('.crumb-star').exists()).toBe(true)
  })

  it('does not navigate when the current directory segment is clicked', async () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    const crumbs = w.findAll('.crumb')
    await crumbs[crumbs.length - 1].trigger('click')
    expect(w.emitted('navigate')).toBeUndefined()
  })

  it('still navigates from an ancestor segment', async () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    await w.findAll('.crumb')[0].trigger('click')
    expect(w.emitted('navigate')).toBeTruthy()
  })

  it('renders the current segment as a non-interactive element, not a button', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    const crumbs = w.findAll('.crumb')
    expect(crumbs[crumbs.length - 1].element.tagName).not.toBe('BUTTON')
  })

  it('does not resolve a pointer cursor for the current segment (cascade-aware)', () => {
    const css = extractStyle(fs.readFileSync(SELF_PATH, 'utf8'))
    // The current segment renders as <span class="crumb current">.
    expect(hasCursorPointerForElement(css, 'span', ['crumb', 'current'])).toBe(false)
  })

  it('still resolves a pointer cursor for a navigable ancestor segment (cascade-aware)', () => {
    const css = extractStyle(fs.readFileSync(SELF_PATH, 'utf8'))
    // Ancestor segments render as <button class="crumb">.
    expect(hasCursorPointerForElement(css, 'button', ['crumb'])).toBe(true)
  })

  // ── Two-line cap ─────────────────────────────────────────────────────────
  // Only the parts that survive without a layout engine are asserted here. jsdom
  // reports every box as 0x0, so the measuring loop can never collapse anything
  // and the geometry itself has to be verified in a real browser.

  it('hides nothing and caps nothing when the environment reports no layout', async () => {
    const deep = '/NimoOS-HD/a/b/c/d/e/f/g/h'
    const w = mount(Breadcrumb, { props: { virtualPath: deep, currentRealPath: '/DATA/a/b/c/d/e/f/g/h' }, ...opts })
    await w.vm.$nextTick()
    // An unmeasured breadcrumb must not clip: a max-height guessed from nothing
    // would swallow levels the user still has room for.
    expect(w.find('nav.breadcrumb').attributes('style')).toBeUndefined()
    expect(w.find('.crumb-more').exists()).toBe(false)
    expect(w.findAll('.crumb').map((c) => c.text())).toEqual(['NimoOS-HD', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
  })

  it('keeps the overflow backstop that stops an unsettled frame from showing a third row', () => {
    const css = extractStyle(fs.readFileSync(SELF_PATH, 'utf8'))
    const nav = parseCssRules(css).find((r) => r.selectors.includes('.breadcrumb'))
    expect(nav).toBeTruthy()
    expect(/overflow:\s*hidden/.test(nav!.body)).toBe(true)
    // Wrapping stays: within two rows the crumbs are still meant to wrap normally.
    expect(/flex-wrap:\s*wrap/.test(nav!.body)).toBe(true)
  })
})

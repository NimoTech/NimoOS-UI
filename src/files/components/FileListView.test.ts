import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileListView from './FileListView.vue'
import { parseCssRules } from '../../styles/__tests__/cssCascade'

const SELF_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'FileListView.vue')

const opts = {
  global: { stubs: { FileRow: true } },
}

function extractStyle(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('style block not found')
  // Strip comments first: parseCssRules treats everything before a `{` as the
  // selector, so a comment sitting above a rule would otherwise get folded into it.
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

// Cascade-aware guard, fix round 1 · F2: a source-text regex anchored on the
// literal `.head-cell { ... cursor: pointer` string can be defeated by adding an
// unrelated rule elsewhere in the same style block, e.g.
// `.col-check, .col-star { cursor: pointer; }` — that rule never contains the
// substring `.head-cell {`, so the old regex kept passing while the spacer cells
// got a pointer cursor again. This instead parses every rule, splits each rule's
// comma-separated selector list into individual selectors (all these header
// cells are plain <span> elements, so no element-tag matching is needed here),
// and checks whether ANY selector arm's class set is a subset of the target
// cell's classes.
function hasCursorPointerForClasses(css: string, classes: string[]): boolean {
  for (const rule of parseCssRules(css)) {
    if (!/cursor:\s*pointer/.test(rule.body)) continue
    for (const selector of rule.selectors) {
      const bare = selector.replace(/:[\w-]+(?:\([^)]*\))?/g, '')
      const classHits = bare.match(/\.[\w-]+/g) ?? []
      if (classHits.length > 0 && classHits.every((c) => classes.includes(c.slice(1)))) return true
    }
  }
  return false
}

describe('FileListView', () => {
  it('does not give the checkbox spacer cell a pointer cursor under any selector (cascade-aware)', () => {
    const css = extractStyle(fs.readFileSync(SELF_PATH, 'utf8'))
    expect(hasCursorPointerForClasses(css, ['head-cell', 'col-check'])).toBe(false)
  })

  it('does not give the star spacer cell a pointer cursor under any selector (cascade-aware)', () => {
    const css = extractStyle(fs.readFileSync(SELF_PATH, 'utf8'))
    expect(hasCursorPointerForClasses(css, ['head-cell', 'col-star'])).toBe(false)
  })

  it('gives the sortable header cells a pointer cursor (cascade-aware)', () => {
    const css = extractStyle(fs.readFileSync(SELF_PATH, 'utf8'))
    expect(hasCursorPointerForClasses(css, ['head-cell', 'is-sortable', 'col-name'])).toBe(true)
  })

  it('marks the sortable header cells with the is-sortable class', () => {
    const w = mount(FileListView, { props: { entries: [], sort: 'name', order: 'asc' }, ...opts })
    const sortable = w.findAll('.head-cell.col-name, .head-cell.col-format, .head-cell.col-date, .head-cell.col-size')
    expect(sortable.length).toBe(4)
    for (const cell of sortable) {
      expect(cell.classes()).toContain('is-sortable')
    }
  })

  it('does not mark the checkbox and star spacer cells as sortable', () => {
    const w = mount(FileListView, { props: { entries: [], sort: 'name', order: 'asc' }, ...opts })
    expect(w.find('.head-cell.col-check').classes()).not.toContain('is-sortable')
    expect(w.find('.head-cell.col-star').classes()).not.toContain('is-sortable')
  })
})

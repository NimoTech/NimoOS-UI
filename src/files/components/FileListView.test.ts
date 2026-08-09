import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileListView from './FileListView.vue'

const SELF_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'FileListView.vue')

const opts = {
  global: { stubs: { FileRow: true } },
}

describe('FileListView', () => {
  // cssCascade-style check: read the source CSS directly since jsdom does not
  // compute layout/cursor styles.
  it('does not give the non-sortable header cells a pointer cursor', () => {
    const css = fs.readFileSync(SELF_PATH, 'utf8')
    // cursor:pointer must be scoped to the cells that actually sort, not the
    // catch-all .head-cell that also matches the checkbox/star spacer cells.
    expect(css).not.toMatch(/\.head-cell\s*\{[^}]*cursor:\s*pointer/)
  })

  it('still gives the sortable header cells a pointer cursor', () => {
    const css = fs.readFileSync(SELF_PATH, 'utf8')
    expect(css).toMatch(/\.head-cell\.is-sortable\s*\{[^}]*cursor:\s*pointer/)
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

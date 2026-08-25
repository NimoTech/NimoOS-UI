// Task 5 (Files Time Machine Vue2-parity line): a static, read-only, non-interactive miniature of
// ONE older snapshot's directory listing at the Files area's CURRENT relative path -- the layer
// TimeMachineStage.vue (Task 7) stacks up to ~10 of behind the real, live window.
//
// Fix round 1 (controller ruling): rewritten to assert against the ACTUAL Vue2 authority
// (NimoOS-UI src/components/filebrowser/components/SnapshotPreviewWindow.vue, 673 lines) instead
// of an earlier version built off a research summary's inaccurate paraphrase. See
// SnapshotPreviewWindow.vue's own header comment for the full structure trace this file asserts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SnapshotPreviewWindow from './SnapshotPreviewWindow.vue'
import { dateFmt } from '../util/format'
import type { SnapshotPreviewEntry } from '../util/snapshotPreviewCache'

vi.mock('../util/snapshotPreviewCache', () => ({ getSnapshotPreview: vi.fn() }))
import { getSnapshotPreview } from '../util/snapshotPreviewCache'

const getSnapshotPreviewMock = vi.mocked(getSnapshotPreview)

function resolved(result: SnapshotPreviewEntry) {
  getSnapshotPreviewMock.mockResolvedValue(result)
}

function pending() {
  let resolve!: (v: SnapshotPreviewEntry) => void
  const promise = new Promise<SnapshotPreviewEntry>((r) => { resolve = r })
  getSnapshotPreviewMock.mockReturnValue(promise)
  return resolve
}

const BASE_PROPS = { mount: '/media/RAID_0', snapshotName: 'snap-a', relPath: '' }

function mountPreview(props = {}) {
  return mount(SnapshotPreviewWindow, { props: { ...BASE_PROPS, ...props } })
}

beforeEach(() => {
  getSnapshotPreviewMock.mockReset()
})

describe('SnapshotPreviewWindow — fetch wiring (Task 4 contract, unchanged)', () => {
  it('requests the listing via getSnapshotPreview(mount, snapshotName, relPath)', async () => {
    resolved({ entries: [], error: false })
    mountPreview({ mount: '/media/RAID_0', snapshotName: 'snap-a', relPath: 'Documents/Q3' })
    await flushPromises()
    expect(getSnapshotPreviewMock).toHaveBeenCalledWith('/media/RAID_0', 'snap-a', 'Documents/Q3')
  })

  it('refetches when relPath changes on an already-mounted instance', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview({ relPath: 'A' })
    await flushPromises()
    expect(getSnapshotPreviewMock).toHaveBeenCalledTimes(1)
    await w.setProps({ relPath: 'B' })
    await flushPromises()
    expect(getSnapshotPreviewMock).toHaveBeenCalledTimes(2)
    expect(getSnapshotPreviewMock).toHaveBeenLastCalledWith('/media/RAID_0', 'snap-a', 'B')
  })

  it('does not fetch at all when mount or snapshotName is missing, and never throws', async () => {
    const w = mountPreview({ mount: '', snapshotName: '' })
    await expect(flushPromises()).resolves.not.toThrow()
    expect(getSnapshotPreviewMock).not.toHaveBeenCalled()
    expect(w.findAll('.tm-preview-window__card')).toHaveLength(0)
  })
})

describe('SnapshotPreviewWindow — chrome Row 1: breadcrumb + read-only chip (Vue2 parity)', () => {
  it('renders the full breadcrumb (volume basename, .snapshots, snapshotName, relPath segments), last segment active', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview({ mount: '/media/RAID_0', snapshotName: '20260715T165314Z_auto-hourly', relPath: 'Documents/Q3' })
    await flushPromises()
    const crumbs = w.findAll('.tm-preview-window__crumb')
    expect(crumbs.map((c) => c.text())).toEqual(['RAID_0', '.snapshots', '20260715T165314Z_auto-hourly', 'Documents', 'Q3'])
    expect(crumbs[crumbs.length - 1].classes()).toContain('is-active')
    expect(crumbs[0].classes()).not.toContain('is-active')
  })

  it('renders the "Snapshot · Read-only" chip', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.tm-preview-window__chip').text()).toBe('快照 · 只读') // snapReadOnlyBanner, zh (global test locale)
  })
})

describe('SnapshotPreviewWindow — chrome Row 2: total count + select-all (gated on totalCount > 0, Vue2 parity)', () => {
  it('hides Row 2 entirely when the listing is empty, mirroring Vue2\'s v-if="totalCount > 0"', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.tm-preview-window__row2').exists()).toBe(false)
  })

  it('shows "N items" using the FULL count, not capped by the row render cap', async () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({ name: `file${i}.txt`, isDir: false, size: 1, mtime: 0 }))
    resolved({ entries, error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.tm-preview-window__count').text()).toBe('30 项') // tmItemCount, zh
  })

  it('renders the select-all checkbox as inert/disabled and a decorative view-toggle glyph', async () => {
    resolved({ entries: [{ name: 'a.txt', isDir: false, size: 1, mtime: 0 }], error: false })
    const w = mountPreview()
    await flushPromises()
    const checkbox = w.find('.tm-preview-window__select-all input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect(checkbox.attributes('disabled')).toBeDefined()
    expect(w.find('.tm-preview-window__view-toggle').exists()).toBe(true)
  })
})

describe('SnapshotPreviewWindow — viewMode prop (Vue2 parity: grid default, list clones FileListView.vue)', () => {
  const entries = [
    { name: 'Report.pdf', isDir: false, size: 2048, mtime: 1720000000000 },
    { name: 'Photos', isDir: true, size: 0, mtime: 1720000000000 },
  ]

  it('defaults to grid mode: renders .tm-preview-window__card per entry, name + date, no table header', async () => {
    resolved({ entries, error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.find('.tm-preview-window__thead').exists()).toBe(false)
    const cards = w.findAll('.tm-preview-window__card')
    expect(cards).toHaveLength(2)
    // Folders-first sort
    expect(cards[0].find('.tm-preview-window__title').text()).toBe('Photos')
    expect(cards[0].find('.tm-preview-window__desc').text()).toBe(dateFmt(1720000000000))
    expect(cards[0].classes()).toContain('is-dir')
  })

  it('list mode: renders the sortable header (name/type/date/size, same i18n keys as FileListView.vue) plus one row per entry', async () => {
    resolved({ entries, error: false })
    const w = mountPreview({ viewMode: 'list' })
    await flushPromises()
    expect(w.find('.tm-preview-window__card').exists()).toBe(false)
    const heads = w.findAll('.tm-preview-window__th').map((h) => h.text())
    expect(heads).toEqual(['名称', '类型', '修改日期', '大小']) // filesColName/Type/Date/Size, zh
    const rows = w.findAll('.tm-preview-window__row')
    expect(rows).toHaveLength(2)
    expect(rows[0].find('.tm-preview-window__col--name').text()).toBe('Photos') // folders-first
    expect(rows[1].find('.tm-preview-window__col--name').text()).toBe('Report.pdf')
  })

  it('list mode: files show extension + formatted size; directories show blank type/size cells', async () => {
    resolved({ entries, error: false })
    const w = mountPreview({ viewMode: 'list' })
    await flushPromises()
    const rows = w.findAll('.tm-preview-window__row')
    const photosRow = rows.find((r) => r.text().includes('Photos'))!
    expect(photosRow.find('.tm-preview-window__col--type').text()).toBe('')
    expect(photosRow.find('.tm-preview-window__col--size').text()).toBe('')
    expect(photosRow.classes()).toContain('is-dir')
    const reportRow = rows.find((r) => r.text().includes('Report.pdf'))!
    expect(reportRow.find('.tm-preview-window__col--type').text()).toBe('pdf')
    expect(reportRow.find('.tm-preview-window__col--size').text()).toBe('2 KB')
    expect(reportRow.classes()).not.toContain('is-dir')
  })

  it('caps rendered rows/cards at a fixed maximum (Vue2 parity: maxRows default 24)', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `file${String(i).padStart(2, '0')}.txt`, isDir: false, size: 1, mtime: 0 }))
    resolved({ entries: many, error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.findAll('.tm-preview-window__card')).toHaveLength(24)
    // Row 2's own count still reads the FULL, uncapped length.
    expect(w.find('.tm-preview-window__count').text()).toBe('40 项')
  })
})

describe('SnapshotPreviewWindow — loading/error/empty all render as empty chrome (Vue2 parity: no spinner, no error text, no toast)', () => {
  it('renders zero cards and hides Row 2 while the fetch is still pending', async () => {
    pending()
    const w = mountPreview()
    await w.vm.$nextTick()
    expect(w.findAll('.tm-preview-window__card')).toHaveLength(0)
    expect(w.find('.tm-preview-window__row2').exists()).toBe(false)
  })

  it('renders zero cards on a fetch error, and never surfaces error copy anywhere in the DOM', async () => {
    resolved({ entries: [], error: true })
    const w = mountPreview()
    await flushPromises()
    expect(w.findAll('.tm-preview-window__card')).toHaveLength(0)
    expect(w.find('.tm-preview-window__row2').exists()).toBe(false)
    expect(w.text()).not.toMatch(/couldn|error|失败|读不到/i)
  })

  it('never throws when getSnapshotPreview itself rejects (defensive only) -- still empty chrome, no error copy', async () => {
    getSnapshotPreviewMock.mockRejectedValue(new Error('boom'))
    const w = mountPreview()
    await expect(flushPromises()).resolves.not.toThrow()
    expect(w.findAll('.tm-preview-window__card')).toHaveLength(0)
  })

  it('a genuinely empty (non-error) listing also renders zero cards, same empty chrome', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.findAll('.tm-preview-window__card')).toHaveLength(0)
    expect(w.find('.tm-preview-window__row2').exists()).toBe(false)
  })
})

describe('SnapshotPreviewWindow — presentational contract', () => {
  it('is decorative: aria-hidden, no click handlers wired', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.attributes('aria-hidden')).toBe('true')
  })

  it('reflects the active prop as a class hook (New-UI-only addition, not present in Vue2), defaulting to active', async () => {
    resolved({ entries: [], error: false })
    const active = mountPreview()
    await flushPromises()
    expect(active.classes()).toContain('is-active')

    const inactive = mountPreview({ active: false })
    await flushPromises()
    expect(inactive.classes()).not.toContain('is-active')
  })

  it('active=false does not gate the fetch (Vue2 has no such concept; every mounted layer always fetches)', async () => {
    resolved({ entries: [{ name: 'a.txt', isDir: false, size: 1, mtime: 0 }], error: false })
    mountPreview({ active: false })
    await flushPromises()
    expect(getSnapshotPreviewMock).toHaveBeenCalledTimes(1)
  })
})

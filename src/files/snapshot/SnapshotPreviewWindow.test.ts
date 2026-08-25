// Task 5 (Files Time Machine Vue2-parity line): a static, read-only, non-interactive miniature of
// ONE older snapshot's directory listing at the Files area's CURRENT relative path -- the layer
// TimeMachineStage.vue (Task 7) stacks up to ~10 of behind the real, live window. Vue2 authority:
// NimoOS-UI src/components/filebrowser/components/SnapshotPreviewWindow.vue -- but this is NOT a
// byte-for-byte clone (that file grew into a full grid/list clone of the real file browser, wired
// to $api.folder.getList + Vuex sort/order + Buefy breadcrumbs). This task's own brief instead asks
// for a much smaller "miniature Finder window": window chrome with a title bar showing the
// snapshot's time, a three-column list (name/size/time), a loading skeleton, and an error
// placeholder -- built against Task 4's own simplified `getSnapshotPreview` contract (no store, no
// view-mode toggle, no breadcrumb chip). See task-5-report.md for the full design-decision trace.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SnapshotPreviewWindow from './SnapshotPreviewWindow.vue'
import { formatSnapshotBannerTime } from '../util/snapshotPath'
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

const BASE_PROPS = { mount: '/DATA', snapshotName: '20260712T101502Z_manual_x', relPath: '' }

function mountPreview(props = {}) {
  return mount(SnapshotPreviewWindow, { props: { ...BASE_PROPS, ...props } })
}

beforeEach(() => {
  getSnapshotPreviewMock.mockReset()
})

describe('SnapshotPreviewWindow — title bar time label (parseSnapshotName semantics)', () => {
  it('shows formatSnapshotBannerTime(snapshotName) for a well-formed snapshot name', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview({ snapshotName: '20260712T101502Z_manual_x' })
    await flushPromises()
    expect(w.find('.tm-preview-window__time').text()).toBe(formatSnapshotBannerTime('20260712T101502Z_manual_x'))
  })

  it('falls back to the raw name for an unparseable snapshot name (never blank, never throws)', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview({ snapshotName: 'not-a-real-snapshot-name' })
    await flushPromises()
    expect(w.find('.tm-preview-window__time').text()).toBe('not-a-real-snapshot-name')
  })
})

describe('SnapshotPreviewWindow — fetch wiring', () => {
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
    expect(getSnapshotPreviewMock).toHaveBeenLastCalledWith('/DATA', '20260712T101502Z_manual_x', 'B')
  })
})

describe('SnapshotPreviewWindow — loading skeleton', () => {
  it('shows a skeleton (no list, no placeholder) while the fetch is still pending', async () => {
    pending()
    const w = mountPreview()
    await w.vm.$nextTick()
    expect(w.find('.tm-preview-window__skeleton').exists()).toBe(true)
    expect(w.find('.tm-preview-window__list').exists()).toBe(false)
    expect(w.find('.tm-preview-window__placeholder').exists()).toBe(false)
  })

  it('replaces the skeleton with the list once the fetch resolves', async () => {
    const resolve = pending()
    const w = mountPreview()
    await w.vm.$nextTick()
    expect(w.find('.tm-preview-window__skeleton').exists()).toBe(true)
    resolve({ entries: [{ name: 'a.txt', isDir: false, size: 10, mtime: 0 }], error: false })
    await flushPromises()
    expect(w.find('.tm-preview-window__skeleton').exists()).toBe(false)
    expect(w.find('.tm-preview-window__list').exists()).toBe(true)
  })
})

describe('SnapshotPreviewWindow — error placeholder', () => {
  it('shows the tmPreviewUnavailable copy when the cache reports error:true', async () => {
    resolved({ entries: [], error: true })
    const w = mountPreview()
    await flushPromises()
    const placeholder = w.find('.tm-preview-window__placeholder')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('暂时读不到这个文件夹的内容') // tmPreviewUnavailable (zh, global test locale)
    expect(w.find('.tm-preview-window__list').exists()).toBe(false)
  })

  it('shows the tmNoFolderAtTime copy for a genuinely empty, non-error listing (folder did not exist yet)', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview()
    await flushPromises()
    const placeholder = w.find('.tm-preview-window__placeholder')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('此时还没有这个文件夹') // tmNoFolderAtTime (zh, global test locale)
  })

  it('never throws when getSnapshotPreview itself rejects (defensive -- the real contract never rejects, but this component must not assume that forever)', async () => {
    getSnapshotPreviewMock.mockRejectedValue(new Error('boom'))
    const w = mountPreview()
    await expect(flushPromises()).resolves.not.toThrow()
    expect(w.find('.tm-preview-window__placeholder').text()).toBe('暂时读不到这个文件夹的内容')
  })
})

describe('SnapshotPreviewWindow — row rendering (row count from mock data, dir-vs-file)', () => {
  const entries = [
    { name: 'Report.pdf', isDir: false, size: 2048, mtime: 1720000000000 },
    { name: 'Photos', isDir: true, size: 0, mtime: 1720000000000 },
    { name: 'notes.txt', isDir: false, size: 128, mtime: 1720000000000 },
  ]

  it('renders one row per entry (row count = mock data length)', async () => {
    resolved({ entries, error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.findAll('.tm-preview-window__row')).toHaveLength(3)
  })

  it('sorts folders first, then alphabetically', async () => {
    resolved({ entries, error: false })
    const w = mountPreview()
    await flushPromises()
    const names = w.findAll('.tm-preview-window__col--name').map((n) => n.text())
    expect(names).toEqual(['Photos', 'notes.txt', 'Report.pdf'])
  })

  it('files show a formatted size; directories show a dash, never a byte count', async () => {
    resolved({ entries, error: false })
    const w = mountPreview()
    await flushPromises()
    const rows = w.findAll('.tm-preview-window__row')
    const photosRow = rows.find((r) => r.text().includes('Photos'))!
    expect(photosRow.find('.tm-preview-window__col--size').text()).toBe('—')
    expect(photosRow.classes()).toContain('is-dir')
    const reportRow = rows.find((r) => r.text().includes('Report.pdf'))!
    expect(reportRow.find('.tm-preview-window__col--size').text()).toBe('2 KB')
    expect(reportRow.classes()).not.toContain('is-dir')
  })

  it('caps rendered rows at a fixed maximum (perf guardrail across up to 10 concurrent depth-stack layers)', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `file${String(i).padStart(2, '0')}.txt`, isDir: false, size: 1, mtime: 0 }))
    resolved({ entries: many, error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.findAll('.tm-preview-window__row').length).toBeLessThan(40)
  })
})

describe('SnapshotPreviewWindow — presentational contract', () => {
  it('is decorative: aria-hidden, no click handlers wired', async () => {
    resolved({ entries: [], error: false })
    const w = mountPreview()
    await flushPromises()
    expect(w.attributes('aria-hidden')).toBe('true')
  })

  it('reflects the active prop as a class hook, defaulting to active', async () => {
    resolved({ entries: [], error: false })
    const active = mountPreview()
    await flushPromises()
    expect(active.classes()).toContain('is-active')

    const inactive = mountPreview({ active: false })
    await flushPromises()
    expect(inactive.classes()).not.toContain('is-active')
  })

  it('does not fetch at all when mount or snapshotName is missing', async () => {
    const w = mountPreview({ mount: '', snapshotName: '' })
    await flushPromises()
    expect(getSnapshotPreviewMock).not.toHaveBeenCalled()
    expect(w.find('.tm-preview-window__placeholder').exists()).toBe(true)
  })
})

// Task 13 (Files Time Machine Vue2-parity line): ports the intent of Vue2 NimoOS-UI's
// tests/restoreDestinationModal.test.js against this rebuild's own Promise-based `open()` API
// (no `visible`/`confirm`/`close` props+events -- see RestoreDestinationModal.vue's own header
// comment) and real reka-ui/i18n stack, same mocking technique SnapshotSettingsModal.test.ts /
// FileConflictDialog.test.ts already established for this directory.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RestoreDestinationModal from './RestoreDestinationModal.vue'
import zh from '../../i18n/zh_cn'

const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getList: (p: string) => getListMock(p) } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

type ModalVm = { open: (mount: string, defaultDir: string) => Promise<{ destDir: string; withMarker: boolean } | null> }

const mountIt = () => mount(RestoreDestinationModal, { global: { plugins: [i18n] }, attachTo: document.body })
const vmOf = (w: ReturnType<typeof mountIt>) => w.vm as unknown as ModalVm

// reka-ui teleports DialogContent to <body> asynchronously (Presence) and fetchEntries() is
// itself async -- same double-flush convention SnapshotSettingsModal.test.ts already
// established for this exact "open() kicks off an async fetch" shape.
const flush = async (w: ReturnType<typeof mountIt>) => {
  await flushPromises()
  await w.vm.$nextTick()
  await w.vm.$nextTick()
}

const btn = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('RestoreDestinationModal — open() defaults', () => {
  it('seeds the current directory from defaultDir and fetches its subfolders', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    expect(document.querySelector('.rdm-current-dir')?.textContent).toBe('/media/RAID_0/Documents')
    expect(getListMock).toHaveBeenCalledWith('/media/RAID_0/Documents')
  })

  it('falls back to the volume mount root when defaultDir is empty', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '')
    await flush(w)
    expect(document.querySelector('.rdm-current-dir')?.textContent).toBe('/media/RAID_0')
  })

  it('defaults the .restored marker toggle to ON, with no off-hint shown', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    expect(document.querySelector('.rdm-switch')?.classList.contains('rdm-switch--on')).toBe(true)
    expect(document.querySelector('.rdm-marker-note')).toBeFalsy()
  })

  it('re-seeds the current directory back to a fresh defaultDir on every open() call', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const w = mountIt()
    const first = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    ;(document.querySelector('.rdm-close-x') as HTMLElement).click()
    expect(await first).toBeNull()

    const second = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Photos')
    await flush(w)
    expect(document.querySelector('.rdm-current-dir')?.textContent).toBe('/media/RAID_0/Photos')
    ;(document.querySelector('.rdm-close-x') as HTMLElement).click()
    await second
  })
})

describe('RestoreDestinationModal — drill-down navigation', () => {
  it('lists only subdirectories (never files), sorted, and clicking one descends into it', async () => {
    getListMock.mockResolvedValueOnce({
      content: [
        { name: 'Q3', path: '/media/RAID_0/Documents/Q3', is_dir: true },
        { name: 'report.docx', path: '/media/RAID_0/Documents/report.docx', is_dir: false },
      ],
    })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    const entryEls = [...document.querySelectorAll('.rdm-entry')]
    expect(entryEls.map((e) => e.querySelector('.rdm-entry-name')?.textContent)).toEqual(['Q3'])

    getListMock.mockResolvedValueOnce({ content: [] })
    ;(entryEls[0] as HTMLElement).click()
    await flush(w)
    expect(document.querySelector('.rdm-current-dir')?.textContent).toBe('/media/RAID_0/Documents/Q3')
    expect(getListMock).toHaveBeenCalledWith('/media/RAID_0/Documents/Q3')
  })

  it('shows "No subfolders here" instead of an empty list', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    expect(document.body.textContent).toContain('此处没有子文件夹')
  })

  it('breadcrumb reflects the drill-down path down to the mount root; clicking an earlier crumb jumps back up', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents/Q3')
    await flush(w)
    const crumbs = [...document.querySelectorAll('.rdm-crumb')]
    expect(crumbs.map((c) => c.textContent)).toEqual(['/media/RAID_0', 'Documents', 'Q3'])

    ;(crumbs[1] as HTMLElement).click()
    await flush(w)
    expect(document.querySelector('.rdm-current-dir')?.textContent).toBe('/media/RAID_0/Documents')
    expect(getListMock).toHaveBeenCalledWith('/media/RAID_0/Documents')
  })

  it('does not re-fetch when the current (last, disabled) breadcrumb crumb is clicked', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    getListMock.mockClear()
    const crumbs = [...document.querySelectorAll('.rdm-crumb')]
    ;(crumbs[crumbs.length - 1] as HTMLElement).click()
    await flush(w)
    expect(getListMock).not.toHaveBeenCalled()
  })
})

describe('RestoreDestinationModal — the ".restored marker" toggle + hint', () => {
  it('shows the "you\'ll be asked" hint once the toggle is switched off', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    ;(document.querySelector('.rdm-switch') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(document.body.textContent).toContain("同名文件会询问你如何处理")
    expect(document.querySelector('.rdm-switch')?.classList.contains('rdm-switch--on')).toBe(false)
  })

  it('withMarker is a session-only preference -- NOT reset back to true across a second open()', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const w = mountIt()
    const first = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    ;(document.querySelector('.rdm-switch') as HTMLElement).click()
    await w.vm.$nextTick()
    ;(document.querySelector('.rdm-close-x') as HTMLElement).click()
    await first

    const second = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Photos')
    await flush(w)
    expect(document.querySelector('.rdm-switch')?.classList.contains('rdm-switch--on')).toBe(false)
    ;(document.querySelector('.rdm-close-x') as HTMLElement).click()
    await second
  })
})

describe('RestoreDestinationModal — confirm/cancel resolution', () => {
  it('confirm resolves with the currently-browsed directory and the toggle state', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    const promise = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    ;(document.querySelector('.rdm-switch') as HTMLElement).click()
    await w.vm.$nextTick()
    btn('取回到此处')!.click()
    expect(await promise).toEqual({ destDir: '/media/RAID_0/Documents', withMarker: false })
  })

  it('confirm reflects the currently-browsed directory after drilling down', async () => {
    getListMock.mockResolvedValueOnce({ content: [{ name: 'Q3', path: '/media/RAID_0/Documents/Q3', is_dir: true }] })
    const w = mountIt()
    const promise = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    getListMock.mockResolvedValueOnce({ content: [] })
    ;(document.querySelector('.rdm-entry') as HTMLElement).click()
    await flush(w)
    btn('取回到此处')!.click()
    expect(await promise).toEqual({ destDir: '/media/RAID_0/Documents/Q3', withMarker: true })
  })

  it('the Cancel footer button resolves null -- no restore should ever be triggered from this', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    const promise = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    btn('取消')!.click()
    expect(await promise).toBeNull()
  })

  it('the header close button resolves null', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    const promise = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    ;(document.querySelector('.rdm-close-x') as HTMLElement).click()
    expect(await promise).toBeNull()
  })

  it('Escape resolves null (reka-ui DialogRoot handles it internally)', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    const promise = vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(await promise).toBeNull()
  })
})

describe('RestoreDestinationModal — chrome', () => {
  it('renders the white-glass title', async () => {
    getListMock.mockResolvedValueOnce({ content: [] })
    const w = mountIt()
    void vmOf(w).open('/media/RAID_0', '/media/RAID_0/Documents')
    await flush(w)
    expect(document.body.textContent).toContain('取回到')
  })
})

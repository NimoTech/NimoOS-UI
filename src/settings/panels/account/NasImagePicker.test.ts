import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import NasImagePicker from './NasImagePicker.vue'

const storageList = vi.fn()
const raidList = vi.fn()
const folderGetList = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    folder: { getList: (...a: unknown[]) => folderGetList(...a) },
    image: { imageUrl: (p: string, t?: string) => `/v1/image?path=${encodeURIComponent(p)}&type=${t}` },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = () => new Promise((r) => setTimeout(r, 0))

// Real-device shape: in /v1/storage's children, size/avail are **strings**, and the
// system disk's mount_point is bare "/".
const STORAGE = [
  { path: '/dev/nvme0n1', disk_name: 'System', type: 'internal', children: [
    { uuid: 'u1', mount_point: '/', label: 'sys', drive_name: 'nvme0n1p7', size: '1000', avail: '400' },
    { uuid: 'u2', mount_point: '/mnt/Extra', label: 'Extra', drive_name: 'nvme0n1p8', size: '2000', avail: '1500' },
  ] },
]

// ⚠️ Use braces, don't return a chained mock (it gets treated as a teardown callback,
// see the comment in ChangePasswordForm.test.ts)
beforeEach(() => {
  storageList.mockReset()
  storageList.mockResolvedValue(STORAGE)
  raidList.mockReset()
  raidList.mockResolvedValue([])
  folderGetList.mockReset()
  folderGetList.mockResolvedValue({ content: [] })
})

function mountPicker() {
  return mount(NasImagePicker, { global: { plugins: [i18n] } })
}
type Exposed = { backToStorages(): void; openFolder(p: string): Promise<void> }

describe('NasImagePicker — parity with Vue2 state 6 (:763-846)', () => {
  it('fetches the storage list on mount; the /DATA card always sorts first', async () => {
    const w = mountPicker()
    await flush()
    const names = w.findAll('[data-test="nas-storage"]').map((n) => n.find('.set-nas-name').text())
    expect(names[0]).toBe('NimoOS-HD')
    expect(names).toContain('Extra')
  })

  it('cards with capacity show "used / total"; the /DATA card shows no capacity (Vue2 v-if="s.size")', async () => {
    const w = mountPicker()
    await flush()
    const cards = w.findAll('[data-test="nas-storage"]')
    expect(cards[0].find('.set-nas-sub').exists()).toBe(false)
    const extra = cards.find((c) => c.find('.set-nas-name').text() === 'Extra')!
    expect(extra.find('.set-nas-sub').text()).toBe('500 Bytes / 1.95 KB')
  })

  it('fetching the storage list fails → shows an error, not an empty grid', async () => {
    storageList.mockImplementation(async () => { throw new Error('boom') })
    const w = mountPicker()
    await flush()
    expect(w.find('.set-danger').exists()).toBe(true)
    expect(w.findAll('[data-test="nas-storage"]')).toHaveLength(0)
  })

  it('raid.list failing does not take down the whole screen (Vue2 :280 catches it separately into empty)', async () => {
    raidList.mockImplementation(async () => { throw new Error('no raid') })
    const w = mountPicker()
    await flush()
    expect(w.findAll('[data-test="nas-storage"]').length).toBeGreaterThan(0)
    expect(w.find('.set-danger').exists()).toBe(false)
  })

  it('clicking a storage card enters browse view, listing the directory at that card\'s path', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenCalledWith('/DATA')
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(true)
  })

  it('browse view lists only directories and images, filtering out hidden items', async () => {
    folderGetList.mockResolvedValue({ content: [
      { name: 'sub', path: '/DATA/sub', is_dir: true },
      { name: '.git', path: '/DATA/.git', is_dir: true },
      { name: 'a.png', path: '/DATA/a.png', is_dir: false },
      { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
    ] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.findAll('[data-test="nas-item"]').map((n) => n.find('.set-nas-item-name').text())).toEqual(['sub', 'a.png'])
  })

  it('drilling into a directory grows the breadcrumb one segment at a time (separator follows every non-final segment, same as Vue2 :804)', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA/sub')
    expect(w.findAll('[data-test="nas-crumb"]').map((n) => n.text())).toEqual(['NimoOS-HD/', 'sub'])
  })

  it('clicking a middle breadcrumb segment goes back up; clicking the last segment sends no request (Vue2\'s i < len-1 guard)', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    const before = folderGetList.mock.calls.length
    await w.findAll('[data-test="nas-crumb"]')[1].trigger('click') // last segment
    await flush()
    expect(folderGetList.mock.calls.length).toBe(before)
    await w.findAll('[data-test="nas-crumb"]')[0].trigger('click') // root segment
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA')
  })

  it('clicking an image emits pick, with src being /v1/image\'s original URL (plan C11: no arraybuffer path)', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'a.png', path: '/DATA/a.png', is_dir: false }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    expect(w.emitted('pick')).toEqual([[{
      path: '/DATA/a.png',
      src: `/v1/image?path=${encodeURIComponent('/DATA/a.png')}&type=original`,
    }]])
  })

  it('empty directory → shows "no image files here"', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.text()).toContain(zh.settingsAccNoImagesHere)
  })

  it('listing the directory fails → shows "failed to load folder"', async () => {
    folderGetList.mockImplementation(async () => { throw new Error('nope') })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccLoadFolderFailed)
  })

  it('the "up one level" button is disabled at the root directory (B6: attribute assertion)', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('[data-test="nas-up"]').attributes('disabled')).toBeDefined()
  })

  it('after drilling in, "up one level" returns to the parent directory', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    await w.find('[data-test="nas-up"]').trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA')
  })

  it('backToStorages returns to the storage-card grid and clears the browse state', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    ;(w.vm as unknown as Exposed).backToStorages()
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="nas-storage"]').length).toBeGreaterThan(0)
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(false)
  })

  it('switching directories quickly: a stale request must not overwrite the new directory (inline generation guard, plan C8)', async () => {
    // The first directory listing hangs, the second returns immediately; the stale one
    // must not be allowed to overwrite the list when it settles later
    let resolveFirst!: (v: unknown) => void
    folderGetList
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => ({ content: [{ name: 'new.png', path: '/DATA/sub/new.png', is_dir: false }] }))
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click') // First: hangs
    ;(w.vm as unknown as Exposed).openFolder('/DATA/sub') // Second: returns immediately
    await flush()
    resolveFirst({ content: [{ name: 'old.png', path: '/DATA/old.png', is_dir: false }] })
    await flush()
    expect(w.findAll('[data-test="nas-item"]').map((n) => n.find('.set-nas-item-name').text())).toEqual(['new.png'])
  })
})

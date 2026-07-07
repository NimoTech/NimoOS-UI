import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import FilesSidebar from './FilesSidebar.vue'
import { useFilesStore } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    folder: { getList: vi.fn() },
    // AddMountMenu(子组件)onMounted 里调用 service.driver.listDrivers();mounts store 的
    // ejectCloud/loadMounts 走 service.cloud —— 均需 mock 以避免未处理拒绝的控制台告警。
    driver: { listDrivers: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { filesFavorites: '收藏', filesDisks: '磁盘', filesNoFavorites: '暂无收藏', filesSharesNav: '共享' } } })

// FilesSidebar now reads useRoute()/useRouter() for the shares nav item's active state — a
// router plugin must be installed or vue-router's injection throws on mount.
const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/files/shares', name: 'files-shares', component: { template: '<div/>' } },
  ],
})

function seedFiles() {
  const files = useFilesStore()
  files.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any
  files.displayNames = { '/DATA': 'NimoOS-HD' }
  files.currentPath = '/DATA'
  return files
}

describe('FilesSidebar', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('renders disks and an empty-favorites hint', () => {
    seedFiles()
    const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
    expect(w.text()).toContain('暂无收藏')
    expect(w.text()).toContain('NimoOS-HD')
  })

  it('clicking a disk emits navigate with the virtual path (not /DATA)', async () => {
    seedFiles()
    const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
    const diskItem = w.findAll('.side-item').find((li) => li.text().includes('NimoOS-HD'))!
    await diskItem.trigger('click')
    const ev = w.emitted('navigate')
    expect(ev![0][0]).toBe('/NimoOS-HD')
    expect(ev![0][0]).not.toContain('/DATA')
  })

  it('clicking a favorite emits its virtual path; remove mutates the store', async () => {
    seedFiles()
    const fav = useFavoritesStore()
    fav.list = [{ name: 'Docs', path: '/DATA/Documents' }] as any
    const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
    const favItem = w.findAll('.side-item').find((li) => li.text().includes('Docs'))!
    await favItem.trigger('click')
    expect(w.emitted('navigate')!.some((e) => e[0] === '/NimoOS-HD/Documents')).toBe(true)
    await favItem.get('.side-remove').trigger('click')
    expect(fav.list.find((f) => f.path === '/DATA/Documents')).toBeUndefined()
  })

  it('dragging a disk reorders the rendered list in the same tick and persists order+default', async () => {
    const files = useFilesStore()
    files.disks = [
      { name: 'DiskA', path: '/DATA', usb: false },
      { name: 'DiskB', path: '/mnt/b', usb: false },
    ] as any
    files.displayNames = { '/DATA': 'DiskA', '/mnt/b': 'DiskB' }
    files.currentPath = '/DATA'
    const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })

    // scope to the disks section — the sidebar now also renders a leading shares-nav .side-item
    const disksItems = () => w.findAll('.side-item').filter((li) => li.text() === 'DiskA' || li.text() === 'DiskB')

    const before = disksItems().map((li) => li.text())
    expect(before).toEqual(['DiskA', 'DiskB'])

    // drag DiskB (index 1) onto DiskA's slot (index 0)
    const items = disksItems()
    await items[1].trigger('dragstart')
    await items[0].trigger('drop')

    // rendered order updates immediately — no loadRoots / reload needed (regression: localStorage isn't reactive)
    const after = disksItems().map((li) => li.text())
    expect(after).toEqual(['DiskB', 'DiskA'])

    // persisted order + default reflect the new arrangement
    expect(JSON.parse(localStorage.getItem('nimoos:location-order')!)).toEqual(['/mnt/b', '/DATA'])
    expect(localStorage.getItem('nimoos:location-default')).toBe('/mnt/b')
  })
})

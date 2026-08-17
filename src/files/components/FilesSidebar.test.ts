import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import FilesSidebar from './FilesSidebar.vue'
import AddMountMenu from './AddMountMenu.vue'
import GoogleDriveAuthDialog from './GoogleDriveAuthDialog.vue'
import { useFilesStore } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { useDiskUsageStore } from '../stores/diskUsage'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    folder: { getList: vi.fn() },
    // AddMountMenu (child component) calls service.driver.listDrivers() in onMounted; mounts store's
    // ejectCloud/loadMounts use service.cloud — both need mock to avoid unhandled rejection console warnings.
    driver: { listDrivers: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    // FilesSidebar's onMounted pulls disk usage (SP12-T9), also needs mock to avoid warnings.
    storage: { list: vi.fn().mockResolvedValue([]) },
    raid: { list: vi.fn().mockResolvedValue([]), getStatus: vi.fn() },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { filesFavorites: '收藏', filesDisks: '磁盘', filesNoFavorites: '暂无收藏', filesSharesNav: '共享', filesDiskUsed: '已用', filesDiskAvailable: '可用', filesDiskCapacity: '容量', filesDiskDetails: '容量详情' } } })

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

  // SP12-T9: favourites are always folders, and the file listing already picks a
  // per-name icon for well-known folder names via icons.ts's FOLDER_BY_NAME map —
  // the sidebar hardcoded the generic folder icon instead.
  describe('favourite icons match the file listing (F9)', () => {
    it('gives a favourite the icon its name maps to, not the generic folder', () => {
      seedFiles()
      const fav = useFavoritesStore()
      fav.list = [{ name: 'Downloads', path: '/DATA/Downloads' }] as any
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      const src = w.find('.side-fav .side-icon').attributes('src')
      expect(src).toContain('folder-download')
    })

    it('falls back to the generic folder icon for an unmapped name', () => {
      seedFiles()
      const fav = useFavoritesStore()
      fav.list = [{ name: 'Trip 2026', path: '/DATA/Trip 2026' }] as any
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      const src = w.find('.side-fav .side-icon').attributes('src')
      expect(src).toContain('folder-default')
    })
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

  describe('cloud auth branching (P5b Google BYO)', () => {
    it('Google Drive → opens BYO form dialog, does not directly window.open', async () => {
      seedFiles()
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      w.findComponent(AddMountMenu).vm.$emit('connect-cloud', { name: 'Google Drive', icon: '', authUrl: 'https://broken?client_id=private+build' })
      await nextTick()
      expect(openSpy).not.toHaveBeenCalled()
      expect(w.findComponent(GoogleDriveAuthDialog).props('open')).toBe(true)
      openSpy.mockRestore()
    })

    it('Dropbox → as before, directly window.open auth window (does not open form dialog)', async () => {
      seedFiles()
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      w.findComponent(AddMountMenu).vm.$emit('connect-cloud', { name: 'Dropbox', icon: '', authUrl: 'https://dp?state=${HOST}%2Fv1%2Frecover%2FDropbox' })
      await nextTick()
      expect(openSpy).toHaveBeenCalledTimes(1)
      const [url, name] = openSpy.mock.calls[0]
      expect(String(url)).toContain(encodeURI(window.location.origin))
      expect(name).toBe('Dropbox')
      expect(w.findComponent(GoogleDriveAuthDialog).props('open')).toBe(false)
      openSpy.mockRestore()
    })

    it('form emits auth-url → after buildAuthUrl replaces ${HOST}, window.open', async () => {
      seedFiles()
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      w.findComponent(GoogleDriveAuthDialog).vm.$emit('auth-url', 'https://accounts.google.com/auth?state=${HOST}%2Fv1%2Frecover%2FGoogleDrive%3Fsid%3Dabc')
      await nextTick()
      expect(openSpy).toHaveBeenCalledTimes(1)
      const [url, name] = openSpy.mock.calls[0]
      expect(String(url)).not.toContain('${HOST}')
      expect(String(url)).toContain(encodeURI(window.location.origin))
      expect(name).toBe('Google Drive')
      openSpy.mockRestore()
    })
  })

  // SP12-T9: sidebar originally only had icon + name, no usage display at all.
  describe('disk capacity tooltip', () => {
    function seedUsage() {
      const usage = useDiskUsageStore()
      usage.details = { '/DATA': { space: { used: 4, total: 10, avail: 6 }, raid: null } }
      return usage
    }

    it('only disks with usage data show ⋮ handle', async () => {
      const files = seedFiles()
      files.disks = [
        { name: 'NimoOS-HD', path: '/DATA', usb: false },
        { name: 'Unknown', path: '/mnt/x', usb: false },
      ] as any
      seedUsage()
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      await nextTick()
      expect(w.findAll('.side-dots').length).toBe(1)
    })

    it('hover opens, move out closes', async () => {
      seedFiles()
      seedUsage()
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      await nextTick()
      expect(w.find('.disk-tip').exists()).toBe(false)
      await w.find('.side-dots').trigger('mouseenter')
      expect(w.find('.disk-tip').exists()).toBe(true)
      expect(w.find('.disk-tip').text()).toContain('40%')
      await w.find('.side-dots').trigger('mouseleave')
      expect(w.find('.disk-tip').exists()).toBe(false)
    })

    it('clicking ⋮ does not navigate', async () => {
      seedFiles()
      seedUsage()
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      await nextTick()
      await w.find('.side-dots').trigger('click')
      expect(w.emitted('navigate')).toBeFalsy()
    })
  })
})

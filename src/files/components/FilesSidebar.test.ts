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
    // AddMountMenu(子组件)onMounted 里调用 service.driver.listDrivers();mounts store 的
    // ejectCloud/loadMounts 走 service.cloud —— 均需 mock 以避免未处理拒绝的控制台告警。
    driver: { listDrivers: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    // FilesSidebar 的 onMounted 拉磁盘用量(SP12-T9),同样要 mock 掉才没有告警。
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

  describe('云盘授权分流(P5b Google BYO)', () => {
    it('Google Drive → 开 BYO 表单框,不直接 window.open', async () => {
      seedFiles()
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      w.findComponent(AddMountMenu).vm.$emit('connect-cloud', { name: 'Google Drive', icon: '', authUrl: 'https://broken?client_id=private+build' })
      await nextTick()
      expect(openSpy).not.toHaveBeenCalled()
      expect(w.findComponent(GoogleDriveAuthDialog).props('open')).toBe(true)
      openSpy.mockRestore()
    })

    it('Dropbox → 照旧直接 window.open 授权窗(不开表单框)', async () => {
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

    it('表单 emit auth-url → 经 buildAuthUrl 替换 ${HOST} 后 window.open', async () => {
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

  // SP12-T9:侧栏原本只有图标+名字,没有任何用量显示。
  describe('磁盘容量悬浮窗', () => {
    function seedUsage() {
      const usage = useDiskUsageStore()
      usage.details = { '/DATA': { space: { used: 4, total: 10, avail: 6 }, raid: null } }
      return usage
    }

    it('只有拿到用量的磁盘才出现 ⋮ 把手', async () => {
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

    it('悬停打开、移出关闭', async () => {
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

    it('点 ⋮ 不导航', async () => {
      seedFiles()
      seedUsage()
      const w = mount(FilesSidebar, { global: { plugins: [i18n, testRouter] } })
      await nextTick()
      await w.find('.side-dots').trigger('click')
      expect(w.emitted('navigate')).toBeFalsy()
    })
  })
})

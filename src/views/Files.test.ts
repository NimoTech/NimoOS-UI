import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useFavoritesStore } from '../files/stores/favorites'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async (path: string) => ({
        content: [
          { name: 'Documents', path: (path === '/DATA' ? '/DATA' : path) + '/Documents', is_dir: true },
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
    // Files.vue 的挂载区 socket 刷新在 onMounted 里调用 mounts.loadMounts();mock 之以避免无关的控制台告警。
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
}

describe('Files.vue browse pipe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('bare /files redirects to default disk root (virtual) and lists it', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toContain('/files/NimoOS-HD')
    const files = useFilesStore()
    expect(files.currentPath).toBe('/DATA')
    expect(w.text()).toContain('Documents')
  })

  it('deep virtual route resolves to real path and lists it', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Documents'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()
    expect(files.currentPath).toBe('/DATA/Documents')
    expect(w.text()).toContain('Documents')
  })

  it('clicking a folder row navigates to that folder\'s virtual route', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // default view is grid; directories render as .file-tile (sorted first)
    const folderTile = w.find('.file-tile')
    expect(folderTile.exists()).toBe(true)
    await folderTile.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toContain('/files/NimoOS-HD/Documents')
    expect(router.currentRoute.value.fullPath).not.toContain('/DATA')
  })

  it('renders grid tiles by default and can switch to list; clicking a column reorders', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    localStorage.clear()
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    const files = useFilesStore()
    // default grid
    expect(files.viewMode).toBe('grid')
    expect(w.findAll('.file-tile').length).toBeGreaterThan(0)
    // switch to list
    await w.get('.view-toggle-list').trigger('click')
    expect(files.viewMode).toBe('list')
    expect(w.findAll('.file-row').length).toBeGreaterThan(0)
    // click a sortable header
    await w.get('.col-name').trigger('click')
    expect(files.sort).toBe('name')
  })

  it('renders the sidebar (disks) and breadcrumb for the current folder', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Documents'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // sidebar shows the disk root
    expect(w.find('.files-sidebar').exists()).toBe(true)
    expect(w.find('.files-sidebar').text()).toContain('NimoOS-HD')
    // breadcrumb shows virtual segments, never the real path
    const crumbs = w.findAll('.crumb').map((c) => c.text())
    expect(crumbs).toContain('NimoOS-HD')
    expect(crumbs).toContain('Documents')
    expect(w.find('.breadcrumb').text()).not.toContain('/DATA')
  })

  it('ctrl-click in list view selects a row and shows the selection toolbar; clear resets', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    localStorage.clear()
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    expect(files.selectedCount).toBe(1)
    expect(w.find('.selection-toolbar').exists()).toBe(true)
    expect(w.find('.selection-toolbar').text()).toContain('已选 1 项')
    await w.get('.selection-toolbar .sel-clear').trigger('click')
    expect(files.selectedCount).toBe(0)
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  it('工具栏有新建文件夹/新建文件按钮', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(w.find('.tb-new-folder').exists()).toBe(true)
    expect(w.find('.tb-new-file').exists()).toBe(true)
  })

  it('右键未选中的行会选中它(为右键菜单定目标);冒泡到容器不应清空该选中', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const files = useFilesStore()
    const row = w.findAll('.file-row')[0]
    // native contextmenu bubbles from the row (data-path target) up through files-listwrap;
    // the container's blank-area handler must not clobber the row-set selection.
    await row.trigger('contextmenu')
    expect(files.selectedCount).toBe(1)
  })
})

describe('快照只读横幅', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('普通目录不显示横幅', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(w.find('.snap-banner').exists()).toBe(false)
  })

  it('进入快照路径后显示横幅', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(w.find('.snap-banner').exists()).toBe(true)
  })
})

describe('时间机器入口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  // 挂载在给定的真实路径上:disk 'NimoOS-HD' ↔ 挂载点 '/DATA'(与本文件其余用例同一约定),
  // real path 的 '/DATA' 前缀换成虚拟段 'NimoOS-HD' 即是路由参数。listVolumes mock(见文件顶部)
  // 返回 supported:true 的 /DATA,canShowEntry 因而在非快照路径上应为真。
  async function mountFiles(realPath: string) {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    const virtual = realPath.replace(/^\/DATA/, 'NimoOS-HD')
    router.push('/files/' + virtual); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    return w
  }

  it('supported 卷上出现入口 chip', async () => {
    const w = await mountFiles('/DATA/Photos')
    expect(w.find('.tb-time-machine').exists()).toBe(true)
  })
  it('已经在快照里时不出现入口 chip', async () => {
    const w = await mountFiles('/DATA/.snapshots/snap1')
    expect(w.find('.tb-time-machine').exists()).toBe(false)
  })
  it('点入口打开覆盖层', async () => {
    const w = await mountFiles('/DATA/Photos')
    await w.find('.tb-time-machine').trigger('click')
    expect(w.find('.tm-overlay').exists()).toBe(true)
  })
})

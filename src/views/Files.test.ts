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

  // 评审修复(Important):拖拽遮罩先诱导"松手就能上传",而快照态下投放本就会被
  // commitSelectedFiles 的 guard 拦住并 toast——遮罩不该在只读快照里出现。
  it('快照态下拖拽进入不显示"上传到…"遮罩', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.files-main').trigger('dragover')
    expect(w.find('.files-drop-mask').exists()).toBe(false)
  })

  it('普通目录下拖拽进入仍显示"上传到…"遮罩(对照组,防止遮罩被误删)', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.files-main').trigger('dragover')
    expect(w.find('.files-drop-mask').exists()).toBe(true)
  })

  // 评审修复(Critical 1):`.snapshots` 容器目录本身(面包屑上点 ".snapshots" 那一段,
  // 没有具体快照名)—— 之前 isSnapshotView 判不出锁,写入工具条 + 时间机器 chip 全部冒出来。
  it('.snapshots 容器目录本身:写入工具条与时间机器入口都不出现', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    expect(w.find('.files-actions').exists()).toBe(false)
    expect(w.find('.tb-time-machine').exists()).toBe(false)
    // 加分项:锁生效了也该有横幅告诉用户为什么,不是"锁了但没人告诉你"
    expect(w.find('.snap-banner').exists()).toBe(true)
    expect(w.find('.snap-banner').text()).toContain('请选择一个快照')
  })

  // 评审复核(Minor,第二轮):`.snapshots` 容器目录下(browseInfo 为 null,因为没有具体
  // 快照名可解析)选中一个条目(恰好是某个具体快照目录),SnapshotSelectionToolbar 的
  // "恢复" 按钮点了只会拿到 performSnapshotRestore 的"路径无效,无法恢复"——这个按钮在
  // 这个场景下天生就是坏的,不该出现。加 `&& !!browse.browseInfo` 后这个专用工具条不再
  // 冒出来。
  //
  // 复核追加(阻塞级回归):只挡掉 SnapshotSelectionToolbar 不够——它一挡,`v-else-if` 的
  // 普通 SelectionToolbar(复制/剪切/下载/共享/删除)会顶上来。复核实测这条口子是真的能
  // 写穿:剪切走的是 move(=删源,是写不是读),`useFileOps.paste()` 的 blockedInSnapshot()
  // 查的是**粘贴目的地**的 isSnapshotView,粘贴到普通目录时该检查形同虚设;`sel-share`
  // (共享到局域网)在 Files.vue 的 onShare 里完全没有 guard,能把快照目录直接开成局域网
  // 共享。这与 SnapshotSelectionToolbar.vue:10-12 的注释("剪切/复制/删除/共享在只读快照
  // 上要么无意义要么会失败,留着只会诱导用户点")、FileContextMenu.vue 的
  // showCopy/showCut/showDelete/showShare 全部 `&& !inSnapshot` 正面冲突。修法:
  // `v-else-if` 补上 `!browse.isSnapshotView`,容器目录下两个工具条都不出现。
  it('.snapshots 容器目录下选中条目:两个工具条(专用恢复条 + 普通复制/剪切/共享/删除条)都不出现', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    const files = useFilesStore()
    expect(files.selectedCount).toBe(1)
    expect(w.find('.snap-sel').exists()).toBe(false)
    expect(w.find('.snap-sel-restore').exists()).toBe(false)
    // 两个工具条共享 .selection-toolbar 这个基类名,不存在即两个都没渲染
    // (普通 SelectionToolbar 没有 .snap-sel 修饰类,单独判它不够,这里判基类)。
    expect(w.find('.selection-toolbar').exists()).toBe(false)
  })

  // 对照组(防止把恢复功能的主入口之一一起挡掉):真正的快照路径(有具体快照名,
  // browseInfo 非空)下选中条目,SnapshotSelectionToolbar 必须仍然正常出现。
  it('普通快照路径(有具体快照名)下选中条目:SnapshotSelectionToolbar 仍正常出现', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Photos'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    await w.get('.view-toggle-list').trigger('click')
    const row = w.findAll('.file-row')[0]
    await row.trigger('click', { ctrlKey: true })
    const files = useFilesStore()
    expect(files.selectedCount).toBe(1)
    expect(w.find('.snap-sel').exists()).toBe(true)
    expect(w.find('.snap-sel-restore').exists()).toBe(true)
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
    // T11 起本描述块新增一条会经 reka-ui Portal 把 .ui-dialog-content Teleport 到真实
    // document.body 的用例(齿轮弹窗)——attachTo: document.body 挂载的实例不会在测试间
    // 自动 unmount,清空 body 防止上一条用例的残留节点污染下一条的 querySelector
    // (同 SnapshotSettingsDialog.test.ts / RaidDeleteDialog.test.ts 的处理方式)。
    document.body.innerHTML = ''
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
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
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
  it('点齿轮打开设置弹窗,时间机器仍在', async () => {
    const w = await mountFiles('/DATA/Photos')
    await w.find('.tb-time-machine').trigger('click')
    await w.find('.tm-gear').trigger('click')
    await flushPromises()
    expect(document.querySelector('.ui-dialog-content')).not.toBeNull()
    expect(w.find('.tm-overlay').exists()).toBe(true)
  })
})

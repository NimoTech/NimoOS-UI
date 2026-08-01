import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppsPanel from './AppsPanel.vue'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'

const getSystemPaths = vi.fn()
const storageList = vi.fn()
const prune = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: { getSystemPaths: () => getSystemPaths(), migrateAppPath: vi.fn(), getMigrateStatus: vi.fn() },
    storage: { list: (...a: unknown[]) => storageList(...a) },
    container: { prune: () => prune() },
    folder: { getList: vi.fn().mockResolvedValue({ content: [] }), create: vi.fn(), rename: vi.fn() },
    batch: { delete: vi.fn() },
  },
}))

// 真机 fixture(2026-08-01)
const PATHS = {
  app_data: { path: '/DATA/AppData', size: 6037987 },
  database: { path: '/DATA', size: 3554691143 },
  images: { path: '/DATA/.system_data/.docker & .containerd', size: 55559455762 },
  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },
}
const RAW_STORAGE = [{
  disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
  children: [{ uuid: 'da0e4da3', mount_point: '/', size: '512110190592', avail: '333092294144', used: '179017896448', type: 'ext4', path: '/dev/nvme0n1p7', drive_name: 'nvme0n1p7', label: 'NimoOS-HD' }],
}]

const mountPanel = () => mount(AppsPanel, { global: { plugins: [i18n] }, attachTo: document.body })

describe('AppsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia()) // AppsPanel 用 useToast()(prune 成功/失败提示),同 rows.test.ts 先例
    getSystemPaths.mockReset(); storageList.mockReset(); prune.mockReset()
    getSystemPaths.mockResolvedValue(PATHS); storageList.mockResolvedValue(RAW_STORAGE)
    prune.mockResolvedValue({ containers: null, images: null })
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('渲染三行数据位置 —— 后端给了 4 个 key(含 photos_data),界面 1:1 只显示 3 行', async () => {
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-app-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('App 数据')
    expect(rows[1].text()).toContain('App 镜像集')
    expect(rows[2].text()).toContain('用户数据库')
  })

  it('路径 chip 经 displayNames 变成虚拟路径', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')[0].text()).toContain('/NimoOS-HD/AppData')
  })

  it('用户数据库那行的路径带 Vue2 的四目录后缀(1:1)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')[2].text()).toContain('/Documents & Downloads & Gallery & Media')
  })

  it('点某行的按钮打开迁移弹窗,并把该行的 type / 路径 / 大小传进去', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.findAll('.set-app-act')[0].trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('存储位置')
    expect(document.body.textContent).toContain('没有其他可用的存储')   // 本机单分区
  })

  it('Docker 缓存清理必须先过二次确认才发请求', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    expect(prune).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('这将删除所有未使用的容器、网络和镜像。确定要继续吗？')
  })

  it('确认后调 prune 并显示成功提示', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    await (document.querySelector('.ui-btn.danger') as HTMLElement).click()
    await flushPromises()
    expect(prune).toHaveBeenCalledTimes(1)
    // #8:toast 是 App 级组件,不在 AppsPanel 子树里——断言必须走 pinia store 本身
    // (同下面 prune 失败那条先例),不能只断言 prune 被调用了事;否则 confirmPrune 里
    // 那行 toast.show(...) 被删掉,这条用例名不副实地仍然全绿。
    const toast = useToast()
    expect(toast.msg).toBe(i18n.global.t('settingsAppsDockerCleanDone'))
  })

  it('prune 失败时提示失败文案,不静默', async () => {
    // toast 是 App 级组件(AppToast.vue,挂在 App.vue 根,不在 AppsPanel 子树里)——
    // 单独 mount AppsPanel 时 w.text()/document.body 里不会出现 toast 文本,断言必须
    // 走 pinia store 本身(同 general/rows.test.ts 的既有先例),而不是找不存在的 DOM 节点。
    prune.mockRejectedValue(new Error('docker daemon unreachable'))
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    await (document.querySelector('.ui-btn.danger') as HTMLElement).click()
    await flushPromises()
    const toast = useToast()
    expect(toast.msg).toBe(i18n.global.t('settingsAppsDockerCleanFailed'))
  })

  it('清理本地待上传缓存行:UI 在、按钮禁用、带待相册区迁移的标注(政策三"做样子")', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.text()).toContain('清除本地未完成的上传')
    expect(w.find('.set-app-pending-btn').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('待相册区迁移完成后启用')
  })

  // 评审 Important #3:取数在途时不能渲染三行 0 值假读数(尤其是「用户数据库」那行,
  // pathText() 无条件拼四目录后缀,取数没落定时会显示成缺前缀的假路径)。收敛条件选
  // 「两个接口都落定」——这里让 getSystemPaths 立即落定、storage.list 挂住,验证加载态
  // 仍然渲染骨架而不是假数据,直到 storage.list 也落定才切换。
  it('取数在途渲染加载骨架,不渲染 0 值假读数;两个接口都落定后才渲染真实三行', async () => {
    let resolveStorage!: (v: typeof RAW_STORAGE) => void
    const pendingStorage = new Promise<typeof RAW_STORAGE>((res) => { resolveStorage = res })
    storageList.mockReturnValueOnce(pendingStorage)
    const w = mountPanel()
    await flushPromises() // getSystemPaths 已落定,storage.list 还挂着
    expect(w.find('.set-skeleton').exists()).toBe(true)
    expect(w.findAll('.set-app-row')).toHaveLength(0)

    resolveStorage(RAW_STORAGE)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(3)
  })

  it('取数失败时三行仍在(空路径),不白屏', async () => {
    getSystemPaths.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')).toHaveLength(3)
  })
})

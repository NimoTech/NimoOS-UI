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

// real-device fixture (2026-08-01)
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
    setActivePinia(createPinia()) // AppsPanel uses useToast() (prune success/failure notices), same precedent as rows.test.ts
    getSystemPaths.mockReset(); storageList.mockReset(); prune.mockReset()
    getSystemPaths.mockResolvedValue(PATHS); storageList.mockResolvedValue(RAW_STORAGE)
    prune.mockResolvedValue({ containers: null, images: null })
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('renders all four data-location rows -- backend sent 4 keys (incl. photos_data), all four render (#103)', async () => {
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-app-row')
    expect(rows).toHaveLength(4)
    expect(rows[0].text()).toContain('App 数据')
    expect(rows[1].text()).toContain('App 镜像集')
    expect(rows[2].text()).toContain('用户数据库')
    expect(rows[3].text()).toContain('相册缓存')
  })

  it('the path chip becomes a virtual path via displayNames', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')[0].text()).toContain('/NimoOS-HD/AppData')
  })

  it('the user-database row path carries the Vue2 four-directory suffix (1:1)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')[2].text()).toContain('/Documents & Downloads & Gallery & Media')
  })

  it('clicking a row\'s button opens the migration dialog, passing in that row\'s type / path / size', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.findAll('.set-app-act')[0].trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('存储位置')
    expect(document.body.textContent).toContain('没有其他可用的存储')   // this machine has a single partition
  })

  it('Docker cache cleanup must go through confirmation before sending the request', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    expect(prune).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('这将删除所有未使用的容器、网络和镜像。确定要继续吗？')
  })

  it('calls prune after confirming and shows a success notice', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    await (document.querySelector('.ui-btn.danger') as HTMLElement).click()
    await flushPromises()
    expect(prune).toHaveBeenCalledTimes(1)
    // #8: toast is an App-level component, not inside the AppsPanel subtree —— the assertion
    // must go through the pinia store itself (same precedent as the prune-failure case below).
    // Asserting only that prune was called is not enough; otherwise if the toast.show(...) line
    // in confirmPrune were deleted, this case would still go green despite no longer testing
    // what its name claims.
    const toast = useToast()
    expect(toast.msg).toBe(i18n.global.t('settingsAppsDockerCleanDone'))
  })

  it('prune failure shows the failure copy, not silently', async () => {
    // toast is an App-level component (AppToast.vue, mounted at the App.vue root, not inside
    // the AppsPanel subtree) —— when mounting AppsPanel in isolation, the toast text never
    // shows up in w.text()/document.body, so the assertion must go through the pinia store
    // itself (same existing precedent as general/rows.test.ts), rather than looking for a DOM
    // node that doesn't exist.
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

  it('clear-local-pending-uploads row: UI is present, button disabled, labeled as pending photos-migration ("just for show" per policy 3)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.text()).toContain('清除本地未完成的上传')
    expect(w.find('.set-app-pending-btn').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('待相册区迁移完成后启用')
  })

  // Review Important #3: while the fetch is in flight, must not render four rows of fake
  // zero-value readings (especially the "user database" row, where pathText() unconditionally
  // appends the four-directory suffix — if the fetch hasn't settled yet, this renders a fake
  // path missing its prefix). The chosen convergence condition is "both endpoints have
  // settled" —— here getSystemPaths settles immediately while storage.list hangs, verifying
  // that the loading state still renders the skeleton instead of fake data, switching over
  // only once storage.list also settles.
  it('stays on the loading skeleton (no zero-value fake rows) while fetching; renders the real four rows only after both endpoints settle', async () => {
    let resolveStorage!: (v: typeof RAW_STORAGE) => void
    const pendingStorage = new Promise<typeof RAW_STORAGE>((res) => { resolveStorage = res })
    storageList.mockReturnValueOnce(pendingStorage)
    const w = mountPanel()
    await flushPromises() // getSystemPaths has settled, storage.list is still hanging
    expect(w.find('.set-skeleton').exists()).toBe(true)
    expect(w.findAll('.set-app-row')).toHaveLength(0)

    resolveStorage(RAW_STORAGE)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.findAll('.set-app-row')).toHaveLength(4)
  })

  it('still shows four rows (with empty paths) when the fetch fails -- no blank screen', async () => {
    getSystemPaths.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')).toHaveLength(4)
  })
})

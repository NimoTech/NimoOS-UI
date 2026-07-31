import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotSettingsDialog from './SnapshotSettingsDialog.vue'
import zh from '../../i18n/zh_cn'

const listVolumesMock = vi.fn()
const getPolicyMock = vi.fn()
const patchPolicyMock = vi.fn()
const togglePolicyMock = vi.fn()
const createMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    listVolumes: () => listVolumesMock(), getPolicy: (u: string) => getPolicyMock(u),
    patchPolicy: (u: string, p: unknown) => patchPolicyMock(u, p),
    togglePolicy: (u: string, e: boolean) => togglePolicyMock(u, e),
    create: (d: unknown) => createMock(d), list: vi.fn().mockResolvedValue([]), remove: vi.fn(),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(SnapshotSettingsDialog, {
    props: { open: true, volumeUuid: 'u-data', mountPoint: '/DATA', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const body = () => document.body.textContent ?? ''

// attachTo: document.body 挂载的实例不会在测试间自动 unmount(Dialog 内容经 reka-ui Portal
// Teleport 到 body,脱离 wrapper 根节点)——同目录 TimeMachineOverlay.test.ts /
// RaidDeleteDialog.test.ts 均以 beforeEach 清空 body 处理,这里沿用同一模式。
// 故意与组件 form 的默认值(hourly_keep:24/daily_keep:7/weekly_keep:4/pause_threshold_pct:90)
// 全部不同——若把"策略落地后同步本地表单"的逻辑整段删掉,组件会停留在默认值上提交,
// 与这组后端值一比对就会露馅。四个字段全部错开默认值,不留任何一个字段"蒙对"的空子。
const BACKEND_POLICY = { enabled: true, hourly_keep: 12, daily_keep: 3, weekly_keep: 8, pause_threshold_pct: 75 }

beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks(); document.body.innerHTML = ''
  listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true, enabled: true, count: 3 }])
  getPolicyMock.mockResolvedValue({ ...BACKEND_POLICY })
})

describe('SnapshotSettingsDialog', () => {
  it('打开即拉卷与策略', async () => {
    const w = mountIt(); await flush(w)
    expect(listVolumesMock).toHaveBeenCalled()
    expect(getPolicyMock).toHaveBeenCalledWith('u-data')
  })
  it('显示挂载点,让人知道在改哪个卷', async () => {
    const w = mountIt(); await flush(w)
    expect(body()).toContain('/DATA')
  })
  // 评审修复(Important):loadVolume 网络往返在途时(store.volumeLoading 初值即 true)不该
  // 提前露出"不支持快照"这句结论性文案——store.volume 此时还是 null(或换卷前带来的旧值),
  // resolveSnapshotState(null) === 'unsupported',若不拿 volumeLoading 挡住就会先闪一句错的。
  it('loadVolume 未 resolve 时不出现 snapUnsupported 文案(避免网络往返期间闪错结论)', async () => {
    listVolumesMock.mockImplementation(() => new Promise(() => {})) // 永不 resolve
    const w = mountIt()
    await w.vm.$nextTick()
    expect(body()).not.toContain('不支持快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
    // 评审复核(Minor,第二轮):`v-else-if="!store.volumeLoading"` 这道门此前没有任何用例
    // 覆盖——把它改回 `v-else` 后本文件 12 条测试仍然全绿,是上一轮唯一存活的变异。
    // 开关按钮(.snap-set-toggle)在 v-else 分支里,和策略字段(.snap-set-fields)同级但
    // 不属于同一个 v-if 块,单独补这一句断言:volumeLoading 落地前,开关也不该露出来
    // (store.volume 还是 null/旧值,开关状态会先闪一下错的 enabled 值)。
    expect(document.querySelector('.snap-set-toggle')).toBeNull()
  })
  it('不支持快照的卷只显示一句说明,没有表单', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: false }])
    const w = mountIt(); await flush(w)
    expect(body()).toContain('不支持快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
  })
  it('已启用时 4 个策略字段常驻可见(不折叠)', async () => {
    const w = mountIt(); await flush(w)
    expect(document.querySelectorAll('.snap-set-fields input').length).toBe(4)
  })
  it('表单从后端策略初始化,而不是停在默认值', async () => {
    const w = mountIt(); await flush(w)
    const values = [...document.querySelectorAll('.snap-set-fields input')].map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['12', '3', '8', '75'])
  })
  it('保存走 patchPolicy(读-改-写,不是从零构造 PUT),且提交的是后端落地的当前值', async () => {
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-save') as HTMLElement).click()
    await flush(w)
    expect(patchPolicyMock).toHaveBeenCalledWith('u-data', expect.objectContaining({
      hourly_keep: BACKEND_POLICY.hourly_keep, daily_keep: BACKEND_POLICY.daily_keep,
      weekly_keep: BACKEND_POLICY.weekly_keep, pause_threshold_pct: BACKEND_POLICY.pause_threshold_pct,
    }))
  })
  it('字段非法时不提交,显示错误', async () => {
    const w = mountIt(); await flush(w)
    const input = document.querySelector('.snap-set-fields input') as HTMLInputElement
    input.value = '0'; input.dispatchEvent(new Event('input')); await flush(w)
    await (document.querySelector('.snap-set-save') as HTMLElement).click(); await flush(w)
    expect(patchPolicyMock).not.toHaveBeenCalled()
    expect(body()).toContain('大于 0')
  })
  it('开关调 togglePolicy', async () => {
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-toggle') as HTMLElement).click(); await flush(w)
    expect(togglePolicyMock).toHaveBeenCalledWith('u-data', false)
  })
  it('关闭状态显示提示文案,没有策略字段', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true, enabled: false, count: 0 }])
    const w = mountIt(); await flush(w)
    expect(body()).toContain('自动为此卷创建快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
  })
  it('立即创建快照:带备注提交,并 emit snapshot-created', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt(); await flush(w)
    const label = document.querySelector('.snap-set-label') as HTMLInputElement
    label.value = '升级前'; label.dispatchEvent(new Event('input')); await flush(w)
    await (document.querySelector('.snap-set-create') as HTMLElement).click(); await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u-data', label: '升级前' })
    expect(w.emitted('snapshot-created')).toHaveLength(1)
  })
  it('备注为空时不带 label 字段', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-create') as HTMLElement).click(); await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u-data' })
  })
})

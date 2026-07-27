import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotPanel from './SnapshotPanel.vue'
import zh from '../../i18n/zh_cn'

const listVolumes = vi.fn()
const getPolicy = vi.fn()
const listMock = vi.fn().mockResolvedValue([])
const togglePolicy = vi.fn().mockResolvedValue(undefined)
const patchPolicy = vi.fn()
const createSnap = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      list: (...a: unknown[]) => listMock(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      patchPolicy: (...a: unknown[]) => patchPolicy(...a),
      create: (...a: unknown[]) => createSnap(...a),
      remove: vi.fn(),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountPanel = () => mount(SnapshotPanel, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountPanel>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getPolicy.mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
  patchPolicy.mockResolvedValue(null)
  createSnap.mockResolvedValue(undefined)
})

describe('SnapshotPanel 三态', () => {
  it('端点 404(listVolumes 抛错)→ 不支持态:有说明、无开关,且不拉策略', async () => {
    listVolumes.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
    expect(w.find('.sp-switch').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('supported=false → 不支持态', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
  })
  it('已关闭态:有开关(未选中)+ 解释行,无状态行/无策略摘要', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
    expect(w.find('.sp-status').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('开关有可访问名称(aria-label),不依赖旁边 .sp-key 的兄弟节点关系', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-label')).toBe(zh.snapTitle)
  })
  it('已关闭但仍有历史快照 → 额外出"已有快照仍会保留"行', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-kept').exists()).toBe(true)
  })
  it('已启用态:开关选中 + 状态摘要 + 保留承诺 + 策略摘要(且策略只拉一次)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 5, last_at: '2026-07-27T01:00:00Z' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
    expect(w.find('.sp-status').text()).toContain('5')
    expect(w.find('.sp-kept').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').text()).toContain('24')
    expect(getPolicy).toHaveBeenCalledTimes(1)
  })
  it('已启用但零快照 → 状态行显示"暂无快照"', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0, last_at: '' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-status').text()).toBe(zh.snapNoneYet)
  })
  it('paused_reason 非空 → 出暂停警告行,内容含原因', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z', paused_reason: '磁盘使用率 95%' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').text()).toContain('磁盘使用率 95%')
  })
  it('无 paused_reason → 不出暂停行', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').exists()).toBe(false)
  })
})

describe('SnapshotPanel 保护开关', () => {
  it('点开关 → togglePolicy(uuid, 目标值);切换后本地状态跟随', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await flush(w)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
  })
  it('切换在途时开关禁用(防连点)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    let release: (v?: unknown) => void = () => {}
    togglePolicy.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await w.vm.$nextTick()
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('SnapshotPanel 高级策略表单', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('点"高级设置"→ 表单以当前策略为初值展开,摘要行让位', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect((w.find('.sp-in-hourly').element as HTMLInputElement).value).toBe('24')
    expect((w.find('.sp-in-pct').element as HTMLInputElement).value).toBe('90')
  })

  it('策略缺失(getPolicy 抛错)时表单落默认值 24/7/4/90', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    getPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect((w.find('.sp-in-daily').element as HTMLInputElement).value).toBe('7')
    expect((w.find('.sp-in-weekly').element as HTMLInputElement).value).toBe('4')
  })

  it('非法输入 → 显示逐字段错误且不发请求', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-in-pct').setValue('101')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').text()).toBe(zh.snapErrPositiveInt)
    expect(w.find('.sp-err-pct').text()).toBe(zh.snapErrPercent)
    expect(patchPolicy).not.toHaveBeenCalled()
    expect(w.find('.sp-advanced').exists()).toBe(true)   // 表单不收起
  })

  it('合法输入 → patchPolicy 收到四字段数字(非字符串),成功后收起表单', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    patchPolicy.mockResolvedValue(null)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('12')
    await w.find('.sp-in-daily').setValue('5')
    await w.find('.sp-in-weekly').setValue('3')
    await w.find('.sp-in-pct').setValue('80')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(patchPolicy).toHaveBeenCalledWith('u1', { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 })
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').text()).toContain('12')
  })

  it('取消 → 收起表单、错误清空、不发请求', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').exists()).toBe(true)
    await w.find('.sp-cancel-adv').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(patchPolicy).not.toHaveBeenCalled()
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-err-hourly').exists()).toBe(false)   // 重开无残留错误
  })
})

describe('SnapshotPanel 手动创建快照', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('填备注后点创建 → create 收到 {volume_uuid,label},成功后输入框清空', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockResolvedValue(undefined)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect(createSnap).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('')
  })

  it('创建失败 → 备注保留(便于重试)', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('升级前')
  })

  it('创建在途:按钮与输入框都禁用', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    let release: (v?: unknown) => void = () => {}
    createSnap.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-create').trigger('click'); await w.vm.$nextTick()
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.sp-label-input').element as HTMLInputElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('SnapshotPanel 内嵌时间线可见性(1:1 照 Vue2)', () => {
  it('已启用 → 时间线出现', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('已关闭且有历史快照 → 时间线仍出现(保住"快照仍保留"的承诺)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('已关闭且无历史 → 无时间线;不支持 → 无时间线', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w1 = mountPanel(); await flush(w1)
    expect(w1.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w2 = mountPanel(); await flush(w2)
    expect(w2.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
  })
})

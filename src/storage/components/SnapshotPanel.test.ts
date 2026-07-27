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
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      list: (...a: unknown[]) => listMock(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      patchPolicy: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountPanel = () => mount(SnapshotPanel, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountPanel>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); getPolicy.mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }) })

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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotTimeline from './SnapshotTimeline.vue'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    list: (...a: unknown[]) => listMock(...a),
    listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
    togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn(),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = () => mount(SnapshotTimeline, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const day = (d: number, h: number) => new Date(2026, 6, d, h, 0).toISOString()

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('SnapshotTimeline', () => {
  it('挂载即按卷拉列表', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('加载中显示骨架、加载完不显示', async () => {
    let release: (v: unknown) => void = () => {}
    listMock.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.st-skeleton').exists()).toBe(true)
    release([]); await flush(w)
    expect(w.find('.st-skeleton').exists()).toBe(false)
  })
  it('空列表 → 空态双句', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-empty').text()).toContain(zh.snapNoneYet)
    expect(w.find('.st-empty').text()).toContain(zh.snapEmptyHint)
  })
  it('按天分组:组头带组名与计数,最近两组默认展开、第三组收起', async () => {
    listMock.mockResolvedValue([
      { id: 1, name: 'a', type: 'auto-hourly', created_at: day(27, 9) },
      { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: day(27, 20) },
      { id: 3, name: 'c', type: 'preop', created_at: day(26, 8) },
      { id: 4, name: 'd', type: 'auto-daily', created_at: day(20, 8) },
    ])
    const w = mountIt(); await flush(w)
    const headers = w.findAll('.st-group-header')
    expect(headers).toHaveLength(3)
    expect(headers[0].find('.st-group-count').text()).toBe('2')
    // 默认展开最近 2 组 = 3 条可见(2 + 1),第三组收起
    expect(w.findAll('.st-item')).toHaveLength(3)
  })
  it('点组头折叠/展开切换', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.findAll('.st-item')).toHaveLength(1)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(0)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
  it('条目渲染时钟/类别徽章/备注,类别圆点带类别修饰类', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', label: '升级前', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    const item = w.find('.st-item')
    expect(item.find('.st-time').text()).toBe('09:00')
    expect(item.find('.st-badge').text()).toBe(zh.snapTypeManual)
    expect(item.find('.st-label').text()).toBe('升级前')
    expect(item.find('.st-dot').classes()).toContain('manual')
  })
  it('不渲染[浏览]入口(文件区快照套件推迟)', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-browse').exists()).toBe(false)
    expect(w.text()).not.toContain(zh.filesTitle ?? '文件')
  })
  it('换卷 → 重置展开态并重拉', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    listMock.mockClear()
    await w.setProps({ volumeUuid: 'u2' }); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u2')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotTimeline from './SnapshotTimeline.vue'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    list: (...a: unknown[]) => listMock(...a),
    listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
    togglePolicy: vi.fn(), create: vi.fn(),
    remove: (...a: unknown[]) => removeMock(...a),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = () => mount(SnapshotTimeline, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const day = (d: number, h: number) => new Date(2026, 6, d, h, 0).toISOString()

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); document.body.innerHTML = '' })

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
  it('不渲染[浏览]入口(文件区快照套件推迟);动作区只有删除一个按钮', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    // .st-browse 这个类从未出现在实现里,原断言是空断言(恒真);改成对动作区按钮数量
    // 的实质约束 —— 只有删除一个按钮,才是"浏览入口未渲染"真正会失败的检验。
    expect(w.findAll('.st-actions button')).toHaveLength(1)
    expect(w.text()).not.toContain(zh.filesTitle ?? '文件')
  })
  it('换卷 → 重置展开态并重拉(不沿用旧卷的展开集合)', async () => {
    // 旧卷:单条,落在与新卷完全不同的日期(2026-07-15),默认展开。
    // 新卷:3 组(2+1+1),默认展开规则是"最近 2 组" —— 若换卷不重置
    // expandedKeys/expandInitialized,旧卷的展开键('2026-07-15')在新卷分组里
    // 找不到任何匹配,会导致新卷的三组全部维持"收起"(0 条可见),而不是新卷
    // 自己应有的默认展开结果(2 条 + 1 条 = 3 条可见、第三组收起)。
    listMock
      .mockResolvedValueOnce([{ id: 1, name: 'old', type: 'manual', created_at: day(15, 9) }])
      .mockResolvedValueOnce([
        { id: 2, name: 'a', type: 'auto-hourly', created_at: day(27, 9) },
        { id: 3, name: 'b', type: 'manual', label: '新卷', created_at: day(27, 20) },
        { id: 4, name: 'c', type: 'preop', created_at: day(26, 8) },
        { id: 5, name: 'd', type: 'auto-daily', created_at: day(20, 8) },
      ])
    const w = mountIt(); await flush(w)
    expect(w.findAll('.st-item')).toHaveLength(1)   // 旧卷:单条,默认展开
    listMock.mockClear()
    await w.setProps({ volumeUuid: 'u2' }); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u2')
    expect(w.findAll('.st-group-header')).toHaveLength(3)
    // 新卷按默认展开最近 2 组渲染(2 条 + 1 条 = 3 条可见,第三组收起)——
    // 这就是"展开态被重置、按新卷重新计算默认展开"的直接证据。
    expect(w.findAll('.st-item')).toHaveLength(3)
  })
})

describe('SnapshotTimeline 删除', () => {
  const one = [{ id: 1, name: '20260727T090000Z_manual_升级前', type: 'manual', created_at: day(27, 9) }]

  it('条目有删除按钮;点击弹确认框(此时还没发请求)', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    expect(w.find('.st-delete').exists()).toBe(true)
    await w.find('.st-delete').trigger('click'); await flush(w)
    expect(document.body.querySelector('.sdd-ok')).not.toBeNull()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('确认后才发 remove(name, uuid),成功则该条从列表消失', async () => {
    listMock.mockResolvedValue(one)
    removeMock.mockResolvedValue(undefined)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).toHaveBeenCalledWith('20260727T090000Z_manual_升级前', 'u1')
    expect(w.findAll('.st-item')).toHaveLength(0)
  })

  it('取消 → 不发请求,条目还在', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).not.toHaveBeenCalled()
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
})

// Task 6 (SP7-P5 人物): PhotosPeople.vue —— 人物列表视图(横幅 + 置信度下拉 + 筛选/排序 +
// 两条警告横幅 + 合并建议横幅 + Pinned/Named/Unnamed 三分区 + 浮动操作菜单 + 空态)。
// 挂 Pinia + i18n + 真实 router(spy push,不 mock 整个 vue-router —— AreaShell/PhotosSidebar
// 都用 useRouter(),照 PhotosAlbums.test.ts 的既有挂载套路),mock 共享包 photos 方法。
// 覆盖 brief Step 1 的 12 条行为清单 + facesEnabled 的三种来源(false / 缺字段 / 请求失败)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    mergeSuggestions: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({}),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://face/${id}/${ver ?? ''}`),
    getTimeline: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosPeople from '../PhotosPeople.vue'
import { usePhotosPeople } from '../../photos/stores/people'
import { useTimelineStore } from '../../photos/stores/timeline'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
      { path: '/photos/people/:id', name: 'photos-person', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/people')
  await router.isReady()
  const w = mount(PhotosPeople, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

// 已命名(顺序即后端返回顺序 —— sort='freq' 不重排,照 Vue2/T1 sortNamed)。
// 数字 id 混字符串 id:铁律回归(String(a)===String(b) / URL 拼接)。
const ALICE = { id: 42, name: 'Alice', favorite: true, relation: 'family', count: 120, confidence: 0.99, lastSeen: '2026-07-20T00:00:00Z', firstSeen: '2020-01-01T00:00:00Z' }
const CAROL = { id: 3, name: 'Carol', favorite: false, relation: 'family', count: 50, confidence: 0.98, lastSeen: '2026-07-10T00:00:00Z', firstSeen: '2021-01-01T00:00:00Z' }
const BOB = { id: 'b7', name: 'Bob', favorite: false, relation: 'friend', count: 90, confidence: 0.97, lastSeen: '2026-06-01T00:00:00Z', firstSeen: '2019-01-01T00:00:00Z' }
// 未命名(name 空串)。默认 confidence=80 / showSingletons=false 下:u1+u2 可见,
// u3(0.95 但只有 1 张)是被单照片开关藏起来的那一个,u4(0.72)低于阈值。
const U1 = { id: 'u1', name: '', favorite: false, relation: '', count: 9, confidence: 0.87 }
const U2 = { id: 'u2', name: '', favorite: false, relation: '', count: 5, confidence: 0.93 }
const U3 = { id: 'u3', name: '', favorite: false, relation: '', count: 1, confidence: 0.95 }
const U4 = { id: 'u4', name: '', favorite: false, relation: '', count: 3, confidence: 0.72 }

const ALL = [ALICE, CAROL, BOB, U1, U2, U3, U4]

function ids(w: ReturnType<typeof mount>, sel: string): string[] {
  return w.findAll(sel).map((n) => String(n.attributes('data-id')))
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: ALL, facesIndexedUpTo: null })
  svc.photos.mergeSuggestions.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.personFaceThumbnailUrl.mockClear()
})

describe('PhotosPeople.vue — 生命周期与分区', () => {
  it('onMounted 拉人物 + 拉合并建议 + 读一次 getConfig', async () => {
    await mountView()
    expect(svc.photos.listPersons).toHaveBeenCalledTimes(1)
    expect(svc.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
  })

  it('三个分区各渲染正确成员:收藏→Pinned,其余已命名→Named,过阈值未命名→Unnamed', async () => {
    const { w } = await mountView()
    expect(ids(w, '[data-test="pinned-card"]')).toEqual(['42'])
    expect(ids(w, '[data-test="named-card"]')).toEqual(['3', 'b7'])
    expect(ids(w, '[data-test="cluster-card"]')).toEqual(['u1', 'u2'])
  })

  it('横幅副行:已命名数 / 可见未命名数 / facesIndexedUpTo 日期', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: ALL, facesIndexedUpTo: '2026-07-20T10:00:00Z' })
    const { w } = await mountView()
    const sub = w.find('[data-test="people-sub"]').text()
    expect(sub).toContain('3 个已命名')
    expect(sub).toContain('2 个未命名人物')
    expect(w.find('[data-test="people-indexed"]').exists()).toBe(true)
    expect(w.find('[data-test="people-indexed"]').text()).toContain('2026')
  })

  it('facesIndexedUpTo 为空 → 不渲染索引日期段', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="people-indexed"]').exists()).toBe(false)
  })

  it('Pinned 卡片显示照片数千分位,Named 卡片名字与计数同行', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="pinned-card"]').text()).toContain('120')
    const carol = w.findAll('[data-test="named-card"]').find((c) => c.attributes('data-id') === '3')!
    const row = carol.find('[data-test="named-name-row"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Carol')
    expect(row.text()).toContain('50')
  })
})

describe('PhotosPeople.vue — 置信度', () => {
  it('未命名卡片渲染置信度角标(0.87→87%),且角标不是头像圆环的子节点', async () => {
    const { w } = await mountView()
    const u1 = w.findAll('[data-test="cluster-card"]').find((c) => c.attributes('data-id') === 'u1')!
    const badge = u1.find('[data-test="cluster-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('87%')
    // 圆环 overflow:hidden 会裁掉角标 —— 必须是兄弟节点(Vue2 :201 的注释)
    const ring = u1.find('.person-avatar-ring').element
    // 正向对照:头像自身的兜底/图片确实在圆环内(证明 contains 断言不是空转)
    expect(ring.contains(u1.find('[data-test="avatar-img"]').element)).toBe(true)
    expect(ring.contains(badge.element)).toBe(false)
  })

  it('下拉顶部渲染 Vue2 :24-26 的小标题', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    expect(w.find('[data-test="conf-head"]').text()).toBe('最低人脸匹配分数')
  })

  it('未命名卡片渲染 Vue2 :204 的悬停操作提示', async () => {
    const { w } = await mountView()
    const hint = w.findAll('[data-test="cluster-card"]')[0].find('[data-test="cluster-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('+ 命名 / 合并 / 删除')
  })

  it('下拉每档旁的预览计数正确(当前 showSingletons=false)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    const opts = w.findAll('[data-test="conf-option"]')
    expect(opts).toHaveLength(6)
    const countOf = (v: number) =>
      opts.find((o) => o.attributes('data-value') === String(v))!.find('[data-test="conf-count"]').text()
    expect(countOf(50)).toContain('3')   // u1 u2 u4(u3 是单照片,被排除)
    expect(countOf(80)).toContain('2')   // u1 u2
    expect(countOf(90)).toContain('1')   // u2
    expect(countOf(95)).toContain('0')
  })

  it('选 ≥90 → 调 setConfidence(90) 且网格里低于 90 的未命名消失', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'setConfidence')
    await w.find('[data-test="conf-btn"]').trigger('click')
    const opt90 = w.findAll('[data-test="conf-option"]').find((o) => o.attributes('data-value') === '90')!
    await opt90.trigger('click')
    expect(spy).toHaveBeenCalledWith(90)
    await w.vm.$nextTick()
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(false)
    expect(ids(w, '[data-test="cluster-card"]')).toEqual(['u2'])
  })

  it('单照片开关:关闭时 count===1 不出现,按钮文案带隐藏数;点击调 setShowSingletons(true)', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    expect(ids(w, '[data-test="cluster-card"]')).not.toContain('u3')
    const btn = w.find('[data-test="singleton-toggle"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('显示 1 张单照片')

    const spy = vi.spyOn(people, 'setShowSingletons')
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledWith(true)
    await w.vm.$nextTick()
    expect(ids(w, '[data-test="cluster-card"]')).toContain('u3')
    expect(w.find('[data-test="singleton-toggle"]').text()).toBe('隐藏单张照片')
  })

  it('总开关:点「隐藏」后未命名网格整体消失', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="cluster-grid"]').exists()).toBe(true)
    await w.find('[data-test="unnamed-toggle"]').trigger('click')
    expect(w.find('[data-test="cluster-grid"]').exists()).toBe(false)
    // 总开关关闭时单照片开关也一起消失(照 Vue2 :180 的 showUnnamed && … 条件)
    expect(w.find('[data-test="singleton-toggle"]').exists()).toBe(false)
  })
})

describe('PhotosPeople.vue — 筛选与排序', () => {
  it('切到 family → 只剩 relation==="family" 的已命名(未命名分区不受影响)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="filter-chip"][data-filter="family"]').trigger('click')
    expect(ids(w, '[data-test="pinned-card"]')).toEqual(['42'])
    expect(ids(w, '[data-test="named-card"]')).toEqual(['3'])
    expect(ids(w, '[data-test="cluster-card"]')).toEqual(['u1', 'u2'])
  })

  it('前四个 chip 带计数徽标,recent 没有(负向断言,照 Vue2)', async () => {
    const { w } = await mountView()
    const chipOf = (f: string) => w.find(`[data-test="filter-chip"][data-filter="${f}"]`)
    expect(chipOf('all').find('[data-test="chip-count"]').text()).toBe('3')
    expect(chipOf('family').find('[data-test="chip-count"]').text()).toBe('2')
    expect(chipOf('friend').find('[data-test="chip-count"]').text()).toBe('1')
    expect(chipOf('work').find('[data-test="chip-count"]').text()).toBe('0')
    expect(chipOf('recent').find('[data-test="chip-count"]').exists()).toBe(false)
  })

  it('排序切到 name → Named 分区 DOM 顺序变字母序(证明接了 sortNamed)', async () => {
    const { w } = await mountView()
    expect(ids(w, '[data-test="named-card"]')).toEqual(['3', 'b7'])   // 后端序 Carol, Bob
    await w.find('[data-test="sort-btn"]').trigger('click')
    await w.find('[data-test="sort-item"][data-sort-id="name"]').trigger('click')
    expect(w.find('[data-test="sort-menu"]').exists()).toBe(false)
    expect(ids(w, '[data-test="named-card"]')).toEqual(['b7', '3'])   // Bob, Carol
  })
})

describe('PhotosPeople.vue — 两条警告横幅', () => {
  it('mlReady === false → 渲染离线警告', async () => {
    const { w } = await mountView()
    const timeline = useTimelineStore()
    timeline.indexStatus.mlReady = false
    await w.vm.$nextTick()
    expect(w.find('[data-test="warn-ml-offline"]').exists()).toBe(true)
    expect(w.text()).toContain('Photos AI 后端离线')
  })

  it('mlReady === null(未知)→ 不渲染任何警告(三态回归)', async () => {
    const { w } = await mountView()
    const timeline = useTimelineStore()
    expect(timeline.indexStatus.mlReady).toBe(null)
    expect(w.find('[data-test="warn-ml-offline"]').exists()).toBe(false)
    expect(w.find('[data-test="warn-faces-off"]').exists()).toBe(false)
  })

  it('getConfig 返回 aiFeatures.faces === false → 渲染人脸识别已关闭横幅,且与离线横幅互斥', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: { faces: false } })
    const { w } = await mountView()
    expect(w.find('[data-test="warn-faces-off"]').exists()).toBe(true)
    const timeline = useTimelineStore()
    timeline.indexStatus.mlReady = false
    await w.vm.$nextTick()
    expect(w.find('[data-test="warn-ml-offline"]').exists()).toBe(false)
  })

  it('getConfig 缺 aiFeatures 字段 / 请求失败 → 一律按开启处理,不吓用户', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: {} })
    const a = await mountView()
    expect(a.w.find('[data-test="warn-faces-off"]').exists()).toBe(false)

    svc.photos.getConfig.mockRejectedValue(new Error('boom'))
    const b = await mountView()
    expect(b.w.find('[data-test="warn-faces-off"]').exists()).toBe(false)
  })
})

describe('PhotosPeople.vue — 合并建议横幅', () => {
  const SUGGESTION = { id: 'm1', fromId: 'u1', intoId: 42, intoName: 'Alice', confidence: 0.91 }

  it('mergeSuggestions 非空 → 横幅出现,副文案带百分比,两个头像叠层', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    const banner = w.find('[data-test="merge-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Nimo 发现了 1 个可能的合并')
    expect(banner.text()).toContain('91%')
    expect(banner.text()).toContain('Alice')
    expect(banner.findAll('.person-avatar')).toHaveLength(2)
  })

  it('点关闭 → dismissAllMerges 被调,横幅消失', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'dismissAllMerges')
    await w.find('[data-test="merge-dismiss"]').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    await w.vm.$nextTick()
    expect(w.find('[data-test="merge-banner"]').exists()).toBe(false)
  })

  it('点 Review → 置 reviewOpen/reviewIdx(T8 接管前的占位状态)', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    expect(w.find('[data-test="review-state"]').exists()).toBe(false)
    await w.find('[data-test="merge-review"]').trigger('click')
    expect(w.find('[data-test="review-state"]').attributes('data-idx')).toBe('0')
  })

  it('警告横幅与合并横幅可同时出现(照 Vue2:两个独立 v-if)', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: { faces: false } })
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    expect(w.find('[data-test="warn-faces-off"]').exists()).toBe(true)
    expect(w.find('[data-test="merge-banner"]').exists()).toBe(true)
  })
})

describe('PhotosPeople.vue — 跳转与浮动菜单', () => {
  it('点已命名卡片 → router.push("/photos/people/<id>")(数字 id 验证 URL 拼接)', async () => {
    const { w, router } = await mountView()
    const push = vi.spyOn(router, 'push')
    const carol = w.findAll('[data-test="named-card"]').find((c) => c.attributes('data-id') === '3')!
    await carol.trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/people/3')

    await w.find('[data-test="pinned-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/people/42')
  })

  it('点未命名卡片 → 浮动菜单出现,坐标来自 getBoundingClientRect', async () => {
    const { w } = await mountView()
    const card = w.findAll('[data-test="cluster-card"]')[0]
    ;(card.element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 100, width: 80, bottom: 200, top: 128, right: 180, height: 72, x: 100, y: 128, toJSON: () => ({}) }) as DOMRect
    await card.trigger('click')

    const menu = w.find('[data-test="cluster-menu"]')
    expect(menu.exists()).toBe(true)
    expect(menu.attributes('style')).toContain('left: 140px')
    expect(menu.attributes('style')).toContain('top: 208px')
  })

  it('菜单三项分别置 dialog 状态(name/merge/delete),不打开任何真实弹窗', async () => {
    for (const [testId, mode] of [['menu-name', 'name'], ['menu-merge', 'merge'], ['menu-delete', 'delete']] as const) {
      const { w } = await mountView()
      await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
      await w.find(`[data-test="${testId}"]`).trigger('click')
      const state = w.find('[data-test="cluster-dialog-state"]')
      expect(state.exists()).toBe(true)
      expect(state.attributes('data-mode')).toBe(mode)
      expect(state.attributes('data-person-id')).toBe('u1')
      // 菜单点完即关
      expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
    }
  })

  it('点 document 别处 → 菜单关闭', async () => {
    const { w } = await mountView()
    await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
  })

  it('按 Esc → 菜单关闭(Vue2 没有 Esc,本仓浮层规范补齐)', async () => {
    const { w } = await mountView()
    await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="cluster-menu"]').exists()).toBe(false)
  })

  it('按 Esc → 置信度下拉与排序下拉都关闭', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(false)

    await w.find('[data-test="sort-btn"]').trigger('click')
    expect(w.find('[data-test="sort-menu"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sort-menu"]').exists()).toBe(false)
  })

  it('点 document 别处 → 置信度下拉关闭', async () => {
    const { w } = await mountView()
    await w.find('[data-test="conf-btn"]').trigger('click')
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="conf-menu"]').exists()).toBe(false)
  })

  // 评审 Minor 修正:原先这条是假绿 —— `expect(typeof addEventListener).toBe('function')` 是
  // 死断言,而「派发不抛错」在把 onUnmounted 整块删掉时也照样绿(handler 在已卸载实例上写
  // ref 不会报错)。改成对着 add/remove 的**函数引用**比对:摘的必须正好是挂的那两个。
  it('卸载后 document 监听成对摘干净(比对函数引用,不只看不抛错)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const { w } = await mountView()
    const added = addSpy.mock.calls.filter(
      (c) => c[0] === 'mousedown' || c[0] === 'keydown',
    ) as Array<[string, EventListener]>
    // 本视图自己挂的两个(PhotosSidebar 的抽屉 keydown 只在窄屏打开时才挂,这里不在场)
    expect(added.map((c) => c[0])).toEqual(['mousedown', 'keydown'])

    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    const removed = removeSpy.mock.calls as Array<[string, EventListener]>
    // 只认「引用与挂载时相同」的那些摘除:摘错函数(比如重新包一个箭头函数)会留下野监听。
    // 不断言 removed 总条数 —— PhotosSidebar 的抽屉 keydown 是无条件 removeEventListener
    // (它自己挂的那次没发生,摘是空转),会多出一条与本视图无关的调用。
    const matched = added.filter(([type, fn]) => removed.some((r) => r[0] === type && r[1] === fn))
    expect(matched).toHaveLength(2)
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

describe('PhotosPeople.vue — 空态', () => {
  it('peopleLoaded 且 people 为空 → 空态文案出现,三个分区标题都不出现', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [], facesIndexedUpTo: null })
    const { w } = await mountView()
    expect(w.find('[data-test="people-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('还没有识别出人物')
    expect(w.find('[data-test="section-pinned"]').exists()).toBe(false)
    expect(w.find('[data-test="section-named"]').exists()).toBe(false)
    expect(w.find('[data-test="section-unnamed"]').exists()).toBe(false)
  })

  it('拉取失败(peopleLoaded 仍为 false)→ 不渲染空态', async () => {
    svc.photos.listPersons.mockRejectedValue(new Error('boom'))
    const { w } = await mountView()
    expect(usePhotosPeople().peopleLoaded).toBe(false)
    expect(w.find('[data-test="people-empty"]').exists()).toBe(false)
  })
})

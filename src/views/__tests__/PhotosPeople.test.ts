// Task 6 (SP7-P5 人物): PhotosPeople.vue —— 人物列表视图(横幅 + 置信度下拉 + 筛选/排序 +
// 两条警告横幅 + 合并建议横幅 + Pinned/Named/Unnamed 三分区 + 浮动操作菜单 + 空态)。
// 挂 Pinia + i18n + 真实 router(spy push,不 mock 整个 vue-router —— AreaShell/PhotosSidebar
// 都用 useRouter(),照 PhotosAlbums.test.ts 的既有挂载套路),mock 共享包 photos 方法。
// 覆盖 brief Step 1 的 12 条行为清单 + facesEnabled 的三种来源(false / 缺字段 / 请求失败)。
//
// Task 7(本次追加):ClusterActionDialog 真正接上后的三条提交路径接线用例 —— 见文件末尾
// "T7 三态弹窗接线" describe 块。updatePerson/mergePersons/purgePerson 是 usePhotosPeople()
// store 内部经由 service.photos 调用的真实端点,这里 mock 到 svc 上而不是 mock 整个 store,
// 端到端验证 store 与弹窗真的接上了(同 AlbumPickerDialog.test.ts 的既有套路)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    updatePerson: vi.fn().mockResolvedValue(undefined),
    mergePersons: vi.fn().mockResolvedValue(undefined),
    purgePerson: vi.fn().mockResolvedValue(undefined),
    rejectMergeSuggestion: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosPeople from '../PhotosPeople.vue'
import { usePhotosPeople } from '../../photos/stores/people'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'

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
  svc.photos.updatePerson.mockClear().mockResolvedValue(undefined)
  svc.photos.mergePersons.mockClear().mockResolvedValue(undefined)
  svc.photos.purgePerson.mockClear().mockResolvedValue(undefined)
  svc.photos.rejectMergeSuggestion.mockClear().mockResolvedValue(undefined)
})
// 关键隔离(同 people.test.ts:46-54 的既有教训):_purgeTimers 是 people store 模块作用域
// 单例,不随 setActivePinia(createPinia()) 重置。T7 的删除测试用同一个 id('u1')反复调
// purgePersonWithUndo,若不清,上一条用例留下的悬挂 entry(未 advanceTimers 也未 undo())
// 会在下一条用例里被"复用首次 idx/snapshot"分支捡到,插回的是上一个 store 实例的快照——
// 用 afterEach(不是 beforeEach,理由同上引处)兜底清空。
afterEach(() => {
  usePhotosPeople().__resetForTest()
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

  it('点 Review → 打开真实的 MergeReviewDialog,定位到第 1 条', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([SUGGESTION])
    const { w } = await mountView()
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
    await w.find('[data-test="merge-review"]').trigger('click')
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="mrd-title"]').text()).toBe('可能的合并 1 / 1')
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

  // T7:菜单三项打开对应 mode 的真实 ClusterActionDialog(此前 T6 只置一个隐藏占位状态,
  // T7 把它换成真弹窗——断言各 mode 特有的 DOM 而不是占位属性)。
  it('菜单三项分别打开对应 mode 的真实弹窗(name/merge/delete),菜单点完即关', async () => {
    const checks: Record<'menu-name' | 'menu-merge' | 'menu-delete', (w: Awaited<ReturnType<typeof mountView>>['w']) => void> = {
      'menu-name': (w) => expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true),
      'menu-merge': (w) => expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(true),
      'menu-delete': (w) => expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(true),
    }
    for (const testId of ['menu-name', 'menu-merge', 'menu-delete'] as const) {
      const { w } = await mountView()
      await w.findAll('[data-test="cluster-card"]')[0].trigger('click')
      await w.find(`[data-test="${testId}"]`).trigger('click')
      expect(w.find('[data-test="cad-overlay"]').exists()).toBe(true)
      checks[testId](w)
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

// ── T7:三态弹窗接线(命名/合并/删除三条提交路径 + 各自的重入守卫)──
// u1/u2 是未命名(候选自身),ALICE/CAROL/BOB 是已命名(合并候选来源 = people.named)。
async function openMenuDialog(w: Awaited<ReturnType<typeof mountView>>['w'], menuTestId: 'menu-name' | 'menu-merge' | 'menu-delete', cardIdx = 0) {
  await w.findAll('[data-test="cluster-card"]')[cardIdx].trigger('click')
  await w.find(`[data-test="${menuTestId}"]`).trigger('click')
}

describe('PhotosPeople.vue — T7 三态弹窗接线:命名', () => {
  it('成功:调 renamePerson(id, name) → 成功 toast 带名字与照片数 → 弹窗关闭', async () => {
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-name')
    await w.get('[data-test="cad-name-input"]').setValue('Sara')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await flushPromises()

    expect(svc.photos.updatePerson).toHaveBeenCalledWith('u1', { name: 'Sara' })
    expect(toast.toasts[0]!.text).toContain('Sara')
    expect(toast.toasts[0]!.text).toContain('9') // u1.count === 9
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
  })

  it('失败:renamePerson 拒绝 → 失败 toast,弹窗保持打开(可重试)', async () => {
    svc.photos.updatePerson.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-name')
    await w.get('[data-test="cad-name-input"]').setValue('Sara')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosPersonRenamedFailed)
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(true)
  })

  // 重入守卫回归(P4 期同类 bug 被抓三次):连按两次回车,第二次在第一次的请求 resolve 前触发。
  it('重入守卫:连按两次回车提交命名 → updatePerson 只被调一次', async () => {
    let resolveUpdate: (() => void) | undefined
    svc.photos.updatePerson.mockImplementation(() => new Promise((resolve) => { resolveUpdate = () => resolve(undefined) }))
    const { w } = await mountView()
    await openMenuDialog(w, 'menu-name')
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('Sara')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter' }) // 第二次回车在第一次未 resolve 前触发
    await flushPromises()

    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    resolveUpdate?.()
    await flushPromises()
  })
})

describe('PhotosPeople.vue — T7 三态弹窗接线:合并', () => {
  it('成功:调 mergePersonInto(fromId, targetId) → 成功 toast 带目标名字 → 弹窗关闭', async () => {
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-merge')
    // 候选来源 = people.named,按 count 降序:Alice(120) > Bob(90) > Carol(50) —— 第一项是 Alice。
    const first = w.get('[data-test="cad-candidate"]')
    expect(first.attributes('data-id')).toBe('42')
    await first.trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toContain('Alice')
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
  })

  it('失败:mergePersons 拒绝 → 失败 toast(T7 偏离登记 8:Vue2 不 await 且先弹假成功);弹窗仍关闭', async () => {
    svc.photos.mergePersons.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-merge')
    await w.get('[data-test="cad-candidate"]').trigger('click')
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeFailed)
    // 唯一成功 toast 的文案不应该出现——回归"先弹成功再报错"的 Vue2 bug
    expect(toast.toasts.some((tt) => tt.text.includes('已合并到'))).toBe(false)
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
  })

  it('重入守卫:连点两次同一候选(第二次在第一次未 resolve 前触发)→ mergePersons 只被调一次', async () => {
    let resolveMerge: (() => void) | undefined
    svc.photos.mergePersons.mockImplementation(() => new Promise((resolve) => { resolveMerge = () => resolve(undefined) }))
    const { w } = await mountView()
    await openMenuDialog(w, 'menu-merge')
    const candidate = w.get('[data-test="cad-candidate"]')
    await candidate.trigger('click')
    await candidate.trigger('click') // 第二次点击在第一次未 resolve 前触发(弹窗此刻仍开着)
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
    resolveMerge?.()
    await flushPromises()
  })
})

describe('PhotosPeople.vue — T7 三态弹窗接线:删除', () => {
  it('成功:purgePersonWithUndo 被调 → 弹窗关闭 → toast 带 5000ms 与 undo action', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    const toast = useToast()
    const purgeSpy = vi.spyOn(people, 'purgePersonWithUndo')
    const toastSpy = vi.spyOn(toast, 'show')
    await openMenuDialog(w, 'menu-delete')
    await w.get('[data-test="cad-confirm-delete"]').trigger('click')

    expect(purgeSpy).toHaveBeenCalledWith('u1')
    expect(w.find('[data-test="cad-overlay"]').exists()).toBe(false)
    // 未命名人物(name==='')落到 photosPersonThisPerson 兜底,不加引号(照 confirmDelete
    // 的兜底逻辑,有名字才加双引号)。
    expect(toastSpy).toHaveBeenCalledWith(`${zh.photosPersonThisPerson} 已删除`, 5000, {
      label: zh.photosPersonUndo,
      onClick: expect.any(Function),
    })
    // 删除立即从网格里消失(purgePersonWithUndo 是乐观本地移除)
    expect(ids(w, '[data-test="cluster-card"]')).not.toContain('u1')
  })

  it('点 toast 里的撤销 action → 调用 undo,人物重新出现在未命名网格', async () => {
    const { w } = await mountView()
    const toast = useToast()
    await openMenuDialog(w, 'menu-delete')
    await w.get('[data-test="cad-confirm-delete"]').trigger('click')
    expect(ids(w, '[data-test="cluster-card"]')).not.toContain('u1')

    const action = toast.toasts[0]!.action!
    action.onClick()
    await w.vm.$nextTick()
    expect(ids(w, '[data-test="cluster-card"]')).toContain('u1')
  })

  // 评审必修 2(第二轮):删除路径**没有**独立的 in-flight 守卫 ref——onSubmitDelete 全程
  // 无 await,一次 dispatchEvent 内跑完,`dialog.value = null` 本身就是天然的防重入锁。
  // 两次点击在 Vue 把面板从 DOM 摘掉之前的同一个同步窗口内都打在同一个按钮上,第二次调用
  // 会在 `onSubmitDelete` 开头被 `!dialog.value` 挡下(第一次调用已把它置空)。已做删码
  // 验证(见 task-7-report.md §11):临时把 `if (!dialog.value) return` 改成
  // `if (false) return`(即彻底移除这条防线,保留其余逻辑不变),重跑本条测试——
  // `purgePersonWithUndo` 被调 2 次,断言 `toHaveBeenCalledTimes(1)` 真的变红;还原后
  // 复跑变绿。证明这条测试确实在验 `dialog.value` 置空这个真实机制,不是"删代码依然绿"
  // 的假绿(评审点名的那种,之前挂一个 `deletingSubmitting` ref 时就是这种假绿)。
  it('删除路径由 dialog.value 置空天然防重入(无独立守卫 ref):连点两次确认删除只调一次 purgePersonWithUndo', async () => {
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'purgePersonWithUndo')
    await openMenuDialog(w, 'menu-delete')
    const btn = w.get('[data-test="cad-confirm-delete"]')
    const p1 = btn.trigger('click')
    const p2 = btn.trigger('click')
    await Promise.all([p1, p2])

    expect(spy).toHaveBeenCalledTimes(1)
  })
})

// ── T8:合并建议审阅弹窗接线(accept/reject 两条提交路径 + 防重入回归 + index 钳制)──
// 防重入的说明(评审必修,同 T7 §11 delete 路径的先例):onReviewAccept/onReviewReject 起草
// 时各加了一个独立 in-flight 守卫 ref,删码验证(把 `if (guard) return` 改成 `if (false)
// return`)后下面两条"连点两次…只被调一次"回归测试依然全绿——真正挡住第二次调用的是
// MergeReviewDialog 自己的 `if (!current.value) return`(store 的 accept/rejectMergeSuggestion
// 在函数体最开头就同步把这条建议从数组里摘掉,current.value 早于任何 await 就已经变成
// undefined)+ store 自身 `if (s) {...}` 的幂等判定,两层都已经在,独立 ref 没有实际保护
// 价值,已删除(详见 PhotosPeople.vue 的 onReviewAccept 头部注释)。测试标题反映真实机制,
// 不再写"重入守卫"。
const S1 = { id: 'm1', fromId: 'u1', intoId: 42, intoName: 'Alice', confidence: 0.91 }
const S2 = { id: 'm2', fromId: 'u2', intoId: 3, intoName: '', confidence: 0.6 }
const S3 = { id: 'm3', fromId: 'b7', intoId: 3, intoName: 'Carol', confidence: 0.55 }

async function openReview(w: Awaited<ReturnType<typeof mountView>>['w']) {
  await w.find('[data-test="merge-review"]').trigger('click')
}

describe('PhotosPeople.vue — T8 合并建议审阅弹窗接线:接受', () => {
  it('成功:调 mergePersons(fromId, intoId) → 成功 toast 带 intoName → 只剩这一条时弹窗关闭', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toContain('Alice')
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  // 不断言弹窗开/关:store 的 acceptMergeSuggestion 失败路径会 `void fetchMergeSuggestions()`
  // 纠正性重拉(people.ts 头部注释"先乐观移除建议,失败重拉建议列表纠正"),这条重拉与
  // 本组件 finally 里的 clampReviewIndex 谁先跑,取决于两者各自还剩几个 await 跳,在真实
  // 网络延迟下几乎总是 clamp 先跑(建议仍是空 → 关弹窗);但在本测试用的全同步 mock 下
  // 顺序会反过来(重拉先落地、建议已经恢复 → 不关)。这是设计里天然存在的竞态,不是本次
  // 要修的 bug,这里只断言与竞态无关的确定性事实(调用参数 + 失败 toast)。
  it('失败:mergePersons 拒绝 → 失败 toast', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.mergePersons.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeFailed)
  })

  it('主按钮文案缺 intoName 时用 photosPersonMergeAsSame 填充,accept 后 toast 同样落到这句', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S2])
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    expect(w.get('[data-test="mrd-accept"]').text()).toContain(zh.photosPersonMergeAsSame)
    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()
    expect(toast.toasts[0]!.text).toContain(zh.photosPersonMergeAsSame)
  })

  // index 钳制(brief 明确要求放宿主):3 条建议,定位到最后一条(index=2)并接受它 → 剩 2
  // 条,index(2) 越界 → 钳到 max(0,2-1)=1,弹窗改显示"剩下两条里的第 2 条"而不是崩或停在
  // 越界位置。
  it('index 钳制:接受最后一条建议后,index 收回到 max(0, 新长度-1)', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1, S2, S3])
    const { w } = await mountView()
    await openReview(w)
    // 手动把 reviewIdx 推到最后一条(Review 按钮只会置 0,这里模拟用户已经看到第 3 条的场景:
    // 直接调用 store 之外没有导航 UI,所以用 vm 直接改内部 ref 来复现"当前停在最后一条"这个前提)。
    ;(w.vm as unknown as { reviewIdx: number }).reviewIdx = 2
    await w.vm.$nextTick()
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 3 / 3')

    await w.get('[data-test="mrd-accept"]').trigger('click')
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledWith('b7', 3)
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(true)
    // 剩 S1、S2 两条,index 钳到 1 → 显示 "2 / 2",且是 S2(intoName 为空,走 AsSame 填充)
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 2 / 2')
    expect(w.get('[data-test="mrd-accept"]').text()).toContain(zh.photosPersonMergeAsSame)
  })

  // 防重入回归(见本 describe 块头部的删码验证说明):连点两次接受按钮,第二次在第一次的
  // 请求 resolve 前触发 —— 由 MergeReviewDialog 的 current.value 置空天然挡住,不是独立守卫 ref。
  it('连点两次接受按钮(第二次在第一次未 resolve 前触发)→ mergePersons 只被调一次(current.value 天然防重入)', async () => {
    let resolveMerge: (() => void) | undefined
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.mergePersons.mockImplementation(() => new Promise((resolve) => { resolveMerge = () => resolve(undefined) }))
    const { w } = await mountView()
    await openReview(w)
    const btn = w.get('[data-test="mrd-accept"]')
    const p1 = btn.trigger('click')
    const p2 = btn.trigger('click') // 第二次点击在第一次未 resolve 前触发(弹窗此刻仍开着)
    await Promise.all([p1, p2])
    await flushPromises()

    expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
    resolveMerge?.()
    await flushPromises()
  })
})

describe('PhotosPeople.vue — T8 合并建议审阅弹窗接线:拒绝', () => {
  it('成功:调 rejectMergeSuggestion(fromId, intoId) → 忽略 toast → 只剩这一条时弹窗关闭', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-reject"]').trigger('click')
    await flushPromises()

    expect(svc.photos.rejectMergeSuggestion).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeDismissedToast)
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  // 同上一条的竞态说明:rejectMergeSuggestion 失败同样会 void fetchMergeSuggestions() 纠正,
  // 弹窗开/关取决于两条 await 链谁先落地,不在这里断言。
  it('失败:rejectMergeSuggestion 拒绝 → 失败 toast', async () => {
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.rejectMergeSuggestion.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()
    await openReview(w)
    await w.get('[data-test="mrd-reject"]').trigger('click')
    await flushPromises()

    expect(svc.photos.rejectMergeSuggestion).toHaveBeenCalledWith('u1', 42)
    expect(toast.toasts[0]!.text).toBe(zh.photosPersonMergeFailed)
  })

  // 同上一条 accept 的删码验证结论,同一套天然机制。
  it('连点两次拒绝按钮(第二次在第一次未 resolve 前触发)→ rejectMergeSuggestion 只被调一次(current.value 天然防重入)', async () => {
    let resolveReject: (() => void) | undefined
    svc.photos.mergeSuggestions.mockResolvedValue([S1])
    svc.photos.rejectMergeSuggestion.mockImplementation(() => new Promise((resolve) => { resolveReject = () => resolve(undefined) }))
    const { w } = await mountView()
    await openReview(w)
    const btn = w.get('[data-test="mrd-reject"]')
    const p1 = btn.trigger('click')
    const p2 = btn.trigger('click')
    await Promise.all([p1, p2])
    await flushPromises()

    expect(svc.photos.rejectMergeSuggestion).toHaveBeenCalledTimes(1)
    resolveReject?.()
    await flushPromises()
  })
})

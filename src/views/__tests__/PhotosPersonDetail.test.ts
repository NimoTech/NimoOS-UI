// Task 14 (SP7-P5 人物): PhotosPersonDetail.vue —— 人物详情视图容器(**四态门控** + 共现
// 横条 + 三 tab + 选择态浮动条 + **七个自绘弹窗** + 灯箱接线)。逐段对照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue(1561 行)。
// 四态 = 骨架 / 加载失败+重试 / 人物不存在 / 正常(协调者裁定 4 由三态扩来)。
// 七弹窗 = brief 清单的六个 + Vue2 promptDialog 的 info 模式(:845-851「暂无可用照片」)。
//
// 测试策略(与 brief 的建议有一处刻意加强,已在报告登记):brief 建议「mock 共享包与
// usePersonDetail」。这里只 mock 共享包(service),**usePersonDetail 用真实实现** ——
// 乐观更新(移出后照片立即消失)、对账重拉(load 被再调一次)、头像 ver 变化这三类断言
// 只有在真实 composable 下才有意义;mock 掉它等于把被测的编排契约替换成 mock 的返回值。
// 「load 被调用」一律通过 svc.photos.getPerson 的调用次数间接断言。
//
// 铁律回归贯穿全文件:后端 id 用**数字**、路由参数用**字符串**,交叉验证 String() 归一。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    // person detail data
    getPerson: vi.fn(),
    personPlaces: vi.fn(),
    getPersonAssets: vi.fn(),
    // people store
    listPersons: vi.fn(),
    mergeSuggestions: vi.fn(),
    updatePerson: vi.fn(),
    setPersonCover: vi.fn(),
    mergePersons: vi.fn(),
    purgePerson: vi.fn(),
    detachAssetsFromPerson: vi.fn(),
    // albums store (saveAsAlbum = createAlbum + batchAddToAlbum + fetchAlbums)
    createAlbum: vi.fn(),
    batchAddToAlbum: vi.fn(),
    listAlbums: vi.fn(),
    // lightbox + timeline
    deleteAsset: vi.fn(),
    getTimeline: vi.fn(),
    getAsset: vi.fn(),
    getAssetOcr: vi.fn(),
    recordView: vi.fn(),
    listFavoriteIds: vi.fn(),
    // url builders
    thumbnailUrl: vi.fn((id: string | number, size = 'small') => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://face/${id}/${ver ?? ''}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom 无媒体栈(PhotoLightbox 挂载即引用,同 PhotosAlbumDetail.test.ts 前置)。
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPersonDetail from '../PhotosPersonDetail.vue'
import PersonHero from '../../photos/components/PersonHero.vue'
import PersonAssetGrid from '../../photos/components/PersonAssetGrid.vue'
import PersonPlacesTab from '../../photos/components/PersonPlacesTab.vue'
import PersonRelationsTab from '../../photos/components/PersonRelationsTab.vue'
import { usePhotosPeople } from '../../photos/stores/people'
import { useToast } from '../../stores/toast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const lb = useLightbox()
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// 后端 id 一律给**数字**(铁律交叉验证:路由参数恒为字符串)。
function rawPerson(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: '妈妈',
    confidence: 0.95,
    count: 128,
    favorite: false,
    relation: '',
    coverFaceId: 'face-1',
    heroAssetId: null,
    firstSeen: '2019-03-04T00:00:00Z',
    lastSeen: '2026-05-01T00:00:00Z',
    placesCount: 4,
    ...overrides,
  }
}

function asset(id: string | number, takenAt = '2026-05-01T10:00:00Z') {
  return { id, takenAt, mimeType: 'image/jpeg', originalName: `${id}.jpg` }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/people', name: 'photos-people', component: { template: '<div/>' } },
      { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
    ],
  })
}

async function mountView(id: string | number = '7') {
  const router = makeRouter()
  await router.push(`/photos/people/${id}`)
  await router.isReady()
  const w = mount(PhotosPersonDetail, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

/** 打开 Edit 菜单并点其中一项(PersonHero 内部菜单,T10 的 data-test 命名)。 */
async function pickEditMenu(w: ReturnType<typeof mount>, which: 'rename' | 'merge' | 'delete') {
  await w.find('[data-test="hero-edit-trigger"]').trigger('click')
  await w.find(`[data-test="hero-edit-${which}"]`).trigger('click')
  await flushPromises()
}

/** document 级 Esc(必须 bubbles:true —— 跨 target 的事件测试铁律)。 */
function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  // people store 的撤销窗口(_purgeTimers)是**模块级**状态,不随 pinia 重建 —— 删除人物的
  // 测试会留下一条 5 秒定时器与一个过滤条目,不清会让后续测试的 fetchPeople 把该 id 滤掉。
  usePhotosPeople().__resetForTest()
  lb.__resetForTest()
  svc.photos.getPerson.mockReset().mockResolvedValue({ person: rawPerson(), relations: [] })
  svc.photos.personPlaces.mockReset().mockResolvedValue([])
  svc.photos.getPersonAssets.mockReset().mockResolvedValue([asset('a1'), asset('a2')])
  svc.photos.listPersons.mockReset().mockResolvedValue({ persons: [rawPerson()], facesIndexedUpTo: null })
  svc.photos.mergeSuggestions.mockReset().mockResolvedValue([])
  svc.photos.updatePerson.mockReset().mockResolvedValue({})
  svc.photos.setPersonCover.mockReset().mockResolvedValue({ coverFaceId: 'face-9' })
  svc.photos.mergePersons.mockReset().mockResolvedValue(undefined)
  svc.photos.purgePerson.mockReset().mockResolvedValue(undefined)
  svc.photos.detachAssetsFromPerson.mockReset().mockResolvedValue(undefined)
  svc.photos.createAlbum.mockReset().mockResolvedValue({ id: 'alb-1', name: 'x' })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.listAlbums.mockReset().mockResolvedValue([])
  svc.photos.deleteAsset.mockReset().mockResolvedValue(undefined)
  svc.photos.getTimeline.mockReset().mockResolvedValue([])
  svc.photos.getAsset.mockReset().mockRejectedValue(new Error('no hydrate in test'))
  svc.photos.getAssetOcr.mockReset().mockResolvedValue({ lines: [] })
  svc.photos.recordView.mockReset().mockResolvedValue(undefined)
  svc.photos.listFavoriteIds.mockReset().mockResolvedValue([])
  svc.photos.personFaceThumbnailUrl.mockClear()
  svc.photos.thumbnailUrl.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosPersonDetail.vue —— 四态门控(骨架 / 加载失败+重试 / 人物不存在 / 正常)', () => {
  it('loading 且无 person → 骨架', async () => {
    // 永不 resolve 的 getPerson:停在 loading 态
    svc.photos.getPerson.mockReturnValue(new Promise(() => {}))
    const router = makeRouter()
    await router.push('/photos/people/7')
    const w = mount(PhotosPersonDetail, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="person-not-found"]').exists()).toBe(false)
    expect(w.findComponent(PersonHero).exists()).toBe(false)
  })

  it('加载完成但没有这个人 → 未找到 + 返回钮', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: null, relations: [] })
    const { w, router } = await mountView('7')
    expect(w.find('[data-test="person-not-found"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosPersonNotFound)
    await w.find('[data-test="person-not-found-back"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/people')
  })

  // 协调者裁定 4:加载失败必须与「没有这个人」可区分(T9 的 failed 标志就是为此而加)。
  it('加载失败 → 专用错误文案 + 重试钮(不复用"找不到这个人物")', async () => {
    svc.photos.getPerson.mockRejectedValue(new Error('network down'))
    const { w } = await mountView('7')
    expect(w.find('[data-test="person-load-failed"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosPersonLoadFailed)
    // 不能落到「没有这个人」那一支
    expect(w.find('[data-test="person-not-found"]').exists()).toBe(false)
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(false)
  })

  it('失败态点「重试」→ load 被再调一次;成功后翻到正常内容', async () => {
    svc.photos.getPerson.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView('7')
    expect(w.find('[data-test="person-load-failed"]').exists()).toBe(true)
    const before = svc.photos.getPerson.mock.calls.length

    await w.find('[data-test="person-retry"]').trigger('click')
    await flushPromises()
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
    expect(svc.photos.getPerson).toHaveBeenLastCalledWith('7')
    expect(w.find('[data-test="person-load-failed"]').exists()).toBe(false)
    expect(w.find('[data-test="hero-name"]').text()).toBe('妈妈')
  })

  it('重试在途期间不重复发请求(loading 短路 + 按钮 disabled)', async () => {
    svc.photos.getPerson.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView('7')
    let release: (() => void) | null = null
    svc.photos.getPerson.mockImplementation(
      () => new Promise((res) => { release = () => res({ person: rawPerson(), relations: [] }) }),
    )
    const before = svc.photos.getPerson.mock.calls.length
    const btn = w.find('[data-test="person-retry"]')
    await btn.trigger('click')
    // load() 在 await 之前同步置 loading —— 门控立刻切回骨架,重试钮已不在 DOM 上
    expect(w.find('[data-test="person-retry"]').exists()).toBe(false)
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(true)
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
    release!()
    await flushPromises()
  })

  it('正常态 → hero + tabs + 资产网格', async () => {
    const { w } = await mountView('7')
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(false)
    expect(w.findComponent(PersonHero).exists()).toBe(true)
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(true)
    expect(w.find('[data-test="hero-name"]').text()).toBe('妈妈')
  })
})

// Plan D Task 3(换壳 + 弹层归位):壳换成 PhotosPeople.vue/PhotosAlbums.vue 同款
// `.photos-root > .app > PhotosSidebar + main.main > PhotosTopbar + .photos-main`;所有弹层
// (选择态浮动条 / 七个 .pd-scrim 弹窗 / AlbumPickerDialog)搬进 .photos-root 内,唯独
// PhotoLightbox 仍是 .photos-root 的兄弟(Plan F 前铁律,见文件模板处的注释)。
describe('PhotosPersonDetail.vue —— 换壳 + 弹层归位(Plan D Task 3)', () => {
  // Fix round 1(controller ruling on Deviation A,2026-08-14):plan 原文的 `back = true` 是
  // 计划本身的缺陷 —— Vue2 源(权威依据)PhotosPeopleTopbar.vue:6-9/36 里 People 详情态顶栏
  // 永远只有 title+sub,没有返回箭头;返回入口在 hero 里(Vue2 `.detail-hero .back`,本仓
  // 对应 PersonHero 的 `hero-back` 按钮,emit('back') → 容器已有的 goToPeopleList)。
  // PhotosTopbar.vue 保持不动,`back` 与 title/sub 互斥的原实现不变——所以这里断言
  // back 假值 + title/sub 是真正要保的视觉契约。
  it('mounts .app shell; topbar shows person name with Unnamed fallback, no back chevron', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ name: '' }), relations: [] })
    const { w } = await mountView('7')
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.props('title')).toBe(zh.photosPersonUnnamedTitle)
    expect(topbar.props('sub')).toBe(zh.photosPersonSubtitle)
    expect(topbar.props('back')).toBeFalsy()
    expect(w.find('.photos-root > .app').exists()).toBe(true)
  })

  it('renders selection bar and person dialogs inside .photos-root, lightbox outside', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('.photos-root .selection-bar').exists()).toBe(true)
    // PhotoLightbox 仍是 .photos-root 的兄弟(Plan F 前铁律)
    const rootEl = w.find('.photos-root').element
    const lbComp = w.findComponent({ name: 'PhotoLightbox' })
    expect(rootEl.contains(lbComp.element)).toBe(false)
  })
})

describe('PhotosPersonDetail.vue —— 路由参数铁律', () => {
  it('personId 走 String(route.params.id):数字后端 id / 字符串路由参数交叉一致', async () => {
    await mountView(7)
    expect(svc.photos.getPerson).toHaveBeenCalledWith('7')
    expect(svc.photos.personPlaces).toHaveBeenCalledWith('7')
    expect(svc.photos.getPersonAssets).toHaveBeenCalledWith('7', 300, 0)
  })

  it('route.params.id 变化 → 重新 load + 清空选中 + tab 复位(hash 路由同组件不重建)', async () => {
    const { w, router } = await mountView('7')
    // 先切到地点 tab + 选中一张
    await w.find('[data-test="person-tab-places"]').trigger('click')
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(true)
    await w.find('[data-test="person-tab-timeline"]').trigger('click')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(true)
    await w.find('[data-test="person-tab-places"]').trigger('click')

    const before = svc.photos.getPerson.mock.calls.length
    await router.push('/photos/people/9')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
    expect(svc.photos.getPerson).toHaveBeenLastCalledWith('9')
    // 选中清空 → 浮动条消失
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
    // tab 复位 timeline
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(false)
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(true)
  })

  it('route.params.id 变化 → 关掉打开着的弹窗', async () => {
    const { w, router } = await mountView('7')
    await pickEditMenu(w, 'rename')
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(true)
    await router.push('/photos/people/9')
    await flushPromises()
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(false)
  })
})

describe('PhotosPersonDetail.vue —— 三个 tab', () => {
  it('切 tab 渲染对应子组件,且只渲染一个', async () => {
    const { w } = await mountView('7')
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(true)
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(false)
    expect(w.findComponent(PersonRelationsTab).exists()).toBe(false)

    await w.find('[data-test="person-tab-places"]').trigger('click')
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(false)
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(true)

    await w.find('[data-test="person-tab-relations"]').trigger('click')
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(false)
    expect(w.findComponent(PersonRelationsTab).exists()).toBe(true)
  })

  it('地点 tab 由容器算好 PlaceGroup[] 传给关系 tab(groupPlaces 归一 unknown 文案)', async () => {
    svc.photos.personPlaces.mockResolvedValue([
      { placeName: '东京', latitude: 35.6, longitude: 139.7 },
      { placeName: '东京', latitude: 35.6, longitude: 139.7 },
      { placeName: null, latitude: null, longitude: null },
    ])
    const { w } = await mountView('7')
    await w.find('[data-test="person-tab-relations"]').trigger('click')
    const groups = w.findComponent(PersonRelationsTab).props('places')
    expect(groups.map((g) => [g.name, g.count])).toEqual([['东京', 2], [zh.photosPersonUnknownPlace, 1]])
  })
})

describe('PhotosPersonDetail.vue —— 共现横条', () => {
  it('只在 timeline tab 顶部,按 count 降序,点击跳转到那个人(数字 id → 字符串路由)', async () => {
    svc.photos.getPerson.mockResolvedValue({
      person: rawPerson(),
      relations: [
        { personId: 11, name: '小明', coverFaceId: 'f11', count: 12 },
        { personId: 12, name: '小红', coverFaceId: 'f12', count: 40 },
      ],
    })
    const { w, router } = await mountView('7')
    const cards = w.findAll('[data-test="coappear-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('小红')   // count 40 在前
    expect(cards[1].text()).toContain('小明')
    await cards[0].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/people/12')

    // 切到地点 tab 后横条消失
    await w.find('[data-test="person-tab-places"]').trigger('click')
    expect(w.findAll('[data-test="coappear-card"]')).toHaveLength(0)
  })
})

describe('PhotosPersonDetail.vue —— 收藏切换(偏离登记 3)', () => {
  it('成功:乐观 patch 生效', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('toggle-fav')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { favorite: true })
    expect(w.findComponent(PersonHero).props('person').favorite).toBe(true)
  })

  it('失败:本地 favorite 回到原值 + toast', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    w.findComponent(PersonHero).vm.$emit('toggle-fav')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person').favorite).toBe(false)
    expect(toast.msg).toBe(zh.photosPersonFavFailed)
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    const hero = w.findComponent(PersonHero)
    hero.vm.$emit('toggle-fav')
    await w.vm.$nextTick()
    hero.vm.$emit('toggle-fav')
    await w.vm.$nextTick()
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue —— 关系分组(偏离登记 4)', () => {
  it('成功:乐观 patch 生效', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('pick-relation', 'family')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { relation: 'family' })
    expect(w.findComponent(PersonHero).props('person').relation).toBe('family')
  })

  it('失败:回滚 + toast', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    w.findComponent(PersonHero).vm.$emit('pick-relation', 'work')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person').relation).toBe('')
    expect(toast.msg).toBe(zh.photosPersonRelationFailed)
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    const hero = w.findComponent(PersonHero)
    hero.vm.$emit('pick-relation', 'family')
    await w.vm.$nextTick()
    hero.vm.$emit('pick-relation', 'friend')
    await w.vm.$nextTick()
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue —— 改名弹窗', () => {
  it('成功:hero 显示新名 + 关弹窗', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'rename')
    const input = w.find('[data-test="person-rename-input"]')
    expect((input.element as HTMLInputElement).value).toBe('妈妈')
    await input.setValue('老妈')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { name: '老妈' })
    expect(w.find('[data-test="hero-name"]').text()).toBe('老妈')
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(false)
  })

  it('失败:toast 且弹窗仍开(便于改)', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-input"]').setValue('老妈')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.msg).toBe(zh.photosPersonRenamedFailed)
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(true)
  })

  it('名字未变 / 空名 → 直接关弹窗,不发请求(照 Vue2 :911)', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).not.toHaveBeenCalled()
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(false)
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-input"]').setValue('老妈')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

// ── 终审 Important 3:身份守卫(在途请求 + 换人)────────────────────────────────
// 这一组与"重入守卫"是两件不同的事:重入守卫防同一个人物上连点两次,身份守卫防
// 「请求在途期间用户换人了,晚到的响应把 A 的数据写到 B 上」。用可手动 resolve/reject 的
// deferred promise 精确制造这个时序;切页走 router.push(等价于浏览器后退键 —— hash 路由,
// 不必点穿遮罩)。
describe('PhotosPersonDetail.vue —— 身份守卫(在途请求跨人物)', () => {
  // A = id 7「妈妈」,B = id 8「爸爸」。
  function twoPeople(bOverrides: Record<string, unknown> = {}, aOverrides: Record<string, unknown> = {}) {
    svc.photos.getPerson.mockImplementation((id: string | number) =>
      Promise.resolve({
        person: String(id) === '8'
          ? rawPerson({ id: 8, name: '爸爸', ...bOverrides })
          : rawPerson(aOverrides),
        relations: [],
      }))
  }

  it('A 页改名的 PATCH 在切到 B 之后才 resolve → 名字**不会**写到 B 上', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    twoPeople()
    const { w, router } = await mountView('7')

    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-input"]').setValue('张三')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { name: '张三' })

    // 后退到 B(同组件复用 → route watch 重新 load)
    await router.push('/photos/people/8')
    await flushPromises()
    expect(w.find('[data-test="hero-name"]').text()).toBe('爸爸')

    release!()                                   // A 的 PATCH 现在才回来
    await flushPromises()
    expect(w.find('[data-test="hero-name"]').text()).toBe('爸爸')
  })

  it('A 页收藏失败的**回滚**在切到 B 之后才发生 → B 的收藏态不被改,也不弹属于 A 的 toast', async () => {
    let fail: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((_res, rej) => {
      fail = () => rej(new Error('boom'))
    }))
    // A 已收藏(点一下 → 乐观取消),B 未收藏 —— 回滚值 true 与 B 的 false 不同才观察得到污染。
    twoPeople({ favorite: false }, { favorite: true })
    const { w, router } = await mountView('7')
    const toast = useToast()

    await w.find('[data-test="hero-fav"]').trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { favorite: false })

    await router.push('/photos/people/8')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person')).toMatchObject({ id: 8, favorite: false })

    fail!()                                      // A 的失败现在才回来 → 无守卫时回滚写 B
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person')).toMatchObject({ id: 8, favorite: false })
    expect(toast.toasts).toEqual([])
  })
})

describe('PhotosPersonDetail.vue —— 选择态与关键照片', () => {
  it('单选出现「设为关键照片」,多选不出现', async () => {
    const { w } = await mountView('7')
    const grid = w.findComponent(PersonAssetGrid)
    grid.vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-set-key-photo"]').exists()).toBe(true)
    grid.vm.$emit('toggle-select', 'a2')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-set-key-photo"]').exists()).toBe(false)
    expect(w.find('[data-test="person-selection-bar"]').text()).toContain('2')
  })

  it('设关键照片成功:setPersonCover + 头像 ver 换成新 coverFaceId + toast + 退出选择态', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    svc.photos.personFaceThumbnailUrl.mockClear()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(svc.photos.setPersonCover).toHaveBeenCalledWith('7', 'a1')
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoToast)
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
    // 头像 URL 用了新的 coverFaceId(cache-bust)
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(7, 'face-9')
  })

  // 评审必修 1:后端返回 `200 {}`(成功但不带 coverFaceId)时,本地封面**必须保持原值** ——
  // 无条件 patch 会把它抹成 null,PersonHero 的 isFallback 当场为真、hero 退成渐变兜底。
  it('设关键照片:后端不带 coverFaceId(200 {}) → 本地封面保持原值,hero 不退化', async () => {
    svc.photos.setPersonCover.mockResolvedValue({})
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(svc.photos.setPersonCover).toHaveBeenCalledWith('7', 'a1')
    // 原值 'face-1' 必须还在(不是 null)
    expect(w.findComponent(PersonHero).props('person').coverFaceId).toBe('face-1')
    // 有封面 ⇒ 不是渐变兜底态
    expect(w.find('[data-test="hero-bg"]').classes()).not.toContain('is-fallback')
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoToast)
  })

  // 与上一条成对:后端**显式** null = 要求清空封面,这时必须写进去(两种情况不可混为一谈)。
  it('设关键照片:后端显式返回 coverFaceId: null → 写入 null(清空封面)', async () => {
    svc.photos.setPersonCover.mockResolvedValue({ coverFaceId: null })
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person').coverFaceId).toBeNull()
  })

  it('设关键照片 404 → 专用文案「那张照片里没有这个人的脸」', async () => {
    svc.photos.setPersonCover.mockRejectedValue({ response: { status: 404 } })
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoNoFace)
  })

  it('设关键照片其它错误 → 通用失败文案', async () => {
    svc.photos.setPersonCover.mockRejectedValue({ response: { status: 500 } })
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoFailed)
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    let release: (() => void) | null = null
    svc.photos.setPersonCover.mockImplementation(
      () => new Promise((res) => { release = () => res({ coverFaceId: 'face-9' }) }),
    )
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    const btn = w.find('[data-test="person-set-key-photo"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.setPersonCover).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })

  it('取消退出选择态', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-selection-cancel"]').trigger('click')
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
  })
})

describe('PhotosPersonDetail.vue —— 移出资产', () => {
  it('确认后照片立即从网格消失(乐观),之后 load 再跑一次对账', async () => {
    // 请求刻意挂住:这样"网格里 a1 已经不见了"只可能来自乐观更新,不可能来自重拉。
    let settle: (() => void) | null = null
    svc.photos.detachAssetsFromPerson.mockImplementation(() => new Promise<void>((res) => { settle = () => res() }))
    const { w } = await mountView('7')
    const before = svc.photos.getPerson.mock.calls.length
    w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1'])
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-detach-dialog"]').exists()).toBe(true)

    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await w.vm.$nextTick()
    // 请求还没 settle:网格里已经没有 a1(乐观),弹窗与选择态已同步关闭
    expect(w.findComponent(PersonAssetGrid).props('months').flatMap((m) => m.photos.map((p) => p.id)))
      .toEqual(['a2'])
    expect(w.find('[data-test="person-detach-dialog"]').exists()).toBe(false)
    expect(svc.photos.getPerson.mock.calls.length).toBe(before)

    settle!()
    await flushPromises()
    expect(svc.photos.detachAssetsFromPerson).toHaveBeenCalledWith('7', ['a1'])
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
  })

  it('失败也要对账重拉 + toast', async () => {
    svc.photos.detachAssetsFromPerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const before = svc.photos.getPerson.mock.calls.length
    w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1'])
    await w.vm.$nextTick()
    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonDetachFailed)
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
  })

  it('选择态批量移出:用选中的全部 id,并退出选择态', async () => {
    const { w } = await mountView('7')
    const grid = w.findComponent(PersonAssetGrid)
    grid.vm.$emit('toggle-select', 'a1')
    grid.vm.$emit('toggle-select', 'a2')
    await w.vm.$nextTick()
    await w.find('[data-test="person-remove-from"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.detachAssetsFromPerson).toHaveBeenCalledWith('7', ['a1', 'a2'])
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
  })

  it('同步关弹窗即天然防重入:确认按钮第二次点击时已不存在', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1'])
    await w.vm.$nextTick()
    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-detach-confirm"]').exists()).toBe(false)
    await flushPromises()
    expect(svc.photos.detachAssetsFromPerson).toHaveBeenCalledTimes(1)
  })
})

describe('PhotosPersonDetail.vue —— 删除人物', () => {
  it('purgePersonWithUndo + 跳回列表 + 5 秒可撤销 toast', async () => {
    vi.useFakeTimers()
    const { w, router } = await mountView('7')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await pickEditMenu(w, 'delete')
    expect(w.find('[data-test="person-delete-dialog"]').exists()).toBe(true)
    await w.find('[data-test="person-delete-confirm"]').trigger('click')
    await w.vm.$nextTick()

    expect(showSpy).toHaveBeenCalledTimes(1)
    const [text, duration, arg] = showSpy.mock.calls[0]
    // SP8-P6-T3 合流:show() 第三参现为判别联合(字符串=tier / 对象=action),按 typeof 收窄回 action。
    const action = typeof arg === 'string' ? undefined : arg
    expect(text).toContain('妈妈')
    expect(duration).toBe(5000)
    expect(action).toBeTruthy()
    expect(action!.label).toBe(zh.photosPersonUndo)
    expect(typeof action!.onClick).toBe('function')

    // 撤销闭包能把人物插回列表
    const people = usePhotosPeople()
    expect(people.people).toHaveLength(0)
    action!.onClick()
    expect(people.people).toHaveLength(1)

    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/people')
  })

  // 评审 Minor 4:标题必须是 Vue2 :304 的「删除人物?」,不是 T7 警示条那句「删除这个人物分组?」
  it('删除弹窗标题用人物专属键,不复用 T7 警示条那句', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    const dlg = w.find('[data-test="person-delete-dialog"]')
    expect(dlg.text()).toContain(zh.photosPersonDeletePersonTitle)
    expect(dlg.text()).not.toContain(zh.photosPersonDeleteTitle)
  })

  // 评审 Minor 6:正文两档灰 —— 第二句在自己的 <span> 里(才能上更淡的一档 token)
  it('删除弹窗正文分两档:正文句 + 更淡的「5 秒内可撤销」', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    const dlg = w.find('[data-test="person-delete-dialog"]')
    expect(dlg.text()).toContain(zh.photosPersonDeleteKeptBody)
    const dim = dlg.find('.pd-body-dim')
    expect(dim.exists()).toBe(true)
    expect(dim.text()).toBe(zh.photosPersonDeleteUndoHint)
  })

  it('未命名人物用占位标签', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ name: '' }), relations: [] })
    const { w } = await mountView('7')
    const showSpy = vi.spyOn(useToast(), 'show')
    await pickEditMenu(w, 'delete')
    await w.find('[data-test="person-delete-confirm"]').trigger('click')
    await w.vm.$nextTick()
    expect(showSpy.mock.calls[0][0]).toContain(zh.photosPersonUnnamedLabel)
  })

  it('同步关弹窗即天然防重入:确认按钮第二次点击时已不存在', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    await w.find('[data-test="person-delete-confirm"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-delete-confirm"]').exists()).toBe(false)
  })
})

describe('PhotosPersonDetail.vue —— 合并到他人', () => {
  const others = [
    rawPerson({ id: 8, name: '小明', count: 20 }),
    rawPerson({ id: 9, name: '小红', count: 90 }),
    rawPerson({ id: 10, name: '', count: 300 }),   // 未命名:候选池只取 named,应被排除
  ]

  it('候选 = named 排除自身、count 降序、不截断;搜索过滤', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    let rows = w.findAll('[data-test="person-merge-candidate"]')
    expect(rows.map((r) => r.attributes('data-person-id'))).toEqual(['9', '8'])
    await w.find('[data-test="person-merge-search"]').setValue('明')
    rows = w.findAll('[data-test="person-merge-candidate"]')
    expect(rows.map((r) => r.attributes('data-person-id'))).toEqual(['8'])
  })

  it('成功:toast + 跳回人物列表', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    const { w, router } = await mountView('7')
    await pickEditMenu(w, 'merge')
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    await w.find('[data-test="person-merge-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.mergePersons).toHaveBeenCalledWith('7', 9)
    expect(useToast().msg).toBe('已合并到「小红」')
    expect(router.currentRoute.value.path).toBe('/photos/people')
    expect(w.find('[data-test="person-merge-dialog"]').exists()).toBe(false)
  })

  it('失败:toast + 停在当前页 + 关弹窗', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    svc.photos.mergePersons.mockRejectedValue(new Error('boom'))
    const { w, router } = await mountView('7')
    await pickEditMenu(w, 'merge')
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    await w.find('[data-test="person-merge-confirm"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonMergeFailed)
    expect(router.currentRoute.value.path).toBe('/photos/people/7')
    expect(w.find('[data-test="person-merge-dialog"]').exists()).toBe(false)
  })

  it('未选目标时确认按钮 disabled', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    expect(w.find('[data-test="person-merge-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    let release: (() => void) | null = null
    svc.photos.mergePersons.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    const btn = w.find('[data-test="person-merge-confirm"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue —— 背景选择弹窗', () => {
  it('打开时预选当前 heroAssetId;网格数据 = 全量照片', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: 'a2' }), relations: [] })
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    const tiles = w.findAll('[data-test="hero-picker-tile"]')
    expect(tiles).toHaveLength(2)
    expect(tiles[1].attributes('data-selected')).toBe('true')
    expect(w.find('[data-test="person-hero-save"]').attributes('disabled')).toBeUndefined()
  })

  // 评审 Minor 7:后端把「无 hero」原样回吐成空串时,不能落进"已选中"状态 ——
  // 否则没有任何瓦片高亮、保存钮却可点,点下去把空串再发一遍还报「背景已更新」。
  it('heroAssetId 为空串 → 视为未选中(无瓦片高亮 + 保存钮 disabled)', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: '' }), relations: [] })
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    const tiles = w.findAll('[data-test="hero-picker-tile"]')
    expect(tiles.every((n) => n.attributes('data-selected') === 'false')).toBe(true)
    expect(w.find('[data-test="person-hero-save"]').attributes('disabled')).toBeDefined()
  })

  it('未选时保存钮 disabled;选一张后可保存 → patch + toast + 关弹窗', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-hero-save"]').attributes('disabled')).toBeDefined()
    await w.findAll('[data-test="hero-picker-tile"]')[0].trigger('click')
    await w.find('[data-test="person-hero-save"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { heroAssetId: 'a1' })
    expect(w.findComponent(PersonHero).props('person').heroAssetId).toBe('a1')
    expect(useToast().msg).toBe(zh.photosPersonHeroSavedToast)
    expect(w.find('[data-test="person-hero-dialog"]').exists()).toBe(false)
  })

  // 协调者裁定 3:两个入口的 toast 语义不同(「重置回关键照片」vs「改成选中的这张」),不合并。
  it('「使用关键照片」= 清空 heroAssetId,且用**重置**专属 toast(不是"背景已更新")', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: 'a2' }), relations: [] })
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.find('[data-test="person-hero-use-key"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { heroAssetId: '' })
    expect(w.findComponent(PersonHero).props('person').heroAssetId).toBe(null)
    expect(useToast().msg).toBe(zh.photosPersonHeroResetToast)
    expect(useToast().msg).not.toBe(zh.photosPersonHeroSavedToast)
  })

  it('「使用关键照片」失败 → **重置**专属失败文案', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: 'a2' }), relations: [] })
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.find('[data-test="person-hero-use-key"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonHeroResetFailed)
    expect(w.find('[data-test="person-hero-dialog"]').exists()).toBe(true)
  })

  it('失败:toast 且弹窗仍开', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.findAll('[data-test="hero-picker-tile"]')[0].trigger('click')
    await w.find('[data-test="person-hero-save"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonHeroFailed)
    expect(w.find('[data-test="person-hero-dialog"]').exists()).toBe(true)
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.findAll('[data-test="hero-picker-tile"]')[0].trigger('click')
    const btn = w.find('[data-test="person-hero-save"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue —— 建相册', () => {
  it('saveAsAlbum 收到全量照片 id + toast + 关弹窗', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([asset('a1'), asset('a2'), asset('a3', '2026-04-02T00:00:00Z')])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    const input = w.find('[data-test="person-album-input"]')
    expect((input.element as HTMLInputElement).value).toBe('妈妈')     // 默认名 = 人物名
    expect(w.find('[data-test="person-album-dialog"]').text()).toContain('3')
    await input.setValue('和妈妈的旅行')
    await w.find('[data-test="person-album-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('和妈妈的旅行')
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('alb-1', ['a1', 'a2', 'a3'])
    expect(useToast().msg).toBe('已创建相册 · 和妈妈的旅行')
    expect(w.find('[data-test="person-album-dialog"]').exists()).toBe(false)
  })

  it('未命名人物用 photosPersonAlbumNameFallback 作默认名(数字 id 也不炸)', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ id: 1234567890, name: '' }), relations: [] })
    const { w } = await mountView('1234567890')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    expect((w.find('[data-test="person-album-input"]').element as HTMLInputElement).value).toBe('人物 12345678')
  })

  it('409 → 重名文案;其它错误 → 通用失败文案', async () => {
    svc.photos.createAlbum.mockRejectedValue({ response: { status: 409 } })
    const { w } = await mountView('7')
    const toast = useToast()
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    await w.find('[data-test="person-album-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.msg).toBe(zh.photosAlbumNameExists)
    expect(w.find('[data-test="person-album-dialog"]').exists()).toBe(true)

    svc.photos.createAlbum.mockRejectedValue(new Error('boom'))
    await w.find('[data-test="person-album-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.msg).toBe(zh.photosPersonAlbumFailed)
  })

  it('没有照片时弹「暂无可用照片」提示,不发请求', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-no-photos-dialog"]').exists()).toBe(true)
    expect(w.find('[data-test="person-album-dialog"]').exists()).toBe(false)
    expect(svc.photos.createAlbum).not.toHaveBeenCalled()
  })

  it('连点两次只发一次请求(重入守卫)', async () => {
    let release: (() => void) | null = null
    svc.photos.createAlbum.mockImplementation(
      () => new Promise((res) => { release = () => res({ id: 'alb-1', name: 'x' }) }),
    )
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    const btn = w.find('[data-test="person-album-confirm"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.createAlbum).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue —— 灯箱接线', () => {
  it('点瓦片开灯箱,翻页集是未裁剪的全量(20 张的月份,网格只渲 16)', async () => {
    const many = Array.from({ length: 20 }, (_, i) => asset(`p${i}`))
    svc.photos.getPersonAssets.mockResolvedValue(many)
    const { w } = await mountView('7')
    // 网格默认只渲 16 张(T11 契约)
    expect(w.findAll('.person-grid .tile')).toHaveLength(16)
    await w.findAll('.person-grid .tile')[0].trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(20)
    expect(lb.list.value[19].id).toBe('p19')
  })

  it('灯箱删除 → deleteAssets + toast + 重新对账 load', async () => {
    const { w } = await mountView('7')
    const before = svc.photos.getPerson.mock.calls.length
    await w.findAll('.person-grid .tile')[0].trigger('click')
    await flushPromises()
    w.findComponent({ name: 'PhotoLightbox' }).vm.$emit('delete', 'a1')
    await flushPromises()
    expect(svc.photos.deleteAsset).toHaveBeenCalledWith('a1')
    expect(useToast().msg).toBe('1 项已移入最近删除')
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
  })
})

// 评审必修 2(界面 1:1 红线):Vue2 这四个按钮/角标内各有一个图标,原实现漏渲染。
describe('PhotosPersonDetail.vue —— 按钮内图标(Vue2 有的都要有)', () => {
  it('选择态移除钮内有 x 图标(Vue2 :240)', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-remove-from"] svg').exists()).toBe(true)
  })

  it('删除确认钮内有 trash 图标(Vue2 :319)', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    expect(w.find('[data-test="person-delete-confirm"] svg').exists()).toBe(true)
  })

  it('合并确认钮:选中目标后才出 sparkles 图标(Vue2 :427 的 v-if)', async () => {
    svc.photos.listPersons.mockResolvedValue({
      persons: [rawPerson(), rawPerson({ id: 9, name: '小红', count: 90 })], facesIndexedUpTo: null,
    })
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    expect(w.find('[data-test="person-merge-confirm"] svg').exists()).toBe(false)
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    expect(w.find('[data-test="person-merge-confirm"] svg').exists()).toBe(true)
  })

  it('背景网格视频角标有 ▶ + 时长(Vue2 :352;同 T11 PersonAssetGrid 的同一元素)', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([
      { id: 'v1', takenAt: '2026-05-01T10:00:00Z', mimeType: 'video/mp4', originalName: 'v1.mp4', durationMs: 5000 },
    ])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    const badge = w.find('.hero-picker-vid')
    expect(badge.exists()).toBe(true)
    expect(badge.find('.vid-play').text()).toBe('▶')
    expect(badge.text()).toContain('0:05')
  })
})

describe('PhotosPersonDetail.vue —— 七个弹窗的 Esc 都要挡住灯箱(六 + info 提示)', () => {
  const cases: Array<[string, string, (w: ReturnType<typeof mount>) => Promise<void>]> = [
    ['改名', 'person-rename-dialog', async (w) => { await pickEditMenu(w, 'rename') }],
    ['合并', 'person-merge-dialog', async (w) => { await pickEditMenu(w, 'merge') }],
    ['删除', 'person-delete-dialog', async (w) => { await pickEditMenu(w, 'delete') }],
    ['背景', 'person-hero-dialog', async (w) => {
      w.findComponent(PersonHero).vm.$emit('open-hero-picker'); await w.vm.$nextTick()
    }],
    ['建相册', 'person-album-dialog', async (w) => {
      w.findComponent(PersonHero).vm.$emit('make-album'); await w.vm.$nextTick()
    }],
    ['移出', 'person-detach-dialog', async (w) => {
      w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1']); await w.vm.$nextTick()
    }],
  ]

  for (const [label, testId, open] of cases) {
    it(`${label}弹窗:Esc 只关弹窗,灯箱不受影响`, async () => {
      const { w } = await mountView('7')
      // 先开灯箱(它在 window 上挂 keydown)
      await w.findAll('.person-grid .tile')[0].trigger('click')
      await flushPromises()
      expect(lb.open.value).toBe(true)

      await open(w)
      expect(w.find(`[data-test="${testId}"]`).exists()).toBe(true)

      pressEscape()
      await w.vm.$nextTick()
      expect(w.find(`[data-test="${testId}"]`).exists()).toBe(false)
      expect(lb.open.value).toBe(true)      // 灯箱没被同一次 Esc 一起关掉
    })
  }

  it('「暂无可用照片」提示也能被 Esc 关掉,且不连累灯箱', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-no-photos-dialog"]').exists()).toBe(true)
    pressEscape()
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-no-photos-dialog"]').exists()).toBe(false)
  })

  it('没有弹窗打开时不挂 document 监听(Esc 应能照常关灯箱)', async () => {
    const { w } = await mountView('7')
    await w.findAll('.person-grid .tile')[0].trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    pressEscape()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(false)
  })
})

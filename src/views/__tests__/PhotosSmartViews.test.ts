// SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页测试。逐条对应 task-4-brief.md
// 「必含用例」清单。挂 Pinia + i18n + 真实 router(spy push 前先真 resolve 一次,
// AreaShell/PhotosSidebar 都用 useRouter(),照 PhotosPeople.test.ts 的既有挂载套路),
// mock 共享包 photos 方法。
//
// SP15-P2b Task 5 (Vue2 939a7d3a): the smart-view grid, its hero, the create tile, and the
// create dialog all moved to PhotosAlbums.vue (Tasks 3/4) — this page is Moments-only now.
// Every test in this file that exercised a smart-view list responsibility (fetching the
// list, the loading skeleton, the hero create button, the create-tile/dialog, a card's
// `@open`, and the two CSS structural checks on `.svs-banner`/`.sv-create-btn`) has been
// deleted rather than rewritten to keep passing against the new shape — that functionality
// and its coverage now live on PhotosAlbums.vue (see PhotosAlbums.test.ts, added in Tasks
// 3/4). See task-5-report.md for the exact old-case → new-home mapping.
//
// What survives here: the `aiSmartViewOff` → `settings.fetchAiFeatures()` dedup behaviour
// (this page still consumes that store directly, unrelated to the smart-view list) and the
// `.app` grid responsive CSS structural check (Plan C Task 2 re-shell: was a `.photos-layout`
// check before the page moved onto the Vue2 `.app` grid shell). The Moments band itself — rendering,
// gating, drag-reorder, the new slim settings hint, and the h2→h1 promotion — is covered in
// the sibling file `../PhotosSmartViews.moments.test.ts` (SP15-P1-T5's established home for
// band behaviour; this branch's new cases were added there, not duplicated here).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getConfig: vi.fn().mockResolvedValue({}),
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://thumb/${id}/${size}`),
    listMoments: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViews from '../PhotosSmartViews.vue'
// 评审既有先例(PhotosPeople.test.ts):`?raw` 只用于对 <style> 原文做结构断言,不用于
// 行为断言。
import photosSmartViewsRaw from '../PhotosSmartViews.vue?raw'
import { usePhotosSettingsStore } from '../../photos/stores/settings'
import PhotosTopbar from '../../photos/components/PhotosTopbar.vue'
import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
      { path: '/photos/moments/:id', name: 'photos-moment-detail-stub', component: { template: '<div/>' } },
      // P8a-T6(§7e-9):设置链接指向 /photos/settings?section=ai——桩路由让
      // RouterLink 真的能解析出 href,不然 vue-router 会警告"no match"。
      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/smart-views')
  await router.isReady()
  const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.listMoments.mockClear().mockResolvedValue([])
})

describe('PhotosSmartViews.vue — aiFeatures 拉取去重(§7e-15,与智能视图列表无关)', () => {
  // P8a-T6(§7e-10):aiSmartViewOff 折进 photosSettings store,本页不再自己直读 getConfig
  // —— onMounted 走 settings.fetchAiFeatures(),同 PhotosPeople.vue 的收编先例。
  //
  // review fix(take-along,收紧断言):原来是 `toHaveBeenCalled()`,改紧到
  // `toHaveBeenCalledTimes(...)` 之前先手动验证了真实次数——`mountView()` 挂的是完整
  // `PhotosSmartViews`(模板里含 `<PhotosSidebar />`,T6 也给侧栏接了 fetchAiFeatures),
  // 挂载后 spy 记录的是**两次** action 调用(本页自身 + 它挂的那份侧栏各一次),不是 1 次
  // ——同 PhotosPeople.test.ts:104-112、PhotosSettings.test.ts 的既有先例(那两处也是 2,
  // 理由相同)。曾经临时改成 `toHaveBeenCalledTimes(1)` 手动跑过,确认会失败(got 2 times)
  // 才定的这个数字,不是照抄评审建议的字面值。
  it('aiSmartViewOff 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures,含它挂的侧栏共 2 次 action 调用)', async () => {
    const settings = usePhotosSettingsStore()
    const spy = vi.spyOn(settings, 'fetchAiFeatures')
    await mountView()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // review fix(Important 1):上一条 spy 的是 store 的 action,不是网络层——这里不 spy
  // fetchAiFeatures,让真实实现跑起来,直接在 HTTP 层(`svc.photos.getConfig`)数调用次数,
  // 证明"页面自身 + 它挂的侧栏同帧各调一次 action"最终只落地一次真实请求(§7e-15 需要的
  // 那条不变量,settings.ts 的 aiFeaturesInFlight 去重)。
  it('§7e-15 网络级去重证明:PhotosSmartViews 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
    await mountView()
    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
  })
})

// ── 样式块结构断言(?raw,照 color-guard / PersonAssetGrid.test.ts 的既有先例)──
describe('PhotosSmartViews.vue — 样式块结构核对', () => {
  // Plan C Task 2:换壳后侧栏宽度由 `.app` CSS Grid 列接管,≤768px 收窄改成折叠整条侧栏列
  // (Photos.vue 同款 `.app { grid-template-columns: 1fr; }`),不再是 `.photos-layout` 的
  // `gap: 0`。
  it('.app 在 ≤768px 媒体查询里把侧栏列折叠成单列(照 Photos.vue 既定形态)', () => {
    const m = /@media \(max-width: 768px\)\s*\{([^}]*\{[^}]*\})*[^}]*\}/.exec(photosSmartViewsRaw)
    expect(m).not.toBeNull()
    expect(photosSmartViewsRaw).toContain('.app { grid-template-columns: 1fr; }')
  })
})

// Fix-1 item 1 (owner acceptance, 2026-08-13): Vue2 mounts the same <PhotosTopbar> for
// activeNav === 'smart' (PhotosTimeline.vue:957-971) with title = topbarTitle's 'smart' branch
// ('For You', PhotosTimeline.vue:190) and sub = topbarSubContext's DEFAULT branch (navMap has
// no 'smart' entry, PhotosTimeline.vue:229-234) -- the same full-library count line the topbar
// already computes on its own by default, so no `sub` override is needed from this page.
describe('Fix-1 item 1: PhotosTopbar restored (title=For You, default full-library sub)', () => {
  it('renders the topbar with title=For You, no search box', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PhotosTopbar).exists()).toBe(true)
    expect(w.get('.topbar-title').text()).toBe(zh.photosMoForYou)
    expect(w.find('.topbar .search').exists()).toBe(false)
  })

  it('passes hide-drawer-trigger to PhotosSidebar', async () => {
    const { w } = await mountView()
    expect(w.findComponent(PhotosSidebar).props('hideDrawerTrigger')).toBe(true)
  })
})

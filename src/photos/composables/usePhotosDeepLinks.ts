// SP7-P8a-T7/T8: 深链 ?asset / ?photoset / ?q / ?album / ?person ——
// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377(mounted 里的分发)、
// :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)、:491-494(?q,
// _applyUrlDeepLinks 内)、:509-523(?person,_applyPersonFromQuery)。
// ?album 的 Vue2 出处不在这个文件——它是 PhotosAlbumsView.vue:264 自己 mounted() 里读的
// (同页面切面板架构下,只有相册列表视图关心这个键)。New-UI 统一收进本组合式:三个键
// 都是"/photos?xxx= 兼容入口 → 归一到真实路由"的入口归一,而不是"同页面内切换本地状态"。
//
// 范围清单(终审 Important 2,回源核实 Vue2 :364-374 的 mounted 分发 + :475-507 的
// _applyUrlDeepLinks 完整键集 + 两个子视图各自的 mounted()):
//   Vue2 `/photos` 全部支持的 query 键 = photoset, asset, active(:368-374,mounted 里
//   分发)+ view, tab, settings, q, place, spot, person, photo(:475-507,
//   _applyUrlDeepLinks 内)+ album(PhotosAlbumsView.vue:264,相册列表页自己 mounted() 读)
//   + smartview(PhotosSmartViewsView.vue:340,智能视图页自己 mounted() 读)。
//   P8a 实现:asset / photoset / active / q / album / person —— 6 个。
//   **P8b 追加(cutover 后 Vue2 `/photos` 整页被重定向,老书签只能在这里落地)**:
//     - view —— 六个 Vue2 NAV_KEYS 值逐个归一到 New-UI 的六条真实路由(VIEW_ROUTES)。
//     - tab —— 唯一需要宿主页面配合的键,走 PhotosDeepLinkHooks.setTab。
//     - settings —— 归一到独立设置路由 `/photos/settings?section=`('1' = 不指定分区)。
//     - photo —— 灯箱链最低优先级的一档(photoset > asset > photo);语义是**状态回显**,
//       找不到静默清键、不弹 toast(与 ?asset 的分享语义刻意不同)。
//     - smartview —— 等 fetchSmartViews 就绪后校验存在,跳 /photos/smart-views/:id。
//     - place、spot —— getPlace 验城市名后跳 /photos/places/:key(?spot 附在 query);
//       spot 找不到降级整城,city 取不到则清两键。
//   **刻意不实现:无。Vue2 `/photos` 的 13 个 query 键在本文件已全部有落地点。**
//   (清点闸:__tests__/deepLinkCoverage.test.ts —— 键集清单 + watch 数组双向核对。
//   将来 Vue2 侧若再加键,那道闸会红;New-UI 侧漏 watch 也会红。)
//
// 挂载约定(真机验收反馈修正,2026-08-04——原裁决"不装 watcher"已撤回,理由见下):
// usePhotosDeepLinks() 在 /photos 的 setup 里调一次,同时支持**两条到达路径**:
//   ① 全新挂载(书签/新开标签页打开 `/photos?xxx=`)—— onMounted 触发一次。
//   ② 已经停留在 /photos、之后才手改地址栏 query(或未来某处内链只换深链参数)——
//      vue-router 4 对同一路由组件只 query 变化**不重新 mount**,onMounted 那一次
//      够不到这种情形,必须补一条不带 immediate 的 watch。
// 真机验收实测:在时间线上直接编辑地址栏改 `#/photos?q=...`/`?asset=...`/`?person=...`,
// 五式全部没反应——根因正是①只有 onMounted、没有②。
//
// 两条路径共用同一个 applyDeepLinkChanges(query, previous)/dispatchQueryChange(query)
// 判据(Task 5 `scrollToSection`/`isSectionId` 的先例:同一个函数,不允许两份逻辑各自
// 维护再慢慢漂开)。previous 为 null 表示"以前什么都没处理过"(mount 时),把五个键当
// 全部"从无到有";previous 有值时逐键比较字符串值,只处理**值真的变了**的那个键。
//
// 🔴 这条"逐键比较,不整体重跑"是解禁 watcher 的关键,也是最初裁决"禁止 watcher"的
// 理由本身:`?photoset` 是一次性交接,consume 一次后 localStorage 里的 key 就没了。
// 如果 watcher 不分青红皂白地对"query 有任何变化"都重新执行完整的五键分发,那么用户
// 哪怕只是编辑了毫不相关的 `?q`,也会让已经消费过的 photoset 分支重新跑一遍、发现
// handoff "缺失"、误判成降级路径,把灯箱重新弹开在 `active` 上——明明用户只是想改
// 搜索词。同理:`?asset` 值没变时,任何其它 query 键的变化都不该重新触发一次
// `openAssetFromQuery`(灯箱不需要也不应该因为无关变化被重新打开一次)。用"这个键自己
// 的值有没有变"做门槛,天然规避了这两种误触发——不是靠额外的"只处理一次"标志位。
//
// 删除某个键(值变成 undefined)在这套判据下是 no-op:firstQueryValue(undefined) 归一
// 成 '',各分支的 `if (id) ...` 天然短路,既不弹 toast 也不关灯箱、不做任何路由改写。
//
// 执行顺序(偏离登记,按铁律修正,不照抄——回源核实见 :364-377):Vue2 mounted() 里
// _openPhotoSetFromQuery(...)/_openAssetFromQuery(...) 是**不 await 的**调用(fire-and-
// forget 的异步函数),紧接着同步调用 _applyUrlDeepLinks()。也就是说 Vue2 的真实时序是
// "调用顺序"先灯箱后路由,但"完成顺序"其实不受控——q/place/person(路由改写那一路)
// 先跑完,灯箱那段的 fetchAssetDetail 仍在飞行中、稍后才落定,这是 Vue2 从未刻意保证过
// 顺序的竞态,不是"先灯箱后路由"的设计承诺。
// New-UI 这里改成显式 await 灯箱那段、再跑 q/album/person,两条到达路径都一样,是刻意
// 串行化,不是"照抄 Vue2 时序"——两条腿都会改路由/开灯箱这类可观察副作用,串行让结果
// 可预测(谁先完成不取决于网络时序,也不取决于用户改地址栏的手速),优于复刻一个从未被
// 保证过、纯属实现细节的竞态。
//
// 范围声明:混合"灯箱开图 + 导航型 query"的组合输入不是本文件的支持形状——`?q` +
// `?album` + `?person` 若同时到达,会在同一次 dispatchQueryChange 里连续触发三次
// router.replace(q 的结果先被 album 的 replace 覆盖导航,person 那条异步落地后又覆盖
// 一次),没有互斥或排队。这是已知限制,不在本期修复范围(deep-link 组合从来不是产品
// 设计要处理的入口形状,Vue2 也没有为这种组合定义过明确行为)。
// P8b 追加的 `?view` / `?settings` 属同一类:它们也是"改路由"腿,与 q/album/person 同时
// 到达时同样是后者覆盖前者,不新增互斥。唯一例外是 `?tab` —— 它只改本页本地状态、不导航,
// 与任何键都不冲突。
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryValue } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../lightbox/useLightbox'
import { usePhotosPeople } from '../stores/people'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'

const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'

// ── P8b cutover ────────────────────────────────────────────────────────────
// 翻牌之后 Vue2 `/photos` 被 strangler.js 整页重定向到 `/app/#/photos`,它支持的 query 键
// 再也不会被 Vue2 自己的组件接住 —— 每个键要么在本文件落地,要么在 cutover 当天变成哑链。
// 所以 P8a 那批"刻意搁置"的键在这里全部补齐(键集清点闸见 __tests__/deepLinkCoverage.test.ts)。

// 回源 NimoOS-UI src/views/Photos/PhotosTimeline.vue:477 的 NAV_KEYS,逐值对到 New-UI 的
// 真实路由。Vue2 是"同页面内切 activeNav 面板",New-UI 是六条独立路由 —— 所以这里做的是
// 入口归一(改路由),不是"在同一页里切本地状态"。
// 注:Vue2 的 NAV_KEYS 里没有 'upload' —— 上传视图在 Vue2 侧本就是不可达死代码(spec D21),
// 故这里也不需要为它留位置;值不在表里一律 no-op(照 Vue2 的 includes 守卫)。
const VIEW_ROUTES: Record<string, string> = {
  albums: '/photos/albums',
  people: '/photos/people',
  places: '/photos/places',
  smart: '/photos/smart-views',
  favs: '/photos/favorites',
  trash: '/photos/trash',
}

// 回源 :478 的 TAB_KEYS。刻意不含 'photo' —— 那是 Vue2 `data() { tab: 'photo' }` 的默认值,
// 从来不出现在 URL 里(Vue2 的 includes 判定同样不认它)。
const TAB_KEYS: readonly string[] = ['all', 'video', 'ocr']

/**
 * 宿主页面把自己的本地状态交给分发器的缝。
 * 只有 `?tab` 需要它:tab 是时间线页内的展示过滤,不是导航目的地,没有对应路由可跳。
 * 其余键全靠 router 落地,不需要回调 —— 所以这个接口刻意只有一个成员,不做成"什么都能塞"
 * 的通用回调袋(避免把页面内部状态一件件漏给组合式)。
 */
export interface PhotosDeepLinkHooks {
  setTab?: (tab: string) => void
}

// 取不到明细时的 toast 停留时长,照 Vue2 :438 / :463 的 duration: 3000。
const NOT_FOUND_TOAST_MS = 3000

function firstQueryValue(v: LocationQueryValue | LocationQueryValue[]): string {
  return (Array.isArray(v) ? v[0] : v) || ''
}

export function usePhotosDeepLinks(hooks: PhotosDeepLinkHooks = {}): void {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const lb = useLightbox()
  const toast = useToast()

  // 按 id 取明细。失败(网络错误 / 404 / 响应假值)统一归为"取不到",不区分原因——
  // 照 Vue2 fetchAssetDetail(NimoOS-UI src/store/modules/photos.js:611-619)的口径:
  // 它自己 catch 后 console.error + 返回 null,调用方按 falsy 处理。
  async function fetchPhoto(id: string): Promise<Photo | null> {
    try {
      const asset = await service.photos.getAsset(id)
      return asset ? assetToPhoto(asset as unknown as Record<string, unknown>) : null
    } catch (e) {
      console.error('[photos-deeplinks] fetchPhoto', e)
      return null
    }
  }

  function notFoundToast(): void {
    toast.show(t('photosDeepLinkPhotoNotFound'), NOT_FOUND_TOAST_MS)
  }

  // Vue2 :431-440 _openAssetFromQuery——单张成集,prev/next 成 no-op(与时间线是否
  // 包含该图无关)。
  async function openAssetFromQuery(id: string): Promise<void> {
    const photo = await fetchPhoto(id)
    if (photo) lb.openAt(photo, [photo])
    else notFoundToast()
  }

  // 读一次性交接载荷:{ ids: string[] },key = 'nimo:photoset:' + token。
  // 过期清理不在这里——2 分钟 TTL 归生产者侧(src/views/AI/Agent/services/openInApp.js:
  // 76-85,从 key 名里解析时间戳写入),消费侧只做"读到就 removeItem",不做过期判断;
  // 读不到(键不存在,包括已经被消费过、或已被生产者侧清理过)一律当作"没有交接"处理。
  function consumePhotosetHandoff(token: string): string[] {
    const key = PHOTOSET_KEY_PREFIX + token
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw) as { ids?: unknown[] }
      // 照 Vue2 :447 的位置——parse 成功即 removeItem,即使后面取明细失败也已经消费掉
      // (一次性交接语义,不因下游失败而"补发")。
      localStorage.removeItem(key)
      return (parsed.ids || []).filter(Boolean) as string[]
    } catch {
      // localStorage 读 / JSON.parse 异常必须吞掉——隐私模式 / 配额异常不能带崩整页
      // (Vue2 :449 的 catch {}）。
      return []
    }
  }

  // Vue2 :441-465 _openPhotoSetFromQuery。
  async function openPhotoSetFromQuery(token: string, activeId: string): Promise<void> {
    const ids = consumePhotosetHandoff(token)
    if (!ids.length) {
      // handoff 缺失(键不存在 / 已被消费)→ 降级成 ?asset 行为;
      // 连 activeId 也没有则什么都不做,静默(不弹 toast)。
      if (activeId) await openAssetFromQuery(activeId)
      return
    }
    const active = activeId && ids.includes(activeId) ? activeId : ids[0]
    const photo = await fetchPhoto(active)
    if (photo) {
      // 翻页集只带 id 的轻量对象——Photo 是 25+ 必填字段的宽接口,用 assetToPhoto({id})
      // 补齐默认值而非 `as unknown as Photo` 强转;灯箱自己会在导航时按需取每张的明细
      // (useLightbox.ts:100-124 的 hydrateDetail)。
      lb.openAt(photo, ids.map((id) => assetToPhoto({ id })))
    } else {
      notFoundToast()
    }
  }

  // Vue2 :491-494(_applyUrlDeepLinks 内):`?q=<词>` 在 Vue2 里是"开搜索面板 + 就地
  // 检索",New-UI 有独立的搜索路由(P7a 已建),所以归一成整页重定向:替换掉 `/photos`
  // 这条兼容 URL,不留在浏览器历史里(用户按后退键该跳出 /photos,不是回到归一前的同页)。
  // 搜索词原样传递——不 trim、不做任何转码(query 对象层面就是原始字符串,序列化成 URL
  // 是 vue-router 自己的事,不需要也不应该在这里手工编码)。
  function redirectSearchFromQuery(term: string): void {
    router.replace({ path: '/photos/search', query: { q: term } })
  }

  // ?view=<NAV_KEYS 之一>:归一成整页重定向。用 replace 不用 push —— 同
  // redirectSearchFromQuery 的理由:`/photos?view=albums` 是兼容 URL,不该留在浏览器历史
  // 里让后退键把用户送回一个"已经不存在的中间态"。
  // 值不在表里一律 no-op,与 Vue2 `if (q.view && NAV_KEYS.includes(q.view))` 逐字一致 ——
  // 不是"未知值就报错",也不是"未知值就落默认页"。
  function redirectViewFromQuery(view: string): void {
    const path = VIEW_ROUTES[view]
    if (path) router.replace(path)
  }

  // ?settings=1|<section>:Vue2 :485-488 —— '1' 表示"开设置面板但不指定分区",其余值原样
  // 当分区名(`settingsInitialSection = q.settings === '1' ? '' : String(q.settings)`)。
  // New-UI 的对应物是独立路由 /photos/settings?section=storage|ai。
  // 分区名刻意不做白名单校验(与 Vue2 一致地原样传):PhotosSettings 内部的 isSectionId 会
  // 把不认识的值当"不滚动"处理,校验责任在目的地,不在入口归一这一层。
  function redirectSettingsFromQuery(value: string): void {
    const section = value === '1' ? '' : value
    router.replace(section
      ? { path: '/photos/settings', query: { section } }
      : { path: '/photos/settings' })
  }

  // ?photo=<id>:Vue2 :556-571 _applyPhotoFromQuery —— 与 ?asset 都是"单张开灯箱",但
  // 语义刻意不同,不合并成一条:?asset 是**分享链接**(找不到要弹 toast 告诉用户"这个
  // 链接失效了"),?photo 是**状态回显**(找不到静默清键、不打扰用户,因为它本来就只是
  // 把当前打开的图写进 URL 供刷新恢复)。Vue2 自己的注释 :556-557 就点明了这个区别。
  async function applyPhotoFromQuery(id: string): Promise<void> {
    const photo = await fetchPhoto(id)
    if (photo) lb.openAt(photo, [photo])
    else stripQueryKey('photo')
  }

  // ?smartview=<id>:Vue2 PhotosSmartViewsView.vue:337-348 _applyRouteSmartView ——
  // 等列表就绪、校验存在才开,不存在静默清键。id 比较走 String() 归一(同 ?person 的
  // 全区铁律:后端 id 可能是数字,query 值恒为字符串,`===` 直接比会把存在的项误判成
  // 不存在)。Vue2 那边是打开同页面内的详情浮层,New-UI 有真实详情路由,故归一成跳转。
  async function applySmartViewFromQuery(id: string): Promise<void> {
    const store = usePhotosSmartViews()
    try {
      await store.fetchSmartViews()
      const exists = store.smartViews.some((s) => String(s.id) === String(id))
      if (exists) router.replace({ name: 'photos-smart-view-detail', params: { id } })
      else stripQueryKey('smartview')
    } catch (e) {
      // 防御性兜底 —— fetchSmartViews 自身已把网络失败吞掉(内部 console.error,不 reject),
      // 这条 catch 目前不会被触发,留着是防 store 实现变化时仍安全(同 ?person 的写法)。
      console.error('[photos-deeplinks] fetchSmartViews', e)
      stripQueryKey('smartview')
    }
  }

  // ?place=<key>(+?spot=<spotKey>):Vue2 :527-554 _applyPlaceFromQuery —— 先取详情验
  // 城市名,拿不到就清 place+spot 两键;spot 在 spots[] 里找不到则降级整城过滤、只丢 spot。
  //
  // 偏离登记(不照抄):Vue2 拿到详情后把 spotName/spotLat/spotLon 一起塞进 onPlacesOpenSpot,
  // 那是它"同页面切面板"架构下的传参方式。New-UI 的目的地是真实路由 /photos/places/:key,
  // 只带 ?spot;lat/lon 两个可选 query 刻意不带 —— PhotosPlaceAssets 自己会 loadDetail(key)
  // 把 spot 坐标取回来,那两个 query 是从地图页跳转时的"免二次请求"优化,不是必需入参。
  // 从一个只有 key 的老书签里硬造 lat/lon 反而要多信一层缓存,没必要。
  async function applyPlaceFromQuery(placeKey: string, spotKey: string): Promise<void> {
    try {
      const detail = (await service.photos.getPlace(placeKey)) as
        { city?: string; spots?: Array<{ key?: unknown }> } | null
      const city = detail?.city || ''
      // Vue2 :531-534:city 为空即视为"这个 place 不存在",清两键、留在原地。
      if (!city) { stripQueryKey('place', 'spot'); return }
      // spot key 比较同样走 String() 归一 —— Place.Key 后端是 int32(P0 已实证)。
      const hit = spotKey
        ? (detail?.spots || []).some((s) => String(s?.key) === String(spotKey))
        : false
      router.replace(hit
        ? { name: 'photos-place-assets', params: { key: placeKey }, query: { spot: spotKey } }
        : { name: 'photos-place-assets', params: { key: placeKey } })
    } catch (e) {
      console.error('[photos-deeplinks] getPlace', e)
      stripQueryKey('place', 'spot')
    }
  }

  // ?album=<id>:Vue2 是 PhotosAlbumsView.vue:264 让相册**列表**页自己校验 + 打开,不做
  // 存在性检查(找不到才会静默清键,但这里 Vue2 从不校验存在——它就是直接赋值)。New-UI
  // 有真实的相册详情路由,直接跳转,同样不加 Vue2 没有的校验(移植纪律:不做无关"改进"、
  // 不擅自加校验)。
  //
  // 偏离登记(按铁律修正,不照抄):Vue2 那边是"同页面内切换本地状态",从没走过"把 id
  // 拼进 URL 路径"这一步,所以从没编码过。New-UI 把它变成真实路径跳转后,不编码会让
  // 含 `/`(或其他路径保留字符)的 id 把路径从中截断,匹配到别的路由甚至匹配失败——
  // 这是要修的缺陷,不是要保真移植的行为。用具名路由 + params 让 vue-router 自己编码
  // (encodeParam 对 `/` 也编,效果等价于 encodeURIComponent),优于手拼字符串再调
  // encodeURIComponent——手拼还要操心两边的百分号编码规则是否完全一致,params 机制
  // 从"构造/解析"两端都用同一套内部函数,不会出现编码和解码不对称的问题。
  function redirectAlbumFromQuery(id: string): void {
    router.replace({ name: 'photos-album-detail', params: { id } })
  }

  // ?person=<id>:Vue2 :509-523 _applyPersonFromQuery——先等 people 列表就绪,校验 id
  // 存在才切页,不存在(或拉取失败)都静默清掉 query 里的 person 键、留在原地,不报错
  // 不提示。
  async function applyPersonFromQuery(id: string): Promise<void> {
    const peopleStore = usePhotosPeople()
    try {
      await peopleStore.fetchPeople()
      // id 比较走 String() 归一——全区铁律:后端 id 有时是数字(同类先例 Place.Key 是
      // int32),query 里的 person 值恒为字符串(URL 本身是文本),`===` 直接比较字符串
      // 和数字永远不相等,会让存在的人物被误判成"不存在"而被静默摘键。
      const exists = peopleStore.people.some((p) => String(p.id) === String(id))
      if (exists) {
        redirectPersonFromQuery(id)
      } else {
        stripQueryKey('person')
      }
    } catch (e) {
      // Vue2 :521-523 的 catch。防御性兜底——usePhotosPeople().fetchPeople() 自身已经
      // 把网络失败吞掉(内部 console.error,不 reject),这条 catch 目前不会被触发,留着
      // 是防 store 实现变化时仍安全(不会让未捕获异常冒出去炸整个 onMounted 链)。
      console.error('[photos-deeplinks] fetchPeople', e)
      stripQueryKey('person')
    }
  }

  function redirectPersonFromQuery(id: string): void {
    router.replace({ name: 'photos-person-detail', params: { id } })
  }

  // 静默摘掉指定 query 键、留在原地——不动其余键,也不清 path(照 Vue2 mergeQuery 的
  // 语义:只动被摘的那几个键)。P8b 起被 person / photo / smartview / place+spot 共用;
  // 收变参是因为 ?place 失败时 Vue2 一次摘 place + spot 两个键(:531 / :552)。
  function stripQueryKey(...keys: string[]): void {
    const rest = { ...route.query }
    for (const k of keys) delete rest[k]
    router.replace({ path: route.path, query: rest })
  }

  // 五键共用的分发判据——mount 路径与 query-only 路径都走这一个函数,不允许两份逻辑
  // 各自维护再慢慢漂开(Task 5 scrollToSection/isSectionId 的先例)。
  //
  // `previous` 为 null:mount 时"以前什么都没处理过",五个键当全部"从无到有",该处理
  // 的都处理(等价于原来 onMounted 的行为)。
  // `previous` 有值:query-only 路径,逐键比较归一化后的字符串值,只处理**值真的变了**
  // 的那个键——这是安全解禁 watcher 的关键(见文件头 🔴 段落),不是"query 有任何变化
  // 就整体重跑五式"。
  async function applyDeepLinkChanges(query: LocationQuery, previous: LocationQuery | null): Promise<void> {
    const photosetToken = firstQueryValue(query.photoset)
    const assetId = firstQueryValue(query.asset)
    const photoId = firstQueryValue(query.photo)
    const photosetChanged = !previous || photosetToken !== firstQueryValue(previous.photoset)
    const assetChanged = !previous || assetId !== firstQueryValue(previous.asset)
    const photoChanged = !previous || photoId !== firstQueryValue(previous.photo)

    // 灯箱先开、路由后跳:这段必须先 await 完,q/album/person 才能跑(见文件头执行
    // 顺序说明)。优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个
    // 都在时只走 photoset,不是两个都触发);这里的"两个都在"特指"两个都是本轮真正
    // 变化的键",不是"两个键当前都有值"——若只是 asset 变了、photoset 值没变(仍是
    // 之前已经处理过的旧值),不应该因为 photoset 仍然"有值"就把这次 asset 变化吞掉。
    if (photosetChanged && photosetToken) {
      await openPhotoSetFromQuery(photosetToken, firstQueryValue(query.active))
    } else if (assetChanged && assetId) {
      await openAssetFromQuery(assetId)
    } else if (photoChanged && photoId && !photosetToken && !assetId) {
      // ?photo 是灯箱链里优先级最低的一档(Vue2 :504 `if (q.photo && !q.photoset && !q.asset)`)。
      // 注意它的让位门槛与上面两档的"变了没"判据不同:这里问的是"那两个键**当前有没有值**",
      // 不是"它们这轮变没变" —— 照 Vue2 逐字。含义是:只要 URL 上还挂着 photoset/asset,
      // photo 就永远不出手,免得同一次分发里开两次灯箱。
      await applyPhotoFromQuery(photoId)
    }

    // q/album/person:三个键各自独立、互不干扰,都是"改路由"而不是"开灯箱"。
    const q = firstQueryValue(query.q)
    const albumId = firstQueryValue(query.album)
    const personId = firstQueryValue(query.person)
    const qChanged = !previous || q !== firstQueryValue(previous.q)
    const albumChanged = !previous || albumId !== firstQueryValue(previous.album)
    const personChanged = !previous || personId !== firstQueryValue(previous.person)

    if (qChanged && q) redirectSearchFromQuery(q)
    if (albumChanged && albumId) redirectAlbumFromQuery(albumId)
    if (personChanged && personId) await applyPersonFromQuery(personId)

    // ── P8b:?tab / ?view / ?settings ────────────────────────────────────────
    // ?tab 先落(纯本地状态、不改路由),再处理会导航走的 ?view/?settings。
    // 偏离登记:Vue2 :479-489 的行文顺序是 view → tab → settings,三者都作用在同一个页面
    // 实例上、顺序无可观察差异;New-UI 里 view/settings 会导航离开本页,若先跳走再 setTab,
    // 改的就是一个正在被卸载的页面的状态了。故按"先本地、后导航"重排,不照抄行文顺序。
    const tab = firstQueryValue(query.tab)
    const view = firstQueryValue(query.view)
    const settings = firstQueryValue(query.settings)
    const tabChanged = !previous || tab !== firstQueryValue(previous.tab)
    const viewChanged = !previous || view !== firstQueryValue(previous.view)
    const settingsChanged = !previous || settings !== firstQueryValue(previous.settings)

    if (tabChanged && TAB_KEYS.includes(tab)) hooks.setTab?.(tab)
    if (viewChanged && view) redirectViewFromQuery(view)
    if (settingsChanged && settings) redirectSettingsFromQuery(settings)

    // ── P8b:?smartview / ?place(+?spot)—— 两条要先问后端/store 才知道去哪的腿 ──────
    // place 的变化判据把 spot 也算进来:spot 是 place 的附属键,只改 spot(place 值不变)
    // 也必须重新落地一次(整城 ↔ 某个 spot 的切换),否则 query-only 路径下改 spot 没反应。
    const smartViewId = firstQueryValue(query.smartview)
    const placeKey = firstQueryValue(query.place)
    const spotKey = firstQueryValue(query.spot)
    const smartViewChanged = !previous || smartViewId !== firstQueryValue(previous.smartview)
    const placeChanged = !previous
      || placeKey !== firstQueryValue(previous.place)
      || spotKey !== firstQueryValue(previous.spot)

    if (smartViewChanged && smartViewId) await applySmartViewFromQuery(smartViewId)
    if (placeChanged && placeKey) await applyPlaceFromQuery(placeKey, spotKey)
  }

  // previousQuery 记录"上一次已经分发处理过"的 query 快照——mount 前是 null(逼五键
  // 全部当"从无到有"),之后每次分发(不论来自 onMounted 还是 watch)都同步更新它,
  // 保证下一次 watch 触发时比较的是"真正上一次处理完的状态",不是过期快照。
  let previousQuery: LocationQuery | null = null

  function dispatchQueryChange(query: LocationQuery): void {
    const previous = previousQuery
    previousQuery = query
    void applyDeepLinkChanges(query, previous)
  }

  onMounted(() => {
    dispatchQueryChange(route.query)
  })

  // query-only 路径:页面已经停留在 /photos,只是某个 query 键变了(手改地址栏、或
  // 未来某处内链只换深链参数)。vue-router 4 对同一路由只 query 变化不重新 mount,
  // onMounted 那次够不到这种情形,补一个不带 immediate 的 watch(watch 默认不在装配
  // 时跑一次,不与 mounted 那次重复)。
  //
  // 只 watch 这五个键各自的值(不是整个 route.query 对象)——这样只有它们其中之一的
  // 值真的变了才会触发回调(Vue 的 watch 对多数据源用 Object.is 逐位比较,即使
  // route.query 因为其它无关键变化而整体换了新对象引用,只要这五个位置的字符串值都
  // 没变,回调根本不会被调用)。回调内部再交给 applyDeepLinkChanges 逐键比对——两层
  // 门槛叠加,不会因为无关 query 变化而误触发任何一个键。
  watch(
    [
      () => route.query.photoset,
      () => route.query.asset,
      () => route.query.q,
      () => route.query.album,
      () => route.query.person,
      // P8b 追加的键 —— 漏进这个数组就等于"只有整页挂载时才认",手改地址栏会毫无反应
      // (P8a 真机验收就是这么被抓到的)。
      () => route.query.tab,
      () => route.query.view,
      () => route.query.settings,
      () => route.query.photo,
      () => route.query.smartview,
      () => route.query.place,
      // spot 是 place 的附属键,但仍要单独 watch —— 只改 spot(place 不变)是真实的用户
      // 操作(整城 ↔ 某个 spot),漏了它这种改动在 query-only 路径下毫无反应。
      () => route.query.spot,
    ],
    () => {
      dispatchQueryChange(route.query)
    },
  )
}

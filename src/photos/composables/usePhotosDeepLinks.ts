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
//   本文件实现:asset / photoset / active / q / album / person —— 6 个。
//   刻意不实现(留给下一期,由控制器决策,不是遗漏):
//     - view、tab —— New-UI 用真实路由 path 区分导航目的地/子标签,不需要一个
//       query 键来在同一页面内切面板;`/photos?view=albums` 这类旧书签本期静默无效。
//     - settings —— New-UI 已有独立设置路由(`/photos/settings?section=ai`),是
//       `?settings=1|ai` 的直接对应物,但接线是下一期的入口归一工作,本期未做——
//       旧书签 `/photos?settings=ai` 本期静默无效,与 view 同一类。
//     - place、spot —— 依赖后端 place 详情(城市名/spot 坐标)才能落地,New-UI 侧
//       对应的地点详情路由本期未建。
//     - photo —— Vue2 的灯箱回填键之一(与 photoset/asset 同类但走 _applyUrlDeepLinks
//       而非 mounted 里的分发),本期没有实现对应入口。
//     - smartview —— 智能视图页的深链键,本文件只统一了相册(album)那一个子视图键,
//       智能视图这一个未纳入。
//
// 挂载约定:usePhotosDeepLinks() 在 /photos 的 setup 里调一次,内部自行 onMounted——
// 不装路由 watcher。这是一次性交接(?photoset 的 handoff 读完即 removeItem),不是
// "同路由改查询参数"的场景;装 watcher 会让已被消费掉的 handoff 在后续 query 变化时
// 被误判成"缺失"而重复触发降级路径。保持"一个键一个小函数"的结构。
//
// 执行顺序(偏离登记,按铁律修正,不照抄——回源核实见 :364-377):Vue2 mounted() 里
// _openPhotoSetFromQuery(...)/_openAssetFromQuery(...) 是**不 await 的**调用(fire-and-
// forget 的异步函数),紧接着同步调用 _applyUrlDeepLinks()。也就是说 Vue2 的真实时序是
// q/place/person(路由改写那一路)先跑完,灯箱那段的 fetchAssetDetail 仍在飞行中、稍后
// 才落定——这是 Vue2 从未刻意保证过顺序的竞态,不是"先灯箱后路由"的设计。
// New-UI 这里改成显式 await 灯箱那段、再跑 q/album/person,是刻意串行化,不是"照抄
// Vue2 时序"——两条腿都会改路由/开灯箱这类可观察副作用,串行让结果可预测(谁先完成
// 不取决于网络时序),优于复刻一个从未被保证过、纯属实现细节的竞态。
//
// 范围声明:混合"灯箱开图 + 导航型 query"的组合输入不是本文件的支持形状——`?q` +
// `?album` + `?person` 若同时到达,会在同一个 IIFE 里连续触发三次 router.replace(q 的
// 结果先被 album 的 replace 覆盖导航,person 那条异步落地后又覆盖一次),没有互斥或
// 排队。这是已知限制,不在本期修复范围(deep-link 组合从来不是产品设计要处理的入口
// 形状,Vue2 也没有为这种组合定义过明确行为)。
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryValue } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../lightbox/useLightbox'
import { usePhotosPeople } from '../stores/people'
import { useToast } from '../../stores/toast'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'

const PHOTOSET_KEY_PREFIX = 'nimo:photoset:'
// 取不到明细时的 toast 停留时长,照 Vue2 :438 / :463 的 duration: 3000。
const NOT_FOUND_TOAST_MS = 3000

function firstQueryValue(v: LocationQueryValue | LocationQueryValue[]): string {
  return (Array.isArray(v) ? v[0] : v) || ''
}

export function usePhotosDeepLinks(): void {
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
        stripPersonFromQuery()
      }
    } catch (e) {
      // Vue2 :521-523 的 catch。防御性兜底——usePhotosPeople().fetchPeople() 自身已经
      // 把网络失败吞掉(内部 console.error,不 reject),这条 catch 目前不会被触发,留着
      // 是防 store 实现变化时仍安全(不会让未捕获异常冒出去炸整个 onMounted 链)。
      console.error('[photos-deeplinks] fetchPeople', e)
      stripPersonFromQuery()
    }
  }

  function redirectPersonFromQuery(id: string): void {
    router.replace({ name: 'photos-person-detail', params: { id } })
  }

  // 静默摘掉 person 键、留在原地——不动其余 query 键,也不清 path(照 Vue2 mergeQuery
  // 的语义:只动被摘的那一个键)。
  function stripPersonFromQuery(): void {
    const { person, ...rest } = route.query
    void person
    router.replace({ path: route.path, query: rest })
  }

  onMounted(() => {
    void (async () => {
      const photosetToken = firstQueryValue(route.query.photoset)
      const assetId = firstQueryValue(route.query.asset)
      // 优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个都在时只走
      // photoset,不是两个都触发)。这段必须先 await 完,q/album/person 的路由改写才能
      // 跑(见文件头执行顺序说明)。
      if (photosetToken) {
        await openPhotoSetFromQuery(photosetToken, firstQueryValue(route.query.active))
      } else if (assetId) {
        await openAssetFromQuery(assetId)
      }

      // q/album/person:三个键各自独立、互不干扰(某个键缺失就跳过对应处理),都是
      // "改路由"而不是"开灯箱"。
      const q = firstQueryValue(route.query.q)
      const albumId = firstQueryValue(route.query.album)
      const personId = firstQueryValue(route.query.person)
      if (q) redirectSearchFromQuery(q)
      if (albumId) redirectAlbumFromQuery(albumId)
      if (personId) await applyPersonFromQuery(personId)
    })()
  })
}

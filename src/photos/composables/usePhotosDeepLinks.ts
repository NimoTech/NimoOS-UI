// SP7-P8a-T7: 深链 ?asset / ?photoset ——
// 回源:Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:364-377(mounted 里的分发)、
// :431-440(_openAssetFromQuery)、:441-465(_openPhotoSetFromQuery)。
//
// 挂载约定:usePhotosDeepLinks() 在 /photos 的 setup 里调一次,内部自行 onMounted——
// 不装路由 watcher。这是一次性交接(?photoset 的 handoff 读完即 removeItem),不是
// "同路由改查询参数"的场景;装 watcher 会让已被消费掉的 handoff 在后续 query 变化时
// 被误判成"缺失"而重复触发降级路径。Task 8 会往本文件追加 ?q/?album/?person 三个键,
// 保持"一个键一个小函数"的结构以便接续。
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { LocationQueryValue } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from '../lightbox/useLightbox'
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

  onMounted(() => {
    const photosetToken = firstQueryValue(route.query.photoset)
    const assetId = firstQueryValue(route.query.asset)
    // 优先级:photoset 优先于 asset(Vue2 :370-374 的 if / else if——两个都在时只走
    // photoset,不是两个都触发)。
    if (photosetToken) {
      void openPhotoSetFromQuery(photosetToken, firstQueryValue(route.query.active))
    } else if (assetId) {
      void openAssetFromQuery(assetId)
    }
  })
}

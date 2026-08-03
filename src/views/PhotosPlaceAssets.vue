<script setup lang="ts">
// P6b-T9(SP7 相册「地点」详情,本期最后一任务):`/photos/places/:key` 地点照片页(D6)——
// 从地图详情面板「查看全部 N 张」/「在图库中打开」/某个 spot 卡片的「在 Library 中查看这个
// spot 的全部照片」(T8 goLibrary/onOpenSpotLibrary)跳库落点。按月分组网格 + 灯箱 + 面包屑
// 「城市 › spot」+ 三态门控。D10:跳库页最小面,只浏览不接多选/批操作(归 P7/P8)。
//
// 参考:
//  - 壳/route 参数归一/灯箱挂载位置:PhotosAlbumDetail.vue:1-80(AreaShell + .photos-layout +
//    PhotosSidebar + .photos-main,P3/P4/P5 既定不抽公共)。
//  - 三态门控体例:PhotosPersonDetail.vue:583-611(loading&&!loaded / failed / 空 / 正常)。
//  - 面包屑信息层级:Vue2 NimoOS-UI PhotosTimeline.vue:1073-1090(地图图标 + 城市段(有 spot
//    时是按钮,点击回整城)+ 右尖角 + spot 段 + 右侧计数)。
//  - spot 深链找不到时的静默降级语义:Vue2 PhotosTimeline.vue:547-551(`_applyPlaceFromQuery`:
//    spotKey 传了但在详情 spots 里找不到 → 只清 spot 键,不弹 toast,按整城显示)。
//
// 铁律:
//  1) placeKey/spotKey 恒 String() 归一;lat/lon 用 Number()+Number.isFinite 守卫,非有限值传
//     null(共享包 usePlaceAssets.load 要求 lat/lon 与 spotKey 成对,不能把 NaN 传给后端)。
//  2) 路由参数(key/spot/lat/lon)变化必须重新拉取详情与资产——SP6-P5.5 抓到的真 bug:hash
//     路由同组件不重建,详情页缺 :id watcher 会让新地点渲染上一个地点的陈旧数据。
//  3) 面包屑的城市名/spot 名一律从 store.detail 回源派生,不信任 URL 上可能带的旧字符串
//     (本页的 query 本就只放 spot/lat/lon,不放 city/spotName —— 那两个字符串会在改名后
//     过期,T8 评审已指出这一点)。
//
// 偏离登记(超出 brief 字面列的必含用例,理由见下):`currentDetail` 只在 `store.detail.id`
// 与当前 `placeKey` 一致时才采信,不是随手加的判断——`usePhotosPlaces.loadDetail` 内部虽有
// seq 竞态守卫(保证不会把旧响应写成新数据),但从地点 A 跳到地点 B 时,在 B 的响应回来之前
// store.detail 仍持有着 A 的数据;不加这层身份核对,面包屑会在跳转的短暂窗口内显示上一个
// 城市的名字。姐妹页 PhotosPlaces.vue:99-100 的 `activeDetail` 对同一个 store 已有这个先例
// (`store.detail && String(store.detail.id) === String(activeId.value)`),这里照抄同一手法,
// 不是新发明的复杂度。
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePlaceAssets } from '../photos/composables/usePlaceAssets'
import { usePhotosPlaces } from '../photos/stores/places'
import type { Photo } from '../photos/util/assetToPhoto'
// P7b-T5:跳库页叠加 EXIF 筛选(D19)——对应 Vue2 PhotosTimeline.vue:167,spot 分支把
// placeAssets 作为基础集,在其上叠加 FilterBar 的 years/cameras 两个维度。位置维度按 D19
// 不出现:Vue2 那条筛选栏是时间线与 spot 跳转共用的同一条,但 spot 分支明确只传
// years/cameras、把 places 丢掉(注释自陈「城市已框定,再套位置文本会误杀」)——在 New-UI
// 这个独立页面上照搬,就是摆一个点了没反应的死胶囊。
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import { groupPhotosByMonth } from '../photos/util/groupPhotosByMonth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = usePhotosPlaces()
const assets = usePlaceAssets()
const lb = useLightbox()

// ── 结构规格 2:参数归一 ──────────────────────────────────────────────────────
const placeKey = computed(() => String(route.params.key))
const spotKey = computed(() => String(route.query.spot ?? ''))
// 评审 I1 修正:lat/lon 必须与 spotKey 挂钩,不能独立生效——回源 Vue2
// `_applyPlaceFromQuery`(NimoOS-UI/src/views/Photos/PhotosTimeline.vue:538-545):只在 spot
// 命中时才赋 spotLat/spotLon,否则强制 null。共享包 `listAssetsByPlace` 要求 lat/lon 与
// spotKey 成对(见 `.sp7/NimoOS-Service/src/photos.ts` 该方法的注释)——没有 spotKey 时哪怕
// URL 上手工带了 `?lat=1&lon=2`,也必须传 null,否则违反这个不变量。应用内导航碰不到这条
// (showWholeCity/spot 卡片都是三键一起清、一起带),但手改地址栏或旧书签会触发。
const lat = computed(() => {
  if (!spotKey.value) return null
  const n = Number(route.query.lat)
  return Number.isFinite(n) ? n : null
})
const lon = computed(() => {
  if (!spotKey.value) return null
  const n = Number(route.query.lon)
  return Number.isFinite(n) ? n : null
})

// 身份守卫(偏离登记,理由见文件头注释)——只信任与当前 placeKey 匹配的详情。
const currentDetail = computed(() =>
  (store.detail && String(store.detail.id) === placeKey.value) ? store.detail : null)

const cityName = computed(() => currentDetail.value?.city || t('photosPlaces'))

// 有 spot 时,spot 名从 store.detail.spots 按 key 找;找不到（深链失效/改名/详情未到位）
// 时不渲染 spot 段——下面的 watch 会同步把 query 清掉，静默降级为整城视图（照 Vue2 :547-551,
// 不弹 toast）。
const matchedSpot = computed(() => {
  if (!spotKey.value || !currentDetail.value) return null
  return currentDetail.value.spots.find((s) => String(s.key) === spotKey.value) ?? null
})

function loadAll(): void {
  void store.loadDetail(placeKey.value)
  void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
}

// ── 结构规格 3:数据编排 ──────────────────────────────────────────────────────
onMounted(loadAll)

// 结构规格 3:路由参数变化重跑两者(SP6-P5.5 第 6 条教训)。
watch(
  () => [route.params.key, route.query.spot, route.query.lat, route.query.lon],
  loadAll,
)

// 城市段点击:去掉 query 只留 path,回到整城视图(结构规格 4)。
function showWholeCity(): void {
  void router.replace({ path: route.path, query: {} })
}

// spot 找不到时的静默降级(结构规格 4 + Vue2 :547-551 语义):一旦确认（身份匹配的）详情里
// 没有这个 spot key，清掉 spot/lat/lon 三个 query，不弹 toast。
//
// 踩坑记录:这里**必须**watch `currentDetail`(它在每次 loadDetail 成功后都会指向一个全新
// 对象引用——`toPlaceDetail` 每次都 `return { ... }` 新建),而不能直接 watch `matchedSpot`。
// `matchedSpot` 在"详情还没到位"(currentDetail 为 null)与"详情到位但确实没这个 spot"两种
// 情形下的值**都是 null**——Vue 的 `watch` 对新旧值做 `hasChanged` 比较,null→null 判定为
// 未变化,回调根本不会跑,降级就成了死代码(有对应的删码验证用例钉住)。watch 一个"确定会换
// 新引用"的量,再在回调里读 matchedSpot.value,才能保证"详情从无到有"这一刻必然触发一次判断。
watch(currentDetail, (d) => {
  if (d && spotKey.value && !matchedSpot.value) showWholeCity()
})

// ── 结构规格 6:网格 + 灯箱 ────────────────────────────────────────────────────
// P7b-T5:EXIF 筛选态(同 T4 形状)。D19:只留年份/相机两个胶囊——见上方 import 处注释。
// P8a-T10 挂账登记(只登记不改):`places` 这个 EXIF 维度在本页从未端到端贯通过——
// PLACE_CHIP_KEYS 不含 'places' 故 UI 从不渲染/不产出这个胶囊,下面 gridMonths 也只投影
// years/cameras 两个键给 applyExifFilters(:146-150)。exifFilter.places 恒为 []。P7b 只把
// cameras 维度接通,places 维度的"未贯通"是本页刻意设计(见下方注释),不是遗漏。
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
const PLACE_CHIP_KEYS = ['years', 'cameras'] as const

// 不改 usePlaceAssets 的 months(那是 P6b 的组件,禁无关重构)——本页自己再算一份筛选后
// 的月份分组,并丢掉空月份(同 T4 的理由:月份刻度尺读的是未按标签页过滤的 months,这里
// 同理不读 assets.months.value,自己对 assets.photos.value 先筛再分组)。
//
// fix round 1 Minor 1(评审):这里的调用顺序是「先筛后分组」——groupPhotosByMonth
// (util/groupPhotosByMonth.ts:15-23)的桶是遇到照片才创建,永不产出空桶,所以本页这个
// `.filter(m => m.photos.length > 0)` 在结构上不可能剔掉任何东西,是防御性死代码。仍然
// 保留它(brief 明文要求),是为了与 T4(views/Photos.vue,那边 months 来自后端预分桶、
// 筛选发生在桶内、空月份是真实可能出现的)保持同一套调用惯例口径,不是本页此刻需要的
// 逻辑保护。
// fix round(终审 M1):显式投影只喂 years/cameras 两个维度,对齐 Vue2
// `PhotosTimeline.vue:167`(spot 分支同样显式传 `{ years, cameras }`,不整个 filter 对象
// 转发)。今天 exifFilter.places 恒空,喂整个对象与只喂两个键结果等价——但一旦将来有代码
// (深链/store)往 exifFilter.places 塞值,喂整个对象会静默按位置筛出结果,而 UI 上既看不到
// 这个胶囊也清不掉它(T2 挂账的「幽灵筛选」)。显式投影让 D19 在数据层自证,不只靠 UI 侧
// 不渲染位置胶囊这一层防线。
const gridMonths = computed(() =>
  groupPhotosByMonth(applyExifFilters(assets.photos.value, {
    years: exifFilter.value.years,
    cameras: exifFilter.value.cameras,
  })).filter((m) => m.photos.length > 0))

// PhotosGrid 自己 emit 的 list 恒为 undefined(它不知道"整页"的边界在哪)。翻页集跟着
// 筛选走(D9 同型要求:灯箱能翻到的必须是这一屏看得见的),所以重建翻页集时用 gridMonths
// 而不是 assets.photos.value——与 T4(views/Photos.vue)的 onOpenTile 同一理由。
function onOpen(photo: Photo, _list: undefined, startMs: number): void {
  lb.openAt(photo, gridMonths.value.flatMap((m) => m.photos), startMs)
}

function retry(): void {
  void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)
}
</script>

<template>
  <AreaShell :title="cityName">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- 面包屑(结构规格 4)——独立于下面的三态门控,任何状态下都显示。 -->
        <div class="place-crumb" data-test="place-crumb">
          <svg class="crumb-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
          <button
            v-if="matchedSpot"
            type="button" class="crumb-city" data-test="place-crumb-city-btn"
            :title="t('photosPlacesShowWholeCity')"
            @click="showWholeCity"
          >{{ cityName }}</button>
          <span v-else class="crumb-city is-leaf" data-test="place-crumb-city-span">{{ cityName }}</span>
          <template v-if="matchedSpot">
            <svg class="crumb-chev" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
            <span class="crumb-spot" data-test="place-crumb-spot">{{ matchedSpot.name }}</span>
          </template>
          <div class="crumb-spacer"></div>
          <PhotosFilterBar
            v-model:filter="exifFilter" :photos="assets.photos.value"
            :chip-keys="[...PLACE_CHIP_KEYS]"
          />
          <!-- P7b-T5(终审 I1 订正措辞):读**未筛选**的 assets.photos,是为了让这个计数
               表达「这个地点一共多少张」,不是「筛完剩多少张」。筛到零时,门控走向下面的
               v-else(PhotosGrid 自己渲染空网格),不会命中下方 place-assets-empty 那个
               分支——但 PhotosGrid 自己的空态用的正是同两个键(photosNoPhotos /
               photosNoPhotosHint),所以用户最终看到的文案与那个分支逐字相同,只是换了个
               DOM 路径,不是「避免了误导文案」。若要一个真正的「没有匹配的筛选结果」文案,
               是 Vue2 也没有的新功能,应挂债务,本期不做。 -->
          <span class="crumb-count" data-test="place-crumb-count">{{ t('photosPlacesPhotoCount', { n: assets.photos.value.length }) }}</span>
        </div>

        <!-- 结构规格 5:三态门控(照 PhotosPersonDetail.vue:583-611 体例)。 -->
        <div v-if="assets.loading.value && !assets.loaded.value" class="place-skeleton" data-test="place-assets-skeleton">
          <div class="place-skeleton-grid">
            <div v-for="i in 12" :key="i" class="place-skeleton-tile"></div>
          </div>
        </div>

        <div v-else-if="assets.failed.value" class="empty-state" data-test="place-assets-failed">
          <div class="empty-state-title">{{ t('photosPlacesLoadFailed') }}</div>
          <button type="button" class="bar-btn" data-test="place-assets-retry" @click="retry">
            {{ t('photosPlacesRetry') }}
          </button>
        </div>

        <!-- P7b-T5(终审 I1 订正措辞):这个门控同样读**未筛选**的 assets.photos,只判定
             「这个地点本身有没有资产」(与筛选无关)——筛到零张时走的是下面的 v-else 分支
             (PhotosGrid 渲染空网格),不落在这里。但那个分支渲染出的空态文案与这里逐字
             相同(见下方面包屑计数处的同款注释),两条门控路径的区分只对代码/测试有意义,
             用户看到的东西不会因为走哪条分支而不同。 -->
        <div v-else-if="assets.loaded.value && assets.photos.value.length === 0" class="empty-state" data-test="place-assets-empty">
          <div class="empty-state-title">{{ t('photosNoPhotos') }}</div>
          <div class="empty-state-desc">{{ t('photosNoPhotosHint') }}</div>
        </div>

        <!-- 结构规格 6:D10 只浏览,不接多选/批操作——selectable=false。 -->
        <div v-else class="place-grid-slot">
          <PhotosGrid
            :months="gridMonths"
            :selectable="false"
            @open="onOpen"
          />
        </div>
      </main>
    </div>
  </AreaShell>

  <!-- 灯箱挂在 AreaShell 之外:position:fixed,避免被祖先的 transform/overflow 裁剪
       (同 PhotosPersonDetail.vue:708-710 的既有先例)。 -->
  <PhotoLightbox />
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.place-crumb { display: flex; align-items: center; gap: 6px; padding: 4px 4px 14px; flex: 0 0 auto; color: var(--fg-muted); }
.crumb-icon { flex: 0 0 auto; }
.crumb-city {
  border: 0; background: transparent; padding: 0; margin: 0; font: inherit; color: var(--fg);
  font-weight: 600; font-size: 14px; cursor: pointer;
}
.crumb-city.is-leaf { cursor: default; }
button.crumb-city:hover { color: var(--accent); }
.crumb-chev { flex: 0 0 auto; opacity: 0.6; }
.crumb-spot { font-size: 14px; color: var(--fg); }
.crumb-spacer { flex: 1; }
.crumb-count { font-size: 12px; color: var(--fg-muted); }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; max-width: 340px; }
.empty-state .bar-btn { margin-top: 10px; }

.place-skeleton-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; padding: 4px; }
.place-skeleton-tile { aspect-ratio: 1; border-radius: 3px; background: var(--skeleton-bg); }

.place-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>

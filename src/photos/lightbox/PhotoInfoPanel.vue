<script setup lang="ts">
// EXIF/详情栏——移植自 Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue:74-149(<aside class="lb-info">)。
// 纯展示组件:props { photo, visible },emits 无。
// delta(见 task-7-brief.md):
//   1) 删「交给 Nimo」/「Hand off to Nimo」按钮(Vue2 :84-87)——本组件不渲染任何 ask-nimo 交互。
//   2) tags/scene/faces 在 P2 时间线路径恒为空 → 对应段落整体隐藏(v-if 挡在外层 div 上),保留结构以便后续接入真实数据后无需改模板。
//
// Task 15B(SP7-P5 两笔记账收口)人脸 chip 真头像 —— 前置事实纠正(task-15-brief.md):
//   ① 后端没有 asset-scoped face-thumbnail 端点,全仓只有 person-scoped 的
//      /v1/photos/persons/:id/face-thumbnail;② Vue2 灯箱本身也是首字母占位
//      (PhotosLightbox.vue:128-129 的 `{{ f[0] }}`)——New-UI 此前(delta ② 的原描述)其实已经
//      与 Vue2 1:1;③ 根因是 Photo.faces 只是人名字符串数组(assetToPhoto.ts:311/398),不带
//      personId,且后端只在收藏列表接口填充这个字段。
//   本任务做的是在不改后端前提下能做到的最好版本:用人名反查人物列表(usePhotosPeople)拿
//   personId,唯一命中(resolvePersonByName)才用 PersonAvatar 显示真头像,否则保持首字母
//   占位——这是超出 Vue2 的增强,登记为偏离;真正的正解(后端让 faces 带 personId,或新增
//   asset-scoped 端点)记后端票,不在本任务范围。不加点击跳转(保持 Vue2 的非交互 chip)。
//   顺带修正:占位首字母原来是裸 `f[0]`(未大写),改用 personInitial(f) 统一大写,对齐
//   Vue2 peopleUtils.js 的 personInitial 语义。
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../files/util/clipboard'
import { osmEmbedSrc } from './util/osmMap'
import { usePhotosPeople } from '../stores/people'
import { resolvePersonByName, personInitial } from '../util/peopleView'
import PersonAvatar from '../components/PersonAvatar.vue'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ photo: Photo | null; visible: boolean }>()

const { t } = useI18n()

// —— 相机/拍摄字段格式化(照 Vue2 :95-96 的 toFixed 规则) ——
const apertureLabel = computed(() => {
  const a = props.photo?.aperture
  if (a == null || a === '') return null
  return `f/${Number(a).toFixed(1)}`
})
const focalLabel = computed(() => {
  const f = props.photo?.focal
  if (f == null || f === '') return null
  return `${Number(f).toFixed(0)} mm`
})

const hasLocation = computed(() => !!(props.photo?.latitude && props.photo?.longitude))
const mapSrc = computed(() => hasLocation.value ? osmEmbedSrc(props.photo!.latitude, props.photo!.longitude) : '')

const faces = computed(() => (props.photo?.faces as string[] | undefined) ?? [])
const tags = computed(() => (props.photo?.tags as string[] | undefined) ?? [])

// —— Task 15B:人脸 chip 真头像(见头部注释的前置事实纠正与登记的偏离) ——
const people = usePhotosPeople()
// 只拉一次(store 的 peopleLoaded 标志天然去重):faces 非空且尚未加载过才拉。失败时
// peopleLoaded 留 false(people.ts 内部约定),下次开图 watch 会再触发一次重试。
watch(
  faces,
  (list) => { if (list.length > 0 && !people.peopleLoaded) void people.fetchPeople() },
  { immediate: true },
)
// 人名 → 唯一匹配的人物(重名/无匹配都是 null,退回首字母占位)。与 faces 一起渲染,
// 随 people.people 到位后自动重新求值。
const faceEntries = computed(() =>
  faces.value.map((f) => ({ name: f, person: resolvePersonByName(people.people, f) })),
)

// —— 复制文件路径 ——(HTTP 非安全上下文兜底走 src/files/util/clipboard.ts 既有 copyText)
const justCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
async function onCopyPath(): Promise<void> {
  const path = props.photo?.filePath
  if (!path) return
  try {
    await copyText(path)
    justCopied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { justCopied.value = false; copiedTimer = null }, 2000)
  } catch {
    // 两条兜底路径都失败——静默忽略,不打断详情栏展示(与 Vue2 行为一致,未做 toast)
  }
}
</script>

<template>
  <!-- Plan F Task 3: root class renamed from the invented `.info-panel` to parity's real
       anchor `.lb-info` (Vue2 PhotosLightbox.vue:74 `<aside class="lb-info scroll">`, parity
       photos.scss:677 `.photos-root .lb-info { grid-area: info; ... }`). This component is
       mounted as a direct child of PhotoLightbox's `.lightbox` grid (see that file's
       scoped-style header comment) and needs the `grid-area: info` placement itself -- kept
       local/scoped here rather than in the parent, since the parent doesn't otherwise reach
       into this component's box model. -->
  <aside v-if="visible && photo" class="lb-info">
    <!-- 图片:相机与拍摄 -->
    <div v-if="!photo.isVideo" class="info-section">
      <div class="info-label">{{ t('photosInfoCameraCapture') }}</div>
      <div v-if="photo.camera" class="info-row" data-field="camera"><span class="k">{{ t('photosFieldCamera') }}</span><span class="v">{{ photo.camera }}</span></div>
      <div v-if="photo.iso" class="info-row" data-field="iso"><span class="k">{{ t('photosFieldIso') }}</span><span class="v">{{ photo.iso }}</span></div>
      <div v-if="photo.shutter" class="info-row" data-field="shutter"><span class="k">{{ t('photosFieldShutter') }}</span><span class="v">{{ photo.shutter }}</span></div>
      <div v-if="apertureLabel" class="info-row" data-field="aperture"><span class="k">{{ t('photosFieldAperture') }}</span><span class="v">{{ apertureLabel }}</span></div>
      <div v-if="focalLabel" class="info-row" data-field="focal"><span class="k">{{ t('photosFieldFocal') }}</span><span class="v">{{ focalLabel }}</span></div>
      <div v-if="photo.dim" class="info-row" data-field="dimensions"><span class="k">{{ t('photosFieldDimensions') }}</span><span class="v">{{ photo.dim }}</span></div>
      <div v-if="photo.size" class="info-row" data-field="file-size"><span class="k">{{ t('photosFieldFileSize') }}</span><span class="v">{{ photo.size }}</span></div>
    </div>

    <!-- 视频:编码/帧率/码率/旋转 -->
    <div v-if="photo.isVideo" class="info-section">
      <div class="info-label">{{ t('photosInfoVideo') }}</div>
      <div v-if="photo.duration" class="info-row" data-field="duration"><span class="k">{{ t('photosFieldDuration') }}</span><span class="v">{{ photo.duration }}</span></div>
      <div v-if="photo.dim" class="info-row" data-field="resolution"><span class="k">{{ t('photosFieldResolution') }}</span><span class="v">{{ photo.dim }}</span></div>
      <div v-if="photo.videoCodec" class="info-row" data-field="video-codec"><span class="k">{{ t('photosFieldVideoCodec') }}</span><span class="v">{{ photo.videoCodec }}</span></div>
      <div v-if="photo.audioCodec" class="info-row" data-field="audio-codec"><span class="k">{{ t('photosFieldAudioCodec') }}</span><span class="v">{{ photo.audioCodec }}</span></div>
      <div v-if="photo.frameRate" class="info-row" data-field="frame-rate"><span class="k">{{ t('photosFieldFrameRate') }}</span><span class="v">{{ photo.frameRate }}</span></div>
      <div v-if="photo.bitRate" class="info-row" data-field="bit-rate"><span class="k">{{ t('photosFieldBitRate') }}</span><span class="v">{{ photo.bitRate }}</span></div>
      <div v-if="photo.rotation" class="info-row" data-field="rotation"><span class="k">{{ t('photosFieldRotation') }}</span><span class="v">{{ photo.rotation }}°</span></div>
      <div v-if="photo.size" class="info-row" data-field="file-size"><span class="k">{{ t('photosFieldFileSize') }}</span><span class="v">{{ photo.size }}</span></div>
    </div>

    <!-- 位置:图片/视频共用 -->
    <div v-if="photo.place || photo.coords" class="info-section" data-section="location">
      <div class="info-label">{{ t('photosInfoLocation') }}</div>
      <div v-if="photo.place" class="info-row" data-field="place"><span class="k">{{ t('photosFieldPlace') }}</span><span class="v">{{ photo.place }}</span></div>
      <div v-if="photo.coords" class="info-row" data-field="coordinates"><span class="k">{{ t('photosFieldCoordinates') }}</span><span class="v">{{ photo.coords }}</span></div>
      <div v-if="hasLocation" class="map-mini">
        <iframe :src="mapSrc" title="map" loading="lazy"></iframe>
        <div class="map-pin"></div>
        <!-- 自绘归属声明:OSM 自己那条页脚(Report a problem / Make a Donation /
             Website and API terms)已被上下对称裁切挡掉(见 .map-mini iframe 的注释),
             但 ODbL 要求保留署名,故在盒内右下补一条最小可读的 credit。 -->
        <div class="map-credit">© OpenStreetMap</div>
      </div>
    </div>

    <!-- 人物(P2 时间线路径 faces 多为空,恒隐藏本段;有数据时渲染 chip,不引入 face-thumbnail) -->
    <div v-if="faces.length > 0" class="info-section" data-section="people">
      <div class="info-label">{{ t('photosInfoPeople') }} · {{ faces.length }}</div>
      <div class="face-row">
        <div v-for="entry in faceEntries" :key="entry.name" class="face-chip">
          <PersonAvatar
            v-if="entry.person"
            :size="18"
            :person-id="entry.person.id"
            :ver="entry.person.coverFaceId"
            :name="entry.name"
          />
          <span v-else class="face-avatar">{{ personInitial(entry.name) }}</span>
          {{ entry.name }}
        </div>
      </div>
    </div>

    <!-- Nimo 识别(P2 时间线路径 tags/scene 恒空,隐藏本段;保留结构等后续接入) -->
    <div v-if="tags.length > 0" class="info-section" data-section="nimo-sees">
      <div class="info-label">{{ t('photosInfoNimoSees') }}<template v-if="photo.scene"> · {{ photo.scene }}</template></div>
      <div class="tag-row">
        <!-- Plan F Task 3: renamed from the invented `.tag-chip` to parity's real anchor
             `.tag[data-kind="ai"]` (Vue2 PhotosLightbox.vue:137, parity photos.scss:696-697).
             This section only ever renders Nimo-recognized tags (the "Nimo sees" section),
             so data-kind is unconditionally "ai", matching Vue2's own hard-coded value. -->
        <span v-for="tag in tags" :key="tag" class="tag" data-kind="ai">{{ tag }}</span>
      </div>
    </div>

    <!-- 文件路径 + 复制 -->
    <div class="info-section">
      <div class="info-label">{{ t('photosInfoFile') }}</div>
      <div class="path-row">
        <span class="path-text">{{ photo.filePath }}</span>
        <button type="button" class="copy-btn" :title="t('photosCopyPath')" @click="onCopyPath">
          {{ justCopied ? t('photosCopied') : t('photosCopyPath') }}
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Plan F Task 5: the Task 3 "card look" deviation on `.lb-info` (border/border-radius/box-
   shadow/backdrop-filter/background/padding/overflow-y, all self-contained so the panel stayed
   legible while rendering standalone outside `.photos-root`) is retired now that this component
   actually nests inside `.photos-root` -- parity's own `.photos-root .lb-info` (photos.scss:685-
   689: `grid-area: info; background: var(--surface-1); border-left: 1px solid var(--line);
   overflow-y: auto; padding: 18px 0;`) is a bare flush panel and now governs those properties
   alone (this was the exact "revisit when Task 5 re-nests" flagged by that original comment).
   Layout structure with no parity counterpart survives: `max-width`/`box-sizing` (defensive floor
   for the narrow-screen media query below, which switches this element out of grid flow
   entirely) and `color` (parity never sets a base text color on the panel itself, each child sets
   its own).

   I3 (final review, 2026-08-15): `display: flex; flex-direction: column; gap: 16px` here, plus
   `.info-section`'s own `display: flex; flex-direction: column; gap: 6px` below, were an
   unregistered pixel deviation -- Vue2 stacks `.info-section`s flush against each other (parity
   :690-691: `padding: 12px 20px; border-bottom: 1px solid var(--line)` is the ONLY spacing
   mechanism between sections, no gap layered on top). Both flex/flex-direction/gap declarations
   deleted so parity's flush, padding+border-driven stacking is what actually governs, matching
   Vue2's real vertical rhythm instead of an extra 16px/6px gap Vue2 never had. */
.lb-info {
  max-width: 100%;
  box-sizing: border-box;
  color: var(--fg);
}
.info-section { min-width: 0; }
/* `.info-label` retired -- byte-duplicate of parity's `.photos-root .info-label` (font-size/
   font-weight/color/text-transform/letter-spacing all collide; parity additionally sets
   `margin-bottom`). */
/* `.info-row`'s own `display`/`justify-content`/`gap`/`font-size` collide with parity's
   `.photos-root .info-row` (which also adds `padding: 4px 0`) -- retired, only `align-items:
   baseline` survives (parity doesn't set it, and it only takes effect once `display: flex` is
   in play, which parity's own copy already supplies). */
.info-row { align-items: baseline; }
/* `.k`'s `color` collides with parity's `.photos-root .info-row .k`; only `flex: 0 0 auto`
   (parity doesn't set it) survives, keeping the label from shrinking. */
.info-row .k { flex: 0 0 auto; }
/* `.v`'s `color`/`text-align` collide with parity's `.photos-root .info-row .v` (which also adds
   `font-variant-numeric: tabular-nums`); only the truncation trio survives (parity doesn't set
   any of them). */
.info-row .v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* `.map-mini`'s `position`/`border-radius`/`overflow`/`height` collide with parity's
   `.photos-root .map-mini` (height already matched byte-exact per the prior Task 4 fix, parity
   additionally sets `margin-top`/`background`) -- retired; only the `border` survives (parity's
   own map area has none, but this component's border ring doesn't conflict with any parity
   property and isn't part of the "card look" being un-done above). New-UI addition, no Vue2
   source (M6): Vue2's own `.map-mini` (PhotosLightbox.vue:119-122) has no border ring at all --
   this is a New-UI-only visual accent with nothing to cite on the Vue2 side, kept because it
   doesn't collide with any parity-declared property. */
.map-mini { border: 1px solid var(--card-border); }
/* 用户 2026-07-31 验收要求:去掉 OSM 内嵌页自带的那条页脚文字
   (Report a problem | © OpenStreetMap contributors ♥ Make a Donation. Website and API terms)。
   iframe 是跨域的,内部元素无法用 CSS 隐藏,只能靠外层裁切;实测在 328px 宽处那条页脚会
   折成两行占约 40px,故裁 48px 留余量(更窄/更宽处行数只会更少)。
   **上下对称裁切**:iframe 比盒子高 2×48px 并上移 48px,让地图中心仍落在盒子中心 ——
   若只加高不上移,OSM 自己的标记会掉到 .map-pin 下方错位(已用无头浏览器截图自查过对位)。
   代价:内嵌页右上角的 +/- 缩放钮也一并被裁掉,小地图不再可缩放(可接受,它是位置示意图)。 */
.map-mini iframe {
  position: absolute; left: 0; width: 100%; border: none; display: block;
  top: -48px; height: calc(100% + 96px);
}
.map-credit {
  position: absolute; right: 6px; bottom: 4px; z-index: 1;
  font-size: 9px; line-height: 1.2; letter-spacing: .01em;
  pointer-events: none;
  /* theme-exception: 归属声明压在任意地图瓦片上(颜色不可预测),固定浅色 + 深色投影保可读,皮肤无关 */
  color: rgba(255, 255, 255, 0.72);
  /* theme-exception: 同上,投影为固定暗色描边 */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
}
/* Plan F Task 5: `.map-pin` retired -- byte-duplicate anchor of parity's `.photos-root .map-pin`,
   which additionally corrects the anchor point (`transform: translate(-50%, -100%)`, a bottom-
   anchored teardrop pin vs this rule's centered dot) and size (14px vs 10px) to match Vue2's
   real pin exactly; nothing here survives that parity doesn't already cover. */

/* Plan F Task 5: `.face-row`/`.tag-row` retired -- byte-duplicate of parity's own
   `.photos-root .face-row`/`.photos-root .tag-row` (display/flex-wrap/gap all collide; only the
   gap value differs, 8px here vs parity's 6px -- parity's now governs alone). */
/* `.face-chip` retired -- collides with parity's `.photos-root .face-chip` on every property it
   declares (display/align-items/gap/padding/border-radius/font-size/background); parity
   additionally adds a `border`, nothing survives locally. */
/* `.face-avatar` retired -- collides with parity's `.photos-root .face-avatar` on every property
   (display/align-items/justify-content/width/height/border-radius/font-size/font-weight/color/
   background); parity's is Vue2's literal pastel gradient avatar, this component's `color-mix`
   approximation is superseded. */
/* `.tag`'s `padding`/`border-radius`/`font-size`/`color`/`background` collide with parity's
   `.photos-root .tag` (which additionally adds a `border`); only `display: inline-flex` survives
   (parity leaves display unset, relying on the element's own inline default -- harmless either
   way since this component's tag chips are text-only, no icon needing flex centering). */
.tag { display: inline-flex; }
/* `.tag[data-kind="ai"]`'s `background`/`color` collide with parity's own modifier (which
   additionally adds `border-color`) -- retired, nothing left to declare locally. */

/* Plan F Task 5: `.path-row` retired -- byte-duplicate of parity's `.photos-root .path-row`
   (display/align-items/gap all collide, identical values too); parity additionally adds
   padding/border-radius/background/border/font/color -- a bonus "code chip" look this component
   never had, now inherited for free. `.path-text` has no parity counterpart (parity's own
   `.path-row` uses a bare text node + a `.open` action link, not a wrapper span) and survives
   unchanged; `.copy-btn` likewise shares no class name with parity's differently-named `.open`
   link, so there is no collision to resolve there either. */
.path-text { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.copy-btn {
  flex: 0 0 auto; font-size: 12px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid var(--card-border); background: transparent; color: var(--fg); cursor: pointer;
}
.copy-btn:hover { background: var(--chip-bg-hi); }

/* 窄屏:桌面态右栏 → 底部浮层/全宽覆盖(独立浮层,不接 useSidebarDrawer——那是侧栏专用) */
@media (max-width: 768px) {
  .lb-info {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    width: auto; max-height: 70vh;
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: none;
  }
}
</style>

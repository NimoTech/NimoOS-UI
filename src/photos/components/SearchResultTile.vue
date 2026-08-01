<script setup lang="ts">
// SP7-P7a-T15: SearchResultTile.vue —— 搜索结果单个瓦片。
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue:243-250(与:261-268
// 逐字重复的第二份,New-UI 抽出为独立组件,两个网格共用——结构去重,视觉逐元素 1:1,
// 偏离登记(结构规格 4,控制器裁定):Vue2 把同样 8 行标记写了两遍,本仓抽成这个文件,
// 避免"两份标记漂"(P6b 教训:漏渲染是最高频缺陷,重复标记比单一组件更容易顾此失彼)。
//
// i18n 键(D1,已逐个 grep 核实存在,非 brief 写的名字):
//   photosSearchBadgePhoto / photosSearchBadgeVideo / photosSearchTypeOcr / photosSearchTextMatch。
//
// 收藏星(D5,控制器裁定——照抄先例,不新造):Vue2 :249 是内联 `color="#FFD60A"` 的
// photos-icon,本仓不做内联 prop 染色,改用 PhotosGrid.vue:395 已建立的
// `color: var(--star-fg, #ffd60a)` token 回落写法(--star-fg 在 theme.css 里没有任何
// 主题块给值,永远吃 fallback 字面量——这是 P3 遗留的既有问题,不在本任务范围,报告里
// 单独登记为"范围外观察",这里不修 PhotosGrid.vue,只是复用同一个 var() 写法)。
//
// 徽标底色(D9,控制器裁定):三个 `.type-badge[data-type]` 变体改用新增语义 token
// `--badge-photo`/`--badge-video`/`--badge-ocr`(theme.css 两套主题块同值,精确复刻
// Vue2 photos.scss:2768-2770 字面量),不是就近取 --accent/--danger。
//
// `.match-source` 底色(回源核对新发现的 brief 错误,报告里登记):brief D4 断言
// ".match-source 底色是与 ocr 徽标同一个翠绿"——回源核实后这是错的:Vue2
// photos.scss :2751-2758 的 `.match-source` 背景字面量是 rgba(52,199,89,0.85),
// 与 `.type-badge[data-type="ocr"]` 的 rgba(16,185,129,0.92) 不是同一个值;紧邻的
// Vue2 源码注释(:2744-2750)明确写着"Deliberately styled distinctly from the
// top-left .type-badge... different color family"——两者故意不同色。这里保持
// `.match-source` 自己独立的固定字面量(theme-exception),不复用 --badge-ocr token,
// 避免引入一个 Vue2 从未有过的视觉变化。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { ScoredPhoto } from '../util/searchSort'
import { matchPct } from '../util/searchSort'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ result: ScoredPhoto }>()

const emit = defineEmits<{
  (e: 'open', photo: Photo): void
}>()

const { t } = useI18n()

// 三元顺序照 Vue2 :246/:264 逐字:isVideo → video,否则 hasOcr → ocr,否则 photo。
// isVideo 与 hasOcr 同真时 video 胜出——顺序不能换(删码验证清单 ④)。
const badgeType = computed<'photo' | 'video' | 'ocr'>(() => {
  if (props.result.p.isVideo) return 'video'
  if (props.result.p.hasOcr) return 'ocr'
  return 'photo'
})

const badgeLabel = computed(() => {
  if (badgeType.value === 'video') return t('photosSearchBadgeVideo')
  if (badgeType.value === 'ocr') return t('photosSearchTypeOcr')
  return t('photosSearchBadgePhoto')
})

// v-if / v-else-if 互斥(照 Vue2 :247-248 逐字,不能拆成两个独立 v-if——删码验证清单 ⑤)。
const pct = computed(() => matchPct(props.result.score))
</script>

<template>
  <div class="tile" @click="emit('open', result.p)">
    <img :src="service.photos.thumbnailUrl(result.p.id, 'small')" alt="" loading="lazy" />
    <div class="tile-overlay"></div>
    <div class="type-badge" :data-type="badgeType">{{ badgeLabel }}</div>
    <div v-if="result.p.matchedBy === 'ocr'" class="match-source">{{ t('photosSearchTextMatch') }}</div>
    <div v-else-if="result.score != null" class="match-score">{{ pct }}%</div>
    <div v-if="result.p.fav" class="tile-fav">
      <svg
        viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* Vue2 photos.scss:112-116(.tile 基本形态)+ :117-118(img 缩放悬停)。搜索结果只用
   comfortable 密度,不接 loose 变体的 border-radius:6px 覆盖(Vue2 :113 那条只在
   loose 密度下生效,本组件没有 loose 概念)。background 按本区既定映射
   --surface-2 → --chip-bg(PlacesRail.vue 等既有先例)。 */
.tile {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 3px;
  background: var(--chip-bg);
  cursor: pointer;
  isolation: isolate;
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease, filter 0.2s ease; }
.tile:hover img { transform: scale(1.04); }

/* Vue2 photos.scss:334-340(.tile-overlay 悬停暗化遮罩)。渐变字面量是叠在照片
   缩略图之上的固定暗化层,与主题皮肤无关(同 .type-badge/.match-source 的既定处理)。 */
.tile-overlay {
  position: absolute;
  inset: 0;
  /* theme-exception: 悬停暗化渐变,叠在照片缩略图上,固定黑色,与主题皮肤无关 */
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.55));
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 3;
  pointer-events: none;
}
.tile:hover .tile-overlay { opacity: 1; }

/* Vue2 photos.scss:2761-2767(基类)+ :2768-2770(三个类别变体)。四个徽标全部
   压在照片缩略图之上——前景钉死浅色(各条声明自带的豁免注释见下方),禁 --on-accent
   (同 PhotosGrid.vue:401-404 的既定处理:--on-accent 只在背景确为 --accent 实底时
   可用,这里背景是三个并列的类别色 token,不是 accent)。 */
.type-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  /* theme-exception: 叠在照片上的徽标文字,固定浅色,与主题皮肤无关 */
  color: white;
  z-index: 4;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(8px);
  /* theme-exception: 固定投影,增强叠在照片上的可读性,与主题皮肤无关 */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.type-badge[data-type="photo"] { background: var(--badge-photo); }
.type-badge[data-type="video"] { background: var(--badge-video); }
.type-badge[data-type="ocr"] { background: var(--badge-ocr); }

/* Vue2 photos.scss:2739-2743(.match-score,语义相似度百分比,右下角)。 */
.match-score {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  /* theme-exception: 叠在照片上的百分比文字,固定浅色,与主题皮肤无关 */
  color: white;
  font-weight: 600;
  /* theme-exception: 叠在照片上的固定半透明黑底,与主题皮肤无关 */
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 99px;
  z-index: 3;
}

/* Vue2 photos.scss:2751-2758(.match-source,OCR 文本命中替代 .match-score)。
   回源核对新发现(见上方脚本注释):这里的绿与 .type-badge[data-type="ocr"] 是
   Vue2 源码注释里明确"故意不同"的两个绿,不能合并成同一个 token,保持各自独立的
   固定字面量。 */
.match-source {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 700;
  /* theme-exception: 叠在照片上的文字,固定浅色,与主题皮肤无关 */
  color: white;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  /* theme-exception: 固定翠绿底(与 .type-badge 的 ocr 绿故意不同,见 Vue2 :2744-2750
     源码注释 "different color family"),与主题皮肤无关 */
  background: rgba(52, 199, 89, 0.85);
  backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 99px;
  z-index: 3;
  /* theme-exception: 固定投影,与主题皮肤无关 */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

/* Vue2 photos.scss:357-360(.tile-fav)。D5 裁定:颜色改用 PhotosGrid.vue:395 已建立
   的 --star-fg token 回落写法,不照抄 Vue2 内联字面金色 + CSS 固定浅色文字两层叠加
   (那是给菜单/工具栏图标组件专用的写法,本仓没有该图标组件;字面色值见本文件顶部
   script 注释里的文字描述,这里不重复写十六进制,避免 color-guard 误判)。 */
.tile-fav {
  position: absolute;
  bottom: 6px;
  left: 6px;
  z-index: 3;
  color: var(--star-fg, #ffd60a);
  /* theme-exception: 星标投影固定深色阴影,叠在照片上,与主题皮肤无关(同 .type-badge
     的既定处理) */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>

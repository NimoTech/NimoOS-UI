<script setup lang="ts">
// P6b-T6: PlaceVisitHistory.vue —— 地点详情面板的"到访记录"时间线段。逐段照 Vue2
// src/views/Photos/PhotosPlacesView.vue:1204-1245(模板)移植;样式照
// photos-places.scss:599-618(时间线本体)+ :869-885(`.visit-save-btn`,在文件另一处,
// 已回源核对行号——brief 给的 scss 行号只覆盖到 :618,`.visit-save-btn` 需要单独定位)。
//
// 分工:纯展示 + emit,不碰 store、不发请求——PlaceDetailPanel 原样透传 save-trip /
// open-photo 给容器(未来任务接住后调用 store 方法)。
//
// props/emits 形状由 brief 钉死:
//   props: { visits: PlaceVisit[], trips: number }
//   emits: (e:'save-trip', visit:PlaceVisit) / (e:'open-photo', assetId:string, list:string[])
// D9(本期三条范围决策之一):open-photo 第二参永远是"那一条 visit 自己的 thumbs 数组"，
// 不是别条的、不是单张、不是整库。
//
// token 映射(Vue2 → New-UI,同 PlaceDetailPanel.vue/PlaceInsights.vue 文件头既定表):
// --text-1/2/3 → --fg/--fg-muted/--fg-subtle;--surface-2 → --chip-bg;--line → --card-border。
// 三处"本次旅行"绿色(.visit-dot[data-current]/.visit-pill/.visit-card.is-current .visit-body)
// 一律用 P6a 已建的 --place-current-trip,半透明层走 color-mix(in srgb, var(--place-current-trip)
// N%, transparent)(本仓既定技法,先例 PhotosPlaces.vue:480),不新增 alpha token、不写字面
// rgba。.visit-save-btn 是 accent 色(不是绿色),Vue2 用 rgba(var(--accent-rgb), α) 精确复刻，
// 本仓无 --accent-rgb/--accent-hi token(已 grep 确认,同 PlaceSpotDialog.vue/PersonHero.vue
// 等先例)——改用语义最接近的既有三档 token:--accent-soft(0.14 ≈ Vue2 0.15)/
// --accent-soft-bd(0.36 ≈ Vue2 0.35)/--accent-soft-2(0.24 ≈ Vue2 0.25 的 hover 深一档)/
// --accent-text(替代不存在的 --accent-hi)。
//
// Vue scoped CSS 不跨组件边界(T5 PlaceInsights.vue 文件头已有说明并给出先例):本组件是
// 独立 SFC,`.detail-section h4` 这类壳样式在 PlaceDetailPanel.vue 里已有一份，但够不着
// 这里的 <h4>,故自带一份等价声明。
//
// 偏离登记 15(brief §4 原文要求"照搬并登记"):`.visit-thumbs img:hover { transform:
// scale(1.05) }` 照搬 Vue2,父格 `.visit-thumbs` 未设 overflow:hidden，hover 放大会溢出
// 压邻格——Vue2 原状如此，本任务不修，同类偏离已在别处登记过（brief 明确点名"同类偏离 15"）。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { PlaceVisit } from '../stores/places'

const props = defineProps<{
  visits: PlaceVisit[]
  trips: number
}>()

const emit = defineEmits<{
  (e: 'save-trip', visit: PlaceVisit): void
  (e: 'open-photo', assetId: string, list: string[]): void
}>()

const { t } = useI18n()

const tripsUnitKey = computed(() => (props.trips === 1 ? 'photosPlacesTrip' : 'photosPlacesTrips'))

function thumbUrl(assetId: string): string {
  return service.photos.thumbnailUrl(assetId, 'small')
}
</script>

<template>
  <!-- brief 结构规格 1:恒渲染,无 v-if。 -->
  <div class="detail-section">
    <h4>
      {{ t('photosPlacesVisitHistory') }}
      <!-- Vue2 :1207 的裸内联 style(font-variant-numeric,非颜色属性)照搬；静态文本，
           不可点，不叠 .is-clickable(T4 留下的约定：这个 .more 是次数展示，不是入口)。 -->
      <span class="more" style="font-variant-numeric: tabular-nums">
        {{ trips }} {{ t(tripsUnitKey) }}
      </span>
    </h4>
    <div class="visit-history">
      <div
        v-for="(v, k) in visits" :key="k"
        :class="`visit-card${v.current ? ' is-current' : ''}`"
      >
        <div class="visit-rail">
          <span class="visit-dot" :data-current="v.current" />
        </div>
        <div class="visit-body">
          <div class="visit-head">
            <span class="visit-when">{{ v.when }}</span>
            <span v-if="v.current" class="visit-pill">
              <span class="live-dot" /> {{ t('photosPlacesCurrentTrip') }}
            </span>
            <span v-else class="visit-len">{{ t('photosPlacesDays', { n: v.days }) }}</span>
          </div>
          <div class="visit-stats">
            <span><b>{{ v.photos }}</b> {{ t('photosPlacesPhotos') }}</span>
            <span v-if="v.faces?.length">· {{ t('photosPlacesWith') }} <b>{{ v.faces.join(' · ') }}</b></span>
            <span v-if="v.spots">· {{ t('photosPlacesSpotsCount', { n: v.spots }) }}</span>
            <button
              type="button" class="visit-save-btn" :title="t('photosPlacesSaveTripTitle')"
              @click.stop="emit('save-trip', v)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
              {{ t('photosPlacesSaveTrip') }}
            </button>
          </div>
          <div class="visit-thumbs">
            <img
              v-for="th in v.thumbs" :key="th" :src="thumbUrl(th)" alt=""
              style="cursor: pointer" @click="emit('open-photo', th, v.thumbs)"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup (Plan E Task 4, 2026-08-15): most of this file's former scoped rules have
   been deleted. Two bug classes fixed:
   (1) The header comment this block used to carry claimed "Vue scoped CSS doesn't cross
       component boundaries, so this file needs its own `.detail-section h4` copy" — true of
       PlaceDetailPanel.vue's *scoped* rule of the same name, false of parity's plain, unscoped
       `photos-places.scss:675-682`, which reaches this component's `<h4>` the same way any
       global stylesheet reaches any element. Deleted the redundant local copy.
   (2) `.visit-history`/`.visit-card`/`.visit-rail`/`.visit-dot`/`.visit-body`/`.visit-head`/
       `.visit-when`/`.visit-len`/`.visit-stats`/`b`/`.visit-thumbs`/`img`/`img:hover` all
       substituted global New-UI tokens (`--card-border`/`--fg-subtle`/`--chip-bg`/`--fg`/
       `--fg-muted`) for Photos-local ones (`--line`/`--text-3`/`--surface-2`/`--text-1`/
       `--text-2`) that parity (`:599-618`, `:869-885` for `.visit-save-btn`) already declares
       correctly for these exact selectors, plus `.visit-save-btn`/`:hover` used global blue-family
       `--accent-soft-bd`/`--accent-text`/`--accent-soft-2` in place of Photos-local
       `--accent-rgb`/`--accent-hi` (wrong hue) — same shadowing pattern as PlacesZoomBar.vue's
       2026-08-15 fix (Task 3). Deleted; parity now governs all of it.
   What survives: the three test-pinned "current trip" green rules (token-based, since this
   app forbids bare color literals — parity's own current-trip-green literal isn't directly
   reusable here), the last-child rail-hiding rule and the `pulseDot` keyframes
   (PlaceVisitHistory.test.ts reads this file's own raw `<style>` text for all of these), and
   an explicit cursor override on the non-clickable `.more` (see below). */

/* spec §7c-9 (same convention as PlaceDetailPanel.vue's spots-section `.more`): this section's
   `.more` is a static "N trips" count, not an entry point — parity's global `.detail-section h4
   .more` rule sets `cursor: pointer` (ported from Vue2, which coincidentally never made this
   particular span clickable either, just inherited the shared class's cursor), and because
   that global rule reaches every `.detail-section h4 .more` on the page regardless of scoped
   boundaries, this local override is required — not optional — to actually cancel the inherited
   pointer cursor for this non-clickable instance. */
.detail-section h4 .more { cursor: auto; }

.visit-card:last-child .visit-rail::before { display: none; }
.visit-dot[data-current="true"] {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}
.visit-card.is-current .visit-body {
  background: color-mix(in srgb, var(--place-current-trip) 5%, transparent);
  border-color: color-mix(in srgb, var(--place-current-trip) 25%, transparent);
}
.visit-pill {
  background: color-mix(in srgb, var(--place-current-trip) 15%, transparent);
  color: var(--place-current-trip);
}
.visit-pill .live-dot { background: var(--place-current-trip); animation: pulseDot 1.5s infinite; }
@keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>

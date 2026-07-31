<script setup lang="ts">
// P6b-T6: PlaceVisitHistory.vue —— 地点详情面板的"到访记录"时间线段。逐段照 Vue2
// NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1204-1245(模板)移植;样式照
// photos-places.scss:599-618(时间线本体)+ :835-851(`.visit-save-btn`,在文件另一处,
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
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
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
/* Vue scoped CSS 不跨组件边界(同 PlaceInsights.vue 文件头说明 + 先例):自带一份等价的
   段落标题壳样式,不依赖 PlaceDetailPanel.vue 里已有的同名规则。 */
.detail-section h4 {
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin: 0 0 10px;
  line-height: 1.4;
  display: flex; align-items: baseline; justify-content: space-between;
}
/* 本段的 .more 是静态次数展示,不可点,不加 cursor:pointer(同 T4 spots 段 / T5 文件头
   关于共享基类 vs is-clickable 修饰类的既定约定——这里干脆不共享基类,自成一份)。 */
.detail-section h4 .more {
  font-size: 11px; color: var(--accent); font-weight: 500;
  text-transform: none; letter-spacing: 0;
}

.visit-history { display: flex; flex-direction: column; gap: 12px; }
.visit-card { display: flex; gap: 10px; }
.visit-rail { width: 14px; flex-shrink: 0; position: relative; display: flex; justify-content: center; padding-top: 6px; }
.visit-rail::before { content: ""; position: absolute; top: 14px; bottom: -12px; left: 50%; width: 1px; background: var(--card-border); transform: translateX(-0.5px); }
/* 照搬 Vue2 :603 —— 否则最后一条到访记录的竖线会拖一截悬空线(brief 明确点名的坑)。 */
.visit-card:last-child .visit-rail::before { display: none; }
.visit-dot { width: 8px; height: 8px; border-radius: 99px; background: var(--fg-subtle); position: relative; z-index: 1; }
.visit-dot[data-current="true"] {
  background: var(--place-current-trip);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--place-current-trip) 20%, transparent);
}
.visit-body { flex: 1; min-width: 0; background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px; }
.visit-card.is-current .visit-body {
  background: color-mix(in srgb, var(--place-current-trip) 5%, transparent);
  border-color: color-mix(in srgb, var(--place-current-trip) 25%, transparent);
}
.visit-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.visit-when { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.visit-len { font-size: 11px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; margin-left: auto; }
.visit-pill {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 500; padding: 2px 8px; border-radius: 99px;
  background: color-mix(in srgb, var(--place-current-trip) 15%, transparent);
  color: var(--place-current-trip);
}
.visit-pill .live-dot { width: 5px; height: 5px; border-radius: 99px; background: var(--place-current-trip); animation: pulseDot 1.5s infinite; }
@keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.visit-stats { font-size: 11px; color: var(--fg-subtle); margin-bottom: 8px; }
.visit-stats b { color: var(--fg-muted); font-weight: 600; }
/* .visit-save-btn(Vue2 photos-places.scss:835-851,不在 brief 给的 :599-618 范围内——
   已单独定位回源核对)。--accent-rgb/--accent-hi 本仓不存在,改用既有三档 accent-soft
   token(文件头已登记映射关系)。 */
.visit-save-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; margin-left: 6px;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  color: var(--accent-text);
  font: inherit; font-size: 10.5px; font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}
.visit-save-btn:hover { background: var(--accent-soft-2); }
.visit-thumbs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.visit-thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; }
/* 偏离登记 15(见文件头):父格无 overflow:hidden,放大会溢出压邻格,Vue2 原状照搬。 */
.visit-thumbs img:hover { transform: scale(1.05); }
</style>

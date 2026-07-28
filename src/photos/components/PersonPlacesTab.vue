<script setup lang="ts">
// Task 12 (SP7-P5 人物): PersonPlacesTab.vue —— 人物详情页「地点」tab
// (段落标题 + 迷你世界地图 + Top5 图例 + 全部地点卡片条)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:157-183(整个 v-if="tab === 'map'" 块,
// 含 :158-162 的 .detail-section / .detail-section-title 标题壳),:446
// (PLACE_PALETTE 七色)、:537-570(groupedPlaces / coloredPoints——已挪到
// peopleView.ts 的 groupPlaces / colorPoints,逐行对应见该文件注释)移植;
// 样式段照 photos-people.scss:724-739(.detail-section / .detail-section-title /
// .sub)与 :570-645(.map-card / .legend / .place-strip / .place-chip)。
//
// 段落标题(协调者裁定,Task 12 fix,原提交曾把这层壳留白):Vue2 的
// .detail-section-title 就在 v-if="tab === 'map'" 块内,是这个 tab 自己的一部分
// (T13 的关系 tab 同理,各有自己的段落标题),不是容器负责的东西——容器只切 tab。
// 新增 i18n 键 photosPersonPlacesTitle("{name} 去过的地方")/ photosPersonPlacesSub
// (副标题),译文取自旧 zh_CN.json,已补进 zh_cn.ts / en_us.ts 段末。
//
// 纯展示组件:不碰 store、不发请求、无 emits——两个纯函数(groupPlaces/colorPoints)
// 在 computed 里跑,渲染即完成。
//
// Top5 vs 全部的区分(brief 强调的关键点,已用测试钉住):图例只列
// groups.value.slice(0, 5)(照 Vue2 :170),下方卡片条列 groups.value 全量
// (照 Vue2 :178)——两者共用同一次 groupPlaces() 结果,只是切片范围不同,
// 不在这里重新分组或重新排序。
//
// 有意偏离 Vue2(brief 明确要求,非误引入):卡片条计数用 t('photosPeoplePhotosCount',
// {n}) 短语渲染(Vue2 :181 是裸 `{{ pl.count }}`);图例的计数保持裸数字,与 Vue2
// :173 一致——两处刻意不同,brief 原文只对 place-strip 提了这条要求。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosMiniMap from './PhotosMiniMap.vue'
import { groupPlaces, colorPoints, type PersonPlace } from '../util/peopleView'

const props = defineProps<{
  places: PersonPlace[]
  personName: string
}>()

const { t } = useI18n()

// Vue2 :541/:563 的 unknownLabel 硬编码 'Unknown';纯函数不依赖 i18n(brief 铁律),
// 在这里把 t() 解析好的字符串传进去。
const unknownLabel = computed(() => t('photosPersonUnknownPlace'))
const groups = computed(() => groupPlaces(props.places, unknownLabel.value))
const legendGroups = computed(() => groups.value.slice(0, 5))
const points = computed(() => colorPoints(props.places, groups.value, unknownLabel.value))

// 照 Vue2 :165-166 共用的兜底:person.name || $t('this person')。段落标题
// (:160)与地图空态文案(:166)都要这个兜底,统一算一次,避免两处各写一遍
// 分叉。personName 为空串时用 photosPersonThisPerson,不会留下空名占位
// (比如 "{name} 去过的地方" 变成一个前导空格的 " 去过的地方")。
const displayName = computed(() => props.personName || t('photosPersonThisPerson'))
const emptyText = computed(() => t('photosPersonNoPlaces', { name: displayName.value }))

// 图例 pin 的光晕环(照 Vue2 :171 `boxShadow: '0 0 0 2px white, 0 0 6px ${pl.color}aa'`)。
// 固定白色环是数据可视化惯例的一部分:环要在任意主题底色上都能撑开任意
// PLACE_PALETTE 填充色,与主题无关——同 PhotosMiniMap.vue 的 .dot-person 描边
// 固定白色的先例(该文件 <style> 里有 theme-exception 注释)。这里写在 JS 里
// (inline :style,由 pl.color 数据驱动),color-guard 只扫 <style> 块与 .css,
// 不扫这里,但仍留此注释供人工评审对齐。
function legendPinStyle(color: string): Record<string, string> {
  return { background: color, boxShadow: `0 0 0 2px #fff, 0 0 6px ${color}aa` }
}
</script>

<template>
  <div class="detail-section">
    <div class="detail-section-title">
      {{ t('photosPersonPlacesTitle', { name: displayName }) }}
      <span class="sub">{{ t('photosPersonPlacesSub') }}</span>
    </div>
    <div class="map-card">
      <PhotosMiniMap :points="points" :empty-text="emptyText" />
      <div v-if="legendGroups.length" class="legend">
        <div class="title">{{ t('photosPersonPlacesLegend') }}</div>
        <div v-for="pl in legendGroups" :key="pl.name" class="row">
          <span class="pin" :style="legendPinStyle(pl.color)" />
          <span>{{ pl.name }}</span>
          <span class="ct">{{ pl.count }}</span>
        </div>
      </div>
    </div>
    <div class="place-strip">
      <div v-for="pl in groups" :key="pl.name" class="place-chip">
        <span class="pin" :style="{ background: pl.color }" />
        <span class="nm">{{ pl.name }}</span>
        <span class="ct">{{ t('photosPeoplePhotosCount', { n: pl.count }) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Section wrapper + title(照 photos-people.scss:724-739 .detail-section /
   .detail-section-title / .sub)。Vue2 用 --font-display/--font-sans 两个字体
   token 区分标题/副标题字重来源;New-UI 只有一个统一的 --font token(已在
   theme.css 核实),两处都用它,同 PersonAssetGrid.vue 的 .person-month-head
   .title/.sub 既有先例(同款 flex+baseline+gap 结构,同款 --fg/--fg-muted 配色)。 */
.detail-section {
  margin-top: 8px;
}
.detail-section-title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 14px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--fg);
}
.detail-section-title .sub {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-muted);
  letter-spacing: 0;
}

/* Map view (照 photos-people.scss:570-590 .map-card)。 */
.map-card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  /* 与旧 iframe 版地图卡保持一致的高度,避免切 tab 时布局跳动。 */
  height: 320px;
  position: relative;
}

/* 左上角图例浮层(照 :591-611 .legend)。 */
.legend {
  position: absolute;
  top: 14px;
  left: 14px;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
  color: var(--fg-muted);
}
.legend .title {
  font-weight: 600;
  font-size: 12.5px;
  margin-bottom: 4px;
  color: var(--fg);
}
.legend .row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--fg-muted);
}
.legend .row .pin {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  /* background/box-shadow 是逐地点数据(PLACE_PALETTE 循环色),由 :style 绑定,
     不是主题色——见脚本区 legendPinStyle 的注释。 */
}
.legend .row .ct {
  margin-left: auto;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

/* 地点卡片条(照 :612-645 .place-strip / .place-chip)。 */
.place-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.place-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  /* Vue2 :636 有 cursor:pointer + :hover 高亮,但两侧模板都没有给 .place-chip 挂
     click 处理器(卡片本身不可点)——纯视觉一致地照搬这个"看起来能点但不做事"的
     状态,不新增 emit(brief 明确本组件无 emits)。 */
  cursor: pointer;
}
.place-chip:hover {
  background: var(--chip-bg-hi);
}
.place-chip .pin {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
  /* 同上:数据色,非主题色。 */
}
.place-chip .nm {
  flex: 1;
  font-size: 12.5px;
  color: var(--fg);
}
.place-chip .ct {
  font-size: 11px;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}
</style>

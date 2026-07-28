<script setup lang="ts">
// Task 12 (SP7-P5 人物): PersonPlacesTab.vue —— 人物详情页「地点」tab
// (迷你世界地图 + Top5 图例 + 全部地点卡片条)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:163-183(map-card / legend / place-strip
// 三块内容),:446(PLACE_PALETTE 七色)、:537-570(groupedPlaces / coloredPoints——
// 已挪到 peopleView.ts 的 groupPlaces / colorPoints,逐行对应见该文件注释)移植;
// 样式段照 photos-people.scss:570-645(.map-card / .legend / .place-strip / .place-chip)。
//
// **不渲染** Vue2 :158-162 的 `.detail-section` + `.detail-section-title`
// 外壳("Places with {name}" + "Where you've photographed them, all-time")——
// 那段文案需要 person.name 拼句,对应 i18n 键(如 photosPersonPlacesTitle)尚未
// 就位,brief 给的组件结构(§"结构"小节)也只列了 map-card/place-strip 两块,不含
// 外壳。参照 T14 brief 明确接管同类的"共现头像横条"标题(照 Vue2 :108-130 整段,
// 含标题行)的先例,判断这层 section 标题由 T14 容器统一拼装,本组件只出 tab 内容。
// 已在任务报告里记为疑虑项,供协调者确认。
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

// 照 Vue2 :166:person.name || $t('this person')。
const emptyText = computed(() =>
  t('photosPersonNoPlaces', { name: props.personName || t('photosPersonThisPerson') }))

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
  <div class="person-places-tab">
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

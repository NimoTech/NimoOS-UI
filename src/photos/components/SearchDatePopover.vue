<script setup lang="ts">
// SP7-P7a-T13: SearchDatePopover.vue —— 搜索日期弹层(5 个快捷区间按钮 + 真日历,D14 两个
// 弹层基元之外的第 3 个"外壳"实现)。结构对应 Vue2 PhotosSearchView.vue:61-91(模板)、
// :755-777(setDraftDateQuick/shiftCalMonth/pickCalDay)、:790-796(togglePop 的 date 分支)。
// 样式对应 photos.scss:2658-2688(区间内每一条已逐条核对,详见任务报告「两条腿审计」)。
//
// 外壳重复登记(控制器裁定:本任务照写,不抽公共外壳组件):`.fpop` / `.fpop-title` /
// `.fpop-quick`(+:hover)/ `.btn` / `.btn-primary` 这套外壳与 T12 的 PhotosFilterPopover.vue
// 里已有一份重复,约 8 条声明(.fpop、.fpop-title、.fpop-quick、.fpop-quick:hover、.btn、
// .btn:hover、.btn-primary、.btn.btn-primary:hover)。这是 scoped SFC 下两个独立弹层的必然
// 代价——本弹层是"固定 320px + 日历",T12 是"width prop + 搜索框 + 列表",结构不同不适合
// 抽共享组件(仓库"禁无关重构"约定 + D14 只冻结了两个基元)。是否抽公共外壳留给整支终审
// triage(T14 之后会是第 4 份重复)。
// 数值来源:本文件的 .fpop/.fpop-quick/.btn 系列数值一律照抄 Vue2 photos.scss,不从 T12
// 文件抄(T12 那份为列表弹层做过 width prop 化等调整,照抄会串味——这正是 brief A1 那条
// 跨任务坑的教训:T12 判定 width:320px"恒不可达"是针对列表弹层成立,对本弹层不成立)。
//
// token 映射(与 T12/PlaceDetailPanel 等既有先例一致的通用表,不重复展开每一条):
// --text-1/2/3 → --fg/--fg-muted/--fg-faint;--surface-2/3 → --chip-bg/--chip-bg-hi;
// --line → --chip-border;--menu-bg → --popup-bg;--accent-hi(本仓不存在)→ --accent-text;
// rgba(110,91,255,0.30)(accent 30% 边框)→ --accent-soft-bd。
//
// locale 转 BCP-47(A2):T9 的 rangeLabel/calDowLabels/calMonthLabel 内部已做
// `locale.replace('_','-')`,本组件直接把 useI18n().locale.value 原样传给它们,不重复转换。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  QUICK_KEYS,
  QUICK_LABEL_KEYS,
  quickRange,
  rangeLabel,
  calCells,
  calDowLabels,
  calMonthLabel,
  type DateRange,
  type CalCell,
  type QuickKey,
} from '../util/dateRange'

const props = defineProps<{
  draft: DateRange | null
  committed: DateRange | null
}>()

const emit = defineEmits<{
  (e: 'update:draft', v: DateRange | null): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()

const { t, locale } = useI18n()

// 日历显示的年月是组件内部 state,初值由 committed 决定——照搬 Vue2 togglePop() 的 date
// 分支(:790-796):有 committed.end 则取它的年月,否则取今天。这只是挂载时的一次性初值,
// 不是持续跟随 committed 的响应式绑定——宿主(T16)每次打开弹层都会用 v-if 重新挂载本组件
// (同 T12 PhotosFilterPopover.vue 的既定手法),等价于 Vue2 每次 togglePop 时重算一次。
function initCalYearMonth(): { y: number; m: number } {
  if (props.committed && props.committed.end) {
    const [y, m] = props.committed.end.split('-')
    return { y: Number(y), m: Number(m) - 1 }
  }
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth() }
}
const init = initCalYearMonth()
const calYear = ref(init.y)
const calMonth = ref(init.m)

const dows = computed(() => calDowLabels(locale.value))
const cells = computed(() => calCells(calYear.value, calMonth.value, props.draft))
const monthLabel = computed(() => calMonthLabel(calYear.value, calMonth.value, locale.value))

// 照搬 Vue2 :81 的 class 拼接顺序(cal-cell → blank → in → start → end)。
function cellClass(c: CalCell): string {
  return ['cal-cell', c.blank ? 'blank' : '', c.in ? 'in' : '', c.start ? 'start' : '', c.end ? 'end' : '']
    .filter(Boolean)
    .join(' ')
}

// 照搬 Vue2 setDraftDateQuick(:755-759)。quickRange() 已经把入参 key 填进返回值的
// DateRange.key(T9 回改,见 dateRange.ts),不需要在这里再拼一次。
function setQuick(key: QuickKey): void {
  const rng = quickRange(key, new Date(), t(QUICK_LABEL_KEYS[key]))
  emit('update:draft', rng)
  const [y, m] = rng.end!.split('-')
  calYear.value = Number(y)
  calMonth.value = Number(m) - 1
}

// 照搬 Vue2 shiftCalMonth(:761-764)——用 `new Date(year, month+delta, 1)` 取年月,
// 天然处理跨年(12 月 +1 → 次年 1 月,1 月 -1 → 上一年 12 月),不要手动拆 if 分支重写。
function shiftMonth(delta: number): void {
  const d = new Date(calYear.value, calMonth.value + delta, 1)
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
}

// 照搬 Vue2 pickCalDay(:765-777)。
// pick 之后新建的 DateRange 不带 key 字段——自定义区间不属于任何快捷键,这是「data-on
// 用 key 比较」这条判据能成立的前提(见文件头 + 任务报告「A3」)。
function pick(c: CalCell): void {
  if (c.blank || !c.date) return
  const r = props.draft
  if (!r || !r.start || r.end) {
    // 开一段新单日区间(r 不存在 / 无 start / 已是完整区间,三种情况都重开)。
    emit('update:draft', { label: rangeLabel(c.date, c.date, locale.value), start: c.date, end: null })
  } else {
    // 补全区间;两端点排序,end < start 则交换。
    let start = r.start
    let end = c.date
    if (end < start) {
      const tmp = start
      start = end
      end = tmp
    }
    emit('update:draft', { label: rangeLabel(start, end, locale.value), start, end })
  }
}
</script>

<template>
  <div @click.stop>
    <div class="fpop">
      <div class="fpop-title">{{ t('photosSearchQuickRange') }}</div>
      <div class="fpop-row">
        <button
          v-for="k in QUICK_KEYS"
          :key="k"
          type="button"
          class="fpop-quick"
          :data-on="draft?.key === k ? 'true' : 'false'"
          @click="setQuick(k)"
        >{{ t(QUICK_LABEL_KEYS[k]) }}</button>
      </div>
      <div class="cal-head">
        <button
          type="button" class="cal-nav" :title="t('photosSearchPreviousMonth')"
          @click="shiftMonth(-1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <span class="fpop-title" style="margin: 0">{{ monthLabel }}</span>
        <button
          type="button" class="cal-nav" :title="t('photosSearchNextMonth')"
          @click="shiftMonth(1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      <div class="cal">
        <div v-for="(d, i) in dows" :key="'h' + i" class="cal-cell dow">{{ d }}</div>
        <div
          v-for="(c, i) in cells" :key="'c' + i"
          :class="cellClass(c)"
          :data-date="c.date"
          @click="pick(c)"
        >{{ c.blank ? '' : c.d }}</div>
      </div>
      <div class="fpop-foot">
        <button type="button" class="fpop-quick" @click="emit('cancel')">{{ t('photosCancel') }}</button>
        <button type="button" class="btn btn-primary" @click="emit('apply')">{{ t('photosSearchApply') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 2026-08-13 回退(机主推翻 EXIF 玻璃例外,Fix-3 item 7 追加执行——本组件此前漏了这一轮
   回退,brief 明确点名"align their chrome to parity like the FilterChip/Popover treatment"):
   .fpop/.fpop-title/.fpop-row/.fpop-quick(+:hover/[data-on])/.cal-head/.cal-nav(+:hover)/.cal/
   .cal-cell(+全部变体)/.btn/.btn-primary(+:hover 两条)这一整批 Vue2 原生 class 名字段,在
   vue2-parity/photos.scss(:2690-2726,.btn 系列走全局 `.photos-root .btn`/`.photos-root
   .btn-primary` 家族 :290-301)已有逐字对应的裸选择器,值就是 Vue2 原文本地 token
   (--surface-2/3、--text-1/2/3、--line、--accent-soft、--accent-hi 等,dark 与
   .photos-root.is-light 两套都有定义)。此前这里各自重复一份、颜色映射到本仓通用玻璃语义
   (--popup-bg/--card-border/--card-shadow-hi/--chip-bg/--fg-muted/--accent-text 等)——那些
   token 均未被 `.photos-root` 本地重定义,会落到 theme.css 的全局蓝紫玻璃值,靠 scoped
   编译出的 [data-v-xxxx] 属性把优先级顶到 parity 裸选择器之上,是这份颜色错配能"赢"的唯一
   原因。删掉这份重复,parity 的裸规则直接生效,不需要再借数据属性提权。`@keyframes pop-in`
   同理删除——parity scss 已有同名关键帧,动画名是全局命名空间,不受 scoped 影响。
   `.cal-cell.muted`(Vue2 photos.scss:2685)在 PhotosSearchView.vue 模板里零命中、没有消费
   方,parity 转录了这条死 CSS,本组件原样不重复声明,不受影响。 */

/* `.fpop-row` 的 `flex-wrap: wrap` 不是 Vue2/parity 有的属性(Vue2 photos.scss:2660 的
   `.fpop-row` 只有 `display:flex;gap:6px;margin-bottom:6px`,没有 flex-wrap)——这是
   New-UI 专属的加性修复:5 个快捷区间按钮在 320px 宽的弹层里不换行会在某些语言的按钮文案
   下溢出,回退时保留这一条(只留新增属性,其余交给 parity 的裸 `.fpop-row`)。 */
.fpop-row {
  flex-wrap: wrap;
}

.fpop-foot {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.fpop-foot .fpop-quick,
.fpop-foot .btn {
  flex: 1;
  justify-content: center;
}
</style>

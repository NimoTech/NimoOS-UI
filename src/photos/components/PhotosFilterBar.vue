<script setup lang="ts">
// SP7-P7b-T2: PhotosFilterBar.vue —— EXIF 筛选条(漏斗 + 年份/位置/相机三胶囊)。
// 逐字对应 Vue2 NimoOS-UI src/views/Photos/PhotosFilterBar.vue(312 行)。
// 胶囊本体与列表型弹层复用 P7a 建的两个基元(D14):PhotosFilterChip / PhotosFilterPopover。
//
// 偏离登记 1(数据源外注):Vue2 组件内部直接读
// `this.$store.getters['photos/displayMonths']` 取 facet 源,因为它在 Vue2 只有一个挂载点
// (时间线工具栏)。New-UI 有两个消费方且数据源不同——时间线页读 timeline store,跳库页读
// usePlaceAssets 的一次性结果——所以 facet 源改由宿主以 `photos` prop 注入。必要偏离。
//
// 偏离登记 2(D19,chipKeys):Vue2 三个胶囊恒显示。跳库页(/photos/places/:key)按 D19 只
// 显示年份+相机——回源 Vue2 PhotosTimeline.vue:167,spot 分支明确只把 years/cameras 传给
// applyExifFilters、把 places 丢掉(注释自陈「城市已框定,再套位置文本会误杀」),照搬等于
// 在独立页面上摆一个点了没反应的死胶囊。chipKeys 默认三个全开,时间线页不传即与 Vue2 一致。
//
// 偏离登记 3(F1,Vue2 缺陷):Vue2 availYears(:99-102)用
// `String(new Date(p.date).getFullYear())` 直接入 Set,遇到不可解析的 date 会塞进字面量
// "NaN";而过滤谓词那侧走 photoYear() 返回空串 ⇒ 用户能在下拉里选到一个永远匹配不上的
// NaN 选项。这里 facet 侧改调同一个 photoYear(),空串跳过。
//
// 登记 4(自动展开的外部触发方在本仓已不存在):Vue2 的 anyActive watcher 是为了承接
// 「从地点页跳过来时外部往 activeFilters.places 塞值」这条路径;New-UI 的城市跳转走独立
// 路由页(D6),时间线的 filter 不会被外部写。watcher 与 mounted 检查仍照抄——「清除全部
// 后收起、再从别处恢复筛选」这类自身路径下仍有意义,且保持行为对等。
//
// 不做 Esc 关弹层:Vue2 本组件没有 keydown 监听,1:1 不擅自加(搜索页那条 Esc 是它自己的
// 结构规格 19,不外溢到这里)。
//
// Plan B Task 5(2026-08-12,"工具栏 + FilterBar 重刻"):
// ① 弹层 max-height:Vue2 PhotosFilterBar.vue:29 内联 `max-height:260px`;共享基元
//   PhotosFilterPopover 当年默认写死 280(照搜索侧),260 这条差异被登记"交给 P7b/T16"——
//   本任务接通,新增 maxHeight prop 传 260(见 PhotosFilterPopover.vue 头部同一处登记)。
// ② .exif-filter/.exif-funnel/.exif-badge/.exif-chiprow/.exif-clear 这五个类只服务本组件
//   (已 grep 确认全仓零其它消费方),下方样式块的颜色 token 从当年 P7b 写的通用
//   app token(--fg/--chip-bg/--accent-soft-bd 等,解析到的是站点玻璃拟态配色)改回 Vue2
//   原文用的 --surface-2/--text-1/2/3/--line-strong/--accent-glow/--accent-hi 这组 token
//   名——src/photos/styles/vue2-parity/photos.scss 的 `.photos-root` 块(T3/T4 为 Plan B
//   建的、逐字对齐 Vue2 photos.scss 的本地深色变量表)重新定义了这组名字,而 P7b 写这段
//   样式块时该文件还不存在(当时的组件注释也写"--line-strong 在本仓不存在,已 grep 确认
//   零命中"——这句话在 parity scss 落地前是对的,现在不是了)。改回同名 token 后,数值随
//   .photos-root 的本地定义走,与 Vue2 逐字一致,不是新造一套配色。
//   .fchip/.fchip-wrap/.fchip-x(PhotosFilterChip.vue)与 .fpop*(PhotosFilterPopover.vue)
//   不在本次改动范围——这两个基元同时被 PhotosSearch/SmartView/Settings/日期与人物弹层等
//   六个消费方共享,统一改配色是一次跨面板的视觉决策,超出本任务"工具栏 + FilterBar 两颗
//   胶囊"的范围,登记为后续任务(见 task-5-report.md 的 concerns)。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosFilterChip from './PhotosFilterChip.vue'
import PhotosFilterPopover from './PhotosFilterPopover.vue'
import { photoYear, type FilterablePhoto } from '../util/photosFilterUtils'

export type ChipKey = 'years' | 'places' | 'cameras'
export interface ExifFilterValue {
  years: string[]
  places: string[]
  cameras: string[]
}

const props = withDefaults(defineProps<{
  filter: ExifFilterValue
  photos: FilterablePhoto[]
  chipKeys?: ChipKey[]
}>(), {
  chipKeys: () => ['years', 'places', 'cameras'],
})

const emit = defineEmits<{ (e: 'update:filter', v: ExifFilterValue): void }>()

const { t } = useI18n()

// chipKey → 该维度在 filter 上的数组键(同名)+ i18n 标签键 + 图标。
// 顺序照 Vue2 CHIPS(:74-78):年份 / 位置 / 相机。
const CHIP_DEFS: Array<{ key: ChipKey; labelKey: string; icon: 'clock' | 'map' | 'settings' }> = [
  { key: 'years', labelKey: 'photosFilterYear', icon: 'clock' },
  { key: 'places', labelKey: 'photosFilterLocation', icon: 'map' },
  { key: 'cameras', labelKey: 'photosFilterCamera', icon: 'settings' },
]

const rootRef = ref<HTMLElement | null>(null)
const openPop = ref<ChipKey | null>(null)
const draft = ref<Partial<Record<ChipKey, string[]>>>({})
let ovT: ReturnType<typeof setTimeout> | null = null

// ── facet:整个数据源里真实存在的取值 ────────────────────────────────────────
const availYears = computed(() => {
  const set = new Set<string>()
  props.photos.forEach((p) => {
    const y = photoYear(p) // F1:走同一个谓词,不可解析日期返回空串 → 不入列表
    if (y) set.add(y)
  })
  return [...set].sort().reverse() // 照 Vue2 :103,字符串序倒排 = 年份从新到旧
})

// 照 Vue2 facet()(:151-159):去重 + localeCompare 升序(带重音/中日韩名字排序才正常)。
function facet(extract: (p: FilterablePhoto) => string): string[] {
  const set = new Set<string>()
  props.photos.forEach((p) => {
    const v = extract(p)
    if (v) set.add(v)
  })
  return [...set].sort((a, b) => a.localeCompare(b))
}
const availPlaces = computed(() => facet(p => (p.place ? p.place.split(',')[0].trim() : '')))
const availCameras = computed(() => facet(p => (p.camera ? p.camera.split('·')[0].trim() : '')))

const itemsByKey = computed<Record<ChipKey, string[]>>(() => ({
  years: availYears.value,
  places: availPlaces.value,
  cameras: availCameras.value,
}))

const chips = computed(() => CHIP_DEFS
  .filter(c => props.chipKeys.includes(c.key))
  .map(c => ({ ...c, label: t(c.labelKey), items: itemsByKey.value[c.key] })))

// 角标只数「可见」维度(D19 的直接推论):不可见的维度用户既看不到也清不掉,
// 把它算进角标会让用户面对一个数不出来的数字。时间线页三个胶囊全可见,与 Vue2 等价。
const activeCount = computed(() =>
  chips.value.reduce((n, c) => n + (props.filter[c.key] || []).length, 0))
const anyActive = computed(() => activeCount.value > 0)

const emptyHint = computed(() =>
  openPop.value === 'places' ? t('photosSearchNoLocationDataYet') : t('photosSearchNothingHereYet'))

// 偏离登记 5(挂载时已带筛选值 → 首帧就该是展开态,不等一次异步更新):Vue2 在 mounted()
// 钩子里对 this.expanded 赋值,Vue2 的响应式更新同样是异步 nextTick——Vue2 模板测试若不等
// tick 本来就看不到这次赋值,只是 Vue2 项目没有对等的挂载即断言的单测。Vue3 +
// @vue/test-utils 下由 onMounted 内部改 ref 触发的重渲染是排到 microtask 才 flush,
// 若测试在 mount() 后不 await 就直接断言 class,会读到挂载前的初始值(已用一次性最小复现
// 用例验证:onMounted 里改 ref,不 await 就断言不到)。本组件要求「挂载时已有筛选值 → 立刻
// 展开」在不 await 的调用点也成立,所以 expanded 的初始值直接取 anyActive(挂载那一刻 props
// 已经就位,能同步算出),不依赖 onMounted 才去 set true——onMounted 里仍然调用 expand()
// 是为了补上 450ms 溢出定时器这条副作用(该值已是 true 时重复赋值不会引发多余渲染)。
const expanded = ref(anyActive.value)
const overflowOpen = ref(false)

// ── 展开 / 收起(照 Vue2 :160-180)────────────────────────────────────────────
function expand(): void {
  expanded.value = true
  // 宽度过渡期间让 chiprow 保持裁剪,过渡结束后再放开 overflow,
  // 否则胶囊弹层会在展开动画途中被裁掉一角。
  if (ovT) clearTimeout(ovT)
  ovT = setTimeout(() => { overflowOpen.value = true }, 450)
}
function collapse(): void {
  expanded.value = false
  overflowOpen.value = false
  openPop.value = null
  if (ovT) { clearTimeout(ovT); ovT = null }
}
function toggleExpand(): void {
  if (expanded.value) collapse()
  else expand()
}

watch(anyActive, (active) => { if (active && !expanded.value) expand() })
onMounted(() => { if (anyActive.value) expand() })

// ── 胶囊 / 弹层交互(照 Vue2 :181-217)───────────────────────────────────────
function chipActive(key: ChipKey): boolean {
  return (props.filter[key] || []).length > 0
}
function chipLabel(chip: { key: ChipKey; label: string }): string {
  const v = props.filter[chip.key] || []
  return v.length ? v.join(', ') : chip.label
}
function togglePop(key: ChipKey): void {
  if (openPop.value === key) {
    openPop.value = null
    return
  }
  openPop.value = key
  // 打开时把已提交值快照进草稿——编辑在点「提交」之前一律不生效。
  draft.value = { ...draft.value, [key]: [...(props.filter[key] || [])] }
}
function cancelPop(): void { openPop.value = null }
function applyPop(key: ChipKey): void {
  emitPatch({ [key]: [...(draft.value[key] || [])] })
  openPop.value = null
}
function clearChip(key: ChipKey): void { emitPatch({ [key]: [] }) }
function clearAll(): void {
  // 三个维度一起清(即便某些胶囊按 chipKeys 不可见)——不可见维度上残留的值同样该被
  // 「清除全部」带走,留着会变成用户看不见也清不掉的幽灵筛选。
  emitPatch({ years: [], places: [], cameras: [] })
  openPop.value = null
}
function emitPatch(patch: Partial<ExifFilterValue>): void {
  emit('update:filter', { ...props.filter, ...patch })
}

// ── 点外部关弹层 ─────────────────────────────────────────────────────────────
// Vue2(:136-142)在 mounted 里无条件挂 document 监听、处理器内 `if (!this.openPop) return`
// 早退。这里改用本仓既有惯例(PhotosSearch.vue:522-530):只在弹层开着时挂监听,关掉即摘。
// 行为等价,少一个常驻全局监听。
function onDocMousedown(e: MouseEvent): void {
  const el = rootRef.value
  if (el && !el.contains(e.target as Node)) cancelPop()
}
watch(openPop, (v) => {
  if (v !== null) document.addEventListener('mousedown', onDocMousedown)
  else document.removeEventListener('mousedown', onDocMousedown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  if (ovT) clearTimeout(ovT)
})
</script>

<template>
  <div ref="rootRef" class="exif-filter" :class="{ expanded, ov: overflowOpen }">
    <button
      type="button" class="exif-funnel" :class="{ on: expanded || anyActive }"
      :title="t('photosFilterByExif')" data-test="exif-funnel" @click="toggleExpand"
    >
      <!-- glyph 逐字符抄自 Vue2 PhotosIcon.vue name==='filter' 分支;size=15。 -->
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M3 5h18l-7 9v6l-4-2v-4z" />
      </svg>
      <span v-if="activeCount" class="exif-badge" data-test="exif-badge">{{ activeCount }}</span>
    </button>

    <div class="exif-chiprow">
      <PhotosFilterChip
        v-for="chip in chips" :key="chip.key"
        :label="chipLabel(chip)" :active="chipActive(chip.key)" :open="openPop === chip.key"
        :data-test="'exif-chip-' + chip.key"
        @toggle="togglePop(chip.key)" @clear="clearChip(chip.key)"
      >
        <template #icon>
          <!-- glyph 逐字符抄自 Vue2 PhotosIcon.vue 对应 name 分支;尺寸由基元的
               .fchip-icon :deep(svg) 焊死在 13×13,这里不写 width/height。 -->
          <svg
            v-if="chip.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <svg
            v-else-if="chip.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
          <svg
            v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-.8c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5c.7-.3 1.4-.7 2-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
          </svg>
        </template>

        <PhotosFilterPopover
          v-if="openPop === chip.key"
          :title="chip.label" :items="chip.items" :selected="draft[chip.key] || []" :width="240"
          :max-height="260"
          :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
          :empty-hint="emptyHint"
          @update:selected="(v) => (draft = { ...draft, [chip.key]: v })"
          @apply="applyPop(chip.key)" @cancel="cancelPop"
        />
      </PhotosFilterChip>

      <button
        v-if="anyActive" type="button" class="exif-clear" data-test="exif-clear-all"
        @click="clearAll"
      >{{ t('photosSearchClearAll') }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Plan B Task 5 token 改法(见上方模块注释②):不再映射到通用 app token,直接用
   Vue2 photos.scss 原文的 token 名——渲染时落在 .photos-root 之内,解析到的是
   src/photos/styles/vue2-parity/photos.scss 里逐字对齐 Vue2 的本地深色变量表
   (--surface-2/--text-1/2/3/--line-strong/--accent-soft/--accent-glow/--accent-hi),
   数值因此与 Vue2 一致,不是新配一套色。角标 `color: white` 与 Vue2
   PhotosFilterBar.vue:262 的写死值逐字一致(同 parity scss 自身 .btn-primary 的
   `color: white` 先例——parity scss 是逐字转录 Vue2 CSS 的例外区,不走站内通用
   "颜色一律 token 化"规则,这里跟随同一先例,不是本组件擅自开的口子)。 */
.exif-filter {
  display: inline-flex;
  align-items: center;
  align-self: center;
  /* 锁死在标签胶囊的高度,免得这个 flex item 把工具栏那一行撑高或错位。 */
  height: 32px;
  min-width: 0;
}
.exif-funnel {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s;
}
/* fix round 1(评审必修 1,人已裁定):Vue2 原文
   NimoOS-UI/src/views/Photos/PhotosFilterBar.vue:251 只改 color/border-color,
   背景保持 --surface-2 不动;此前这里多写了一行 `background: var(--chip-bg-hi)`,是简报
   文本本身的漂移,不是抄错——已按「界面严格 1:1」铁律删掉,不补偏离登记(这不是有意偏离,
   是订正)。 */
.exif-funnel:hover {
  color: var(--text-1);
  border-color: var(--accent-glow);
}
.exif-funnel.on {
  background: var(--accent-soft);
  border-color: var(--accent-glow);
  color: var(--accent-hi);
}
/* hover 硬约束:基类 .exif-funnel:hover 是 (0,2,0),变体 .exif-funnel.on 也是 (0,2,0)
   —— 平手,靠书写顺序苟活(本区已栽四次的形态)。变体自带 :hover,数值等于未 hover 的
   .on 态,即「已激活的漏斗在悬停时保持 accent 外观」——这正是 Vue2 里靠「.on 写在
   :hover 之后」隐含表达的语义,这里显式化。 */
.exif-funnel.on:hover {
  background: var(--accent-soft);
  border-color: var(--accent-glow);
  color: var(--accent-hi);
}
.exif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 9999px;
  background: var(--accent);
  color: white; /* theme-exception: Vue2 PhotosFilterBar.vue:262 写死同值,parity scss 自身
  .btn-primary(photos.scss:272)同一先例已被机主拍板豁免——角标叠在 .photos-root 本地紫色
  accent 上,不参与站内通用主题切换 */
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* 原地横向展开:过渡期间靠 max-width 裁剪,过渡结束由 .ov 放开 overflow,
   好让胶囊弹层能溢出容器。 */
.exif-chiprow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 0;
  margin-left: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transition: max-width 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, margin-left 0.42s;
}
.exif-filter.expanded .exif-chiprow {
  max-width: 640px;
  margin-left: 8px;
  opacity: 1;
  pointer-events: auto;
}
.exif-filter.ov .exif-chiprow { overflow: visible; }
/* .fchip-wrap 是 PhotosFilterChip 的根节点——scoped CSS 下子组件根节点同时带父组件的
   scope 属性,所以这里能直接选到它,不需要 :deep()。 */
.exif-chiprow .fchip-wrap {
  transform: translateX(-10px);
  opacity: 0;
  transition: transform 0.34s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.exif-filter.expanded .exif-chiprow .fchip-wrap { transform: none; opacity: 1; }
.exif-filter.expanded .exif-chiprow .fchip-wrap:nth-child(1) { transition-delay: 0.06s; }
.exif-filter.expanded .exif-chiprow .fchip-wrap:nth-child(2) { transition-delay: 0.13s; }
.exif-filter.expanded .exif-chiprow .fchip-wrap:nth-child(3) { transition-delay: 0.2s; }
.exif-clear {
  flex-shrink: 0;
  padding: 0 10px;
  height: 30px;
  border: none;
  background: none;
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 9999px;
  transition: color 0.2s;
}
.exif-clear:hover { color: var(--text-1); }
</style>

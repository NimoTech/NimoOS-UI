### Task 2: `PhotosFilterBar.vue` 组件 + 4 个 i18n 键

**Files:**
- Create: `src/photos/components/PhotosFilterBar.vue`
- Create: `src/photos/components/__tests__/PhotosFilterBar.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(各 +4 键)

**Interfaces:**
- Consumes: T1 的 `photoYear` / `FilterablePhoto`;P7a 冻结基元 `PhotosFilterChip.vue`(props `{ label, active, open? }`,emits `toggle`/`clear`,`#icon` 具名插槽 + 默认插槽挂弹层)与 `PhotosFilterPopover.vue`(props `{ title, items, selected, searchPlaceholder, emptyHint, width?, multiple?, labelFor? }`,emits `update:selected`/`apply`/`cancel`)。
- Produces: 默认导出组件 + `ChipKey` / `ExifFilterValue` 两个导出类型(T4/T5 要 import 类型)。

**新增 i18n 键**(文案逐字取自 Vue2 `src/assets/lang/zh_CN.json`,已核对):

| key | zh_cn | en_us |
|---|---|---|
| `photosFilterByExif` | `按 EXIF 过滤` | `Filter by EXIF` |
| `photosFilterYear` | `年份` | `Year` |
| `photosFilterLocation` | `位置` | `Location` |
| `photosFilterCamera` | `相机` | `Camera` |

**复用键(不要重复新增,已 grep 确认存在)**:`photosSearchClearAll`(清除全部 / Clear all,zh:1276)、`photosSearchSearchLabel`(搜索{label}… / Search {label}…,zh:1312)、`photosSearchNoLocationDataYet`(暂无位置数据,zh:1291)、`photosSearchNothingHereYet`(暂无内容,zh:1294)。`PhotosFilterPopover` 内部自带的 Cancel/Apply 用的是 `photosCancel` / `photosSearchApply`,本组件不管。

**插入位置**:两个 locale 文件里 `photosField*` 一族与 `photosSearch*` 一族之间没有强排序约束,但本仓约定**只追加不重排**——把 4 个键按字母序插在 `photosFieldCamera`(zh:587)之后那一段的末尾即可,两个文件插同一相对位置。

- [ ] **Step 1: 先加 i18n 键并确认 parity 绿**

在 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts` 中各加上表 4 个键。

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS(若红说明只加了一个文件)。

- [ ] **Step 2: 写失败的测试**

创建 `src/photos/components/__tests__/PhotosFilterBar.test.ts`:

```ts
// SP7-P7b-T2: PhotosFilterBar.vue —— 漏斗 + 三胶囊 EXIF 筛选条。
// 对照源:Vue2 NimoOS-UI src/views/Photos/PhotosFilterBar.vue(312 行)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosFilterBar from '../PhotosFilterBar.vue'
import barRaw from '../PhotosFilterBar.vue?raw'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const PHOTOS = [
  { date: 'May 1, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 35mm' },
  { date: 'March 2, 2022', place: 'Osaka, Japan', camera: 'Canon R6 · 50mm' },
  { date: 'July 9, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 85mm' },
  { date: 'not-a-date', place: '', camera: null },
]

const empty = () => ({ years: [] as string[], places: [] as string[], cameras: [] as string[] })

function mountBar(props: Record<string, unknown> = {}) {
  return mount(PhotosFilterBar, {
    props: { filter: empty(), photos: PHOTOS, ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

describe('结构与展开', () => {
  it('默认收起:.exif-filter 无 expanded 类,漏斗无 .on,无角标', () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-funnel').classes()).not.toContain('on')
    expect(w.find('[data-test="exif-badge"]').exists()).toBe(false)
  })

  it('点漏斗展开:加 expanded 类,450ms 后才加 ov 类(溢出放开)', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('再点漏斗收起:expanded/ov 同时撤掉,已开的弹层关闭', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('挂载时已有筛选值 → 自动展开,漏斗带 .on,角标显示总数', () => {
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-funnel').classes()).toContain('on')
    expect(w.get('[data-test="exif-badge"]').text()).toBe('2')
  })

  it('筛选值从无到有(外部写入)→ 自动展开', async () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
  })
})

describe('facet 取值', () => {
  it('年份倒序去重;F1:不可解析日期不产生 NaN 选项', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    const items = w.findAll('.fpop .nav-item').map(n => n.text())
    expect(items).toEqual(['2023', '2022'])
    expect(items).not.toContain('NaN')
  })

  it('位置取逗号前一段、相机取「·」前一段,各自去重并按 localeCompare 升序', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.findAll('.fpop .nav-item').map(n => n.text())).toEqual(['Osaka', 'Tokyo'])
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click') // 关掉
    await w.get('[data-test="exif-chip-cameras"] .fchip').trigger('click')
    expect(w.findAll('.fpop .nav-item').map(n => n.text())).toEqual(['Canon R6', 'Sony A7'])
  })
})

describe('草稿 / 提交 / 清除', () => {
  it('弹层里勾选不立刻生效,点「提交」才 emit update:filter', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    await w.get('.fpop .btn-primary').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: ['2023'], places: [], cameras: [] })
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('点「取消」丢弃草稿、关弹层、不 emit', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click')
    await w.get('.fpop .fpop-quick').trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('重开弹层时草稿从已提交值重新快照(上次取消的勾不残留)', async () => {
    const w = mountBar({ filter: { years: ['2022'], places: [], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click') // 勾上 2023
    await w.get('.fpop .fpop-quick').trigger('click') // 取消
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click') // 重开
    const actives = w.findAll('.fpop .nav-item').filter(n => n.attributes('data-active') === 'true')
    expect(actives.map(n => n.text())).toEqual(['2022'])
  })

  it('胶囊上的 × 清掉该维度;「清除全部」清三个维度并关弹层', async () => {
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip-x').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: [], places: ['Tokyo'], cameras: [] })
    await w.get('[data-test="exif-clear-all"]').trigger('click')
    expect(w.emitted('update:filter')![1][0]).toEqual({ years: [], places: [], cameras: [] })
  })

  it('胶囊标签:无值显示维度名,有值显示逗号拼接的取值', () => {
    const w = mountBar({ filter: { years: ['2023', '2022'], places: [], cameras: [] } })
    expect(w.get('[data-test="exif-chip-years"] .fchip').text()).toContain('2023, 2022')
    expect(w.get('[data-test="exif-chip-places"] .fchip').text()).toContain('位置')
  })

  it('「清除全部」只在有筛选时出现', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(false)
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(true)
  })
})

describe('弹层关闭与 chipKeys', () => {
  it('点组件外部 mousedown 关弹层;点组件内部不关', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('卸载后不再残留 document 监听(不抛错)', async () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })

  it('D19:chipKeys 只给年份+相机时,不渲染位置胶囊,角标只数可见维度', () => {
    const w = mountBar({
      chipKeys: ['years', 'cameras'],
      filter: { years: ['2023'], places: ['Tokyo'], cameras: [] },
    })
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    expect(w.find('[data-test="exif-chip-years"]').exists()).toBe(true)
    expect(w.find('[data-test="exif-chip-cameras"]').exists()).toBe(true)
    expect(w.get('[data-test="exif-badge"]').text()).toBe('1')
  })

  it('位置弹层空态用「暂无位置数据」,其余用「暂无内容」', async () => {
    const w = mountBar({ photos: [] })
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.get('.fpop-empty').text()).toBe('暂无位置数据')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.get('.fpop-empty').text()).toBe('暂无内容')
  })
})

describe('hover 特异性硬约束', () => {
  it('.exif-funnel.on 的 hover 背景不被基类 .exif-funnel:hover 顶掉', () => {
    const rules = parseCssRules(extractStyleBlock(barRaw))
    expect(winningHoverBackground(rules, ['exif-funnel', 'on'])).toBe('var(--accent-soft)')
  })
})
```

> **写测试时的坑(先看这条再动手)**:`winningHoverBackground` 的签名与用法照抄 `PhotosFilterChip.test.ts` 里已有的调用(同目录 `cssCascade.ts`)。若签名对不上,以 `cssCascade.ts` 的实际导出为准调整这一条断言,**不要改 `cssCascade.ts`**。

- [ ] **Step 3: 跑测试确认它红**

Run: `pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts`
Expected: FAIL — 无法解析 `../PhotosFilterBar.vue`。

- [ ] **Step 4: 写实现**

创建 `src/photos/components/PhotosFilterBar.vue`:

```vue
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
const expanded = ref(false)
const overflowOpen = ref(false)
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
/* token 映射(沿用 PhotosFilterChip.vue 顶部那张四档表,不重复展开):
   Vue2 --surface-2 → --chip-bg · --text-1/2/3 → --fg/--fg-muted/--fg-faint ·
   --accent-hi → --accent-text · 白色角标文字 #fff → --on-accent。
   Vue2 --line-strong 与 --accent-glow 在本仓都不存在(已 grep theme.css 确认零命中):
   前者取 --chip-border(同 PhotosFilterPopover.vue:273-281 的既有判定),后者取
   --accent-soft-bd(accent 家族里描边档,同 PhotosFilterChip.vue [data-on] 边框的映射)。 */
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
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s;
}
.exif-funnel:hover {
  background: var(--chip-bg-hi);
  color: var(--fg);
  border-color: var(--accent-soft-bd);
}
.exif-funnel.on {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--accent-text);
}
/* hover 硬约束:基类 .exif-funnel:hover 是 (0,2,0),变体 .exif-funnel.on 也是 (0,2,0)
   —— 平手,靠书写顺序苟活(本区已栽四次的形态)。变体自带 :hover,数值等于未 hover 的
   .on 态,即「已激活的漏斗在悬停时保持 accent 外观」——这正是 Vue2 里靠「.on 写在
   :hover 之后」隐含表达的语义,这里显式化。 */
.exif-funnel.on:hover {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--accent-text);
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
  color: var(--on-accent);
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
  color: var(--fg-faint);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 9999px;
  transition: color 0.2s;
}
.exif-clear:hover { color: var(--fg); }
</style>
```

- [ ] **Step 5: 跑测试确认它绿 + 类型 + 颜色门**

Run:
```bash
pnpm exec vitest run src/photos/components/__tests__/PhotosFilterBar.test.ts src/i18n/parity.test.ts src/styles/color-guard.test.ts \
  && pnpm exec vue-tsc --noEmit
```
Expected: 全 PASS;tsc exit 0。

- [ ] **Step 6: 提交**

```bash
git add src/photos/components/PhotosFilterBar.vue src/photos/components/__tests__/PhotosFilterBar.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7b-T2 PhotosFilterBar —— 漏斗+三胶囊 EXIF 筛选条(复用 D14 基元,修 F1,开 chipKeys/D19)"
```

---


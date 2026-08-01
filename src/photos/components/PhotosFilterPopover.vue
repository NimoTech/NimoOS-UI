<script setup lang="ts">
// SP7-P7a-T12: PhotosFilterPopover.vue —— 列表型筛选弹层基元(D14 两个基元之一)。
// 结构对应 Vue2 PhotosSearchView.vue:124-147 的 list popover。与 PhotosFilterBar.vue:25-63
// 逐字比对(结论详见 task-12-report.md):唯一实质差异是滚动容器 max-height——搜索侧
// 280px、FilterBar 侧 260px;以搜索侧为准,本组件写死 280(FilterBar 的 260 差异登记交给
// P7b/T16 决定要不要开 prop)。其余差异(空态文案来源两条硬编码 vs 单一来源、type 专属的
// $t(it) 转换 vs 直传、cancelPop 参数)在 New-UI 接口层已经用 emptyHint / labelFor 两个
// prop 统一抹平,不属于结构差异。
//
// props.selected 不许就地改——toggle() 一律 emit 新数组(照搬 Vue2 toggleDraftItem
// :741-747 的不可变写法,immer 式 `{ ...draft, [key]: ... }`,这里数组版是
// filter/展开字面量),测试钉住"传入数组的引用内容不被 push/splice"。
//
// search 每次弹层打开清空的等价性登记:Vue2 togglePop()(:783-793)里显式
// `this.popSearch = ''`;本组件的 search 是内部 ref,不接受 host 传入。host 通过 v-if
// 每次重新挂载本组件,组件内部 ref 天然回到初始值 ''——与 Vue2 显式清空语义等价,host 不
// 需要、也不应该自己维护 search 状态(否则会有两份 truth)。
//
// 不做 portal/Teleport、不做点外部关闭/Esc(P6a 明确裁定 + brief Step 4)——这两件事由
// 宿主(T16)在容器 ref 层面统一处理;本组件只在根节点 @click.stop 防止弹层内部点击冒泡到
// 宿主的"点外部判定"逻辑里(结构参照 Vue2 `<div v-if="..." @click.stop>` 外层 + `.fpop`
// 内层两级)。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    title: string
    items: string[]
    selected: string[]
    searchPlaceholder: string
    emptyHint: string
    width?: number
    multiple?: boolean
    labelFor?: (item: string) => string
  }>(),
  {
    width: 260,
    multiple: true,
  },
)

const emit = defineEmits<{
  (e: 'update:selected', v: string[]): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const search = ref('')

// 照搬 Vue2 filteredPopItems(:778-782):search 为空 → 原样返回 items;否则大小写不敏感
// 的包含匹配。不 trim——Vue2 原样没有 trim,不擅自加(那是行为变更,不是移植)。
const filtered = computed(() => {
  if (!search.value) return props.items
  const q = search.value.toLowerCase()
  return props.items.filter((i) => i.toLowerCase().includes(q))
})

function isSel(it: string): boolean {
  return props.selected.includes(it)
}

// 照搬 Vue2 toggleDraftItem(:741-747)的语义,用统一的 selected: string[] 表达单选/多选:
// multiple → 数组增删,返回新数组(不原地改 props.selected);!multiple → 已选置空数组、
// 未选置单元素数组(对应 Vue2 单值分支 `v === it ? null : it` 的 null/it 二态,这里用
// []/[it] 表达同一语义,以便宿主统一按数组消费)。
function toggle(it: string): void {
  if (props.multiple) {
    const next = isSel(it) ? props.selected.filter((x) => x !== it) : [...props.selected, it]
    emit('update:selected', next)
  } else {
    emit('update:selected', isSel(it) ? [] : [it])
  }
}
</script>

<template>
  <div @click.stop>
    <div class="fpop" :style="{ width: `${width}px` }">
      <div class="fpop-title">{{ title }}</div>
      <input v-model="search" class="fpop-search" :placeholder="searchPlaceholder">
      <div class="fpop-list">
        <div
          v-for="it in filtered" :key="it" class="nav-item"
          :data-active="isSel(it) ? 'true' : 'false'"
          @click="toggle(it)"
        >
          <span class="nav-icon">
            <svg
              v-if="isSel(it)" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-text)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <span>{{ labelFor ? labelFor(it) : it }}</span>
        </div>
        <div v-if="filtered.length === 0" class="fpop-empty">{{ emptyHint }}</div>
      </div>
      <div class="fpop-foot">
        <button type="button" class="fpop-quick" @click="emit('cancel')">{{ t('photosCancel') }}</button>
        <button type="button" class="btn btn-primary" @click="emit('apply')">{{ t('photosSearchApply') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* token 映射(同 PhotosFilterChip.vue 顶部注释的四档表 + chip-bg/chip-border 家族,不
   重复展开)。弹层自身底色/边框/投影照本仓"触发按钮 + 绝对定位下拉面板"这一类组件的既定
   惯例——--popup-bg(不透明底)+ --card-border + --card-shadow-hi,先例见
   ClusterActionDialog.vue:272-280(.cad-panel)、AlbumPickerDialog.vue、
   PlacesFilterMenu.vue(.map-filter-pop,该文件里有一段完整的偏离登记,结论与本处一致:
   Vue2 用 --menu-bg + backdrop-filter 模糊 + 纯 box-shadow,本仓这类"锚定在页面内容之上的
   不透明面板"统一走 --popup-bg/--card-shadow-hi 这一组,不复刻模糊——popup-bg 已经是
   (近)不透明,不需要靠模糊保证可读性,backdrop-filter 因此省略,不是漏移植)。 */
.fpop {
  position: absolute;
  top: 36px;
  left: 0;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: var(--card-shadow-hi);
  padding: 14px;
  z-index: 10;
  animation: pop-in 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: default;
  text-align: left;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
}

.fpop-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--fg-faint);
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.fpop-search {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  margin-bottom: 10px;
}
.fpop-search:focus {
  outline: 0;
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* Vue2 两侧内联 style 里的 max-height 不一致(搜索侧 280px / FilterBar 侧 260px,见上方
   模块注释的逐字比对结论)——以搜索侧为准,取 280。 */
.fpop-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--fg-muted);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  position: relative;
}
.nav-item:hover {
  background: var(--chip-bg-hi);
  color: var(--fg);
}
.nav-item[data-active='true'] {
  background: var(--accent-soft);
  color: var(--fg);
}
/* hover 硬约束(B4 补的第三处,brief 原文只点名了 .fchip 与 .btn-primary,漏了这条):
   .nav-item[data-active="true"] 未 hover 时与 .nav-item:hover 同为 (0,2,0),scoped SFC 里
   正是"优先级相等靠源码顺序苟活"的第二种危险形态。变体自带 :hover(值=未 hover 时的既有
   态,即选中态在 hover 下保持——这是显式化 Vue2 里"active 规则写在 hover 规则之后、
   tie 靠源码顺序赢"这条隐含语义,不再依赖顺序)。 */
.nav-item[data-active='true']:hover {
  background: var(--accent-soft);
  color: var(--fg);
}
.nav-item[data-active='true'] .nav-icon {
  color: var(--accent-text);
}
.nav-icon {
  color: var(--fg-faint);
  flex: none;
  display: flex;
  width: 16px;
  justify-content: center;
}

.fpop-empty {
  padding: 18px 8px;
  text-align: center;
  color: var(--fg-faint);
  font-size: 12px;
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

.fpop-quick {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-muted);
  cursor: pointer;
}
/* 本组件的 Cancel 按钮不带 data-on(那是 T13 日期弹层的快捷区间按钮用的)——brief Step 3
   明确划界:本任务只保证基类 hover 存在,[data-on] 变体的 hover 处理留给 T13。 */
.fpop-quick:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
  border-color: var(--accent-soft-bd);
}

.btn {
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}
/* Vue2 .btn:hover 还带 border-color: var(--line-strong)——本仓没有这个更强调的线条
   token(已 grep 确认 theme.css 无 --line-strong),且现有 --chip-border 与之数值级已经
   很接近,直接省略这一属性、只变背景,视觉差异可忽略不计(登记为已知的小幅简化,不是
   漏移植)。 */
.btn:hover {
  background: var(--chip-bg-hi);
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
/* hover 硬约束(本任务受此约束的三处之一):.btn:hover 是 (0,2,0),会压过单类 .btn-primary
   (0,1,0),hover 时把 accent 实底换成 --chip-bg-hi、文字仍是 --on-accent(白/深藏青)→
   按钮和文字一起糊掉。变体自带 :hover 把 accent 实底盖回来,同 ClusterActionDialog.vue:
   331-332(.cad-btn-primary:hover)/MergeReviewDialog.vue:269 的既有正确写法——
   background 与 filter 分两条声明,避免被禁用态污染(本组件没有禁用态,但沿用同一写法
   保持一致)。 */
.btn.btn-primary:hover {
  background: var(--accent);
  filter: brightness(1.08);
}
</style>

<script setup lang="ts">
// SP7-P7a-T12: PhotosFilterPopover.vue —— 列表型筛选弹层基元(D14 两个基元之一)。
// 结构对应 Vue2 PhotosSearchView.vue:124-147 的 list popover。与 PhotosFilterBar.vue:25-63
// 逐字比对(完整结论详见 task-12-report.md,fix round 1 · M9 已改正措辞——此前写"唯一
// 实质差异",不准确):真实数值差异有两处——① 滚动容器 max-height:搜索侧 280px、
// FilterBar 侧 260px,以搜索侧为准,本组件写死 280(260 的差异登记交给 P7b/T16 决定要不
// 要开 prop);② `.fpop` 内联宽度:搜索侧 260、FilterBar 侧 240——这一处已经由本组件的
// `width` prop 吸收(brief 接口段本就给了这两个数),不构成功能差异,只是不该被"唯一"
// 这个词盖过去。其余表面不同(空态文案来源两条硬编码 vs 单一来源、type 专属的 $t(it)
// 转换 vs 直传、cancelPop 参数)在 New-UI 接口层已经用 emptyHint / labelFor 两个 prop
// 统一抹平,不属于结构差异。
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
//
// Plan B Task 5(2026-08-12):当年这里的 max-height 差异(搜索侧 280 / FilterBar 侧 260,
// 见上方模块注释①)被登记成"交给 P7b/T16 决定要不要开 prop"、一直没有接通,组件一直写死
// 280。这里接通——新增 maxHeight prop(默认 280,不影响既有消费方的既有行为),照抄 width
// prop 已有的"inline style 覆写"模式(:style 而不是写死的 CSS 声明),FilterBar 侧显式传
// 260 命中 Vue2 数值。
//
// 机主验收回退(2026-08-13,推翻 Task 5 机主拍板的"第四处视觉例外"——EXIF 胶囊/弹层维持
// New-UI 玻璃质感):玻璃在亮色主题下不可见,裁决是撤回玻璃、回退 Vue2 原始不透明面板样式
// ——纯样式改动,组件保持 Vue3 代码不变。下方样式块因此拆成两半:
// ①`.fpop`/`.fpop-title`/`.fpop-search`(+:focus)/`.fpop-quick`(+:hover)/`.btn`/
// `.btn-primary`(+:hover)—— vue2-parity/photos.scss 对这些 class 名字段本就有逐字对应的
// 裸选择器(:2662-2704,以及 `.btn`/`.btn-primary` 走全局 `.photos-root .btn` 家族
// :262-273),这半批整段删除,交给 parity/全局规则接管。
// ②`.fpop-list`/`.fpop-item`(+:hover/[data-active]/子级图标)/`.fpop-item-icon`/
// `.fpop-empty`/`.fpop-foot`(+组合选择器)—— parity scss 里没有这几个 class(已 grep
// 确认 `.fpop-item`/`.fpop-list`/`.fpop-empty`/`.fpop-foot` 全文件零命中):Vue2 原始列表
// 弹层(PhotosSearchView.vue:129-140)这部分是行内 style + `.nav-item`/`.nav-icon`
// 两个别处复用的类,并没有抽出 `.fpop-item` 这一级专属 class——是 New-UI 当年为复用而
// 自建的抽象,parity 天然不覆盖,继续留在这里,只是把颜色 token 从本仓通用玻璃语义
// (--fg-muted/--fg/--fg-faint/--chip-bg-hi/--accent-text)改回 Vue2 photos.scss 原文
// 对应位置实际使用的 --text-2/--text-1/--text-3/--surface-3/--accent-hi(数值随
// .photos-root 本地定义走,dark/is-light 两套都有)。
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
    maxHeight?: number
    multiple?: boolean
    labelFor?: (item: string) => string
  }>(),
  {
    width: 260,
    maxHeight: 280,
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
      <div class="fpop-list" :style="{ maxHeight: `${maxHeight}px` }">
        <div
          v-for="it in filtered" :key="it" class="fpop-item"
          :data-active="isSel(it) ? 'true' : 'false'"
          @click="toggle(it)"
        >
          <span class="fpop-item-icon">
            <svg
              v-if="isSel(it)" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-hi)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
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
/* 2026-08-13 回退(见上方 script 模块注释):.fpop/.fpop-title/.fpop-search(+:focus)/
   .fpop-quick(+:hover)/.btn/.btn-primary(+:hover) 这一批 Vue2 原生 class 名字段,在
   vue2-parity/photos.scss 里已有逐字对应的规则——.fpop 系列在 :2662-2704,.btn 系列走
   全局 `.photos-root .btn`/`.photos-root .btn-primary`(+:hover)家族(:262-273,该家族
   app-wide 生效,覆盖所有挂在 .photos-root 下的按钮,不需要本组件自带一份)。删除这半批
   scoped 重复,交给 parity/全局规则接管,不再靠 scoped 编译出的 [data-v-xxxx] 属性抢
   优先级。@keyframes pop-in 同理删除——parity scss 已有同名关键帧(:881),动画名是
   全局命名空间,不受 scoped 影响。 */

/* max-height 由 maxHeight prop 驱动的行内 style 给出(见上方模块注释,Plan B Task 5 接通
   了当年 P7a 登记的 280/260 差异),这里只留结构性声明。parity scss 没有 .fpop-list 这个
   class(Vue2 原文这里是行内 style,没有抽类——见下方 .fpop-item 系列的同一登记),
   New-UI 专属,继续留在这里。 */
.fpop-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

/* .fpop-item(+:hover/[data-active]/子级图标)与 .fpop-item-icon:parity scss 全文件零
   命中(已 grep 确认)——Vue2 原始列表弹层(PhotosSearchView.vue:129-137)这一级是
   `.nav-item`/`.nav-icon`(别处复用的通用类)+ 行内 style,没有抽出 `.fpop-item` 这个
   专属 class;是 New-UI 当年为可复用组件自建的抽象,parity 天然不覆盖。结构/尺寸原样
   保留,只把颜色 token 从本仓通用玻璃语义改回 Vue2 photos.scss `.nav-item`/`.nav-icon`
   对应位置(:171-172/1192 一带)实际使用的值:--fg-muted→--text-2、--fg→--text-1、
   --fg-faint→--text-3、--chip-bg-hi→--surface-3、--accent-text→--accent-hi(--accent-soft
   本就是 .photos-root 本地 token,数值已经是 Vue2 原文,不必改名)。 */
.fpop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  position: relative;
}
.fpop-item:hover {
  background: var(--surface-3);
  color: var(--text-1);
}
.fpop-item[data-active='true'] {
  background: var(--accent-soft);
  color: var(--text-1);
}
/* hover 硬约束(B4 补的第三处,brief 原文只点名了 .fchip 与 .btn-primary,漏了这条):
   .fpop-item[data-active="true"] 未 hover 时与 .fpop-item:hover 同为 (0,2,0),scoped SFC 里
   正是"优先级相等靠源码顺序苟活"的第二种危险形态。变体自带 :hover(值=未 hover 时的既有
   态,即选中态在 hover 下保持——这是显式化 Vue2 里"active 规则写在 hover 规则之后、
   tie 靠源码顺序赢"这条隐含语义,不再依赖顺序)。这条 hover-lock 逻辑与颜色映射无关,
   2026-08-13 回退未改动其结构,只跟随上面同一次 token 改名。 */
.fpop-item[data-active='true']:hover {
  background: var(--accent-soft);
  color: var(--text-1);
}
.fpop-item[data-active='true'] .fpop-item-icon {
  color: var(--accent-hi);
}
.fpop-item-icon {
  color: var(--text-3);
  flex: none;
  display: flex;
  width: 16px;
  justify-content: center;
}

/* .fpop-empty/.fpop-foot(+组合选择器)同上一条登记——parity 里也没有这两个 class(Vue2
   原文是行内 style,:138/:142),继续留在这里,只改 .fpop-empty 的文字色 token。 */
.fpop-empty {
  padding: 18px 8px;
  text-align: center;
  color: var(--text-3);
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
</style>

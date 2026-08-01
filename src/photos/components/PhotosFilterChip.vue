<script setup lang="ts">
// SP7-P7a-T12: PhotosFilterChip.vue —— 筛选胶囊基元(D14 两个基元之一,T13/T14/T16/P7b 消费)。
// 逐字对应 Vue2 PhotosSearchView.vue:51-59(与 PhotosFilterBar.vue:16-24 逐字比对确认相同,
// 唯二差别①处理器名 clearFilter/clearChip ②组件标签大小写 photos-icon/PhotosIcon,均不
// 影响本仓落地;完整比对结论见 task-12-report.md)。结构:.fchip-wrap(position:relative,
// 弹层定位上下文,与默认插槽挂的弹层是兄弟节点、不是父子——弹层的点击不会经过 .fchip 的
// click 处理器)→ .fchip(:data-on,@click → toggle)内含图标插槽 + label + chevD 图标 +
// (active 时)清除叉 → 之后默认插槽挂弹层。
//
// 偏离登记 1(B7 裁定,接口相对 brief 的偏离):brief 原接口是 `{ icon: string }`,喂给
// 共享 PhotosIcon 组件的 glyph name。本仓没有 PhotosIcon.vue(已 grep 确认
// `find src -name "PhotosIcon.vue"` 零命中,本相册区既定做法是每个组件内联 <svg>,先例
// SmartViewCard.vue:76-88),字符串 name 在本仓无处消费——若在本基元里写死 name→svg 映射表,
// 等于重建一份迷你 PhotosIcon,且 T13/T14/T16/P7b 会不断加新 glyph。裁定:把 icon 从
// prop 改成具名插槽 #icon,由宿主自己内联对应的 <svg>。chevD 与 x 这两个"chip 固定结构"
// 的 glyph(不随宿主变化)仍由本组件自己内联,不进插槽。
//
// 偏离登记 2(glyph 数值 1:1 复刻):下方 chevD `d="m6 9 6 6 6-6"`、x
// `d="m6 6 12 12M18 6 6 18"` 逐字符抄自 Vue2 NimoOS-UI
// src/views/Photos/PhotosIcon.vue 对应 name 分支(P6b 终审抓过 4 处 glyph 漏抄/错抄,三道
// 门全测不出),测试对渲染出的 <path d> 做精确断言钉住。
//
// 偏离登记 3(token 映射,控制器裁定 B2):chevD 颜色 Vue2 原值是 var(--text-3)
// (PhotosSearchView.vue:55),不是 brief 写的 --fg-subtle(那是 text-4)。本期已确立的
// 四档映射(SmartViewCreateDialog.vue:43-45)text-1→--fg / text-2→--fg-muted /
// text-3→--fg-faint / text-4→--fg-subtle,这里用 --fg-faint。
// (ClusterActionDialog.vue:368 把 text-3 映射成 --fg-muted 是 P6b 既有代码,与本期表不
// 一致,但那是既有代码不许动,也不作为本任务依据——本任务以 T5 的表为准。)
//
// open prop:Vue2 没有对应概念(chip 的视觉态只有 data-on,没有"弹层是否展开"这个独立
// 维度)。brief 冻结的接口里带了这个可选 prop,这里原样接住并转发成 .fchip 的 data-open
// 属性,不附加任何默认样式——具体消费(要不要挂 CSS 钩子)留给 T13/T14/T16,避免臆造
// Vue2 不存在的视觉效果。
defineProps<{
  label: string
  active: boolean
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="fchip-wrap">
    <div class="fchip" :data-on="active" :data-open="open ?? false" @click="emit('toggle')">
      <span class="fchip-icon"><slot name="icon" /></span>
      <span>{{ label }}</span>
      <svg
        class="fchip-chevd" width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="var(--fg-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <button v-if="active" type="button" class="fchip-x" @click.stop="emit('clear')">
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* token 映射:Vue2 --surface-2/--surface-3(实底胶囊底色/hover 底色)→ 本仓既有
   --chip-bg/--chip-bg-hi(同 ClusterActionDialog.vue/PhotosToolbar.vue/AlbumPickerDialog.vue
   等既有先例的通用映射);--line → --chip-border;--text-1/2/3 → --fg/--fg-muted/--fg-faint
   (上方偏离登记 3 的四档表);--accent-hi(不存在,已 grep 确认)→ --accent-text(同
   MergeReviewDialog.vue:249-252/PersonHero.vue:488-491 等既有先例);Vue2 的边框是一个
   写死的 accent 紫色、透明度三成(不是 var(--accent-rgb) 写法,但同一色调同一透明度量级)
   → 既有三档 accent 家族里最接近三成透明度的 --accent-soft-bd(dark 3.6 成 / light 3 成)。 */
.fchip-wrap {
  position: relative;
  display: inline-flex;
}
.fchip {
  height: 30px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-muted);
  font-size: 12.5px;
  position: relative;
  cursor: pointer;
}
.fchip:hover {
  background: var(--chip-bg-hi);
  color: var(--fg);
}
.fchip[data-on='true'] {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--fg);
}
/* hover 硬约束(本任务受此约束的三处之一):基类 .fchip:hover 是 (0,2,0),变体
   .fchip[data-on="true"] 未 hover 时只有 (0,2,0)(class + 属性选择器),二者相等 ⇒ 会靠
   书写顺序苟活(P6a 四次事故的第二种形态)。T7 已修好 cssCascade.ts 的 classSpecificity——
   属性选择器现在计入优先级,所以给变体自带 :hover 后是 (0,3,0),稳赢基类,不必再改成伴生
   类。数值原样复刻未 hover 时的 [data-on] 态,即"选中态在鼠标悬停时保持不变"。 */
.fchip[data-on='true']:hover {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--fg);
}
.fchip[data-on='true'] .fchip-icon {
  color: var(--accent-text);
}
.fchip-icon {
  color: var(--fg-faint);
  display: flex;
}
.fchip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-left: 2px;
  margin-right: -4px;
  color: var(--fg-faint);
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
/* Vue2 用一个跟随文字色、透明度一成的淡叠层做透明背景上的 hover 底(基于 Vue2 自己的
   --ink 文字色 token 取一成透明度)——本仓没有 --ink 这个 RGB 三元组 token,代以语义
   等价、两套主题都有定义的 --hover(同 PersonRelationsTab.vue:218 .rel-row:hover 的
   既有先例)。 */
.fchip-x:hover {
  background: var(--hover);
  color: var(--fg);
}
</style>

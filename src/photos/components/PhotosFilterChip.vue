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
// 偏离登记 3(token 映射,控制器裁定 B2,已被 2026-08-13 回退取代):chevD 颜色 Vue2
// 原值是 var(--text-3)(PhotosSearchView.vue:55)。T5 当时把 New-UI 四档通用 token 映射
// (text-3→--fg-faint)套在这上面,是"玻璃质感"例外期间的产物。2026-08-13 回退后本组件
// 不再走通用四档映射——.photos-root 本地就定义着 --text-3(parity scss :23-26/浅色版
// :83-86),chevD 直接写 var(--text-3),与 Vue2 逐字一致,不需要再经一层映射表转译。
//
// open prop:Vue2 没有对应概念(chip 的视觉态只有 data-on,没有"弹层是否展开"这个独立
// 维度)。brief 冻结的接口里带了这个可选 prop,这里原样接住;具体消费(要不要挂 CSS 钩子)
// 留给 T13/T14/T16,避免臆造 Vue2 不存在的视觉效果。
// fix round 1 · M4(评审 Important 同批发现):data-open 只在 open === true 时渲染到
// DOM(:data-open="open ? 'true' : undefined"),不恒渲染——Vue2 的 .fchip 上根本没有
// 这个属性,默认态(open 未传或为 false)时 DOM 应与 Vue2 逐字一致,不能凭空多一个
// data-open="false"。语义(要不要在其上挂样式)由 T13 定,当前无 CSS 消费。
//
// 机主验收回退(2026-08-13,推翻 Task 5 当时机主拍板的"第四处视觉例外"——EXIF 胶囊/
// 弹层维持 New-UI 玻璃质感):玻璃质感在亮色主题下不可见(玻璃靠深色底叠加透明层才有
// 辨识度,parity token 表虽然在 .photos-root.is-light 下给了完整浅色取值,但玻璃本身这
// 一层视觉语言在浅背景上直接消失)。这不是"亮色下玻璃出 bug 需要修",裁决是反过来
// 整个撤回玻璃、回退到 Vue2 原始扁平胶囊样式——纯样式改动,组件保持 Vue3 代码不变。
// 下方样式块因此整块收缩:.fchip/.fchip-wrap/.fchip-icon/.fchip-x 等 Vue2 原有
// class 名字段(parity scss :2614-2645 逐字有对应裸选择器)全部从这里删除,交给
// src/photos/styles/vue2-parity/photos.scss 的裸规则接管——那份文件是 Vue2 CSS 的逐字
// 转录,组件不必再自带一份颜色重复的 scoped 版本。留在这里的只剩 parity 确实不覆盖的
// New-UI 专属结构规则(见下方 .fchip-icon :deep(svg) 的独立注释)。
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
    <div class="fchip" :data-on="active" :data-open="open ? 'true' : undefined" @click="emit('toggle')">
      <span class="fchip-icon"><slot name="icon" /></span>
      <span>{{ label }}</span>
      <svg
        class="fchip-chevd" width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
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
/* 2026-08-13 回退:.fchip-wrap/.fchip(+:hover/[data-on]/.fchip-icon)/.fchip-x(+:hover)
   这一整批 Vue2 原生 class 名字段,在 vue2-parity/photos.scss:2614-2645 已经有逐字对应的
   裸选择器(.fchip-wrap/.fchip/.fchip:hover/.fchip[data-on="true"]/
   .fchip[data-on="true"] .fchip-icon/.fchip-icon/.fchip-x/.fchip-x:hover),值就是 Vue2
   原文的 --surface-2/--surface-3/--line/--text-1/2/3/--accent-hi 等本地 token(dark 与
   .photos-root.is-light 两套都有定义)。此前这里各自重复一份、颜色映射到本仓通用玻璃
   token(--chip-bg/--fg-muted/--accent-text 等),靠 scoped 编译出的 [data-v-xxxx] 属性
   把优先级顶到 parity 裸选择器之上,是玻璃质感能"赢"的唯一原因——删掉这份重复,parity
   的裸规则直接生效,不需要再借数据属性提权。
   .fchip-x 上原有的 border:0/background:transparent/cursor:pointer 同样删除,不是漏移植:
   Vue2 photos.scss:92(parity 转录在 :104)本就有 `.photos-root button { background:
   transparent; border:0; color:inherit; cursor:pointer; }` 全局重置,.fchip-x 是
   `<button>` 且本组件只会挂在 .photos-root 之内(a822ef1d 起全体 photos 视图皆然),这条
   重置天然覆盖,重复写等于两份真相。真实指标:该重置的 `color: inherit` specificity
   (0,1,1) 高于裸 `.fchip-x` 的 (0,1,0),所以 .fchip-x 非 hover 态文字色其实是从 .fchip
   继承而来、并不真的等于 --text-3——这与真实 Vue2(同一份 CSS)的渲染结果完全一致,是
   如实复刻而非本仓引入的新缺陷,不属于"修 bug",不额外提权去覆盖。仅 `padding: 0`
   予以保留——没有任何全局重置会清空 <button> 的 UA 默认内边距,少了它 16×16 的圆形
   叉号会被撑大,这是 parity 真正没覆盖到的结构性质。 */
.fchip-x {
  padding: 0;
}
/* fix round 1 · M3(评审并入,牵动 T13/T14/T16/P7b 四个下游):Vue2
   PhotosSearchView.vue:53 用 <photos-icon :name="chip.icon" :size="13"/>,即 svg
   width/height 各 13px。本组件把 icon 从字符串 prop 换成 #icon 具名插槽后,这条尺寸
   契约不能只靠报告里一句话交代——用 :deep(svg) 把宿主传入的 svg 焊死在 13×13,不管
   宿主内联的 svg 自己写了多大尺寸,渲染出来都会被这条规则收敛,不依赖下游任务自觉记住
   13 这个数字。parity scss 没有这条规则(Vue2 原文走 :size prop 而不是插槽 + CSS 焊死),
   New-UI 专属,保留。 */
.fchip-icon :deep(svg) {
  width: 13px;
  height: 13px;
}
</style>

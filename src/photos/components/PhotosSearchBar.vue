<script setup lang="ts">
// SP7-P7a-T16: PhotosSearchBar.vue —— 搜索框(D13)。
// 结构对应 Vue2 PhotosTopbar.vue:14-24(模板,`.search` 圆角输入框容器)+ :52-70
// (query prop 回流 watch + submitSearch/onKbd)。样式对应 photos.scss:226-246。
//
// 与 Vue2 PhotosTopbar.vue 的差异(结构规格 5,登记不建):Vue2 的 topbar 还有一个
// `searchMode` 态下的返回键(`:6-8`,emit('exit-search'))。New-UI 由路由承担"返回"
// 语义(`/photos/search` → 浏览器后退 / 侧栏切换),本组件不做返回键,也不接
// `lightboxOpen` 之类的抑制 prop——这些概念在路由化后不再需要。Produces 接口骨架里
// 列的 `(e: 'exit'): void` 因此不在这里实现(结构规格 5 明确"登记不建"覆盖了接口骨架
// 那行,以结构规格为准)。
//
// 空串也 emit(结构规格 3):回源核对发现 brief 引用的 Vue2 `PhotosTopbar.vue:66-69`
// (`submitSearch`)实际上是 `if (!q) return`(空串不 emit)——与 brief 描述不符,这是
// 本任务查实的一处 brief 事实错误(报告里登记)。空串确实会 emit 的真实先例是
// `PhotosTimeline.vue`的 `@exit-search="onSearch('')"` 这条独立wiring(退出搜索按钮
// 直接调 `onSearch('')`,不经过 `submitSearch` 的空串守卫)。本组件面向的是路由化的
// 独立搜索页(§7e-3),没有"返回键"这个概念,Enter 键本身就要承担"提交词/清空退出"
// 两种语义,因此照 brief 结构规格 3 与测试用例的明确要求实现"空串也 emit"——由宿主
// (PhotosSearch.vue/Photos.vue)决定空串提交时导航去哪。
//
// value prop 回流(结构规格 2,照搬 PhotosTopbar.vue:57 的 `!==` 守卫):不在用户正在
// 输入时用外部 value 打断——只有当 value 真的变化时才覆盖本地 text。
//
// fix round 1 · I3(评审查实的真缺陷):placeholder 第一版误用了
// `photosSearchSearchLibrary`(="搜索你的资料库")——那句在 Vue2 里其实是**预搜索态的
// `<h2>`**(`PhotosSearchView.vue:6`),不是输入框占位符。Vue2 `PhotosTopbar.vue:19` 的
// 真实 placeholder 是另一句长文案("Search photos, people, places, or describe in a
// sentence…"),i18n 表里原来没有对应键——已按文案回源铁律,从
// `NimoOS-UI/src/assets/lang/zh_CN.json:2405` / `en_US.json:2324` 查出原文对应译文,
// 新增 `photosSearchSearchBarPlaceholder` 键(追加在两个 locale 文件末尾,未重排)。
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    value?: string
    autofocus?: boolean
  }>(),
  { value: '', autofocus: false },
)

const emit = defineEmits<{
  (e: 'submit', q: string): void
}>()

const { t } = useI18n()

const text = ref(props.value || '')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.value,
  (v) => {
    if (v !== text.value) text.value = v || ''
  },
)

function submit(): void {
  // 照搬 Vue2 submitSearch 的 trim 口径;结构规格 3:空串也 emit(见文件头注释)。
  emit('submit', text.value.trim())
}

onMounted(() => {
  if (props.autofocus) inputRef.value?.focus()
})
</script>

<template>
  <div class="photos-search-bar">
    <div class="search">
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        ref="inputRef" v-model="text" data-test="search-bar-input"
        :placeholder="t('photosSearchSearchBarPlaceholder')" @keydown.enter="submit"
      >
    </div>
  </div>
</template>

<style scoped>
/* Vue2 PhotosTopbar.vue photos.scss:226-246(`.search`/`.search input`/`.search .kbd`)。
   本组件不建 `.kbd`(↵ 提示徽标)——结构规格 1 明确只要求"圆角输入框容器含 search 图标
   14px + <input>",两处都没有提这个提示徽标,登记为刻意的范围收窄(不是漏做)。
   高度与 Vue2 两个变体(topbar 里 32px / 搜索页 `.search-active` 40px)都不同——本组件
   在两处(Photos.vue 时间线顶部 / PhotosSearch.vue 搜索页顶部)复用同一份外观,不做
   "普通/放大"两态,取两者之间的 34px 作为统一值(登记:结构规格没有给"变体" prop,
   这是本任务自己的简化决定)。
   fix round 1 · M13(评审并入):`.photos-search-bar` 外层容器本身**无 Vue2 对应**——
   Vue2 的搜索框是 `PhotosTopbar.vue` 内联在一个共享顶栏里的一个 flex 子项,没有独立
   组件、也没有专属的外层 padding;New-UI 把它拆成独立组件复用在两个页面顶部,需要一层
   自己的外壳容器来控制页面内的留白——`4px 4px 14px` 是本任务自定的量(不是照抄 Vue2,
   因为 Vue2 根本没有这个容器),已在此登记而非静默新增。 */
.photos-search-bar { display: flex; justify-content: center; padding: 4px 4px 14px; }
.search {
  flex: 1;
  max-width: 520px;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  /* fix round 1 · M13:改回 Vue2 字面值(photos.scss:229 是 `padding: 0 12px`,第一版
     写成 14px 是抄错,不是刻意偏离——照 Vue2 值改回。 */
  padding: 0 12px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-faint);
}
.search:focus-within {
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.search svg { flex: none; color: var(--fg-faint); }
.search input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--fg);
  font: inherit;
}
.search input::placeholder { color: var(--fg-faint); }
</style>

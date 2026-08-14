<script setup lang="ts">
// Task 4(顶栏重刻,D13:搜索框入顶栏;副行恒全库计数)。
// 结构对应 Vue2 NimoOS-UI src/views/Photos/PhotosTopbar.vue:1-34 —— `.topbar`(52px,
// border-bottom)→ 折叠 icon-btn(panelLeft 图标)→ 标题块(`.topbar-title`+`.topbar-sub`)
// → flex:1 居中 `.search`(放大镜图标 + input + `⏎` .kbd 提示)。样式对应
// photos.scss:204-264(`.topbar`/`.topbar-title`/`.topbar-sub`/`.icon-btn`/`.search`/
// `.search .kbd`)。
//
// B 期范围收窄(brief 明示,登记不建):
// - Vue2 `searchMode` 态下的返回键(:6-8,emit('exit-search'))不做 —— 这个仓子没有独立的
//   "搜索模式"覆盖态,搜索提交走路由跳转到 /photos/search(见 search-submit emit)。
// - upload 按钮(:26-28)、Ask Nimo 按钮(:29-32)不渲染 —— B 期这条时间线页不挂上传/AI
//   聊天入口,与 Photos.vue 现状一致(P1 已移除上传;chat drawer 未接线)。
//
// 标题/副行不做成 props(与 brief 的 Produces 接口骨架一致:`<PhotosTopbar :collapsed
// @toggle-collapse @search-submit>`,没有 title/sub):这条时间线页只有"照片库"这一种
// topbar 态(Vue2 topbarTitle 的 default 分支、topbarSubContext 的 default 分支——
// PhotosTimeline.vue:184-194/225-234 的 library 分支),组件自己消费 useI18n()/
// useTimelineStore() 拿到这两句,不需要外部传入。
//
// 副行=恒全库口径(brief 标题"副行恒全库计数"):store.photoCount/store.videoCount 是
// timeline store 的全库计数(bucket 模式下取自目录汇总,非当前已加载/已筛选的子集——
// timeline.ts:131-145),不随 Photos.vue 自己的 tab/EXIF 筛选变化,toLocaleString 千分位
// 格式化(brief 明示)。
//
// 搜索 submit 语义(fix round 1 · Important,owner 裁决 ledger-六-2):空串 Enter = 无动作,
// 照 Vue2 自己的 submitSearch(:65-69)语义——trim 后为空直接 return,不 emit。
// 第一版曾照搬 PhotosSearchBar.vue"空串也 emit"的约定(结构规格 3),owner 裁决 ledger-六-2
// 把"时间线顶栏空串 Enter 不动作"列为要清的债、覆盖那条约定——但只覆盖**这个顶栏**,
// PhotosSearchBar.vue 自己（PhotosSearch.vue 独立搜索页用的那个框）的"空串也 emit"仍然
// 有效、不受本次裁决影响,两者是不同范围、故意留出的不同行为,不是漏改。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosIcon from './PhotosIcon.vue'
import { useTimelineStore } from '../stores/timeline'

// Fix-1 item 1 (owner acceptance, 2026-08-13): the four re-shelled album/for-you pages need
// this same topbar but with a different title/sub and (per Vue2) no search box — Vue2's own
// PhotosTopbar.vue (NimoOS-UI src/views/Photos/PhotosTopbar.vue:42-51) takes title/sub/
// showSearch as props with defaults, and PhotosTimeline.vue:957-971 feeds it per-nav strings
// computed from topbarTitle/topbarSubContext. This component originally hard-coded the
// library-only values (see the header comment above, still accurate for the no-prop case);
// these three props are additive overrides so Photos.vue's own existing usage (no props
// passed) is byte-for-byte unchanged — see PhotosTopbar.test.ts's pre-existing default-mount
// assertions, none of which pass title/sub/showSearch.
const props = withDefaults(defineProps<{
  collapsed?: boolean
  title?: string
  sub?: string
  showSearch?: boolean
}>(), {
  showSearch: true,
})

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'search-submit', q: string): void
}>()

const { t } = useI18n()
const store = useTimelineStore()

// Default title: Vue2's own library-nav value (topbarTitle's default branch,
// PhotosTimeline.vue:194). A caller passing `title` (albums/for-you) overrides it.
const title = computed(() => props.title ?? t('photosLibrary'))

// Default sub: Vue2's own default branch (topbarSubContext, PhotosTimeline.vue:234) — full
// -library photo/video counts. A caller passing `sub` (albums' own album-aggregate line)
// overrides it; the for-you pages reuse this default as-is (Vue2's navMap has no 'smart'
// entry either, PhotosTimeline.vue:229-233).
const sub = computed(() => props.sub ?? t('photosCountSummary', {
  photos: store.photoCount.toLocaleString(),
  videos: store.videoCount.toLocaleString(),
}))

const searchText = ref('')

function submitSearch(): void {
  const q = searchText.value.trim()
  if (!q) return
  emit('search-submit', q)
}

function onKbd(e: KeyboardEvent): void {
  // Case-insensitive: a real Enter keypress gives `e.key === 'Enter'`, but
  // @vue/test-utils' `trigger('keydown.enter')` helper (used by this component's
  // own tests, matching the sibling PhotosSearchBar.test.ts's convention) sets the
  // synthetic event's `key` to the lowercase modifier name it was given — mirrors
  // how Vue's own compiled `.enter` template modifier compares via `hyphenate()`
  // internally (also case-insensitive), so this isn't loosening real behavior.
  if (e.key.toLowerCase() === 'enter') { e.preventDefault(); submitSearch() }
}
</script>

<template>
  <header class="topbar">
    <!-- aria-expanded describes the sidebar's own collapsed/expanded state (what this
         button controls), not this button's own expanded/collapsed state. -->
    <button class="icon-btn" :aria-expanded="!collapsed" :title="t('photosToggleSidebar')" @click="emit('toggle-collapse')">
      <PhotosIcon name="panelLeft" :size="17" />
    </button>
    <div style="display:flex;flex-direction:column">
      <div class="topbar-title">{{ title }}</div>
      <div class="topbar-sub">{{ sub }}</div>
    </div>
    <div style="flex:1;display:flex;justify-content:center">
      <!-- Vue2 keeps this outer centering wrapper unconditional and only gates the inner
           `.search` div itself (NimoOS-UI PhotosTopbar.vue:13-14) — same shape here. -->
      <div v-if="showSearch" class="search">
        <PhotosIcon name="search" :size="14" />
        <input
          v-model="searchText"
          :placeholder="t('photosSearchSearchBarPlaceholder')"
          @keydown="onKbd"
        >
        <span class="kbd">↵</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 唯一保留的 scoped 规则:已拍板的搜索框 FILL 偏离(搜索 C 决策延伸)——New-UI 玻璃质感
   (chip-bg 渐变 + chip-border)取代 Vue2 parity 的 surface-2 实底(photos.scss:233-238
   `.photos-root .search { background: var(--surface-2); border: 1px solid var(--line); }`)。
   形状/尺寸/位置/焦点环全部让 parity scss 生效,这里不重复声明 height/border-radius/padding/
   max-width 等——那些是形状,不是"质感",偏离范围仅限 FILL 两个声明。
   chip-bg/chip-border 是 theme.css 的全局 token(:150-220/:344-346),`.photos-root` 自己的
   token 块(vue2-parity/photos.scss:14-101)没有同名重定义(核对过,不遮蔽),所以这里取到
   的就是 New-UI 全局主题值,不需要字面量兜底/theme-exception 注释。 */
.search {
  background: var(--chip-bg);
  border-color: var(--chip-border);
}
</style>

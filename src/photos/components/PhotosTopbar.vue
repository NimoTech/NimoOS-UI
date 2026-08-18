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
// Search submit semantics (fix round 1 · Important, owner ruling ledger-六-2): empty Enter =
// no-op, matching Vue2's own submitSearch (:65-69) — trim to empty, return, don't emit. The
// first version of this component had copied the now-retired PhotosSearchBar.vue's own
// "empty string also emits" convention (structural spec 3); owner ruling ledger-六-2
// overrode that for the timeline topbar with "empty Enter here is a no-op" instead.
//
// Plan F Task 1 (2026-08-15) update: PhotosSearchBar.vue has since been retired outright (no
// consumer left — grep-confirmed) and PhotosSearch.vue's own search page now shares THIS
// exact topbar box (via the `query`/`search-submit` props below) instead of rendering its own
// separate input. So the no-op-on-empty guard below is no longer scoped to "just the timeline
// topbar" — it is now this repo's only search-box behavior, everywhere PhotosTopbar is used,
// and it matches Vue2 1:1 (Vue2 likewise has only one search box, shared by both the library
// and search "views", with this same empty-Enter no-op). One observable behavior change from
// the retirement: PhotosSearchBar's old "empty string also emits" used to let an empty Enter
// on the search page clear the query and fall back to the pre-search state; that specific path
// is intentionally gone now — an empty Enter is simply a no-op everywhere, the D13-aligned
// outcome, not an accidental loss.
import { computed, onMounted, ref, watch } from 'vue'
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
//
// Fix-3 item 7 (owner acceptance, 2026-08-13 pull-forward of Plan F): PhotosSearch.vue's own
// shell migration needs the `searchMode` half of Vue2 PhotosTopbar.vue:6-12 — a second
// `icon-btn` (chevL) rendered as a sibling of the collapse toggle, replacing the title/sub
// block entirely (Vue2's `v-if="searchMode"` / `v-if="!searchMode"` pair). `back` is the
// New-UI prop name for that state (Vue2's `searchMode`); the emitted event is `back` rather
// than Vue2's `exit-search` since New-UI's search page is a real route and "back" means
// "navigate away", not "toggle a local state flag" — PhotosSearch.vue wires it to
// `router.push('/photos')`.
//
// Plan F Task 1 (D13 topbar alignment, supersedes the "show-search=false" note this comment
// used to carry): PhotosSearch.vue used to pass `show-search=false` here and render its own,
// separate in-page editable input (PhotosSearchBar.vue) — a D13 deviation from Vue2, which has
// only ONE search box (this component's own `.search`) because its search "page" and library
// page are the same component. PhotosSearchBar.vue has been retired (grep-confirmed no other
// consumer remained) and PhotosSearch.vue now leaves `showSearch` at its default (true) and
// wires THIS component's own `.search` box to the route via the new `query` prop below —
// matching Vue2 1:1 (one search box, shared by both the library and search "views").
const props = withDefaults(defineProps<{
  collapsed?: boolean
  title?: string
  sub?: string
  showSearch?: boolean
  back?: boolean
  query?: string
}>(), {
  showSearch: true,
  back: false,
  query: '',
})

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'search-submit', q: string): void
  (e: 'back'): void
}>()

const { t } = useI18n()
const store = useTimelineStore()
const searchInputRef = ref<HTMLInputElement | null>(null)

// Default title: Vue2's own library-nav value (topbarTitle's default branch,
// PhotosTimeline.vue:194). A caller passing `title` (albums/for-you) overrides it.
const title = computed(() => props.title ?? t('photosLibrary'))

// Default sub: Vue2's own default branch (topbarSubContext, PhotosTimeline.vue:234) — full
// -library photo/video counts. A caller passing `sub` (albums' own album-aggregate line)
// overrides it; the for-you pages reuse this default as-is (Vue2's navMap has no 'smart'
// entry either, PhotosTimeline.vue:229-233).
//
// Fix round 1 · Important 1 (Plan E Task 1 review, 2026-08-14): an explicit `sub=""` is a
// distinct, additive opt-out — "render no subtitle at all" — from omitting the prop, which
// still means "use the library default" (`??` only falls back on null/undefined, not on '').
// PhotosPlaceAssets.vue needs exactly this: Vue2 has no topbar/sub concept for that detail
// context at all, so neither the library default nor an empty-but-rendered `.topbar-sub` node
// is correct there.
const sub = computed(() => props.sub ?? t('photosCountSummary', {
  photos: store.photoCount.toLocaleString(),
  videos: store.videoCount.toLocaleString(),
}))

// Plan F Task 1 (D13 topbar alignment): mirrors Vue2 PhotosTopbar.vue's own `query` prop
// contract exactly (:47-57 `data() { return { searchText: this.query } }` + a
// `query(v) { if (v !== this.searchText) this.searchText = v || '' }` watcher) — the same
// "echo the route/store query, but never clobber in-progress typing" guard the now-retired
// PhotosSearchBar.vue's own `value` prop used to implement.
const searchText = ref(props.query)

watch(() => props.query, (v) => {
  if (v !== searchText.value) searchText.value = v || ''
})

function submitSearch(): void {
  const q = searchText.value.trim()
  if (!q) return
  emit('search-submit', q)
}

function onKbd(e: KeyboardEvent): void {
  // Case-insensitive: a real Enter keypress gives `e.key === 'Enter'`, but
  // @vue/test-utils' `trigger('keydown.enter')` helper (used by this component's own tests,
  // a convention formerly shared with the now-retired PhotosSearchBar.test.ts) sets the
  // synthetic event's `key` to the lowercase modifier name it was given — mirrors
  // how Vue's own compiled `.enter` template modifier compares via `hyphenate()`
  // internally (also case-insensitive), so this isn't loosening real behavior.
  if (e.key.toLowerCase() === 'enter') { e.preventDefault(); submitSearch() }
}

// Plan F Task 1: mirrors Vue2 PhotosTopbar.vue's own `searchMode(on) { if (on) ... focus() }`
// watcher (:60-62) — entering search focuses the box. New-UI's `back` prop is the routed
// equivalent of Vue2's `searchMode` (see the Fix-3 item 7 comment above this component's props
// block); PhotosSearch.vue mounts with `back` already true (a dedicated route, not a toggled
// local flag that transitions after mount), so the equivalent moment here is `onMounted`, not
// a prop-change watcher — by `onMounted` time the template ref is already bound (no `nextTick`
// needed, same synchronous pattern the now-retired PhotosSearchBar.vue's own `autofocus` prop
// used). Losing this would be an observable regression vs. that component.
onMounted(() => {
  if (props.back) searchInputRef.value?.focus()
})
</script>

<template>
  <header class="topbar">
    <!-- aria-expanded describes the sidebar's own collapsed/expanded state (what this
         button controls), not this button's own expanded/collapsed state. -->
    <button class="icon-btn" :aria-expanded="!collapsed" :title="t('photosToggleSidebar')" @click="emit('toggle-collapse')">
      <PhotosIcon name="panelLeft" :size="17" />
    </button>
    <!-- Fix-3 item 7: Vue2 PhotosTopbar.vue:6-8 (searchMode's back button, chevL glyph
         copied verbatim from NimoOS-UI PhotosIcon.vue's chevL branch — same path already
         used by SearchDatePopover.vue's cal-nav "previous month" button). -->
    <button v-if="back" class="icon-btn" :title="t('photosSearchBackToLibrary')" @click="emit('back')">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
    </button>
    <div v-if="!back" style="display:flex;flex-direction:column">
      <div class="topbar-title">{{ title }}</div>
      <!-- Fix round 1 · Important 1: `sub=""` (explicit empty string) is the opt-out — no
           `.topbar-sub` node at all — distinct from omitting the prop, which still renders the
           library-default fallback computed above. -->
      <div v-if="sub" class="topbar-sub">{{ sub }}</div>
    </div>
    <div style="flex:1;display:flex;justify-content:center">
      <!-- Vue2 keeps this outer centering wrapper unconditional and only gates the inner
           `.search` div itself (NimoOS-UI PhotosTopbar.vue:13-14) — same shape here. -->
      <div v-if="showSearch" class="search">
        <PhotosIcon name="search" :size="14" />
        <input
          ref="searchInputRef"
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

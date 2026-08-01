<script setup lang="ts">
// SP7-P7a-T15: PhotosSearchGrid.vue —— 搜索结果双档网格(最佳匹配 + 折叠长尾)+
// 无限滚动 sentinel。
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue:
//   :241-279 (模板:结果网格 + 折叠条 + sentinel)
//   :405-415 (showLoadMoreSentinel,sentinel 门控 —— 由宿主 T16 依据 store 状态算,
//             作为 showSentinel prop 传入本组件,本组件不重算)
//   :694-721 (loadMore + IntersectionObserver —— 逻辑已抽进 useInfiniteScroll composable)
//
// 渲染项清单对照(Vue2 :241-279 逐项 → 本组件落点):
//   .photos-wrap.scroll(D7,本仓自己写 flex:1 + overflow-y:auto)→ .photos-wrap(ref rootRef)
//   .grid[data-density=comfortable] + v-for best → 第一个 .grid(恒渲染,tile 抽为 SearchResultTile)
//   v-if moreTierResults.length → template(用 more.length 判断)
//     .more-results-bar(chevD/chevR + photosSearchResultsCount)→ 按钮 + toggleMore
//     v-if moreExpanded → 第二个 .grid → v-for more 出 tile
//     v-if showSentinel → .load-more-sentinel(ref sentinelRef)
//       v-if loadingMore → .load-more-status(photosSearchLoading)
//
// D2(控制器裁定,列宽偏离登记):brief 结构规格 6 自相矛盾(既要求照搬 Vue2 固定
// 7 列,又要求复用 PhotosGrid 的自适应列宽)。裁定:照 PhotosGrid.vue 的默认(comfortable)
// `.grid` 规则(`repeat(auto-fill, minmax(140px, 1fr))` + `gap: 4px`),不是 Vue2
// photos.scss:318 的 `repeat(7, 1fr)` 固定列——理由:①同区视觉一致优先(P3 已为整个
// 相册区做过这个决定,搜索页不该开倒车)②这是相对 Vue2 的刻意偏离,非漏做。本组件
// 不接 density prop(Vue2 搜索结果写死 comfortable,照搬,见下方样式块)。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScoredPhoto } from '../util/searchSort'
import type { Photo } from '../util/assetToPhoto'
import { useInfiniteScroll } from '../composables/useInfiniteScroll'
import SearchResultTile from './SearchResultTile.vue'

const props = defineProps<{
  best: ScoredPhoto[]
  more: ScoredPhoto[]
  moreExpanded: boolean
  showSentinel: boolean
  loadingMore: boolean
}>()

const emit = defineEmits<{
  (e: 'open', photo: Photo): void
  (e: 'update:moreExpanded', v: boolean): void
  (e: 'load-more'): void
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

// D8(T11 交接,务必不再"保护"一层):store 的 loadMore 已经自带 loadingMore/exhausted
// 入口短路 + 过期响应 seq 守卫(src/photos/stores/search.ts),这里只管把 IO 命中原样
// 转发成 load-more 事件,不额外加防抖/节流——本期已四次栽在"composable 又包一层守卫、
// 和 store 的守卫叠成遮蔽"上。
useInfiniteScroll({
  target: sentinelRef,
  root: rootRef,
  enabled: computed(() => props.showSentinel),
  onHit: () => emit('load-more'),
})

function toggleMore(): void {
  emit('update:moreExpanded', !props.moreExpanded)
}
</script>

<template>
  <div class="photos-wrap" ref="rootRef">
    <div class="grid" data-density="comfortable">
      <SearchResultTile v-for="r in best" :key="r.p.id" :result="r" @open="emit('open', $event)" />
    </div>
    <template v-if="more.length">
      <button class="more-results-bar" type="button" @click="toggleMore">
        <svg
          v-if="moreExpanded"
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
        ><path d="m6 9 6 6 6-6" /></svg>
        <svg
          v-else
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
        ><path d="m9 6 6 6-6 6" /></svg>
        {{ t('photosSearchResultsCount', { count: more.length }) }}
      </button>
      <div v-if="moreExpanded" class="grid" data-density="comfortable">
        <SearchResultTile v-for="r in more" :key="r.p.id" :result="r" @open="emit('open', $event)" />
      </div>
      <div v-if="showSentinel" ref="sentinelRef" class="load-more-sentinel">
        <span v-if="loadingMore" class="load-more-status">{{ t('photosSearchLoading') }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* D7(控制器裁定):Vue2 靠全局 .scroll 类(photos.scss:98,只有一条 overflow-y:auto)
   + 内联 style="flex:1;padding-top:0"。本仓 scoped SFC 没有全局 .scroll 类,自己写。 */
.photos-wrap { flex: 1; overflow-y: auto; }

/* D2(见上方 script 注释):照 PhotosGrid.vue 的默认(comfortable)自适应列宽,不是
   Vue2 photos.scss:318 的固定 7 列——这是相对 Vue2 的刻意偏离,已登记。 */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px; padding: 0 32px 40px; }

/* Vue2 photos.scss:2711-2718(.more-results-bar + :hover)。token 映射照本期既定表:
   --surface-2→--chip-bg / --surface-3→--chip-bg-hi / --line→--card-border /
   --text-1→--fg / --text-2→--fg-muted(SmartViewCreateDialog.vue:43-45 四档映射)。 */
.more-results-bar {
  display: flex; align-items: center; gap: 6px;
  margin: 4px 32px 16px; padding: 9px 14px;
  border-radius: 8px; border: 1px dashed var(--card-border);
  background: var(--chip-bg); color: var(--fg-muted);
  font-size: 12px; font-weight: 500; cursor: pointer;
}
.more-results-bar:hover { background: var(--chip-bg-hi); color: var(--fg); }

/* Vue2 photos.scss:2722-2726(.load-more-sentinel/.load-more-status)。 */
.load-more-sentinel {
  display: flex; align-items: center; justify-content: center;
  height: 1px; margin: 4px auto 24px; padding: 20px 0;
}
.load-more-status { font-size: 12px; font-weight: 500; color: var(--fg-faint); }
</style>

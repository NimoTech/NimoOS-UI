<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'
import { useTimelineStore } from '../stores/timeline'
import { usePhotosSettingsStore } from '../stores/settings'
import { renderSize } from '../../files/util/format'
import { activeNavId } from '../util/activeNavId'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const timeline = useTimelineStore()
// P8a-T6 (§7e-15):侧栏是相册区全部页面共用组件,自己拉一次 aiFeatures 配置来决定是否
// 隐藏 smart-views 条目。store 是单例,与任意视图各自的 onMounted 同帧挂载会并发调用
// fetchAiFeatures() —— 并发去重收在 settings.ts 里(见该文件 fetchAiFeatures 头部注释),
// 这里只管调用,不用关心去重细节。
const settings = usePhotosSettingsStore()
onMounted(() => { void settings.fetchAiFeatures() })

// 抽屉态:注意必须解构(嵌套 ref 在模板里不会自动解包,drawer.isNarrow 恒真值是坑)——照 FilesSidebar。
const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()

// 任何路由变化后抽屉自动收起;桌面态 close 是 no-op。
watch(() => route.fullPath, () => closeDrawer())

// ESC 关抽屉,仅在窄屏打开时监听。
function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

// 导航条目注册表。
const NAV_ALL = [
  { id: 'library', route: '/photos', labelKey: 'photosLibrary' },
  { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums' },
  { id: 'people', route: '/photos/people', labelKey: 'photosPeople' },
  { id: 'places', route: '/photos/places', labelKey: 'photosPlaces' },
  // SP7-P7a-T4:插在 places 之后、favorites 之前,照 Vue2 PhotosSidebar.vue:114-118 的顺序
  // (library / albums / people / places / smart)。7 项(原 6 项),favorites/trash 下标各 +1。
  // SP15-P2b (Vue2 939a7d3a:PhotosSidebar.vue:118): the page behind this entry is now a
  // Moments-only "For You" page -- the smart albums moved into Albums. Only the label
  // changes; id and route stay so the ?view=smart deep link and the hide-when-off filter
  // keep working.
  { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosMoForYou' },
  { id: 'favorites', route: '/photos/favorites', labelKey: 'photosFavorites' },
  { id: 'trash', route: '/photos/trash', labelKey: 'photosTrash' },
]

// P8a-T6(§7e-15):Vue2 PhotosSidebar.vue:120-122 —— `ai.smartview === false` 时
// `items.filter(i => i.id !== 'smart')`。判据必须是 `=== false`,不是 `!x`:aiFeatures.
// smartview 的默认值与"取数失败/字段缺失"的兜底值都是 `true`,只有后端明确说关了才隐藏这一
// 条——配置读取抖动/请求失败不该让导航条目消失,吓用户以为功能不见了。
const NAV = computed(() =>
  settings.aiFeatures.smartview === false
    ? NAV_ALL.filter((n) => n.id !== 'smart-views')
    : NAV_ALL,
)

function isActive(n: { id: string }): boolean {
  return activeNavId(route.path, NAV.value) === n.id
}

// 存储条:usedText = totalBytes 人类可读;percent = (diskTotal-diskAvail)/diskTotal,除零守卫。
const usedText = computed(() => renderSize(timeline.indexStatus.totalBytes))
const usedPercent = computed(() => {
  const total = timeline.indexStatus.diskTotal
  if (!total) return 0
  const used = total - timeline.indexStatus.diskAvail
  return Math.min(100, Math.max(0, (used / total) * 100))
})
</script>

<template>
  <div v-if="isNarrow && drawerOpen" class="side-scrim" @click="closeDrawer"></div>
  <aside class="photos-sidebar" :class="{ 'is-drawer': isNarrow, 'is-open': drawerOpen }">
    <!-- 桌面态:回主页 + 标题并入侧栏玻璃面板(AreaShell 顶栏同时段隐藏);窄屏走顶栏,抽屉内不重复 -->
    <div v-if="!isNarrow" class="side-top">
      <h1 class="side-app-title">{{ t('photosTitle') }}</h1>
      <button class="bar-btn side-home-btn" type="button" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
    </div>
    <section class="side-section">
      <ul class="side-list">
        <li
          v-for="n in NAV" :key="n.id"
          class="side-item" :class="{ active: isActive(n) }"
          @click="router.push(n.route)"
        >
          <span class="side-name">{{ t(n.labelKey) }}</span>
        </li>
      </ul>
    </section>
    <section class="side-section storage-bar">
      <h4 class="side-title">{{ t('photosStorage') }}</h4>
      <div class="storage-bar-track">
        <div class="storage-bar-fill" :style="{ width: usedPercent + '%' }"></div>
      </div>
      <p class="storage-bar-text">{{ usedText }}</p>
    </section>

    <!-- SP7-P8a-T5:侧栏底部设置入口,照 Vue2 PhotosSidebar.vue:34-35 的齿轮按钮(那边
         @open-settings 是 emit 给挂着 open prop 的全屏 overlay;本仓是真路由,直接
         router.push)。不改 NAV 数组/既有导航项顺序——T6 要接的"smart-views 条件隐藏"
         同样改 NAV,两者互不打扰。 -->
    <section class="side-section side-settings">
      <button type="button" class="side-settings-btn" data-test="sidebar-settings-link" @click="router.push('/photos/settings')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        <span class="side-name">{{ t('photosSettingsTitle') }}</span>
      </button>
    </section>
  </aside>
</template>

<style scoped>
/* 与 FilesSidebar/AppsSidebar 同一壳形态(玻璃面板 + 窄屏抽屉)。token 五件套照抄。 */
.photos-sidebar {
  flex: 0 0 220px; align-self: stretch; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 18px;
  padding: 14px; overflow-y: auto;
  background: var(--panel-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--panel-shadow);
  backdrop-filter: var(--blur);
}
.side-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.side-home-btn { font-size: 13px; flex: 0 0 auto; }
.side-app-title { font-size: clamp(20px, 1.8vw, 28px); font-weight: 600; margin: 0 0 0 2px; color: var(--fg); }
.side-section { min-width: 0; }
.side-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 0 0 6px; }
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg-hi); }
.side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.storage-bar { margin-top: auto; } /* 存储条压到侧栏底部 */
.storage-bar-track { height: 6px; border-radius: 999px; background: var(--chip-bg-hi); overflow: hidden; }
.storage-bar-fill { height: 100%; border-radius: 999px; background: var(--accent); }
.storage-bar-text { margin: 6px 0 0; font-size: 12px; color: var(--fg-muted, #9aa4bf); }

/* 设置入口:紧跟存储条之后,视觉上处于侧栏最底部。 */
.side-settings-btn {
  display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px;
  padding: 6px 8px; border: none; border-radius: 10px; background: transparent;
  color: var(--fg); font: inherit; cursor: pointer;
}
.side-settings-btn:hover { background: var(--chip-bg-hi); }

.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.photos-sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
  border: none; border-right: 1px solid var(--card-border);
  border-radius: 0; box-shadow: none;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.photos-sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .photos-sidebar.is-drawer { transition: none; } }
</style>

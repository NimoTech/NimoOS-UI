<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'
import { useTimelineStore } from '../stores/timeline'
import { renderSize } from '../../files/util/format'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const timeline = useTimelineStore()

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

// 导航条目注册表:数组结构预留后续阶段追加(收藏夹/回收站等)。
const NAV = [
  { id: 'library', route: '/photos', labelKey: 'photosLibrary' },
]

function isActive(n: { route: string }): boolean {
  return route.path.startsWith(n.route)
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

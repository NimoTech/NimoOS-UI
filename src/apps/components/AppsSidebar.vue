<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// 抽屉态:必须解构(嵌套 ref 在模板里不自动解包,drawer.isNarrow 恒真值是坑)
const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()

// 路由变化后抽屉自动收起;桌面态 close 是 no-op
watch(() => route.fullPath, () => closeDrawer())

function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

// P5/P7 增补:自定义 /apps/custom、源 /apps/sources
const nav = [
  { name: 'apps', labelKey: 'appsNavInstalled', to: '/apps' },
  { name: 'apps-store', labelKey: 'appsNavStore', to: '/apps/store' },
]

/** 商店详情(apps-store-detail)也高亮「应用商店」——子路由归属父导航项 */
function isActive(n: { name: string }): boolean {
  const cur = String(route.name ?? '')
  return n.name === 'apps-store' ? cur.startsWith('apps-store') : cur === n.name
}
</script>

<template>
  <div v-if="isNarrow && drawerOpen" class="side-scrim" @click="closeDrawer"></div>
  <aside class="apps-sidebar" :class="{ 'is-drawer': isNarrow, 'is-open': drawerOpen }">
    <!-- 桌面态:回主页 + 标题并入侧栏玻璃面板(AreaShell 顶栏同时段隐藏);窄屏走顶栏,抽屉内不重复 -->
    <div v-if="!isNarrow" class="side-top">
      <h1 class="side-app-title">{{ t('appsTitle') }}</h1>
      <button class="bar-btn side-home-btn" type="button" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
    </div>
    <section class="side-section">
      <ul class="side-list">
        <li
          v-for="n in nav" :key="n.name"
          class="side-item" :class="{ active: isActive(n) }"
          @click="router.push(n.to)"
        >
          <span class="side-name">{{ t(n.labelKey) }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
/* 与 FilesSidebar 同一壳形态(玻璃面板 + 窄屏抽屉)。第二次出现:第三区(SP6)时抽 AreaSidebar。 */
.apps-sidebar {
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
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg-hi); }
.side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.apps-sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
  border: none; border-right: 1px solid var(--card-border);
  border-radius: 0; box-shadow: none;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.apps-sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .apps-sidebar.is-drawer { transition: none; } }
</style>

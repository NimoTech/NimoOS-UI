<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'

defineProps<{ title: string }>()
const router = useRouter()
const { t } = useI18n()
const { isNarrow, toggle } = useSidebarDrawer()
function goHome() { router.push('/') }
</script>

<template>
  <div class="area-shell">
    <header class="area-bar">
      <button v-if="isNarrow" class="bar-btn area-menu-btn" type="button" :aria-label="t('areaSidebarToggle')" @click="toggle">☰</button>
      <button class="bar-btn area-home-btn" type="button" @click="goHome">‹ {{ t('areaBackHome') }}</button>
      <h1 class="area-title">{{ title }}</h1>
    </header>
    <main class="area-body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* 100dvh:手机浏览器的 100vh 含被地址栏/工具条遮住的区域,会把最后一行内容压到工具条背后;
   dvh 随浏览器 UI 伸缩取真实可见高度。前一行 100vh 是旧内核兜底。 */
.area-shell { display: flex; flex-direction: column; height: 100vh; height: 100dvh; color: var(--fg); }
.area-bar { display: flex; align-items: center; gap: 16px; padding: 16px 20px; flex: 0 0 auto; }
.area-title { font-size: 18px; font-weight: 600; margin: 0; }
.area-body { flex: 1 1 auto; overflow: auto; padding: 0 20px 20px; }

/* 窄屏(≤768px):侧栏变抽屉,头部内边距/间距收紧以省空间 */
@media (max-width: 768px) {
  .area-bar { padding: 12px; gap: 10px; }
  .area-body { padding: 0 12px 12px; }
}
/* 桌面态:回主页+标题已并入各区侧栏玻璃面板(Sidebar .side-top),顶栏整条隐藏、内容顶到上缘 */
@media (min-width: 769px) {
  .area-bar { display: none; }
  .area-body { padding: 20px; }
}
</style>

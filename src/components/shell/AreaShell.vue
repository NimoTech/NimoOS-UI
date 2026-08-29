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
/* 100dvh: on mobile browsers 100vh includes the area hidden behind the address bar/toolbar,
   pushing the last row of content behind the toolbar; dvh tracks the real visible height as the
   browser UI expands/collapses. The 100vh line before it is a fallback for older engines. */
.area-shell { display: flex; flex-direction: column; height: 100vh; height: 100dvh; color: var(--fg); }
.area-bar { display: flex; align-items: center; gap: 16px; padding: 16px 20px; flex: 0 0 auto; }
.area-title { font-size: 18px; font-weight: 600; margin: 0; }
.area-body { flex: 1 1 auto; overflow: auto; padding: 0 20px 20px; }

/* Narrow screens (≤768px): sidebar becomes a drawer; header padding/gaps tighten to save space */
@media (max-width: 768px) {
  .area-bar { padding: 12px; gap: 10px; }
  .area-body { padding: 0 12px 12px; }
}
/* Desktop: back-home + title have moved into each area's sidebar glass panel (Sidebar .side-top); the whole top bar is hidden and content reaches the top edge */
@media (min-width: 769px) {
  .area-bar { display: none; }
  .area-body { padding: 20px; }
}
</style>

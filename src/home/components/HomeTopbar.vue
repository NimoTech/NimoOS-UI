<template>
  <header class="topbar">
    <div class="brand">NimoOS</div>
    <div class="status">
      <button class="bar-btn search-btn" :aria-label="t('topbarSearch')" :title="t('topbarSearchKbd')" @click="homeUi.openSearch()">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        <span>{{ t('topbarSearch') }}</span>
      </button>
      <button class="bar-btn add-btn" @click="$emit('add')">+ {{ t('topbarAdd') }}</button>
      <button class="bar-btn edit-btn" :aria-pressed="editing" @click="toggleEdit()">{{ editing ? t('topbarDone') : '✎ ' + t('topbarEdit') }}</button>
      <ThemeToggle />
    </div>
  </header>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditMode } from '../composables/useEditMode'
import { useHomeUiStore } from '../stores/homeUi'
import ThemeToggle from './ThemeToggle.vue'
defineEmits<{ add: [] }>()
const { t } = useI18n()
const { editing, toggleEdit } = useEditMode()
const homeUi = useHomeUiStore()

// ⌘K / Ctrl+K opens the search palette. (Esc-to-close is handled by the dialog itself.)
function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); homeUi.openSearch() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>
<style scoped>
/* topbar layout — base.css:29 */
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 40px; padding: 0 20px; }

/* brand — base.css:30 + skin-spatial.css:163 */
.brand { display: flex; align-items: center; gap: 11px; font-weight: 600; font-size: 16px; letter-spacing: -0.2px; font-family: var(--brand-font, inherit); text-shadow: var(--label-shadow); }

/* status area — base.css:35 */
.status { display: flex; justify-content: flex-end; align-items: center; gap: 10px; color: var(--fg-muted); font-size: 13px; }

/* glass chip button — base.css:37-40 */
.bar-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border: 1px solid var(--chip-border); border-radius: var(--chip-radius, 999px); background: var(--chip-bg); color: var(--fg); font-size: 13px; font-weight: 500; cursor: pointer; backdrop-filter: var(--blur); transition: background 0.2s, border-color 0.2s, box-shadow 0.2s; text-decoration: none; }
.bar-btn:hover { background: var(--chip-bg-hi); }
.bar-btn .icon { width: 16px; height: 16px; }

/* search-btn: glass pill with magnifier icon — matches 搜索组件.dc.html topbar button */
.search-btn { padding-left: 13px; }
.search-btn .ic { width: 17px; height: 17px; }

/* add-btn is a bar-btn variant — no extra overrides needed */

/* edit-btn active — maps #editBtn[aria-pressed="true"] from base.css:41 */
.edit-btn[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
</style>

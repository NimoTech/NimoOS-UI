<template>
  <Dialog :open="!!sa.state.value" :title="t('startAppTitle')" @update:open="(v: boolean) => { if (!v) sa.dismiss() }">
    <template v-if="sa.state.value?.phase === 'confirm'">
      <p class="sa-msg">{{ t('startAppMessage', { name: appName }) }}</p>
    </template>
    <template v-else>
      <div class="sa-starting">
        <span class="sa-spinner" />
        <span class="sa-msg">{{ t('startAppStarting', { name: appName }) }}</span>
      </div>
    </template>
    <template v-if="sa.state.value?.phase === 'confirm'" #footer>
      <button class="sa-btn" @click="sa.dismiss()">{{ t('startAppCancel') }}</button>
      <button class="sa-btn sa-primary" @click="sa.confirm()">{{ t('startAppConfirm') }}</button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { useStartApp } from '../composables/useStartApp'
import { useAppsStore } from '../stores/apps'

const { t } = useI18n()
const sa = useStartApp()
const apps = useAppsStore()
const appName = computed(() => {
  const k = sa.state.value?.key
  return (k && apps.app(k)?.name) || k || ''
})
</script>
<style scoped>
.sa-msg { font-size: 14px; color: var(--fg-muted); margin: 0; }
.sa-starting { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
/* 与 SearchDialog .spinner 同款:--ring-track 底圈 + --accent 顶弧 */
.sa-spinner { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 3px solid var(--ring-track); border-top-color: var(--accent); animation: sa-spin 0.8s linear infinite; }
@keyframes sa-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .sa-spinner { animation-duration: 1.6s; } }
.sa-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.sa-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
</style>

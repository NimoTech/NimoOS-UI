<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialogRoot, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from 'reka-ui'

const props = defineProps<{ open: boolean; name: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', deleteConfigFolder: boolean) : void }>()
const { t } = useI18n()
const delData = ref(true)
// Default to checked 'Also delete user data' (user decision 2026-07-21, overrides P1's default unchecked); reset to default each time dialog opens
watch(() => props.open, (o) => { if (o) delData.value = true })
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="uc-overlay" />
      <AlertDialogContent class="uc-content">
        <AlertDialogTitle class="uc-title">{{ t('appsUninstallTitle') }}</AlertDialogTitle>
        <AlertDialogDescription class="uc-msg">{{ t('appsUninstallMsg', { name }) }}</AlertDialogDescription>
        <label class="uc-check">
          <input v-model="delData" type="checkbox" />
          <span>{{ t('appsUninstallDeleteData') }}</span>
        </label>
        <div class="uc-footer">
          <AlertDialogCancel class="uc-btn">{{ t('appsCancel') }}</AlertDialogCancel>
          <AlertDialogAction class="uc-btn danger" @click="emit('confirm', delData)">{{ t('appsUninstall') }}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
/* scoped works: data-v attributes follow the component's own template vnode, and persist after Portal to body
   (same as AlertDialog.vue). AppActionsMenu must not be scoped because its menu items come from consumer slots. */
.uc-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.uc-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: 92vw; padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.uc-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
.uc-msg { font-size: 14px; color: var(--fg-muted); margin: 0; }
.uc-check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; color: var(--fg); cursor: pointer; }
.uc-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.uc-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.uc-btn.danger { background: color-mix(in srgb, #ff5d5d 30%, transparent); border-color: #ff5d5d; /* theme-exception: danger button follows AlertDialog's existing exception */ }
</style>

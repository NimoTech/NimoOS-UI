<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { useToast } from '../../stores/toast'
import { buildSmbPaths, getShareHost } from '../util/sambaPath'
import { copyText } from '../util/clipboard'

const props = defineProps<{ open: boolean; name: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
const { t } = useI18n()
const toast = useToast()

const paths = computed(() => buildSmbPaths(getShareHost(), props.name))

async function copy(text: string) {
  try {
    await copyText(text)
    toast.show(t('filesShareCopied'))
  } catch { /* 剪贴板不可用时静默 */ }
}
</script>

<template>
  <Dialog :open="open" :title="t('filesShareLinkTitle')" @update:open="emit('update:open', $event)">
    <p class="share-hint">{{ t('filesShareLinkHint') }}</p>
    <label class="share-label">{{ t('filesShareWindows') }}</label>
    <div class="share-path"><input class="ui-input" readonly :value="paths.windows" /><button class="ui-btn" @click="copy(paths.windows)">{{ t('filesShareCopy') }}</button></div>
    <label class="share-label">{{ t('filesShareMac') }}</label>
    <div class="share-path"><input class="ui-input" readonly :value="paths.mac" /><button class="ui-btn" @click="copy(paths.mac)">{{ t('filesShareCopy') }}</button></div>
    <template #footer>
      <button class="ui-btn primary" @click="emit('update:open', false)">{{ t('filesGotIt') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.share-hint { font-size: 13px; color: var(--fg-muted, #9aa4bf); margin: 0 0 14px; }
.share-label { display: block; font-size: 12px; color: var(--fg-muted, #9aa4bf); margin: 12px 0 6px; }
.share-path { display: flex; gap: 8px; }
.ui-input { flex: 1 1 auto; min-width: 0; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--chip-border, rgba(255,255,255,0.16)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; outline: none; }
.ui-btn { flex: 0 0 auto; padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
</style>

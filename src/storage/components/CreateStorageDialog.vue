<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { fmtSize } from '../../home/util/format'
import type { AvailDisk } from '../util/storageMap'

const props = defineProps<{ open: boolean; disks: AvailDisk[]; defaultName: string; busy?: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', payload: { path: string; name: string; format: boolean }): void
}>()
const { t } = useI18n()

const name = ref('')
const diskIndex = ref(0)
// Reset to the default name + preselect the first disk every time it opens; immediate covers the mount case where open is already true initially
watch(
  () => props.open,
  (o) => {
    if (o) {
      name.value = props.defaultName
      diskIndex.value = 0
    }
  },
  { immediate: true },
)
// Same as Vue2: name only allows \w and hyphens
function onNameInput(e: Event) {
  const el = e.target as HTMLInputElement
  name.value = el.value.replace(/[^\w-]/g, '')
  el.value = name.value
}
const selected = computed<AvailDisk | undefined>(() => props.disks[diskIndex.value])
const canSubmit = computed(() => !!name.value && !!selected.value && !props.busy)
function submit(format: boolean) {
  if (!canSubmit.value || !selected.value) return
  emit('confirm', { path: selected.value.path, name: name.value, format })
}
</script>

<template>
  <Dialog :open="open" :title="t('storageCreate')" @update:open="emit('update:open', $event)">
    <label class="cs-label">{{ t('storageCreateName') }}</label>
    <input :value="name" class="cs-input" type="text" @input="onNameInput" />
    <label class="cs-label">{{ t('storageCreateChooseDisk') }}</label>
    <select v-model.number="diskIndex" class="cs-input cs-select">
      <option v-for="(d, i) in disks" :key="d.path" :value="i">
        {{ d.name }} ({{ d.model }} - {{ fmtSize(d.size) }})
      </option>
    </select>
    <aside v-if="selected" class="cs-warn" :class="selected.needFormat ? 'danger' : 'notice'">
      <strong>{{ selected.needFormat ? t('storageCreateWarnTitle') : t('storageCreateAttentionTitle') }}</strong>
      <p>{{ selected.needFormat ? t('storageCreateWarnErase') : t('storageCreateAttentionDirect') }}</p>
      <p v-if="!selected.needFormat">{{ t('storageCreateWarnErase') }}</p>
    </aside>
    <template #footer>
      <button class="cs-btn" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button v-if="selected && !selected.needFormat" class="cs-btn" type="button" :disabled="!canSubmit" @click="submit(false)">
        {{ t('storageCreateDirect') }}
      </button>
      <button class="cs-btn danger" type="button" :disabled="!canSubmit" @click="submit(true)">
        {{ busy ? t('storageCreating') : t('storageCreateOk') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.cs-label { display: block; margin: 12px 0 6px; font-size: 12.5px; color: var(--fg-muted); }
.cs-label:first-of-type { margin-top: 0; }
.cs-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.cs-input:focus { border-color: var(--accent); }
.cs-select { appearance: auto; }
/* `.cs-input` sets background to var(--chip-bg) —— under the dark theme it is a **translucent, near-light gradient**.
 * Once the author gives a <select> its own background, Chrome carries it over to the popup list, but a native option
 * **does not render a gradient** (it falls back to the browser's default light background), and combined with a
 * near-light --fg that becomes light-on-light (invisible text). The root's color-scheme: dark cannot save it
 * (the author's background wins). Note the background comes from the shared class `.cs-input`, not the
 * select-specific `.cs-select` —— watching only the select-specific class will miss the actual source. Guarded by:
 * styles/selectPopup.test.ts. */
.cs-select option,
.cs-select optgroup {
  background-color: var(--set-option-bg);
  color: var(--set-option-fg);
}
.cs-warn { margin-top: 14px; padding: 10px 12px; border-radius: 10px; font-size: 13px; border: 1px solid var(--chip-border); }
.cs-warn strong { display: block; margin-bottom: 4px; font-size: 13px; }
.cs-warn p { margin: 0 0 4px; color: var(--fg-muted); }
.cs-warn.danger { border-color: var(--remove-fg); }
.cs-warn.danger strong { color: var(--remove-fg); }
.cs-btn {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.cs-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cs-btn.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>

<script setup lang="ts">
// folder-permissions' "Add folder / Add exclusion" dialog.
// Corresponds to Vue2 FolderPermissions.vue L157-174 (b-modal + FolderBrowser + manual input box).
//
// ⚠️ This phase follows spec §3.1 policy three: **the dialog opens, the picker and
// manual input box are both present, but the "Add" button is always disabled** — it triggers
// no write. When wiring it up (debt D11), remove that disabled and replace it with Vue2 L169's
// `:disabled="!newPath.startsWith('/')"`, and hook the click up to the panel's confirmAdd —
// the UI does not need rework.
//
// ⚠️ This phase's roots are always the pickerRoots([]) fallback three (/DATA, /media, /mnt),
// because the snapshot's candidates is empty (that data comes from wiki.getCandidates, and
// the wiki domain is punted = debt D12). The root buttons are therefore also disabled: clicking
// into one needs folder.getList to list the directory, which is wiring-time work — no requests fire this phase.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../../components/ui/Dialog.vue'
import type { PickerRoot } from '../../util/folderBrowser'
import '../../styles/settings.css'

const props = defineProps<{ open: boolean; title: string; roots: PickerRoot[] }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const newPath = ref('')

// Vue2's openAdd() resets newPath on every open — copying this behavior verbatim (don't let the previous input linger).
watch(
  () => props.open,
  (v) => {
    if (v) newPath.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
    <div data-test="fp-picker-body">
      <div class="set-fp-picker-roots">
        <button
          v-for="r in roots"
          :key="r.path"
          class="set-fp-picker-root"
          type="button"
          data-test="fp-picker-root"
          disabled
        >
          {{ r.label }}
        </button>
      </div>
      <div class="set-net-field" data-test="fp-picker-field">
        <input v-model="newPath" class="set-input" type="text" placeholder="/DATA">
      </div>
    </div>
    <template #footer>
      <button class="ui-btn" type="button" data-test="fp-picker-cancel" @click="emit('update:open', false)">
        {{ t('settingsCancel') }}
      </button>
      <!-- Policy three: always disabled this phase. Change to :disabled="!newPath.startsWith('/')" (Vue2 L169) when wiring it up. -->
      <button class="ui-btn" type="button" data-test="fp-picker-add" disabled>
        {{ t('settingsFpAddFolder') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.set-fp-picker-roots { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.set-fp-picker-root {
  padding: 8px 12px; border-radius: 10px; font-size: 13px; cursor: not-allowed;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
}
</style>

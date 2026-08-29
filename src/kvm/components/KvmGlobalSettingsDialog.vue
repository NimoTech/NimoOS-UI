<script setup lang="ts">
// Global settings dialog: entry point from the gear icon in the left bar; dialog changes storage path / default
// vCPU / default memory / autostart—four global settings. Visual 1:1 mirrors Vue2 KVMFullPage.vue template
// :516-556; data flow mirrors showGlobalSettings (:1075-1088) / saveGlobalSettings (:1090-1106).
//
// Form editing uses a local copy (local, reactive)—does not directly two-way bind useKvmHostInfo()'s settings
// ref. Reason (brief reminder + hard constraint of this task): settings is a shared composable state used by both
// Task 7 (create dialog) / Task 9 (VM settings dialog); if user edits values in this dialog then clicks ✕
// cancel, dirty values shouldn't stay in shared state and pollute other consumers' view of default values. Only
// after fetch() completes do we overwrite host.settings values into local; canceling edits doesn't affect shared state.
import { reactive, ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import KvmDialog from './KvmDialog.vue'
import { useKvmHostInfo } from '../composables/useKvmHostInfo'
import type { KvmWritableSettings } from '../composables/useKvmHostInfo'
import { useToast } from '../../stores/toast'

const props = defineProps<{ open: boolean }>()
// `saved` (P6 Task 8 addition; true defect fix identified in review): this component holds its own independent
// `useKvmHostInfo()` instance (see the "local copy for form editing" comment above), separate from the `KvmPage.vue`
// create dialog's other instance `hostInfo`—this is an intentional design of Task 2 (isolate local edit copies,
// canceling doesn't pollute shared state), but the cost is: save success here only updates **this single copy**
// `host.settings`; `KvmPage`'s `hostInfo.settings` (source of create dialog's `:defaults`) is completely unaware
// the value changed. Without this notification, after user changes global defaults and opens the create dialog,
// they still see old values—requiring a page refresh—this is a true defect detected in review testing, not
// "defer to the next task" technical debt. On save success, emit this extra event; parent (KvmPage) receiving it
// re-fetches its own copy, without breaking the "local copy isolation" boundary (passing hostInfo as props / making
// useKvmHostInfo a module-level singleton would both destroy Task 2's already-reviewed isolation design; review
// explicitly ruled out both approaches).
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [] }>()

const { t, te } = useI18n()
const toast = useToast()
const host = useKvmHostInfo()

const local = reactive<KvmWritableSettings>({
  storagePath: '', defaultVcpu: 0, defaultMemory: 0, autostart: false,
})

const saving = ref(false)
// ''=no error; otherwise is backend original text or i18n key name returned by useKvmHostInfo.save()—both cases
// are passed to errorText below to be judged by te()/t(), same as the existing pattern in InstallBanner.vue / ConsoleStage.vue.
const formError = ref('')
const errorText = computed(() => (formError.value && te(formError.value)) ? t(formError.value) : formError.value)

// In-place stale guard (hard constraint 5; don't extract common guard tool): the component itself is permanently
// mounted in KvmPage (v-model:open controls visibility, not v-if); theoretically only whole-page unmount (leaving /kvm
// route) triggers it, but fetch/save are both async operations, still need to handle per project convention.
let alive = true

// Per Vue2 showGlobalSettings (:1075-1087): open dialog first (props.open already drives KvmDialog display) then
// fetch data. immediate:true lets "direct mount with open=true" scenario (as in tests) also run through.
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  await host.fetch()
  if (!alive) return // responses arriving after dispose no longer overwrite local copy
  Object.assign(local, host.settings.value)
}, { immediate: true })

onUnmounted(() => {
  alive = false
  host.dispose()
})

async function onSave(): Promise<void> {
  if (saving.value) return
  saving.value = true
  formError.value = ''
  try {
    const err = await host.save({ ...local })
    if (!alive) return
    if (err === '') {
      // Hard constraint 2: success notification of "operation result" type goes to global toast, not inline in dialog.
      toast.show(t('kvmToastSettingsSaved'))
      emit('update:open', false)
      // See the comment at `saved` emit definition above: notify parent component to re-fetch its own
      // useKvmHostInfo() instance, otherwise create dialog's default values stay at pre-save old values.
      emit('saved')
    } else {
      // Hard constraint 2: errors in dialog go inline .cv-error, not toast (toast z-index 60 gets pushed under
      // dialog mask 900 + blur obscures it; prioritize displaying backend message as-is for debugging).
      formError.value = err
    }
  } finally {
    if (alive) saving.value = false
  }
}
</script>

<template>
  <KvmDialog :open="props.open" :title="t('kvmSettings')" @update:open="emit('update:open', $event)">
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmStoragePath') }}</label>
      <input v-model="local.storagePath" type="text" name="storagePath" class="cv-input" />
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDefaultVcpu') }}</label>
      <div class="cv-input-row cv-input-unit">
        <input v-model.number="local.defaultVcpu" type="number" name="defaultVcpu" min="1" class="cv-input" />
        <span class="cv-unit">{{ t('kvmCoresUnit') }}</span>
      </div>
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDefaultMemory') }}</label>
      <div class="cv-input-row cv-input-unit">
        <input v-model.number="local.defaultMemory" type="number" name="defaultMemory" min="256" step="256" class="cv-input" />
        <span class="cv-unit">MB</span>
      </div>
    </div>

    <div class="cv-field">
      <!-- Container deviation (declared): Vue2 uses buefy b-switch; New-UI lacks it → custom-draw .cv-switch
           (capsule shape, visual follows buefy switch). Native checkbox visually hidden (not using display:none;
           preserves keyboard reachability and native checked semantics), :checked adjacent sibling selector drives
           .cv-switch-track/.cv-switch-knob styles; no extra JS needed. -->
      <label class="cv-switch">
        <input v-model="local.autostart" type="checkbox" name="autostart" />
        <span class="cv-switch-track"><span class="cv-switch-knob"></span></span>
        <span>{{ t('kvmAutoStart') }}</span>
      </label>
    </div>

    <p v-if="errorText" class="cv-error">{{ errorText }}</p>

    <template #footer>
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': saving }"
        :disabled="saving"
        @click="onSave"
      >
        {{ t('kvmSave') }}
      </button>
    </template>
  </KvmDialog>
</template>

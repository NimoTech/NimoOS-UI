<script setup lang="ts">
// Pure graphical switch. Follows SnapshotSettingsDialog.vue's .ss-switch pattern (role=switch +
// aria-checked + aria-label), no visible text added — the label comes from the enclosing SettingsRow.
// Controlled component: holds no state, only emits; the parent decides to update v-model after persisting
// (switch-type operations must "flip only after a successful write" and bounce back on failure).
import '../styles/settings.css'

const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="set-switch"
    :class="{ on: modelValue }"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="toggle"
  ><span class="set-switch-thumb"></span></button>
</template>

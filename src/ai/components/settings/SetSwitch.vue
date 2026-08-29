<!--
  SP8-P2a Task 6 — 1:1 ported from Vue2 `src/views/AI/Settings/SetSwitch.vue` (25 lines).

  Self-drawn toggle: structure is just a div, visual entirely from `.sw` / `.sw[data-on]` CSS rules
  (see src/ai/styles/sk-shared.scss — that rule originally lived in Vue2
  `src/views/AI/Skills/skills-styles.scss:235-249`, Task 2 extraction of sk-shared.scss
  missed this segment by line range, Task 6 grep verification and added it, see source comment at addition site in that file).

  【Framework API difference, not behavior change】Vue2's v-model contract is `$emit('input', v)`,
  Vue3 is `update:modelValue`. Vue2 also emitted `change`, and all call sites used
  `@change` — so both are emitted here, call site syntax (`@change="v => ..."`) unchanged.
-->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{ modelValue: boolean; disabled?: boolean; title?: string }>(),
  { disabled: false, title: '' },
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'change', v: boolean): void
}>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
  emit('change', !props.modelValue)
}
</script>

<template>
  <div
    class="sw"
    :data-on="modelValue ? 'true' : 'false'"
    :title="title"
    role="switch"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : 'false'"
    @click="toggle"
  />
</template>

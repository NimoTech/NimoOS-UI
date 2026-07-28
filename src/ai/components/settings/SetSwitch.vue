<!--
  SP8-P2a Task 6 —— 1:1 移植自 Vue2 `src/views/AI/Settings/SetSwitch.vue`(25 行)。

  自绘开关:结构就是一个 div,视觉全靠 `.sw` / `.sw[data-on]` 的 CSS 规则
  (见 src/ai/styles/sk-shared.scss —— 该规则原在 Vue2
  `src/views/AI/Skills/skills-styles.scss:235-249`,Task 2 抽取 sk-shared.scss
  时按行号范围摘录漏收了这段,Task 6 grep 复核后补上,见该档追加处的来源注释)。

  【框架 API 差异,非行为改动】Vue2 的 v-model 契约是 `$emit('input', v)`,
  Vue3 是 `update:modelValue`。Vue2 同时还发了 `change`,而全部调用点用的都是
  `@change` —— 所以这里两个都发,调用点写法(`@change="v => ..."`)一字不用改。
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

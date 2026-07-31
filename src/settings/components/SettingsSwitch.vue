<script setup lang="ts">
// 纯图形开关。照 SnapshotSettingsDialog.vue 的 .ss-switch 写法(role=switch + aria-checked +
// aria-label),不新增可见文字 —— 标签由所在的 SettingsRow 提供。
// 受控组件:自己不持状态,只 emit,由父组件决定是否落库后再改 v-model
// (开关类操作要"写成功才翻",失败要能弹回去)。
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

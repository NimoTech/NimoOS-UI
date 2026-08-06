<!--
  SP8-P2a Task 6 —— 新建原语,替代 Vue2 `$buefy.dialog.prompt`(New-UI 没有
  带输入框的确认对话框)。结构照抄 `src/components/ui/AlertDialog.vue`,多一个
  绑本地 ref 的 <input>。

  【D2 同类问题】reka-ui 的 AlertDialogRoot 本身不销毁重建(常驻),所以每次
  `open` 由 false → true 都要把本地输入值重置为 initialValue —— 不重置的话,
  上一次弹窗输入的内容会原样带进这一次(同 settingsStore 单例导致的瞬态状态
  残留问题,见 store 侧的 resetTransientUi 处理)。
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AlertDialogRoot, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent,
  AlertDialogTitle, AlertDialogDescription,
} from 'reka-ui'

const props = withDefaults(
  defineProps<{
    open: boolean; title: string; message: string; placeholder?: string
    confirmText: string; cancelText: string; initialValue?: string
  }>(),
  { placeholder: '', initialValue: '' },
)
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', value: string): void }>()

const value = ref(props.initialValue ?? '')

watch(() => props.open, (o) => {
  if (o) value.value = props.initialValue ?? ''
})

function onConfirm() {
  emit('confirm', value.value)
  emit('update:open', false)
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="ui-dialog-overlay" />
      <AlertDialogContent class="ui-dialog-content">
        <AlertDialogTitle class="ui-dialog-title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="ui-alert-msg">{{ message }}</AlertDialogDescription>
        <input
          v-model="value"
          class="ui-dialog-input"
          :placeholder="placeholder"
          @keydown.enter="onConfirm"
        />
        <div class="ui-dialog-footer">
          <button type="button" class="ui-btn" data-testid="prompt-cancel" @click="onCancel">{{ cancelText }}</button>
          <button type="button" class="ui-btn" data-testid="prompt-confirm" @click="onConfirm">{{ confirmText }}</button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
/* 复用 AlertDialog.vue 的 .ui-dialog-* 类(scoped 样式不能跨组件共享,故复制)。
   AlertDialog.vue 里这些规则写的是「token + 裸色兜底」(如
   var(--popup-bg, rgba(20,23,35,0.95))) —— 本文件是新写的 .vue,受 color-guard
   全额约束,复制时去掉兜底、只留 token。 */
.ui-dialog-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.ui-dialog-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: 92vw; padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.ui-dialog-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
.ui-alert-msg { font-size: 14px; color: var(--fg-muted); margin: 0; }
.ui-dialog-input {
  display: block;
  width: 100%;
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg-hi);
  color: var(--fg);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.ui-dialog-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
</style>

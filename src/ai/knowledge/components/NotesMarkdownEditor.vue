<template>
  <div class="nme">
    <EditorContent :editor="editor" class="nme-content" />
  </div>
</template>

<script setup lang="ts">
// SP8-P5d Task 4 —— 1:1 移植自 Vue2 `NimoOS-UI`(main@7a6ee6b7)
// `src/views/AI/Knowledge/NotesMarkdownEditor.vue`(47 行)。
//
// K37(裁定 R2,附录 D §D.6.3):tiptap 四包锁 v2 线 —— `@tiptap/vue-3@^2.27.2` ·
// `@tiptap/starter-kit@^2.27.2` · `@tiptap/pm@^2.27.2`(peer,已显式列)·
// `tiptap-markdown@^0.8.10`(治理 K37/A-7 写的 `^0.6.1` 已作废,E-36:蓝本
// `package.json:74` 实际就是 `^0.8.10`,装 0.6.1 = 拿蓝本从未跑过的版本做 1:1 移植)。
//
// K38:`@tiptap/vue-2` → `@tiptap/vue-3`;`beforeDestroy` → `onBeforeUnmount`;
// v-model 契约 `value`/`$emit('input')` → `modelValue`/`update:modelValue`,且**保留**
// `input` 事件 —— 父组件(T7 `NoteEditPane.vue`)写的是
// `<NotesMarkdownEditor v-model="form.body" @input="dirty = true"/>`,Vue3 里 `@input`
// 是独立监听器、不会被 v-model 覆盖,子组件必须**同时**发两个 emit,否则"打字后标记
// 为脏"这个用户可见行为会静默丢失。
//
// K44:样式块(蓝本 :40-46)已在 T2 搬进 `knowledge.scss`(顶层 `.nme-content .ProseMirror`
// 例外段,治理 §6.2),本文件零 `<style>` 块;JS 侧不需要 side-effect import ——
// `knowledge.scss` 由 `KnowledgeLayout.vue` 早已全局 import(与 P5c 的 `parser-styles.scss`
// 不同,那是新样式文件、消费组件需要显式 import 才会挂进依赖图;`knowledge.scss` 是既有
// 常驻样式表,本组件的规则随它一起早已挂载,不需要本文件再 import 一次)。

import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
  (e: 'ready', editor: Editor): void
  (e: 'transaction'): void
}>()

const editor = ref<Editor>()

onMounted(() => {
  const ed = new Editor({
    extensions: [StarterKit, Markdown],
    content: props.modelValue,
    onUpdate: () => {
      const md = ed.storage.markdown.getMarkdown()
      emit('update:modelValue', md)
      emit('input', md)
    },
    // Lets the parent toolbar refresh its active states (bold/heading/…).
    onTransaction: () => { emit('transaction') },
  })
  editor.value = ed
  emit('ready', ed)
})

onBeforeUnmount(() => {
  if (editor.value) editor.value.destroy()
})

// §5.3 防回环:先比对 editor.storage.markdown.getMarkdown() 再 setContent,否则会在
// 每次 onUpdate 之后又被重设内容、光标跳回开头。
watch(
  () => props.modelValue,
  (v) => {
    if (editor.value && v !== editor.value.storage.markdown.getMarkdown()) {
      editor.value.commands.setContent(v)
    }
  },
)
</script>

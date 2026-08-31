<template>
  <div class="nme">
    <EditorContent :editor="editor" class="nme-content" />
  </div>
</template>

<script setup lang="ts">
// 1:1 ported from the Vue 2 panel's
// `src/views/AI/Knowledge/NotesMarkdownEditor.vue` (47 lines).
//
// K37 (ruling R2, Appendix D §D.6.3): tiptap four packages lock v2 line —
// `@tiptap/vue-3@^2.27.2` · `@tiptap/starter-kit@^2.27.2` · `@tiptap/pm@^2.27.2` (peer,
// explicitly listed) · `tiptap-markdown@^0.8.10` (governance K37/A-7 wrote `^0.6.1` now
// defunct, E-36: blueprint `package.json:74` actually `^0.8.10`, install 0.6.1 = use
// version blueprint never ran, do 1:1 port).
//
// K38: `@tiptap/vue-2` → `@tiptap/vue-3`; `beforeDestroy` → `onBeforeUnmount`;
// v-model contract `value`/`$emit('input')` → `modelValue`/`update:modelValue`, **keep**
// `input` event — parent component (T7 `NoteEditPane.vue`) wrote
// `<NotesMarkdownEditor v-model="form.body" @input="dirty = true"/>`, Vue3 `@input` is
// independent listener, not overridden by v-model, child must **emit both**, else "mark
// dirty after type" user-visible behavior silently lost.
//
// K44: style block (blueprint :40-46) already moved to `knowledge.scss` (top-level
// `.nme-content .ProseMirror` exception section, governance §6.2), this file zero `<style>`
// block; JS side no side-effect import needed — `knowledge.scss` already globally imported
// by `KnowledgeLayout.vue` (different from P5c's `parser-styles.scss`, that's new style
// file, consuming component needs explicit import to enter dependency graph; `knowledge.scss`
// is existing resident stylesheet, this component's rules already mounted with it, file
// doesn't need to import again).

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
    // Let parent toolbar refresh its active states (bold/heading/…).
    onTransaction: () => { emit('transaction') },
  })
  editor.value = ed
  emit('ready', ed)
})

onBeforeUnmount(() => {
  if (editor.value) editor.value.destroy()
})

// §5.3 anti-loop: compare editor.storage.markdown.getMarkdown() first before setContent,
// else after each onUpdate content reset again and cursor jumps to start.
watch(
  () => props.modelValue,
  (v) => {
    if (editor.value && v !== editor.value.storage.markdown.getMarkdown()) {
      editor.value.commands.setContent(v)
    }
  },
)
</script>

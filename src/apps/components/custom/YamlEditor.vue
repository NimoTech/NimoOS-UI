<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { monokai } from '@uiw/codemirror-theme-monokai'
import { yaml } from '@codemirror/lang-yaml'

// 照 CodeViewer.vue(files/viewers/CodeViewer.vue:87-97)的 CM6 构建模式——不做通用抽取回填
// CodeViewer(extract-not-predict,defer)。
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null
// 组件在异步场景下可能已被卸载(与 CodeViewer 同款防御,这里同步构造用不上但保持习惯一致)
let disposed = false

onMounted(() => {
  if (disposed) return
  const exts: Extension[] = [
    basicSetup,
    monokai,
    yaml(),
    keymap.of([indentWithTab]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
    }),
  ]
  view = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions: exts }),
    parent: host.value!,
  })
})

// 外部 modelValue 变化(如 tab2 转换写入)需要同步进编辑器——但只在真的不同于当前文档时才
// dispatch,否则用户敲字触发的 emit 经父组件 v-model 回写会被这个 watch 反过来再 setState 一次,
// 形成反馈环(且会打断光标位置/撤销栈)。
watch(() => props.modelValue, (v) => {
  if (!view) return
  if (v === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
})

onBeforeUnmount(() => {
  disposed = true
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="yaml-editor" data-test="yaml-editor"></div>
</template>

<style scoped>
.yaml-editor { width: 100%; height: 100%; overflow: auto; border-radius: var(--radius); border: 1px solid var(--card-border); }
.yaml-editor :deep(.cm-editor) { height: 100%; }
/* 行号/正文默认紧贴边框,加内边距留出呼吸空间(gutter 有主题底色,padding 保持底色连续) */
.yaml-editor :deep(.cm-gutters) { padding-left: 10px; }
.yaml-editor :deep(.cm-gutter.cm-lineNumbers .cm-gutterElement) { padding-right: 10px; }
.yaml-editor :deep(.cm-content) { padding: 10px 12px 10px 4px; }
</style>

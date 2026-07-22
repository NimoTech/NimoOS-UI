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
/* 12px 与终端/日志面板同档(2026-07-22 用户拍板:深底控制台类面板统一 12px,不用大卡片档 --radius) */
.yaml-editor { width: 100%; height: 100%; overflow: hidden; border-radius: 12px; border: 1px solid var(--card-border); }
.yaml-editor :deep(.cm-editor) { height: 100%; }
/* CM6 固定高度的标准配方:滚动发生在内部 .cm-scroller(行号 gutter 保持粘住),
   而不是外层盒子滚走整个编辑器——外层因此改 overflow:hidden。 */
.yaml-editor :deep(.cm-scroller) {
  overflow: auto;
  /* 编辑器永远是 monokai 深底:滚动条拇指用固定亮色 token,不随主题翻转(见 theme.css --console-scroll-thumb) */
  scrollbar-width: thin;
  scrollbar-color: var(--console-scroll-thumb) transparent;
}
.yaml-editor :deep(.cm-scroller)::-webkit-scrollbar { width: 16px; height: 16px; }
/* 轨道从两端各让开圆角距离+余量,滚动条只落在直边段内,不穿圆角
   (WebKit 轨道 margin 只在滚动条自身轴向生效) */
.yaml-editor :deep(.cm-scroller)::-webkit-scrollbar-track { background: transparent; margin: 16px; }
.yaml-editor :deep(.cm-scroller)::-webkit-scrollbar-thumb {
  background: var(--console-scroll-thumb);
  border: 5px solid transparent;
  background-clip: padding-box;
  border-radius: 8px;
}
.yaml-editor :deep(.cm-scroller)::-webkit-scrollbar-thumb:hover { background: var(--console-scroll-thumb-hover); background-clip: padding-box; }
/* 行号/正文默认紧贴边框,加内边距留出呼吸空间(gutter 有主题底色,padding 保持底色连续) */
.yaml-editor :deep(.cm-gutters) { padding-left: 10px; }
.yaml-editor :deep(.cm-gutter.cm-lineNumbers .cm-gutterElement) { padding-right: 10px; }
.yaml-editor :deep(.cm-content) { padding: 10px 12px 10px 4px; }
</style>

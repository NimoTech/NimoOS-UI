<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { monokai } from '@uiw/codemirror-theme-monokai'
import { yaml } from '@codemirror/lang-yaml'

// Follows the CM6 construction pattern of CodeViewer.vue (files/viewers/CodeViewer.vue:87-97) — no generic extraction
// backfilled into CodeViewer (extract-not-predict, defer).
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null
// The component may already be unmounted in async scenarios (same defense as CodeViewer; unused here with synchronous construction, but kept for consistency)
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

// External modelValue changes (e.g. writes from the tab2 conversion) must be synced into the editor — but only
// dispatch when it truly differs from the current document; otherwise an emit triggered by the user typing, written
// back through the parent's v-model, would make this watch setState again, forming a feedback loop (and breaking cursor position/undo stack).
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
/* 12px matches the terminal/log panel tier (2026-07-22 user decision: dark console-style panels use a uniform 12px, not the large-card --radius tier) */
.yaml-editor { width: 100%; height: 100%; overflow: hidden; border-radius: 12px; border: 1px solid var(--card-border); }
/* 10px top/right/bottom padding insets .cm-scroller from the rounded frame: the scrollbar hugs the scroll
   container's edge with no adjustable offset, so shrinking the container is the only universal way to move it off the border; the padding area is filled by monokai's .cm-editor background, visually continuous
   (2026-07-22 real-device gotcha: theme.css sets standard scrollbar-width/color on *, so Chrome 121+
   disables all ::-webkit-scrollbar customization — the previous width/track margin were dead code) */
.yaml-editor :deep(.cm-editor) { height: 100%; box-sizing: border-box; padding: 10px; }
/* Standard CM6 fixed-height recipe: scrolling happens inside .cm-scroller (line-number gutter stays pinned),
   rather than the outer box scrolling the whole editor away — hence the outer box uses overflow:hidden. */
.yaml-editor :deep(.cm-scroller) {
  overflow: auto;
  /* The editor is always monokai dark: the thumb uses a fixed light token, not flipped by theme (see theme.css --console-scroll-thumb) */
  scrollbar-width: thin;
  scrollbar-color: var(--console-scroll-thumb) transparent;
}
/* Left breathing room comes mainly from .cm-editor's 10px outer padding (which also keeps the horizontal scrollbar's left end off the frame);
   the gutter itself keeps only small padding to avoid stacking up too wide */
.yaml-editor :deep(.cm-gutters) { padding-left: 4px; }
.yaml-editor :deep(.cm-gutter.cm-lineNumbers .cm-gutterElement) { padding-right: 10px; }
/* Vertical breathing room is already provided by .cm-editor's 10px outer padding; only horizontal is kept here */
.yaml-editor :deep(.cm-content) { padding: 2px 12px 2px 4px; }
</style>

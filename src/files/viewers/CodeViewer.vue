<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { monokai } from '@uiw/codemirror-theme-monokai'
import ViewerShell from './ViewerShell.vue'
import Dialog from '../../components/ui/Dialog.vue'
import { coerceContent, langFor } from './codeContent'
import { fileExt } from '../util/ext'
import { useToast } from '../../stores/toast'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()
const toast = useToast()

const host = ref<HTMLElement | null>(null)
const dirty = ref(false)
const confirmOpen = ref(false)
let view: EditorView | null = null
// 组件在异步 onMounted 的 await 期间可能已被卸载(用户快速关闭覆盖层)——
// 卸载后必须放弃构造编辑器,否则会产生 onBeforeUnmount 跳过销毁的分离 EditorView 泄漏。
let disposed = false

// Vue2 CodeEditor showed the full path as a breadcrumb strip below the header
// (pathArray = item.path.substr(1).split('/')); reproduce it as a static,
// non-interactive trail (Vue2's items are all `active`, i.e. display-only).
const pathSegments = computed(() => props.item.path.replace(/^\/+/, '').split('/').filter(Boolean))

async function readCode(): Promise<string> {
  // Controller-verified: /v1/file/content is a standard envelope whose `data`
  // is the raw content STRING (not {content}) — but read defensively in case
  // the endpoint ever returns the typed `{content}` shape instead of a bare string.
  const raw = await service.file.getContent(props.item.path)
  return coerceContent(typeof raw === 'string' ? raw : (raw as { content?: unknown })?.content ?? raw)
}

async function save(): Promise<boolean> {
  if (!view) return false
  try {
    await service.file.update(props.item.path, view.state.doc.toString())
    dirty.value = false
    toast.show(t('filesViewerSaved'))
    return true
  } catch {
    toast.show(t('filesViewerSaveFailed'))
    return false
  }
}

function requestClose() {
  if (dirty.value) confirmOpen.value = true
  else emit('close')
}
// Each dialog action owns its own state transition + emit — do NOT gate the
// action behind an @update:open(false) watcher and do NOT clear state there.
// reka-ui fires update:open(false) on action-click and it can race a
// watcher-based approach (hard-won P2a/P3 lesson).
async function confirmSave() {
  const ok = await save()
  if (ok) {
    confirmOpen.value = false
    emit('close')
  }
}
function discardClose() {
  confirmOpen.value = false
  emit('close')
}

onMounted(async () => {
  let content: string
  try {
    content = await readCode()
  } catch {
    toast.show(t('filesViewerReadFailed'))
    return
  }
  if (disposed) return
  const lang = await langFor(fileExt(props.item.name))
  if (disposed) return
  const exts: Extension[] = [
    basicSetup,
    monokai,
    keymap.of([
      indentWithTab,
      { key: 'Mod-s', preventDefault: true, run: () => { save(); return true } },
    ]),
    EditorView.updateListener.of((u) => { if (u.docChanged) dirty.value = true }),
  ]
  if (lang) exts.push(lang)
  view = new EditorView({ state: EditorState.create({ doc: content, extensions: exts }), parent: host.value! })
})
onBeforeUnmount(() => {
  disposed = true
  view?.destroy()
  view = null
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="requestClose" @download="emit('download', props.item)">
    <template #toolbar>
      <button type="button" class="chip viewer-save" @click="save">{{ t('filesViewerSave') }}</button>
    </template>
    <div class="code-body">
      <nav class="code-breadcrumb">
        <template v-for="(seg, i) in pathSegments" :key="i">
          <span v-if="i > 0" class="crumb-sep">/</span>
          <span class="crumb">{{ seg }}</span>
        </template>
      </nav>
      <div ref="host" class="cm-host"></div>
    </div>
  </ViewerShell>

  <Dialog v-model:open="confirmOpen" :title="t('filesViewerWantSave')">
    <p style="color:var(--fg-muted,#9aa4bf)">{{ t('filesViewerUnsavedHint') }}</p>
    <template #footer>
      <button type="button" class="chip" @click="confirmOpen = false">{{ t('filesCancel') }}</button>
      <button type="button" class="chip" @click="discardClose">{{ t('filesViewerDontSave') }}</button>
      <button type="button" class="chip" @click="confirmSave">{{ t('filesViewerSave') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.code-body { display: flex; flex-direction: column; height: 100%; }
.code-breadcrumb {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  padding: 8px 18px; font-size: 12px; color: var(--fg-muted, #9aa4bf);
  border-bottom: 1px solid var(--card-border, rgba(255,255,255,0.1));
  flex: 0 0 auto;
}
.crumb-sep { opacity: 0.6; }
.cm-host { width: 100%; overflow: auto; flex: 1 1 auto; min-height: 0; }
.cm-host :deep(.cm-editor) { height: 100%; }
</style>

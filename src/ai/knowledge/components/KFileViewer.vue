<script setup lang="ts">
// SP8-P5e Task 4 — 1:1 ported from blueprint `KFileViewer.vue`
// (`NimoOS-UI@7a6ee6b7`, `src/views/AI/Knowledge/components/KFileViewer.vue:1-68`).
//
// 🔴 K44 (governance §3): `.vue` side zero `<style>` block — blueprint `<style scoped>`
// (:70-120) content already moved to `src/ai/styles/knowledge.scss` (inside `.knowledge-app`
// block, range :71-76 + :102-119, ruling R3.1/M-1 corrects range, original :103-119 would
// lose :102's `}`).
//
// 🔴 K46 (governance §3): blueprint :77-101 three `::v-deep` (`.overlay`/`.v-container`/
// `.doc-container`) patches not ported — those are positioning patches for Vue2
// `.file-panel .modal-card .overlay` ancestor chain. This repo's `DocViewer.vue`/
// `ExcelViewer.vue` **own templates zero these three classes** (self-proof see `KFileViewer.test.ts`
// and T2's `knowledgeStyles.test.ts`), they render self-contained `ViewerShell` whose
// `.overlay` already has `position: absolute; inset: 0; z-index: 200`
// (`src/files/viewers/ViewerShell.vue:24`) — host only needs `position: fixed; inset: 0;
// z-index: 1100` this layer "viewport-filling positioning ancestor", doesn't need Vue2's
// three patches (conversely: removing host's `fixed` collapses viewer into document flow,
// both directions are bug). K47 (host background bare value → `var(--bg-canvas)`) and three
// host positioning properties' assertion already in T2's `knowledgeStyles.test.ts`
// (`describe('knowledge.scss — K46 / K47 …')`), this round doesn't repeat.
//
// 🔴 N41 (governance §3.5): `FileDetailDrawer` and `KFileViewer` independently register/
// unregister their own `keydown` Esc listeners — blueprint's existing behavior (both when
// mounted simultaneously press Esc closes both), this round doesn't add `stopPropagation`/
// hierarchy management to "fix" it (that's effect only visible when T7 wires them).
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'
import KIcon from './KIcon.vue'
import DocViewer from '../../../files/viewers/DocViewer.vue'
import ExcelViewer from '../../../files/viewers/ExcelViewer.vue'
import type { FileEntry } from '../../../files/stores/files'
import type { FileVM } from '../util/searchAggregate'

const { t } = useI18n()

const props = defineProps<{ file: FileVM }>()
// Blueprint `<component :is="viewerComponent">` only binds `@close`, zero `@download` listener
// (see template below) — DocViewer/ExcelViewer's own `download` emit never forwarded on
// this path, blueprint's existing behavior, copied as-is not "fixed". `download` only emitted
// in fallback branch button, and emits `file` (entire prop) not `item` (blueprint :18, §2.7
// known inconsistency, copied as-is).
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', file: FileVM): void }>()

// Blueprint :37-43 — extension → viewer component mapping, case-insensitive (`:56` `.toLowerCase()`).
const VIEWER_MAP: Record<string, Component> = {
  docx: DocViewer,
  wps: DocViewer,
  xls: ExcelViewer,
  xlsx: ExcelViewer,
  csv: ExcelViewer,
}

// Blueprint :52-54. `FileEntry` only needs `name`/`path`/`is_dir` (verified
// `src/files/stores/files.ts:8-16`) ⇒ this literal's shape exactly fits `FileEntry`,
// no `as any` needed.
const item = computed<FileEntry>(() => ({
  path: props.file.fullPath,
  name: props.file.name,
  is_dir: false,
}))

// Blueprint :55-58.
const viewerComponent = computed<Component | null>(() => {
  const ext = ((props.file.name || '').split('.').pop() || '').toLowerCase()
  return VIEWER_MAP[ext] || null
})

// Blueprint :60-66 — `mounted`/`beforeDestroy` → `onMounted`/`onBeforeUnmount`
// (lifecycle rewrite, not divergence). Register/unregister with same function reference,
// criterion see `KFileViewer.test.ts`.
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="k-fileviewer-host">
    <component
      v-if="viewerComponent"
      :is="viewerComponent"
      :item="item"
      :list="[item]"
      @close="emit('close')"
    />
    <div v-else class="k-fileviewer-fallback">
      <header class="k-drawer-head">
        <div class="k-drawer-filename" :title="item.name">{{ item.name }}</div>
        <div class="k-drawer-head-spacer" />
        <button class="k-modal-x" @click="emit('close')"><KIcon name="x" :size="12" /></button>
      </header>
      <div class="k-fileviewer-empty">
        <KIcon name="file" :size="36" color="var(--text-quaternary)" />
        <p>{{ t('aiKbFvUnsupported') }}</p>
        <button class="k-btn primary" @click="emit('download', props.file)">
          <KIcon name="download" :size="12" /> {{ t('aiKbFdDownload') }}
        </button>
      </div>
    </div>
  </div>
</template>

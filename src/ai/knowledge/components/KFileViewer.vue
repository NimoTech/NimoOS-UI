<script setup lang="ts">
// SP8-P5e Task 4 —— 1:1 移植自蓝本 `KFileViewer.vue`
// (`NimoOS-UI@7a6ee6b7`,`src/views/AI/Knowledge/components/KFileViewer.vue:1-68`)。
//
// 🔴 K44(治理 §3):`.vue` 侧零 `<style>` 块 —— 蓝本 `<style scoped>`(:70-120)的内容
// 已由 T2 搬进 `src/ai/styles/knowledge.scss`(`.knowledge-app` 块内,范围
// `:71-76` + `:102-119`,裁定 R3.1/M-1 订正范围,原写 `:103-119` 会丢 `:102` 的 `}`)。
//
// 🔴 K46(治理 §3):蓝本 `:77-101` 的三条 `::v-deep`(`.overlay`/`.v-container`/
// `.doc-container`)补丁不搬 —— 那是给 Vue2 `.file-panel .modal-card .overlay`
// 祖先链打的定位补丁。本仓 `DocViewer.vue`/`ExcelViewer.vue` **自身模板零这三个类**
// (自证见 `KFileViewer.test.ts` 与 T2 的 `knowledgeStyles.test.ts`),它们渲染自带的
// `ViewerShell`,其 `.overlay` 已经 `position: absolute; inset: 0; z-index: 200`
// (`src/files/viewers/ViewerShell.vue:24`)—— host 只需保留
// `position: fixed; inset: 0; z-index: 1100` 这一层「铺满视口的定位祖先」,不需要
// 再补 Vue2 那三条(反过来:拿掉 host 的 `fixed` 会让预览器塌进文档流,两个方向都是 bug)。
// K47(host 底色具名裸值 → `var(--bg-canvas)`)与三个 host 定位属性的断言都已由 T2 放进
// `knowledgeStyles.test.ts`(`describe('knowledge.scss —— K46 / K47 …')`,本刀不重复。
//
// 🔴 N41(治理 §3.5):`FileDetailDrawer` 与 `KFileViewer` 各自独立注册/注销自己的
// `keydown` Esc 监听 —— 蓝本既有行为(两者同时挂载时按 Esc 会一起关两个),
// 本刀不加 `stopPropagation`/层级管理去"修好"它(那是 T7 接线时才会看到的效果)。
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
// 蓝本的 `<component :is="viewerComponent">` 只绑了 `@close`,零 `@download` 监听
// (见下方模板)—— DocViewer/ExcelViewer 自己的 `download` emit 在这条路径上从未被
// 转发,这是蓝本自身的既有行为,照抄不"修好"。`download` 只在 fallback 分支的按钮里发,
// 且发的是 `file`(整个 prop)而不是 `item`(蓝本 `:18`,§2.7 的既知不一致,照抄)。
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', file: FileVM): void }>()

// 蓝本 `:37-43` —— 扩展名 → viewer 组件的映射,大小写不敏感(`:56` 的 `.toLowerCase()`)。
const VIEWER_MAP: Record<string, Component> = {
  docx: DocViewer,
  wps: DocViewer,
  xls: ExcelViewer,
  xlsx: ExcelViewer,
  csv: ExcelViewer,
}

// 蓝本 `:52-54`。`FileEntry` 只必需 `name`/`path`/`is_dir`
// (实测 `src/files/stores/files.ts:8-16`)⇒ 这个字面量的形状恰好满足 `FileEntry`,
// 不需要 `as any`。
const item = computed<FileEntry>(() => ({
  path: props.file.fullPath,
  name: props.file.name,
  is_dir: false,
}))

// 蓝本 `:55-58`。
const viewerComponent = computed<Component | null>(() => {
  const ext = ((props.file.name || '').split('.').pop() || '').toLowerCase()
  return VIEWER_MAP[ext] || null
})

// 蓝本 `:60-66` —— `mounted`/`beforeDestroy` → `onMounted`/`onBeforeUnmount`(生命周期
// 改写,不算偏离)。用同一个函数引用注册与注销,判据见 `KFileViewer.test.ts`。
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

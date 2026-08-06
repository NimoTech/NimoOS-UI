<script setup lang="ts">
// SP8-P5e Task 5 —— 1:1 移植自蓝本 `FileDetailDrawer.vue`
// (`NimoOS-UI@7a6ee6b7`,`src/views/AI/Knowledge/components/FileDetailDrawer.vue`,220 行,
// 模板+脚本 `:1-220` 全部本刀移植)。
//
// 🔴 K44(治理 §3):`.vue` 侧零 `<style>` 块 —— scss 已由 T2 搬进 `src/ai/styles/knowledge.scss`。
//
// 🔴 emit 契约照抄(蓝本 `:186-190` 注释明写):`close` / `open({file})` / `download(file)` /
// `toast(message)`。**本组件不许直接调 `useToast()`** —— 由父组件(`SearchView.vue`,T6/T7)的
// `onDrawerToast` 接住后转发到全局 toast(K3 同族)。改了就是改组件契约,按 Critical。
//
// 🔴 N42(蓝本自带 `reqId` 过期守卫,`:148`/`:155`/`:159`/`:162`)—— 照抄,见 `fetchFull()`。
// `activeId` 是组件本地(`ref`,`<script setup>` 顶层,每个组件实例各有一份)——
// 「两实例交错」用例见 `FileDetailDrawer.test.ts`(判据:把它挪到模块级 → 必须报红)。
//
// 🔴 N43(蓝本 `:182-190` 的方法约定)—— 蓝本把 `submitDistill`/`notify` 写成独立方法是为了
// 让 Options API 的 method-style 测试(`fileDetailDrawerDistill.spec.js`)能整体 stub;
// `<script setup>` 没有 `methods` 对象,那份测法不可移植。行为承接:真挂载 + mock
// `service.notes.distillFile`,断言传的是 `file.fullPath`(不是 `file.path`,那是 dirname)。
//
// 🔴 N44 —— `canDistill` 用包内 `isDistillableName`(`@nimotech/nimoos-service`),
// 不在本仓重定义扩展名表(唯一定义处 = `NimoOS-Service/src/notes.ts` 的 `DISTILL_EXTS`)。
//
// 🔴 N41 —— `created`/`beforeDestroy` → `onMounted`/`onBeforeUnmount`(生命周期改写,不算
// 偏离)。与 `KFileViewer.vue` 各自独立注册/注销 `keydown` Esc —— 两者同时挂载时按 Esc 会
// 一起关掉,这是蓝本既有行为,不加 `stopPropagation`/层级管理去"修好"它。
// ⚠️ `fetchFull()` 的首次调用照蓝本放在“创建时”(对应 Vue2 `created()`,在此即 `<script
// setup>` 顶层、组件实例创建时同步执行),不挪进 `onMounted`——两者时机不同(created 早于
// mount),挪进 onMounted 会让首次数据请求延后到 DOM 挂载之后才发出,是可观察的时序偏移。
// Esc 监听的注册/注销按 N41 指示放在 onMounted/onBeforeUnmount。
//
// 🔴 K48 —— `highlight`/`fmtMtime`/`relLevel`/`relLabel` 从 `util/searchAggregate` import,
// 不在本文件重复定义(自证:`grep -c 'function highlight' FileDetailDrawer.vue` = 0)。
//
// 🔴 K49 —— 本组件三处 `v-html`(`.k-chunk-item-preview` / `.k-chunk-content` 各一处,
// 后者的内容来自 `viewerHtml`,同样经 `highlight()` 转义)消费 `highlight()` 的输出,
// 该函数已在 `util/searchAggregate.ts` 里先 escape 再插 `<mark>`,XSS 面已在那边测过。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDistillableName, service } from '@nimotech/nimoos-service'
import KIcon from './KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { fmtMtime, highlight, relLabel, relLevel } from '../util/searchAggregate'
import type { ChunkVM, FileVM } from '../util/searchAggregate'

// ─── K41(零 any)—— `loadChunkContext` 的后端原始响应体窄类型 ───
// 字段依据:`NimoOS-Search/service/authz.go` 的 `ChunkContextResponse`(`:96-101`)与
// `GetChunkWindow`(`:103-149`)。`anchor_chunk_no` 恒存在(请求里的 `chunk_no` 原样回显,
// `:146-148`);`chunks[]` 只保留窗口内命中的点,`page`/`offset_start`/`offset_end` 都带
// `omitempty`(空则整键消失,`chunk.go`/`authz.go` 的 struct tag),消费侧只用得到
// `chunk_no`/`text`,其余字段不读,故不声明。
interface ChunkContextChunkRaw {
  chunk_no: number
  text: string
}
interface ChunkContextRaw {
  anchor_chunk_no?: number
  chunks?: ChunkContextChunkRaw[]
}

const { t } = useI18n()
const store = useKnowledgeStore()

const props = withDefaults(defineProps<{ file: FileVM; query?: string }>(), { query: '' })
// 蓝本 `:186-190`:本组件的通知约定是 emit `toast`,不直接调用 toast 服务。
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open', payload: { file: FileVM }): void
  (e: 'download', file: FileVM): void
  (e: 'toast', message: string): void
}>()

// 蓝本 `data()`(`:98-102`)—— activeId 初值 = 首个 chunk 的 id 或 null。
const activeId = ref<string | null>(props.file.chunks.length ? props.file.chunks[0].id : null)
const fullText = ref('')
const loading = ref(false)

// 蓝本 `:104-107` computed `cur` —— `find` 落空退首个,再落空退 `{}`
// (只在 `file.chunks` 为空数组时触发,`as ChunkVM` 是蓝本这个动态兜底在类型层的等价表达,
// 不是 `any`)。
const cur = computed<ChunkVM>(
  () => props.file.chunks.find((c) => c.id === activeId.value) || props.file.chunks[0] || ({} as ChunkVM),
)
// 蓝本 `:108-111`。
const curIndex = computed(() => {
  const i = props.file.chunks.findIndex((c) => c.id === activeId.value)
  return i < 0 ? 0 : i
})
// 蓝本 `:112-115`。
const viewerHtml = computed(() => highlight(fullText.value || cur.value.snippet || '', props.query))
// 蓝本 `:119-125`(canDistill)—— N44。
const canDistill = computed(() => isDistillableName(props.file.name))

// 蓝本 `:143-144` methods.select/step。
function select(c: ChunkVM) {
  activeId.value = c.id
}
function step(delta: number) {
  const i = curIndex.value + delta
  if (i >= 0 && i < props.file.chunks.length) activeId.value = props.file.chunks[i].id
}

// 蓝本 `:145-163` fetchFull() —— N42:reqId 过期守卫是蓝本自带的,四处判断逐字照抄:
// ① `chunkNo == null` 早退(`:147`);② 成功分支的 `reqId` 判断(`:155`);
// ③ catch 分支的 `reqId` 判断(`:159`);④ finally 里 `loading` 也带判断(`:162`)。
async function fetchFull() {
  const c = cur.value
  if (!c || c.chunkNo == null) {
    fullText.value = ''
    return
  }
  const reqId = c.id
  loading.value = true
  fullText.value = ''
  try {
    const r = (await store.loadChunkContext({
      fileId: props.file.id,
      kind: c.kind,
      chunkNo: c.chunkNo,
      window: 2,
    })) as ChunkContextRaw
    if (activeId.value !== reqId) return
    const anchor = (r.chunks || []).find((x) => x.chunk_no === r.anchor_chunk_no)
    fullText.value = (anchor && anchor.text) || c.snippet || ''
  } catch {
    if (activeId.value !== reqId) return
    fullText.value = c.snippet || ''
  } finally {
    if (activeId.value === reqId) loading.value = false
  }
}

// 蓝本 `:141-142` watch —— 非 immediate(与 created() 里的显式首次调用配套,不重复触发)。
watch(activeId, () => fetchFull())

// 蓝本 `:164-181` copy() —— 两条路径:navigator.clipboard 成功优先;不存在/失败时走
// execCommand 兜底(HTTP-IP 非安全上下文下 `navigator.clipboard` 不存在)。
// 🔴 这个兜底是蓝本自带的、与笔记区(P5d 无兜底)不同源 —— 照抄,不许按 N 系列拒绝。
async function copy() {
  const plain = (fullText.value || cur.value.snippet || '').replace(/<[^>]+>/g, '')
  let ok = false
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(plain)
      ok = true
    } catch {
      ok = false
    }
  }
  if (!ok) {
    try {
      const ta = document.createElement('textarea')
      ta.value = plain
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      ok = false
    }
  }
  emit('toast', ok ? t('aiKbFdCopied') : t('aiKbFdCopyFailed'))
}

// 蓝本 `:182-197` —— submitDistill(方法引用)/notify(独立方法)的约定见文件头 N43 说明。
// 本仓 `<script setup>` 无 methods 对象,该约定的"可整体 stub"目的靠 mock
// `service.notes.distillFile` 达成,不保留方法引用的形式本身。
function notify(message: string) {
  emit('toast', message)
}
async function distillToNote() {
  try {
    // 🔴 N43 判据:传的是 `file.fullPath`(完整路径),不是 `file.path`(dirname)。
    await service.notes.distillFile(props.file.fullPath)
    notify(t('aiKbFdDistillQueued'))
  } catch {
    notify(t('aiKbFdDistillFailed'))
  }
}

// 蓝本 `created()`/`beforeDestroy()` 的 Esc 监听部分 —— N41:注册挪到 onMounted,
// 注销挪到 onBeforeUnmount(生命周期改写)。
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// 蓝本 `created()` 的另一半 —— 首次数据请求,时机对应 Vue2 的 created()(组件实例创建时
// 同步触发,早于挂载),故不挪进 onMounted,见文件头说明。
fetchFull()

// ── T5 DoD-12:自动上膛守卫 ──
// 父组件 `views/SearchView.vue` 由 T6 建,现在还不存在。见同目录
// `FileDetailDrawer.test.ts` 底部的文件系统条件断言:「若 SearchView.vue 存在,则它必须
// import 本组件」——现在惰性通过,T6 一创建文件立刻上膛强制接线。
</script>

<template>
  <div class="k-drawer-bg" @click="emit('close')">
    <aside class="k-drawer" @click.stop>
      <header class="k-drawer-head">
        <button class="k-drawer-back" @click="emit('close')" :title="t('aiKbFdBack')">
          <span style="transform: scaleX(-1); display: inline-flex"><KIcon name="chev" :size="14" /></span>
          <span>{{ t('aiKbFdResults') }}</span>
        </button>
        <div class="k-drawer-head-spacer" />
        <button class="k-modal-x" @click="emit('close')" :title="t('aiKbClose')"><KIcon name="x" :size="12" /></button>
      </header>

      <div class="k-drawer-fileinfo">
        <div class="k-rcard-icon" style="width: 40px; height: 48px">
          <span class="k-rcard-tag" :data-kind="file.kind">{{ file.kind.toUpperCase() }}</span>
        </div>
        <div style="flex: 1; min-width: 0">
          <div class="k-drawer-filename" :title="file.name">{{ file.name }}</div>
          <div class="k-rcard-meta" style="margin-top: 4px">
            <span class="k-rcard-meta-item"><KIcon name="folder" :size="11" /><span class="path">{{ file.path }}</span></span>
          </div>
          <div class="k-rcard-meta" style="margin-top: 3px">
            <span class="k-rcard-meta-item">{{ t('aiKbSrMatchTitle', { n: file.chunks.length }) }}</span>
            <span style="color: var(--text-quaternary)">·</span>
            <span class="k-rcard-meta-item">{{ t('aiKbSrModified') }} {{ fmtMtime(file.mtimeMs) }}</span>
          </div>
        </div>
        <div class="k-drawer-actions">
          <button class="k-btn outline" @click="emit('download', file)"><KIcon name="download" :size="12" /> {{ t('aiKbFdDownload') }}</button>
          <button v-if="canDistill" class="k-btn outline" @click="distillToNote"><KIcon name="edit" :size="12" /> {{ t('aiKbFdDistill') }}</button>
          <button class="k-btn primary" @click="emit('open', { file })"><KIcon name="arrowRight" :size="12" /> {{ t('aiKbFdOpenFile') }}</button>
        </div>
      </div>

      <div class="k-drawer-summary">
        {{ t('aiKbFdSummary', { n: file.chunks.length, query }) }}
      </div>

      <div class="k-drawer-body">
        <div class="k-chunk-list">
          <button
            v-for="(c, i) in file.chunks"
            :key="c.id"
            class="k-chunk-item"
            :data-active="String(c.id === activeId)"
            @click="select(c)"
          >
            <div class="k-chunk-rank">#{{ i + 1 }}</div>
            <div class="k-chunk-item-body">
              <div class="k-chunk-item-head">
                <span class="k-rel" :data-level="relLevel(c.score)"><span class="k-rel-dot" /> {{ relLabel(c.score) }}</span>
                <span class="k-chunk-loc">
                  {{ c.page ? t('aiKbFdPage', { n: c.page }) : t('aiKbFdSection', { n: i + 1 }) }}
                  <span style="color: var(--text-quaternary)"> · {{ Math.round(c.score * 100) }}%</span>
                </span>
              </div>
              <div class="k-chunk-item-preview" v-html="highlight(c.snippet, query)" />
            </div>
          </button>
        </div>

        <div class="k-chunk-viewer">
          <div class="k-chunk-viewer-head">
            <div class="k-chunk-viewer-title">
              <span class="k-rel" :data-level="relLevel(cur.score)"><span class="k-rel-dot" /> {{ relLabel(cur.score) }}</span>
              <span>{{ cur.page ? t('aiKbFdPage', { n: cur.page }) : t('aiKbFdPassage') }} · {{ t('aiKbSrSimilarity') }} {{ Math.round(cur.score * 100) }}%</span>
            </div>
            <div class="k-chunk-nav">
              <button class="k-row-action" :disabled="curIndex === 0" @click="step(-1)" :title="t('aiKbFdPrevSection')">
                <span style="transform: rotate(180deg); display: inline-flex"><KIcon name="chev" :size="14" /></span>
              </button>
              <span class="k-chunk-nav-count">{{ curIndex + 1 }} / {{ file.chunks.length }}</span>
              <button class="k-row-action" :disabled="curIndex === file.chunks.length - 1" @click="step(1)" :title="t('aiKbFdNextSection')">
                <span style="transform: scaleX(-1); display: inline-flex"><KIcon name="chev" :size="14" /></span>
              </button>
            </div>
          </div>
          <div class="k-chunk-content" v-html="viewerHtml" />
          <div class="k-chunk-viewer-foot">
            <button class="k-btn ghost" @click="copy"><KIcon name="check" :size="12" /> {{ t('aiKbFdCopy') }}</button>
            <!-- "跳到原文位置" intentionally removed for this version: jumping to
                 a specific PDF page reliably across @vue-office/pdf's progressive
                 render proved too brittle. Users open the file via the top
                 "打开原文件" button and scroll manually. -->
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

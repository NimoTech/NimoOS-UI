<script setup lang="ts">
// SP8-P5e Task 5 — 1:1 ported from blueprint `FileDetailDrawer.vue`
// (`NimoOS-UI@7a6ee6b7`, `src/views/AI/Knowledge/components/FileDetailDrawer.vue`, 220 lines,
// template+script :1-220 all ported this round).
//
// 🔴 K44 (governance §3): `.vue` side zero `<style>` block — scss already moved to
// `src/ai/styles/knowledge.scss` by T2.
//
// 🔴 emit contract copied as-is (blueprint :186-190 comments spell it out): `close` /
// `open({file})` / `download(file)` / `toast(message)`. **This component must not call
// `useToast()` directly** — parent component (`SearchView.vue`, T6/T7) `onDrawerToast`
// catches then forwards to global toast (same family as K3). Changing this is changing
// component contract, mark as Critical.
//
// 🔴 N42 (blueprint comes with `reqId` stale guard, :148/:155/:159/:162) — copy as-is,
// see `fetchFull()`. `activeId` is component-local (`ref`, top of `<script setup>`,
// each instance has its own) — “two instances interleaved” test in `FileDetailDrawer.test.ts`
// (criterion: move it to module-level → must fail).
//
// 🔴 N43 (blueprint :182-190 method convention) — blueprint wrote `submitDistill`/`notify`
// as standalone methods so Options API method-style test (`fileDetailDrawerDistill.spec.js`)
// could stub wholesale; `<script setup>` has no `methods` object, that test approach
// not portable. Behavior transfer: real mount + mock `service.notes.distillFile`, assert
// passes `file.fullPath` (not `file.path`, that's dirname).
//
// 🔴 N44 — `canDistill` uses in-package `isDistillableName` (`@nimotech/nimoos-service`),
// don't redefine extension table here (sole definition = `NimoOS-Service/src/notes.ts` `DISTILL_EXTS`).
//
// 🔴 N41 — `created`/`beforeDestroy` → `onMounted`/`onBeforeUnmount` (lifecycle rewrite,
// not divergence). With `KFileViewer.vue` each independently registers/unregisters `keydown`
// Esc — both when mounted simultaneously press Esc closes both, that's blueprint's existing
// behavior, don't add `stopPropagation`/hierarchy management to “fix” it.
// ⚠️ `fetchFull()` first call placed “at creation time” per blueprint (corresponds Vue2
// `created()`, here = `<script setup>` top level, runs sync at component instance creation),
// don't move into `onMounted` — their timing differs (created before mount), moving into
// onMounted delays first data request until after DOM mounts, observable timing divergence.
// Esc listener registration/unregistration per N41 in onMounted/onBeforeUnmount.
//
// 🔴 K48 — `highlight`/`fmtMtime`/`relLevel`/`relLabel` imported from `util/searchAggregate`,
// not redefined in this file (self-proof: `grep -c 'function highlight' FileDetailDrawer.vue` = 0).
//
// 🔴 K49 — this component three `v-html` places (`.k-chunk-item-preview` / `.k-chunk-content`
// one each, latter content from `viewerHtml`, also escaped by `highlight()`) consume
// `highlight()` output, function already escapes then inserts `<mark>` in
// `util/searchAggregate.ts`, XSS surface already tested there.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDistillableName, service } from '@nimotech/nimoos-service'
import KIcon from './KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { fmtMtime, highlight, relLabel, relLevel } from '../util/searchAggregate'
import type { ChunkVM, FileVM } from '../util/searchAggregate'

// ─── K41 (zero any) — `loadChunkContext` backend raw response body narrow type ───
// Field basis: `NimoOS-Search/service/authz.go` `ChunkContextResponse` (:96-101) and
// `GetChunkWindow` (:103-149). `anchor_chunk_no` always present (request `chunk_no` echoed
// as-is, :146-148); `chunks[]` keeps only window's hits, `page`/`offset_start`/`offset_end`
// all have `omitempty` (absent if empty, struct tag in `chunk.go`/`authz.go`), consumer only
// needs `chunk_no`/`text`, other fields unread, so not declared.
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
// Blueprint :186-190: this component's notification convention is emit `toast`, not direct
// toast service call.
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open', payload: { file: FileVM }): void
  (e: 'download', file: FileVM): void
  (e: 'toast', message: string): void
}>()

// Blueprint `data()` (:98-102) — activeId initial = first chunk's id or null.
const activeId = ref<string | null>(props.file.chunks.length ? props.file.chunks[0].id : null)
const fullText = ref('')
const loading = ref(false)

// Blueprint :104-107 computed `cur` — `find` fails, fall back to first, then fall back
// to `{}` (only triggers when `file.chunks` is empty array, `as ChunkVM` is blueprint's
// dynamic fallback at type level, not `any`).
const cur = computed<ChunkVM>(
  () => props.file.chunks.find((c) => c.id === activeId.value) || props.file.chunks[0] || ({} as ChunkVM),
)
// Blueprint :108-111.
const curIndex = computed(() => {
  const i = props.file.chunks.findIndex((c) => c.id === activeId.value)
  return i < 0 ? 0 : i
})
// Blueprint :112-115.
const viewerHtml = computed(() => highlight(fullText.value || cur.value.snippet || '', props.query))
// Blueprint :119-125 (canDistill) — N44.
const canDistill = computed(() => isDistillableName(props.file.name))

// Blueprint :143-144 methods.select/step.
function select(c: ChunkVM) {
  activeId.value = c.id
}
function step(delta: number) {
  const i = curIndex.value + delta
  if (i >= 0 && i < props.file.chunks.length) activeId.value = props.file.chunks[i].id
}

// Blueprint :145-163 fetchFull() — N42: reqId stale guard is blueprint's built-in, four
// checks copied verbatim: ① `chunkNo == null` early exit (:147); ② success branch
// `reqId` check (:155); ③ catch branch `reqId` check (:159); ④ finally `loading`
// also has check (:162).
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

// Blueprint :141-142 watch — non-immediate (pairs with explicit first call in created(),
// no duplicate trigger).
watch(activeId, () => fetchFull())

// Blueprint :164-181 copy() — two paths: navigator.clipboard succeeds first; when missing/
// fails falls back to execCommand (HTTP-IP non-secure context `navigator.clipboard` absent).
// 🔴 This fallback is blueprint's built-in, different origin from notes area (P5d has no
// fallback) — copy as-is, don't reject per N series.
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

// Blueprint :182-197 — submitDistill (method reference)/notify (standalone method)
// convention explained in file header N43. This repo's `<script setup>` has no `methods`
// object, convention's "can stub wholesale" goal achieved by mocking `service.notes.distillFile`,
// don't preserve method reference form itself.
function notify(message: string) {
  emit('toast', message)
}
async function distillToNote() {
  try {
    // 🔴 N43 criterion: passes `file.fullPath` (full path), not `file.path` (dirname).
    await service.notes.distillFile(props.file.fullPath)
    notify(t('aiKbFdDistillQueued'))
  } catch {
    notify(t('aiKbFdDistillFailed'))
  }
}

// Blueprint `created()`/`beforeDestroy()` Esc listener part — N41: registration moved to
// onMounted, unregistration moved to onBeforeUnmount (lifecycle rewrite).
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Blueprint `created()` other half — first data request, timing corresponds Vue2 `created()`
// (triggers sync at component instance creation, before mount), so don't move into onMounted,
// see file header explanation.
fetchFull()

// ── T5 DoD-12: auto-load guard ──
// Parent component `views/SearchView.vue` created by T6, doesn't exist yet. See bottom of
// `FileDetailDrawer.test.ts` same directory filesystem conditional assertion: "if
// SearchView.vue exists, it must import this component" — lazily passes now, T6 instantly
// loads file and enforces wiring."
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

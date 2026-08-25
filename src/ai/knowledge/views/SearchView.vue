<script setup lang="ts">
// SP8-P5e Task 6+7 — `SearchView.vue` (1:1 port from blueprint
// `NimoOS-UI@7a6ee6b7` `src/views/AI/Knowledge/SearchView.vue`, 401 lines).
//
// T6 scope (governance `p5e-plan.md` §T6, `p5e-coordinator-rulings-T0.md` R25):
//   Template `:1-119` (sticky search box + advanced panel + idle/loading/empty three states) +
//   `:158-162` (error state) + script constant block (`SAMPLE_QUERIES`/`FILE_TYPES`/
//   `MIME_PREFIXES`/`MTIMES`/`WEEK_MS`/`MONTH_MS`/`YEAR_MS`) +
//   `advEnabled`/`totalChunks` + `clear`/`quickSearch`/`toggleSet`/
//   `buildFilters`/`run` + `$route.query.q` watch.
// T7 scope (this phase continuation, `p5e-plan.md` §T7 · ruling R1 "Plan A"):
//   Result card list (`:121-156`) + two child component mount markup (`:164-172`) +
//   `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast` + two extension
//   constant sets (`:186-190`).
//
// ═══ 🔴 K44 — `.vue` side has zero `<style>` block (all SCSS moved to `src/ai/styles/knowledge.scss` by T2) ═══
//
// ═══ 🔴 K52 (ruling R1, Plan A) — file byte stream goes through `service.file.fileUrl()` + `getHttp()` ═══
// Governance K50: the implementation approach specified in the ruling
// (`getHttp().get('/v3/file', { params, responseType:'blob' })`) returns 401 100% of the time
// on real devices — `/v3/file` (`NimoOS/route/v2.go:237-266` `InitFile()`) is a bare
// `http.HandlerFunc` with zero JWT middleware, only reads `?token=` query parameter.
// `getHttp()` only sets the `Authorization` header and never appends token to query.
// User approved Plan A on 2026-08-05: switch to using
// `service.file.fileUrl(path)` (the only call that accepts this endpoint auth form) to construct
// the URL for this single XHR, still using `getHttp()` (Service repo unchanged).
// For `inline`, manually append `&inline=1` (backend truly supports it,
// `route/v2.go:257-261`). `window.open`/`<a href>` consume `URL.createObjectURL()`-produced
// `blob:` address, not `fileUrl()` itself — address bar/browser history/Referer contain no token.
// Trade-off: token enters this single background XHR query (merged into existing backend ticket
// "terminal WS token in access log"). `/v3/file` is not rewritten by `withVersion()` to
// `/v1/v3/file` (`.sp8/NimoOS-Service/src/http.ts:6-10` the `/^\/v[1-9]/` pattern passes
// through unchanged, `v3` matches).
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getHttp, service } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import FileDetailDrawer from '../components/FileDetailDrawer.vue'
import AssetDetailDrawer from '../components/AssetDetailDrawer.vue'
import KFileViewer from '../components/KFileViewer.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { chunkCount, fmtMtime, highlight, relLabel, relLevel, toFileResults } from '../util/searchAggregate'
import type { FileVM, SearchTextResponseRaw } from '../util/searchAggregate'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

// ─── Blueprint :186-219 script constants ───

// Blueprint :188. Browsers cannot natively preview these office formats —
// use in-app `@vue-office` viewer (`KFileViewer`), do not open a new tab.
const OFFICE_INAPP_EXTS = new Set(['docx', 'wps', 'xls', 'xlsx', 'csv'])
// Blueprint :190. Old binary office formats that neither browsers nor `@vue-office` can handle —
// can only prompt download.
const NO_PREVIEW_EXTS = new Set(['doc', 'ppt', 'pptx'])

// Blueprint :192. 🔴 N33: Five sample queries copy-as-is and pass through i18n —
// this repo does not use the blueprint's convention of "English phrase itself as key".
// T1 has materialized them as `aiKbSample*` keys (zh_cn.ts/en_us.ts); here we store key names.
// Template `t(s)` resolves to the true translated text (equivalent to blueprint's `$t(s)`
// dual-render semantics: button caption and search-box value on click are both translated text).
const SAMPLE_QUERIES = [
  'aiKbSampleThyroid',
  'aiKbSamplePythonAsync',
  'aiKbSampleContract',
  'aiKbSampleIphone',
  'aiKbSampleSkating',
]

// Blueprint :194-200. ⚠️ These five labels are bare literals, template `{{ t.label }}`
// does not go through `$t()` → not i18n'd, copy literals as-is (T1 i18n header comment already
// clarifies this; don't confuse with MTIMES/SAMPLE_QUERIES).
const FILE_TYPES = [
  { id: 'pdf', label: 'PDF', icon: '📕' },
  { id: 'md', label: 'Markdown', icon: '📝' },
  { id: 'txt', label: 'TXT', icon: '📃' },
  { id: 'doc', label: 'DOC', icon: '📚' },
  { id: 'code', label: 'Code', icon: '💻' },
]

// Blueprint :202-208. 🔴 N35: Copy verbatim, do not "complete" missing docling variants —
// these are the existing facts of backend MIME values; completing them would silently change
// filter results (on this machine, all 7 indexed files have MIME type text/plain;
// unchecking any class except TXT does not change the result set, see fixtures README §2③).
const MIME_PREFIXES: Record<string, string[]> = {
  pdf: ['text/markdown+docling/pdf', 'application/pdf'],
  md: ['text/markdown'],
  txt: ['text/plain'],
  doc: ['text/markdown+docling/docx', 'text/markdown+docling/pptx', 'text/markdown+docling/xlsx'],
  code: ['text/x-source'],
}

// Blueprint :210-215. Labels store key names (pass through `t()`), not literals —
// same handling as SAMPLE_QUERIES.
const MTIMES = [
  { id: 'any', label: 'aiKbSrMtimeAny' },
  { id: '1w', label: 'aiKbSrMtimeWeek' },
  { id: '1m', label: 'aiKbSrMtimeMonth' },
  { id: '1y', label: 'aiKbSrMtimeYear' },
]

// Blueprint :217-219. 🔴 N36: `1m` = 30 days, `1y` = 365 days (constants, not calendar
// months/years).
const WEEK_MS = 7 * 24 * 3600 * 1000
const MONTH_MS = 30 * 24 * 3600 * 1000
const YEAR_MS = 365 * 24 * 3600 * 1000

// ─── Blueprint data() (:224-244) — page-level ephemeral state, all component-local refs,
// none stored in store (governance §5.1) ───

const q = ref('')
const advOpen = ref(false)
// Blueprint :232 — initial value is all 5 types (K51: `ref<Set<string>>` + reassign
// wholesale, do not use `reactive(new Set())` to add/delete in place, see `toggleSet` below).
const types = ref<Set<string>>(new Set(['pdf', 'md', 'doc', 'txt', 'code']))
const mtime = ref('any')
const quality = ref<'fast' | 'accurate'>('fast')
const topK = ref(10)
type Phase = 'idle' | 'loading' | 'results' | 'empty' | 'error'
const phase = ref<Phase>('idle')
const results = ref<FileVM[]>([])
// N39: `clear()` also clears these two together (blueprint :264). Rendering belongs to T7,
// state declared in this phase.
const openFile = ref<FileVM | null>(null)
/** The album-asset hit currently expanded in AssetDetailDrawer (mutually exclusive with openFile). */
const openAsset = ref<FileVM | null>(null)

/**
 * Result-card click: a plain file opens the file detail drawer; an **album asset**
 * (`file_id` = `photos:<asset_id>`, a caption vector from the semantic source) opens
 * AssetDetailDrawer — media preview + caption, in place, so the result list is still there when
 * the user collapses it. The album lightbox (`#/photos?asset=<id>`, Photos' existing share
 * semantics, see `src/photos/composables/usePhotosDeepLinks.ts`) is one explicit button away,
 * see openInPhotos; it used to be the click's default and lost the search context every time.
 */
function openResult(r: FileVM) {
  if (r.photoAssetId) {
    openAsset.value = r
    return
  }
  openFile.value = r
}

function openInPhotos(assetId: string) {
  openAsset.value = null
  void router.push({ path: '/photos', query: { asset: assetId } })
}

/**
 * A thumbnail can 404 (Photos hasn't generated one yet for that asset, or it was pruned from the
 * cache). Dropping `thumbnailUrl` leaves the bare paper chip instead of a broken image in the
 * grid — see the template for why the kind tag is not the fallback here. One-way: we don't retry
 * within this result set.
 */
function onThumbError(r: FileVM) {
  r.thumbnailUrl = undefined
}
const viewerFile = ref<FileVM | null>(null)
const ms = ref(0)
const errorMsg = ref('')
const showRerankWarn = ref(false)
const lastQuery = ref('')

// ─── Blueprint computed (:246-251) ───

/**
 * Blueprint :247-249. 🔴 N34: The criterion is `types.size < FILE_TYPES.length` —
 * **all selected = not enabled** (counterintuitive, copy as-is without changes).
 * Any one of the four OR branches being true returns `true`.
 */
const advEnabled = computed(
  () =>
    types.value.size < FILE_TYPES.length ||
    mtime.value !== 'any' ||
    quality.value !== 'fast' ||
    topK.value !== 10,
)
/** Blueprint :250. */
const totalChunks = computed(() => chunkCount(results.value))

// ─── Blueprint methods ───

/** Blueprint :264. N39: Also clear `openFile`/`viewerFile` together. */
function clear() {
  q.value = ''
  phase.value = 'idle'
  results.value = []
  openFile.value = null
  openAsset.value = null
  viewerFile.value = null
}

/** Blueprint :265-268. */
function quickSearch(s: string) {
  q.value = s
  run()
}

/**
 * Blueprint :269-274 (original comment "mutate set then reassign for reactivity"). K51:
 * Copy to a new Set then reassign wholesale — 🔴 do not change to `reactive(new Set())`
 * adding/deleting in place (that would make `advEnabled`'s `types.size` dependency tracking
 * follow a different path, diverging from blueprint). ⚠️ Although the blueprint's method
 * signature accepts a `set` parameter, the reassignment target is hardcoded to `this.types`
 * (the only call site `toggleSet(types, t.id)` also only passes `types` itself) —
 * copy this pattern verbatim, do not "generalize" it to dynamic reassignment by passed reference.
 */
function toggleSet(set: Set<string>, v: string) {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  types.value = next
}

/**
 * Blueprint :275-289. 🔴 N35/N36 verbatim: all selected (`types.size === FILE_TYPES.length`)
 * does not send `mime_prefix`; only send when at least one type is unchecked, with prefixes
 * concatenated in `types` iteration order (Set insertion order). Only send `mtime_after_ms`
 * when `mtime !== 'any'`; the three tiers' constants see `WEEK_MS`/`MONTH_MS`/`YEAR_MS` above.
 */
function buildFilters(): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (types.value.size < FILE_TYPES.length) {
    const prefixes: string[] = []
    for (const ty of types.value) {
      for (const p of MIME_PREFIXES[ty] || []) prefixes.push(p)
    }
    if (prefixes.length) f.mime_prefix = prefixes
  }
  if (mtime.value !== 'any') {
    const map: Record<string, number> = { '1w': WEEK_MS, '1m': MONTH_MS, '1y': YEAR_MS }
    f.mtime_after_ms = Date.now() - map[mtime.value]
  }
  return f
}

// 🔴 Governance §5.2 — blueprint has no such guard; newly added this phase
// (K15 family, 9th instance). Three concurrent entry points: `run()` (enter/button) ·
// `quickSearch()` · watch of `route.query.q` below — all three ultimately call this same
// `run()`, guard only needs to be added in one place. `runEpoch` is a variable declared
// at top level of `<script setup>`: Vue SFC's `<script setup>` compiles to a `setup()`
// function body that runs once per component instance, so the `let` declared here is
// **component-instance-local closure variable**, not module-level shared state — the "two
// instances interleaved" test case (see `SearchView.test.ts`) locks in this point, with
// the criterion "move it to module-level shared state → must fail red" (manual RED probe,
// see report, does not become a permanent test file).
let runEpoch = 0

/**
 * Blueprint :290-316. Branches: empty query → `'idle'` and no request sent;
 * success with results → `'results'`; success with zero results → `'empty'`;
 * error thrown → `'error'`. 🔴 N37: do not set `ms` in catch block (elapsed time from
 * previous success is retained, but that block does not render when `phase==='error'`).
 * 🔴 Stale guard (governance §5.2, blueprint has none): `myEpoch` captures the current
 * issue number; after await, compare with `runEpoch` — mismatch means a newer request
 * is in flight/landed, discard this request's update directly without overwriting
 * `results`/`ms`/`phase`/`errorMsg`. Both success and catch branches must be guarded
 * (blueprint has no such guard; this was proactively added because "phase directly drives
 * full-screen render, user-visible", a real bug, not part of blueprint behavior).
 */
async function run() {
  const query = q.value.trim()
  if (!query) {
    phase.value = 'idle'
    return
  }
  lastQuery.value = query
  phase.value = 'loading'
  showRerankWarn.value = false
  const myEpoch = ++runEpoch
  const t0 = Date.now()
  try {
    const r = (await store.runSearch({
      query,
      filters: buildFilters(),
      topK: topK.value,
      rerank: quality.value === 'accurate',
    })) as SearchTextResponseRaw
    if (myEpoch !== runEpoch) return
    const elapsed = Date.now() - t0
    results.value = toFileResults(r)
    ms.value = elapsed
    if (r.warnings && r.warnings.includes('rerank_unavailable')) {
      showRerankWarn.value = true
      // N38: Blueprint's `setTimeout` has no cleanup (:309), copy as-is — callback still
      // runs after component unmount, but in Vue 3 writing a ref of an unmounted component
      // has no side effect and no warning, so do not add onBeforeUnmount.
      setTimeout(() => {
        showRerankWarn.value = false
      }, 5000)
    }
    phase.value = results.value.length ? 'results' : 'empty'
  } catch (e) {
    if (myEpoch !== runEpoch) return
    phase.value = 'error'
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    errorMsg.value = (err.response && err.response.data && err.response.data.error) || err.message || String(e)
  }
}

/**
 * Blueprint :346-355 `fetchBlobUrl`. 🔴 K52/ruling R1 (Plan A, see file header explanation):
 * do not use `getHttp().get('/v3/file', {params, responseType:'blob'})` (that approach
 * returns 401 100% of the time on this backend) — instead use the URL string from
 * `service.file.fileUrl(fullPath)` (the only form of authentication this endpoint accepts)
 * to make the same `getHttp()` XHR. When `inline` is true, manually append `&inline=1`
 * (backend truly supports it, `route/v2.go:257-261`), otherwise `inline` is not in URL.
 * 🔴 **`responseType: 'blob'` is a hard assertion** — `blob` brings the true MIME type from
 * response `Content-Type`, `arraybuffer` drops it, and new tab becomes download instead of
 * preview (criterion: change to `'arraybuffer'` → test must fail red). Return value is a
 * same-origin `blob:` address produced by `URL.createObjectURL()` — `window.open`/`<a href>`
 * must consume this, not `fileUrl()` itself (address bar/browser history/Referer contain no
 * token, the privacy payoff of K52 lands here).
 */
async function fetchBlobUrl(fullPath: string, opts: { inline?: boolean } = {}): Promise<string> {
  const url = service.file.fileUrl(fullPath) + (opts.inline ? '&inline=1' : '')
  const resp = await getHttp().get(url, { responseType: 'blob' })
  return URL.createObjectURL(resp.data as Blob)
}

/**
 * Blueprint :357-380 `openOriginal`. Route by extension: office in-app format → `viewerFile`
 * (no request sent); old office format without previewer → toast prompt to download
 * (no request sent); everything else → open blob URL in new tab (browser native preview
 * is fast). 🔴 Extension extraction is `(file.name || '').split('.').pop().toLowerCase()`
 * (`|| ''` is TS-level defensive for `.pop()` return type `string | undefined`, same as
 * `KFileViewer.vue`, at runtime never triggers on non-empty array — not a behavior change) —
 * **a filename with no extension treats the entire name as ext** (e.g., a filename happens
 * to be `docx` with zero extension would be misparsed as in-app-previewable), copy as-is,
 * do not "fix".
 */
async function openOriginal(payload: { file: FileVM }) {
  const file = payload.file
  if (!file || !file.fullPath) {
    store.toast(t('aiKbSrNoPath'))
    return
  }
  const ext = ((file.name || '').split('.').pop() || '').toLowerCase()
  if (OFFICE_INAPP_EXTS.has(ext)) {
    viewerFile.value = file
    return
  }
  if (NO_PREVIEW_EXTS.has(ext)) {
    store.toast(t('aiKbSrNoPreviewToast'))
    return
  }
  try {
    const url = await fetchBlobUrl(file.fullPath, { inline: true })
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) store.toast(t('aiKbSrPopupBlocked'))
    // N38 family: blueprint's native 60s delayed cleanup, copy as-is.
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    const err = e as { message?: string } | undefined
    // `String(...)` only lets TS (`e: unknown`) compile — JS's `+` does the same implicit
    // ToString on non-string operands anyway; runtime output is identical to blueprint's
    // `... + e` verbatim, not a behavior change.
    store.toast(t('aiKbSrOpenFailed') + ': ' + String((err && err.message) || e))
  }
}

/**
 * Blueprint :382-397 `downloadFile`. Fetch bytes → create `<a download>` → trigger click
 * → cleanup. 🔴 All steps must be asserted: `a.download` has `file.name || 'download'`
 * fallback · `rel` · `document.body.removeChild(a)` is truly called (otherwise DOM leak) ·
 * 60s delayed `revokeObjectURL`.
 */
async function downloadFile(file: FileVM) {
  if (!file || !file.fullPath) {
    store.toast(t('aiKbSrNoPath'))
    return
  }
  try {
    const url = await fetchBlobUrl(file.fullPath)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name || 'download'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    const err = e as { message?: string } | undefined
    store.toast(t('aiKbSrDownloadFailed') + ': ' + String((err && err.message) || e))
  }
}

/**
 * Blueprint :398 `onDrawerToast`. `FileDetailDrawer`'s notification contract is to emit `toast`
 * (blueprint `:186-190` comment), forwarded by parent to the store's toast action
 * (`store.toast` internally calls `useToast().show(msg, 2400)`, governance §5.1).
 * 🔴 Do not let the child component directly call `useToast()` — that changes the blueprint's
 * component contract.
 */
function onDrawerToast(msg: string) {
  store.toast(msg)
}

/**
 * Blueprint :252-261 watch('$route.query.q', {immediate:true}). 🔴 N40: must use reactive
 * `watch`, not just read once in `onMounted` (memory `newui-router-query-only-no-remount`:
 * when user changes address bar, nothing runs if only in onMounted). Condition
 * `v && v !== q.value` — do not re-search when query matches current `q`.
 */
watch(
  () => route.query.q,
  (v) => {
    if (v && v !== q.value) {
      q.value = v as string
      run()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <!-- Sticky search box -->
      <div class="k-search-sticky">
        <div class="k-search-sticky-inner">
          <div class="k-search-box">
            <KIcon name="search" :size="16" color="var(--text-tertiary)" />
            <input
              type="text"
              :placeholder="t('aiKbSrPlaceholder')"
              v-model="q"
              @keydown.enter="run"
              autofocus
            />
            <button v-if="q" class="k-search-clear" @click="clear">
              <KIcon name="x" :size="10" />
            </button>
            <button class="k-btn primary" :disabled="!q.trim()" @click="run">
              <KIcon name="search" :size="12" /> {{ t('aiKbSearch') }}
            </button>
          </div>

          <button class="k-adv-toggle" :data-open="String(advOpen)" @click="advOpen = !advOpen">
            <span class="chev"><KIcon name="chev" :size="11" /></span>
            <KIcon name="settings" :size="12" />
            {{ t('aiKbSrAdvanced') }}
            <span v-if="advEnabled" style="color: var(--accent); font-weight: 600">· {{ t('aiKbSrAdvOn') }}</span>
          </button>

          <div v-if="advOpen" class="k-adv-panel">
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrFileType') }}</div>
              <div class="k-adv-chips">
                <button
                  v-for="ft in FILE_TYPES"
                  :key="ft.id"
                  class="k-adv-chip"
                  :data-on="String(types.has(ft.id))"
                  @click="toggleSet(types, ft.id)"
                >
                  <span>{{ ft.icon }}</span> {{ ft.label }}
                </button>
              </div>
            </div>
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrModified') }}</div>
              <div class="k-adv-chips">
                <button
                  v-for="m in MTIMES"
                  :key="m.id"
                  class="k-adv-chip"
                  :data-on="String(mtime === m.id)"
                  @click="mtime = m.id"
                >
                  {{ t(m.label) }}
                </button>
              </div>
            </div>
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrQuality') }}</div>
              <div class="k-seg">
                <button :data-on="String(quality === 'fast')" @click="quality = 'fast'">
                  <KIcon name="play" :size="10" /> {{ t('aiKbSrQualityFast') }}
                </button>
                <button :data-on="String(quality === 'accurate')" @click="quality = 'accurate'">
                  <KIcon name="target" :size="10" /> {{ t('aiKbSrQualityAccurate') }}
                </button>
              </div>
              <div v-if="showRerankWarn" class="k-rerank-warn">
                {{ t('aiKbSrRerankWarn') }}
              </div>
            </div>
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrTopK') }}</div>
              <div class="k-seg">
                <button
                  v-for="n in [5, 10, 20, 50]"
                  :key="n"
                  :data-on="String(topK === n)"
                  @click="topK = n"
                >
                  {{ n }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- States -->
      <div v-if="phase === 'idle'" class="k-empty">
        <div class="k-empty-illust"><KIcon name="search" :size="36" /></div>
        <div class="k-empty-title">{{ t('aiKbSrIdleTitle') }}</div>
        <div class="k-empty-sub">
          {{ t('aiKbSrIdleSub') }}
        </div>
        <div class="k-empty-tips">
          <div
            style="
              font-size: 11px;
              color: var(--text-quaternary);
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-weight: 600;
              margin-top: 8px;
            "
          >
            {{ t('aiKbTry') }}
          </div>
          <div class="k-hero-suggest" style="justify-content: center">
            <button v-for="s in SAMPLE_QUERIES" :key="s" class="k-suggest-chip" @click="quickSearch(t(s))">
              {{ t(s) }}
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'loading'" class="k-results">
        <div class="k-result-count">
          <span class="k-skel" style="display: inline-block; width: 200px; height: 12px" />
        </div>
        <div v-for="i in 6" :key="i" class="k-skel-rcard">
          <div class="k-skel" style="width: 30px; height: 36px" />
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <div class="k-skel" style="width: 40%; height: 14px" />
            <div class="k-skel" style="width: 100%; height: 12px" />
            <div class="k-skel" style="width: 90%; height: 12px" />
            <div class="k-skel" style="width: 35%; height: 10px" />
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'empty'" class="k-empty">
        <div class="k-empty-illust"><KIcon name="search" :size="32" /></div>
        <div class="k-empty-title">{{ t('aiKbSrEmptyTitle') }}</div>
        <div class="k-empty-sub">{{ t('aiKbSrEmptySub') }}</div>
        <div class="k-empty-tips">
          <div class="k-empty-tip"><KIcon name="edit" :size="12" /> {{ t('aiKbSrEmptyTipKeyword') }}</div>
          <div class="k-empty-tip"><KIcon name="folder" :size="12" /> {{ t('aiKbSrEmptyTipIndexed') }}</div>
          <div class="k-empty-tip"><KIcon name="settings" :size="12" /> {{ t('aiKbSrEmptyTipAllowlist') }}</div>
        </div>
      </div>

      <!-- phase === 'results': Blueprint :121-156 (T7). -->
      <div v-else-if="phase === 'results'" class="k-results">
        <div class="k-result-count">
          <b>{{ results.length }}</b> {{ t('aiKbSrCountFiles') }} ·
          <b>{{ totalChunks }}</b> {{ t('aiKbSrCountMatches') }} · for <b>"{{ lastQuery }}"</b>
          <span style="color: var(--text-quaternary); margin-left: 6px">
            <!-- Blueprint :125 `v-if="ms"` — 🔴 when ms === 0 does not render (falsy),
            not an empty string placeholder. -->
            <span v-if="ms"> · {{ ms }} ms</span>
          </span>
        </div>
        <div v-for="r in results" :key="r.id" class="k-rcard" @click="openResult(r)">
          <!-- An album-asset hit (`file_id` = `photos:<asset_id>`) has no file path to show,
               so it gets a thumbnail instead; everything else keeps the paper chip + kind tag.
               See the PHOTO_ID_PREFIX comment in searchAggregate.ts. -->
          <div class="k-rcard-icon">
            <img
              v-if="r.thumbnailUrl" class="k-rcard-thumb" :src="r.thumbnailUrl" :alt="r.name"
              loading="lazy" @error="onThumbError(r)"
            />
            <!-- The kind chip is deliberately not a fallback for a failed album thumbnail:
                 `kindFromMime` only knows the document kinds, so `video/mp4` would come out
                 labelled DOC. The card name already reads Photo/Video, so an album asset whose
                 thumbnail 404s keeps the bare paper chip. -->
            <span v-else-if="!r.photoAssetId" class="k-rcard-tag" :data-kind="r.kind">{{ r.kind.toUpperCase() }}</span>
          </div>
          <div class="k-rcard-body">
            <div class="k-rcard-head">
              <div class="k-rcard-name">{{ r.name }}</div>
              <!-- 🔴 :title and visible text are two different i18n keys (blueprint :135-136),
              do not merge. -->
              <span class="k-match-pill" :title="t('aiKbSrMatchTitle', { n: r.chunks.length })">
                <KIcon name="search" :size="10" /> {{ t('aiKbSrMatchPill', { n: r.chunks.length }) }}
              </span>
              <span class="k-rel" :data-level="relLevel(r.score)" :title="`${t('aiKbSrSimilarity')} ${(r.score * 100).toFixed(0)}%`">
                <span class="k-rel-dot" /> {{ relLabel(r.score) }}
              </span>
            </div>
            <!-- Blueprint :142: `r.chunks[0] && r.chunks[0].snippet` — files with zero
            chunks must not throw. K49: v-html consumes escaped output from highlight(),
            XSS surface already tested at util layer, here we add real DOM assertion after
            component-layer render (see test file). -->
            <div class="k-rcard-snippet" v-html="highlight(r.chunks[0] && r.chunks[0].snippet, lastQuery)" />
            <!-- Blueprint :143: v-if uses chunks.length > 1, text uses chunks.length - 1
            (both sides need test cases). -->
            <div v-if="r.chunks.length > 1" class="k-more-hint">
              <span class="chev"><KIcon name="chev" :size="11" /></span>
              {{ t('aiKbSrMoreHint', { n: r.chunks.length - 1 }) }}
            </div>
            <div class="k-rcard-meta">
              <!-- An album asset shows its folder when Photos resolved one, else the library
                   locator; never the "Modified" item — mtime is the capture time, which the
                   drawer labels properly. -->
              <template v-if="r.photoAssetId">
                <span class="k-rcard-meta-item"><KIcon name="folder" :size="11" /><span class="path">{{ r.path || t('aiKbSrPhotoLibrary') }}</span></span>
              </template>
              <template v-else>
                <span class="k-rcard-meta-item"><KIcon name="folder" :size="11" /><span class="path">{{ r.path }}</span></span>
                <span style="color: var(--text-quaternary)">·</span>
                <span class="k-rcard-meta-item">{{ t('aiKbSrModified') }} {{ fmtMtime(r.mtimeMs) }}</span>
              </template>
              <span style="color: var(--text-quaternary)">·</span>
              <span class="k-rcard-meta-item"><KIcon name="check" :size="11" color="var(--success)" /> {{ t('aiKbStatusIndexed') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'error'" class="k-empty">
        <div class="k-empty-illust" style="color: var(--danger)"><KIcon name="danger" :size="32" /></div>
        <div class="k-empty-title">{{ t('aiKbSrErrorTitle') }}</div>
        <div class="k-empty-sub">{{ errorMsg }}</div>
      </div>

      <!-- Blueprint :164-172 (T7). FileDetailDrawer receives all four listeners
      (T5 DoD-12 auto-chambered guard satisfied at this point); onDrawerToast
      forwards the child component's toast contract to store.toast. -->
      <FileDetailDrawer
        v-if="openFile"
        :file="openFile"
        :query="lastQuery"
        @close="openFile = null"
        @open="openOriginal"
        @download="downloadFile"
        @toast="onDrawerToast"
      />

      <AssetDetailDrawer
        v-if="openAsset"
        :file="openAsset"
        :query="lastQuery"
        @close="openAsset = null"
        @open-photos="openInPhotos"
      />

      <KFileViewer v-if="viewerFile" :file="viewerFile" @close="viewerFile = null" @download="downloadFile" />
    </div>
  </div>
</template>

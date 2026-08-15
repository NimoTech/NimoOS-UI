<!--
  SP8-P5c Task 7 — "Parser test sandbox" page (route `/ai/parser/test`), 1:1 ported from Vue2 blueprint
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/ParserTest.vue` (369 lines,
  read via `git show main:` — governance §1: that repo's working tree is old branch, not trustworthy).

  🔴 **This cut covers template (blueprint :1-152) + script (blueprint :154-243) = 242 lines only.**
     Blueprint `<style lang="scss" scoped>` (:245-369, 125 lines) task T2b already moved to
     `.parser-app .parser-test-page` section in `src/ai/styles/parser-styles.scss` and reviewed
     → **this file zero `<style>` blocks**, styles via K24 JS-side side-effect import.

  Structure comparison (blueprint line ranges → this file template):
    :3-6     page header: title + `← Back to details` router-link (`/ai/parser`)
    :8-18    help card: two paragraphs (second has two `<code>` extension lists)
    :21-93   upload card: drop zone · three parameter inputs + reset · query + rerank + OCR · submit + ok-hint · error-box
    :96-150  result area (`<template v-if="result">`): docling card (collapsible) · scored card · chunks card
    :159-176 data() 10 transient items (all component-local ref, governance §5.1: don't stuff store)
    :178-240 onDrop / onFile / clearFile / resetParams / submit / chunkText / truncate / fmtBytes

  ─────────────────────────────────────────────────────────────────────────────
  【K31 — root element must be two layers】 (coordinator ruled 2026-08-03, governance §3 K31)
    `<div class="parser-app"><div class="parser-test-page">…</div></div>`
    —**extra DOM layer vs blueprint**. Outer `.parser-app` carries only K22's three structural attributes
    (`height:100vh; height:100dvh; overflow-y:auto`, see `parser-styles.scss:68-72`),
    inner `.parser-test-page` is blueprint :246-250's `padding:16px; max-width:900px; margin:0 auto`.
    🔴 Why cannot squash to single element: `src/styles/theme.css:318` is `body{overflow:hidden}`,
    `/ai/parser/test` is **top-level route** (not under KnowledgeLayout), content without self-made scroll container
    never visible (K22); if scroll container also is that 900px centered column, `overflow-y:auto` scrollbar
    lands at **column's right edge (roughly screen center on wide)**, whereas Vue2 scrolls whole page with scrollbar
    at **viewport's right edge** — that is **user-visible interface not 1:1**. Extra DOM layer invisible to user, pick latter.
    ⚠️ Plan `p5c-plan.md` §T7 still shows pre-K31 `class="parser-app parser-test-page"` (single element,
    governance §12.3 E-14 already corrected that line in T6), **already superseded by K31**;
    authority priority: governance + appendix > brief > plan. Precedent: `ParserStatus.vue` (T6) same two layers.

  【K24 — styles via JS-side import, zero `<style>` blocks】 `import '../../styles/parser-styles.scss'`
    (independent file made by T2b). Blueprint's scoped isolation became K9's "rules scoped to page context" in New-UI.
    Precedent: `KnowledgeLayout.vue:43` / `AgentPage.vue:72` / `SettingsPage.vue:70` / `ParserStatus.vue:108`.
    ⏳ Governance §12.3 **E-13** history: **at T7 landing** this page **zero production imports** (`/ai/parser/test`
    still pointed to placeholder in `knowledgeRoutes.ts`) → module never entered Vite graph → this side-effect import never evaluated
    → **then** not finding `parser-test-page` in `dist/assets/*.css` was expected, that gate was moved to T10.
    ✅ **P5c T10 (2026-08-04) reversed routes, gate now passing**: product `.parser-app .parser-test-page`
    measured **53 hits** (composite forms 0 = K31 working). **This import now truly in production CSS, don't delete.**

  【K27 — REST goes through the shared package, and **single-argument call**】
    Blueprint :216-219 is
      `api.post('/ai/parser/test/analyze', fd, { headers:{'Content-Type':'multipart/form-data'}, timeout:120000 })`
    This repo writes `service.ai.parserTestAnalyze(fd)` — 🔴 **no second argument passed**:
    the package method signature at `NimoOS-Service/src/ai.ts:673-680` only accepts `FormData`; internally it
    **already** adds the multipart header + a dedicated 120s timeout (the comment there states "matches Vue2
    `ParserTest.vue:207-219` verbatim").
    Passing it again would be redundant, and the types don't even allow it.

  【K1 — single-layer data unwrap】Blueprint :220 is `this.result = resp.data`; the package already `return res.data`
    → this repo's `result.value = await service.ai.parserTestAnalyze(fd)` **has no `.data` layer**.
    The package's return type is `Promise<unknown>` → the `as AnalyzeResult` here closes the type (HTTP shape as-is,
    snake_case, zero transformation, field names match the fixture verbatim).

  【Zero KIcon】(governance §1.2 / E-2 / N16) neither of the two Parser page blueprints uses any KIcon — they use
    emoji and plain-text buttons. **Don't "conveniently switch to KIcon"** (that would break the 1:1 UI match).

  【N16 — emoji/symbol positions copied verbatim, none may move in/out of `t()`】
    All **outside** `t()`: `←` (:5 before the back link) · `×` (:35 clear button) · `✓` (:80 before ok-hint) ·
      `▼` / `▶` (:100 docling collapse arrow) · `⚠` (:110 `⚠ Reranker error:`) ·
      `·` (U+00B7, :80-82 ok-hint separator dots / :136 chunk-head / :145 sparse joiner) ·
      `…` (U+2026, :141 trailing `, …]` in the dense preview)
    **Inside** `t()` (i.e. baked into the key's value): `…` in `aiKbPtProcessing` (Processing…) · full-width
      punctuation `（）；，` in several key values (one of the 18 exceptions in Appendix A §A.5) · `–` (U+2013)
      in `aiKbPtDefaults`'s `5–20`
    **Produced by the script**: `…` is `truncate()`'s ellipsis marker (:234, U+2026)
    🔴 This page's title has **no** emoji (blueprint :4 is a bare `<h2>{{ $t('Parser test sandbox') }}</h2>`) —
      `🧪` belongs to `ParserStatus.vue:6` and `SettingsView.vue:162`, **not this page** (brief §4.3's line
      "`🧪` (title)" is wrong, logged as **E-15**).

  【N18 — `result.scored.indexOf(s) + 1` used as the rank number, copied as-is】(blueprint :115)
    O(n²) and relies on object identity (the `s` from `v-for` is the same reference as the array element).
    On this machine `scored` has at most 20 items → **not observable error behaviour** → keep it as-is.
    🔴 **Do not change to `v-for="(s, i) in …"` and use `i + 1`** (an unrelated drive-by change).

  【N22 — none of the hardcoded technical identifiers/parameter names get an i18n key added】(governance §3.5 N22)
    `rerank top-20` (:65) · `⚠ Reranker error:` (:110) · `dense [0:8]:` (:140) · `sparse top:` (:144) ·
    `chunk #` (:119 / :135) · `cos` (:116) · `rr` (:118) · the three `<label>`s'
    `target_tokens` (:41) / `overlap_tokens` (:45) / `min_tokens` (:49) ·
    `chunker=…, target=…, overlap=…, min=…` (:84-87) · `{{ c.token_count }} tokens · offset …` (:136) ·
    `chunks` (the English unit word in the ok-hint at :80).
    🔴 **Adding a key would create a key Vue2 never had, and filling both en/zh with English would be pure noise.**

  【Four facts measured under governance §4.2 — expected behaviour, not a defect】
    ① `.md`/`.txt` **never produces `docling_markdown`** → the entire docling card at :98 never renders.
    ② `scored[]` **has no `rerank_score`** → `rr {…}` at :117-118 never renders.
    ③ 🔴 **This machine's reranker is broken** (`XLMRobertaTokenizer has no attribute prepare_for_model`)
       → checking `rerank top-20` only ever shows the `⚠ Reranker error:` warning bar, **the `rr` score is never
       seen**. **A backend defect, already filed as a backend ticket (governance §8.2); this period we copy the
       frontend as-is, don't fix it, don't work around it.**
    ④ `params_used.overlap_tokens` gets rewritten by the backend based on the chunker (markdown → always 0,
       plain → unchanged) → the ok-hint echo at :83-88 shows the **`params_used` the backend returned**, not the
       `params` the frontend sent. **This lines up exactly with the `<em>` hint at :56 — not a frontend bug.**

  【🔴 The 422 branch is unreachable — copy the value-extraction chain as-is, no array branch, no unit test】
    (governance §4.2 / §5.1)
    When no file is passed the backend returns **422** with `{"detail":[{…}]}` — `detail` is an **array** (FastAPI
    validation error), inconsistent with the string `detail` contract of other endpoints.
    🔴 But **the UI can never reach this branch**: the submit button's `:disabled="!file || loading"` (:76) blocks
    "submit without choosing a file"; `submit()`'s opening `if (!file) return` blocks it a second time.
    → Copy the `detail || e.message || String(e)` value-extraction chain at :222-223 as-is, **do not add an array
      branch for it** (that would be logic invented out of nowhere); **do not write a unit test for it either**
      (testing a path the UI can never reach is a no-op).

  【K34 — mechanical type-safety rewrite (4 spots, **all preserve-throw, zero behaviour change**)】
    🔴 **Unified stance (review M-1, 2026-08-04): always use the "preserve-throw" style (`as` / `!`), never a
    fallback with `?.` / `&&`.**
    Rationale: `?.` and a newly added `&&` would **silently turn** the `TypeError` the blueprint throws **into a
    no-op** — that's a behaviour change, conflicting with K34 requirement ②("truly zero behaviour change"), and
    also self-contradicting point 4 below's own argument (the first draft used `?.`/`&&` for 1/2/3 and `!` for 4 —
    two opposite judgements in the same file).
    **The criterion is fidelity to the blueprint, not "not throwing is safer."** After rewriting all four spots
    `vue-tsc` still exits 0 → proving `!`/`as` are enough to satisfy strict mode, so those three `?.`/`&&` were
    superfluous from the start.

    1. `$refs.fileInput.click()` (blueprint :29) → a template ref inside `<script setup>`:
       `const fileInput = ref<HTMLInputElement | null>(null)` + template **`fileInput!.click()`**.
       Vue 3 has no options-API `$refs` (inside `<script setup>` the ref variable *is* the element).
       The `!` is purely a type-level statement → when the ref is null this still throws the same TypeError,
       verbatim consistent with the blueprint.
    2. `onFile($event.target.files[0])` (blueprint :27) → **`($event.target as HTMLInputElement).files![0]`**
       — `EventTarget` has no `files` property (needs `as`), and `FileList | null` can't be indexed directly
       (needs `!`). Both sides throw when `files` is null. Precedent: `ParserStatus.vue:262`'s
       `($event.target as HTMLInputElement).checked` uses the same `as`.
    3. `e.dataTransfer.files && e.dataTransfer.files[0]` (blueprint :180) →
       **`e.dataTransfer!.files && e.dataTransfer!.files[0]`** — `DragEvent.dataTransfer`'s type is
       `DataTransfer | null`, only add `!`. 🔴 That middle `&&` is **the blueprint's own short-circuit**, copy it
       as-is; the extra `e.dataTransfer &&` added in the first draft has been removed (that one was the actual
       behaviour change).
    4. **`result.value!.chunks`** inside `chunkText()` (blueprint :229 is the bare `this.result.chunks`) —
       when `result` is null this still throws the same TypeError; `?.` would quietly turn it into "return an
       empty string" = a behaviour change.
       (`chunkText` is only ever called inside `<template v-if="result">` → in practice unreachable.)
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import '../../styles/parser-styles.scss'

const { t } = useI18n()

/* ═══ Response shape of `POST /v1/parser/test/analyze` ═══
 * 🔴 HTTP shape as-is, snake_case: the package method `service.ai.parserTestAnalyze` only does `return res.data`
 * (`NimoOS-Service/src/ai.ts:673-680`, zero transformation) → field names match
 * `.superpowers/sdd/p5c-fixtures/parser-test-analyze-*.json` verbatim.
 * The optional fields are exactly the ones governance §4.2 measured as "this machine never sends"
 * (`docling_markdown` / `rerank_error` / `scored` / `rerank_score`) — **the `v-if` guards in the template exist
 * precisely for them, don't simplify them away**. */
interface SparseTerm {
  token_id: number
  weight: number
}
interface AnalyzeChunk {
  chunk_no: number
  text: string
  token_count: number
  offset_start: number
  offset_end: number
  dense_preview?: number[]
  sparse_top_terms?: SparseTerm[]
}
interface AnalyzeScored {
  chunk_no: number
  cos_sim: number
  /** 🔴 This machine never sends this (governance §4.2 fact ②) — the blueprint's double guard at :117 exists for it. */
  rerank_score?: number | null
}
interface AnalyzeParamsUsed {
  target_tokens: number
  overlap_tokens: number
  min_tokens: number
  chunker: string
}
interface AnalyzeResult {
  mime: string
  /** Backend echo field, unused by the blueprint template — kept to match the real response shape. */
  filename: string
  size: number
  /** Backend echo field, unused by the blueprint template. */
  text_length: number
  chunk_count: number
  chunks: AnalyzeChunk[]
  params_used?: AnalyzeParamsUsed
  /** Backend echo field, unused by the blueprint template. */
  query?: string
  scored?: AnalyzeScored[]
  rerank_error?: string
  docling_markdown?: string
}

/* ═══ Blueprint data() (:159-176) — all 10 items are page-level transients, all component-local refs (governance §5.1: don't stuff the store) ═══ */
const file = ref<File | null>(null)
const query = ref('')
const rerank = ref(false)
const ocr = ref(false)
const loading = ref(false)
const result = ref<AnalyzeResult | null>(null)
const error = ref<string | null>(null)
const dragActive = ref(false)
const doclingOpen = ref(false)
/** 🔴 Use `ref` rather than `reactive`: the blueprint's `resetParams()` (:199) does a **whole-object reassignment**
 *  `this.params = { … }`, and `ref`'s `params.value = { … }` corresponds to it verbatim. */
const params = ref<{ target_tokens: number; overlap_tokens: number; min_tokens: number }>({
  target_tokens: 600,
  overlap_tokens: 80,
  min_tokens: 2,
})

/** Blueprint :27's `ref="fileInput"` + :29's `$refs.fileInput.click()` (mechanical rewrite 1). */
const fileInput = ref<HTMLInputElement | null>(null)

/**
 * Blueprint onDrop(e) (:178-182) — turn off the highlight first, then take the first file, and only hand it to
 * onFile if one was found.
 * K34-3: only add `!` to `e.dataTransfer` (its type is `DataTransfer | null`); the middle `&&` is
 * **the blueprint's own short-circuit**, copied as-is. Throws the same TypeError as the blueprint when null.
 */
function onDrop(e: DragEvent): void {
  dragActive.value = false
  const f = e.dataTransfer!.files && e.dataTransfer!.files[0]
  if (f) onFile(f)
}

/**
 * Blueprint onFile(f) (:183-192).
 * 🔴 **The order and "doesn't clear `file`" are copied verbatim**: when over 30 MB it **only sets `error` and
 * returns** — it clears neither the already-selected `file` nor `result`, and never sends a request. So dropping
 * an oversized file **leaves the previous selection and the previous result on screen**, just with an extra
 * red-bordered error added.
 * (The `30 * 1024 * 1024` threshold is also copied as-is, not written out as `31457280`.)
 */
function onFile(f: File | null | undefined): void {
  if (!f) return
  if (f.size > 30 * 1024 * 1024) {
    error.value = t('aiKbPtTooBig')
    return
  }
  file.value = f
  error.value = null
  result.value = null
}

/** Blueprint clearFile() (:193-197) — clears all three. */
function clearFile(): void {
  file.value = null
  result.value = null
  error.value = null
}

/** Blueprint resetParams() (:198-200) — resets the three values to defaults (identical to data()'s initial values). */
function resetParams(): void {
  params.value = { target_tokens: 600, overlap_tokens: 80, min_tokens: 2 }
}

/**
 * Blueprint submit() (:201-227).
 * 🔴 The **order and values of FormData's nine fields are copied verbatim** (blueprint :208-215):
 *    file · query (**only appended when `query` is non-empty**, an empty string is not sent) · embed (**always
 *    `'true'`**) · rerank (ternary `'true'`/`'false'`) · ocr (same) · target_tokens / overlap_tokens / min_tokens
 *    (all three wrapped in `String()`).
 * 🔴 K27: `parserTestAnalyze(fd)` takes a **single argument** — the multipart header and the 120s timeout both
 * live inside the package.
 * 🔴 K1: the package already strips one layer, **there is no `.data`**.
 */
async function submit(): Promise<void> {
  if (!file.value) return
  loading.value = true
  error.value = null
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', file.value)
    if (query.value) fd.append('query', query.value)
    fd.append('embed', 'true')
    fd.append('rerank', rerank.value ? 'true' : 'false')
    fd.append('ocr', ocr.value ? 'true' : 'false')
    fd.append('target_tokens', String(params.value.target_tokens))
    fd.append('overlap_tokens', String(params.value.overlap_tokens))
    fd.append('min_tokens', String(params.value.min_tokens))
    result.value = (await service.ai.parserTestAnalyze(fd)) as AnalyzeResult
  } catch (e) {
    /* 🔴 The value-extraction chain at blueprint :222-223 is **unchanged, character for character**.
     * The two 400 cases (out-of-range target_tokens / unsupported extension) have a string `detail` → goes
     * straight into `.error-box`; the 422 case (no file passed) has an **array** `detail` — but that path is
     * unreachable from the UI (see the file-header comment), so **no array branch is added for it**. `as string`
     * is purely a type-level closure, it doesn't change the runtime value extraction. */
    const err = e as { response?: { data?: { detail?: unknown; error?: unknown } }; message?: string }
    const detail = err.response && err.response.data && (err.response.data.detail || err.response.data.error)
    error.value = (detail || err.message || String(e)) as string
  } finally {
    loading.value = false
  }
}

/** Blueprint chunkText(chunkNo) (:228-231) — returns an empty string when not found. See mechanical rewrite 4 in the file header for the non-null assertion. */
function chunkText(chunkNo: number): string {
  const c = result.value!.chunks.find((x) => x.chunk_no === chunkNo)
  return c ? c.text : ''
}

/** Blueprint truncate(s, n) (:232-235) — only truncates when strictly `> n` (`= n` is returned unchanged); the ellipsis marker is U+2026. */
function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

/**
 * Blueprint fmtBytes(n) (:236-240) — three tiers, all boundaries use `<` (strictly less than):
 * `< 1024` → `n + ' B'` (integer, no decimal) · `< 1024*1024` → `(n/1024).toFixed(1) + ' KB'` ·
 * otherwise `(n/1024/1024).toFixed(2) + ' MB'`. 🔴 Don't add `Intl`, don't change the tier boundaries, don't
 * unify the decimal places.
 */
function fmtBytes(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}
</script>

<template>
  <div class="parser-app">
    <!-- K31: the outer `.parser-app` = K22's scroll container (height:100dvh + overflow-y:auto),
         the inner `.parser-test-page` = the blueprint's 900px centered column. See the file-header comment for
         the rationale.
         ⚠️ This comment must be placed **inside** the outer div: putting it in the first position of
         `<template>` would give the component an extra comment root node, and VTU's `wrapper.element` would no
         longer be that div (T6 already hit this). -->
    <div class="parser-test-page">
      <!-- Page header (blueprint :3-6) — N16: `←` is outside t(); this page's title has **no emoji** -->
      <header class="page-header">
        <h2>{{ t('aiKbPtTitle') }}</h2>
        <router-link to="/ai/parser" class="back-link">← {{ t('aiKbPtBackLink') }}</router-link>
      </header>

      <!-- Help card (blueprint :8-18) — the two <code> extension lists are technical identifiers, don't put
           them into i18n (N22); the comma after `<strong>` and the period at the end of the paragraph are both
           bare punctuation in the template, copied verbatim -->
      <div class="card help-card">
        <p>
          {{ t('aiKbPtHelp1') }}
          <strong>{{ t('aiKbPtHelpNoWrite') }}</strong>, {{ t('aiKbPtHelpPreviewOnly') }}.
        </p>
        <p class="small">
          {{ t('aiKbPtSupports') }} <code>.md .txt .html .json .csv .py .go .ts .java</code>,
          {{ t('aiKbPtAsWellAs') }} <code>.pdf .docx .pptx .xlsx</code> {{ t('aiKbPtViaDocling') }}.
          {{ t('aiKbPtMaxSize') }}
        </p>
      </div>

      <!-- Upload + query input (blueprint :20-93) -->
      <div class="card upload-card">
        <div class="dropzone"
             :class="{ active: dragActive, has: !!file }"
             @dragover.prevent="dragActive = true"
             @dragleave.prevent="dragActive = false"
             @drop.prevent="onDrop">
          <!-- K34-1/2: `files![0]` and `fileInput!.click()` are both **preserve-throw** style — only adding
               type-level `as` / `!`; when `files` or the ref is null they throw the same TypeError as the
               blueprint (no `?.` fallback) -->
          <input ref="fileInput" type="file" hidden
                 @change="onFile(($event.target as HTMLInputElement).files![0])" />
          <div v-if="!file">
            <button class="pick-btn" @click="fileInput!.click()">{{ t('aiKbPtChooseFile') }}</button>
            <span class="hint">{{ t('aiKbPtDragDrop') }}</span>
          </div>
          <div v-else class="file-meta">
            <strong>{{ file.name }}</strong>
            <span class="hint">{{ fmtBytes(file.size) }}</span>
            <!-- N16: `×` (U+00D7) is outside t() -->
            <button class="clear-btn" @click="clearFile">×</button>
          </div>
        </div>

        <!-- Three parameter inputs (blueprint :39-53) — N22: the three <label>s' parameter names are technical
             identifiers, don't put them into i18n; `v-model.number` copied as-is (not changed to `v-model` +
             manual Number()) -->
        <div class="row params-row">
          <label class="param">
            target_tokens
            <input type="number" min="50" max="4000" step="50" v-model.number="params.target_tokens" />
          </label>
          <label class="param">
            overlap_tokens
            <input type="number" min="0" max="400" step="10" v-model.number="params.overlap_tokens" />
          </label>
          <label class="param">
            min_tokens
            <input type="number" min="1" max="200" v-model.number="params.min_tokens" />
          </label>
          <button class="reset-btn" @click="resetParams" type="button">{{ t('aiKbPtReset') }}</button>
        </div>
        <div class="hint-line">
          {{ t('aiKbPtDefaults') }}
          <em>{{ t('aiKbPtOverlapNote') }}</em>
        </div>

        <div class="row">
          <input class="query-input"
                 v-model="query"
                 :placeholder="t('aiKbPtQueryPlaceholder')" />
          <!-- N22: `rerank top-20` is a technical identifier, don't put it into i18n -->
          <label class="checkbox">
            <input type="checkbox" v-model="rerank" />
            rerank top-20
          </label>
          <label class="checkbox">
            <input type="checkbox" v-model="ocr" />
            {{ t('aiKbPtOcr') }}
          </label>
        </div>

        <div class="row">
          <button class="submit-btn"
                  @click="submit"
                  :disabled="!file || loading">
            {{ loading ? t('aiKbPtProcessing') : t('aiKbPtRun') }}
          </button>
          <!-- ok-hint (blueprint :79-89) — N16: `✓` and the three `·` (U+00B7) are outside t();
               N22: `chunks` / `chunker=` / `target=` / `overlap=` / `min=` all stay out of i18n.
               🔴 Governance §4.2 fact ④: what's echoed here is the **`params_used` the backend returned**, not
               the `params` the frontend sent (when `.md` goes through the markdown chunker, `overlap_tokens` is
               always rewritten to 0). -->
          <span v-if="result" class="ok-hint">
            ✓ {{ result.chunk_count }} chunks ·
            {{ fmtBytes(result.size) }} ·
            {{ result.mime }} ·
            <em v-if="result.params_used">
              chunker={{ result.params_used.chunker }},
              target={{ result.params_used.target_tokens }},
              overlap={{ result.params_used.overlap_tokens }},
              min={{ result.params_used.min_tokens }}
            </em>
          </span>
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>
      </div>

      <!-- Results (blueprint :95-150) -->
      <template v-if="result">
        <!-- Docling markdown preview (only when docling actually ran) — blueprint :97-104.
             🔴 Governance §4.2 fact ①: `.md`/`.txt` never produces `docling_markdown` → this card never renders
             on this machine.
             N16: `▼`/`▶` are outside t(). -->
        <div v-if="result.docling_markdown" class="card docling-card">
          <button class="toggle" @click="doclingOpen = !doclingOpen">
            {{ doclingOpen ? '▼' : '▶' }}
            {{ t('aiKbPtDoclingToggle', { n: result.docling_markdown.length }) }}
          </button>
          <pre v-show="doclingOpen" class="docling-md">{{ result.docling_markdown }}</pre>
        </div>

        <!-- Query scoring (blueprint :106-124) -->
        <div v-if="result.scored && result.scored.length" class="card scored-card">
          <h3>{{ t('aiKbPtScoredTitle', { n: result.scored.length }) }}</h3>
          <!-- N22: the whole `⚠ Reranker error:` string stays out of i18n. Governance §4.2 fact ③: this
               machine's reranker is broken, so checking rerank always shows this -->
          <div v-if="result.rerank_error" class="warn">
            ⚠ Reranker error: {{ result.rerank_error }}
          </div>
          <ul class="scored-list">
            <li v-for="s in result.scored" :key="s.chunk_no">
              <div class="rank-line">
                <!-- 🔴 N18: `indexOf(s) + 1` used as the rank number, copied as-is (don't switch to v-for's index i + 1) -->
                <span class="rank-no">#{{ result.scored.indexOf(s) + 1 }}</span>
                <span class="score">cos {{ s.cos_sim.toFixed(3) }}</span>
                <!-- 🔴 Governance §4.2 fact ②: `scored[]` has no `rerank_score` → this cell never renders on this machine -->
                <span v-if="s.rerank_score !== undefined && s.rerank_score !== null"
                      class="rerank-score">rr {{ s.rerank_score.toFixed(3) }}</span>
                <span class="chunk-ref">chunk #{{ s.chunk_no }}</span>
              </div>
              <div class="rank-text">{{ truncate(chunkText(s.chunk_no), 200) }}</div>
            </li>
          </ul>
        </div>

        <!-- Chunks (blueprint :126-149) -->
        <div class="card chunks-card">
          <h3>{{ t('aiKbPtChunksTitle', { n: result.chunk_count }) }}</h3>
          <div v-if="!result.chunks.length" class="empty">
            {{ t('aiKbPtZeroChunks') }}
          </div>
          <ul v-else class="chunk-list">
            <li v-for="c in result.chunks" :key="c.chunk_no" class="chunk-item">
              <div class="chunk-head">
                <strong>chunk #{{ c.chunk_no }}</strong>
                <span class="hint">{{ c.token_count }} tokens · offset {{ c.offset_start }}-{{ c.offset_end }}</span>
              </div>
              <pre class="chunk-text">{{ c.text }}</pre>
              <div v-if="c.dense_preview" class="emb-preview">
                <span class="emb-label">dense [0:8]:</span>
                <code>[{{ c.dense_preview.map(v => v.toFixed(4)).join(', ') }}, …]</code>
              </div>
              <!-- ⚠️ The blueprint :145 arrow-function parameter is itself named `t`, which **shadows** the
                   i18n `t` inside `<script setup>` — no i18n is used here, so the shadowing is harmless, and the
                   Vue compiler's scope tracking (`walkIdentifiers`) resolves it to the parameter rather than
                   `$setup.t`.
                   Copied verbatim (renaming it would be an unrelated drive-by change); a dedicated test case
                   below proves it renders correctly. -->
              <div v-if="c.sparse_top_terms && c.sparse_top_terms.length" class="emb-preview">
                <span class="emb-label">sparse top:</span>
                <code>{{ c.sparse_top_terms.map(t => `${t.token_id}:${t.weight}`).join(' · ') }}</code>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

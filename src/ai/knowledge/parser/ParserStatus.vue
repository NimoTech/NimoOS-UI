<!--
  SP8-P5c Task 6 —— "Parser Details" page (route `/ai/parser`), 1:1 ported from Vue2
  blueprint `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/ParserStatus.vue` (164 lines,
  read with `git show main:` —— governance §1: the working tree of that repo is stale,
  cannot be trusted).

  Structure mapping (blueprint line range → this file):
    :3-9     Page header: title + 🧪 test sandbox link + refresh button (`:disabled` watches
             store.loading)
    :11-14   Unreachable alert card (one of two, alternate with the whole `<template v-else>` below)
    :18-66   Control card: pause indicator/button · concurrency level (three choices) ·
             inference device (three choices) + parsing hint · OCR toggle
    :69-76   Queue card: 6 emoji + numbers
    :79-89   Folder card: title with {top}/{total} · empty state · list + progress bar
    :92-102  Failure card: collapse button (rendered unconditionally) + list (N19: v-show + v-if
             both applied)
    :119-125 deviceOptions computed
    :127-135 mounted/beforeDestroy —— 5-second polling + document.hidden guard (N20)
    :136-157 Five pass-throughs + three pure functions (formatCursor / barWidth / truncateErr)

  ─────────────────────────────────────────────────────────────────────────────
  【K31 —— Root element must have two layers】(ruling by coordinator on 2026-08-03,
    governance §3 K31)
    `<div class="parser-app"><div class="parser-status-page">…</div></div>`
    ——**one extra layer of DOM compared to blueprint**. Outer `.parser-app` carries only
    the three structural properties from K22 (`height:100vh; height:100dvh; overflow-y:auto`,
    see `parser-styles.scss:68-72`), inner `.parser-status-page` is the blueprint's
    `padding:16px; max-width:900px; margin:0 auto`.
    🔴 Why cannot be flattened into one element: `src/styles/theme.css:318` has
    `body{overflow:hidden}`, `/ai/parser` is **a top-level route** (not under KnowledgeLayout),
    without its own scroll container content is never visible (K22); and if the scroll
    container is also the 900px centered column, then `overflow-y:auto`'s scrollbar ends up
    on **the column's right edge (roughly in the middle of the screen on wide displays)**,
    whereas Vue2 scrolls the whole page with the scrollbar on **the viewport's far right** ——
    that would be **visible interface not matching 1:1**. One extra invisible DOM layer is
    preferable.
    There are already two-element precedents: `AreaShell.vue` has `.area-shell` + `.area-body`,
    `knowledge.scss` has `.knowledge-app` wrapper + `.k-scroll` inner scroller.
    ⚠️ Plan doc `p5c-plan.md:204` still mentions the pre-K31 `class="parser-app parser-status-page"`
    (single element), **now superseded by K31**; governance file + appendix > brief > plan,
    follow K31.

  【K24 —— Styles imported from JS side, zero `<style>` block】
    `import '../../styles/parser-styles.scss'` (standalone file created by T2b). Blueprint
    `:162-164` was `<style lang="scss" scoped>@import './parser-styles.scss'`; scoped
    isolation in New-UI becomes K9's "all rules nested under page scope". Precedents:
    `KnowledgeLayout.vue:43` / `AgentPage.vue:72` / `SettingsPage.vue:70`.
    🔴 This file is the **first and only production import site** for `parser-styles.scss`
    (before T7), so the "can find `parser-status-page` in `dist/assets/*.css`" gate falls on
    this file.

  【K26 + K1 —— Store layer flattening】Blueprint used `Vue.observable({state:{…}})`,
    with `ParserStatus.vue` writing `store.state.xxx` everywhere; `parserStore.ts`
    introduced in T5 is a Pinia setup store, with **the `state` layer entirely removed** →
    this file uses `store.xxx` throughout. 🔴 Flatten every reference; actual count is
    **31 state accesses**(`controlState` 10 · `stats` 6 · `loading` 5 · `folders` 5 ·
    `failedJobs` 3 · `unreachable` 1 · `error` 1)**+ 8 action calls**
    (`loadAll` 3 · `pause`/`resume`/`setConcurrency`/`setDevice`/`setOcr` each 1),
    matching blueprint field-for-field (detailed list in T6 report §4); miss one and that
    cell becomes `undefined`.
    Similarly `store.actions.loadAll()` → `store.loadAll()` (same for five actions).

  【K27】All REST calls go through shared package inside store, this file makes zero
    direct calls.

  【Zero KIcon】(governance §1.2 / E-2 / N16) Neither of the two Parser pages uses a single
    KIcon in the blueprint —— they use emoji + plain text buttons. **Must not "while we're
    here, switch to KIcon"** (would not be 1:1 visually).

  【N16 —— Emoji / symbol position copied exactly, not a single one moved in/out of `t()`】
    **Outside** `t()`: `🧪`(:6)· `⏳`(:70)· `🔄`(:71)· `✅`(:72)· `❌`(:73)·
                      `📦`(:74)· `📍`(:75)· `▼`/`▶` collapse arrow(:94)
    **By script concatenation**: `'▶ ' + t('aiKbResume')` / `'⏸ ' + t('aiKbPause')`(:27)——
      i18n key value is pure `Resume` / `Pause`, symbols stay outside language pack.
    **Inside** `t()`: none (this page has zero such cases).
    `→` is **inside the key value** of `aiKbPrResolvedHint` (`→ actual {device}` /
    `→ 实际 {device}`, :53).
    `—` is `formatCursor`'s null fallback (:147, U+2014), `…` is `truncateErr`'s truncation
    marker (:156, U+2026).

  【N17 —— Concurrency level uses array index to fetch i18n, copy this pattern】
    `[t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)]`
    (blueprint :38). 🔴 **Must not change to a computed mapping table** (unrelated housekeeping).
    ⚠️ Key selection has nuance (N21 #3 / appendix A): `Balanced` **reuses**
    `aiKbCcBalanced` (matching exactly in en + zh); `Power-saving` / `Full power` **must
    create new keys** `aiKbPrCcPowerSaving` / `aiKbPrCcFullPower`, **cannot** reuse
    `aiKbCcPowerSaver` / `aiKbCcFullSpeed` —— although those two have the same zh (省电 /
    全力), their en is `Power saver` / `Full speed`, reusing would make English render
    differently from Vue2.

  【N19 —— Failure list has both `v-show` and `v-if` on the same `<ul>`, copy both
    directives】(blueprint :96)
    Vue has `v-if` higher precedence than `v-show` → when `failedJobs` is empty the whole
    `<ul>` **is not rendered**, `v-show` has no effect. 🔴 Merging to single directive =
    changing DOM structure = regression.
    ⚠️ Live test on this machine: `jobs?status=failed&limit=5` returns `{"jobs":[]}`
    (governance §4.3) → collapse button **is clickable** (renders unconditionally, shows
    "Recent failures (0)"), but opening it shows no list ——
    **this is correct behavior**, not a bug (governance §13 has noted this).

  【N20 —— 5-second polling + `document.hidden` guard + cleanup on unmount】(blueprint
    :127-135)
    Frequency `5000`, guard, cleanup timing all copied verbatim; `beforeDestroy` → Vue3's
    `onBeforeUnmount`.
    Timer handle is **component-local** `let` (blueprint has `this._timer`) —— 🔴
    **does not go in store**: `parserStore.ts` has zero timers, that is correct (governance
    §3.5 N20 / `parserStore.ts` header comment).

  【Three pure functions copied exactly】(blueprint :146-157)
    `formatCursor(ms)`: `if (!ms) return '—'` (covers 0 / NaN / undefined)
    `barWidth(count)`: `reduce` finds max + **`|| 1` fallback** (when max=0, prevents
    division by zero → 0/1*100 = 0)
    `truncateErr(s)`: truncate only if `> 120`, then `slice(0,120) + '…'`; `!s` → `''`
    🔴 All three must not be "improved" (no `Intl` formatting, no changed truncation length,
    no removed `|| 1`).

  【Hardcoded identifiers stay out of i18n】`'GPU (CUDA)'` / `'CPU'` (blueprint :123-124) ——
    technical identifiers, blueprint deliberately left them out of i18n (same as N22 family).
    **Must not "while we're here, add the key"** (would add keys Vue2 never had, and
    filling en/zh with English = pure noise). Only `Auto` goes into i18n → `aiKbDeviceAuto`
    (🔴 ruling A-1: **create new**, **do not reuse** `aiKbOriginAuto` —— that one's semantics
    is "infer task source").

  【K5/K30 do not apply here】`:13` has `<small>{{ store.error }}</small>` echoing
    `e.message || String(e)` (network-layer error text, `parserStore.ts:184`), **blueprint
    behavior, copy it**.
    K5/K30 covers "do not concatenate backend response `detail` into toast", different case
    (brief §3.6 has explicitly ruled on this).

  【Divergence, type-safety mechanical rewrite】`@change="setOcr($event.target.checked)"`
    (blueprint :61) in TS requires `($event.target as HTMLInputElement).checked` ——
    `EventTarget` lacks `checked` property.
    Precedent: `src/ai/components/settings/sections/ChannelsSection.vue:354` same pattern.
    Rendering and behavior unchanged, only type annotation.
-->
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useParserStore } from '../stores/parserStore'
import '../../styles/parser-styles.scss'

const { t } = useI18n()
const store = useParserStore()

/** Blueprint data() :112-117 —— the `store` item in Vue3 is `useParserStore()` above,
 *  leaving only `failedOpen` as page-level transient state (governance §5.1: not stored). */
const failedOpen = ref(false)

/** Blueprint `this._timer` (:129) —— component-local handle, not stored (N20). */
let timer: ReturnType<typeof setInterval> | null = null

/** Blueprint computed deviceOptions (:119-125) —— only `Auto` goes through i18n,
 *  `GPU (CUDA)` / `CPU` are hardcoded technical identifiers. */
const deviceOptions = computed<{ value: string; label: string }[]>(() => [
  { value: 'auto', label: t('aiKbDeviceAuto') },
  { value: 'cuda', label: 'GPU (CUDA)' },
  { value: 'cpu', label: 'CPU' },
])

/** Blueprint mounted() (:127-132) —— fetch once immediately, then start 5-second polling;
 *  skip this tick when `document.hidden` (timer keeps running, just no request sent). */
onMounted(() => {
  store.loadAll()
  timer = setInterval(() => {
    if (!document.hidden) store.loadAll()
  }, 5000)
})

/** Blueprint beforeDestroy() (:133-135) —— Vue3 equivalent is `onBeforeUnmount`. */
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

/** Blueprint reload() (:137). */
function reload(): void {
  store.loadAll()
}

/**
 * Blueprint togglePause() (:138-142) —— **ternary expression statement** dispatch, copy
 * exactly (do not rewrite to `if/else`: equivalent but not the blueprint's shape, would
 * be unrelated refactoring).
 * Both branches return Promise and the blueprint doesn't await either —— copy this too:
 * after clicking the button, let `resume()`/`pause()`'s internal `await loadAll()`
 * handle refresh; `loading` is already true and `:disabled` prevents double-click.
 */
function togglePause(): void {
  store.controlState.paused ? store.resume() : store.pause()
}

/** Blueprint :143-145 —— three pure pass-throughs. */
function setConcurrency(n: number): void {
  store.setConcurrency(n)
}
function setDevice(device: string): void {
  store.setDevice(device)
}
function setOcr(enabled: boolean): void {
  store.setOcr(enabled)
}

/** Blueprint formatCursor(ms) (:146-149) —— `!ms` covers 0 / NaN / undefined, fallback to U+2014. */
function formatCursor(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

/**
 * Blueprint barWidth(count) (:150-153) —— use the maximum count in the current list as 100%.
 * 🔴 `|| 1` fallback must not be deleted: when list is empty or all counts are 0, `reduce`
 * returns 0, division by zero would produce `NaN`/`Infinity` written into `style="width: NaN%"`.
 */
function barWidth(count: number): number {
  const max = store.folders.folders.reduce((m, f) => Math.max(m, f.count), 0) || 1
  return Math.round((count / max) * 100)
}

/** Blueprint truncateErr(s) (:154-157) —— truncate only if strictly `> 120` (=120 returned unchanged), truncation marker U+2026. */
function truncateErr(s?: string | null): string {
  if (!s) return ''
  return s.length > 120 ? s.slice(0, 120) + '…' : s
}
</script>

<template>
  <div class="parser-app">
    <!-- K31: outer `.parser-app` = K22 scroll container (height:100dvh + overflow-y:auto),
         inner `.parser-status-page` = blueprint's 900px centered column. Rationale in file
         header comment.
         ⚠️ This comment must be **inside** the outer div: placing it at the start of
         `<template>` would add an extra comment root node, making VTU's `wrapper.element`
         point elsewhere. -->
    <div class="parser-status-page">
      <!-- Page header (blueprint :3-9) -->
      <header class="page-header">
        <h2>{{ t('aiKbPrDetailsTitle') }}</h2>
        <div class="header-actions">
          <!-- N16: 🧪 is outside t() -->
          <router-link to="/ai/parser/test" class="test-link">🧪 {{ t('aiKbPrTestLink') }}</router-link>
          <button class="refresh-btn" @click="reload" :disabled="store.loading">{{ t('aiKbRefresh') }}</button>
        </div>
      </header>

      <!-- Unreachable alert card (blueprint :11-14) —— `<small>` echoing store.error is blueprint behavior, see K5/K30 explanation in file header -->
      <div v-if="store.unreachable" class="card unreachable">
        {{ t('aiKbPrUnreachable') }}<br />
        <small>{{ store.error }}</small>
      </div>

      <template v-else>
        <!-- Control card (blueprint :17-66) -->
        <div class="card control-card">
          <div class="row">
            <span class="status-text">
              <span class="dot" :class="{ paused: store.controlState.paused }" />
              {{ store.controlState.paused ? t('aiKbPaused') : t('aiKbRunning') }}
            </span>
            <!-- N16: `▶ ` / `⏸ ` are produced by script-side string concatenation, not in i18n key (blueprint :27) -->
            <button class="pause-btn"
                    @click="togglePause"
                    :disabled="store.loading">
              {{ store.controlState.paused ? ('▶ ' + t('aiKbResume')) : ('⏸ ' + t('aiKbPause')) }}
            </button>
          </div>
          <div class="row concurrency-row">
            <label>{{ t('aiKbConcurrencyLevel') }}:</label>
            <label v-for="n in [1, 2, 4]" :key="n" class="radio">
              <input type="radio"
                     :value="n"
                     :checked="store.controlState.concurrency === n"
                     :disabled="store.loading"
                     @change="setConcurrency(n)" />
              <!-- N17: array index to fetch i18n, copy blueprint :38 pattern, no computed mapping table -->
              {{ [t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)] }} ({{ n }})
            </label>
          </div>
          <div class="row device-row">
            <label>{{ t('aiKbInferenceDevice') }}:</label>
            <label v-for="opt in deviceOptions" :key="opt.value" class="radio">
              <input type="radio"
                     :value="opt.value"
                     :checked="store.controlState.device === opt.value"
                     :disabled="store.loading"
                     @change="setDevice(opt.value)" />
              {{ opt.label }}
            </label>
            <span v-if="store.controlState.device === 'auto' && store.controlState.resolved_device"
                  class="resolved-hint">
              {{ t('aiKbPrResolvedHint', { device: store.controlState.resolved_device.toUpperCase() }) }}
            </span>
          </div>
          <div class="row">
            <label class="checkbox">
              <input type="checkbox"
                     :checked="store.controlState.ocr_enabled"
                     :disabled="store.loading"
                     @change="setOcr(($event.target as HTMLInputElement).checked)" />
              {{ t('aiKbPrOcrLabel') }}
            </label>
            <span class="resolved-hint">{{ t('aiKbPrOcrHint') }}</span>
          </div>
        </div>

        <!-- Queue card (blueprint :68-76) —— N16: all six emoji outside t() -->
        <div class="card queue-card">
          <div class="kv">⏳ {{ t('aiKbPending') }} <b>{{ store.stats.queue_depth.pending }}</b></div>
          <div class="kv">🔄 {{ t('aiKbPrQueueRunning') }} <b>{{ store.stats.queue_depth.running }}</b></div>
          <div class="kv">✅ {{ t('aiKbPrQueueDone') }} <b>{{ store.stats.queue_depth.done }}</b></div>
          <div class="kv">❌ {{ t('aiKbFailed') }} <b>{{ store.stats.queue_depth.failed }}</b></div>
          <div class="kv">📦 {{ t('aiKbPrIndexedVectors') }} <b>{{ store.stats.total_vectors_text }}</b></div>
          <div class="kv">📍 {{ t('aiKbLastSynced') }} <b>{{ formatCursor(store.stats.last_cursor_ms) }}</b></div>
        </div>

        <!-- Folder card (blueprint :78-89) —— {top} is this page's list length, {total} is backend group count, two numbers from different sources -->
        <div class="card folders-card">
          <h3>{{ t('aiKbPrFoldersTitle', { top: store.folders.folders.length, total: store.folders.total_groups }) }}</h3>
          <div v-if="!store.folders.folders.length" class="empty">{{ t('aiKbPrNoPending') }}</div>
          <ul v-else class="folder-list">
            <li v-for="(f, i) in store.folders.folders" :key="i" class="folder-row">
              <span class="folder-path">{{ f.folder }}</span>
              <span class="folder-count">{{ f.count }}</span>
              <span class="folder-bar" :style="{ width: barWidth(f.count) + '%' }" />
            </li>
          </ul>
        </div>

        <!-- Failure card (blueprint :91-102) -->
        <div class="card failures-card">
          <button class="toggle" @click="failedOpen = !failedOpen">
            {{ failedOpen ? '▼' : '▶' }} {{ t('aiKbPrRecentFailures', { n: store.failedJobs.length }) }}
          </button>
          <!-- 🔴 N19: copy both directives. v-if has higher precedence → when failedJobs is empty the whole <ul> is not rendered -->
          <ul v-show="failedOpen" v-if="store.failedJobs.length" class="failure-list">
            <li v-for="j in store.failedJobs" :key="j.id">
              <div class="path">{{ j.path }}</div>
              <div class="error">{{ truncateErr(j.last_error) }}</div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

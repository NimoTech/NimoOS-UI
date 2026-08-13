<!--
  SP8-P5f Task 6 (first half) + **Task 7 (second half, this batch)** — "Wiki navigation" page
  (rail item 3, route `/ai/knowledge/wiki`),
  1:1 ported from Vue 2 reference `NimoOS-UI` @ `7a6ee6b7`
  `src/views/AI/Knowledge/WikiView.vue` (314 lines, read via
  `git -C ../../NimoOS-UI show 7a6ee6b7:` — governance §0.4: that repo's working tree is
  on a different branch, not trustworthy).

  ═══════════════════ 🔴 T6 / T7 batch boundary (read this first before next batch) ═══════════════════

  This batch (T6) ports:
    · Template `:1-46` — left tree three states (skeleton / load-failed+retry / "not yet generated")
                         + node list when tree exists, plus empty-tree onboarding screen on right
                         (`kw-pending` + "manage knowledge roots" button);
    · Template `:48-75` — breadcrumb / title / "open folder" / article skeleton (four `k-skel`
                          under `nodeLoading`);
    · Template `:76-81` — `<template v-else>` and its internal `kw-meta` three lines.
      🔴 **Boundary declaration**: T6 brief says "scope: template `:48-75`", while same brief says
      "do not write: all of `:76-141` after **`kw-meta`**" — two statements assign `:76-81`
      opposite ownerships. This batch takes **the latter** ("after `kw-meta`" = `kw-meta` itself
      goes to T6), reasoning: T6's DoD #8 requires "fallback test cases for `updatedFmt` /
      `selAiLabel`", and these two computed have **only `kw-meta` as a render outlet** — without
      porting `kw-meta` there is no observable surface, DoD requirement fails (governance §10
      declaration discipline #2 same case). **Explicitly declared in T6 report.**
    · script: `visibleNodes` / `trail` / `crumbParents` / `selTreeNode` / `selName` /
      `selAiLabel` / `updatedFmt` / `owningRoot` · `loadTree` / `isOpen` / `toggle` /
      `nodeClick` / `select` / `fetchArticle` / `openFolder` · watch on `$route.query.path`.

  🔴 **T6 does NOT port, left for T7** (template `:83-141` + script):
    Summary rendering (`kw-summary` / `kw-rawsrc` / `v-html`) · "this dir has no wiki summary"
    screen + rescan button · contents section (`kw-sec` / `kw-children`) · recent changes
    (`kw-changes`) · footer (`kw-foot`) and "view source" toggle;
    plus `html` / `changes` / `childIsDir` / `childPath` / `childClick` / `rescan` / `fmtTs` /
    `OP_LABEL_KEYS` / `rescanBusy`.
    ⚠️ **T6 deliberately does not pre-write summary section markup to make it visible** (brief
    mandate).
    ⚠️ `showSource` is already declared in T6 — it is not T7-exclusive: the blueprint
    `fetchArticle` (`:264`) resets it to `false` every time it fetches an article, that line
    falls **within T6's scope**, without declaring the ref you cannot write it out.

  ═══════════════════════ 🔴 T7 (this batch) ports in ═══════════════════════

    · Template `:83-141` — summary section (`class="kw-summary kw-md"` `v-html` / `kw-rawsrc`
      source view) · "this dir has no wiki summary" screen (`kw-pending` + rescan button with
      `v-if="owningRoot"`) · contents section (`kw-sec` / `kw-children` / `kw-child*`) ·
      recent changes (`kw-changes` / `kw-change*`) · footer `kw-foot` ("view source / rendered
      view" toggle);
    · script: `rescanBusy` · `OP_LABEL_KEYS` · `html` / `changes` two computed ·
      `childIsDir` / `childPath` / `childClick` / `rescan` / `fmtTs`.
    🔴 T6 set up **auto-cock guard** (`WikiView.test.ts` "auto-cock guard" group)
      — "as soon as this file's template shows `kw-summary`, must simultaneously show
      `showSource` toggle button" — **as of writing `class="kw-summary kw-md"` in this batch
      it is cocked and satisfied**:
      footer `kw-foot` has `@click="showSource = !showSource"` as the toggle entry.
      ⚠️ The sentence above contains literal `kw-summary` string, and it is in **file header
      comment** — that guard's template extractor has per ruling **R28** switched to **column-0
      anchor**, will not be fooled by file header comment again (T6's bare `indexOf('<template>')`
      would be; review tested and reported red).

  【§9.15 — `v-html` is this cycle's only XSS surface (K49 same-family second time)】
    `html` = `renderWikiMarkdown(raw || '')` = forwarded via `util/wikiViewHelpers.ts` to this
    repo's `src/ai/markdown/renderMarkdown.ts` (**contains DOMPurify**). `.wiki.md` body is
    **synthesized by backend from filenames/user notes in user's directory**, contains attacker-
    controlled strings ⇒ must sanitize before `v-html`. 🔴 Guard falls **on this batch's code**:
    `WikiView.test.ts` §9.15 XSS group **mounts real component, inspects real DOM**, and
    **does not mock `renderMarkdown`** throughout (mocking then claiming XSS verified = placebo
    test, governance §9.15 mandate).

  【N58 — `childPath`'s `base === '' ? '' : base` is identity expression, copy as-is without
  simplification】
    Blueprint `:283-286`. Both branches **return identical results** (both return `base`) ⇒
    it is the original text's intent trace; simplifying it away obscures "author once
    considered that `sel` being root would strip `base` to empty string". **Copy as-is, no
    simplification, note it in report** (governance §3.5 N58 original mandate).

  【N49 — Go nil slice fallback】`node.childMap` / `node.recentChanges` `|| []` fallback
    **lives in shared package's `normalizeNode`** (`NimoOS-Service/src/wiki.ts:113-114`) ⇒ page
    always receives arrays. This batch copies blueprint's `v-if="node && node.childMap.length"`
    — the "node is null" half still must be guarded by page itself (N48's 404→null business
    state). `changes` with `(node ? node.recentChanges : [])` same logic, copy as-is.

  Structure correspondence (blueprint line ranges → this file):
    :2      `.kw-split` two-column shell
    :4-33   left column `.kw-tree` → `.kw-tree-scroll` → four states (loading / error / empty / tree exists)
    :36-46  right column `.kw-article` → `.kw-article-inner` → empty tree onboarding
    :48-55  breadcrumb (**K56: `:key` moved to `<template v-for>` itself**)
    :57-66  title row + "open folder"
    :69-74  article skeleton
    :76-81  `<template v-else>` + `kw-meta`
    :83-95  summary section two-choice (`kw-rawsrc` / `kw-summary`) + "no summary" screen (**T7**)
    :97-117 contents section `kw-sec` / `kw-children` (**T7**)
    :119-132 recent changes `kw-sec` / `kw-changes` (**T7**)
    :134-140 footer `kw-foot` + "view source / rendered view" toggle (**T7**)
    :156    `OP_LABEL_KEYS` (**T7**)
    :161-176 `data()` eleven page-level volatile items (**excludes `store` item**; blueprint
             `data()` has 12 keys total) → component-local `ref` (T6 covers ten of them, eleventh
             `rescanBusy` by **T7**)
    :177-209 `computed` → `computed()`
    :210-214 `watch '$route.query.path'` → `watch(() => route.query.path, …)`
    :215-218 `created()` → `onMounted()`
    :219-312 `methods` → plain functions

  ─────────────────────────────────────────────────────────────────────────────
  【Zero style block — K44 / governance §3】Blueprint page **has zero `<style>` block**
    (its `kw-*` classes originally live in blueprint `knowledge.scss:2453-2561`), T2 already
    moved entire section to `src/ai/styles/knowledge.scss` (nested under `.knowledge-app`, K9)
    ⇒ **this file has zero style blocks**. `knowledge.scss` imported by `KnowledgeLayout.vue`
    side, this file does not import styles (precedent: `QueueView.vue` / `SettingsView.vue` /
    `AllowlistView.vue` / `RootsView.vue`). Guard: `knowledgeStyles.test.ts` K44 parameterized
    assertion (T2b placed, ruling R20 C-1) — it **strips comments first, then anchors at line
    start**, so above sentence itself won't trigger it (ruling **R19** direct consequence). Also
    this file must be registered in `knowledgeStyles.test.ts`'s `KNOWLEDGE_VUE_FILES` list (set
    equality prevents drift; not registered = that assertion goes red, **that is correct behavior,
    do not alter assertion**).

  【K56 — breadcrumb `:key` position is Vue 3 compiler hard requirement, not choice】
    Blueprint `:50-53` is Vue 2 style: `<template v-for>` internal `<button>` and `<span>`
    **each** have keys, latter also concatenates `+ '/sep'`. **Vue 3 compiler requires `key` on
    `<template v-for>` itself** (on internal children causes compile warning/fails) ⇒ this file
    has `:key="c.path"` on `<template>` itself, internal two elements **no longer each have
    keys**.
    🔴 DOM sequence rendered matches blueprint **one-to-one** (`button, span('/')` alternating
    + final `span.cur`), pinned by assertion in `WikiView.test.ts` "K56 breadcrumb DOM
    sequence".

  【K1 — store layer reduction, per-site】Blueprint `this.store.state.wikiRoots` (`:196`),
    `this.store.actions.loadRoots/loadWikiTree/loadWikiNode/loadWikiRaw/toast`, this repo's
    `knowledgeStore` is Pinia setup store, **`state` and `actions` layers both disappear**
    → `store.wikiRoots` / `store.loadRoots()` / `store.loadWikiTree()` / ….

  【K58 form A — `fetchArticle`'s catch does not echo backend body】
    Blueprint `:277`: `toast($t('Operation failed') + ': ' + (e.message || e))`.
    K5/K58 mandate forbid echoing backend strings into UI; `p5f-task-0-report.md` §12 establishes
    this repo's standard practice (precedent `QueueView.vue:212-217` / `IndexedFilesView.vue:592-593`
    / `NoteEditPane.vue:461`, same-period `RootsView.vue` four places) — **catch discards
    `e.message`, shows only fixed i18n key, and "no second clause to concatenate so no `': '`
    prefix"**. This file's sole catch-toast becomes `aiKbOpFailed`. **No new mapping invented.**
    Landing criterion is **negative assertion** (see K58 group in test file: have store action
    reject error with identifiable text, assert toast text and entire page DOM both **do not
    contain** that text).
    ⚠️ That probe text **deliberately does not appear in this file** (governance §9: negative
    assertion hits comment = false positive).

  【K27 same-family — toast always via `store.toast(...)`】Ruling **R27** (P5e) / errata **E-62**:
    inside `knowledgeStore.ts` `toast()` is `useToast().show(msg, 2400)`, while **global `show()`
    defaults to 1500ms only** ⇒ direct `useToast()` loses blueprint's own 2400ms. Eight existing
    pages all use `store.toast()`, this page follows same — this batch's scope has **1 place**
    (`fetchArticle`'s catch).

  ═══════════════════ Copy-as-is declaration (§3.5 N items) ═══════════════════

  【N46 — two naming styles, easiest mistake this cycle】Wiki's `WikiRoot` **has no json tag**
    ⇒ HTTP response is PascalCase; `/tree`, `/node`, `/raw` are snake_case. **Bidirectional
    normalization already in shared package** (`NimoOS-Service/src/wiki.ts:85 normalizeRoot` /
    `:102 normalizeTreeNode` / `:112 normalizeNode`) ⇒ **store exit is camelCase throughout**
    (T0 determined by testing, `p5f-task-0-report.md` §4.4). This page only consumes camelCase
    `aiLabel` / `lastModified` / `r.path` / `r.id`, **must not normalize again in page**.

  【N48 — `loadWikiNode` / `loadWikiRaw` 404→null layer, copy as-is】
    404 (node not yet indexed / `.wiki.md` not yet generated) converts to `null` **at store
    layer**, other errors pass through (`knowledgeStore.ts:715` / `:725`) ⇒ `null` received in
    this page's `try` is **legitimate business state** (T7's "this dir has no wiki summary"
    screen), while `catch` only receives real errors. **Layering is intentional, do not flatten.**

  【N55 — `fetchArticle`'s staleness guard is blueprint's own, copy as-is】
    Blueprint `:270` / `:274` / `:279` three instances of `if (this.sel !== p)`. All three
    **cannot be dropped**, each guards different things:
      · one in try — late success response must not overwrite newly selected article;
      · one in catch — late **failure** must not clear newly selected article, must not toast;
      · one in finally — late response must not prematurely close **newly selected** skeleton
                        `nodeLoading` (else new article hasn't arrived yet, UI flashes "loaded"
                        blank).
    🔴 Beyond "logic", must also guard **variable scope** half (governance §9.1 / K15 same-family
    10th time): both `p` and `sel` must be **component-instance-level**, not module-level —
    when two WikiView instances coexist, module-level variable makes A's response compare against
    B's selection. Test includes "two instances interleaved" case (**criterion: move `sel` to
    module-level → must go red**).

  【N56 — deep-link two halves are **two different paths**, do not "unify" to
  `immediate: true`】
    · initial selection: read **once** `route.query.path` in `loadTree()` (blueprint `:230-232`);
    · later changes: `watch` **no `immediate`** (blueprint `:210-214`), condition
    `v && v !== sel && byPath[v]`.
    🔴 **Why not merge**: watch condition includes `byPath[v]`, but `byPath` is built **after**
    `loadTree()` returns — `immediate: true` runs at mount time, `byPath` is still empty object,
    that call **silently does nothing**, deep-link breaks (none of the guards fire). Blueprint's
    initialization takes different path, copy as-is.
    🔴 "modify address bar query after mount → actually switch" must have test case (memory
    `newui-router-query-only-no-remount`: pattern of reading query once in `onMounted`, user
    changing address bar runs no code).

  【N57 — `select()`'s `router.replace(...).catch(() => {})`, copy as-is】
    Blueprint `:256-258`. vue-router 4 **rejects repeated navigation** with
    `NavigationDuplicated`-style error; blueprint here has no log from the start, swallowing is
    standard practice ⇒ **K6 "do not copy `console.error`" does not apply** (nothing logged to
    not copy).

  【N49 — Go nil slice fallback】 within this batch's scope hit-points are in
    `buildWikiTree` (`util/wikiViewHelpers.ts` `(list || [])`) and store side, this file does
    not repeat fallback.

  ═══════════════════ Vue2 → Vue3 mandatory rewrites (governance §2, not divergence) ═══════════════════
    | Blueprint (Options API) | This file | Reasoning |
    |---|---|---|
    | `data()` object | `ref()` | `<script setup>` has no `this` |
    | `computed: { … }` | `computed()` | same |
    | `watch: { '$route.query.path'(v) {} }` | `watch(() => route.query.path, (v) => …)` | string path watch unavailable in setup |
    | `created()` | `onMounted()` | blueprint's two calls **both do not block initial paint** (no await) |
    | `methods: { … }` | plain functions | same |
    | `this.$route` / `this.$router` | `useRoute()` / `useRouter()` | this repo standard |
    | `this.$t` | `useI18n().t` | this repo standard |
    | `this.store.actions.x()` | `store.x()` | Pinia setup store has no `actions` layer |
    | `$router.push(...)`(in template) | `router.push(...)` | only difference with `<script setup>` is template doesn't access `$router` |

  🔴 **No `any`** (follows K41): tree nodes use `WikiViewTreeNode` exported by
    `util/wikiViewHelpers.ts`, article nodes use shared package's `WikiNode`, roots use shared
    package's `WikiRoot`.
  🔴 `route.query.path` type is `LocationQueryValue | LocationQueryValue[] | undefined`
    (may be array: `?path=a&path=b`) ⇒ this file uses `queryPath()` to narrow to `string`
    (non-strings become `''`). **Semantics equivalent to blueprint**: blueprint feeds array
    directly to `byPath[…]`, JS stringifies it to an impossible key ⇒ same falls to "no match"
    branch.
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { WikiChildMapEntry, WikiNode } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'
import { openDirInNewTab, openFileInNewTab } from '../../services/openInApp'
import {
  buildWikiTree,
  trailFor,
  opToType,
  parseTs,
  rootForPath,
  renderWikiMarkdown,
} from '../util/wikiViewHelpers'
import type { WikiViewTreeNode } from '../util/wikiViewHelpers'

/**
 * Blueprint `:156` — file event `op` → label text. **Four values through `$t()`** (dynamic
 * key, same pattern as P5e's `MTIMES`) ⇒ blueprint's `'Added'/'Updated'/'Removed'/'Renamed'`
 * become corresponding `aiKbWkOp*` keys in this repo (i18n placed by T1, see `zh_cn.ts` /
 * `en_us.ts`; values word-for-word from blueprint `zh_CN.json` / `en_US.json`).
 * 🔴 **Fallback for unknown op is `Updated`** from blueprint `:205` with
 * `OP_LABEL_KEYS[c.op] || 'Updated'`, copy as-is — **two independent fallbacks** from `opToType`'s
 * "modify + any unknown → 'mod'", do not merge.
 */
const OP_LABEL_KEYS: Record<string, string> = {
  create: 'aiKbWkOpAdded',
  modify: 'aiKbWkOpUpdated',
  delete: 'aiKbWkOpRemoved',
  rename: 'aiKbWkOpRenamed',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

/* ── Blueprint data() (`:161-176`) page-level volatile state, all component-local refs,
     not in store (governance §5.1).
     🔴 Component-local = one per instance — N55's "two instances interleaved" guard pins
     exactly this. ── */

/** Blueprint `:164` — initial value `true` (skeleton on mount, no flash of empty). */
const treeLoading = ref(true)
/** Blueprint `:165`. */
const treeError = ref(false)
/** Blueprint `:166` — top-level forest from `buildWikiTree`. */
const treeRoots = ref<WikiViewTreeNode[]>([])
/** Blueprint `:167` — path → tree node (second return value from `buildWikiTree`). */
const byPath = ref<Record<string, WikiViewTreeNode>>({})
/** Blueprint `:168` — expanded paths. Blueprint uses array + `indexOf`, copy as-is (don't
 *  switch to Set). */
const openPaths = ref<string[]>([])
/** Blueprint `:169` — currently selected path. **N55's staleness guard compares against it.** */
const sel = ref('')
/** Blueprint `:170` — response from `/wiki/node` (T7 renders contents and recent changes). */
const node = ref<WikiNode | null>(null)
/** Blueprint `:171` — `.wiki.md` raw source; **`null` is legitimate business state**
 *  (N48: 404 converts to null at store layer). */
const raw = ref<string | null>(null)
/** Blueprint `:172`. */
const nodeLoading = ref(false)
/** Blueprint `:173` — "view source / rendered view" toggle (footer `kw-foot` button flips it);
 *  **already declared in T6** because blueprint `fetchArticle` (`:264`) resets it to false
 *  every time it fetches an article, that line falls within T6's scope. */
const showSource = ref(false)
/** Blueprint `:174` (**T7**) — rescan in-flight gate; both function gate in `rescan()` and
 *  button's `:disabled` read it. */
const rescanBusy = ref(false)

/**
 * Blueprint `:178-186` — flatten forest to "visible rows" (with indent depth), collapsed
 * subtrees do not appear. `isOpen` decides whether to continue walking down ⇒ when `openPaths`
 * changes, this computed auto-recalculates.
 */
const visibleNodes = computed<Array<{ n: WikiViewTreeNode; depth: number }>>(() => {
  const out: Array<{ n: WikiViewTreeNode; depth: number }> = []
  const walk = (n: WikiViewTreeNode, depth: number): void => {
    out.push({ n, depth })
    if (isOpen(n.path)) n.children.forEach((c) => walk(c, depth + 1))
  }
  treeRoots.value.forEach((r) => walk(r, 0))
  return out
})

/** Blueprint `:187` — ancestor chain (root-most first, includes self). */
const trail = computed<WikiViewTreeNode[]>(() => trailFor(byPath.value, sel.value))
/** Blueprint `:188` — breadcrumb shows **ancestors only**, current node rendered separately
 *  as final `.cur`. */
const crumbParents = computed<WikiViewTreeNode[]>(() => trail.value.slice(0, -1))
/** Blueprint `:189`. */
const selTreeNode = computed<WikiViewTreeNode | null>(() => byPath.value[sel.value] || null)
/** Blueprint `:190` — 🔴 fallback: when not found in tree, **degrade to full path** (not
 *  blank). */
const selName = computed<string>(() => (selTreeNode.value ? selTreeNode.value.name : sel.value))
/** Blueprint `:191` — fallback to empty string (`v-if` out entire `<span>` in `kw-meta`). */
const selAiLabel = computed<string>(() => (selTreeNode.value ? selTreeNode.value.aiLabel : ''))
/**
 * Blueprint `:192-195` — `parseTs` returns **milliseconds** (0 = empty string from backend
 * formatTS / invalid value), entire block does not render when 0. 🔴 `fmtAgo` also takes
 * milliseconds (`knowledgeStore.ts:190`).
 */
const updatedFmt = computed<string>(() => {
  const ms = selTreeNode.value ? parseTs(selTreeNode.value.lastModified) : 0
  return ms ? fmtAgo(ms) : ''
})
/** Blueprint `:196` (K1 layer reduction) — which index root the selected path belongs to
 *  (longest prefix match); rescan button needs its `id`. */
const owningRoot = computed(() => rootForPath(store.wikiRoots, sel.value))

/**
 * Blueprint `:197` (**T7**) — 🔴 **§9.15: this cycle's only XSS surface**.
 * `renderWikiMarkdown` just forwards to this repo's `renderMarkdown` (contains DOMPurify),
 * sanitization happens there.
 * 🔴 `raw || ''` copy as-is — when `raw` is `null` template takes different branch (`kw-pending`),
 *    but computed itself evaluates once, feeding `null` to markdown renderer would fail, fallback
 *    cannot be removed.
 */
const html = computed<string>(() => renderWikiMarkdown(raw.value || ''))

/** `changes` 的行形状(蓝本 `:201-207` 那个对象字面量,零 `any`)。 */
interface WikiChangeRow {
  path: string
  name: string
  type: ReturnType<typeof opToType>
  label: string
  timeFmt: string
}

/**
 * Blueprint `:198-208` (**T7**) — "recent changes" timeline row data. Four things, copy each
 * as-is:
 *   ① **`.slice(0, 10)` limit** — backend can send dozens, page shows only latest 10;
 *   ② **prefix stripping** — paths under current index root show **relative path**, unmatched
 *      prefixes show **full path** (cross-root entries like `/outside/...` pass through,
 *      blueprint `:203` criterion `indexOf(prefix) === 0`);
 *   ③ `opToType(c.op)` → `data-type` (CSS `--tone` uses it for color);
 *   ④ **fallback for unknown op `OP_LABEL_KEYS[c.op] || 'Updated'`** + when `c.at` is empty
 *      string, `timeFmt` is `''`.
 * 🔴 `root.path.replace(/\/+$/, '') + '/'` copy as-is (when root is `/` produces `//`, same
 * as blueprint — do not "fix").
 * 🔴 `(node ? node.recentChanges : [])` copy as-is (N48's `null` business state guarded here).
 */
const changes = computed<WikiChangeRow[]>(() => {
  const root = owningRoot.value
  const prefix = root ? root.path.replace(/\/+$/, '') + '/' : ''
  return (node.value ? node.value.recentChanges : []).slice(0, 10).map((c) => ({
    path: c.path,
    name: prefix && c.path.indexOf(prefix) === 0 ? c.path.slice(prefix.length) : c.path,
    type: opToType(c.op),
    label: t(OP_LABEL_KEYS[c.op] || 'aiKbWkOpUpdated'),
    timeFmt: c.at ? fmtAgo(parseTs(c.at)) : '',
  }))
})

/**
 * Narrow `route.query.path` type (see "mandatory rewrites" table end in file header).
 * Non-strings (absent / array form from `?path=a&path=b`) all become `''` — same as blueprint
 * falling to "no match".
 */
function queryPath(): string {
  const q = route.query.path
  return typeof q === 'string' ? q : ''
}

/**
 * Blueprint `:220-238`.
 * 🔴 **Deliberately no staleness guard** (governance §5.2 line 2), four reasons:
 *   ① Only two call sites — `onMounted` runs once, and "retry" button in `treeError` branch;
 *   ② That retry button **cannot fire twice concurrently**: first call sets `treeLoading` true
 *      immediately, and button's `v-else-if="treeError"` branch does not render when
 *      `treeLoading` is true (`v-if="treeLoading"` comes first) ⇒ while request in-flight,
 *      button **does not exist**, cannot click;
 *      🔴 This is guarded by "retry button not rendered while treeLoading" test case in
 *      `WikiView.test.ts`, **that is the basis for "no guard" decision** — if future code
 *      changes layout to "retry button always shown", that test goes red first, reminds
 *      developer to add staleness guard alongside;
 *   ③ This page has no "switch root, reload tree" parameter — `loadWikiTree()` takes no args,
 *      two calls must have same source;
 *   ④ Blueprint itself has no guard (but `fetchArticle` **does have**) ⇒ adding one is
 *      undeclared divergence.
 * 🔴 Initial selection reads **once** `route.query.path` here (N56 first half):
 *    query hit → select it; miss → `roots[0]`; neither → `''` (don't select, right side shows
 *    onboarding/blank).
 */
async function loadTree(): Promise<void> {
  treeLoading.value = true
  treeError.value = false
  try {
    const flat = await store.loadWikiTree()
    const built = buildWikiTree(flat)
    treeRoots.value = built.roots
    byPath.value = built.byPath
    // top-level roots start expanded (blueprint `:228` original comment)
    openPaths.value = built.roots.map((r) => r.path)
    const q = queryPath()
    const initial = q && built.byPath[q] ? q : built.roots[0] ? built.roots[0].path : ''
    // 🔴 `fromRoute: q === initial` — when address bar already has this value, don't replace
    // again (prevent loop).
    if (initial) select(initial, { fromRoute: q === initial })
  } catch {
    treeError.value = true
  } finally {
    treeLoading.value = false
  }
}

/** Blueprint `:239`. */
function isOpen(path: string): boolean {
  return openPaths.value.indexOf(path) !== -1
}

/** Blueprint `:240-244` — pure toggle; mounted on chevron in template with **`@click.stop`**
 *  (click it does not trigger selection). */
function toggle(path: string): void {
  const i = openPaths.value.indexOf(path)
  if (i === -1) openPaths.value.push(path)
  else openPaths.value.splice(i, 1)
}

/**
 * 蓝本 `:245-248` —— 点整行:先选中,**再**把有子节点且当前折叠的展开(只展不收)。
 *
 * 🔴 **申报:第二行在蓝本里其实是不可达分支**(与 N58 的恒等表达式同族,**照抄不化简**)。
 *   推演:`select(n.path)` 里的 `trailFor(byPath, n.path)` 返回的祖先链**含 `n` 自己**
 *   (`util/wikiViewHelpers.ts` 的 `trailFor`:逐段拼 `cur` 并在命中 `byPath` 时 push,
 *   最后一段就是 `n.path` 本身)⇒ `select()` 的循环已经把 `n.path` 推进 `openPaths`;
 *   而 `n` 一定在 `byPath` 里(它是从 `visibleNodes` 里点出来的),`select()` 的
 *   `if (!byPath[path]) return` 早退也不会发生 ⇒ 回到这里时 `isOpen(n.path)` 恒为 `true`,
 *   `!isOpen(...)` 恒 `false`,这一行**永远不会执行**。
 *   ⇒ 「点整行会展开」这个**可观测行为**是真的(由 `select()` 提供),用例照常钉;
 *      但它的守卫落在 `select()` 的祖先循环上,不在这一行。**不删、不化简**:
 *      删了会让「将来有人改动 `select()` 的循环」时失去这处的意图痕迹(N58 同款理由)。
 */
function nodeClick(n: WikiViewTreeNode): void {
  select(n.path)
  if (n.children.length && !isOpen(n.path)) openPaths.value.push(n.path)
}

/**
 * 蓝本 `:249-260` —— **三件事**:
 *   ① 设 `sel`;
 *   ② **展开每一个祖先**(`trailFor` 循环)—— 少了它,深链到深层节点时那一行在树里看不见;
 *   ③ 把选中写进地址栏 `?path=`(`router.replace`,不进历史)。
 * 🔴 `fromRoute: true`(来自 watch / 初始 query 命中)时**跳过第 ③ 步**,防「watch → replace →
 *    watch」的回环。
 * 🔴 **N57**:`.catch(() => {})` 照抄 —— vue-router 对重复导航会 reject。
 */
function select(path: string, opts: { fromRoute?: boolean } = {}): void {
  const fromRoute = opts.fromRoute === true
  if (!byPath.value[path]) return
  sel.value = path
  // expand every ancestor so the selection is visible in the tree(蓝本 `:252` 原注释)
  for (const anc of trailFor(byPath.value, path)) {
    if (!isOpen(anc.path)) openPaths.value.push(anc.path)
  }
  if (!fromRoute && queryPath() !== path) {
    router.replace({ query: { ...route.query, path } }).catch(() => {})
  }
  fetchArticle()
}

/**
 * 蓝本 `:261-281`。
 * 🔴 **N55 —— 三处过期守卫逐字照抄**(理由逐处见文件头)。`p` 是**这一发**的路径快照。
 * 🔴 `Promise.all` 照抄 —— 两个请求并发,不串行。
 * 🔴 **N48**:404 已在 store 层转成 `null`(合法业务态,走 try);其余错误上抛 → 走 catch。
 * 🔴 **K58 形态 A**:catch 只弹固定键,不回显 `e.message`(蓝本 `:277` 回显,本仓不照抄)。
 */
async function fetchArticle(): Promise<void> {
  const p = sel.value
  nodeLoading.value = true
  showSource.value = false
  try {
    const [n, r] = await Promise.all([store.loadWikiNode(p), store.loadWikiRaw(p)])
    if (sel.value !== p) return // stale response — a newer selection won(蓝本 `:270` 原注释)
    node.value = n
    raw.value = r
  } catch {
    if (sel.value !== p) return
    node.value = null
    raw.value = null
    store.toast(t('aiKbOpFailed'))
  } finally {
    if (sel.value === p) nodeLoading.value = false
  }
}

/** 蓝本 `:282`(**T7**)—— 子项是不是目录 = 它的全路径在树里有没有节点。
 *  🔴 判据是 `byPath`,不是文件名有没有后缀 —— 「有 `.wiki.md` 的目录」才算目录,
 *  被折叠的目录(`is_opaque`)不在树里 ⇒ 这里判 `false`,点它走文件管理器(与蓝本同解)。 */
function childIsDir(c: WikiChildMapEntry): boolean {
  return !!byPath.value[childPath(c)]
}

/**
 * 蓝本 `:283-286`(**T7**)。
 * 🔴 **N58 —— `base === '' ? '' : base` 是恒等表达式,两支结果相同,照抄不化简。**
 *   触发它的唯一场景:`sel` 是 `'/'` ⇒ `replace(/\/+$/, '')` 把它剥成 `''`
 *   ⇒ 拼出 `'' + '/' + name` = `/name`(而不是 `//name`)。作者当年写下这个三元
 *   显然是在标注「这里 base 可能为空」,化简掉就把那处意图痕迹擦了。
 */
function childPath(c: WikiChildMapEntry): string {
  const base = sel.value.replace(/\/+$/, '')
  return (base === '' ? '' : base) + '/' + c.name
}

/**
 * 蓝本 `:287-291`(**T7**)—— 两分支:
 *   · 树里有这个路径(= 有自己的 `.wiki.md` 的目录)→ 就地 `select()` 换文章;
 *   · 否则(普通文件,或被折叠的目录)→ 到「文件」应用里打开并高亮它。
 */
function childClick(c: WikiChildMapEntry): void {
  const full = childPath(c)
  if (byPath.value[full]) select(full)
  else openFileInNewTab(full) // plain file (or opaque dir) → file manager, highlighted(蓝本 `:290` 原注释)
}

/** 蓝本 `:292-294` —— 在「文件」应用里打开当前目录本身(不高亮任何文件)。 */
function openFolder(): void {
  openDirInNewTab(sel.value)
}

/**
 * 蓝本 `:295-307`(**T7**)—— 手动重扫当前选中所属的索引根。
 * 🔴 **函数门 `if (!root || rescanBusy) return`** 照抄(治理 §5.2 第 4 行):
 *   · `!root` —— 选中不属于任何索引根时不发请求(模板里那个按钮本来就 `v-if="owningRoot"`,
 *     但函数门是**第二道**,不许因为「按钮不渲染」就省掉);
 *   · `rescanBusy` —— 第一发在飞时不发第二发。
 * ⚠️ 模板上的 `:disabled="rescanBusy"` 与这道函数门是**两层**;jsdom 不向 `:disabled` 元素
 *   派发 click(裁定 R27 的常驻教训)⇒ 测试验函数门时**直接调 `vm.rescan()`**,
 *   不去点那个带 `:disabled` 的按钮(点它测到的是 `:disabled` 绑定,不是函数门)。
 * 🔴 **K58 形态 A**:catch 只弹固定键,不回显 `e.message`(蓝本 `:303` 回显,本仓不照抄)。
 * 🔴 `finally` 里无条件 `rescanBusy = false` 照抄(**不带过期守卫** —— 蓝本如此,且门本身
 *   保证同一时刻只有一发在飞)。
 */
async function rescan(): Promise<void> {
  const root = owningRoot.value
  if (!root || rescanBusy.value) return
  rescanBusy.value = true
  try {
    await store.rescanRoot(root.id)
    store.toast(t('aiKbRescanStarted'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  } finally {
    rescanBusy.value = false
  }
}

/** 蓝本 `:308-311`(**T7**)—— RFC3339 → 「x 分钟前」;后端 `formatTS` 的空串 / 非法值
 *  经 `parseTs` 得 0 ⇒ 返回空串(不显示 `1970`,承 P5d-T3 的单位教训)。 */
function fmtTs(rfc3339: string): string {
  const ms = parseTs(rfc3339)
  return ms ? fmtAgo(ms) : ''
}

/**
 * 蓝本 `:210-214` —— **N56 的第二半**:watch **无 `immediate`**。
 * 条件三件:有值 · 与当前选中不同 · 树里真有这个路径。
 * 🔴 `fromRoute: true` —— 值本来就来自地址栏,不再 replace 回去(防回环)。
 */
watch(
  () => route.query.path,
  () => {
    const v = queryPath()
    if (v && v !== sel.value && byPath.value[v]) select(v, { fromRoute: true })
  },
)

/**
 * 蓝本 `:215-218` 的 `created()`。
 * 🔴 `if (!wikiRoots.length)` 照抄 —— 从别的知识库页切过来时 store 里已有根列表,不重复拉。
 * ⚠️ 这一发**不 await**(蓝本也没有):`/v1/wiki/roots` 在本机会等满 60 s axios 超时(D1),
 *    await 它会把整页首屏也拖住。`loadRoots` 自己带 catch + toast(`knowledgeStore.ts:661-663`)。
 *    调用形态与同期 `RootsView.vue` 的 `onMounted` 逐字同款(不传 `silent`)。
 */
onMounted(() => {
  if (!store.wikiRoots.length) store.loadRoots()
  loadTree()
})
</script>

<template>
  <div class="kw-split">
    <!-- Left: directory tree (one node per folder = one .wiki.md)(蓝本 :3 原注释)-->
    <aside class="kw-tree">
      <div class="kw-tree-scroll">
        <template v-if="treeLoading">
          <span
            v-for="i in 6"
            :key="i"
            class="k-skel"
            style="display: block; height: 22px; margin: 6px 8px"
          />
        </template>
        <template v-else-if="treeError">
          <div class="kw-tree-note">
            {{ t('aiKbWkTreeError') }}
            <!-- 🔴 治理 §5.2:这个按钮**只在 treeError 分支里**渲染,而 treeLoading 为真时
                 上面那个 v-if 分支胜出 ⇒ 请求在飞时它不存在 = loadTree 不需要过期守卫。 -->
            <button class="k-btn outline" style="margin-top: 8px" @click="loadTree">
              {{ t('aiKbRetry') }}
            </button>
          </div>
        </template>
        <template v-else-if="!treeRoots.length">
          <div class="kw-tree-note">{{ t('aiKbWkEmptyTitle') }}</div>
        </template>
        <template v-else>
          <button
            v-for="item in visibleNodes"
            :key="item.n.path"
            class="kw-node"
            :data-active="String(sel === item.n.path)"
            :style="{ paddingLeft: 8 + item.depth * 14 + 'px' }"
            @click="nodeClick(item.n)"
          >
            <!-- 🔴 @click.stop:点 chevron 只折叠/展开,**不**触发整行的选中(蓝本 :26)。 -->
            <span
              v-if="item.n.children.length"
              class="kw-node-chev"
              :data-open="String(isOpen(item.n.path))"
              @click.stop="toggle(item.n.path)"
            ><KIcon name="chev" :size="11" /></span>
            <span v-else class="kw-node-chev" />
            <span class="kw-node-ico">
              <KIcon :name="item.depth === 0 ? 'drive' : 'folder'" :size="13" />
            </span>
            <span class="kw-node-name">{{ item.n.name }}</span>
          </button>
        </template>
      </div>
    </aside>

    <!-- Right: .wiki.md article(蓝本 :35 原注释)-->
    <div class="kw-article">
      <div class="kw-article-inner">
        <!-- Tree empty: onboarding pointer(蓝本 :38 原注释)
             🔴 §9.17:本机 /v1/wiki/tree 是**超时**不是空 ⇒ 走的是 treeError,这一屏本机到不了。 -->
        <div
          v-if="!treeLoading && !treeError && !treeRoots.length"
          class="kw-pending"
        >
          <div class="kw-pending-orb"><KIcon name="layers" :size="20" /></div>
          <div class="kw-pending-title">{{ t('aiKbWkEmptyTitle') }}</div>
          <div class="kw-pending-sub">{{ t('aiKbWkEmptySub') }}</div>
          <button class="k-btn primary" @click="router.push('/ai/knowledge/roots')">
            <KIcon name="drive" :size="12" /> {{ t('aiKbManageRoots') }}
          </button>
        </div>

        <template v-else-if="sel">
          <!-- K56 —— `:key` 必须在 `<template v-for>` 自身(Vue 3 编译器要求),
               内部两个元素不再各带 key;渲染出的 DOM 序列与蓝本 :50-53 逐个一致。 -->
          <div class="kw-crumb">
            <template v-for="c in crumbParents" :key="c.path">
              <button @click="select(c.path)">{{ c.name }}</button>
              <span>/</span>
            </template>
            <span class="cur">{{ selName }}</span>
          </div>

          <div class="kw-head">
            <h1 class="kw-title">
              <!-- 蓝本 :59 的两个 `--ly` 变量已核实两档都有值(knowledge.scss 的两个
                   声明块),照抄不改(附录 B §B.5)。 -->
              <span
                class="k2-tag"
                style="--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)"
              >TREE</span>{{ selName }}
            </h1>
            <div class="kw-actions">
              <button class="k-btn ghost" @click="openFolder">
                <KIcon name="folder" :size="12" /> {{ t('aiKbWkOpenFolder') }}
              </button>
            </div>
          </div>

          <!-- Article loading skeleton(蓝本 :68 原注释)-->
          <div
            v-if="nodeLoading"
            style="margin-top: 18px; display: flex; flex-direction: column; gap: 10px"
          >
            <span class="k-skel" style="display: block; height: 12px; width: 45%" />
            <span class="k-skel" style="display: block; height: 80px" />
            <span class="k-skel" style="display: block; height: 44px" />
            <span class="k-skel" style="display: block; height: 44px" />
          </div>

          <template v-else>
            <div class="kw-meta">
              <span v-if="updatedFmt">{{ t('aiKbWkSummaryUpdated', { t: updatedFmt }) }}</span>
              <span v-if="selAiLabel"><b>{{ selAiLabel }}</b></span>
              <span>{{ t('aiKbWkMaintained') }}</span>
            </div>

            <!-- Summary: sanitized .wiki.md markdown (or its raw source)(蓝本 :83 原注释)
                 🔴 §9.15:`v-html` 的输入必须是 renderWikiMarkdown 的产物(DOMPurify 消毒过)。 -->
            <template v-if="raw !== null">
              <pre v-if="showSource" class="kw-rawsrc">{{ raw }}</pre>
              <div v-else class="kw-summary kw-md" v-html="html" />
            </template>
            <div v-else class="kw-pending">
              <div class="kw-pending-orb"><KIcon name="layers" :size="20" /></div>
              <div class="kw-pending-title">{{ t('aiKbWkNoSummaryTitle') }}</div>
              <div class="kw-pending-sub">{{ t('aiKbWkNoSummarySub') }}</div>
              <!-- 🔴 §9.17 可点性:`owningRoot` 为 null(选中不属于任何索引根)时**整个按钮不渲染**,
                   点不到 —— 不是「渲染出来但 disabled」。`:disabled="rescanBusy"` 是另一层。 -->
              <button v-if="owningRoot" class="k-btn primary" :disabled="rescanBusy" @click="rescan">
                <KIcon name="refresh" :size="12" /> {{ t('aiKbWkRescanRoot') }}
              </button>
            </div>

            <!-- Contents (child_map)(蓝本 :97 原注释)-->
            <div v-if="node && node.childMap.length" class="kw-sec">
              <div class="kw-sec-head">
                <span class="kw-sec-title">{{ t('aiKbWkContents') }}</span>
                <!-- 🔴 附录 A §A.4:`kw-sec-en` 的英文是蓝本**未过 $t()** 的装饰文案,
                     照抄字面量,不许顺手 i18n 化。 -->
                <span class="kw-sec-en">Contents</span>
                <span class="kw-sec-count">{{ t('aiKbWkItemCount', { n: node.childMap.length }) }}</span>
              </div>
              <div class="kw-children">
                <button v-for="c in node.childMap" :key="c.name" class="kw-child" @click="childClick(c)">
                  <span class="kw-child-ico" :data-kind="childIsDir(c) ? 'dir' : 'file'">
                    <KIcon :name="childIsDir(c) ? 'folder' : 'file'" :size="14" />
                  </span>
                  <span class="kw-child-body">
                    <span class="kw-child-name">{{ c.name }}</span>
                    <div v-if="c.isOpaque" class="kw-child-sum">{{ t('aiKbWkCollapsed') }}</div>
                  </span>
                  <span class="kw-child-meta">{{ c.lastModified ? fmtTs(c.lastModified) : '' }}</span>
                  <span class="kw-child-chev"><KIcon name="chev" :size="12" /></span>
                </button>
              </div>
            </div>

            <!-- Recent changes (root-wide timeline)(蓝本 :119 原注释)-->
            <div v-if="changes.length" class="kw-sec">
              <div class="kw-sec-head">
                <span class="kw-sec-title">{{ t('aiKbWkRecentChanges') }}</span>
                <!-- 同上:蓝本未过 $t() 的装饰文案,照抄字面量(附录 A §A.4)。 -->
                <span class="kw-sec-en">Recent changes</span>
              </div>
              <div class="kw-changes">
                <div v-for="(c, i) in changes" :key="i" class="kw-change" :data-type="c.type">
                  <span class="kw-change-type">{{ c.label }}</span>
                  <span class="kw-change-name" :title="c.path">{{ c.name }}</span>
                  <span class="kw-change-time">{{ c.timeFmt }}</span>
                </div>
              </div>
            </div>

            <div v-if="raw !== null" class="kw-foot">
              <KIcon name="info" :size="12" />
              {{ t('aiKbWkRenderNote', { path: sel + '/.wiki.md' }) }}
              <button @click="showSource = !showSource">
                {{ showSource ? t('aiKbWkRenderedView') : t('aiKbWkViewSource') }} →
              </button>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<!--
  1:1 ported from the Vue 2 panel's `src/views/AI/MCP/McpServerDetail.vue`
  (174 lines) :1-157. Task 7 (test connection) fills three gaps T6 left:
    - :50-53 "Test connection" button
    - :87-100 test hint `.mcp-test-hint` / result panel `.mcp-test-result`
    - :158-171 `runTest()` method and `testing`/`testResult` (this repo `testView`) state,
      plus corresponding reset in `watch(() => props.server?.id)`
  T7's two deviations (**D8** error localization + collapsible technical details, **D11** in-flight request race guard)
  see `<script>` `runTest`/`reqSeq` header comments and template `mcp-test-result` branch comments.

  [Task 21 (2026-08-13 mcp-progressive-disclosure plan, the delete-confirm cascade
  notice) -- declared deviation from the brief's file list] The brief lists this under
  "Modify: ... McpSection.vue", but the delete-confirm dialog (`.sk-confirm`) has lived
  in THIS file since T6; `McpSection.vue` only forwards the `@delete` event and never
  owns the dialog's state -- the brief plainly missed that file boundary. Following the
  already-authorised principle from the sections.ts registration ("where the brief and
  the real code disagree, the real code wins"), the change lands here rather than in
  `McpSection.vue`. Where the cascade count comes from and why is documented on
  `approvalCascadeCount` below; the new standalone delete entry point
  (`data-test="delete-server-<id>"`, one click straight to the confirm dialog, no need
  to open the "..." menu first) is documented next to that button in the template.

  [Task 21 fix round (added after review, 2026-08-15) -- the residual gap declared in
  the paragraph above ("approvals for tools the server has since removed are not
  counted") was never an architectural limit, just one line the backend had not wired
  up: the `Tools` handler in `route/v2/mcp_approvals.go` had long since fetched the
  full, ungated `ListForServer` result into its `approvals` variable and simply never
  published `len(approvals)`. NimoOS-AI now ships a `total_stored_approvals` field
  (committed separately in that repo) and `approvalCascadeCount` reads it first, falling
  back to this file's original derivation only against a backend that predates the field
  -- see that constant's own header comment below.]
-->
<!--
  【Deviation D3, public constraint §3 #3】`SkillIcon.vue` not ported, unified to use
  `../../icons/AgentIcon.vue` (following P3a/T5 precedent).
  Vue2 :121 passes named color literal to delete button `SkillIcon` — this repo doesn't.
  grep-verified `.sk-btn.danger` (sk-shared.scss:50-54) has foreground declaration built-in: background takes
  danger semantic color `--danger`, icon/text inherit the fixed foreground color in that rule block (M7 fix round:
  original verbatim quoted color literal from CSS source, rewritten per public constraint §6 "no color literals
  even in comments" discipline, no longer copy source code).
  `AgentIcon` `color` prop default is already `currentColor` (AgentIcon.vue:79),
  SVG `stroke` uses `currentColor` (AgentIcon.vue:88) inherits button foreground declaration,
  no need to repeat color in this component — exactly matches `SkillDetail.vue:507-510` delete button existing approach
  (also no color passed), not a new pattern.

  【Deviation D9, public constraint §3 #9】Vue2 :36-37 status dot uses inline `:style` assembling
  `background` and `boxShadow` (two color literals, per color convention must not appear in this file, rewritten
  as: enabled state takes semantic color `--success` solid dot + same-color semi-transparent glow ring, disabled state
  takes semantic color `--text-quaternary` solid dot + same-color semi-transparent glow ring). This repo removes entire inline style,
  keeps only `:data-disabled` on `.val`, colors provided by two existing static rules in `skills-styles.scss`:
  `.sk-meta-cell .val .dot` (base state, :351-369) and `.val[data-disabled="true"] .dot` (disabled override, :370-376).
  DOM structure identical — `<div class="val" :data-disabled="...">` wraps zero-attribute `<span class="dot" />`,
  two selectors naturally hit by CSS cascade, zero new tokens.

  【Deviation D6, public constraint §3 #6】delete confirmation modal doesn't use `SkModal`, directly hand-assembled with reka Dialog
  primitives (`DialogRoot`/`DialogPortal`/`DialogOverlay`/`DialogContent`/`DialogTitle`), copied from
  `../skills/SkillDetail.vue:486-517`. Rationale for two modal shells coexisting in same section (isomorphic with that file's
  "deviation report 2"): Vue2's confirm modal (:112-125) has no title bar (title is `<h3>` in `.sk-confirm-body`),
  `SkModal` forces render of title bar + close button, default slot wrapped in `.sk-modal-body` stacks padding with
  `.sk-confirm-body`'s built-in padding, `.sk-modal` class also hardcoded can't add `.sk-confirm` — three reasons don't fit
  `SkModal` shape, must hand-assemble to pixel-perfect match Vue2. `DialogPortal to=".set-app"` cannot be omitted —
  AI region tokens defined in `.agent-app`/`.set-app` scope (tokens.scss:31), portaling to body fails all `var(--…)`
  parsing, modal becomes transparent/wrong color (documented three times already this period). Accessibility title uses
  `<VisuallyHidden as-child><DialogTitle>`, same precedent as `SkillDetail.vue:492`.

  【Click outside to close menu, coordinator ruling 5】Vue2 :143-153 is conditional add/remove of `document` `mousedown`
  listener inside `watch(menuOpen)` + `beforeDestroy` fallback. This file per ruling uses `watch` + `onBeforeUnmount`
  byte-for-byte equivalent (not using `useClickOutside` composable — that's P3b `SkillDetail.vue`'s implementation choice,
  task spec explicitly requires hand-write here to match Vue2's conditional mount timing). Only listen to `mousedown`,
  no additional `click`, no Esc — those are unreported deviations.

  【Deviation D4, public constraint §3 #4】no `console.error` (this file has no error paths anyway,
  pure display + emit forward).

  【Implementation choice, not behavior deviation】Vue2 data field name is `confirm` (boolean), this repo renames to
  `confirmOpen` — reason identical to `SkillDetail.vue:156-158`: avoid reading ambiguity with JS global `window.confirm`,
  pure identifier rename, DOM/behavior unchanged.
  Vue2 `color()`/`label2()` two computed/methods are just direct forwarding to `serverColor`/`transportLabel`,
  this repo following `McpServerGroup.vue` (T5) precedent calls utility functions directly in template,
  no new wrapper computed added.
  Vue2 :119 `<div class="right" style="margin-left: auto">` duplicates with
  `sk-shared.scss:149` existing `.sk-modal-foot .right { margin-left: auto; ... }` rule (same as
  `SkillDetail.vue:505` existing), so no duplicate inline style — visual result unchanged, not an omission.

  Zero `<style>` block: every class used already exists in `skills-styles.scss`
  (`sk-detail*`/`sk-name`/`sk-meta-*`/`sk-section*`/`sk-menu`/`sk-pill-more`/`sk-confirm*`),
  `sk-shared.scss` (`sw`/`sk-modal*`/`sk-btn`) or T1's `mcp-styles.scss` (`mcp-config*`/`mcp-code`).
-->
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
} from 'reka-ui'
import type { McpServer, McpTestView } from '../../../types/mcpServer'
import type { McpToolRow } from '@nimotech/nimoos-service'
import { toTestView, toTestViewFromError } from '../../../util/mcpErrorKey'
import { protocolLine } from '../../../util/mcpProtocol'
import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from '../skills/SkillTile.vue'
import McpToolList from '../sections/McpToolList.vue'

// Aligned with Vue2 `props: { server: { type: Object, default: null } }` (:139).
const props = defineProps<{ server: McpServer | null }>()

// Aligned with Vue2 `$emit('toggle', …)` (:18)/`$emit('edit', …)` (:22)/`$emit('delete', …)` (:157).
const emit = defineEmits<{
  (e: 'toggle', id: number, enabled: boolean): void
  (e: 'edit', server: McpServer): void
  (e: 'delete', id: number): void
}>()

const { t } = useI18n()

// Backend has no icon field, all MCP services use this glyph uniformly (Vue2 `data(){ glyph: SERVER_GLYPH }` (:140)).
const glyph = SERVER_GLYPH

// More menu expand/collapse, aligned with Vue2 `data(){ menuOpen: false }` (:140).
const menuOpen = ref(false)
// Delete confirmation modal, aligned with Vue2 `data(){ confirm: false }` (:140) — renamed to confirmOpen,
// see file header comment "Implementation choice, not behavior deviation".
const confirmOpen = ref(false)
// Wrapper element for `.sk-pill-more` button + `.sk-menu` dropdown, aligned with Vue2 `ref="menuWrap"` (:19).
const menuWrap = ref<HTMLElement | null>(null)

// Test connection, aligned with Vue2 `data(){ testing: false, testResult: null }` (:140) — this repo
// renames `testResult` to `testView` because it stores the result of T3's `toTestView`/`toTestViewFromError`
// mapped `McpTestView` (i18n key + detail), not raw backend response; renaming avoids confusion with
// `McpTestResult` (backend original shape, types/mcpServer.ts).
const testing = ref(false)
const testView = ref<McpTestView | null>(null)
// 【Deviation D11, public constraint §3 #11】Vue2 `runTest` (:158-171) has no request token:
// stdio probe takes up to 100s (`NimoOS-AI/route/v2/mcp.go:346`), during which if user switches to
// another server, the `watch(() => props.server?.id)` above already clears `testView`,
// but when the in-flight promise lands it still executes `testView.value = ...`, writing
// **old server's result** into **new server's panel** — reproducible mismatch, not harmless timing.
// Here we use monotonically-increasing `reqSeq` guard: take a number on entry, switching servers in
// `watch` invalidates the number, success/failure/finally all check before landing if number is still
// the one sent, else discard entirely (including not reset `testing`, since that's already new-round state,
// the new round's own finally handles it).
const reqSeq = ref(0)
// The `reqSeq` guard above only stops a late answer from LANDING in the wrong
// panel -- the request itself keeps running. That matters more since the
// backend started waiting inside this call: it now waits (up to ~10s) for a
// probe already in flight, and a stdio probe can hold the connection for
// ~125s. Switching servers or closing the panel therefore aborts it, so the
// browser is not holding a connection nobody will read, and the backend's
// waiter is released. Aborting never cancels the probe itself: the backend
// keeps it running and still persists its result (NimoOS-AI's `awaitProbe`).
let testAbort: AbortController | null = null

function abortInFlightTest() {
  testAbort?.abort()
  testAbort = null
}

// #141: the protocol-version line shown under the success panel, derived from
// the current testView via the T8 pure function (see mcpProtocol.ts).
const protoLine = computed(() => (testView.value ? protocolLine(testView.value) : null))

// The backend's `config_changed`: this result came from a probe that was
// already running when the server was edited, so it describes the config as
// it was BEFORE that edit. The success panel has to say so -- otherwise it
// reads as "the address and token now on screen work", which is precisely
// what was never tested.
const testConfigChanged = computed(() => testView.value?.ok === true && testView.value.configChanged)

// Aligned with Vue2 `runTest()` (:158-171).
async function runTest() {
  if (!props.server || testing.value) return // Vue2 :159 byte-for-byte match
  const seq = ++reqSeq.value
  const id = props.server.id
  testing.value = true
  testView.value = null
  const ac = new AbortController()
  testAbort = ac
  try {
    // 【Deviation D1, public constraint §3 #1】single layer data extraction: shared package
    // `service.ai.testMCPServer` already `return res.data` (the shared HTTP client's `src/ai.ts:388-391`),
    // backend `mcp.go:355` is `c.JSONBlob` raw object. Vue2 :164's `resp.data` is always
    // `undefined` in this repo, would make "test connection" **always show failure**, even if backend returns
    // `ok:true` — verbatim copy would be a bug, here directly use `body` itself.
    const body = await service.ai.testMCPServer(id, ac.signal)
    if (seq !== reqSeq.value) return
    testView.value = toTestView(body)
  } catch (e) {
    if (seq !== reqSeq.value) return
    testView.value = toTestViewFromError(e)
  } finally {
    if (testAbort === ac) testAbort = null
    if (seq === reqSeq.value) {
      testing.value = false
      // A probe is the one moment the persisted tool list is guaranteed to
      // have just been rewritten (the backend re-lists the server's tools and
      // clears the `desc_changed` flags as part of persisting the probe), so
      // it is exactly when this panel must re-read it. Without this the list
      // below keeps showing the pre-test snapshot -- tools the server no
      // longer offers, and change flags that were already acknowledged.
      // Also on the failure path: a failed probe still moves the health state
      // the rows render.
      loadTools(id)
    }
  }
}

// Click outside to close menu, byte-for-byte equivalent to Vue2 `watch: { menuOpen(v) {...} }` (:143-150) +
// `beforeDestroy` (:153). See file header comment "Click outside to close menu".
let docListener: ((e: MouseEvent) => void) | null = null
watch(menuOpen, (v) => {
  if (v) {
    docListener = (e: MouseEvent) => {
      const w = menuWrap.value
      if (w && !w.contains(e.target as Node)) menuOpen.value = false
    }
    document.addEventListener('mousedown', docListener)
  } else if (docListener) {
    document.removeEventListener('mousedown', docListener)
    docListener = null
  }
})
onBeforeUnmount(() => {
  if (docListener) document.removeEventListener('mousedown', docListener)
  abortInFlightTest()
})

// Aligned with Vue2 `watch: { 'server.id'() {...} }` (:151), same line also clears
// `this.testing = false; this.testResult = null`. This repo additionally `reqSeq.value++`
// — 【Deviation D11】see `runTest` header comment below: make old in-flight requests invalid when switching,
// if sequence number doesn't match on landing, discard entirely, won't write old server's test result to new server's panel.
watch(() => props.server?.id, () => {
  menuOpen.value = false
  confirmOpen.value = false
  reqSeq.value += 1
  testing.value = false
  testView.value = null
  // reqSeq above already invalidates the answer; this drops the request too.
  abortInFlightTest()
})

// Task 20 (mcp-progressive-disclosure plan) -- the persisted tool list +
// approval state, read via `listMCPTools` and handed to `McpToolList.vue`.
// Zero-network on the server side (see that component's file header), so
// this loads instantly even for a server that is currently unreachable --
// unlike `runTest()` above, which actually dials the server.
const toolRows = ref<McpToolRow[]>([])
const toolsLoading = ref(false)
// Fix round (review point B/C): whether a server-level ('*') grant exists at
// all, plus its own stale reason/key if void -- see McpToolList.vue's
// `serverLevelApproved` prop doc comment for why this can't be derived from
// `toolRows` alone.
const serverLevelApproved = ref(false)
const serverLevelStaleReason = ref('')
const serverLevelStaleReasonKey = ref('')
// Task 21 fix round -- see `approvalCascadeCount` below for why this (not a
// derivation from `toolRows`/`serverLevelApproved`) is the count's primary
// source. `undefined` (not 0) when the field is missing, so the computed can
// tell "backend predates this field" apart from "honestly zero approvals".
const totalStoredApprovals = ref<number | undefined>(undefined)
// Same race the `reqSeq` guard above protects `runTest()` against, applied
// to this independent request: switching servers while a `listMCPTools` call
// is in flight must not let the old server's tools land in the new server's
// panel. Kept as its own counter rather than reusing `reqSeq` -- the two
// requests are unrelated and run concurrently, sharing one counter would let
// finishing one wrongly invalidate the other.
let toolsSeq = 0

// Task 21 (mcp-progressive-disclosure plan, fix round) -- the honest count of
// stored approval rows this server's delete cascades to. Deliberately NOT
// `listMCPApprovals()` (the gated cross-server summary McpApprovalsSection.vue
// reads) -- that endpoint only returns approvals that currently pass every
// invalidation gate, so a stored-but-void approval (e.g. every approval for a
// server goes void once its URL is edited) would silently disappear from the
// count even though CASCADE will still drop its row.
//
// Primary source: `listMCPTools`'s `total_stored_approvals` (backend
// `route/v2/mcp_approvals.go`'s `Tools` handler, Task 21 fix round) -- the
// raw `len(approvals)` from `ListForServer`, which queries
// `mcp_tool_approvals WHERE server_id = ?` with NO gate applied at all, the
// same predicate a server-delete CASCADE acts against. This is the one
// number that cannot undercount: unlike the per-tool `tools` rows below (each
// built by ranging over the server's CURRENT handshake tool metas), it is not
// filtered by whether a tool still appears in the latest listing -- an
// approval for a tool the server has since stopped offering is still counted
// here even though it no longer produces a `McpToolRow` at all. See that
// field's doc comment in `packages/service/src/ai.ts` for the full backend
// trace.
//
// Fallback: `toolRows.filter(approved).length + (serverLevelApproved ? 1 : 0)`
// -- the original Task 21 derivation, kept only for a backend that predates
// `total_stored_approvals` (the field is `undefined` there, not absent-but-
// zero, so `!= null` distinguishes "old backend" from "field is honestly 0").
// This fallback still has the removed-tool undercount `total_stored_approvals`
// exists to close; it is a compatibility floor, not a second correct source.
const approvalCascadeCount = computed(() => {
  if (totalStoredApprovals.value != null) return totalStoredApprovals.value
  return toolRows.value.filter((tool) => tool.approved).length + (serverLevelApproved.value ? 1 : 0)
})

async function loadTools(id: number) {
  const seq = ++toolsSeq
  toolsLoading.value = true
  try {
    const res = await service.ai.listMCPTools(id)
    if (seq !== toolsSeq) return
    toolRows.value = Array.isArray(res?.tools) ? res.tools : []
    serverLevelApproved.value = !!res?.server_level_approved
    serverLevelStaleReason.value = res?.server_level_stale_reason || ''
    serverLevelStaleReasonKey.value = res?.server_level_stale_reason_key || ''
    totalStoredApprovals.value = res?.total_stored_approvals
  } catch {
    if (seq !== toolsSeq) return
    toolRows.value = []
    serverLevelApproved.value = false
    serverLevelStaleReason.value = ''
    serverLevelStaleReasonKey.value = ''
    totalStoredApprovals.value = undefined
  } finally {
    if (seq === toolsSeq) toolsLoading.value = false
  }
}

watch(() => props.server?.id, (id) => {
  toolsSeq += 1 // invalidate any in-flight load from the previous server
  toolRows.value = []
  toolsLoading.value = false
  serverLevelApproved.value = false
  serverLevelStaleReason.value = ''
  serverLevelStaleReasonKey.value = ''
  totalStoredApprovals.value = undefined
  if (id !== undefined) loadTools(id)
}, { immediate: true })

// Aligned with Vue2 `closeAnd(fn)` (:155).
function closeAnd(fn?: () => void) {
  menuOpen.value = false
  fn?.()
}

// Aligned with Vue2 menu first item inline arrow `() => $emit('edit', server)` (:22). Split into named function
// (not template inline arrow body) because vue-tsc's non-null narrowing for `server` in v-else branch
// doesn't penetrate into template inline arrow body (TS18047), named function re-checks `props.server`
// in <script> — same explanation as `SkillDetail.vue` `toggleFromMenu` header comment, behavior completely
// equivalent to inline.
function emitEdit() {
  const s = props.server
  if (!s) return
  emit('edit', s)
}

// Aligned with Vue2 menu second item inline arrow `() => confirm = true` (:24), same rationale as above.
function openConfirmDialog() {
  confirmOpen.value = true
}

// Aligned with Vue2 `doDelete()` (:157).
function doDelete() {
  const s = props.server
  if (!s) return
  confirmOpen.value = false
  emit('delete', s.id)
}
</script>

<template>
  <div class="sk-detail">
    <template v-if="!server">
      <div class="sk-detail-empty">
        <div class="sk-detail-empty-inner">
          <div class="orb" />
          <div class="empty-title">{{ t('aiMcpSrvPickHint') }}</div>
          <div class="empty-sub">{{ t('aiMcpSrvPickSub') }}</div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="sk-detail-bar">
        <SkillTile :color="serverColor(server.name)" :icon="glyph" :size="28" :radius="8" />
        <div class="sk-name"><span>{{ server.name }}</span><code>{{ transportLabel(server.transport) }}</code></div>
        <div
          class="sw"
          :data-on="server.enabled ? 'true' : 'false'"
          role="switch"
          :aria-checked="server.enabled ? 'true' : 'false'"
          @click="emit('toggle', server.id, !server.enabled)"
        />
        <!-- Task 21 (mcp-progressive-disclosure plan) -- a standalone, directly
             clickable delete trigger, additional to the "..." menu's "Remove"
             item below (kept as-is; existing tests 9a-9c drive it through the
             menu). Both open the same `confirmOpen` dialog -- this one exists
             so deleting a server is a single click, not "open menu, then find
             the danger item inside it". Deliberately `.icon-btn`, not
             `.sk-pill-more` -- that class is also on the "..." button right
             below, and existing tests locate it with `find('.sk-pill-more')`
             (which returns the FIRST match); sharing the class would make
             those tests silently click this new button instead. -->
        <button
          class="icon-btn"
          :data-test="`delete-server-${server.id}`"
          :title="t('aiMcpSrvRemove')"
          @click="openConfirmDialog"
        >
          <AgentIcon name="trash" :size="16" />
        </button>
        <div ref="menuWrap" style="position: relative">
          <button class="sk-pill-more" @click="menuOpen = !menuOpen">
            <AgentIcon name="settings" :size="16" />
          </button>
          <div v-if="menuOpen" class="sk-menu">
            <button @click="closeAnd(emitEdit)">
              <AgentIcon name="edit" :size="13" /> {{ t('aiMcpSrvEditConfig') }}
            </button>
            <hr>
            <button data-danger="true" @click="closeAnd(openConfirmDialog)">
              <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemove') }}
            </button>
          </div>
        </div>
      </div>

      <div class="sk-detail-body">
        <div class="sk-detail-inner">
          <div class="sk-meta-grid">
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvStatus') }}</div>
              <div class="val" :data-disabled="!server.enabled ? 'true' : 'false'">
                <span class="dot" />
                {{ server.enabled ? t('aiCfgEnabled') : t('aiMcpSrvDisabled') }}
              </div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvTransport') }}</div>
              <div class="val">{{ transportLabel(server.transport) }}</div>
            </div>
            <div v-if="server.transport !== 'stdio'" class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvHeaders') }}</div>
              <div class="val">{{ server.has_headers ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvEnv') }}</div>
              <div class="val">{{ server.has_env ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
            </div>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiMcpSrvConfiguration') }}</div>
              <div class="sk-section-hint">{{ t('aiMcpSrvConfigHint') }}</div>
              <!-- Aligned with Vue2 :50-53. -->
              <button class="sk-btn ghost mcp-test-btn" :disabled="testing" @click="runTest">
                <span v-if="testing" class="sk-spinner" />
                {{ testing ? t('aiMcpSrvTesting') : t('aiMcpSrvTest') }}
              </button>
            </div>
            <div class="sk-section-body">
              <div class="mcp-config">
                <template v-if="server.transport === 'stdio'">
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvCommand') }}</div>
                    <div class="val"><code class="mcp-code">{{ server.command }}</code></div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvArgs') }}</div>
                    <div class="val"><code class="mcp-code">{{ (server.args || []).join(' ') || t('aiMcpSrvNone') }}</code></div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
                    <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                  </div>
                </template>
                <template v-else>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvUrl') }}</div>
                    <div class="val"><code class="mcp-code">{{ server.url }}</code></div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvReqHeaders') }}</div>
                    <div class="val">{{ server.has_headers ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
                    <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                  </div>
                </template>
              </div>

              <!-- Aligns with Vue2 :87-100. The wording dropped its hard-coded
                   duration (was "~90s") — that number was copied across a repo
                   boundary and drifted twice in one change set; a number-free
                   phrasing cannot go stale. -->
              <div v-if="testing && server.transport === 'stdio'" class="mcp-test-hint">
                {{ t('aiMcpSrvTestStdioHint') }}
              </div>
              <div v-if="testView" class="mcp-test-result" :data-ok="testView.ok ? 'true' : 'false'">
                <template v-if="testView.ok">
                  <div class="mcp-test-line">✓ {{ t('aiMcpSrvTestOk', { n: testView.toolCount }) }}</div>
                  <div class="mcp-test-tools">
                    <span v-for="tool in testView.tools" :key="tool" class="mcp-tool-chip">{{ tool }}</span>
                  </div>
                  <!-- Which MCP protocol version the server negotiated (see the
                       script comment above protoLine for the tracking ticket --
                       spelling it out with a leading "#" here trips the bare-hex-
                       color guard in src/ai/styles/knowledgeStyles.test.ts (the
                       template-scanning guard driven by COMPONENTS_VUE_FILES),
                       since three decimal digits are also valid hex digits;
                       the sister guard for this file's <script> block comments
                       is pinned to a different file list, which is why the
                       identical ticket number there is not flagged). -->
                  <div v-if="protoLine" class="mcp-test-proto" :class="{ 'is-legacy': protoLine.key === 'aiMcpSrvProtoLegacy' }">
                    {{ t(protoLine.key, protoLine.params) }}
                  </div>
                  <!-- The probe this result came from predates an edit made
                       while it ran (backend `config_changed`), so the panel
                       above describes the previous configuration. Rendered
                       inside the success branch on purpose: the connection
                       genuinely worked, just not necessarily with what is on
                       screen now. -->
                  <div v-if="testConfigChanged" class="mcp-test-stale">
                    {{ t('aiMcpSrvTestConfigChanged') }}
                  </div>
                </template>
                <template v-else>
                  <div class="mcp-test-line">✗ {{ t(testView.msgKey) }}</div>
                  <!-- 【Deviation D8, public constraint §3 #8】Vue2 :98 directly shows backend-assembled
                       English error string (`testResult.error`). Here changed to localized single sentence
                       from `error_key` mapping (`testView.msgKey`) + default-collapsed technical
                       details (`testView.detail`, user approved 2026-07-31); backend English
                       original never appears on interface. Collapse section not rendered when `detail` is empty
                       (`v-if="testView.detail"`) — this control didn't exist in Vue2, new and authorized
                       interface deviation this period, not "added as side effect of copying". -->
                  <details v-if="testView.detail" class="mcp-test-detail">
                    <summary>{{ t('aiMcpSrvTestDetail') }}</summary>
                    <pre>{{ testView.detail }}</pre>
                  </details>
                </template>
              </div>
            </div>
          </div>

          <!-- Task 20 (mcp-progressive-disclosure plan): the persisted tool
               list + per-tool/server-level approval toggles, replacing what
               was previously just a static note here. -->
          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiMcpSrvToolsTitle') }}</div>
            </div>
            <div class="sk-section-body">
              <div class="sk-description">{{ t('aiMcpSrvToolsNote') }}</div>
              <div v-if="toolsLoading" data-test="tools-loading" style="display: grid; place-items: center; padding: 14px 0">
                <div class="sk-spinner" />
              </div>
              <McpToolList
                v-else
                :server-id="server.id"
                :tools="toolRows"
                show-server-level
                :server-level-approved="serverLevelApproved"
                :server-level-stale-reason="serverLevelStaleReason"
                :server-level-stale-reason-key="serverLevelStaleReasonKey"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Delete confirmation modal, aligned with Vue2 :112-125. Deviation D6 (see file header):
           doesn't use SkModal, reka primitives hand-assembled, code copied from SkillDetail.vue:486-517. -->
      <DialogRoot :open="confirmOpen" @update:open="confirmOpen = $event">
        <DialogPortal to=".set-app" defer>
          <DialogOverlay class="sk-modal-bg">
            <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
              <VisuallyHidden as-child><DialogTitle>{{ t('aiMcpSrvRemoveTitle') }}</DialogTitle></VisuallyHidden>
              <div data-test="delete-confirm" class="sk-confirm-body">
                <h3>{{ t('aiMcpSrvRemoveTitle') }}</h3>
                <p>{{ t('aiMcpSrvRemoveBody', { name: server.name }) }}</p>
                <!-- Task 21 (mcp-progressive-disclosure plan) -- the cascade
                     must be named before the user confirms, not discovered
                     after. Hidden entirely when there is nothing to lose
                     (see approvalCascadeCount's doc comment for the count's
                     source). -->
                <p v-if="approvalCascadeCount > 0" class="mcp-reveal-warn" style="margin-top: 6px">
                  {{ t('aiMcpSrvRemoveApprovalsCount', { count: approvalCascadeCount }) }}
                </p>
              </div>
              <div class="sk-modal-foot">
                <div class="right">
                  <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
                  <!-- Deviation D3 (see file header): no named color passed, color supplied by
                       `.sk-btn.danger`'s built-in foreground declaration, AgentIcon inherits default currentColor
                       (M7 fix round: comments no longer quote color literals from CSS source verbatim). -->
                  <button class="sk-btn danger" @click="doDelete">
                    <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemoveConfirm') }}
                  </button>
                </div>
              </div>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </DialogRoot>
    </template>
  </div>
</template>

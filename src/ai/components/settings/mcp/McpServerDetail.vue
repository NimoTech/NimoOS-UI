<!--
  SP8-P4 Task 6 — 1:1 ported from Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerDetail.vue`
  (174 lines) :1-157. Task 7 (test connection) fills three gaps T6 left:
    - :50-53 "Test connection" button
    - :87-100 test hint `.mcp-test-hint` / result panel `.mcp-test-result`
    - :158-171 `runTest()` method and `testing`/`testResult` (this repo `testView`) state,
      plus corresponding reset in `watch(() => props.server?.id)`
  T7's two deviations (**D8** error localization + collapsible technical details, **D11** in-flight request race guard)
  see `<script>` `runTest`/`reqSeq` header comments and template `mcp-test-result` branch comments.

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
import { toTestView, toTestViewFromError } from '../../../util/mcpErrorKey'
import { protocolLine } from '../../../util/mcpProtocol'
import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from '../skills/SkillTile.vue'

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

// #141: the protocol-version line shown under the success panel, derived from
// the current testView via the T8 pure function (see mcpProtocol.ts).
const protoLine = computed(() => (testView.value ? protocolLine(testView.value) : null))

// Aligned with Vue2 `runTest()` (:158-171).
async function runTest() {
  if (!props.server || testing.value) return // Vue2 :159 byte-for-byte match
  const seq = ++reqSeq.value
  const id = props.server.id
  testing.value = true
  testView.value = null
  try {
    // 【Deviation D1, public constraint §3 #1】single layer data extraction: shared package
    // `service.ai.testMCPServer` already `return res.data` (`NimoOS-Service/src/ai.ts:388-391`),
    // backend `mcp.go:355` is `c.JSONBlob` raw object. Vue2 :164's `resp.data` is always
    // `undefined` in this repo, would make "test connection" **always show failure**, even if backend returns
    // `ok:true` — verbatim copy would be a bug, here directly use `body` itself.
    const body = await service.ai.testMCPServer(id)
    if (seq !== reqSeq.value) return
    testView.value = toTestView(body)
  } catch (e) {
    if (seq !== reqSeq.value) return
    testView.value = toTestViewFromError(e)
  } finally {
    if (seq === reqSeq.value) testing.value = false
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
})

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

          <div class="sk-section">
            <div class="sk-section-body">
              <div class="sk-description">{{ t('aiMcpSrvToolsNote') }}</div>
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
              <div class="sk-confirm-body">
                <h3>{{ t('aiMcpSrvRemoveTitle') }}</h3>
                <p>{{ t('aiMcpSrvRemoveBody', { name: server.name }) }}</p>
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

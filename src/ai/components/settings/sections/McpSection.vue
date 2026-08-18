<!--
  SP8-P4 Task 9 (wrap-up) — ported 1:1 from Vue2 `NimoOS-UI/src/views/AI/MCP/McpSection.vue`
  (136 lines). Its twin sibling is `./SkillsSection.vue` (SP8-P3a/P3b, already reviewed and
  approved) — this file's `<script setup>` style, the structure of the four data methods
  (reload/toggle/delete/save), and the `+` button wiring are all copied from it; no third
  pattern is introduced. Once this file is done, `sections.ts`'s `DEFERRED_SECTIONS` is
  empty — all 13 settings sections are now wired to real components.

  [Divergence D1 (public constraint §3 item 1, mandatory, hits two spots)]

  1. `reload()` — Vue2 `:74` `this.servers = resp.data || []`. The shared package's
     `service.ai.listMCPServers()` already `return res.data` (peels off the axios layer
     once), while the backend `mcp.go:96` is `c.JSON(200, out)` — a bare array. Peeling
     off `.data` again on a bare array is always `undefined`, so `this.servers` is always
     `[]` (the `|| []` fallback masks the fact that it actually got `undefined`) — the
     server list is forever empty. This repo uses the return value directly as an array:
     `Array.isArray(list) ? list : []` (same mold, same line, as `SkillsSection.vue`'s
     `reload()`).
  2. `onSave`'s create branch — Vue2 `:117` `const id = resp.data && resp.data.id`.
     The shared package's `service.ai.createMCPServer` is likewise already peeled once,
     while the backend `mcp.go:121` is `201 {"id": <int64>}` — not a full object. Peeling
     off `.data` again is always `undefined`, so the new server never gets selected after
     a successful create. This repo reads `(created as { id?: number })?.id` directly.

  [Divergence D2 (public constraint §3 item 2)] `.sk-toast` (Vue2 `:32-34`, `showToast()`)
  is not ported; switched to the global `useToast().show()`. Vue2's `.sk-toast` template
  **unconditionally** renders a green check icon (`:33`) — even a failure message wears a
  "success" checkmark. This is Vue2's own defect and is not copied (carried over from
  P3a/P3b, declared the same way as `SkillsSection.vue`). Failure states uniformly go
  through `toast.show(t(...), 3000, 'danger')`; the `danger` tier naturally has no check.

  [Divergence D4 (public constraint §3 item 4)] No `console.error` (Vue2 has four:
  `:79,93,105,124`) — none of this repo's three sibling sections
  (BlacklistSection/ExecutionSection/MemorySection) nor `SkillsSection.vue` follow that
  convention; silently swallowing the error plus toast/inline error display is enough.

  [Divergence D5 (public constraint §3 item 5)] `onSave` failure no longer reads Vue2
  `:125`'s `e.response.data.message` (raw backend English text — the hard rule is the UI
  never echoes it back). Instead it uses `util/mcpErrorKey.ts` (T3)'s
  `saveServerErrorKey(e)` to map to an i18n key; `saveError` is passed to
  `McpServerModal`'s `serverError` prop — **the dialog stays open** (so the user can edit
  and retry), shown inline rather than as a toast (carried over from P3b's
  `SkillsSection.vue` `onCreate`, same pattern). `watch(modalOpen)` clears `saveError` on
  close (per `SkillsSection.vue:126-128`) — so the next time the dialog opens it won't
  show a leftover error from the previous attempt.

  [Divergence D7 (public constraint §3 item 7)] The `+` button's `AgentIcon` does not pass
  the named color `color="white"` (Vue2 `:7`) — no `color` prop, falls back to
  `currentColor`, colored by `.sk-add-btn`'s `--text-on-accent` (from
  `skills-styles.scss:183`), same as `SkillsSection.vue`.

  [N4 copied verbatim, unchanged (public constraint §3.5 item 4, confirmed as intentional
  copy)] `activeServer` is looked up in **the unfiltered `servers`** (Vue2 `:64`), not in
  `filtered` — so the right-hand detail panel doesn't clear itself while searching, same
  as `SkillsSection.vue`'s `activeSkill`; not a new decision made in this file.

  [Selected-item placement after delete, matching Vue2 `:102`] `activeId` only falls back
  to the first remaining item when the deleted item **was the currently selected one**;
  deleting a different item leaves `activeId` untouched — same condition as
  `SkillsSection.vue`'s `onDelete`.

  [Interface divergence (ruling 3, following the interface `McpServerModal` already
  established in T8)] Vue2 uses `v-if="modalOpen"` (rebuilds the instance on every open,
  so `data()` naturally only runs once) plus `@close`. In this repo `McpServerModal` is
  already designed as `v-model:open` always-mounted plus two props, `server`/`serverError`
  (see that file's header comment); `McpSection`'s side just needs to set `editing` and
  `modalOpen` together inside `openCreate`/`openEdit` (setting `editing.value` first, then
  `modalOpen.value = true`, in the same function body — Vue's reactivity will sync both to
  `McpServerModal`'s `watch(() => props.open, ...)` before the next render, so there's no
  flicker where "the dialog first pops open with the old server, then refreshes to the new
  server on the next frame"). The two integration tests the coordinator added
  ("edit A → close → edit B", "create → close → edit") are exactly what pins down this
  ordering.

  [`+` button doesn't pass a named color, zero <style> blocks] Every class used already
  exists in the existing scss: `set-split`/`sk-col*`/`sk-list`/`sk-col-empty`/`sk-spinner`/
  `icon-btn`/`sk-col-actions`/`sk-add-btn` (`settings-styles.scss`/`skills-styles.scss`,
  the exact same class set as `SkillsSection.vue`, already reviewed and approved in that
  file). Vue2 `:13`/`:16`'s inline `style="width: 18px; height: 18px"` /
  `style="display: grid; place-items: center; padding: 28px 0"` are size/layout, not
  color, and are copied as-is (public constraint §6 explicitly allows this).
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { McpServer, McpServerFormPayload } from '../../../types/mcpServer'
import { saveServerErrorKey, toTestView, toTestViewFromError } from '../../../util/mcpErrorKey'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import McpServerGroup from '../mcp/McpServerGroup.vue'
import McpServerDetail from '../mcp/McpServerDetail.vue'
import McpServerModal from '../mcp/McpServerModal.vue'

const { t } = useI18n()
const toast = useToast()

const servers = ref<McpServer[]>([])
const loading = ref(true)
const activeId = ref<number | null>(null)
const query = ref('')

const modalOpen = ref(false)
const editing = ref<McpServer | null>(null)
const saving = ref(false)
const saveError = ref('')
// Task 19: synchronous connectivity probe after a successful add/edit. True
// while the reused `testMCPServer` request (axios 135s timeout) is in flight,
// so the template can show that work is still happening even though the
// modal has already closed.
const probing = ref(false)

// Clear the inline error when the dialog closes (see the "Divergence D5" section of the
// file header comment, per SkillsSection.vue:126-128), and also clear `editing` (fix
// round M5).
//
// [Fix round M5, undeclared divergence] Vue2's `closeModal()` (`:85`) is
// `{ this.modalOpen = false; this.editing = null }` — **every** close path clears
// `editing`. This repo previously only cleared it inside `closeModal()` (below, only
// called after a successful onSave); the cancel / top-right X / overlay close paths all
// go through `v-model:open` setting `modalOpen` to false directly, bypassing
// `closeModal()`, so `editing` would keep its stale value. Although `openCreate`/
// `openEdit` reset `editing` every time, and `McpServerModal`'s `watch(open)` true branch
// also backfills from `props.server`, testing showed no visible consequence — but this
// was a behavioral difference never declared in any report, and per porting discipline
// "an undeclared divergence is itself a defect", it's fixed here: clearing `editing` was
// moved into this watch, alongside clearing `saveError`, covering every close path, to
// match Vue2's `closeModal()` clearing both on every path.
watch(modalOpen, (v) => {
  if (!v) {
    saveError.value = ''
    editing.value = null
  }
})

// Matches Vue2's `computed` (`:57-64`).
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return servers.value
  // Vue2 `:60` only searches the name/url fields, not command — copied as-is (design §5.1).
  return servers.value.filter(
    (s) => (s.name || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q),
  )
})
const enabled = computed(() => filtered.value.filter((s) => s.enabled))
const disabled = computed(() => filtered.value.filter((s) => !s.enabled))
// N4 copied verbatim, unchanged (see file header comment): activeServer is looked up in
// the unfiltered servers, so searching doesn't clear the detail panel.
const activeServer = computed(() => servers.value.find((s) => s.id === activeId.value) || null)

function setActive(id: number) {
  activeId.value = id
}

// Matches Vue2's `reload()` (`:70-82`).
async function reload() {
  loading.value = true
  try {
    // Divergence D1 spot 1 (see file header comment): single-layer unwrap, no extra
    // `.data` peel.
    const list = await service.ai.listMCPServers()
    servers.value = Array.isArray(list) ? list : []
    // Selection-retention logic, matching Vue2 `:75-77`: leave it alone if the currently
    // selected item is still in the new list, otherwise fall back to the first item
    // (falls to null on an empty list).
    if (!activeId.value || !servers.value.find((s) => s.id === activeId.value)) {
      activeId.value = servers.value[0]?.id ?? null
    }
  } catch {
    // Divergence D2/D4 (see file header comment): no console.error, failure goes through
    // the global danger toast.
    toast.show(t('aiMcpSrvLoadFailed'), 3000, 'danger')
  } finally {
    loading.value = false
  }
}

onMounted(() => reload())

function openCreate() {
  editing.value = null
  modalOpen.value = true
}
function openEdit(server: McpServer) {
  editing.value = server
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
  editing.value = null
}

// Matches Vue2's `onToggle` (`:86-96`). 204 has no body, so the return value isn't read.
async function onToggle(id: number, enabledVal: boolean) {
  try {
    await service.ai.updateMCPServer(id, { enabled: enabledVal })
    const idx = servers.value.findIndex((s) => s.id === id)
    if (idx !== -1) servers.value.splice(idx, 1, { ...servers.value[idx], enabled: enabledVal })
    toast.show(enabledVal ? t('aiMcpSrvEnabledToast') : t('aiMcpSrvDisabledToast'))
  } catch {
    toast.show(t('aiMcpSrvUpdateFailed'), 3000, 'danger')
  }
}

// Matches Vue2's `onDelete` (`:97-108`). 204 has no body, so the return value isn't read.
// See the file header comment for selected-item placement after delete — activeId only
// falls back to the first remaining item when the deleted item was the currently
// selected one.
async function onDelete(id: number) {
  const s = servers.value.find((x) => x.id === id)
  try {
    await service.ai.deleteMCPServer(id)
    servers.value = servers.value.filter((x) => x.id !== id)
    if (activeId.value === id) {
      activeId.value = servers.value[0]?.id ?? null
    }
    toast.show(t('aiMcpSrvRemovedName', { name: s ? s.name : String(id) }))
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 3000, 'danger')
  }
}

// Matches Vue2's `onSave` (`:109-128`). Divergence D1 spot 2 / D5, see the file header
// comment.
//
// Task 19: after a successful save, probe the server synchronously by
// reusing the existing `testMCPServer` (axios 135s > Go 125s > Python 120s
// timeout chain, already built and already tested). An async probe pushed
// over MessageBus was considered and rejected during design: it only hides
// the couple of minutes a first stdio package install can take, at the cost
// of a whole push-and-state-machine apparatus. `probeId` is only set once the
// corresponding create/update call has actually succeeded, so a save failure
// (caught below) never triggers a probe, and the probe itself runs in its own
// try/catch/finally after the modal has closed and the list reloaded, so a
// probe-side failure is never mistaken for a save failure and never reopens
// the modal.
async function onSave(payload: McpServerFormPayload) {
  saving.value = true
  saveError.value = ''
  let probeId: number | undefined
  try {
    // The shared package's parameter type is `Record<string, unknown>`
    // (NimoOS-Service/dist/ai.d.ts:85-86) — `McpServerFormPayload` is a named interface
    // without an implicit index signature, so TS considers them incompatible (TS2345),
    // hence the one-off cast; the field values themselves are untouched (same note as
    // SkillsSection.vue's `onCreate`).
    if (editing.value) {
      const id = editing.value.id
      await service.ai.updateMCPServer(id, payload as unknown as Record<string, unknown>)
      probeId = id
      toast.show(t('aiCfgSaved'))
    } else {
      const created = await service.ai.createMCPServer(payload as unknown as Record<string, unknown>)
      const id = (created as { id?: number } | undefined)?.id
      if (id) {
        activeId.value = id
        probeId = id
      }
      toast.show(t('aiMcpSrvAddedName', { name: payload.name }))
    }
    closeModal()
    await reload()
  } catch (e) {
    saveError.value = t(saveServerErrorKey(e))
  } finally {
    saving.value = false
  }
  if (probeId !== undefined) {
    await probeServer(probeId)
  }
}

/** Task 19: the synchronous post-save probe. Mirrors `McpServerDetail.vue`'s
 *  `runTest()` mapping (`toTestView`/`toTestViewFromError`) so the same i18n
 *  keys and never-echo-backend-English rule apply here too -- success shows
 *  the tool count, failure (whether the request rejected outright or the
 *  server answered `200 {ok:false,...}`) shows the mapped localized reason as
 *  a danger toast. Both paths clear `probing` via `finally`. */
async function probeServer(id: number) {
  probing.value = true
  try {
    const body = await service.ai.testMCPServer(id)
    const view = toTestView(body)
    if (view.ok) {
      toast.show(t('aiMcpSrvTestOk', { n: view.toolCount }))
    } else {
      toast.show(t(view.msgKey), 3000, 'danger')
    }
  } catch (e) {
    // toTestViewFromError always returns the ok:false branch, but its
    // declared return type is the full McpTestView union -- narrow before
    // reading msgKey (mirrors the `if (view.ok)` narrowing above).
    const view = toTestViewFromError(e)
    if (!view.ok) {
      toast.show(t(view.msgKey), 3000, 'danger')
    }
  } finally {
    probing.value = false
  }
}
</script>

<template>
  <div class="set-split">
    <div class="sk-col">
      <div class="sk-col-head">
        <div class="sk-col-actions">
          <!-- Task 19: post-save probe indicator. Reuses the existing
               `.sk-spinner` class (same one the `loading` state below uses)
               so the in-flight `testMCPServer` request has a visible signal
               even though the modal has already closed by this point. -->
          <span v-if="probing" class="sk-spinner" :title="t('aiMcpSrvTesting')" />
          <button class="icon-btn" :title="t('aiCfgRefresh')" @click="reload">
            <AgentIcon name="refresh" :size="15" />
          </button>
          <!-- Matches Vue2 :7. No named color passed — see "Divergence D7" in the file header comment. -->
          <button class="sk-add-btn" :title="t('aiMcpSrvAdd')" @click="openCreate">
            <AgentIcon name="plus" :size="15" />
          </button>
        </div>
      </div>
      <div class="sk-col-search">
        <AgentIcon name="search" :size="13" color="var(--text-tertiary)" />
        <input v-model="query" :placeholder="t('aiMcpSrvSearchPlaceholder')">
        <button
          v-if="query"
          class="icon-btn"
          style="width: 18px; height: 18px"
          @click="query = ''"
        >
          <AgentIcon name="x" :size="10" />
        </button>
      </div>
      <div class="sk-list">
        <div v-if="loading" style="display: grid; place-items: center; padding: 28px 0">
          <div class="sk-spinner" />
        </div>
        <template v-else>
          <McpServerGroup
            v-if="enabled.length"
            :label="t('aiMcpSrvGroupEnabled')"
            :items="enabled"
            :active-id="activeId"
            @pick="setActive"
          />
          <McpServerGroup
            v-if="disabled.length"
            :label="t('aiMcpSrvGroupDisabled')"
            :items="disabled"
            :active-id="activeId"
            @pick="setActive"
          />
          <div v-if="filtered.length === 0" class="sk-col-empty">
            <template v-if="query">
              {{ t('aiMcpSrvNoMatch') }} <code>{{ query }}</code>
            </template>
            <template v-else>
              {{ t('aiMcpSrvEmpty') }}
            </template>
          </div>
        </template>
      </div>
    </div>

    <McpServerDetail
      :server="activeServer"
      @toggle="onToggle"
      @edit="openEdit"
      @delete="onDelete"
    />

    <McpServerModal
      v-model:open="modalOpen"
      :server="editing"
      :saving="saving"
      :server-error="saveError"
      @save="onSave"
    />
  </div>
</template>

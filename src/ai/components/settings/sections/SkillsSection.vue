<!--
  1:1 ported from Vue2 src/views/AI/Skills/SkillsSection.vue (226 lines,
  read-only half). Left column (header only refresh button + search box + grouped list) + right SkillDetail.

  【Divergence list (all reported per public constraint §2 three-item kit)】

  1 (public constraint §3 divergence 1 / brief §6.2) — `reload()` no longer peels off `.data` again.
  Vue2 :133-134 wrote `const resp = await ai.listSkills(); this.skills = resp.data || []`,
  that's peeling off axios response layer's `.data` as backend payload. Shared package
  `service.ai.listSkills()` (the shared HTTP client's `dist/ai.d.ts:75`) already internally `return res.data`
  peeled axios layer once, while backend `NimoOS-AI/route/v2/skills.go:37` is `c.JSON(200, out)`
  bare array — peeling off `.data` again on bare array is always `undefined`, `this.skills` always
  `[]` (bare array fallback masks actually getting undefined), list forever empty. Same defect mold
  as the earlier fix to `loadAvailableModels` (commit a942196): core field name ≠ core envelope
  layers. Here directly `await service.ai.listSkills()` use as array, no second `.data` layer anymore.

  2 (public constraint §3 divergence 3) — `.sk-toast` (Vue2 :72-77, `showToast()`) not ported,
  changed to global `useToast().show()`. Vue2 on load fail (:139-140) goes `console.error` +
  `showToast('Could not load skills')`, and its `.sk-toast` template (:73-74) **unconditionally**
  renders green check icon, even error message wears success check — this is Vue2's own defect,
  not copying (brief §6.2 explicitly names). This repo changed fail to `toast.show(t('aiSkLoadFailed'),
  3000, 'danger')`, `danger` tier naturally won't wear check. Vue2 :139's `console.error` also not copied
  — this repo's three sibling sections (BlacklistSection/ExecutionSection/MemorySection) have no
  this convention, silently swallowing error + toast shown already enough.

  3 (public constraint §3 divergence 2) — `SkillIcon.vue` not ported, unified to use
  `../../icons/AgentIcon.vue` (Task 4/5 already same treatment).

  4 (brief §6.1) — left column header only refresh button. Vue2 :9-11's `+` add button (`adding = true`
  opens `AddSkillModal`) belongs to P3b (write operations half), Task 8 wired, see new comment section below.

  [Color] Vue2 :15's `SkillIcon name="search" ... color="var(--text-tertiary)"`
  explicitly passes a color (the `.sk-col-search` container itself has no CSS rule
  setting the icon's color, so without an explicit pass it would fall back to
  `currentColor`, which would look darker than Vue2 — hence the token is passed
  explicitly, as-is). The `.icon-btn` button itself already defines
  `color: var(--text-secondary)` in settings-styles.scss:350, so the icons inside the
  refresh/clear buttons naturally inherit via currentColor and don't need an explicit
  color pass.

  Vue2 :17-24's inline `style="width: 18px; height: 18px"` and :27-29's
  `style="display: grid; place-items: center; padding: 28px 0"` are both size/layout, not
  color — copying them as-is doesn't violate the color guard (brief §6.1 names this).

  Zero <style> blocks: every class used (sk-col*/sk-list/sk-col-empty/sk-spinner/icon-btn/
  sk-col-actions/set-split/sk-add-btn) already exists in settings-styles.scss
  (sk-col-actions/set-split/icon-btn) and skills-styles.scss (Task 1/8, the rest).

  ============================================================================
  The `+` button plus the four write-operation wire-ups (matching Vue2's
  :6-11 order and the four method bodies at :147-214).

  [Single-layer unwrap, public constraint §4 / brief §10.2] All three spots use a
  single-layer unwrap, no longer peeling off an extra `.data` layer the way Vue2 does — the
  reasoning is exactly the same shape as this file's existing `reload()` (divergence 1,
  the earlier comment block above):
    - Vue2 :150-151 `const resp = await ai.updateSkill(...); const updated = resp.data`
      → backend `route/v2/skills.go:131` (PATCH) goes through `h.Get(c)`, returning a
      **200 bare skill**. The shared package already peeled off one axios layer, so
      peeling again is always `undefined`, and `if (idx !== -1 && updated)` is always
      false — clicking the toggle on a list item doesn't update it (user-visible symptom:
      the toggle "clicks but does nothing" until you refresh).
    - Vue2 :188 `const sk = resp.data` → backend `:105` (POST) is **201 bare skill**, the
      same defect — after a successful create, `sk && sk.id` is always false, so the list
      neither appends nor selects the new skill.
    - DELETE (`:143`) is **204 with no body**; Vue2 never reads its return value (`:166`
      is just `await ai.deleteSkill(id)`, and this repo likewise doesn't read it) — no
      divergence here, this just records the real shape of all three endpoints together.

  [Selected-item placement after delete, matching Vue2 :168-170, the condition brief §10.2
  explicitly names] `activeId` only falls back to the first remaining item when the
  deleted item **was the currently selected one**; deleting a different item leaves
  `activeId` untouched.

  [onTest's optimistic local value, declared, matching Vue2 :204-214, brief §10.2]
  `onTest()` updates the currently selected item in place (the item matching `activeId` —
  the `test` event forwarded by `TestPanel` through `SkillDetail` only fires when the
  sandbox **genuinely completes successfully**; see the divergence D5 note in
  `TestPanel.vue`'s header comment and the comment at `SkillDetail.vue`'s
  `emit('test')` forwarding site), setting `last_used` to `'Just now'` and incrementing
  `calls` by 1. This is an **optimistic local value that is never persisted**: the backend
  `service/skills.go:352 RecordRun` has zero call sites anywhere in the repo (confirmed by
  grep, see the task report), and `reload()` / switching skills / refreshing the page will
  all reset these two fields back to the backend's real values, making the optimistic
  update vanish instantly. This isn't a defect this task is meant to fix — public
  constraint §3 divergence 4 already lists it as a registered existing fact (the other
  half of "the test count only increments on successful completion": the backend never
  actually records it) — this just preserves Vue2's local-feel behavior as-is, adding
  nothing new.

  [console.error not copied, declared, matching Vue2 :139,156,178,196] None of the four
  methods (reload was already declared in divergence 2 above; onToggle/onDelete/onCreate
  follow the same pattern) write `console.error` — none of this repo's three sibling
  sections (BlacklistSection/ExecutionSection/MemorySection) nor this file's existing
  P3a `reload()` follow that convention; failure states are handed off uniformly to
  toast/inline error display, and silently swallowing the error is enough.

  [`+` button doesn't pass a named color, matching public constraint §3 divergence 8 /
  brief §10.1] Vue2 :10's `SkillIcon name="plus" ... color="white"` is not copied —
  `AgentIcon` gets no `color` prop, falls back to `currentColor`, colored by
  `.sk-add-btn { color: var(--text-on-accent) }` (skills-styles.scss:193, confirmed this
  rule has a `color`).

  [Dialog wiring style — brief §10.3 requires grepping for precedent first, then picking
  one of two options and explaining] `AddSkillModal` uses `v-model:open="adding"` (i.e.
  `:open="adding"` plus `@update:open="adding = $event"`) always-mounted, rather than
  Vue2 :65-70's `v-if="adding"` — reason: `AddSkillModal.vue` itself already does
  `resetForm()` in the `!v` branch of `watch(() => props.open, ...)` (see that file's
  header comment, "implementation detail that isn't a ruled-on divergence but needs
  explaining"); it's designed on the premise "component stays mounted, `open` drives
  visibility". This is also the same style already used as precedent in
  `ChannelsSection.vue:427` (`SkModal :open="showAdd"`) and `SkillDetail.vue`
  (`SkModal :open="tryModalOpen"`); this file follows that precedent rather than
  introducing a third pattern. On close (`adding` becoming `false`), `createError` is also
  cleared — `AddSkillModal` only resets its own fields, while `serverError`'s source
  (`createError`) lives in this component; without clearing it, the next time the dialog
  opens it would show a leftover error from the previous attempt.
  ============================================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Skill, SkillFormPayload } from '../../../types/skill'
import { createSkillErrorKey } from '../../../util/skillsErrorKey'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillGroup from '../skills/SkillGroup.vue'
import SkillDetail from '../skills/SkillDetail.vue'
import AddSkillModal from '../skills/AddSkillModal.vue'

const { t } = useI18n()
const toast = useToast()

const skills = ref<Skill[]>([])
const loading = ref(true)
const activeId = ref<string | null>(null)
const query = ref('')

// Task 8's new state, matching brief §1 verbatim.
const adding = ref(false)
const saving = ref(false)
const busy = ref<Record<string, boolean>>({})
const createError = ref('')

// Clear the inline error when the dialog closes (see the end of the "Dialog wiring style"
// section in the file header comment).
watch(adding, (v) => {
  if (!v) createError.value = ''
})

// Four computeds, matching Vue2's SkillsSection.vue:105-118.
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return skills.value
  return skills.value.filter(
    (s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q),
  )
})
const builtIn = computed(() => filtered.value.filter((s) => s.system))
const personal = computed(() => filtered.value.filter((s) => !s.system))
const activeSkill = computed(() => skills.value.find((s) => s.id === activeId.value) || null)

function setActive(id: string) {
  activeId.value = id
}

async function reload() {
  loading.value = true
  try {
    // Single-layer unwrap (divergence 1, see file header comment) — no extra `.data` peel.
    const list = (await service.ai.listSkills()) as Skill[]
    skills.value = Array.isArray(list) ? list : []
    // Selection-retention logic, matching Vue2 :135-137: leave it alone if the currently
    // selected item is still in the new list, otherwise fall back to the first item
    // (falls to null on an empty list).
    if (!activeId.value || !skills.value.find((s) => s.id === activeId.value)) {
      activeId.value = skills.value[0]?.id ?? null
    }
  } catch {
    // Divergence 2 (see file header comment): Vue2's `console.error` is not copied,
    // failure goes through the global danger toast.
    toast.show(t('aiSkLoadFailed'), 3000, 'danger')
  } finally {
    loading.value = false
  }
}

onMounted(() => reload())

// Matches Vue2's `onToggle` (:147-161). Single-layer unwrap (see the "Single-layer
// unwrap" item 1 in the file header comment).
//
// [Fix M5] Previously, when `idx !== -1 && updated` was false (the
// backend returned an unexpected shape, e.g. an empty body), the list wouldn't update but
// would still fall through to the bottom of the `try` branch and pop a success toast —
// today PATCH always returns a 200 bare skill so this never triggers, but if it ever did,
// the list would stay put plus show a fake "enabled/paused" success message, and combined
// with `SkillDetail.vue`'s D4 `watch(enabled)` (which is waiting exactly for this
// `updated` to land in props) D4's dialog would never see `enabled` actually change and
// get stuck open, leaving the user with no clue. Changed to: only count it as success if
// the list item was genuinely replaced; otherwise go through the failure branch (the same
// danger toast as a request exception).
async function onToggle(id: string, enabled: boolean) {
  busy.value = { ...busy.value, [id]: true }
  try {
    const updated = (await service.ai.updateSkill(id, { enabled })) as Skill | undefined
    const idx = skills.value.findIndex((s) => s.id === id)
    if (idx !== -1 && updated) {
      skills.value.splice(idx, 1, updated)
      toast.show(enabled ? t('aiSkEnabledToast') : t('aiSkPausedToast'))
    } else {
      toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
    }
  } catch {
    toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
  } finally {
    const next = { ...busy.value }
    delete next[id]
    busy.value = next
  }
}

// Matches Vue2's `onDelete` (:162-183). DELETE is 204 with no body, so the return value
// isn't read (see item 3 in the "Single-layer unwrap" section of the file header
// comment). The selected-item placement condition is in the file header comment's
// "Selected-item placement after delete" section.
async function onDelete(id: string) {
  const s = skills.value.find((x) => x.id === id)
  busy.value = { ...busy.value, [id]: true }
  try {
    await service.ai.deleteSkill(id)
    skills.value = skills.value.filter((x) => x.id !== id)
    if (activeId.value === id) {
      activeId.value = skills.value[0]?.id ?? null
    }
    const name = s?.name ?? id
    toast.show(s?.system ? t('aiSkUninstalledName', { name }) : t('aiSkDeletedName', { name }))
  } catch {
    toast.show(t('aiSkDeleteFailed'), 3000, 'danger')
  } finally {
    const next = { ...busy.value }
    delete next[id]
    busy.value = next
  }
}

// Matches Vue2's `onCreate` (:184-203). 201 bare skill (see item 2 in the "Single-layer
// unwrap" section of the file header comment). On failure, **the dialog stays open**
// (so the user can edit and retry); the error goes to the inline `createError`, not a
// toast (brief §10.2 / public constraint §3 divergence 5: HTTP-layer failures never echo
// the backend body, use localized copy instead).
async function onCreate(payload: SkillFormPayload) {
  saving.value = true
  createError.value = ''
  try {
    // `service.ai.createSkill`'s parameter type is `Record<string, unknown>` (shared
    // HTTP client signature, see `src/ai.ts:337`) — `SkillFormPayload` is a
    // named interface without an implicit index signature, so TS considers them
    // incompatible (TS2345), hence the one-off cast; the field values themselves are
    // untouched.
    const sk = (await service.ai.createSkill(payload as unknown as Record<string, unknown>)) as Skill | undefined
    if (sk?.id) {
      skills.value.push(sk)
      activeId.value = sk.id
      adding.value = false
      toast.show(t('aiSkAddedName', { name: sk.name }))
    }
  } catch (e) {
    createError.value = t(createSkillErrorKey(e))
  } finally {
    saving.value = false
  }
}

// Matches Vue2's `onTest` (:204-214). Optimistic local value, never persisted — see the
// "onTest's optimistic local value" declaration in the file header comment: the backend
// RecordRun has zero call sites anywhere in the repo, and reload() / switching skills /
// refreshing the page will all reset these two fields back to the original values.
function onTest() {
  const idx = skills.value.findIndex((s) => s.id === activeId.value)
  if (idx === -1) return
  const s = skills.value[idx]
  skills.value.splice(idx, 1, {
    ...s,
    last_used: 'Just now',
    calls: (s.calls || 0) + 1,
  })
}
</script>

<template>
  <div class="set-split">
    <div class="sk-col">
      <div class="sk-col-head">
        <div class="sk-col-actions">
          <button class="icon-btn" :title="t('aiCfgRefresh')" @click="reload">
            <AgentIcon name="refresh" :size="15" />
          </button>
          <!-- Matches Vue2 :9-11. No named color passed — see "+ button doesn't pass a named color" in the file header comment. -->
          <button class="sk-add-btn" :title="t('aiSkAddSkill')" @click="adding = true">
            <AgentIcon name="plus" :size="15" />
          </button>
        </div>
      </div>
      <div class="sk-col-search">
        <AgentIcon name="search" :size="13" color="var(--text-tertiary)" />
        <input v-model="query" :placeholder="t('aiSkSearchPlaceholder')">
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
          <SkillGroup
            v-if="builtIn.length"
            :label="t('aiSkBuiltIn')"
            :items="builtIn"
            :active-id="activeId"
            @pick="setActive"
          />
          <SkillGroup
            v-if="personal.length"
            :label="t('aiSkYours')"
            :items="personal"
            :active-id="activeId"
            @pick="setActive"
          />
          <div v-if="filtered.length === 0" class="sk-col-empty">
            <template v-if="query">
              {{ t('aiSkNoMatch') }} <code>{{ query }}</code>
            </template>
            <template v-else>
              {{ t('aiSkEmpty') }}
            </template>
          </div>
        </template>
      </div>
    </div>

    <SkillDetail
      :skill="activeSkill"
      :busy="busy"
      @toggle="onToggle"
      @delete="onDelete"
      @test="onTest"
    />

    <AddSkillModal
      v-model:open="adding"
      :saving="saving"
      :server-error="createError"
      @save="onCreate"
    />
  </div>
</template>

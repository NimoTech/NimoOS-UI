<!--
  SP8-P3a Task 5 — read-only half, excerpt from Vue2 src/views/AI/Skills/SkillDetail.vue (271 lines).
  This task only takes a subset from brief §5.1: empty state / top bar (no switch or more menu) / four info cells /
  description section / SKILL.md section / bundled files section. Write operations (switch, more menu, copy/export/delete,
  TestPanel/runTest) all left to P3b (brief §5.2); this file does not contain any related state or methods.

  SP8-P3b Task 6 — top bar write operations (switch + more menu + copy/export) + delete/uninstall confirmation dialog.
  Align with Vue2 :21-56 (top bar controls) and :155-184 (confirmation dialog); details in inline comments below.

  [Deviation notice 1, shared constraints §3 deviation 12] Copy uses `useCopyFeedback` (internal `copyText` fallback
  + toast + checkmark state), not copying Vue2 :243-253 hand-written `navigator.clipboard` try/catch +
  temporary textarea fallback.

  [Deviation notice 2, shared constraints §3 deviation 11 extension / task 6.1 coordinator revision] Delete confirmation
  dialog does not use `SkModal`, directly uses reka Dialog primitives (`DialogRoot`/`DialogPortal`/`DialogOverlay`/
  `DialogContent`) to construct Vue2's exact DOM in this component — reason in task 6.1: `SkModal` forces
  title bar + close button rendering (Vue2's confirmation dialog has no title bar, title is the
  `<h3>` inside `.sk-confirm-body`), default slot with `.sk-modal-body` stacks with `.sk-confirm-body`'s built-in padding,
  `.sk-modal` class hardcoded and cannot add `.sk-confirm`. `DialogPortal to=".set-app"` cannot be omitted — AI zone
  token defined in `.agent-app` scope, portaling to body would make `var(--bg-elevated)` and similar all
  fail to parse (same as SkModal.vue header comment D1). Accessibility title uses
  `<VisuallyHidden as-child><DialogTitle>` (reka requires DialogTitle inside DialogContent),
  precedent `src/home/components/SearchDialog.vue:317`. Confirm/cancel buttons use plain
  `<button>` hand-written `@click` (not `AlertDialogAction`/`DialogClose`) — those two reka components
  hardcode `@click="onOpenChange(false)"` in template, consumer's `@click` after `$attrs` merge
  `update:open` fires before custom handler (P1c1 Task 11's pitfall); this component's confirm button
  handler directly reads `props.skill.id`, does not depend on `open` state, naturally unaffected by this pitfall,
  but still follows the existing pattern (plain `<button @click>`, not DialogClose) for consistency,
  no new pattern introduced.

  [Implementation choice, not behavior deviation, analogous to SetSwitch.vue header comment's v-model/update:modelValue line
  "framework API difference, not behavior change"] External click closes menu, reuses existing `useClickOutside`
  composable (`../../../composables/useClickOutside.ts`, existing precedent
  `ModelPicker.vue:26,69`), not hand-written Vue2 :214-225's `watch(menuOpen)` with
  conditional addEventListener/removeEventListener. Behavior to user is completely equivalent (external
  mousedown closes menu, listeners must be removed after component unmount), `useClickOutside` uses onMounted/
  onUnmounted unconditionally attach/detach, does not have Vue2's "only attach listener when menuOpen is true" conditional
  race (P1c1 Task 7's leak came from conditional mount timing). `skill.id` change resets
  `menuOpen`/`confirmOpen` still uses separate `watch`, aligns with Vue2 :226-229.

  [Deviation 2 (shared constraints §3.2)] Vue2 :30 `SkillIcon` not ported, uniformly use
  `../../icons/AgentIcon.vue` (sparkle icon already exists, same usage as SkillTile.vue).

  [Deviation 4 (shared constraints §3.2 / type skill.ts header comment / util/skillsFormat.ts header comment)]
  Vue2 :79 directly renders `skill.trigger_human || skill.trigger`. This repo abandons
  `trigger_human`, uses `triggerLabel(skill.trigger, skill.name)` instead: if hit
  `t(key, params)` (slash branch gets `/{name}`), if not hit (unknown trigger) display
  `skill.trigger` as-is. **This file does not read the `skill.trigger_human` field.**

  [Color change, shared constraint §6] Vue2 :64-73's status dot is inline `:style` constructing `rgba(...)`
  (explicitly forbidden by color-guard, see constraint §6 point 5 naming `SkillDetail.vue:67-72`).
  Here changed to: output `data-disabled="true"/"false"` on `.val` based on `!skill.enabled`,
  color rules entirely delegated to Task 1's already-written
  `.sk-meta-cell .val .dot` / `.val[data-disabled="true"] .dot` static CSS in skills-styles.scss:280-316 — this component's
  `<span class="dot" />` no longer carries any inline styles or color-related data attributes.

  [last_used no mapping] Per Vue2 :88 use `skill.last_used || '—'` as-is. If backend later
  writes English relative time strings (like "3 hours ago") to this field, need to add a localization layer here —
  currently backend contract (NimoOS-AI/service/skills.go) this field is any string or empty, no handling needed.

  [TestPanel placeholder] Vue2 :108-112's `TestPanel` sits between "description" and "SKILL.md"
  `.sk-section` blocks. P3a does not render it, two sections directly adjacent; template below leaves one comment line marking
  where P3b should reinsert it, avoid inserting in wrong order.

  SP8-P3b Task 7 — D4 dialog (disabled skill "try in chat" prompts first) + mount TestPanel.

  [Deviation notice 3, shared constraint §3 deviation 3 / task D4] Address P3a backlog ③: backend
  `NimoOS-AI/service/skills_runtime.go:57` excludes `disabled` skills from runtime view, disabled
  skill's "try in chat" sends `X-Skill-Id` but agent cannot find `SKILL.md`, UI gives zero feedback.
  Vue2 `SkillDetail.vue:240-242 tryInChat()` completely ignores `skill.enabled`, always jumps directly —
  this is a reproducible bug to fix, not a "visual/interaction" to copy. Changed to: when `skill.enabled === false`
  do not jump, instead show a D4 confirmation dialog ("enable and try" / cancel); when `enabled === true` behavior unchanged
  (P3a already implemented, jump directly). **This dialog does not exist in Vue2** (user decided to add 2026-07-30),
  not a duplication target, so uses standard shell `SkModal` (see "two dialog shells coexist" comment below), not
  this file's reka primitive hand-construction.

  [Two dialog shells coexist, not inconsistency] This file has two dialog patterns: delete/uninstall confirmation dialog uses bare reka
  Dialog primitives (see above "Deviation notice 2"), because it must pixel-perfectly duplicate Vue2's **dialog without title bar**,
  `SkModal`'s forced title bar + close button shape won't fit; D4 this dialog is new this period,
  Vue2 has no corresponding object, no "duplication target", so directly uses ready-made standard shell `SkModal`
  (`:open`+`@update:open`+default slot+`#footer`, precedent `sections/ChannelsSection.vue:427`),
  gets Esc/focus trap/`.set-app` scoping handling for free. Both selection rationale same rule: "have pixel-perfect
  duplication target → hand-construct close to Vue2; no duplication target (new UI this period) → use standard shell",
  not style drift.

  [`pendingTryId` one-time semantics] "Enable and try" emits `emit('toggle', id, true)`, must wait
  **parent truly changes this skill's `enabled` to true** (toggle succeeds) before navigating; if toggle fails parent
  doesn't change `enabled`, `watch` won't see value change, naturally won't navigate, no need for extra failure branch. Use
  `pendingTryId` (records skill id at request moment, not a boolean flag) instead of timers/await emit
  (emit is synchronous, no return value, cannot wait for "parent finished processing" event). Three clear paths:
  ① Before navigate (`watch` hits `enabled===true` and id matches) immediately clear, prevent future "switch on→user manually opens"
     being misread as "waiting to navigate" and redirecting user;
  ② Click "cancel" immediately clear;
  ③ `skill.id` change clear (shared same `watch` with existing `menuOpen`/`confirmOpen` reset) — this way
     after switching to another skill, previous skill's registration won't linger, also won't rely on watcher firing order
     between multiple watchers: `watch(enabled)` callback extra checks `skill.id === pendingTryId`, two-layer defense
     stacked, not depending on Vue internal watcher scheduling order implementation detail.

  [Post-review revision (Important 1, task D4's simplification vs design doc §9.4 original)]  Task simplified
  §9.4 "first `toggle(id, true)`, **navigate only on success**; on failure **stay in dialog** + danger toast, no
  navigate" into "emit toggle then close dialog", kept only half (no navigate on failure), missed "dialog must
  stay before success" — this is task's simplification loss of design doc, per design doc: `confirmEnableAndTry`
  no longer closes `tryModalOpen` at toggle moment, instead stays open; `watch(enabled)` hits
  `id match && enabled===true` **same step** closes dialog + navigates. Toggle fails → `enabled`
  unchanged, dialog stays open, user can retry "enable and try" or click "cancel". Danger toast
  by parent (T8 `SkillsSection.onToggle`), this component won't repeat.
  Additionally (self-judgment scope, not design doc forced): `busy[skill.id]` is true (toggle request in flight)
  "enable and try" button `disabled`, prevent user repeatedly clicking before request returns, avoid
  multiple `toggle` requests.

  No <style> block: all used classes (sk-detail*, sk-name, sk-pill-try, sk-meta-grid,
  sk-meta-cell, sk-section*, sk-description, sk-md, sk-file-row, sw, sk-pill-more,
  sk-menu, sk-modal-bg, sk-modal, sk-confirm*, sk-modal-foot, sk-btn) already exist in
  skills-styles.scss (Task 1) or sk-shared.scss (existing).
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
} from 'reka-ui'
import type { Skill } from '../../../types/skill'
import { triggerLabel, authorLabel, fileSizeLabel } from '../../../util/skillsFormat'
import { renderMarkdown } from '../../../markdown/renderMarkdown'
import { useClickOutside } from '../../../composables/useClickOutside'
import { useCopyFeedback } from '../../../composables/useCopyFeedback'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from './SkillTile.vue'
import SetSwitch from '../SetSwitch.vue'
import SkModal from '../SkModal.vue'
import TestPanel from './TestPanel.vue'

// Vue2 SkillDetail.vue:200-201 `skill: { type: Object, default: null }` +
// `busy: { type: Object, default: () => ({}) }` (collection of skill ids disabled during in-flight,
// maintained by parent SkillsSection during toggle/delete requests, drives switch disabled state).
const props = withDefaults(
  defineProps<{ skill: Skill | null; busy?: Record<string, boolean> }>(),
  { busy: () => ({}) },
)

// Align with Vue2 :27 (`$emit('toggle', …)`) and :238 (`$emit('delete', …)`).
// `test` is new in T7: pass through TestPanel's `test` (emitted only when sandbox truly completes successfully, see
// TestPanel.vue header comment deviation D5) as-is, no extra trigger conditions added in this file.
const emit = defineEmits<{
  (e: 'toggle', id: string, enabled: boolean): void
  (e: 'delete', id: string): void
  (e: 'test'): void
}>()

const { t } = useI18n()
const router = useRouter()

// Top bar "more" dropdown menu. Align with Vue2 data() `menuOpen` (:205).
const menuOpen = ref(false)
// Delete/uninstall confirmation dialog. Align with Vue2 data() `confirm` (:206; this repo avoids
// ambiguity with Vue's built-in `computed` global `confirm`, renamed to `confirmOpen`).
const confirmOpen = ref(false)
// `.sk-pill-more` button + `.sk-menu` dropdown wrapper element, align with Vue2 `ref="menuWrap"` (:33).
const menuWrap = ref<HTMLElement | null>(null)
// D4: confirmation dialog when disabled skill's "try in chat" is clicked (Vue2 has no counterpart, new this period, see
// file header comment "Deviation notice 3").
const tryModalOpen = ref(false)
// D4 "enable and try" one-time registration: record skill id at toggle request moment (not a boolean flag),
// see file header comment "pendingTryId one-time semantics".
const pendingTryId = ref<string | null>(null)

// External click closes menu. Reuse existing `useClickOutside` composable (see file header comment "Implementation choice")
// instead of hand-written Vue2 :214-225's `watch(menuOpen)` with conditional add/removeEventListener.
useClickOutside(menuWrap, () => { menuOpen.value = false })

// Reset menu and confirmation dialog when skill.id changes, align with Vue2 `watch: { 'skill.id'() { … } }` (:226-229).
// D4: simultaneously reset tryModalOpen/pendingTryId at same location (clear path ③, see file header comment) —
// after switching to another skill, previous skill's "enable and try" registration must not linger.
watch(() => props.skill?.id, () => {
  menuOpen.value = false
  confirmOpen.value = false
  tryModalOpen.value = false
  pendingTryId.value = null
})

// Copy SKILL.md to clipboard + checkmark state (deviation notice 1, see file header comment).
const { copiedKey, copy: copyToClipboard } = useCopyFeedback()

// Align with Vue2 `closeAnd(fn)` (:235): close menu first, then execute passed action.
function closeAnd(fn?: () => void) {
  menuOpen.value = false
  fn?.()
}

// Align with Vue2 first menu item `$emit('toggle', skill.id, !skill.enabled)` (:38). Split into named function
// (instead of inline template `() => emit('toggle', skill.id, !skill.enabled)`) because vue-tsc
// does not pierce non-null narrowing of `skill` in `v-else` branch into template inline arrow function body
// (TS18047 `'skill' is possibly 'null'`), named function in <script> can re-check with `props.skill` to avoid,
// behavior completely equivalent to inline.
function toggleFromMenu() {
  const s = props.skill
  if (!s) return
  emit('toggle', s.id, !s.enabled)
}

// Align with Vue2 `copyMarkdown()` (:243-253) — hand-written clipboard/execCommand fallback replaced
// by `copyText` internal to `useCopyFeedback` (deviation notice 1).
function copyMarkdown() {
  copyToClipboard(props.skill?.md ?? '', 'skillmd')
}

// Align with Vue2 `exportSkill()` (:255-262): create hidden `<a>`, trigger browser
// download via `download` attribute, not navigate current page. `service.ai.exportSkillURL` is synchronous URL builder (not axios
// call), token via `?token=` query fallback.
function exportSkill() {
  const s = props.skill
  if (!s) return
  const a = document.createElement('a')
  a.href = service.ai.exportSkillURL(s.id)
  a.download = (s.name || 'skill') + '.tar.gz'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Align with Vue2 `doDelete()` (:236-239).
function doDelete() {
  const s = props.skill
  if (!s) return
  confirmOpen.value = false
  emit('delete', s.id)
}

// Align with Vue2 :79, but input changed to raw trigger enum (deviation 4, see file header comment).
const triggerText = computed(() => {
  const s = props.skill
  if (!s) return ''
  const ref = triggerLabel(s.trigger, s.name)
  return ref ? t(ref.key, ref.params ?? {}) : s.trigger
})

// Align with Vue2 :83, `authorLabel` only localizes backend hardcoded literal 'You', rest shown as-is.
const authorText = computed(() => {
  const s = props.skill
  if (!s) return ''
  const ref = authorLabel(s.author)
  return ref ? t(ref.key) : s.author
})

// Align with Vue2 :90 `Number(skill.calls || 0).toLocaleString()`.
const totalCount = computed(() => Number(props.skill?.calls || 0).toLocaleString())

// Top bar "switch" title, align with Vue2 :24 `:title="skill.enabled ? $t('Disable') : $t('Enable')"` .
const switchTitle = computed(() => (props.skill?.enabled ? t('aiSkDisable') : t('aiSkEnable')))

// "More" menu first item (pause/enable) text, align with Vue2 :40.
const pauseLabel = computed(() => (props.skill?.enabled ? t('aiSkDisableTemporarily') : t('aiSkEnable')))

// "More" menu danger item + confirmation dialog text: built-in skills use "uninstall" wording, user-created use "delete".
// Align with Vue2 :53 (menu item) and :158-179 (dialog title/body/button); built-in body text is D3-revised
// truthful text (shared constraint §3 deviation 2: backend only writes uninstalled=1 flag, no recovery endpoint in whole repo).
const dangerMenuLabel = computed(() => (props.skill?.system ? t('aiSkUninstall') : t('aiSkDeleteSkill')))
const confirmTitle = computed(() => (props.skill?.system ? t('aiSkUninstallTitle') : t('aiSkDeleteTitle')))
const confirmBody = computed(() => (props.skill?.system ? t('aiSkUninstallBody') : t('aiSkDeleteBody')))
const confirmButtonLabel = computed(() => (props.skill?.system ? t('aiSkUninstall') : t('aiSkDelete')))

// Align with Vue2 :169 `$t('{count} previous runs', { count: Number(skill.calls || 0).toLocaleString() })`.
// Same formatting formula as totalCount, separate computed only to keep confirmation dialog and :90 info cells
// independent, evolve separately (actually values currently equal, if future splits formatting rules no need to revisit).
const confirmRunsText = computed(() => t('aiSkNPrevRuns', { count: totalCount.value }))

// Align with Vue2 :130 `$t('{n} files', { n: (skill.files || []).length })` (section header hint,
// reuse aiSkNFiles — with single file line size localization below is two uses of same key).
const filesHint = computed(() => t('aiSkNFiles', { n: (props.skill?.files || []).length }))

// Align with Vue2 :211 (this.skill && this.skill.md || ''); `renderMarkdown` internal DOMPurify
// sanitization, safe to v-html.
const mdHTML = computed(() => renderMarkdown(props.skill?.md || ''))

// Align with Vue2 :141 `f.size` shown as-is; this repo additionally passes directory "(N files)"
// through fileSizeLabel() for localization, byte units ("12 B"/"1.0 KB") passed through as-is.
function fileSize(size: string): string {
  const ref = fileSizeLabel(size)
  return ref ? t(ref.key, ref.params ?? {}) : size
}

// Align with Vue2 :240-242 `tryInChat`, but address P3a backlog ③ with correct logic (D4, see file header comment
// "Deviation notice 3"): Vue2 completely ignores `skill.enabled`, always jumps directly; disabled skills don't exist
// in agent runtime view (`skills_runtime.go:57`), jumping just gives no feedback.
// When `enabled === true` behavior unchanged, jump directly (P3a existing implementation).
function tryInChat() {
  const s = props.skill
  if (!s) return
  if (s.enabled === false) {
    tryModalOpen.value = true
    return
  }
  router.push({ path: '/ai/agent', query: { skill: s.id } })
}

// D4 "enable and try": record current skill id as one-time registration, bubble intent up. **Do not close
// dialog here** (post-review revision, see file header comment "Post-review revision") — design doc §9.4 requires "navigate only on success",
// dialog must stay open until parent truly changes `enabled` to true; on failure dialog stays, user can
// retry or cancel. Parent (SkillsSection) decides whether enable truly succeeds — this component doesn't directly change
// `skill.enabled`, only observes value on props (watch below).
function confirmEnableAndTry() {
  const s = props.skill
  if (!s) return
  pendingTryId.value = s.id
  emit('toggle', s.id, true)
}

// [P3b final review I1 fix] D4 dialog close methods not just "cancel" button: `SkModal` has built-in `.sk-x` close
// button + reka Dialog's Esc / click overlay close, all three only go through `@update:open`, previously only "cancel"
// and "skill.id change" cleared `pendingTryId`, this path missed — with registration hanging, if user later manually
// enables switch for this skill (completely unrelated to "enable and try"), below
// `watch(enabled)` still hits `s.id === pendingTryId.value && enabled === true`, mysteriously navigates
// user to `/ai/agent`. This is exactly the scenario clear path ① header comment prevents, just missed "close this
// dialog" entry. Unified handler: any dialog close method (cancel button / X / Esc /
// click overlay) goes through it clearing registration, no separate maintenance.
function onTryModalOpenChange(v: boolean) {
  tryModalOpen.value = v
  if (!v) pendingTryId.value = null
}

// D4 "cancel": clear path ② (see file header comment). No emit toggle, no navigate — reuse handler above,
// X/Esc/overlay all go through same cleanup logic.
function cancelTryModal() {
  onTryModalOpenChange(false)
}

// D4 one-time navigate: only when "current props.skill is the skill that initiated registration" and its `enabled`
// becomes true **same step** close dialog + navigate, then clear registration (clear path ①). Toggle fails →
// parent won't change `enabled` to true, never see true here, dialog stays open
// (post-review revision, see file header comment) — no extra failure branch/timers needed. Explicitly check
// `s.id === pendingTryId.value` instead of just trusting "skill.id change reset" watch already
// cleared it: both watches hang on same `props.skill`, not depending on Vue internal same-tick
// multiple watcher scheduling order implementation detail.
watch(() => props.skill?.enabled, (enabled) => {
  const s = props.skill
  if (!s || !pendingTryId.value) return
  if (s.id !== pendingTryId.value) { pendingTryId.value = null; return }
  if (enabled === true) {
    pendingTryId.value = null
    tryModalOpen.value = false
    router.push({ path: '/ai/agent', query: { skill: s.id } })
  }
})
</script>

<template>
  <div class="sk-detail">
    <template v-if="!skill">
      <div class="sk-detail-empty">
        <div class="sk-detail-empty-inner">
          <div class="orb" />
          <div class="empty-title">{{ t('aiSkPickLeft') }}</div>
          <div class="empty-sub">{{ t('aiSkPickLeftSub') }}</div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="sk-detail-bar">
        <SkillTile :color="skill.color" :icon="skill.icon" :size="28" :radius="8" />
        <div class="sk-name">
          <span>{{ skill.title }}</span>
          <code>{{ skill.name }}</code>
        </div>
        <!-- .sw switch, align with Vue2 :21-28. Only accept SetSwitch's @change, not v-model —
             true source of state is parent list item's skill.enabled, this component only bubbles intent up. -->
        <SetSwitch
          :model-value="skill.enabled"
          :disabled="!!busy[skill.id]"
          :title="switchTitle"
          @change="emit('toggle', skill.id, !skill.enabled)"
        />
        <button class="sk-pill-try" :title="t('aiSkTryInChat')" @click="tryInChat">
          <AgentIcon name="sparkle" :size="13" />
          {{ t('aiSkTryInChat') }}
        </button>
        <!-- .sk-pill-more + .sk-menu dropdown, align with Vue2 :33-56. `menuWrap` container wraps button +
             `v-if="menuOpen"` menu: pause/enable · copy SKILL.md · export skill · <hr> ·
             danger item (uninstall/delete). -->
        <div ref="menuWrap" style="position: relative">
          <button class="sk-pill-more" @click="menuOpen = !menuOpen">
            <AgentIcon name="settings" :size="16" />
          </button>
          <div v-if="menuOpen" class="sk-menu">
            <button @click="closeAnd(toggleFromMenu)">
              <AgentIcon name="pause" :size="13" />
              {{ pauseLabel }}
            </button>
            <button @click="closeAnd(copyMarkdown)">
              <AgentIcon name="edit" :size="13" />
              {{ copiedKey === 'skillmd' ? t('aiCopied') : t('aiSkCopyMd') }}
            </button>
            <button @click="closeAnd(exportSkill)">
              <AgentIcon name="download" :size="13" />
              {{ t('aiSkExport') }}
            </button>
            <hr>
            <button data-danger="true" @click="closeAnd(() => { confirmOpen = true })">
              <AgentIcon name="trash" :size="13" />
              {{ dangerMenuLabel }}
            </button>
          </div>
        </div>
      </div>

      <div class="sk-detail-body">
        <div class="sk-detail-inner">
          <div class="sk-meta-grid">
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkStatus') }}</div>
              <div class="val" :data-disabled="!skill.enabled ? 'true' : 'false'">
                <span class="dot" />
                {{ skill.enabled ? t('aiSkActive') : t('aiSkPaused') }}
              </div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkTrigger') }}</div>
              <div class="val">{{ triggerText }}</div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkAddedBy') }}</div>
              <div class="val">{{ authorText }}</div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiSkLastRun') }}</div>
              <div class="val">
                {{ skill.last_used || '—' }}
                <span class="total">· {{ t('aiSkNTotal', { count: totalCount }) }}</span>
              </div>
            </div>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiSkDescription') }}</div>
              <div class="sk-section-hint">{{ t('aiSkDescHint') }}</div>
            </div>
            <div class="sk-section-body">
              <div class="sk-description">{{ skill.description }}</div>
            </div>
          </div>

          <!-- Vue2 SkillDetail.vue:108-112: TestPanel sits between "description" and "SKILL.md".
               :key="skill.id" aligns with Vue2 :109 — whole component destroyed/rebuilt when switching skills (TestPanel.vue
               header comment explains: key change won't trigger internal skill.id watcher, real cleanup
               falls in its own onBeforeUnmount). test event passed through as-is, see comment at emits definition. -->
          <TestPanel :key="skill.id" :skill="skill" @test="emit('test')" />

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">SKILL.md</div>
              <div class="sk-section-hint">{{ t('aiSkMdHint') }}</div>
            </div>
            <div class="sk-section-body">
              <div class="sk-md" v-html="mdHTML" />
            </div>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiSkBundledFiles') }}</div>
              <div class="sk-section-hint">{{ filesHint }}</div>
            </div>
            <div class="sk-section-body">
              <div
                v-for="(f, i) in (skill.files || [])"
                :key="i"
                class="sk-file-row"
              >
                <div class="ico" />
                <span class="name">{{ f.name }}</span>
                <span class="size">{{ fileSize(f.size) }}</span>
              </div>
              <div
                v-if="!skill.files || skill.files.length === 0"
                class="sk-file-row"
                style="color: var(--text-tertiary)"
              >
                <span class="name">{{ t('aiSkNoBundledFiles') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete/uninstall confirmation dialog, align with Vue2 :155-184. Not wrapped in SkModal — reka Dialog
           primitives directly construct Vue2's exact DOM (reason in file header comment "Deviation notice 2"). -->
      <DialogRoot :open="confirmOpen" @update:open="confirmOpen = $event">
        <DialogPortal to=".set-app" defer>
          <DialogOverlay class="sk-modal-bg">
            <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
              <VisuallyHidden as-child><DialogTitle>{{ confirmTitle }}</DialogTitle></VisuallyHidden>
              <div class="sk-confirm-body">
                <h3>{{ confirmTitle }}</h3>
                <p>{{ confirmBody }}</p>
                <div class="sk-confirm-skill">
                  <SkillTile :color="skill.color" :icon="skill.icon" :size="28" :radius="8" />
                  <div class="skill-line">
                    <div class="name">{{ skill.name }}</div>
                    <div class="runs">{{ confirmRunsText }}</div>
                  </div>
                </div>
              </div>
              <div class="sk-modal-foot">
                <div class="right">
                  <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
                  <button class="sk-btn danger" @click="doDelete">
                    <AgentIcon name="trash" :size="13" />
                    {{ confirmButtonLabel }}
                  </button>
                </div>
              </div>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </DialogRoot>

      <!-- D4: disabled skill "try in chat" prompt first (see file header comment "Deviation notice 3"). This dialog
           doesn't exist in Vue2, no pixel-perfect duplication target, so uses standard shell SkModal, not reka
           primitives hand-constructed above (reason for two shells coexisting in file header comment "Two dialog shells coexist, not inconsistency"). -->
      <SkModal
        :open="tryModalOpen"
        :title="t('aiSkTryDisabledTitle')"
        @update:open="onTryModalOpenChange"
      >
        <p>{{ t('aiSkTryDisabledBody') }}</p>
        <template #footer>
          <button class="sk-btn ghost" @click="cancelTryModal">{{ t('aiCancel') }}</button>
          <!-- disabled when busy[skill.id] is true (toggle request in flight), prevent repeated clicks
               stacking multiple toggle requests — self-judgment scope, see file header comment "Post-review revision" end. -->
          <button
            class="sk-btn primary"
            :disabled="!!busy[skill.id]"
            @click="confirmEnableAndTry"
          >{{ t('aiSkTryEnableAndTry') }}</button>
        </template>
      </SkModal>
    </template>
  </div>
</template>

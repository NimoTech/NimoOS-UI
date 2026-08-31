<!--
  1:1 port from Vue2 src/views/AI/Skills/TestPanel.vue (182 lines).
  Inserted by SkillDetail.vue (T7) between "description" and "SKILL.md"
  `.sk-section` blocks (Vue2 :108-112 position, SkillDetail.vue:166-167 already left placeholder comment).

  [Deviation D2 (shared constraint §3.1, continuing T2 sandboxRun.ts header comment)]  Vue2 :159-163 upon receiving each piece
  message/message_delta/text `push` a new string to output.steps — backend
  message_delta sends word-by-word (NimoOS-AI/agent/agent.py:1266,1284), copying would explode result into
  lots of single characters/words independent lines. This repo changed to consume T2 `reduceSandboxEvent` reduced result: continuous text pieces
  merged into single `{kind:'text'}` step, tool calls still one line each (`{kind:'tool'}`).
  This file does not re-implement reduction logic, just renders T2's already-reduced `sandbox.steps`.

  [Deviation D5 (shared constraint §3.4)] Vue2 upon click run `$emit('...')` to let parent SkillsSection
  increment count (SkillsSection.vue:204-214), but backend `service/skills.go:352 RecordRun`
  zero call sites in whole repo, sandbox SSE must 422 (see skillTestTransport.ts header "known backend ticket") —
  combined equals each "test" falsely reports success twice. This repo changed to only
  `state === 'done' && !sandbox.error` (i.e., truly completed and no failure) `emit('test')`.

  [HTTP layer failure no show backend body] Continuing P2b "errors no longer show backend JSON" — when onError gets
  `{status}` (non-HTTP shape has no status), only use localized string `aiSkTestHttpFailed`/
  `aiSkTestFailed` fallback, never put `body` into UI. SSE `error` **event** goes through
  reduceSandboxEvent already-written `sandbox.error` (backend human-readable text, like
  "sandbox timed out"), shown as-is, not showing backend JSON, no conflict.

  [Failure state style deviation] Vue2 :92-98's
  failure state relies on template inline styles: `.label` inline `color: var(--danger)`, `.bullet` inline
  background + about 18% opacity iOS red glow circle (hardcoded rgba literal, color is current --danger
  token color value) — latter violates this repo's color hard constraint (forbid rgba literal), inline color itself also violates
  (shared constraint §6).
  Changed to: `.label` add `data-state="failed"`, color rules moved into
  skills-styles.scss `.sk-test-result .label` `&[data-state="failed"]` branch
  (same level as existing running branch, glow derived with color-mix, technique same as that file :506-509's
  success state), template has zero inline colors.

  [Mechanical change, not logic deviation] Vue2 :34 Run button icon `color="white"` is named color literal,
  hard constraint forbids (even if color-guard only scans `<style>` blocks can't catch prop literals, rule itself
  covers "all visible colors"). Button container already carries this foreground color in skills-styles.scss:478 with
  `color: var(--text-on-accent)` (disabled state has :482's --text-quaternary), changed here to
  `color="currentColor"` inherit, visual result identical to Vue2 (light text on solid accent button),
  technique same as existing SkillTile.vue:57 precedent.

  [Not ported] `SkillIcon.vue` (shared constraint §3.9, uniformly use `../../icons/AgentIcon.vue`) ·
  `runFn` prop and Vue2's `{ close }` return value protocol (changed to T3 `runSkillTest`'s
  `(id, prompt, signal, onEvent, onError) => Promise<void>` shape, this component itself
  holds AbortController, no longer need parent-passed closeable stream object) · `output.tokens`
  dead branch (Vue2 :70-73, `output.tokens` never assigned in whole component, T2 sandboxRun.ts header explains,
  SandboxState type also lacks this field).

  No <style> block: all used classes (sk-section*, sk-test*, sk-item-off,
  sk-test-result and its nested label/bullet/step-row/ex/footer-note/code) already exist in
  sk-shared.scss or skills-styles.scss (Task 1), grep-confirmed each one.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Skill } from '../../../types/skill'
import { initSandboxState, reduceSandboxEvent } from '../../../util/sandboxRun'
import { runSkillTest } from '../../../services/skillTestTransport'
import AgentIcon from '../../icons/AgentIcon.vue'

// Vue2 TestPanel.vue:110-113 `skill: { type: Object, required: true }`.
// `runFn` (:113) not ported, see file header comment — this component itself calls T3's runSkillTest.
const props = defineProps<{ skill: Skill }>()

// Align with Vue2 SkillsSection.vue:204-214 consumer's expected event name, but trigger condition per deviation D5
// tightened to "only on successful completion", see file header comment.
//
// [P3b final review M3, explicit notice] Design doc §6 and Vue2 `SkillsSection.vue:204`
// (`onTest({id})`) events all carry `id` payload, this file ends up bare `emit('test')` — this is unreported
// deviation, final review pointed out. Supplement notice instead of changing back to carry id: probe testing shows current harmless —
// `SkillDetail.vue` mounts this component with `:key="skill.id"`, always renders only one instance for `activeSkill`,
// parent `SkillsSection.onTest()` reads `activeId` therefore always equals this component's current
// `skill.id`; plus Vue 3's `emit` is no-op for unmounted instances, sandbox interruption when switching skills won't
// put late `test` on new skill (`watch(skill.id)`/`onBeforeUnmount` already aborted
// request). If future `SkillDetail`/`SkillsSection` mount method changes (no longer force single instance via `:key`),
// assumption becomes invalid, should change to `emit('test', { id: skill.id })` and let parent use
// payload for location, instead of continuing to rely on `activeId` implicit equality.
const emit = defineEmits<{ test: [] }>()

const { t } = useI18n()

// Align with Vue2 data() :115-121. output.tokens dead branch not ported (SandboxState lacks this field).
const prompt = ref('')
const state = ref<'idle' | 'running' | 'done'>('idle')
const sandbox = ref(initSandboxState())
// Aligned with Vue2 run()'s local variable startedAt (:157) — a plain variable, not a ref,
// since it doesn't need to trigger rendering.
let startedAt = 0
let ctrl: AbortController | null = null

// Aligned with Vue2 computed.canRun (:124-126).
const canRun = computed(() => prompt.value.trim().length > 0 && state.value !== 'running')

// Aligned with Vue2 computed.placeholder (:127-131).
const placeholder = computed(() => {
  const ex = props.skill.examples && props.skill.examples[0]
  if (ex) return t('aiSkTestPlaceholderEx', { ex })
  return t('aiSkTestPlaceholder')
})

// Aligned with Vue2 onKeydown (:146-151).
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    run()
  }
}

function onEvent(ev: Record<string, unknown>) {
  sandbox.value = reduceSandboxEvent(sandbox.value, ev, Date.now() - startedAt)
}

// Aligned with the transport-layer failure path outside Vue2 onEvent's ev.type === 'error'
// branch that goes through backend text (T3 runSkillTest's onError callback: a non-2xx HTTP
// response or a non-AbortError exception).
// If status is present -> the HTTP-layer failure localized string; if status is unavailable
// (a non-HTTP shape) -> the generic fallback string.
// Neither case echoes the backend body back (see the file header comment "HTTP layer failure
// no show backend body").
function onError(e: unknown) {
  const err = e as { status?: number } | null | undefined
  const msg = err && typeof err.status === 'number'
    ? t('aiSkTestHttpFailed', { status: err.status })
    : t('aiSkTestFailed')
  // failed is explicitly set true (the symmetric counterpart of the P3b final review I2 fix at
  // the same spot — a transport-layer failure always has a non-empty localized message anyway,
  // so this doesn't rely on whether error is non-empty to determine the failed state).
  sandbox.value = { ...sandbox.value, error: msg, failed: true }
}

// Aligned with Vue2 run() (:152-179), but uses T3's Promise shape instead of Vue2's
// `{ onEvent, onClose } => { close }` callback protocol. If still `running` after await
// returns (i.e., the connection closed without ever receiving an SSE 'done' event) -> falls
// back to `done`, aligned with Vue2 onClose's (:174-177) fallback semantics. Only emits
// `'test'` on successful completion (done and not failed) (deviation D5, see file header
// comment). Checks `sandbox.value.failed` rather than `!sandbox.value.error`
// (P3b final review I2) — the `error` event's content is an empty string for some backend
// exceptions, and `!error` would misjudge that failure as success, which would in turn break
// D5's "only +1 on successful completion" invariant.
async function run() {
  if (!canRun.value) return
  state.value = 'running'
  sandbox.value = initSandboxState()
  startedAt = Date.now()
  ctrl = new AbortController()
  await runSkillTest(props.skill.id, prompt.value.trim(), ctrl.signal, onEvent, onError)
  if (state.value === 'running') state.value = 'done'
  if (state.value === 'done' && !sandbox.value.failed) emit('test')
}

// Aligned with Vue2 watch: 'skill.id' (:133-141) — the reset logic is kept as-is for a 1:1
// visual/interaction comparison.
// Note: T7 mounts this component with `:key="skill.id"`, in which case the whole component
// gets destroyed and recreated, so this watcher never actually fires (a key change goes
// straight to unmount -> mount without preserving the component instance).
// So the real fallback cleanup has to live in onBeforeUnmount below — it can't rely on this
// watcher alone.
watch(() => props.skill.id, () => {
  prompt.value = ''
  state.value = 'idle'
  sandbox.value = initSandboxState()
  ctrl?.abort()
  ctrl = null
})

// Aligned with Vue2 beforeDestroy (:142-144), i.e. Vue3's onBeforeUnmount. See the comment
// above: this is the only cleanup point guaranteed to run (the watcher doesn't fire in the
// :key-recreation scenario).
onBeforeUnmount(() => {
  ctrl?.abort()
})
</script>

<template>
  <div class="sk-section">
    <div class="sk-section-head">
      <div class="sk-section-title">{{ t('aiSkTestTitle') }}</div>
      <div class="sk-section-hint">{{ t('aiSkTestHint') }}</div>
    </div>
    <div class="sk-test">
      <div class="sk-test-head">
        <span class="sk-test-pill">{{ t('aiSkTestPill') }}</span>
        <div style="flex: 1; min-width: 0">
          <div class="sk-test-title">{{ t('aiSkTestTryName', { name: skill.name }) }}</div>
          <div class="sk-test-sub">{{ t('aiSkTestDiscard') }}</div>
        </div>
        <span
          v-if="!skill.enabled"
          class="sk-item-off"
          :title="t('aiSkTestOffTitle')"
        >{{ t('aiSkTestOffBadge') }}</span>
      </div>

      <div class="sk-test-body">
        <div class="sk-test-input">
          <textarea
            v-model="prompt"
            :placeholder="placeholder"
            rows="2"
            @keydown="onKeydown"
          />
          <button :disabled="!canRun" @click="run">
            <AgentIcon name="play" :size="11" color="currentColor" />
            {{ state === 'running' ? t('aiSkTestRunning') : t('aiSkTestRun') }}
          </button>
        </div>

        <div
          v-if="skill.examples && skill.examples.length && state === 'idle' && sandbox.steps.length === 0 && !sandbox.failed"
          class="sk-test-result"
          style="background: transparent; border: 0; padding: 8px 2px 0"
        >
          <div class="label" style="margin: 0">
            <AgentIcon name="sparkle" :size="11" />
            {{ t('aiSkTestExamples') }}
          </div>
          <div class="ex">
            <button
              v-for="(ex, i) in skill.examples"
              :key="i"
              @click="prompt = ex"
            >{{ ex }}</button>
          </div>
        </div>

        <div v-if="state === 'running'" class="sk-test-result">
          <div class="label" data-state="running">
            <span class="bullet" />
            {{ t('aiSkTestRunningLabel') }}
          </div>
          <div>{{ t('aiSkTestBootstrapping', { name: skill.name }) }}</div>
        </div>

        <div v-if="state === 'done' && !sandbox.failed" class="sk-test-result">
          <div class="label">
            <span class="bullet" />
            {{ t('aiSkTestCompleted', { ms: sandbox.ms }) }}
          </div>
          <div
            v-for="(s, i) in sandbox.steps"
            :key="i"
            class="step-row"
          >
            <AgentIcon name="check" :size="12" color="var(--success)" />
            <div>{{ s.text }}</div>
          </div>
          <div class="footer-note">
            <AgentIcon name="check" :size="11" />
            {{ t('aiSkTestClosed') }}
          </div>
        </div>

        <div v-if="state === 'done' && sandbox.failed" class="sk-test-result">
          <div class="label" data-state="failed">
            <span class="bullet" />
            {{ t('aiSkTestFailed') }}
          </div>
          <!-- P3b final review I2: the error event's content can be an empty string (str(e) is
               empty for some backend exceptions) — the design spec §5's half "if empty, leave
               it empty and let the UI fill in the localized fallback copy" wasn't done before
               this, so the empty string would render verbatim as a blank body. The fallback
               reuses the existing key aiSkTestFailed (already used by the label above), no new
               key added. -->
          <div>{{ sandbox.error || t('aiSkTestFailed') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

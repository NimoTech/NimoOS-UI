<!--
  SP8-P3b Task 4 — 1:1 port from Vue2 src/views/AI/Skills/TestPanel.vue (182 lines).
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

  [Failure state style deviation (coordinator pre-disambiguated, see p3b-task-4-brief.md main text)] Vue2 :92-98's
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
// 对齐 Vue2 run() 里的局部变量 startedAt(:157)——普通变量,不是 ref,不需要触发渲染。
let startedAt = 0
let ctrl: AbortController | null = null

// 对齐 Vue2 computed.canRun(:124-126)。
const canRun = computed(() => prompt.value.trim().length > 0 && state.value !== 'running')

// 对齐 Vue2 computed.placeholder(:127-131)。
const placeholder = computed(() => {
  const ex = props.skill.examples && props.skill.examples[0]
  if (ex) return t('aiSkTestPlaceholderEx', { ex })
  return t('aiSkTestPlaceholder')
})

// 对齐 Vue2 onKeydown(:146-151)。
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    run()
  }
}

function onEvent(ev: Record<string, unknown>) {
  sandbox.value = reduceSandboxEvent(sandbox.value, ev, Date.now() - startedAt)
}

// 对齐 Vue2 onEvent 里 ev.type === 'error' 走后端文本的分支之外的、传输层失败路径
// （T3 runSkillTest 的 onError 回调:非 2xx HTTP 或非 AbortError 的异常）。
// 有 status → HTTP 层失败本地化串;拿不到 status（非 HTTP 形状）→ 通用兜底串。
// 两种都不回显后端 body（见文件头注释「HTTP 层失败不回显后端 body」）。
function onError(e: unknown) {
  const err = e as { status?: number } | null | undefined
  const msg = err && typeof err.status === 'number'
    ? t('aiSkTestHttpFailed', { status: err.status })
    : t('aiSkTestFailed')
  // failed 显式置真(P3b 终审 I2 同一处修复的对称写法——传输层失败本来就一定有一条
  // 非空的本地化文案,这里不依赖 error 是否非空来判定失败态)。
  sandbox.value = { ...sandbox.value, error: msg, failed: true }
}

// 对齐 Vue2 run()(:152-179),但改用 T3 的 Promise 形状而非 Vue2 的
// `{ onEvent, onClose } => { close }` 回调协议。await 返回后若仍处于 running
// （即从未收到 SSE 'done' 事件、连接就已关闭)→ 兜底置 done,对齐 Vue2 onClose
// (:174-177) 的 fallback 语义。仅在成功完成(done 且未 failed)时才 emit('test')
// （偏离 D5,见文件头注释)。判 `sandbox.value.failed` 而不是 `!sandbox.value.error`
// (P3b 终审 I2)——`error` 事件的 content 对某些后端异常是空串,`!error` 会把这种
// 失败误判成成功,连带让 D5「只在成功完成时 +1」失守。
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

// 对齐 Vue2 watch: 'skill.id'(:133-141)——原样保留复位逻辑做 1:1 视觉/交互对照。
// 注意:T7 挂载本组件时会带 `:key="skill.id"`,那种情况下整个组件会被销毁重建,
// 这个 watcher 实际上不会触发(key 变化直接走 unmount→mount,不会保留组件实例)。
// 所以真正兜底的清理必须落在下面的 onBeforeUnmount,不能只靠这个 watcher。
watch(() => props.skill.id, () => {
  prompt.value = ''
  state.value = 'idle'
  sandbox.value = initSandboxState()
  ctrl?.abort()
  ctrl = null
})

// 对齐 Vue2 beforeDestroy(:142-144),即 Vue3 的 onBeforeUnmount。见上面注释:
// 这是唯一保证一定会执行的清理点(watcher 在 :key 重建场景下不会触发)。
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
          <!-- P3b 终审 I2:error 事件的 content 可能是空串(后端某些异常 str(e) 为
               空)——设计 §5「空则留空，由 UI 填本地化兜底文案」这半此前没做,空串
               会原样渲染成一段空白正文。兜底复用既有键 aiSkTestFailed(上面 label
               已经在用),不新增键。 -->
          <div>{{ sandbox.error || t('aiSkTestFailed') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

# Task 4 review package — e1a53c7..HEAD

## commits
af1cdc0 sp8-ai P3b Task 4: sandbox test panel (TestPanel.vue)

## diff --stat
 .../components/settings/skills/TestPanel.test.ts   | 277 +++++++++++++++++++++
 src/ai/components/settings/skills/TestPanel.vue    | 236 ++++++++++++++++++
 src/ai/styles/skills-styles.scss                   |  13 +
 3 files changed, 526 insertions(+)

## diff -U10
diff --git a/src/ai/components/settings/skills/TestPanel.test.ts b/src/ai/components/settings/skills/TestPanel.test.ts
new file mode 100644
index 0000000..9900c1d
--- /dev/null
+++ b/src/ai/components/settings/skills/TestPanel.test.ts
@@ -0,0 +1,277 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { createI18n } from 'vue-i18n'
+import zh from '../../../../i18n/zh_cn'
+import type { Skill } from '../../../types/skill'
+
+// SP8-P3b Task 4 —— 对齐 Vue2 src/views/AI/Skills/TestPanel.vue(182 行)。
+// mock 骨架用 vi.hoisted()(先例 src/ai/stores/agentStore.test.ts:4-19)——裸 const
+// 放 vi.mock 之前会因 ESM 提升抛 TDZ ReferenceError。
+const h = vi.hoisted(() => ({ runSkillTest: vi.fn() }))
+vi.mock('../../../services/skillTestTransport', () => ({ runSkillTest: h.runSkillTest }))
+
+import TestPanel from './TestPanel.vue'
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function makeSkill(overrides: Partial<Skill> = {}): Skill {
+  return {
+    id: 's1',
+    name: 'File Organizer',
+    title: 'File Organizer',
+    description: 'organizes files',
+    trigger: 'manual',
+    trigger_human: 'Manual',
+    color: 'blue',
+    icon: 'sparkle',
+    enabled: true,
+    system: false,
+    author: 'Alice',
+    last_used: '',
+    calls: 3,
+    files: [],
+    examples: [],
+    md: '',
+    ...overrides,
+  }
+}
+
+const mountPanel = (skill: Skill) =>
+  mount(TestPanel, { props: { skill }, global: { plugins: [i18n] } })
+
+// 每个测试自己捕获这一轮 runSkillTest 调用传入的 onEvent/onError/signal,并持有一个
+// 可手动 resolve 的 deferred promise,模拟 T3 runSkillTest 在流关闭前一直 pending
+// 的行为(真实实现是 `await sseRequest(...)`,流没关闭 promise 就不会 resolve)。
+type Captured = {
+  onEvent: (ev: Record<string, unknown>) => void
+  onError: (e: unknown) => void
+  signal: AbortSignal
+  resolve: () => void
+}
+function captureNextRun(): Captured {
+  const captured = {} as Captured
+  h.runSkillTest.mockImplementationOnce(
+    (_id: string, _prompt: string, signal: AbortSignal, onEvent: Captured['onEvent'], onError: Captured['onError']) => {
+      captured.onEvent = onEvent
+      captured.onError = onError
+      captured.signal = signal
+      return new Promise<void>(resolve => { captured.resolve = resolve })
+    },
+  )
+  return captured
+}
+
+beforeEach(() => {
+  h.runSkillTest.mockReset()
+})
+
+describe('TestPanel', () => {
+  it('canRun 三态:空 prompt 禁用、有 prompt 启用、running 中禁用', async () => {
+    const w = mountPanel(makeSkill())
+    const btn = w.find('.sk-test-input button')
+    expect(btn.attributes('disabled')).toBeDefined() // 空 prompt
+
+    await w.find('.sk-test-input textarea').setValue('do the thing')
+    expect(btn.attributes('disabled')).toBeUndefined() // 非空 prompt
+
+    const cap = captureNextRun()
+    await btn.trigger('click')
+    expect(btn.attributes('disabled')).toBeDefined() // running 中
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('Cmd+Enter 触发运行,普通 Enter 不触发', async () => {
+    const w = mountPanel(makeSkill())
+    const textarea = w.find('.sk-test-input textarea')
+    await textarea.setValue('hello')
+
+    await textarea.trigger('keydown', { key: 'Enter' })
+    expect(h.runSkillTest).not.toHaveBeenCalled()
+
+    const cap = captureNextRun()
+    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })
+    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('ctrlKey+Enter 也触发运行(对齐 Vue2 :147 的 e.metaKey || e.ctrlKey)', async () => {
+    const w = mountPanel(makeSkill())
+    const textarea = w.find('.sk-test-input textarea')
+    await textarea.setValue('hello')
+    const cap = captureNextRun()
+    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
+    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('运行中按钮文案变「运行中…」且禁用', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+    expect(w.find('.sk-test-input button').text()).toContain('运行中…')
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('多个 message_delta 渲染成一行(钉住偏离 D2),tool_call 单独一行', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'message_delta', content: 'Hel' })
+    cap.onEvent({ type: 'message_delta', content: 'lo' })
+    cap.onEvent({ type: 'tool_call', tool: 'grep' })
+    cap.onEvent({ type: 'done' })
+    cap.resolve()
+    await flushPromises()
+
+    const rows = w.findAll('.sk-test-result .step-row')
+    // 若未合并(照抄 Vue2 :162 的逐片 push),这里会是 3 行('Hel'/'lo'/'→ grep')。
+    expect(rows).toHaveLength(2)
+    expect(rows[0].text()).toBe('Hello')
+    expect(rows[1].text()).toContain('→ grep')
+  })
+
+  it('SSE error 事件原样显示后端人类可读文本', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'error', content: 'sandbox timed out' })
+    cap.resolve()
+    await flushPromises()
+
+    const failed = w.find('.sk-test-result .label[data-state="failed"]')
+    expect(failed.exists()).toBe(true)
+    expect(w.find('.sk-test-result').text()).toContain('sandbox timed out')
+  })
+
+  it('HTTP 失败显示带状态码的本地化串,且不回显后端 body 内容', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onError({ status: 500, body: { detail: 'super secret internal path' } })
+    cap.resolve()
+    await flushPromises()
+
+    const text = w.find('.sk-test-result').text()
+    expect(text).toContain('500')
+    expect(text).not.toContain('super secret internal path')
+    expect(text).not.toContain('detail')
+  })
+
+  it('非 HTTP 形状的错误(拿不到 status)落回通用兜底串', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onError(new Error('boom'))
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.find('.sk-test-result').text()).toContain('运行失败')
+  })
+
+  it('成功完成后 emit(test) 恰好一次', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'message_delta', content: 'done thing' })
+    cap.onEvent({ type: 'done' })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.emitted('test')).toHaveLength(1)
+  })
+
+  it('失败时不 emit(test)(钉住偏离 D5)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'error', content: 'nope' })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.emitted('test')).toBeUndefined()
+  })
+
+  it('HTTP 失败(而非 SSE error 事件)时也不 emit(test)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onError({ status: 422 })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.emitted('test')).toBeUndefined()
+  })
+
+  it('停用技能显示「技能已关闭」角标,但运行按钮仍可用', async () => {
+    const w = mountPanel(makeSkill({ enabled: false }))
+    expect(w.find('.sk-item-off').exists()).toBe(true)
+    expect(w.find('.sk-item-off').text()).toBe('技能已关闭')
+
+    await w.find('.sk-test-input textarea').setValue('go')
+    expect(w.find('.sk-test-input button').attributes('disabled')).toBeUndefined()
+  })
+
+  it('启用技能不显示「技能已关闭」角标', () => {
+    const w = mountPanel(makeSkill({ enabled: true }))
+    expect(w.find('.sk-item-off').exists()).toBe(false)
+  })
+
+  it('示例提示词点击写进 textarea', async () => {
+    const w = mountPanel(makeSkill({ examples: ['清理下载文件夹', '整理照片'] }))
+    const exButtons = w.findAll('.sk-test-result .ex button')
+    expect(exButtons).toHaveLength(2)
+
+    await exButtons[1].trigger('click')
+    const textarea = w.find('.sk-test-input textarea').element as HTMLTextAreaElement
+    expect(textarea.value).toBe('整理照片')
+  })
+
+  it('有示例但技能无描述示例时不渲染示例区(examples 为空数组)', () => {
+    const w = mountPanel(makeSkill({ examples: [] }))
+    expect(w.find('.sk-test-result .ex').exists()).toBe(false)
+  })
+
+  it('卸载时调用 abort', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    expect(cap.signal.aborted).toBe(false)
+    w.unmount()
+    expect(cap.signal.aborted).toBe(true)
+  })
+
+  it('不实现 output.tokens 死分支:成功文案不含 tokens 相关文本(钉住 Vue2 :70-73 死分支不移植)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'done', tokens: 999 })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.find('.sk-test-result').text()).not.toContain('999')
+    expect(w.find('.sk-test-result').text()).not.toContain('tokens')
+  })
+})
diff --git a/src/ai/components/settings/skills/TestPanel.vue b/src/ai/components/settings/skills/TestPanel.vue
new file mode 100644
index 0000000..e2fbf44
--- /dev/null
+++ b/src/ai/components/settings/skills/TestPanel.vue
@@ -0,0 +1,236 @@
+<!--
+  SP8-P3b Task 4 —— 1:1 移植 Vue2 src/views/AI/Skills/TestPanel.vue(182 行)。
+  由 SkillDetail.vue(T7)插在「描述」与「SKILL.md」两个 `.sk-section` 之间
+  (Vue2 :108-112 的位置,SkillDetail.vue:166-167 已留占位注释)。
+
+  【偏离 D2(公共约束 §3.1,承 T2 sandboxRun.ts 头注)】Vue2 :159-163 每收到一片
+  message/message_delta/text 就 `push` 一个新字符串到 output.steps —— 后端
+  message_delta 是逐词发的(NimoOS-AI/agent/agent.py:1266,1284),照抄会在结果里炸出
+  一大堆单字/单词的独立行。本仓改为消费 T2 `reduceSandboxEvent` 的归约结果:连续文本片
+  会被合并成同一个 `{kind:'text'}` 步骤,工具调用仍单独一行(`{kind:'tool'}`)。
+  本文件不重新实现归约逻辑,只是渲染 T2 已归约好的 `sandbox.steps`。
+
+  【偏离 D5(公共约束 §3.4)】Vue2 一点运行就 `$emit('...')` 让上层 SkillsSection
+  计数 +1(SkillsSection.vue:204-214),而后端 `service/skills.go:352 RecordRun`
+  全仓零调用点、沙箱 SSE 又必 422(见 skillTestTransport.ts 头注「已知后端票」)——
+  两者叠加等于每次「测试」都双重谎报一次成功调用。本仓改为只有
+  `state === 'done' && !sandbox.error`(即真正跑完且没有失败)才 `emit('test')`。
+
+  【HTTP 层失败不回显后端 body】承 P2b「错误不再回显后端 JSON」——onError 拿到
+  `{status}`(非 HTTP 形状则没有 status)时,只用本地化串 `aiSkTestHttpFailed`/
+  `aiSkTestFailed` 兜底,绝不把 `body` 塞进界面。SSE `error` **事件**走的是
+  reduceSandboxEvent 已经写好的 `sandbox.error`(后端人类可读文本,如
+  "sandbox timed out"),原样显示,不算回显后端 JSON,不冲突。
+
+  【失败态样式偏离(协调者预先解歧义,见 p3b-task-4-brief.md 正文)】Vue2 :92-98
+  的失败态靠模板内联样式:`.label` 上 `style="color: var(--danger)"`,`.bullet` 上
+  `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`——
+  后者是字面量 rgba(),违反本仓配色硬约束,内联颜色本身也违规(公共约束 §6)。
+  改为:`.label` 加 `data-state="failed"`,颜色规则搬进
+  skills-styles.scss `.sk-test-result .label` 的 `&[data-state="failed"]` 分支
+  (与既有 running 分支同级,发光圈用 color-mix 派生,手法同该文件 :506-509 的
+  success 态),模板里零内联颜色。
+
+  【机械改动,非逻辑偏离】Vue2 :34 Run 按钮图标 `color="white"` 是具名色字面量,
+  硬约束禁止(即便 color-guard 只扫 `<style>` 块抓不到 prop 里的字面量,规则本身
+  覆盖"一切可见颜色")。按钮容器已在 skills-styles.scss:478 用
+  `color: var(--text-on-accent)` 承载这个前景色(disabled 态另有 :482 的
+  --text-quaternary),这里改成 `color="currentColor"` 继承,视觉结果与 Vue2
+  完全一致(实底 accent 按钮上的浅色字),手法同 SkillTile.vue:57 的既有先例。
+
+  【不移植】`SkillIcon.vue`(公共约束 §3.9,统一用 `../../icons/AgentIcon.vue`)·
+  `runFn` prop 与 Vue2 `{ close }` 返回值协议(改用 T3 `runSkillTest` 的
+  `(id, prompt, signal, onEvent, onError) => Promise<void>` 形状,由本组件自己
+  持有 AbortController,不再需要上层传入可关闭的 stream 对象)· `output.tokens`
+  死分支(Vue2 :70-73,`output.tokens` 全组件从未被赋值,T2 sandboxRun.ts 头注已
+  说明,SandboxState 类型上也没有该字段)。
+
+  零 <style> 块:用到的每个 class(sk-section*、sk-test*、sk-item-off、
+  sk-test-result 及其嵌套 label/bullet/step-row/ex/footer-note/code)均已存在于
+  sk-shared.scss 或 skills-styles.scss(Task 1),已逐个 grep 确认。
+-->
+<script setup lang="ts">
+import { computed, onBeforeUnmount, ref, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import type { Skill } from '../../../types/skill'
+import { initSandboxState, reduceSandboxEvent } from '../../../util/sandboxRun'
+import { runSkillTest } from '../../../services/skillTestTransport'
+import AgentIcon from '../../icons/AgentIcon.vue'
+
+// Vue2 TestPanel.vue:110-113 `skill: { type: Object, required: true }`。
+// `runFn`(:113)不移植,见文件头注释——本组件自己调用 T3 的 runSkillTest。
+const props = defineProps<{ skill: Skill }>()
+
+// 对齐 Vue2 SkillsSection.vue:204-214 消费方的期望事件名,但触发条件按偏离 D5
+// 收紧为「只在成功完成时」,见文件头注释。
+const emit = defineEmits<{ test: [] }>()
+
+const { t } = useI18n()
+
+// 对齐 Vue2 data() :115-121。output.tokens 死分支不移植(SandboxState 无该字段)。
+const prompt = ref('')
+const state = ref<'idle' | 'running' | 'done'>('idle')
+const sandbox = ref(initSandboxState())
+// 对齐 Vue2 run() 里的局部变量 startedAt(:157)——普通变量,不是 ref,不需要触发渲染。
+let startedAt = 0
+let ctrl: AbortController | null = null
+
+// 对齐 Vue2 computed.canRun(:124-126)。
+const canRun = computed(() => prompt.value.trim().length > 0 && state.value !== 'running')
+
+// 对齐 Vue2 computed.placeholder(:127-131)。
+const placeholder = computed(() => {
+  const ex = props.skill.examples && props.skill.examples[0]
+  if (ex) return t('aiSkTestPlaceholderEx', { ex })
+  return t('aiSkTestPlaceholder')
+})
+
+// 对齐 Vue2 onKeydown(:146-151)。
+function onKeydown(e: KeyboardEvent) {
+  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
+    e.preventDefault()
+    run()
+  }
+}
+
+function onEvent(ev: Record<string, unknown>) {
+  sandbox.value = reduceSandboxEvent(sandbox.value, ev, Date.now() - startedAt)
+}
+
+// 对齐 Vue2 onEvent 里 ev.type === 'error' 走后端文本的分支之外的、传输层失败路径
+// （T3 runSkillTest 的 onError 回调:非 2xx HTTP 或非 AbortError 的异常）。
+// 有 status → HTTP 层失败本地化串;拿不到 status（非 HTTP 形状）→ 通用兜底串。
+// 两种都不回显后端 body（见文件头注释「HTTP 层失败不回显后端 body」）。
+function onError(e: unknown) {
+  const err = e as { status?: number } | null | undefined
+  const msg = err && typeof err.status === 'number'
+    ? t('aiSkTestHttpFailed', { status: err.status })
+    : t('aiSkTestFailed')
+  sandbox.value = { ...sandbox.value, error: msg }
+}
+
+// 对齐 Vue2 run()(:152-179),但改用 T3 的 Promise 形状而非 Vue2 的
+// `{ onEvent, onClose } => { close }` 回调协议。await 返回后若仍处于 running
+// （即从未收到 SSE 'done' 事件、连接就已关闭)→ 兜底置 done,对齐 Vue2 onClose
+// (:174-177) 的 fallback 语义。仅在成功完成(done 且无 error)时才 emit('test')
+// （偏离 D5,见文件头注释)。
+async function run() {
+  if (!canRun.value) return
+  state.value = 'running'
+  sandbox.value = initSandboxState()
+  startedAt = Date.now()
+  ctrl = new AbortController()
+  await runSkillTest(props.skill.id, prompt.value.trim(), ctrl.signal, onEvent, onError)
+  if (state.value === 'running') state.value = 'done'
+  if (state.value === 'done' && !sandbox.value.error) emit('test')
+}
+
+// 对齐 Vue2 watch: 'skill.id'(:133-141)——原样保留复位逻辑做 1:1 视觉/交互对照。
+// 注意:T7 挂载本组件时会带 `:key="skill.id"`,那种情况下整个组件会被销毁重建,
+// 这个 watcher 实际上不会触发(key 变化直接走 unmount→mount,不会保留组件实例)。
+// 所以真正兜底的清理必须落在下面的 onBeforeUnmount,不能只靠这个 watcher。
+watch(() => props.skill.id, () => {
+  prompt.value = ''
+  state.value = 'idle'
+  sandbox.value = initSandboxState()
+  ctrl?.abort()
+  ctrl = null
+})
+
+// 对齐 Vue2 beforeDestroy(:142-144),即 Vue3 的 onBeforeUnmount。见上面注释:
+// 这是唯一保证一定会执行的清理点(watcher 在 :key 重建场景下不会触发)。
+onBeforeUnmount(() => {
+  ctrl?.abort()
+})
+</script>
+
+<template>
+  <div class="sk-section">
+    <div class="sk-section-head">
+      <div class="sk-section-title">{{ t('aiSkTestTitle') }}</div>
+      <div class="sk-section-hint">{{ t('aiSkTestHint') }}</div>
+    </div>
+    <div class="sk-test">
+      <div class="sk-test-head">
+        <span class="sk-test-pill">{{ t('aiSkTestPill') }}</span>
+        <div style="flex: 1; min-width: 0">
+          <div class="sk-test-title">{{ t('aiSkTestTryName', { name: skill.name }) }}</div>
+          <div class="sk-test-sub">{{ t('aiSkTestDiscard') }}</div>
+        </div>
+        <span
+          v-if="!skill.enabled"
+          class="sk-item-off"
+          :title="t('aiSkTestOffTitle')"
+        >{{ t('aiSkTestOffBadge') }}</span>
+      </div>
+
+      <div class="sk-test-body">
+        <div class="sk-test-input">
+          <textarea
+            v-model="prompt"
+            :placeholder="placeholder"
+            rows="2"
+            @keydown="onKeydown"
+          />
+          <button :disabled="!canRun" @click="run">
+            <AgentIcon name="play" :size="11" color="currentColor" />
+            {{ state === 'running' ? t('aiSkTestRunning') : t('aiSkTestRun') }}
+          </button>
+        </div>
+
+        <div
+          v-if="skill.examples && skill.examples.length && state === 'idle' && sandbox.steps.length === 0 && !sandbox.error"
+          class="sk-test-result"
+          style="background: transparent; border: 0; padding: 8px 2px 0"
+        >
+          <div class="label" style="margin: 0">
+            <AgentIcon name="sparkle" :size="11" />
+            {{ t('aiSkTestExamples') }}
+          </div>
+          <div class="ex">
+            <button
+              v-for="(ex, i) in skill.examples"
+              :key="i"
+              @click="prompt = ex"
+            >{{ ex }}</button>
+          </div>
+        </div>
+
+        <div v-if="state === 'running'" class="sk-test-result">
+          <div class="label" data-state="running">
+            <span class="bullet" />
+            {{ t('aiSkTestRunningLabel') }}
+          </div>
+          <div>{{ t('aiSkTestBootstrapping', { name: skill.name }) }}</div>
+        </div>
+
+        <div v-if="state === 'done' && !sandbox.error" class="sk-test-result">
+          <div class="label">
+            <span class="bullet" />
+            {{ t('aiSkTestCompleted', { ms: sandbox.ms }) }}
+          </div>
+          <div
+            v-for="(s, i) in sandbox.steps"
+            :key="i"
+            class="step-row"
+          >
+            <AgentIcon name="check" :size="12" color="var(--success)" />
+            <div>{{ s.text }}</div>
+          </div>
+          <div class="footer-note">
+            <AgentIcon name="check" :size="11" />
+            {{ t('aiSkTestClosed') }}
+          </div>
+        </div>
+
+        <div v-if="state === 'done' && sandbox.error" class="sk-test-result">
+          <div class="label" data-state="failed">
+            <span class="bullet" />
+            {{ t('aiSkTestFailed') }}
+          </div>
+          <div>{{ sandbox.error }}</div>
+        </div>
+      </div>
+    </div>
+  </div>
+</template>
diff --git a/src/ai/styles/skills-styles.scss b/src/ai/styles/skills-styles.scss
index 85d62fb..a7f330c 100644
--- a/src/ai/styles/skills-styles.scss
+++ b/src/ai/styles/skills-styles.scss
@@ -505,20 +505,33 @@
       background: var(--success);
       // Vue2 skills-styles.scss:465 原为 iOS 绿色约 18% 透明度发光圈字面量——
       // 与 .sk-meta-cell 的「启用」态发光圈(本档 :302-306)完全同族同比例,
       // 同样用 color-mix 从 --success 派生。
       box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
     }
     &[data-state="running"] .bullet {
       background: var(--accent);
       animation: skill-pulse 1.4s ease-in-out infinite;
     }
+    // SP8-P3b Task 4 —— 失败态。Vue2 TestPanel.vue:92-98 靠模板内联样式实现:
+    // `.label` 上 `style="color: var(--danger)"`,`.bullet` 上
+    // `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`。
+    // 后者是字面量 rgba() 且内联颜色本身违反本仓配色硬约束(公共约束 §6),改成
+    // 静态 CSS 分支:发光圈用 color-mix 从 --danger 派生,手法与上方 :506-509 的
+    // success 态发光圈同族同比例(18% 不透明度)。
+    &[data-state="failed"] {
+      color: var(--danger);
+      .bullet {
+        background: var(--danger);
+        box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
+      }
+    }
   }
   code {
     font-family: var(--font-mono);
     font-size: 12px;
     background: var(--bg-elevated);
     border: 1px solid var(--line-faint);
     padding: 1px 5px;
     border-radius: 4px;
   }
   .step-row {

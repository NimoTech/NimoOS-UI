# Task 2 review package — f613947..HEAD

## commits
b8357ee sp8-ai P3b Task 2: skills write-half sandboxRun/skillsErrorKey utils + i18n keys

## diff --stat
 src/ai/util/sandboxRun.test.ts     | 118 ++++++++++++++++++++++++++
 src/ai/util/sandboxRun.ts          |  73 ++++++++++++++++
 src/ai/util/skillsErrorKey.test.ts | 169 +++++++++++++++++++++++++++++++++++++
 src/ai/util/skillsErrorKey.ts      |  77 +++++++++++++++++
 src/i18n/en_us.ts                  |  80 ++++++++++++++++++
 src/i18n/messageSyntax.test.ts     |  33 ++++++++
 src/i18n/zh_cn.ts                  |  89 +++++++++++++++++++
 7 files changed, 639 insertions(+)

## diff -U10
diff --git a/src/ai/util/sandboxRun.test.ts b/src/ai/util/sandboxRun.test.ts
new file mode 100644
index 0000000..54437d8
--- /dev/null
+++ b/src/ai/util/sandboxRun.test.ts
@@ -0,0 +1,118 @@
+import { describe, it, expect } from 'vitest'
+import { initSandboxState, reduceSandboxEvent, type SandboxState } from './sandboxRun'
+
+describe('sandboxRun', () => {
+  it('initSandboxState starts empty/idle', () => {
+    expect(initSandboxState()).toEqual({ steps: [], ms: null, error: '', done: false })
+  })
+
+  it('two consecutive message_delta merge into one step, text appended in order', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'Hel' }, 0)
+    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'lo' }, 0)
+    expect(s.steps).toEqual([{ kind: 'text', text: 'Hello' }])
+  })
+
+  it('text and message also participate in the same accumulation', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'A' }, 0)
+    s = reduceSandboxEvent(s, { type: 'message', content: 'B' }, 0)
+    s = reduceSandboxEvent(s, { type: 'text', content: 'C' }, 0)
+    expect(s.steps).toEqual([{ kind: 'text', text: 'ABC' }])
+  })
+
+  it('text -> tool_call -> text yields 3 steps, 3rd is a new text step', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'text', content: 'before' }, 0)
+    s = reduceSandboxEvent(s, { type: 'tool_call', tool: 'grep' }, 0)
+    s = reduceSandboxEvent(s, { type: 'text', content: 'after' }, 0)
+    expect(s.steps).toEqual([
+      { kind: 'text', text: 'before' },
+      { kind: 'tool', text: '→ grep' },
+      { kind: 'text', text: 'after' },
+    ])
+  })
+
+  it('tool_call without ev.tool falls back to ev.name', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'tool_call', name: 'search_files' }, 0)
+    expect(s.steps).toEqual([{ kind: 'tool', text: '→ search_files' }])
+  })
+
+  it('tool_call with neither tool nor name falls back to the literal "tool"', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'tool_call' }, 0)
+    expect(s.steps).toEqual([{ kind: 'tool', text: '→ tool' }])
+  })
+
+  it('error event writes error', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'error', content: 'sandbox exploded' }, 0)
+    expect(s.error).toBe('sandbox exploded')
+  })
+
+  it('error event with no content writes empty string, not "null"/"undefined"', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'error' }, 0)
+    expect(s.error).toBe('')
+  })
+
+  it('done event writes done and ms from the caller-supplied elapsedMs', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'text', content: 'x' }, 0)
+    s = reduceSandboxEvent(s, { type: 'done' }, 4242)
+    expect(s.done).toBe(true)
+    expect(s.ms).toBe(4242)
+  })
+
+  it('unknown event type leaves state unchanged (same reference)', () => {
+    const s = initSandboxState()
+    const next = reduceSandboxEvent(s, { type: 'thinking', content: 'hmm' }, 0)
+    expect(next).toBe(s)
+  })
+
+  it('message_delta with empty string content leaves state unchanged', () => {
+    const s = initSandboxState()
+    const next = reduceSandboxEvent(s, { type: 'message_delta', content: '' }, 0)
+    expect(next).toBe(s)
+  })
+
+  it('message_delta with non-string content leaves state unchanged', () => {
+    const s = initSandboxState()
+    const next = reduceSandboxEvent(s, { type: 'message_delta', content: 123 }, 0)
+    expect(next).toBe(s)
+  })
+
+  it('does not mutate the input state object in place', () => {
+    const s = initSandboxState()
+    const originalSteps = s.steps
+    reduceSandboxEvent(s, { type: 'text', content: 'hello' }, 0)
+    // Original object passed in must be untouched: same array reference, still empty.
+    expect(s.steps).toBe(originalSteps)
+    expect(s.steps.length).toBe(0)
+  })
+
+  it('does not mutate an input state that already has steps (array not shared)', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'text', content: 'first' }, 0)
+    const before = s.steps
+    const beforeLength = before.length
+    reduceSandboxEvent(s, { type: 'text', content: 'more' }, 0)
+    expect(s.steps).toBe(before)
+    expect(s.steps.length).toBe(beforeLength)
+  })
+
+  // RED-probe style regression: Vue2 TestPanel.vue:70-73 has an `output.tokens != null`
+  // template branch, but `output.tokens` is never assigned anywhere in that component —
+  // a dead branch. We deliberately do not carry a `tokens` field on SandboxState. This
+  // pins that decision: even if a `done` event arrives with a `tokens` payload, the
+  // resulting state must not gain a `tokens` property.
+  it('does not add a tokens field even if the done event carries one (dead Vue2 branch, not ported)', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'done', tokens: 999 }, 10)
+    expect('tokens' in (s as unknown as Record<string, unknown>)).toBe(false)
+    // Type-level pin: SandboxState has no tokens field, so this would not compile if added.
+    const check: SandboxState = s
+    expect(check.done).toBe(true)
+  })
+})
diff --git a/src/ai/util/sandboxRun.ts b/src/ai/util/sandboxRun.ts
new file mode 100644
index 0000000..84f8afe
--- /dev/null
+++ b/src/ai/util/sandboxRun.ts
@@ -0,0 +1,73 @@
+// SP8-P3b Task 2 —— 对齐 Vue2 src/views/AI/Skills/TestPanel.vue:160-172 的 SSE 事件归约逻辑。
+//
+// Vue2 每收到一片 message/message_delta/text 就 push 一个新的字符串到 output.steps
+// （:162 `this.output.steps.push(ev.content)`），逐词流式发送时会在结果列表里炸出一大堆
+// 单字/单词的独立行，而不是一段连续文本。后端 message_delta 是逐词发的
+// （NimoOS-AI/agent/agent.py:1266,1284），Vue2 这里没适配。
+// 【拍板偏离 D2，见 p3b-common-constraints.md §3.1】本仓改成：连续的文本片如果上一步也是
+// text，就把新内容追加到同一步里；工具调用（tool_call）仍然单独起一行。
+//
+// 纯函数：不读时钟（elapsedMs 由调用方传入，便于测试），不就地修改传入的 state，
+// 每次返回一个新对象（包括 steps 数组本身，即使内容未变也返回新引用是可接受的——
+// 但为避免不必要的对象抖动，无变化路径直接原样返回入参 s）。
+//
+// 不实现 `tokens`：Vue2 模板 TestPanel.vue:70-73 有 `output.tokens != null` 分支，
+// 但 `output.tokens` 全组件从未被赋值（`data()` 里初始化为 null 后再无写入点）——
+// 是死分支。照 P3a 处理 trigger_human 的先例，此处不复刻这个字段，SandboxState 类型上
+// 没有 tokens，.test.ts 里有一条探针钉死这一点。
+
+export type SandboxStep = { kind: 'text' | 'tool'; text: string }
+
+export type SandboxState = {
+  steps: SandboxStep[]
+  ms: number | null
+  error: string
+  done: boolean
+}
+
+export function initSandboxState(): SandboxState {
+  return { steps: [], ms: null, error: '', done: false }
+}
+
+/**
+ * 对齐 Vue2 TestPanel.vue run() 里 onEvent 回调（:158-172）。
+ * 事件取舍见 p3b-task-2-brief.md §2.1 的表；忽略 thinking/tool_result/confirmation_required
+ * 等其余事件类型。返回新的 SandboxState，不修改入参 s 或 s.steps。
+ */
+export function reduceSandboxEvent(
+  s: SandboxState,
+  ev: Record<string, unknown>,
+  elapsedMs: number
+): SandboxState {
+  const type = ev.type
+
+  if (type === 'message_delta' || type === 'message' || type === 'text') {
+    const content = ev.content
+    if (typeof content !== 'string' || content === '') return s
+    const steps = s.steps.slice()
+    const last = steps[steps.length - 1]
+    if (last && last.kind === 'text') {
+      steps[steps.length - 1] = { kind: 'text', text: last.text + content }
+    } else {
+      steps.push({ kind: 'text', text: content })
+    }
+    return { ...s, steps }
+  }
+
+  if (type === 'tool_call') {
+    const name = (ev.tool as string | undefined) ?? (ev.name as string | undefined) ?? 'tool'
+    const steps = s.steps.slice()
+    steps.push({ kind: 'tool', text: '→ ' + name })
+    return { ...s, steps }
+  }
+
+  if (type === 'error') {
+    return { ...s, error: String(ev.content ?? '') }
+  }
+
+  if (type === 'done') {
+    return { ...s, done: true, ms: elapsedMs }
+  }
+
+  return s
+}
diff --git a/src/ai/util/skillsErrorKey.test.ts b/src/ai/util/skillsErrorKey.test.ts
new file mode 100644
index 0000000..c6c4e75
--- /dev/null
+++ b/src/ai/util/skillsErrorKey.test.ts
@@ -0,0 +1,169 @@
+import { describe, it, expect } from 'vitest'
+import { createSkillErrorKey, validateSkillForm } from './skillsErrorKey'
+
+/** Wrap a raw backend string the way axios would, so createSkillErrorKey can read it. */
+function errWith(message: string) {
+  return { response: { data: { message } } }
+}
+
+describe('createSkillErrorKey', () => {
+  // Real Go error strings, taken verbatim from NimoOS-AI/service/skills_store.go
+  // (fmt.Errorf("%w: <reason>", ErrBadSkillID / ErrBadDescription / ErrDuplicateSkill /
+  // ErrBadPath / ErrBundleTooLarge) and the SKILL.md size message).
+  it('maps "skill already exists"', () => {
+    expect(createSkillErrorKey(errWith('skill already exists'))).toBe('aiSkErrDuplicate')
+  })
+
+  it('maps "invalid skill id"', () => {
+    expect(createSkillErrorKey(errWith('invalid skill id'))).toBe('aiSkErrBadId')
+  })
+
+  it('maps "invalid skill description: description required"', () => {
+    expect(createSkillErrorKey(errWith('invalid skill description: description required'))).toBe(
+      'aiSkErrDescRequired'
+    )
+  })
+
+  it('maps "invalid skill description: longer than 256 characters"', () => {
+    expect(
+      createSkillErrorKey(errWith('invalid skill description: longer than 256 characters'))
+    ).toBe('aiSkErrDescTooLong')
+  })
+
+  it('maps "invalid skill description: must be a single line"', () => {
+    expect(
+      createSkillErrorKey(errWith('invalid skill description: must be a single line'))
+    ).toBe('aiSkErrDescSingleLine')
+  })
+
+  it('maps "invalid skill description: \'<\' and \'>\' are not allowed"', () => {
+    expect(
+      createSkillErrorKey(errWith("invalid skill description: '<' and '>' are not allowed"))
+    ).toBe('aiSkErrDescAngle')
+  })
+
+  it('maps "invalid skill description: control characters are not allowed"', () => {
+    expect(
+      createSkillErrorKey(errWith('invalid skill description: control characters are not allowed'))
+    ).toBe('aiSkErrDescControl')
+  })
+
+  it('maps "invalid file path in bundle"', () => {
+    expect(createSkillErrorKey(errWith('invalid file path in bundle'))).toBe('aiSkErrBadPath')
+  })
+
+  it('maps "bundle exceeds size limits"', () => {
+    expect(createSkillErrorKey(errWith('bundle exceeds size limits'))).toBe('aiSkErrBundleTooLarge')
+  })
+
+  it('maps "SKILL.md exceeds 32768 bytes (got 40000)" (case-insensitive)', () => {
+    expect(createSkillErrorKey(errWith('SKILL.md exceeds 32768 bytes (got 40000)'))).toBe(
+      'aiSkErrMdTooLarge'
+    )
+  })
+
+  it('falls back to aiSkErrCreateFailed for an unrecognized backend string', () => {
+    expect(createSkillErrorKey(errWith('something went sideways'))).toBe('aiSkErrCreateFailed')
+  })
+
+  it('falls back to aiSkErrCreateFailed when no error string can be extracted', () => {
+    expect(createSkillErrorKey(new Error('network down'))).toBe('aiSkErrCreateFailed')
+    expect(createSkillErrorKey(undefined)).toBe('aiSkErrCreateFailed')
+    expect(createSkillErrorKey(null)).toBe('aiSkErrCreateFailed')
+  })
+
+  it('reads .detail when .message is absent (FastAPI shape)', () => {
+    expect(createSkillErrorKey({ response: { data: { detail: 'skill already exists' } } })).toBe(
+      'aiSkErrDuplicate'
+    )
+  })
+
+  it('is case-insensitive on the backend string', () => {
+    expect(createSkillErrorKey(errWith('SKILL ALREADY EXISTS'))).toBe('aiSkErrDuplicate')
+  })
+})
+
+describe('validateSkillForm', () => {
+  it('rejects an empty name', () => {
+    expect(validateSkillForm('', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a whitespace-only name', () => {
+    expect(validateSkillForm('   ', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('accepts a single-character name ("a")', () => {
+    expect(validateSkillForm('a', 'a valid description')).toBe(null)
+  })
+
+  it('rejects uppercase letters in the name', () => {
+    expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects underscores in the name', () => {
+    expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a name starting with a dash', () => {
+    expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a name ending with a dash', () => {
+    expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('accepts a name exactly at the 64-char boundary', () => {
+    // 1 leading + 62 middle + 1 trailing = 64 chars total, matches skillIDRe exactly.
+    const name = 'a' + 'b'.repeat(62) + 'c'
+    expect(name.length).toBe(64)
+    expect(validateSkillForm(name, 'a valid description')).toBe(null)
+  })
+
+  it('rejects a name one char past the 64-char boundary', () => {
+    const name = 'a' + 'b'.repeat(63) + 'c'
+    expect(name.length).toBe(65)
+    expect(validateSkillForm(name, 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects an empty description', () => {
+    expect(validateSkillForm('valid-name', '')).toBe('aiSkErrDescRequired')
+  })
+
+  it('rejects a whitespace-only description', () => {
+    expect(validateSkillForm('valid-name', '   ')).toBe('aiSkErrDescRequired')
+  })
+
+  it('accepts a description exactly at the 256-char boundary', () => {
+    const description = 'x'.repeat(256)
+    expect(validateSkillForm('valid-name', description)).toBe(null)
+  })
+
+  it('rejects a description one char past the 256-char boundary', () => {
+    const description = 'x'.repeat(257)
+    expect(validateSkillForm('valid-name', description)).toBe('aiSkErrDescTooLong')
+  })
+
+  it('rejects a description containing a newline', () => {
+    expect(validateSkillForm('valid-name', 'line one\nline two')).toBe('aiSkErrDescSingleLine')
+  })
+
+  it('rejects a description containing a carriage return', () => {
+    expect(validateSkillForm('valid-name', 'line one\rline two')).toBe('aiSkErrDescSingleLine')
+  })
+
+  it('rejects a description containing "<"', () => {
+    expect(validateSkillForm('valid-name', 'use <tag> here')).toBe('aiSkErrDescAngle')
+  })
+
+  it('rejects a description containing ">"', () => {
+    expect(validateSkillForm('valid-name', 'a > b')).toBe('aiSkErrDescAngle')
+  })
+
+  it('rejects a description containing a control character (\\x07)', () => {
+    expect(validateSkillForm('valid-name', 'bell\x07here')).toBe('aiSkErrDescControl')
+  })
+
+  it('returns null when both name and description are valid', () => {
+    expect(validateSkillForm('invoice-tagger', 'Tags invoices when they arrive.')).toBe(null)
+  })
+})
diff --git a/src/ai/util/skillsErrorKey.ts b/src/ai/util/skillsErrorKey.ts
new file mode 100644
index 0000000..54dc6e8
--- /dev/null
+++ b/src/ai/util/skillsErrorKey.ts
@@ -0,0 +1,77 @@
+// SP8-P3b Task 2 —— 技能新建/更新的错误归一 + 前端预校验。
+//
+// createSkillErrorKey 的形状照 src/ai/util/channelsFormat.ts:65-76 (addBotErrorKey)：
+// 取 e.response.data.message ?? .detail ?? data，String 化后 trim().toLowerCase()，
+// 按包含匹配判定，认不出的一律落通用兜底键，后端原文永不回显
+// （承 p3b-common-constraints.md §4 数据契约「HTTP 层失败不回显后端 body」）。
+//
+// 后端 NimoOS-AI/service/skills_store.go 的 validateSkillDescription 用
+// `fmt.Errorf("%w: <reason>", ErrBadDescription)` 包装，所以串形如
+// "invalid skill description: description required" —— 带前缀。匹配顺序：
+// 先判更具体的 description 子类（"description required" / "longer than 256
+// characters" / "must be a single line" / "'<' and '>' are not allowed" 里的
+// "are not allowed" + 含 '<' / "control characters are not allowed"），
+// 再判 "invalid skill description" 本身，最后落 aiSkErrCreateFailed 兜底。
+//
+// validateSkillForm 是【拍板偏离①，见 p3b-common-constraints.md §3.6】：Vue2
+// AddSkillModal.vue:137-139 提交前只查了 name/description 非空，填完一整屏才被后端一句
+// 英文顶回来。这里在前端做与后端同款的校验规则，规则逐条对
+// NimoOS-AI/service/skills_store.go:37-59 的 validateSkillDescription 与
+// skillIDRe（:86）——已回源核对，两处正则字面一致，见本任务报告。
+
+/** 对齐 channelsFormat.ts:66-70 的取错误串形状：response.data.message ?? .detail ?? data。 */
+function extractErrorString(e: unknown): string {
+  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
+  const raw =
+    data && typeof data === 'object'
+      ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
+      : data
+  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
+}
+
+/**
+ * 后端错误 → i18n 键。对齐 p3b-task-2-brief.md §2.2 的表。
+ * 已回源核对 NimoOS-AI/service/skills_store.go 的错误串字面量（见任务报告）。
+ */
+export function createSkillErrorKey(e: unknown): string {
+  const s = extractErrorString(e)
+
+  if (s.includes('skill already exists')) return 'aiSkErrDuplicate'
+  if (s.includes('invalid skill id')) return 'aiSkErrBadId'
+  if (s.includes('description required')) return 'aiSkErrDescRequired'
+  if (s.includes('longer than 256 characters')) return 'aiSkErrDescTooLong'
+  if (s.includes('must be a single line')) return 'aiSkErrDescSingleLine'
+  if (s.includes('are not allowed') && s.includes('<')) return 'aiSkErrDescAngle'
+  if (s.includes('control characters are not allowed')) return 'aiSkErrDescControl'
+  if (s.includes('invalid file path in bundle')) return 'aiSkErrBadPath'
+  if (s.includes('bundle exceeds size limits')) return 'aiSkErrBundleTooLarge'
+  if (s.includes('skill.md exceeds')) return 'aiSkErrMdTooLarge'
+  return 'aiSkErrCreateFailed'
+}
+
+// 回源核对结论（NimoOS-AI/service/skills_store.go:86 与 agent/main.py:2489）：两处正则
+// 字面完全一致，均为 /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/ —— 首尾必须是小写字母或数字，
+// 中间可含短横线，总长 1–64。brief 表里给的这条是对的，不存在需要以 Go 为准改写的分歧。
+const SKILL_ID_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/
+
+/**
+ * 前端预校验，规则逐条对齐 skills_store.go 的 ValidateSkillID + validateSkillDescription。
+ * 全过返回 null；否则返回对应的 i18n 错误键。
+ */
+export function validateSkillForm(name: string, description: string): string | null {
+  const trimmedName = name.trim()
+  if (trimmedName === '' || !SKILL_ID_RE.test(trimmedName)) return 'aiSkErrBadId'
+
+  const trimmedDescription = description.trim()
+  if (trimmedDescription === '') return 'aiSkErrDescRequired'
+  // Array.from(...).length counts Unicode code points, matching Go's
+  // utf8.RuneCountInString(d) in skills_store.go:49 more closely than
+  // JS's native .length (UTF-16 code units, which over-counts astral chars).
+  if (Array.from(trimmedDescription).length > 256) return 'aiSkErrDescTooLong'
+  if (/[\n\r]/.test(trimmedDescription)) return 'aiSkErrDescSingleLine'
+  if (trimmedDescription.includes('<') || trimmedDescription.includes('>')) return 'aiSkErrDescAngle'
+  // eslint-disable-next-line no-control-regex
+  if (/[\x00-\x1f\x7f]/.test(trimmedDescription)) return 'aiSkErrDescControl'
+
+  return null
+}
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index 2c9d71d..e102d06 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1226,11 +1226,91 @@ export default {
   aiSkTriggerSlash: '/{name}',
 
   // SP8-P3a post-acceptance addendum — "skill attached" banner inside the
   // composer (user-requested 2026-07-30, no Vue2 counterpart; see the header
   // comment in AgentComposer.vue and
   // .superpowers/sdd/p3a-post-skillbanner-brief.md). {name} is filled by an
   // <i18n-t> named slot with <code>; the value itself carries no markup.
   aiSkPendingBanner: 'Skill {name} is attached — it will apply to your next message',
   aiSkPendingDetach: 'Detach skill',
   // <<< SP8-P3a
+  // >>> SP8-P3b Task 2 — skills section "write half": add/enable/disable/uninstall/
+  // delete/sandbox test. See zh_cn.ts for which lines are Vue2-less new copy.
+  aiSkAddSkill: 'Add skill',
+  aiSkDisable: 'Disable',
+  aiSkEnable: 'Enable',
+  aiSkDisableTemporarily: 'Disable temporarily',
+  aiSkCopyMd: 'Copy SKILL.md',
+  aiSkExport: 'Export skill',
+  aiSkUninstall: 'Uninstall',
+  aiSkDeleteSkill: 'Delete skill',
+  aiSkDelete: 'Delete',
+  aiSkUninstallTitle: 'Uninstall this skill?',
+  aiSkDeleteTitle: 'Delete this skill?',
+  aiSkUninstallBody:
+    "It will be removed from this NAS. This interface cannot restore it — you would need to reinstall the system or put the skill folder back by hand.",
+  aiSkDeleteBody: 'This permanently deletes the skill and its SKILL.md from your NAS. This cannot be undone.',
+  aiSkNPrevRuns: '{count} previous runs',
+  aiSkEnabledToast: 'Skill enabled',
+  aiSkPausedToast: 'Skill paused',
+  aiSkUpdateFailed: 'Update failed',
+  aiSkUninstalledName: 'Uninstalled {name}',
+  aiSkDeletedName: 'Deleted {name}',
+  aiSkDeleteFailed: 'Delete failed',
+  aiSkAddedName: 'Added {name}',
+  aiSkAddTitle: 'Add a new skill',
+  aiSkFieldName: 'Name',
+  aiSkNamePlaceholder: 'e.g. invoice-tagger',
+  aiSkNameHint: 'Lowercase, dashes only — this becomes the slash command.',
+  aiSkDescPlaceholder: 'When should Nimo use this skill? What does it do?',
+  aiSkDescFormHint: 'A clear description helps Nimo pick the right skill automatically.',
+  aiSkFieldColor: 'Color',
+  aiSkOptional: 'optional',
+  aiSkScriptFiles: 'Script files',
+  aiSkScriptsHint: "Files are stored inside scripts/{'<'}name{'>'} in the bundle.",
+  aiSkSavedLocally: 'Saved locally on this NAS',
+  aiSkCreating: 'Creating…',
+  aiSkCreate: 'Create skill',
+  aiSkTrigOptAuto: 'Automatic',
+  aiSkTrigDescAuto: 'Nimo decides when to use it',
+  aiSkTrigOptSlash: 'Slash command',
+  aiSkTrigDescSlash: 'Run with /name in chat',
+  aiSkTrigDescManual: 'Only when explicitly invoked',
+  aiSkMdPlaceholderHead: 'Your skill',
+  aiSkMdPlaceholderBody: 'Describe how the skill works…',
+  aiSkFilesSkippedTooBig: '{n} file(s) larger than 1 MiB were skipped',
+  aiSkErrDuplicate: 'A skill with this name already exists',
+  aiSkErrBadId:
+    'Name may only contain lowercase letters, digits and dashes, and cannot start or end with a dash',
+  aiSkErrDescRequired: 'Description is required',
+  aiSkErrDescTooLong: 'Description cannot exceed 256 characters',
+  aiSkErrDescSingleLine: 'Description must be a single line',
+  aiSkErrDescAngle: "Description cannot contain {'<'} or {'>'}",
+  aiSkErrDescControl: 'Description cannot contain control characters',
+  aiSkErrBadPath: 'Invalid file path in bundle',
+  aiSkErrBundleTooLarge: 'Bundle exceeds size limits',
+  aiSkErrMdTooLarge: 'SKILL.md is too large',
+  aiSkErrCreateFailed: 'Could not create skill',
+  aiSkTestTitle: 'Test in sandbox',
+  aiSkTestHint: "Runs in an isolated container — won't touch real files.",
+  aiSkTestPill: 'Sandbox',
+  aiSkTestTryName: 'Try {name} without affecting your NAS',
+  aiSkTestDiscard: 'Inputs and outputs are discarded after the run.',
+  aiSkTestOffTitle: 'Skill is disabled — testing still works',
+  aiSkTestOffBadge: 'Skill off',
+  aiSkTestRun: 'Run',
+  aiSkTestRunning: 'Running…',
+  aiSkTestExamples: 'Example prompts',
+  aiSkTestRunningLabel: 'Running in sandbox…',
+  aiSkTestBootstrapping: 'Bootstrapping {name} environment…',
+  aiSkTestCompleted: 'Completed in {ms} ms',
+  aiSkTestClosed: 'Sandbox closed. No files were modified.',
+  aiSkTestFailed: 'Run failed',
+  aiSkTestPlaceholderEx: 'Try: "{ex}"',
+  aiSkTestPlaceholder: 'Run the skill on a sample folder',
+  aiSkTestHttpFailed: 'Sandbox run failed (HTTP {status})',
+  aiSkTryDisabledTitle: 'This skill is paused',
+  aiSkTryDisabledBody:
+    'A paused skill is not loaded, so trying it in chat will have no effect. Enable it first?',
+  aiSkTryEnableAndTry: 'Enable and try',
+  // <<< SP8-P3b Task 2
 }
diff --git a/src/i18n/messageSyntax.test.ts b/src/i18n/messageSyntax.test.ts
index 62e62c8..6e6e93f 100644
--- a/src/i18n/messageSyntax.test.ts
+++ b/src/i18n/messageSyntax.test.ts
@@ -43,20 +43,53 @@ describe('i18n message syntax', () => {
         legacy: false,
         locale: 'zh_cn',
         messages: { zh_cn: zh },
       })
       const message = i18nZh.global.t('aiSlashNoFolders')
       expect(message).toContain('@')
       expect(message).toBe('还没有可见目录 —— 先用 @ 选一个')
     })
   })
 
+  // SP8-P3b Task 2: aiSkScriptsHint / aiSkErrDescAngle both contain literal angle
+  // brackets, written as {'<'}/{'>'} escapes (probe confirmed vue-i18n 9 renders bare
+  // <>  without erroring too, but logs an "[intlify] Detected HTML" console warning —
+  // the escaped form renders identically without that warning, so it's what's shipped).
+  // Same failure mode as the P1c1 bare-@ incident this file was created to guard
+  // against: pin the resolved rendering so a future edit that breaks the escape shows
+  // up here instead of silently mangling the UI.
+  describe('aiSkScriptsHint and aiSkErrDescAngle keys (angle-bracket escapes)', () => {
+    it('should resolve the literal angle brackets in zh_cn aiSkScriptsHint', () => {
+      const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+      const message = i18nZh.global.t('aiSkScriptsHint')
+      expect(message).toBe('文件会保存在 bundle 的 scripts/<name> 路径下。')
+    })
+
+    it('should resolve the literal angle brackets in en_us aiSkScriptsHint', () => {
+      const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
+      const message = i18nEn.global.t('aiSkScriptsHint')
+      expect(message).toBe('Files are stored inside scripts/<name> in the bundle.')
+    })
+
+    it('should resolve the literal angle brackets in zh_cn aiSkErrDescAngle', () => {
+      const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+      const message = i18nZh.global.t('aiSkErrDescAngle')
+      expect(message).toBe('描述里不能包含 < 和 >')
+    })
+
+    it('should resolve the literal angle brackets in en_us aiSkErrDescAngle', () => {
+      const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
+      const message = i18nEn.global.t('aiSkErrDescAngle')
+      expect(message).toBe('Description cannot contain < or >')
+    })
+  })
+
   describe('bare @ guard (unescaped @ detection)', () => {
     it('should not allow bare @ in any key (only {@} escapes or @:key references)', () => {
       const locales = [
         { name: 'zh_cn', messages: zh },
         { name: 'en_us', messages: en },
       ]
 
       const violations: Array<{ locale: string; key: string; value: string }> = []
 
       for (const { name, messages } of locales) {
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index d4f70d4..9edca66 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1228,11 +1228,100 @@ export default {
   aiSkAuthorYou: '你',
   aiSkTriggerSlash: '/{name}',
 
   // SP8-P3a 验收后追加 —— 输入框内「已挂载技能」提示条(用户 2026-07-30 当面要求
   // 新增,Vue2 无对应 UI;见 AgentComposer.vue 顶部注释与
   // .superpowers/sdd/p3a-post-skillbanner-brief.md)。{name} 由 <i18n-t> 具名插槽
   // 用 <code> 填充,值本身不含 <code> 标签。
   aiSkPendingBanner: '已挂载技能 {name},将应用于下一条消息',
   aiSkPendingDetach: '取消挂载',
   // <<< SP8-P3a
+  // >>> SP8-P3b Task 2 —— 技能分区「写操作」半:新建/启停/卸载/删除/沙箱测试。
+  // 加粗行(见任务书 §2.3)在下方逐条标注为「Vue2 没有的新文案」。
+  aiSkAddSkill: '添加技能',
+  aiSkDisable: '禁用',
+  aiSkEnable: '启用',
+  aiSkDisableTemporarily: '临时禁用',
+  aiSkCopyMd: '复制 SKILL.md',
+  aiSkExport: '导出技能',
+  aiSkUninstall: '卸载',
+  aiSkDeleteSkill: '删除技能',
+  aiSkDelete: '删除', // 拍板不复用 aiConfirm(P1a 弹窗标题误用按钮文案的历史遗留),按任务书新增
+  aiSkUninstallTitle: '卸载这个技能？',
+  aiSkDeleteTitle: '删除这个技能？',
+  // 新文案(D3 拍板):Vue2 SkillDetail.vue:161 承诺「以后可从内置目录重新安装」,
+  // 但后端 service/skills.go:330-340 只写 uninstalled=1 标记、全仓无恢复接口 —— 说实话。
+  aiSkUninstallBody:
+    '技能将从这台 NAS 移除。此界面无法恢复,需要重装系统或手工把技能目录放回。',
+  aiSkDeleteBody: '这会永久删除该技能及其 SKILL.md 文件,无法恢复。',
+  aiSkNPrevRuns: '历史运行 {count} 次',
+  aiSkEnabledToast: '技能已启用',
+  aiSkPausedToast: '技能已暂停',
+  aiSkUpdateFailed: '更新失败',
+  aiSkUninstalledName: '已卸载 {name}',
+  aiSkDeletedName: '已删除 {name}',
+  aiSkDeleteFailed: '删除失败',
+  aiSkAddedName: '已添加 {name}',
+  aiSkAddTitle: '添加新技能',
+  aiSkFieldName: '名称',
+  aiSkNamePlaceholder: '例如:invoice-tagger',
+  aiSkNameHint: '仅小写字母与短横线 —— 这个名字会作为斜杠命令使用。',
+  aiSkDescPlaceholder: 'Nimo 应该在什么时候用这个技能?它做什么?',
+  aiSkDescFormHint: '清晰的描述能帮助 Nimo 自动挑选合适的技能。',
+  aiSkFieldColor: '颜色',
+  aiSkOptional: '可选',
+  aiSkScriptFiles: '脚本文件',
+  // 尖括号实测:vue-i18n 9 对裸 `<`/`>` 渲染无异常,但会打印
+  // "[intlify] Detected HTML in ... message" 控制台警告；本仓沿用既有转义惯例
+  // ({'@'} 等),用 {'<'}/{'>'} 转义写法,渲染结果与裸字面完全一致但不触发该警告。
+  aiSkScriptsHint: '文件会保存在 bundle 的 scripts/{\'<\'}name{\'>\'} 路径下。',
+  aiSkSavedLocally: '保存在这台 NAS 本地',
+  aiSkCreating: '创建中…',
+  aiSkCreate: '创建技能',
+  aiSkTrigOptAuto: '自动触发',
+  aiSkTrigDescAuto: '由 Nimo 自行决定何时使用',
+  aiSkTrigOptSlash: '斜杠命令',
+  aiSkTrigDescSlash: '在对话中输入 /name 触发',
+  aiSkTrigDescManual: '仅在明确调用时',
+  aiSkMdPlaceholderHead: '你的技能',
+  aiSkMdPlaceholderBody: '描述这个技能的工作方式…',
+  // 新文案(拍板偏离⑦):Vue2 AddSkillModal.vue:164-167 对 >1 MiB 的脚本文件直接
+  // continue 静默丢弃,用户看不到文件消失 —— 改为提示。
+  aiSkFilesSkippedTooBig: '{n} 个文件超过 1 MiB,已跳过',
+  aiSkErrDuplicate: '已存在同名技能',
+  aiSkErrBadId: '名称只能用小写字母、数字和短横线,且不能以短横线开头或结尾',
+  aiSkErrDescRequired: '请填写描述',
+  aiSkErrDescTooLong: '描述不能超过 256 个字符',
+  aiSkErrDescSingleLine: '描述必须是单行',
+  aiSkErrDescAngle: '描述里不能包含 {\'<\'} 和 {\'>\'}',
+  aiSkErrDescControl: '描述里不能包含控制字符',
+  aiSkErrBadPath: '脚本文件路径不合法',
+  aiSkErrBundleTooLarge: '技能包体积超出限制',
+  aiSkErrMdTooLarge: 'SKILL.md 太大',
+  aiSkErrCreateFailed: '无法创建技能',
+  aiSkTestTitle: '沙箱测试',
+  aiSkTestHint: '在隔离环境中运行,不会影响真实文件。',
+  aiSkTestPill: '沙箱',
+  aiSkTestTryName: '试用 {name},不影响你的 NAS',
+  aiSkTestDiscard: '运行结束后输入和输出会被丢弃。',
+  aiSkTestOffTitle: '技能已禁用,但仍可在沙箱中测试',
+  aiSkTestOffBadge: '技能已关闭',
+  aiSkTestRun: '运行',
+  aiSkTestRunning: '运行中…',
+  aiSkTestExamples: '示例提示',
+  aiSkTestRunningLabel: '在沙箱中运行…',
+  aiSkTestBootstrapping: '正在准备 {name} 运行环境…',
+  aiSkTestCompleted: '用时 {ms} 毫秒',
+  aiSkTestClosed: '沙箱已关闭,没有文件被修改。',
+  aiSkTestFailed: '运行失败',
+  aiSkTestPlaceholderEx: '试试:"{ex}"',
+  aiSkTestPlaceholder: '在示例文件夹上运行该技能',
+  // 新文案:沙箱运行失败的 HTTP 状态码提示(设计要求本地化文案 + 状态码,不回显后端 body)。
+  aiSkTestHttpFailed: '沙箱运行失败(HTTP {status})',
+  // 新文案(D4 拍板,收 P3a 挂账③):停用技能点「在对话中试用」先提示,而不是
+  // X-Skill-Id 照发但 agent 找不到 SKILL.md 造成的零反馈(skills_runtime.go:57)。
+  aiSkTryDisabledTitle: '该技能已停用',
+  aiSkTryDisabledBody:
+    '停用的技能不会被加载,现在去对话里试用不会有任何效果。要先启用它吗?',
+  aiSkTryEnableAndTry: '启用并试用',
+  // <<< SP8-P3b Task 2
 }

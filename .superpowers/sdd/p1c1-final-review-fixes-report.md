# SP8-P1c1 final-review fixes — report

Scope: 7 items from the final whole-branch review of the AI Agent composer
(P1c-1). Touched files (matches the constraint list exactly):
`src/ai/components/shell/AgentComposer.vue` (+`.test.ts`),
`src/ai/components/shell/MentionPopover.vue`, `src/ai/components/shell/SlashMenu.vue`,
`src/ai/views/AgentPage.vue`, `src/ai/styles/tokens.scss`,
`src/ai/stores/agentStore.test.ts`. No i18n keys were needed.

---

## F1 — legacy store test mock missing `listStagedChanges`

**File:** `src/ai/stores/agentStore.test.ts`

Before:
```ts
const svc = vi.hoisted(() => ({
  ...
  listVisibleResources: vi.fn(),
  listAttachments: vi.fn(),
}))
```

After:
```ts
const svc = vi.hoisted(() => ({
  ...
  listVisibleResources: vi.fn(),
  listAttachments: vi.fn(),
  listStagedChanges: vi.fn(),
}))
```

No assertions changed. `selectSession`'s `Promise.allSettled` over the three
loaders no longer hits a `TypeError` from calling `undefined` as a function.

---

## F2 — declared deviation: MentionPopover drive-row size formatting

**File:** `src/ai/components/shell/MentionPopover.vue:351` (template)

Vue2 reference: `shell/MentionPopover.vue:59` — `{{ item.used }} / {{ item.capacity }}` (raw bytes).

Decision (controller): keep the formatted rendering (`formatSize(...)`), declare the
deviation in-code rather than reverting to raw bytes, since every sibling row already
uses `formatSize` and raw byte counts are themselves the presentation defect.

Comment added immediately above the line (rendering unchanged):
```html
<!-- Declared deviation (final review, 2026-07-27): Vue2 MentionPopover.vue:59
     prints the raw byte counts `{{ item.used }} / {{ item.capacity }}` (e.g.
     "500107862016 / 1000204885504"). Treated as a Vue2 presentation defect under
     the project rule (logic follows correctness) — every sibling row in this same
     list already goes through formatSize, so raw bytes here would be the odd one
     out. Intentionally formatted; not a missed 1:1 port. -->
<span v-if="item.kind === 'drive' && item.used && item.capacity">{{ formatSize(item.used) }} / {{ formatSize(item.capacity) }}</span>
```

---

## F3 — `submit()` busy guard (Enter during streaming ate the message)

**File:** `src/ai/components/shell/AgentComposer.vue`, `submit()`

Vue2 reference: `AgentComposer.vue:436-454` (`submit()` — unconditional clear, no busy
check) vs. the store's `send()` guarding `if (busy.value) return`. Same defect
reproduced 1:1 in this port before the fix.

Before:
```ts
function submit() {
  const trimmed = text.value.trim()
  ...
}
```

After:
```ts
/**
 * ...
 * Vue2 缺陷修复(final review, 2026-07-27,项目移植纪律:逻辑跟正确性):Vue2
 * AgentComposer.vue:436-454 的 submit() 无 busy 守卫,无条件清空 this.text/
 * this.attachments;但对应 store 的 send() 一开头就 `if (busy.value) return`
 * ——于是流式回复期间按 Enter,文本和已上传附件 chip 被原地清空,消息却根本没发
 * 出去,静默吞掉用户输入。这里在做任何清空/emit 之前先挡一道 busy。
 */
function submit() {
  if (props.busy) return
  const trimmed = text.value.trim()
  ...
}
```

### New test (RED before fix, GREEN after)

`src/ai/components/shell/AgentComposer.test.ts`:
```ts
it('final-review fix: busy 时按 Enter 既不 emit send 也不清空文本(AgentComposer.vue submit() 的 busy 守卫)', async () => {
  const w = mountComposer({ busy: true })
  const ta = w.find('textarea')
  await ta.setValue('hi there')
  await ta.trigger('keydown', { key: 'Enter' })
  expect(w.emitted('send')).toBeFalsy()
  expect((ta.element as HTMLTextAreaElement).value).toBe('hi there')
})
```

RED output (captured by temporarily removing `if (props.busy) return` from `submit()`,
then re-running just this test):
```
FAIL  src/ai/components/shell/AgentComposer.test.ts > AgentComposer 骨架 > final-review fix: busy 时按 Enter 既不 emit send 也不清空文本(AgentComposer.vue submit() 的 busy 守卫)
AssertionError: expected [ [ { text: 'hi there', …(2) } ] ] to be falsy

- Expected:
false

+ Received:
[
  [
    {
      "attachmentIds": [],
      "attachmentRefs": [],
      "text": "hi there",
    },
  ],
]

 ❯ src/ai/components/shell/AgentComposer.test.ts:55:31
     53|     await ta.setValue('hi there')
     54|     await ta.trigger('keydown', { key: 'Enter' })
     55|     expect(w.emitted('send')).toBeFalsy()
       |                               ^
     56|     expect((ta.element as HTMLTextAreaElement).value).toBe('hi there')
     57|   })

 Test Files  1 failed (1)
      Tests  1 failed | 25 skipped (26)
```

GREEN after restoring `if (props.busy) return` — confirmed as part of the full
`AgentComposer.test.ts` run below (95/95 passing across the 5 target files).

---

## F4 — SlashMenu scrim darker than Vue2

**Files:** `src/ai/styles/tokens.scss`, `src/ai/components/shell/SlashMenu.vue`

Vue2 reference: `shell/SlashMenu.vue` overlay literal `rgba(0,0,0,0.3)`. This port had
been using `var(--modal-scrim)` = `rgba(0,0,0,0.5)` — a visible, undeclared darkening.

`tokens.scss`, light block (`.agent-app`), added next to `--modal-scrim`:
```scss
/* SP8-P1c1 (final review, 2026-07-27) — a lighter scrim tier for SlashMenu.
   Vue2 shell/SlashMenu.vue's overlay literal was rgba(0,0,0,0.3), noticeably
   lighter than --modal-scrim's 0.5; reusing --modal-scrim there would be a
   visible 1:1 deviation, so this is a separate token, same value both themes
   (a scrim, not a skin surface — same family as --modal-scrim/--scrim-dark). */
--modal-scrim-soft: rgba(0, 0, 0, 0.3);
```

Dark block (`.agent-app[data-theme="dark"]`), same value:
```scss
/* SP8-P1c1 (final review, 2026-07-27) — dark-theme value for --modal-scrim-soft
   above (see light block comment); same value both themes, like --modal-scrim. */
--modal-scrim-soft: rgba(0, 0, 0, 0.3);
```

`SlashMenu.vue`:
```css
.slash-menu {
  position: fixed; inset: 0; background: var(--modal-scrim-soft);
  ...
}
```
(was `var(--modal-scrim)`). `--shadow-pop` left untouched per the review's judgment
that difference is negligible. Header comment in `SlashMenu.vue` updated to describe
the new token and why (see diff). `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white'`
over the four component files returns nothing — no raw color literal remains.

---

## F5 — context-usage ring keeps a dead session's numbers

**File:** `src/ai/views/AgentPage.vue`, `refreshContextUsage()`

Vue2 reference: `Agent.vue:198-207` has no guard at all on this path (not a "we differ
from Vue2" fix — a guard Vue2 never had).

Before:
```ts
async function refreshContextUsage() {
  if (!store.activeSessionId) return
  const seq = ++ctxUsageSeq
  ...
}
```

After:
```ts
async function refreshContextUsage() {
  // Final-review fix (2026-07-27, 项目移植纪律:逻辑跟正确性,Vue2 Agent.vue
  // 198-207 在这个早退分支上完全没有守卫,不是"跟 Vue2 不一样"而是补一个 Vue2
  // 从没做过的守卫):no-session 早退必须一样地(a) 递增 ctxUsageSeq,使一个
  // "刚被删掉的会话"仍在途的请求落地时,因 seq 已过期而被 catch/then 里的
  // `seq === ctxUsageSeq` 检查丢弃,不会覆盖当前(空)状态;(b) 清空 ctxUsage,
  // 否则环形进度条会继续显示已经不存在的会话的旧 token 数。
  if (!store.activeSessionId) {
    ++ctxUsageSeq
    ctxUsage.value = null
    return
  }
  const seq = ++ctxUsageSeq
  ...
}
```

---

## F6 — incomplete blur-timer teardown

**File:** `src/ai/components/shell/AgentComposer.vue`, `onBlur()`

Before:
```ts
function onBlur() {
  blurTimer.value = setTimeout(() => {
    closeMention()
    blurTimer.value = null
  }, 180)
}
```

After:
```ts
/**
 * ...
 * Final-review fix (2026-07-27): storing only the *latest* handle was still
 * incomplete — a blur→focus→blur sequence overwrote `blurTimer` with the
 * second timer's handle without ever clearing the first one, so the first
 * timer kept running and could fire `closeMention()` after the user had
 * already refocused and reopened the popover. Clear any pending handle
 * before scheduling a new one so at most one blur-close timer is ever live.
 */
function onBlur() {
  if (blurTimer.value !== null) clearTimeout(blurTimer.value)
  blurTimer.value = setTimeout(() => {
    closeMention()
    blurTimer.value = null
  }, 180)
}
```

---

## F7 — silent no-op removing an agent-authorized chip (no id)

**File:** `src/ai/components/shell/AgentComposer.vue`, `removeChip()`

Vue2 reference: `agentStream.js:539-542` (`case 'visible_resource_added'` →
`appendVisibleResource({path, kind})`, no id) and this repo's
`src/ai/services/dispatchEvent.ts` (`case 'visible_resource_added'`, ~line 310-315),
which forwards the same shape. Vue2's `removeChip` (`AgentComposer.vue:430-434`) has
**no** id guard — it calls `removeVisibleResource(undefined)` unconditionally and lets
the failure surface through its existing `catch { toastError(e) }`, so the user does
see an error toast. This port's guard is silent.

No functional fix attempted (deferred to 1c-2, per instructions — needs either the
reducer to carry the id or a remove-by-path path). Comment added:
```ts
/**
 * Vue2 430-434 removeChip()。
 *
 * Known gap (final review, 2026-07-27, deferred to 1c-2): chips the agent
 * itself authorizes mid-run arrive with no `id` — Vue2 agentStream.js:539-542
 * and this repo's dispatchEvent.ts (`case 'visible_resource_added'`, ~line
 * 310-315) both forward the stream event to `appendVisibleResource`/
 * `addVisibleResource` with only `{path, kind}`, never an id (see the same
 * observation in agentStore.ts:35). Vue2 has no guard here at all — it calls
 * `removeVisibleResource(undefined)` unconditionally and lets the resulting
 * failure surface through its existing `catch { toastError(e) }`, i.e. the
 * user does see an error toast. This port's `id === undefined` guard instead
 * no-ops silently: clicking × on such a chip does nothing and gives no
 * feedback. A proper fix needs either the reducer to carry the id or a
 * remove-by-path path — both out of scope here; not attempted in this task.
 */
async function removeChip(c: { id?: string | number }) {
  if (c.id === undefined) return
  ...
}
```

---

## Verification command outputs (tails)

### Targeted 5-file suite
```
$ pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/ai/stores/agentStore.test.ts src/ai/views/AgentPage.test.ts src/ai/components/shell/SlashMenu.test.ts src/ai/components/shell/MentionPopover.test.ts

 Test Files  5 passed (5)
      Tests  95 passed (95)
```

### Full suite
```
$ pnpm test

 Test Files  244 passed (244)
      Tests  1622 passed (1622)
```
(Baseline before this change was 1621 passing; +1 is the new F3 test.)

### Type check
```
$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)
```

### Raw-color grep gate
```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue src/ai/components/shell/SlashMenu.vue src/ai/components/shell/MentionPopover.vue src/ai/views/AgentPage.vue
(no output)
```

## Files touched (matches allowed list exactly)
- `src/ai/components/shell/AgentComposer.vue`
- `src/ai/components/shell/AgentComposer.test.ts`
- `src/ai/components/shell/MentionPopover.vue`
- `src/ai/components/shell/SlashMenu.vue`
- `src/ai/views/AgentPage.vue`
- `src/ai/styles/tokens.scss`
- `src/ai/stores/agentStore.test.ts`

No i18n keys were added (none needed).

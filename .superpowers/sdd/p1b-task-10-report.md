# Task 10 report: ProcessStrip + AssistantMessage groupBlocks wiring + TimelineMinimap + busy indicator

## What was ported/wired

1. **`src/ai/components/blocks/ProcessStrip.vue`** (new) — 1:1 port of Vue2
   `NimoOS-UI/src/views/AI/Agent/blocks/ProcessStrip.vue`. `data{open,expanded}` →
   `ref(false)` + `reactive<Record<number,boolean>>({})`; `$set(expanded,i,…)` →
   `expanded[i] = …`; computed `thinkCount`/`toolCount`/`headLabel`; methods
   `toggle`/`kindOf`/`iconOf`/`labelOf`/`metaOf` ported verbatim in behavior.
   **One deliberate deviation from "no glue code"**: the Vue2 version has no type
   system, so `s.text`/`s.sections`/`s.argsPreview`/`s.name`/`s.icon`/`s.time` are
   free-form. TS strict + the `AgentBlockLike` type from `groupBlocks` (`{type:
   string,[k:string]:unknown}`) means those fields resolve to `unknown`. Added
   four tiny typed accessor helpers (`textOf`/`argsPreviewOf`/`sectionsOf`, plus
   casts inside `iconOf`/`labelOf`/`metaOf`) purely to satisfy `vue-tsc`— the
   runtime behavior and template structure are unchanged from Vue2.
   Props typed as `steps?: AgentBlockLike[]` (imported from `groupBlocks.ts`)
   rather than a bespoke interface, specifically so `AssistantMessage.vue` can
   pass `item.steps` straight through with no cast at the call site.

2. **`src/ai/components/stream/AssistantMessage.vue`** (modified) — replaced the
   `1b:` placeholder slot with:
   - `import { groupBlocks, type AgentBlockLike, type ProcessGroup } from '../../util/groupBlocks'`
   - `const renderItems = computed(() => groupBlocks(props.msg.blocks ?? []))`
   - a local type guard `isProcessGroup(item): item is ProcessGroup` (checks
     `item.__process === true`) used in the template's `v-if`/`v-else` so both
     branches narrow cleanly for `vue-tsc` (a raw `item.__process` truthy check
     doesn't narrow through `AgentBlockLike`'s index signature — the guard fixes
     that without any `as any`).
   - Template: `<ProcessStrip v-if="isProcessGroup(item)" :steps="item.steps" :streaming="!!msg.streaming" />` else `<BlockRenderer v-else :block="item" />`.
   - **`formatMs` import path fixed**: P1a had a locally-defined duplicate
     `formatMs` function with a comment admitting it was a placeholder. Removed
     it and now imports the real one from `../../services/streamMappers` (Task 3)
     — same signature/behavior, so `statsLine` output is unchanged.
   - Header (tool count), stats footer, and Copy button (still using P1a's
     `copyText` insecure-context fallback) all left untouched.

3. **`src/ai/components/stream/TimelineMinimap.vue`** (new) — 1:1 port of Vue2
   `stream/TimelineMinimap.vue`. `data{cy}` → `ref<number|null>(null)`; computed
   `ticks = ticksFromMessages(messages)` (Task 2's `timelineMath`), `nearest`,
   `preview` all ported with identical math (distance-based dock magnification,
   clip-to-15-chars preview card). `widthFor(i)` → `tickWidth`. Emits `jump`.
   **One Vue2→Vue3 mechanical difference**: Vue2's `this.$refs.tickEls` (an
   array ref populated automatically by `ref="tickEls"` inside `v-for`) has no
   fully order-stable Vue3 equivalent via the string-ref shorthand, so I used
   the documented function-ref pattern instead: `tickEls = ref<(Element|null)[]>([])`,
   reset in `onBeforeUpdate`, populated via `:ref="(el) => setTickEl(el, i)"`.
   Same resulting array-by-index semantics as the Vue2 version, just the
   idiomatic Vue3 way to get there — no behavior change.

4. **`src/ai/components/stream/MessageList.vue`** (modified) — mounted
   `<TimelineMinimap :messages="messages" :active="activeIdx" @jump="jumpTo" />`
   at the `1b:` slot; removed the `void jumpTo` no-op (P1a placeholder) since
   `jumpTo` now has a real consumer. The busy "thinking" indicator markup
   (`:83-94` in the brief, unchanged lines) was not touched — verified it goes
   live via `AgentPage.vue:125` (`<MessageList :busy="store.busy" />`) and
   `agentStore.ts`'s `busy` ref, which flips `true`/`false` across
   `send`/`attach`/`setStreamingDone`/`stop`/`continueRun` (Task 6/7 work,
   already committed). No code change was needed for this — P1a's markup was
   already correct, just fed a store that was permanently `false`.

## i18n keys added (both zh_cn.ts and en_us.ts, parity test green)

Vue2's `ProcessStrip.vue`/`TimelineMinimap.vue` use raw-English `$t()` keys
(`'Working'`, `'{n} steps'`, `'You'`, …) resolved against Vue2's own
`src/assets/lang/zh_CN.json`. New-UI's i18n convention is `ai*`-prefixed keys
with parity enforced by `src/i18n/parity.test.ts`, so I translated these into
that scheme (values sourced from Vue2's `zh_CN.json` for wording fidelity):

| New-UI key | zh_cn | en_us | Vue2 source key |
|---|---|---|---|
| `aiProcWorking` | 处理中 | Working | `'Working'` |
| `aiProcProcessed` | 已处理 | Processed | `'Processed'` |
| `aiProcThinkingWord` | 思考 | thinking | `'thinking'` |
| `aiProcSteps` | {n} 步 | {n} steps | `'{n} steps'` |
| `aiProcReasoned` | 已推理 | Reasoned | `'Reasoned'` |
| `aiProcTool` | 工具 | Tool | `'Tool'` |
| `aiProcNoDetails` | 无详情 | No details | `'No details'` |
| `aiTimelineYou` | 你 | You | `'You'` |

(`aiProcThinkingWord` is deliberately distinct from the pre-existing
`aiThinking` key — that one means "thinking…" for the busy indicator dots,
this one is the short noun "thinking" used inside `headLabel`'s bit-joining.)

## Tokens / colors

**No new tokens added.** All CSS classes ProcessStrip/TimelineMinimap need
(`.proc`, `.proc-head`, `.proc-body`, `.step`, `.step-line`, `.step-ic`,
`.step-label`, `.step-meta`, `.step-chev`, `.step-detail`, `.tool-section`,
`.code-block`, `.timeline`, `.tl-tick`, `.tl-preview`, `.tlp-row`, `.tlp-tag`,
`.tlp-txt`) already exist in `src/ai/styles/agent-styles.scss` (ported in an
earlier task alongside the rest of the Agent stylesheet) and already reference
only `var(--…)` tokens defined in `tokens.scss` (e.g. `--tl-tick`,
`--tl-active: var(--accent)`, `--line`, `--bg-hover`, `--accent-soft`). Neither
new `.vue` file introduces a single raw hex/rgb literal.

## Color self-audit

```
grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" \
  ProcessStrip.vue TimelineMinimap.vue AssistantMessage.vue MessageList.vue \
  TimelineMinimap.test.ts AssistantMessage.test.ts zh_cn.ts en_us.ts
```
→ no matches. `git status --porcelain` confirms no other files touched.

## Tests

- New `TimelineMinimap.test.ts` (3 cases): one tick per message with correct
  `data-role`; click emits `jump` with the correct index; `active` index gets
  `data-active="true"`.
- Extended `AssistantMessage.test.ts` with a groupBlocks case: `thinking` +
  `tool` blocks followed by an `md` block renders exactly one `.proc`
  (ProcessStrip) and the `md` block still renders via `BlockRenderer`
  (`<strong>结果</strong>` present).
- Existing `MessageList.test.ts` (3 cases) and the pre-existing
  `AssistantMessage.test.ts` copy-failure case pass unchanged — no assertion
  updates were needed since a lone `md` block still passes through
  `groupBlocks` untouched (not grouped, since it's not `thinking`/`tool`).

```
pnpm test -- TimelineMinimap AssistantMessage MessageList   → 3 files / 8 tests pass
pnpm test (full suite)                                       → 233 files / 1465 tests pass
pnpm exec vue-tsc --noEmit                                   → no output, no errors
```

## Self-review

- **groupBlocks wiring correct**: `renderItems = computed(() => groupBlocks(props.msg.blocks ?? []))`
  matches the brief exactly; verified via the new grouping test that
  consecutive `thinking`+`tool` collapse into a single `ProcessStrip` while
  unrelated block types (md) pass through individually.
- **busy indicator live**: traced `AgentPage.vue:125` → `MessageList`'s `busy`
  prop → the unchanged P1a markup at the bottom of `MessageList.vue`'s
  template. `agentStore.busy` is a real `ref` flipped by `send`/`attach`/
  `setStreamingDone`/`stop`/`continueRun` (already-committed Task 6/7 work) —
  confirmed by reading `agentStore.ts`, not by re-deriving it. No changes were
  required to the indicator markup itself, per the brief.
- **formatMs path fixed**: P1a's local duplicate (with its own
  "this is a stand-in" comment) is gone; `AssistantMessage.vue` now imports the
  real `formatMs` from `services/streamMappers.ts` (Task 3), identical
  ms-formatting behavior (`<1000ms → "423ms"`, else `"4.5s"`).

## Concerns / judgment calls made (none blocking)

- **Type-guard addition for `__process` narrowing**: the brief's pseudocode
  used `item.__process` directly as the `v-if` condition. I added a 3-line
  local `isProcessGroup()` type-predicate function instead of using that
  directly, because `groupBlocks`' `AgentBlockLike` type has an index
  signature, and TS doesn't narrow a union through a bare index-signature
  property access — direct use would have needed an `as any`/`as ProcessGroup`
  cast at every access point instead. `vue-tsc --noEmit` confirms this compiles
  clean with zero casts anywhere in the template. Purely a typing-only change,
  same runtime dispatch.
- **`ProcessStrip`'s `steps` prop type** is `AgentBlockLike[]` (the loose
  `groupBlocks` type) rather than a `ProcessStep` interface with named optional
  fields, specifically so the call site needs zero casts. Field extraction
  inside `ProcessStrip.vue` uses small typed helper functions instead — this is
  the only place the "verbatim port" rule bent to satisfy TS strict mode; no
  Vue2 behavior changed.
- **`TimelineMinimap`'s array-ref pattern** (function ref + `onBeforeUpdate`
  reset) replaces Vue2's automatic `ref="tickEls"`-in-`v-for` array — this is
  the same mechanical Vue2→Vue3 template-ref conversion every port so far has
  needed for `v-for` refs; flagged here since the brief's pseudocode showed the
  Vue2 form.

## Files touched

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/blocks/ProcessStrip.vue` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/TimelineMinimap.vue` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/TimelineMinimap.test.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/AssistantMessage.vue` (modified)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/AssistantMessage.test.ts` (modified)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/MessageList.vue` (modified)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/zh_cn.ts` (modified — 8 new `aiProc*`/`aiTimelineYou` keys)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/en_us.ts` (modified — same 8 keys)

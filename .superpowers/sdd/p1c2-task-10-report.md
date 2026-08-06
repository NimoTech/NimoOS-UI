### Task 10 report: AgentRightPanel + ActivityTab + ContextTab

**Files**
- `src/ai/components/shell/AgentRightPanel.vue` + `.test.ts` (new)
- `src/ai/components/tabs/ActivityTab.vue` + `.test.ts` (new; `tabs/` dir did not exist yet, created)
- `src/ai/components/tabs/ContextTab.vue` + `.test.ts` (new)
- `src/ai/util/formatDuration.ts` + `.test.ts` (new — extracted pure function, see below)
- `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` (modified — 11 new keys, both files)

Not touched (as instructed): `src/ai/views/AgentPage.vue` (wiring is Task 13's job per its brief — Task 10's brief file list never mentions AgentPage.vue), `src/ai/styles/agent-styles.scss` (only read, not edited).

**AgentRightPanel — props/emits**
12 props (all optional with Vue2-matching defaults): `collapsed`, `tab` (`'activity'|'context'|'system'|'resources'`, default `'activity'`), `activitySteps: ActivityStep[]`, `systemMetrics: Record<string, unknown>`, `storage: Record<string, unknown> | null`, `busy`, `sessionId`, `visibleResources`, `attachments`, `stagedChanges: StagedGroup[]` (reused from `agentStore.ts`'s existing exported type), `committing`, `reverting: Record<string, boolean>`.
7 emits (Vue2 had none declared — added per brief): `set-tab`, `remove-resource`, `remove-attachment`, `revert-run`, `revert-batch`, `revert-item`, `commit-all`.
Dumb-component shape preserved: no store import, no `useProvidedAgentStore()` — everything is prop-in/event-out, matching Vue2's contract so Task 13 can wire it into `AgentPage.vue` exactly like `Agent.vue:44-64`.

**Double-collapse note**: only the `v-if="!collapsed"` half lives in this component (verified via test: `collapsed: true` → `aside.rightpanel` absent). The grid-column half (`data-rightcollapsed` on `AgentPage`'s root) already landed in Task 2 — this task doesn't touch `AgentPage.vue` at all, confirmed by `git status` showing it untouched.

**System/Resources stubbing**: both are separate later tasks (11 = SystemTab, 12 = ResourcesTab, per `progress.md`). The four-way `v-if/v-else-if/v-else` chain is wired with the real `ActivityTab`/`ContextTab` for the first two branches, and two empty `<div data-testid="system-tab-placeholder">` / `<div data-testid="resources-tab-placeholder">` for the last two — with comments naming exactly which task replaces them and what they'll be wired to (reusing this component's own `systemMetrics`/`storage` props for SystemTab, and the resources/staged-changes props+emits already declared here for ResourcesTab, so Task 11/12 don't need to touch this file's props/emits contract again). Resources is confirmed to be the `v-else` fallback: a test mounts with `tab: 'nonexistent-tab'` and asserts the resources placeholder renders (not system, not Activity/ContextTab).

**Badge defensiveness**: `pendingCount = computed(() => stagedChanges.reduce((n, g) => n + (g.items?.length ?? 0), 0))` — a group is allowed to have no `items` array (test covers a group object with `items` omitted entirely; sums to the same result as if it contributed 0).

**Extracted duration formatter**: `src/ai/util/formatDuration.ts`, `formatDuration(ms?: number | null): string | null`.
- `< 1000` → `` `${Math.max(1, Math.round(ms))}ms` `` (note: `ms === 0` is NOT the "falsy→Done" case — Vue2's guard is `!ms && ms !== 0`, so `0` correctly falls through to the numeric branch and renders `"1ms"`, tested explicitly).
- `>= 1000 && < 10000` → one-decimal seconds, e.g. `4500` → `"4.5s"`.
- `>= 10000` → rounded whole seconds, e.g. `15000` → `"15s"`.
- falsy and not `0` (`null`/`undefined`) → returns `null` (not the Vue2 literal `'Done'`) — this is a **deliberate deviation from a literal 1:1 port**, not a bug fix: Vue2's function hardcodes the English word `'Done'` directly in a "pure" helper. This phase's i18n policy requires that literal to become a translatable key (`aiActivityDone`), and a pure util function has no access to `useI18n()`/locale — embedding either the English or the Chinese word directly would violate the "both locales, both files, i18n key" contract. So the function returns a locale-free sentinel and `ActivityTab.vue`'s template does the mapping: `` {{ formatDuration(step.durationMs) ?? t('aiActivityDone') }} ``. Numeric outputs (`ms`/`s` suffixes) are intentionally left as un-i18n'd literals since the brief's i18n key list for this task does not include duration-unit keys — only the four tab labels, section headers, and activity states are in scope for i18n this phase.
Test cases (`formatDuration.test.ts`, 5 `describe`/`it` groups, 9 assertions total): `<1000` (500→"500ms", 999→"999ms"), the `0` edge case ("1ms", not Done), `[1000,10000)` (1000→"1.0s", 4500→"4.5s", 9499→"9.5s"), `>=10000` (15000→"15s", 59999→"60s" — rounding), and `null`/`undefined`→`null`.

**Token that replaced the raw colour**: `.badge-pending`'s `color: white` (Vue2 `AgentRightPanel.vue:76`) → `var(--text-on-accent)`. This CSS rule lives in `AgentRightPanel.vue`'s own `<style scoped>` block (ported from Vue2's own scoped style, not from `agent-styles.scss` — that shared file never owned `.badge-pending`), so it wasn't in scope to edit the shared scss file, and I didn't.

**i18n keys added** (both `zh_cn.ts` and `en_us.ts`, appended at end of file with a dated section comment): `aiTabActivity`/`aiTabContext`/`aiTabSystem`/`aiTabResources`, `aiActivityHeader` ("Agent Run" / "Agent 运行"), `aiActivityRunning`/`aiActivityWaiting`/`aiActivityEmpty`/`aiActivityDone`, `aiContextNotYet`/`aiContextDesc`. Chinese values for `aiActivityRunning`("运行中…")/`aiActivityWaiting`("等待")/`aiContextNotYet`("暂不可用")/`aiContextDesc` were reused verbatim from Vue2's shipped `src/assets/lang/zh_CN.json` (confirmed present there under the raw-English keys `"Running…"`, `"Waiting"`, `"Not available yet"`, and the long context sentence) per this repo's "reuse existing translation first" convention; the rest (`aiTabResources`="资源", `aiActivityHeader`="Agent 运行", `aiActivityDone`="完成") have no existing zh_CN.json entry (`"Resources"`/`"Agent Run"`/`"Done"` are absent — Vue2 would have silently rendered the raw English key as fallback) so these are newly authored, consistent in register with the rest of this key family. No `@` characters in any new value (messageSyntax guard not implicated).

**Test commands + tail**
```
pnpm test -- src/ai/ src/i18n/
  Test Files  41 passed (41)
       Tests  532 passed (532)

pnpm exec vue-tsc --noEmit
  (no output — 0 errors)

grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*(white|black)\b' <8 new/touched files>
  1 hit — inside a code comment describing the Vue2→token fix, not a live
  declaration (`AgentRightPanel.vue:111`, "Vue2:76 raw \`color: white\` → ...").
  No live literal in any new file.
```

**Noticed but left alone**: none new. The two placeholder divs for System/Resources are intentionally inert (no visible copy, no i18n needed) since Task 11/12 replace them wholesale in the same phase — adding throwaway strings for content nobody will ever see in the shipped UI seemed like unnecessary i18n-key churn.

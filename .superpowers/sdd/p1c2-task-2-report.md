# P1c2 Task 2 report — right-panel collapse state + topbar toggle

## State/actions added (`src/ai/stores/agentStore.ts`)

- `rightCollapsed` default changed `true` → `false` (agentStore.js:37). 1a wrote
  `true` because the right panel didn't exist yet; this phase starts wiring the
  shell, so the store aligns with Vue2's default (expanded).
- `rightTab: Ref<'activity'|'context'|'system'|'resources'>` initial `'activity'`
  (agentStore.js:38).
- `toggleRight()` — flips `rightCollapsed` (agentStore.js:157).
- `setRightTab(tab)` — sets `rightTab` (agentStore.js:158). Deliberately does
  **not** touch localStorage — Vue2 never persists tab selection (only theme
  and selectedModel are persisted); a test asserts this (`localStorage.length`
  stays 0 after `setRightTab`).
- All four added to the store's return object (factory pattern preserved).

## AgentTopbar.vue

- Added prop `rightCollapsed?: boolean` (default `false`, mirrors Vue2
  shell/AgentTopbar.vue:73) and emit `toggle-right`.
- Filled the `<!-- 1c: right-panel toggle -->` marker with the button, 1:1 from
  Vue2 shell/AgentTopbar.vue:43-45: `.icon-btn` + `AgentIcon name="panel"` +
  `:data-active="!rightCollapsed"` + `@click="emit('toggle-right')"`. No
  `title` attribute — Vue2 has none on this button either, so none was added.

## AgentPage.vue

- `:data-rightcollapsed="true"` → `:data-rightcollapsed="store.rightCollapsed"`.
- `AgentTopbar` now receives `:right-collapsed="store.rightCollapsed"` and
  `@toggle-right="store.toggleRight"` (Vue2 Agent.vue:20/24).
- Right panel component itself (`AgentRightPanel`) is still not mounted — only
  the container's collapse-state plumbing changed, per the phase scope note
  (Task 10+ mounts the panel).

## Pre-existing tests touched, and why

- `src/ai/stores/agentStore.test.ts` — the "初始态(新鲜 store)" test asserted
  `s.rightCollapsed === true`. That assertion was specifically pinning the 1a
  placeholder behaviour (comment above the old `ref(true)` said as much: "右侧
  面板... 要到 streaming 落地才有内容可看"). Per the brief's explicit
  instruction, updated the expectation to `false` and rewrote the comment to
  point at `agentStore.p1c2.test.ts` and explain the 1a→1c-2 default change.
- `src/ai/components/shell/AgentTopbar.test.ts` — the "1a 裁剪" test asserted
  the `1c: right-panel toggle` HTML marker was still present and that exactly
  3 `.icon-btn` elements existed. Since this task fills that marker with a
  real button, updated the test to assert the marker is now *absent* and the
  count is 4; added a new test for the toggle button's emit + `data-active`
  binding across a prop change.

No other pre-existing tests were touched.

## New test file

`src/ai/stores/agentStore.p1c2.test.ts` — copied the `vi.hoisted()` service-mock
+ `attachAgentStream`/`runAgentRun` mock + `setActivePinia(createPinia())`
pattern from `agentStore.p1c.test.ts`. 4 tests: default values, `setRightTab`
cycling through all four tabs, `toggleRight` flip/flip-back, and the
no-localStorage-write assertion for tab selection.

`src/ai/views/AgentPage.test.ts` — 2 new tests: default `data-rightcollapsed`
is `"false"`, and it flips to `"true"`/back to `"false"` when
`store.toggleRight()` is called (proving the topbar button and the grid
attribute share the same store action).

## Test commands run

```
pnpm test -- src/ai/stores/ src/ai/components/shell/AgentTopbar.test.ts src/ai/views/AgentPage.test.ts
```
Tail:
```
 Test Files  5 passed (5)
      Tests  94 passed (94)
```

```
pnpm exec vue-tsc --noEmit
```
Tail: (no output — 0 errors)

Did not run the full suite per instructions (a concurrent agent is working in
the sibling package).

## Noticed but left alone

- `AgentRightPanel` itself, `ModelPicker`, `ThinkingBar`, and the AI-rename
  button are all still `<!-- 1c: ... -->` placeholders in `AgentTopbar.vue` /
  `AgentPage.vue` — explicitly out of scope for this task (Task 10+).
- Vue2's `AgentTopbar` also takes `regeneratingTitleFor`, `availableModels`,
  `selectedModel`, `thinking` props and emits `select-model`/`thinking-*`/
  `regenerate-title` — none of that is wired yet in New-UI; out of scope here,
  will land with ModelPicker/ThinkingBar/AI-rename tasks.
- No i18n keys were needed for this task (no new user-visible text).

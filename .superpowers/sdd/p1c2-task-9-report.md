# P1c2 Task 9 report — ModelPicker + fallback notice + AI-rename button

## Pure module: `src/ai/util/modelPickerView.ts`

Ported the three pure computations out of Vue2 `shell/ModelPicker.vue`'s `computed`/`methods` so they're independently testable:

- `splitModels(list: AgentModel[]): { local: AgentModel[]; cloud: AgentModel[] }` — filters by `source`, order preserved (Vue2 :82-83).
- `cloudGroups(cloud: AgentModel[], query: string): CloudGroup[]` where `CloudGroup = { providerId, providerName?, models }` — query (trimmed, lowercased) filters **only** `displayName`, never `providerName` (Vue2 :84-100, confirmed by a dedicated test: a query matching a provider name but no display name returns `[]`); groups appear in first-occurrence-of-`providerId` order via an index map, exactly mirroring Vue2's `index[pid]` bookkeeping. Provider ids are coerced to `String()` only as the object-key lookup, the emitted `providerId` keeps its original type.
- `formatModelSize(bytes?: number): string` — `>=1GB` → `x.x GB`, else `x MB` (rounded), `0`/`undefined` → `''` (Vue2 :113-118).

Tests: `src/ai/util/modelPickerView.test.ts` (7 cases covering grouping order, displayName-only filtering, case/whitespace-insensitive query, both size tiers, and the falsy-size empty string).

## Composable: `src/ai/composables/useClickOutside.ts`

`useClickOutside(elRef: Ref<HTMLElement | null | undefined>, handler: () => void): void`. Lifecycle: `onMounted` attaches a `document` `mousedown` listener; the handler checks `!el.contains(event.target)`; `onUnmounted` removes it. This replaces Vue2's locally-registered `click-outside` directive (`bind`/`unbind` hooks — those hook names don't exist on Vue 3 directives at all, let alone as composable-shaped lifecycle). Verified with a tiny host component (`defineComponent` + `h()`) mounted via `@vue/test-utils`: outside `mousedown` fires the handler, inside `mousedown` doesn't, and after `unmount()` the handler no longer fires (2 tests, `useClickOutside.test.ts`).

## Component: `src/ai/components/shell/ModelPicker.vue`

Props: `availableModels?: AgentModel[]` (default `[]`), `selectedKey?: string | null` (default `null`). Emits: `select(key: string)`, `open-settings()`. Markup and CSS classes are a literal port of Vue2 `shell/ModelPicker.vue` (127 lines) — pill (`.model-pill` + `data-source` icon + `pillLabel`), dropdown (`v-if="open"`), local group (💻), cloud group (☁️, subgrouped by provider, 🧠 badge on `supports_thinking`), search box gated on `cloudModels.length > 6`, empty state (`aiModelEmptyText` + `aiGoToSettings` button).

Vue2-isms converted:
- `directives: { 'click-outside' }` → `useClickOutside(rootEl, closeDropdown)`.
- **The one real bug fix**: Vue2 :28-38 puts `:key="grp.providerId"` on the `<template v-for="grp in cloudGroups">`'s **child** (`.model-subgroup-label` div) instead of on the `<template>` itself. Vue 3 requires the key directly on the `<template>` tag when it's the `v-for` root — moved it there. Noted as the only structural change; the nested `v-for="mdl in grp.models"` still keys its own `<button>`s normally.
- Added explicit `defineEmits` (Vue2 didn't need to declare emits).
- Discovered `agent-styles.scss` is missing two rules that Vue2's `ModelPicker.vue` had in its own scoped `<style>` (`.model-search` width/margin/padding, `.model-subgroup-label` padding/opacity) — grepped `agent-styles.scss` and confirmed absence. Per the brief ("do not add new rules there"), I kept them local to `ModelPicker.vue`'s own scoped `<style>`, exactly matching Vue2's original component-local placement — not a new rule in the shared stylesheet, just the same two rules living where Vue2 also kept them.
- "Go to Settings" button emits `open-settings`; per the 2026-07-27 decision this does **not** deep-link — the consumer (AgentPage, via AgentTopbar) routes it to the existing `aiSettingsComingSoon` placeholder toast, same as the sidebar settings gear.

Tests: `ModelPicker.test.ts`, 8 cases — pill label (selected/not-selected/no-models), local+cloud group rendering, search box presence at 6 vs 7 cloud models, select emits+closes, outside-click closes+clears query, 🧠 badge only on `supports_thinking`, empty state button emits `open-settings`+closes.

## `AgentTopbar.vue` changes

Re-read the file first per the brief's warning (a sibling task had just landed the ThinkingBar second row) before touching anything.

- New props: `availableModels?: AgentModel[]`, `selectedModel?: string | null`, `regeneratingTitleFor?: { id: string | number; background: boolean } | null` (all with Vue2-aligned defaults).
- New emits: `select-model`, `open-settings`, `regenerate-title`.
- `<!-- 1c: ModelPicker -->` replaced with a real `<ModelPicker>` mount forwarding `available-models`/`selected-key` down and `select`/`open-settings` up (remapped to `select-model`/`open-settings`).
- `<!-- 1c: AI-rename button -->` replaced with the sparkle `icon-btn`.

**AI-rename disable matrix** (computed, Vue2 :93-100):
| condition | title input disabled | sparkle disabled |
|---|---|---|
| `regeneratingTitleFor = null` | no | no (unless `isFocused`) |
| `regeneratingTitleFor = { id: thisSession, background: true }` (auto title-on-first-turn) | no | **yes** |
| `regeneratingTitleFor = { id: thisSession, background: false }` (explicit sparkle click) | **yes** | **yes** |
| `regeneratingTitleFor = { id: otherSession, ... }` | no | no |
| title input focused (`isFocused`) | n/a | **yes** |

Also added the two missing CSS rules Vue2 had (`.topbar-title-input:disabled`, `.ai-rename-btn:disabled` — opacity/cursor only, no colours) — the current file had the disabled *attribute* wiring stubbed out but never carried these two rules over.

Existing tests using `buttons[N]` positional indices needed updating: inserting the AI-rename button (also `.icon-btn`) ahead of the theme toggle shifted indices by one (theme toggle test, right-panel-toggle test). The old "1a 裁剪" test asserting the two comment markers still existed was replaced with a positive assertion that they're gone and `ModelPicker`/`.ai-rename-btn` are mounted. Added 3 new tests: ModelPicker prop passthrough + event remap, AI-rename disable matrix across all four session/background combinations, and focus-disables-sparkle.

## `AgentPage.vue` changes

- `AgentTopbar` now receives `regenerating-title-for`, `available-models`, `selected-model` bound to the store fields, and wires `select-model` → `store.selectModel(key)` (inline arrow, matching the existing `send`/`stop` precedent — direct method references break `vi.spyOn` since Vue doesn't see through `Object.defineProperty` overrides), `open-settings` → the existing `onOpenSettings` (same placeholder toast as the sidebar), `regenerate-title` → new `onRegenerateTitle()`.
- `onRegenerateTitle()` — 1:1 port of Vue2 `Agent.vue:216-220`: `if (store.activeSessionId) store.regenerateTitle(store.activeSessionId)`. No-ops with no active session.
- **Fallback-notice watcher** (Vue2 `Agent.vue:133-142`): `watch(() => store.lastFallbackNotice, ...)` — on a truthy notice, calls `toast.show(t('aiModelFallback', { from, to: to || t('aiNoModelAvailable') }), 4000, 'warning')`, then **the watcher itself** sets `store.lastFallbackNotice = null`. Confirmed in `agentStore.ts` that the store never clears this field on its own (by design, per the brief) — clearing here means a second identical fallback later still re-fires the watcher instead of being swallowed by an unchanged-but-still-truthy value.

Tests added to `AgentPage.test.ts` (6 new): select-model wiring + prop passthrough, open-settings → same toast, regenerate-title with/without active session, regeneratingTitleFor passthrough, fallback-notice → warning toast + cleared to null, and the `to`-empty fallback text.

## i18n keys added (both `zh_cn.ts` and `en_us.ts`, `parity.test.ts` green)

`aiLocalOllama`, `aiCloudModels`, `aiSearchModelsPlaceholder`, `aiModelSelect`, `aiModelNotSelected`, `aiModelEmptyText`, `aiGoToSettings`, `aiModelFallback` (`{from}`/`{to}` params), `aiNoModelAvailable`, `aiRename`. English values are Vue2's exact literal strings, cross-checked against `NimoOS-UI/src/assets/lang/en_US.json` (Vue2 uses the raw English string as its i18n key, e.g. `"Local Ollama": "Local Ollama"`). Chinese values reused Vue2's existing `zh_CN.json` translations for the same keys (idiomatic, already battle-tested wording) rather than re-inventing them. No literal `@` appears in any of these strings, so no `{'@'}` escaping was needed.

Note: `aiNoModelsAvailable` (plural, pre-existing key) is a **different**, longer string used elsewhere (agent send-flow's "no model configured" block message) — not reused here; the ModelPicker's own empty-state text is the new, shorter `aiModelEmptyText` per Vue2's distinct `'No models available yet'` string.

## Test commands + output tails

```
$ pnpm test -- src/ai/ src/i18n/
 Test Files  37 passed (37)
      Tests  509 passed (509)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)

$ grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|:\s*(red|blue|...)" <new/changed files>
(no matches)
```

## Noticed but left alone

- `agentStore.ts`'s `regenerateTitle` swallows failures with only `console.warn` and always resolves (by design, documented in-file) — the sparkle button and auto-title-on-first-turn both rely on this fire-and-forget contract; not this task's concern, just confirming the AI-rename wiring doesn't need its own try/catch.
- The settings-area consumer of `ModelPicker` mentioned in the brief (Vue2's second usage site) doesn't exist yet in this app — props/emits API kept exactly as Vue2's shape so that future consumer can mount it unchanged, but nothing was built for it.

## Commit

`SP8-P1c2: ModelPicker + fallback notice + AI-rename button`

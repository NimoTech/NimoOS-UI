### Task 8: Block renderers batch A — full BLOCK_MAP + trivial/light (incl. confirm cards)

**Files:**
- Modify: `src/ai/components/blocks/BlockRenderer.vue` (restore full BLOCK_MAP at `:23`)
- Create (17): `ActionsRow.vue`, `McpWarningCard.vue`, `StorageCard.vue`, `SearchResultsCard.vue`, `ProgressCard.vue`, `VideoCard.vue`, `FileListCard.vue`, `ThinkingBlock.vue`, `MaxTurnsCard.vue`, `ImageGridCard.vue`, `ToolCard.vue`, `ConfirmCard.vue`, `PermissionRequestCard.vue`, `McpCallCard.vue`, `McpPermissionCard.vue`, `McpInstallCard.vue`, `PhotoGridCard.vue` — all under `src/ai/components/blocks/`
- Create: `src/ai/components/blocks/BlockRenderer.batchA.test.ts` (smoke)

**Interfaces:**
- Consumes: Task 4 seam (`useProvidedAgentStore`), Task 3 mappers (none needed at render), existing `MarkdownBlock.vue`, `KindIcon.vue`, `AgentIcon.vue`, `useToast`.
- Produces: `BLOCK_MAP` covering all 20 dispatched types (batch B adds `terminal`, `semantic_search`).

**Mechanical conversions (apply to EVERY ported renderer):**
- Options API → `<script setup>` (props via `defineProps`, `data` → `ref`/`reactive`, computed → `computed`, methods → functions).
- `inject: { agentStore … }` / `inject: ['agentStore']` → `const store = useProvidedAgentStore()`; `agentStore.actions.X()` → `store.X()`. (Confirm cards call `store.confirmAgentAction(...)`; MaxTurnsCard calls `store.continueRun()`.)
- `this.$set(obj, k, v)` → `obj[k] = v`. `this.$t(...)` → `const { t } = useI18n()` / template `$t`.
- `$buefy.toast` → `useToast().show(...)`.
- Color literals → Agent theme tokens (Global Constraints). `v-bind="block"` prop-spread stays valid; ensure every block field the renderer reads is a declared prop (Vue3 puts undeclared attrs on root — declare them to avoid leak).

- [ ] **Step 1: Restore full `BLOCK_MAP`** in `BlockRenderer.vue` (replace the `:23` slot) with all 20 entries per the Vue2 table (`thinking,tool,md,confirm,access_request,max_turns,imggrid,video,filelist,search,progress,storage,actions,terminal,semantic_search,photo_grid,mcp_confirm,mcp_call,mcp_warning,mcp_install`). `terminal`/`semantic_search` components come in batch B — import them (files created in Task 9); to keep this task green, create Task 9's two files as empty stubs first OR order Task 9 before wiring those two map entries. **Chosen: add all 20 map entries now; create `TerminalCard.vue`/`SemanticSearchCard.vue` as minimal valid stubs in this task (Step 2), Task 9 fills them.**

- [ ] **Step 2: Create minimal valid stubs** for `TerminalCard.vue` + `SemanticSearchCard.vue` (`<script setup>` with `defineProps<{...}>()` + a placeholder chip) so BLOCK_MAP imports resolve and tsc is green. Task 9 replaces the bodies.

- [ ] **Step 3: Port the 17 trivial/light renderers** (files above) applying the mechanical conversions. Reference Vue2 props/complexity from the block inventory (e.g. `ConfirmCard` props `confirmId,action,description,command` + `resolve(confirmed)`→`store.confirmAgentAction(confirmId,confirmed)` with 409/error handling; `MaxTurnsCard` `onContinue`→`store.continueRun()`; `PhotoGridCard` embeds `SearchImageLightbox` from Task 9 — stub-import ok, or gate lightbox behind batch B). For `PhotoGridCard`'s lightbox dependency, import `SearchImageLightbox` (Task 9 creates it; add a stub in Task 9 Step-order or here). Keep each renderer's scoped styles, converting colors to tokens.

- [ ] **Step 4: Write smoke tests** — mount each renderer with representative props, assert it renders without error and shows the key content (e.g. `ConfirmCard` shows the description + two buttons; clicking Approve calls a mocked `store.confirmAgentAction`). One `it` per renderer.

- [ ] **Step 5: Run** — `pnpm test -- BlockRenderer.batchA` → PASS; `pnpm exec vue-tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/ai/components/blocks/
git commit -m "SP8-P1b: block renderers batch A (full BLOCK_MAP + trivial/light + confirm cards)"
```

---


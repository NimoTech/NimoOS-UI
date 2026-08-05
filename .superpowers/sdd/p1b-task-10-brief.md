### Task 10: ProcessStrip + AssistantMessage wiring + TimelineMinimap + busy indicator

**Files:**
- Create: `src/ai/components/blocks/ProcessStrip.vue`
- Create: `src/ai/components/stream/TimelineMinimap.vue` + `TimelineMinimap.test.ts`
- Modify: `src/ai/components/stream/AssistantMessage.vue` (wire groupBlocks→ProcessStrip/BlockRenderer)
- Modify: `src/ai/components/stream/MessageList.vue` (mount TimelineMinimap; busy indicator already present)

**Interfaces:**
- Consumes: Task 2 `groupBlocks`/`timelineMath`, Task 8/9 renderers.
- Produces: assistant turns render process strips + individual blocks; minimap jumps.

- [ ] **Step 1: Port `ProcessStrip.vue`** (Vue2 82 lines): props `steps,streaming`; `data{open,expanded}`; `this.$set(this.expanded,i,…)`→`expanded[i]=…`; `thinkCount`/`toolCount`/`headLabel` (i18n), `toggle`/`kindOf`/`iconOf`/`labelOf`/`metaOf`; uses `AgentIcon`. Colors→tokens.

- [ ] **Step 2: Wire `AssistantMessage.vue`** (replace the `:85` slot): `const renderItems = computed(() => groupBlocks(props.msg.blocks ?? []))`; template iterates → `<ProcessStrip v-if="item.__process" :steps="item.steps" :streaming="!!msg.streaming" />` else `<BlockRenderer :block="item" />`. Keep the P1a stats footer (`formatMs` already imported from streamMappers — update the import path to `../../services/streamMappers`). `copy` uses `copyText` (P1a already uses the insecure-context fallback per newui-clipboard).

- [ ] **Step 3: Port `TimelineMinimap.vue`** (Vue2 74 lines): props `messages,active`; `data{cy}`; computed `ticks=ticksFromMessages(messages)`, `nearest`, `preview`; `widthFor(i)`→`tickWidth`; emits `jump`. Colors→tokens.

- [ ] **Step 4: Mount minimap in `MessageList.vue`** (the `:72` slot): `<TimelineMinimap :messages="messages" :active="activeIdx" @jump="jumpTo" />`. `jumpTo` already implemented at `MessageList.vue:43` (remove the `void jumpTo` no-op). Confirm the busy `thinking` indicator (`:83-94`) now activates (busy flips via streaming).

- [ ] **Step 5: Write `TimelineMinimap.test.ts`** — mount with 4 messages, assert one tick per message with correct `data-role`, click a tick emits `jump` with the index.

- [ ] **Step 6: Run** — `pnpm test -- TimelineMinimap` → PASS; `pnpm test -- MessageList AssistantMessage` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ai/components/blocks/ProcessStrip.vue src/ai/components/stream/
git commit -m "SP8-P1b: ProcessStrip + AssistantMessage groupBlocks wiring + TimelineMinimap"
```

---


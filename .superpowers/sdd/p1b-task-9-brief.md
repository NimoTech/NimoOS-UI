### Task 9: Block renderers batch B — heavy (Terminal, SemanticSearch + search aux)

**Files:**
- Replace stubs: `src/ai/components/blocks/TerminalCard.vue`, `SemanticSearchCard.vue`
- Create: `src/ai/components/blocks/SearchImageLightbox.vue`, `SearchFileDrawer.vue`, `SearchFullResults.vue`
- Create: `src/ai/components/blocks/BlockRenderer.batchB.test.ts`

**Interfaces:**
- Consumes: Task 3 `searchMapper` output shape (SemanticSearchCard props), `service.photos`/`service.ai` for thumbnails as in Vue2 (image original→thumbnail fallback), Task 4 seam if needed.
- Produces: `terminal` + `semantic_search` renderers fully functional; `PhotoGridCard`'s lightbox dependency (`SearchImageLightbox`) satisfied.

- [ ] **Step 1: Port `SearchImageLightbox.vue`** (Vue2 216 lines) — mechanical conversions; `beforeDestroy`→`onBeforeUnmount` for keydown listener removal; large-src original→thumbnail fallback (`triedThumb`).

- [ ] **Step 2: Port `SearchFileDrawer.vue`** (295) and `SearchFullResults.vue` (686) — mechanical conversions; `escapeHtml`/`highlightText` stay; color maps → tokens.

- [ ] **Step 3: Port `TerminalCard.vue`** (185) — props `command,cwd,shell,sandbox,state,exitCode,durationMs,lines,streamingLine,approval,defaultOpen`; `STATE_BADGE`, `durationLabel`, `cmdTokens`; approval flow. Colors → tokens.

- [ ] **Step 4: Port `SemanticSearchCard.vue`** (926 — heaviest) — tabbed (all/image/file/semantic), composes the three aux components; `data`→refs. Colors → tokens.

- [ ] **Step 5: Write smoke tests** — mount `TerminalCard` (running + success + error states render), `SemanticSearchCard` (with a `buildSemanticSearchBlock` fixture, tabs switch, lightbox opens), `SearchImageLightbox` (nav keys). 

- [ ] **Step 6: Run** — `pnpm test -- BlockRenderer.batchB` → PASS; `pnpm exec vue-tsc --noEmit` → clean; full `pnpm test` → no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/ai/components/blocks/
git commit -m "SP8-P1b: block renderers batch B (Terminal + SemanticSearch + search aux)"
```

---


### Task 3: Stream mappers — `searchMapper.ts` + `streamMappers.ts`

**Files:**
- Create: `src/ai/types.ts` (the shared contracts block above — verbatim; created here since the mappers are the earliest consumer, Task 4 imports it)
- Create: `src/ai/services/searchMapper.ts` (port `@/service/searchMapper.js`)
- Create: `src/ai/services/streamMappers.ts` + `src/ai/services/streamMappers.test.ts`

**Interfaces:**
- Produces: `src/ai/types.ts` exports (`AgentBlock`/`AgentStats`/`AttachmentRef`/`AgentMessage`/`StreamActions`) consumed by Tasks 4/5/6/7.
- Produces (all consumed by Task 5 reducer + Task 7 `migrateLegacyMessages`):
  - `buildSemanticSearchBlock(parsed: unknown, query: string): AgentBlock | null` (from searchMapper)
  - `buildPhotoGridBlock(parsed: unknown, query: string): AgentBlock | null`
  - `parseMcpToolName(tool: string): { server: string; tool: string } | null`
  - `parseShellResult(content: string): Partial<AgentBlock>` (→ `{state,exitCode,lines,…}`)
  - `MCP_ERR_RE: RegExp`
  - `stripLeakedToolArgs(actions: StreamActions, args: unknown): void`
  - `formatMs(ms: number | null | undefined): string`
  - `migrateLegacyMessages(messages: AgentMessage[]): AgentMessage[]`, `expandHistoryBlock(b: AgentBlock): AgentBlock[]`, `migrateLegacyBlock(b: AgentBlock): AgentBlock`, `mcpCallFromToolBlock`, `photoGridFromToolBlock`, `semanticSearchFromToolBlock`, `toLines`

- [ ] **Step 0: Create `src/ai/types.ts`** with the shared contracts block (`AgentBlock`/`AgentStats`/`AttachmentRef`/`AgentMessage`/`StreamActions`) verbatim from the plan's "Shared type contracts" section. This module has no imports.

- [ ] **Step 1: Port `searchMapper.js` → `searchMapper.ts`** verbatim (typed). It exports `buildSemanticSearchBlock`. Preserve its output block shape exactly (SemanticSearchCard props depend on it: `query,terms,model,scope,corpus,durationMs,total,fileindexStatus,images,files,passages,warnings`).

- [ ] **Step 2: Write `streamMappers.test.ts`** porting the mapper-relevant assertions from `agentStream.spec.js` (the `migrateLegacyMessages`/`expandHistoryBlock`/`parseShellResult`/`parseMcpToolName` cases). Include at minimum:
  - `parseMcpToolName('mcp__server__tool')` → `{server:'server',tool:'tool'}`; non-mcp → `null`.
  - `migrateLegacyMessages` on a message with a legacy `run_command` tool block → block converted to `type:'terminal'` with `command`/`cwd:'/work'`/`shell:'bash'`.
  - `expandHistoryBlock` on a `nimoos_search` tool block → `[originalTool, {type:'semantic_search',…}]`.
  - `parseShellResult` on a sample result string → expected `{state,exitCode,lines}`.
  Copy the exact fixtures from `agentStream.spec.js` where present.

- [ ] **Step 3: Run, verify fail** — `pnpm test -- streamMappers` → FAIL.

- [ ] **Step 4: Port the mapper family `streamMappers.ts`** verbatim from `agentStream.js`: `stripLeakedToolArgs` (72-89), `migrateLegacyMessages` (91-98), `mcpCallFromToolBlock` (105-120), `expandHistoryBlock` (122-136), `photoGridFromToolBlock` (138-151), `buildPhotoGridBlock` (156-169), `semanticSearchFromToolBlock` (171-184), `migrateLegacyBlock` (188-211), `parseMcpToolName` (215-221), `MCP_ERR_RE` (225), `parseShellResult` (230-248), `toLines` (250-255), `formatMs` (654-658). Import `buildSemanticSearchBlock` from `./searchMapper`. Convert `Date.now()` usage stays (runtime, fine). Typed with `AgentBlock`/`StreamActions`.

- [ ] **Step 5: Run, verify pass** — `pnpm test -- streamMappers` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ai/services/searchMapper.ts src/ai/services/streamMappers.ts src/ai/services/streamMappers.test.ts
git commit -m "SP8-P1b: port stream mappers (searchMapper + migrate/parse family)"
```

---


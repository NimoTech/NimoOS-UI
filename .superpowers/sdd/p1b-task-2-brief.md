### Task 2: Pure util — `groupBlocks.ts` + `timelineMath.ts`

**Files:**
- Create: `src/ai/util/groupBlocks.ts` + `src/ai/util/groupBlocks.test.ts`
- Create: `src/ai/util/timelineMath.ts` + `src/ai/util/timelineMath.test.ts`
- Reference (already present, confirm no change needed): `src/ai/util/userMessageView.ts`

**Interfaces:**
- Produces:
  - `groupBlocks(blocks: AgentBlock[]): (AgentBlock | { __process: true; steps: AgentBlock[] })[]` — collapses **consecutive** `thinking`/`tool` blocks into one `{__process,steps}` group; all else passes through in order; non-array → `[]`. (Consumed by Task 10 AssistantMessage.)
  - `tickWidth(distancePx: number | null, opts?): number`, `clip(str: string, n?: number): string`, `ticksFromMessages(messages: AgentMessage[]): { role:'user'|'ai'; id: unknown; text: string }[]`. (Consumed by Task 10 TimelineMinimap.)

- [ ] **Step 1: Port `groupBlocks.spec.js` → `groupBlocks.test.ts`.** Copy the Vue2 spec at `stream/groupBlocks.spec.js` verbatim; convert to TS import (`import { groupBlocks } from './groupBlocks'`). Keep every assertion.

- [ ] **Step 2: Run, verify fail** — `pnpm test -- groupBlocks` → FAIL (module missing).

- [ ] **Step 3: Port `groupBlocks.js` → `groupBlocks.ts`** verbatim (`stream/groupBlocks.js:1-22`), typed with `AgentBlock`. Logic unchanged: `STEP_TYPES = new Set(['thinking','tool'])`; iterate, group consecutive step-types under `{__process:true,steps:[]}`, reset on non-step, non-array → `[]`.

- [ ] **Step 4: Run, verify pass** — `pnpm test -- groupBlocks` → PASS.

- [ ] **Step 5: Port `timelineMath.spec.js` → `timelineMath.test.ts`** verbatim (TS import).

- [ ] **Step 6: Run, verify fail** — `pnpm test -- timelineMath` → FAIL.

- [ ] **Step 7: Port `timelineMath.js` → `timelineMath.ts`** verbatim (`stream/timelineMath.js:1-35`): `DEFAULTS={base:14,amp:36,spread:22}`, `tickWidth`, `clip`, `ticksFromMessages`, private `textOf`. Typed.

- [ ] **Step 8: Run, verify pass** — `pnpm test -- timelineMath` → PASS.

- [ ] **Step 9: Confirm `userMessageView.ts` unchanged** (P1a already has it + `userMessageView.test.ts`). Run `pnpm test -- userMessageView` → PASS. No edit.

- [ ] **Step 10: Commit**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
git add src/ai/util/groupBlocks.ts src/ai/util/groupBlocks.test.ts src/ai/util/timelineMath.ts src/ai/util/timelineMath.test.ts
git commit -m "SP8-P1b: port groupBlocks + timelineMath pure modules"
```

---


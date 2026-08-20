### Task 4: Point `openInApp` at New-UI (closes A-8)

**Files:**
- Modify: `src/ai/services/openInApp.ts:112-131`
- Test: `src/ai/services/openInApp.test.ts:195-238`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime — but it is only correct **after** Tasks 1-3, because it depends on New-UI's `/ai/agent` actually honouring `?session=`.
- Produces: `agentSessionUrl(sessionId) -> '/app/#/ai/agent?session=<encoded>'`, consumed by `openAgentSessionInNewTab` and, through the module, by `src/ai/knowledge/components/NoteEditPane.vue:480` (whose test mocks this module, so it needs no change).

- [ ] **Step 1: Flip the test's four assertions**

In `src/ai/services/openInApp.test.ts`, rewrite the block comment above `describe('agentSessionUrl / openAgentSessionInNewTab')` and the four URL assertions so both directions point the other way:

```ts
// SP8-P5d Task 5 / A-8 closed 2026-08-19: New-UI's /ai/agent now honours ?session=
// (see docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md), so these two
// functions land inside New-UI at /app.
// 🔴 Forward assertion: URL verbatim + reverse assertion "does not equal the root-mounted
// old Vue2 URL" — the reverse assertion is what discriminates: if someone reverts the landing
// point to /#/ai/agent, users leave New-UI on every "open source conversation" click, which
// the forward assertion alone could miss by string coincidence.
describe('agentSessionUrl / openAgentSessionInNewTab', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('builds a URL pointing at New-UI (mounted at /app)', () => {
    expect(agentSessionUrl('sess 1')).toBe('/app/#/ai/agent?session=sess%201')
  })
  it('does NOT point at the root-mounted old Vue2 app (reverse assertion, guards against a silent regression)', () => {
    expect(agentSessionUrl('sess 1')).not.toBe('/#/ai/agent?session=sess%201')
  })
  it('encodes special characters in the session id', () => {
    expect(agentSessionUrl('a&b c')).toBe('/app/#/ai/agent?session=a%26b%20c')
  })

  it('opens the agent session url in a new tab', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('sess-1')
    expect(spy).toHaveBeenCalledWith('/app/#/ai/agent?session=sess-1', '_blank')
  })
  it('the opened url is NOT the root-mounted old Vue2 route (reverse assertion)', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    openAgentSessionInNewTab('sess-1')
    expect(spy.mock.calls[0][0]).not.toBe('/#/ai/agent?session=sess-1')
  })
```

Leave the two "does nothing when the session id is empty / null" tests exactly as they are.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/ai/services/openInApp.test.ts`
Expected: 3 failures (the two forward assertions and the `window.open` argument); the reverse assertions now pass for the wrong reason and will be locked in by Step 3.

- [ ] **Step 3: Flip the implementation and rewrite its comment**

In `src/ai/services/openInApp.ts`, replace the comment block at `:112-122` and the function:

```ts
// 1:1 port from Vue2 openInApp.js:117-124 (`agentSessionUrl` / `openAgentSessionInNewTab`).
// Originally these deliberately landed on the root-mounted old Vue2 app because New-UI's
// /ai/agent read no `?session=` at all, so an /app-prefixed link would have opened the Agent
// page without selecting the session (a silent failure). Ticket A-8 closed that gap on
// 2026-08-19 — AgentPage now mirrors, reads and follows `?session=`
// (docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md) — so the landing point
// is New-UI's own route, and openInApp.test.ts's reverse assertions now guard against a
// regression back to the old app.
export function agentSessionUrl(sessionId: string | number): string {
  return '/app/#/ai/agent?session=' + encodeURIComponent(String(sessionId))
}
```

Leave `openAgentSessionInNewTab` unchanged — it delegates.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/ai/services/openInApp.test.ts src/ai/knowledge/components/NoteEditPane.test.ts`
Expected: PASS both — `NoteEditPane.test.ts` mocks the module, so it is only checked for collateral damage.

- [ ] **Step 5: Commit**

```bash
git add src/ai/services/openInApp.ts src/ai/services/openInApp.test.ts
git commit -s -m "feat(ai): land \"open source conversation\" inside New-UI, closing A-8

New-UI's /ai/agent now honours ?session=, so the note editor's session refs no
longer have to borrow the old Vue2 app's route. Both reverse assertions are
inverted to guard the new direction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


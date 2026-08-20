# Final whole-branch review — fix wave (one dispatch, one re-review)

Head at review time: `f8399267`. Base: `4fe81f86`. Spec:
`docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md`.

Seven items. Two are Important and change behaviour; five are cheap honesty
fixes on comments, one dropped test, and test hygiene. Everything else the
review raised is either already ruled acceptable-as-deferred or a note with no
action (see the bottom of this file).

Both Important items live in the same `onMounted` block in
`src/ai/views/AgentPage.vue` and interact, so read all of item 1 and item 2
before editing either.

---

## Important 1 — re-entering the page with a session already active writes no `?session=`

`src/ai/views/AgentPage.vue:304-318`

The spec's Background argues that `loadSessions()` never auto-selects, so
`activeSessionId` is `null` at mount and the URL stays clean until the user
picks a session. That holds on a cold load only. `agentStore` is an app-scoped
Pinia store (`defineStore`, `activeSessionId` at `src/ai/stores/agentStore.ts:140`),
nothing resets it in `onUnmounted` (`AgentPage.vue:397-399`), and there is no
`KeepAlive`. So on any in-app re-navigation the store still holds the session
while the URL does not:

- session X open → sidebar gear (`AgentPage.vue:126`, `router.push('/ai/settings')`)
  → back to `/ai/agent`: the mount seed reads an empty query, the deep-link
  block is skipped because `wantedSession` is empty, and the `activeSessionId`
  watcher never fires because nothing changed. Address bar shows
  `/app/#/ai/agent` while session X is open, and a refresh loses the session —
  the exact failure A-8 exists to fix.
- Same path via `AgentTopbar.vue:193` (`router.push('/')`) and back, and via
  `SkillDetail.vue:295` (`push('/ai/agent?skill=…')`), where the skill strip's
  `writeQuery()` actively rewrites the URL to a session-less one.

It self-heals on the next session switch, so this is a gap rather than a
regression — but "the address bar is always a shareable deep link" is not
delivered, and that sentence is the feature.

**Fix:** give the deep-link block an `else` branch that mirrors whatever the
store already holds — `else syncSessionQuery(store.activeSessionId)`. When
`activeSessionId` is `null` this is a no-op by the equality guard, so the
pinned replace-count tests (`AgentPage.test.ts` "no one-shot query params" →
zero replaces, `?skill=abc` → 1, `?skill=abc&search=cats` → 2) all still hold:
each of them mounts with `activeSessionId === null`. In the
`?search=`-with-active-session case it costs one extra replace before the
strip's, which is correct — the URL should name the session that is open.

**Test:** mount with an empty query and `store.activeSessionId` already set
(the store is created before `mountPage()` in this file's convention), then
assert `replace` was called with `{ path: '/ai/agent', query: { session: '…' } }`.
Confirm by mutation that removing the `else` branch fails it.

---

## Important 2 — a failed `loadSessions()` misreports a valid deep link and destroys the parameter

`src/ai/views/AgentPage.vue:296-318`

`loadSessions()` (`agentStore.ts:190-193`) awaits `service.ai.listAgentSessions()`
unguarded, and `onMounted` swallows its rejection at `:298`. After a transient
network failure `store.sessions` is `[]`, so a perfectly valid `?session=` misses
the lookup at `:306`, the user is told the session "may have been deleted", and
`syncSessionQuery` strips the id from the URL at `:316`. The user's natural
recovery — refresh — no longer has the id to retry with. The comment at `:301`
("now that the list exists") states exactly the assumption that just failed.

**Fix:** record whether the list actually loaded (`let sessionsLoaded = true`,
set to `false` in that existing catch) and only take the warn-and-strip branch
when it did. When the load failed, leave the parameter alone — no toast, no
strip — so a refresh can retry. Keep the found-branch behaviour unchanged.

**Test:** `svc.listAgentSessions.mockRejectedValue(new Error('offline'))` with
`routeQuery.session = 's1'`: assert no toast, no `replace`, and that
`routeQuery.session` / the URL still names `s1`. Distinguish it from the
existing unknown-session test, which must keep warning and stripping.

---

## Minor 3 — spec Testing item 7 was never implemented, and the plan dropped it silently

Spec Testing item 7: `?skill=abc&session=s1` → skill stripped, session
preserved throughout. No plan step covers it and no such test exists. The
review traced the behaviour and it is correct, and `AgentPage.test.ts:764`
covers the same "a strip write preserves session" property via `?search=`, so
this is a coverage gap, not a defect. Add the test (four lines in the style of
the neighbouring skill tests) rather than recording the drop — it is cheaper
than the note explaining its absence.

## Minor 4 — the route watcher's `selectSession` is unhandled on rejection

`src/ai/views/AgentPage.vue:264`

`selectSession` can reject (`agentStore.ts:291`, `listAgentMessages` unguarded)
and this repo has no `unhandledrejection` handler or `app.config.errorHandler`.
The mount-time read wraps the identical call in try/catch (`:308-313`); the
watcher does not. `AgentSidebar`'s `@select="store.selectSession"` floats the
same way, so this matches existing practice, but the asymmetry inside one file
is worth closing: add `.catch(() => {})` with a one-line comment saying the
switch already happened and a failed message fetch must not surface as an
unhandled rejection.

## Minor 5 — the spec misdescribes the base when justifying the replace-swallow

Spec, Error handling: "`router.replace` rejection: `writeQuery()` swallows it …
as the existing strips do." The base did **not** swallow — `git show
4fe81f86:src/ai/views/AgentPage.vue` shows `await router.replace(...)` with no
`.catch`, so a rejected redundant navigation would have rejected `onMounted`
and skipped both model loading and the seed send. The swallow is therefore an
improvement, not a continuation. Fix the spec sentence, and add the clause to
`writeQuery`'s comment so the next reader sees what it buys.

## Minor 6 — `openInApp.ts` header and comment no longer match the code

`src/ai/services/openInApp.ts:112` still opens "1:1 port from Vue2
openInApp.js:117-124" while the URL now deliberately differs. The sentences
after it explain the divergence, so nothing is false in aggregate, but the
first line reads as an unqualified claim about code that is no longer
byte-identical — qualify it. Separately, the file-header landing-point
inventory (`:1-10`) lists Files → New-UI and Photos → old Vue2 and never
mentions Agent; add the Agent row now that it lands in New-UI.

## Minor 7 — `writeQuery`'s comment overclaims

`src/ai/views/AgentPage.vue` — the comment says "One ref, no stale reads",
which is true only for the keys the ref tracks. The route watcher re-syncs
`session` and nothing else, so any other query key added by external navigation
while the page stays mounted would be dropped by the next session switch. The
spec puts that out of scope and no in-app path triggers it today. Narrow the
claim to `session` rather than widening the implementation.

## Minor 8 — the new tests never unmount, and the reactive route mock gives leaked components teeth

`src/ai/views/AgentPage.test.ts:37` plus the 12 new tests, none of which call
`w.unmount()`. A component left mounted by an earlier test keeps its
`route.query.session` watcher alive, so a later test assigning
`routeQuery.session` can make a stale component reach the shared module-level
`replace` mock that several tests assert exact call counts on. Harmless today
(the review walked the order), but before this branch the mock was inert, so
the order-dependency is new. Add `w.unmount()` to the new tests — 52 mounts vs
25 unmounts is the file's pre-existing style, so fix what this branch added and
leave the rest.

---

## Not in scope for this wave

- **Array-valued `session`** and the **duplicated session lookup**: the review
  triaged both as acceptable-as-deferred. Do not change them.
- **Nit (review item 9):** `?session=s1&search=cats` selects s1 — a full
  message/stream/resources round trip — and then abandons it for
  `createSession()`. Spec test 6 pins the outcome as intended; leave it.
- **The codebase disagreeing with itself about whether the Vue2 app still
  exists** (`src/ai/composables/useOpenAction.ts:57` says retired 08-07 while
  `:86`/`:96` still fall back to it, and `photosAssetUrl` would be dead by the
  same argument): real, out of scope, someone else's ticket.

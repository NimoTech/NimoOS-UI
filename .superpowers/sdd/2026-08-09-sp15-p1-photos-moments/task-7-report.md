# Task 7 report — moment detail page and its route

Branch `sp15-photos-moments`, worktree `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp15-photos-moments`.

Two commits:

- `7ce2928` — `feat(photos): add the moment detail page as a route` (the brief's message, verbatim)
- `7069012` — `chore(oss): extend the export manifest for the moment detail route`

---

## 1. What was implemented

**`src/views/PhotosMomentDetail.vue`** (new) — the route page at `/photos/moments/:id`.

Three gates in the main column, the same shape `PhotosSmartViewDetail.vue` uses:

1. `v-if="!store.listLoaded"` → a small skeleton (`data-test="mo-skeleton"`);
2. `v-else-if="notFound"` → the explicit not-found state (`data-test="mo-not-found"`) plus a
   back button (`mo-not-found-back`);
3. `v-else-if="moment"` → the real content.

Content ported from Vue 2 `899af59b:PhotosMomentDetail.vue`:

- Top bar (`:3-9`) — back button (`mo-back`) → `router.push('/photos/smart-views')`, and the
  last-updated line (`mo-last-updated`).
- Header (`:12-30`) — title, amber type pill + place chip, subtitle / photo count /
  "+N this week" badge (`.mo-week-badge`, absent when `addedThisWeek === 0`).
- Right rail — About (Type / Time / Place, `mo-about-time`, `mo-about-place` with the
  `placesTitle` hover hint), Stats (`mo-stat-photos`, `mo-stat-featured`, `mo-stat-span`,
  `mo-stat-lastupdate`), and By month (`mo-dist`, bars `mo-dist-bar` with
  `:title="b.label + ' · ' + b.count"`), the whole By-month section dropped when no asset
  carries a `takenAt`.

Computed ported one by one from Vue 2 `:203-291` and `distStyle` from `:418-421`:
`momentAssetCount`, `typeLabel`, `timeWindowLabel`, `spanDays`, `spanLabel`, `monthBuckets`,
`distMax`, `distStyle`, `placesLabel`, `placesTitle`.

Loading uses the T3 store: `ensureLoaded()` then `byId()` (cold deep link), then
`loadDetail()` + `loadAll()` in parallel, all behind the `loadEpoch` staleness guard. The
state Tasks 8/9/10 need — `featuredAssets`, `allAssets`, `allLoading`, `manualIds`, `places` —
is populated here.

**`src/router/index.ts`** — appended `{ path: '/photos/moments/:id', name: 'photos-moment-detail', … }`
between `/photos/smart-views/:id` and `/photos/search`, plus its import. Nothing reordered.

**`src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`** — the 14 keys from the brief's table,
strings verbatim. `*.base.ts` untouched.

**`src/views/__tests__/photosLayoutHeightCap.test.ts`** — registered `PhotosMomentDetail.vue`
in `CAPPED`. Not optional: that guard scans `src/views` for any `.vue` containing
`.photos-layout {` and fails on any page not in `CAPPED ∪ EXEMPT`. The page is genuinely capped
(`height: 100%`) because `.sv-detail-main` / `.sv-detail-side` are each their own scroll
container, same as the sibling page.

**`oss/manifest.mjs`** — see §6.

---

## 2. TDD evidence

### RED

```
$ pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose

 FAIL  src/views/PhotosMomentDetail.test.ts [ src/views/PhotosMomentDetail.test.ts ]
Error: Failed to resolve import "./PhotosMomentDetail.vue" from
"src/views/PhotosMomentDetail.test.ts". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

### First run after implementing — 15/16, one real failure

```
 FAIL  src/views/PhotosMomentDetail.test.ts > top bar and header > the back button returns to the smart views page
AssertionError: expected '/photos/moments/m1' to be '/photos/smart-views'
      Tests  1 failed | 15 passed (16)
```

`trigger()` only awaits one `nextTick`; a vue-router 4 navigation needs more than one microtask.
Fixed in the test with `await flushPromises()` (deviation D-T2 below).

### GREEN

```
$ pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose

 ✓ cold deep link (a New-UI-only path — the backend has no GET /moments/:id) > fetches the whole list and looks the id up in it when the store is empty
 ✓ cold deep link … > does not fetch the list again when the store already holds that moment
 ✓ cold deep link … > renders "moment not found" rather than a blank page when the list has no such id
 ✓ top bar and header > the back button returns to the smart views page
 ✓ top bar and header > the backend sends no updated_at ⇒ both the top bar and Stats show the placeholder
 ✓ top bar and header > renders no green badge when addedThisWeek is 0
 ✓ About sidebar > time window: shows a single date when the two ends fall on the same day
 ✓ About sidebar > falls back to subtitle when the time window is missing, and to the placeholder without one
 ✓ About sidebar > takes the top three city names when places is non-empty and appends +N beyond that
 ✓ About sidebar > falls back to moment.place when places is empty
 ✓ About sidebar > still renders the row with a placeholder when neither places nor place exists
 ✓ Stats and the month distribution > the span is computed from the two ends, inclusive of both
 ✓ Stats and the month distribution > the span shows the placeholder when the time window is missing
 ✓ Stats and the month distribution > the histogram buckets by YYYY-MM ascending and skips photos with no takenAt
 ✓ Stats and the month distribution > drops the whole By month section when nothing has a takenAt
 ✓ route parameter changes > refetches when only :id changes without a remount (the watcher tracks route.params.id)
 ✓ route parameter changes > a late response for the previous :id does not clobber the newer one

 Test Files  1 passed (1)
      Tests  17 passed (17)
```

**17 tests, not the brief's predicted 16** — one is an addition, see D-T3. Output is pristine:
no `[Vue warn]`, no stderr at all.

### Two mutation checks (this task's assertions were verified to actually bite)

**a) The mock-hygiene fix is load-bearing.** Deleting the three reinstall lines from `beforeEach`:

```
 × About sidebar > falls back to moment.place when places is empty
 × About sidebar > still renders the row with a placeholder when neither places nor place exists
      Tests  2 failed | 14 passed (16)
```

**b) The staleness guard is genuinely covered.** Deleting the post-`Promise.all` epoch check
from `load()`:

```
 × route parameter changes > a late response for the previous :id does not clobber the newer one
      Tests  1 failed | 16 passed (17)
```

The brief's route-param test alone does **not** cover the guard — `m1`'s load fully settles
before the push, so `loadEpoch` could be deleted without turning it red. Hence D-T3.

---

## 3. Deviations from the Vue 2 original

Numbering matches the file-header comment in `PhotosMomentDetail.vue`.

| # | Deviation | Why |
|---|---|---|
| 1 | **Not-found state, plus a loading gate ahead of it** — new, no Vue 2 counterpart | Vue 2 receives the moment as a prop from `PhotosSmartViewsView` and can never hold a missing id. A real route can (address bar, stale bookmark, deep link while the band is hidden), and the backend has no `GET /moments/:id` — only the full list and per-moment assets — so a cold deep link fetches the list and looks the id up. The loading gate exists for the same reason: with nothing in the store yet there is literally nothing to render, and a blank flash on a route is not acceptable. |
| 2 | **`lastUpdated` is a constant `'—'`; the `relTime` branch is not ported** | `momentResponse` (`NimoOS-Photos/route/v1/moments.go:39-73`) has no `updated_at`, so Vue 2's `this.moment.updated_at ? relTime(...) : '—'` has always taken the else branch. The rendered result is reproduced exactly; the unreachable formatting branch is not carried over. `Moment.updatedAt` stays in the type (already commented as such by Task 3). |
| 3 | **`typeLabel` returns a translated string**, not a bare English key for the template to feed `$t` | Vue 2 `:215-221` returns `'Trip'`/`'Pets'`/… and the template does `{{ $t(typeLabel) }}`. Here it reuses `photosMoType{Trip,Pets,Family,Theme}`, which `MomentCard.vue` added in T4 — same ladder, same order, no new keys. Vue 2 also kept two independent copies of this ladder on purpose, so this is not a shared-helper refactor either. |
| 4 | **Every `toLocale*String` gets an explicit BCP-47 tag** | Vue 2 passed a tag to the dates but left the counts on a bare `toLocaleString()` (browser locale, unpredictable). Both now follow the app language. `zh_cn` / `en_us` are not valid BCP-47 — passing one raw throws `RangeError`, so `locale.value.replace('_', '-')` (precedent `SmartViewCard.vue`). |
| 5 | **Action bar, both photo grids, selection bar, delete confirmation and library picker are not here** | They are Tasks 8/9/10. |
| 5b | **Vue 2's `document.mousedown` listener is not ported** | It exists only to close the `more` menu. There is no menu on this page yet, so it belongs with Task 10. ⚠️ **This contradicts the brief**, whose suggested file-header comment lists "the more menu's document mousedown listener, copied from Vue 2 `mounted`/`beforeDestroy`" as deviation 3 — but the same brief's `<script setup>` skeleton declares no `moreOpen` and no listener, and the delete action it would serve is explicitly Task 10. Resolved in favour of the skeleton and the task split; flagged here rather than silently dropped. |
| 6 | **Vue 2's `memberIds` / `refreshAfterEdit` / all write methods are not ported** | Tasks 9/10. |
| 7 | **Colours** — amber literal → `--warn-bg`/`--warn-fg`; green literal → `--success`; the histogram's hard-coded pale violet → `var(--accent-text)`; the sidebar's `--surface-*` family → `--chip-bg`/`--panel-bg`; hairlines → `--divider` | Repo hard constraint. Each substitution follows an existing precedent (`MomentCard.vue` for the amber and green, `SmartViewSidePanel.vue:274` for the gradient, `PhotosSmartViewDetail.vue` for the rail). No `theme-exception` was needed: this page has no text sitting over a photo. |
| 8 | **Vue 2's `::-webkit-scrollbar` repaint (`scss:346-365`) not ported** | Same decision, and the same recorded reason, as at the matching rules in `PhotosSmartViewDetail.vue`. |
| 9 | **Gate 3 is `v-else-if="moment"`, not a bare `v-else`** | Purely a typing matter, see §5. |

Deviations in the **test file** relative to the brief's verbatim listing:

| # | Deviation | Why |
|---|---|---|
| D-T1 | `beforeEach` reinstalls the default mock implementations; `getConfig` added to the hoisted mock | `vi.clearAllMocks()` clears call records only — an implementation installed with `mockResolvedValue`/`mockImplementation` inside a test survives into the next. Proven: without it, two About-sidebar cases fail (§2a). `getConfig` silences a `console.error` on every mount (`PhotosSidebar` → settings store `fetchAiFeatures`) that would otherwise bury real failures. |
| D-T2 | `await flushPromises()` after the back-button click | vue-router 4 navigations do not settle within the single `nextTick` that `trigger()` awaits. Without it the assertion fails (§2, first run). |
| D-T3 | Added `'a late response for the previous :id does not clobber the newer one'` | Constraint 2 requires the guard's regression test to take the interleaved path; the brief's route-param test does not interleave. Verified to fail when the guard is removed (§2b). |
| D-T4 | Uses the app's i18n singleton (`import { i18n } from '../i18n'`) and switches its locale, instead of building a second instance with `createI18n` | Installing vue-i18n twice into the same app prints seven `[Vue warn]`s per mount — `PhotosSmartViewDetail.test.ts` emits **406** of them. Matches the project memory note "New-UI 测试别另建 createI18n". Removed all `[Vue warn]` noise from this file's output. |

---

## 4. `sv-detail-*` reuse vs. what had to be added

Scoped styles do not cross component boundaries in this repo, so "reuse" means restating the
rule bodies — the same technique `MomentCard.vue` used against `SmartViewCard.vue`. The class
*names* and rule bodies are identical to their sources, which is what keeps the two detail pages
visually in sync.

**Reused verbatim from `PhotosSmartViewDetail.vue`:** `.photos-layout`, `.photos-main`,
`.sv-detail-bar`, `.sv-back-btn`, `.sv-last-updated`, `.sv-detail-layout`, `.sv-detail-main`,
`.sv-detail-side`, `.sv-header`, `.sv-header-conds`, `.sv-header-stats`, and the ≤768px block.

**Reused verbatim from `SmartViewSidePanel.vue`** (which ported the same scss):
`.sv-side-section`, `.sv-side-section h3`, `.sv-stat-grid`, `.sv-stat-cell` (+ `.v` / `.l`),
`.sv-distribution`, `.sv-dist-bar`, `.sv-dist-x`.

**Reused from `MomentCard.vue`:** `.mo-week-badge`.

**Had to be added** (no existing counterpart):

- `.mo-skeleton` / `.mo-skel-bar` / `.mo-skel-header` — the loading gate (deviation 1). Modelled
  on `.sv-skeleton` minus the photo-grid block, since this task renders no grid.
- `.mo-not-found` / `.mo-not-found-title` / `.mo-not-found-back` — the not-found gate
  (deviation 1). Mirrors `.sv-not-found*`.
- `.sv-cond` — `PhotosSmartViewDetail.vue` does not define it (its chips come from the
  `SmartViewConditionEditor` child); ported from `scss:95-101`, with `inline-flex`/`gap` added
  because our chip carries a leading pin icon.
- `.sv-cond.mo-type-pill` — the amber type pill (`scss:271-278`).
- `.mo-about-row` (+ `:last-child`, `b`) — the three About key/value rows (`scss:281-289`).
- `.sv-header h1` — restated without Vue 2's inline-editing affordances (this page's title is
  not editable, unlike a smart view's).

The `sv-detail-*` skeleton fitted without any structural change. Vue 2 reached the same
conclusion — its top bar is commented "same as sv-detail-bar".

---

## 5. Gate results

| Gate | Command | Result |
|---|---|---|
| Types | `pnpm exec vue-tsc --noEmit` | **exit 0, clean** |
| Router | `pnpm exec vitest run src/router --reporter=verbose` | **25 passed (3 files)** — includes the three "append only, never reorder" source-order assertions |
| i18n parity | `pnpm exec vitest run src/i18n/parity.test.ts` | **passed** (ran together with the page suite: 26 passed / 2 files) |
| Style guards | `pnpm exec vitest run src/styles` | **1075 passed (4 files)** — the brief predicted 1072; the guards enumerate files, so a new `.vue` moves the count |
| This page | `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose` | **17 passed** |
| All views (layout-cap + glass guards) | `pnpm exec vitest run src/views` | **647 passed (33 files)** |
| OSS export | `pnpm exec vitest run oss` | **448 passed (19 files)** — was red before this task, see §6 |
| Full suite | `pnpm exec vitest run` | **10759 passed, 678 files, 0 failed, 0 skipped** |

`vue-tsc` needed one fix. The first version used a bare `v-else` for gate 3, as
`PhotosSmartViewDetail.vue` does, and got seven `TS18048: 'moment' is possibly 'undefined'`.
The sibling page narrows because its gate 2 is `v-else-if="!sv"` — a direct negation of the same
ref. Ours goes through the separate `notFound` computed, which vue-tsc cannot see through, so
gate 3 became `v-else-if="moment"`: identical at runtime (gates 1 and 2 exclude every other
case), and it narrows. Documented at the site.

---

## 6. The OSS export manifest (second commit)

Adding an import line to `src/router/index.ts` broke the manifest's router anchor and the export
aborted:

```
[oss] 失败:锚点未命中:src/router/index.ts
这是设计意图,不是故障 —— 看一眼私有侧那几行改成什么了,更新 manifest.mjs 的锚点。
```

That tripwire is correct: the two router patches are paired with the DELETE list, and an anchor
that silently kept matching would ship a dangling import into the public tree. Updated both
anchors (import block and route block) and registered `src/views/PhotosMomentDetail.vue` +
`src/views/PhotosMomentDetail.test.ts` in `DELETE`, with the counts in the surrounding comments.

While doing so, two **pre-existing** omissions from earlier tasks in this phase surfaced — the
leak guard (`oss/tree.test.mjs > 泄漏守卫`) had been red before I started (verified by stashing
my work and re-running: same 1 file / 2 tests failing):

- `packages/service/src/photos.moments.test.ts` (T1/T2) — never added to `SERVICE_DELETE`;
- `src/views/PhotosSmartViews.moments.test.ts` (T5) — never added to `DELETE`. Easy to miss
  because, like mine, it sits next to its view rather than in `views/__tests__/`.

Both registered. `pnpm exec vitest run oss` now passes 448/448, an improvement on the baseline.

---

## 7. Files changed

```
oss/manifest.mjs                                  |  20 +-
src/i18n/en_us.photos.ts                          |  16 +
src/i18n/zh_cn.photos.ts                          |  16 +
src/router/index.ts                               |   3 +
src/views/PhotosMomentDetail.test.ts              | 246 ++++++++++
src/views/PhotosMomentDetail.vue                  | 410 ++++++++++++++++
src/views/__tests__/photosLayoutHeightCap.test.ts |   1 +
```

`src/files/**` untouched. `src/i18n/*.base.ts` untouched.

---

## 8. Self-review findings

- **Every `data-test` the brief names is present and spelled exactly:** `mo-back`,
  `mo-last-updated`, `mo-not-found`, `mo-about-time`, `mo-about-place`, `mo-stat-span`,
  `mo-dist`, `mo-dist-bar`. Extras added for Tasks 8/9/10 and for the new gates:
  `mo-not-found-back`, `mo-skeleton`, `mo-stat-photos`, `mo-stat-featured`, `mo-stat-lastupdate`.
- **Bad id renders the not-found state, not a blank page** — covered, and reachable in three
  ways (unknown id in a loaded store, unknown id after a cold fetch, and — noted below — a
  failed list fetch).
- **Changing only `:id` refetches** — covered, and the staleness guard was mutation-verified.
- **Colours:** `grep -nE '#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\('` over the new `.vue` returns
  nothing. Every colour is a token; no `theme-exception` was needed.
- **No `*` immediately followed by `/` inside any CSS comment** — checked over the whole style
  block. Colours are described in words, never as literals inside comments (the guard does not
  strip comments).
- **Nothing unreachable ported** — the `relTime` branch is the one Vue 2 has that can never run;
  it is deliberately absent (deviation 2).
- **Test output pristine** — zero `[Vue warn]`, zero stderr in this file's verbose run.
- Fixed during review: the `vue-tsc` narrowing failure (§5), the back-button async gap (D-T2),
  the mock leak (D-T1), the missing interleave test (D-T3), the duplicate-i18n warnings (D-T4).

---

## 9. Concerns

1. **Brief-vs-skeleton conflict on the `more` menu**, resolved in favour of the skeleton and the
   task split — see deviation 5b. If Task 10 expects the listener to already exist, it does not;
   it should add it alongside the menu it serves.
2. **A failed `listMoments()` renders the not-found state.** The T3 store swallows the error and
   still sets `listLoaded = true` in its `finally`, so a network blip on a cold deep link is
   indistinguishable from a deleted moment. Vue 2 had no equivalent path at all, so there is no
   original behaviour to match. Fixing it properly needs a `listError` flag on the store, which
   is a store change and out of this task's scope — flagged for whoever owns the error states.
3. **`allLoading` is set but nothing reads it yet.** Task 8's grids are its consumer. Same for
   `manualIds` (Task 8's pin badge). Both are populated and correct today.
4. **Two pre-existing OSS omissions were fixed here** (§6) rather than left red. They are not
   mine, but they were blocking the export gate and the fix is one line each.
5. **The month histogram buckets by local time**, matching Vue 2 (`d.getFullYear()` /
   `d.getMonth()`). An asset taken near a month boundary lands in a different bucket depending on
   the viewer's timezone. Faithful to the original; noting it because it is the kind of thing a
   real-device check can surface.
6. **Not verified on device.** jsdom does no layout, so the two-column grid, the height cap and
   the histogram's rendered bar heights are source-text-correct but visually unverified.

---
---

# Fix round 1

Three commits, on top of `7ce2928` / `7069012`:

- `61752c0` — `fix(photos): let consumers tell a failed moment list from an empty one` (store)
- `e7cfd32` — `fix(photos): stop one failed asset request from discarding the other` (view + i18n)
- `2af7d1a` — `chore(oss): correct the photos counts in the export manifest`

All seven findings addressed. Concerns A and C were upheld and needed no code change; Concern B
became finding 4.

## Finding 1 — `Promise.all` discarded data Vue 2 would have kept

Upheld and fixed. `load()` now issues the two requests independently, each with its own rejection
handler and its own epoch check before it writes:

```ts
const detailDone = store.loadDetail(id).then(
  (detail) => { if (epoch !== loadEpoch) return; featuredAssets.value = detail.assets; … },
  (e: unknown) => { console.error('[photos-moments] loadDetail', e) },
)
const allDone = store.loadAll(id).then(
  (all) => { if (epoch !== loadEpoch) return; allAssets.value = all },
  (e: unknown) => { console.error('[photos-moments] loadAll', e) },
)
await Promise.all([detailDone, allDone])   // neither handler can reject
if (epoch === loadEpoch) allLoading.value = false
```

Two new tests, one per direction. Logged as deviation 10 in the file header.

## Finding 2 — the histogram-ordering assertion did not bite

Upheld. `toContain('2')` → `toBe('Nov 2016 · 2')`, plus `bars[1]` → `'Dec 2016 · 1'`.

## Finding 3 — the same-day assertion was satisfied by the placeholder

Upheld; the en-dash/em-dash mismatch is exactly as described. The same-day case is now an
equality against the formatted single date, and a new case covers a genuine multi-day range and
asserts the whole `from – to` string. Both expectations are built in the test with plain `Intl`
rather than by reaching into the component, so they stay timezone-safe without restating the
implementation.

## Finding 4 — a failed list fetch reported as a deleted moment

Implemented as specified.

- Store: `listError` ref, set in `fetchMoments`'s catch, cleared on a successful load, and
  written **only** by the current epoch — a superseded request's late failure is no more the
  current truth than its late success. Exported alongside `listLoaded`.
- View: `loadFailed = listLoaded && !moment && listError`, `notFound = listLoaded && !moment &&
  !listError`. Both require `!moment`, so a moment we do hold still renders even if a later
  refresh failed underneath it. Four gates now: skeleton → `mo-load-failed` → `mo-not-found` →
  content.
- The failure screen has a retry (`mo-load-failed-retry`) that refetches the list and reloads —
  without it the state is a dead end, since `ensureLoaded()` short-circuits once `listLoaded` is
  true. It reuses the existing `photosRetry` key.
- New key `photosMoLoadFailed` in **both** locale files: `时刻加载失败` / `Couldn't load
  moments`. It deliberately says nothing about whether the moment exists.

Four view tests (failure state, genuine not-found, loaded, retry recovery) and three store tests
(initial false, raised on failure, cleared on the next success), plus one epoch test.

## Finding 5 — Chinese comments I had written

All three rewritten in English: `oss/manifest.mjs` view-list header, `oss/manifest.mjs`
view-test-list header, and the `photosLayoutHeightCap.test.ts` CAPPED entry. The file's
pre-existing Chinese is untouched apart from the numbers finding 6 required. One Chinese string
remains in a comment I wrote — the quoted test title
`` `oss/tree.test.mjs > 泄漏守卫 > 不带 --skip-guard 也能跑通` `` — kept verbatim because it is a
source reference to a real `describe`/`it` name, not prose.

## Finding 6 — the manifest's own counts

Recounted by hand against the source rather than trusting either comment:

| Comment | Was | Now | Reality |
|---|---|---|---|
| `相册面 = … 个视图` | 13 | 14 | 14 `.vue` entries in DELETE |
| `相册面 = … 个视图测试` | 16 → my 17 | **19** | 17 in `views/__tests__/` + 2 beside their views |
| section header `个视图测试` | (mine) 18 | **19** | same |
| router header `条 /photos* 路由` | 14 → my 15 | **14** | 14 route lines in the anchor |
| router header `个相册视图 import` | 13 | 14 | 14 import lines in the anchor |
| `DELETE 表已删掉那 N 个 .vue 文件` | 13 | 14 | same as the DELETE count |

The route count was already wrong before this phase (13 routes described as 14); I inherited it
and bumped it to 15. Corrected to the real number. The dated `2026-08-05 清点结果` parenthetical
is left as the historical record it is, with a dated 2026-08-09 recount appended beside it.

## Finding 7 — `ensureLoaded` could return without loading

Fixed. `fetchMoments` publishes its running body on an `inFlight` slot (assigned before the
function's first suspension point, so a caller entering in the same tick already sees it) and
clears it only if the slot is still its own. `ensureLoaded` awaits `inFlight` when present.

**This is where the round's own mistake was.** My first version of the test compared the list
length observed inside each caller's `.then`:

```ts
const p2 = s.ensureLoaded().then(() => { seen.push(`second:${s.moments.length}`) })
```

It passed against the old early-return too. A probe confirmed why — with the old code the
observed order was `['second:1', 'first:1']`: an async function that returns without awaiting
still needs a couple of microtask ticks to deliver its result, and the store's own continuation
won that race, so the second caller happened to look after the list had landed. A real fake gate,
of exactly the kind findings 2 and 3 are about, and only the mutation check exposed it.

Rewritten to remove the race instead of betting on it — assert that the second caller has **not**
settled while the request is still unanswered:

```ts
const p1 = s.ensureLoaded()
let secondSettled = false
const p2 = s.ensureLoaded().then(() => { secondSettled = true })
await new Promise((r) => setTimeout(r, 0))          // drain microtasks, answer nothing
expect(secondSettled).toBe(false)
resolve([RAW]); await Promise.all([p1, p2])
expect(listMoments).toHaveBeenCalledTimes(1)
```

## Self-initiated: stale assets across an `:id` change (deviation 11)

Found while rewriting `load()` for finding 1. The watcher refetched but never cleared, so the
previous moment's photos, Featured count and Place stayed on screen under the new moment's title
until the new responses landed. Vue 2 could not hit this — its detail component was `v-if`'d by
the parent, so switching remounted it. A params-only route change does not remount, which is the
entire reason the watcher exists, so the reset has to be explicit. Fixed, tested, logged as
deviation 11; Task 8's grids would otherwise have inherited it.

## Mutation checks — every new or rewritten assertion was verified to bite

| # | Mutation applied | Result |
|---|---|---|
| M1 | reverse `monthBuckets`' `localeCompare` sort | `× the histogram buckets by YYYY-MM ascending …` — 1 failed / 24 passed |
| M2 | `timeWindowLabel` → `return m.subtitle \|\| DASH` | `× … exactly one date …`, `× … the full "from – to" range …` — 2 failed / 23 passed |
| M3 | fold both loads back into one `Promise.all` + one catch | `× a rejected all-assets request …`, `× a rejected detail request …` — 2 failed / 23 passed |
| M4 | drop `!listError` from `notFound` (and disable `loadFailed`) | `× renders its own failure state …`, `× retry refetches …` — 2 failed / 23 passed |
| M5 | remove the on-`:id`-change asset reset | `× clears the previous moment assets on an :id change …` — 1 failed / 24 passed |
| M6 | restore `ensureLoaded`'s `if (listLoaded \|\| listLoading) return` | `× a second caller does not resolve while the first request is still on the wire …` — 1 failed / 24 passed |

M6 is the rewritten test; against the original version this same mutation produced **25 passed**,
which is what prompted the rewrite. Every file was restored from backup and re-verified green
after each mutation.

## Gate results after the fix

| Gate | Result |
|---|---|
| `pnpm exec vue-tsc --noEmit` | **exit 0, clean** |
| `src/views/PhotosMomentDetail.test.ts` | **25 passed** (was 17) |
| `src/photos/stores/__tests__/moments.test.ts` | **25 passed** (was 20) |
| `pnpm exec vitest run src/router` | **25 passed** (3 files) |
| `pnpm exec vitest run src/i18n/parity.test.ts` | **9 passed** |
| `pnpm exec vitest run src/styles` | **1075 passed** (4 files) |
| `pnpm exec vitest run oss` | **448 passed** (19 files) — unchanged, guard not weakened |
| `pnpm exec vitest run` (full) | **10772 passed, 678 files, 0 failed, 0 skipped** (was 10759) |

Test output for both touched suites is pristine — the cases that deliberately reject a request
spy on `console.error`, silence it, and assert it was called, so a genuinely unexpected error
still stands out.

## Files changed in this round

```
oss/manifest.mjs                                  | counts + English comments
src/i18n/en_us.photos.ts                          | +photosMoLoadFailed
src/i18n/zh_cn.photos.ts                          | +photosMoLoadFailed
src/photos/stores/__tests__/moments.test.ts       | +5 tests
src/photos/stores/moments.ts                      | listError + inFlight ensureLoaded
src/views/PhotosMomentDetail.test.ts              | +8 tests, 2 assertions hardened
src/views/PhotosMomentDetail.vue                  | independent loads, 4th gate, :id reset
src/views/__tests__/photosLayoutHeightCap.test.ts | comment to English
```

## Concerns after this round

1. **`retry()` was not in the finding's letter.** The failure state as specified would have been a
   dead end — no back button, and `ensureLoaded()` short-circuits once `listLoaded` is true, so
   nothing on the page could recover. I added a retry button reusing the existing `photosRetry`
   key and tested it. Flagging it as an addition rather than burying it.
2. **`listError` is a single flag for the whole store.** It describes the list request only.
   Per-moment asset failures are still silent apart from `console.error` — the detail panels just
   stay empty, which is what Vue 2 did too. If a visible signal is wanted there, it needs its own
   state and its own screen treatment; not attempted here.
3. **Still not verified on device.** jsdom does no layout, so the new failure screen's appearance
   (it reuses `.mo-not-found`'s styles) is source-correct but visually unchecked.
4. **The `.superpowers/sdd/.gitignore` was still present in this worktree**, despite the round-1
   message saying the controller had removed it — a single `*`, itself untracked, hiding all 26
   of this phase's ledger files while 1855 siblings from earlier phases are tracked. Removed
   (not re-created) and the phase directory committed, following the convention the rest of the
   tree already uses. It also kept the working tree permanently dirty, which the OSS export
   refuses to run against; before this the oss suite could only be verified by stashing first.
   Worth checking whether the controller's removal landed somewhere else and needs propagating.

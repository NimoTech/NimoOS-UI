# Task 7 report: shared avatar version store

## Store API (`src/stores/userProfile.ts`)

```ts
export const useUserProfile = defineStore('userProfile', () => {
  const avatarVersion = ref(1)          // starts at 1, per page load
  function bumpAvatarVersion() {        // avatarVersion.value += 1
    avatarVersion.value += 1
  }
  return { avatarVersion, bumpAvatarVersion }
})
```

Setup-store form, matching the style of `src/stores/toast.ts` / `locale.ts`.

## Exact comment left for the future maintainer

In `src/stores/userProfile.ts` (top-of-file block comment):

> SP8-P1c2 Task 7: app-level home for "did the user's avatar change" state.
>
> Why this exists: in the Vue2 app, changing your avatar broadcast an
> `$EventBus` 'avatar-changed' event and every subscriber (incl. the AI
> sidebar) re-fetched it. New-UI has no event bus, and — more importantly —
> New-UI does not have an account/avatar UI yet; the only place you can
> change an avatar today is the *old* app, which is a separate page load, so
> a live cross-app refresh is impossible right now and inventing a channel
> for it would be waste.
>
> So this store does not port the event. It relocates the capability to the
> right place: `avatarVersion` used to be a local ref inside AgentSidebar
> (only the AI sidebar's `<img>` would ever change); it now lives here, at
> app scope, with one action. Any component that renders an avatar can read
> `avatarVersion` and append it as a cache-busting `&v=` query param.
>
> The hook for later: when New-UI grows its own account/avatar panel, its
> upload-success handler just calls `bumpAvatarVersion()` once — every
> avatar anywhere in the app (sidebar, desktop, wherever) recomputes its URL
> and reloads the image. No event bus, no changes needed in the AI area.
>
> Not a bug: if you change your avatar in the *old* (Vue2) app, the New-UI
> page won't reflect it until you reload — the two are separate page loads
> with no shared runtime, so `avatarVersion` simply restarts at 1 on next
> load (which happens to also bust the browser cache for the new image).
> That reload requirement is expected today, not a regression to chase.

In `AgentSidebar.vue`, the `:88` placeholder comment was replaced with:

> No 'avatar-changed' subscription here (unlike Vue2's $EventBus version):
> New-UI has no event bus, and no account/avatar UI to change it from yet —
> the only place to change an avatar today is the old Vue2 app, a separate
> page load, so a live cross-app refresh isn't possible and isn't worth
> inventing a channel for. Instead, avatarUrl above reads userProfile's
> shared avatarVersion (src/stores/userProfile.ts); when New-UI gets its own
> account panel, its upload-success handler calls bumpAvatarVersion() and
> this (and every other) avatar refreshes automatically. Changing the
> avatar in the *old* app only shows up here after a page reload — that's
> expected, not a bug (see the store's comment for why).

Plus a short inline comment above `const userProfile = useUserProfile()` pointing
back at the store, and one above `avatarFailed` explaining why it stays local.

## What stayed local and why

`avatarFailed` (a `ref(false)` in `AgentSidebar.vue`) stayed local. It is the
load-failure state of this one `<img>` element (drives the 404→bundled
`defaultAvatar` fallback), not shared profile data — every avatar instance
in the app should independently track whether its own image request
succeeded, not share one global "did the avatar fail" flag. The existing
404-fallback behaviour (`avatarSrc` computed) is untouched.

## Changes made

- Created `src/stores/userProfile.ts` (store) and
  `src/stores/userProfile.test.ts` (2 tests: initial value 1, bump
  increments).
- `src/ai/components/shell/AgentSidebar.vue`: removed local `avatarVersion`
  ref, added `useUserProfile()` import/call, `avatarUrl` computed now reads
  `userProfile.avatarVersion`, replaced the `1c:` placeholder comment.
- `src/ai/components/shell/AgentSidebar.test.ts`: added 2 tests — avatar URL
  contains `&v=1` from the store's default, and calling
  `useUserProfile().bumpAvatarVersion()` on an already-mounted sidebar
  changes the rendered `<img src>` to `&v=2` (proves cross-component /
  future-account-panel wiring works without touching AI code).

## TDD sequence

1. Wrote the 4 new tests (2 store + 2 sidebar) against the not-yet-existing
   `useUserProfile` — confirmed both suites failed with "Failed to resolve
   import ... does the file exist?" (module-not-found, i.e. the right kind
   of red).
2. Implemented the store and the sidebar edits.
3. Re-ran — all green.

## Test commands + output tails

```
$ pnpm test -- src/stores/userProfile.test.ts src/ai/components/shell/AgentSidebar.test.ts
 Test Files  2 passed (2)
      Tests  12 passed (12)

$ pnpm test -- src/stores/ src/ai/components/shell/AgentSidebar.test.ts
 Test Files  7 passed (7)
      Tests  34 passed (34)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)
```

## Noticed but left alone

- No colour literals introduced; diff is scoped to the two target files plus
  the two new store files — no unrelated refactors.
- Did not touch i18n files — no new user-facing strings were added by this
  task (only code comments).
- Did not run the full test suite per instructions (other agents working
  concurrently); ran the scoped test paths named in the brief instead.

## Commit

`d3f316b` — `SP8-P1c2: shared avatar version store (future account-panel hook)`

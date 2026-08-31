import { defineStore } from 'pinia'
import { ref } from 'vue'

// App-level home for "did the user's avatar change" state.
//
// Why this exists: in the Vue2 app, changing your avatar broadcast an
// `$EventBus` 'avatar-changed' event and every subscriber (incl. the AI
// sidebar) re-fetched it. New-UI has no event bus, and — more importantly —
// New-UI does not have an account/avatar UI yet; the only place you can
// change an avatar today is the *old* app, which is a separate page load, so
// a live cross-app refresh is impossible right now and inventing a channel
// for it would be waste.
//
// So this store does not port the event. It relocates the capability to the
// right place: `avatarVersion` used to be a local ref inside AgentSidebar
// (only the AI sidebar's `<img>` would ever change); it now lives here, at
// app scope, with one action. Any component that renders an avatar can read
// `avatarVersion` and append it as a cache-busting `&v=` query param.
//
// The hook for later: when New-UI grows its own account/avatar panel, its
// upload-success handler just calls `bumpAvatarVersion()` once — every
// avatar anywhere in the app (sidebar, desktop, wherever) recomputes its URL
// and reloads the image. No event bus, no changes needed in the AI area.
//
// Not a bug: if you change your avatar in the *old* (Vue2) app, the New-UI
// page won't reflect it until you reload — the two are separate page loads
// with no shared runtime, so `avatarVersion` simply restarts at 1 on next
// load (which happens to also bust the browser cache for the new image).
// That reload requirement is expected today, not a regression to chase.
export const useUserProfile = defineStore('userProfile', () => {
  const avatarVersion = ref(1)

  function bumpAvatarVersion() {
    avatarVersion.value += 1
  }

  return { avatarVersion, bumpAvatarVersion }
})

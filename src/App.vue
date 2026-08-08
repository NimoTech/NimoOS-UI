<template>
  <router-view />
  <WallpaperDialog />
  <AppToast />
</template>

<script setup lang="ts">
// Home (and future routes) own their own chrome; AppToast is app-level so any route can show toasts.
import { defineAsyncComponent, watch } from 'vue'
import AppToast from './components/AppToast.vue'
import { useSessionStore } from './stores/session'
import { useLocaleStore } from './stores/locale'
import { useWallpaperStore } from './stores/wallpaper'

// Async on purpose: the two built-in JPEGs total ~3 MB, and this keeps them out
// of the first-paint bundle. M6 (final review): this does NOT mean they only
// download once the picker opens -- defineAsyncComponent resolves as soon as
// <WallpaperDialog /> is mounted below (App.vue has no v-if gating it), which
// happens on every app boot. The actual deferral comes from reka-ui's
// DialogRoot never rendering DialogContent while :open is false, so the
// component's own template never reaches the <img>/background-image that
// would need the JPEGs until the dialog is actually opened.
const WallpaperDialog = defineAsyncComponent(() => import('./components/WallpaperDialog.vue'))

const session = useSessionStore()

// I1 (final review): load() used to run once from onMounted, gated on
// session.isAuthed at mount time only -- which covered neither half of the
// session lifecycle. Logging out left the previous user's wallpaper painted:
// useAuth().logout() is session.clear() only, which drops the localStorage
// cache key but never touches <html data-wallpaper> / --wallpaper-img, and
// GET /v1/users/image is unauthenticated by backend design so it keeps
// rendering straight through the login page. Logging back in never (re-)ran
// load() at all, because both Login.vue and useAuth's login flows navigate
// with router.push (no page reload), so this root component never remounts.
//
// A single watcher on session.isAuthed covers both directions from the one
// place that already owned load(): it reacts whenever session.token actually
// changes, regardless of which composable or view triggered it (login,
// registerAndLogin, or logout), so useAuth.ts and every post-auth navigation
// site stay untouched. `immediate: true` reproduces the old onMounted-gated
// call for the already-authed-at-boot case; main.ts has already painted the
// cached wallpaper by then, so this only reconciles it with the server (e.g.
// a change made on another device).
watch(
  () => session.isAuthed,
  (authed, wasAuthed) => {
    if (authed) {
      void useLocaleStore().loadFromServer()
      void useWallpaperStore().load()
    } else if (wasAuthed) {
      useWallpaperStore().reset()
    }
  },
  { immediate: true },
)
</script>

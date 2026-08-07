<template>
  <router-view />
  <WallpaperDialog />
  <AppToast />
</template>

<script setup lang="ts">
// Home (and future routes) own their own chrome; AppToast is app-level so any route can show toasts.
import { defineAsyncComponent, onMounted } from 'vue'
import AppToast from './components/AppToast.vue'
import { useSessionStore } from './stores/session'
import { useLocaleStore } from './stores/locale'
import { useWallpaperStore } from './stores/wallpaper'

// Async on purpose: the two built-in JPEGs total ~3 MB, and this keeps them out
// of the first-paint bundle -- they download only when the picker is opened.
const WallpaperDialog = defineAsyncComponent(() => import('./components/WallpaperDialog.vue'))

onMounted(() => {
  const session = useSessionStore()
  if (session.isAuthed) {
    void useLocaleStore().loadFromServer()
    // main.ts already painted the cached wallpaper before mount; this reconciles
    // it with the server so a change made on another device shows up.
    void useWallpaperStore().load()
  }
})
</script>

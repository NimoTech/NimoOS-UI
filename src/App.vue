<template>
  <router-view />
  <AppToast />
</template>

<script setup lang="ts">
// Home (and future routes) own their own chrome; AppToast is app-level so any route can show toasts.
import { onMounted } from 'vue'
import AppToast from './components/AppToast.vue'
import { useSessionStore } from './stores/session'
import { useLocaleStore } from './stores/locale'

onMounted(() => {
  const session = useSessionStore()
  if (session.isAuthed) { void useLocaleStore().loadFromServer() }
})
</script>

<template>
  <router-view />
  <AppToast />
</template>

<script setup lang="ts">
// Home (and future routes) own their own chrome; AppToast is app-level so any route can show toasts.
import AppToast from './components/AppToast.vue'
</script>

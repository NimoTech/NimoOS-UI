<!-- Mount this once per Photos view, alongside <PhotosToastHost /> -- same "singleton overlay,
     redundantly mounted per page, Teleported to <body>" convention (Photos has no shared route
     shell to provide() a persistent FAB/drawer through, since all /photos/* routes are flat
     leaf routes, see router/index.ts:67-83 -- verified no parent route component exists).
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { usePhotosTheme } from '../../composables/usePhotosTheme'
import AskNimoFab from './AskNimoFab.vue'
import AskNimoPopup from './AskNimoPopup.vue'
import AskNimoDrawer from './AskNimoDrawer.vue'

const { themeClass } = usePhotosTheme()
</script>

<template>
  <Teleport to="body">
    <div class="ask-nimo-host photos-root" :class="themeClass">
      <AskNimoFab />
      <AskNimoPopup />
      <AskNimoDrawer />
    </div>
  </Teleport>
</template>

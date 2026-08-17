<!-- Full-height chat drawer. Pixel source: Vue2 NimoOS-UI
     src/views/Photos/PhotosNimoChatDrawer.vue + photos.scss:2563-2572 (already ported).
     Note: unlike the popup, the drawer has no prefill path (matches Vue2's own TODO comment --
     only the popup supports prefill).
     Preflight F-16 (verified against Vue2 source directly): PhotosNimoChatDrawer.vue also has
     NO scrim/Esc/click-outside -- same grep, same zero hits. Deliberate parity, not an omission.
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { resetPhotosSession } from '../../composables/useAskNimoSession'
import { useAskNimo } from '../../composables/useAskNimo'
import PhotosIcon from '../PhotosIcon.vue'
import NimoModelPicker from './NimoModelPicker.vue'
import NimoTaskBar from './NimoTaskBar.vue'
import AskNimoChat from './AskNimoChat.vue'

const { t } = useI18n()
const agent = useAgentStore('photos')
const nimo = useAskNimo()
const clearing = ref(false)

async function clear(): Promise<void> {
  if (clearing.value) return
  clearing.value = true
  try {
    await resetPhotosSession(agent)
  } catch (e) {
    console.warn('[AskNimoDrawer] reset session failed', e)
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <aside v-if="nimo.drawerOpen.value" class="chat-drawer">
    <header class="cd-head">
      <span class="nimo-orb" style="width:34px;height:34px" />
      <div style="flex:1;min-width:0">
        <div class="cd-title">{{ t('photosNimoAgent') }}</div>
        <NimoModelPicker />
      </div>
      <button type="button" class="icon-btn" data-test="drawer-clear" :disabled="clearing" :title="t('photosClearConversation')" @click="clear">
        <PhotosIcon name="trash" :size="14" />
      </button>
      <button type="button" class="icon-btn" data-test="drawer-close" :title="t('photosClose')" @click="nimo.closeDrawer()">
        <PhotosIcon name="x" :size="15" />
      </button>
    </header>
    <NimoTaskBar v-model:expanded="nimo.taskBarExpanded.value" />
    <AskNimoChat
      :fullscreen="true" :context-photo="nimo.contextPhoto.value" :context-album="nimo.contextAlbum.value"
      @context-consumed="nimo.consumeContextPhoto()" @album-context-consumed="nimo.consumeContextAlbum()"
    />
  </aside>
</template>

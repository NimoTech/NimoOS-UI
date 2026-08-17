<!-- Small FAB popup shell. Pixel source: Vue2 NimoOS-UI src/views/Photos/PhotosAskNimo.vue's
     popup half + photos.scss:951-972 (already ported).
     Preflight F-16 (verified against Vue2 source directly, not assumed): PhotosAskNimo.vue has
     NO scrim, NO Esc-to-close, NO click-outside-to-close -- grepped for
     Escape/keydown/mousedown/scrim across the whole file, zero hits besides the drag handlers.
     This component deliberately matches that absence; it is not an omission.
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAskNimo } from '../../composables/useAskNimo'
import PhotosIcon from '../PhotosIcon.vue'
import NimoModelPicker from './NimoModelPicker.vue'
import NimoTaskBar from './NimoTaskBar.vue'
import AskNimoChat from './AskNimoChat.vue'

const { t } = useI18n()
const nimo = useAskNimo()
</script>

<template>
  <div v-if="nimo.popupOpen.value" class="nimo-pop">
    <div class="nimo-pop-head">
      <span class="nimo-orb" style="width:32px;height:32px" />
      <div style="flex:1;min-width:0">
        <div class="nimo-pop-title">Nimo</div>
        <NimoModelPicker />
      </div>
      <button type="button" class="icon-btn" data-test="pop-expand" :title="t('photosOpenFullConversation')" @click="nimo.expand()">
        <PhotosIcon name="panelRight" :size="14" />
      </button>
      <button type="button" class="icon-btn" data-test="pop-close" :title="t('photosClose')" @click="nimo.closePopup()">
        <PhotosIcon name="x" :size="14" />
      </button>
    </div>
    <NimoTaskBar v-model:expanded="nimo.taskBarExpanded.value" />
    <AskNimoChat
      :prefill="nimo.prefill.value" :context-photo="nimo.contextPhoto.value" :context-album="nimo.contextAlbum.value"
      @prefill-consumed="nimo.consumePrefill()" @context-consumed="nimo.consumeContextPhoto()"
      @album-context-consumed="nimo.consumeContextAlbum()"
    />
  </div>
</template>

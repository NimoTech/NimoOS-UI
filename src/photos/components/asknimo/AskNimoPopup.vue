<!-- Small FAB popup shell. Pixel source: the Vue 2 panel's src/views/Photos/PhotosAskNimo.vue's
     popup half + photos.scss:951-972 (already ported).
     Preflight F-16 (verified against Vue2 source directly, not assumed): PhotosAskNimo.vue has
     NO scrim, NO Esc-to-close, NO click-outside-to-close -- grepped for
     Escape/keydown/mousedown/scrim across the whole file, zero hits besides the drag handlers.
     This component deliberately matches that absence; it is not an omission.
     Review fix (inherited parity gap, controller-ruled): popup position is NOT the static
     right:24/bottom:78 scss corner -- Vue2 anchors it above the FAB's CURRENT (possibly
     dragged) position via a `popStyle` computed (PhotosAskNimo.vue:70,126-132). The script
     block below ports that computed byte-exact and binds it as an inline :style, which wins
     over the static scss rule once mounted; the scss rule stays as the pre-mount/no-JS fallback.
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAskNimo } from '../../composables/useAskNimo'
import PhotosIcon from '../PhotosIcon.vue'
import NimoModelPicker from './NimoModelPicker.vue'
import NimoTaskBar from './NimoTaskBar.vue'
import AskNimoChat from './AskNimoChat.vue'

const { t } = useI18n()
const nimo = useAskNimo()

// Byte-exact port of Vue2 PhotosAskNimo.vue:126-132's `popStyle` computed -- the popup anchors
// ABOVE the FAB's CURRENT (possibly dragged-away-from-default) position, not a fixed corner.
// `right` is clamped so the 360px-wide panel never runs off the left edge of the viewport;
// `bottom` is simply fabBottom + 54 (the FAB's own height/gap), uncapped, same as Vue2.
// The static .nimo-pop right:24/bottom:78 scss rule stays in place as the no-JS fallback
// (first paint before this computed runs / SSR) -- this inline style overrides it once mounted.
const POP_WIDTH = 360
const popStyle = computed(() => {
  const maxRight = Math.max(8, window.innerWidth - POP_WIDTH - 8)
  const right = Math.min(nimo.fabRight.value, maxRight)
  return { right: `${right}px`, bottom: `${nimo.fabBottom.value + 54}px` }
})
</script>

<template>
  <div v-if="nimo.popupOpen.value" class="nimo-pop" :style="popStyle">
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

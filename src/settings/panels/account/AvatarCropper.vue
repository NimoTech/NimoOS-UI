<script setup lang="ts">
// Avatar cropper — counterpart of Vue2 AccountPanel state 4 (:746-760) + saveAvatar (:442-462).
// Left: 220x220 crop box (1:1 square stencil, 160x160 canvas output); right: 80x80 round preview + "Preview" label.
//
// ⚠️ The backend PUT /v1/users/avatar strips only the `data:image/png;base64,` prefix, and a
// decode failure log.Fatal-kills UserService (cluster-wide JWT invalidation, everyone re-logs in; systemd restarts it in 100ms).
// canvas.toDataURL() with no args defaults to PNG — **do not pass 'image/jpeg' or similar**.
// This write path was never actually exercised on the dev machine this sprint (plan D table / debt D27); coverage relies on unit tests.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cropper, Preview } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { service } from '@nimotech/nimoos-service'
import '../../styles/settings.css'

const props = defineProps<{ src: string }>()
const { t } = useI18n()

const result = ref<{ coordinates: unknown; image: unknown; canvas: HTMLCanvasElement | null }>({
  coordinates: null,
  image: null,
  canvas: null,
})
const busy = ref(false)
const error = ref('')

function onChange(payload: { coordinates: unknown; image: unknown; canvas: HTMLCanvasElement }) {
  result.value = payload
}

// Vue2 defaultSize (:383-388): prefer the visible area, fall back to full image size.
function defaultSize({ imageSize, visibleArea }: {
  imageSize: { width: number; height: number }
  visibleArea?: { width: number; height: number }
}) {
  const s = visibleArea || imageSize
  return { width: s.width, height: s.height }
}

async function submit(): Promise<boolean> {
  if (busy.value) return false
  const canvas = result.value.canvas
  // 🔧 Vue2 calls `this.result.canvas.toDataURL()` directly — canvas is null when the user
  // never touched the crop box, throwing a TypeError swallowed by .catch into a generic
  // "update failed". Explicit early return here (plan C1: don't copy error-swallowing).
  if (!canvas) return false
  busy.value = true
  error.value = ''
  try {
    await service.users.saveAvatar(canvas.toDataURL())
    return true
  } catch (e) {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = r?.response?.data?.message || r?.message || String(e)
    return false
  } finally {
    busy.value = false
  }
}
defineExpose({ submit })
</script>

<template>
  <div class="set-acc-crop">
    <div class="set-acc-crop-box">
      <Cropper
        :src="props.src" :debounce="false" :stencil-props="{ aspectRatio: 1 }" check-orientation
        :min-height="80" :min-width="80" :canvas="{ height: 160, width: 160 }"
        :default-size="defaultSize" @change="onChange"
      />
    </div>
    <div class="set-acc-crop-preview">
      <Preview :width="80" :height="80" :image="result.image" :coordinates="result.coordinates" />
      <p class="set-acc-crop-label">{{ t('settingsAccPreview') }}</p>
    </div>
    <p v-if="error" class="set-danger" data-test="acc-crop-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.set-acc-crop { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
/* Vue2 .cropper-wrapper is 220x220 with a 20%-opaque dark underlay → replaced with a token (C4).
   ⚠️ No color literals even in comments — color-guard.test.ts does NOT strip comments; writing one turns it red. */
.set-acc-crop-box {
  width: 220px; height: 220px; flex: 0 0 auto; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg);
}
.set-acc-crop-preview { text-align: center; }
/* Vue2 .preview { border-radius: 50% } — library-internal structure, pierce with :deep */
.set-acc-crop-preview :deep(.vue-preview) { border-radius: 50%; overflow: hidden; }
.set-acc-crop-label { margin: 8px 0 0; font-size: 13px; color: var(--fg-muted); }
</style>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import ViewerShell from './ViewerShell.vue'
import { mediaKind } from './mediaKind'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download'): void }>()
const { locale } = useI18n()

const kind = mediaKind(props.item.name)
const url = service.file.fileUrl(props.item.path)
const videoEl = ref<HTMLDivElement | null>(null)
const audioEl = ref<HTMLElement | null>(null)
const wrap = ref<HTMLElement | null>(null)
const poster = ref('')
const audioTitle = ref(props.item.name)
const audioArtist = ref('...')
// Artplayer/APlayer instances are third-party interop boundaries with no shared
// type surface we need beyond `destroy` — `any` here is intentional, not laziness.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let artInst: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let apInst: any = null

onMounted(async () => {
  if (kind === 'video') {
    const Artplayer = (await import('artplayer')).default
    artInst = new Artplayer({
      url,
      container: videoEl.value!,
      setting: true,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      subtitleOffset: true,
      fullscreenWeb: true,
      fullscreen: true,
      autoplay: true,
      pip: true,
      screenshot: true,
      airplay: true,
      playsInline: true,
      theme: '#007AE5',
      lang: locale.value.replace('_', '-'),
    })
  } else if (kind === 'audio') {
    // 封面 + 标题/艺术家(Vue2 mm.fetchFromUrl)—— 元数据失败不阻断播放
    try {
      const mm = await import('music-metadata-browser')
      const metadata = await mm.fetchFromUrl(url)
      const pic = metadata.common.picture?.[0]
      if (pic) {
        const blob = new Blob([new Uint8Array(pic.data)], { type: pic.format })
        poster.value = URL.createObjectURL(blob)
        if (wrap.value) {
          wrap.value.style.backgroundImage = `url(${poster.value})`
          wrap.value.style.backgroundSize = 'cover'
          wrap.value.style.backgroundPosition = 'center'
        }
      }
      if (metadata.common.title) audioTitle.value = metadata.common.title
      if (metadata.common.artist) audioArtist.value = metadata.common.artist
    } catch {
      /* 元数据失败不阻断播放 */
    }
    const APlayer = (await import('aplayer')).default
    await import('aplayer/dist/APlayer.min.css')
    apInst = new APlayer({
      container: audioEl.value!,
      autoplay: true,
      preload: 'auto',
      theme: '#41b883',
      audio: [{ name: audioTitle.value, artist: audioArtist.value, url, cover: poster.value }],
    })
  }
})
onBeforeUnmount(() => {
  if (artInst?.destroy) artInst.destroy(false)
  if (apInst?.destroy) apInst.destroy()
  if (poster.value) URL.revokeObjectURL(poster.value)
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download')">
    <div ref="wrap" class="media-wrap" :class="{ audio: kind === 'audio' }">
      <div v-if="kind === 'audio' && poster" class="audio-blur"></div>
      <div v-if="kind === 'video'" ref="videoEl" class="media-video"></div>
      <div v-else-if="kind === 'audio'" ref="audioEl" class="media-audio"></div>
    </div>
  </ViewerShell>
</template>

<style scoped>
.media-wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.media-video { width: 100%; height: 100%; }
.media-audio { width: 100%; max-width: 80rem; position: relative; z-index: 1; padding: 0 24px; }
.audio-blur {
  position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center;
  background-color: rgba(53, 54, 58, 0.4); backdrop-filter: blur(10px) saturate(180%);
}
</style>

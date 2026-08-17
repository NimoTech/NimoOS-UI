<!-- Message list + composer for Ask Nimo, shared by the popup and the drawer. Pixel source:
     Vue2 NimoOS-UI src/views/Photos/PhotosAgentChat.vue (markup + logic) + Task 5's ported
     .nimo-md/.nimo-tool-line/.nimo-photo-grid/.nimo-typing/.nimo-ctx-chip rules.
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { renderMarkdown } from '../../../ai/markdown/renderMarkdown'
import { useLightbox } from '../../lightbox/useLightbox'
import type { Photo } from '../../util/assetToPhoto'
import type { AgentBlock, AgentMessage } from '../../../ai/types'
import AskNimoConfirm, { type ConfirmLikeBlock } from './AskNimoConfirm.vue'
import type { AskNimoContextPhoto, AskNimoContextAlbum } from '../../composables/useAskNimo'

const props = defineProps<{
  fullscreen?: boolean
  prefill?: string
  contextPhoto?: AskNimoContextPhoto | null
  contextAlbum?: AskNimoContextAlbum | null
}>()
const emit = defineEmits<{
  (e: 'prefill-consumed'): void
  (e: 'context-consumed'): void
  (e: 'album-context-consumed'): void
}>()

const { t } = useI18n()
const agent = useAgentStore('photos')
const lightbox = useLightbox()

const historyRef = ref<HTMLElement | null>(null)
const text = ref('')

interface PhotoGridBlock extends AgentBlock {
  query?: string
  photos: Array<{ id: string | number; name: string; takenAt: unknown; thumbUrl: string }>
}
interface ToolLikeBlock extends AgentBlock {
  state?: string
  name?: string
  command?: string
  sections?: Array<{ label: string; code: string }>
}

const RENDERED_TYPES = new Set(['md', 'tool', 'terminal', 'photo_grid', 'confirm', 'access_request'])
function isRendered(block: AgentBlock): boolean {
  return RENDERED_TYPES.has(block.type)
}
function toolLabel(block: ToolLikeBlock): string {
  return block.name || block.command || 'tool'
}
function toolErrorText(block: ToolLikeBlock): string {
  const code = block.sections?.[0]?.code || block.command || ''
  return `${toolLabel(block)} · ${code.slice(0, 120)}`
}
function hasVisibleContent(blocks: AgentBlock[] | undefined): boolean {
  return !!blocks?.some(isRendered)
}

function md(block: AgentBlock, streaming: boolean): string {
  const html = renderMarkdown(String((block as { text?: string }).text || ''))
  return streaming ? html + '<span class="msg-cursor"></span>' : html
}

type PhotoGridTile = { id: string | number; name: string; takenAt: unknown; thumbUrl: string }

function toPhotoStub(tile: PhotoGridTile): Photo {
  return {
    id: tile.id, title: tile.name, file: '', date: '', time: '',
    takenAt: (tile.takenAt as string | number | null) ?? null, indexedAt: null, mimeType: '',
    fileSize: 0, isVideo: false, hasOcr: false, isNew: false, pinned: false, isLivePhoto: false,
    livePhotoVideoId: null, duration: null, durationMs: 0, fav: false, status: undefined,
    filePath: tile.name, width: null, height: null, dim: null, size: '', latitude: null,
    longitude: null, coords: null, place: null, camera: null, iso: null, shutter: null, aperture: null,
  } as Photo
}

// Re-check N-4: `allTiles` is always the FULL block.photos array (verbatim Vue2
// `openPhoto(p, block.photos)` / `openPhoto(block.photos[11], block.photos)`), not just the
// clicked tile -- this is what gives the lightbox left/right paging across the whole grid result.
function openPhotoTile(tile: PhotoGridTile, allTiles: PhotoGridTile[]): void {
  lightbox.searchQuery.value = ''
  const entryList = allTiles.map(toPhotoStub)
  const current = entryList.find((p) => p.id === tile.id) ?? toPhotoStub(tile)
  lightbox.openAt(current, entryList)
}

const busy = computed(() => agent.busy)
// Preflight F-12: agentStore.ts's own `AgentMessage = Record<string, unknown>` is a different,
// looser type than the one imported above from types.ts -- this cast is the single seam where
// the widen happens, so every read below (`messages.value`) is properly typed.
const messages = computed(() => agent.messages as unknown as AgentMessage[])
const lastMessage = computed(() => messages.value[messages.value.length - 1])

watch(() => agent.messages, () => {
  nextTick(() => {
    if (historyRef.value) historyRef.value.scrollTop = historyRef.value.scrollHeight
  })
}, { deep: true })

watch(() => props.prefill, (v) => {
  if (v) {
    text.value = v
    nextTick(() => emit('prefill-consumed'))
  }
}, { immediate: true })

onMounted(() => {
  nextTick(() => {
    if (historyRef.value) historyRef.value.scrollTop = historyRef.value.scrollHeight
  })
})

function suggest(s: string): void {
  text.value = s
}

async function onSend(): Promise<void> {
  const value = text.value.trim()
  if (!value || !agent.selectedModel) return
  const photo = props.contextPhoto
  const album = props.contextAlbum
  const contextPhoto = photo && photo.id != null ? { id: String(photo.id), name: photo.name, takenAt: photo.takenAt, place: photo.place } : null
  const contextAlbum = album && album.id != null ? { id: String(album.id), name: album.name } : null
  text.value = ''
  if (photo) emit('context-consumed')
  if (album) emit('album-context-consumed')
  await agent.send({ text: value, contextPhoto, contextAlbum })
}
async function onStop(): Promise<void> {
  await agent.stop()
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void onSend()
  }
}
</script>

<template>
  <div class="nimo-chat" :class="{ 'is-fullscreen': fullscreen }">
    <div ref="historyRef" class="nimo-chat-history">
      <template v-for="m in messages" :key="m.id">
        <div v-if="m.role === 'user'" class="msg msg-u"><span class="msg-content">{{ m.content }}</span></div>
        <div v-else-if="m.role === 'assistant'" class="msg msg-a">
          <template v-for="(block, i) in (m.blocks || []).filter(isRendered)" :key="i">
            <div v-if="block.type === 'md'" class="nimo-md" v-html="md(block, !!m.streaming)" />
            <div
              v-else-if="block.type === 'tool' || block.type === 'terminal'"
              class="nimo-tool-line"
              :class="{ 'is-running': (block as ToolLikeBlock).state === 'running', 'is-error': (block as ToolLikeBlock).state === 'error' }"
            >
              <span v-if="(block as ToolLikeBlock).state === 'error'" class="nimo-tool-err">{{ toolErrorText(block as ToolLikeBlock) }}</span>
              <template v-else>⚡ {{ toolLabel(block as ToolLikeBlock) }}<template v-if="(block as ToolLikeBlock).state === 'running'">…</template></template>
            </div>
            <div v-else-if="block.type === 'photo_grid'" class="nimo-photo-grid">
              <div v-if="(block as PhotoGridBlock).query" class="nimo-photo-grid-label">{{ (block as PhotoGridBlock).query }}</div>
              <div class="nimo-photo-grid-tiles">
                <!-- Re-check N-4: verbatim Vue2 PhotosAgentChat.vue:36-60 semantics -- always
                     slice(0,12); slot pi===11 (the 12th) only becomes the +N badge when
                     length > 12, otherwise (<=12 photos) all 12 slots render as real tiles. -->
                <template v-for="(tile, pi) in (block as PhotoGridBlock).photos.slice(0, 12)" :key="tile.id">
                  <div
                    v-if="pi < 11 || (block as PhotoGridBlock).photos.length <= 12" class="nimo-photo-tile"
                    @click="openPhotoTile(tile, (block as PhotoGridBlock).photos)"
                  >
                    <img :src="tile.thumbUrl" loading="lazy" alt="">
                  </div>
                  <div
                    v-else class="nimo-photo-tile nimo-photo-tile-more"
                    @click="openPhotoTile((block as PhotoGridBlock).photos[11], (block as PhotoGridBlock).photos)"
                  >
                    +{{ (block as PhotoGridBlock).photos.length - 11 }}
                  </div>
                </template>
              </div>
            </div>
            <AskNimoConfirm v-else-if="block.type === 'confirm' || block.type === 'access_request'" :block="(block as ConfirmLikeBlock)" />
          </template>
          <span v-if="busy && m === lastMessage && !hasVisibleContent(m.blocks)" class="nimo-typing">…</span>
        </div>
      </template>
      <div v-if="busy && lastMessage?.role !== 'assistant'" class="msg msg-a"><span class="nimo-typing">…</span></div>
    </div>

    <div class="nimo-chat-input">
      <div v-if="contextPhoto" class="nimo-ctx-chip">
        <span class="nimo-ctx-chip-label">📷 {{ contextPhoto.name }}</span>
        <button type="button" class="nimo-ctx-chip-x" @click="emit('context-consumed')">×</button>
      </div>
      <div v-if="contextAlbum" class="nimo-ctx-chip">
        <span class="nimo-ctx-chip-label">📁 {{ contextAlbum.name }}</span>
        <button type="button" class="nimo-ctx-chip-x" @click="emit('album-context-consumed')">×</button>
      </div>
      <textarea v-model="text" class="nimo-chat-textarea" :placeholder="t('photosAskNimoPlaceholder')" @keydown="onKey" />
      <div class="nimo-chat-foot-row">
        <button type="button" class="nimo-chat-suggest" @click="suggest(t('photosSuggestLastWeekend'))">{{ t('photosSuggestLastWeekend') }}</button>
        <button type="button" class="nimo-chat-suggest" @click="suggest(t('photosSuggestBestSunsets'))">{{ t('photosSuggestBestSunsets') }}</button>
        <button type="button" class="nimo-chat-suggest" @click="suggest(t('photosSuggestFindPeople'))">{{ t('photosSuggestFindPeople') }}</button>
        <div class="nimo-chat-foot-spacer" />
        <button v-if="!busy" type="button" class="nimo-chat-btn nimo-chat-btn-send" :disabled="!text.trim() || !agent.selectedModel" @click="onSend">↑</button>
        <button v-else type="button" class="nimo-chat-btn nimo-chat-btn-stop" @click="onStop">■</button>
      </div>
    </div>
  </div>
</template>

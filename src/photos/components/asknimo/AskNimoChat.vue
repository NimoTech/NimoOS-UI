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
  // Review fix (MINOR #4): server-persisted history can carry a photo_grid block with no
  // `photos` field at all (e.g. a malformed/older record) -- optional, every dereference site
  // below falls back to an empty array rather than throwing on `.slice`/`.length`/`[11]`.
  photos?: Array<{ id: string | number; name: string; takenAt: unknown; thumbUrl: string }>
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
// Review fix (Vue2 wins, PhotosAgentChat.vue:181-184) -- verbatim truncate(): empty/falsy input
// renders as '', otherwise cut to `n` chars with a trailing ellipsis.
function truncate(str: string | undefined, n: number): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}
// Review fix (Vue2 wins, PhotosAgentChat.vue:27,32) -- `terminal` blocks always display the
// literal label 'terminal', never `block.name` (New-UI's terminal blocks don't carry `name` at
// all, see dispatchEvent.ts/streamMappers.ts -- they use `command`, which is not a label).
function toolLabel(block: ToolLikeBlock): string {
  return block.type === 'terminal' ? 'terminal' : (block.name || '')
}
// Review fix (Vue2 wins, PhotosAgentChat.vue:26-29) -- error text is `label · truncate(code,120)`;
// the code half comes solely from `sections[0].code` and renders as '' when absent (Vue2 has no
// `command` fallback here -- that would show raw shell input in place of the tool's ARGUMENTS/RESULT).
function toolErrorText(block: ToolLikeBlock): string {
  const code = block.sections?.[0]?.code
  return `${toolLabel(block)} · ${truncate(code, 120)}`
}
function hasVisibleContent(blocks: AgentBlock[] | undefined): boolean {
  return !!blocks?.some(isRendered)
}

// Review fix (MINOR #2) -- the streaming cursor keys off the BLOCK's own `streaming` flag
// (dispatchEvent.ts:71 sets it on append, :21-25 `endMessageStreaming` clears it), not the
// message's. A message can hold multiple md blocks across turns; only the block currently being
// appended to is streaming, not the whole message.
function md(block: AgentBlock): string {
  const html = renderMarkdown(String((block as { text?: string }).text || ''))
  return (block as { streaming?: boolean }).streaming ? html + '<span class="msg-cursor"></span>' : html
}

type PhotoGridTile = { id: string | number; name: string; takenAt: unknown; thumbUrl: string; isVideo?: boolean }

function toPhotoStub(tile: PhotoGridTile): Photo {
  return {
    id: tile.id, title: tile.name, file: '', date: '', time: '',
    takenAt: (tile.takenAt as string | number | null) ?? null, indexedAt: null, mimeType: '',
    fileSize: 0,
    // Review fix (MINOR #5) -- buildPhotoGridBlock (streamMappers.ts) never emits an `isVideo`
    // field on grid tiles today (photo_grid tiles are id/name/takenAt/thumbUrl only, no per-asset
    // metadata), so this is always false in practice. Read it defensively in case a future mapper
    // adds it, rather than hardcoding false, so the lightbox's video controls would light up
    // without another change here.
    isVideo: !!tile.isVideo, hasOcr: false, isNew: false, pinned: false, isLivePhoto: false,
    livePhotoVideoId: null, duration: null, durationMs: 0, fav: false, status: undefined,
    filePath: tile.name, width: null, height: null, dim: null, size: '', latitude: null,
    longitude: null, coords: null, place: null, camera: null, iso: null, shutter: null, aperture: null,
    // Cast covers the remaining optional Photo fields this stub can't populate from a grid tile:
    // focal/orientation/videoCodec/audioCodec/frameRate/bitRate/rotation/matchScore/matchedBy/
    // belowCut/tags/scene/faces -- none of these are available from photo_grid's minimal shape.
  } as Photo
}

// Re-check N-4: `allTiles` is always the FULL block.photos array (verbatim Vue2
// `openPhoto(p, block.photos)` / `openPhoto(block.photos[11], block.photos)`), not just the
// clicked tile -- this is what gives the lightbox left/right paging across the whole grid result.
function openPhotoTile(tile: PhotoGridTile, allTiles: PhotoGridTile[]): void {
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
  // Review fix (IMPORTANT #3, Vue2 wins PhotosAgentChat.vue:207) -- guard busy too: without this,
  // pressing Enter mid-stream wipes the textarea and consumes the context chips without actually
  // sending (send() itself no-ops while busy, but the UI-side wipe already happened).
  if (!value || agent.busy || !agent.selectedModel) return
  const photo = props.contextPhoto
  const album = props.contextAlbum
  // Review fix (MINOR #6, Vue2 wins :217-218) -- normalize missing takenAt/place to '', not undefined/null.
  const contextPhoto = photo && photo.id != null ? { id: String(photo.id), name: photo.name, takenAt: photo.takenAt || '', place: photo.place || '' } : null
  const contextAlbum = album && album.id != null ? { id: String(album.id), name: album.name } : null
  text.value = ''
  // Review fix (MINOR #6, Vue2 wins :220/:228) -- key the emit on the BUILT ctx, not the raw prop:
  // an id-less contextPhoto/contextAlbum builds to null and must NOT emit consumed -- the chip
  // stays visible (Vue2 never clears a chip it couldn't actually attach to the outgoing message).
  if (contextPhoto) emit('context-consumed')
  if (contextAlbum) emit('album-context-consumed')
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
            <div v-if="block.type === 'md'" class="nimo-md" v-html="md(block)" />
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
                     length > 12, otherwise (<=12 photos) all 12 slots render as real tiles.
                     Review fix (MINOR #4): `|| []` at every `.photos` dereference -- a
                     persisted photo_grid block missing the `photos` field must render an
                     empty grid, not throw. -->
                <template v-for="(tile, pi) in ((block as PhotoGridBlock).photos || []).slice(0, 12)" :key="tile.id">
                  <div
                    v-if="pi < 11 || ((block as PhotoGridBlock).photos || []).length <= 12" class="nimo-photo-tile"
                    @click="openPhotoTile(tile, (block as PhotoGridBlock).photos || [])"
                  >
                    <img :src="tile.thumbUrl" loading="lazy" :alt="tile.name">
                  </div>
                  <div
                    v-else class="nimo-photo-tile nimo-photo-tile-more"
                    @click="openPhotoTile(((block as PhotoGridBlock).photos || [])[11], (block as PhotoGridBlock).photos || [])"
                  >
                    +{{ ((block as PhotoGridBlock).photos || []).length - 11 }}
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

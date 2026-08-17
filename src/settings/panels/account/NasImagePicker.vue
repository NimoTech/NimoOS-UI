<script setup lang="ts">
// Pick avatar from NAS — maps to Vue2 AccountPanel state 6 (:763-846).
// Two views: storage card grid (nasView='storages') and directory browsing (nasView='browse').
// **Entirely read-only**: storage.list / raid.list / folder.getList / <img> fetches /v1/image, safe to click on a real device.
//
// 🔧 plan C11: after picking an image, Vue2 goes axios arraybuffer → Blob → createObjectURL, purely to
// sniff the mime type, and that mime type **has zero references in the template** (dead code) → here
// we use /v1/image?...&type=original directly as the <img src> (same-origin, works with the cropper),
// saving a layer of memory copying and producing no objectURL that needs revoking.
// 🔧 Vue2's loadNasFolder checks `res.data?.success === 200` (v1 envelope), but the shared package's
// folder.getList has already unwrapped it and hands back FolderListing directly → **don't check
// success again**, failures come through as an axios reject.
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { mapVolumes } from '../../../storage/util/storageMap'
import { renderSize } from '../../../files/util/format'
import {
  buildNasStorages, filterNasItems, nasBreadcrumbs, nasNavigateUpTarget,
  type NasStorage,
} from '../../util/nasStorages'
import '../../styles/settings.css'

// SP11: the payload carries both halves because the two consumers need different
// ones -- the avatar cropper wants a displayable URL, the wallpaper picker needs
// the on-disk NAS path to hand to PUT /users/current/image/wallpaper.
const emit = defineEmits<{ pick: [{ path: string; src: string }] }>()
const { t } = useI18n()

const view = ref<'storages' | 'browse'>('storages')
const storages = ref<NasStorage[]>([])
const storagesLoading = ref(false)
const items = ref<{ name: string; path: string; is_dir: boolean }[]>([])
const itemsLoading = ref(false)
const error = ref('')
const nasPath = ref('')
const nasRootPath = ref('')
const displayNames = ref<Record<string, string>>({})

// Inline generation guard (not extracted into a shared helper, plan C8). Listing a directory takes
// ~hundreds of milliseconds, and the user clicking a breadcrumb / up a level / a directory can all
// fire another request while one is in flight — "the previous one is still in flight, the next one
// has come back" is a genuine path, so seq is used to distinguish two requests from the same
// component (a boolean `alive` can't tell them apart).
let alive = true
let seq = 0
onUnmounted(() => {
  alive = false
})

async function loadStorages() {
  storagesLoading.value = true
  error.value = ''
  try {
    // Vue2 :278-281 calls $api.storage.list() (**no arguments**, not AppsPanel's {system:'show'}) +
    // raid.list() catches its own failure into an empty array — RAID being unreachable shouldn't take
    // down the whole screen. Copied as-is.
    const [rawStorage, rawRaid] = await Promise.all([
      service.storage.list(),
      service.raid.list().catch(() => [] as unknown[]),
    ])
    if (!alive) return
    // displayNames: only maps **non-root** mount points (their name is the volume label).
    // ⚠️ Why we don't map the root volume's label to "/DATA" (AppsPanel.vue:87-95 does that):
    // Vue2's displayNames comes from a dedicated endpoint `GET /v2/nimoos/local_storage/display_names`,
    // not derived from the volume label. Tested live on the device on 2026-08-01, that endpoint returns
    //   {"data":{"/DATA":"NimoOS-HD"},"message":""}   ← note the envelope is only data+message, **no success**
    // In other words, `/DATA`'s real display name **exactly equals** Vue2's hardcoded fallback value 'NimoOS-HD'.
    // And the local_storage domain, per the SP6 decision, doesn't go into the shared package, and this
    // period (spec §5.7) only fills in the users domain → so we don't send that request here, and let
    // /DATA fall back to buildNasStorages' 'NimoOS-HD', matching the real device's behavior byte for byte.
    // ⚠️ `/DATA` must be **seeded into the map**, not left to buildNasStorages' fallback alone: the
    // breadcrumbs go through nasBreadcrumbs → toVirtualPath(nasRootPath, displayNames), which has no
    // such fallback — when /DATA isn't in the map, the breadcrumb would show `DATA` while Vue2 on the
    // real device shows `NimoOS-HD` (a 1:1 mismatch).
    // What's seeded here is the real value curl'd above.
    // Leftover: if the user has renamed the system disk, this card and the breadcrumb will show
    // 'NimoOS-HD' instead of the custom name (debt).
    const map: Record<string, string> = { '/DATA': 'NimoOS-HD' }
    for (const v of mapVolumes(rawStorage)) {
      if (!v.mountPoint || v.mountPoint === '/') continue
      map[v.mountPoint] = v.name || v.mountPoint
    }
    displayNames.value = map
    storages.value = buildNasStorages(rawStorage, rawRaid, map)
  } catch (e) {
    if (!alive) return
    const r = e as { message?: string }
    error.value = r?.message || t('settingsAccLoadFolderFailed')
    storages.value = []
  } finally {
    if (alive) storagesLoading.value = false
  }
}
loadStorages()

async function openFolder(path: string) {
  const mySeq = ++seq
  itemsLoading.value = true
  error.value = ''
  try {
    const res = await service.folder.getList(path)
    if (!alive || mySeq !== seq) return
    nasPath.value = path
    items.value = filterNasItems(res?.content)
  } catch {
    if (!alive || mySeq !== seq) return
    error.value = t('settingsAccLoadFolderFailed')
    items.value = []
  } finally {
    if (alive && mySeq === seq) itemsLoading.value = false
  }
}

function enterStorage(s: NasStorage) {
  nasRootPath.value = s.path
  view.value = 'browse'
  openFolder(s.path)
}

function backToStorages() {
  view.value = 'storages'
  nasPath.value = ''
  nasRootPath.value = ''
  items.value = []
  error.value = ''
}

function up() {
  const target = nasNavigateUpTarget(nasPath.value, nasRootPath.value)
  if (!target) return // already at root; Vue2 :348 also just returns directly, no request sent
  openFolder(target)
}

const crumbs = computed(() => nasBreadcrumbs(nasPath.value, nasRootPath.value, displayNames.value))
const atRoot = computed(() => nasPath.value === nasRootPath.value)

function onItemClick(item: { path: string; is_dir: boolean }) {
  if (item.is_dir) openFolder(item.path)
  else emit('pick', { path: item.path, src: service.image.imageUrl(item.path, 'original') })
}

function sizeText(s: NasStorage): string {
  return `${renderSize((s.size || 0) - (s.avail || 0))} / ${renderSize(s.size || 0)}`
}

defineExpose({ backToStorages, openFolder, view })
</script>

<template>
  <div class="set-acc-nas">
    <!-- ── Storage card grid (Vue2 L766-789) ── -->
    <template v-if="view === 'storages'">
      <p v-if="storagesLoading" class="set-fp-empty">…</p>
      <p v-else-if="error" class="set-danger">{{ error }}</p>
      <div v-else class="set-nas-grid">
        <button
          v-for="s in storages" :key="s.path" class="set-nas-card" type="button"
          data-test="nas-storage" @click="enterStorage(s)"
        >
          <span class="set-nas-name">{{ s.name }}</span>
          <span v-if="s.size" class="set-nas-sub">{{ sizeText(s) }}</span>
        </button>
      </div>
    </template>

    <!-- ── Directory browsing (Vue2 L792-844) ── -->
    <template v-else>
      <div class="set-nas-toolbar">
        <button
          class="set-btn" type="button" :aria-label="t('settingsAccBack')"
          data-test="nas-back" @click="backToStorages"
        >‹</button>
        <div class="set-nas-crumbs" data-test="nas-crumbs">
          <!-- Copies Vue2 :803's `i < len-1 &&` guard: the last segment is not clickable -->
          <span
            v-for="(c, i) in crumbs" :key="c.path" class="set-nas-crumb"
            :class="{ active: i === crumbs.length - 1 }" data-test="nas-crumb"
            @click="i < crumbs.length - 1 && openFolder(c.path)"
          >{{ c.name }}<span v-if="i < crumbs.length - 1" class="set-nas-crumb-sep">/</span></span>
        </div>
        <button
          class="set-btn" type="button" :disabled="atRoot" aria-label="↑"
          data-test="nas-up" @click="up"
        >↑</button>
      </div>

      <p v-if="itemsLoading" class="set-fp-empty">…</p>
      <p v-else-if="error" class="set-danger">{{ error }}</p>
      <p v-else-if="!items.length" class="set-fp-empty">{{ t('settingsAccNoImagesHere') }}</p>
      <div v-else class="set-nas-items">
        <button
          v-for="it in items" :key="it.path" class="set-nas-item" type="button"
          data-test="nas-item" @click="onItemClick(it)"
        >
          <!-- This is a **type marker** (not an action button), keeping the colored emoji: Vue2 also
               used colored mdi icons (orange for folder, purple for image). ⚠️ Shows as an empty box in
               headless screenshots (missing emoji glyph), fine in a real browser — already listed in the
               acceptance checklist. -->
          <span class="set-nas-item-icon" aria-hidden="true">{{ it.is_dir ? '📁' : '🖼' }}</span>
          <span class="set-nas-item-name">{{ it.name }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

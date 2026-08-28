<script setup lang="ts">
// Settings · Folder permissions. 1:1 parity with the Vue 2 panel's
// src/components/settings/FolderPermissions.vue (337 lines).
//
// ⚠️ **spec §5.7 describes this as a "permission matrix" (header / rows / a toggle
// column per subsystem), which doesn't match the source** — Vue2 is actually **four
// vertically stacked sections** (filename index / knowledge base / folders hidden
// from AI / photos), each with its own list, with no matrix header and no columns.
// Following the P0 precedent "when spec and source disagree, source wins, UI is
// strictly 1:1", this builds four sections to match the source (plan C3).
//
// ⚠️ Per spec §3.1 **policy three**, this milestone only builds the UI skeleton:
// the data source is folderPermissionsSnapshot.ts's stub implementation (all four
// paths offline), and write operations are disabled. After sp7/sp8 merge, only the
// two functions in that file need to be swapped in (debt D11).
// The empty snapshot's four-path offline state conveniently reuses Vue2's "service
// offline" form, so no separate empty state needs to be invented.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
import FolderPickerDialog from './folderPerm/FolderPickerDialog.vue'
import type { FolderPermSnapshot } from '../util/folderPermissions'
import { emptySnapshot, fetchSnapshot, WIRED } from '../util/folderPermissionsSnapshot'
import {
  aiItems, knowledgeExcludeItems, knowledgeRootItems, photosItems, searchItems,
} from '../util/folderPermissionsView'
import { pickerRoots } from '../util/folderBrowser'
import '../styles/settings.css'

const { t } = useI18n()

const snap = ref<FolderPermSnapshot>(emptySnapshot())
const loading = ref(false)

// Inline stale-response guard (not extracted into a shared helper — reviewer judged
// that premature, plan C8). This panel **genuinely has a second trigger point**
// (the refresh button), so the guard isn't a no-op: when refresh is clicked
// repeatedly in quick succession, or the tab is switched right after clicking, a
// response that settles later must not be allowed to write back.
let alive = true
let seq = 0
onUnmounted(() => {
  alive = false
})

async function reload() {
  const mySeq = ++seq
  loading.value = true
  try {
    const s = await fetchSnapshot()
    if (!alive || mySeq !== seq) return
    snap.value = s
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
onMounted(reload)

const offline = computed(() => snap.value.offline)
const photosAuto = computed(() => snap.value.photos.auto && !snap.value.photos.stale)
const photosStale = computed(() => snap.value.photos.stale)
const lists = computed(() => ({
  search: searchItems(snap.value),
  knowledgeRoots: knowledgeRootItems(snap.value),
  knowledgeExcludes: knowledgeExcludeItems(snap.value),
  ai: aiItems(snap.value),
  photos: photosItems(snap.value),
}))
const browserRoots = computed(() => pickerRoots(snap.value.candidates))

// Add dialog: this milestone only makes it openable, with the confirm button always
// disabled (policy three). target keeps Vue2's 5 possible values so that wiring it up
// can just follow Vue2 confirmAdd()'s (L304-323) branching directly.
type AddTarget = 'search' | 'knowledge-root' | 'knowledge-exclude' | 'ai' | 'photos'
const adding = ref(false)
const addTarget = ref<AddTarget>('search')
function openAdd(target: AddTarget) {
  addTarget.value = target
  adding.value = true
}
const addTitle = computed(() =>
  addTarget.value === 'knowledge-exclude' ? t('settingsFpAddExclusion') : t('settingsFpAddFolder'),
)
</script>

<template>
  <SettingsSection :title="t('settingsTabFolderPermissions')">
    <!-- Header: Vue2 L3-8's description + refresh button -->
    <div class="set-fp-head">
      <p class="set-fp-intro">{{ t('settingsFpIntro') }}</p>
      <button class="set-btn" type="button" data-test="fp-refresh" :disabled="loading" @click="reload">
        ⟳
      </button>
    </div>

    <!-- New this milestone (Vue2 doesn't have this): policy three requires flagging the stubbed data source in the UI -->
    <p v-if="!WIRED" class="set-info" data-test="fp-pending">{{ t('settingsFpDataPending') }}</p>

    <!-- ① Filename index (Vue2 L10-36) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpFilenameIndex') }}</span>
        <span v-if="offline.search" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <button v-else class="set-btn" type="button" data-test="fp-add-search" @click="openAdd('search')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpFilenameDesc') }}</p>
      <template v-if="!offline.search">
        <!-- Add when wiring up D11: rows with !coveredBy need a delete button → run(path,'search',false) (Vue2 L30) -->
        <div v-for="it in lists.search" :key="`s-${it.path}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.search.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>
      </template>
    </div>

    <!-- ② Knowledge base (Vue2 L38-81) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpKnowledge') }}</span>
        <span v-if="offline.knowledge" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpKnowledgeDesc') }}</p>
      <template v-if="!offline.knowledge">
        <div class="set-fp-sub-head">
          <span class="set-fp-sub-title">{{ t('settingsFpIndexedFolders') }}</span>
          <button class="set-btn" type="button" data-test="fp-add-knowledge-root" @click="openAdd('knowledge-root')">
            + {{ t('settingsFpAddFolder') }}
          </button>
        </div>
        <!-- Add when wiring up D11: a toggle per row → run(path,'knowledge',v) (Vue2 L58-61) -->
        <div v-for="it in lists.knowledgeRoots" :key="`kr-${it.rootId}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
        </div>
        <p v-if="!lists.knowledgeRoots.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>

        <div class="set-fp-sub-head">
          <span class="set-fp-sub-title">{{ t('settingsFpExcludedSubfolders') }}</span>
          <button class="set-btn" type="button" data-test="fp-add-knowledge-exclude" @click="openAdd('knowledge-exclude')">
            + {{ t('settingsFpAddExclusion') }}
          </button>
        </div>
        <!-- Add when wiring up D11: a delete button per row → removeDenyRule(it.id) (Vue2 L75) -->
        <div v-for="it in lists.knowledgeExcludes" :key="`ke-${it.id}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
        </div>
        <p v-if="!lists.knowledgeExcludes.length" class="set-fp-empty">{{ t('settingsFpNoExclusions') }}</p>
      </template>
    </div>

    <!-- ③ Folders hidden from AI (Vue2 L83-115) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpAiHidden') }}</span>
        <span class="set-fp-tag">{{ t('settingsFpCurrentUserOnly') }}</span>
        <span v-if="offline.ai" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <button v-else class="set-btn" type="button" data-test="fp-add-ai" @click="openAdd('ai')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpAiDesc') }}</p>
      <template v-if="!offline.ai">
        <!-- Add when wiring up D11: a delete button per row → run(path,'ai',true) (Vue2 L106) -->
        <div v-for="it in lists.ai.items" :key="`a-${it.id}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.ai.items.length" class="set-fp-empty">{{ t('settingsFpNoAiBlocked') }}</p>
        <p v-if="lists.ai.globCount" class="set-fp-desc">
          {{ t('settingsFpGlobRules', { n: lists.ai.globCount }) }}
        </p>
      </template>
    </div>

    <!-- ④ Photos (Vue2 L117-155) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpPhotos') }}</span>
        <span v-if="offline.photos" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <span v-else-if="photosStale" class="set-fp-tag">{{ t('settingsFpUpdateRequired') }}</span>
        <button v-else-if="!photosAuto" class="set-btn" type="button" data-test="fp-add-photos" @click="openAdd('photos')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpPhotosDesc') }}</p>
      <template v-if="!offline.photos && !photosStale">
        <p v-if="photosAuto" class="set-info">{{ t('settingsFpPhotosAuto') }}</p>
        <!-- Add when wiring up D11: non-auto rows with !coveredBy need a delete button →
             run(path,'photos',false) (Vue2 L143); when photosAuto, there's also a
             "switch to manual management" button at the bottom → materialize() (L148) -->
        <div v-for="it in lists.photos" :key="`p-${it.path}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.photos.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>
      </template>
      <p v-else-if="photosStale" class="set-fp-desc">{{ t('settingsFpPhotosStale') }}</p>
    </div>

    <FolderPickerDialog v-model:open="adding" :title="addTitle" :roots="browserRoots" />
  </SettingsSection>
</template>

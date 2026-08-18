<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import StoreCard from '../components/StoreCard.vue'
import CategoryBar from '../components/CategoryBar.vue'
import FeaturedStrip from '../components/FeaturedStrip.vue'
import PreInstallTips from '../components/PreInstallTips.vue'
import { useAppstoreStore, ALL } from '../stores/appstore'
import { mapStoreApp, filterStoreApps } from '../util/storeApp'
import { useInstallFlow } from '../composables/useInstallFlow'
import { useDeviceArch } from '../composables/useDeviceArch'
import { useInstallProgressStore } from '../stores/installProgress'
import type { StoreApp } from '../util/storeApp'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAppstoreStore()

const { isCompatible } = useDeviceArch()
const { tipsDlg, requestInstall, confirmTips } = useInstallFlow()
const progress = useInstallProgressStore()

function onInstall(a: StoreApp) {
  requestInstall({ id: a.id, title: a.title, icon: a.icon, tips: a.tips })
}
/** Featured cards only carry an id: look up the raw data in store.featured/list */
function onInstallById(id: string) {
  const raw = store.featured[id] ?? store.list[id]
  if (!raw) return
  const a = mapStoreApp(id, raw, locale.value)
  onInstall(a)
}
const percentOf = (id: string) => {
  const task = progress.tasks[id]
  return task && task.state === 'installing' ? task.percent : null
}
const compatibleOf = (id: string) => {
  const raw = store.list[id] ?? store.featured[id]
  return isCompatible(Array.isArray(raw?.architectures) ? (raw!.architectures as string[]) : undefined)
}

// Three deep-link params (spec §3.1): ?category= / ?author= / ?search=; single source of truth = route query
const category = computed(() => (typeof route.query.category === 'string' && route.query.category) || ALL)
const author = computed(() => (typeof route.query.author === 'string' && route.query.author) || ALL)
const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')

// Author filter: static menu as in Vue2 (All/official/by_nimoos/community → author_type parameter)
const AUTHORS = [
  { value: ALL, labelKey: 'appsStoreAll' },
  { value: 'official', labelKey: 'appsStoreAuthorOfficial' },
  { value: 'by_nimoos', labelKey: 'appsStoreAuthorByNimoos' },
  { value: 'community', labelKey: 'appsStoreAuthorCommunity' },
]

// Search input: write query after 250ms debounce (same as Vue2); external query changes (back navigation) flow back into the input
const searchInput = ref(search.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if ((v || '') === search.value) return
    router.replace({ query: { ...route.query, search: v || undefined } })
  }, 250)
})
watch(search, (v) => { if (v !== searchInput.value) searchInput.value = v })
// On unmount (e.g. clicking a card to navigate to the detail page) clear any pending debounce timer --
// otherwise a setTimeout left in the 250ms window would fire an extra replace on the router
// captured by the destroyed component after leaving this page.
onUnmounted(() => clearTimeout(timer))

// Category/author are backend parameters: refetch on query change; search is frontend-only, no refetch
watch([category, author], () => { store.loadCatalog(category.value, author.value) })
onMounted(() => {
  store.loadCatalog(category.value, author.value)
  store.loadFeatured()
})

const items = computed(() => Object.entries(store.list).map(([id, raw]) => mapStoreApp(id, raw, locale.value)))
const shown = computed(() => filterStoreApps(items.value, search.value))
const featuredItems = computed(() =>
  Object.entries(store.featured).map(([id, raw]) => mapStoreApp(id, raw, locale.value)),
)
// The featured strip only shows in the unfiltered, unsearched first-screen context -- when filtering/searching, the list is the answer the user wants and the strip is noise
const showFeatured = computed(() => category.value === ALL && author.value === ALL && !search.value)

function setCategory(name: string) {
  router.replace({ query: { ...route.query, category: name === ALL ? undefined : name } })
}
function setAuthor(v: string) {
  router.replace({ query: { ...route.query, author: v === ALL ? undefined : v } })
}
function openDetail(id: string) {
  router.push({ name: 'apps-store-detail', params: { id } })
}
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <div v-if="store.error" class="store-error">
          <p>{{ t('appsStoreLoadFailed') }}</p>
          <button class="store-retry" type="button" @click="store.retry()">{{ t('appsStoreRetry') }}</button>
        </div>
        <template v-else>
          <div class="store-toolbar">
            <CategoryBar :categories="store.categories" :current="category" @select="setCategory" />
            <div class="store-toolbar-row">
              <select class="store-author" :value="author" @change="setAuthor(($event.target as HTMLSelectElement).value)">
                <option v-for="a in AUTHORS" :key="a.value" :value="a.value">{{ t(a.labelKey) }}</option>
              </select>
              <label class="store-search">
                <input v-model="searchInput" type="search" :placeholder="t('appsStoreSearch')" />
              </label>
            </div>
          </div>
          <FeaturedStrip
            v-if="showFeatured"
            :items="featuredItems" :installed="store.isInstalled"
            :progress="percentOf" :compatible="compatibleOf"
            @open="openDetail"
            @install="onInstallById"
          />
          <p v-if="!store.loading && !shown.length" class="apps-empty">{{ t('appsStoreEmpty') }}</p>
          <div v-else class="apps-grid">
            <StoreCard
              v-for="a in shown" :key="a.id"
              :app="a" :installed="store.isInstalled(a.id)"
              :compatible="compatibleOf(a.id)" :percent="percentOf(a.id)"
              @open="openDetail(a.id)"
              @install="onInstall(a)"
            />
          </div>
        </template>
      </main>
    </div>
    <PreInstallTips
      :open="tipsDlg.open" :text="tipsDlg.text"
      @update:open="(v) => { if (!v) tipsDlg.open = false }"
      @confirm="confirmTips"
    />
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; }
.apps-empty { color: var(--fg-muted); font-size: 14px; padding: 24px 8px; }
.apps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }

.store-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.store-toolbar-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.store-author {
  font-size: 13px; padding: 6px 10px; color: var(--fg);
  background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 10px;
}
/* `.store-author` is a <select>, and above we set background to var(--chip-bg) -- in the dark theme
 * that is a **semi-transparent white gradient**. Once the author sets a background on a <select>,
 * Chrome carries it onto the popup list, but native options **do not render gradients** (falling back
 * to the browser default white background), which combined with a near-white --fg gives white-on-white text.
 * color-scheme: dark on the root cannot save it (author background wins). Guard: styles/selectPopup.test.ts. */
.store-author option,
.store-author optgroup {
  background-color: var(--set-option-bg);
  color: var(--set-option-fg);
}
.store-search { flex: 1 1 200px; }
.store-search input {
  width: 100%; box-sizing: border-box; font-size: 13px; padding: 7px 12px;
  color: var(--fg); background: var(--chip-bg);
  border: 1px solid var(--card-border); border-radius: 10px; outline: none;
}
.store-search input:focus { border-color: var(--accent-soft-bd); }
.store-search input::placeholder { color: var(--fg-muted); }

.store-error { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }
.store-retry {
  margin-top: 12px; font-size: 13px; padding: 6px 18px; cursor: pointer;
  color: var(--accent-text); background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd); border-radius: 10px;
}
@media (max-width: 768px) { .apps-layout { gap: 0; } }
</style>

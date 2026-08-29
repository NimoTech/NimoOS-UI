<!-- src/apps/views/SourcesPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import { useSourcesStore } from '../stores/sources'
import { sourceDisplayName, isOfficialSource } from '../util/sourceMeta'
import type { AppStoreSource } from '@nimotech/nimoos-service'

const { t } = useI18n()
const store = useSourcesStore()

const url = ref('')
const formError = ref('')
const URL_RE = /^https?:\/\/./i
const canSubmit = computed(() => !store.registeringUrl && URL_RE.test(url.value.trim()))

async function onAdd() {
  const target = url.value.trim()
  if (!URL_RE.test(target)) {
    formError.value = t('appsSourcesInvalidUrl')
    return
  }
  formError.value = ''
  try {
    await store.register(target)
    url.value = ''
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}

// reka timing trap: AlertDialogAction is also a DialogClose, so update:open(false) fires before confirm —
// store open and the target separately; read the target in confirm before clearing it, never clear it in update:open
const delOpen = ref(false)
const delTarget = ref<AppStoreSource | null>(null)
function askRemove(s: AppStoreSource) {
  delTarget.value = s
  delOpen.value = true
}
function confirmRemove() {
  const s = delTarget.value
  delOpen.value = false
  delTarget.value = null
  if (s) void store.unregister(s.id)
}

// Community-maintained list of third-party stores (original CasaOS-ecosystem page; the awesome.nimoos.io used in Vue2 is a dead rebranded link, the domain does not exist)
const MORE_URL = 'https://awesome.casaos.io/content/3rd-party-app-stores/list.html'

onMounted(() => {
  void store.load()
})
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <h2 class="src-title">{{ t('appsSourcesTitle') }}</h2>
        <p class="src-desc">
          {{ t('appsSourcesDesc') }}
          <a class="src-more" :href="MORE_URL" target="_blank" rel="noopener">{{ t('appsSourcesMore') }}</a>
        </p>

        <form class="src-add" @submit.prevent="onAdd">
          <!-- While registering, don't lock the input (the user can prepare the next URL), only lock submit (canSubmit) —
               the single-flight constraint lives in the store.register pre-guard; the completion event carries no URL, so concurrent registrations can't be attributed -->
          <input
            v-model="url"
            class="src-input"
            type="text"
            :placeholder="t('appsSourcesAddPlaceholder')"
          />
          <button class="bar-btn src-add-btn" type="submit" :disabled="!canSubmit">
            {{ t('appsSourcesAdd') }}
          </button>
        </form>
        <p v-if="formError" class="src-form-error">{{ formError }}</p>

        <div v-if="store.registeringUrl" class="src-pending">
          <span class="src-spinner" aria-hidden="true"></span>
          <div class="src-text">
            <div class="src-name">{{ sourceDisplayName(store.registeringUrl) }}</div>
            <div class="src-url">{{ store.registeringUrl }}</div>
          </div>
          <span class="src-pending-hint">{{ t('appsSourcesAdding') }}</span>
        </div>

        <div v-if="store.loading && !store.loaded" class="apps-empty">{{ t('appsSourcesLoading') }}</div>
        <div v-else-if="store.error" class="apps-empty">
          {{ t('appsSourcesLoadFailed') }}
          <button class="bar-btn" type="button" @click="store.load()">{{ t('appsSourcesRetry') }}</button>
        </div>
        <ul v-else-if="store.sources.length" class="src-list">
          <li v-for="s in store.sources" :key="s.id" class="src-item">
            <div class="src-text">
              <div class="src-name">
                {{ sourceDisplayName(s.url) }}
                <span v-if="isOfficialSource(s.url)" class="src-badge">{{ t('appsSourcesOfficial') }}</span>
              </div>
              <div class="src-url">{{ s.url }}</div>
            </div>
            <button
              v-if="!isOfficialSource(s.url)"
              class="bar-btn src-remove"
              type="button"
              @click="askRemove(s)"
            >
              {{ t('appsSourcesRemove') }}
            </button>
          </li>
        </ul>
        <div v-else class="apps-empty">{{ t('appsSourcesEmpty') }}</div>
      </main>
    </div>

    <AlertDialog
      v-model:open="delOpen"
      :title="t('appsSourcesRemoveTitle')"
      :message="t('appsSourcesRemoveMsg', { name: delTarget ? sourceDisplayName(delTarget.url) : '' })"
      :confirm-text="t('appsSourcesRemove')"
      :cancel-text="t('appsCancel')"
      destructive
      @confirm="confirmRemove"
    />
  </AreaShell>
</template>

<style scoped>
/* Layout skeleton shared with the other apps pages (duplicated per page in scoped styles, established convention) */
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; }
.apps-empty { color: var(--fg-muted); font-size: 14px; padding: 24px 8px; display: flex; align-items: center; gap: 10px; }
@media (max-width: 768px) { .apps-layout { gap: 0; } }

.src-title { font-size: 18px; font-weight: 600; margin: 2px 0 4px; color: var(--fg); }
.src-desc { font-size: 13px; color: var(--fg-muted); margin: 0 0 14px; }
.src-more { color: var(--accent-text); margin-left: 6px; }

.src-add { display: flex; gap: 8px; }
.src-input {
  flex: 1 1 auto; min-width: 0; height: 34px; box-sizing: border-box; padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px;
}
.src-input:focus { outline: none; border-color: var(--accent); }
/* Primary action: bar-btn base + the same accent pill colors as the store "Install" button (StoreCard .store-install) */
.src-add-btn {
  flex: 0 0 auto;
  color: var(--accent-text); background: var(--accent-soft); border-color: var(--accent-soft-bd);
}
.src-add-btn:hover { background: var(--accent-soft-2); }
.src-add-btn:disabled { opacity: 0.55; cursor: default; }
.src-add-btn:disabled:hover { background: var(--accent-soft); }
.src-form-error { color: var(--remove-fg); font-size: 12px; margin: 6px 0 0; }

.src-pending {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-top: 12px;
  border: 1px dashed var(--card-border); border-radius: 12px; background: var(--chip-bg);
}
.src-pending-hint { font-size: 12px; color: var(--fg-muted); flex: 0 0 auto; }
.src-spinner {
  width: 14px; height: 14px; border-radius: 50%; flex: 0 0 auto;
  border: 2px solid var(--chip-border); border-top-color: var(--accent);
  animation: src-spin 0.8s linear infinite;
}
@keyframes src-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .src-spinner { animation: none; } }

.src-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.src-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px;
}
.src-text { flex: 1 1 auto; min-width: 0; }
.src-name { font-size: 14px; font-weight: 600; color: var(--fg); display: flex; align-items: center; gap: 8px; }
.src-badge {
  font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 999px;
  background: var(--accent-soft); border: 1px solid var(--accent-soft-bd); color: var(--accent-text);
}
.src-url {
  font-family: var(--font-mono, monospace); font-size: 12px; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Destructive action: bar-btn base + danger-colored text (same token convention as the card buttons) */
.src-remove { color: var(--remove-fg); flex: 0 0 auto; }
</style>

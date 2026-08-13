<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import SnapCarousel from '../../components/SnapCarousel.vue'
import PreInstallTips from '../components/PreInstallTips.vue'
import { useAppstoreStore } from '../stores/appstore'
import { resolveAppText } from '../util/appTitle'
import { renderMarkdown } from '../../files/viewers/renderMarkdown'
import { useInstallFlow } from '../composables/useInstallFlow'
import { useDeviceArch } from '../composables/useDeviceArch'
import { useInstallProgressStore } from '../stores/installProgress'
import { minMemoryMB } from '../util/composeSettings'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAppstoreStore()

const { isCompatible, archLabel } = useDeviceArch()
const { tipsDlg, requestInstall, confirmTips } = useInstallFlow()
const progress = useInstallProgressStore()

const id = computed(() => String(route.params.id ?? ''))
const minMB = ref<number | null>(null)

onMounted(() => {
  store.loadDetail(id.value)
  // Deep-linking straight to the detail page means the catalog isn't loaded → fetch it once to determine "installed" (the full catalog has no pagination anyway, acceptable cost)
  if (!store.catalogLoaded) store.loadCatalog().catch(() => {})
})

onMounted(() => {
  service.appstore.getAppCompose(id.value)
    .then((y) => { minMB.value = minMemoryMB(y, id.value) })
    .catch(() => { minMB.value = null }) // if unavailable just don't show it (silent failure, same as Featured)
})

const title = computed(() => resolveAppText(store.detail?.title, locale.value, id.value))
const tagline = computed(() => resolveAppText(store.detail?.tagline, locale.value, ''))
/** renderMarkdown is markdown-it with html:false — raw HTML is escaped, so v-html on its output is safe (§3.8-2) */
const descHtml = computed(() => renderMarkdown(resolveAppText(store.detail?.description, locale.value, '')))
const shots = computed(() => (Array.isArray(store.detail?.screenshot_link) ? store.detail.screenshot_link : []))
const installed = computed(() => store.isInstalled(id.value))

const task = computed(() => progress.tasks[id.value])
const compatible = computed(() =>
  isCompatible(Array.isArray(store.detail?.architectures) ? (store.detail!.architectures as string[]) : undefined),
)
function onInstall() {
  if (!store.detail) return
  requestInstall({
    id: id.value,
    title: title.value,
    icon: typeof store.detail.icon === 'string' ? store.detail.icon : '',
    tips: store.detail.tips,
  })
}
function backToStore() {
  router.push({ name: 'apps-store' })
}

// Screenshot zoom layer (hand-rolled overlay: same inline fullscreen mode as the P4a viewers, no Dialog import)
const zoomSrc = ref<string | null>(null)
function onZoomKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') zoomSrc.value = null
}
onMounted(() => document.addEventListener('keydown', onZoomKeydown))
onUnmounted(() => document.removeEventListener('keydown', onZoomKeydown))
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <button class="bar-btn detail-back" type="button" @click="backToStore">‹ {{ t('appsStoreBack') }}</button>

        <div v-if="store.detailError" class="detail-error">
          <p>{{ t('appsStoreDetailFailed') }}</p>
        </div>

        <template v-else-if="store.detail">
          <header class="detail-head">
            <img v-if="store.detail.icon" :src="String(store.detail.icon)" alt="" class="detail-icon" />
            <div class="detail-head-meta">
              <h2 class="detail-title">{{ title }}</h2>
              <p class="detail-tagline">{{ tagline }}</p>
              <span v-if="installed" class="store-badge">{{ t('appsStoreInstalled') }}</span>
              <div v-else-if="task && task.state === 'installing'" class="detail-progress">
                <div class="op-progress"><div class="op-progress-fill" :style="{ width: task.percent + '%' }" /></div>
                <span class="detail-progress-text">{{ t('appsInstallingPercent', { percent: task.percent }) }}</span>
              </div>
              <div v-else-if="task" class="detail-install-error">
                <span class="detail-error-text">{{ task.message || t('appsInstallStalled') }}</span>
                <button class="detail-install" type="button" @click="onInstall">{{ t('appsStoreInstall') }}</button>
              </div>
              <template v-else>
                <button class="detail-install" type="button" :disabled="!compatible" @click="onInstall">
                  {{ t('appsStoreInstall') }}
                </button>
                <p v-if="!compatible" class="detail-incompat">{{ t('appsStoreIncompatible', { arch: archLabel }) }}</p>
              </template>
            </div>
          </header>

          <dl class="detail-meta">
            <div v-if="store.detail.category" class="detail-meta-item">
              <dt>{{ t('appsStoreCategory') }}</dt>
              <dd>{{ store.detail.category }}</dd>
            </div>
            <div v-if="store.detail.developer" class="detail-meta-item">
              <dt>{{ t('appsStoreDeveloper') }}</dt>
              <dd>{{ store.detail.developer }}</dd>
            </div>
            <div v-if="minMB" class="detail-meta-item" data-test="detail-min-memory">
              <dt>{{ t('appsStoreMinMemory') }}</dt>
              <dd>{{ minMB }} MB</dd>
            </div>
          </dl>

          <SnapCarousel v-if="shots.length" class="detail-shots">
            <img
              v-for="s in shots" :key="s"
              :src="s" alt="" class="detail-shot" loading="lazy"
              @click="zoomSrc = s"
            />
          </SnapCarousel>

          <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown html:false, output already escaped -->
          <div class="detail-desc" v-html="descHtml"></div>
        </template>
      </main>
    </div>

    <div v-if="zoomSrc" class="shot-zoom" role="dialog" :aria-label="t('appsStoreZoomClose')" @click="zoomSrc = null">
      <img :src="zoomSrc" alt="" />
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
.detail-back { font-size: 13px; margin-bottom: 14px; }
.detail-error { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }

.detail-head { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; }
.detail-icon { width: 84px; height: 84px; border-radius: 18px; object-fit: cover; flex: 0 0 auto; }
.detail-head-meta { min-width: 0; }
.detail-title { font-size: 22px; font-weight: 600; margin: 0 0 4px; color: var(--fg); }
.detail-tagline { margin: 0 0 10px; font-size: 13.5px; color: var(--fg-muted); }
.store-badge {
  font-size: 12px; padding: 2px 10px; border-radius: 999px;
  color: var(--accent-text); background: var(--accent-soft);
}
.detail-install {
  font-size: 13.5px; padding: 7px 22px; cursor: pointer;
  color: var(--on-accent); background: var(--accent);
  border: none; border-radius: 10px;
}
.detail-install:hover { filter: brightness(1.08); }
.detail-install:disabled { opacity: 0.55; cursor: default; filter: none; }

.detail-progress { display: flex; align-items: center; gap: 10px; min-width: 240px; }
.op-progress { flex: 1 1 auto; height: 6px; border-radius: 999px; background: var(--chip-bg); overflow: hidden; }
.op-progress-fill { height: 100%; background: var(--accent); transition: width 0.2s; }
.detail-progress-text { font-size: 12.5px; color: var(--fg-muted); white-space: nowrap; }
.detail-install-error { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.detail-error-text { font-size: 13px; color: var(--remove-fg); }
.detail-incompat { margin: 8px 0 0; font-size: 12.5px; color: var(--fg-muted); }

.detail-meta { display: flex; gap: 28px; margin: 0 0 18px; }
.detail-meta-item dt { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 2px; }
.detail-meta-item dd { font-size: 13.5px; margin: 0; color: var(--fg); }

.detail-shots { margin-bottom: 18px; }
.detail-shot { height: 210px; border-radius: var(--radius); cursor: zoom-in; object-fit: cover; }

.detail-desc { font-size: 14px; line-height: 1.7; color: var(--fg); max-width: 760px; overflow-wrap: anywhere; }
.detail-desc :deep(a) { color: var(--accent); }
.detail-desc :deep(img) { max-width: 100%; }
.detail-desc :deep(code) { background: var(--chip-bg); border-radius: 4px; padding: 1px 5px; word-break: break-all; }
/* Same as PreInstallTips: fenced code blocks wrap instead of stretching the description area horizontally */
.detail-desc :deep(pre) {
  background: var(--chip-bg); border-radius: 8px; padding: 10px 12px; margin: 8px 0;
  white-space: pre-wrap; word-break: break-all; max-width: 100%;
}
.detail-desc :deep(pre code) { background: none; padding: 0; }

.shot-zoom {
  position: fixed; inset: 0; z-index: 200; cursor: zoom-out;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg);
}
.shot-zoom img { max-width: 92vw; max-height: 92vh; border-radius: var(--radius); }
@media (max-width: 768px) { .apps-layout { gap: 0; } .detail-meta { flex-wrap: wrap; gap: 16px; } }
</style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import SnapCarousel from '../../components/SnapCarousel.vue'
import { useAppstoreStore } from '../stores/appstore'
import { resolveAppText } from '../util/appTitle'
import { renderMarkdown } from '../../files/viewers/renderMarkdown'
import { useToast } from '../../stores/toast'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAppstoreStore()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))

onMounted(() => {
  store.loadDetail(id.value)
  // 深链直达详情时目录未加载 → 补拉一次以判「已装」(全量目录本就无分页,代价可接受)
  if (!store.catalogLoaded) store.loadCatalog().catch(() => {})
})

const title = computed(() => resolveAppText(store.detail?.title, locale.value, id.value))
const tagline = computed(() => resolveAppText(store.detail?.tagline, locale.value, ''))
/** renderMarkdown 是 html:false 的 markdown-it——原始 HTML 被转义,v-html 其输出安全(§3.8-2) */
const descHtml = computed(() => renderMarkdown(resolveAppText(store.detail?.description, locale.value, '')))
const shots = computed(() => (Array.isArray(store.detail?.screenshot_link) ? store.detail.screenshot_link : []))
const installed = computed(() => store.isInstalled(id.value))

/** P3 接管:真实安装编排(dry_run→install→进度)。本期占位 toast。 */
function onInstall() {
  toast.show(t('appsStoreInstallSoon'))
}
function backToStore() {
  router.push({ name: 'apps-store' })
}

// 截图放大层(自绘 overlay:P4a viewers 同款内联全屏模式,不引 Dialog)
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
              <button v-else class="detail-install" type="button" @click="onInstall">{{ t('appsStoreInstall') }}</button>
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
            <!-- REQUIRE MEMORY:§3.8-3 挂账 P4(需解析 compose YAML),此处刻意留空 -->
          </dl>

          <SnapCarousel v-if="shots.length" class="detail-shots">
            <img
              v-for="s in shots" :key="s"
              :src="s" alt="" class="detail-shot" loading="lazy"
              @click="zoomSrc = s"
            />
          </SnapCarousel>

          <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown html:false,输出已转义 -->
          <div class="detail-desc" v-html="descHtml"></div>
        </template>
      </main>
    </div>

    <div v-if="zoomSrc" class="shot-zoom" role="dialog" :aria-label="t('appsStoreZoomClose')" @click="zoomSrc = null">
      <img :src="zoomSrc" alt="" />
    </div>
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

.detail-meta { display: flex; gap: 28px; margin: 0 0 18px; }
.detail-meta-item dt { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 2px; }
.detail-meta-item dd { font-size: 13.5px; margin: 0; color: var(--fg); }

.detail-shots { margin-bottom: 18px; }
.detail-shot { height: 210px; border-radius: var(--radius); cursor: zoom-in; object-fit: cover; }

.detail-desc { font-size: 14px; line-height: 1.7; color: var(--fg); max-width: 760px; }
.detail-desc :deep(a) { color: var(--accent); }
.detail-desc :deep(img) { max-width: 100%; }
.detail-desc :deep(code) { background: var(--chip-bg); border-radius: 4px; padding: 1px 5px; }

.shot-zoom {
  position: fixed; inset: 0; z-index: 200; cursor: zoom-out;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg);
}
.shot-zoom img { max-width: 92vw; max-height: 92vh; border-radius: var(--radius); }
@media (max-width: 768px) { .apps-layout { gap: 0; } .detail-meta { flex-wrap: wrap; gap: 16px; } }
</style>

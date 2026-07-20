<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import StoreCard from '../components/StoreCard.vue'
import CategoryBar from '../components/CategoryBar.vue'
import FeaturedStrip from '../components/FeaturedStrip.vue'
import { useAppstoreStore, ALL } from '../stores/appstore'
import { mapStoreApp, filterStoreApps } from '../util/storeApp'
import { useToast } from '../../stores/toast'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAppstoreStore()
const toast = useToast()

/** P3 接管:真实安装编排。本期卡片安装钮与详情页同款占位 toast。 */
function onInstall() {
  toast.show(t('appsStoreInstallSoon'))
}

// 深链三参(spec §3.1):?category= / ?author= / ?search=,单一事实源=路由 query
const category = computed(() => (typeof route.query.category === 'string' && route.query.category) || ALL)
const author = computed(() => (typeof route.query.author === 'string' && route.query.author) || ALL)
const search = computed(() => (typeof route.query.search === 'string' && route.query.search) || '')

// 作者过滤:Vue2 静态菜单(All/official/by_nimoos/community → author_type 参数)
const AUTHORS = [
  { value: ALL, labelKey: 'appsStoreAll' },
  { value: 'official', labelKey: 'appsStoreAuthorOfficial' },
  { value: 'by_nimoos', labelKey: 'appsStoreAuthorByNimoos' },
  { value: 'community', labelKey: 'appsStoreAuthorCommunity' },
]

// 搜索输入:250ms 防抖(Vue2 同款)后写 query;外部 query 变化(后退)回灌输入框
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
// 卸载(如点卡片跳转详情页)时清理未触发的防抖定时器——否则 250ms 窗口内残留的
// setTimeout 会在离开本页后仍对已销毁组件捕获的 router 触发一次多余的 replace。
onUnmounted(() => clearTimeout(timer))

// 分类/作者是后端参数:query 变化即重拉;搜索纯前端不重拉
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
// 推荐带只在「未过滤未搜索」的首屏语境显示——过滤/搜索时列表就是用户要的答案,带子是噪音
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
            @open="openDetail"
            @install="onInstall"
          />
          <p v-if="!store.loading && !shown.length" class="apps-empty">{{ t('appsStoreEmpty') }}</p>
          <div v-else class="apps-grid">
            <StoreCard
              v-for="a in shown" :key="a.id"
              :app="a" :installed="store.isInstalled(a.id)"
              @open="openDetail(a.id)"
              @install="onInstall"
            />
          </div>
        </template>
      </main>
    </div>
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

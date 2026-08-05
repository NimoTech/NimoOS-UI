### Task 4: `SourcesPage.vue` + 路由 + 侧栏入口 + i18n 键

**Files:**
- Create: `src/apps/views/SourcesPage.vue`
- Modify: `src/router/index.ts`(import + 路由记录)
- Modify: `src/apps/components/AppsSidebar.vue`(nav 数组加一项,删占位注释)
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(文件末尾 `}` 前追加键块;若 Task 3 已加则跳过)
- Test: `src/apps/views/SourcesPage.test.ts`

**Interfaces:**
- Consumes: Task 1 `sourceDisplayName`/`isOfficialSource`;Task 3 `useSourcesStore()`(字段与 actions 签名见 Task 3);既有 `AreaShell`(prop `title: string`)、`AppsSidebar`、`components/ui/AlertDialog.vue`(props `open/title/message/confirmText/cancelText/destructive`,emits `update:open`/`confirm`)。
- Produces: 路由 `{ path: '/apps/sources', name: 'apps-sources' }`。

- [ ] **Step 1: 写失败测试**

参照 `src/apps/views/InstalledAppsPage.test.ts` 的 mount 模式(真实 i18n + **显式 pinia 实例进 global.plugins**、mock vue-router):

```ts
// src/apps/views/SourcesPage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  appstore: {
    listSources: vi.fn(),
    registerSource: vi.fn(),
    unregisterSource: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: vi.fn(() => () => {}) }),
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'apps-sources', fullPath: '/apps/sources' }),
}))

import SourcesPage from './SourcesPage.vue'

const OFFICIAL = { id: 0, url: 'https://github.com/NimoTech/NimoOS-AppStore/archive/main.zip' }
const THIRD = { id: 1, url: 'https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip' }

function mountPage() {
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
  const pinia = createPinia()
  return mount(SourcesPage, { global: { plugins: [i18n, pinia] } })
}

describe('SourcesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.appstore.listSources.mockResolvedValue([OFFICIAL, THIRD])
  })

  it('渲染源列表:官方源带徽章无移除按钮,第三方源有移除按钮', async () => {
    const w = mountPage()
    await flushPromises()
    const items = w.findAll('.src-item')
    expect(items).toHaveLength(2)
    expect(items[0].find('.src-badge').exists()).toBe(true)
    expect(items[0].find('.src-remove').exists()).toBe(false)
    expect(items[1].find('.src-badge').exists()).toBe(false)
    expect(items[1].find('.src-remove').exists()).toBe(true)
    expect(items[1].text()).toContain('WisdomSky')
  })

  it('非 http(s) 输入:添加按钮禁用', async () => {
    const w = mountPage()
    await flushPromises()
    await w.find('.src-input').setValue('ftp://x/y.zip')
    expect((w.find('.src-add-btn').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.src-input').setValue('https://example.com/s.zip')
    expect((w.find('.src-add-btn').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('提交调 store.register(trim 后),输入清空;同步错误就地展示', async () => {
    const w = mountPage()
    await flushPromises()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await w.find('.src-input').setValue(' https://example.com/s.zip ')
    await w.find('form.src-add').trigger('submit')
    await flushPromises()
    expect(svc.appstore.registerSource).toHaveBeenCalledWith('https://example.com/s.zip')
    expect((w.find('.src-input').element as HTMLInputElement).value).toBe('')
    expect(w.find('.src-pending').exists()).toBe(true) // 注册中行可见

    // 同步 409 就地展示(新 mount,干净 store)
    const w2 = mountPage()
    await flushPromises()
    svc.appstore.registerSource.mockRejectedValueOnce({ response: { data: { message: 'already exists' } } })
    await w2.find('.src-input').setValue('https://dup.example.com/s.zip')
    await w2.find('form.src-add').trigger('submit')
    await flushPromises()
    expect(w2.find('.src-form-error').text()).toContain('already exists')
  })

  it('移除:确认弹窗 confirm 后调 store.unregister(id)', async () => {
    const w = mountPage()
    await flushPromises()
    svc.appstore.unregisterSource.mockResolvedValueOnce(undefined)
    await w.find('.src-remove').trigger('click')
    // reka AlertDialog 挂 portal,直接调组件暴露的 confirm 路径:
    const dialog = w.findComponent({ name: 'AlertDialog' })
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(svc.appstore.unregisterSource).toHaveBeenCalledWith(1)
  })
})
```

(若 `findComponent({ name: 'AlertDialog' })` 因 SFC 无 name 取不到,改用 `w.findComponent(AlertDialogImport)`,顶部 `import AlertDialogImport from '../../components/ui/AlertDialog.vue'`。)

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/apps/views/SourcesPage.test.ts`
Expected: FAIL(`./SourcesPage.vue` 不存在)

- [ ] **Step 3: 加 i18n 键块(两个文件,末尾 `}` 前;若 Task 3 已加则跳过)**

`src/i18n/zh_cn.ts`(现文件在 `appsConsoleLoadFailed: '加载失败,请重试',` 一行之后、结尾 `}` 之前追加):

```ts
  // ── 商店源(/apps/sources) ──
  appsNavSources: '商店源',
  appsSourcesTitle: '商店源',
  appsSourcesDesc: '第三方应用商店源,添加后其中的应用会并入应用商店。',
  appsSourcesMore: '浏览更多第三方源',
  appsSourcesAddPlaceholder: '粘贴商店源地址(https://…)',
  appsSourcesAdd: '添加',
  appsSourcesAdding: '正在注册,下载商店目录中…',
  appsSourcesInvalidUrl: '请输入 http:// 或 https:// 开头的地址',
  appsSourcesRegisterOk: '商店源已添加',
  appsSourcesRegisterFail: '商店源注册失败:{msg}',
  appsSourcesOfficial: '官方',
  appsSourcesRemove: '移除',
  appsSourcesRemoveTitle: '移除商店源',
  appsSourcesRemoveMsg: '确定移除「{name}」?该源的应用将从商店中消失,已安装的应用不受影响。',
  appsSourcesRemoveOk: '已移除商店源',
  appsSourcesRemoveFail: '移除失败:{msg}',
  appsSourcesLoading: '加载中…',
  appsSourcesLoadFailed: '加载失败,请重试',
  appsSourcesRetry: '重试',
  appsSourcesEmpty: '暂无商店源',
```

`src/i18n/en_us.ts`(同位置):

```ts
  // ── App sources (/apps/sources) ──
  appsNavSources: 'App Sources',
  appsSourcesTitle: 'App Sources',
  appsSourcesDesc: 'Third-party app store sources. Apps from added sources appear in the App Store.',
  appsSourcesMore: 'Browse more third-party sources',
  appsSourcesAddPlaceholder: 'Paste a source URL (https://…)',
  appsSourcesAdd: 'Add',
  appsSourcesAdding: 'Registering — downloading catalog…',
  appsSourcesInvalidUrl: 'Enter a URL starting with http:// or https://',
  appsSourcesRegisterOk: 'App source added',
  appsSourcesRegisterFail: 'Failed to register app source: {msg}',
  appsSourcesOfficial: 'Official',
  appsSourcesRemove: 'Remove',
  appsSourcesRemoveTitle: 'Remove app source',
  appsSourcesRemoveMsg: 'Remove "{name}"? Its apps will disappear from the store; installed apps are not affected.',
  appsSourcesRemoveOk: 'App source removed',
  appsSourcesRemoveFail: 'Failed to remove: {msg}',
  appsSourcesLoading: 'Loading…',
  appsSourcesLoadFailed: 'Failed to load, please retry',
  appsSourcesRetry: 'Retry',
  appsSourcesEmpty: 'No app sources',
```

- [ ] **Step 4: 实现页面**

```vue
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

// reka 时序坑:AlertDialogAction 也是 DialogClose,update:open(false) 先于 confirm 触发——
// open 与目标分开存,confirm 里读完目标再清,勿在 update:open 里清目标
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

const MORE_URL = 'https://awesome.nimoos.io/content/3rd-party-app-stores/list.html'

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
          <input
            v-model="url"
            class="src-input"
            type="text"
            :placeholder="t('appsSourcesAddPlaceholder')"
            :disabled="!!store.registeringUrl"
          />
          <button class="ui-btn src-add-btn" type="submit" :disabled="!canSubmit">
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
          <button class="ui-btn" type="button" @click="store.load()">{{ t('appsSourcesRetry') }}</button>
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
              class="ui-btn src-remove"
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
/* 与其它 apps 页共用的布局骨架(各页 scoped 重复,既有约定) */
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; }
.apps-empty { color: var(--fg-muted); font-size: 14px; padding: 24px 8px; display: flex; align-items: center; gap: 10px; }
@media (max-width: 768px) { .apps-layout { gap: 0; } }

.src-title { font-size: 18px; font-weight: 600; margin: 2px 0 4px; color: var(--fg); }
.src-desc { font-size: 13px; color: var(--fg-muted); margin: 0 0 14px; }
.src-more { color: var(--accent-text); margin-left: 6px; }

.src-add { display: flex; gap: 8px; }
.src-input {
  flex: 1 1 auto; min-width: 0; padding: 8px 10px; border-radius: 10px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit;
}
.src-input:focus { outline: none; border-color: var(--accent); }
.src-add-btn { flex: 0 0 auto; }
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
  font-family: var(--font-mono); font-size: 12px; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.src-remove { color: var(--remove-fg); flex: 0 0 auto; }
</style>
```

- [ ] **Step 5: 接路由**

`src/router/index.ts`:import 区(`CustomAppsPage` 之后)加

```ts
import SourcesPage from '../apps/views/SourcesPage.vue'
```

路由表 `apps-custom` 行后、`apps-settings` 行前加(静态段先于参数段的仓库惯例):

```ts
  { path: '/apps/sources', name: 'apps-sources', component: SourcesPage },
```

- [ ] **Step 6: 侧栏入口**

`src/apps/components/AppsSidebar.vue`:删掉 `// P7 增补:源 /apps/sources` 占位注释,nav 数组尾部加一项:

```ts
const nav = [
  { name: 'apps', labelKey: 'appsNavInstalled', to: '/apps' },
  { name: 'apps-store', labelKey: 'appsNavStore', to: '/apps/store' },
  { name: 'apps-custom', labelKey: 'appsNavCustom', to: '/apps/custom' },
  { name: 'apps-sources', labelKey: 'appsNavSources', to: '/apps/sources' },
]
```

`isActive` 不用改(`/apps/sources` 无子路由,默认 `cur === n.name` 精确匹配即可)。

- [ ] **Step 7: 跑测试确认通过 + i18n parity**

Run: `pnpm exec vitest run src/apps/views/SourcesPage.test.ts src/i18n/parity.test.ts src/i18n/i18n.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/apps/views/SourcesPage.vue src/apps/views/SourcesPage.test.ts \
  src/router/index.ts src/apps/components/AppsSidebar.vue \
  src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "P7: /apps/sources 商店源管理页 + 路由 + 侧栏入口 + i18n"
```

---


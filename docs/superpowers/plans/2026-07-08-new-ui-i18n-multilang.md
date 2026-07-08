# 新 UI 多语言（英/中）+ 用户级语言偏好 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 NimoOS-New-UI 支持英文/中文切换，首次设置时可选语言，并把偏好写入服务端 `system.json`、登录后自动应用。

**Architecture:** 新增英文 locale 文件并入 vue-i18n；新增一个 locale Pinia store 封装"设 locale / 从 system.json 读并应用 / 读-改-写持久化"；在登录与冷启动挂钩自动应用；Welcome 首次设置加语言选择。后端零改动，复用 `service.users.get/setCustomStorage('system')`。

**Tech Stack:** Vue 3.4、vue-i18n@9（`legacy:false`，组合式 `useI18n`）、Pinia、`@nimotech/nimoos-service`、Vitest + @vue/test-utils、pnpm。

## Global Constraints

- 语言码固定：`zh_cn` / `en_us`（小写下划线，与老 UI/AppStore 一致）。
- 默认语言：`zh_cn`。
- vue-i18n 为 `legacy:false` 组合式模式：改语言用 `i18n.global.locale.value = <lang>`（是 WritableComputedRef）。
- **后端零改动**；语言存服务端 `system.json`，走 `service.users.getCustomStorage('system')` / `setCustomStorage('system', data)`。
- **写 `system.json` 必须读-改-写**：先读整个 blob，只覆盖 `lang`，再写回——严禁整体覆盖（blob 内还有 timezone/各开关等字段）。
- `getCustomStorage` 返回值可能是 string（JSON）或 object，需两者都处理（参照 `src/home/stores/layout.ts:85-92`）。
- 英文文案来源：老 UI `NimoOS-UI/src/assets/lang/en_US.json`（用中文串在 `zh_CN.json` 匹配后取对应英文），无匹配再手工翻译。
- 测试：Vitest；service 用 `vi.mock('@nimotech/nimoos-service')` + `importActual` 覆盖 `service.users`（参照 `src/home/stores/layout.persist.test.ts`）；组件用 `@vue/test-utils` `mount` + `createI18n`/`createRouter`（参照 `src/views/Welcome.test.ts`）。
- 命令：`pnpm test`（单测）、`pnpm build`（构建校验）。每个 Task 结束提交一次。
- 本计划仅覆盖阶段 1 + 阶段 3；阶段 2（36 个硬编码中文 .vue 抽 key）独立后续计划。

---

## File Structure

- Create `src/i18n/en_us.ts` — 英文 locale，`messages = { en_us: {...} }`，key 与 `zh_cn.ts` 完全对齐。
- Modify `src/i18n/index.ts` — 合并 zh_cn + en_us 两套 messages。
- Create `src/i18n/parity.test.ts` — 校验两 locale 顶层 key 集合一致。
- Create `src/stores/locale.ts` — locale Pinia store（setLocale / loadFromServer / persist）。
- Create `src/stores/locale.test.ts` — store 单测。
- Modify `src/composables/useAuth.ts` — 登录后应用服务端语言。
- Modify `src/App.vue` — 冷启动（已登录）应用服务端语言。
- Modify `src/views/Welcome.vue` — 语言选择器 + 完成时持久化。
- Modify `src/views/Welcome.test.ts` — 覆盖语言选择行为。

---

## Task 1: 英文 locale 文件 + index 合并 + key 对齐测试

**Files:**
- Create: `src/i18n/en_us.ts`
- Modify: `src/i18n/index.ts`
- Test: `src/i18n/parity.test.ts`

**Interfaces:**
- Consumes: `src/i18n/zh_cn.ts` 的 `export const messages = { zh_cn: {...} }`。
- Produces: `src/i18n/en_us.ts` 导出 `export const messages = { en_us: {...} }`；`src/i18n/index.ts` 仍导出 `export const i18n`，其 `messages` 含 `zh_cn` 与 `en_us` 两个顶层 key。

- [ ] **Step 1: 写对齐测试（先失败）**

创建 `src/i18n/parity.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { messages as zh } from './zh_cn'
import { messages as en } from './en_us'

describe('i18n locale parity', () => {
  it('en_us 与 zh_cn 顶层 key 集合完全一致', () => {
    const zhKeys = Object.keys(zh.zh_cn).sort()
    const enKeys = Object.keys(en.en_us).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('en_us 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(en.en_us)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('抽查若干英文文案', () => {
    expect(en.en_us.cpu).toBe('CPU')
    expect(en.en_us.memory).toBe('Memory')
    expect(en.en_us.filesTitle).toBe('Files')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/i18n/parity.test.ts`
Expected: FAIL —— 无法解析模块 `./en_us`（文件尚不存在）。

- [ ] **Step 3: 创建 `src/i18n/en_us.ts`**

对照 `src/i18n/zh_cn.ts` 的每个 key 逐一写英文值，结构与顶层 key 完全一致。英文优先从老 UI 复用：用该 key 的中文串在 `NimoOS-UI/src/assets/lang/zh_CN.json` 里找到相同文案，取其在 `NimoOS-UI/src/assets/lang/en_US.json` 的英文；无匹配再手工译。骨架与示例（继续补齐 `zh_cn.ts` 中其余全部 key，直到 Step 4 的对齐测试通过）：

```ts
export const messages = {
  en_us: {
    appTitle: 'NimoOS · New Home Base',
    backToOld: '← Back to main app',
    cpu: 'CPU',
    memory: 'Memory',
    collecting: 'Collecting…',
    filesTitle: 'Files',
    filesBackHome: 'Home',
    filesEmpty: 'This folder is empty',
    filesViewList: 'List',
    filesViewGrid: 'Grid',
    filesColName: 'Name',
    filesColType: 'Type',
    filesColDate: 'Date modified',
    filesColSize: 'Size',
    filesFavorites: 'Favorites',
    filesDisks: 'Disks',
    filesNoFavorites: 'No favorites yet',
    filesSelectedCount: '{count} selected',
    filesSelectAll: 'Select all',
    filesClearSel: 'Clear',
    filesOpFailed: 'Operation failed',
    filesProtectedDelete: 'This item is protected and cannot be deleted',
    filesProtectedRename: 'This item is protected and cannot be renamed',
    filesProtectedMove: 'This item is protected and cannot be moved',
    filesCopiedPath: 'Path copied',
    filesNewFolder: 'New folder',
    filesNewFile: 'New file',
    filesPaste: 'Paste',
    // …继续补齐 zh_cn.ts 中每一个 key…
  },
}
```

注意：占位变量（如 `{count}`）在英文中必须保留原样。

- [ ] **Step 4: 修改 `src/i18n/index.ts` 合并两套 locale**

```ts
import { createI18n } from 'vue-i18n'
import { messages as zhMessages } from './zh_cn'
import { messages as enMessages } from './en_us'

const messages = { ...zhMessages, ...enMessages }

function initialLocale(): string {
  const stored = localStorage.getItem('lang')
  if (stored && stored in messages) return stored
  return 'zh_cn'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh_cn',
  messages,
})
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test -- src/i18n/parity.test.ts src/i18n/i18n.test.ts`
Expected: PASS（对齐、值非空、抽查、以及原有 `i18n.test.ts` 全绿）。若对齐用例报某些 key 缺失，回到 Step 3 补齐这些 key 后重跑。

- [ ] **Step 6: 提交**

```bash
git add src/i18n/en_us.ts src/i18n/index.ts src/i18n/parity.test.ts
git commit -m "feat(i18n): add English locale and merge into vue-i18n"
```

---

## Task 2: locale Pinia store（设置 / 读取应用 / 读-改-写持久化）

**Files:**
- Create: `src/stores/locale.ts`
- Test: `src/stores/locale.test.ts`

**Interfaces:**
- Consumes: `import { i18n } from '../i18n'`；`import { service } from '@nimotech/nimoos-service'`（`service.users.getCustomStorage(key)` / `setCustomStorage(key, data)`）。
- Produces: `export const LOCALES = ['zh_cn', 'en_us'] as const`；`export type Locale`；`export const useLocaleStore` —— 暴露 `setLocale(lang: Locale): void`、`loadFromServer(): Promise<void>`、`persist(lang: Locale): Promise<void>`。

- [ ] **Step 1: 写 store 单测（先失败）**

创建 `src/stores/locale.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const getCustomStorage: MockedFunction<(k: string) => Promise<unknown>> = vi.fn(async () => null)
const setCustomStorage: MockedFunction<(k: string, d: unknown) => Promise<unknown>> = vi.fn(async () => ({}))
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { users: {
    getCustomStorage: (k: string) => getCustomStorage(k),
    setCustomStorage: (k: string, d: unknown) => setCustomStorage(k, d),
  } } }
})

import { i18n } from '../i18n'
import { useLocaleStore } from './locale'

describe('locale store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh_cn'
  })

  it('setLocale 改 i18n 与 localStorage', () => {
    useLocaleStore().setLocale('en_us')
    expect(i18n.global.locale.value).toBe('en_us')
    expect(localStorage.getItem('lang')).toBe('en_us')
  })

  it('loadFromServer 应用 blob 内合法 lang', async () => {
    getCustomStorage.mockResolvedValueOnce({ lang: 'en_us', timezone: 'UTC' })
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('en_us')
  })

  it('loadFromServer 支持字符串 JSON blob', async () => {
    getCustomStorage.mockResolvedValueOnce(JSON.stringify({ lang: 'en_us' }))
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('en_us')
  })

  it('loadFromServer 忽略非法 lang，不改当前语言', async () => {
    getCustomStorage.mockResolvedValueOnce({ lang: 'fr_fr' })
    await useLocaleStore().loadFromServer()
    expect(i18n.global.locale.value).toBe('zh_cn')
  })

  it('persist 读-改-写：保留 blob 其它字段，仅覆盖 lang', async () => {
    getCustomStorage.mockResolvedValueOnce({ timezone: 'UTC', search_switch: true })
    await useLocaleStore().persist('en_us')
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('system')
    expect(setCustomStorage.mock.calls[0]?.[1]).toEqual({ timezone: 'UTC', search_switch: true, lang: 'en_us' })
    expect(i18n.global.locale.value).toBe('en_us')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/stores/locale.test.ts`
Expected: FAIL —— 无法解析 `./locale`。

- [ ] **Step 3: 创建 `src/stores/locale.ts`**

```ts
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../i18n'

export const LOCALES = ['zh_cn', 'en_us'] as const
export type Locale = (typeof LOCALES)[number]
const SYSTEM_KEY = 'system'

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

export const useLocaleStore = defineStore('locale', () => {
  function setLocale(lang: Locale) {
    i18n.global.locale.value = lang
    localStorage.setItem('lang', lang)
  }

  async function readSystemBlob(): Promise<Record<string, unknown>> {
    let data: unknown = await service.users.getCustomStorage(SYSTEM_KEY)
    if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = null } }
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  }

  async function loadFromServer(): Promise<void> {
    try {
      const blob = await readSystemBlob()
      if (isLocale(blob.lang)) setLocale(blob.lang)
    } catch (e) { console.warn('[locale] server load failed', e) }
  }

  async function persist(lang: Locale): Promise<void> {
    setLocale(lang)
    try {
      const blob = await readSystemBlob()
      blob.lang = lang
      await service.users.setCustomStorage(SYSTEM_KEY, blob)
    } catch (e) { console.warn('[locale] server save failed', e) }
  }

  return { setLocale, loadFromServer, persist }
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- src/stores/locale.test.ts`
Expected: PASS（5 用例全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/stores/locale.ts src/stores/locale.test.ts
git commit -m "feat(i18n): add locale store with server persistence (read-modify-write)"
```

---

## Task 3: 登录与冷启动时应用服务端语言

**Files:**
- Modify: `src/composables/useAuth.ts`（`login` 与 `registerAndLogin` 之外不动；见下）
- Modify: `src/App.vue`
- Test: `src/composables/useAuth.locale.test.ts`（新建）

**Interfaces:**
- Consumes: Task 2 的 `useLocaleStore().loadFromServer()`。
- Produces: 无新导出；`useAuth().login` 在成功后会调用 `loadFromServer()`。

- [ ] **Step 1: 写 useAuth 应用语言的测试（先失败）**

创建 `src/composables/useAuth.locale.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const loadFromServer = vi.fn(async () => {})
vi.mock('../stores/locale', () => ({ useLocaleStore: () => ({ loadFromServer }) }))

const loginApi = vi.fn(async () => ({ token: { access_token: 'a', refresh_token: 'r', expires_at: '1' }, user: { id: 1 } }))
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { users: { login: loginApi }, sys: { getVersion: vi.fn(async () => ({ current_version: 'x' })) } } }
})

import { useAuth } from './useAuth'

describe('useAuth applies server locale', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.clearAllMocks() })

  it('login 成功后调用 loadFromServer', async () => {
    await useAuth().login('nimo', 'secret1')
    expect(loadFromServer).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/composables/useAuth.locale.test.ts`
Expected: FAIL —— `loadFromServer` 未被调用（`login` 尚未接入）。

- [ ] **Step 3: 修改 `src/composables/useAuth.ts`**

顶部加 import：

```ts
import { useLocaleStore } from '../stores/locale'
```

在 `login` 末尾（`session.setVersion('local')` 之后）追加：

```ts
    await useLocaleStore().loadFromServer()
```

修改后的 `login` 完整体：

```ts
  async function login(username: string, password: string): Promise<void> {
    const { token, user } = await service.users.login(username, password)
    session.setTokens(token.access_token, token.refresh_token, token.expires_at)
    session.setUser(user)
    session.setVersion('local')
    await useLocaleStore().loadFromServer()
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- src/composables/useAuth.locale.test.ts`
Expected: PASS。

- [ ] **Step 5: 修改 `src/App.vue` 冷启动应用**

```vue
<template>
  <router-view />
  <AppToast />
</template>

<script setup lang="ts">
// Home (and future routes) own their own chrome; AppToast is app-level so any route can show toasts.
import { onMounted } from 'vue'
import AppToast from './components/AppToast.vue'
import { useSessionStore } from './stores/session'
import { useLocaleStore } from './stores/locale'

onMounted(() => {
  const session = useSessionStore()
  if (session.isAuthed) { void useLocaleStore().loadFromServer() }
})
</script>
```

- [ ] **Step 6: 运行既有测试确保未回归**

Run: `pnpm test -- src/composables src/App`
Expected: PASS（若无 App 专项测试，只需 useAuth 相关全绿）。

- [ ] **Step 7: 提交**

```bash
git add src/composables/useAuth.ts src/composables/useAuth.locale.test.ts src/App.vue
git commit -m "feat(i18n): apply server language on login and cold start"
```

---

## Task 4: Welcome 首次设置语言选择 + 持久化

**Files:**
- Modify: `src/views/Welcome.vue`
- Modify: `src/views/Welcome.test.ts`
- Modify: `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`（新增选择器文案 key）

**Interfaces:**
- Consumes: Task 2 的 `useLocaleStore().setLocale(lang)` 与 `persist(lang)`；`LOCALES`/`Locale`。
- Produces: Welcome step 2 出现两个语言按钮 `.welcome-lang-zh` / `.welcome-lang-en`；创建成功后调用 `persist(选中语言)`。

- [ ] **Step 1: 新增选择器文案 key（两 locale 同步）**

在 `src/i18n/zh_cn.ts` 的 `zh_cn` 对象内新增：

```ts
    welcomeLanguage: '语言',
```

在 `src/i18n/en_us.ts` 的 `en_us` 对象内新增：

```ts
    welcomeLanguage: 'Language',
```

（`parity.test.ts` 会保证两边都加了；漏一边测试即红。）

- [ ] **Step 2: 写 Welcome 语言选择测试（先失败）**

修改 `src/views/Welcome.test.ts`：在文件顶部 mock 区加入 locale store spy，并新增两条用例。

顶部 mock（加在 `vi.mock('../composables/useAuth', ...)` 之后）：

```ts
const setLocale = vi.fn()
const persist = vi.fn(async () => {})
vi.mock('../stores/locale', () => ({
  LOCALES: ['zh_cn', 'en_us'],
  useLocaleStore: () => ({ setLocale, persist }),
}))
```

`mountWelcome()` 需要 pinia：改为

```ts
import { createPinia } from 'pinia'
// …
async function mountWelcome() {
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
  const pinia = createPinia()
  const router = createRouter({ history: createWebHashHistory('/app/'), routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/welcome', component: Welcome },
  ] })
  router.push('/welcome'); await router.isReady()
  return mount(Welcome, { global: { plugins: [i18n, pinia, router] } })
}
```

新增用例：

```ts
  it('点击英文按钮即时切换语言', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    await w.find('.welcome-lang-en').trigger('click')
    expect(setLocale).toHaveBeenCalledWith('en_us')
  })

  it('创建成功后以选中语言持久化', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    await w.find('.welcome-lang-en').trigger('click')
    await w.find('.welcome-username').setValue('nimo')
    await w.find('.welcome-password').setValue('secret1')
    await w.find('.welcome-confirm').setValue('secret1')
    await w.find('.welcome-create').trigger('click')
    expect(persist).toHaveBeenCalledWith('en_us')
  })
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test -- src/views/Welcome.test.ts`
Expected: FAIL —— 找不到 `.welcome-lang-en`；`persist` 未被调用。

- [ ] **Step 4: 修改 `src/views/Welcome.vue`**

`<script setup>` 内：加 import 与选择状态，并在 `create()` 成功分支持久化。

```ts
import { useLocaleStore, LOCALES, type Locale } from '../stores/locale'
```

在 `const { registerAndLogin } = useAuth()` 附近加：

```ts
const localeStore = useLocaleStore()
const chosenLang = ref<Locale>(((localStorage.getItem('lang') as Locale) ?? 'zh_cn'))
function pickLang(l: Locale) {
  chosenLang.value = l
  localeStore.setLocale(l)
}
```

`create()` 中，把 `step.value = 3` 之前改为先持久化：

```ts
    await registerAndLogin(username.value, password.value, key)
    await localeStore.persist(chosenLang.value)
    step.value = 3
```

模板：在 step 2 的标题 `<h2 ...>{{ t('welcomeCreateAccount') }}</h2>` 之后插入语言选择块：

```html
        <div class="welcome-lang">
          <span class="auth-label">{{ t('welcomeLanguage') }}</span>
          <div class="welcome-lang-btns">
            <button type="button" class="welcome-lang-zh"
                    :class="{ active: chosenLang === 'zh_cn' }" @click="pickLang('zh_cn')">简体中文</button>
            <button type="button" class="welcome-lang-en"
                    :class="{ active: chosenLang === 'en_us' }" @click="pickLang('en_us')">English</button>
          </div>
        </div>
```

`<style scoped>` 内追加：

```css
.welcome-lang { margin: 0.25rem 0 0.5rem; }
.welcome-lang-btns { display: flex; gap: 0.5rem; margin-top: 0.35rem; }
.welcome-lang-btns button {
  flex: 1; padding: 0.45rem 0.5rem; border-radius: 10px; cursor: pointer;
  background: rgba(255, 255, 255, 0.12); color: var(--fg);
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.welcome-lang-btns button.active { border-color: var(--accent, #3b82f6); background: rgba(59, 130, 246, 0.25); }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test -- src/views/Welcome.test.ts`
Expected: PASS（含既有 4 用例 + 新增 2 用例）。

- [ ] **Step 6: 全量单测 + 构建校验**

Run: `pnpm test`
Expected: 全绿。

Run: `pnpm build`
Expected: 构建成功，无类型错误。

- [ ] **Step 7: 提交**

```bash
git add src/views/Welcome.vue src/views/Welcome.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(i18n): language picker on first-boot setup with server persistence"
```

---

## 验收（手动，可选）

1. `pnpm dev` 起新 UI，配好后端代理。
2. 首次设置流程：Welcome step 2 选 English → 完成 → 首页应为英文。
3. 刷新页面（冷启动）：仍为英文（来自 `system.json`）。
4. 清 `localStorage`、换浏览器登录同账号：登录后自动变英文（服务端偏好生效）。
5. 后端确认 `/var/lib/nimoos/<用户id>/system.json` 内 `lang` 已写入且 timezone/开关等原字段未丢。

## Self-Review 记录

- 覆盖 spec 阶段 1（Task 1）、阶段 3a 持久化（Task 2）、阶段 3b 启动应用（Task 3）、阶段 3c 创建时选择（Task 4）。阶段 2 明确移出本计划。
- 读-改-写约束在 Task 2 `persist` 实现 + 专项用例校验。
- 类型/命名一致：`useLocaleStore`、`setLocale/loadFromServer/persist`、`Locale`、`LOCALES` 全计划统一。
- 默认 `zh_cn`、语言码 `zh_cn/en_us` 贯穿。

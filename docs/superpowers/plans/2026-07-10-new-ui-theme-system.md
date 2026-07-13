# NimoOS-New-UI 可切换配色主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 New-UI 加一套可切换的配色主题(白色/米白纸感 + 现有蓝色/深色玻璃),用户在主页顶栏一键切换,并把全站颜色收编为 theme token。

**Architecture:** 单一 token 源 `src/styles/theme.css` 的 `:root` = 蓝色(默认);新增 `:root[data-theme="light"]` 覆盖块 = 白色。切换 = Pinia `theme` store 设 `document.documentElement` 的 `data-theme` + 写 `localStorage['theme']`,`main.ts` 在 mount 前应用防闪。所有消费 `var(--…)` 的组件零改动自动翻色;两处本地调色板(SearchDialog/MediaViewer)与散落硬编码色收编为全局 token,末尾加一个永久 guard 测试守约定。

**Tech Stack:** Vue 3 `<script setup>` · Vite · Pinia(setup-store 写法)· vue-i18n · Vitest + @vue/test-utils · 纯手写 CSS custom properties(无 Tailwind/UI 框架)。

## Global Constraints

- **包管理器 pnpm**;命令:`pnpm exec vitest run <path>`(单测)、`pnpm exec vue-tsc --noEmit`(类型)、`pnpm build`、`./scripts/deploy.sh`。
- **一切可见颜色必须走 `var(--token)`,禁止在 `<style>`/CSS 写死 `#hex`/`rgb()`/`rgba()`/具名色**(约定见 `CLAUDE.md` 与 `docs/THEMING.md §0`)。例外仅两类,须在代码加 `/* theme-exception: 原因 */` 注释:①`theme.css` 的 `.ic-*` 品牌图标渐变;②第三方库内部主题(CodeMirror)。
- **i18n 新增键必须同时加到 `src/i18n/zh_cn.ts` 和 `src/i18n/en_us.ts`** —— `src/i18n/parity.test.ts` 断言两文件键完全一致。
- **token 权威取值**:`docs/THEMING.md §2`(蓝/白两套)。改 `theme.css` 后同步该表。
- **非颜色结构 token**(`--font/--radius/--ease/--stroke/--gap/--icon-radius/--chip-radius/--dock-radius/--app-size/--clock-weight/--card-hover/--num-font`)两套主题**共享,只放 `:root`**,`[data-theme]` 块里不重复。
- **提交信息**用中文/英文皆可,结尾附:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/stores/theme.ts` | 主题 store + `applyTheme`/`initialTheme`/`THEMES`/`isTheme` | 新建 |
| `src/stores/theme.test.ts` | store 单测 | 新建 |
| `src/main.ts` | mount 前应用 data-theme(防闪) | 改 |
| `index.html` | `<head>` 内联脚本(JS 加载前防闪) | 改 |
| `src/styles/theme.css` | `:root[data-theme="light"]` 覆盖块 + light 滚动条/光斑关闭;§5 扩展 token(两块) | 改 |
| `src/home/components/ThemeToggle.vue` | 顶栏主题切换 UI | 新建 |
| `src/home/components/ThemeToggle.test.ts` | 切换 UI 单测 | 新建 |
| `src/home/components/HomeTopbar.vue` | 挂载 `<ThemeToggle/>` | 改 |
| `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` | `themeToggle`/`themeLight`/`themeBlue` | 改 |
| `src/home/components/SearchDialog.vue` | 删本地调色板,吃全局 token | 改 |
| `src/files/viewers/MediaViewer.vue` | 删本地调色板,吃全局 token | 改 |
| `src/**/*.vue`, `src/files/viewers/viewers.css` | 散落硬编码色收编 | 改 |
| `src/styles/color-guard.test.ts` | 永久约定守卫(颜色字面量 linter) | 新建 |

任务顺序:1–4 交付**可用的核心切换功能**(可在此独立发布);5–8 完成**全站彻底收编**。

---

### Task 1: 主题 store

**Files:**
- Create: `src/stores/theme.ts`
- Test: `src/stores/theme.test.ts`

**Interfaces:**
- Produces:
  - `THEMES: readonly ['blue', 'light']`,`type Theme = 'blue' | 'light'`
  - `isTheme(v: unknown): v is Theme`
  - `applyTheme(t: Theme): void` —— 无需 Pinia,可在 mount 前调用(`blue` 移除 `data-theme`,`light` 置 `data-theme="light"`)
  - `initialTheme(): Theme` —— 读 `localStorage['theme']`,非法/缺省回 `'blue'`
  - `useThemeStore()` —— setup-store,暴露 `theme: Ref<Theme>` 与 `setTheme(t: Theme): void`

- [ ] **Step 1: 写失败测试**

```ts
// src/stores/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore, applyTheme, initialTheme, isTheme, THEMES } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('THEMES 与 isTheme', () => {
    expect(THEMES).toEqual(['blue', 'light'])
    expect(isTheme('light')).toBe(true)
    expect(isTheme('green')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('applyTheme: light 置属性, blue 移除属性', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    applyTheme('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('initialTheme: 读 localStorage, 非法回 blue', () => {
    expect(initialTheme()).toBe('blue')
    localStorage.setItem('theme', 'light')
    expect(initialTheme()).toBe('light')
    localStorage.setItem('theme', 'nope')
    expect(initialTheme()).toBe('blue')
  })

  it('setTheme: 改 state + data-theme + localStorage', () => {
    const store = useThemeStore()
    store.setTheme('light')
    expect(store.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    store.setTheme('blue')
    expect(store.theme).toBe('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('theme')).toBe('blue')
  })
})
```

- [ ] **Step 2: 运行,确认失败**

Run: `pnpm exec vitest run src/stores/theme.test.ts`
Expected: FAIL(`Cannot find module './theme'`)

- [ ] **Step 3: 实现 store**

```ts
// src/stores/theme.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const THEMES = ['blue', 'light'] as const // blue = 默认/兜底
export type Theme = (typeof THEMES)[number]

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

// 直接写 <html data-theme>,无需 Pinia —— 供 main.ts 在 mount 前调用(防闪)。
// blue 是 :root 默认块,移除属性即回落;light 置属性触发 :root[data-theme="light"] 覆盖块。
export function applyTheme(t: Theme): void {
  if (t === 'blue') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function initialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return isTheme(stored) ? stored : 'blue'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(initialTheme())
  function setTheme(t: Theme) {
    theme.value = t
    applyTheme(t)
    localStorage.setItem('theme', t)
  }
  return { theme, setTheme }
})
```

- [ ] **Step 4: 运行,确认通过**

Run: `pnpm exec vitest run src/stores/theme.test.ts`
Expected: PASS(4 tests)

- [ ] **Step 5: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/stores/theme.ts src/stores/theme.test.ts
git commit -m "feat(theme): add theme store (blue/light + applyTheme/initialTheme)"
```

---

### Task 2: mount 前应用主题(防闪)

**Files:**
- Modify: `src/main.ts`(在 `app.mount('#app')` 之前调用 `applyTheme(initialTheme())`)
- Modify: `index.html`(`<head>` 加内联脚本,JS bundle 加载前先贴属性)

**Interfaces:**
- Consumes: `applyTheme`, `initialTheme`(Task 1)

- [ ] **Step 1: main.ts 引入并在 mount 前应用**

在 `src/main.ts` 顶部 import 区加:

```ts
import { applyTheme, initialTheme } from './stores/theme'
```

在文件末尾 `app.use(router)` 与 `app.mount('#app')` 之间插入:

```ts
// 冷启动:mount 前先把 data-theme 贴到 <html>,避免先渲染默认蓝再跳白的闪烁。
applyTheme(initialTheme())
```

- [ ] **Step 2: index.html 加内联防闪脚本**

在 `index.html` 的 `<head>` 内(其它 `<script>`/`<link>` 之前)加:

```html
<script>
  // 主题防闪:在 JS bundle 加载前就贴 data-theme(与 src/stores/theme.ts 逻辑一致)
  try {
    if (localStorage.getItem('theme') === 'light') {
      document.documentElement.dataset.theme = 'light'
    }
  } catch (e) { /* localStorage 不可用时静默,回落默认蓝 */ }
</script>
```

- [ ] **Step 3: 类型检查 + 构建冒烟**

Run: `pnpm exec vue-tsc --noEmit && pnpm build`
Expected: 均无报错(dist/ 产出)

- [ ] **Step 4: 提交**

```bash
git add src/main.ts index.html
git commit -m "feat(theme): apply persisted theme before mount (anti-flash)"
```

---

### Task 3: 白色主题覆盖块(theme.css)

**Files:**
- Modify: `src/styles/theme.css`(在 `:root { … }` 结束的 `}`(约 line 120)之后、`* { box-sizing }`(约 line 122)之前插入 light 块与 light 全局翻转规则)

**Interfaces:**
- Produces: `:root[data-theme="light"]` 下所有现有颜色 token 的白色值(取值见 `docs/THEMING.md §2.1–§2.11`)。§5 的扩展 token 在 Task 5 追加,本任务不含。

- [ ] **Step 1: 插入 light 覆盖块**

在 `theme.css` 的 `:root{…}` 闭合花括号之后插入:

```css
/* ═══ 白色 / 米白纸感主题:覆盖全部颜色 token(结构 token 沿用 :root)。权威取值见 docs/THEMING.md §2 ═══ */
:root[data-theme="light"] {
  color-scheme: light;

  /* 2.1 基础色 */
  --bg: #f7f5ef;
  --fg: #1c1b19;
  --fg-muted: #6e6a61;
  --fg-faint: #9a958a;
  --accent: #3b5bdb;
  --accent2: #6e5ae0;
  --good: #15754c;
  --on-accent: #ffffff;

  /* 2.2 品牌渐变 */
  --brand-bg: linear-gradient(135deg, #4c6fe8, #6e5ae0);
  --brand-shadow: 0 12px 30px rgba(59, 91, 219, 0.3);

  /* 2.3 chip / 通透按钮 */
  --chip-border: #e7e3d9;
  --chip-bg: #ffffff;
  --chip-bg-hi: #f2efe7;
  --dot: rgba(28, 27, 25, 0.35);
  --dot-on: #1c1b19;

  /* 2.4 卡片 / 浮层 */
  --card-bg: #ffffff;
  --popup-bg: #ffffff;
  --card-border: #e7e3d9;
  --card-shadow: 0 2px 6px rgba(60, 50, 30, 0.06), 0 26px 50px -20px rgba(60, 50, 30, 0.3);
  --card-shadow-hi: 0 4px 10px rgba(60, 50, 30, 0.08), 0 40px 70px -22px rgba(60, 50, 30, 0.34);
  --card-shadow-drag: 0 10px 20px rgba(60, 50, 30, 0.12), 0 60px 90px -28px rgba(60, 50, 30, 0.4);
  --clock-bg: linear-gradient(157deg, rgba(59, 91, 219, 0.1), #ffffff 60%);
  --folder-glass: linear-gradient(157deg, #ffffff, #f4f1e9);
  --folder-mini: linear-gradient(150deg, #ece7dc, #dcd6c8);
  --toast-bg: #ffffff;

  /* 2.5 工具 / 内嵌面 */
  --tool-bg: #f0eee8;
  --tool-bg-hi: #e7e3d9;
  --inner-bg: #f7f5ef;
  --inner-bg-hi: #f0eee8;
  --inner-border: #e7e3d9;
  --grid-dot: rgba(28, 27, 25, 0.14);

  /* 2.6 环形图 / 迷你图 / AI 光球 */
  --ring-hole: rgba(255, 255, 255, 0.85);
  --ring-track: rgba(28, 27, 25, 0.1);
  --spark-fill: rgba(59, 91, 219, 0.14);
  --spark-grid: rgba(28, 27, 25, 0.06);
  --num-color: #1c1b19;
  --orb-core: #d9def5;
  --orb-glow: rgba(59, 91, 219, 0.4);

  /* 2.7 图标 / 标签 / 文件夹 */
  --folder-bg: linear-gradient(180deg, #a9c2f5, #6e8fe8);
  --icon-shadow: 0 14px 30px -8px rgba(60, 50, 30, 0.22);
  --label-color: rgba(28, 27, 25, 0.92);
  --label-shadow: none;

  /* 2.8 Dock / 全部应用 */
  --dock-bg: rgba(255, 255, 255, 0.9);
  --dock-border: #e7e3d9;
  --dock-shadow: 0 30px 60px -18px rgba(60, 50, 30, 0.32);
  --all-bg: #f0eee8;
  --all-fg: #1c1b19;
  --all-border: #e7e3d9;

  /* 2.9 浮层 / 背景 / 危险 / 拖放 */
  --overlay-bg: rgba(40, 36, 28, 0.28);
  --remove-bg: #e0466a;
  --drop-bg: rgba(59, 91, 219, 0.12);
  --app-bg: #f7f5ef;

  /* 2.10 模糊(纸感不用玻璃) */
  --blur: none;
  --overlay-blur: blur(8px);
}

/* 白色主题:滚动条滑块贴浅底改深色;关闭散景光斑与暗角(纸感不要 bokeh)。见 THEMING.md §2.11 */
:root[data-theme="light"] { scrollbar-color: rgba(28, 27, 25, 0.22) transparent; }
:root[data-theme="light"] *::-webkit-scrollbar-thumb {
  background: rgba(28, 27, 25, 0.22); border: 2px solid transparent; background-clip: padding-box;
}
:root[data-theme="light"] *::-webkit-scrollbar-thumb:hover { background: rgba(28, 27, 25, 0.4); background-clip: padding-box; }
:root[data-theme="light"] body::before,
:root[data-theme="light"] body::after { background: none; }
```

- [ ] **Step 2: 构建冒烟(CSS 语法不破)**

Run: `pnpm build`
Expected: 构建成功;dist/ 中 CSS 含 `[data-theme="light"]`

验证命令:`grep -rl 'data-theme="light"' dist/assets/*.css`(应有命中)

- [ ] **Step 3: 人工视觉冒烟(可选但推荐)**

Run: `pnpm dev`,浏览器控制台执行 `document.documentElement.dataset.theme='light'`,确认主页整体变米白、光斑消失、卡片变白;执行 `delete document.documentElement.dataset.theme` 恢复蓝色。

- [ ] **Step 4: 提交**

```bash
git add src/styles/theme.css
git commit -m "feat(theme): add light (paper) override block + light scrollbar/bokeh off"
```

---

### Task 4: 顶栏切换 UI(ThemeToggle + i18n) — 核心功能到此可用

**Files:**
- Create: `src/home/components/ThemeToggle.vue`
- Test: `src/home/components/ThemeToggle.test.ts`
- Modify: `src/home/components/HomeTopbar.vue`(`.status` 区挂 `<ThemeToggle/>`)
- Modify: `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts`(加 3 键)

**Interfaces:**
- Consumes: `useThemeStore`, `THEMES`, `type Theme`(Task 1);i18n 键 `themeToggle`/`themeLight`/`themeBlue`

- [ ] **Step 1: 加 i18n 键(两文件都加)**

`src/i18n/zh_cn.ts` 在 `topbarDone: '完成',` 之后加:

```ts
    themeToggle: '主题',
    themeLight: '白色',
    themeBlue: '蓝色',
```

`src/i18n/en_us.ts` 在 `topbarDone: 'Done',` 之后加:

```ts
    themeToggle: 'Theme',
    themeLight: 'White',
    themeBlue: 'Blue',
```

- [ ] **Step 2: 写失败测试**

```ts
// src/home/components/ThemeToggle.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../../stores/theme'
import ThemeToggle from './ThemeToggle.vue'

describe('ThemeToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('点击按钮展开菜单,选白色切到 light', async () => {
    const store = useThemeStore()
    const w = mount(ThemeToggle)
    expect(w.find('.theme-menu').exists()).toBe(false)
    await w.get('.theme-btn').trigger('click')
    expect(w.find('.theme-menu').exists()).toBe(true)
    const light = w.findAll('.theme-opt').find((b) => b.text().includes('白色'))!
    await light.trigger('click')
    expect(store.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(w.find('.theme-menu').exists()).toBe(false) // 选完关闭
  })

  it('当前主题项打勾', async () => {
    useThemeStore().setTheme('light')
    const w = mount(ThemeToggle)
    await w.get('.theme-btn').trigger('click')
    const on = w.findAll('.theme-opt').find((b) => b.classes().includes('on'))!
    expect(on.text()).toContain('白色')
  })
})
```

- [ ] **Step 3: 运行,确认失败**

Run: `pnpm exec vitest run src/home/components/ThemeToggle.test.ts`
Expected: FAIL(找不到 `ThemeToggle.vue`)

- [ ] **Step 4: 实现 ThemeToggle.vue**

```vue
<!-- src/home/components/ThemeToggle.vue -->
<template>
  <div class="theme-toggle">
    <button class="bar-btn theme-btn" :aria-label="t('themeToggle')" :title="t('themeToggle')" @click="open = !open">
      <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
      </svg>
    </button>
    <template v-if="open">
      <div class="theme-scrim" @click="open = false" />
      <div class="theme-menu" role="menu">
        <button
          v-for="opt in THEMES"
          :key="opt"
          class="theme-opt"
          :class="{ on: theme.theme === opt }"
          role="menuitemradio"
          :aria-checked="theme.theme === opt"
          @click="pick(opt)"
        >
          <span class="sw" :class="'sw-' + opt" />
          <span class="lbl">{{ t(opt === 'light' ? 'themeLight' : 'themeBlue') }}</span>
          <span v-if="theme.theme === opt" class="ck">✓</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore, THEMES, type Theme } from '../../stores/theme'
const { t } = useI18n()
const theme = useThemeStore()
const open = ref(false)
function pick(v: Theme) {
  theme.setTheme(v)
  open.value = false
}
</script>

<style scoped>
.theme-toggle { position: relative; }
.theme-btn { padding: 0 11px; }
.theme-btn .ic { width: 17px; height: 17px; }
.theme-scrim { position: fixed; inset: 0; z-index: 40; }
.theme-menu {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 41;
  display: flex; flex-direction: column; gap: 2px; min-width: 148px; padding: 6px;
  border: 1px solid var(--card-border); border-radius: 14px;
  background: var(--popup-bg); box-shadow: var(--card-shadow-hi);
  backdrop-filter: var(--blur);
}
.theme-opt {
  display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px;
  border: 0; border-radius: 9px; background: transparent; color: var(--fg);
  font-size: 13px; cursor: pointer; text-align: left;
}
.theme-opt:hover { background: var(--hover); }
.theme-opt.on { color: var(--accent-text); }
.theme-opt .lbl { flex: 1; }
.theme-opt .ck { color: var(--accent); font-weight: 600; }
.sw { width: 18px; height: 18px; border-radius: 6px; border: 1px solid var(--card-border); flex: 0 0 auto; }
/* theme-exception: 主题预览色块必须显示各主题的真实配色,与当前主题无关,故写死品牌色。 */
.sw-blue { background: linear-gradient(135deg, #8ab4ff, #b79bff); }
/* theme-exception: 同上,白色主题预览块。 */
.sw-light { background: linear-gradient(135deg, #f7f5ef 40%, #3b5bdb); }
</style>
```

- [ ] **Step 5: 挂载到 HomeTopbar**

`src/home/components/HomeTopbar.vue`:`<script setup>` 加 import:

```ts
import ThemeToggle from './ThemeToggle.vue'
```

模板里 `.status` 区,把 `<ThemeToggle />` 放在 edit-btn 之后(`.status` 闭合 `</div>` 之前):

```html
      <button class="bar-btn edit-btn" :aria-pressed="editing" @click="toggleEdit()">{{ editing ? t('topbarDone') : '✎ ' + t('topbarEdit') }}</button>
      <ThemeToggle />
```

- [ ] **Step 6: 运行相关测试(含 i18n parity)**

Run: `pnpm exec vitest run src/home/components/ThemeToggle.test.ts src/home/components/HomeTopbar.test.ts src/i18n`
Expected: 全 PASS(parity 通过说明两 locale 键一致)

- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/home/components/ThemeToggle.vue src/home/components/ThemeToggle.test.ts src/home/components/HomeTopbar.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(theme): topbar ThemeToggle (white/blue) + i18n keys"
```

> ✅ 此处核心切换功能已端到端可用(除 SearchDialog/MediaViewer 尚保留本地浅色板)。可选择在此发布,或继续 Task 5–8 完成全站收编。

---

### Task 5: 扩展全局 token(供两处本地调色板收编)

SearchDialog/MediaViewer 用到的 token 中,有些全局 `:root` 还没有(`--card`/`--border`/`--fg-subtle`/`--divider`/`--hover`/`--accent-text`/`--grad-a`/`--grad-b`/`--accent-soft*`),以及语义色(`--sem-*`/`--dem-*`/`--nrm-*`/`--hit-*`/`--success`)与高光(`--hl-*`)。本任务把它们**提升为全局 token,在 `:root`(蓝)和 light 块都给值**,为 Task 6 删本地板铺路。

**Files:**
- Modify: `src/styles/theme.css`(`:root` 追加蓝值;`:root[data-theme="light"]` 追加白值)

**Interfaces:**
- Produces: 全局可用的 `--card`/`--border`/`--fg-subtle`/`--divider`/`--hover`/`--accent-text`/`--grad-a`/`--grad-b`/`--accent-soft`/`--accent-soft-2`/`--accent-soft-bd`/`--sem-bg|-fg|-bd`/`--dem-bg|-fg|-bd`/`--nrm-bg|-fg|-bd`/`--hit-bg|-fg`/`--success`/`--hl-bg|-bd|-fg|-star`

- [ ] **Step 1: `:root`(蓝色)追加**

在 `theme.css` `:root` 块内 `--good`/`--on-accent` 附近之后加:

```css
  /* 扩展/语义 token(SearchDialog·MediaViewer 提升为全局;每套主题都给值)。见 THEMING.md §5 */
  --card: #232a45;
  --border: rgba(255, 255, 255, 0.14);
  --fg-subtle: rgba(255, 255, 255, 0.4);
  --divider: rgba(255, 255, 255, 0.1);
  --hover: rgba(255, 255, 255, 0.08);
  --accent-text: #a9c6ff;
  --grad-a: #7a98ff;
  --grad-b: #b79bff;
  --accent-soft: rgba(138, 180, 255, 0.14);
  --accent-soft-2: rgba(138, 180, 255, 0.24);
  --accent-soft-bd: rgba(138, 180, 255, 0.36);
  --sem-bg: rgba(95, 227, 176, 0.14); --sem-fg: #5fe3b0; --sem-bd: rgba(95, 227, 176, 0.35);
  --dem-bg: rgba(240, 200, 120, 0.14); --dem-fg: #f0c878; --dem-bd: rgba(240, 200, 120, 0.32);
  --nrm-bg: rgba(255, 255, 255, 0.08); --nrm-fg: rgba(255, 255, 255, 0.7); --nrm-bd: rgba(255, 255, 255, 0.16);
  --hit-bg: rgba(255, 224, 138, 0.3); --hit-fg: #ffe08a;
  --success: #5fe3b0;
  --hl-bg: rgba(232, 192, 106, 0.16); --hl-bd: rgba(232, 192, 106, 0.4); --hl-fg: #e8c06a; --hl-star: #e8c06a;
```

- [ ] **Step 2: light 块追加**

在 `:root[data-theme="light"]` 块末尾(`--overlay-blur` 之后、闭合 `}` 之前)加:

```css
  /* 扩展/语义 token(白色纸感,取自 SearchDialog/MediaViewer 原浅色板) */
  --card: #ffffff;
  --border: #e7e3d9;
  --fg-subtle: #9a958a;
  --divider: rgba(28, 27, 25, 0.08);
  --hover: rgba(28, 27, 25, 0.045);
  --accent-text: #3550c4;
  --grad-a: #4c6fe8;
  --grad-b: #6e5ae0;
  --accent-soft: rgba(59, 91, 219, 0.11);
  --accent-soft-2: rgba(59, 91, 219, 0.2);
  --accent-soft-bd: rgba(59, 91, 219, 0.3);
  --sem-bg: #e7f5ee; --sem-fg: #15754c; --sem-bd: #b7e2cc;
  --dem-bg: #fbefd9; --dem-fg: #92600c; --dem-bd: #f0d9a8;
  --nrm-bg: #f0eee8; --nrm-fg: #5c584f; --nrm-bd: #e0dcd1;
  --hit-bg: #fce8a6; --hit-fg: #5a4a12;
  --success: #15754c;
  --hl-bg: #fdf4d9; --hl-bd: #f0d9a8; --hl-fg: #92600c; --hl-star: #c9992f;
```

- [ ] **Step 3: 同步 THEMING.md**

在 `docs/THEMING.md §2` 增补一个「§2.12 扩展/语义 token」小节,把上面每个 token 的蓝/白值补进表格(保持文档与代码一致)。

- [ ] **Step 4: 构建冒烟 + 提交**

Run: `pnpm build`(成功)

```bash
git add src/styles/theme.css docs/THEMING.md
git commit -m "feat(theme): promote SearchDialog/MediaViewer palette to global tokens (both themes)"
```

---

### Task 6: 删除 SearchDialog / MediaViewer 本地调色板

删掉两组件里各自的一份本地 CSS 变量定义,让它们消费 Task 5 的全局 token。删完后:白色模式两者仍是米白(值来自 light 块),蓝色模式两者变深色(值来自 `:root`)—— 符合「复用同一方案」。

**Files:**
- Modify: `src/home/components/SearchDialog.vue`(删本地 `--var` 定义,约 line 417–436)
- Modify: `src/files/viewers/MediaViewer.vue`(删本地 `--var` 定义,约 line 472–477)

**Interfaces:**
- Consumes: Task 5 的全局 token

- [ ] **Step 1: 删 SearchDialog 本地板**

删除 `SearchDialog.vue` `<style>` 里定义这些自定义属性的声明行(`--bg/--card/--fg/--fg-muted/--fg-subtle/--border/--divider/--hover/--sem-*/--dem-*/--nrm-*/--hit-*/--success/--accent/--accent-text/--grad-a/--grad-b/--accent-soft*`,约 417–436 行)。**只删这些 `--xxx: …;` 声明**,保留承载它们的选择器及其它属性;若选择器删空则一并删除空规则。组件内其它 `var(--…)` 引用不动(现在解析到全局)。

- [ ] **Step 2: 删 MediaViewer 本地板**

删除 `MediaViewer.vue` `<style>` 里 `.audio-panel` 上定义的 `--bg/--card/--fg/--fg-muted/--fg-subtle/--border/--hover/--accent/--accent-text/--grad-a/--grad-b/--accent-soft*/--hl-*` 声明(约 472–477 行)。保留 `.audio-panel` 选择器的其它属性(`background/color/border/box-shadow` 等,它们已用 `var(--…)`)。

- [ ] **Step 3: 检查遗留字面色 + 播放器 chrome**

在两文件 `<style>` 内 grep 残留硬编码色:

Run: `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/home/components/SearchDialog.vue src/files/viewers/MediaViewer.vue`

对每处命中:换成对应全局 token;`MediaViewer` 里播放器标题/时间等原先写死的白色(浮在 ViewerShell 背景上)—— 改用 `var(--fg)`(ViewerShell 背景在白色模式也会变浅,见 Task 7),不要保留写死白;确实主题无关的纯中性值(极少)才加 `/* theme-exception: 原因 */`。SPEAKER_COLORS 等 `.ts` 内的 JS 颜色常量不在本任务范围(guard 不扫 `.ts`),保留。

- [ ] **Step 4: 运行相关测试 + 类型检查**

Run: `pnpm exec vitest run src/files/viewers src/home/components/SearchDialog.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS

- [ ] **Step 5: 人工视觉冒烟**

`pnpm dev`;白色模式打开搜索面板与音频预览 —— 应与现状米白观感一致;切蓝色模式 —— 两者应变为深色玻璃、文字白、无对比问题。

- [ ] **Step 6: 提交**

```bash
git add src/home/components/SearchDialog.vue src/files/viewers/MediaViewer.vue
git commit -m "refactor(theme): drop local palettes in SearchDialog/MediaViewer, consume global tokens"
```

---

### Task 7: 收编散落硬编码色(全站)

把其余组件 `<style>` 与 `viewers.css` 里的硬编码色换成 token。参考探查(热点):`AddPanel.vue`(~21)、`UploadPanel.vue`(~20)、`OperationStatusBar.vue`、`NetworkStorageDialog.vue`、`ShareLinkDialog.vue`、`Welcome.vue`、`Files.vue`、`ClockWidget.vue`、`AiWidget.vue`、`Login.vue`、`ViewerShell.vue`、`PdfViewer.vue`、`MarkdownViewer.vue`、`SelectionToolbar.vue`、`RenameDialog.vue`、`NewItemDialog.vue`、`FilesSidebar.vue`、`FileRow.vue`、`FileTile.vue`、`FileListView.vue`、`ShareRow.vue`、`FavoriteStar.vue`、`Breadcrumb.vue`、`CodeViewer.vue`、`ImageViewer.vue`、`SharesPage.vue`、`WidgetCard.vue`、`AppTile.vue`、`components/ui/AlertDialog.vue`、`components/ui/ContextMenu.vue`、`src/files/viewers/viewers.css` 等。

**Files:**
- Modify: 上列各 `.vue` 的 `<style>` + `src/files/viewers/viewers.css`

**替换映射(按语义选 token,取值查 `docs/THEMING.md §2`):**

| 硬编码语义 | 换成 |
|---|---|
| 面板/卡片底(白/深玻璃) | `var(--card-bg)` 或 `var(--card)` |
| 页面/内嵌区底 | `var(--bg)` / `var(--inner-bg)` |
| 正文文字 | `var(--fg)` |
| 次要/提示文字 | `var(--fg-muted)` / `var(--fg-faint)` / `var(--fg-subtle)` |
| 描边/分隔线 | `var(--card-border)` / `var(--border)` / `var(--inner-border)` / `var(--divider)` |
| 主强调(链接/选中/主按钮) | `var(--accent)` / `var(--accent-text)`;渐变用 `var(--grad-a)`→`var(--grad-b)` |
| 强调淡底/描边 | `var(--accent-soft)` / `-2` / `-bd` |
| hover 底 | `var(--hover)` |
| 成功/危险 | `var(--good)`·`var(--success)` / `var(--remove-bg)` |
| 阴影 | `var(--card-shadow)` / `-hi` / `--icon-shadow` |
| 遮罩 | `var(--overlay-bg)`(+ `backdrop-filter: var(--overlay-blur)`) |
| 模态浮层底 | `var(--popup-bg)` |

既有 token 表达不了的新语义 → 按 `THEMING.md §5` 新增 token(两块都给值),不要就地写死。纯中性、确属主题无关的值(如某些纯黑投影)保留时须加 `/* theme-exception: 原因 */`。

- [ ] **Step 1: 逐文件收编**

对上表每个文件:`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(' <file>` 找出 `<style>`/CSS 内命中,按映射逐个替换;边改边 `pnpm dev` 目测该组件白/蓝两色无异常。建议按区域分批 commit(见下)。

- [ ] **Step 2: 每批类型检查 + 相关测试**

Run(示例,按批调整路径):`pnpm exec vue-tsc --noEmit && pnpm exec vitest run src/files src/home`
Expected: 无类型错、相关测试 PASS

- [ ] **Step 3: 分批提交**

```bash
git add src/home/components/AddPanel.vue src/files/components/UploadPanel.vue # …本批文件
git commit -m "refactor(theme): tokenize hardcoded colors (home/files panels)"
# 其余区域(dialogs / viewers / login+welcome / misc widgets)各自成批提交
```

> 完成判据由 Task 8 的 guard 测试统一裁定(全绿即收编干净)。本任务先尽力扫完上列文件。

---

### Task 8: 约定守卫(永久 linter)+ 全量验证 + 部署

加一个永久 Vitest 守卫:扫 `src/**/*.{vue,css}`(排除 `theme.css`)的 `<style>`/CSS,发现未标注例外的颜色字面量即红。它把 §0 约定变成可执行的 CI 门,并裁定 Task 7 是否收编干净。

**Files:**
- Create: `src/styles/color-guard.test.ts`

- [ ] **Step 1: 写守卫测试**

```ts
// src/styles/color-guard.test.ts
// 约定守卫(见 CLAUDE.md / THEMING.md §0):New-UI 一切可见颜色必须走 var(--token)。
// 本测试扫描所有 .vue 的 <style> 与 .css(theme.css 除外——它是 token 定义处),
// 发现未标注 /* theme-exception: 原因 */ 的 #hex / rgb()/rgba()/hsl() 即失败。
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC = join(__dirname, '..') // -> src/
const HEX = /#[0-9a-fA-F]{3,8}\b/
const FUNC = /\b(rgba?|hsla?)\s*\(/
// theme.css 是 token 真相源,字面色本就在此定义,豁免。
const SKIP = new Set(['styles/theme.css'])

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (extname(p) === '.vue' || extname(p) === '.css') acc.push(p)
  }
  return acc
}

// .vue 只取 <style> 块;.css 全文。返回 [行号, 行文本]。
function colorLines(file: string): Array<[number, string]> {
  const src = readFileSync(file, 'utf8')
  let text = src
  let base = 0
  const out: Array<[number, string]> = []
  if (extname(file) === '.vue') {
    const re = /<style[^>]*>([\s\S]*?)<\/style>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const startLine = src.slice(0, m.index).split('\n').length
      m[1].split('\n').forEach((line, i) => {
        if (line.includes('theme-exception')) return
        if (HEX.test(line) || FUNC.test(line)) out.push([startLine + i, line.trim()])
      })
    }
    return out
  }
  text.split('\n').forEach((line, i) => {
    if (line.includes('theme-exception')) return
    if (HEX.test(line) || FUNC.test(line)) out.push([i + 1, line.trim()])
  })
  return out
  void base
}

describe('color-token guard', () => {
  const files = walk(SRC)
  for (const file of files) {
    const rel = file.slice(SRC.length + 1).replace(/\\/g, '/')
    if (SKIP.has(rel) || rel.endsWith('.test.ts')) continue
    it(`${rel} 无硬编码颜色`, () => {
      const offenders = colorLines(file)
      expect(
        offenders,
        `\n${rel} 发现硬编码颜色(改为 var(--token) 或加 /* theme-exception: 原因 */):\n` +
          offenders.map(([n, l]) => `  L${n}: ${l}`).join('\n'),
      ).toEqual([])
    })
  }
})
```

- [ ] **Step 2: 运行守卫,按报告清剩余漏网**

Run: `pnpm exec vitest run src/styles/color-guard.test.ts`
Expected: 起初可能 FAIL 并列出 Task 7 漏掉的文件/行 —— 逐个改成 token(或加 `theme-exception` 注释),直到 PASS。
(注:守卫不扫 `.ts` 内的 JS 颜色常量、也不扫模板内联 `:style` 字面色;若这类值需主题化,单独处理。)

- [ ] **Step 3: 全量测试 + 类型 + 构建**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit && pnpm build`
Expected: 全 PASS / 无类型错 / 构建成功

- [ ] **Step 4: 提交守卫**

```bash
git add src/styles/color-guard.test.ts
git commit -m "test(theme): add permanent color-literal guard enforcing token convention"
```

- [ ] **Step 5: 部署 + 真机验收**

Run: `./scripts/deploy.sh`
Expected: 构建 + rsync 到 `/var/lib/nimoos/www/app/`

真机 `http://192.168.1.143/#/…`:切白色、蓝色各一遍,逐屏扫(主页/Dock/小组件/文件区/预览器/所有弹窗/登录/Welcome),确认**白色模式无深色残留**、蓝色模式与改造前一致、切换即时无闪、刷新后保持(localStorage)。

---

## 自查(Self-Review)

- **Spec 覆盖**:§3 架构→Task 3;§4 token 映射→Task 3/5;§2 约定→Task 8 guard + `CLAUDE.md`/`THEMING.md`(已存在);§5 收编本地板/散落色→Task 6/7;§6 store+持久化+防闪→Task 1/2;§7 切换 UI→Task 4;§9 验证→各任务 + Task 8;§10 YAGNI(不做第三主题/服务器同步/语义重命名)→未纳入,`persist` 未实现符合预期。✅ 无遗漏。
- **占位符扫描**:无 TBD/TODO;每个代码步骤含完整代码;Task 7 是明确的映射驱动机械收编,完成判据由 Task 8 guard 客观裁定,非占位。
- **类型/命名一致**:`applyTheme/initialTheme/isTheme/THEMES/Theme/useThemeStore` 在 Task 1 定义,Task 2/4 引用一致;i18n 键 `themeToggle/themeLight/themeBlue` 一致;新增 token 名 Task 5 定义、Task 6/7 消费一致。
- **服务器同步**:spec §6 说预留 `persist()` 壳但本轮不接线 —— 当前 store 未含 `persist`;若严格留壳,可后续加,不阻塞本计划(§10 已列为非目标)。

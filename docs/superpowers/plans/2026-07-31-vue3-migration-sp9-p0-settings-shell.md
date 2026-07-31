# SP9-P0 设置壳 + 地基 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把系统设置区的**形状**立起来 —— `/settings/:tab` 路由页(左 tab rail + 右内容)、9 个 tab 的空骨架、i18n 与 theme 的 SP9 分片接线,零后端调用,做完能在浏览器里看到并切换。

**Architecture:** Vue2 的 3095 行模态面板 `SettingsPanel.vue` → New-UI 的路由页(授权偏离 #2,§12)。壳 `SettingsShell.vue` 提供左侧 rail + 顶部用户块 + 回主页;路由组件 `SettingsPage.vue` 按 `:tab` 参数挑一个 panel 骨架塞进壳的 slot。tab 合法性判定与"上次 tab"记忆抽成纯函数,由路由 `redirect` / `beforeEnter` 消费,便于单测。i18n 与 theme 走 SP9 专属分片文件,此后本期不再碰 `zh_cn.ts` / `en_us.ts` / `theme.css`。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript(strict) · vue-router 4(hash 路由) · vue-i18n 9 · vitest + @vue/test-utils · 手写 CSS(无框架)

---

## Global Constraints

以下每条对**每个**任务都生效,不再逐任务重复。

- **工作树**:`/home/nimo/NimoTech/.sp9/NimoOS-New-UI`,分支 `sp9-final-views`。**不碰** `/home/nimo/NimoTech/NimoOS-New-UI`(时间机器会话)、`.sp7/`、`.sp8/`。
- **不碰 `src/files/**`**(含其测试 fixture / 快照)—— 时间机器落在那里,将来要合并。
- **提交一律显式 pathspec**:`git commit <path> [<path>…] -m "…"`。**永不** `-a`、**永不** `git add -A`、**永不** `git stash -u`。新建文件先 `git add <该文件路径>` 再提交。
- **颜色只能走 theme token**(`var(--…)`)。本期新语义 token 一律加进 `src/styles/theme.sp9.css`,且 `:root{}` 与 `:root[data-theme="light"]{}` **两块都要给值**。**全程不碰 `src/styles/theme.css`**。
- **i18n 新 key 只落分片**:`src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`,**必须同时加**,**扁平 key、值必须是字符串**(`parity.test.ts` 断言 `typeof v === 'string'`,不能嵌套对象)。**任务 1 之后不再碰 `zh_cn.ts` / `en_us.ts`**。
- **移植纪律**(roadmap 2026-07-27):界面严格 1:1;Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并在代码里注释登记;**禁无关重构**。
- **任务门**:每个任务收尾跑 `pnpm test` + `pnpm exec vue-tsc --noEmit`。基线 = **261 文件 / 1853 测试全绿 + tsc 零错误**(台账 `.superpowers/sdd/sp9/00-baseline.md`)。判定:**tsc 零错误、测试零失败、总数只增不减**。
- **验收 dev server 端口 5299**:`pnpm dev --port 5299`。**不是** `./scripts/deploy.sh`。
- 全部命令在 `/home/nimo/NimoTech/.sp9/NimoOS-New-UI` 下执行。包管理器 **pnpm**。

### P0 与 spec 的三处出入(已核对 Vue2 源码,依据见台账 `00-baseline.md`)

1. **tab rail 是 7 项不是 9 项。** Vue2 `SettingsPanel.vue` L855-863 的 `tabs` 只有 7 项;`account` 的入口是侧栏顶部用户块(L13-20),`developer` 的入口是 general 页内的一行(L315)且**无任何开关门控**。本计划:**9 条路由 + 9 个骨架**,rail 渲染 7 项(非 admin 6 项),`account` 走用户块,`developer` 走 general 骨架内的入口行。
2. **`.scss` → `.css`。** 本仓库未装 `sass`、全仓零 `.scss`;用 `.scss` 会新增构建依赖,与「依赖只装一次」冲突。落 `src/settings/styles/settings.css`。
3. **窄屏无对齐对象。** Vue2 `SettingsPanel.vue` 整文件零 `@media`(固定尺寸模态)。按 New-UI 同类外壳 `src/storage/components/StorageShell.vue`(SP6 已实盘验收)的窄屏写法自定,落在授权偏离 #2 的覆盖范围内。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` | **新建。** SP9 全期的文案分片,扁平 key、值为字符串 |
| `src/i18n/index.ts` | **改。** 一次性合并分片进 `messages` |
| `src/i18n/parity.test.ts` | **改。** 断言**合并后**集合一致 |
| `src/styles/theme.sp9.css` | **新建。** SP9 新语义 token,两套主题块都给值 |
| `src/styles/theme.sp9.test.ts` | **新建。** 守卫:两块 token 名集合必须一致 |
| `src/styles/color-guard.test.ts` | **改。** 跳过名单加 `styles/theme.sp9.css` |
| `src/main.ts` | **改。** `import './styles/theme.sp9.css'`(在 theme.css 之后) |
| `src/settings/util/tabs.ts` | **新建。** tab 常量、类型守卫、按角色算 rail 项(纯函数) |
| `src/settings/util/lastTab.ts` | **新建。** `nimoos_settings_last_tab` 读写(纯函数 + localStorage) |
| `src/settings/components/SettingsSection.vue` | **新建。** 骨架通用件:标题 / 返回头 / 内容容器 / 空态位 |
| `src/settings/panels/*.vue`(9 个) | **新建。** 每 tab 一个空骨架,后续期往里填 |
| `src/settings/components/SettingsShell.vue` | **新建。** 左 rail + 用户块 + 回主页 + 内容 slot + 窄屏 |
| `src/settings/views/SettingsPage.vue` | **新建。** 路由组件:按 `:tab` 挑 panel、写记忆 |
| `src/settings/styles/settings.css` | **新建。** 设置区共用样式(骨架/列表行),scoped 之外的公共部分 |
| `src/router/index.ts` | **改。** 加 `/settings` 与 `/settings/:tab` 两条(**本期唯一一次碰它**) |
| `package.json` / `pnpm-lock.yaml` | **改。** 装 `@novnc/novnc`(P5 用,本期只装这一次) |

---

## Task 1: 地基分片接线(i18n / theme / color-guard / main.ts)

**Files:**
- Create: `src/i18n/zh_cn.sp9.ts`
- Create: `src/i18n/en_us.sp9.ts`
- Create: `src/styles/theme.sp9.css`
- Create: `src/styles/theme.sp9.test.ts`
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/parity.test.ts`
- Modify: `src/styles/color-guard.test.ts:64`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: 无(本任务是本期第一个)
- Produces:
  - `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` 默认导出 `Record<string, string>`,后续任务往里加 key
  - CSS 变量 `--set-rail-bg`、`--set-rail-border`,后续任务在 `<style>` 里用 `var(--set-rail-bg)`
  - `i18n` 实例的 `messages` 已含分片 —— 后续任务用 `t('settingsXxx')` 直接可取

- [ ] **Step 1: 建两个 i18n 分片文件**

`src/i18n/zh_cn.sp9.ts`:

```ts
// SP9(收尾视图:系统设置 / KVM / Search)文案分片。
// 与 sp7/sp8 并行开发,分片可让三线几乎不在 i18n 上相撞(spec §4.2 / §9.3)。
// 约定:扁平 key、值必须是字符串(parity.test.ts 断言 typeof v === 'string')。
export default {
  settingsTitle: '设置',
  settingsTabGeneral: '通用',
  settingsTabStorage: '存储',
  settingsTabNetwork: '网络',
  settingsTabApps: '应用',
  settingsTabTerminal: '终端与日志',
  settingsTabSystemStatus: '系统状态',
  settingsTabFolderPermissions: '文件夹权限',
  settingsTabAccount: '账户',
  settingsTabDeveloper: '开发者模式',
  settingsSkeletonHint: '本页内容将在后续阶段接入。',
}
```

`src/i18n/en_us.sp9.ts`:

```ts
// SP9 (final views: Settings / KVM / Search) locale shard. See zh_cn.sp9.ts.
export default {
  settingsTitle: 'Settings',
  settingsTabGeneral: 'General',
  settingsTabStorage: 'Storage',
  settingsTabNetwork: 'Network',
  settingsTabApps: 'App',
  settingsTabTerminal: 'Terminal and Logs',
  settingsTabSystemStatus: 'System Status',
  settingsTabFolderPermissions: 'Folder Permissions',
  settingsTabAccount: 'Account',
  settingsTabDeveloper: 'Developer mode',
  settingsSkeletonHint: 'This tab lands in a later phase.',
}
```

- [ ] **Step 2: 合并分片进 i18n 实例**

`src/i18n/index.ts` —— 把开头四行替换成:

```ts
import { createI18n } from 'vue-i18n'
import zh from './zh_cn'
import en from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// SP9 起文案走分片(spec §4.2):新 key 只落 *.sp9.ts,不再改 zh_cn.ts / en_us.ts,
// 以免与 sp7/sp8/时间机器三条并行线在同一文件上相撞。
const messages = { zh_cn: { ...zh, ...zhSp9 }, en_us: { ...en, ...enSp9 } }
```

其余不动(`initialLocale()` 里的 `stored in messages` 仍然成立)。

- [ ] **Step 3: 改 parity 测试,断言合并后集合**

`src/i18n/parity.test.ts` 整体替换为:

```ts
import { describe, it, expect } from 'vitest'
import zhBase from './zh_cn'
import enBase from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// SP9 起文案分片(spec §4.2)。断言对象是「合并后」的集合 —— 只测基座会漏掉分片里的缺键。
const zh: Record<string, unknown> = { ...zhBase, ...zhSp9 }
const en: Record<string, unknown> = { ...enBase, ...enSp9 }

describe('i18n locale parity', () => {
  it('en_us 与 zh_cn 顶层 key 集合完全一致(含 sp9 分片)', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('en_us 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('zh_cn 值均为非空字符串', () => {
    for (const [k, v] of Object.entries(zh)) {
      expect(typeof v, `key ${k}`).toBe('string')
      expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
    }
  })

  it('分片不得覆盖基座已有 key(静默改文案)', () => {
    const dup = Object.keys(zhSp9).filter((k) => k in zhBase)
    expect(dup, `sp9 分片与基座 key 冲突: ${dup.join(', ')}`).toEqual([])
  })

  it('抽查若干英文文案', () => {
    expect(en.cpu).toBe('CPU')
    expect(en.memory).toBe('Memory')
    expect(en.filesTitle).toBe('Files')
    expect(en.settingsTitle).toBe('Settings')
  })
})
```

- [ ] **Step 4: 建 theme 分片(两套主题块都给值)**

`src/styles/theme.sp9.css`:

```css
/*
 * SP9(收尾视图)专属 theme token 分片(spec §4.3)。
 * 由 main.ts 在 theme.css 之后 import —— 不能写成 theme.css 末尾的 @import,
 * CSS 规定 @import 必须位于所有规则之前。
 * 硬约束:每个颜色 token 在 :root 与 :root[data-theme="light"] 两块里都要有值。
 * 本文件是 token 定义处,允许裸颜色字面量(与 theme.css 同例,已在 color-guard 跳过名单里)。
 */
:root {
  --set-rail-bg: rgba(255, 255, 255, 0.06);
  --set-rail-border: rgba(255, 255, 255, 0.12);
}

:root[data-theme='light'] {
  --set-rail-bg: rgba(0, 0, 0, 0.03);
  --set-rail-border: rgba(0, 0, 0, 0.08);
}
```

- [ ] **Step 5: 写 theme 分片的守卫测试(先写,预期它此刻就该通过)**

`src/styles/theme.sp9.test.ts`:

```ts
// 守卫 New-UI 硬约束(CLAUDE.md / docs/THEMING.md):
// theme.sp9.css 里每个 token 必须在 :root 与 :root[data-theme="light"] 两块都有值。
// theme.css 本身没有这个守卫(历史原因),分片是新文件,从第一天就上守卫。
import { describe, it, expect } from 'vitest'
import src from './theme.sp9.css?raw'

function tokensOf(selector: string): string[] {
  const i = src.indexOf(selector)
  expect(i, `找不到选择器 ${selector}`).toBeGreaterThanOrEqual(0)
  const open = src.indexOf('{', i)
  const close = src.indexOf('}', open)
  const body = src.slice(open + 1, close)
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]).sort()
}

describe('theme.sp9.css token 两套主题齐备', () => {
  it(':root 与 :root[data-theme="light"] 的 token 名集合一致', () => {
    expect(tokensOf(":root[data-theme='light']")).toEqual(tokensOf(':root {'))
  })

  it('至少定义了一个 token(接线已生效,不是空文件)', () => {
    expect(tokensOf(':root {').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6: 把 theme.sp9.css 加进 color-guard 跳过名单**

`src/styles/color-guard.test.ts` L64,把

```ts
    if (rel === 'styles/theme.css') continue
```

替换为

```ts
    // token 定义文件:裸字面量是它的本职工作。theme.sp9.css 是 SP9 分片(spec §4.3),同理豁免。
    if (rel === 'styles/theme.css' || rel === 'styles/theme.sp9.css') continue
```

- [ ] **Step 7: main.ts 引入分片**

`src/main.ts`,把

```ts
import './styles/theme.css'
```

替换为

```ts
import './styles/theme.css'
import './styles/theme.sp9.css'
```

（顺序不能颠倒:分片依赖基座已定义的 token 语义,且后加载才能覆盖。)

- [ ] **Step 8: 跑测试确认全绿且总数增加**

Run: `pnpm test 2>&1 | tail -8`
Expected: `Tests` 数 > 1853(新增 theme.sp9 的 2 例 + parity 新增的 2 例),`0 failed`

Run: `pnpm exec vue-tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK`

- [ ] **Step 9: 提交**

```bash
git add src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/styles/theme.sp9.css src/styles/theme.sp9.test.ts
git commit src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/i18n/index.ts src/i18n/parity.test.ts \
  src/styles/theme.sp9.css src/styles/theme.sp9.test.ts src/styles/color-guard.test.ts src/main.ts \
  -m "feat(sp9-p0): i18n 与 theme 的 SP9 分片接线

分片后 SP9 全程不再碰 zh_cn.ts / en_us.ts / theme.css,与 sp7/sp8/时间机器
三条并行线在这三个文件上的足迹归零(spec §4.2/§4.3/§9.3)。
parity 测试改为断言合并后集合,并新增「分片不得覆盖基座 key」一条。
color-guard 跳过名单加 theme.sp9.css —— 它是 token 定义处,裸字面量是本职。"
```

---

## Task 2: tab 模型与「上次 tab」记忆(纯函数)

**Files:**
- Create: `src/settings/util/tabs.ts`
- Create: `src/settings/util/tabs.test.ts`
- Create: `src/settings/util/lastTab.ts`
- Create: `src/settings/util/lastTab.test.ts`

**Interfaces:**
- Consumes: Task 1 的 i18n 分片 key `settingsTab*`(本任务只引用 key 名字符串,不调 `t()`)
- Produces:
  - `SETTINGS_TABS: readonly SettingsTab[]` —— 9 个 tab id
  - `type SettingsTab = 'general' | 'storage' | 'network' | 'apps' | 'terminal' | 'system-status' | 'folder-permissions' | 'account' | 'developer'`
  - `DEFAULT_TAB: SettingsTab`(`'general'`)
  - `isSettingsTab(v: unknown): v is SettingsTab`
  - `railTabsFor(role: string | undefined): readonly SettingsTab[]`
  - `TAB_LABEL_KEY: Record<SettingsTab, string>`
  - `readLastTab(): SettingsTab` / `writeLastTab(tab: SettingsTab): void` / `LAST_TAB_KEY: string`

- [ ] **Step 1: 写 tabs 的失败测试**

`src/settings/util/tabs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  SETTINGS_TABS,
  RAIL_TABS,
  DEFAULT_TAB,
  TAB_LABEL_KEY,
  isSettingsTab,
  railTabsFor,
} from './tabs'

describe('settings tabs 模型', () => {
  it('9 个 tab,顺序与 Vue2 一致(rail 7 项 + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'folder-permissions',
      'account',
      'developer',
    ])
  })

  it('rail 只有 7 项 —— account 走用户块、developer 走 general 页内入口(Vue2 L855-863/L13/L315)', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'folder-permissions',
    ])
  })

  it('默认 tab 是 general', () => {
    expect(DEFAULT_TAB).toBe('general')
  })

  it('每个 tab 都有文案 key', () => {
    for (const t of SETTINGS_TABS) {
      expect(typeof TAB_LABEL_KEY[t], t).toBe('string')
      expect(TAB_LABEL_KEY[t].length, t).toBeGreaterThan(0)
    }
  })

  it('isSettingsTab 只认已知 id', () => {
    expect(isSettingsTab('general')).toBe(true)
    expect(isSettingsTab('system-status')).toBe(true)
    expect(isSettingsTab('nope')).toBe(false)
    expect(isSettingsTab('')).toBe(false)
    expect(isSettingsTab(undefined)).toBe(false)
    expect(isSettingsTab(null)).toBe(false)
    expect(isSettingsTab(['general'])).toBe(false)
  })

  it('admin 看到全部 7 项', () => {
    expect(railTabsFor('admin')).toEqual(RAIL_TABS)
  })

  it('非 admin 看不到 folder-permissions(Vue2 visibleTabs L1034)', () => {
    expect(railTabsFor('user')).not.toContain('folder-permissions')
    expect(railTabsFor('user')).toHaveLength(6)
  })

  it('role 缺失按非 admin 处理(保守:不泄漏管理项)', () => {
    expect(railTabsFor(undefined)).not.toContain('folder-permissions')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/util/tabs.test.ts`
Expected: FAIL —— `Failed to resolve import "./tabs"`

- [ ] **Step 3: 实现 tabs.ts**

```ts
// 系统设置的 tab 模型。对位 Vue2 src/components/settings/SettingsPanel.vue:
//   - data().tabs (L855-863) —— 侧栏 rail 的 7 项
//   - visibleTabs (L1034)    —— 非 admin 过滤掉 folder-permissions
//   - 用户块 (L13-20)         —— account 的唯一入口,不在 rail 上
//   - general 页内一行 (L315) —— developer 的唯一入口,不在 rail 上,且无任何开关门控
// spec §4.1 写「rail 9 项」与源码不符,此处以源码为准(界面严格 1:1)。

export const SETTINGS_TABS = [
  'general',
  'storage',
  'network',
  'apps',
  'terminal',
  'system-status',
  'folder-permissions',
  'account',
  'developer',
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** 侧栏 rail 上可见的 7 项(account / developer 有各自入口,不在 rail 上)。 */
export const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 7)

export const DEFAULT_TAB: SettingsTab = 'general'

export const TAB_LABEL_KEY: Record<SettingsTab, string> = {
  general: 'settingsTabGeneral',
  storage: 'settingsTabStorage',
  network: 'settingsTabNetwork',
  apps: 'settingsTabApps',
  terminal: 'settingsTabTerminal',
  'system-status': 'settingsTabSystemStatus',
  'folder-permissions': 'settingsTabFolderPermissions',
  account: 'settingsTabAccount',
  developer: 'settingsTabDeveloper',
}

export function isSettingsTab(v: unknown): v is SettingsTab {
  return typeof v === 'string' && (SETTINGS_TABS as readonly string[]).includes(v)
}

/** Vue2 visibleTabs:只有 admin 能看到 folder-permissions。role 缺失按非 admin 处理。 */
export function railTabsFor(role: string | undefined): readonly SettingsTab[] {
  if (role === 'admin') return RAIL_TABS
  return RAIL_TABS.filter((t) => t !== 'folder-permissions')
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/util/tabs.test.ts`
Expected: PASS(8 例)

- [ ] **Step 5: 写 lastTab 的失败测试**

`src/settings/util/lastTab.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { LAST_TAB_KEY, readLastTab, writeLastTab } from './lastTab'

describe('设置区「上次 tab」记忆', () => {
  beforeEach(() => localStorage.clear())

  it('沿用 Vue2 的 localStorage 键名', () => {
    expect(LAST_TAB_KEY).toBe('nimoos_settings_last_tab')
  })

  it('空存储 → general', () => {
    expect(readLastTab()).toBe('general')
  })

  it('读回写入的合法 tab', () => {
    writeLastTab('network')
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('network')
    expect(readLastTab()).toBe('network')
  })

  it('存了非法值 → 回落 general(不是崩,也不是原样返回)', () => {
    localStorage.setItem(LAST_TAB_KEY, 'bogus')
    expect(readLastTab()).toBe('general')
  })

  it('localStorage 抛错(隐私模式/配额)也不炸,回落 general', () => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('denied')
    }
    try {
      expect(readLastTab()).toBe('general')
    } finally {
      Storage.prototype.getItem = orig
    }
  })

  it('写入抛错被吞掉,不影响调用方', () => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      expect(() => writeLastTab('apps')).not.toThrow()
    } finally {
      Storage.prototype.setItem = orig
    }
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/util/lastTab.test.ts`
Expected: FAIL —— `Failed to resolve import "./lastTab"`

- [ ] **Step 7: 实现 lastTab.ts**

```ts
import { DEFAULT_TAB, isSettingsTab, type SettingsTab } from './tabs'

/** 键名沿用 Vue2(SettingsPanel.vue L854/L1179),这样从旧 UI 切过来记忆不丢。 */
export const LAST_TAB_KEY = 'nimoos_settings_last_tab'

/**
 * Vue2 是 `localStorage.getItem(KEY) || 'general'` —— 存了非法值会原样吃进去,
 * 之后渲染成空白页(Vue2 的 v-else-if 链全部落空)。此处改正确:非法值一律回落 general。
 * (移植纪律:Vue2 的 bug 不照抄。)
 */
export function readLastTab(): SettingsTab {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(LAST_TAB_KEY)
  } catch {
    return DEFAULT_TAB // 隐私模式等禁用存储:降级到默认,不抛
  }
  return isSettingsTab(raw) ? raw : DEFAULT_TAB
}

export function writeLastTab(tab: SettingsTab): void {
  try {
    localStorage.setItem(LAST_TAB_KEY, tab)
  } catch {
    /* 配额/隐私模式:记忆丢了不影响使用,静默降级 */
  }
}
```

- [ ] **Step 8: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/util/lastTab.test.ts`
Expected: PASS(6 例)

- [ ] **Step 9: 提交**

```bash
git add src/settings/util/tabs.ts src/settings/util/tabs.test.ts \
        src/settings/util/lastTab.ts src/settings/util/lastTab.test.ts
git commit src/settings/util/tabs.ts src/settings/util/tabs.test.ts \
           src/settings/util/lastTab.ts src/settings/util/lastTab.test.ts \
  -m "feat(sp9-p0): 设置区 tab 模型与「上次 tab」记忆

对位 Vue2 SettingsPanel.vue:rail 7 项、非 admin 隐藏 folder-permissions、
account 与 developer 各有独立入口不上 rail。
记忆键名沿用 nimoos_settings_last_tab;Vue2 对非法存值不做校验会渲染空白页,
此处改正确为回落 general(移植纪律:bug 不照抄)。"
```

---

## Task 3: 骨架通用件 + 9 个 tab 空骨架

**Files:**
- Create: `src/settings/styles/settings.css`
- Create: `src/settings/components/SettingsSection.vue`
- Create: `src/settings/components/SettingsSection.test.ts`
- Create: `src/settings/panels/GeneralPanel.vue`
- Create: `src/settings/panels/StoragePanel.vue`
- Create: `src/settings/panels/NetworkPanel.vue`
- Create: `src/settings/panels/AppsPanel.vue`
- Create: `src/settings/panels/TerminalPanel.vue`
- Create: `src/settings/panels/SystemStatusPanel.vue`
- Create: `src/settings/panels/FolderPermissionsPanel.vue`
- Create: `src/settings/panels/AccountPanel.vue`
- Create: `src/settings/panels/DeveloperPanel.vue`
- Create: `src/settings/panels/panels.test.ts`
- Modify: `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`(无新增 key,本任务复用 Task 1 已加的)

**Interfaces:**
- Consumes: Task 2 的 `SettingsTab` / `TAB_LABEL_KEY`;Task 1 的 `settingsSkeletonHint` 文案 key、`--set-rail-*` token
- Produces:
  - `SettingsSection.vue` props:`{ title?: string; backTo?: string }`,默认 slot = 内容区
  - 9 个 panel 组件,**均无 props、无 emit**;`GeneralPanel` 额外 emit `open-tab` 事件、payload `'developer'`
  - `PANEL_BY_TAB: Record<SettingsTab, Component>`(导出自 `src/settings/panels/index.ts`)

- [ ] **Step 1: 建设置区公共样式**

`src/settings/styles/settings.css`:

```css
/*
 * 设置区公共样式(非 scoped)。只放跨组件复用的骨架/列表样式;
 * 组件自己的布局仍写在各自 scoped <style> 里。
 * 颜色一律 var(--token)(CLAUDE.md 硬约束);新语义 token 落 src/styles/theme.sp9.css。
 */
.set-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.set-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}
.set-section-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
}
.set-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: 20px;
  font-weight: 600;
  color: var(--fg);
  font-family: inherit;
}
.set-back:hover {
  color: var(--accent);
}
.set-section-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.set-skeleton {
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 28px 20px;
  text-align: center;
  color: var(--fg-faint);
  font-size: 13px;
}
```

- [ ] **Step 2: 写 SettingsSection 的失败测试**

`src/settings/components/SettingsSection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'

describe('SettingsSection', () => {
  it('给 title 时渲染 h1 标题', () => {
    const w = mount(SettingsSection, { props: { title: '通用' } })
    expect(w.find('.set-section-title').text()).toBe('通用')
    expect(w.find('.set-back').exists()).toBe(false)
  })

  it('不给 title 也不给 backTo 时不渲染头部(对位 Vue2 terminal 无标题, L51)', () => {
    const w = mount(SettingsSection)
    expect(w.find('.set-section-head').exists()).toBe(false)
  })

  it('给 backTo 时渲染返回按钮而不是 h1(对位 Vue2 developer, L52-56)', () => {
    const w = mount(SettingsSection, { props: { title: '开发者模式', backTo: 'general' } })
    expect(w.find('.set-section-title').exists()).toBe(false)
    expect(w.find('.set-back').text()).toContain('开发者模式')
  })

  it('点返回按钮 emit back 并带上目标 tab', async () => {
    const w = mount(SettingsSection, { props: { title: '开发者模式', backTo: 'general' } })
    await w.find('.set-back').trigger('click')
    expect(w.emitted('back')).toEqual([['general']])
  })

  it('默认 slot 渲染进内容区', () => {
    const w = mount(SettingsSection, { props: { title: 'x' }, slots: { default: '<p class="probe">hi</p>' } })
    expect(w.find('.set-section-body .probe').text()).toBe('hi')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/components/SettingsSection.test.ts`
Expected: FAIL —— 找不到 `./SettingsSection.vue`

- [ ] **Step 4: 实现 SettingsSection.vue**

```vue
<script setup lang="ts">
// 设置区每个 tab 的通用外框。三种头部形态严格对位 Vue2 SettingsPanel.vue L51-56:
//   backTo 有值 → 返回按钮(developer);title 有值 → h1(多数 tab);都没有 → 无头部(terminal)。
import '../styles/settings.css'

defineProps<{ title?: string; backTo?: string }>()
const emit = defineEmits<{ back: [tab: string] }>()
</script>

<template>
  <section class="set-section">
    <header v-if="backTo || title" class="set-section-head">
      <button v-if="backTo" class="set-back" type="button" @click="emit('back', backTo)">
        ‹ {{ title }}
      </button>
      <h1 v-else class="set-section-title">{{ title }}</h1>
    </header>
    <div class="set-section-body"><slot /></div>
  </section>
</template>
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/components/SettingsSection.test.ts`
Expected: PASS(5 例)

- [ ] **Step 6: 写 9 个 panel 的失败测试**

`src/settings/panels/panels.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import { SETTINGS_TABS } from '../util/tabs'
import { PANEL_BY_TAB } from './index'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

describe('9 个 tab 骨架', () => {
  it('每个 tab 都能取到一个组件', () => {
    for (const t of SETTINGS_TABS) {
      expect(PANEL_BY_TAB[t], t).toBeTruthy()
    }
    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(9)
  })

  it.each(SETTINGS_TABS.filter((t) => t !== 'terminal'))('%s 骨架渲染标题与空态位', (tab) => {
    const w = mount(PANEL_BY_TAB[tab], { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title,.set-back').exists()).toBe(true)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  it('terminal 骨架无标题(对位 Vue2 L51)', () => {
    const w = mount(PANEL_BY_TAB.terminal, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-head').exists()).toBe(false)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  it('developer 骨架用返回按钮而不是标题(对位 Vue2 L52-56)', () => {
    const w = mount(PANEL_BY_TAB.developer, { global: { plugins: [i18n] } })
    expect(w.find('.set-back').exists()).toBe(true)
    expect(w.find('.set-section-title').exists()).toBe(false)
  })

  it('developer 的返回按钮向上冒泡 open-tab general', async () => {
    const w = mount(PANEL_BY_TAB.developer, { global: { plugins: [i18n] } })
    await w.find('.set-back').trigger('click')
    expect(w.emitted('open-tab')).toEqual([['general']])
  })

  it('general 骨架带 developer 入口行,点击 emit open-tab developer(对位 Vue2 L315)', async () => {
    const w = mount(PANEL_BY_TAB.general, { global: { plugins: [i18n] } })
    const row = w.find('.set-dev-entry')
    expect(row.exists()).toBe(true)
    await row.trigger('click')
    expect(w.emitted('open-tab')).toEqual([['developer']])
  })
})
```

- [ ] **Step 7: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/panels/panels.test.ts`
Expected: FAIL —— 找不到 `./index`

- [ ] **Step 8: 实现 9 个 panel**

七个"普通"骨架长得一样,只有 title 的 key 不同。**逐个写出来**,不要抽成工厂 —— 后续 P1-P4 每个都要往里填真实内容,现在共用一个文件反而要拆。

`src/settings/panels/StoragePanel.vue`:

```vue
<script setup lang="ts">
// P0 空骨架。内容见 spec §5.5 / 授权偏离 #3(改为跳转 /storage 的入口卡),P3 填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsSection :title="t('settingsTabStorage')">
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
```

`NetworkPanel.vue`、`AppsPanel.vue`、`SystemStatusPanel.vue`、`FolderPermissionsPanel.vue`、`AccountPanel.vue` 同款,只把 `settingsTabStorage` 分别换成 `settingsTabNetwork` / `settingsTabApps` / `settingsTabSystemStatus` / `settingsTabFolderPermissions` / `settingsTabAccount`,并把注释里的 spec 章节换成 §5.3 / §5.4 / §5.5 / §5.7 / §5.7。

`src/settings/panels/TerminalPanel.vue`(无标题):

```vue
<script setup lang="ts">
// P0 空骨架。Vue2 的 terminal tab 不渲染 h1(SettingsPanel.vue L51),此处 1:1。
// 内容见 spec §5.5;终端位本身是永久空态占位(授权偏离 #4,后端 /v1/sys/wsssh 实测 404)。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsSection>
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
```

`src/settings/panels/DeveloperPanel.vue`(返回头):

```vue
<script setup lang="ts">
// P0 空骨架。Vue2 的 developer 用返回按钮代替 h1(SettingsPanel.vue L52-56),此处 1:1。
// 内容(HTTPS 开关 + WebUIHTTPSModal)见 spec §5.2,P1 填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()
</script>

<template>
  <SettingsSection :title="t('settingsTabDeveloper')" back-to="general" @back="emit('open-tab', $event)">
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
```

`src/settings/panels/GeneralPanel.vue`(带 developer 入口行):

```vue
<script setup lang="ts">
// P0 空骨架 + developer 入口行。
// Vue2 (SettingsPanel.vue L314-321) 把「开发者模式」做成 general 页最后一行,常驻可见、
// 无任何开关门控 —— spec §4.1 写「只在开发者模式开启后出现」与源码不符,此处以源码为准。
// general 的真实内容(设备信息卡/壁纸/语言/时区/更新/关机重启…)见 spec §5.1,P1 填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()
</script>

<template>
  <SettingsSection :title="t('settingsTabGeneral')">
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
    <button class="set-dev-entry" type="button" @click="emit('open-tab', 'developer')">
      <span>{{ t('settingsTabDeveloper') }}</span>
      <span class="set-dev-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>

<style scoped>
.set-dev-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.set-dev-entry:hover {
  background: var(--hover);
}
.set-dev-chevron {
  color: var(--fg-faint);
}
</style>
```

`src/settings/panels/index.ts`:

```ts
import type { Component } from 'vue'
import type { SettingsTab } from '../util/tabs'
import GeneralPanel from './GeneralPanel.vue'
import StoragePanel from './StoragePanel.vue'
import NetworkPanel from './NetworkPanel.vue'
import AppsPanel from './AppsPanel.vue'
import TerminalPanel from './TerminalPanel.vue'
import SystemStatusPanel from './SystemStatusPanel.vue'
import FolderPermissionsPanel from './FolderPermissionsPanel.vue'
import AccountPanel from './AccountPanel.vue'
import DeveloperPanel from './DeveloperPanel.vue'

export const PANEL_BY_TAB: Record<SettingsTab, Component> = {
  general: GeneralPanel,
  storage: StoragePanel,
  network: NetworkPanel,
  apps: AppsPanel,
  terminal: TerminalPanel,
  'system-status': SystemStatusPanel,
  'folder-permissions': FolderPermissionsPanel,
  account: AccountPanel,
  developer: DeveloperPanel,
}
```

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/panels/panels.test.ts src/settings/components/SettingsSection.test.ts`
Expected: PASS(SettingsSection 5 例 + panels 13 例)

- [ ] **Step 10: 提交**

```bash
git add src/settings/styles/settings.css src/settings/components/SettingsSection.vue \
        src/settings/components/SettingsSection.test.ts src/settings/panels/
git commit src/settings/styles/settings.css src/settings/components/SettingsSection.vue \
           src/settings/components/SettingsSection.test.ts src/settings/panels/ \
  -m "feat(sp9-p0): 设置区骨架通用件与 9 个 tab 空骨架

SettingsSection 三种头部形态对位 Vue2 SettingsPanel.vue L51-56:
h1(多数 tab)/ 返回按钮(developer)/ 无头部(terminal)。
GeneralPanel 带 developer 入口行(Vue2 L314-321,常驻无门控)。
本任务零后端调用。"
```

---

## Task 4: SettingsShell 外壳(rail + 用户块 + 回主页 + 窄屏)

**Files:**
- Create: `src/settings/components/SettingsShell.vue`
- Create: `src/settings/components/SettingsShell.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `railTabsFor` / `TAB_LABEL_KEY` / `SettingsTab`;Task 1 的 `settingsTitle` 文案与 `--set-rail-bg` / `--set-rail-border` token;已有文案 key `areaBackHome`
- Produces:
  - `SettingsShell.vue` props:`{ current: SettingsTab }`
  - emit:`select: [tab: SettingsTab]`(rail 项与用户块点击都走它)
  - 默认 slot = 右侧内容区

- [ ] **Step 1: 写失败测试**

`src/settings/components/SettingsShell.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import SettingsShell from './SettingsShell.vue'

const Stub = defineComponent({ template: '<div />' })
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

async function mountShell(current = 'general') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/settings/:tab', component: Stub },
    ],
  })
  await router.push('/settings/' + current)
  await router.isReady()
  const w = mount(SettingsShell, {
    props: { current },
    global: { plugins: [router, i18n] },
    slots: { default: '<p class="probe">body</p>' },
  })
  return { w, router }
}

describe('SettingsShell', () => {
  beforeEach(() => localStorage.clear())

  it('渲染标题与 slot 内容', async () => {
    const { w } = await mountShell()
    expect(w.find('.set-title').text()).toBe('设置')
    expect(w.find('.probe').text()).toBe('body')
  })

  it('非 admin(无 user)rail 只有 6 项', async () => {
    const { w } = await mountShell()
    expect(w.findAll('.set-rail-item')).toHaveLength(6)
  })

  it('admin rail 有 7 项且含 folder-permissions', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const { w } = await mountShell()
    const items = w.findAll('.set-rail-item')
    expect(items).toHaveLength(7)
    expect(items.map((i) => i.attributes('data-tab'))).toContain('folder-permissions')
  })

  it('当前 tab 的 rail 项带 active', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const { w } = await mountShell('network')
    const active = w.findAll('.set-rail-item').filter((i) => i.classes().includes('active'))
    expect(active).toHaveLength(1)
    expect(active[0].attributes('data-tab')).toBe('network')
  })

  it('点 rail 项 emit select', async () => {
    const { w } = await mountShell()
    await w.findAll('.set-rail-item')[2].trigger('click')
    expect(w.emitted('select')).toEqual([['network']])
  })

  it('account 不在 rail 上,入口是顶部用户块(对位 Vue2 L13-20)', async () => {
    const { w } = await mountShell()
    expect(w.findAll('.set-rail-item').map((i) => i.attributes('data-tab'))).not.toContain('account')
    await w.find('.set-user').trigger('click')
    expect(w.emitted('select')).toEqual([['account']])
  })

  it('developer 不在 rail 上(入口在 general 页内)', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }))
    const { w } = await mountShell()
    expect(w.findAll('.set-rail-item').map((i) => i.attributes('data-tab'))).not.toContain('developer')
  })

  it('用户块显示 nickname,缺失时退 username,再缺退 admin(Vue2 L18 同款回落链)', async () => {
    localStorage.setItem('user', JSON.stringify({ nickname: '小明', username: 'nimo' }))
    let { w } = await mountShell()
    expect(w.find('.set-user-name').text()).toBe('小明')

    localStorage.setItem('user', JSON.stringify({ username: 'nimo' }))
    ;({ w } = await mountShell())
    expect(w.find('.set-user-name').text()).toBe('nimo')

    localStorage.removeItem('user')
    ;({ w } = await mountShell())
    expect(w.find('.set-user-name').text()).toBe('admin')
  })

  it('user 存了坏 JSON 不炸,按无用户处理', async () => {
    localStorage.setItem('user', '{not json')
    const { w } = await mountShell()
    expect(w.find('.set-user-name').text()).toBe('admin')
    expect(w.findAll('.set-rail-item')).toHaveLength(6)
  })

  it('回主页按钮 push /', async () => {
    const { w, router } = await mountShell()
    await w.find('.set-home').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/components/SettingsShell.test.ts`
Expected: FAIL —— 找不到 `./SettingsShell.vue`

- [ ] **Step 3: 实现 SettingsShell.vue**

```vue
<script setup lang="ts">
// 设置区外壳:左 tab rail + 右内容。对位 Vue2 SettingsPanel.vue 的 .settings-sidebar / .settings-content,
// 但容器形态由模态改为路由页(授权偏离 #2,spec §12)。
// 侧栏底部的关机/重启按钮不在 P0 范围 —— 电源流(含 6 个状态浮层)整体归 P1(spec §5.1),
// 此处只留 .set-rail-foot 容器占位,P1 往里填。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { railTabsFor, TAB_LABEL_KEY, type SettingsTab } from '../util/tabs'
import '../styles/settings.css'

defineProps<{ current: SettingsTab }>()
const emit = defineEmits<{ select: [tab: SettingsTab] }>()

const router = useRouter()
const { t } = useI18n()

// 用户信息由登录时写进 localStorage['user'](stores/session.ts setUser)。
// P0 零后端调用,所以只读本地缓存,不发 /v1/users/current。
const user = computed<Record<string, unknown>>(() => {
  try {
    const raw = localStorage.getItem('user')
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {} // 坏 JSON:按无用户处理,不炸整个设置区
  }
})

// Vue2 L18: nickname || username || 'admin'
const userName = computed(() => {
  const nick = user.value.nickname
  const name = user.value.username
  if (typeof nick === 'string' && nick) return nick
  if (typeof name === 'string' && name) return name
  return 'admin'
})
const initial = computed(() => userName.value.slice(0, 1).toUpperCase())
const railTabs = computed(() =>
  railTabsFor(typeof user.value.role === 'string' ? user.value.role : undefined),
)
</script>

<template>
  <div class="settings-shell">
    <aside class="set-rail">
      <button class="set-user" type="button" @click="emit('select', 'account')">
        <span class="set-user-avatar" aria-hidden="true">{{ initial }}</span>
        <span class="set-user-name">{{ userName }}</span>
      </button>

      <nav class="set-rail-list">
        <button
          v-for="tab in railTabs"
          :key="tab"
          class="set-rail-item"
          :class="{ active: tab === current }"
          :data-tab="tab"
          type="button"
          @click="emit('select', tab)"
        >
          {{ t(TAB_LABEL_KEY[tab]) }}
        </button>
      </nav>

      <!-- P1 填:关机 / 重启(spec §5.1) -->
      <div class="set-rail-foot"></div>
    </aside>

    <div class="set-main">
      <header class="set-bar">
        <button class="set-home" type="button" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
        <h1 class="set-title">{{ t('settingsTitle') }}</h1>
      </header>
      <main class="set-body"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
/*
 * 布局约束(与 storage/components/StorageShell.vue 同源,SP6 实盘验收过):
 * body 全局 overflow:hidden(src/styles/theme.css:302,桌面端需要,不能改),
 * 所以滚动必须由「受视口约束」的 .set-body 自己承担 —— 外壳必须用 height 而非 min-height,
 * 否则它随内容一起长高、永远量不出溢出,滚动条永不出现。
 * 两行 height 是给不支持 dvh 的旧浏览器兜底,不要合并/删除其中一行。
 */
.settings-shell {
  height: 100vh;
  height: 100dvh;
  display: flex;
  background: var(--bg);
  color: var(--fg);
}

.set-rail {
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 12px;
  background: var(--set-rail-bg);
  border-right: 1px solid var(--set-rail-border);
  overflow-y: auto;
}
.set-user {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  margin-bottom: 18px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--fg);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.set-user:hover {
  background: var(--hover);
}
.set-user-avatar {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 15px;
  font-weight: 600;
}
.set-user-name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.set-rail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.set-rail-item {
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--fg-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.set-rail-item:hover {
  background: var(--hover);
  color: var(--fg);
}
/* Vue2 .sidebar-item.active:透明底 + 主色描边 + 主色字(SettingsPanel.vue L2418-2424) */
.set-rail-item.active {
  background: transparent;
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 500;
}
.set-rail-foot {
  margin-top: auto;
}

.set-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.set-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  flex: 0 0 auto;
}
.set-home {
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.set-home:hover {
  background: var(--chip-bg-hi);
}
.set-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
/* min-height:0 必须写:flex 子项默认 min-height:auto,会阻止收缩到小于内容高度,
 * 导致 overflow-y:auto 失效。 */
.set-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 22px 28px;
}
.set-body > :deep(*) {
  max-width: 980px;
}

/* 窄屏:Vue2 是固定尺寸模态、整文件零 @media,没有可对齐的行为;
 * 按 StorageShell(SP6 已实盘验收)的思路自定 —— rail 收到顶部横向滚动条。
 * 覆盖在授权偏离 #2(模态→路由页)范围内。 */
@media (max-width: 768px) {
  .settings-shell {
    flex-direction: column;
  }
  .set-rail {
    flex: 0 0 auto;
    padding: 10px 12px;
    border-right: 0;
    border-bottom: 1px solid var(--set-rail-border);
  }
  .set-user {
    margin-bottom: 10px;
  }
  .set-rail-list {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
  }
  .set-rail-item {
    white-space: nowrap;
  }
  .set-bar {
    padding: 10px 14px;
  }
  .set-body {
    padding: 4px 14px 20px;
  }
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/components/SettingsShell.test.ts`
Expected: PASS(11 例)

- [ ] **Step 5: 提交**

```bash
git add src/settings/components/SettingsShell.vue src/settings/components/SettingsShell.test.ts
git commit src/settings/components/SettingsShell.vue src/settings/components/SettingsShell.test.ts \
  -m "feat(sp9-p0): 设置区外壳(rail + 用户块 + 回主页 + 窄屏)

rail 7 项、非 admin 隐藏 folder-permissions,account 走顶部用户块 —— 全部对位
Vue2 SettingsPanel.vue。用户信息只读 localStorage['user'],P0 零后端调用;
坏 JSON 按无用户处理不炸。高度用 height 而非 min-height(同 StorageShell,
body 全局 overflow:hidden 下滚动才生效)。侧栏电源位留空容器,归 P1。"
```

---

## Task 5: 路由两条 + SettingsPage 装配

**Files:**
- Create: `src/settings/views/SettingsPage.vue`
- Create: `src/settings/views/SettingsPage.test.ts`
- Create: `src/settings/settingsRoutes.test.ts`
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: Task 2 的 `isSettingsTab` / `DEFAULT_TAB` / `readLastTab` / `writeLastTab`;Task 3 的 `PANEL_BY_TAB`;Task 4 的 `SettingsShell`
- Produces: 路由 `/settings`(重定向)与 `/settings/:tab`(name `settings`)

- [ ] **Step 1: 写 SettingsPage 的失败测试**

`src/settings/views/SettingsPage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import SettingsPage from './SettingsPage.vue'
import { LAST_TAB_KEY } from '../util/lastTab'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

async function mountPage(tab: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/settings/:tab', component: SettingsPage },
    ],
  })
  await router.push('/settings/' + tab)
  await router.isReady()
  const w = mount(SettingsPage, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { w, router }
}

describe('SettingsPage', () => {
  beforeEach(() => localStorage.clear())

  it('按 :tab 渲染对应骨架', async () => {
    const { w } = await mountPage('network')
    expect(w.find('.set-section-title').text()).toBe('网络')
  })

  it('切 tab 时内容跟着换', async () => {
    const { w, router } = await mountPage('network')
    await router.push('/settings/apps')
    await flushPromises()
    expect(w.find('.set-section-title').text()).toBe('应用')
  })

  it('进入时把当前 tab 写进记忆', async () => {
    await mountPage('apps')
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('apps')
  })

  it('切 tab 后记忆跟着更新', async () => {
    const { router } = await mountPage('apps')
    await router.push('/settings/terminal')
    await flushPromises()
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('terminal')
  })

  it('点 rail 项跳到对应路由', async () => {
    const { w, router } = await mountPage('general')
    const item = w.findAll('.set-rail-item').find((i) => i.attributes('data-tab') === 'apps')!
    await item.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/apps')
  })

  it('general 页内的 developer 入口跳到 /settings/developer', async () => {
    const { w, router } = await mountPage('general')
    await w.find('.set-dev-entry').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/developer')
  })

  it('developer 的返回按钮跳回 /settings/general', async () => {
    const { w, router } = await mountPage('developer')
    await w.find('.set-back').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/general')
  })

  it('用户块跳到 /settings/account', async () => {
    const { w, router } = await mountPage('general')
    await w.find('.set-user').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/account')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/views/SettingsPage.test.ts`
Expected: FAIL —— 找不到 `./SettingsPage.vue`

- [ ] **Step 3: 实现 SettingsPage.vue**

```vue
<script setup lang="ts">
// 设置区路由组件:按 :tab 挑一个骨架塞进外壳,并维护「上次 tab」记忆。
// 未知 :tab 的回落由路由 beforeEnter 负责(见 src/router/index.ts),
// 此处仍做一次兜底 —— 组件也可能被直接挂载(测试/将来的复用)。
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsShell from '../components/SettingsShell.vue'
import { PANEL_BY_TAB } from '../panels'
import { DEFAULT_TAB, isSettingsTab, type SettingsTab } from '../util/tabs'
import { writeLastTab } from '../util/lastTab'

const route = useRoute()
const router = useRouter()

const tab = computed<SettingsTab>(() =>
  isSettingsTab(route.params.tab) ? route.params.tab : DEFAULT_TAB,
)
const panel = computed(() => PANEL_BY_TAB[tab.value])

watch(tab, (t) => writeLastTab(t), { immediate: true })

function go(next: string) {
  if (!isSettingsTab(next) || next === tab.value) return
  router.push(`/settings/${next}`)
}
</script>

<template>
  <SettingsShell :current="tab" @select="go">
    <!-- key 让切 tab 时重建骨架而不是复用同一实例(各 panel 后续会各自持有请求状态);
         v-if 语义由 component 的 key 变化承担,不用 v-show —— sp8 P2a 记过 v-show 的窄屏回归坑。 -->
    <component :is="panel" :key="tab" @open-tab="go" />
  </SettingsShell>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/views/SettingsPage.test.ts`
Expected: PASS(8 例)

- [ ] **Step 5: 写路由的失败测试**

`src/settings/settingsRoutes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { settingsRoutes } from './settingsRoutes'
import { LAST_TAB_KEY } from './util/lastTab'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }, ...settingsRoutes],
  })
}

describe('设置区路由', () => {
  beforeEach(() => localStorage.clear())

  it('/settings 无记忆时重定向到 general', async () => {
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('/settings 有记忆时重定向到上次 tab', async () => {
    localStorage.setItem(LAST_TAB_KEY, 'network')
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/network')
  })

  it('/settings 记忆是非法值时重定向到 general', async () => {
    localStorage.setItem(LAST_TAB_KEY, 'bogus')
    const r = makeRouter()
    await r.push('/settings')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('未知 :tab 重定向到 general(不是 404)', async () => {
    const r = makeRouter()
    await r.push('/settings/nope')
    expect(r.currentRoute.value.path).toBe('/settings/general')
  })

  it('9 个合法 tab 都能直接进(刷新保持)', async () => {
    for (const t of [
      'general', 'storage', 'network', 'apps', 'terminal',
      'system-status', 'folder-permissions', 'account', 'developer',
    ]) {
      const r = makeRouter()
      await r.push('/settings/' + t)
      expect(r.currentRoute.value.path, t).toBe('/settings/' + t)
    }
  })

  it('路由有 name settings', async () => {
    const r = makeRouter()
    await r.push('/settings/apps')
    expect(r.currentRoute.value.name).toBe('settings')
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/settingsRoutes.test.ts`
Expected: FAIL —— 找不到 `./settingsRoutes`

- [ ] **Step 7: 实现 settingsRoutes.ts**

`src/settings/settingsRoutes.ts` —— 路由表单独成文件,`src/router/index.ts` 只加一行展开。
这样 SP9 对 `router/index.ts` 的改动固定为「加一个 import + 展开一次」,与 sp7/sp8 的合并冲突面最小(spec §9.3 第 3 条)。

```ts
import type { RouteRecordRaw } from 'vue-router'
import SettingsPage from './views/SettingsPage.vue'
import { DEFAULT_TAB, isSettingsTab } from './util/tabs'
import { readLastTab } from './util/lastTab'

export const settingsRoutes: RouteRecordRaw[] = [
  // 记忆由路由承载(Vue2 是组件内 data + watch);readLastTab 已对非法存值回落 general。
  { path: '/settings', redirect: () => `/settings/${readLastTab()}` },
  {
    path: '/settings/:tab',
    name: 'settings',
    component: SettingsPage,
    // 未知 tab 回落 general,不是 404(spec §4.1)。
    beforeEnter: (to) => (isSettingsTab(to.params.tab) ? true : `/settings/${DEFAULT_TAB}`),
  },
]
```

- [ ] **Step 8: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/settingsRoutes.test.ts`
Expected: PASS(6 例)

- [ ] **Step 9: 接进主路由表**

`src/router/index.ts`:在 `import { authGuard } from './guard'` 上一行加

```ts
import { settingsRoutes } from '../settings/settingsRoutes'
```

在 `routes` 数组里,`{ path: '/storage/raid/:id', … },` 之后、`{ path: '/files/:path(.*)*', … },` 之前插入一行:

```ts
  ...settingsRoutes,
```

(必须在 `/files/:path(.*)*` 这条通配之前 —— 它虽然只匹配 `/files/` 开头,但保持"具体路由在通配之前"的既有排布。)

- [ ] **Step 10: 跑全量确认接线没打断别人**

Run: `pnpm test 2>&1 | tail -8`
Expected: `0 failed`,总数 ≥ 1853 + 本期新增

Run: `pnpm exec vue-tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK`

- [ ] **Step 11: 提交**

```bash
git add src/settings/views/SettingsPage.vue src/settings/views/SettingsPage.test.ts \
        src/settings/settingsRoutes.ts src/settings/settingsRoutes.test.ts
git commit src/settings/views/SettingsPage.vue src/settings/views/SettingsPage.test.ts \
           src/settings/settingsRoutes.ts src/settings/settingsRoutes.test.ts src/router/index.ts \
  -m "feat(sp9-p0): /settings 与 /settings/:tab 路由接线

/settings 重定向到上次 tab(键名沿用 Vue2 nimoos_settings_last_tab),
未知 tab 回落 general 而非 404。路由表单独成 settingsRoutes.ts,
router/index.ts 只加一个 import + 一次展开,把与 sp7/sp8 的合并冲突面压到最小。"
```

---

## Task 6: 装 @novnc/novnc + 全期收口

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `.superpowers/sdd/sp9/01-p0.md`(台账,gitignore 不进 git)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP9(重要结论回写)

**Interfaces:**
- Consumes: Task 1-5 全部
- Produces: `@novnc/novnc` 可供 P5 `import RFB from '@novnc/novnc/lib/rfb'`

- [ ] **Step 1: 装依赖前先看清工作树状态**

Run: `git status --short && git log --oneline -1`
Expected: 工作干净(只有可能的 `.superpowers/` 未跟踪,它已 gitignore)

- [ ] **Step 2: 装 @novnc/novnc**

Run: `pnpm add @novnc/novnc`
Expected: `package.json` 的 `dependencies` 多出 `@novnc/novnc`,`pnpm-lock.yaml` 更新

- [ ] **Step 3: 确认没有连带改动**

Run: `git status --short`
Expected: 只有 `package.json` 与 `pnpm-lock.yaml` 两个 M

若还有别的文件被改,**停下报告**,不要提交。

- [ ] **Step 4: 立刻提交(缩短窗口)**

```bash
git commit package.json pnpm-lock.yaml \
  -m "chore(sp9-p0): 装 @novnc/novnc(P5 KVM 控制台用)

spec §4.4:本期依赖只装这一次。"
```

- [ ] **Step 5: 跑最终任务门**

Run: `pnpm test 2>&1 | tail -8`
Expected: `Test Files … passed`,`0 failed`,Tests 总数 ≥ 1853 + 本期新增(约 +45)

Run: `pnpm exec vue-tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK`

Run: `pnpm build 2>&1 | tail -5`
Expected: 构建成功(证明新路由/新 CSS 不破坏生产构建)

- [ ] **Step 6: 起 dev server 自查**

Run: `pnpm dev --port 5299`(后台)

自查清单(浏览器 `http://localhost:5299/app/#/settings`):

1. `/settings` 自动跳到某个 tab,地址栏变成 `/settings/general`
2. 左侧 rail 6 或 7 项(取决于登录账号是否 admin),点击切换、地址栏跟着变
3. 刷新页面停在当前 tab
4. 手输 `#/settings/nope` → 跳回 `#/settings/general`
5. 点顶部用户块 → `#/settings/account`
6. general 页底部「开发者模式」行 → `#/settings/developer`,该页头部是「‹ 开发者模式」,点它回 general
7. 「回主页」按钮回桌面
8. 浏览器缩到 <768px:rail 变成顶部横向条,内容不塌、能滚
9. 切换亮/暗主题:rail 底色与分隔线两套都正常(验证 `theme.sp9.css` 两块都生效)
10. terminal 页无标题(1:1 Vue2),其余页有标题

- [ ] **Step 7: 写台账**

`.superpowers/sdd/sp9/01-p0.md` 记:最终测试数、tsc 结果、自查 10 条的实际结果、发现的新问题、与 spec 的偏离(已知三处 + 新增)。

- [ ] **Step 8: 回写 roadmap(SP7 台账丢失的教训,spec §10 末条)**

在 `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` 的 §4 SP9 节追加一小段,记录:

- SP9 改为在 `.sp9/{NimoOS-New-UI,NimoOS-Service}` 独立工作树、分支 `sp9-final-views`(用户 2026-07-31 拍板,推翻 spec §9.5 的原安排),spec §9 的并发对策相应降级
- P0 完成,基线 261 文件 / 1853 测试
- 与 spec 的三处出入(rail 7 项非 9 项 / `.scss`→`.css` / 窄屏无对齐对象)

改前先 `cd /home/nimo/NimoTech/NimoOS-UI && git log --oneline -1`(sp7 会话也在写这个仓的文档),改动尽量小,改完立刻用显式 pathspec 提交。

---

## Self-Review

**1. spec §4 覆盖检查**

| spec §4 要求 | 落在 |
|---|---|
| 代码落 `src/settings/` | Task 3/4/5 全部文件 |
| 样式不复用 sp8 的 `settings-styles.scss` | Task 3 新建 `src/settings/styles/settings.css`(改 `.css`,见出入 2) |
| 路由页 `/settings` + `/settings/:tab` | Task 5 |
| tab 记忆沿用 `nimoos_settings_last_tab` 键名、由路由承载 | Task 2 `lastTab.ts` + Task 5 `settingsRoutes.ts` redirect |
| 未知 `:tab` → 重定向 general | Task 5 `beforeEnter` |
| 9 个 tab | Task 2 `SETTINGS_TABS` + Task 3 九个 panel(rail 7 项,见出入 1) |
| `developer` 沿用 Vue2 显隐条件 | Task 3 `GeneralPanel` 入口行(Vue2 无门控,见出入 1) |
| 每 tab 一个空骨架,不接接口 | Task 3 |
| 「回主页」按钮 | Task 4 `.set-home` |
| 窄屏 + `v-if`(不用 `v-show`) | Task 4 `@media`;Task 5 用 `<component :is>` + `key`,不存在 `v-show` |
| i18n 分片 + `index.ts` 合并 + parity 改断言合并后 | Task 1 |
| theme 分片 + `main.ts` 追加 import | Task 1 |
| 装 `@novnc/novnc`,只装一次,装完立刻 pathspec 提交 | Task 6 |
| 跑全量测试与 tsc 记基线 | 已在开工前完成(台账 `00-baseline.md`) |

spec §4 无遗漏。P0 DoD 的每一条都有对应任务与验证步骤。

**2. 占位符扫描** —— 无 TBD / "类似 Task N" / 无代码的代码步骤。七个"普通"骨架在 Task 3 Step 8 用"照 StoragePanel 换 key"描述而没有逐个贴全文,但同时给出了模板全文与逐个的确切替换值,不构成占位。

**3. 类型一致性** —— `SettingsTab` 贯穿 tabs.ts / lastTab.ts / PANEL_BY_TAB / SettingsShell props / SettingsPage;`open-tab` 事件名在 GeneralPanel / DeveloperPanel emit、SettingsPage 监听处一致;`select` 事件在 SettingsShell emit、SettingsPage 监听处一致;`back` 事件只在 SettingsSection↔DeveloperPanel 之间,不外泄。

**4. 已知缺口(有意,非遗漏)** —— 侧栏底部关机/重启按钮 P0 不做,归 P1(spec §5.1 owns 电源流含 6 个状态浮层);P0 只留 `.set-rail-foot` 空容器。桌面磁贴/旧 UI 入口翻到 `/settings` 归 P8 cutover(spec §8),P0 只让路由可达。

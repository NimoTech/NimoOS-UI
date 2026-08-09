# SP16 KVM / 设置区零散小缺陷清理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清掉 KVM 区与设置区 12 条互不依赖的可见缺陷与守卫缺口，每条自带回归测试、独立成一个提交。

**Architecture:** 无新架构。13 个任务对应 spec 的 12 条缺陷（spec 的 T7 含两半，拆成两个任务）。任务之间零依赖，可任意顺序执行、任意子集合并。改动集中在 `src/kvm/**`、`src/settings/**`、`src/styles/**`，外加 `src/components/AppToast.vue` 一处 CSS 变量化和 `src/home/components/SearchDialog.vue` 一处事件时序修复。

**Tech Stack:** Vue 3 + TypeScript + vitest + jsdom + `@vue/test-utils`；pnpm@9。

## Global Constraints

- **提交信息一律英文**（`CLAUDE.md` 硬要求）。代码注释一律英文；本仓既有中文注释在你正好编辑那段时顺手翻译，不做单独 sweep。
- **界面严格 1:1，逻辑照正确**：不照抄 Vue2 的 bug，改正确逻辑并就地注释登记（`vue2-port-visual-only-fix-logic`）。
- **禁无关重构。** 尤其禁止把 `cssCascade.ts` 挪位置或改签名 —— 它有 31 个引用方，且 `sp15-photos-moments` 那条线正在同一目录作业。
- **不部署、不推 origin。** 验收清单成文交机主统一验。
- **jsdom 测不到 CSS 级联与布局**：凡涉及 hover / 渐隐 / 定位的断言，一律断在**源文本或自算级联**上，不要用 `getComputedStyle`（`newui-css-invisible-failure-guards`）。
- **测试证据一律 `--reporter=verbose` 并数条数**（`vitest-reporter-hides-warnings`：默认 reporter 不打印通过用例的 stderr，`[Vue warn]` 会隐形）。
- **守卫类任务必须做变异验证**：每次变异都**从干净基线重做**，并断言 `replace` 真的改到了文件 —— 曾出现过第 3 次变异静默不命中、看到的红其实是上一次的（`05-设置与KVM与搜索-SP9.md` A11 记的过程坑）。
- 基线：`pnpm vitest run` = **672 文件 / 10669 例 / 0 失败**（本 worktree 实测）。

---

## File Structure

| 文件 | 责任 | 涉及任务 |
|---|---|---|
| `src/settings/styles/settings.css` | 设置区共享样式 | 1 |
| `src/settings/panels/general/UsbAutoMountRow.vue` | USB 自动挂载行 | 2 |
| `src/settings/components/SettingsShell.vue` | 设置区外壳（侧栏 rail + 窄屏分支） | 3 |
| `src/components/AppToast.vue` | 全局 toast 容器 | 4 |
| `src/kvm/styles/kvm.css` | KVM 区样式（toast 位置覆写落点） | 4 |
| `src/kvm/components/IsoBrowser.vue` | 本地 ISO 浏览（含折叠开关） | 5, 6 |
| `src/kvm/views/KvmPage.vue` | KVM 页（OsSelector / eject / VNC 接线） | 6, 7, 8 |
| `src/kvm/composables/useVmList.ts` | VM 数据层与电源动作 | 7, 8 |
| `src/kvm/views/KvmPage.test.ts` | KVM 页测试 | 10 |
| `src/kvm/styles/kvmStyles.test.ts` | KVM 样式守卫 | 9 |
| `src/i18n/i18nKeys.test.ts` | **新建** i18n 键存在性守卫 | 11 |
| `src/styles/color-guard.test.ts` | 全仓 CSS 守卫 | 12 |
| `src/home/components/SearchDialog.vue` | 搜索面板 | 13 |

---

### Task 1: 禁用行悬停不该变强调色

对应 spec **T9**。`.set-list-item.clickable:hover` 缺 `:not(:disabled)` ⇒ 禁用行悬停仍变色，用户误以为可点。

**Files:**
- Modify: `src/settings/styles/settings.css:83-85`
- Test: `src/settings/panels/panels.test.ts`（沿用该文件既有的 `readCss()` / `node:fs` 读法；本仓约定**测试里读 `.css` 一律 `node:fs`**，`?raw` 对 `.css` 在 vitest 下恒为空串）

**Interfaces:**
- Consumes: 无
- Produces: 无（纯 CSS）

- [ ] **Step 1: 写失败的测试**

加到 `src/settings/panels/panels.test.ts` 末尾（若该文件没有读 css 的辅助，就用 `node:fs` + `path` 直接读，照 `color-guard.test.ts:42-47` 的 `listCss` 写法）：

```ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

describe('禁用的设置行悬停不变强调色', () => {
  it('.set-list-item.clickable:hover 带 :not(:disabled) 限定', () => {
    const css = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles/settings.css'),
      'utf8',
    )
    // 断在源文本上：jsdom 不做级联,也进不了 hover 态,getComputedStyle 读不出结果。
    const hoverRules = css.match(/\.set-list-item\.clickable[^{]*:hover[^{]*\{/g) ?? []
    expect(hoverRules.length).toBeGreaterThan(0) // 防空转:规则改名了就该红,而不是静默通过
    for (const r of hoverRules) expect(r).toContain(':not(:disabled)')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/settings/panels/panels.test.ts --reporter=verbose`
Expected: FAIL — 期望包含 `:not(:disabled)` 但实际是 `.set-list-item.clickable:hover {`

- [ ] **Step 3: 改 CSS**

`src/settings/styles/settings.css:83`：

```css
.set-list-item.clickable:not(:disabled):hover {
  color: var(--accent-text);
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/settings/panels/panels.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/settings/styles/settings.css src/settings/panels/panels.test.ts
git commit -m "fix(settings): stop disabled rows from lighting up on hover

A disabled row still turned accent-coloured under the pointer, which reads
as clickable when it is not. The guard asserts on the stylesheet text
because jsdom neither cascades nor enters a hover state."
```

---

### Task 2: `UsbAutoMountRow` 的 getter 会绕过 `allSettled`

对应 spec **T10**。`service.sys` 是 **getter**：`initService()` 未调用时它**同步**抛错，而抛错发生在数组字面量求值阶段 —— `Promise.allSettled` 收不到这个异常，直接变成 unhandled rejection 炸穿测试文件。生产不触发（`main.ts` 保证先 `initService`），但任何"先挂载 Settings 组件再 initService"的新入口都会复现。

**Files:**
- Modify: `src/settings/panels/general/UsbAutoMountRow.vue:28-36`
- Test: `src/settings/panels/general/UsbAutoMountRow.test.ts`（不存在则新建）

**Interfaces:**
- Consumes: `service.sys.getUsbStatus(): Promise<boolean>`、`service.sys.hardwareInfo(): Promise<{ drive_model?: unknown }>`
- Produces: 无

- [ ] **Step 1: 写失败的测试**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import UsbAutoMountRow from '../UsbAutoMountRow.vue'

// 模拟"尚未 initService"：service.sys 这个 getter 同步抛错。
vi.mock('@nimotech/nimoos-service', async (orig) => {
  const real = (await orig()) as Record<string, unknown>
  return {
    ...real,
    get service() {
      return {
        get sys(): never {
          throw new Error('service not initialised')
        },
      }
    },
  }
})

describe('UsbAutoMountRow 在 initService 之前挂载', () => {
  it('不产生 unhandled rejection,组件正常渲染', async () => {
    const spy = vi.fn()
    process.on('unhandledRejection', spy)
    const w = mount(UsbAutoMountRow)
    await new Promise((r) => setTimeout(r, 0))
    process.off('unhandledRejection', spy)
    expect(spy).not.toHaveBeenCalled()
    expect(w.exists()).toBe(true)
  })
})
```

> 若该组件的 service mock 在本仓有既有惯例（`src/settings/**/*.test.ts` 里搜 `vi.mock` 看邻居怎么写的），沿用邻居写法，只保留"getter 同步抛错"这个核心。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/settings/panels/general/UsbAutoMountRow.test.ts --reporter=verbose`
Expected: FAIL — unhandled rejection 被捕获到，或挂载过程直接抛错

- [ ] **Step 3: 把 getter 求值挪进 thunk 内部**

`src/settings/panels/general/UsbAutoMountRow.vue:28`：

```ts
onMounted(async () => {
  // `service.sys` is a getter that throws synchronously before initService() runs.
  // Evaluating it inside the array literal happens outside allSettled's protection,
  // so the throw escapes as an unhandled rejection. Wrapping each call in an async
  // thunk moves the getter access inside the promise, where allSettled can catch it.
  await Promise.allSettled([
    (async () => { const v = await service.sys.getUsbStatus(); if (!touched) on.value = v })(),
    (async () => {
      const hw = await service.sys.hardwareInfo()
      const model = typeof hw.drive_model === 'string' ? hw.drive_model : ''
      isRpi.value = model.toLowerCase().includes('raspberry')
    })(),
  ])
})
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/settings/panels/general/ --reporter=verbose`
Expected: PASS，且既有 general 面板用例全绿

- [ ] **Step 5: 提交**

```bash
git add src/settings/panels/general/UsbAutoMountRow.vue src/settings/panels/general/UsbAutoMountRow.test.ts
git commit -m "fix(settings): keep the usb row's getter access inside allSettled

service.sys is a getter that throws synchronously until initService() has
run. Reading it in the array literal put that throw outside allSettled,
where it surfaced as an unhandled rejection and took the whole test file
down. Production never hits it because main.ts initialises first, but any
entry point that mounts a settings component earlier would."
```

---

### Task 3: 窄屏设置侧栏没有可滚动提示

对应 spec **T8**。420px 下 `.set-rail-list` 是 `flex-direction: row` + `overflow-x: auto`，**7 个** tab 排一行被硬切（`RAIL_TABS = SETTINGS_TABS.slice(0, 7)`，`src/settings/util/tabs.ts:24`；非 admin 再减掉 `folder-permissions` = 6 个）。能滑，但没有任何提示，第一眼像坏了。

**Files:**
- Modify: `src/settings/components/SettingsShell.vue`（窄屏分支 `:238-242`）
- Test: `src/settings/components/SettingsShell.test.ts`（不存在则新建）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 写失败的测试**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('窄屏设置侧栏有可滚动提示', () => {
  it('.set-rail-list 的窄屏分支带边缘渐隐遮罩', () => {
    const src = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './SettingsShell.vue'),
      'utf8',
    )
    // 只看窄屏媒体查询那一段：宽屏是纵向排列,不需要提示。
    const narrow = src.slice(src.indexOf('@media'))
    const rail = narrow.slice(narrow.indexOf('.set-rail-list'))
    expect(rail).toContain('overflow-x: auto')   // 防空转:布局改了就该红
    expect(rail).toMatch(/mask-image|--set-rail-fade/)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/settings/components/SettingsShell.test.ts --reporter=verbose`
Expected: FAIL — 窄屏 `.set-rail-list` 里没有 `mask-image`

- [ ] **Step 3: 加边缘渐隐**

`src/settings/components/SettingsShell.vue` 窄屏分支的 `.set-rail-list`：

```css
  .set-rail-list {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
    /* The seven tabs are cut off mid-word at 420px. They do scroll, but with no
       affordance it reads as broken rather than scrollable. A right-edge fade
       shows there is more; it is decorative only, so it needs no token. */
    mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
  }
```

> ⚠️ `mask-image` 的 `#000` 是遮罩通道值、不是可见颜色，color-guard 的裸色扫描可能拦它。若被拦，按守卫自己的规矩加 `/* theme-exception: 遮罩通道值,与皮肤无关 */`（**不要放宽词表**）。

- [ ] **Step 4: 跑测试确认它绿，并确认 color-guard 没被激怒**

Run: `pnpm vitest run src/settings/components/SettingsShell.test.ts src/styles/color-guard.test.ts --reporter=verbose`
Expected: 两个文件都 PASS

- [ ] **Step 5: 提交**

```bash
git add src/settings/components/SettingsShell.vue src/settings/components/SettingsShell.test.ts
git commit -m "fix(settings): show that the narrow-screen tab rail scrolls

At 420px the seven tabs are sliced mid-character with no hint that the row
scrolls, so the first read is that the layout is broken. A right-edge fade
restores the affordance without changing the tab set or order."
```

---

### Task 4: KVM 页的 toast 挡住客户机画面

对应 spec **T3**。`AppToast.vue:49` 的 `bottom: 118px` 是给 Home 的 dock 让位设计的；KVM 是全屏页、没有 dock，提示条就浮在控制台画面中下方。

**Files:**
- Modify: `src/components/AppToast.vue:49`
- Modify: `src/kvm/styles/kvm.css`
- Test: `src/kvm/styles/kvmStyles.test.ts`

**Interfaces:**
- Produces: CSS 变量 `--toast-bottom`（默认 `118px`），任何全屏页可覆写

- [ ] **Step 1: 写失败的测试**

加到 `src/kvm/styles/kvmStyles.test.ts`（沿用该文件既有的 `node:fs` 读 `kvm.css` 的方式）：

```ts
describe('KVM 全屏页的 toast 不占用控制台画面', () => {
  it('AppToast 的 bottom 走可覆写变量,且 KVM 覆写了它', () => {
    const toast = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../components/AppToast.vue'),
      'utf8',
    )
    expect(toast).toContain('bottom: var(--toast-bottom, 118px)')
    expect(toast).toContain('z-index: 10100') // 别回退掉「弹窗压不住 toast」那次修复
    const kvm = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './kvm.css'),
      'utf8',
    )
    expect(kvm).toMatch(/--toast-bottom:\s*\d+px/)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/kvm/styles/kvmStyles.test.ts --reporter=verbose`
Expected: FAIL — `AppToast.vue` 里是写死的 `bottom: 118px`

- [ ] **Step 3: 变量化 + KVM 覆写**

`src/components/AppToast.vue:49`，只改 `bottom` 一项，其余声明**逐字不动**：

```css
.toast-stack { position: fixed; z-index: 10100; left: 50%; bottom: var(--toast-bottom, 118px); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
```

`src/kvm/styles/kvm.css` 的 `.kvm-page` 块（`:41`，页面根类）里加一行：

```css
.kvm-page {
  /* The default 118px clears the desktop dock. KVM is a full-screen page with
     no dock, so that offset parks the toast over the guest's console output. */
  --toast-bottom: 24px;
  /* …既有声明逐字不动… */
}
```

> ⚠️ CSS 变量靠**继承**生效，而 `.toast-stack` 是 `position: fixed` 的全局 toast 容器 —— 它挂在
> `App.vue` 层，**不是 `.kvm-page` 的后代**，拿不到这个变量。所以正确落点是**根元素**：把覆写写成
> `:root:has(.kvm-page) { --toast-bottom: 24px; }`（`:has()` 在本仓目标浏览器可用），或由 `KvmPage`
> 在 `onMounted` / `onBeforeUnmount` 里增删 `document.documentElement` 上的一个类。
> **实施时先验哪条真的生效**：写完用 Step 1 的测试之外再加一条挂载态断言，或直接在 dev server 上看 —— 
> 「变量写了但继承不到」正是那种三门全绿、真机无效的形态（`newui-css-invisible-failure-guards`）。

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/kvm/ src/components/ --reporter=verbose`
Expected: PASS，且既有 toast 用例全绿（桌面侧默认值未变，行为零变化）

- [ ] **Step 5: 提交**

```bash
git add src/components/AppToast.vue src/kvm/styles/kvm.css src/kvm/styles/kvmStyles.test.ts
git commit -m "fix(kvm): stop toasts from parking over the guest console

The 118px offset exists to clear the desktop dock. KVM is full-screen and
has no dock, so notifications floated in the middle-bottom of the console
and could cover the guest's output. The offset becomes an overridable
variable; the desktop default is unchanged."
```

---

### Task 5: 键盘用户完全打不开「本地 ISO 浏览」

对应 spec **T5**。`IsoBrowser.vue:78-85` 的 `.custom-divider` 是可点 `<div>`，有 `aria-label` 但**无 `role` / `tabindex` / 键盘处理** —— 而它是**唯一**能展开本地 ISO 浏览的控件。

**Files:**
- Modify: `src/kvm/components/IsoBrowser.vue:78-85`
- Test: `src/kvm/components/IsoBrowser.test.ts`

**Interfaces:**
- Consumes: 组件内既有的 `toggle()` 与 `expanded` ref
- Produces: 无

- [ ] **Step 1: 写失败的测试**

加到 `src/kvm/components/IsoBrowser.test.ts`（沿用该文件顶部既有的 `mk()` 辅助）：

```ts
it('折叠开关可聚焦,Enter 与 Space 都能展开(键盘用户的唯一入口)', async () => {
  const wr = mk()
  const divider = wr.get('.custom-divider')
  expect(divider.attributes('role')).toBe('button')
  expect(divider.attributes('tabindex')).toBe('0')
  expect(divider.attributes('aria-expanded')).toBe('false')

  await divider.trigger('keydown', { key: 'Enter' })
  expect(wr.find('.custom-browse').exists()).toBe(true)
  expect(wr.get('.custom-divider').attributes('aria-expanded')).toBe('true')

  await divider.trigger('keydown', { key: ' ' })
  expect(wr.find('.custom-browse').exists()).toBe(false)
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/kvm/components/IsoBrowser.test.ts --reporter=verbose`
Expected: FAIL — `role` 是 `undefined`

- [ ] **Step 3: 补 role / tabindex / 键盘处理**

`src/kvm/components/IsoBrowser.vue` 模板。**视觉零变化**，不加任何样式：

```vue
    <div
      class="custom-divider"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="t('kvmToggleCustom')"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
```

> `.prevent` 是必须的：Space 在可聚焦元素上会滚动页面。

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/kvm/components/IsoBrowser.test.ts --reporter=verbose`
Expected: PASS，且既有 8 条 `.trigger('click')` 用例全部不受影响

- [ ] **Step 5: 提交**

```bash
git add src/kvm/components/IsoBrowser.vue src/kvm/components/IsoBrowser.test.ts
git commit -m "feat(kvm): make the local ISO browser reachable by keyboard

The collapse toggle was a click-only div, and it is the only control that
opens local ISO browsing — so keyboard-only users had no route in at all.
It gains a button role, focusability, aria-expanded and Enter/Space
handling. Nothing about it looks different."
```

---

### Task 6: 重开 OS 选择器时 ISO 列表陈旧、自定义区折叠回去

对应 spec **T4**，两条未申报的行为差异。Vue2 的 `OSSelector` 每次 `visible: true` 都重拉，且组件常驻故展开态保持。New-UI 里 `watch(osSelectorOpen)`（`KvmPage.vue:105-107`）**只在关闭时清下载报错**，没有任何重拉。

**Files:**
- Modify: `src/kvm/views/KvmPage.vue:105-107`
- Modify: `src/kvm/components/IsoBrowser.vue`（展开态提升为 props/emit，或由父组件保活）
- Test: `src/kvm/views/KvmPage.test.ts`、`src/kvm/components/IsoBrowser.test.ts`

**Interfaces:**
- Consumes: `isoList.fetch(): Promise<void>` —— **注意方法名就叫 `fetch`，不是 `fetchIsos`**（`useIsoList.ts:64`，内部打的是 `service.kvm.getISOList()`，`:67`）
- Produces: 无

- [ ] **Step 1: 写失败的测试**

加到 `src/kvm/views/KvmPage.test.ts`（沿用既有 `mountPage()` / `flush()` / `api` mock）：

```ts
it('每次打开 OS 选择器都重拉 ISO 列表(Vue2 每次 visible:true 都拉)', async () => {
  api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
  const w = mountPage()
  await flush()
  const before = api.getISOList.mock.calls.length

  // 直接驱动页面自己的开关 ref —— 打开 OS 选择器的入口藏在创建弹窗内部,
  // 经它点进去会把「创建流程」也拖进这条用例,断言的东西就不纯粹了。
  const page = w.vm as unknown as { osSelectorOpen: boolean }
  page.osSelectorOpen = true
  await flush()
  page.osSelectorOpen = false
  await flush()
  page.osSelectorOpen = true
  await flush()

  expect(api.getISOList.mock.calls.length).toBeGreaterThan(before + 1)
})
```

> `osSelectorOpen` 是 `<script setup>` 里的顶层 ref，测试要够到它需要它被 `defineExpose` 出来；若没有，改用 `w.getComponent({ name: 'OsSelector' }).props('open')` 驱动不到的话，就退回从创建弹窗的「选择系统」按钮点进去（`grep -n "openOsSelectorFor" src/kvm/components/CreateVmDialog.vue` 找触发点的真实选择器）。**两种路径都可以，但断言那一行不变。**

再加到 `src/kvm/components/IsoBrowser.test.ts`：

```ts
it('父组件保活时,重开不会把自定义区折叠回去', async () => {
  const wr = mk({ expanded: true })
  expect(wr.find('.custom-browse').exists()).toBe(true)
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/kvm/views/KvmPage.test.ts src/kvm/components/IsoBrowser.test.ts --reporter=verbose`
Expected: FAIL — 第二次打开没有新增 `getISOList` 调用

- [ ] **Step 3: 打开时重拉 + 展开态提升**

`src/kvm/views/KvmPage.vue:105`：

```ts
watch(osSelectorOpen, (open) => {
  // Closing: drop a download error that no longer relates to the next session.
  if (!open) { isoDownloadError.value = ''; return }
  // Opening: the old picker refetched every time it became visible. Here the list
  // is a prop owned by the page, so without this the user can reopen the picker
  // and see a list that predates a download that has since finished.
  void isoList.fetch()
})
```

`IsoBrowser.vue` 的展开态目前是组件内部的 `const expanded = ref(false)`（`:36`），弹窗内容一卸载就归零。改成受控：

```ts
const props = defineProps<{ isos: IsoRow[]; expanded?: boolean }>()
const emit = defineEmits<{ select: [os: SelectedOs]; 'update:expanded': [v: boolean] }>()

// The old picker kept this section open across reopens because the component was
// always mounted. Here the dialog's contents are rebuilt each time, so the state
// has to live above it — the page owns it, the browser just reports the toggle.
const expanded = computed(() => props.expanded ?? false)
function toggle(): void {
  emit('update:expanded', !expanded.value)
}
```

`:43` 那句 `if (expanded.value) browser.fetch(browser.path.value)` 保持原有语义 —— 它现在要改成 `watch(expanded, (v) => { if (v) browser.fetch(browser.path.value) })`（原来写在 `toggle()` 里，受控化之后 `toggle` 不再直接改值）。

`OsSelector.vue` 把它透传给父级，`KvmPage.vue` 持有那个 ref：

```ts
const isoBrowserExpanded = ref(false)   // survives the dialog's contents being rebuilt
```

**视觉与交互完全不变。**

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/kvm/ --reporter=verbose`
Expected: PASS，KVM 区全绿

- [ ] **Step 5: 提交**

```bash
git add src/kvm/views/KvmPage.vue src/kvm/components/IsoBrowser.vue src/kvm/views/KvmPage.test.ts src/kvm/components/IsoBrowser.test.ts
git commit -m "fix(kvm): refresh the OS picker on open and keep the custom section expanded

Two behaviour differences from the old picker that were never declared.
It refetched on every open; here the list is a prop owned by the page, so
reopening could show a list that predates a finished download. And its
custom section stayed expanded because the component was always mounted,
while this one collapses every time the dialog's contents are rebuilt."
```

---

### Task 7: 弹出安装介质失败、组件已卸载时弹了假的成功提示

对应 spec **T2**（D39）。`KvmPage.vue:412` 拿 `ejectInstallMedia` 的返回值，`:419` 用 `=== ''` 判成功弹 toast；而 `useVmList.ts:386` 的 **catch** 里 `if (!alive) return ''` ⇒ 请求失败 + 组件已卸载 → 返回 `''` → 调用方弹「已弹出」。toast 容器在 `App.vue` 层，KvmPage 卸载不影响它显示 ⇒ **用户看到假的成功**。

> **实测订正 spec 的范围**：`useVmList.ts` 共 6 处 `if (!alive) return ''`，其中 **try 分支的三处（`:381` eject、`:416` create、`:445` update）语义正确**（请求确实成功了）。真正有问题的是 **catch 分支的三处**：`:386` eject（本任务）、`:420` create、`:464` update。后两处按机主确认的范围**本期不改**，记为交接票 —— 它们的调用方分别是 `CreateVmDialog` / `VmSettingsDialog` 的 `submitError`，症状同形（弹窗卸载后失败被当成功）。
> 电源动作那一族（`runAction`）**已经是对的**：`:224/:229` 返回 `false`，契约就是「失败或 dispose 后短路」，调用方不会弹成功 toast。

**Files:**
- Modify: `src/kvm/views/KvmPage.vue:399-422`
- Test: `src/kvm/views/KvmPage.test.ts`

**Interfaces:**
- Consumes: `s.ejectInstallMedia(vm): Promise<string>`（`''` = 成功或被重入守卫挡掉，非空 = 错误文案）—— **契约不变**
- Produces: 无

- [ ] **Step 1: 写失败的测试**

```ts
it('eject 在途时离开页面,失败不再弹出成功提示', async () => {
  api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running', iso: 'a.iso' })], total: 1 })
  let reject!: (e: unknown) => void
  api.setBootFromDisk.mockReturnValue(new Promise((_, rj) => { reject = rj }))
  const w = mountPage()
  await flush()
  const toast = useToast()

  await w.getComponent({ name: 'InstallBanner' }).vm.$emit('finish')
  w.unmount()                       // 请求在途时整页跳走
  reject(new Error('boom'))         // 之后才失败
  await flush()

  expect(toast.toasts.map((x) => x.text)).not.toContain('已弹出安装介质')
})
```

> 断言里的文案用 `t('kvmEjectSuccess')` 的**真实译文**（实施时 `grep -n "kvmEjectSuccess" src/i18n/zh_cn*.ts` 取字面量），别自己编 —— `newui-fixture-from-imagination-trap` 记过手编 fixture 已经栽过三次。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/kvm/views/KvmPage.test.ts --reporter=verbose`
Expected: FAIL — toast 列表里出现了成功文案

- [ ] **Step 3: 调用方自查存活**

`src/kvm/views/KvmPage.vue`，在 `onEjectFinish` 所在的 `<script setup>` 里加一个页面级存活标志（若该文件已有同类标志，复用它、不要新增第二个）：

```ts
// The page can unmount while a request is in flight. useVmList's own `alive`
// guard already stops it writing shared state, but it reports that case as ''
// — which this caller reads as success. Checking here keeps the composable's
// contract untouched and stops a failed eject from announcing itself as done.
let pageAlive = true
onBeforeUnmount(() => { pageAlive = false })
```

`onEjectFinish` 里 await 之后立即判：

```ts
    const err = await s.ejectInstallMedia(vm)
    if (!pageAlive) return          // 页面没了：既不写 ref,也不弹任何 toast
    ejectError.value = err
    if (err === '') toast.show(t('kvmEjectSuccess'))
```

> `finally` 里的 `ejectBusy.value = false` 保留原样 —— 写一个已卸载组件的 ref 无害，且移走会打乱既有的忙碌态语义。

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/kvm/views/KvmPage.test.ts --reporter=verbose`
Expected: PASS，既有 eject 用例（成功弹 toast、失败显示内联错误）全绿

- [ ] **Step 5: 提交**

```bash
git add src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts
git commit -m "fix(kvm): do not announce a failed eject as successful

useVmList reports 'disposed' and 'succeeded' with the same empty string, so
an eject that failed after the page unmounted was announced as done — the
toast container outlives the page, so the user really saw it. The caller now
checks whether it is still mounted instead, leaving the composable's
contract alone. Two sibling call sites (create, update) have the same shape
and are recorded as follow-up work."
```

---

### Task 8: MessageBus 掉线时点「强制重启」→ 控制台一片黑、零提示

对应 spec **T1**（D37）。`restart()`（`useVmList.ts:270-278`）成功后，若 `restartPending` 里 id 还在（说明 `kvm:vm_started` 事件还没到），就 `disconnectCb?.()` 断开 VNC，**把重连完全交给事件**。MessageBus 掉线 ⇒ 事件永不到达 ⇒ 断了就再没人连回来 ⇒ 黑屏，且界面上没有任何说明。

> 注意 `finally` 里的 `restartPending.delete(vm.id)` 保证了标记不会泄漏 —— 台账写的「标记永远留在集合里」是不准确的；真正的问题是**断开之后没有任何兜底**。

**Files:**
- Modify: `src/kvm/composables/useVmList.ts:250-278`
- Test: `src/kvm/composables/useVmList.test.ts`

**Interfaces:**
- Produces: `useVmList()` 新增导出 `onVncReconnectStalled(cb: () => void): void` —— 注册"重启后迟迟没能重连"的回调，供 `KvmPage` 展示提示
- Consumes: 既有 `disconnectCb` / `connectCb`、`restartPending`

- [ ] **Step 1: 写失败的测试**

加到 `src/kvm/composables/useVmList.test.ts`。该文件顶部已备好全部装配：`api`（服务 mock）、
`emit(ev, props)`（手动触发 MessageBus）、`VM(over)`（VM 工厂）、`beforeEach`（重置 + `getVMList`
默认返回一台 running 的 `vm-1`）。`fetchVMs()` 会自动选中第一台，所以拿到 `selectedVM` 只需 `await s.fetchVMs()`。

```ts
describe('重启后的 VNC 重连兜底', () => {
  it('kvm:vm_started 迟迟不来时通知调用方(而不是无声黑屏)', async () => {
    vi.useFakeTimers()
    const s = useVmList()
    const stalled = vi.fn()
    s.onVncReconnectStalled(stalled)
    await s.fetchVMs()                       // 自动选中 vm-1(该文件既有用例证过)

    await s.restart(s.selectedVM.value!)
    expect(stalled).not.toHaveBeenCalled()   // 刚断开时还不该报

    await vi.advanceTimersByTimeAsync(20_000)
    expect(stalled).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('kvm:vm_started 按时到达就不报', async () => {
    vi.useFakeTimers()
    const s = useVmList()
    const stalled = vi.fn()
    s.onVncReconnectStalled(stalled)
    await s.fetchVMs()

    await s.restart(s.selectedVM.value!)
    emit('kvm:vm_started', { vm_id: 'vm-1' })   // 顶部那个手动 emit 辅助

    await vi.advanceTimersByTimeAsync(20_000)
    expect(stalled).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('dispose 之后计时器不再回调', async () => {
    vi.useFakeTimers()
    const s = useVmList()
    const stalled = vi.fn()
    s.onVncReconnectStalled(stalled)
    await s.fetchVMs()

    await s.restart(s.selectedVM.value!)
    s.dispose()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(stalled).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/kvm/composables/useVmList.test.ts --reporter=verbose`
Expected: FAIL — `s.onVncReconnectStalled is not a function`

- [ ] **Step 3: 断开后加超时兜底**

`useVmList.ts` 顶部（`restartPending` 旁边）：

```ts
// Restart hands reconnection to the kvm:vm_started event on purpose: the VNC
// port is usually not listening yet when the HTTP call returns, so an immediate
// reconnect fails and pins vncError on screen for good. But when the bus is down
// the event never arrives, and the console just stays black with nothing said.
// This timer is the floor under that case: it does not reconnect (that would
// reintroduce the failure it was avoiding), it tells the page to say so.
const RECONNECT_STALL_MS = 20_000
const stallTimers = new Map<string, ReturnType<typeof setTimeout>>()
let stalledCb: (() => void) | undefined
function onVncReconnectStalled(cb: () => void): void { stalledCb = cb }

function clearStallTimer(id: string): void {
  const t = stallTimers.get(id)
  if (t) { clearTimeout(t); stallTimers.delete(id) }
}
```

`restart()` 的 onSuccess 分支，在 `disconnectCb?.()` 之后：

```ts
      return await runAction(vm, (id) => service.kvm.restartVM(id), (v) => {
        setVMState(v.id, 'running')
        if (restartPending.has(v.id) && selectedVM.value?.id === v.id) {
          disconnectCb?.()
          clearStallTimer(v.id)
          stallTimers.set(v.id, setTimeout(() => {
            stallTimers.delete(v.id)
            if (alive && selectedVM.value?.id === v.id) stalledCb?.()
          }, RECONNECT_STALL_MS))
        }
      }, 'kvmFailedToRestart')
```

`kvm:vm_started` 处理器里，紧挨着既有的 `restartPending.delete(id)`：

```ts
      restartPending.delete(id)
      clearStallTimer(id)   // the reconnect landed; no need to warn about it
```

`dispose()` 里清干净：

```ts
  function dispose(): void {
    alive = false
    stallTimers.forEach((t) => clearTimeout(t))
    stallTimers.clear()
    unsubs.forEach((off) => off())
    unsubs.length = 0
  }
```

`return {}` 块里加上 `onVncReconnectStalled`。

`KvmPage.vue`（紧挨 `:325-326` 那两行回调注册）：

```ts
s.onVncReconnectStalled(() => { toast.show(t('kvmConsoleReconnectStalled')) })
```

新 i18n 键加到 KVM 用的那两个分片（`grep -n "kvmToastResumed" src/i18n/*.ts` 定位是哪两份），zh/en 都要有：

- `zh_cn`: `kvmConsoleReconnectStalled: '控制台未能自动恢复,请重新选择该虚拟机'`
- `en_us`: `kvmConsoleReconnectStalled: 'The console did not come back on its own — reselect the VM'`

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/kvm/ --reporter=verbose`
Expected: PASS，KVM 区全绿

- [ ] **Step 5: 提交**

```bash
git add src/kvm/composables/useVmList.ts src/kvm/views/KvmPage.vue src/kvm/composables/useVmList.test.ts src/i18n/
git commit -m "fix(kvm): say something when a restarted console never reconnects

Restart deliberately leaves reconnection to the kvm:vm_started event, since
reconnecting immediately fails while the VNC port is still coming up. When
the bus is down that event never arrives, so the console went black and
stayed black with nothing explaining why. A timer now reports the stall to
the page. It deliberately does not reconnect — that would bring back the
failure the event handoff exists to avoid."
```

---

### Task 9: 6 个 KVM 按钮的 hover 特异度体检

对应 spec **T6**。`.cv-btn-restore` / `.cv-btn-delete` / `.cv-btn-create` / `.cv-primary-btn` / `.category-btn` / `.os-action-btn` 从未被检查过。风险是 `newui-css-hover-specificity-trap` 那一类：基类 `.x:hover` 是 (0,2,0)、变体 `.x-danger` 只有 (0,1,0)，CSS 优先级高者胜**与书写顺序无关** ⇒ 指针一进按钮，变体背景被基类 hover 背景整块替换、文字色仍由变体提供 → **白底白字**。jsdom 测不到，必须自算级联。

**Files:**
- Modify: `src/kvm/styles/kvmStyles.test.ts`
- 可能 Modify: `src/kvm/styles/kvm.css`（仅当体检真的发现被压过）

**Interfaces:**
- Consumes: `src/photos/components/__tests__/cssCascade.ts` 的 `winningHoverBackground(styleText, classes) => { selector, specificity, value, order } | undefined`

> ⚠️ **跨区依赖登记**：`cssCascade.ts` 位于 photos 区的 `__tests__` 下，现有 31 个引用方**全部是 photos 区自己**；本任务是第一个区外引用，而 `sp15-photos-moments` 正在同一目录作业。它是无状态纯函数且签名被 31 处锁死，改动概率极低 —— 但**不要动它**，合并时若签名有变，改本任务这一侧。
>
> ⚠️ **不需要 `extractStyleBlock`**：这六个类的样式**全部写在 `src/kvm/styles/kvm.css` 里**，不在任何 SFC 的 `<style>` 块中（模板在各 `.vue`、样式在 `kvm.css`）。直接 `node:fs` 读 `kvm.css` 即可 —— **不要用 `?raw` 读 `.css`**，在 vitest 下恒为空串，会让守卫静默空转。
>
> ⚠️ **实际是 5 个按钮不是 6 个**：`.cv-btn-create` 在全仓**只出现在 `kvm.css:2061` 的一句注释里**，既无 CSS 规则也无模板引用 ⇒ 它是**死类名**，台账那份 6 个的清单把它算进去了。本任务把它从清单里剔除并在提交信息里点明。

- [ ] **Step 1: 写体检测试**

加到 `src/kvm/styles/kvmStyles.test.ts`（沿用该文件既有的 `node:fs` 读 `kvm.css` 的方式）：

```ts
import { winningHoverBackground } from '../../photos/components/__tests__/cssCascade'

// 变体自带的 hover 背景必须赢过它继承的基类 hover 背景,否则指针一进去背景被整块
// 换掉、文字色还是变体的 → 白底白字。jsdom 既不级联也进不了 hover,只能自己算优先级。
// `.cv-btn-create` 不在列:全仓只有一句注释提到它,没有规则也没有模板引用(死类名)。
const BUTTONS: Array<{ base: string[]; variant: string }> = [
  { base: ['cv-btn'], variant: 'cv-btn-restore' },
  { base: ['cv-btn'], variant: 'cv-btn-delete' },
  { base: [], variant: 'cv-primary-btn' },
  { base: [], variant: 'category-btn' },
  { base: [], variant: 'os-action-btn' },
]

describe('KVM 按钮的 hover 背景没有被基类压过', () => {
  const css = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), './kvm.css'),
    'utf8',
  )
  for (const b of BUTTONS) {
    it(`.${b.variant} 的 hover 背景来自最具体的那条规则`, () => {
      const win = winningHoverBackground(css, [...b.base, b.variant])
      // 防空转:一条 hover 背景规则都没有时也该红,而不是"没找到 = 通过"
      expect(win, `.${b.variant} 没有任何 hover 背景规则`).toBeTruthy()
      // 赢家必须提到变体自己的类名 —— 基类赢 = 变体的底被整块替换掉了。
      expect(win!.selector).toContain(b.variant)
    })
  }
})
```

> 已知的现场情况（`grep -n` 取自 `kvm.css`）：`.cv-btn-restore:hover:not(:disabled)` `:2223` · `.cv-btn-delete:hover` `:2241` ·
> `.cv-primary-btn:hover:not(:disabled)` `:1388` · `.category-btn:hover:not(.active)` `:1525` ·
> `.os-action-btn.is-download:hover` `:1625` / `.is-selected:hover` `:1637`。
> 五条**都自带 hover**，所以体检大概率全绿 —— 那也是有效结果：本任务的交付物就是这道守卫，防的是复发。
> `kvm.css:2094` 有一句注释已经推理过 restore/delete 这一对，但**推理不是守卫**，改一行就会失效。

- [ ] **Step 2: 跑测试，记录结果**

Run: `pnpm vitest run src/kvm/styles/kvmStyles.test.ts --reporter=verbose`
Expected: 六条各自 PASS 或 FAIL —— **这一步是体检，红是有效结果，不是失败**。把红的那几条记下来。

- [ ] **Step 3: 只修真红的那几条**

对每条红的：给变体补一条自带的 `:hover` 背景，使它的特异度不低于基类 hover 规则。例如：

```css
.cv-btn-danger:hover {
  /* The base .cv-btn:hover is (0,2,0) and this variant was only (0,1,0), so the
     pointer replaced the danger background wholesale while the text colour
     stayed — white on white. Giving the variant its own hover rule settles it. */
  background: var(--danger-bg-hover);
}
```

若六条全绿：**不改任何产品代码**，本任务只留下这道守卫（这本身就是交付物 —— 防的是复发）。

- [ ] **Step 4: 跑全套确认**

Run: `pnpm vitest run src/kvm/ src/styles/ --reporter=verbose`
Expected: PASS，且新增 **5** 条用例（数一下，别只看绿）

- [ ] **Step 5: 提交**

```bash
git add src/kvm/styles/kvmStyles.test.ts src/kvm/
git commit -m "test(kvm): check that variant hover backgrounds outrank their base class

A base .x:hover scores (0,2,0) while a single-class variant scores (0,1,0),
and specificity beats source order — so the pointer can replace a variant's
background while its text colour stays, rendering white on white. jsdom
neither cascades nor enters hover, so the check computes specificity itself.

One comment in the stylesheet had already reasoned this through for the
restore/delete pair, but reasoning is not a guard and does not survive an
edit. The backlog listed six buttons; .cv-btn-create is a dead class name
appearing only in that comment, so five are checked."
```

---

### Task 10: 测试标题承诺了没有覆盖的动作

对应 spec **T7 下半**。`KvmPage.test.ts:891` 标题写「暂停/恢复/强制重启/**强制关机**成功后也各自弹对应文案的 toast」，用例体只点了暂停、恢复、强制重启三个 —— `api.stopVM` 虽已 mock 但从未触发 ⇒ **标题误导后人以为强制关机有覆盖**。

**Files:**
- Modify: `src/kvm/views/KvmPage.test.ts:891-917`

**Interfaces:** 无

- [ ] **Step 1: 补上标题承诺的那一段**

在该用例末尾（`强制重启` 断言之后）追加。强制关机与重启一样需要就地二次确认：

```ts
  // The title promised force-stop coverage and never delivered it; api.stopVM was
  // mocked but never triggered. Same two-click confirm shape as restart.
  await w.findAll('.action-btn')[1].trigger('click')
  await w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!.trigger('click')
  await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click')
  await flush()
  expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 已关闭')
```

> 期望文案用 `kvmToastStopped`（或同族键）的**真实译文** —— 实施时 `grep -n "kvmToast" src/i18n/zh_cn*.ts` 取字面量，别照上面这行猜。二次确认的文案同理，照该文件 `:915` 那条既有写法。

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/kvm/views/KvmPage.test.ts --reporter=verbose`
Expected: PASS。**若它红**，说明强制关机的 toast 真的坏了 —— 那就是一条本任务顺带发现的真缺陷：先修产品代码再让它绿，并在提交信息里说明。

- [ ] **Step 3: 提交**

```bash
git add src/kvm/views/KvmPage.test.ts
git commit -m "test(kvm): actually exercise the force-stop toast its title claims

The case was titled for four power actions and only clicked three; stopVM
was mocked but never triggered, so the title read as coverage that did not
exist."
```

---

### Task 11: i18n 键写错时没有任何门拦得住

对应 spec **T7 上半**（D38）。`KvmPage.vue:598` 用的是 `t('kvmToastResumed')` —— **已经是 i18n 键调用**（台账说的"手写一行"已过时）。真实缺口是：键名写错时 vue-i18n 静默回落成键名本身，界面显示 `kvmToastResumd` 这种原文，而三门全绿。

**Files:**
- Create: `src/i18n/i18nKeys.test.ts`

**Interfaces:** 无

- [ ] **Step 1: 先只读取数，决定守卫范围**

```bash
# 全仓有多少 t('…') 字面量键？其中多少在 zh_cn 里查不到？
grep -rhoE "\bt\('[a-zA-Z][a-zA-Z0-9_]*'\)" src/ --include=*.vue --include=*.ts | sort -u | wc -l
```

写一段一次性脚本（或直接把守卫写成全仓版先跑一次）统计缺失数。
**判据**：缺失 ≤ 10 条 ⇒ 守卫直接上全仓，本任务顺手修掉这些键；缺失 > 10 条 ⇒ **守卫范围缩到 `src/kvm/**` + `src/settings/**`**，其余在提交信息里记为交接票，不在本期硬扛（spec §3 已授权这个降级）。

- [ ] **Step 2: 写守卫**

```ts
// vue-i18n falls back to the key itself when a key is missing, so a typo ships as
// literal `kvmToastResumd` on screen and every gate stays green: tsc does not type
// string literals against the message catalogue, and tests that assert on rendered
// text usually assert the key's own text.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import zhBase from './zh_cn'
import enBase from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// 与运行时逐字一致:index.ts:9 装进 createI18n 的就是这两个合并结果
// (`{ ...zh, ...zhSp9 }`)。parity.test.ts:8-9 也是这个写法 —— 只看基座会漏掉
// 分片,而 KVM 的键正好全在 sp9 分片里。
const zh: Record<string, unknown> = { ...zhBase, ...zhSp9 }
const en: Record<string, unknown> = { ...enBase, ...enSp9 }

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPES = ['kvm', 'settings']    // Step 1 的取数若允许,改成 ['']（全仓）

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(vue|ts)$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const KEY_RE = /\bt\('([a-zA-Z][a-zA-Z0-9_]*)'\)/g

describe('t() 引用的 i18n 键在两侧语料里都存在', () => {
  for (const scope of SCOPES) {
    const files = walk(path.join(SRC, scope))
    it(`${scope || 'src'} 下没有死键`, () => {
      expect(files.length).toBeGreaterThan(0)   // 防空转
      const missing: string[] = []
      for (const f of files) {
        const src = fs.readFileSync(f, 'utf8')
        for (const m of src.matchAll(KEY_RE)) {
          const k = m[1]
          if (!(k in zh)) missing.push(`${path.relative(SRC, f)}: zh 缺 ${k}`)
          if (!(k in en)) missing.push(`${path.relative(SRC, f)}: en 缺 ${k}`)
        }
      }
      expect(missing, `\n发现 t() 引用了不存在的键:\n${missing.join('\n')}`).toEqual([])
    })
  }
})
```

> ⚠️ 只扫 `t('字面量')` 这一种形态。`t(someVar)` / `t(\`x${y}\`)` 静态查不了，**不要**为了覆盖它们放宽正则 —— 假阴性可接受，假阳性会让守卫被人关掉。
> ⚠️ 与既有的 `src/i18n/parity.test.ts` **不重复**：那份查的是「zh 与 en 两侧键集合是否对等、值是否非空、分片有没有覆盖基座」，**从不读源码** ⇒ 一个两侧都不存在的键它照样放行。本任务查的是反方向：源码引用的键在不在语料里。

- [ ] **Step 3: 跑守卫，修掉它找到的（在选定范围内的）死键**

Run: `pnpm vitest run src/i18n/i18nKeys.test.ts --reporter=verbose`
Expected: 先红（如果真有死键）→ 修键 → 绿；若一条没有则直接绿。

- [ ] **Step 4: 变异验证（必做）**

从**干净基线**开始，把 `KvmPage.vue:598` 的 `kvmToastResumed` 改成 `kvmToastResumd`，**先确认文件真的被改了**（`grep -n kvmToastResumd src/kvm/views/KvmPage.vue` 有输出），再跑守卫确认它红，然后 `git checkout src/kvm/views/KvmPage.vue` 还原。

- [ ] **Step 5: 提交**

```bash
git add src/i18n/i18nKeys.test.ts
git commit -m "test(i18n): fail when t() references a key that does not exist

A mistyped key falls back to the key itself, so it ships as raw
kvmToastResumd on screen while tsc, the unit tests and the build all stay
green. The guard reads only literal t('...') calls; dynamic keys are out of
reach and left alone rather than approximated."
```

---

### Task 12: CSS 注释完整性守卫看不见 `.vue` 里的样式

对应 spec **T12**（D50 剩余一半）。`color-guard.test.ts` 有两个语料：颜色扫描用 `files`（**已含 `.vue`**），而注释完整性守卫 `:199` 用的是 `cssFiles`（**只有 5 个 `.css`**）。「注释里 `*` 紧贴 `/` 提前关闭注释 → 错误恢复吞掉后面整条规则」这类缺陷若发生在任何 `.vue` 的 `<style>` 里，**五道门全瞎**（类名白名单 / 裸色扫描 / color-guard 只看源文本 · vue-tsc 不看 CSS · build 不报错 · jsdom 不做布局）—— SP9 那次「KVM 页只占半屏」正是这个。

**Files:**
- Modify: `src/styles/color-guard.test.ts:198-215`

**Interfaces:** 无

- [ ] **Step 1: 扩语料**

**不能**把循环源直接换成 `files` —— `.vue` 的 `<script>` 里 JS 块注释的 ` * 续行` 极常见，会误报爆炸。只扫 `<style>` 块：

```ts
// The colour scan already covers .vue; this one did not. A comment that closes
// itself early inside a <style> block is invisible to every gate we have, which
// is exactly how a page once ended up rendering at half height.
const commentCorpus: Record<string, string> = { ...cssFiles }
for (const [rel, src] of Object.entries(files)) {
  if (!rel.endsWith('.vue')) continue
  // Style blocks only — never <script>, whose JS comments legitimately use
  // ` * ` continuation lines and would drown this check in false positives.
  const blocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  if (blocks.length) commentCorpus[rel] = blocks.join('\n')
}

describe('CSS 注释完整性(防「注释里写了 */ 把后面的规则吞掉」)', () => {
  for (const [rel, src] of Object.entries(commentCorpus)) {
    // …循环体逐字不动…
```

> 提取正则与本文件既有的样式块提取同源，因此同样受 Minor 11 那条测试（「样式块提取不被注释里的假开标签污染」）的保护 —— 那条测试跑的是 `files`，本任务不改它。

- [ ] **Step 2: 跑守卫，看扩语料后有多少既有违例**

Run: `pnpm vitest run src/styles/color-guard.test.ts --reporter=verbose`
Expected: 可能有既有 `.vue` 红。**判据同 Task 11**：违例 ≤ 10 处 ⇒ 本任务一并修（把注释里的 `*/` 拆开写，如 `os-* / category-*`，斜杠两侧留空格）；> 10 处 ⇒ 只覆盖 `src/kvm/**` + `src/settings/**` 下的 `.vue`，其余记交接票。

- [ ] **Step 3: 变异验证（必做）**

从**干净基线**开始，往任意一个 KVM 的 `.vue` 的 `<style>` 里插一行会提前闭合的块注释，例如：

```css
/* tokens used here: --kvm-modal-*/--kvm-field-* */
.some-rule { color: var(--fg); }
```

先 `grep` 确认文件真被改了，再跑守卫确认它红，然后 `git checkout` 还原。**每次变异都从干净基线重做** —— 曾出现过 `str.replace` 静默不命中、看到的红其实是上一次的。

- [ ] **Step 4: 确认既有 5 个 `.css` 的用例没丢**

Run: `pnpm vitest run src/styles/ --reporter=verbose`
Expected: PASS，且用例条数**比改动前多**（多出来的就是新纳入的 `.vue`）—— 数一下，别只看绿。

- [ ] **Step 5: 提交**

```bash
git add src/styles/color-guard.test.ts
git commit -m "test(styles): extend the comment-integrity check to .vue style blocks

A block comment that closes itself early makes CSS error recovery swallow
everything up to the next brace, so the source reads correctly while the
rule silently disappears — no gate catches it. The check only ever looked at
the five standalone stylesheets. Script blocks stay excluded: their JS
comments use ' * ' continuation lines and would bury the signal."
```

---

### Task 13: 按一次 Esc，预览和搜索面板一起关

对应 spec **T11**。搜 `receipt` → 点结果开预览 → 按一次 Esc → 预览关了，**搜索面板也一起关了、结果全丢**。

根因（已取证）：`reka-ui` 的 `DismissableLayer.js:77` 用 VueUse `onKeyStroke('Escape', …)` —— target 默认 **window**、**冒泡阶段**、非 capture；`ViewerHost.vue:29` 也是 `window.addEventListener('keydown', …)` 冒泡。同目标同阶段 ⇒ 执行顺序 = 注册顺序。Home 挂载时 ViewerHost 就注册了、搜索弹窗是后开的 ⇒ ViewerHost 先 `v.close()` 把 `viewer.open` 置 false，守卫（`SearchDialog.vue:249`）再读已是 false ⇒ 不 `preventDefault()` ⇒ 弹窗照常 dismiss。

**Files:**
- Modify: `src/home/components/SearchDialog.vue:246-251`
- Test: `src/home/components/SearchDialog.test.ts`（已存在，且顶部**已经 import 了 `useViewer`** —— 沿用它的 mock 体系，别新建文件）

**Interfaces:**
- Consumes: 既有 `viewer`（`useViewer()`）的 `open` ref
- Produces: 无

> **不动 `src/files/viewers/ViewerHost.vue`。** 让它 `stopPropagation()` 无效（同目标同阶段拦不住，得用 `stopImmediatePropagation`），而且那样是把正确性押在"ViewerHost 恰好先注册"上。

- [ ] **Step 1: 写失败的测试**

加到 `src/home/components/SearchDialog.test.ts`（该文件已 `import { useViewer } from '../../files/viewers/useViewer'`，
并有 `useHomeUiStore`、pinia、router 的完整装配；i18n 由 `vitest.setup.ts` 全局装好 —— **不要在测试里另建 `createI18n`**）：

```ts
it('预览开着时按一次 Esc,只关预览,搜索面板与结果都还在', async () => {
  const homeUi = useHomeUiStore()
  homeUi.searchOpen = true
  const w = mount(SearchDialog, { /* 沿用该文件既有用例的 global 配置 */ })
  await flushPromises()

  const viewer = useViewer()
  viewer.open.value = true
  await nextTick()

  // 真实时序:capture 阶段先跑(本任务新加的快照监听),然后 ViewerHost 的冒泡
  // 监听把 open 置 false,最后 reka 的冒泡监听读守卫。这里用一次真实的 window
  // 事件把三者串起来 —— 断言落在"用户看到什么"上,而不是内部函数。
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  viewer.open.value = false      // ViewerHost 在同一个事件里做的事
  await nextTick()

  expect(homeUi.searchOpen).toBe(true)   // 面板必须还开着
})
```

> 该文件既有用例里已有一条覆盖「无预览时 Esc 正常关面板」的路径；若没有，**本任务顺手补一条** ——
> 只证「挡住了」而不证「该关的时候还能关」，等于给自己留一个更难发现的缺陷。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm vitest run src/home/components/SearchDialog.test.ts --reporter=verbose`
Expected: FAIL — 搜索面板被关掉了 / `defaultPrevented` 是 false

- [ ] **Step 3: 改成读 capture 阶段的快照**

`src/home/components/SearchDialog.vue`：

```ts
// Both the viewer's Escape handler and reka's sit on window's bubble phase, so
// which runs first is decided by registration order — and the viewer registers
// when Home mounts, long before this dialog opens. It therefore closes the
// preview and clears viewer.open before this guard reads it, and the guard lets
// the dialog dismiss too, throwing the results away. A capture-phase listener
// always runs before both, so it can record whether a preview was open at the
// moment the key went down, independent of registration order.
let viewerOpenAtKeydown = false
function snapshotViewerState(e: KeyboardEvent): void {
  if (e.key === 'Escape') viewerOpenAtKeydown = viewer.open.value
}
onMounted(() => window.addEventListener('keydown', snapshotViewerState, true))
onBeforeUnmount(() => window.removeEventListener('keydown', snapshotViewerState, true))

function onEscapeKeyDown(e: Event): void {
  if (viewerOpenAtKeydown) e.preventDefault() // 交给 ViewerHost 自己的 Esc 关闭预览
}
```

`onInteractOutside`（`:247`）**保持原样** —— 指针路径没有这个先后问题，不为对称而改。

- [ ] **Step 4: 跑测试确认它绿**

Run: `pnpm vitest run src/home/ --reporter=verbose`
Expected: PASS，且既有搜索面板用例（无预览时 Esc 正常关面板）全绿 —— 这一条尤其要确认，别把正常路径也挡了。

- [ ] **Step 5: 提交**

```bash
git add src/home/components/SearchDialog.vue src/home/components/SearchDialog.test.ts
git commit -m "fix(home): keep the search panel open when Escape closes a preview

One Escape closed both the preview and the panel behind it, discarding the
results. The viewer's handler and the dialog's both listen on window's
bubble phase, so order comes down to registration — and the viewer registers
first, clearing the flag the guard was about to read. Recording the flag
from a capture-phase listener makes the guard independent of that order.
Stopping propagation in the viewer would not work here: same target, same
phase."
```

---

## 收尾：全套门

13 个任务全部完成后，在**干净工作树**上跑：

```bash
pnpm vitest run                    # 期望 ≥ 672 文件 / ≥ 10669 例,0 失败
pnpm vue-tsc --noEmit              # 期望 0 错误
pnpm vitest run src/styles/        # color-guard + selectPopup 守卫
pnpm vitest run oss/               # 期望 6 文件 / 138 例,0 失败
pnpm build                         # 期望成功
```

**不部署、不推 origin。** 把验收清单写进 `docs/superpowers/2026-08-09-sp16-outstanding.md`，逐条给出**点击路径**（`05` 文件记的教训：面板内状态机 / 弹窗才能到达的屏，不写点击路径机主会卡住），并标明哪几条 jsdom 验不了、只能真机看：

- Task 3 窄屏渐隐（要把窗口拉到 420px）
- Task 4 toast 位置（要有一台 running 的 VM 并连上控制台）
- Task 8 重启后控制台未恢复的提示（要能制造 MessageBus 掉线）

## 交接票（本期不做，已登记）

1. `useVmList.ts:420`（create）与 `:464`（update）的 catch 里 `if (!alive) return ''` 与 Task 7 修的那处同形 —— 弹窗卸载后失败会被当成功。机主确认本期只改 eject。
2. Task 11 / Task 12 若因既有违例过多而降级到 `kvm`+`settings` 范围，全仓收口另开一期。
3. `cssCascade.ts` 长期只服务 photos 区，本期起有了区外引用方；若将来要提到共享位置，那是独立一期的事（现在动会与 photos 线冲突，且要改 31 个 import）。

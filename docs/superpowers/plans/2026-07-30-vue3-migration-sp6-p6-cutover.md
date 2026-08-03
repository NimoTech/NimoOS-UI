# SP6-P6 存储区收口 + cutover 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把四个存储入口(New-UI 桌面磁贴 + Vue2 三处弹窗调用处)翻到新 UI `/app/#/storage`,共用一把可逆回退开关 `strangler:disabled:/storage`,并完成 i18n 收口扫描、两仓部署、真机验收与记账。

**Architecture:** Vue2 侧新增「无路由绞杀点」表 `migratedEntries` + 纯函数 `resolveEntryTarget(from, storage)`,与既有 `migratedRoutes`/`resolveTarget` 结构对称;三个 `.vue` 调用处各两行判定,老弹窗代码原样留作安全网。New-UI 侧把 P1 起就硬跳的 storage 分支改为受同一把 flag 门控,回退落到既有 `/#/legacy` 兜底。

**Tech Stack:** Vue 2.7 + `@vue/test-utils@1` + vitest(jsdom)【`NimoOS-UI`】;Vue 3 + vitest + pinia【`NimoOS-New-UI`】。

**Spec:** `NimoOS-New-UI/docs/superpowers/specs/2026-07-30-vue3-migration-sp6-p6-cutover-design.md`

## Global Constraints

- **两个仓库,分别提交**:`/home/nimo/NimoTech/NimoOS-UI`(Vue2)与 `/home/nimo/NimoTech/NimoOS-New-UI`(Vue3)。每个仓自己 `git add`/`git commit`,**不要跨仓一次提交**。不开 worktree,各自在**当前检出的分支**上做 —— New-UI 是 `master`;**Vue2 仓没有 `master`,迁移期的工作分支是 `docs/vue3-migration-sp3`**(领先 `main` 163 个提交,`strangler.js` 的全部历史都在这条分支上,部署脚本构建的是工作树),照检出状态直接提交即可,不要切分支、不要合 `main`。
- **回退 flag 唯一键名:`strangler:disabled:/storage`**(四处共用,逐字如此,不要写成 `storage-entry` 或 `/storage/`)。
- **迁移目标 URL 逐字:`/app/#/storage`**。
- **老弹窗代码是安全网,一行都不删**。`$buefy.modal.open({ ... StorageManagerPanel ... })` 整块保留,只在它前面加提前返回。
- **`this.$messageBus('widget_storagemanager')` 保留在跳转判定之前**(`Home.vue` 与 `Disks.vue` 各有一行;`MountActionButton.vue` 原本没有,不要加)。
- **移植纪律**:界面/交互 1:1;不做与本期无关的重构、改名、格式化。**Vue2 文件缩进照原文** —— `src/views/Home.vue` 用 2 空格,`src/widgets/Disks.vue` 与 `src/components/filebrowser/components/MountActionButton.vue` 用 **Tab**。
- **变异验证是每个任务的收尾步骤**:撤回实现改动,确认对应新测试变红,再恢复。P5.5 曾靠这一步抓到一条对空气生效的空洞断言。
- **fixture 纪律**:本期不涉及外部命令输出/HTTP 信封,无需真机抓取;但也**不要**为「顺手」给别处补手编 fixture。
- 中文注释,与两仓现有注释风格一致。

---

### Task 0: 清理 NimoOS-UI 工作区(P6 无关改动)

`NimoOS-UI` 有 3 个未提交改动,而本期要构建部署该仓,不处置就会静默上线。**必须先做完这个任务再动 P6 代码**,否则 P6 的提交会和它们混在一起。

**Files:**
- Commit as-is: `src/views/Home.vue`(+60,`/next/` 入口药丸,**已在现网**)
- Commit as-is: `src/views/AI/Agent/Agent.vue`(+13,接 `?message=` 种子消息)
- Revert: `src/views/Photos/PhotosTimeline.vue`(−163,撤掉了已提交的照片深链同步 + 重新启用 `PhotosDropZone`,疑似误 checkout)

**Interfaces:**
- Consumes: 无
- Produces: 干净的 `NimoOS-UI` 工作区(`git status --short` 只剩 `docs/` 与未跟踪文件),后续任务的提交才只含 P6 改动。

- [ ] **Step 1: 确认三处改动内容与判读一致**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git status --short -- src/
git diff --stat -- src/views/Home.vue src/views/AI/Agent/Agent.vue src/views/Photos/PhotosTimeline.vue
```

预期:恰好这 3 个 `src/` 下文件被修改(`M`)。若出现**第 4 个** `src/` 下的修改文件,**停下来报告**,不要自行处置。

- [ ] **Step 2: 验证 `/next/` 药丸确实已在现网**(决定「提交而非丢弃」的依据)

```bash
grep -rl "enter-next" /var/lib/nimoos/www --include=*.js 2>/dev/null | grep -v '/app/'
```

预期:命中 `src_components_common_KIcon_vue-src_views_Home_vue.*.js`(现网 Home chunk 里有这段样式类名)。若**无命中**,停下来报告 —— 判读前提不成立。

- [ ] **Step 3: 单独提交 Home.vue 的 `/next/` 药丸**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/views/Home.vue
git commit -m "feat(home): Vue2 桌面补「进入新主页」入口药丸

早前改动一直未提交但已在现网(部署的 Home chunk 含 enter-next)。
本次 SP6-P6 要构建部署 Vue2 仓,先把它正式入库,避免随 P6 提交混入。
与 SP6-P6 无关。"
```

- [ ] **Step 4: 单独提交 Agent.vue 的 `?message=` 接力**

```bash
git add src/views/AI/Agent/Agent.vue
git commit -m "feat(ai): Agent 页接收 ?message= 种子消息

New-UI 桌面 AI 小组件的 sendToAI 一直在发 /#/ai/agent?message=<text>,
接收端此前未提交。?search= 在场时跳过,两者不会双发。
本次 SP6-P6 要构建部署 Vue2 仓,先把它正式入库。与 SP6-P6 无关。"
```

- [ ] **Step 5: 撤回 PhotosTimeline.vue 的旧版本**

```bash
git checkout -- src/views/Photos/PhotosTimeline.vue
git diff --stat -- src/views/Photos/PhotosTimeline.vue
```

预期:第二条命令**零输出**(文件回到 HEAD)。

- [ ] **Step 6: 确认工作区干净并跑全量测试**

```bash
git status --short -- src/
pnpm test 2>&1 | tail -20
```

预期:第一条命令零输出;测试全绿(记下用例数,后续任务比对)。

- [ ] **Step 7: 无需额外提交,报告本任务结果**

报告:两个提交的 hash、`pnpm test` 的用例数。

---

### Task 1: Vue2 `strangler.js` 加「无路由绞杀点」表

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/router/strangler.js`(在文件末尾追加,不改动既有 `migratedRoutes`/`isEnabled`/`resolveTarget`/`matches` 任何一行)
- Test: `/home/nimo/NimoTech/NimoOS-UI/src/router/__tests__/strangler.spec.js`(追加一个 `describe` 块)

**Interfaces:**
- Consumes: 文件内既有的私有函数 `flagKey(from)`(返回 `` `strangler:disabled:${from}` ``)与 `resolveStorage(storage)`(storage 为空时回落到全局 `localStorage`,无 `localStorage` 环境返回 `null`)。
- Produces:
  - `export const migratedEntries` —— 数组,元素形状 `{ from: string, to: string, enabled: boolean }`。
  - `export function resolveEntryTarget(from, storage)` —— 命中且未回退返回 `to` 字符串;未登记 / `enabled === false` / flag 为 `'1'` 时返回 `null`。第二参 `storage` 可选,用于测试注入。
  - Task 2 / Task 3 的三个 `.vue` 调用 `resolveEntryTarget('/storage')`。

- [ ] **Step 1: 写失败测试**

追加到 `src/router/__tests__/strangler.spec.js` 末尾(顶部 import 行同时补上两个新导出):

```js
// 顶部 import 改为:
// import { migratedRoutes, migratedEntries, isEnabled, resolveTarget, resolveEntryTarget } from '../strangler'

describe('无路由绞杀点 migratedEntries(SP6-P6 存储区 cutover)', () => {
  it('存储区是第一条,目标 /app/#/storage', () => {
    expect(migratedEntries[0]).toEqual({ from: '/storage', to: '/app/#/storage', enabled: true })
  })

  it('未回退时 resolveEntryTarget 返回目标 URL', () => {
    expect(resolveEntryTarget('/storage', noStore)).toBe('/app/#/storage')
  })

  it('回退 flag strangler:disabled:/storage === "1" 时返回 null(调用处走老弹窗)', () => {
    expect(resolveEntryTarget('/storage', offStore('strangler:disabled:/storage'))).toBeNull()
  })

  it('flag 为其他值不算回退', () => {
    expect(resolveEntryTarget('/storage', { getItem: () => '0' })).toBe('/app/#/storage')
    expect(resolveEntryTarget('/storage', { getItem: () => '' })).toBe('/app/#/storage')
  })

  it('未登记的入口返回 null', () => {
    expect(resolveEntryTarget('/photos', noStore)).toBeNull()
    expect(resolveEntryTarget('', noStore)).toBeNull()
  })

  it('两张表互不干扰:存储不进路由表,/storage 不被守卫重定向', () => {
    expect(migratedRoutes.some((e) => e.from === '/storage')).toBe(false)
    expect(resolveTarget('/storage', noStore)).toBeNull()
  })

  it('不传 storage 且环境无 localStorage 时不抛(SSR/裸 node)', () => {
    const saved = globalThis.localStorage
    // eslint-disable-next-line no-global-assign
    delete globalThis.localStorage
    expect(() => resolveEntryTarget('/storage')).not.toThrow()
    expect(resolveEntryTarget('/storage')).toBe('/app/#/storage')
    globalThis.localStorage = saved
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm vitest run src/router/__tests__/strangler.spec.js
```

预期:FAIL —— `resolveEntryTarget is not a function` / `migratedEntries` undefined。

- [ ] **Step 3: 实现**

追加到 `src/router/strangler.js` 末尾:

```js
/**
 * 无路由绞杀点:Vue2 侧是模态弹窗、没有路由,进不了 migratedRoutes(全局守卫拦不到),
 * 由入口调用处自己判定。SP6-P6 存储区是第一条;SP7/SP8 若也有模态型入口,在此续行,
 * 不要回到「每个调用处各写一遍 localStorage 判断」。
 * flag 命名与 migratedRoutes 共用:localStorage['strangler:disabled:<from>'] === '1' 即回退。
 */
export const migratedEntries = [
	{ from: '/storage', to: '/app/#/storage', enabled: true }, // SP6-P6:三处存储弹窗入口
]

/**
 * 命中且未回退 → 返回目标 URL(调用处整页跳转);未登记 / 已禁用 / 已回退 → null(调用处走原弹窗)。
 */
export function resolveEntryTarget(from, storage) {
	const entry = migratedEntries.find((e) => e.from === from)
	if (!entry || !entry.enabled) return null
	const ls = resolveStorage(storage)
	if (ls && ls.getItem(flagKey(from)) === '1') return null
	return entry.to
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/router/__tests__/strangler.spec.js
```

预期:PASS,全部用例绿。

- [ ] **Step 5: 变异验证**

把 `resolveEntryTarget` 里 `=== '1'` 临时改成 `=== 'x'`,重跑 → 「回退 flag」那条必须变红;改回。
再把 `enabled` 判定 `|| !entry.enabled` 临时删掉,重跑 → 该改动不应让任何用例变红(**这是预期的**,表里目前没有 `enabled: false` 的条目);恢复后在报告里说明这一点,不要为它补测试(YAGNI)。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/router/strangler.js src/router/__tests__/strangler.spec.js
git commit -m "feat(strangler): 加无路由绞杀点表 migratedEntries + resolveEntryTarget

存储区在 Vue2 是模态弹窗、没有路由,全局守卫拦不到,进不了 migratedRoutes。
新增第二张表登记这类 cutover 点,flag 命名与路由表共用 strangler:disabled:<from>。
SP6-P6 存储区是第一条。"
```

---

### Task 2: Vue2 `Home.vue` 存储入口改跳

`showStorageManagerPanelModal` 只由 `mounted()` 里的 EventBus `casaUI:openStorageManager` 触发 —— 即新盘检测通知卡的「Storage Manager」按钮(`src/components/CoreService.vue:306`)。**EventBus 接线本任务不动**,改方法体即覆盖该路径。

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/views/Home.vue`(`showStorageManagerPanelModal`,当前在 262-273 行附近)
- Create: `/home/nimo/NimoTech/NimoOS-UI/src/views/__tests__/Home.storageCutover.spec.js`

**Interfaces:**
- Consumes: `resolveEntryTarget(from, storage)`(Task 1),`import { resolveEntryTarget } from '@/router/strangler'`。
- Produces: 无(叶子改动)。

**测试策略(照此做,不要改成 `shallowMount`)**:`Home.vue` 的 `created()` 会打三个 `$api` 请求,`components` 里挂着 `SideBar`/`SearchBar`/`CoreService`/`AppSection`/`KVMFullPage` + `vue-custom-scrollbar`,挂载它需要一大堆与本改动无关的 mock。本任务测的是方法内的一个分支,故**在桩 `this` 上直调 `Home.methods.showStorageManagerPanelModal`**,并在测试文件里注释写明这个取舍。模板与 EventBus 接线本任务未改动,由真机验收覆盖。

- [ ] **Step 1: 写失败测试**

新建 `src/views/__tests__/Home.storageCutover.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Home from '@/views/Home.vue'

// 说明:Home.vue 的 created() 会打三个 $api 请求、components 里挂着 SideBar/CoreService/
// AppSection/KVMFullPage 等,shallowMount 需要一大堆与本改动无关的 mock。本用例测的是
// showStorageManagerPanelModal 里的 cutover 分支,故在桩 this 上直调该方法。
// 模板绑定与 mounted() 里的 EventBus 接线(casaUI:openStorageManager)本期未改动,由真机验收覆盖。
function stubThis() {
  return {
    $messageBus: vi.fn(),
    $buefy: { modal: { open: vi.fn() } },
  }
}

let savedLocation
let hrefs
beforeEach(() => {
  hrefs = []
  savedLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { set href(v) { hrefs.push(v) }, get href() { return '' } },
  })
  localStorage.removeItem('strangler:disabled:/storage')
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: savedLocation })
  localStorage.removeItem('strangler:disabled:/storage')
})

describe('Home.vue 存储入口 cutover(SP6-P6)', () => {
  it('未回退时整页跳 /app/#/storage,不开老弹窗', async () => {
    const vm = stubThis()
    await Home.methods.showStorageManagerPanelModal.call(vm)
    expect(hrefs).toEqual(['/app/#/storage'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('埋点 widget_storagemanager 仍然上报', async () => {
    const vm = stubThis()
    await Home.methods.showStorageManagerPanelModal.call(vm)
    expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')
  })

  it('回退 flag == "1" 时开老弹窗,不跳转', async () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const vm = stubThis()
    await Home.methods.showStorageManagerPanelModal.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
    expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm vitest run src/views/__tests__/Home.storageCutover.spec.js
```

预期:第 1、3 条 FAIL(现在无论如何都开弹窗、`hrefs` 为空);第 2 条已通过。

- [ ] **Step 3: 实现**

`src/views/Home.vue` 顶部 import 区(与其他 `@/` import 同段)加:

```js
import { resolveEntryTarget } from '@/router/strangler'
```

把 `showStorageManagerPanelModal` 改为(**2 空格缩进**,`$buefy.modal.open` 整块原样保留):

```js
    // show storage settings modal
    async showStorageManagerPanelModal() {
      this.$messageBus('widget_storagemanager')
      // SP6-P6 cutover:存储区已迁到 New-UI(/app/#/storage)。
      // localStorage['strangler:disabled:/storage'] === '1' 时返回 null,落到下面的老弹窗(可逆回退)。
      const target = resolveEntryTarget('/storage')
      if (target) {
        window.location.href = target
        return
      }
      this.$buefy.modal.open({
        parent: this,
        component: () => import('@/components/Storage/StorageManagerPanel.vue'),
        hasModalCard: true,
        customClass: 'storage-modal',
        trapFocus: true,
        canCancel: [],
        scroll: 'keep',
        animation: 'zoom-in',
      })
    },
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/views/__tests__/Home.storageCutover.spec.js
```

预期:3 条全 PASS。

- [ ] **Step 5: 变异验证**

把 `if (target) {` 临时改成 `if (false) {`,重跑 → 第 1 条变红;改回。
把 `this.$messageBus('widget_storagemanager')` 临时挪到 `return` 之后,重跑 → 第 2 条变红;改回。

- [ ] **Step 6: 提交**

```bash
git add src/views/Home.vue src/views/__tests__/Home.storageCutover.spec.js
git commit -m "feat(storage): Vue2 桌面存储入口改跳 /app/#/storage(SP6-P6)

新盘通知卡「Storage Manager」按钮经 EventBus casaUI:openStorageManager 打到这里。
埋点保留在跳转前;老弹窗代码原样留作安全网,flag strangler:disabled:/storage 可逆回退。"
```

---

### Task 3: Vue2 磁盘小组件 + 文件区挂载按钮改跳

两处方法同名 `showDiskManagement`、改法同型,合成一个任务。**两个文件都用 Tab 缩进。**

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/widgets/Disks.vue`(`showDiskManagement`,当前 107-120 行附近;**有** `$messageBus` 一行)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/components/filebrowser/components/MountActionButton.vue`(`showDiskManagement`,当前 106-118 行附近;**没有** `$messageBus`,不要加)
- Create: `/home/nimo/NimoTech/NimoOS-UI/src/widgets/__tests__/Disks.spec.js`
- Create: `/home/nimo/NimoTech/NimoOS-UI/src/components/filebrowser/components/__tests__/MountActionButton.spec.js`

**Interfaces:**
- Consumes: `resolveEntryTarget(from, storage)`(Task 1)。
- Produces: 无(叶子改动)。

测试策略同 Task 2:桩 `this` 直调方法(`Disks.vue` 的 `mounted()` 读 `$store.state.hardwareInfo`,`MountActionButton.vue` 的 `created()` 打 `$api.driver.getDriverList`,挂载都要无关 mock)。

- [ ] **Step 1: 写失败测试(两个文件)**

新建 `src/widgets/__tests__/Disks.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Disks from '@/widgets/Disks.vue'

// 说明:Disks.vue 的 mounted() 读 $store.state.hardwareInfo,挂载需与本改动无关的 mock。
// 本用例测 showDiskManagement 里的 cutover 分支,故在桩 this 上直调该方法。
// 模板 @click 绑定本期未改动,由真机验收覆盖。
function stubThis() {
  return {
    $messageBus: vi.fn(),
    $buefy: { modal: { open: vi.fn() } },
  }
}

let savedLocation
let hrefs
beforeEach(() => {
  hrefs = []
  savedLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { set href(v) { hrefs.push(v) }, get href() { return '' } },
  })
  localStorage.removeItem('strangler:disabled:/storage')
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: savedLocation })
  localStorage.removeItem('strangler:disabled:/storage')
})

describe('Disks 小组件存储入口 cutover(SP6-P6)', () => {
  it('未回退时整页跳 /app/#/storage,不开老弹窗', () => {
    const vm = stubThis()
    Disks.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual(['/app/#/storage'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('埋点 widget_storagemanager 仍然上报', () => {
    const vm = stubThis()
    Disks.methods.showDiskManagement.call(vm)
    expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')
  })

  it('回退 flag == "1" 时开老弹窗,不跳转', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const vm = stubThis()
    Disks.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
  })
})
```

新建 `src/components/filebrowser/components/__tests__/MountActionButton.spec.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MountActionButton from '@/components/filebrowser/components/MountActionButton.vue'

// 说明:MountActionButton.vue 的 created() 打 $api.driver.getDriverList,挂载需无关 mock。
// 本用例测 showDiskManagement 里的 cutover 分支,故在桩 this 上直调该方法。
// 该组件原本没有 widget_storagemanager 埋点,本期也不加。
function stubThis() {
  return { $buefy: { modal: { open: vi.fn() } } }
}

let savedLocation
let hrefs
beforeEach(() => {
  hrefs = []
  savedLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { set href(v) { hrefs.push(v) }, get href() { return '' } },
  })
  localStorage.removeItem('strangler:disabled:/storage')
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: savedLocation })
  localStorage.removeItem('strangler:disabled:/storage')
})

describe('文件区挂载按钮存储入口 cutover(SP6-P6)', () => {
  it('未回退时整页跳 /app/#/storage,不开老弹窗', () => {
    const vm = stubThis()
    MountActionButton.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual(['/app/#/storage'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('回退 flag == "1" 时开老弹窗,不跳转', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const vm = stubThis()
    MountActionButton.methods.showDiskManagement.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm vitest run src/widgets/__tests__/Disks.spec.js src/components/filebrowser/components/__tests__/MountActionButton.spec.js
```

预期:两文件各有「未回退时跳转」「回退时开弹窗」FAIL(现在恒开弹窗)。

- [ ] **Step 3: 实现 —— `src/widgets/Disks.vue`**

顶部 import 区加(与既有两行 import 同段):

```js
import { resolveEntryTarget } from '@/router/strangler'
```

方法改为(**Tab 缩进**,`$buefy.modal.open` 整块原样保留,注意原文分号风格):

```js
		showDiskManagement() {
			this.$messageBus('widget_storagemanager');
			// SP6-P6 cutover:存储区已迁到 New-UI(/app/#/storage)。
			// localStorage['strangler:disabled:/storage'] === '1' 时返回 null,落到下面的老弹窗(可逆回退)。
			const target = resolveEntryTarget('/storage')
			if (target) {
				window.location.href = target
				return
			}
			this.$buefy.modal.open({
				parent: this,
				component: StorageManagerPanel,
				hasModalCard: true,
				customClass: 'storage-modal',
				trapFocus: true,
				canCancel: [],
				scroll: "keep",
				animation: "zoom-in",
			})
		},
```

- [ ] **Step 4: 实现 —— `src/components/filebrowser/components/MountActionButton.vue`**

顶部 import 区加:

```js
import { resolveEntryTarget } from '@/router/strangler'
```

方法改为(**Tab 缩进**,不加埋点):

```js
		// Show Disk Management Panel
		showDiskManagement() {
			// SP6-P6 cutover:存储区已迁到 New-UI(/app/#/storage)。
			// localStorage['strangler:disabled:/storage'] === '1' 时返回 null,落到下面的老弹窗(可逆回退)。
			const target = resolveEntryTarget('/storage')
			if (target) {
				window.location.href = target
				return
			}
			this.$buefy.modal.open({
				parent: this,
				component: StorageManagerPanel,
				hasModalCard: true,
				customClass: 'storage-modal',
				trapFocus: true,
				canCancel: [],
				scroll: "keep",
				animation: "zoom-in",
			})
		},
```

- [ ] **Step 5: 跑测试确认通过 + 全量**

```bash
pnpm vitest run src/widgets/__tests__/Disks.spec.js src/components/filebrowser/components/__tests__/MountActionButton.spec.js
pnpm test 2>&1 | tail -20
```

预期:新用例全 PASS;全量绿(用例数 = Task 0 记下的数 + 本期新增)。

- [ ] **Step 6: 变异验证**

`Disks.vue` 里 `if (target) {` 临时改 `if (false) {` → Disks 第 1 条变红;改回。
`MountActionButton.vue` 同样操作 → 该文件第 1 条变红;改回。
把 `MountActionButton.vue` 的目标临时改成 `'/app/#/storages'` → 第 1 条变红(证明断言锁的是逐字 URL);改回。

- [ ] **Step 7: 提交**

```bash
git add src/widgets/Disks.vue src/widgets/__tests__/Disks.spec.js \
        src/components/filebrowser/components/MountActionButton.vue \
        src/components/filebrowser/components/__tests__/MountActionButton.spec.js
git commit -m "feat(storage): 桌面磁盘小组件与文件区挂载按钮改跳 /app/#/storage(SP6-P6)

两处 showDiskManagement 各加两行 cutover 判定,老弹窗原样留作安全网。
Disks 的 widget_storagemanager 埋点保留在跳转前;MountActionButton 原本无埋点,不加。"
```

---

### Task 4: New-UI 存储磁贴补回退 flag

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/composables/useOpenAction.ts`(14-32 行附近)
- Test: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/composables/useOpenAction.test.ts`

**Interfaces:**
- Consumes: 无(不依赖 Vue2 侧代码;共用的只是 localStorage 键名字符串)。
- Produces: 无(叶子改动)。

现状:`if (key === 'storage') { router.push('/storage'); return }`,P1 起就无条件硬跳,代码里已留注释「SP6-P6 cutover 时补齐」。回退时应落到既有的 `window.location.href = SYS_ROUTE[key] || '/#/legacy'`(`SYS_ROUTE` 无 `storage` 键 → `/#/legacy`),与 `appstore` 分支完全同型。

顺带 DRY:现有 `appsCutoverDisabled()` 与要加的存储版只差键名,合并成一个带参数的 `cutoverDisabled(from)`。这是本任务正在编辑的同一段代码,不算无关重构。

- [ ] **Step 1: 写失败测试**

在 `src/home/composables/useOpenAction.test.ts` 的 `describe('useOpenAction.openApp')` 块内、`appstore` 那两条之后追加:

```ts
  it('storage 磁贴应用内 router.push /storage(SP6-P6 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/storage')
  })
  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
```

并把 `beforeEach` 里的清理补上存储键(紧跟现有 `/apps` 那行):

```ts
  localStorage.removeItem('strangler:disabled:/storage')
```

**已核实**:`storage` 是 `src/home/apps/systemApps.ts:25` 的内置条目(`SYSTEM_APPS`),`apps.app('storage')` 天然返回 `system: true` 的记录,**用例不需要 `setApps`** —— 与现有 `appstore`/`settings` 两条用例同样的前提。

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm vitest run src/home/composables/useOpenAction.test.ts
```

预期:「回退 flag」那条 FAIL(现在无条件 push);另两条应已通过。

- [ ] **Step 3: 实现**

把 14-18 行的 `appsCutoverDisabled` 替换为带参版本:

```ts
// 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 /#/legacy 老桌面,可逆 cutover。
// /apps = SP5-P8;/storage = SP6-P6(Vue2 桌面那三个存储入口共用同一把键,
// 同源共享 localStorage,所以置一次即两侧同时回退)。
function cutoverDisabled(from: string): boolean {
  try { return localStorage.getItem(`strangler:disabled:${from}`) === '1' } catch { return false }
}
```

`openApp` 里两行改为:

```ts
      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
```

(删掉原 storage 分支上方那两行「尚无 strangler 回退 flag …… SP6-P6 cutover 时补齐」的注释 —— 债已还。)

- [ ] **Step 4: 跑测试确认通过 + 全量守门**

```bash
pnpm vitest run src/home/composables/useOpenAction.test.ts
pnpm test 2>&1 | tail -15
pnpm exec vue-tsc --noEmit
```

预期:三条新用例 PASS,`/apps` 的四条老用例仍绿;全量绿;tsc 零错。

- [ ] **Step 5: 变异验证**

把 `!cutoverDisabled('/storage')` 临时改成 `!cutoverDisabled('/storages')` → 「回退 flag」那条变红;改回。
把 `'/apps'` 临时也改成 `'/storage'` → 「两把 flag 互不干扰」那条变红;改回。

- [ ] **Step 6: 提交**

```bash
git add src/home/composables/useOpenAction.ts src/home/composables/useOpenAction.test.ts
git commit -m "feat(storage): 存储磁贴补回退 flag strangler:disabled:/storage(SP6-P6)

P1 起磁贴就硬跳 /storage、浏览器侧回滚不掉,本次补齐门控,回退落 /#/legacy。
顺带把 appsCutoverDisabled 合并成带参 cutoverDisabled(from),两处共用。"
```

---

### Task 5: i18n 收口扫描 + 全量守门 + 台账

无源码改动预期(扫描发现问题才改,改则单独小提交)。

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp6/progress-p6.md`(台账;`.superpowers/` 在 gitignore 里,只落磁盘、不进 git)
- 扫描范围:`src/storage/`(components / stores / util)+ `src/views/Storage*.vue`(五个视图)

**Interfaces:**
- Consumes: Task 1–4 的全部改动。
- Produces: 台账文件 + 扫描结论,供 Task 6 记账引用。

- [ ] **Step 1: 模板中文文本节点扫描(期望 0)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<template>/,/^<\/template>/' "$f" | sed 's/<!--.*-->//' \
    | grep "[一-龥]" | grep -vE "^\s*(<!--|[^<]*-->)"
done | grep -v "^\s*$" | tee /tmp/sp6p6-tpl-cn.txt | wc -l
```

预期 `0`。非 0 则逐行看 `/tmp/sp6p6-tpl-cn.txt`:真的是硬编码中文文案 → 补 i18n 键(zh_cn + en_us 都加)并单独提交;是注释残留 → 记进台账说明为何不算欠账。

- [ ] **Step 2: `<script>` / `.ts` 中文字面量扫描(逐条核验)**

```bash
grep -rn "[一-龥]" src/storage --include="*.ts" | grep -v "\.test\.ts" \
  | grep -vE "^[^:]+:[0-9]+:\s*//" | grep -E "['\"\`][^'\"\`]*[一-龥]" | tee /tmp/sp6p6-ts-cn.txt | wc -l

for f in $(ls src/storage/components/*.vue src/views/Storage*.vue); do
  awk '/<script/,/<\/script>/' "$f" | grep -n "[一-龥]" \
    | grep -vE ":\s*(//|\*|/\*)" | grep -E "['\"\`][^'\"\`]*[一-龥]" | sed "s|^|$f:|"
done | tee /tmp/sp6p6-vue-script-cn.txt | wc -l
```

两条命中都要**逐条核验**并把结论写进台账(SP4-P8 / SP5-P8 的结论都是「全是代码注释,欠账不存在」)。真有面向用户的硬编码中文 → 补键并单独提交。

- [ ] **Step 3: i18n parity + color-guard + 全量 + 构建**

```bash
pnpm vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts
pnpm test 2>&1 | tail -15
pnpm exec vue-tsc --noEmit
pnpm build 2>&1 | tail -15
```

预期:parity 与 color-guard 绿;全量绿;tsc 零错;build 成功。

- [ ] **Step 4: Vue2 仓全量守门**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm test 2>&1 | tail -20
git status --short -- src/
```

预期:全量绿;工作区 `src/` 干净(所有改动已提交)。

- [ ] **Step 5: 写台账**

`/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp6/progress-p6.md`,内容含:
- 四个 cutover 点与那一把 flag 的最终形态(照 spec §4 的行为矩阵抄一份)。
- Task 0 三个文件的处置结果 + 两个提交 hash。
- Task 1–4 的提交 hash(两仓分列)。
- **Step 1/2 三条扫描命令逐字 + 命中数 + 逐条核验结论。**
- 两仓全量测试用例数、tsc、color-guard、parity、build 结果。
- 变异验证记录:每个任务撤回了什么、哪条测试变红。
- 留白待 Task 6 填:部署产物入口 chunk、真机验收结果。

- [ ] **Step 6: 提交(仅 Vue2 仓若有 i18n 补键;New-UI 台账不进 git)**

若 Step 1/2 没有补键,本任务**无提交**。台账文件在 gitignore 内,不需要也不能 `git add`。报告扫描数字与台账路径。

---

### Task 6:部署 + 真机验收 + 记账(主会话执行,不派 subagent)

需 sudo、动真机、要用户逐屏点验,由主会话执行并与用户交互。

- [ ] **Step 1: 部署 New-UI(先)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && ./scripts/deploy.sh
```

(长期约定:一律走脚本,勿手写 rsync 到 `/var/lib`。)记下入口 chunk:

```bash
curl -s http://localhost/app/ | grep -o 'index-[^"]*\.js' | head -1
```

- [ ] **Step 2: 部署 Vue2(后)**

```bash
cd /home/nimo/NimoTech && ./nimo_os_docs/scripts/deploy-ui.sh
```

脚本内建 `--exclude app/`,不会覆盖 New-UI。部署后确认 `/var/lib/nimoos/www/app/` 仍在、mtime 是 Step 1 的时间。

- [ ] **Step 3: 真机验收(照 spec §8 逐条,由用户点验)**

A 组(flag 未置):磁贴 → `/storage`;`/#/legacy` 磁盘小组件 → 跳新页;`/#/legacy` 新盘通知卡「Storage Manager」→ 跳新页(不便插盘时控制台 `$EventBus.$emit('casaUI:openStorageManager')` 验同一 handler);置 `strangler:disabled:/files=1` 后文件区挂载下拉 → 跳新页,验完清除该键。
B 组(`strangler:disabled:/storage=1`):四条路径全部回老行为,老弹窗功能正常。
C 组:清 flag 复原;存储区五页各开一次确认部署产物无回归。

- [ ] **Step 4: 记账**

- `NimoOS-UI/docs/vue3-migration-roadmap.md`:§4 SP6 的 P6 条目四项打勾 + 写两仓坐标与 flag 键名;阶段表 SP6 状态 🔄 → ✅(P7 单独列出未做)。
- 台账 `progress-p6.md` 补上部署产物 chunk 与验收结果。
- 记忆 `vue3-migration-plan` 更新 SP6 状态(P6 关账、P7 待做、Vue2 工作区处置结果)。
- 新登记的债:`migratedEntries` 目前只有存储一条,SP7/SP8 的模态型入口在此续行。

---

## Self-Review

**Spec coverage:** spec §3 D1 → Task 1+3+4(单键四处共用);D2 → Task 1+2+3;D3 → Task 4;§4 行为矩阵 → Task 2/3/4 的测试断言;§5 测试 → 各任务 Step 1/5;§6 i18n → Task 5 Step 1-2;§7 工作区处置 → Task 0,守门 → Task 5 Step 3-4,部署 → Task 6 Step 1-2;§8 验收 → Task 6 Step 3;§9 记账 → Task 5 Step 5 + Task 6 Step 4。无缺口。

**Placeholder scan:** 无 TBD/TODO;每个代码步骤都有可直接落盘的代码;Task 5 的分支处置写明了「命中怎么办」的两种具体做法。Task 4 Step 1 留了一处条件性指示(store 里是否需 `setApps`)—— 这是对现有测试实际形状的适配,已给出判定方法,不是占位。

**Type consistency:** `resolveEntryTarget(from, storage)` 在 Task 1 定义、Task 2/3 以单参调用(第二参可选,一致);`migratedEntries` 元素形状 `{from,to,enabled}` 在 Task 1 的测试与实现里一致;`cutoverDisabled(from: string): boolean` 在 Task 4 内定义并两处调用,一致;flag 键 `strangler:disabled:/storage` 与 URL `/app/#/storage` 全篇逐字一致。

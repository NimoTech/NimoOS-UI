# SP17 设置区 + 桌面零散补迁 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `#93`(LAN Devices 设置标签)、`#103`+`#105`(Photos Cache 迁移入口 + 死条目清理)、`#125`(KVM 磁贴按服务可用性门控)补迁到 New-UI,并把 `#97`/`#119`/`#121`/`#128` 的「不适用/不做」结论带证据登记进 roadmap。

**Architecture:** 三块互不依赖的改动,顺序无强制约束但按 Task 序号做最省心。A 走「service 包加一个裸 JSON 方法 → 新面板 → 接进 tab 模型」;B 是在既有 `AppPathKey` 三元组上加第四个成员,派生逻辑全在 `appPaths.ts` / `migrateBrowse.ts` 两个纯函数文件里;C 给 `SYSTEM_APPS` 静态表加一个可选的 `requiresService` 声明,由 apps store 在 `loadGrid()` 时探活决定是否注入,桌面磁贴的清除复用既有 `sweepGone()` 宽限期通路,不新造机制。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript · Pinia · vue-i18n 9 · vitest + @vue/test-utils(jsdom)· 共享包 `@nimotech/nimoos-service`(源码在本仓 `packages/service/`)。

**spec:** `docs/superpowers/specs/2026-08-09-sp17-settings-catchup-design.md`

## Global Constraints

- **颜色只能来自 theme token**(`var(--…)`,定义在 `src/styles/theme.css`)。新 CSS 里出现 `#hex` / `rgb()` / 具名色即违规,`color-guard` 会红。
- **i18n 键必须同时加进 `src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`**(设置区的键都在 sp9 分片里)。`src/i18n/parity.test.ts` 断言两侧键完全一致,漏一个即红。
- **中文文案以 Vue2 `src/assets/lang/zh_CN.json` 为准,逐字照抄,不自译。** 本计划里给出的中文串已经从 Vue2 取好。
- **新写的代码注释、测试描述一律英文**(工作区 CLAUDE.md 硬要求 + 机主 2026-08-09 拍板)。改到的旧中文注释顺手译成英文,不做无关的全仓清扫。
- **提交信息英文**,祈使句主题行 + 说明「为什么」的正文。
- **界面严格 1:1 照 Vue2,逻辑照正确**:Vue2 的 bug / 竞态 / 吞错不照抄,改正确并在代码里注释登记(本计划已逐条指明是哪几处)。
- **不碰 `src/files/**` 与 `src/photos/**`**(SP12 / SP15 并行线在改)。
- 包管理器 **pnpm**;测试跑 `pnpm test`,类型检查 `pnpm exec vue-tsc --noEmit`。
- 改了 `packages/service/` 的源码后,dev server 要**重启**才生效(浏览器还需硬刷新);跑 vitest / vue-tsc 不受影响。

---

## File Structure

**Task 1(service 层)**
- 改 `packages/service/src/types.ts` —— 加 `LanDevice` / `LanDiscovery` 两个接口。
- 改 `packages/service/src/sys.ts` —— 加 `getLanDiscovery()`,与既有 `getGatewayComponents()`(同样是裸 JSON)并列。
- 改 `packages/service/src/sys.test.ts`。

**Task 2(LAN Devices 界面)**
- 改 `src/settings/util/tabs.ts` —— tab 模型加一项,rail 切片 7 → 8。
- 改 `src/settings/util/tabs.test.ts` —— 两处硬编码列表。
- 新 `src/settings/panels/LanDevicesPanel.vue` —— 面板本体(取数 + 渲染,无独立 util:逻辑只有一次取数和一个 IPv4 判据,抽文件是过早抽象)。
- 新 `src/settings/panels/LanDevicesPanel.test.ts`。
- 改 `src/settings/panels/index.ts` —— 注册面板。
- 改 `src/settings/panels/panels.test.ts` —— `toHaveLength(9)` → `10`。
- 改 `src/settings/styles/settings.css` —— 新增 `.set-lan-*` 类。
- 改 `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts` —— 11 个键。

**Task 3(Photos Cache)**
- 改 `src/settings/util/appPaths.ts` —— `AppPathKey` 加成员、`ORDER` 加第四项、改写过期的顶部注释。
- 改 `src/settings/util/migrateBrowse.ts` —— `browseDestPaths` 加分支;`filterBrowseFolders` 删死条目。
- 改 `src/settings/util/appPaths.test.ts` / `migrateBrowse.test.ts`。
- 改 `src/settings/panels/AppsPanel.vue` —— `ROW_LABEL_KEY` 加一项。
- 改 `src/settings/panels/panels.test.ts` —— `.set-app-row` `toHaveLength(3)` → `4`。
- 改 `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` —— 1 个键。

**Task 4(KVM 磁贴门控)**
- 改 `src/home/apps/systemApps.ts` —— `SystemApp` 加可选 `requiresService`。
- 改 `src/home/stores/apps.ts` —— 探活 + 过滤。
- 改 `src/home/apps/systemApps.test.ts` / `src/home/stores/apps.test.ts`。

**Task 5(登记)**
- 改 `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md`(**Vue2 仓,分支 `docs/vue3-migration-sp3`**,单独提交)。
- 新 `docs/superpowers/2026-08-09-sp17-outstanding.md`(本仓挂账文档)。

**Task 6** 只跑门,不改代码(除非门红)。

---

### Task 1: service 层 `getLanDiscovery`(裸 JSON,不能套 unwrap)

**Files:**
- Modify: `packages/service/src/types.ts`(接在 `GatewayDeviceInfo` 之后,约 267 行)
- Modify: `packages/service/src/sys.ts:110-121`(紧挨既有两个裸 JSON 方法)
- Test: `packages/service/src/sys.test.ts`(接在 `getDeviceInfo 读裸 JSON` 用例之后,约 250 行)

**Interfaces:**
- Consumes: 无(本任务是最底层)
- Produces:
  ```ts
  export interface LanDevice { ip: string; hostname: string; version: string; self: boolean }
  export interface LanDiscovery { devices: LanDevice[]; truncated: boolean }
  // service.sys.getLanDiscovery(): Promise<LanDiscovery>
  ```
  Task 2 只用这两个类型名与这个方法名。

- [ ] **Step 1: Write the failing tests**

在 `packages/service/src/sys.test.ts` 里,`getDeviceInfo 读裸 JSON` 那个 `it` 之后加(注意本文件既有用例的 `http({...})` helper 已在文件顶部定义,直接用):

```ts
  it('getLanDiscovery reads bare JSON -- it must not go through unwrap', async () => {
    // Real response captured on the device 2026-08-09: no success/message/data envelope.
    const s = createSys(http({ '/gateway/lan-discovery': {
      devices: [
        { ip: '192.168.1.49', hostname: 'NimoOS', version: 'dev', self: false },
        { ip: '192.168.1.143', hostname: 'NimoOS', version: '1.9.3-alpha1+28.g0dc16d6', self: true },
        { ip: '192.168.1.189', hostname: 'debian', version: '1.9.4-alpha1+430', self: false },
      ],
      truncated: false,
    } }))
    const res = await s.getLanDiscovery()
    expect(res.devices).toHaveLength(3)
    expect(res.devices[1].self).toBe(true)
    expect(res.devices[2].hostname).toBe('debian')
    expect(res.truncated).toBe(false)
  })

  it('getLanDiscovery keeps truncated true', async () => {
    const s = createSys(http({ '/gateway/lan-discovery': { devices: [], truncated: true } }))
    expect(await s.getLanDiscovery()).toEqual({ devices: [], truncated: true })
  })

  it('getLanDiscovery tolerates a body without devices/truncated', async () => {
    const s = createSys(http({ '/gateway/lan-discovery': {} }))
    expect(await s.getLanDiscovery()).toEqual({ devices: [], truncated: false })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/service/src/sys.test.ts -t getLanDiscovery`
Expected: FAIL —— `s.getLanDiscovery is not a function`

- [ ] **Step 3: Add the types**

`packages/service/src/types.ts`,接在 `export interface GatewayDeviceInfo …` 那一行之后:

```ts
// Gateway LAN discovery (GET /gateway/lan-discovery). Bare JSON, see sys.ts.
export interface LanDevice { ip: string; hostname: string; version: string; self: boolean }
export interface LanDiscovery { devices: LanDevice[]; truncated: boolean }
```

- [ ] **Step 4: Implement the method**

`packages/service/src/sys.ts` —— 先把 `LanDiscovery` 加进文件顶部那个 `import type { … } from './types.js'` 列表,然后紧接在 `getDeviceInfo` 之后插入:

```ts
    // Bare JSON as well -- {"devices":[…],"truncated":false}, no success/message/data
    // envelope (verified with curl on the device 2026-08-09). unwrap() would throw here
    // because it treats a missing `success: 200` as a failed request.
    async getLanDiscovery(): Promise<LanDiscovery> {
      const res = await http.get('/gateway/lan-discovery')
      const body = res.data as Partial<LanDiscovery> | null
      return { devices: body?.devices ?? [], truncated: body?.truncated ?? false }
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/service/src/sys.test.ts -t getLanDiscovery`
Expected: PASS(3 passed)

- [ ] **Step 6: Mutation check —— 证明测试确实钉住了「不能套 unwrap」**

临时把实现改成 `return unwrap<LanDiscovery>(res.data)`,重跑上面那条命令,**必须红**(报 `request failed (undefined)`)。确认后改回 Step 4 的实现,再跑一次确认绿。这一步不提交任何东西,只是验证测试不是空转。

- [ ] **Step 7: Commit**

```bash
git add packages/service/src/types.ts packages/service/src/sys.ts packages/service/src/sys.test.ts
git commit -m "feat(service): read the gateway LAN discovery endpoint

The endpoint answers with bare JSON, so it takes the same shape as
getGatewayComponents rather than the standard envelope; unwrap() would
reject it outright."
```

---

### Task 2: LAN Devices 设置标签(Vue2 #93)

**Files:**
- Modify: `src/settings/util/tabs.ts`
- Modify: `src/settings/util/tabs.test.ts`
- Create: `src/settings/panels/LanDevicesPanel.vue`
- Create: `src/settings/panels/LanDevicesPanel.test.ts`
- Modify: `src/settings/panels/index.ts`
- Modify: `src/settings/panels/panels.test.ts:26`
- Modify: `src/settings/styles/settings.css`(文件末尾追加)
- Modify: `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`

**Interfaces:**
- Consumes: Task 1 的 `service.sys.getLanDiscovery(): Promise<LanDiscovery>` 与 `LanDevice` 类型。
- Produces: 新 tab id `'lan-devices'`;`PANEL_BY_TAB['lan-devices']`;11 个 i18n 键(键名见 Step 1)。后续任务不依赖本任务。

- [ ] **Step 1: 加 i18n 键(先加,后面测试要用)**

`src/i18n/zh_cn.sp9.ts` —— 在 `settingsStatusNoData` 那一行之后、`// ── P3 terminal tab` 那行注释之前插入(中文串逐字取自 Vue2 `zh_CN.json`,`#93` 那 9 条):

```ts
  // ── SP17 lan-devices tab (Vue2 #93) ────────────────────────────────────
  settingsLanTitle: '局域网设备',
  settingsLanRescan: '重新扫描',
  settingsLanSubtitle: '在局域网内发现的 NimoOS 设备',
  settingsLanScanning: '正在扫描局域网…',
  settingsLanDeviceFallback: 'NimoOS 设备',
  settingsLanThisDevice: '当前设备',
  settingsLanUnknownVersion: '未知版本',
  settingsLanTruncated: '扫描范围被截断,可能有设备未显示。',
  settingsLanEmpty: '未发现其他 NimoOS 设备。请确认对方设备已开机且在同一网段。',
  settingsLanFailed: '扫描失败,请稍后重试。', // new in SP17: Vue2 shows the empty state on failure
```

同一位置,`src/i18n/en_us.sp9.ts`(英文串逐字取自 Vue2 `en_US.json`):

```ts
  settingsLanTitle: 'LAN Devices',
  settingsLanRescan: 'Rescan',
  settingsLanSubtitle: 'NimoOS devices discovered on your local network',
  settingsLanScanning: 'Scanning local network…',
  settingsLanDeviceFallback: 'NimoOS Device',
  settingsLanThisDevice: 'This device',
  settingsLanUnknownVersion: 'Unknown version',
  settingsLanTruncated: 'Scan range was truncated; some devices may be missing.',
  settingsLanEmpty: 'No other NimoOS devices found. Make sure they are powered on and on the same network.',
  settingsLanFailed: 'Scan failed. Please try again.',
```

还要给侧栏标签加一个键 —— 两份文件里,紧挨 `settingsTabSystemStatus` 那一行加:

```ts
  settingsTabLanDevices: '局域网设备',   // zh_cn.sp9.ts
  settingsTabLanDevices: 'LAN Devices',  // en_us.sp9.ts
```

- [ ] **Step 2: 写 tab 模型的失败测试**

改 `src/settings/util/tabs.test.ts` 的前两个用例(把断言改成含新 tab 的期望值,顺手把这两个用例的描述改成英文):

```ts
  it('has 10 tabs in Vue2 order (8 rail items + account + developer)', () => {
    expect(SETTINGS_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'folder-permissions',
      'account',
      'developer',
    ])
  })

  it('the rail holds 8 items -- account has its own entry, developer sits inside general', () => {
    expect(RAIL_TABS).toEqual([
      'general',
      'storage',
      'network',
      'apps',
      'terminal',
      'system-status',
      'lan-devices',
      'folder-permissions',
    ])
  })
```

同文件底部那条 `railTabsFor('user')` 的 `toHaveLength(6)` 改成 `toHaveLength(7)`。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/util/tabs.test.ts`
Expected: FAIL —— `SETTINGS_TABS` 少 `'lan-devices'`;rail 断言也红。

- [ ] **Step 4: 改 tab 模型**

`src/settings/util/tabs.ts`:
1. `SETTINGS_TABS` 里在 `'system-status'` 与 `'folder-permissions'` 之间插 `'lan-devices',`(位置照 Vue2 `SettingsPanel.vue` 的 `tabs` 数组)。
2. **`RAIL_TABS` 的切片 `slice(0, 7)` 改成 `slice(0, 8)`** —— 漏改则新 tab 进不了侧栏,而 `account` 会被挤进 rail。
3. `TAB_LABEL_KEY` 加 `'lan-devices': 'settingsTabLanDevices',`。
4. 顺手把 `RAIL_TABS` 上方那句「侧栏 rail 上可见的 7 项」注释改成英文并把 7 改成 8。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/util/tabs.test.ts`
Expected: PASS

- [ ] **Step 6: 写面板的失败测试**

新建 `src/settings/panels/LanDevicesPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import sp9 from '../../i18n/zh_cn.sp9'
import LanDevicesPanel from './LanDevicesPanel.vue'

const getLanDiscovery = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getLanDiscovery: () => getLanDiscovery() } },
}))

// Real response captured on the device 2026-08-09.
const FIXTURE = {
  devices: [
    { ip: '192.168.1.49', hostname: 'NimoOS', version: 'dev', self: false },
    { ip: '192.168.1.143', hostname: 'NimoOS', version: '1.9.3-alpha1+28.g0dc16d6', self: true },
    { ip: '192.168.1.189', hostname: '', version: '', self: false },
  ],
  truncated: false,
}

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...sp9 } } })
const mountPanel = () => mount(LanDevicesPanel, { global: { plugins: [i18n] } })

describe('LanDevicesPanel', () => {
  beforeEach(() => { getLanDiscovery.mockReset() })

  it('renders one row per device and falls back for empty hostname/version', async () => {
    getLanDiscovery.mockResolvedValue(FIXTURE)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-lan-row')
    expect(rows).toHaveLength(3)
    expect(rows[2].text()).toContain('NimoOS 设备')
    expect(rows[2].text()).toContain('未知版本')
  })

  it('marks the local device and refuses to open it', async () => {
    getLanDiscovery.mockResolvedValue(FIXTURE)
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-lan-row')
    expect(rows[1].text()).toContain('当前设备')
    await rows[1].trigger('click')
    expect(open).not.toHaveBeenCalled()
    await rows[0].trigger('click')
    expect(open).toHaveBeenCalledWith('http://192.168.1.49/', '_blank', 'noopener')
    open.mockRestore()
  })

  it('refuses to open anything that is not a plain IPv4 address', async () => {
    getLanDiscovery.mockResolvedValue({ devices: [
      { ip: 'evil.example.com', hostname: 'x', version: '1', self: false },
      { ip: '10.0.0.1/../x', hostname: 'y', version: '1', self: false },
    ], truncated: false })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountPanel()
    await flushPromises()
    for (const row of w.findAll('.set-lan-row')) await row.trigger('click')
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('warns when the scan range was truncated', async () => {
    getLanDiscovery.mockResolvedValue({ ...FIXTURE, truncated: true })
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-lan-warn').exists()).toBe(true)
  })

  it('shows the empty state when the network really has no other device', async () => {
    getLanDiscovery.mockResolvedValue({ devices: [], truncated: false })
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-lan-empty').exists()).toBe(true)
    expect(w.find('.set-lan-error').exists()).toBe(false)
  })

  it('shows an error line instead of the empty state when the request fails', async () => {
    // Vue2 swallows the failure and renders "no devices found", which tells the user
    // the network is empty when the request never came back.
    getLanDiscovery.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-lan-error').exists()).toBe(true)
    expect(w.find('.set-lan-empty').exists()).toBe(false)
  })

  it('drops a slow first scan when a second one has already been started', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    getLanDiscovery
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce({ devices: [
        { ip: '192.168.1.200', hostname: 'second', version: '2', self: false },
      ], truncated: false })
    const w = mountPanel()             // scan #1 -- still pending
    await w.find('.set-lan-refresh').trigger('click') // scan #2
    await flushPromises()
    resolveFirst(FIXTURE)              // #1 lands late, must be discarded
    await flushPromises()
    const rows = w.findAll('.set-lan-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('second')
  })
})
```

- [ ] **Step 7: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/panels/LanDevicesPanel.test.ts`
Expected: FAIL —— 组件文件不存在。

- [ ] **Step 8: 写面板组件**

新建 `src/settings/panels/LanDevicesPanel.vue`:

```vue
<script setup lang="ts">
// Settings - LAN devices. Ports Vue2 components/settings/LanDevices.vue (#93).
// Data source: GET /gateway/lan-discovery (bare JSON, see packages/service/src/sys.ts).
//
// Two deliberate departures from Vue2, both under the "copy the UI, fix the logic" rule:
//  1. Vue2's catch() clears the list, so a failed request renders "no other devices
//     found" -- it reports a broken request as an empty network. We keep an error
//     state and say the scan failed instead.
//  2. Vue2's scan() has no generation guard: clicking rescan while a scan is still in
//     flight lets the older response overwrite the newer one. Guarded here, in place,
//     the same way SystemStatusPanel.vue and AppPathDialog.vue do it.
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type LanDevice } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import '../styles/settings.css'

const { t } = useI18n()
const devices = ref<LanDevice[]>([])
const truncated = ref(false)
const loading = ref(false)
const failed = ref(false)

let scanSeq = 0

async function scan() {
  const seq = ++scanSeq
  loading.value = true
  failed.value = false
  try {
    const res = await service.sys.getLanDiscovery()
    if (seq !== scanSeq) return // superseded by a newer scan: drop this result
    devices.value = res.devices
    truncated.value = res.truncated
  } catch {
    if (seq !== scanSeq) return
    devices.value = []
    truncated.value = false
    failed.value = true
  } finally {
    if (seq === scanSeq) loading.value = false
  }
}

// Only plain IPv4 is allowed through: the value goes straight into a window URL, and a
// hostname or a path-bearing string would let the backend steer where we navigate.
function open(d: LanDevice) {
  if (d.self) return
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(d.ip)) return
  window.open(`http://${d.ip}/`, '_blank', 'noopener')
}

onMounted(scan)
</script>

<template>
  <SettingsSection :title="t('settingsLanTitle')">
    <div class="set-comp-head">
      <button
        class="set-btn set-lan-refresh" type="button"
        :title="t('settingsLanRescan')" @click="scan"
      >
        {{ t('settingsLanRescan') }}
      </button>
    </div>

    <p class="set-lan-sub">{{ t('settingsLanSubtitle') }}</p>

    <p v-if="loading" class="set-lan-empty">{{ t('settingsLanScanning') }}</p>

    <template v-else>
      <div
        v-for="d in devices" :key="d.ip"
        class="set-lan-row" :class="{ 'is-link': !d.self }"
        @click="open(d)"
      >
        <span class="set-lan-name">
          {{ d.hostname || t('settingsLanDeviceFallback') }}
          <span v-if="d.self" class="set-lan-tag">{{ t('settingsLanThisDevice') }}</span>
        </span>
        <span class="set-lan-ip">{{ d.ip }}</span>
        <span class="set-lan-ver">{{ d.version || t('settingsLanUnknownVersion') }}</span>
      </div>

      <p v-if="truncated" class="set-lan-warn">{{ t('settingsLanTruncated') }}</p>
      <p v-if="failed" class="set-lan-error">{{ t('settingsLanFailed') }}</p>
      <p v-else-if="!devices.length" class="set-lan-empty">{{ t('settingsLanEmpty') }}</p>
    </template>
  </SettingsSection>
</template>
```

- [ ] **Step 9: 加样式**

`src/settings/styles/settings.css` 末尾追加(颜色全部走 token,别写字面色):

```css
/* ── SP17 lan-devices tab ─────────────────────────────────────────────── */
.set-lan-sub { font-size: 12px; color: var(--fg-muted); margin: 0 0 8px; }
.set-lan-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.set-lan-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.set-lan-row.is-link { cursor: pointer; }
.set-lan-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.set-lan-tag {
  margin-left: 8px; padding: 1px 8px; border-radius: 999px;
  font-size: 11px; color: var(--fg-muted); border: 1px solid var(--border);
}
.set-lan-ip { font-size: 12px; color: var(--fg-muted); }
.set-lan-ver { font-size: 12px; color: var(--fg-muted); }
.set-lan-warn { font-size: 12px; color: var(--warn-fg); margin: 8px 0 0; }
.set-lan-error { font-size: 12px; color: var(--remove-fg); margin: 8px 0 0; }
.set-lan-empty { padding: 28px 16px; text-align: center; color: var(--fg-muted); font-size: 12px; }
```

用到的 token 都已确认存在(`theme.css:155` `--warn-fg`、`:149` `--remove-fg`、`--fg-muted` / `--border` 全区在用),两套主题块里都有值,无需新增 token。

- [ ] **Step 10: 注册面板并修计数断言**

`src/settings/panels/index.ts`:加 `import LanDevicesPanel from './LanDevicesPanel.vue'`,并在 `PANEL_BY_TAB` 里加 `'lan-devices': LanDevicesPanel,`(位置照 `SETTINGS_TABS` 顺序,放在 `'system-status'` 之后)。

`src/settings/panels/panels.test.ts:26`:`toHaveLength(9)` → `toHaveLength(10)`。

- [ ] **Step 11: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/panels/LanDevicesPanel.test.ts src/settings/panels/panels.test.ts src/settings/util/tabs.test.ts src/settings/settingsRoutes.test.ts src/i18n/parity.test.ts`
Expected: 全部 PASS。若 parity 红,说明两份 i18n 文件的键没对齐,回 Step 1 补。

- [ ] **Step 12: Commit**

```bash
git add src/settings src/i18n
git commit -m "feat(settings): add the LAN devices tab

Ports the Vue 2 tab that lists NimoOS devices found on the local network.
Two things do not carry over: a failed scan now says so instead of
rendering the empty state, and a rescan started while one is in flight no
longer lets the older response win."
```

---

### Task 3: Photos Cache 迁移入口(Vue2 #103)+ 死条目清理(#105)

**Files:**
- Modify: `src/settings/util/appPaths.ts:20-30`(类型、`ORDER`、顶部注释)
- Modify: `src/settings/util/migrateBrowse.ts:24-29`(`browseDestPaths`)与 `:50-58`(`filterBrowseFolders`)
- Modify: `src/settings/panels/AppsPanel.vue:25-29`(`ROW_LABEL_KEY`)
- Modify: `src/settings/panels/panels.test.ts:107`
- Test: `src/settings/util/appPaths.test.ts`、`src/settings/util/migrateBrowse.test.ts`
- Modify: `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`

**Interfaces:**
- Consumes: 无跨任务依赖。
- Produces: `AppPathKey` 从三元组变成 `'app_data' | 'images' | 'database' | 'photos_data'`。

- [ ] **Step 1: 加 i18n 键**

`src/i18n/zh_cn.sp9.ts` 在 `settingsAppsDatabase` 那行之后加 `settingsAppsPhotosData: '相册缓存',`;
`src/i18n/en_us.sp9.ts` 同位置加 `settingsAppsPhotosData: 'Photos Cache',`。(两串逐字取自 Vue2 `#103`。)

- [ ] **Step 2: 写失败测试**

`src/settings/util/appPaths.test.ts` 追加(fixture 是 2026-08-09 真机 `GET /v1/sys/paths` 的响应):

```ts
  it('derives a fourth row for the photos cache (Vue2 #103)', () => {
    const paths = {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      database: { path: '/DATA', size: 3557039799 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 58125438307 },
      photos_data: { path: '/DATA/.system_data/photos', size: 6281536962 },
    }
    const rows = buildAppPathRows(paths as never, [])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
    expect(rows[3].path).toBe('/DATA/.system_data/photos')
    expect(rows[3].size).toBe(6281536962)
  })
```

`src/settings/util/migrateBrowse.test.ts` 追加:

```ts
  it('points the photos cache at <target>/.system_data/photos (matches migrate.go)', () => {
    expect(browseDestPaths('photos_data', '/media/Backup')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
    expect(browseDestPaths('photos_data', '/media/Backup/')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
  })

  it('drops dot-prefixed folders before the blocked list is ever consulted (Vue2 #105)', () => {
    // #105 found the dot entries in the blocked list to be dead code: the dot filter
    // below already removed them. Same holds here, which is why photos_data adds no
    // `.system_data` entry to `blocked`.
    const items = [
      { name: '.system_data', path: '/DATA/.system_data', is_dir: true, is_symlink: false },
      { name: '.docker', path: '/DATA/.docker', is_dir: true, is_symlink: false },
      { name: 'Backup', path: '/DATA/Backup', is_dir: true, is_symlink: false },
    ]
    for (const type of ['app_data', 'images', 'database', 'photos_data'] as const) {
      expect(filterBrowseFolders(items as never, type, '').map((i) => i.name)).toEqual(['Backup'])
    }
  })
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts`
Expected: FAIL —— 类型不认 `'photos_data'`;`browseDestPaths('photos_data', …)` 落到 database 的四目录分支。

- [ ] **Step 4: 改 `appPaths.ts`**

1. `export type AppPathKey = 'app_data' | 'images' | 'database' | 'photos_data'`
2. `const ORDER: AppPathKey[] = ['app_data', 'images', 'database', 'photos_data']`
3. 顶部那段注释里这句已经过期,必须改写(它现在会把人引向错误结论):

   > 后端(2026-08-01 实测 GET /v1/sys/paths)返回 4 个 key —— app_data / images / database / photos_data,而 Vue2 只渲染前 3 个。界面 1:1 → 这里也只产出 3 行。

   换成英文的现状描述:

   ```ts
   // The backend returns four keys -- app_data / images / database / photos_data
   // (verified 2026-08-09). Vue 2 rendered only the first three until #103 added the
   // photos cache row; all four are rendered here.
   ```

- [ ] **Step 5: 改 `migrateBrowse.ts`**

`browseDestPaths` 里,在 `if (type === 'app_data')` 那一行之后加:

```ts
  if (type === 'photos_data') return [`${b}/.system_data/photos`]
```

`filterBrowseFolders` 里删掉这一行:

```ts
  if (type !== 'images') blocked.push('.docker', '.containerd')
```

并在 `const blocked: string[] = []` 上方补注释:

```ts
  // Dot-prefixed folders (.docker/.containerd/.system_data) need no entry here: the
  // filter below drops every item whose name starts with '.' before `blocked` is even
  // consulted, so such entries would be dead code (Vue 2 #105 reached the same result).
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts`
Expected: PASS

- [ ] **Step 7: 变异验证 —— 确认 dot 过滤那条用例不是空转**

临时把 `filterBrowseFolders` 里 `it.name.startsWith('.')` 这个条件删掉,重跑上面那条命令:**Step 2 里那条 `drops dot-prefixed folders…` 必须红**。确认后改回来再跑一次确认绿。不提交这次改动。

- [ ] **Step 8: 接面板第四行**

`src/settings/panels/AppsPanel.vue` 的 `ROW_LABEL_KEY` 加一项:

```ts
  photos_data: 'settingsAppsPhotosData',
```

`src/settings/panels/panels.test.ts:107` 的 `expect(w.findAll('.set-app-row')).toHaveLength(3)` 改成 `toHaveLength(4)`,并把同一个 `it` 描述里的「三行」改成「四行」(该描述是中文旧文,顺手整句改成英文)。

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/panels/panels.test.ts src/settings/panels/AppsPanel.test.ts src/i18n/parity.test.ts`
Expected: 全部 PASS。若 `AppsPanel.test.ts` 因为 fixture 只有三个 key 而红,把它的 `PATHS` fixture 补上 `photos_data: { path: '/DATA/.system_data/photos', size: 6281536962 }`(与真机一致)。

- [ ] **Step 10: Commit**

```bash
git add src/settings src/i18n
git commit -m "feat(settings): show the photos cache under app data locations

The backend has reported photos_data from /sys/paths all along; the row
and its migration target were the only missing half. The dot-prefixed
entries in the browse blocklist go with it -- the dot filter above them
already made them unreachable."
```

---

### Task 4: KVM 磁贴按服务可用性门控(Vue2 #125)

**Files:**
- Modify: `src/home/apps/systemApps.ts:13`(接口)与 `:31`(vm 条目)
- Modify: `src/home/stores/apps.ts:26-73`
- Test: `src/home/apps/systemApps.test.ts`、`src/home/stores/apps.test.ts`

**Interfaces:**
- Consumes: `service.kvm.getSettings()`(包里已有,`packages/service/src/kvm.ts:265`)。
- Produces: `SystemApp.requiresService?: 'kvm'`;apps store 多一个 `loadGrid()` 内部探活,对外签名不变(`Home.vue` 不用改)。

- [ ] **Step 1: 写失败测试**

`src/home/apps/systemApps.test.ts` 追加:

```ts
describe('SYSTEM_APPS -- optional services (SP17 #125)', () => {
  it('kvm is the only tile gated on a service being reachable', () => {
    const gated = SYSTEM_APPS.filter((a) => a.requiresService)
    expect(gated.map((a) => a.key)).toEqual(['vm'])
    expect(gated[0].requiresService).toBe('kvm')
  })
})
```

`src/home/stores/apps.test.ts` 追加一个新 describe(本文件现在没有 service mock,**mock 要加在文件顶部**,与既有用例共存 —— 既有用例只调 `setApps`,不打接口,不受影响):

```ts
// at the top of the file, next to the other imports
const getGrid = vi.fn()
const getKvmSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    apps: { getGrid: () => getGrid() },
    kvm: { getSettings: () => getKvmSettings() },
  },
}))
vi.mock('../../apps/util/linkApps', () => ({ listLinkApps: () => Promise.resolve([]) }))
```

```ts
describe('KVM tile gating (SP17 #125)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getGrid.mockReset(); getKvmSettings.mockReset()
    getGrid.mockResolvedValue([])
  })

  it('keeps the tile before the probe has answered -- the first frame must not flicker', () => {
    const s = useAppsStore()
    expect(s.app('vm')).toBeDefined() // store init calls setApps([]) with no probe result yet
  })

  it('keeps the tile when the KVM service answers', async () => {
    getKvmSettings.mockResolvedValue({ cpuCores: 6 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.app('vm')).toBeDefined()
    expect(s.order).toContain('vm')
  })

  it('drops the tile when the KVM service is unreachable, without failing the load', async () => {
    getKvmSettings.mockRejectedValue(new Error('ECONNREFUSED'))
    const s = useAppsStore()
    await expect(s.loadGrid()).resolves.toBeUndefined()
    expect(s.app('vm')).toBeUndefined()
    expect(s.order).not.toContain('vm')
    expect(s.app('files')).toBeDefined() // the other system tiles are untouched
  })

  it('brings the tile back once KVM answers again', async () => {
    getKvmSettings.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ cpuCores: 6 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.app('vm')).toBeUndefined()
    await s.loadGrid()
    expect(s.app('vm')).toBeDefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/stores/apps.test.ts`
Expected: FAIL —— `requiresService` 不存在(类型错 + 断言红);门控用例里 `vm` 恒存在。

- [ ] **Step 3: 给静态表加声明**

`src/home/apps/systemApps.ts`:

```ts
// `requiresService` marks a tile that only belongs on this machine when the named
// service is actually reachable -- KVM is optional and is not installed everywhere.
// The static entry deliberately carries no status: the apps store decides both
// visibility and status once the probe has answered (Vue 2 #125).
export interface SystemApp {
  key: string; name: string; label: string; cls: string; glyph: string; icon: string
  requiresService?: 'kvm'
}
```

`vm` 条目改成:

```ts
  { key: 'vm', name: 'KVM', label: 'appVm', cls: 'ic-vm', glyph: G.vm, icon: iconVm, requiresService: 'kvm' },
```

- [ ] **Step 4: 在 store 里探活并过滤**

`src/home/stores/apps.ts`:

1. 在 `const apps = ref…` 附近加状态:

```ts
  // null = not probed yet. Unknown must render as "available": the store calls
  // setApps([]) at init so the desktop has its system tiles before any request has
  // been made, and hiding the tile there would make it blink out and back in.
  const kvmAvailable = ref<boolean | null>(null)
```

2. `setApps` 里那段 `SYSTEM_APPS.forEach(...)` 改成先过滤:

```ts
    SYSTEM_APPS
      .filter((s) => s.requiresService !== 'kvm' || kvmAvailable.value !== false)
      .forEach((s) => {
        map[s.key] = { name: s.label, cls: s.cls, glyph: s.glyph, icon: s.icon, system: true, status: 'running' }
        ord.push(s.key)
      })
```

3. 加探活函数并接进 `loadGrid()`:

```ts
  /** Any failure -- not registered with the gateway, unreachable, timing out -- means
   *  "not available" here. It is not an error worth surfacing: a machine without KVM
   *  installed is the normal case (Vue 2 AppSection.checkKvmAvailability). */
  async function probeKvm(): Promise<boolean> {
    try {
      await service.kvm.getSettings()
      return true
    } catch {
      return false
    }
  }

  async function loadGrid() {
    const [list, links, kvmOk] = await Promise.all([
      service.apps.getGrid(),
      listLinkApps().catch(() => []),
      probeKvm(),
    ])
    kvmAvailable.value = kvmOk
    setApps(list || [], links)
  }
```

`Home.vue` 一行都不用改:它在 `loadGrid()` **成功之后**才调 `layout.sweepGone(Object.keys(apps.apps))`,`vm` 不在 map 里就自动进 45 秒缺席宽限期,与容器应用被卸载走同一条通路。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/stores/apps.test.ts`
Expected: 全部 PASS

- [ ] **Step 6: 钉住桌面磁贴确实会被清掉**

`src/home/stores/layout.test.ts` 的 `sweepGone / evict force` 那个 describe 里追加(该 describe 已 `vi.useFakeTimers()`):

```ts
  it('removes the KVM tile once the service has been missing for the grace period', () => {
    // The default layout already carries a `vm` tile, so loadInitial() is enough to
    // reproduce what a machine without KVM installed sees on first load.
    const s = useLayoutStore(); s.loadInitial()
    const live = ['files', 'storage', 'photos', 'ai', 'knowledge', 'settings', 'appstore']
    s.sweepGone(live) // first absence: only starts the clock
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
    vi.advanceTimersByTime(46_000)
    s.sweepGone(live) // absent past the grace period: removed
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
  })
```

形状照抄同 describe 里既有的两个用例(`s.loadInitial()` + `s.sweepGone([...])`,断言带 `i.kind === 'app'`),不用 `replaceAll`。

Run: `pnpm exec vitest run src/home/stores/layout.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/home
git commit -m "feat(home): hide the KVM tile when the service is not reachable

KVM is optional and is not installed on every machine, yet the tile was
injected unconditionally with a hardcoded running status. The probe runs
with the app grid load; an unknown result still renders the tile so the
first frame does not blink, and a confirmed absence lets the existing
sweep reclaim the tile after its grace period."
```

---

### Task 5: roadmap 开 SP17 节 + 「不适用」结论登记

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md`(**Vue2 仓**,当前分支 `docs/vue3-migration-sp3`)
- Create: `docs/superpowers/2026-08-09-sp17-outstanding.md`(本仓)

**Interfaces:**
- Consumes: Task 1-4 的实际结果(测试数、提交号)。
- Produces: 无代码接口。

- [ ] **Step 1: 在 roadmap 里开 SP17 节**

在 `### SP15 — 相册区补迁` 那一节之后、`## 5. 大外壳收口` 之前插入一节,内容必须包含:

1. 范围三件(`#93` / `#103`+`#105` / `#125`)与各自状态。
2. **带证据的「不做/不适用」结论**(下一期的人不必再探一遍):
   - `#97` Terminal Security:2026-08-09 实测 `GET /v1/sys/wsssh` → `404 {"message":"Not Found"}`,后端仍未提供;New-UI 早已删掉旧 wsssh 终端(`TerminalPanel.vue:5-9`),债务 D7/D25 继续挂。
   - `#121` 图标死链:New-UI `src/apps/util/importNormalize.ts:76` 早已处理。
   - `#121` Discord 链接:New-UI 无 `ContactBar` 对位组件。
   - `#119` 清死域名:改的是 Vue2 的 README / 多语言 locale,New-UI 只有 zh/en 两份且无对应键。
   - `awesome.casaos.io`:Vue2 `origin/main` 的 `AppStoreSourceManagement.vue:92` **同样还在**,不是缺口。
   - `#128` 默认应用图标:New-UI 无 `default.png/svg`,走 CSS `.store-icon-fallback`,换美术是新设计不是补迁。
3. 两条实测校正,写清楚「原判据错在哪」:
   - SP12 那份清单把 `#122` 归在「零散四条」里,它其实是 Files 区、归 SP12 的 worktree;`#136` 已由 SP14 做掉。**本期真正的零散只有 `#125` 一条。**
   - Knowledge/Notes(`#78`–`#104`)SP8 移植时已吸收主体,不在本期。
4. 分支 / worktree / 基线坐标。

- [ ] **Step 2: 提交 roadmap(Vue2 仓,单独提交)**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit -m "docs(roadmap): open SP17 for the settings-area catch-up

Records what the recomputed diff set actually leaves for this area, and
why #97/#119/#121/#128 are out of scope, with the probe results behind
each call so the next session does not repeat them."
cd -   # 回本 worktree
```

- [ ] **Step 3: 写本仓挂账文档**

新建 `docs/superpowers/2026-08-09-sp17-outstanding.md`,给「接下一期的人」看,含:本期做了什么(逐 Task 的提交范围)· 收尾门实测结果(数字照抄真实输出,不写约数)· **真机验收清单**(见下)· 未做的事与原因。

真机验收清单必须写成可照做的步骤:

1. 在本 worktree 起 dev server:`pnpm dev --host --port 5279`(5273/5277/5288 被并行线占着),浏览器开 `http://<设备IP>:5279/app/`。
2. 设置 → 侧栏应出现「局域网设备」,列表应有若干台设备;本机那行带「当前设备」标签且点不动。**开工当天实测局域网有 6 台(含本机),其中一台 hostname 是 `debian`。**
3. 点「重新扫描」,列表刷新、不报错。
4. 断网或把 devtools 网络设为 offline 后点重新扫描 → 应出现「扫描失败,请稍后重试。」**而不是**「未发现其他 NimoOS 设备」。
5. 设置 → 应用 → 「App 数据存储位置」应有第四行「相册缓存」,容量与路径非空(真机为 `/DATA/.system_data/photos`,约 5.8 GB)。
6. 点第四行的更改按钮 → 弹窗浏览步骤里,目标落点显示为 `<所选目录>/.system_data/photos`;**不要真的开始迁移**。
7. 桌面:本机 KVM 服务可用(`/v1/kvm/settings` 返 200),所以 KVM 磁贴应正常显示。要验「不可用」路径,在浏览器 devtools 里把 `/v1/kvm/settings` 请求拦成失败并刷新页面,45 秒后磁贴应消失;恢复拦截后刷新,磁贴可从「添加应用」面板加回。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/2026-08-09-sp17-outstanding.md
git commit -m "docs(sp17): record the outstanding acceptance steps"
```

---

### Task 6: 收尾门(五道)

**Files:** 不改代码,除非门红。

- [ ] **Step 1: 类型检查**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 0 错。

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 全绿。**把真实的「文件数 / 用例数」记下来写进挂账文档,不要写约数。**
已知既有 flake:`src/files/upload/persist.test.ts:55` 偶发红(SP4 期遗留,与本期无关),单跑该文件确认能绿即可,别去改它。

- [ ] **Step 3: i18n 键对齐**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 4: 开源导出**

Run: `node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/f58a5f4d-afa0-4fa2-950e-aa2dc8ebb7cb/scratchpad/sp17-oss --no-commit --allow-dirty-oss`
Expected: 零真实泄漏(二进制跳过属预期)。⚠️ 该守卫会把**注释里提到跨区文件的散文**也算命中 —— 若红,改写注释措辞,别加白名单。

- [ ] **Step 5: 构建**

Run: `pnpm build`
Expected: 成功(chunk 体量警告不算错)。

- [ ] **Step 6: 把五道门的真实输出补进挂账文档并提交**

```bash
git add docs/superpowers/2026-08-09-sp17-outstanding.md
git commit -m "docs(sp17): record the gate results"
```

---

## 完成后

**不做**的事(除非机主另有指示):不合并进 `master`、不推 origin、不跑 `scripts/deploy.sh`(会覆盖设备上 `/app/` 那一份,三条并行线共用一个部署目录)。验收一律起 dev server。

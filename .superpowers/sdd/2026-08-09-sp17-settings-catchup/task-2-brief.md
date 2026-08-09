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


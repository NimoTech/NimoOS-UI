## Task 4: 设备信息卡 + 设备信息弹窗

**Files:**
- Create: `src/assets/img/nimologo.svg`(从 Vue2 逐字复制,**不改任何一笔**)
- Create: `src/settings/util/deviceInfo.ts`
- Create: `src/settings/util/deviceInfo.test.ts`
- Create: `src/settings/components/DeviceInfoDialog.vue`
- Create: `src/settings/components/DeviceInfoDialog.test.ts`
- Create: `src/settings/panels/general/DeviceInfoCard.vue`
- Create: `src/settings/panels/general/DeviceInfoCard.test.ts`
- Modify: `src/settings/styles/settings.css`(加 `.set-logo` 的暗色可见性处理)

**Interfaces:**
- Consumes: `service.sys.hardwareInfo()`(Task 1 扩过字段)、`service.sys.getBaseInfo()`、`src/components/ui/Dialog.vue`(既有 reka 弹窗:`:open` / `@update:open` / `:title` / 默认插槽 / `#footer`)、Task 3 的 `.set-card` / `.set-btn`
- Produces:
  ```ts
  // src/settings/util/deviceInfo.ts —— 纯函数,DeviceInfoPanel.vue 的 computed 逐条对位
  export interface DeviceInfoView {
    platform: string; deviceId: string
    cpuModel: string; cpuCores: number; cpuFreq: string; cpuThreads: number
    ramDetail: string; ramFreq: string; ramType: string
    gpuList: string[]
  }
  export function toDeviceInfoView(hw: HardwareInfo | null, deviceId: string | null): DeviceInfoView
  export function osVersionLabel(hw: HardwareInfo | null): string   // "1.9.3-…" | "1.0.0"(Vue2 回退)
  ```
  ```
  <DeviceInfoDialog :open="boolean" @update:open="…" />   // 自己拉数据
  <DeviceInfoCard />                                       // 自己拉版本号,内含打开弹窗的按钮
  ```

- [ ] **Step 1: 复制 logo 资源(不修改)**

```bash
mkdir -p src/assets/img
cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/logo/nimologo.svg src/assets/img/nimologo.svg
grep -oE 'fill="[^"]*"' src/assets/img/nimologo.svg | sort | uniq -c
```
预期输出:`2 fill="#222222"`、`1 fill="none"`、`1 fill="white"`。

**这个文件一笔都不许改。** 它是品牌标识(CLAUDE.md 主题例外第 1 类:品牌识别色、皮肤无关)。但 `#222222` 在暗色主题下几乎不可见,所以**在 CSS 侧**处理可见性,而不是去改美术资源。追加到 `src/settings/styles/settings.css`:

```css
/* 品牌 logo 以 <img> 引入,资源内是近黑 + 白双色(CLAUDE.md 主题例外第 1 类:
 * 品牌识别、皮肤无关,不许改美术资源)。默认暗色主题下近黑不可见,
 * 所以在**样式侧**反相,不动 .svg 本身。
 * theme-exception: 品牌美术资源的可见性补偿,非配色语义,无 token 可用。 */
.set-logo {
  width: 96px;
  height: 96px;
  flex: 0 0 auto;
  filter: invert(1);
}
:root[data-theme='light'] .set-logo {
  filter: none;
}
```

- [ ] **Step 2: 写 `deviceInfo.ts` 的失败测试**

`src/settings/util/deviceInfo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { HardwareInfo } from '@nimotech/nimoos-service'
import { toDeviceInfoView, osVersionLabel } from './deviceInfo'

// curl 实证 2026-07-31 GET /v1/sys/hardware(本机真实值,注意 hardware_name 与 drive_model 都是空串)
const HW: HardwareInfo = {
  arch: 'amd64',
  cpu_cores: 6,
  cpu_freq: 4600,
  cpu_model: 'Intel(R) Core(TM) 5 320',
  drive_model: '',
  gpu_list: ['Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)'],
  hardware_id: 'nimoos-standard-v1',
  hardware_name: '',
  ram_speed: '8533 MT/s',
  ram_total: 16335863808,
  ram_type: 'LPDDR5',
  version: '1.9.3-alpha1+25.gc8d7d14-dirty',
}

describe('toDeviceInfoView(逐条对位 DeviceInfoPanel.vue 的 computed)', () => {
  it('platform:hardware_name 优先,空串回退 hardware_id', () => {
    expect(toDeviceInfoView(HW, 'dc1').platform).toBe('nimoos-standard-v1')
    expect(toDeviceInfoView({ ...HW, hardware_name: 'ZimaCube Pro' }, 'dc1').platform).toBe('ZimaCube Pro')
  })

  it('两者都空时给 ---', () => {
    expect(toDeviceInfoView({ ...HW, hardware_name: '', hardware_id: '' }, 'dc1').platform).toBe('---')
  })

  it('deviceId 缺失给 ---', () => {
    expect(toDeviceInfoView(HW, null).deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '').deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '2389ab5a').deviceId).toBe('2389ab5a')
  })

  it('cpuFreq:>=1000MHz 换算成 ~x.x GHz', () => {
    expect(toDeviceInfoView(HW, 'd').cpuFreq).toBe('~4.6 GHz')
  })

  it('cpuFreq:<1000MHz 保留 MHz', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 800 }, 'd').cpuFreq).toBe('800 MHz')
  })

  it('cpuFreq:0 或缺失给 ---', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 0 }, 'd').cpuFreq).toBe('---')
    expect(toDeviceInfoView({ ...HW, cpu_freq: undefined }, 'd').cpuFreq).toBe('---')
  })

  it('cpuThreads = 核数 × 2(Vue2 就是这么算的,不是真的读超线程)', () => {
    expect(toDeviceInfoView(HW, 'd').cpuThreads).toBe(12)
    expect(toDeviceInfoView({ ...HW, cpu_cores: undefined }, 'd').cpuThreads).toBe(0)
  })

  // 纯函数如实返回空串,「检测中」占位文案由模板用 i18n 补
  // (占位渲染由 DeviceInfoDialog.test.ts 覆盖,不在这里断言)
  it('cpuModel 缺失时如实返回空串,不自己塞占位文案', () => {
    expect(toDeviceInfoView({ ...HW, cpu_model: '' }, 'd').cpuModel).toBe('')
    expect(toDeviceInfoView({ ...HW, cpu_model: undefined }, 'd').cpuModel).toBe('')
  })

  it('ramDetail 按 GiB 取整', () => {
    expect(toDeviceInfoView(HW, 'd').ramDetail).toBe('RAM 15 GB total')
  })

  it('ramDetail 在 ram_total 缺失时给 0 GB(不产出 NaN)', () => {
    expect(toDeviceInfoView({ ...HW, ram_total: undefined }, 'd').ramDetail).toBe('RAM 0 GB total')
  })

  it('ramFreq / ramType 缺失给 ---', () => {
    const v = toDeviceInfoView({ ...HW, ram_speed: '', ram_type: undefined }, 'd')
    expect(v.ramFreq).toBe('---')
    expect(v.ramType).toBe('---')
  })

  it('gpuList 缺失给空数组', () => {
    expect(toDeviceInfoView({ ...HW, gpu_list: undefined }, 'd').gpuList).toEqual([])
    expect(toDeviceInfoView(HW, 'd').gpuList).toHaveLength(1)
  })

  it('hw 为 null(还没加载出来)时全字段都有安全占位,不抛', () => {
    const v = toDeviceInfoView(null, null)
    expect(v.platform).toBe('---')
    expect(v.cpuCores).toBe(0)
    expect(v.gpuList).toEqual([])
  })
})

describe('osVersionLabel', () => {
  it('用 hardware.version', () => {
    expect(osVersionLabel(HW)).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('缺失时回退 1.0.0(Vue2 SettingsPanel.vue:90 的写法)', () => {
    expect(osVersionLabel({ ...HW, version: '' })).toBe('1.0.0')
    expect(osVersionLabel(null)).toBe('1.0.0')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm test src/settings/util/deviceInfo.test.ts 2>&1 | tail -10
```

- [ ] **Step 4: 实现 `src/settings/util/deviceInfo.ts`**

```ts
import type { HardwareInfo } from '@nimotech/nimoos-service'

/**
 * 对位 Vue2 DeviceInfoPanel.vue 的 computed 块(L~100-140)。
 * 抽成纯函数是为了能单测这些换算 —— Vue2 那边混在组件里没法测。
 */
export interface DeviceInfoView {
  platform: string
  deviceId: string
  cpuModel: string
  cpuCores: number
  cpuFreq: string
  cpuThreads: number
  ramDetail: string
  ramFreq: string
  ramType: string
  gpuList: string[]
}

const DASH = '---'
const s = (v: unknown): string => (typeof v === 'string' ? v : '')
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function toDeviceInfoView(hw: HardwareInfo | null, deviceId: string | null): DeviceInfoView {
  const cores = n(hw?.cpu_cores)
  const mhz = n(hw?.cpu_freq)
  const ram = n(hw?.ram_total)
  return {
    // hardware_name 在本机实测是空串 → 必须回退 hardware_id
    platform: s(hw?.hardware_name) || s(hw?.hardware_id) || DASH,
    deviceId: s(deviceId) || DASH,
    // 空串照实返回,由模板决定显示「检测中」占位
    cpuModel: s(hw?.cpu_model),
    cpuCores: cores,
    cpuFreq: mhz === 0 ? DASH : mhz >= 1000 ? `~${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`,
    // Vue2 就是 cores*2 —— 不是真读超线程数,1:1 照留
    cpuThreads: cores * 2,
    ramDetail: `RAM ${(ram / (1024 * 1024 * 1024)).toFixed(0)} GB total`,
    ramFreq: s(hw?.ram_speed) || DASH,
    ramType: s(hw?.ram_type) || DASH,
    gpuList: Array.isArray(hw?.gpu_list) ? (hw.gpu_list as string[]) : [],
  }
}

/** Vue2 SettingsPanel.vue:90 / :254 —— `v{hardwareInfo.version || '1.0.0'}` */
export function osVersionLabel(hw: HardwareInfo | null): string {
  return s(hw?.version) || '1.0.0'
}
```

- [ ] **Step 5: 写 `DeviceInfoDialog` 与 `DeviceInfoCard` 的失败测试**

`src/settings/components/DeviceInfoDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const hw = {
  arch: 'amd64', cpu_cores: 6, cpu_freq: 4600, cpu_model: 'Intel(R) Core(TM) 5 320',
  gpu_list: ['Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)'],
  hardware_id: 'nimoos-standard-v1', hardware_name: '',
  ram_speed: '8533 MT/s', ram_total: 16335863808, ram_type: 'LPDDR5',
  version: '1.9.3-alpha1+25.gc8d7d14-dirty',
}
const calls = { hardware: 0, base: 0 }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      hardwareInfo: async () => { calls.hardware++; return hw },
      getBaseInfo: async () => { calls.base++; return { device_id: '2389ab5a67ce8f1d541d5c5048afd5cd', model: '', version: hw.version } },
    },
  },
}))

import DeviceInfoDialog from './DeviceInfoDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = (open = true) => mount(DeviceInfoDialog, { props: { open }, global: { plugins: [i18n] } })

beforeEach(() => { calls.hardware = 0; calls.base = 0 })

describe('DeviceInfoDialog', () => {
  it('打开时拉硬件与基础信息,渲染 5 行', async () => {
    const w = mountIt()
    await flushPromises()
    expect(calls.hardware).toBe(1)
    expect(calls.base).toBe(1)
    const labels = w.findAll('.dev-label').map((e) => e.text())
    expect(labels).toEqual(['Platform', 'DC', 'CPU', 'RAM', 'GPU'])
  })

  it('platform 用 hardware_id 回退(本机 hardware_name 是空串)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('nimoos-standard-v1')
  })

  it('CPU 行渲染型号 + 核数/频率/线程', async () => {
    const w = mountIt()
    await flushPromises()
    const cpu = w.findAll('.dev-row')[2].text()
    expect(cpu).toContain('Intel(R) Core(TM) 5 320')
    expect(cpu).toContain('6')
    expect(cpu).toContain('~4.6 GHz')
    expect(cpu).toContain('12')
  })

  it('GPU 列表逐条渲染', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.findAll('.dev-gpu')).toHaveLength(1)
  })

  it('open=false 时不发请求(别在设置页一进来就打硬件接口)', async () => {
    mountIt(false)
    await flushPromises()
    expect(calls.hardware).toBe(0)
  })

  it('cpu_model 为空时渲染「检测中」占位(纯函数返回空串,占位是模板的活)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockResolvedValueOnce({ ...hw, cpu_model: '' })
    const w = mountIt()
    await flushPromises()
    expect(w.findAll('.dev-row')[2].text()).toContain('检测中')
  })

  it('接口失败不抛,渲染占位 ---', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(svc.service.sys, 'getBaseInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('---')
  })
})
```

`src/settings/panels/general/DeviceInfoCard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', version: '1.9.3-alpha1+25.gc8d7d14-dirty' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.9.3' }),
    },
  },
}))

import DeviceInfoCard from './DeviceInfoCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

describe('DeviceInfoCard', () => {
  it('渲染 NimoOS 标题、版本号与 logo', async () => {
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.dic-title').text()).toBe('NimoOS')
    expect(w.find('.dic-version').text()).toBe('NimoOS v1.9.3-alpha1+25.gc8d7d14-dirty')
    expect(w.find('img.set-logo').exists()).toBe(true)
  })

  it('版本拉不到时回退 v1.0.0(对位 Vue2:90)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.dic-version').text()).toBe('NimoOS v1.0.0')
  })

  it('点「设备信息」按钮打开弹窗', async () => {
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.findComponent({ name: 'DeviceInfoDialog' }).props('open')).toBe(false)
    await w.find('.dic-btn').trigger('click')
    expect(w.findComponent({ name: 'DeviceInfoDialog' }).props('open')).toBe(true)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

```bash
pnpm test src/settings/components/DeviceInfoDialog.test.ts src/settings/panels/general/DeviceInfoCard.test.ts 2>&1 | tail -12
```

- [ ] **Step 7: 实现 `DeviceInfoDialog.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 DeviceInfoPanel.vue(191 行)。5 行:Platform / DC / CPU / RAM / GPU。
// 容器从 Buefy 模态换成 New-UI 既有的 ui/Dialog.vue(reka),内容 1:1(授权偏离 #2 的同类容器替换)。
// 只在 open 变 true 时拉数据 —— 设置页一进来就打硬件接口没有必要。
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { toDeviceInfoView } from '../util/deviceInfo'
import '../styles/settings.css'

defineOptions({ name: 'DeviceInfoDialog' })
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const hw = ref<HardwareInfo | null>(null)
const deviceId = ref<string | null>(null)
const view = ref(toDeviceInfoView(null, null))

async function load() {
  // 两个接口各自成败:硬件挂了不该连 DC 一起不显示(Vue2 是两个来源,这里保持独立)
  await Promise.allSettled([
    service.sys.hardwareInfo().then((r) => { hw.value = r }),
    service.sys.getBaseInfo().then((r) => { deviceId.value = r.device_id }),
  ])
  view.value = toDeviceInfoView(hw.value, deviceId.value)
}

watch(() => props.open, (o) => { if (o) void load() }, { immediate: true })
</script>

<template>
  <Dialog :open="open" :title="t('settingsDeviceInfoTitle')" @update:open="emit('update:open', $event)">
    <div class="dev-rows">
      <div class="dev-row">
        <span class="dev-label">Platform</span>
        <span class="dev-value one-line">{{ view.platform }}</span>
      </div>
      <div class="dev-row">
        <span class="dev-label">DC</span>
        <span class="dev-value one-line">{{ view.deviceId }}</span>
      </div>
      <div class="dev-row">
        <span class="dev-label">CPU</span>
        <span class="dev-value">
          <span class="dev-strong">{{ view.cpuModel || t('settingsDeviceDetecting') }}</span>
          <span class="dev-sub">{{ view.cpuCores }} Cores | {{ view.cpuFreq }} | {{ view.cpuThreads }} Threads</span>
        </span>
      </div>
      <div class="dev-row">
        <span class="dev-label">RAM</span>
        <span class="dev-value">
          <span class="dev-strong">{{ view.ramDetail }}</span>
          <span class="dev-sub">{{ view.ramFreq }} | {{ view.ramType }}</span>
        </span>
      </div>
      <div class="dev-row">
        <span class="dev-label">GPU</span>
        <span class="dev-value">
          <span v-for="(g, i) in view.gpuList" :key="i" class="dev-gpu dev-strong">{{ g }}</span>
          <span v-if="view.gpuList.length === 0" class="dev-sub">{{ t('settingsDeviceNoGpu') }}</span>
        </span>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.dev-rows { display: flex; flex-direction: column; gap: 12px; min-width: min(520px, 80vw); }
.dev-row {
  display: flex; align-items: flex-start; gap: 20px;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--card-bg);
}
.dev-label {
  flex: 0 0 56px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--fg-muted); padding-top: 2px;
}
.dev-value { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; min-width: 0; font-size: 14px; }
.dev-strong { font-weight: 500; }
.dev-sub { font-size: 12px; color: var(--fg-muted); }
.one-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
```

- [ ] **Step 8: 实现 `DeviceInfoCard.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L76-96 的设备信息卡:
// 左「NimoOS」标题 + 「设备信息」按钮 + 「NimoOS v<版本>」,右 logo。
// spec §5.1 提到的 Premium 推广条(Vue2 L67-73)本期不做 —— 用户 2026-07-31 拍板,授权偏离 #6。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import DeviceInfoDialog from '../../components/DeviceInfoDialog.vue'
import { osVersionLabel } from '../../util/deviceInfo'
import logo from '../../../assets/img/nimologo.svg'
import '../../styles/settings.css'

const { t } = useI18n()
const hw = ref<HardwareInfo | null>(null)
const dialogOpen = ref(false)

onMounted(async () => {
  // 失败静默:版本号回退 1.0.0(与 Vue2 一致),不让整张卡消失
  try { hw.value = await service.sys.hardwareInfo() } catch (e) { console.warn('[settings] hardwareInfo failed', e) }
})
</script>

<template>
  <section class="set-card dic">
    <div class="dic-text">
      <h2 class="dic-title">NimoOS</h2>
      <button class="set-btn dic-btn" type="button" @click="dialogOpen = true">
        {{ t('settingsDeviceInfoBtn') }}
      </button>
      <p class="dic-version">NimoOS v{{ osVersionLabel(hw) }}</p>
    </div>
    <img class="set-logo" :src="logo" alt="" aria-hidden="true" />
    <DeviceInfoDialog v-model:open="dialogOpen" />
  </section>
</template>

<style scoped>
.dic { display: flex; align-items: center; gap: 16px; }
.dic-text { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; flex: 1 1 auto; min-width: 0; }
.dic-title { margin: 0; font-size: 22px; font-weight: 700; }
.dic-btn { align-self: flex-start; }
.dic-version { margin: 0; font-size: 12px; color: var(--fg-muted); }
</style>
```

> **`import logo from '…svg'` 的类型**:Vite 默认给 `.svg` 提供 `?url` 形态的字符串导出,类型来自 `vite/client`。若 `vue-tsc` 报找不到模块声明,检查 `tsconfig.json` 的 `types` 里是否含 `vite/client`;**不要**为此改 `tsconfig` 的 `types` 数组(P0 台账「发现一」记过:往 `types` 里塞东西会改变整个 `src` 的类型推断),改用文件级 `/// <reference types="vite/client" />`。

- [ ] **Step 9: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short   # 确认 3 行 design-export 的 D 还在原位
git add src/assets/img/nimologo.svg src/settings/util/deviceInfo.ts src/settings/util/deviceInfo.test.ts \
        src/settings/components/DeviceInfoDialog.vue src/settings/components/DeviceInfoDialog.test.ts \
        src/settings/panels/general/DeviceInfoCard.vue src/settings/panels/general/DeviceInfoCard.test.ts
git commit src/assets/img/nimologo.svg src/settings/util/deviceInfo.ts src/settings/util/deviceInfo.test.ts \
           src/settings/components/DeviceInfoDialog.vue src/settings/components/DeviceInfoDialog.test.ts \
           src/settings/panels/general/DeviceInfoCard.vue src/settings/panels/general/DeviceInfoCard.test.ts \
           src/settings/styles/settings.css \
  -m "feat(settings): 设备信息卡 + 设备信息弹窗(SP9-P1)

- DeviceInfoPanel.vue 的 computed 全部抽成纯函数 deviceInfo.ts 并单测
  (hardware_name 本机是空串,必须回退 hardware_id;cpuThreads=核数×2 是 Vue2 原样)
- 弹窗只在 open 变 true 时拉数据;两个接口 allSettled 各自成败
- logo 资源逐字复制不改,暗色可见性在 CSS 侧 invert 补偿"
```

---


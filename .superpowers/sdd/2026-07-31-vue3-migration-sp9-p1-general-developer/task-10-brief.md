## Task 10: GeneralPanel 装配

**Files:**
- Modify: `src/settings/panels/GeneralPanel.vue`
- Modify: `src/settings/panels/panels.test.ts`
- Create: `src/settings/panels/general/GeneralPanel.integration.test.ts`

**Interfaces:**
- Consumes: Task 4-9 的全部行组件;P0 的 `SettingsSection`(`:title` + 默认插槽)与既有的 `open-tab` 事件通道
- Produces: 无新接口 —— 本任务只定**顺序**与整页装配

**行顺序(逐条对位 Vue2 SettingsPanel.vue,不许改序):**

| # | 行 | Vue2 行号 | 备注 |
|---|---|---|---|
| — | ~~Premium 推广条~~ | L67-73 | **不做**,授权偏离 #6 |
| 1 | 设备信息卡 | L76-96 | `DeviceInfoCard` |
| 2 | 壁纸 | L102-116 | 按钮禁用(D5) |
| 3 | 语言 | L119-135 | 只 2 项(D6) |
| 4 | 时区 | L138-154 | |
| 5 | 硬盘待机 | L157-173 | |
| 6 | WebUI 端口 | L176-208 | |
| 7 | 自动挂载 USB | L211-217 | |
| 8 | 显示推荐应用 | L220-226 | `SwitchRow recommend_switch` |
| 9 | 新闻流 | L229-236 | `SwitchRow rss_switch`,开启需确认 |
| — | ~~显示其他 Docker 容器应用~~ | L239-245 | **不做**,恒不渲染(D15) |
| 10 | 固件更新 | L249-278 | `UpdateRow kind="os"`,副标题传 hardware.version |
| 11 | 系统更新 | L281-312 | `UpdateRow kind="app"` |
| 12 | 开发者模式 | L315-321 | P0 已有的入口行,保留 |

- [ ] **Step 1: 写装配的失败测试**

`src/settings/panels/general/GeneralPanel.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', drive_model: '', version: '1.9.3-alpha1+25.gc8d7d14-dirty' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.9.3' }),
      getServerPort: async () => '80',
      getUsbStatus: async () => false,
      getOsVersion: async () => ({ current_version: '1.0.0', need_update: false }),
      getAppVersion: async () => ({ current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false }),
      setDiskStandby: async () => {},
      editServerPort: async () => {},
      toggleUsbAutoMount: async () => {},
      power: async () => {},
      updateOs: async () => {}, updateApp: async () => {}, cancelDownload: async () => {},
    },
    file: { getContent: async () => ({ content: '' }) },
  },
}))
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => () => {} }),
}))

import GeneralPanel from '../GeneralPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(GeneralPanel, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
})

describe('GeneralPanel 装配', () => {
  it('标题是「通用」', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').text()).toBe('通用')
  })

  it('P0 的空态占位已经拆掉', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('设备信息卡在列表之前', async () => {
    const w = mountIt(); await flushPromises()
    const html = w.html()
    expect(html.indexOf('set-card')).toBeGreaterThan(-1)
    expect(html.indexOf('set-card')).toBeLessThan(html.indexOf('set-list'))
  })

  it('11 行 + 开发者入口,顺序逐条对位 Vue2', async () => {
    const w = mountIt(); await flushPromises()
    const labels = w.findAll('.set-list .set-row-label').map((e) => e.text())
    expect(labels).toEqual([
      '壁纸', '语言', '时区', '硬盘待机', 'WebUI 端口',
      '自动挂载USB磁盘', '显示推荐应用', '新闻流',
      '固件更新', '系统更新',
    ])
  })

  it('开发者入口行仍在最后并能 emit open-tab', async () => {
    const w = mountIt(); await flushPromises()
    const row = w.find('.set-dev-entry')
    expect(row.exists()).toBe(true)
    await row.trigger('click')
    expect(w.emitted('open-tab')).toEqual([['developer']])
  })

  it('「显示其他 Docker 容器应用」行不存在(债务 D15)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toContain('Docker')
  })

  it('Premium 推广条不存在(授权偏离 #6)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toMatch(/Premium|Upgrade Now/)
  })

  it('固件更新行的副标题用 hardware.version(不是 os_version 的 current_version)', async () => {
    const w = mountIt(); await flushPromises()
    const subs = w.findAll('.set-list .set-row-sub').map((e) => e.text())
    // 固件行副标题 = hardware.version;系统行副标题 = /sys/version 的 current_version
    expect(subs[0]).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })

  it('整页渲染不产出裸 i18n key', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toMatch(/settings[A-Z]\w+/)
  })

  it('所有行的接口都失败时页面仍完整渲染(不白屏)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    for (const m of ['hardwareInfo', 'getBaseInfo', 'getServerPort', 'getUsbStatus', 'getOsVersion', 'getAppVersion'] as const) {
      vi.spyOn(svc.service.sys, m).mockRejectedValue(new Error('boom'))
    }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValue(new Error('boom'))
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-list .set-row-label')).toHaveLength(10)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/panels/general/GeneralPanel.integration.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `GeneralPanel.vue`**

```vue
<script setup lang="ts">
// general 页装配。行顺序逐条对位 Vue2 SettingsPanel.vue L65-324,不许改序。
// 两处**有意不做**(见计划 §实测校正):
//   - 顶部 Premium 推广条(L67-73):用户 2026-07-31 拍板不做,授权偏离 #6
//     (Vue2 侧那个 Upgrade Now 按钮本来也没有任何 @click)
//   - 「显示其他 Docker 容器应用」开关行(L239-245):Vue2 恒不渲染,债务 D15
// 「开发者模式」入口行沿用 P0 已有的实现(Vue2 L315,常驻可见、无开关门控)。
//
// 说明:本页会打 3 次 /sys/hardware(此处 + DeviceInfoCard + UsbAutoMountRow)。
// Vue2 也是多处各拉一次(SettingsPanel.getHardwareInfo + DeviceInfoPanel.fetchHardwareInfo),
// 且这是本机的廉价读接口 —— 不为此引入缓存层(YAGNI)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import DeviceInfoCard from './general/DeviceInfoCard.vue'
import WallpaperRow from './general/WallpaperRow.vue'
import LanguageRow from './general/LanguageRow.vue'
import TimezoneRow from './general/TimezoneRow.vue'
import DiskStandbyRow from './general/DiskStandbyRow.vue'
import WebUiPortRow from './general/WebUiPortRow.vue'
import UsbAutoMountRow from './general/UsbAutoMountRow.vue'
import SwitchRow from './general/SwitchRow.vue'
import UpdateRow from './general/UpdateRow.vue'
import '../styles/settings.css'

const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

// 固件更新行的副标题用 hardware.version(Vue2 L254),不是 os_version 的 current_version
const hwVersion = ref('')
onMounted(async () => {
  try {
    const hw: HardwareInfo = await service.sys.hardwareInfo()
    if (typeof hw.version === 'string') hwVersion.value = hw.version
  } catch (e) {
    console.warn('[settings] hardwareInfo failed', e)
  }
})
</script>

<template>
  <SettingsSection :title="t('settingsTabGeneral')">
    <DeviceInfoCard />

    <div class="set-list">
      <WallpaperRow />
      <LanguageRow />
      <TimezoneRow />
      <DiskStandbyRow />
      <WebUiPortRow />
      <UsbAutoMountRow />
      <SwitchRow field="recommend_switch" label-key="settingsRecommendApps" />
      <SwitchRow
        field="rss_switch"
        label-key="settingsNewsFeed"
        confirm-title-key="settingsNewsFeedTitle"
        confirm-msg-key="settingsNewsFeedConfirm"
        confirm-ok-key="settingsAccept"
      />
      <UpdateRow kind="os" :sub="hwVersion" />
      <UpdateRow kind="app" />
    </div>

    <button class="set-dev-entry" type="button" @click="emit('open-tab', 'developer')">
      <span>{{ t('settingsTabDeveloper') }}</span>
      <span class="set-dev-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>

<style scoped>
/* 开发者入口行样式沿用 P0 原样,不改 */
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

- [ ] **Step 4: 修 P0 的 `panels.test.ts`**

P0 那两条断言现在会红,因为 general 不再有 `.set-skeleton`:

1. `it.each(SETTINGS_TABS.filter((t) => t !== 'terminal'))('%s 骨架渲染标题与空态位')` —— 把 `general` 也排除,并在注释里写明「P1 起 general 已填内容」:
```ts
  // P1 起 general 已填真实内容,developer 见下方单独用例;这里只剩仍是骨架的 tab
  it.each(SETTINGS_TABS.filter((t) => t !== 'terminal' && t !== 'general' && t !== 'developer'))(
    '%s 骨架渲染标题与空态位',
    (tab) => { /* 原实现不变 */ },
  )
```
2. `it('general 骨架带 developer 入口行…')` —— 这条**保留**(入口行仍在),但 general 现在会打接口,给该文件补最小 mock(照 Step 1 的 mock 抄一份,或把该用例移到新的 integration 测试里 —— **推荐后者**,`panels.test.ts` 保持零 mock 的纯骨架测试)。

`developer` 的两条(`.set-back` / 返回冒泡)在 Task 11 之后仍应通过,先不动。

- [ ] **Step 5: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/panels/general/GeneralPanel.integration.test.ts
git commit src/settings/panels/GeneralPanel.vue src/settings/panels/panels.test.ts \
           src/settings/panels/general/GeneralPanel.integration.test.ts \
  -m "feat(settings): general 页装配(SP9-P1)

行顺序逐条对位 Vue2 L65-324。两处有意不做:
- Premium 推广条(授权偏离 #6,用户 2026-07-31 拍板)
- 显示其他 Docker 容器应用(Vue2 恒不渲染,债务 D15)
整页在所有接口都失败时仍完整渲染,不白屏。"
```

---


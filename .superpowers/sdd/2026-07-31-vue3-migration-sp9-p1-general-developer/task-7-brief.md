## Task 7: USB 自动挂载 / 推荐应用 / 新闻流 三行

**Files:**
- Create: `src/settings/panels/general/UsbAutoMountRow.vue`
- Create: `src/settings/panels/general/SwitchRow.vue`
- Create: `src/settings/panels/general/switchRows.test.ts`

**Interfaces:**
- Consumes: `service.sys.getUsbStatus()`(Task 1 已把 `"True"` 归一成布尔)、`service.sys.toggleUsbAutoMount({state})`、`service.sys.hardwareInfo()`(取 `drive_model` 判树莓派)、Task 2 的 `readSystemConfig` / `patchSystemConfig`、Task 3 的 `SettingsRow` / `SettingsSwitch`、`src/components/ui/AlertDialog.vue`(既有:`:open` `:title` `:message` `:confirmText` `:cancelText` `@confirm` `@update:open`)、`useToast()`
- Produces:
  ```
  <UsbAutoMountRow />                            // 自持状态
  <SwitchRow field="recommend_switch" label-key="settingsRecommendApps" />
  <SwitchRow field="rss_switch" label-key="settingsNewsFeed"
             confirm-title-key="settingsNewsFeedTitle"
             confirm-msg-key="settingsNewsFeedConfirm"
             confirm-ok-key="settingsAccept" />   // 只在「开」时弹确认
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/panels/general/switchRows.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
const state = { usb: false, usbCalls: [] as unknown[], usbFail: false, driveModel: '' }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      getUsbStatus: async () => state.usb,
      toggleUsbAutoMount: async (p: { state: string }) => {
        state.usbCalls.push(p)
        if (state.usbFail) throw new Error('boom')
      },
      hardwareInfo: async () => ({ arch: 'arm64', drive_model: state.driveModel }),
    },
  },
}))

import UsbAutoMountRow from './UsbAutoMountRow.vue'
import SwitchRow from './SwitchRow.vue'
// 用「导入组件本身」而不是 findComponent({name:'AlertDialog'}):
// AlertDialog.vue 没有 defineOptions({name}),而它是 sp7/sp8 也会碰的共享文件,
// 为了测试去改它会白增合并冲突面。
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  state.usb = false; state.usbCalls = []; state.usbFail = false; state.driveModel = ''
  __resetSystemConfigQueue()
})

describe('UsbAutoMountRow', () => {
  const mountIt = () => mount(UsbAutoMountRow, { global: { plugins: [i18n] } })

  it('挂载后开关反映后端状态("True" 已在包里归一成布尔)', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('挂载**不**下发 toggle(加载 ≠ 用户操作)', async () => {
    state.usb = true
    mountIt()
    await flushPromises()
    expect(state.usbCalls).toEqual([])
  })

  it('拨开下发 state:on,并立刻乐观翻转', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'on' }])
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('拨关下发 state:off', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'off' }])
  })

  it('下发失败时开关弹回原状态(Vue2 是 fire-and-forget,失败后界面在骗人)', async () => {
    state.usbFail = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('树莓派 + 开启时给出启动失败警告(对位 Vue2 L1791-1797)', async () => {
    state.driveModel = 'Raspberry Pi 5 Model B'
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    // Vue2 译文写的是 "Raspberry Pi" 而不是「树莓派」,断言跟着译文走
    expect(w.text()).toContain('Raspberry Pi')
  })

  it('非树莓派不给警告', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })

  it('关闭时即使是树莓派也不给警告(警告只针对「开启」)', async () => {
    state.driveModel = 'Raspberry Pi 5'
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })
})

describe('SwitchRow —— 推荐应用(无确认)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: { field: 'recommend_switch', labelKey: 'settingsRecommendApps' },
    global: { plugins: [i18n] },
  })

  it('挂载后反映服务端值,默认 true(对位 Vue2 L942)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('拨动直接落库,只写自己那一个字段', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(blob.recommend_switch).toBe(false)
    expect(blob.rss_switch).toBe(true)
  })

  it('落库失败时弹回', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })
})

describe('SwitchRow —— 新闻流(开启需确认,对位 Vue2 rssConfirm L1696-1715)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: {
      field: 'rss_switch', labelKey: 'settingsNewsFeed',
      confirmTitleKey: 'settingsNewsFeedTitle',
      confirmMsgKey: 'settingsNewsFeedConfirm',
      confirmOkKey: 'settingsAccept',
    },
    global: { plugins: [i18n] },
  })

  it('默认关(对位 Vue2 L944 rss_switch:false)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('拨开先弹确认,未确认前不落库、开关不翻', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(true)
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('确认后才落库并翻开', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('confirm')
    await flushPromises()
    expect(blob.rss_switch).toBe(true)
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('取消确认:保持关闭且不落库', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('update:open', false)
    await flushPromises()
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('关闭方向**不**弹确认,直接落库(对位 Vue2:!rss_switch 时直接 saveData)', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(false)
    expect(blob.rss_switch).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm test src/settings/panels/general/switchRows.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 `UsbAutoMountRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L211-217(行)+ getUsbStatus L1442 / usbAutoMount L1449。
// 移植纪律:Vue2 的 usbAutoMount() 是 fire-and-forget(不 await、不看结果),
// 下发失败时开关停在新位置、界面在骗人。这里改成失败弹回。
// 树莓派警告:Vue2 用 hardwareInfo().drive_model 是否含 "raspberry" 判断
// (LocalStorage 服务在树莓派上会静默强制关掉 USB 自动挂载,见顶层 CLAUDE.md)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const on = ref(false)
const busy = ref(false)
const isRpi = ref(false)
const warn = ref('')

onMounted(async () => {
  await Promise.allSettled([
    service.sys.getUsbStatus().then((v) => { on.value = v }),
    service.sys.hardwareInfo().then((hw) => {
      const model = typeof hw.drive_model === 'string' ? hw.drive_model : ''
      isRpi.value = model.toLowerCase().includes('raspberry')
    }),
  ])
})

async function onToggle(next: boolean) {
  if (busy.value) return
  const prev = on.value
  on.value = next            // 乐观翻转
  busy.value = true
  warn.value = ''
  try {
    await service.sys.toggleUsbAutoMount({ state: next ? 'on' : 'off' })
    // 警告只针对「开启」方向
    if (next && isRpi.value) warn.value = t('settingsUsbRpiWarn')
  } catch (e) {
    on.value = prev          // 失败弹回(Vue2 不弹,界面会骗人)
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] toggleUsbAutoMount failed', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsUsbAutoMount')">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t('settingsUsbAutoMount')"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
    <template v-if="warn" #hint><span class="set-warn">{{ warn }}</span></template>
  </SettingsRow>
</template>
```

- [ ] **Step 4: 实现 `SwitchRow.vue`**

```vue
<script setup lang="ts">
// 服务端 system blob 里一个布尔字段的开关行。两处复用:
//   - 推荐应用(Vue2 L220-226,直接保存)
//   - 新闻流  (Vue2 L229-236 + rssConfirm L1696-1715,**只在开启方向**弹确认)
// 「显示其他 Docker 容器应用」那一行不做 —— Vue2 恒不渲染(债务 D15,见计划 §实测校正 4)。
//
// 移植纪律 #1:加载不回写;只在用户拨动时 patch,且只写自己那一个字段
// (整块覆写会和别的行/语言互相洗,见 systemConfig.ts 的串行队列)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{
  field: string
  labelKey: string
  /** 三个 confirm* 同时给才启用「开启前确认」 */
  confirmTitleKey?: string
  confirmMsgKey?: string
  confirmOkKey?: string
}>()

const { t } = useI18n()
const toast = useToast()

const on = ref<boolean>(SYSTEM_DEFAULTS[props.field] === true)
const busy = ref(false)
const confirmOpen = ref(false)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg[props.field] === 'boolean') on.value = cfg[props.field] as boolean
})

async function save(next: boolean) {
  const prev = on.value
  on.value = next
  busy.value = true
  try {
    await patchSystemConfig({ [props.field]: next })
  } catch (e) {
    on.value = prev
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] save switch failed', props.field, e)
  } finally {
    busy.value = false
  }
}

function onToggle(next: boolean) {
  // 只有「开启」方向需要确认;关闭方向直接存(对位 Vue2 rssConfirm 的 !rss_switch 分支)
  if (next && props.confirmMsgKey) {
    confirmOpen.value = true
    return
  }
  void save(next)
}

function onConfirm() {
  confirmOpen.value = false
  void save(true)
}
</script>

<template>
  <SettingsRow :label="t(labelKey)">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t(labelKey)"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
  </SettingsRow>

  <AlertDialog
    v-if="confirmMsgKey && confirmTitleKey && confirmOkKey"
    :open="confirmOpen"
    :title="t(confirmTitleKey)"
    :message="t(confirmMsgKey)"
    :confirm-text="t(confirmOkKey)"
    :cancel-text="t('settingsCancel')"
    @update:open="confirmOpen = $event"
    @confirm="onConfirm"
  />
</template>
```

> **不要**为了测试给 `AlertDialog.vue` 加 `defineOptions({name})` —— 它是 sp7/sp8 也会碰的共享文件,测试里直接 `import AlertDialog from '…'` 再 `findComponent(AlertDialog)` 即可,本任务**不改任何共享文件**。

- [ ] **Step 5: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/panels/general/UsbAutoMountRow.vue src/settings/panels/general/SwitchRow.vue \
        src/settings/panels/general/switchRows.test.ts
git commit src/settings/panels/general/UsbAutoMountRow.vue src/settings/panels/general/SwitchRow.vue \
           src/settings/panels/general/switchRows.test.ts \
  -m "feat(settings): USB 自动挂载 / 推荐应用 / 新闻流三行(SP9-P1)

- 开关下发失败一律弹回原位(Vue2 是 fire-and-forget,失败后界面在骗人)
- 新闻流只在「开启」方向弹确认,关闭直接存(对位 Vue2 rssConfirm)
- 树莓派警告只在开启方向给出
- 「显示其他 Docker 容器应用」行不做:Vue2 恒不渲染(债务 D15)"
```

---


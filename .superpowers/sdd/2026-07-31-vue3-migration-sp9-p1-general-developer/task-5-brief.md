## Task 5: 壁纸 / 语言 / 时区 / 硬盘待机 四行

**Files:**
- Create: `src/settings/util/timezones.ts`
- Create: `src/settings/util/standby.ts`
- Create: `src/settings/util/standby.test.ts`
- Create: `src/settings/panels/general/WallpaperRow.vue` + `.test.ts`
- Create: `src/settings/panels/general/LanguageRow.vue` + `.test.ts`
- Create: `src/settings/panels/general/TimezoneRow.vue` + `.test.ts`
- Create: `src/settings/panels/general/DiskStandbyRow.vue` + `.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `readSystemConfig` / `patchSystemConfig`、Task 3 的 `SettingsRow` / `.set-select` / `.set-btn`、`useLocaleStore`(既有 `persist(lang)`)、`service.sys.setDiskStandby`、`useToast().show(text, duration?)`
- Produces:
  ```ts
  // timezones.ts —— 逐字照抄 Vue2 SettingsPanel.vue L871-933
  export interface TimezoneOption { label: string; value: string }
  export const TIMEZONES: readonly TimezoneOption[]        // 与 Vue2 同序同内容
  // standby.ts
  export interface StandbyOption { value: string; labelKey: string }
  export const STANDBY_OPTIONS: readonly StandbyOption[]   // never/10m/20m/30m/1h..5h,9 项
  export function parseStandbyMinutes(standby: string | undefined): number
  ```
  四个行组件都无 props、无 emit,各自读写自己那一份配置。

- [ ] **Step 1: 抄时区表**

`src/settings/util/timezones.ts` —— 从 `NimoOS-UI/src/components/settings/SettingsPanel.vue` **L871-933 逐字复制**(约 39 项,`{label, value}` 结构不变):

```bash
sed -n '871,933p' /home/nimo/NimoTech/NimoOS-UI/src/components/settings/SettingsPanel.vue
```

文件头写:
```ts
/**
 * 时区表逐字照抄 Vue2 SettingsPanel.vue L871-933(同序、同 label 文案、同 value)。
 * label 是英文原文且**不进 i18n** —— Vue2 那边也没有 $t(),两套 UI 显示一致优先。
 * 顺序不要"优化"成按 GMT 排序:Vue2 就是这个顺序,界面 1:1。
 */
export interface TimezoneOption { label: string; value: string }
export const TIMEZONES: readonly TimezoneOption[] = [
  { label: '(GMT-12:00) International Date Line West', value: 'Etc/GMT+12' },
  // … 逐字抄完 …
] as const
```

- [ ] **Step 2: 写 `standby.ts` 的失败测试**

`src/settings/util/standby.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STANDBY_OPTIONS, parseStandbyMinutes } from './standby'

describe('STANDBY_OPTIONS', () => {
  it('9 项,顺序与取值对位 Vue2 L989-999', () => {
    expect(STANDBY_OPTIONS.map((o) => o.value)).toEqual(
      ['never', '10m', '20m', '30m', '1h', '2h', '3h', '4h', '5h'],
    )
  })
  it('每项都有 i18n 键(Vue2 是内联 zh/en 两栏,这里改走 i18n 分片)', () => {
    for (const o of STANDBY_OPTIONS) expect(o.labelKey).toMatch(/^settingsStandby/)
  })
})

describe('parseStandbyMinutes(对位 Vue2 L1093-1098)', () => {
  it('never → 0', () => expect(parseStandbyMinutes('never')).toBe(0))
  it('空/undefined → 0', () => {
    expect(parseStandbyMinutes('')).toBe(0)
    expect(parseStandbyMinutes(undefined)).toBe(0)
  })
  it('分钟后缀原样取值', () => {
    expect(parseStandbyMinutes('10m')).toBe(10)
    expect(parseStandbyMinutes('30m')).toBe(30)
  })
  it('小时后缀 ×60', () => {
    expect(parseStandbyMinutes('1h')).toBe(60)
    expect(parseStandbyMinutes('5h')).toBe(300)
  })
  it('无法识别的值 → 0(不是 NaN —— 后端要求 minutes 是整数,NaN 会被 400)', () => {
    expect(parseStandbyMinutes('abc')).toBe(0)
    expect(parseStandbyMinutes('12')).toBe(0)
  })
})
```

- [ ] **Step 3: 跑测试确认失败,然后实现 `standby.ts`**

```bash
pnpm test src/settings/util/standby.test.ts 2>&1 | tail -8
```

```ts
/**
 * 硬盘待机选项。取值对位 Vue2 SettingsPanel.vue L989-999。
 * Vue2 每项内联 `{zh, en}` 两栏、靠 getStandbyLabel() 按当前语言挑
 * (且它只认 zh_cn/zh_tw,其他语言一律走英文)。这里改走 i18n 分片,
 * 由 vue-i18n 统一管 —— 不是重构,是因为 New-UI 本来就有 i18n 体系,
 * 内联两栏在新仓库里是重复实现。
 */
export interface StandbyOption { value: string; labelKey: string }

export const STANDBY_OPTIONS: readonly StandbyOption[] = [
  { value: 'never', labelKey: 'settingsStandbyNever' },
  { value: '10m', labelKey: 'settingsStandby10m' },
  { value: '20m', labelKey: 'settingsStandby20m' },
  { value: '30m', labelKey: 'settingsStandby30m' },
  { value: '1h', labelKey: 'settingsStandby1h' },
  { value: '2h', labelKey: 'settingsStandby2h' },
  { value: '3h', labelKey: 'settingsStandby3h' },
  { value: '4h', labelKey: 'settingsStandby4h' },
  { value: '5h', labelKey: 'settingsStandby5h' },
] as const

/**
 * 对位 Vue2 L1093-1098。后端 PUT /v1/sys/disk/standby 要求 `minutes` 是整数,
 * 非整数会被 400(NimoOS/route/v1/system.go:617-624),所以无法识别一律给 0 而不是 NaN。
 */
export function parseStandbyMinutes(standby: string | undefined): number {
  if (!standby || standby === 'never') return 0
  const num = Number.parseInt(standby, 10)
  if (!Number.isFinite(num)) return 0
  if (standby.endsWith('m')) return num
  if (standby.endsWith('h')) return num * 60
  return 0
}
```

- [ ] **Step 4: 写四个行组件的失败测试**

新建 `src/settings/panels/general/rows.test.ts`(四行放一个测试文件,它们共享同一套 mock):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
const standbyCalls: { minutes: number }[] = []
const persisted: string[] = []

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: { setDiskStandby: async (p: { minutes: number }) => { standbyCalls.push(p) } },
  },
}))
vi.mock('../../../stores/locale', () => ({
  LOCALES: ['zh_cn', 'en_us'],
  useLocaleStore: () => ({ persist: async (l: string) => { persisted.push(l) } }),
}))

import WallpaperRow from './WallpaperRow.vue'
import LanguageRow from './LanguageRow.vue'
import TimezoneRow from './TimezoneRow.vue'
import DiskStandbyRow from './DiskStandbyRow.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountRow = (C: unknown) => mount(C as never, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  standbyCalls.length = 0
  persisted.length = 0
  __resetSystemConfigQueue()
})

describe('WallpaperRow(债务 D5:New-UI 无壁纸系统)', () => {
  it('渲染壁纸标签,「更改」按钮禁用', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeDefined()
  })
  it('行下方有说明,写清为什么不可用', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').text()).toBe('新版界面暂未提供壁纸功能')
  })
})

describe('LanguageRow(债务 D6:只有 2 项,Vue2 有 31 项)', () => {
  it('只列 zh_cn / en_us', () => {
    const opts = mountRow(LanguageRow).findAll('option')
    expect(opts.map((o) => o.attributes('value'))).toEqual(['zh_cn', 'en_us'])
  })
  it('行下方有说明', () => {
    expect(mountRow(LanguageRow).find('.set-row-hint').exists()).toBe(true)
  })
  it('选中项跟随当前 locale', () => {
    expect((mountRow(LanguageRow).find('select').element as HTMLSelectElement).value).toBe('zh_cn')
  })
  it('切换走 locale store 的 persist(不自己写 system blob,避免两条路径打架)', async () => {
    const w = mountRow(LanguageRow)
    await w.find('select').setValue('en_us')
    await flushPromises()
    expect(persisted).toEqual(['en_us'])
  })
})

describe('TimezoneRow', () => {
  it('挂载后选中服务端保存的时区', async () => {
    blob.timezone = 'Europe/Paris'
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('Europe/Paris')
  })

  it('服务端没存时用默认值 America/New_York(对位 Vue2 L940)', async () => {
    const w = mountRow(TimezoneRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('America/New_York')
  })

  it('挂载**不**回写配置(移植纪律 #1:Vue2 每次打开都白写一次)', async () => {
    blob.timezone = 'UTC'
    mountRow(TimezoneRow)
    await flushPromises()
    expect(blob).toEqual({ timezone: 'UTC' })   // 没有被整块覆写出别的字段
  })

  it('用户改选才 patch,且只写 timezone 一个字段', async () => {
    blob.rss_switch = true
    const w = mountRow(TimezoneRow)
    await flushPromises()
    await w.find('select').setValue('UTC')
    await flushPromises()
    expect(blob.timezone).toBe('UTC')
    expect(blob.rss_switch).toBe(true)          // 别人的字段没被洗掉
  })

  it('时区表项数与 Vue2 一致(防抄漏)', () => {
    const w = mountRow(TimezoneRow)
    expect(w.findAll('option').length).toBeGreaterThanOrEqual(35)
  })
})

describe('DiskStandbyRow', () => {
  it('挂载后选中服务端值,且**不**下发 standby 指令(移植纪律 #2)', async () => {
    blob.disk_standby = '30m'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('30m')
    expect(standbyCalls).toEqual([])
  })

  it('用户改选才既 patch 配置又下发指令,分钟数经 parseStandbyMinutes 换算', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('2h')
    await flushPromises()
    expect(blob.disk_standby).toBe('2h')
    expect(standbyCalls).toEqual([{ minutes: 120 }])
  })

  it('选 never 下发 0', async () => {
    blob.disk_standby = '1h'
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('never')
    await flushPromises()
    expect(standbyCalls).toEqual([{ minutes: 0 }])
  })

  it('下发失败时提示,但不把 select 弹回去(配置已落库,指令下次开机生效)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'setDiskStandby').mockRejectedValueOnce(new Error('boom'))
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    await w.find('select').setValue('10m')
    await flushPromises()
    expect((w.find('select').element as HTMLSelectElement).value).toBe('10m')
  })

  it('9 个选项且文案有译文(没渲染出裸 key)', async () => {
    const w = mountRow(DiskStandbyRow)
    await flushPromises()
    const opts = w.findAll('option')
    expect(opts).toHaveLength(9)
    expect(opts[0].text()).toBe('从未')
    for (const o of opts) expect(o.text()).not.toMatch(/^settings/)
  })
})
```

- [ ] **Step 5: 跑测试确认失败**

```bash
pnpm test src/settings/panels/general/rows.test.ts 2>&1 | tail -12
```

- [ ] **Step 6: 实现 `WallpaperRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L102-116。
// **做样子(政策三 / 债务 D5)**:New-UI 没有壁纸系统(全仓只有 session 里一个
// 登出时清理的 localStorage key),Vue2 那边点 Change 会发 EventBus 打开换壁纸弹窗 ——
// 新 UI 没有那个弹窗的对位物。所以行保留、按钮禁用、下方写明原因。
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsRow :label="t('settingsWallpaper')">
    <template #control>
      <button class="set-btn" type="button" disabled>{{ t('settingsWallpaperChange') }}</button>
    </template>
    <template #hint>{{ t('settingsWallpaperNa') }}</template>
  </SettingsRow>
</template>
```

- [ ] **Step 7: 实现 `LanguageRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L119-135。
// **做样子(政策三 / 债务 D6)**:Vue2 从 @/assets/lang 动态枚举出 31 种语言;
// New-UI 目前只有 zh_cn / en_us 两个 locale 文件,所以只列 2 项 —— 归 roadmap §5 的 i18n 全量收口。
// 写入走 locale store 的 persist()(它内部已改接 systemConfig 串行队列),
// 不在这里自己 patch lang —— 两条路径都写同一个字段必然打架。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, useLocaleStore, type Locale } from '../../../stores/locale'
import SettingsRow from '../../components/SettingsRow.vue'
import '../../styles/settings.css'

const { t, locale } = useI18n()
const localeStore = useLocaleStore()

const LABELS: Record<Locale, string> = { zh_cn: '简体中文', en_us: 'English' }
const current = computed(() => locale.value as Locale)

async function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value as Locale
  await localeStore.persist(v)
}
</script>

<template>
  <SettingsRow :label="t('settingsLanguage')">
    <template #control>
      <select class="set-select" :value="current" @change="onChange">
        <option v-for="l in LOCALES" :key="l" :value="l">{{ LABELS[l] }}</option>
      </select>
    </template>
    <template #hint>{{ t('settingsLanguageNa') }}</template>
  </SettingsRow>
</template>
```

- [ ] **Step 8: 实现 `TimezoneRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L138-154。
// 移植纪律 #1:Vue2 的 barData 深度 watcher 会在**加载完成的那一刻**把刚读到的配置
// 原样写回服务端(每次打开设置都白写一次)。这里只在用户 change 时才 patch。
// 注意:时区目前只有 Vue2 的时钟组件在消费(New-UI 还没有对位小组件),
// 但两套 UI 共用服务端同一个 system blob —— 在这里改是真的会影响旧 UI 的时钟,不是空操作。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { TIMEZONES } from '../../util/timezones'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import '../../styles/settings.css'

const { t } = useI18n()
const value = ref<string>(SYSTEM_DEFAULTS.timezone as string)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg.timezone === 'string' && cfg.timezone) value.value = cfg.timezone
})

async function onChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ timezone: next })
  } catch (err) {
    console.warn('[settings] save timezone failed', err)
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsTimezone')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 9: 实现 `DiskStandbyRow.vue`**

```vue
<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L157-173 + watcher L1230-1237。
// 移植纪律 #2:Vue2 的 'barData.disk_standby' watcher 在初次 hydrate 时也会 fire,
// 于是每次打开设置页都会对磁盘下一次 standby 指令。这里只在用户 change 时下发。
// 两件事都要做:① patch 配置(给旧 UI 与下次启动读)② 立刻下发指令(当次生效)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import { STANDBY_OPTIONS, parseStandbyMinutes } from '../../util/standby'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const value = ref<string>(SYSTEM_DEFAULTS.disk_standby as string)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg.disk_standby === 'string' && cfg.disk_standby) value.value = cfg.disk_standby
})

async function onChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ disk_standby: next })
  } catch (err) {
    console.warn('[settings] save disk_standby failed', err)
  }
  try {
    await service.sys.setDiskStandby({ minutes: parseStandbyMinutes(next) })
  } catch (err) {
    // 配置已落库,只是这一次没下发成功 → 提示但不把 select 弹回去
    console.warn('[settings] apply disk standby failed', err)
    toast.show(t('settingsSaveFailed'))
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsDiskStandby')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="o in STANDBY_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 10: 跑测试确认通过 + 任务门 + 提交**

```bash
pnpm test src/settings 2>&1 | tail -8
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short
git add src/settings/util/timezones.ts src/settings/util/standby.ts src/settings/util/standby.test.ts \
        src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/LanguageRow.vue \
        src/settings/panels/general/TimezoneRow.vue src/settings/panels/general/DiskStandbyRow.vue \
        src/settings/panels/general/rows.test.ts
git commit src/settings/util/timezones.ts src/settings/util/standby.ts src/settings/util/standby.test.ts \
           src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/LanguageRow.vue \
           src/settings/panels/general/TimezoneRow.vue src/settings/panels/general/DiskStandbyRow.vue \
           src/settings/panels/general/rows.test.ts \
  -m "feat(settings): general 壁纸/语言/时区/硬盘待机四行(SP9-P1)

- 壁纸按钮禁用 + 说明(债务 D5);语言只 2 项 + 说明(债务 D6)
- 移植纪律 #1:加载不回写配置(Vue2 深度 watcher 每次打开都白写一次)
- 移植纪律 #2:加载不下发硬盘待机指令,只在用户改选时下发
- parseStandbyMinutes 无法识别一律给 0 而非 NaN(后端要整数,NaN 会 400)"
```

---


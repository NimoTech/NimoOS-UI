## Task 3: 行级 UI 原语 + 文案/token 分片

**Files:**
- Create: `src/settings/components/SettingsRow.vue`
- Create: `src/settings/components/SettingsRow.test.ts`
- Create: `src/settings/components/SettingsSwitch.vue`
- Create: `src/settings/components/SettingsSwitch.test.ts`
- Modify: `src/settings/styles/settings.css`
- Modify: `src/styles/theme.sp9.css`
- Modify: `src/styles/theme.sp9.test.ts`(P0 建的守卫会自动覆盖新 token,通常无需改;跑一次确认)
- Modify: `src/i18n/zh_cn.sp9.ts`
- Modify: `src/i18n/en_us.sp9.ts`

**Interfaces:**
- Consumes: P0 的 `settings.css` 与 `theme.sp9.css` 分片、既有 token(`--card-bg` / `--border` / `--fg` / `--fg-muted` / `--fg-faint` / `--accent` / `--on-accent` / `--chip-bg` / `--chip-border` / `--hover` / `--radius-sm` / `--success` / `--remove-fg` / `--ease`)
- Produces:
  ```
  <SettingsRow :label="string" :sub="string?" :clickable="boolean?" :disabled="boolean?" @click>
    <template #control> …右侧控件… </template>
    <template #hint>   …行下方说明(壁纸 D5 / 语言 D6 用)… </template>
  </SettingsRow>
  → 根元素 .set-list-item;clickable 时渲染 <button>,并带 .set-chevron

  <SettingsSwitch v-model="boolean" :label="string" :disabled="boolean?" />
  → <button role="switch" :aria-checked> + .set-switch / .set-switch.on
  ```
  CSS 类:`.set-list`(卡片容器)· `.set-list-item`(一行)· `.set-row-label` · `.set-row-sub` · `.set-row-hint` · `.set-chevron` · `.set-switch` / `.set-switch-thumb` · `.set-select`(原生 select 的药丸样式)· `.set-input`(数字/文本输入)· `.set-btn` / `.set-btn.primary` · `.set-card`(设备信息卡等大卡)
  新 token:`--set-warn-fg`

- [ ] **Step 1: 加 token(两套主题块都给值)**

`src/styles/theme.sp9.css` 的两个块里各加一行。重启超时的浮层要一个警示色,既有 token 里只有 `--success` 和 `--remove-fg`(危险红),没有琥珀色:

```css
:root {
  --set-rail-bg: rgba(255, 255, 255, 0.06);
  --set-rail-border: rgba(255, 255, 255, 0.12);
  --set-warn-fg: #f0b429;
}

:root[data-theme='light'] {
  --set-rail-bg: rgba(0, 0, 0, 0.03);
  --set-rail-border: rgba(0, 0, 0, 0.08);
  --set-warn-fg: #b7791f;
}
```

跑 P0 建的守卫确认两块 token 名集合一致:
```bash
pnpm test src/styles/theme.sp9.test.ts src/styles/color-guard.test.ts 2>&1 | tail -8
```

- [ ] **Step 2: 加 P1 文案(zh 与 en 必须同时加,值必须是字符串)**

en 文案**逐字取自 Vue2 的 `$t('…')` 键名本身**(Vue2 用英文原文当 key),zh 取自 `NimoOS-UI/src/assets/lang/zh_cn.js` 对应译文;查不到的按现有语气自拟。

追加到 `src/i18n/zh_cn.sp9.ts`:

```ts
  // ── P1 general ──
  settingsDeviceInfoBtn: '设备信息',
  settingsDeviceInfoTitle: '设备信息',
  settingsDeviceNoGpu: '未检测到独立显卡',
  settingsDeviceDetecting: '检测中…',
  settingsWallpaper: '壁纸',
  settingsWallpaperChange: '更换',
  settingsWallpaperNa: '新版界面暂未提供壁纸功能',
  settingsLanguage: '语言',
  settingsLanguageNa: '新版界面目前只有简体中文与英文',
  settingsTimezone: '时区',
  settingsDiskStandby: '磁盘待机',
  settingsStandbyNever: '从不',
  settingsStandby10m: '10 分钟',
  settingsStandby20m: '20 分钟',
  settingsStandby30m: '30 分钟',
  settingsStandby1h: '1 小时',
  settingsStandby2h: '2 小时',
  settingsStandby3h: '3 小时',
  settingsStandby4h: '4 小时',
  settingsStandby5h: '5 小时',
  settingsWebuiPort: 'WebUI 端口',
  settingsPortPlaceholder: '端口',
  settingsPortRange: '端口范围为 80-65535',
  settingsPortSwitching: '正在切换到新端口…',
  settingsPortTimeout: '新端口没有响应,请手动访问。',
  settingsUsbAutoMount: '自动挂载 USB 设备',
  settingsUsbRpiWarn: '树莓派从 USB 启动时,开启该功能可能导致无法启动',
  settingsRecommendApps: '显示推荐应用',
  settingsNewsFeed: '新闻源',
  settingsNewsFeedTitle: '新闻源',
  settingsNewsFeedConfirm: 'NimoOS 桌面会通过互联网获取 https://blog.nimoos.io 的最新资讯,这可能会向该站点留下你的访问记录。是否接受?',
  settingsAccept: '接受',
  settingsCancel: '取消',
  settingsConfirm: '确定',
  settingsSave: '保存',
  settingsSaveSuccess: '保存成功',
  settingsSaveFailed: '保存失败',
  settingsError: '发生错误',
  settingsFirmwareUpdate: '固件更新',
  settingsSystemUpdate: '系统更新',
  settingsLatestVersion: '已是最新版本',
  settingsDownloaded: '已下载',
  settingsDownloading: '下载中',
  settingsCheckUpdate: '检查更新',
  settingsUpdateNow: '立即更新',
  settingsUpdateAvailable: '有可用更新',
  settingsUpdateTitle: '更新',
  settingsDownloadNow: '立即下载',
  settingsUpgradeNow: '立即升级',
  settingsDownloadingSystem: '正在下载系统更新',
  settingsDownloadCancelled: '已取消下载',
  settingsDownloadCancelFailed: '取消下载失败',
  settingsUpgradeFailed: '升级过程似乎出了问题,请重试!',
  // ── P1 电源流 ──
  settingsShutdown: '关机',
  settingsRestart: '重启',
  settingsShutdownConfirmTitle: '确认关机?',
  settingsShutdownConfirmMsg: '系统将会关闭,期间无法访问。',
  settingsRestartConfirmTitle: '确认重启?',
  settingsRestartConfirmMsg: '系统将会重启,期间短暂无法访问。',
  settingsPowerShutting: '正在关机',
  settingsPowerShuttingMsg: '请等待约 30 秒后再切断电源。',
  settingsPowerOffline: '机器已关机',
  settingsPowerOfflineMsg: '可以安全断电了。',
  settingsPowerRestarting: '正在重启',
  settingsPowerRestartingMsg: '正在发送重启指令…',
  settingsPowerReconnecting: '正在重新连接',
  settingsPowerReconnectingMsg: '系统正在重启,将自动重新连接…',
  settingsPowerBack: '系统已恢复',
  settingsPowerBackMsg: '正在跳转…',
  settingsPowerAppUpdating: '系统正在更新',
  settingsPowerAppUpdatingMsg: '请等待系统更新并重启…',
  settingsPowerFallback: '重启耗时超出预期。',
  settingsPowerFallbackMsg: '请手动刷新页面。',
  settingsRefresh: '刷新',
  // ── P1 developer ──
  settingsHttps: 'HTTPS',
  settingsHttpsConfig: 'WebUI HTTPS 配置',
  settingsHttpsTitle: 'WebUI HTTPS',
  settingsHttpsDomain: '主域名',
  settingsHttpsEffective: '生效时间',
  settingsHttpsExpiration: '到期时间',
  settingsHttpsPort: '端口',
  settingsHttpsCert: 'SSL 证书',
  settingsHttpsCertAuto: '自动(自签名证书)',
  settingsHttpsCertCustom: '上传证书',
  settingsHttpsTrust: '信任证书',
  settingsHttpsDownloadCa: '下载 CA 证书',
  settingsHttpsCertFiles: '证书文件',
  settingsHttpsBothFiles: '请同时上传 PEM 与 CRT 文件。',
  settingsHttpsUploadFailed: '证书上传失败',
```

追加到 `src/i18n/en_us.sp9.ts`(**同名同序**):

```ts
  // ── P1 general ──
  settingsDeviceInfoBtn: 'Device information',
  settingsDeviceInfoTitle: 'Device Info',
  settingsDeviceNoGpu: 'No dedicated GPU detected',
  settingsDeviceDetecting: 'Detecting...',
  settingsWallpaper: 'Wallpaper',
  settingsWallpaperChange: 'Change',
  settingsWallpaperNa: 'Wallpapers are not available in the new UI yet',
  settingsLanguage: 'Language',
  settingsLanguageNa: 'The new UI currently ships Simplified Chinese and English only',
  settingsTimezone: 'Timezone',
  settingsDiskStandby: 'Disk Standby',
  settingsStandbyNever: 'Never',
  settingsStandby10m: '10 minutes',
  settingsStandby20m: '20 minutes',
  settingsStandby30m: '30 minutes',
  settingsStandby1h: '1 hour',
  settingsStandby2h: '2 hours',
  settingsStandby3h: '3 hours',
  settingsStandby4h: '4 hours',
  settingsStandby5h: '5 hours',
  settingsWebuiPort: 'WebUI Port',
  settingsPortPlaceholder: 'Port',
  settingsPortRange: 'Port range is 80-65535',
  settingsPortSwitching: 'Switching to the new port...',
  settingsPortTimeout: 'The new port did not respond. Please navigate manually.',
  settingsUsbAutoMount: 'Automount USB Drive',
  settingsUsbRpiWarn: 'Enabling this function may cause boot failures when the Raspberry Pi device is booted from USB',
  settingsRecommendApps: 'Show Recommended Apps',
  settingsNewsFeed: 'News Feed',
  settingsNewsFeedTitle: 'News Feed',
  settingsNewsFeedConfirm: 'NimoOS dashboard will get the the latest news feed of https://blog.nimoos.io via Internet, which might leave your visit records to the site. Do you accept?',
  settingsAccept: 'Accept',
  settingsCancel: 'Cancel',
  settingsConfirm: 'Confirm',
  settingsSave: 'Save',
  settingsSaveSuccess: 'Save success',
  settingsSaveFailed: 'Failed to save configuration',
  settingsError: 'An error occurred',
  settingsFirmwareUpdate: 'Firmware Update',
  settingsSystemUpdate: 'System Update',
  settingsLatestVersion: 'Currently at the latest version',
  settingsDownloaded: 'Downloaded',
  settingsDownloading: 'Downloading',
  settingsCheckUpdate: 'Check for Updates',
  settingsUpdateNow: 'Update Now',
  settingsUpdateAvailable: 'Update Available',
  settingsUpdateTitle: 'Update',
  settingsDownloadNow: 'Download Now',
  settingsUpgradeNow: 'Upgrade Now',
  settingsDownloadingSystem: 'Downloading system update',
  settingsDownloadCancelled: 'Download cancelled',
  settingsDownloadCancelFailed: 'Failed to cancel download',
  settingsUpgradeFailed: 'There seems to be a problem with the upgrade process, please try again!',
  // ── P1 电源流 ──
  settingsShutdown: 'Shutdown',
  settingsRestart: 'Restart',
  settingsShutdownConfirmTitle: 'Shut down the system?',
  settingsShutdownConfirmMsg: 'The system will power off and be unreachable.',
  settingsRestartConfirmTitle: 'Restart the system?',
  settingsRestartConfirmMsg: 'The system will reboot and be briefly unreachable.',
  settingsPowerShutting: 'Now shutting down',
  settingsPowerShuttingMsg: 'Please wait for about 30 seconds before cutting off the power.',
  settingsPowerOffline: 'Machine has shut down',
  settingsPowerOfflineMsg: 'Safe to cut the power.',
  settingsPowerRestarting: 'Restarting now',
  settingsPowerRestartingMsg: 'Sending restart command...',
  settingsPowerReconnecting: 'Reconnecting',
  settingsPowerReconnectingMsg: 'System is rebooting, reconnecting automatically...',
  settingsPowerBack: 'System is back online',
  settingsPowerBackMsg: 'Redirecting...',
  settingsPowerAppUpdating: 'System is updating',
  settingsPowerAppUpdatingMsg: 'Please wait for the system to update and restart...',
  settingsPowerFallback: 'Restart took longer than expected.',
  settingsPowerFallbackMsg: 'Please refresh the page manually.',
  settingsRefresh: 'Refresh',
  // ── P1 developer ──
  settingsHttps: 'HTTPS',
  settingsHttpsConfig: 'WebUI HTTPS Configuration',
  settingsHttpsTitle: 'WebUI HTTPS',
  settingsHttpsDomain: 'Primary domain',
  settingsHttpsEffective: 'Effective time',
  settingsHttpsExpiration: 'Expiration date',
  settingsHttpsPort: 'Port',
  settingsHttpsCert: 'SSL Certificate',
  settingsHttpsCertAuto: 'Auto (Self-signed certificate)',
  settingsHttpsCertCustom: 'Upload Certificate',
  settingsHttpsTrust: 'Trust Certificate',
  settingsHttpsDownloadCa: 'Download CA Certificate',
  settingsHttpsCertFiles: 'Certificate Files',
  settingsHttpsBothFiles: 'Please upload both PEM and CRT files.',
  settingsHttpsUploadFailed: 'Failed to upload certificate',
```

跑一致性守卫:
```bash
pnpm test src/i18n/parity.test.ts 2>&1 | tail -8
```

- [ ] **Step 3: 写 `SettingsRow` / `SettingsSwitch` 的失败测试**

`src/settings/components/SettingsRow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsRow from './SettingsRow.vue'

describe('SettingsRow', () => {
  it('渲染标签与右侧控件插槽', () => {
    const w = mount(SettingsRow, { props: { label: '壁纸' }, slots: { control: '<b class="x">ctl</b>' } })
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.x').exists()).toBe(true)
  })

  it('给了 sub 才渲染副标题', () => {
    expect(mount(SettingsRow, { props: { label: 'a' } }).find('.set-row-sub').exists()).toBe(false)
    expect(mount(SettingsRow, { props: { label: 'a', sub: 'v1.0' } }).find('.set-row-sub').text()).toBe('v1.0')
  })

  it('非 clickable 时根元素是 div,不可聚焦', () => {
    const w = mount(SettingsRow, { props: { label: 'a' } })
    expect(w.find('button.set-list-item').exists()).toBe(false)
    expect(w.find('.set-chevron').exists()).toBe(false)
  })

  it('clickable 时根元素是 button 并带 chevron,点击 emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.exists()).toBe(true)
    expect(w.find('.set-chevron').exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('disabled 的 clickable 行既带 disabled 属性,也确实不 emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true, disabled: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.attributes('disabled')).toBeDefined()
    // 只断言属性不够:@vue/test-utils 的 trigger 对 disabled 元素照样会派发,
    // 所以要真点一次,验证组件内那道 disabled 守卫也在。
    await btn.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('hint 插槽渲染在行下方(壁纸 D5 / 语言 D6 的说明位)', () => {
    const w = mount(SettingsRow, { props: { label: 'a' }, slots: { hint: '暂不可用' } })
    expect(w.find('.set-row-hint').text()).toBe('暂不可用')
  })
})
```

`src/settings/components/SettingsSwitch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSwitch from './SettingsSwitch.vue'

describe('SettingsSwitch', () => {
  it('role=switch + aria-checked 反映 modelValue', () => {
    const off = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻源' } })
    expect(off.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    expect(off.find('.set-switch').classes()).not.toContain('on')
    const on = mount(SettingsSwitch, { props: { modelValue: true, label: '新闻源' } })
    expect(on.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(on.find('.set-switch').classes()).toContain('on')
  })

  it('用 label 作 aria-label(纯图形开关,没有可见文字)', () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻源' } })
    expect(w.find('[role="switch"]').attributes('aria-label')).toBe('新闻源')
  })

  it('点击 emit 取反后的值(受控:自己不改状态)', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x' } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    // 受控组件:props 没变,class 也不该变
    expect(w.find('.set-switch').classes()).not.toContain('on')
  })

  it('disabled 时不 emit', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x', disabled: true } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

```bash
pnpm test src/settings/components/SettingsRow.test.ts src/settings/components/SettingsSwitch.test.ts 2>&1 | tail -12
```

- [ ] **Step 5: 实现 `SettingsRow.vue`**

```vue
<script setup lang="ts">
// 设置列表里一行的通用骨架。对位 Vue2 SettingsPanel.vue 的 .settings-list-item:
// 左侧标签(可带副标题)撑开、右侧放控件、可点的整行右端带 ›。
// Vue2 每行左侧还有一个 casa 图标字体的图标(b-icon pack="casa");
// New-UI 没有引入那套图标字体(仍是 CasaOS 品牌资源,见顶层 CLAUDE.md 的 iconfonts-casaos 记债),
// 故本期不渲染行内图标 —— 这是既有的图标体系差异,不是本期新增偏离。
import '../styles/settings.css'

defineProps<{ label: string; sub?: string; clickable?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div class="set-row-wrap">
    <component
      :is="clickable ? 'button' : 'div'"
      class="set-list-item"
      :class="{ clickable }"
      :type="clickable ? 'button' : undefined"
      :disabled="clickable && disabled ? true : undefined"
      @click="clickable && !disabled && emit('click')"
    >
      <span class="set-row-text">
        <span class="set-row-label">{{ label }}</span>
        <span v-if="sub" class="set-row-sub">{{ sub }}</span>
      </span>
      <span class="set-row-ctl"><slot name="control" /></span>
      <span v-if="clickable" class="set-chevron" aria-hidden="true">›</span>
    </component>
    <p v-if="$slots.hint" class="set-row-hint"><slot name="hint" /></p>
  </div>
</template>
```

- [ ] **Step 6: 实现 `SettingsSwitch.vue`**

```vue
<script setup lang="ts">
// 纯图形开关。照 SnapshotSettingsDialog.vue 的 .ss-switch 写法(role=switch + aria-checked +
// aria-label),不新增可见文字 —— 标签由所在的 SettingsRow 提供。
// 受控组件:自己不持状态,只 emit,由父组件决定是否落库后再改 v-model
// (开关类操作要"写成功才翻",失败要能弹回去)。
import '../styles/settings.css'

const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="set-switch"
    :class="{ on: modelValue }"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="toggle"
  ><span class="set-switch-thumb"></span></button>
</template>
```

- [ ] **Step 7: 追加 `settings.css` 的公共骨架样式**

追加到 `src/settings/styles/settings.css`(**颜色全部 token,禁字面量**):

```css
/* ── 设置列表(对位 Vue2 .settings-list / .group-list)────────────────── */
.set-list {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0 16px;
}
.set-row-wrap:not(:last-child) .set-list-item {
  border-bottom: 1px solid var(--border);
}
.set-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 0;
  border: 0;
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  text-align: left;
}
.set-list-item.clickable {
  cursor: pointer;
}
.set-list-item.clickable:hover {
  color: var(--accent-text);
}
.set-list-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.set-row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}
.set-row-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.set-row-sub {
  font-size: 12px;
  color: var(--fg-muted);
}
.set-row-ctl {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.set-chevron {
  color: var(--fg-faint);
  flex: 0 0 auto;
}
.set-row-hint {
  margin: -6px 0 10px;
  font-size: 12px;
  color: var(--fg-faint);
}

/* ── 开关(照 SnapshotSettingsDialog.vue 的 .ss-switch)──────────────── */
.set-switch {
  position: relative;
  width: 38px;
  height: 21px;
  flex: none;
  padding: 0;
  cursor: pointer;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--chip-bg);
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.set-switch.on {
  background: var(--accent);
  border-color: var(--accent);
}
.set-switch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.set-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--fg);
  transition: transform 0.15s var(--ease);
}
/* --on-accent 只有叠在 accent 实底上才可用 —— 这里正是那种情形 */
.set-switch.on .set-switch-thumb {
  transform: translateX(17px);
  background: var(--on-accent);
}

/* ── 表单控件(原生 select/input,全仓既有惯例:appearance:auto)─────── */
.set-select,
.set-input {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  max-width: 240px;
}
.set-select {
  appearance: auto;
}
.set-input {
  width: 92px;
}
.set-select:disabled,
.set-input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── 按钮 ────────────────────────────────────────────────────────────── */
.set-btn {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
}
.set-btn:hover:not(:disabled) {
  background: var(--chip-bg-hi);
}
/* 变体必须自带 :hover 背景 —— 基类 .set-btn:hover 的优先级(0,2,0)会压过变体
 * 的(0,1,0),否则 hover 时变体色被洗成默认底(newui-css-hover-specificity-trap)。 */
.set-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.set-btn.primary:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  filter: brightness(1.08);
}
.set-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── 大卡(设备信息卡等)────────────────────────────────────────────── */
.set-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 20px;
}

/* ── 状态文字 ────────────────────────────────────────────────────────── */
.set-ok {
  color: var(--success);
  font-size: 12px;
}
.set-info {
  color: var(--accent-text);
  font-size: 12px;
}
.set-warn {
  color: var(--set-warn-fg);
}
.set-danger {
  color: var(--remove-fg);
  font-size: 12px;
}
```

- [ ] **Step 8: 跑测试确认通过 + 任务门**

```bash
pnpm test src/settings src/styles src/i18n 2>&1 | tail -10
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 9: 提交**

```bash
git status --short   # 确认 3 行 design-export 的 D 还在原位
git add src/settings/components/SettingsRow.vue src/settings/components/SettingsRow.test.ts \
        src/settings/components/SettingsSwitch.vue src/settings/components/SettingsSwitch.test.ts
git commit src/settings/components/SettingsRow.vue src/settings/components/SettingsRow.test.ts \
           src/settings/components/SettingsSwitch.vue src/settings/components/SettingsSwitch.test.ts \
           src/settings/styles/settings.css src/styles/theme.sp9.css \
           src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts \
  -m "feat(settings): 行级原语 SettingsRow/SettingsSwitch + P1 文案与 token(SP9-P1)

- 一行的骨架抽成 SettingsRow(clickable 时渲染 button + ›)
- 开关照 SnapshotSettingsDialog 的 role=switch 写法,受控不自持状态
- .set-btn.primary 自带 :hover 背景(基类 hover 优先级更高会洗掉变体色)
- 新 token --set-warn-fg,两套主题块都给值
- 行内图标不渲染:New-UI 未引入 iconfonts-casaos,属既有图标体系差异"
```

---


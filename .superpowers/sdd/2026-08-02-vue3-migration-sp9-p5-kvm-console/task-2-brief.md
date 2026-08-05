## Task 2: 地基 —— token + i18n + 路由 + 空壳页

**Files:**
- Modify: `src/styles/theme.sp9.css`(追加 `--kvm-*`)
- Create: `src/kvm/styles/kvm.css`
- Modify: `src/i18n/zh_cn.sp9.ts` · `src/i18n/en_us.sp9.ts`
- Create: `src/kvm/views/KvmPage.vue` + `KvmPage.test.ts`
- Modify: `src/router/index.ts`
- Create: `src/kvm/styles/kvmStyles.test.ts`

**Interfaces:**
- Consumes: T1 的 util(暂不用)
- Produces:`/kvm` 路由(name `kvm`);`KvmPage.vue` 默认导出;`kvm.css` 里的 `.kvm-*` 类;i18n key 前缀 `kvm*`

- [ ] **Step 1: 追加 token 到 `src/styles/theme.sp9.css`**

在文件末尾**两个块内各追加同一组值**(注意:`:root` 块和 `:root[data-theme='light']` 块都要加,值相同):

```css
/* ── P5 KVM ──
 * ⚠️ KVM 区**固定深色,不跟随全局主题** —— Vue2 KVMFullPage.vue 是写死的深色控制台配色
 * (#0d1117 / #161b22 / #21262d / #30363d),浅色主题下也保持深色。所以下面每个 token
 * 在 :root 与 :root[data-theme='light'] 两块里是**相同的值**。
 * 先例:--console-bg / --console-fg(终端与日志面板)同样两套主题同值。
 * 唯一例外是安装横幅(--kvm-banner-*),Vue2 那块本来就是浅蓝底,照抄。 */
  --kvm-bg: #0d1117;
  --kvm-panel: #161b22;
  --kvm-elev: #21262d;
  --kvm-border: #30363d;
  --kvm-fg: #c9d1d9;
  --kvm-fg-dim: #8b949e;
  --kvm-fg-faint: #6e7681;
  --kvm-accent: #8950f2;
  --kvm-accent-soft: rgba(137, 80, 242, 0.15);
  --kvm-on-accent: #ffffff;
  --kvm-ok: #76b32d;
  --kvm-ok-glow: rgba(118, 179, 45, 0.5);
  --kvm-ok-glow-weak: rgba(118, 179, 45, 0.3);
  --kvm-ok-glow-strong: rgba(118, 179, 45, 0.8);
  --kvm-warn: #e0a800;
  --kvm-warn-glow-weak: rgba(224, 168, 0, 0.3);
  --kvm-warn-glow-strong: rgba(224, 168, 0, 0.8);
  --kvm-warn-border: rgba(224, 168, 0, 0.3);
  --kvm-danger: #f85149;
  --kvm-danger-soft: rgba(248, 81, 73, 0.15);
  --kvm-danger-glow-weak: rgba(248, 81, 73, 0.3);
  --kvm-danger-glow-strong: rgba(248, 81, 73, 0.8);
  --kvm-idle: #6e7681;
  --kvm-toggle-off: #484f58;
  --kvm-overlay: rgba(22, 27, 34, 0.92);
  --kvm-shadow: rgba(0, 0, 0, 0.4);
  --kvm-shadow-soft: rgba(0, 0, 0, 0.2);
  --kvm-banner-bg: #e3f2fd;
  --kvm-banner-border: #bbdefb;
  --kvm-banner-fg: #0d47a1;
  --kvm-banner-btn: #1976d2;
  --kvm-banner-btn-hover: #1565c0;
```

- [ ] **Step 2: 跑 token 守卫,确认两块一致**

Run: `pnpm vitest run src/styles/theme.sp9.test.ts`
Expected: PASS(若报「token 名集合不一致」= 有一块漏加,补齐)

- [ ] **Step 3: 写 `src/kvm/styles/kvmStyles.test.ts`(样式白名单守卫,失败)**

照 SP8 的 `knowledgeStyles.test.ts` 惯例:每期新增 scss/css 段要有类名白名单守卫,防止后续任务往里塞不在册的类。

```ts
/// <reference types="node" />
// 必须用 node:fs 读 .css —— `?raw` 对 .css 在 vitest 下恒为空串(见 color-guard.test.ts)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'kvm.css'),
  'utf8',
)

// 本期(P5)允许出现的类名。P6 加新块时往这里补,别偷偷塞。
const ALLOWED = new Set([
  'kvm-page', 'kvm-content', 'kvm-sidebar-toggle', 'toggle-icon', 'collapsed',
  'kvm-sidebar', 'kvm-header', 'kvm-header-left', 'kvm-header-text', 'kvm-header-right',
  'kvm-logo', 'kvm-title', 'kvm-status', 'kvm-settings-btn',
  'vm-list', 'empty-state', 'empty-icon', 'empty-text',
  'vm-list-item', 'active', 'vm-item-icon', 'os-icon', 'vm-item-info', 'vm-item-name',
  'vm-item-specs', 'vm-item-status', 'status-indicator', 'status-dot', 'status-text',
  'running', 'stopped', 'paused', 'suspended', 'error',
  'add-vm-btn', 'kvm-main', 'main-empty', 'empty-icon-ring', 'main-empty-icon',
  'vm-console-container', 'console-header', 'console-title', 'console-os-icon', 'console-status',
  'console-actions', 'action-btn', 'dropdown-wrapper', 'overflow-dropdown', 'dropdown-item',
  'is-danger', 'confirm-text-danger', 'toggle-indicator', 'on', 'dropdown-divider',
  'console-display', 'console-placeholder', 'console-hint', 'is-error', 'start-vm-btn',
  'power-icon', 'power-svg',
  'sendkey-toolbar', 'sendkey-divider', 'sendkey-btn', 'sendkey-hint', 'sendkey-img',
  'fullscreen-svg', 'sendkey-btn--fullscreen',
  'sendkey-slide-enter-active', 'sendkey-slide-leave-active',
  'sendkey-slide-enter-from', 'sendkey-slide-leave-to',
  'spice-info-bar', 'spice-info-content', 'spice-agent-hint', 'spice-info-close',
  'spice-toast-enter-active', 'spice-toast-leave-active',
  'spice-toast-enter-from', 'spice-toast-leave-to',
  'installation-banner', 'banner-content', 'banner-btn', 'is-loading',
  'kvm-progress-overlay', 'kvm-progress-card', 'kvm-progress-title', 'kvm-progress-msg',
  'kvm-spinner',
])

describe('kvm.css 类名白名单', () => {
  it('没有不在册的类名', () => {
    const used = new Set([...src.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
    expect([...used].filter((c) => !ALLOWED.has(c)).sort()).toEqual([])
  })
})

describe('kvm.css 不含裸颜色字面量(与全局 color-guard 双保险)', () => {
  it('所有颜色走 var(--kvm-*)', () => {
    // 去掉注释后再扫,避免注释里抄的 Vue2 色值被误判(color-guard 不剥注释,是已知坑,
    // 所以本文件的注释里**不要写** #hex)。
    const noComment = src.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComment).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(noComment.replace(/var\([^)]*\)/g, '')).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})
```

- [ ] **Step 4: 建 `src/kvm/styles/kvm.css`,先只放本任务用得到的段**

本步只写:`.kvm-page` / `.kvm-content` / `.kvm-sidebar`(含折叠)/ `.kvm-sidebar-toggle` / `.kvm-header` 系列 / `.vm-list` / `.empty-state` / `.add-vm-btn` / `.kvm-main` / `.main-empty` 系列。数值**逐字**照 Vue2 `KVMFullPage.vue:1658-1790`(布局)与 `:1975-2015`(main-empty)。颜色全部换成 `var(--kvm-*)`。

关键数值锚点(照抄,别改):侧栏 `width: 22rem`;折叠切换按钮 `left: 22rem` / `width: 1.5rem` / `height: 3rem` / `border-radius: 0 .5rem .5rem 0`,折叠态 `left: 0` 且圆角镜像、图标 `rotate(180deg)`;侧栏 `transition: width .25s ease`;折叠仅在 `@media (min-width: 769px)` 生效且把 logo/title/status/list/add 按钮/header 一并 `display:none`;`.kvm-header` padding `.5rem 1rem`;`.kvm-logo` 2rem;`.kvm-title` `.9rem/600`;`.kvm-status` `.75rem`,点 `.4rem` 圆、running 时 `box-shadow: 0 0 8px var(--kvm-ok-glow)`;`.vm-list` `flex:1; overflow-y:auto; padding:.5rem`;`.empty-state` padding `3rem 1rem`、图标 `opacity:.4`;`.add-vm-btn` `width: calc(100% - 1rem); margin:.5rem; padding:.75rem; border-radius:.5rem`;`.main-empty .empty-icon-ring` `120px` 方、`2px dashed var(--kvm-border)`、圆、`margin-bottom:1.5rem`;`.main-empty h3` `1.125rem/500`。

窄屏块(`@media (max-width: 768px)`,照 Vue2 `:2740-2759`):`.kvm-sidebar { width:100%; position:absolute; left:0; top:4rem; bottom:0; z-index:10; transform:translateX(-100%); transition:transform .3s }`,`.kvm-sidebar.active { transform:translateX(0) }`(Vue2 用的类名是 `.open`,但 `.open` 未在模板里出现过 —— 是死代码;这里改用已在册的 `active`,并注释登记)。

- [ ] **Step 5: 追加 i18n 键**

`src/i18n/zh_cn.sp9.ts` 末尾追加(**中文以 Vue2 `zh_CN.json` 为准**;先 `grep` 该文件,查不到的再看组件内联):

```ts
  // ── P5 KVM ──
  kvmTitle: 'NIMO 虚拟机',
  kvmRunningSuffix: '运行中',
  kvmNoVms: '暂无虚拟机',
  kvmAddVm: '添加虚拟机',
  kvmSelectVmTitle: '选择一台虚拟机',
  kvmSelectVmHint: '从列表中选择一台虚拟机以查看控制台并进行管理',
  kvmStateRunning: '运行中',
  kvmStateStopped: '已停止',
  kvmStatePaused: '已暂停',
  kvmStateSuspended: '已挂起',
  kvmStateError: '错误',
  kvmSettings: '设置',
  kvmSettingsDisabledHint: '停止虚拟机后才能修改设置',
  kvmMore: '更多',
  kvmComingSoon: '即将支持',
  kvmPowerOn: '开机',
  kvmForceShutDown: '强制关机',
  kvmForceRestart: '强制重启',
  kvmPause: '暂停',
  kvmResume: '继续',
  kvmWakeUp: '唤醒',
  kvmAutoStart: '开机自启',
  kvmDelete: '删除',
  kvmAreYouSure: '确定吗?',
  kvmStopping: '正在停止',
  kvmRestarting: '正在重启',
  kvmDeleting: '正在删除',
  kvmVncPortUnavailable: 'VNC 端口不可用,请尝试重启虚拟机',
  kvmVncFetchFailed: '获取 VNC 信息失败',
  kvmInstallingFromIso: '正在从 ISO 安装。安装完成后请点击:',
  kvmFinishedInstalling: '我已安装完成',
  kvmEjectSuccess: '安装介质已弹出,下次重启将从硬盘启动。',
  kvmEjectFailed: '弹出安装介质失败',
  kvmSpiceHint: '为获得更好体验,请使用 virt-viewer 客户端连接:',
  kvmSpiceAgentWin: '在虚拟机内安装 virtio-win 驱动以启用剪贴板、音频与 USB 功能',
  kvmSpiceAgentLinux: '在虚拟机内安装 spice-vdagent 以启用剪贴板、音频与 USB 功能',
  kvmToggleCtrl: '按住 Ctrl',
  kvmToggleAlt: '按住 Alt',
  kvmToggleShift: '按住 Shift',
  kvmToggleWin: '按住 Windows 键',
  kvmPressTab: '按 Tab',
  kvmPressEsc: '按 Esc',
  kvmPressCtrlAltDel: '按 Ctrl+Alt+Del',
  kvmFullscreen: '全屏',
  kvmExitFullscreen: '退出全屏',
  kvmClose: '关闭',
  kvmFailedStart: '启动虚拟机失败',
  kvmFailedStop: '停止虚拟机失败',
  kvmFailedRestart: '重启失败',
  kvmFailedPause: '暂停失败',
  kvmFailedResume: '继续失败',
  kvmFailedDelete: '删除虚拟机失败',
  kvmFailedAutostart: '保存设置失败',
  kvmToggleSidebar: '折叠/展开侧边栏',
```

`src/i18n/en_us.sp9.ts` 追加同名 key,英文照 Vue2 模板里的原文(`NIMO Virtual Machines` / `running` / `No virtual machines` / `Add VM` / `Select a Virtual Machine` / `Choose a VM from the list to view its console and manage it` / `Running` / `Stopped` / `Paused` / `Suspended` / `Error` / `Settings` / `Stop VM to modify settings` / `More` / `Coming soon` / `Power On` / `Force Shut Down` / `Force Restart` / `Pause` / `Resume` / `Wake Up` / `Auto Start` / `Delete` / `Are you sure?` / `Stopping VM` / `Restarting VM` / `Deleting VM` / `VNC port not available, try restarting` / `Failed to get VNC info` / `Installing from ISO. Click when finished:` / `I Finished Installing` / `Installation media ejected. VM will boot from hard disk on next restart.` / `Failed to eject installation media` / `For better experience, use virt-viewer client to connect:` / `Install virtio-win drivers in VM for clipboard, audio & USB features` / `Install spice-vdagent in VM for clipboard, audio & USB features` / `Toggle Ctrl` / `Toggle Alt` / `Toggle Shift` / `Toggle Windows` / `Press Tab` / `Press Esc` / `Press Ctrl+Alt+Del` / `Fullscreen` / `Exit Fullscreen` / `Close` / `Failed to start VM` / `Failed to stop VM` / `Failed to restart` / `Failed to pause` / `Failed to resume` / `Failed to delete VM` / `Failed to save settings` / `Toggle sidebar`)。

- [ ] **Step 6: 写 `src/kvm/views/KvmPage.test.ts`(失败)**

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KvmPage from './KvmPage.vue'
import { i18n } from '../../i18n'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { kvm: { getVMList: () => Promise.resolve({ data: [], total: 0 }) } },
}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => () => {} }) }))

const mountPage = () => mount(KvmPage, { global: { plugins: [i18n] } })

describe('KvmPage 壳', () => {
  it('渲染左栏标题与右侧空态', () => {
    const w = mountPage()
    expect(w.text()).toContain('NIMO 虚拟机')
    expect(w.text()).toContain('选择一台虚拟机')
  })

  it('侧栏折叠按钮点一下加 collapsed 类,再点去掉', async () => {
    const w = mountPage()
    const btn = w.get('.kvm-sidebar-toggle')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
  })

  it('折叠态下鼠标移入侧栏会临时展开(Vue2 isSidebarCollapsed = collapsed && !hover)', async () => {
    const w = mountPage()
    await w.get('.kvm-sidebar-toggle').trigger('click')
    await w.get('.kvm-sidebar').trigger('mouseenter')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await w.get('.kvm-sidebar').trigger('mouseleave')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
  })

  it('折叠按钮有 aria-label(图标按钮硬约束)', () => {
    expect(mountPage().get('.kvm-sidebar-toggle').attributes('aria-label')).toBeTruthy()
  })
})
```

- [ ] **Step 7: 实现 `src/kvm/views/KvmPage.vue`(本任务只做壳)**

```vue
<script setup lang="ts">
// KVM 区主页(路由 /kvm)。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue。
// P5 = 列表 + 控制台 + 电源;P6 补创建向导 / VM 设置 / 快照 / 全局设置。
//
// ⚠️ 本区**固定深色,不跟随全局主题** —— Vue2 该页是写死的深色控制台配色,
// --kvm-* token 在两个主题块里同值(见 styles/theme.sp9.css 注释)。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../styles/kvm.css'

const { t } = useI18n()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover ——
// 折叠后鼠标移上去临时展开,移开又收回。照抄。
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)
</script>

<template>
  <div class="kvm-page">
    <div class="kvm-content">
      <button
        class="kvm-sidebar-toggle"
        :class="{ collapsed }"
        :aria-label="t('kvmToggleSidebar')"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <span class="toggle-icon" aria-hidden="true">‹</span>
      </button>

      <aside
        class="kvm-sidebar"
        :class="{ collapsed }"
        @mouseenter="sidebarHover = true"
        @mouseleave="sidebarHover = false"
      >
        <header class="kvm-header">
          <div class="kvm-header-left">
            <div class="kvm-header-text">
              <h2 class="kvm-title">{{ t('kvmTitle') }}</h2>
            </div>
          </div>
        </header>
        <div class="vm-list" />
      </aside>

      <main class="kvm-main">
        <div class="main-empty">
          <div class="empty-icon-ring">
            <span class="main-empty-icon" aria-hidden="true">▭</span>
          </div>
          <h3>{{ t('kvmSelectVmTitle') }}</h3>
          <p>{{ t('kvmSelectVmHint') }}</p>
        </div>
      </main>
    </div>
  </div>
</template>
```

> 注:`‹` / `▭` 是**临时占位单色符号**,T4/T8 会换成从 Vue2 拷来的 svg 或既有图标组件。**不许用 emoji**。

- [ ] **Step 8: 接路由 `src/router/index.ts`**

顶部加 `import KvmPage from '../kvm/views/KvmPage.vue'`;`routes` 数组里、`...settingsRoutes` 之后加一行:
```ts
  { path: '/kvm', name: 'kvm', component: KvmPage },
```
**注意**:必须加在 `{ path: '/files/:path(.*)*' }` **之前**(那条是通配兜底)。桌面磁贴翻路由归 P8,现在只能手输 `#/kvm`。

- [ ] **Step 9: 跑测试**

Run: `pnpm vitest run src/kvm/ src/styles/ src/i18n/` 然后 `pnpm test && pnpm vue-tsc --noEmit`
Expected: 全绿;i18n parity 不报缺键

- [ ] **Step 10: 起 dev server 目视确认形状**

Run: `pnpm dev --host`(端口 5273),浏览器开 `http://<ip>:5273/app/#/kvm`
Expected: 深色底、左侧 22rem 侧栏带标题、右侧虚线圆环空态、折叠按钮能收放侧栏

- [ ] **Step 11: 提交**

```bash
git add src/kvm/views/ src/kvm/styles/ src/styles/theme.sp9.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/router/index.ts
git commit -m "feat(kvm): 地基 —— token 分片/文案/kvm.css/路由 /kvm/ 空壳页"
```

---


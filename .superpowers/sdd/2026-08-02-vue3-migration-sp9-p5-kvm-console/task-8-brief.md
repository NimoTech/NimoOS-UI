## Task 8: 安装横幅 + SPICE 提示条 + 收尾

**Files:**
- Create: `src/kvm/components/InstallBanner.vue` + `InstallBanner.test.ts`
- Create: `src/kvm/components/SpiceInfoBar.vue` + `SpiceInfoBar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css`

**Interfaces:**
- `InstallBanner` props `{ busy: boolean }`,emit `finish`
- `SpiceInfoBar` props `{ hostname: string, spicePort: number, isWindowsGuest: boolean }`,emit `close`

**显示条件**(照 Vue2,逐字):
- 安装横幅:`vm.state === 'running' && !vm.bootFromDisk && vm.iso`
- SPICE 条:`vm.spicePort > 0 && vm.bootFromDisk && !dismissed`
- SPICE 条 **180 秒后自动收起**(Vue2 `:748-752` 的 `spiceTimer`);切换 VM 时 `dismissed` 复位、计时器重置

- [ ] **Step 1: 写两个组件的测试(失败)**

```ts
// InstallBanner.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InstallBanner from './InstallBanner.vue'
import { i18n } from '../../i18n'

const mk = (busy = false) => mount(InstallBanner, { props: { busy }, global: { plugins: [i18n] } })

describe('InstallBanner', () => {
  it('显示提示文案与按钮', () => {
    const t = mk().text()
    expect(t).toContain('正在从 ISO 安装')
    expect(t).toContain('我已安装完成')
  })
  it('点按钮 emit finish', async () => {
    const w = mk(); await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toHaveLength(1)
  })
  it('busy 时按钮加 is-loading 类且不可重复点', async () => {
    const w = mk(true)
    expect(w.get('.banner-btn').classes()).toContain('is-loading')
    await w.get('.banner-btn').trigger('click')
    expect(w.emitted('finish')).toBeUndefined()
  })
})
```

```ts
// SpiceInfoBar.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpiceInfoBar from './SpiceInfoBar.vue'
import { i18n } from '../../i18n'

const mk = (p: Record<string, unknown> = {}) =>
  mount(SpiceInfoBar, { props: { hostname: '192.168.1.10', spicePort: 5901, isWindowsGuest: false, ...p },
    global: { plugins: [i18n] } })

describe('SpiceInfoBar', () => {
  it('拼出 spice:// 连接串', () => {
    expect(mk().get('code').text()).toBe('spice://192.168.1.10:5901')
  })
  it('Linux 客户机提示装 spice-vdagent', () => {
    expect(mk().text()).toContain('spice-vdagent')
  })
  it('Windows 客户机提示装 virtio-win', () => {
    expect(mk({ isWindowsGuest: true }).text()).toContain('virtio-win')
  })
  it('关闭按钮 emit close 且有 aria-label', async () => {
    const w = mk()
    expect(w.get('.spice-info-close').attributes('aria-label')).toBeTruthy()
    await w.get('.spice-info-close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 实现两个组件**

`InstallBanner` 样式照 Vue2 `:3096-3147` —— **这是全页唯一的浅色块**(浅蓝底 `var(--kvm-banner-bg)`、`1px solid var(--kvm-banner-border)` 下边框、字 `var(--kvm-banner-fg)`、按钮 `var(--kvm-banner-btn)` + hover `var(--kvm-banner-btn-hover)`、`is-loading` 时字透明 + 白色转圈 `::after`)。`SpiceInfoBar` 照 `:2796-2865`(顶部居中悬浮、`var(--kvm-overlay)` 底 + `var(--kvm-warn-border)` 边、字 `var(--kvm-warn)`、`backdrop-filter: blur(8px)`、`max-width:36rem`、进出场 `spice-toast-*` 过渡)。

- [ ] **Step 3: 接进 `KvmPage.vue` + 180 秒计时器**

```ts
// SPICE 提示条 180 秒后自动收起(Vue2 :748-752)。切 VM 时复位并重新计时。
const spiceDismissed = ref(false)
let spiceTimer: ReturnType<typeof setTimeout> | undefined
watch(() => selectedVM.value?.id, () => {
  spiceDismissed.value = false
  clearTimeout(spiceTimer)
  if (selectedVM.value) spiceTimer = setTimeout(() => { spiceDismissed.value = true }, 180_000)
})
onUnmounted(() => clearTimeout(spiceTimer))
```

`isWindowsGuest` 派生照 Vue2 `:715-719`:`os` 含 `win`(大小写不敏感)即为真。

`ejectInstallMedia` 接到横幅的 `finish`,`busy` 用一个 ref 挡重复点。

给 `KvmPage.test.ts` 补:
```ts
it('running + 未从硬盘启动 + 有 iso → 显示安装横幅', ...)
it('已从硬盘启动 → 不显示安装横幅', ...)
it('spicePort>0 且 bootFromDisk → 显示 SPICE 条', ...)
it('180 秒后 SPICE 条自动消失(vi.useFakeTimers)', ...)
it('切换 VM 时 SPICE 条重新出现并重新计时', ...)
it('点安装横幅按钮调 setBootFromDisk(id,true)', ...)
```

- [ ] **Step 4: 整页收尾自查**

- [ ] `pnpm test` 全量,与基线(324 文件 / 2660 例)比对,**不新增红**
- [ ] `pnpm vue-tsc --noEmit` 零错
- [ ] `pnpm build` 通过
- [ ] `pnpm vitest run src/styles/color-guard.test.ts src/styles/theme.sp9.test.ts src/kvm/styles/kvmStyles.test.ts` 三个守卫全绿
- [ ] i18n parity 测试绿(zh/en 键集合一致)
- [ ] `grep -rn "console.log" src/kvm/` 零命中
- [ ] 窄屏(~420px)自查:侧栏变全宽抽屉、控制台不横向溢出
- [ ] **静态截图自查**(记忆 `headless-chrome-screenshot-check`):用缓存里的 chromium 对 `#/kvm` 截图,确认没有空方框字形、没有溢出

- [ ] **Step 5: 提交 + 写台账**

```bash
git add src/kvm/ src/styles/theme.sp9.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/router/index.ts
git commit -m "feat(kvm): 安装横幅 + SPICE 提示条 + P5 收尾(整页组装/窄屏/三门全绿)"
```

台账写到 `NimoOS-New-UI/.superpowers/sdd/sp9/06-p5.md`(**gitignore,不进 git**),内容:各任务坐标 commit、偏离登记(3 处)、暂缺登记(1 处)、验收清单、挂账项。

---

## 真机验收清单(交给用户,每屏写清点击路径)

**前置**:`cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host`,浏览器开 `http://<本机IP>:5273/app/#/kvm`。
⚠️ **不要用 `deploy.sh`** —— 那会覆盖 SP6 的 `/app/`(记忆 `sp7-acceptance-dev-server` 同理)。

| # | 点击路径 | 预期 |
|---|---|---|
| 1 | 打开 `#/kvm` | 深色页面;左栏 22rem 宽,标题「NIMO 虚拟机」,下方「1 / 1 运行中」,状态点绿色**呼吸** |
| 2 | 看左栏列表 | 一行 `sp9-alpine-test`,左侧 Linux 图标,规格「2 vCPU / 1.0 GB」,右侧绿点 + 「运行中」 |
| 3 | 点这一行 | 右侧出现控制台,头部显示名字与 OS 图标;**几秒内出现 Alpine 的登录画面**(黑屏见下方排障) |
| 4 | 鼠标移到控制台**右侧边缘 80px 内** | 竖排工具条从右侧滑出:Ctrl / Alt / Shift / ⊞ / Tab / Esc / ─ / Ctrl+Alt+Del / 全屏 |
| 5 | 点 `Ctrl` | 按钮变紫底白字(按住态);再点一次复原 |
| 6 | 点 `Ctrl+Alt+Del` | Alpine 控制台应有反应(通常触发重启序列);**若你不想重启这台机器就跳过此项** |
| 7 | 点全屏按钮 | 控制台铺满屏幕、圆角消失,工具条仍在;按 Esc 或再点一次退出 |
| 8 | 点控制台头右上 `⋮` | 菜单弹出。running 态应看到:强制关机 / 强制重启 / 暂停 / 开机自启。**不应有**「开机」和「删除」 |
| 9 | 点「暂停」 | 立即执行(无需确认)。VM 状态变「已暂停」、点变黄呼吸、控制台断开并出现**继续大按钮** |
| 10 | 点控制台中央的继续大按钮 | VM 回到「运行中」,控制台画面重新出现 |
| 11 | `⋮` → 点「强制关机」**一次** | 文字原地变红色「确定吗?」,**不发请求**、VM 不停 |
| 12 | 点页面别处 | 菜单收起;再打开菜单,文字应已复原成「强制关机」(确认态被清掉) |
| 13 | `⋮` → 「强制关机」点**两次** | 弹出「正在停止」遮罩;完成后 VM 变「已停止」、灰点、控制台出现**开机大按钮** |
| 14 | 点开机大按钮 | VM 回到「运行中」,控制台画面出现 |
| 15 | `⋮` → 「强制重启」点两次 | 弹出「正在重启」遮罩;VM 保持运行,控制台**先断开,几秒后自动重连**(这是修过 Vue2 竞态的地方,重点看它会不会卡在红字错误上) |
| 16 | `⋮` → 点「开机自启」 | 左侧小圆点由灰变绿;再点一次变回灰 |
| 17 | 停机后 `⋮` | 应出现「开机」和「删除」,且「删除」上方有一条分隔线 |
| 18 | 点「删除」**一次** | 文字变红「确定吗?」。**⛔ 到此为止,不要点第二次**(见下方挂账 D33) |
| 19 | 看左栏底部「添加虚拟机」按钮 与 头部齿轮 | 两者都**灰色不可点**,鼠标悬停显示「即将支持」 |
| 20 | 看控制台头的齿轮(Settings) | 同样灰色不可点,悬停提示「即将支持」 |
| 21 | 点左栏与控制台之间那个竖条按钮 | 侧栏收起、按钮翻转到最左;鼠标移到最左侧栏区域,侧栏**临时滑出**,移开又收回 |
| 22 | 把浏览器拖窄到 ~420px | 侧栏变成全宽抽屉;控制台不横向溢出 |

**控制台黑屏排障**:浏览器直连 `ws://<本机IP>:5700`,不走网关、无鉴权。若黑屏,先在浏览器控制台看有没有 WebSocket 连接失败;有的话是防火墙挡了 5700,不是前端问题。

### 本期没能验的(挂账,不算验收失败)

| 编号 | 内容 | 为什么验不了 | 覆盖方式 |
|---|---|---|---|
| D33 | 真删除 VM | 本机只有一台测试 VM,删了 P6 就没得验 | 单测覆盖二次确认闸门 + 变异验证(跳过确认必翻红);P6 能建一次性 VM 后补真删一次 |
| D34 | `wakeup`(唤醒) | 造不出 `suspended` 态(需要 libvirt managedsave / S3),按交付政策二不列验收项 | 单测覆盖派生与调用 |
| D35 | SPICE 提示条 | 只在 `bootFromDisk=true` 且 `spicePort>0` 时出现,本机 VM 是 `bootFromDisk=false`(还挂着安装 ISO) | 单测覆盖显示条件与 180s 自动收起 |
| D36 | 安装横幅的「我已安装完成」 | 点了会把 VM 的启动项永久改成硬盘,这台测试机还挂着 alpine ISO,改了 P6 验创建流程时要重来 | 单测覆盖 `setBootFromDisk(id, true)` 调用 |

---

## 债务与后续

- **D8 销号** —— spec §6.1 记的「KVM 改事件驱动」不是债务,Vue2 本来就是事件驱动,P5 照做了。
- **P6 待接**:VM 列表为空时自动弹创建弹窗(Vue2 `:906`)· Add VM / 齿轮 / Settings 三个入口解禁 · OSSelector · 快照 tab · 全局设置。
- **P8 待接**:桌面磁贴 / 旧 UI 入口翻 `/kvm` 路由 + 回退 flag(`strangler:disabled:/kvm`)。**P1 就翻路由却没留回退 flag 的教训见 SP6-P6,别重犯。**
- **后端票**:`GET /v1/kvm/vms` 不返回 `spicePort`,逼前端做保活合并(见 `spicePreserve.ts` 注释)。宜在列表接口里一并返回。

---

## 自查(写 plan 时已跑)

**spec 覆盖**:§6.1 逐项对照 —— VM 列表(T4)· 状态点/规格/运行计数/侧栏折叠(T2/T4)· 控制台头/动作区/溢出菜单(T5)· 六个电源动作 + 七个 `can*` 派生(T1/T3/T5)· 全屏(T7)· Send Key 工具条(T7)· 安装横幅(T8)· SPICE 提示条(T8)· noVNC RFB 参数与 wsUrl(T6)· spicePort 保活(T1/T3)· `kvm` 域 25 方法 + 信封层数写死(T0)。**全部有落点。**

**类型一致性**:`KvmVM` / `KvmVncInfo` / `KvmSettings` 在 T0 定义,T1/T3/T6 消费的字段名与之一致(`state` / `spicePort` / `spiceTlsPort` / `vncWebsocketPort` / `bootFromDisk` / `os`)。`preserveSpice` 在 T1 定义、T3 消费,签名一致。`stateLabelKey` 在 T1 定义、T4/T5 消费。`useVmList` / `useVncConsole` 的返回签名在各自任务的 Interfaces 块里写死,T5/T6/T7/T8 按此消费。

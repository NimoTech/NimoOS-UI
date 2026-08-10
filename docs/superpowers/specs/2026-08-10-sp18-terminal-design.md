# SP18 终端区设计（/terminal 页 + 桌面磁贴 + 设置 Security 段）

日期:2026-08-10 · 分支:`sp18-terminal`(基座 master@266d5ad) · 起跑线:`docs/superpowers/2026-08-10-sp18-terminal-kickoff.md`

## 0. 背景与范围

后端 `NimoOS-Terminal`(ttyd + tmux + 薄 Go)已冷装完成并在设备上 active。机主拍板三件一起做、不拆期:

1. **`/terminal` 页**:iframe 套 ttyd + 窗口 tab 条 + keepalive 心跳 + 密码 step-up + 空闲锁
2. **桌面 admin-only 终端磁贴**(叠加服务探针)
3. **设置「终端」tab 的 Security 段**(锁策略),替掉现在的「终端不可用」空态

理由:锁策略在设置里改、在终端页上生效,分开做会得到「能锁但改不了策略」的中间态。

**蓝本**:Vue2 `src/views/Terminal.vue`(241 行,#39)+ `src/components/settings/TerminalSecuritySection.vue`
+ `builtInApps.js` 第 7 项,一律 `git show FETCH_HEAD:` 读(工作树在旧分支)。
界面严格 1:1,但不照抄 bug/竞态(逐条登记,见 §3.4、§6.3)。

**本期不做**:任何 wsssh 相关(Vue2 #97 已删除,New-UI 从未有过);ttyd 内部主题定制;
移动端软键盘适配超出 Vue2 已有行为的部分;ShellUser 改配置(机主拍板保持 root)。

## 1. 四个开工决策(机主 2026-08-10 拍板)

| # | 问题 | 决定 |
|---|---|---|
| 1 | 主题 | **UI 部件全部跟随主题**(tab 条/锁屏/错误态用 theme token);页面上唯一恒深的是终端台面本身(`--console-bg`,既有第三方例外 token) |
| 2 | 外壳 | **走 `AreaShell`**,与其它区一致;不照 Vue2 全屏 `inset:0` |
| 3 | 磁贴门控 | **isAdmin + 服务探针**,照 `probeKvm` 那套扩;探针把 2xx/401/403 都算「服务在」 |
| 4 | ShellUser | **保持 root**(`/etc/nimoos/terminal.conf` 的 `ShellUser` 留空不动);验收时打开是 root shell 属预期 |

设计基调(机主开场指定):符合主页/files/appstore/settings/photos 的统一弧度与配色,
复用 appstore/kvm 已有组件语言。**视觉先例 = `src/apps/views/AppConsolePage.vue` + `src/apps/console/TerminalPane.vue`**
(SP5-P6 应用控制台:AreaShell + chip token 的 tab + `--console-bg` 深色终端台面、12px 圆角)。

## 2. 后端契约(权威表在 `NimoOS-Terminal/OVERVIEW.md`,此处只记前端消费面)

全部前缀 `/v1/terminal`。**裸 JSON,无 `Result` 信封,不过 `unwrap()`**(Vue2 直接读
`r.data.mode`、`e.response.data.password_required`,已核实)。

| 方法 | 路径 | 前端关注 |
|---|---|---|
| POST | `/session` | 换票。401+`{password_required, mode, idle_minutes}`=要密码;401 无该字段=密码错;403=非 admin;429+`{retry_after_seconds}`=冻结(后端 5 次/15 分钟按用户名);2xx 返 `{mode, idle_minutes}` |
| DELETE | `/session` | 清 cookie 票(不拆 tmux、不停 ttyd) |
| POST | `/keepalive` | 续票;401 ⇒ 回锁屏 |
| GET/PUT | `/settings` | `{mode, idle_minutes}`;PUT 要带 `password`;任何改动使旧票失效 |
| GET/POST | `/windows` | 列窗口 `[{index,name,active}]` / 新建 |
| POST | `/windows/:i/select` · DELETE `/windows/:i` · PUT `/windows/:i` | 切换 / 关闭(关最后一个 409)/ 重命名(体 `{name}`) |
| ANY | `/*` | 反代 ttyd 页面与 WS ⇒ iframe `src="/v1/terminal/"` |

票是 HMAC cookie(`nimoos_term`, Path=/v1/terminal, HttpOnly)⇒ **前端只能 iframe,不能自己接 WS**。

已知边界(照着设计错误态):
① 服务重启 ⇒ 密钥重生 ⇒ 所有票失效,前端靠 401 自愈回 `/session`;
② 票过期不掐已建立的 WS,空闲锁锁的是「再进入」不是「踢下线」;
③ `DELETE /session` 不销毁 tmux ⇒ 重新输密码**原样恢复现场**(锁屏文案要传达这层语义);
④ 动态 ShellUser 下 ttyd 懒启动,首开会慢(本期 ShellUser 留空,root 模式,ttyd 常驻,不受此影响)。

## 3. 架构(方案 B:composable 拆解,机主已选)

### 3.1 服务客户端 `packages/service/src/terminal.ts`

照 `kvm.ts` 形状,`index.ts` 挂 `service.terminal` 并导出类型。文件头注释登记「裸 JSON 无信封」。

```ts
export type TerminalMode = 'off' | 'on_open' | 'idle'
export interface TerminalSettings { mode: TerminalMode; idle_minutes: number }
export interface TerminalWindow { index: number; name: string; active: boolean }
export interface TerminalSessionInfo { mode: TerminalMode; idle_minutes: number }

createTerminal(http): {
  createSession(password?): Promise<TerminalSessionInfo>
  deleteSession(): Promise<void>
  keepalive(): Promise<void>
  getSettings(): Promise<TerminalSettings>
  putSettings(body: { mode; idle_minutes; password }): Promise<void>
  listWindows(): Promise<TerminalWindow[]>
  newWindow(): Promise<void>
  selectWindow(i): Promise<void>
  closeWindow(i): Promise<void>
  renameWindow(i, name): Promise<void>
}
```

错误语义(`password_required`/`retry_after_seconds`)由调用方从 axios error 读,客户端保持薄。

### 3.2 终端页 `src/terminal/`(路由 `/terminal`,加在通配兜底之前)

- **`useTerminalSession.ts`** —— 五态状态机 `loading / forbidden / error / locked / ready`,纯逻辑不碰 DOM:
  - `provision()`:POST /session 无密码 → 2xx=ready;401+password_required=locked(记下 mode/idle_minutes);403=forbidden;其它=error(带重试按钮)。
  - `submitPassword(pw)`:429 → 冻结倒计时(秒级 interval);403 → forbidden;无响应或 ≥500 → error;其余 401 → 行内「密码错误」;2xx → ready。
  - ready 后:keepalive interval(`on_open`=30s,其它=60s);**idle 模式只在上一周期有活动时才续票**;keepalive 401 → `lock()`。
  - idle 模式:到点前 60s 置预警(`Math.max(ms-60000, 0)`,1:1);到点 `lock()`;活动信号由外部 `notifyActivity()` 喂入(重置计时、清预警、标记 activitySince)。
  - `lock()`:清计时器、清 iframe src、回 locked(tmux 仍活着)。
  - `mode==='on_open'` 时页面卸载 / `beforeunload` 发 `DELETE /session`(best-effort)。
- **`useTerminalWindows.ts`** —— 窗口列表 3s 轮询 + select/new/close/rename;任何 401 回调 `onAuthLost`(→ lock);关最后一个窗口的 409 静默忽略(1:1);改名去空白后为空则放弃(1:1)。
- **`TerminalView.vue`** —— 装配层,唯一碰 DOM 的地方:
  - 套 `AreaShell`(title=终端)。内容区照 AppConsolePage 骨架:桌面态顶部一行「`‹ 返回` + 标题 + 窗口 tab 条」,下面深色终端台面(`--console-bg`、12px 圆角、iframe 铺满,`v-show` ready)。
  - 活动监听:`keydown/mousedown/wheel/touchstart` capture,挂 window 与 iframe `contentDocument` 两处;iframe 侧等 `@load` 后再绑(照 Vue2 的正确时序,绑早了拿到的是导航前空白文档);卸载/lock 时对称解绑。
  - iframe `src` 只在 ready 时是 `/v1/terminal/`,lock 后清空(断开渲染,WS 由浏览器随文档销毁)。
- **`TerminalTabs.vue`** —— tab 条:单击切换、双击进入改名输入框(enter/blur 提交)、`×` 关闭、`＋` 新建。chip token(`--chip-bg`/`--chip-bg-hi`/`--card-border`),激活态对齐 `.console-tabs button.on`。
- **`TerminalLockCard.vue`** —— 居中卡片(card token):标题「请输入密码以打开终端」+ 副标题传达边界③语义(会话仍在,解锁后原样恢复)+ 密码框 + 解锁按钮;「密码错误」「尝试次数过多,请 {s} 秒后再试。」内联显示;冻结时输入与按钮禁用(1:1)。
- 预警条:ready 态顶部居中悬浮「终端即将锁定 — 按任意键保持连接」,warning token(不写死 `#b45309`)。

### 3.3 桌面磁贴

- `systemApps.ts`:`SystemApp` 加 `adminOnly?: true`;`requiresService` 放宽为 `'kvm' | 'terminal'`;
  新增第 9 项 `{ key: 'terminal', name: 'Terminal', label: 'appTerminal', adminOnly: true, requiresService: 'terminal', icon: terminal.svg }`。
  图标从 Vue2 `src/assets/img/app/terminal.svg` 原样拷入 `src/home/apps/icons/`;`.ic-terminal` 渐变兜底已在 theme.css(既有)。
- `apps.ts` store:照 `kvmAvailable`/`probeKvm` 同款加 `terminalAvailable`(**`null`=未探测必须渲染成可用**,防闪烁,同 KVM 注释);
  `probeTerminal()` 打 `service.terminal.getSettings()`:**2xx/401/403 = 服务在**(403 恰好证明服务活着),
  404/5xx/网络错 = 未装;`loadGrid()` 的 `Promise.all` 并行加一枪。
  `setApps` 的系统应用 filter 叠 `adminOnly` 检查,读 `useSessionStore().isAdmin`(Vue2 前端过滤,1:1)。
- `useOpenAction.ts`:`terminal` 磁贴 → `router.push('/terminal')`;**不设 `strangler:disabled` flag**
  (照 knowledge 先例:Vue2 已于 08-07 从设备下线,无回退目标)。

### 3.4 设置区 Security 段

- 新建 `src/settings/panels/terminal/TerminalSecuritySection.vue`;`TerminalPanel.vue` 替掉空态那块,
  **日志卡及其 5s 轮询一行不动**。
- 界面 1:1 照 Vue2:三档单选行(从不锁定 / 打开时询问一次 / 询问+空闲后自动锁定)+ idle 分钟数(1-240,仅 idle 档显示)
  + 保存 → **内联**密码确认(非弹窗,照 Vue2;报错内联在按钮旁,符合本仓惯例)+ 429 冻结倒计时 + 「已保存」提示。
  样式用 settings.css 既有 `set-*` 词汇 + theme token,单选圆点对齐本仓既有 radio 形状(勿写死 `#8950f2`)。
- 门控与纠偏(登记):
  1. **非 admin 整段不渲染**(v-if `isAdmin`,Vue2 同款),此时面板只剩日志卡。
  2. **服务不可用时不摆假表单**(对 Vue2 的纠偏,它取数失败静默用默认值、表单照常可交互):
     `load()` 挂载取数,404/网络错 → 渲染现有「终端不可用」空态(复用现文案);2xx → 表单。
  3. 保存成功后后端作废所有旧票 —— 无需额外处理,终端页 401 自愈已覆盖。

## 4. 正确性约束(对 Vue2 的偏离登记,全局约束落点)

1. **过期守卫(全局约束)**:Vue2 的 keepalive/窗口轮询响应落定不看会话代际。本期每次 lock/unlock 递增 epoch,
   异步响应落定时代际不符则丢弃(不写状态)。回归测试走交错路径(lock 后旧 keepalive 才落定)。
2. 计时器全部集中 teardown(组件卸载、lock、重新 provision 三处都要清干净);
   Vue2 的 `teardownTimers`/`unbindActivity` 对称性照搬并补 epoch。
3. 锁屏副标题补「会话仍在,解锁后原样恢复」语义(后端边界③,Vue2 界面缺失,属正确性补充非视觉偏离)。
4. 设置段服务不可用 → 空态(见 §3.4-2)。
5. 其余状态机分支逐条 1:1(429/403/5xx、`password_required` 判定、idle 只在活动后续票、
   预警 60s 提前量、窗口 409/改名空白规则)。

## 5. i18n

新增分期文件 `src/i18n/zh_cn.sp18.ts` / `en_us.sp18.ts`(照 sp9 组织方式,扁平 camelCase 键):

- Vue2 `terminal.*` 22 键 → `termLoading / termAdminOnly / termUnavailable / termRetry / termLockedTitle /
  termPwPlaceholder / termPwWrong / termUnlock / termFrozen / termIdleWarn / termSecTitle / termModeOff /
  termModeOnOpen / termModeIdle / termIdleMinutes / termSave / termSaved / termConfirmPwHint / termSaveFailed /
  termNewWin / termCloseWin` 等。**中文逐字照 Vue2 zh_CN.json,英文照 en_US.json**(`newui-zh-copy-source-of-truth`)。
- 另加:磁贴名 `appTerminal`(zh: 终端 / en: Terminal);锁屏副标题一键(§4-3,中文自拟,验收时机主过目);
  终端页返回按钮复用既有 `areaBackHome` 类词汇,能复用则不新增。
- `src/i18n/parity.test.ts` 自动守双语一致。

## 6. 测试

- `useTerminalSession`(fake timers,交错路径):`password_required` 401→locked;错密码 401→行内错;
  429 冻结倒计时(到 0 解禁);403→forbidden;5xx/无响应→error;keepalive 401→自愈回 locked;
  idle 无活动不续票/有活动续票;预警 60s 提前量;`on_open` 卸载发 DELETE;
  **epoch 守卫**:lock 后旧 keepalive/窗口响应落定不写状态。
- `useTerminalWindows`:3s 轮询、select/new/close/rename、401→onAuthLost、关最后窗口 409 静默、改名空白放弃。
- 组件:`TerminalTabs`(切换/双击改名/关闭/新建)、`TerminalLockCard`(禁用态/错误文案)、
  `TerminalSecuritySection`(load 404→空态、保存 401/429/成功分支、非 admin 不渲染)、
  `TerminalView` 装配冒烟(五态渲染切换)。
- `apps.ts`:探针三分类(2xx/401/403=在;404/网络=不在;null=渲染可用)、adminOnly 过滤。
- 测试描述一律英文(SP12 拍板)。fixture 里的错误体形状照 §2 契约,不凭想象手编
  (`newui-fixture-from-imagination-trap`;本期错误体字段已从 Vue2 消费代码逐字核过)。

## 7. 收尾门(全局约束)

`pnpm exec vue-tsc --noEmit` · 全量 `pnpm test`(含 parity)· `pnpm build` ·
`node oss/export.mjs --no-commit`(**先提交再跑**,脏树假红)。
终端属系统管理功能,不在 AI/相册/搜索剔除面 ⇒ 预期全量进开源树,manifest 无需 PATCH;
plan 里仍放一步「导出树能构建」验证(SP9 起的既有门)。

## 8. 验收要点(给验收清单的种子,plan 里展开)

- ShellUser 保持 root:打开终端是 root shell 属预期,别当 bug。
- 后端锁策略当前值决定首开路径:`off` 直接 ready;`on_open`/`idle` 先见锁屏 —— 验收前先在设置段看一眼当前档位。
- 服务重启后旧票全失效:终端页应经 401 自愈回锁屏/重新换票,不许白屏。
- 磁贴:admin 可见、非 admin 不可见;停掉 `nimoos-terminal.service` 后刷新,磁贴应消失(探针 404/网络错)。
- 锁屏解锁后 tmux 现场原样恢复(边界③)。

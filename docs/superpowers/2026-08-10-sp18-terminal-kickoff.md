# SP18 终端区 —— 开工交接（brainstorm 未做，故意留给新会话）

**这份文档不是设计，是给新会话的起跑线。** 2026-08-10 在一个已经扛着 SP12 合并 + 非文件区差集审计 +
终端后端冷装的会话里摸完了上下文，机主拍板「换个干净会话做」，所以**只落盘事实，不落盘设计决策**。
新会话请从 `superpowers:brainstorming` 开始，把下面 §5 那几个问题跟机主当面过一遍。

- 分支 / worktree：`sp18-terminal` / `.claude/worktrees/sp18-terminal`，**从本地 `master@a73a570` 切**
  （不是 `origin/master`，它落后 800+ 提交）。原生 `EnterWorktree` 默认 `baseRef=fresh` 会切错基座 ⇒
  worktree 已由上一会话用 `git worktree add … master` 建好，直接 `EnterWorktree --path` 进即可。
- 进去先 `pnpm install`（checkout/merge 会断 pnpm 硬链接，见记忆 `pnpm-hardlink-broken-by-checkout`）。

---

## 1. 范围（机主 2026-08-10 已拍板：三件一起做，不拆期）

1. **`/terminal` 页**：iframe 套 ttyd + 窗口 tab 条 + keepalive 心跳 + 密码 step-up + 空闲锁
2. **桌面 admin-only 终端磁贴**
3. **设置「终端」tab 的 Security 段**（锁策略），替掉现在的「终端不可用」空态

理由（机主原话的意思）：锁策略在设置里改、在终端页上生效，分开做会得到一个「能锁但改不了策略」的中间态。

## 2. 后端：已装好、已跑起来（2026-08-10 实测，不是推断）

`NimoOS-Terminal` 仓 2026-08-10 才克隆到工作区（`/home/nimo/NimoTech/NimoOS-Terminal`，`main@7ccb85d`）。
**冷装已完成**：`nimoos-terminal.service` enabled+active · `terminal.url` = `http://127.0.0.1:44823` ·
网关 `routes.json` 有 `"/v1/terminal"` · `/v1/gateway/components` 里 Terminal online ·
`/v1/terminal/settings` 从 404 变 **401**。装法与两条「别当 bug」的现象见记忆 `vue2-delta-nonfiles-audit`。

**架构**：ttyd(web) + tmux(持久) + 薄 Go(集成)。**admin only、单个共享 tmux session `nimoos`**
（多管理员不隔离，后端有意为之）。鉴权三段：JWT →（按锁策略可选的密码 step-up）→ HMAC cookie ticket
（`nimoos_term`，`Path=/v1/terminal`、HttpOnly、SameSite=Strict）→ ticket 门控反向代理。
**ttyd 的 WS upgrade 走同一道门。ticket 是 cookie 而不是 header，因为 iframe 里的静态资源和 WS
没法带 Authorization** —— 这决定了前端只能用 iframe，不能自己接 WebSocket。

前端要用的路由（全部前缀 `/v1/terminal`，权威表在 `NimoOS-Terminal/OVERVIEW.md`）：

| 方法 | 路径 | 用途 / 前端关注的返回 |
|---|---|---|
| POST | `/session` | 换票。**401 + `{password_required, mode, idle_minutes}`** = 要密码；**403** = 非 admin；**429 + `{retry_after_seconds}`** = 被冻结（后端 5 次/15 分钟按用户名冻结）|
| DELETE | `/session` | 清 cookie（只清票，不拆 tmux、不停 ttyd）|
| POST | `/keepalive` | 按当前策略续票；401 ⇒ 前端该回锁屏 |
| GET/PUT | `/settings` | 锁策略 `{mode, idle_minutes}`；**PUT 要带 password**（改策略本身是敏感操作），任何改动使旧票失效 |
| GET/POST | `/windows` | 列窗口 `{index,name,active}` / 新建 |
| POST | `/windows/:i/select` · DELETE `/windows/:i` · PUT `/windows/:i` | 切换 / 关闭（关最后一个返 **409**）/ 重命名（去控制字符、上限 32 字符）|
| ANY | `/*` | 反代 ttyd 页面与 WS ⇒ iframe 的 `src` 就是 `/v1/terminal/` |

**后端已知边界（`OVERVIEW.md` §Known Boundaries，前端要照着设计错误态）**：
① 服务重启 ⇒ 内存 HMAC 密钥重生 ⇒ **所有票失效**，前端要能靠 401 自愈回 `/session`；
② 票过期**不会掐断已建立的 WS**，空闲锁锁的是"再进入"，不是"踢下线"；
③ `DELETE /session` 不销毁 tmux ⇒ 锁屏后重新输密码能**原样恢复**现场（这是锁屏文案该传达的语义）；
④ 动态 ShellUser 模式下 ttyd 是**首次 `/session` 时懒启动**的，第一次开会慢一点。

## 3. Vue2 蓝本坐标（工作树在旧分支，**必须 `git show FETCH_HEAD:` 读**，别读工作树文件）

- `src/views/Terminal.vue`（241 行，#39 于 2026-07-03 进来，**早于 7-15 蓝本** ⇒ 历次差集重算看不见它）
  —— 五态状态机 `loading / forbidden / error / locked / ready`；`mode==='on_open'` 时
  `beforeDestroy`/`beforeunload` 会 `DELETE /session`；`mode==='idle'` 时在
  **window 与 iframe 的 contentDocument 两处**挂 `keydown/mousedown/wheel/touchstart`（同源可访问），
  空闲到点前 60 秒弹「即将锁定」提示；keepalive 间隔 `on_open`=30s / 其它=60s，且 **idle 模式只在
  有活动时才续票**；窗口列表 3 秒轮询；双击 tab 改名。
- `src/components/settings/TerminalSecuritySection.vue` —— 三档锁策略单选（`off` / `on_open` / `idle`）
  + idle 分钟数（1-240）+ 保存要密码 step-up + 429 冻结倒计时。
- `src/components/Apps/builtInApps.js` 第 7 项 = `Terminal`，`adminOnly: true`（前端过滤）。
- **i18n 文案以 Vue2 `terminal.*` 为准**（22 个键，中英都有；记忆 `newui-zh-copy-source-of-truth`）。
  中文：`正在连接终端…` / `终端仅管理员可用` / `请输入密码以打开终端` / `尝试次数过多，请 {s} 秒后再试。` /
  `终端即将锁定 — 按任意键保持连接` / `终端锁定策略` / `从不锁定` / `打开时询问一次` / `询问 + 空闲后自动锁定` 等。

⚠️ 增量里的 `#97`（2026-07-23）**删掉了** Vue2 的旧 wsssh 终端与 TopBar 图标，并把设置 tab 改成
Security+Logs。New-UI 已对齐"删除"那半（从来没有 wsssh 终端）⇒ **本期不要去复活任何 wsssh 相关的东西**。

## 4. New-UI 侧已有的抓手（不用新造）

- `src/stores/session.ts:43` `isAdmin`（`user.role === 'admin'`）—— 磁贴与 Security 段共用
- `src/home/apps/systemApps.ts:18` 的 `requiresService?: 'kvm'` + `src/home/stores/apps.ts:39,79-94`
  的 `probeKvm()` / `kvmAvailable`（**`null` = 未探测，必须渲染成"可用"**，否则磁贴会闪一下再消失）
  ⇒ 终端磁贴的服务门控照这套扩，但**探针端点要挑**：`/v1/terminal/settings` 是 admin-only，
  非 admin 会 403（403 恰恰说明"服务在"）—— 别把 403 当"服务不存在"。
- `src/home/composables/useOpenAction.ts` 磁贴 → 路由。**终端在 Vue2 侧已无可回退目标**
  （Vue2 已于 08-07 从设备下线），照 `knowledge` 那条先例**不设 `strangler:disabled` flag**。
- `src/components/shell/AreaShell.vue` —— 各区外壳（窄屏有顶栏、桌面态顶栏隐藏，`.area-body` 是滚动容器）。
- `src/settings/panels/TerminalPanel.vue` —— 现在的「不可用空态 + 日志卡」，Security 段要替掉的正是那个空态；
  日志卡（含 5 秒轮询与 `onUnmounted` 清理）**保留**，别动。
- 共享包**没有** terminal 客户端 ⇒ 要新建 `packages/service/src/terminal.ts` 并在 `index.ts` 挂出去
  （照 `kvm.ts` / `snapshot.ts` 的形状）。

## 5. 留给 brainstorm 的问题（**没答，别自己拍**）

1. **主题**：Vue2 那页是写死的深色（`#1e1e1e`/`#252526`/`#8950f2`），而本仓禁止硬编码颜色、且有浅色主题。
   iframe 里 ttyd 自己的终端是深色且无法 token 化（属 CLAUDE.md 的第三方例外）。
   ⇒ tab 条/锁屏卡片是**跟随主题**，还是**恒定深色**与终端内容连成一片？这是视觉决定，值得给机主看图。
2. **外壳**：终端页走 `AreaShell`（有返回主页入口、与其它区一致），还是照 Vue2 全屏 `inset:0`（无外壳）？
   两者对"怎么退出终端"的影响不同。
3. **磁贴门控**：只按 `isAdmin`，还是叠加服务探针（终端是可选安装，`install.sh` 明说 ttyd 装失败只降级）？
   叠加就要定探针端点与 403 的解读（见 §4）。
4. **ShellUser**：`/etc/nimoos/terminal.conf` 现在留空 = 跑服务用户（root）的 shell；填 `nimo`
   才会用机主自己的 PATH/`~/.local/bin`。**这是后端配置、不是前端代码**，但直接决定验收时终端里是什么环境
   ⇒ 开工前问一句，免得验收时才发现打开是个 root shell。

## 6. 硬约束（本仓长期规则，写进 plan 的 Global Constraints）

颜色一律 theme token（`src/styles/theme.css`，两套主题都要给值）· 新增文案键必须同时进 `zh_cn` 与 `en_us`
（`src/i18n/parity.test.ts` 会红）· **提交信息与代码注释、测试描述一律英文** · 界面严格 1:1 照 Vue2、
但**不照抄它的 bug/竞态/吞错**（改正确并注释登记，记忆 `vue2-port-visual-only-fix-logic`）·
异步写共享 state 必带过期守卫 · 收尾门：`vue-tsc --noEmit` + 全量 `vitest` + `src/i18n/parity.test.ts`
+ `pnpm build` + `node oss/export.mjs --no-commit`（**跑 oss 门前先提交，脏树会让它假红**）。

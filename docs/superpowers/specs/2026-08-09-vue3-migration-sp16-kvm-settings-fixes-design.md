# SP16 — KVM / 设置区零散小缺陷清理 设计

> 日期：2026-08-09 · 阶段：SP16 · 尺寸：S–M · 状态：设计已确认，待写实施计划
> 工作树：`NimoOS-New-UI/.claude/worktrees/sp16-kvm-settings-fixes`，分支 `sp16-kvm-settings-fixes`（基于本地 master `9100418`）

## 1. 背景与本期定位

本期是**第三条并行线**，与另外两条同时进行：

| 线 | 分支 | 触及目录 |
|---|---|---|
| Files | `sp12-files-fixes` | `src/files/components|util`、`src/views/Files.vue`、`src/i18n/*.base.ts` |
| Photos | `sp15-photos-moments` | （开工时 0 提交，预期 `src/photos/**`） |
| **本期** | `sp16-kvm-settings-fixes` | `src/kvm/**`、`src/settings/**`、`src/styles/**`、`src/home/components/SearchDialog.vue` |

三线**零文件级重叠**（开工前实测：sp12 改的 5 个 `src/files/*` 文件里没有 `viewers/`，见 §2.3）。

缺口来源是 `NimoOS-UI/docs/vue3-pending/05-设置与KVM与搜索-SP9.md` 的 A 区（该文件 2026-08-06 做过一轮代码级复核）。
本期取其中**前端能独立做完、且工作量在几十行内**的 12 条；跨期依赖或需后端配合的整块留给后续期次（见 §5）。

**本期不含**用户明确未选的两项：A5 文件夹权限整页接线、A3 关机确认框数据丢失警告。

## 2. 开工前的代码级复核（2026-08-09）

照 `vue3-pending-audit` 那条教训（**汇总结论落盘前必须过代码级取证**）与 `newui-dialog-error-not-toast`
那条（**计划里写死的数字会先于计划腐烂，援引先例前先核现场**），本期开工前对 12 条逐一取证。
坐标全部仍成立，但**有三处推翻或订正台账**。

### 2.1 推翻：D50「注释完整性守卫只扫独立 `.css`」——成立，但修法与台账设想的不同

`src/styles/color-guard.test.ts` 里有**两个语料**：

- `files`（`:50-54`）= `import.meta.glob('../**/*.vue', ?raw)` **+** `cssFiles` ⇒ 已含 `.vue`
- `cssFiles`（`:42-47`）= `node:fs` 递归收集的 `.css`，仅 5 个文件

颜色扫描、`color-scheme` 扫描用的是 `files`（含 `.vue`）；**注释完整性守卫 `:199` 用的是 `cssFiles`** ⇒ 缺口确实在。
但不能简单把循环源换成 `files`：`.vue` 的 `<script>` 块里 JS 块注释的 ` * 续行` 极常见，直接换会误报爆炸。
**必须只扫 `.vue` 的 `<style>` 块**，复用本文件既有的样式块提取逻辑（并受 Minor 11 那条「非贪婪匹配」约束的保护）。

### 2.2 订正：D38 的实际形态与台账描述不同

台账写「`KvmPage.vue:323` 的 wakeup toast 是**手写一行**」。现测：该逻辑已漂到 `KvmPage.vue:595-598`，
且用的是 `t('kvmToastResumed')` —— **已经是 i18n 键调用，不是手写字面量**。
⇒ 这一条的真实缺口不是"改成用 i18n"，而是**没有守卫保证 `t()` 的键真实存在**（键写错时 vue-i18n 回落成键名本身，三门全绿）。

台账的**第二半仍完全成立**：`KvmPage.test.ts:891` 标题写「暂停/恢复/强制重启/**强制关机**成功后也各自弹对应文案的 toast」，
但用例体只点了暂停、恢复、强制重启三个（`api.stopVM` 虽被 mock 但从未触发）⇒ **标题误导后人以为强制关机有覆盖**。

### 2.3 确认：Esc 缺陷的根因，以及它不构成跨线冲突

`reka-ui` 的 `DismissableLayer.js:77` 用 VueUse 的 `onKeyStroke('Escape', …)` —— 默认 target 是 **window**、默认 `keydown`、**非 capture**。
`ViewerHost.vue:29` 也是 `window.addEventListener('keydown', …)` 冒泡阶段。
两者同目标同阶段 ⇒ **执行顺序 = 注册顺序**。Home 挂载时 ViewerHost 就注册了，搜索弹窗是后开的
⇒ ViewerHost 先跑 `v.close()` 把 `viewer.open` 置 false，reka 的 handler 后跑，`onEscapeKeyDown`（`SearchDialog.vue:249`）
读到的已是 false ⇒ 不 `preventDefault()` ⇒ 弹窗照常 dismiss。台账根因描述属实（坐标从 `:250` 校正为 `:249`）。

`sp12-files-fixes` 改的是 `src/files/components/FileContextMenu.vue`、`util/contextTarget.ts`、`util/shareGate.ts`、`views/Files.vue`
—— **没有 `src/files/viewers/`**。但本期仍选择不动 `src/files/`（见 T11 的方案选择，理由不是冲突而是正确性）。

## 3. 逐条设计

### 组 1 · KVM 用户能看到的缺陷

**T1 · D37 — MessageBus 掉线时点「强制重启」，控制台一片黑、无任何提示**
`useVmList.ts:265-277` 的 `restartPending` 集合只解「顺序竞争」（重连处理器 `:159-161` 与 `restart()` 谁先到）。
当触发条件变成 **`kvm:vm_started` 事件缺席**（MessageBus 掉线）时，标记永远留在集合里、断连回调永不补发 ⇒ 黑屏且零提示。
**修法**：进 `restartPending` 时起超时计时；超时仍未收到事件就清标记并向调用方报一个可见的超时结果，由 KvmPage 弹提示。
超时时长在 plan 阶段定，取「比正常重启慢但用户还没开始怀疑坏了」的量级。

**T2 · D39 — 弹出安装介质失败、但组件正好卸载时弹假的成功提示**
`useVmList.ts` 的多个 catch 分支里 `if (!alive) return ''`，而 `''` 在调用方语义是「无错误 = 成功」
（`:381,386,416,420,445,464` 共 6 处同形，本期只改 eject 那条链路，其余同形处记录在案）。
**修法**：让「已卸载」与「成功」在返回值上可区分（哨兵值或调用方先查 alive），使已卸载时不弹任何 toast。
窗口极窄但语义是错的，且这套 `return ''` 惯例会被后来者复制。

**T3 · D40 — KVM 页的提示条浮在控制台画面中下方，可能挡住客户机画面**
`AppToast.vue:49` 的 `.toast-stack { bottom: 118px }` 是给 Home 的 dock 让位设计的，KVM 全屏页没有 dock。
**修法**：把 `bottom` 抽成可覆写的 CSS 变量（默认值仍是 118px，桌面行为零变化），KVM 页覆写它。
不改 `z-index: 10100`（那是 `newui-dialog-error-not-toast` 修过的，别回退）。

**T4 · OSSelector 两条未申报的行为差异**
① 重开时 ISO 列表可能是旧的 —— Vue2 每次 `visible: true` 都重拉；② 重开时自定义区折叠回去 —— Vue2 组件常驻故保持展开。
**修法**：`OsSelector.vue` 补 `visible` 的 watch 触发重拉，并把自定义区展开态保留到组件生命周期而非每次开关重置。

### 组 2 · KVM 可达性与防复发

**T5 · `.custom-divider` 键盘完全打不开「本地 ISO 浏览」**
`IsoBrowser.vue:80` 是可点 `<div>`，无 `role` / `tabindex` / 键盘处理，而它是**唯一**能打开本地 ISO 浏览的控件
⇒ 纯键盘用户被完全挡在外面（这是 a11y backlog 里价值最高的一条，原划归 SP10）。
**修法**：补 `role="button"` + `tabindex="0"` + Enter/Space 处理。视觉零变化。
既有 8 条 `IsoBrowser.test.ts` 用例都 `.trigger('click')`，不受影响。

**T6 · 6 个按钮的 hover 特异度从未被检查**
`.cv-btn-restore` / `.cv-btn-delete` / `.cv-btn-create` / `.cv-primary-btn` / `.category-btn` / `.os-action-btn`。
T11 期的反向检查只测「有没有样式」，没测「hover 特异度对不对」⇒ 可能复发 `newui-css-hover-specificity-trap`
那类「基类 `:hover`(0,2,0) 压过变体 `:hover`(0,1,0) → 白底白字」。**jsdom 测不到，必须自算级联。**
**修法**：用既有的 `cssCascade.ts` 给这 6 个类补特异度断言；真发现被压过就给变体补 `:hover` 背景。

**T7 · toast 的 i18n 键写错，三门全绿抓不到（D38 两半）**
- 上半：加一道**键存在性守卫** —— 扫源码里 `t('…')` 的字面量键，断言在 `zh_cn` / `en_us` 两侧都存在。
  ⚠️ **风险**：全仓扫可能有大量既有死键。plan 阶段先只读扫一遍取数，**命中多则把守卫范围缩到 `src/kvm/**` + `src/settings/**`**，
  全仓收口另开票，不在本期硬扛。
- 下半：修 `KvmPage.test.ts:891` 那条误导标题 —— 要么补上强制关机的点击断言（`api.stopVM` 已 mock 好），要么改标题。
  优先补断言（标题承诺的覆盖本来就该有）。

### 组 3 · 设置区

**T8 · 420px 窄屏下设置侧栏 tab 被裁切、没有可滚动提示**
`SettingsShell.vue:147`（窄屏分支 `:238`）的 `.set-rail-list` 在窄屏是 `flex-direction: row` + `overflow-x: auto`，
**7 个** tab 排一行被硬切（`RAIL_TABS = SETTINGS_TABS.slice(0, 7)`，`src/settings/util/tabs.ts:24`；非 admin 再减掉
`folder-permissions` = 6 个 —— 台账原写「8 个」是错的）。理论上能滑，但没有渐隐/箭头提示，第一眼像坏了。
**修法**：补可滚动的视觉提示（边缘渐隐遮罩）。不改 tab 数量与顺序。

**T9 · disabled 的可点行悬停仍变强调色**
`settings.css:83` 的 `.set-list-item.clickable:hover` 缺 `:not(:disabled)` ⇒ 禁用行悬停仍变色，误以为可点。
**修法**：补 `:not(:disabled)`。

**T10 · `UsbAutoMountRow` 会炸穿测试文件的坑**
`UsbAutoMountRow.vue:29` 把两个调用包进 `Promise.allSettled`，但 `service.sys` 是 **getter** ——
`initService()` 未调用时它会**同步**抛错，发生在数组字面量求值阶段，`allSettled` 根本包不住 ⇒ unhandled rejection。
生产不触发（`main.ts` 保证先 `initService`），但任何「先挂载 Settings 组件再 initService」的新入口都会复现崩溃。
台账留的 one-line fix，本期正好开这个目录。
**修法**：把 getter 求值也纳入保护（在 `allSettled` 的 thunk 内部再取 `service.sys`）。

### 组 4 · 跨区

**T11 · 按一次 Esc，预览和搜索面板一起关、结果全丢**
根因见 §2.3。两个候选修法：

| 方案 | 做法 | 评价 |
|---|---|---|
| A | `ViewerHost.vue` 消费 Esc 时阻止传播 | ❌ **不采用**。两者挂在**同一个 target 的同一阶段**，`stopPropagation()` 对此无效，得用 `stopImmediatePropagation()`；且它只在「ViewerHost 恰好先注册」时有效 —— 把正确性押在注册顺序上。还要动 `src/files/` |
| **B** | `SearchDialog.vue` 在 **window 的 capture 阶段**记下按下 Esc 那一刻 `viewer.open` 的快照，`onEscapeKeyDown` 读快照而非实时值 | ✅ **采用**。capture 一定先于所有 bubble 监听 ⇒ **与注册顺序无关**；改动全在 `src/home/components/SearchDialog.vue` 内 |

同一处的 `onInteractOutside`（`:247`）读的也是实时值，但指针路径没有这个先后问题，**本期不动**（避免为对称而改）。

**T12 · CSS 注释完整性守卫的语料缺口（D50 剩余的一半）**
背景见 §2.1，以及 `newui-css-invisible-failure-guards` 那条教训 —— 「源文本正确 + 解析后规则消失」是五道门全瞎的一整类盲区
（SP9 那次「KVM 页只占半屏」正是这个）。
**修法**：把 `color-guard.test.ts:199` 的循环源从 `cssFiles` 扩到「`cssFiles` + 各 `.vue` 的 `<style>` 块」，
`.vue` 侧复用既有样式块提取逻辑，**不扫 `<script>`**。
⚠️ **风险**：扩语料后可能扫出既有 `.vue` 违例。命中少则本期一并修；命中多则同 T7 处理（缩范围 + 记债）。

## 4. 验证

- **每条一个回归测试**，且必须是「修之前红、修之后绿」的（T6/T7/T12 这三条守卫类的做**变异验证**，
  照 `05` 文件 A11 记的过程坑：**每次变异都从干净基线重做，并断言 `replace` 真改了文件** —— 曾经出现过第 3 次变异静默不命中、
  看到的红其实是上一次的）。
- **每条一个提交**，互不依赖，便于合并时取舍。
- **收尾跑全套门**：`vitest` 全量 / `vue-tsc` / color-guard / oss / `build`。基线为 **672 文件 / 10669 例，0 失败**（本 worktree 实测）。
- **不部署、不推 origin**。验收清单成文交机主统一验 —— 与 sp12 / sp15 两条线的现行惯例一致。
- T1（超时）、T3（toast 位置）、T8（窄屏渐隐）在 jsdom 里只能验逻辑与源文本，**真机观感留验收清单**。

## 5. 本期不做（已筛查，附理由）

| 条目 | 理由 |
|---|---|
| A4 系统终端整块 | 后端端点已删（`NimoOS/route/v1.go:106` 的 `wsssh` 是注释掉的），工作区无 `NimoOS-Terminal` 仓 ⇒ 前端做不了 |
| A2 语言只有中文/英文 | 属 roadmap §5「i18n 全量收口（31 locale × ~800 key）」，独立一期 |
| A6 清理本地待上传缓存按钮 | SP7-P8a 已裁定 D21 上传子系统整块不做 ⇒ 无数据源可接，维持永久禁用 |
| D15 新建 VM 的 autostart 不生效 | 后端 `model.CreateVMRequest` 无该字段 ⇒ 后端票 |
| D14 ISO 无法从界面删除 | 用户 2026-08-03 已拍板不做 |
| KVM 区占位 Unicode 图标 | 等统一换真图标那批 |
| D8 VM 状态轮询改 MessageBus 事件 | 明确的改进方向，但不属「小修」 |
| A7 / A8 搜索的后端耦合与噪声结果 | 后端票，前端刻意不动 |
| A5 文件夹权限接线 · A3 关机数据丢失警告 | 用户本期未选 |

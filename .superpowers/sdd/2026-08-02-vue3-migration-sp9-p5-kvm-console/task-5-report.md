# Task 5 报告:控制台头 + 溢出菜单(就地二次确认)+ 电源动作接线 + 进度遮罩

状态:完成。commit `eee9fda`(父提交 `f7323d6`)。

## i18n 实际值核对(开工前 grep,brief 草稿的中文断言按此订正)

`grep -n "kvm" src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` 核对结果:

| key | brief 草稿 | **实际值** | 本任务用在哪 |
|---|---|---|---|
| `kvmAreYouSure` | 确定吗? | **你确定吗？**(全角问号) | OverflowMenu 二次确认文字 |
| `kvmResume` | 继续 | **恢复** | paused 态"继续/恢复"项 |
| `kvmAutoStart` | 开机自启 | **自动启动** | 自启开关项 |
| `kvmComingSoon` | 即将支持 | **即将上线** | Settings 按钮 title |
| `kvmSettings` | 设置 | **系统设置** | Settings 按钮 aria-label |
| `kvmMore` | 更多 | **浏览更多** | ⋮ 按钮 title/aria-label |
| `kvmStopping` | 正在停止 | **正在停止虚拟机** | 进度遮罩标题 |
| `kvmRestarting` | 正在重启 | **正在重启虚拟机** | 进度遮罩标题 |
| `kvmDeleting` | 正在删除 | **正在删除虚拟机** | 进度遮罩标题 |
| `kvmSettingsDisabledHint` | Stop VM to modify settings | 停止虚拟机以修改设置 | **本任务未使用**(见下方"与 brief 的偏离 #1") |

其余用到的键(`kvmPowerOn`=开机、`kvmForceShutDown`=强制关机、`kvmForceRestart`=强制重启、
`kvmPause`=暂停、`kvmWakeUp`=唤醒、`kvmDelete`=删除)核对后与 brief 草稿一致,未改动。

brief Step1/Step3 给的测试代码原文按上表逐处替换,替换点:
`OverflowMenu.test.ts` 里所有 `'继续'`→`'恢复'`、`'开机自启'`→`'自动启动'`、
`'确定吗?'`(半角问号)→`'你确定吗？'`(全角问号,共 6 处点击目标/断言);
`ConsoleHeader.test.ts` 里 `'即将支持'`→`'即将上线'`。

## Vue2 行号核对

`NimoOS-UI/src/components/KVM/KVMFullPage.vue` 当前版本逐段读过:

| 段落 | brief 引导 | 实读确认 |
|---|---|---|
| console-header/console-actions/overflow-dropdown 模板 | :75-140 | **:79-140**(console-header 从 79 起) |
| confirmStopVM/confirmRestartVM/confirmDeleteVM/resetPendingConfirm/handleOutsideClick/toggleOverflowMenu | :1500-1620 | resetPendingConfirm **:1135-1137**,handleOutsideClick **:1108-1111**,toggleOverflowMenu **:1115-1117**,confirmDeleteVM/confirmStopVM/confirmRestartVM **:1322-1365**(顺序是删除→停→重启,与 brief 列的顺序不同) |
| 进度弹窗模板 | :495-505 | **:503-514**(`<!-- Progress Modal -->` 注释在 503,`</b-modal>` 收在 514) |
| `.console-header`/`.console-actions .action-btn` | 未给行号 | **:2025-2135**(嵌套 scss,含 `.console-title`/`.console-status`/`.console-actions`) |
| `.overflow-dropdown`/`.dropdown-item`/`.toggle-indicator`/`.dropdown-divider` | 未给行号 | **:2137-2200**;`.confirm-text-danger` 是顶层独立规则,单独在 **:3092-3094**(不嵌套在 overflow-dropdown 里) |
| computed(canPowerOn 等) | — | 已由 T1 核过,:674-706,本任务直接复用 `util/vmState.ts`,未重复读 |
| 电源动作方法体(startVM/stopVM/…/deleteVM) | — | **:1530-1620**,已由 T3 核过并落地在 `useVmList.ts`,本任务只调用 |

关键发现:Vue2 的 `.dropdown-item` CSS **没有 `:disabled` 规则**(自启开关按钮
`:disabled="selectedVM._processing"` 是真实存在的状态,但 Vue2 压根没为它写禁用态的
视觉——鼠标移上去照样变背景色、光标照样是手型)。这是 Vue2 自身的视觉空白,不是
"New-UI 新造的禁用占位态"(那种情况已经在 T4 里遇到过 kvm-settings-btn/add-vm-btn,
也确实修了),按 1:1 原则本任务**没有**给 `.dropdown-item` 加 `:disabled` 样式,照抄
Vue2 的空白。

## Step 1:`OverflowMenu.test.ts`(先写测试,确认失败)

按 brief 原文抄录并按上表订正中文断言,写入 13 条用例(brief 原文是 13 条:显隐 7 条 +
二次确认 6 条)。跑 `pnpm vitest run src/kvm/components/OverflowMenu.test.ts`:
```
Error: Failed to resolve import "./OverflowMenu.vue" ...
Test Files  1 failed (1)
```
红色确认。

## Step 2:实现 `OverflowMenu.vue`,跑绿

- 确认目标用**非响应式闭包变量**(`let pendingAction = ''`、`let pendingId = ''`)存,
  一个不参与判断、只用来触发模板重渲染的 `tick` ref 建立响应式依赖——严格照 brief 的
  契约文字实现(P4 教训:响应式变量可能在外部先被清空,决策逻辑不该依赖 Vue 什么时候
  同步好 ref)。
- `confirmThenEmit(action)`:第一次点存目标,第二次点(同目标)才 `reset()+emit`。
  `direct(action)`:一次点直接 `reset()+emit`(照 Vue2 每个直接动作按钮上都带的
  `resetPendingConfirm(); xxxVM(...)`)。
- 删除项的确认文字**没有**套 `confirm-text-danger`(Vue2 :134 原文如此——它本来就是
  `is-danger` 红字,不需要再叠一层),只有 stop/restart 的确认文字套了这个类。
- `defineExpose({ reset })` 供父组件调用。
- 图标:Vue2 用 `<b-icon>`(bulma 图标字体),New-UI 没有这套依赖,dropdown-item 改成
  纯文字标签(**已申报偏离,见下**),跟 `settings/components/SettingsRow.vue` 的
  纯文字菜单项一致,不是本任务自创风格。

样式(`kvm.css`)照 Vue2 `:2137-2200` 逐字对应(颜色全部换成 `var(--kvm-*)` token,
数值不变):`.dropdown-wrapper`/`.overflow-dropdown`/`.dropdown-item`/`.is-danger`/
`.toggle-indicator`/`.on`/`.dropdown-divider`/`.confirm-text-danger`(顶层独立规则,
对应 Vue2 :3092)。

```
pnpm vitest run src/kvm/components/OverflowMenu.test.ts src/kvm/styles/kvmStyles.test.ts
Test Files  2 passed (2)
      Tests  17 passed (17)
```

## Step 3:`ConsoleHeader.test.ts` 并实现

按 brief 原文抄录,`'即将支持'`→`'即将上线'`;最后一条"卸载时摘掉 document 监听"
按 brief 自己标注的"这条是占位断言"要求,改成:
```ts
const spy = vi.spyOn(document, 'removeEventListener')
w.unmount()
expect(spy).toHaveBeenCalledWith('click', expect.any(Function))
```
先跑测试确认失败(组件不存在,0 test)。

实现 `ConsoleHeader.vue`:
- 状态文字用 `stateLabelKey` + `te()`/`t()`(同 VmListItem 的既有写法)。
- Settings 按钮**恒 disabled**(硬约束 5),`title=t('kvmComingSoon')`、
  `aria-label=t('kvmSettings')`——**不实现** Vue2 的 `canEditSettings` 切换 tooltip
  文案逻辑(那是"设置弹窗"本身,P6 的活;`kvmSettingsDisabledHint` 这个键本任务
  没有用上,已在偏离清单里申报)。
- ⋮ 按钮用 `v-if="menuOpen"` 挂载/卸载 `OverflowMenu`(不是 `v-show`)——每次重开都是
  全新实例,内部确认态天然是空的。`toggleMenu()`/`handleOutsideClick()` 照 Vue2
  `toggleOverflowMenu`(:1115-1117)/`handleOutsideClick`(:1108-1111)的语义,
  额外调用 `overflowRef.value?.reset()`(即使 v-if 卸载本身也会清,这里是照抄 Vue2
  在"卸载前"就清的时序意图,不是观测到问题才加的)。
- `watch(() => props.vm.id, ...)` 切换 VM 时清菜单 + 确认态。

样式(`kvm.css`)照 Vue2 `:2025-2135`:`.console-header`/`.console-title`/
`.console-os-icon`/`h3`/`.console-status`(含 hover 才显示 status-text 的 Vue2 特有写法)/
`.console-actions .action-btn`(disabled 态 **opacity:.35**,与 Vue2 :2124-2131 完全一致的
嵌套 `:disabled:hover` 兜底写法,**不是** T4 的 `:hover:not(:disabled)` 简化写法——
因为这是 Vue2 真实存在的视觉,要 1:1;T4 那套 `.5`+`:not(:disabled)` 只用在
kvm-settings-btn/add-vm-btn 这两个 New-UI 自造的占位态上)。

```
pnpm vitest run src/kvm/components/ConsoleHeader.test.ts src/kvm/styles/kvmStyles.test.ts
Test Files  2 passed (2)
      Tests  12 passed (12)
```

踩到一个类名白名单的坑(和 T4 报告里同一类):CSS 注释里写了字面的
`ConsoleHeader.vue`/`kvmStyles.test.ts` 之类带 `.` 的文件名,被白名单扫描器的
`/\.([a-zA-Z][\w-]*)/g` 正则当成新类名 `vue`/`test`/`ts` 抓了出来,`没有不在册的类名`
用例翻红。改成不在注释里写带扩展名的文件名(用"组件"/"用例"这种描述代替),复测绿。

## Step 4:`ProgressOverlay.vue` + 接进 `KvmPage.vue`

- 无点击处理器 = `can-cancel=false` 的落地方式(遮罩、卡片哪里都不响应点击)。
- **Teleport 到 body**(硬约束 6 要求写清楚判断,已写进组件注释):`.kvm-page` 是
  T2 为压过全局氛围光层加的层叠上下文(`position:relative;z-index:1`)。若
  `ProgressOverlay` 渲染在其内部,相对 body 级兄弟(`AppToast` z-index:60、
  `components/ui/Dialog.vue` 一类弹窗 z-index:1000)的有效层级会被整体钳在 1,
  盖不住它们。Vue2 的 `b-modal` 本身就是 buefy 挂在 body 下的(不是
  `kvm-full-page` 的子节点),Teleport 是**还原 Vue2 实际挂载位置**,不是新增行为。
  停/重启/删除是不可撤销操作,遮罩期间应该霸屏,不该被恰好路过的全局 toast/弹窗
  盖住或误当成还能操作背后的东西。
  用探针脚本验证过:`@vue/test-utils` 的 `wrapper.find()` **找不到** Teleport 出去
  的内容(`false`),必须用 `document.body.querySelector()`(`true`)——已在
  `KvmPage.test.ts` 里用后者查询进度遮罩,并在测试文件里写了这条注释,免得后来者
  用 `wrapper.find` 白忙活。
- CSS:`.kvm-progress-overlay`(`position:fixed;inset:0;z-index:1000`,背景
  `var(--kvm-overlay)`)+ `.kvm-progress-card`(`var(--kvm-panel)`/`var(--kvm-border)`/
  `var(--kvm-shadow)`)+ `.kvm-progress-title`/`.kvm-progress-msg` + `.kvm-spinner`
  (border-top 染色转圈,`var(--kvm-accent)`)。这几个类名 T2 阶段已经预先登记进
  `kvmStyles.test.ts` 白名单,本任务未改动白名单文件。

`KvmPage.vue`:`onAction(name)` 里 `CONFIRM_ACTIONS` 映射表(stop/restart/delete)
命中时先 `progress.value = {...}`、`await` 动作、`finally` 清空;其余动作
(start/pause/resume/wakeup/autostart)直接 `await`,不碰 `progress`。

## Step 5:电源动作接线 + lastError 内联 + 全量 + 提交

- `onAction` 分派到 `useVmList` 的对应方法:start/pause/resume/wakeup 直接对应;
  `autostart`→`toggleAutostart`;`delete`→`remove`。
- `lastError` 用 `<p v-if="s.lastError.value" class="console-hint is-error">` 内联
  显示在新增的 `.console-display > .console-placeholder` 里(不用 toast,硬约束 9)。
  这两个容器类(`console-display`/`console-placeholder`)是 T2 阶段为**后续 VNC
  任务**预先登记的白名单类名,本任务只用了其中"错误提示"这一小块用途,VNC 画布/
  开机按钮(`start-vm-btn`/`power-icon`/`power-svg`)留给后续任务,模板里未引用。

```
pnpm vitest run src/kvm
Test Files  10 passed (10)
      Tests  114 passed (114)

pnpm exec vue-tsc --noEmit
(无输出,exit 0)
```

### 数字核对(基线 vs 现在)

用 `git worktree add -f /tmp/kvm-baseline-check HEAD`(HEAD=`f7323d6`,Task 5 开工前
的提交)在隔离目录里跑了一遍基线全量测试,确认基线确实是 **332 文件 / 2754 例**
(与 task-4-report.md 记的一致),然后跑现在的全量:

```
pnpm test
Test Files  334 passed (334)
      Tests  2782 passed (2782)
     Errors  1 error   # SettingsPage.test.ts 的 avatarPath mock 缺失,P4 已知遗留,未碰 src/settings/
```

差值 334-332=2(新增 `OverflowMenu.test.ts`/`ConsoleHeader.test.ts` 两个测试文件),
2782-2754=28。28 这个数字一开始让我意外(`src/kvm` 目录本身只增加了 25 例:
OverflowMenu 13 + ConsoleHeader 8 + KvmPage 净增 4),多出的 3 例查证后来自
`src/styles/color-guard.test.ts`——它用 `import.meta.glob` 扫描项目里**全部** `.vue`
文件、每个文件生成一条测试用例,本任务新增了 3 个 `.vue` 文件(`OverflowMenu.vue`/
`ConsoleHeader.vue`/`ProgressOverlay.vue`),color-guard 对它们各生成一条用例并全部
通过(佐证三个新组件确实全走 `var(--kvm-*)`,没有裸颜色字面量)。25+3=28,对上。
**只增不减,零新增 failed**,符合硬约束。清理:`git worktree remove /tmp/kvm-baseline-check --force`。

## 变异验证(3 处,均按预期翻红后已用备份文件字节级还原)

**1(判断力最强的一条)—— `OverflowMenu.vue` 的 `confirmThenEmit` 改成跳过确认、直接 emit**
```ts
function confirmThenEmit(action: string) {
  reset()
  emit('action', action)   // MUTATION: 不再检查 isPending
}
```
```
pnpm vitest run src/kvm/components/OverflowMenu.test.ts
Test Files  1 failed (1)
      Tests  4 failed | 9 passed (13)
```
翻红的 4 条精确对应二次确认相关用例(第一次点不该 emit / 第二次才 emit / 重启删除
同样两次点 / 确认态转移不误触发),典型报错:
```
AssertionError: expected [ [ 'stop' ], [ 'restart' ] ] to be undefined
```
用 `/tmp/OverflowMenu.vue.bak` 还原,`diff` 确认字节级一致,复测 13/13 绿。

**2 —— `KvmPage.vue` 的 `onAction` 里删掉 `progress.value = {...}` 这一行(confirmed 分支)**
```ts
if (confirmed) {
  await confirmed.run(vm)   // MUTATION: 不再挂 progress
  return
}
```
```
pnpm vitest run src/kvm/views/KvmPage.test.ts
Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```
精确命中"stop 二次确认通过后显示进度遮罩"这一条:
```
AssertionError: expected null not to be null
 ❯ expect(overlay).not.toBeNull()
```
用 `/tmp/KvmPage.vue.bak` 还原,`diff` 确认字节级一致,复测 8/8 绿。

**3 —— `ConsoleHeader.vue` 删掉 `onUnmounted(() => document.removeEventListener(...))`**
```
pnpm vitest run src/kvm/components/ConsoleHeader.test.ts
Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```
精确命中"卸载时摘掉 document 监听"这一条(证明我把 brief 标注的占位断言改成
`vi.spyOn` 之后是真的有判别力,不是又写了一条空转断言):
```
AssertionError: expected "removeEventListener" to be called with arguments: [ 'click', Any<Function> ]
Number of calls: 0
```
用 `/tmp/ConsoleHeader.vue.bak` 还原,`diff` 确认字节级一致,复测 8/8 绿。

三次变异后重跑 `pnpm vitest run src/kvm` 确认稳定回到 114/114。

## dev server 目视自查

`pnpm dev --host --port 5299`(5273/5277/5288/5301 都已被其它长期存活的会话占用,
新起一个临时端口,完成后按 PID 单独 kill,没碰其它会话)。用不提交的临时预览页
`_dev_kvm_preview.html`/`.ts`(仿 task-2/task-4 报告里的既有做法:`createApp(KvmPage)
.use(i18n).mount('#app')`,绕开路由守卫)。

踩了两个坑,记录一下供下次参考:
1. 最初 `initService()` 桩传的字段名是我凭印象编的(`getAccessToken`/`clearTokens`),
   与 `NimoOS-Service/src/config.ts` 的真实接口(`getToken`/`getRefresh`/`setTokens`/
   `onAuthFail`/`getLang`)对不上——因为这个预览文件不在 `tsc` 类型检查范围内(vite
   dev 只用 esbuild 转译、不做类型检查),错误字段名不会在编译期报错,只会在运行时
   请求拦截器里调用 `cfg.getToken()` 时抛出、被 `fetchVMs` 的 `catch` 悄悄吞掉,
   表现为"页面空白/VM 列表恒空"——排查了一轮才定位到。改用真实字段名后恢复正常。
2. 预览文件没有 import `src/styles/theme.css`/`theme.sp9.css`(main.ts 正常会 import,
   这里绕过了 main.ts),导致 `--kvm-*` token 全部未定义、页面背景变白。补上这两个
   import 后恢复深色。

修好后两张截图(`/tmp/claude-1000/.../scratchpad/kvm-shots/`):
- `03-loaded.png`:深色底铺满,左侧栏显示 "1 / 1 运行中" + `sp9-alpine-test`
  这一行(自动选中,紫色高亮边框),右侧 ConsoleHeader 显示 VM 名 + 绿色状态点 +
  两个动作按钮(⚙ 置灰禁用、⋮ 正常)。
- `04-menu-confirm.png`:自动脚本点了一次 ⋮ 再点了一次"强制关机",截图定格在
  确认态——菜单显示"你确定吗？"(红字)/"强制重启"/"暂停"/"自动启动"(灰色圆点=
  未开启)。**只点了一次"强制关机"进入确认态就停手,没有点第二次**——第二次点击
  会真的调用 `stopVM` 打到真机的 `sp9-alpine-test`,违反硬约束 9(禁止对真机发写
  请求),已刻意避免。

截图确认后 `rm` 删除了 `_dev_kvm_preview.html`/`.ts`,`git status --short` 确认无
残留(只剩预期的 8 个改动文件 + 3 个原有 design-export 删除)。临时 dev server(端口
5299)按 PID kill 掉,其余长期存活的会话(5273/5277/5288/5301)未动。

## 与 brief 的偏离(全部已申报)

1. **ConsoleHeader 的 Settings 按钮没有实现 Vue2 的 `canEditSettings` 切换 tooltip
   逻辑**,恒用 `kvmComingSoon`(硬约束 5 明确要求),`kvmSettingsDisabledHint` 这个
   i18n 键本任务未使用——这不是遗漏,是硬约束 5 本身就要求"渲染但 disabled + title
   说明(P6 才实现)",那套"停机才能改设置"的条件逻辑连同设置弹窗本身都是 P6 的活。
2. **OverflowMenu 的 dropdown-item 没有图标**,只有文字标签。Vue2 用 `<b-icon>`
   (bulma 图标字体依赖),New-UI 没有这套依赖,且类名白名单里没有为这些图标预先
   登记专门的类名。参照 `settings/components/SettingsRow.vue` 等既有的纯文字菜单项
   写法,没有引入新的 unicode 占位符号(与 VmSidebar/KvmPage 的 ⚙/+/⬚/‹/▭ 那种
   "有意义但需要图标占位"的场景不同,这里纯粹是列表项文字,省略图标不影响可读性)。
3. **`.dropdown-item` 没有 `:disabled` 视觉**(自启开关在 processing 时禁用,但没有
   变灰/改光标)——这是**照抄 Vue2 本身的空白**,不是遗漏。Vue2 CSS 里
   `.dropdown-item` 确实没有任何 disabled 规则(已在"Vue2 行号核对"一节确认)。
4. **进度遮罩 title/message 的切法与 Vue2 不同**:Vue2 是"固定标题(如 'Stopping
   VM')+ 拼接的动态 message(`${vm.name} stopping...`)"。zh_cn.sp9.ts 的
   `kvmStopping`/`kvmRestarting`/`kvmDeleting` 已经是"正在停止/重启/删除虚拟机"这种
   完整句子(不是可拼接的动词片段),所以改成 title=完整句子、message=vm 名,卡片
   读起来是"正在停止虚拟机 / sp9-alpine-test"——信息不丢,只是标题/正文的切法因
   实际 i18n 键的形态而变了(已在 `KvmPage.vue` 内联注释里写明)。
5. **控制台主体(VNC 画布/开机按钮)本任务未实现**,`console-display`/
   `console-placeholder` 只用于内联展示 `lastError`;`start-vm-btn`/`power-icon`/
   `power-svg` 这三个 T2 预先登记的白名单类名本任务未使用(留给需要 VNC 连接状态机
   的后续任务)。这不是缺失,是任务边界("Task 5 之外的任务不归你做")。
6. brief Step1/Step3 给的测试代码原文有 7 处中文断言按实际 i18n 值订正(见上方
   核对表),brief 自己在开头已经预告了这几处要改,不是本任务自创偏离。
7. `ConsoleHeader.test.ts` 最后一条"卸载时摘掉 document 监听"按 brief 自己的提示
   从占位断言改成 `vi.spyOn` 断言,已用变异验证证明改动后确有判别力(见上方变异 3)。

## 交付文件清单

- `src/kvm/components/OverflowMenu.vue` / `OverflowMenu.test.ts`(新建)
- `src/kvm/components/ConsoleHeader.vue` / `ConsoleHeader.test.ts`(新建)
- `src/kvm/components/ProgressOverlay.vue`(新建)
- `src/kvm/views/KvmPage.vue`(修改:接入三个新组件 + 电源动作分派 + lastError 内联)
- `src/kvm/views/KvmPage.test.ts`(修改:保留原 4 条壳测试,新增 4 条电源动作接线测试)
- `src/kvm/styles/kvm.css`(修改:新增 console-header/overflow-dropdown/progress-overlay/
  console-placeholder 几段样式,均为白名单已登记类名,未改动 `kvmStyles.test.ts`)

commit:`eee9fda`(父提交 `f7323d6`)。

---

# 评审修复追加

评审确认二次确认契约全部成立、Teleport 判断正确、CSS 数值逐条对上、pathspec 干净,
指出 4 条要修 + 1 条只需补登记。逐条记录如下。

## 1(Important)`lastError` 裸渲染没过 `t()`,8 个 fallback 键根本不存在

**根因确认**:`grep -n "kvmFailed" src/kvm/composables/useVmList.ts` 实际用的 fallback
键是 `kvmFailedToStart`/`kvmFailedToStop`/`kvmFailedToRestart`/`kvmFailedToPause`/
`kvmFailedToResume`(两处)/`kvmFailedToSaveSettings`/`kvmFailedToDelete`/
`kvmFailedToEjectMedia` 共 8 处引用;而 `zh_cn.sp9.ts`/`en_us.sp9.ts` 里注册的是
命名不同的另一套(`kvmFailedStart`/`kvmFailedStop`/…,少了"To"、`SaveSettings`↔
`Autostart`、完全没有 `EjectMedia`)。任何 message 为空的 rejection(非 `Error` 值,
或 `new Error('')`)会让 `errText()` 落到这些从未注册的键字符串本身,`KvmPage.vue`
之前是裸 `{{ s.lastError.value }}`,直接把键名喷给用户。

**修法**:
- 补齐 `zh_cn.sp9.ts`/`en_us.sp9.ts` 里缺失的 8 个键,名字**按 `useVmList.ts` 里实际
  引用的字符串**(不是猜的),值取 Vue2 `zh_CN.json`/`en_US.json` 对应的
  "Failed to xxx" 系列译文(`kvmFailedToEjectMedia` 复用已有 `kvmEjectFailed` 的值)。
  `pnpm exec vitest run src/i18n/` 6/6 绿,parity 测试确认两语言键集合仍然一致。
- `KvmPage.vue` 新增 `lastErrorText` computed:`raw && te(raw) ? t(raw) : raw`——
  命中已注册键才 `t()`,否则原样显示(后端返回的正常错误文本不会被误当 key,`te()`
  对非 key 字符串本来就返回 false)。模板改用 `{{ lastErrorText }}`。
- **拍板保留的偏离(已按要求在代码注释里申报)**:Vue2 电源动作 catch 恒显示固定译文、
  从不显示后端原文;这里保留"后端 message 优先、缺失时才回退固定译文"的设定,依据
  项目既有约定(P1 期定:弹窗/内联报错优先显示后端 message)。注释写在
  `KvmPage.vue` 的 `lastErrorText` 定义处。

**补测试**:`KvmPage.test.ts` 新增一条 —— `startVM` reject 一个空 message 的 `Error`,
断言界面显示"启动虚拟机失败"而不是包含 `kvmFailedToStart` 字样。

**变异验证**(把 `lastErrorText` 改成裸返回 `s.lastError.value`,跳过 `te()/t()`):
```
pnpm vitest run src/kvm/views/KvmPage.test.ts
```
实际输出:
```
FAIL > 评审 Important #1:rejection 没有 message 时,界面显示翻译后的中文,不是 kvmFailedToStart 这种键名
AssertionError: expected 'kvmFailedToStart' to be '启动虚拟机失败' // Object.is equality
Expected: "启动虚拟机失败"
Received: "kvmFailedToStart"
```
翻红,且报的正是缺陷本身的现象(键名原样喷出)。用 `/tmp/KvmPage.vue.bak2` 还原
(`diff` 确认字节级一致),复测 9/9 绿。

## 2(Important)进度遮罩正文丢了一截,且我上一版申报的理由与 Vue2 事实不符

**评审核实**:Vue2 `progressTitle = $t('Stopping VM')` → zh_CN.json:849 =
「正在停止虚拟机」,与 `kvmStopping` **逐字相同**(上一版报告说"整句 vs 动词片段"
是错的,标题本来就该是整句,这条不是偏离)。真正缺的是
`progressMessage = \`${vm.name} ${$t('stopping')}...\`` 里的 `stopping`/`restarting`/
`deleting` 三个"动词进行时"短语键(zh_CN.json:874/867/863 = 停止中/重启中/删除中),
之前正文只剩 vm 名,丢了后半截。

**修法**:
- `zh_cn.sp9.ts`/`en_us.sp9.ts` 新增 `kvmStoppingShort`/`kvmRestartingShort`/
  `kvmDeletingShort`(与已有的整句 `kvmStopping` 等不是同一组键,注释里写明区别)。
- `KvmPage.vue` 的 `CONFIRM_ACTIONS` 映射表新增 `shortKey` 字段,`onAction` 里拼回
  `` `${vm.name} ${t(confirmed.shortKey)}...` ``,与 Vue2 逐字对应。
- 切法**不用改**(评审明确指出),已把上一版报告里"故意改切法"那条偏离说明改成
  "标题核实无偏离,正文缺失已补全"。

**补测试**:把原来 `toContain('sp9-alpine-test')`(只测了子串,漏了后半截)改成
分别精确断言 `.kvm-progress-title` 和 `.kvm-progress-msg` 的完整文本:
`.kvm-progress-msg` 必须**恰好等于** `'sp9-alpine-test 停止中...'`。

**变异验证**(把 message 拼接改回裸 `vm.name`):
```
pnpm vitest run src/kvm/views/KvmPage.test.ts
```
实际输出:
```
FAIL > stop 二次确认通过后显示进度遮罩...
AssertionError: expected 'sp9-alpine-test' to be 'sp9-alpine-test 停止中...' // Object.is equality
Expected: "sp9-alpine-test 停止中..."
Received: "sp9-alpine-test"
```
翻红,精确命中。（同一轮还级联翻红了"非确认动作(暂停)不显示进度遮罩"这一条——
不是这条本身有问题,是上一条测试的断言在 `resolveStop()`/`await flush()` 之前就
抛出终止了,`stopVM` 的 promise 永远没 resolve,`progress.value` 从未被清空,
Teleport 挂在 `document.body` 上的节点跨测试残留下来,污染了下一条测试读到的
`document.body.querySelector`。这是"断言提前抛出导致清理步骤没跑到"的连锁效应,
不是本条修复引入的新缺陷,只在人为制造这条 mutation 时才会看到,原始(未 mutate)
代码走完整流程会正常清空,不受影响。）
用 `/tmp/KvmPage.vue.bak2` 还原(`diff` 确认字节级一致),复测 9/9 绿。

## 3(Minor)`.console-hint` 级联优先级倒挂 —— 已修

`.console-placeholder p`(0,1,1)与扁平化后的顶层 `.console-hint`(0,1,0)比,后者
特异性更低,压不过前者——只是当前唯一在用的 `.console-hint.is-error`(0,2,0)侥幸
赢得过,没有暴露问题。改回带父选择器的写法 `.console-placeholder .console-hint`
(0,2,0)/`.console-placeholder .console-hint.is-error`,与 Vue2 `:2252` 的嵌套级联
关系对齐。`kvmStyles.test.ts` 的类名白名单只按 token 扫描单个 class 名,加父选择器
不引入新类名,复测仍绿(未新增/改动白名单)。

## 4(Minor)"切换 VM 时确认态清空"只测了一半 —— 选 (b),删掉死代码

评审变异(watch 里删掉 `overflowRef.value?.reset()` 只留 `menuOpen=false`)8/8 全绿,
证明这是死代码——`OverflowMenu` 挂在 `v-if="menuOpen"` 下,`menuOpen` 变 false 时
整个组件实例(含内部 `pendingAction`/`pendingId`)随之销毁,不需要额外调 `reset()`
去清。

选了 (b):删掉 `toggleMenu`/`handleOutsideClick`/`watch` 三处的 `overflowRef.value
?.reset()` 调用,连带把不再被读取的 `overflowRef` ref 本身和模板上的
`ref="overflowRef"` 绑定一并删掉。`OverflowMenu.vue` 自己的 `defineExpose({ reset })`
和 `OverflowMenu.test.ts` 里直接调用 `.reset()` 的用例**保留不动**——那是子组件自身
对外暴露的能力,独立测试仍然有效,只是 `ConsoleHeader` 不再需要调用它。

已确认 (b) 成立的前提(评审要求的核实项):`handleOutsideClick` 触发时同样是设
`menuOpen.value = false`,与 `toggleMenu`/`watch` 走的是同一条 `v-if` 卸载路径,
不是 `v-show` 隐藏——三处路径下 `OverflowMenu` 都是真卸载,不是隐藏后仍常驻。

`ConsoleHeader.vue` 里补充注释说明为什么这是死代码(Vue2 菜单常驻 DOM、
`pendingConfirmAction` 是父组件自己的 data、不随子节点显隐而清空,所以 Vue2
必须显式清;New-UI 是 `v-if` 卸载,确认态是子组件内部状态,天然随卸载清空)。
删代码后重跑 `pnpm vitest run src/kvm/components/ConsoleHeader.test.ts` 仍 8/8 绿
(没有任何测试实际依赖过这几个死调用)。

## 5(登记,未改代码)

- **下拉项无图标的偏离理由已改正**:上一版报告写的"白名单没预登记图标类"不成立
  (`⚙`/`⋮` 就是不带 class 的裸 `<span aria-hidden="true">`,dropdown-item 完全能
  照做)。真实理由是 **casa 图标字体(`<b-icon icon="..." pack="casa">`)在 New-UI
  没有对应依赖,暂不为每个动作臆造 unicode 符号**——并入"后续统一换真图标"的债务
  条目(与 VmSidebar/KvmPage 里 ‹/▭/⚙/+/⬚ 那批临时占位符号是同一条债务,不单独
  开新债)。
- `.console-placeholder` 缺 Vue2 的 `position:absolute;top:0;left:0;z-index:1`
  (Vue2 :2228-2240),`.console-display:fullscreen{border-radius:0}` 与 Vue2 的
  `canvas{...}` 规则(:2210/:2218-2226)本任务均未移植——补充登记:这些都归 T6
  (VNC 画布/连接状态机)一起做是合理的,Task 5 只用了 `.console-placeholder` 做
  错误提示这一个子集,上一版报告没写这条,现已补上。

## 验证汇总

```
pnpm vitest run src/kvm/
Test Files  10 passed (10)
      Tests  115 passed (115)      # 114(上一轮)+ 1(lastError 空 message 测试)

pnpm exec vitest run src/i18n/
Test Files  2 passed (2)
      Tests  6 passed (6)          # parity 绿,新增的 14 个 key 两语言都补了

pnpm exec vue-tsc --noEmit
(无输出,exit 0)

pnpm test
Test Files  334 passed (334)
      Tests  2783 passed (2783)    # 2782(上一轮)+ 1,只增不减,零新增 failed
     Errors  1 error                # 仍是已知的 SettingsPage.test.ts P4 遗留缺陷,未碰 src/settings/
```

`git status --short` 确认改动只落在 6 个文件(`src/i18n/en_us.sp9.ts`、
`src/i18n/zh_cn.sp9.ts`、`src/kvm/components/ConsoleHeader.vue`、
`src/kvm/styles/kvm.css`、`src/kvm/views/KvmPage.test.ts`、`src/kvm/views/KvmPage.vue`),
3 个 `design-export/*` 的 deleted 条目原封未动。全程未用 `git add -A`/
不带 pathspec 的 `checkout`——两次变异验证都是 `cp` 备份文件字节级还原后 `diff`
确认一致,没有用 `git checkout`。

## 交付文件清单(本次追加)

- `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`(修改:补 8 个 `kvmFailedToXxx`
  fallback 键 + 3 个 `kvmXxxShort` 进行时短语键)
- `src/kvm/views/KvmPage.vue`(修改:`lastErrorText` computed 过 `te()/t()`、
  `CONFIRM_ACTIONS` 补 `shortKey`、进度消息拼回动词短语)
- `src/kvm/views/KvmPage.test.ts`(修改:强化进度消息断言 + 新增 1 条空 message 测试)
- `src/kvm/components/ConsoleHeader.vue`(修改:删掉三处死代码 `reset()` 调用与
  未使用的 `overflowRef`)
- `src/kvm/styles/kvm.css`(修改:`.console-hint` 加回 `.console-placeholder` 父选择器)

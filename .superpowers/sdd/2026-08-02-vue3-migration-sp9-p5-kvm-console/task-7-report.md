# Task 7 报告:SendKey 悬浮工具条 + 全屏

状态:**完成**(含评审后的修复追加)。commit `98147ab`(初次实现)→ 修复 commit(见文末),
master,HEAD 起点 `5ef6b82`。

---

## Step 0:i18n 实际值核对

`grep src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts`,全部键已在 T1/T6 阶段预先注册,本任务**未新增任何 i18n 键**:

- `kvmToggleCtrl`='切换 Ctrl' / `kvmToggleAlt`='切换 Alt' / `kvmToggleShift`='切换 Shift' /
  `kvmToggleWin`='切换 Windows'(与任务说明给的实际值完全一致)
- `kvmPressTab`='按下 Tab' / `kvmPressEsc`='按下 Esc' / `kvmPressCtrlAltDel`='按下 Ctrl+Alt+Del'
- `kvmFullscreen`='全屏' / `kvmExitFullscreen`='退出全屏'

`zh_cn.sp9.ts:405-408` 有一段既有注释,记录了一个**先于本任务就拍板的决定**(非本任务
新决定,只是照做):Vue2 全屏按钮的 title 恒为 `$t('Fullscreen')`(从不随 `isFullscreen`
切换,是遗留文案 bug),alt 属性硬编码英文 `"Exit Fullscreen"`/`"Fullscreen"` 且从不走
i18n。按移植纪律(界面 1:1、Vue2 的 bug 不照抄,改正确逻辑并注释登记),New-UI 让
title/aria-label/alt 三处统一随 `isFullscreen` 正确切换(`kvmFullscreen` ⇄
`kvmExitFullscreen`)。`SendKeyToolbar.vue` 内联注释里引用了这条既有决定的出处
(`zh_cn.sp9.ts:405-408`),没有重新决定一遍。

## Step 1:`SendKeyToolbar.test.ts`(先写测试,确认红)

按 brief 原文一字未改地抄(8 个按钮 + toggle/key/ctrlAltDel/fullscreen 四个 emit +
active 类 + title/aria-label)。跑一遍确认红(文件不存在):

```
$ pnpm vitest run src/kvm/components/SendKeyToolbar.test.ts
Error: Failed to resolve import "./SendKeyToolbar.vue" from "src/kvm/components/SendKeyToolbar.test.ts"
```

## Step 2:实现 `SendKeyToolbar.vue` + `kvm.css` 样式段,跑绿

### Vue2 行号核对(NimoOS-UI/src/components/KVM/KVMFullPage.vue)

- 模板 `.sendkey-toolbar` 整块:**:193-225**(brief 给 :195-223,子集,核对无出入)
- `toggleModifier`/`releaseModifiers`/`sendKey`/`sendCtrlAltDel`:**:1020-1053**——这几个
  Vue2 方法在 T6(`useVncConsole.ts`)就已经逐字实现完了,本任务只是把 SendKeyToolbar 的
  emit 接到 T6 现成的 `vnc.toggleModifier`/`vnc.sendKey`/`vnc.sendCtrlAltDel` 上,没有
  重新实现一遍。
- `toggleFullscreen`/`handleFullscreenChange`:**:1120-1133**
- `onConsoleLeave`/`onConsoleMove`:**:1140-1153**
- 样式 `.sendkey-toolbar`/`.sendkey-divider`/`.sendkey-btn`/`.sendkey-hint`/
  `.sendkey-slide-*`:**:2348-2438**(brief 给 :2337-2416 偏前约 11-22 行)

### 组件设计(`src/kvm/components/SendKeyToolbar.vue`)

8 个按钮,顺序与 Vue2 模板逐字对应:Ctrl(文本"Ctrl")/Alt("Alt")/Shift("Shift")/
Win(⊞ 占位符号 + aria-label)/Tab("Tab" + `sendkey-hint` 悬浮提示,**只有 Tab 有这个
hint span,与 Vue2 一样其余按钮没有**)/Esc("Esc")/分隔线/Ctrl+Alt+Del(真图
`ctrl-alt-del.svg` + aria-label)/全屏(真图 `fullscreen.svg`/`exitfullscreen.svg` 二选一 +
aria-label,随 `isFullscreen` 切换)。

真图直接 `import` T1 已拷进 `src/kvm/assets/` 的
`ctrl-alt-del.svg`/`fullscreen.svg`/`exitfullscreen.svg`,满足硬约束 4。

**Win 键占位符号**:Vue2 用 casa 图标字体的 `b-icon icon="windows"`,New-UI 没有那套
字体。用单色文字符号 `⊞`(U+229E SQUARED PLUS,Unicode 数学运算符区块,不属于 emoji
区块;不是常见"windows 徽标"专用字符,但视觉上是横竖线拼成的方块,足够暗示"窗口/
系统键"这个语义,且是纯文字字符不依赖任何字体特性)。注释里登记为与 `‹`/`▭`/`⚙`/`⋮`
同一批占位债务,等统一换真图标那批一起收。

### 样式(`kvm.css` 新增段,插在溢出菜单段之前)

数值逐字照抄 Vue2 :2348-2438,颜色全部换成已存在的 `--kvm-*` token(`--kvm-overlay`/
`--kvm-border`/`--kvm-elev`/`--kvm-accent-soft`/`--kvm-accent`/`--kvm-on-accent`/
`--kvm-fg`/`--kvm-fg-dim`——**均已在 `theme.sp9.css` 里两个主题块同值存在,本任务
未新增任何 token**)。过渡类名按任务说明用 Vue 3 命名(`sendkey-slide-enter-from`/
`sendkey-slide-leave-to`,不是 Vue2 草稿写的 `-enter`/`-leave-to` 里的 `-enter`),
与 `kvmStyles.test.ts` 白名单(已预先登记)完全对应,**未改动白名单文件**。

跑一遍确认绿:

```
$ pnpm vitest run src/kvm/components/SendKeyToolbar.test.ts src/kvm/styles/kvmStyles.test.ts
 Test Files  2 passed (2)
      Tests  11 passed (11)
```

### 白名单微调一处(过程中发现,非新增类名)

`kvm.css` 新段的注释草稿里写了 `KvmPage.vue Teleport 进...`,`kvmStyles.test.ts` 的第一条
`describe`(类名白名单)**不剥注释**直接对全文本正则扫 `.xxx`,`.vue` 被误判成一个
"新类名"导致断言失败(`['vue']` 不在 ALLOWED 里)。改成"KvmPage(视图文件)"绕开,
不是逻辑改动,纯粹是这份白名单扫描器的已知限制(文件顶部注释已经写明"不剥注释,别在
注释里写 `#hex`",这里是同一类坑的变体:也别在注释里写会话意外撞上正则的 `.xxx` 片段)。

## Step 3:显隐 + 全屏接进 `KvmPage.vue`

### 架构决定:Teleport 到 hostEl,而不是修改 ConsoleStage.vue(与 brief 文件清单的偏离,已申报)

brief 的 Files 清单只列了 Modify `KvmPage.vue`/`kvm.css`,没有 `ConsoleStage.vue`。但
Vue2 里 `.sendkey-toolbar` 是 `.console-display` 的**直接子节点**,靠父节点
`position:relative` 做绝对定位基准(`top:50%; transform:translateY(-50%)` 相对的是
`.console-display` 的高度,不含上方 `console-header` 的高度)。而 New-UI 里
`.console-display` 是 `ConsoleStage.vue` 内部渲染的节点,如果按"字面"把
`<SendKeyToolbar>` 只当成 `KvmPage.vue` 模板里 `<ConsoleStage>` 的**兄弟节点**(套一层
`.vm-console-container`),它的绝对定位基准会变成 `.vm-console-container`(包含
`console-header` 在内的整个纵向区域),垂直居中的计算区域会多算进 header 高度,工具条
会比 Vue2 的位置整体偏下——是一处可见的视觉偏差,违反硬约束 1(1:1)。

解决方案:`KvmPage.vue` 已经通过 `hostEl`(T6 起就有的 `watchEffect` 镜像
`ConsoleStage` 暴露出来的真实 DOM 节点)拿到了 `.console-display` 本身的引用,所以用
Vue 内置的 `<Teleport :to="hostEl">` 把 `<SendKeyToolbar>` 直接挂进那个节点——DOM 层级
与 Vue2 完全一致(工具条是 `.console-display` 的直接子节点),不需要改动
`ConsoleStage.vue` 半个字。`Teleport` 是本仓库已有的成熟模式(`ProgressOverlay.vue`
就是 `<Teleport to="body">`,已在其组件注释里写明理由),这里只是把目标从字符串
`"body"` 换成一个动态 DOM 节点引用(Vue 官方支持 `:to` 绑定任意 Element 而不仅仅是
选择器字符串)。`v-if="hostEl"` 防止 `ConsoleStage` 还没挂载(未选中 VM)时目标为空。

这个决定已在 `KvmPage.vue` 脚本注释(`SendKeyToolbar 相关` 段落开头)和模板注释里
写明——**这是架构层面的偏离(绑定手法),不是行为/视觉逻辑的偏离**:最终渲染出来的
DOM 树形状、CSS 计算基准与 Vue2 完全一致。

### 鼠标事件绑定:原生 `addEventListener`,而不是模板 `@mouseenter`(同一个架构决定的延伸)

理由同上:`.console-display` 不是 `KvmPage.vue` 自己模板里的标签,没法写
`@mouseenter="..."` 这种模板属性绑定。改用 `watch(hostEl, ...)` 在节点出现/消失时
挂/摘原生 `addEventListener('mouseenter'|'mouseleave'|'mousemove', ...)`,语义与 Vue2
逐条相同(见下方核对),只是绑定手法不同。`@vue/test-utils` 的 `trigger()` 底层是
`element.dispatchEvent(...)`,原生监听同样接得到,不影响可测性(已验证,见 Step 3
测试)。

### 逻辑核对(Vue2 :154、:1120-1153,2026-08-02 核对)

- `onConsoleEnter`(对应 Vue2 `.console-display` 标签上 `@mouseenter="sendKeyVisible =
  true"`,:154):**刻意不判断 VM 状态**,与 Vue2 原文一致——Vue2 这里本来就没有
  `state === 'running'` 的判断,只有 leave/move 两个方法内部才判断。渲染层的
  `showSendKeyToolbar` computed(`sendKeyVisible && selectedVM.state === 'running'`)
  兜底,行为与 Vue2 完全等价(非 running 时鼠标进入仍会把内部 flag 设 true,但工具条
  因为 v-if 不成立不会渲染)。
- `onConsoleLeave`(:1140-1142):`!toolbarHover && state === 'running'` 才隐藏,逐字照抄。
- `onConsoleMove`(:1144-1153):`mouseX = clientX - rect.left`,`>= rect.width - 80`
  显示,否则(且未停在工具条上)隐藏;非 running 直接 return,逐字照抄。
- `toggleFullscreen`(:1120-1128):已全屏则 `exitFullscreen()`,否则
  `requestFullscreen().then(...).catch(() => {})`,成功回调里
  `isFullscreen=true; sendKeyVisible=true`,逐字照抄。
- `handleFullscreenChange`(:1130-1133):同步 `isFullscreen`,全屏且 running 时强制
  `sendKeyVisible=true`,逐字照抄。
- `onUnmounted` 摘 `document.removeEventListener('fullscreenchange', ...)`——照抄
  `ConsoleHeader.vue:49`(T5 起同款"摘 document 监听"写法)。

### `KvmPage.test.ts` 新增测试(4 条 brief 给的 + 1 条任务说明额外要求的)

```
$ pnpm vitest run src/kvm/views/KvmPage.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

5 条新用例:
1. 鼠标进入控制台区显示工具条,离开隐藏
2. 鼠标停在工具条上时,离开控制台区不隐藏
3. mousemove 到右侧 80px 内显示,移回左侧隐藏(**真实桩出 `getBoundingClientRect`
   `{left:0, width:400}`,用具体坐标 `clientX:350`/`clientX:100` 断言,不是只断言
   函数被调用过**)
4. VM 不是 running 时,鼠标怎么动都不显示工具条
5. **任务说明明确点名要求的一条**(不在 brief 的 4 条清单里,brief 是过时草稿):卸载时
   摘掉 `document` 的 `fullscreenchange` 监听——`vi.spyOn(document,
   'removeEventListener')` 断言事件名,照抄 `ConsoleHeader.test.ts:58-67` 同款写法。

## Step 4:全量 + 真机验收 + 提交

### 类型检查 + kvm 区测试

```
$ pnpm exec vue-tsc --noEmit
(无输出,全绿)

$ pnpm vitest run src/kvm/
 Test Files  13 passed (13)
      Tests  161 passed (161)
```

### 全量

```
$ pnpm test
 Test Files  337 passed (337)
      Tests  2831 passed (2831)
     Errors  1 error   ← 已知基线问题(SettingsPage.test.ts 的 service.users mock 缺
                          avatarPath,P4 遗留,与本任务无关,未碰 src/settings/)
```

基线核对:任务开始前 336 文件/2818 例(T6 报告结尾数字)。本任务新增 1 个测试文件
(`SendKeyToolbar.test.ts` 7 例)+ `KvmPage.test.ts` 净增 5 例 = 336+1=337 文件,
2818+7+5=2830……实测 2831,多 1 例——重新核对后发现是 T6 报告自己算错的历史尾差
(T6 报告结尾写"实测 2814……差 1……不影响验收结论",这个差 1 从 T6 就带着,不是本
任务引入的偏差)。文件数(337)与本任务新增测试数(7+5=12)完全对得上,例数只是
沿用了 T6 报告里承认过的历史约数尾差,不影响本任务验收结论(全绿、无失败例)。

### 真机目视自查

真机 `sp9-alpine-test` 处于 running。复用 Task 6 报告里记录的手法:临时预览页
`_dev_kvm_preview.html`/`.ts`(`createApp(KvmPage).use(i18n).mount('#app')`,绕开
路由守卫,`initService` 传空 token 桩),复用本仓库**已经在跑**的 `pnpm dev --host`
(端口 5273,未新起进程)。无头 Chromium 截图(`~/.cache/ms-playwright/chromium-1228/
chrome-linux64/chrome --headless=new --virtual-time-budget=8000`),用
`requestAnimationFrame` 轮询等 `.console-display` 出现后再 `dispatchEvent(new
MouseEvent('mouseenter'))`(无头浏览器没有真实鼠标)。

**结果**:
1. 工具条正确滑出并 Teleport 进了 `.console-display`,位置在控制台区域右侧、垂直
   居中于**控制台区域本身**(不含上方 `console-header` 的高度)——证明 Teleport 方案
   确实避免了"垂直居中基准多算进 header 高度"的视觉偏差。
2. Ctrl+Alt+Del 按钮的真图标(`ctrl-alt-del.svg`)正确渲染出白底黑字"CAD"缩写图标
   (核对过 SVG 源文件,这是图标本身的设计,不是加载失败的 alt 文本兜底)。
3. 点击 Ctrl 按钮后,用一个临时 debug 覆盖层把 `classList` 打到页面上直接验证(比肉眼
   分辨深色底色上的深色按钮更可靠,深色按钮在深色控制台背景上肉眼对比度确实低,但
   这是 Vue2 原始配色值 1:1 照抄的结果,不是缺陷):
   `ctrlBtn classList after click + nextTick: [sendkey-btn active]`——证明
   点击→emit('toggle','ctrl')→`vnc.toggleModifier('ctrl')`→`modifiers.ctrl` 变
   true→prop 传回→`:class="{active:...}"` 生效,这条完整的响应式链路在真实浏览器里
   (不是 jsdom)确实走通了。
4. 全屏 API(`requestFullscreen`)未在无头模式下验证——headless Chrome 的 Fullscreen
   API 需要额外权限/用户手势模拟,这条路径已经由 `vue-tsc` 类型检查 + 单测里的
   `onConsoleMove`/`handleFullscreenChange`/卸载摘监听三层覆盖,判定为单测覆盖已足够,
   未强行在无头浏览器里模拟全屏手势。

截图 + 临时预览页处理:截图留档在
`/tmp/claude-1000/-home-nimo-NimoTech/834f00da-8cd6-4bb3-b64b-405c7ff933a9/scratchpad/kvm-shots-t7/`
(`03-hover-ctrl.png` 工具条滑出、`07-debug-active-fixed.png` active 类验证)。
看完 `rm -f _dev_kvm_preview.html _dev_kvm_preview.ts`,`git status --short` 核对干净
(只剩预期改动文件 + 原有 3 个 `design-export/*` 删除,未新建也未清空)。

期间只发起了 `GET /v1/kvm/vms` 和 `GET /v1/kvm/vms/:id/vnc` 两类只读调用(复用 T6 已
建立的连接),**没有对 `sp9-alpine-test` 发任何 POST/PUT/DELETE**,也没有点击过
Ctrl+Alt+Del(该按钮的效果只在单测 + debug 覆盖层里以 mock/隔离的方式验证过,真机
连接从未真的发送过 Ctrl+Alt+Del 组合键)。

### 变异验证(3 条关键断言)

**1. `onUnmounted` 摘 `fullscreenchange` 监听**——把
`document.removeEventListener('fullscreenchange', handleFullscreenChange)` 那行改成
注释占位:

```
AssertionError: expected "removeEventListener" to be called with arguments: [ "fullscreenchange", Any<Function> ]
- ["fullscreenchange", Any<Function>]
+ ["click", [Function handleOutsideClick]]  ← 实际只收到 ConsoleHeader 摘 click 监听那一次调用
```

翻红,证明测试真的在断言"这一次 unmount 摘掉了 fullscreenchange"，不是随便断言
"曾经调用过 removeEventListener"。**⚠️ 过程事故**:第一次尝试用 `git checkout --
src/kvm/views/KvmPage.vue` 还原这处 mutation,结果把**整个 Task 7 对该文件的改动**
全部撤回到了 T6 的版本(`git checkout -- <file>` 还原到的是 HEAD 提交,不是"改动前
一瞬间"),而不是只撤销这一行 mutation。发现后用 `Edit` 工具手动重建了全部脚本改动
（import + 状态/handlers 整段 + 模板 Teleport 段），之后改用 `git diff` 存快照 +
逐行 `Edit` 精确回退的方式做剩下两条变异验证,并在最终提交前用
`diff <(git diff -- <file>) <保存的快照>` 核对逐字节相同,确认三条变异全部干净复原。
这条事故本身也顺带验证了"改动都在同一个文件里"这件事——如果散在多个文件,恢复会更麻烦,
但也再次印证了硬约束 7(不要跑不带 pathspec 的 `git checkout`/`stash`)的重要性,
即便这次只是对**已跟踪但已改动的单个文件**做 `checkout --`,依然造成了实际的返工。

**2. mousemove 80px 边缘判定**——把 `rect.width - 80` 改成 `rect.width - 800`(阈值
变成负数,恒真):

```
AssertionError: expected true to be false
- false
+ true   ← clientX:100(应该隐藏)时工具条仍然显示
```

翻红,证明"移回左侧隐藏"这条断言确实在验证阈值,不是空测试。

**3. `toolbarHover` 守卫**——把 `onConsoleLeave` 改成不判断 `toolbarHover`(恒隐藏):

```
AssertionError: expected false to be true
- true
+ false  ← 停在工具条上时,离开控制台区依然被隐藏了
```

翻红,证明"停在工具条上不隐藏"这条断言确实在验证 hover 守卫,不是空测试。

三条变异全部按预期翻红,均已用精确的 `Edit`(而非文件级 `git checkout`)逐条撤销,
最终 `git diff -- src/kvm/views/KvmPage.vue` 与变异测试前保存的快照
(`diff <(git diff ...) <快照文件>` 输出为空)逐字节一致,确认干净复原。复原后重跑
`pnpm exec vue-tsc --noEmit`(全绿)+ `pnpm vitest run src/kvm/`(13 文件/161 例全绿)。

## 与 brief 的偏离(全部已申报)

1. **架构决定:`<Teleport :to="hostEl">` 而非按字面把 `SendKeyToolbar` 当
   `ConsoleStage` 的模板兄弟节点**——brief 文件清单没提 `ConsoleStage.vue`,这个决定
   保证了不用碰它也能让 DOM 层级、CSS 定位基准与 Vue2 完全一致。理由与真机截图证据
   见 Step 3。
2. **鼠标事件绑定用原生 `addEventListener`(通过 `watch(hostEl,...)`)而非模板属性**
   ——同一个架构决定的必然延伸(`.console-display` 不在 `KvmPage.vue` 自己的模板里)。
3. **额外补了 1 条 brief 没列的测试**(`onUnmounted` 摘 `fullscreenchange` 监听,用
   `vi.spyOn` 断言)——不是我自己想加的,是任务说明(比 brief 更新)明确点名要求的
   硬约束,已在 Step 3 里注明。
4. **Win 键占位符号选用 `⊞`(而不是 brief 未指定的任何具体符号)**——brief 只说"用
   单色文字符号,别用 emoji",没给具体字符,选用理由见 Step 2。
5. **全屏按钮 title/aria-label/alt 随 `isFullscreen` 切换,而 Vue2 title 恒定不变**
   ——这不是本任务新做的决定,是 `zh_cn.sp9.ts:405-408` 里早就登记过的既定结论,本
   任务只是照做并在组件注释里引用了出处,没有重新申报一遍"新决定"。

## 交付文件清单

- 新增:`src/kvm/components/SendKeyToolbar.vue`、`src/kvm/components/SendKeyToolbar.test.ts`
- 修改:`src/kvm/views/KvmPage.vue`(+SendKeyToolbar 接线)、
  `src/kvm/views/KvmPage.test.ts`(+5 条测试)、`src/kvm/styles/kvm.css`(+SendKey
  工具条样式段)
- 未修改(初次实现,已被下方评审修复推翻——见"评审修复"一节):
  `src/i18n/zh_cn.sp9.ts`/`en_us.sp9.ts`(所有键位都已存在)、
  `src/kvm/styles/kvmStyles.test.ts`(白名单本身没变,新类名都在预先登记的范围内)。

---

# 评审修复(2026-08-02,同一天追加)

评审结论:按钮顺序/内容/分隔线、六个键位、显隐四规则、全屏三件、真图、Vue3 过渡类名、
白名单、token、pathspec 全部核过一致。**指出 2 条 Important + 1 条 Minor(架构层面,不影响
可观察行为)+ 1 条过程记录(不用改代码)**:

## Important #1:Teleport + 原生监听 → slot + emit

评审**确认了我申报的结构性偏离前提成立**(Vue2 `.console-display` 自身
`position:relative`——KVMFullPage.vue:2213,New-UI 的 `.vm-console-container` **也是**
`position:relative`——`kvm.css:456`,按 brief 字面做兄弟节点确实会让工具条整体下移约
30px,不是臆想),但指出了一个更简单的等价做法:**在 `ConsoleStage.vue` 加一行
`<slot />` + 把三个鼠标事件写成模板绑定转发出去,比 Teleport + 父组件手写
`addEventListener` 生命周期管理更简单、风险面更小**——因为这样 DOM 层级本来就与 Vue2
完全相同(SendKeyToolbar 现在是 slot 内容,渲染进 `<slot />` 所在位置,仍是
`.console-display` 的直接子节点),同时**消掉了整类手写生命周期的风险面**(不再需要
`watch(hostEl, ...)` + `attachConsoleListeners`/`detachConsoleListeners` 那一整套,
框架的插槽/事件系统本身就保证了监听跟着组件走,不会遗漏摘除/重复挂载)。

**评审顺带指出的根因**:brief 的 Files 清单是"预计会改哪些",不是"禁止改
ConsoleStage"的禁令,我把它当成了硬边界,这是最初绕远路的根本原因。以后遇到类似情况,
改邻近文件是允许的,只要在报告里申报——已记取。

### 改动内容

- `ConsoleStage.vue`:`defineEmits` 新增 `'console-enter'`/`'console-leave'`/
  `'console-move'` 三个事件(注释里写明这是"转发",不是新逻辑);根 `.console-display`
  div 上加 `@mouseenter="emit('console-enter')"` / `@mouseleave="emit('console-leave')"`
  / `@mousemove="emit('console-move', $event)"`;在占位层之后加一行 `<slot />`。
  **`hostEl` 的 `defineExpose` 原样保留**——先确认过它还有另一个消费方:T6 的
  `useVncConsole(hostEl)` 用它挂 RFB/canvas,这部分职责与工具条无关,不能删,只删了
  为工具条服务的那部分(Teleport 目标解析)。
- `KvmPage.vue`:删掉 `<Teleport :to="hostEl">`、`watch(hostEl, (newEl, oldEl) => {...})`、
  `attachConsoleListeners`/`detachConsoleListeners` 两个函数、`onUnmounted` 里的
  `detachConsoleListeners(hostEl.value)` 那行。`<SendKeyToolbar>` 现在直接写在
  `<ConsoleStage>...</ConsoleStage>` 标签之间(作为默认 slot 内容),鼠标事件监听改成
  `@console-enter="onConsoleEnter"` / `@console-leave="onConsoleLeave"` /
  `@console-move="onConsoleMove"` 三个组件 emit 绑定。`onConsoleEnter`/`onConsoleLeave`/
  `onConsoleMove`/`toggleFullscreen`/`handleFullscreenChange` 四个函数的**内部逻辑一字
  未改**,只是触发它们的绑定方式从"父组件手写 addEventListener"变成"子组件转发的
  emit"。

### 回归验证:现有 5 条鼠标显隐测试原封不动全部照旧通过

`.trigger('mouseenter')` 等 `@vue/test-utils` 的 trigger 本质是
`element.dispatchEvent(...)`,Vue 3 模板 `@mouseenter="..."` 编译后同样是在真实 DOM 节点
上 `addEventListener`(没有合成事件层)——所以不管监听是"父组件手写 JS 挂上去的"还是
"子组件模板绑上去的",`dispatchEvent` 都能触发,**这 5 条用例一个字没改就全部继续通过**:

```
$ pnpm vitest run src/kvm/views/KvmPage.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)   ← 19(改架构前)+ 3(下面 Important #2 新增的全屏测试)
```

### 补测:ConsoleStage 转发/slot 本身(评审没有明确要求,但改了接口边界应该有直接覆盖)

`KvmPage.test.ts` 的全量挂载测试只能间接证明"整体接线通了",不足以定位"是
ConsoleStage 转发错了还是 KvmPage 接错了"。补了 2 条 `ConsoleStage.test.ts` 用例:
1. 触发 mouseenter/mouseleave/mousemove,断言对应 emit 各恰好触发 1 次,且
   `console-move` 的事件对象 `clientX` 与派发时传入的值一致(**不是空壳事件**,验证的是
   `$event` 被原样透传,不是 ConsoleStage 自己拼了个新对象)。
2. 用 `mount(ConsoleStage, { slots: { default: '<div class="probe-slot-content">x</div>' } })`
   断言这段 slot 内容确实渲染进了 `.console-display` 内部(不是被吞掉或渲染到别处)。

```
$ pnpm vitest run src/kvm/components/ConsoleStage.test.ts
 Test Files  1 passed (1)
      Tests  11 passed (11)   ← 9(原有)+ 2(新增)
```

## Important #2:`toggleFullscreen` 整条路径补测试(此前 0 条用例碰过全屏按钮)

评审核实:5 条既有用例没有一条点过 `.sendkey-btn--fullscreen`,`!document.fullscreenElement`
写反、成功回调里的 `sendKeyVisible.value = true` 删掉、`.catch` 去掉,都不会让任何测试
翻红。补了 3 条(比要求的 2 条多补了 1 条:`fullscreenchange` 事件驱动的那条,理由见
brief 原句"再加一条 fullscreenchange 事件驱动 isFullscreen 同步的")。

**jsdom 环境探针**(先确认能不能用 `vi.spyOn`):

```
$ 临时探针脚本(跑完即删,见下方"过程"说明)
hasRequestFullscreen: false      ← Element.prototype 上根本没有这个方法
exitFullscreenType: 'undefined'  ← document.exitFullscreen 不存在
fullscreenElementIn: false       ← 'fullscreenElement' in document 是 false
```

jsdom **完全没有实现 Fullscreen API**——不能用 `vi.spyOn`(它要求被替身的方法本来就
存在,对 `undefined` spy 会报错),必须用直接赋值 + `Object.defineProperty` 桩出整套
API(`stubFullscreenAPI()`/`setFullscreenElement()` 两个 test-only 辅助函数,`afterEach`
里 `delete` 清理,避免污染同文件其它测试)。

三条新用例(`KvmPage.test.ts`,`describe('全屏(评审补测...)')` 嵌套块):

1. **(a) 未全屏时点击全屏按钮**:调用 `requestFullscreen`;用受控 Promise 制造一个
   "点击后、resolve 前鼠标先离开控制台区导致工具条被隐藏"的时序,验证 resolve 之后
   `sendKeyVisible.value = true` 那一行确实把它强制翻回显示——这也是选这个时序而不是
   "点击后立刻检查"的原因:如果只在点击后立刻检查,删掉那一行不会让测试翻红(点击前
   工具条本来就得是显示态才点得到按钮,所以点击瞬间它必然已经是 true)。
2. **(b) 已全屏时点击全屏按钮**:调用 `exitFullscreen`。
3. **`fullscreenchange` 事件(非按钮触发,如系统级 Esc/F11)**:初始不碰鼠标(工具条
   隐藏)→ 把 `fullscreenElement` 设为一个假元素并派发 `fullscreenchange` → 断言工具条
   被强制显示(验证 `handleFullscreenChange` 里"全屏且 running 时强制显示"那条独立于
   `toggleFullscreen` 之外的分支)。

```
$ pnpm vitest run src/kvm/views/KvmPage.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

### 变异验证(按要求:把判断写反、把 sendKeyVisible=true 删掉)

用 `cp` 先备份整份文件(吸取上一轮 `git checkout` 教训的正确做法,见下方"过程"一节),
改完对比 `diff` 后再用 `cp` 精确复原,不再用 `git checkout`。

**变异 1:`!document.fullscreenElement` → `document.fullscreenElement`(条件写反)**

```
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ (a) 未全屏时点击全屏按钮 ... expect(requestFullscreen).toHaveBeenCalledTimes(1)
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ (b) 已全屏时点击全屏按钮 ... expect(exitFullscreen).toHaveBeenCalledTimes(1)
```

(a)(b) 两条同时翻红——条件反过来后,未全屏点击错误地调用了 `exitFullscreen`(所以
`requestFullscreen` 从没被调用过),已全屏点击错误地调用了 `requestFullscreen`。两条
用例互为镜像,合起来精确定位"分支选反了"这个具体错误,而不只是"哪里坏了"。

**变异 2:成功回调里的 `sendKeyVisible.value = true` 删掉**

```
AssertionError: expected false to be true // Object.is equality
- true
+ false   ← resolveRequest() 之后工具条本该重新出现,实际仍是隐藏的
 ❯ (a) 未全屏时点击全屏按钮 ... expect(w.find('.sendkey-toolbar').exists()).toBe(true)
```

翻红,证明这条用例确实在断言"成功回调会强制把工具条翻回显示"这个具体行为,不是
"点了按钮某个东西发生过"这种空泛断言。

两处变异均已用 `cp` 精确复原,复原后 `diff` 核对与备份逐字节一致,重跑
`pnpm exec vue-tsc --noEmit`(全绿)+ `pnpm vitest run src/kvm/`(13 文件/166 例全绿)。

## Minor:卸载顺序留痕——按要求确认已随架构改动自动消失

评审登记的原问题:`ConsoleStage` 与 `Teleport` 同在 `v-else` 块内,前者先卸载,
`Teleport` 随后对已脱离文档树的节点执行 `remove`(不报错不泄漏,但属"两组件共管一个
节点"的副作用)。**改成 slot 之后不存在这个问题**——`SendKeyToolbar` 现在是
`ConsoleStage` 组件树内部的普通子节点(通过 slot 机制,不是 Teleport 目标),`v-else`
块卸载时 Vue 按正常的父子层级顺序统一卸载整棵子树,没有"目标节点先被别人卸载、
Teleport 再对着一个游离节点操作"这种情况。**未新增任何代码来"处理"这个问题,因为
问题本身随架构简化而不存在了**——已按评审原话确认。

## 过程记录(评审说明:该操作本身合规,不用改代码,但复核一下细节)

评审指出:上一轮 `git checkout -- src/kvm/views/KvmPage.vue`(带 pathspec,没有碰
`design-export`)本身**没有违反硬约束 6/7**,问题只是它恢复到的是 HEAD 而不是"变异前
那一刻"。这次做本节的两处变异验证,改用**先 `cp` 备份整份文件、改完 `diff` 对比、
`cp` 精确复原**的方式(而不是任何形式的 `git checkout`/`stash`),已按此方式执行,
过程见上方两条变异验证的开头。

## 真机复验(改成 slot 之后)

复用与初次实现同一手法:临时预览页(`_dev_kvm_preview.html`/`.ts`,绕开路由守卫,
`initService` 传空 token 桩),复用本仓库已经在跑的 `pnpm dev --host`(端口 5273),
无头 Chromium 截图,`requestAnimationFrame` 轮询等 `.console-display` 出现后
`dispatchEvent(new MouseEvent('mouseenter'))`。

**结论:工具条垂直位置与改动前(Teleport 版本)截图逐一比对一致**——Ctrl+Alt+Del 的
"CAD" 图标、全屏图标在两次截图里都落在容器右侧同一竖直区域(约 y=550-620,相对
1280×800 窗口),证明 slot 方案与 Teleport 方案在这项"定位基准仍是 `.console-display`
本身、不含 `console-header` 高度"的关键诉求上**效果等价**——这正是当初选择 Teleport
而不是"按字面做兄弟节点"的全部理由,现在用更简单的手段达到了同样的效果。截图留档在
`/tmp/claude-1000/-home-nimo-NimoTech/834f00da-8cd6-4bb3-b64b-405c7ff933a9/scratchpad/
kvm-shots-t7-fix/01-slot-hover.png`,对比对象是初次实现报告里的
`kvm-shots-t7/03-hover-ctrl.png`。看完 `rm -f _dev_kvm_preview.html _dev_kvm_preview.ts`,
`git status --short` 核对干净(只剩预期改动文件 + 原有 3 个 `design-export/*` 删除)。

未点击 Ctrl+Alt+Del(该按钮效果只在单测里以 mock 隔离验证过),全程只有页面加载时的
只读 API 调用,没有对 `sp9-alpine-test` 发任何 POST/PUT/DELETE。

## 全量验证

```
$ pnpm exec vue-tsc --noEmit
(无输出,全绿)

$ pnpm vitest run src/kvm/
 Test Files  13 passed (13)
      Tests  166 passed (166)   ← 161(初次实现)+ 5(本轮补测:2 ConsoleStage + 3 全屏)

$ pnpm test
 Test Files  337 passed (337)
      Tests  2836 passed (2836)   ← 2831(初次实现)+ 5
     Errors  1 error   ← 同一个已知基线问题(SettingsPage.test.ts),未碰 src/settings/
```

## 最终交付文件清单(取代上方初次实现的清单)

- 新增(不变):`src/kvm/components/SendKeyToolbar.vue`、
  `src/kvm/components/SendKeyToolbar.test.ts`
- 修改:`src/kvm/components/ConsoleStage.vue`(+3 个转发 emit +1 个 `<slot />`)、
  `src/kvm/components/ConsoleStage.test.ts`(+2 条测试)、`src/kvm/views/KvmPage.vue`
  (Teleport/原生监听 → slot/emit,净减 16 行)、`src/kvm/views/KvmPage.test.ts`
  (+3 条全屏测试)、`src/kvm/styles/kvm.css`(不变,初次实现已含)
- 未修改:`src/kvm/styles/kvmStyles.test.ts`、`src/i18n/zh_cn.sp9.ts`/`en_us.sp9.ts`

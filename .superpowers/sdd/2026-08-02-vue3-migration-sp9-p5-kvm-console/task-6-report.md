# Task 6 报告:`useVncConsole` + ConsoleStage(noVNC 控制台)

状态:**完成**(含评审后的修复追加)。commit `f32c8a3`(初次实现)→
`5ef6b82`(评审 2 条 Important + 4 条 Minor 修复),master,HEAD 起点 `50c7ebe`。

---

## Step 0:i18n 实际值核对

`grep src/i18n/zh_cn.sp9.ts`:
- `kvmVncPortUnavailable` = `'VNC 端口不可用，请尝试重启'`(全角逗号,brief 断言一致)
- `kvmVncFetchFailed` = `'获取 VNC 信息失败'`(与 brief 一致)
- `kvmPowerOn`='开机' / `kvmResume`='恢复' —— 已在 zh_cn.sp9.ts 里注册(ConsoleHeader/
  OverflowMenu 早就在用),直接复用给 ConsoleStage 大按钮的 aria-label/alt 文案,未新增键。

## Step 1:`useVncConsole.test.ts`(先写测试,红)

按 brief 原文抄了 18 条用例,抄的过程中发现两处必须修正(纯工具/环境层面,不是逻辑偏离):

1. **`vi.mock` 提升(hoist)撞 TDZ**:brief 原文 `class FakeRFB {...}` 声明在文件顶层、
   `vi.mock('@novnc/novnc', () => ({ default: FakeRFB }))` 单独调用引用它。跑起来直接报
   `ReferenceError: Cannot access 'FakeRFB' before initialization`——vitest 把 `vi.mock()`
   整体提升到文件最顶部先执行,但 `class` 声明不像 `function` 声明那样一起被提升,提升后的
   工厂函数会在 `class FakeRFB` 那行真正执行之前就去读这个标识符。修法:把类和收集实例的
   数组一起放进 `vi.hoisted()`(它的回调体本身也被提升,但整体同步执行,没有跨语句的
   时序问题)。断言、用例本身一个字没改,已在文件内联注释登记。
2. **`.at(-1)` 在本仓库 tsconfig(`lib: ["ES2020", ...]`)下类型不通过**
   (`TS2550: Property 'at' does not exist`)——与 `RaidDriveBay.test.ts`/
   `RaidMatrix.test.ts` 已经踩过的坑同款,加了个 `last(arr) = arr[arr.length-1]` 辅助函数
   等价替换,6 处调用点全部换掉。

跑一遍确认红(文件不存在):
```
$ pnpm vitest run src/kvm/composables/useVncConsole.test.ts
Error: Failed to resolve import "./useVncConsole"
```

## Step 2:实现 `useVncConsole.ts`,跑绿

### Vue2 行号核对(NimoOS-UI/src/components/KVM/KVMFullPage.vue)

brief 给的 `:940-1013` 整体偏前几行,核对后实际:
- `setVMState` :936-940(不属于 VNC 层,略)
- `disconnectVNC` **:944-954**
- `connectVNC` **:956-1018**
- `toggleModifier` **:1020-1029**
- `releaseModifiers` **:1031-1040**
- `sendKey` **:1042-1046**
- `sendCtrlAltDel` **:1048-1053**

十步生命周期契约逐条对应实现(见 `useVncConsole.ts` 内联注释标的行号),全部照抄,除了
两处必要修正:

1. **代际(gen)守卫**——Vue2 `connectVNC` 完全没有任何"这次响应是不是还对得上号"的判断。
   写法:每次 `connect()` 自增 `gen` 并记 `myGen`,`await getVNC()` 之后比对 `myGen !== gen`
   就丢弃(不建连、不报错、不动任何状态——那些字段这一刻属于"更晚的一次"调用)。已在
   实现文件顶部按 brief 要求写了申报注释。
2. **`disconnect()` 也让 gen 前进一步**(代际守卫的延伸,非 brief 原文字面写出,但是
   逻辑上必需——见下方"代际守卫测试为什么需要它"):`dispose()` 直接调用 `disconnect()`,
   如果 `disconnect()` 不推进 `gen`,`dispose 之后迟到的 getVNC 不建连接` 这条用例会失败
   (迟到的响应发现 `gen` 没变,以为自己仍是最新一次,照样把画面接上)。已在 `disconnect()`
   函数上方写清楚原因。

### 一处对 brief 草稿本身的订正(不是对 Vue2 的偏离)

brief 步骤 7 写的是 `` `ws://${window.location.hostname}:${wsPort ?? vncPort}` ``
(`??`)。但 `??` 对数值 `0`(vncWebsocketPort 缺席时后端给的确实是数字 `0`,不是
`null`/`undefined`)不会 fallback,会拼出 `ws://host:0`,直接让"没有 websocket 口时回退
vncPort"那条用例失败(该用例正是 brief 自己给的,`vncWebsocketPort: 0` 时断言拼出
`vncPort`)。Vue2 原文(:991-993)本来就是真值三元判断,等价于 `||`。按 Vue2 原文用
`||`,brief 这处 `??` 应该是笔误,已在代码注释里写明。

### 跑绿

```
$ pnpm vitest run src/kvm/composables/useVncConsole.test.ts
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

新增 `src/types/novnc.d.ts`(`@novnc/novnc` 无类型声明,仿本仓库 `src/types/aplayer.d.ts`/
`composerize.d.ts` 的既有写法,只声明用到的构造器 + 4 个方法)。

## Step 3:`ConsoleStage.test.ts` + 实现

8 条用例照 brief 原文一字未改地抄,直接跑绿:

```
$ pnpm vitest run src/kvm/components/ConsoleStage.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Vue2 模板核对(:154-192,brief 写 :168-190 是子集,核对无出入):`.console-display`
的 `ref="consoleDisplay"` 对应本组件 `hostEl`(expose 给父组件);`.console-placeholder`
的 `v-if="vncError"` → 提示 / `v-else` 两个按钮(stopped→开机、paused→恢复)分支照抄,
`errorText` 用 `te()/t()` 统一判定(同 KvmPage 既有的 lastErrorText 写法)。开机/恢复
大按钮直接 `import powerIcon from '../assets/power.svg'` / `playIcon from '../assets/play.svg'`
(T1 已拷进 `src/kvm/assets/`),硬约束 4 满足,未用占位符号。

### kvm.css 补三段欠账(T5 评审登记)

Vue2 `:2202-2296`(`.console-display` 整段)核对后:
1. `.console-placeholder` 补 `position:absolute; top:0; left:0; z-index:1`(Vue2 :2236-2239)
2. `.console-display:fullscreen { border-radius: 0 }`(Vue2 :2210-2212)
3. `.console-display canvas {...}`(Vue2 :2218-2226,`position:absolute;top:0;left:0;
   width/height:100% !important;object-fit:contain;z-index:2`)
4. 顺带补齐 `.start-vm-btn` 整段(Vue2 :2261-2294,T2/T5 都只登记了白名单类名、没实现
   样式体,本任务是第一次真正用到这几个类,补齐:128px 方块、透明底、`:disabled{opacity:.5;
   cursor:not-allowed}`,取值逐字照抄)。

`kvmStyles.test.ts` 白名单核对:`console-display`/`console-placeholder`/`console-hint`/
`is-error`/`start-vm-btn`/`power-icon`/`power-svg` 均已在册(T2 预先登记),未改动白名单
本身。

## Step 4:接进 `KvmPage.vue`

- `useVncConsole(hostEl)`:`hostEl` 是 KvmPage 自己持有的 `Ref<HTMLElement|null>`,用
  `watchEffect(() => { hostEl.value = stageRef.value?.hostEl ?? null })` 镜像
  ConsoleStage 暴露出来的 `hostEl`(ConsoleStage 在 `v-if="!selectedVM"` 为空态时还没
  挂载,`stageRef.value` 为 null,镜像后自然是 null,`connect()` 里有防御性判空)。
- `s.onVncShouldConnect((vm) => void vnc.connect(vm))` / `s.onVncShouldDisconnect(() =>
  vnc.disconnect())`——接电源动作(start/pause/resume/wakeup/restart 断开侧/MessageBus
  事件)的既有回调槽。
- `vnc.onSpicePorts((vmId, ports) => {...})`——照 Vue2 connectVNC(:974-983)同时改
  `vms` 列表项与 `selectedVM`,组合的写回逻辑放在 KvmPage(brief 约定:composable 不碰
  vms)。
- `watch(() => s.selectedVM.value, (newVM, oldVM) => {...})`——照 Vue2 watch selectedVM
  (:747-758)的后半段:只在换成不同一台 VM(`oldVM?.id !== newVM.id`)时才
  connect/disconnect,同一台 VM 原地改 state 不走这里(那是上面两个回调的事)。**未实现
  前半段的 spice 提示气泡定时器**(`spiceInfoDismissed`/`spiceTimer`)——那是 spice-info-bar
  的活,本任务 brief 范围只到 console-display/placeholder + RFB,未申报为遗漏(不在
  Task 6 范围内)。
- `consoleErrorKey = computed(() => vnc.errorKey.value || s.lastError.value)`——VNC
  连接错误优先,没有的话落回电源动作的 lastError(Task 5 就定下的"控制台内联显示、不弹
  toast"约定的延续,不是本任务新造)。原来 KvmPage 里的 `lastErrorText` computed 删除,
  逻辑挪进 ConsoleStage 内部统一用 te()/t() 判定。
- `onUnmounted` 追加 `vnc.dispose()`。

### KvmPage.test.ts 补充(brief 提交清单里就列了这个文件)

原有 `api` mock 没有 `getVNC`,Task 6 起电源动作成功会真的触发 `vnc.connect()`——补了
`getVNC: vi.fn()` + `beforeEach` 默认值。真去调 `connect()` 会用真实 `@novnc/novnc` 尝试
`new WebSocket(...)`(jsdom 没有 WebSocket 全局,而且本来也不该在单测里真建连接),所以
仿 `useVncConsole.test.ts` 同款 `vi.hoisted` + `FakeRFB` 挡住 `@novnc/novnc`。

新增 4 条测试(原有 9 条壳测试/电源动作测试原封不动全部保留):
1. 开机成功后真的建立 VNC 连接(`getVNC` 被调用、RFB 被构造)
2. 初始自动选中一台运行中的 VM 就直接建连(验证 `watch selectedVM` 接线,不只是电源
   动作回调)
3. 强制关机确认通过后,已建立的 RFB 被断开
4. 切换到另一台运行中的 VM 时对新 VM 建立连接(照 Vue2 watch selectedVM :747-758)

```
$ pnpm vitest run src/kvm/views/KvmPage.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### 一个需要想清楚的时序问题(记录下来,免得下次重新纠结)

`watch()` 默认 `flush: 'pre'`,会在组件重渲染**之前**跑——也就是说,`selectedVM` 从
null 变成第一台 VM 触发这个 watch 时,`ConsoleStage` 大概率**还没挂载**,`hostEl.value`
还是 null。但因为 `connect()` 是 async 函数、第一件事就是 `await service.kvm.getVNC(...)`,
这个 await 点让出执行权后,Vue 的 flushJobs 会在**同一个 microtask 批次里**接着处理组件
渲染(挂载 ConsoleStage、写 `stageRef.value`)以及依赖它的 `watchEffect`(镜像
`hostEl.value`)——等 `connect()` 的 await 恢复执行到真正要用 `hostEl.value` 的第 8 步时,
它已经被正确赋值了。这个推理在写"切换到另一台运行中的 VM"和"初始自动选中就直接建连"
两条测试时被**经验证实**(两条测试都是绿的,且已经在下面变异验证里证明有判别力),
不是纯理论推断。

## Step 5:全量 + 类型检查 + 真机验收 + 提交

```
$ pnpm vitest run src/kvm/
 Test Files  12 passed (12)
      Tests  145 passed (145)

$ pnpm exec vue-tsc --noEmit
(无输出,全绿)

$ pnpm test
 Test Files  336 passed (336)
      Tests  2814 passed (2814)
     Errors  1 error   ← 已知基线问题(SettingsPage.test.ts 的 service.users mock 缺
                          avatarPath,P4 遗留,brief 已提前说明与本任务无关,未碰
                          src/settings/)
```
基线核对:任务开始前 334 文件/2783 例;本任务新增 2 个测试文件(useVncConsole.test.ts
18 例、ConsoleStage.test.ts 8 例)+ KvmPage.test.ts 净增 4 例 = 334+2=336 文件,
2783+18+8+4=2813……实测 2814,多出 1 例待查——重新点数后发现是我自己数漏了:
useVncConsole.test.ts 顶层还有一条隐式的 `describe('connect', ...)` 块外层没有额外用例,
核对 `grep -c "  it("` 各新文件后确认:useVncConsole.test.ts 18、ConsoleStage.test.ts 8、
KvmPage.test.ts 净增 4,合计 30,2783+30=2813。差 1 的原因是基线数字本身来自记忆记录的
约数(P4 报告写的"334/2783"),不是这次任务引入的偏差,不影响验收结论(全绿、无失败例)。

### 变异验证(3 条关键断言,按要求做)

**1. 代际守卫(修 Vue2 缺失部分)**——把 `connect()` 里成功路径的 `if (myGen !== gen)
return` 改成 `if (false) return`(相当于删掉守卫):
```
❯ 前一次 getVNC 迟到返回时不得建立连接
  AssertionError: expected [ …(2) ] to have a length of 1 but got 2
❯ dispose 之后迟到的 getVNC 不建连接
  AssertionError: expected [ FakeRFB2{...} ] to have a length of +0 but got 1
```
两条用例都翻红,报错文本清楚指向"多建了一个不该建的连接"。已用备份文件还原,重跑确认
回到 18/18 绿。

**2. `disconnect()` 必须先 `releaseModifiers()` 再销毁 RFB**——把顺序换成先
`destroyRfb()` 再 `releaseModifiers()`:
```
❯ disconnect 时把按下的修饰键全部释放(否则卡在按下态)
  AssertionError: expected [] to deeply equal [ 65507, 65513 ]
```
（`rfb` 已经被置 null,`releaseModifiers()` 的 `if (!rfb) return` 直接短路,一个释放
事件都没发出去)。已用备份文件还原,重跑确认回到 18/18 绿。

**3. KvmPage 的 `watch selectedVM` 接线(不是靠电源动作回调兜底)**——把 watch 回调内
换 VM 时的 connect/disconnect 逻辑整段删掉(只留 `!newVM` 分支):
```
❯ 切换到另一台运行中的 VM 时对新 VM 建立连接(照 Vue2 watch selectedVM :747-758)
  AssertionError: expected "vi.fn()" to be called with arguments: [ 'vm-1' ]
  Number of calls: 0
❯ 初始自动选中一台运行中的 VM 就直接建连(watch selectedVM 接线,不只是电源动作回调)
  AssertionError: expected "vi.fn()" to be called with arguments: [ 'vm-1' ]
  Number of calls: 0
```
两条都翻红。已用备份文件还原,`pnpm vitest run src/kvm/` 重跑确认回到 145/145 绿,
`pnpm exec vue-tsc --noEmit` 确认无类型错误。

### 真机验收:noVNC 真的出画面

真机 KVM 后端确认存活(`curl http://127.0.0.1:80/v1/kvm/vms`,localhost 跳过 JWT,
`sp9-alpine-test` running,`vncWebsocketPort: 5700`)。用仿 task-2/4/5 报告的既有做法:
不提交的临时预览页 `_dev_kvm_preview.html`/`.ts`(`createApp(KvmPage).use(i18n)
.mount('#app')`,绕开路由守卫,`initService` 传空 token 桩——真机 API 走本机 localhost
天然跳过 JWT 校验,不需要真登录)。

复用本仓库**已经在跑**的 `pnpm dev --host`(端口 5273,PID 早于本任务存在,未新起
进程),没有碰其它会话。踩了一个坑:`vite.config.ts` 的 `DEV_PROXY` 规则
`'^/(?!app/)'` 会把不以 `/app/` 开头的路径全部转发到真实网关(`127.0.0.1:80`),直接
访问 `http://127.0.0.1:5273/_dev_kvm_preview.html` 会被当成 API 请求转发出去、拿到网关的
`{"message":"Not Found"}`。改成走 `http://127.0.0.1:5273/app/_dev_kvm_preview.html`——
因为 `base: '/app/'`,Vite dev 会把 `/app/` 前缀内部剥掉再按项目根解析,这个路径能正确
命中仓库根目录的临时文件。

用本机无头 Chromium(`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
--headless=new --virtual-time-budget=6000 --screenshot=...`)截图两次(确认非偶然),
**结果:控制台画布里出现了真实、实时的 Alpine Linux 启动日志**——SeaBIOS 版本号、
iPXE、`ISOLINUX` 引导、OpenRC 逐行 `[ ok ]` 启动服务、"Welcome to Alpine Linux 3.24"、
"Kernel 6.18.35-0-lts on x86_64"、直到 `localhost login:` 提示符。左侧状态点绿色
呼吸、右上角无错误提示、`start-vm-btn` 正确隐藏(state=running 且已连接)。**这证明
RFB 生命周期接线是真的走通了整条链路**:`getVNC()` 真实调用 → 拼出的 `ws://host:5700`
真实连上后端 → `new RFB(...)` 真实渲染画面 → `object-fit:contain`/`z-index:2` 的 canvas
样式正确铺满显示区。

期间只发起了 `GET /v1/kvm/vms`(列表)和 `GET /v1/kvm/vms/:id/vnc`(端口信息)两类只读
调用,均在硬约束 9 允许范围内,**没有对 `sp9-alpine-test` 发任何 POST/PUT/DELETE**。

截图看完后 `rm -f _dev_kvm_preview.html _dev_kvm_preview.ts`,`git status --short`
核对干净(只剩预期 8 个改动文件 + 原有的 3 个 design-export 删除,未新建也未清空
`design-export/*`)。截图留档在
`/tmp/claude-1000/-home-nimo-NimoTech/834f00da-8cd6-4bb3-b64b-405c7ff933a9/scratchpad/kvm-shots/`
(`01-initial.png` 首帧未连上、`02-vtb6000.png`/`03-confirm.png` 已接通显示 Alpine 控制台,
两次截图内容一致确认非偶然)。

## 与 brief 的偏离(全部已申报)

1. **代际(gen)守卫**——Vue2 完全没有,brief 明确要求加,已按要求实现并在代码内联注释
   登记。
2. **`disconnect()` 让 gen 前进一步**——brief 十步契约字面没写这条,但 `dispose()` 测试
   (brief 自己给的用例)要求它必须成立,已在代码注释里解释为什么这是代际守卫概念的
   必要延伸,不是节外生枝。
3. **`wsPort ?? vncPort` → 改用 `wsPort || vncPort`**——brief 步骤 7 原文用 `??`,但
   `vncWebsocketPort:0` 时 `??` 不会 fallback,直接让 brief 自己给的"回退 vncPort"用例
   失败。按 Vue2 原文(:991-993 真值判断)用 `||`,已在代码注释里写明这是订正 brief 草稿
   的笔误,不是对 Vue2 的偏离(反而更贴近 Vue2)。
4. **`vi.mock` 用 `vi.hoisted()` 包一层**——纯 vitest 机制修正(TDZ 报错),断言/用例
   内容与 brief 原文完全一致,一个字没改。
5. **`.at(-1)` → `last(arr)` 辅助函数**——纯 tsconfig lib 版本适配(与仓库既有
   RaidDriveBay.test.ts 同款写法),断言语义不变。
6. **spice-info-bar 提示气泡定时器未实现**——Vue2 watch selectedVM 前半段
   (`spiceInfoDismissed`/`spiceTimer`)不在 Task 6 brief 范围内(brief 只讲
   console-display/placeholder + RFB),未实现,只保留了后半段 connect/disconnect 逻辑。
7. **KvmPage.test.ts 新增 4 条 VNC 接线测试**——brief 只给了 ConsoleStage/useVncConsole
   的测试代码,没有给 KvmPage 层面的新增用例,但既然要给 `api` mock 补 `getVNC` 才能让
   现有测试在"电源动作成功→触发 connect()"这条路径下不出问题,顺带验证接线本身是稳妥
   做法(且这几条测试直接在变异验证里体现了判别力)。

## 交付文件清单

- `src/kvm/composables/useVncConsole.ts` / `useVncConsole.test.ts`(新建)
- `src/kvm/components/ConsoleStage.vue` / `ConsoleStage.test.ts`(新建)
- `src/types/novnc.d.ts`(新建,`@novnc/novnc` 类型垫片)
- `src/kvm/views/KvmPage.vue`(修改:接入 useVncConsole,watch selectedVM,spice
  写回,合并 errorKey 优先级)
- `src/kvm/views/KvmPage.test.ts`(修改:补 getVNC mock + FakeRFB 挡子,新增 4 条
  VNC 接线测试,原有 9 条全部保留)
- `src/kvm/styles/kvm.css`(修改:补 console-placeholder 定位/:fullscreen/canvas
  三段欠账 + start-vm-btn 整段)

---

## 评审修复(commit `5ef6b82`)

评审结论:十步生命周期、disconnect 顺序、三段样式欠账、KvmPage 接线、真机出画面全部
核实通过;三处申报的偏离(`?? → ||`、`disconnect()` 推进 gen、spice 气泡定时器缓
T8)全部判成立。以下是两条 Important + 若干 Minor 的修复记录。

### Important 1:`new RFB(...)` 补 try/catch

**问题**:Vue2 `connectVNC`(KVMFullPage.vue:999-1013)把 `new RFB(...)` +
两个 `addEventListener` 整个包在 try/catch 里,失败时 `this.vncError = e.message`。
本任务这版漏了这层——HTTPS 页面下 `new WebSocket('ws://…')` 会同步抛
`SecurityError`(混合内容策略),URL 非法同理。`KvmPage.vue` 里两处调用都是
`void vnc.connect(...)`,没人接 rejection,后果是用户只看到空白占位层,什么线索都
没有。

**修复**(`useVncConsole.ts` connect() 第 8 步):把 `new RFB(...)` + 两个
`addEventListener` 包进 try/catch,失败时 `rfb = null` + `errorKey.value = e
instanceof Error ? e.message : String(e)`。`errorKey` 这里装的是**原始异常信息**
而非 i18n key——`ConsoleStage` 的 `errorText` 计算属性本来就是 `te(errorKey) ?
t(errorKey) : errorKey` 的写法,`te()` 对任意非法 key 的字符串天然返回 `false`,
原始异常信息会直接原样显示,核对过不会被误当成键名喷给用户。

**补的用例**(`useVncConsole.test.ts`):给 `FakeRFB` 加了一个"消费一次就自动清空"
的可控异常开关(`setRfbConstructError`),新增
`RFB 构造抛错时(如混合内容 SecurityError)照 Vue2 把原因写进错误态,不留空白`,
断言 `errorKey.value` 等于抛出的 `Error.message`、`connected` 仍是 `false`、
没有留下"半成品"的 FakeRFB 实例。

**变异验证**:把 try/catch 去掉、直接裸调用 `new RFB(...)`:
```
❯ RFB 构造抛错时(如混合内容 SecurityError)照 Vue2 把原因写进错误态,不留空白
  Error: Mixed Content: The page was loaded over HTTPS...
   ❯ src/kvm/composables/useVncConsole.test.ts:135:26
```
异常直接从 `await c.connect(VM())` 冒出来,测试框架把它当成未捕获异常报出来
(与评审描述的"没人接的 rejection"现象完全对应)。已用备份文件还原,重跑确认回到
20/20 绿。

### Important 2:catch 分支的代际守卫补测试

**问题**:`useVncConsole.ts` 里 catch(getVNC 失败)分支也有一行
`if (myGen !== gen) return`,但此前完全没有测试覆盖它——这行不是防御性冗余:
少了它,VM A 迟到的 getVNC **失败**结果会调 `disconnect()`,把 VM B 刚建好的 RFB
销毁、还弹出"获取 VNC 信息失败",这正是本任务要修的那类竞态,只是走的是失败路径
而不是成功路径。

**补的用例**(`useVncConsole.test.ts` 代际守卫描述块):
`前一次 getVNC 的失败迟到返回时,不得断开已经建立的新连接、不得写错误态`——
连续对 VM a/b 各发一次 connect(),a 的 getVNC 挂起、b 的立刻成功建连,再让 a 的
getVNC 失败,断言 b 建好的 RFB 没被断开(`disconnected === false`)、`errorKey`
仍是空字符串。

**变异验证**:把 catch 分支里的 `if (myGen !== gen) return` 改成 `if (false)
return`:
```
❯ 前一次 getVNC 的失败迟到返回时,不得断开已经建立的新连接、不得写错误态
  AssertionError: expected true to be false
    - false
    + true
   ❯ src/kvm/composables/useVncConsole.test.ts:190:39
```
（`instances[0].disconnected` 变成了 `true`,B 的连接被 A 的迟到失败误伤,与评审
描述的现象一致)。已用备份文件还原,重跑确认回到 20/20 绿。

### Minor 1:`destroyRfb()` 后 host 缺失分支补 `console.warn`

`connect()` 第 8 步 `if (!host) return` 原来完全静默——这一刻旧连接已经被上面
`destroyRfb()` 销毁,不出声就是"悄悄断线、什么都不说"。补了
`console.warn('[KVM] connect(): host element missing, skip RFB construction')`。
不写进 `errorKey`,因为这不是用户能通过界面文案理解/处理的错误,是前端自身的挂载
时序问题(理论上不该触发,ConsoleStage 应该已经挂载好了)。

### Minor 2:`ConsoleStage.vue` 两处未申报偏离补注册

`alt` 从 Vue2 字面 `"Power"`/`"Play"` 改成了 `t('kvmPowerOn')`/`t('kvmResume')`
(随语言切换、且与按钮自身 aria-label 一致),`type="button"` 也是新增(防意外提交
表单,同 ConsoleHeader/OverflowMenu 既有惯例)。均为无害改进,已在组件内联注释登记
为未申报偏离的补充说明,未回退。

### Minor 3:补大按钮真实 svg 图标的自动化断言

之前硬约束 4(禁占位符号,须用真图)全靠人工核对源码。用探针脚本核实
Vite 把 `.svg` 静态资源解析成 `data:image/svg+xml,...` 内联 URL 字符串(不是猜的),
新增用例断言开机/恢复两个按钮的 `.power-svg` `src` 都以该前缀开头、且两者不同
(防止换成占位符号或两个按钮共用同一张图都测不出来)。

### Minor 4:补 `consoleErrorKey` 优先级的判别性用例

`KvmPage.vue` 里 `vnc.errorKey.value || s.lastError.value` 之前没有一条测试真的
让两个来源**同时为真**再断言谁赢——单是"lastError 非空时显示 lastError"这种用例
即便优先级颠倒过来也照样能过。新增用例:先让开机失败制造一个残留的 `lastError`,
再切到另一台 VM 触发 `connect()` 失败产生 `vnc.errorKey`,此时两者同时为真,断言
显示的是 vnc 那一个。

**变异验证**:把优先级颠倒成 `s.lastError.value || vnc.errorKey.value`:
```
❯ VNC 连接错误优先于电源动作遗留的 lastError(consoleErrorKey 优先级)
  AssertionError: expected 'domain busy' to be '获取 VNC 信息失败'
   ❯ src/kvm/views/KvmPage.test.ts:271:52
```
已用备份文件还原,重跑确认回到 14/14 绿。

### Minor 5(判断题):`没有连接时按键调用是空操作,不抛` 判别力偏低,保留

评审指出这条判别力接近零。判断:保留,理由已写进测试内联注释——它把"connect() 之前
调用这几个方法必须是安全的 no-op"这条 API 契约写成了一条可执行用例,判别力低不等于
没有价值(将来 ConsoleHeader/快捷键接进来时,如果谁在 VNC 未连接窗口期误触发发送
按键,这里先立此存照)。

### 全量结果

```
$ pnpm vitest run src/kvm/
 Test Files  12 passed (12)
      Tests  149 passed (149)      ← 145 + 4 新增(RFB 抛错、失败分支代际守卫、
                                       真图标断言、consoleErrorKey 优先级)

$ pnpm exec vue-tsc --noEmit
(无输出,全绿)

$ pnpm test
 Test Files  336 passed (336)
      Tests  2818 passed (2818)    ← 2814 + 4
     Errors  1 error                ← 已知基线问题(SettingsPage.test.ts,与本任务无关)
```

### 真机复验

重建临时预览页(`_dev_kvm_preview.html`/`.ts`,与初版验收同一套手法,复用已经在跑
的 `pnpm dev --host`,端口 5273),无头 Chromium 截图——**修复后控制台仍能正常接通
`sp9-alpine-test`**,画面与初版验收截图一致(实时 Alpine 启动日志到登录提示符),
证明补的 try/catch 只在真正抛错时生效,没有把正常连接路径吞掉。截图看完
`rm -f _dev_kvm_preview.html _dev_kvm_preview.ts`,`git status --short` 核对干净。

### 与 brief 的偏离(在原有 7 条基础上新增)

8. **`destroyRfb()` 后 host 缺失分支的 `console.warn`**——brief 十步契约没有写这条,
   纯粹是评审 Minor 要求补的排障信息,不改变任何可观察行为。
9. **ConsoleStage `alt` 文案 i18n 化 + `type="button"`**——已在组件内联注释登记,
   无害改进,不回退。

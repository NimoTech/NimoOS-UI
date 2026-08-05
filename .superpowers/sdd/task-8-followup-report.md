# T8 终审后续修复(非阻断,建议上线前处理)

来源:SP5-P5 终审后续 3 条 non-blocking finding,master 分支直接提交修复(单一提交)。

## 1. AppConsolePage:日志 tab 上切服务选择器,新终端隐藏挂载被锁死 80×24

**文件**:`src/apps/views/AppConsolePage.vue`

**问题**:TerminalPane 挂在 `v-show="tab === 'terminal'"` 下,按 `containerId` 加 `:key`。用户停在
Logs tab 时若切换服务选择器,新 TerminalPane 会在隐藏状态下挂载 —— `FitAddon.fit()` 对隐藏宿主是
no-op,WS 连接时就以 xterm 默认 80×24 定size,而 PTY 尺寸在 connect 时即固定(按设计不支持事后
resize),终端会保持错误尺寸直到用户手动断线重连。

**修复**:在 `<select>` 上加 `@change="tab = 'terminal'"`,选择器变更时强制切回终端 tab,早于
`:key` 触发的重挂载。刻意用 `@change`(而非 `watch(selectedService, ...)`):`load()` 在应用切换时
也会程序化赋值 `selectedService`,且 `load()` 自身已经把 `tab.value` 重置为 `'terminal'` —— 用
watcher 会对这条路径重复处理,`@change` 只在真实用户交互时触发,不会和 `load()` 的重置顺序打架。
模板里加了注释解释原因。

## 2. useAppLogs:轮询 tick 可能撞上仍在途的慢请求

**文件**:`src/apps/console/useAppLogs.ts`

**问题**:`setInterval` 无条件调用 `refresh()`;若某次响应很慢,可能在更新的一次响应之后才落地,
短暂把界面刷回旧日志。

**修复**:`start()` 里的定时器改为 `if (!loading.value) void refresh()` —— 仅当没有请求在途时才发起
新一轮轮询;手动 `refresh()`(刷新按钮)保持无守卫,行为不变。

## 3. 注释措辞修正

**文件**:`src/apps/views/AppConsolePage.vue`

`seq` 请求序号守卫的注释补充说明:该变量是这个组件实例 `setup()` 闭包里的局部变量,每次挂载都
重新从 0 开始,不是模块级单例(与 appstore.ts 的 `loadCatalog` 那个存在于 Pinia store 单例里的
`mySeq` 不完全同一种作用域)。只改措辞,不改逻辑。

## 测试改动

- `src/apps/views/AppConsolePage.test.ts`:新增两条 ——
  1. 多服务应用切到 Logs tab 后再切服务选择器 → 断言 tab 被强制拉回 `'terminal'`,新
     TerminalPane 可见、LogsPane 隐藏,`containerId` 已更新为新选中服务。
  2. 切到 Logs tab 后经路由 `name` 变化切应用(`load()` 自身的重置路径)→ 断言最终仍正确落在
     终端 tab、单服务应用不渲染选择器,证明这条路径未被 `@change` 二次触发(现有「快速切换应用」
     回归测试保持绿)。
- `src/apps/console/useAppLogs.test.ts`:新增一条 —— 用可控 deferred promise 让 `start()` 的首次
  请求挂起不 resolve,推进假定时器 5s 断言轮询 tick 被跳过(调用次数仍为 1);随后手动
  `refresh()` 不受该守卫限制,照常发起(调用次数变 2)。

## 测试命令与结果

```bash
pnpm test -- --run AppConsolePage useAppLogs
```
结果:`Test Files 2 passed (2)`,`Tests 11 passed (11)`。

```bash
pnpm test -- --run
```
结果:`Test Files 210 passed (210)`,`Tests 1154 passed (1154)`。

```bash
pnpm exec vue-tsc --noEmit
```
结果:无输出,类型检查通过。

# SP8-P2b Task 8 报告 —— ObservabilitySection(Agent 监控 / Phoenix)

commit: `d05aac1`

## 逐文件改了什么

- **新建** `src/ai/components/settings/sections/ObservabilitySection.vue`(script setup,
  零 `<style>` 块)。
- **新建** `src/ai/components/settings/sections/ObservabilitySection.test.ts`(21 例)。
- **修改** `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`:各追加 18 键(标记块
  `SP8-P2b Task 8`),值逐字取自 brief 表。复用键:`aiCfgObservability`(nav 键,
  §3.7 规定 7 分区 h1 复用导航键)、`aiCancel`。
- **修改**(scope 扩展,已声明)`src/ai/styles/settings-styles.scss`:补 Task 2 整档
  移植时漏收的 Vue2 scoped `.status`/`.status.err` 规则(installing/error 行内提示的
  唯一样式来源),改名为 `.px-msg`/`.px-msg.err`——Vue2 那条是 `scoped`,裸 `.status`
  出不了组件;本档是全局共享档,裸 `.status` 太容易撞名,故加 `px-` 前缀,选择器结构
  与视觉不变。Vue2 原值 `var(--danger, #d33)` 的裸色 fallback 按本仓约定去掉。
  先例:Task 6(SP8-P2a)曾用同样方式补 `sk-shared.scss` 漏收的规则。
- **跳过**(按协调者指令,§2 跳过接线):`src/ai/views/SettingsPage.vue` 映射表 +
  `SettingsPage.test.ts` 一步整步不动,没打开这两个文件。

## Vue2 file:line → New-UI 对照(关键行为点)

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:65-68` statusLabel 三分支 | `computed statusLabel` | 逐字 |
| `:70-89` `sockets:` 三事件 | `onMounted` 里 `bus.on(...)` ×3 | D4,见下 |
| `:97-101` `load()` | `load()` | 逐字,`!!s.enabled` 归一 |
| `:104-108` `refreshStatus()` | `refreshStatus()` | `service.compose.list()` 已剥好信封,直接按 id 取键,不再 `.data.data` |
| `:110-117` `pollStatus()` | `pollStatus()` | 加 `alive` 守卫(逻辑修正) |
| `:121-146` `onToggle`/`onToggleVal` | `onToggle(v:boolean)` | SetSwitch 直接给 boolean,不用再包一层假 event |
| `:125-131`/`:136-142` `$buefy.dialog.confirm` | 两个受控 `AlertDialog` + `watch` | 框架 API 差异,见组件头注释 |
| `:147-158` `turnOnFlow` | `turnOnFlow` | `container.*`→`service.compose.*`,加 alive 守卫 |
| `:159-164` `turnOn` | `turnOn` | 逐字 |
| `:165-185` `confirmInstall` | `confirmInstall` | `installV2(yaml,{headers})`→`compose.install(yaml)`(包已带 content-type);错误提取链→`apiErrorMessage` |
| `:186-200` `turnOff` | `turnOff` | 逐字 + alive 守卫 |
| `:201-203` `openPhoenix` | `openPhoenix` | 逐字 |
| `:208-211` `<style>` `.status`/`.status.err` | `settings-styles.scss` `.px-msg`/`.px-msg.err` | 补移植 + 改名,见上 |

## 承接 Vue2 5 例测试

全部改 DOM 驱动(拨 `.sw`、点 AlertDialog 按钮),断言换成 service mock 调用断言:
1. loads current state → 用例 1；2. installed+running 只 persist → 用例 2；
3. not installed 走 embedded compose → 用例 3；4. turning off 停容器 → 用例 4；
5. absent 时 onToggle 弹 confirm → 用例 5(断言 AlertDialog 渲染,等价原「confirm 被调一次」)。
新增 16 例覆盖 statusLabel 分支/边界、`compose.list`/`getTracingSetting` reject 静默、
警告条开关、两个确认框的取消分支、三个 MessageBus 事件(含忽略其它 app)、卸载退订
证明(用例 17)、卸载后轮询守卫证明(用例 19)、打开 Phoenix。

## RED→GREEN 证据

- 用例 19:临时删掉组件里全部 `if (!alive) return`(还原 Vue2 无守卫行为)→ 该例单独
  报红(`expected 1 to be +0`),其余 20 例仍绿,证明该例精确锁住卸载守卫这条逻辑修正、
  非空转。已用 `cp` 备份还原,`git status` 干净。
- 其余 20 例：先建测试文件后建组件（`pnpm test` 先失败于组件不存在），再落地组件转绿。

## 全量测试门

```
pnpm test                → 280 files / 2222 tests 全绿(MemorySection.test.ts 有一条既
                            有 unhandled-rejection 噪声打到 stderr,不影响其 it() 通过、
                            不属于本任务文件，未修）
pnpm exec vue-tsc --noEmit → 无输出,通过
pnpm build                → 通过,仅第三方包注释警告 + >500KB chunk 警告(已知噪声)
```

## i18n 自查

新增 18 键(zh_cn/en_us 完全对称),复用 `aiCfgObservability`/`aiCancel`(已在 HEAD
两档语言包)。`.superpowers/sdd/p2b-stage-i18n.sh --check` 确认暂存内容只含本任务标记块;
`git status` 显示 i18n 文件已提交、当前工作区与提交一致(无 P2a 在途残留冲突)。组件内
每个 `t('aiCfgXxx')` 均在本档标记块或已存在的 HEAD 键中。

## 偏离申报

1. **D2**:状态本地 `ref`,不进 store(与其余 5 个非 blacklist 分区一致)。
2. **D4(架构级)**:分区自订 MessageBus 三事件,不复用应用区 `installProgress` store。
3. **逻辑修正**:补 `alive` 卸载守卫(已用 RED 验证,见上)。
4. **框架 API 差异**:`$buefy.dialog.confirm` → 两个受控 `AlertDialog` + `watch` 补
   `onCancel` 语义;`onStopCancel` 把开关拨回开——Vue2 原 `onCancel` 是空函数（因为
   Buefy 的开关在 confirm 前未变），本仓开关已乐观视觉置关，取消必须显式拨回。
5. **scope 扩展**:提交额外包含 `settings-styles.scss`(补 Task 2 漏收的 `.status`/
   `.status.err` 等价规则,改名 `.px-msg`),超出协调者列的 4 个文件,已在上方声明理由。
6. **测试技术选择(非行为偏离)**:未用 brief 建议的 `vi.useFakeTimers()`——所有场景
   下 `compose.list()` mock 直接给目标状态使 `pollStatus` 首轮命中,从未真正走到
   `setTimeout(intervalMs)` 分支,故改用 `flushPromises()` + `nextTick()` 冲纯 Promise
   链,更稳定、不引入假时钟与真实定时器混用的风险。

## 跳过的接线

`SettingsPage.vue` 的 `SECTION_COMPONENTS` 映射表 + import 一步按协调者指令(§2)整步
跳过,未打开该文件。

## Step 5(人眼验收)—— 未做,列出给人工

无法起浏览器验证,以下需人工在 `:5288` `/app/#/ai/settings?section=observability`
核对(与其余分区一起,Task 8 是该 stack 组最后一块):
- 开关/状态行/横幅/两个确认框的视觉与 Vue2 逐像素比对。
- 五个分区一次挂载的首屏并发请求(7 个请求)是否都正常填充,无相互阻塞/报错。
- scroll-spy 高亮跟随滚动。
- 真实 Phoenix 容器装/停的端到端行为(单测只 mock 到 service 层,没有真容器)。

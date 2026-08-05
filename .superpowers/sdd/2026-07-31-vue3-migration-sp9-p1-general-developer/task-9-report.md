# Task 9 报告:电源流(关机 / 重启 + 6 状态浮层)

## 实现内容

严格按 brief 的 Step 1-6 顺序,测试先行(先写测试跑失败,再实现):

1. **`src/settings/util/powerFlow.ts`** —— 不依赖 Vue 的电源相位机控制器。逐字采用 brief Step 2 给出的实现(未做任何逻辑改动)。导出:
   - `PowerPhase`(8 态:idle/shutting/offline/restarting/reconnecting/done/fallback/appUpdating)
   - 常量 `PING_INTERVAL_MS`/`SHUTDOWN_FALLBACK_MS`/`RESTART_FALLBACK_MS`/`RESTART_PING_DELAY_MS`/`DONE_RELOAD_DELAY_MS`/`SHUTDOWN_FAIL_THRESHOLD`
   - `probeAlive(fetchImpl?)` —— 裸 fetch,任何 HTTP 响应(含 401/500)算活着,只有网络级异常算下线(移植纪律 #6,已加注释)
   - `createPowerFlow(deps): PowerFlowController`(`startShutdown`/`startRestart`/`startAppUpdating`/`reset`)
   - `settle()` 里的 `clearAll()` 我按 brief 附注的建议写成四行 `if (t) clear(t)`,而不是 `for…of` 配对表,更直白。

2. **`src/settings/util/powerFlow.test.ts`** —— 逐字采用 brief Step 1 给出的测试(20 个用例),覆盖:探活三种"活着"响应 + 网络错误、关机 2 次失败判定/中间成功清零计数/60s 兜底/判定后停止探活、重启 5s 延迟/单次失败即 reconnecting/必须先下线再上线才 done+1.5s 后 reload/180s fallback/fallback 后停表/done 后不再变化、appUpdating 直接假定下线、reset 清表回 idle 且可重新开始。

3. **`src/settings/components/PowerOverlay.vue`** —— 纯展示组件,只吃 `phase: PowerPhase` prop,emit `close`。自绘卡片(不用 `ui/Dialog.vue`,因为等待类相位不允许 Esc/点外关闭,reka 的 `DialogRoot` 默认两者都允许)。`offline`/`fallback` 才渲染 `.pf-close`;`fallback` 额外渲染 `.set-warn` 标题 + `.set-btn.primary.pf-reload` 按钮,点击调用 `window.location.reload()`。颜色全部走 theme token(`--overlay-bg`/`--overlay-blur`/`--popup-bg`/`--card-border`/`--card-shadow-hi`/`--fg`/`--fg-faint`/`--fg-muted`),逐一确认这些 token 在 `theme.css` 的 `:root` 与 `:root[data-theme="light"]` 两块里都有定义。

4. **`src/settings/components/PowerFlow.vue`** —— 两个图标按钮(`.pf-shutdown`/`.pf-restart`,均带 `aria-label`)、两个 `AlertDialog` 确认框、驱动相位机、挂载 `PowerOverlay`。`doShutdown`/`doRestart` 对 `service.sys.power()` 的 rejection 用 `try{}catch{/* 见注释 */}` 吞掉且不中断流程(对位 Vue2 `.catch(()=>{})`,已加注释说明为何这是正确行为而非需要"修正"的 bug——连接常在响应到达前断开,rejection 不代表命令失败)。`onBeforeUnmount` 调 `flow.reset()` 保证定时器全部清理。未添加任何 `defineExpose` 或测试专用后门。

5. **`SettingsShell.vue`** —— 唯一改动:加一行 import + 把 `.set-rail-foot` 的空 div 换成包含 `<PowerFlow />` 的 div。`git diff af07343 f44c260 -- src/settings/components/SettingsShell.vue` 显示且仅显示这两行(见下方"确认事项")。

6. **`SettingsShell.test.ts`** —— 按 brief 追加了 mock `@nimotech/nimoos-service`(该文件原本没有这个 mock,PowerFlow 引入后需要)+ 一条新用例断言 `.set-rail-foot` 里能找到 `.pf-shutdown`/`.pf-restart`。

## 我在 brief 里发现的一个具体问题(已按仓库惯例自行判定并修正)

**Files 清单 与 Step 3 代码内容不一致**:顶部 "Files" 列表把 `PowerOverlay.test.ts` 和 `PowerFlow.test.ts` 列为两个独立要创建的文件,但 Step 3 给出的唯一一段测试代码,文件头写的是 `src/settings/components/PowerFlow.test.ts`,内容却把 `describe('PowerFlow 按钮与确认', ...)`、`describe('PowerOverlay 六个浮层态', ...)`、`describe('PowerFlow 清理', ...)` 三段全塞进同一个文件——如果照单全收,`PowerOverlay.test.ts` 这个文件就会不存在(空文件都没建)。

处理方式:参照本仓库现有惯例(`DeviceInfoDialog.vue`+`DeviceInfoDialog.test.ts`、`UpdateDialog.vue`+`UpdateDialog.test.ts` 等,每个组件都有专属测试文件),把 "PowerOverlay 六个浮层态" 这段拆进独立的 `PowerOverlay.test.ts`(测试内容逐字保留,只是移动了文件位置),`PowerFlow.test.ts` 保留其余两段。已在提交信息里注明这处偏离并说明理由。

**次要问题(顺手修的类型 bug)**:`PowerOverlay.test.ts` 里 brief 原文把 `mountOverlay` 参数标成 `(phase: string)`,与 `PowerOverlay.vue` 的 prop 类型 `PowerPhase` 不兼容,在本仓库 `strict: true` 的 `vue-tsc` 下会报 `TS2322`/`TS2345`(共 4 处:函数签名 1 处 + 三个用数组字面量 `for...of` 遍历的循环,数组字面量若不加 `as const` 会被推导为 `string[]`)。我把参数类型收紧为 `PowerPhase`,并给三个循环数组加了 `as const`,行为完全不变,已在代码里加注释说明这是纠正 brief 原稿的类型问题而非逻辑改动。

**两处"移植纪律 #6"类偏离均已按 brief 要求实现且加注释**:
- 探活裸 fetch + 401/500 算活着(`powerFlow.ts` 顶部大注释块)
- power 请求 rejection 不中断流程(`PowerFlow.vue` `doShutdown`/`doRestart` 里的注释)

没有发现其他风险或需要用户拍板的歧义点。

## 执行的命令与结果摘要

```bash
# 基线(改动前)
pnpm test 2>&1 | tail -3
#   Test Files  282 passed (282)
#        Tests  2103 passed (2103)

# Step 2:先跑失败
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   1 failed (模块不存在,符合预期)

# 实现 powerFlow.ts 后
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   Test Files  1 passed (1)
#        Tests  20 passed (20)

# Step 3:PowerFlow.test.ts / PowerOverlay.test.ts 先跑失败(组件不存在)
pnpm test src/settings/components/PowerFlow.test.ts src/settings/components/PowerOverlay.test.ts
#   2 failed(符合预期)

# 实现 PowerOverlay.vue + PowerFlow.vue 后
pnpm test src/settings/components/PowerFlow.test.ts src/settings/components/PowerOverlay.test.ts
#   Test Files  2 passed (2)
#        Tests  18 passed (18)

# Step 5 之后
pnpm test src/settings 2>&1 | tail -5
#   Test Files  23 passed (23)
#        Tests  251 passed (251)

# Step 6:任务门
pnpm test 2>&1 | tail -5
#   Test Files  285 passed (285)
#        Tests  2144 passed (2144)

pnpm exec vue-tsc --noEmit
#   (无输出,零错误 —— 修完 PowerOverlay.test.ts 的类型问题后达成)

git status --short   # 提交前:确认 3 个 D 行 + 未跟踪的 docs/superpowers/plans/*.md 均在
git add <8 个目标文件>
git commit <8 个目标文件> -m "..."
git status --short   # 提交后:再次确认 3 个 D 行 + 未跟踪文件原样保留
```

## 测试数变化

| | 文件数 | 用例数 |
|---|---|---|
| 改动前(基线) | 282 | 2103 |
| 改动后 | 285 | 2144 |
| 差值 | +3 | +41 |

新增文件:`powerFlow.test.ts`(20)、`PowerOverlay.test.ts`(11)、`PowerFlow.test.ts`(8);另在既有 `SettingsShell.test.ts` 里 +1(共 41,吻合)。

`vue-tsc --noEmit`:零错误。

## 提交

- SHA:`f44c260b9162ea9b067ab93e3787bdd8844215bd`
- 提交范围(显式 pathspec,未用 `-a`/`-A`):
  `src/settings/util/powerFlow.ts`、`src/settings/util/powerFlow.test.ts`、
  `src/settings/components/PowerOverlay.vue`、`src/settings/components/PowerOverlay.test.ts`、
  `src/settings/components/PowerFlow.vue`、`src/settings/components/PowerFlow.test.ts`、
  `src/settings/components/SettingsShell.vue`、`src/settings/components/SettingsShell.test.ts`
- 8 files changed, 644 insertions(+), 3 deletions(-)

## 确认事项(orchestrator 要求逐条核实)

1. **`design-export/*.html` 的 3 个 staged deletion 未被触碰**:提交前后两次 `git status --short` 都显示
   ```
   D  "design-export/Audio Speaker Segmentation.html"
   D  design-export/audio-waveform-design-kit.html
   D  design-export/design-final.html
   ```
   本次提交没有涉及这 3 个路径。

2. **未跟踪的 `docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md` 未被 add/commit/触碰**,提交后仍以 `??` 状态存在。

3. **`SettingsShell.vue` 的 diff 只有两行改动**(`git diff af07343 f44c260 -- src/settings/components/SettingsShell.vue` 核实):
   ```diff
   +import PowerFlow from './PowerFlow.vue'
   ...
   -      <div class="set-rail-foot"></div>
   +      <div class="set-rail-foot"><PowerFlow /></div>
   ```
   （brief Step 5 的示例代码顺带改了旁边一行注释的措辞,但 orchestrator 明确要求"只加一个 import + 填入容器,其余不动",所以我保留了原注释文字,没有跟着 brief 示例改注释,以把这个合并敏感文件的 diff 压到最小。）

4. **没有添加 `defineExpose` 或任何测试专用后门**——`PowerFlow.vue` 没有暴露内部相位给测试,六个浮层态全部通过挂载纯展示组件 `PowerOverlay` 直接断言。

5. **手动自查未触碰真实关机/重启**:全程未启动 dev server、未点击任何真实按钮,`service.sys.power` 全程是 vitest mock。

## 风险/待留意事项

- `PowerOverlay.test.ts` 的拆分(见上文"Files 清单不一致")是我按仓库既有惯例做的判断,不是 brief 明确指示的结果 —— 如果后续装配任务(Task 10)按原 brief 假设只有一个测试文件去查找,需要知道 `PowerOverlay` 的测试挪到了独立文件里(生产代码 `PowerOverlay.vue`/`PowerFlow.vue` 本身文件名和导出符号完全没变,不影响装配)。
- 其余无异常。

---

# Fix round 1(评审反馈:1 Critical + 2 Important)

评审结论:spec ✅,quality 未通过。核心结论——机器**单次运行内**的状态机不变式、每条终态路径的清理、power 请求的 fire-and-forget 都是对的;问题出在**跨运行**(reset 之后 / 跨轮次)时,一个仍在途的探活 Promise 迟到 resolve,能绕过现有防护。

## Critical:`reset()` 之后,迟到的探活能重新推动相位机,可能把用户困在无法关闭的浮层里

**根因**:`settled` 是唯一的过期判断,但 `reset()` 会把 `settled` 重新置回 `false`。探活是 `await` 出去的,一次 `fetch` 在正在重启/关机的机器上可能悬空几十秒才 resolve/reject。评审给出的具体链路(已复核成立):重启到 180s 兜底 → `fallback`(带关闭按钮)→ 用户点关闭 → `reset()` → `idle` → 之前悬空的探活终于回来 → 因为 `settled` 已被 `reset()` 清空,回调继续往下走,把用户重新推进 `reconnecting`(**无关闭按钮、无定时器**),只能手动刷新页面才能脱困。另外三个变体(关机侧两次陈旧失败拼出误判 offline;`waitForComeback` 里 `sawOffline` 在 5 秒延迟窗口内被陈旧探活提前置真,导致新一轮"未见过下线就 done"——正是这个任务要防的头号 bug;卸载后 `onBeforeUnmount` 调 `reset()`,陈旧探活仍能挂出一个新的 reload 定时器,在用户已经离开设置页之后把整个页面刷新掉)均已复核成立,根因相同。

**修复**(`src/settings/util/powerFlow.ts`):加纪元计数器 `gen`,在 `reset()`/`startShutdown()`/`startRestart()`/`startAppUpdating()` 里各自递增;两个探活回调在 `await deps.probe()` 之前记下 `const g = gen`,`await` 之后判断 `if (g !== gen || settled) return`。保留 `settled` 不变——两道防线回答不同的问题(`settled`="这一轮定型了吗",`gen`="这个结果还算不算当前这一轮的")。在 `gen` 声明处写了较长的注释,解释探活悬空跨越 `reset()` 这个不直观的场景。

## Important 1:过期防护此前零覆盖——补 4 条 deferred-probe 回归测试

**根因确认**:原有 20 条用例的探活全部在同一微任务里 resolve,任何一次相位切换都赶在下一次探活发起之前完成,从未真正构造出"探活还悬在半空、这一轮已经翻篇"的时序。评审验证过:删掉两个回调里的 `if (settled) return`,原 20 条全绿。

在 `powerFlow.test.ts` 里加了 `deferredHarness()`——探活返回一个手动 `resolve` 的 Promise,配合假定时器把"探活正在途中"做成可控的测试状态,而不是让它在同一个微任务里自动完事。新增 `describe('评审 fix round 1:悬空探活的过期防护(gen + settled 双重门)')`,4 条用例:

1. **相位已定后,迟到的探活结果不能再推动相位**(重启 → 探活悬空 → 180s 兜底进 `fallback` → 此时才 resolve 探活为 `false`)→ 断言相位仍是 `['restarting','fallback']`,没有多出 `reconnecting`。
2. **`reset()` 之后,迟到的探活结果不能把 `idle` 拖回 `reconnecting`**(Critical 的原样回归:悬空探活 → `fallback` → `reset()` → 此时才 resolve 探活)→ 断言相位停在 `['restarting','fallback','idle']`。
3. **上一轮悬空的探活不能污染下一轮的 `sawOffline`**(重启 → 探活悬空 → `reset()` → 再次 `startRestart()` → 此时才 resolve 上一轮的探活为 `false` → 新一轮自己真正的探活报"活着")→ 断言不会因为一次"活着"就直接 `done`(必须先见过下线),`reload` 不会被调用。**这是任务存在的核心不变式,权重最高的一条。**
4. **卸载(`reset`)之后不会新建 reload 定时器,即便过期探活凑出"假下线→假上线"也不会真的 `reload`**——与用例 3 同一种交错,但走到底并显式检查副作用:`reload()` 有没有被真的调用,并把时间推进到远超 `DONE_RELOAD_DELAY_MS`。

### 消融验证(逐条按要求实测,不是理论推断)

**去掉 `gen`(只留 `if (settled) return`)**:
```
Tests  3 failed | 21 passed (24)
用例 2 FAIL —— phases 多出 'reconnecting'
用例 3 FAIL —— phases 多出 'reconnecting'
用例 4 FAIL —— phases 里出现了 'done'(assert not.toContain('done') 失败)
用例 1 仍然 PASS(这条本来就只依赖 settled,不依赖 gen)
```

**去掉 `settled`(只留 `if (g !== gen) return`)**:
```
Tests  1 failed | 23 passed (24)
用例 1 FAIL —— phases 多出 'reconnecting'(因为这条场景里 gen 全程没变,只有 settled 在防)
用例 2/3/4 仍然 PASS(gen guard 单独就能挡住这三条)
```

两次消融都恢复代码后重新跑了一遍确认 24/24 全绿,`diff` 对比复原前后文件完全一致(用 `/tmp/.../scratchpad/powerFlow.ts.bak` 做的快照）。

**一个中途发现并修正的测试设计问题**:用例 4 最初按评审字面描述写成"单个探活悬空 → reset() → resolve 为 true → 断言不 done",第一次消融(去掉 gen)时这条**没有失败**——因为 `reset()` 本身就会把 `sawOffline` 清回 `false`,单独这一步已经能让 `if (!sawOffline) return` 挡住,不依赖 `gen`。据此把用例 4 改成了和用例 3 同构的跨轮次交错(陈旧探活的"下线"结果 + 新一轮自己真实的"上线"结果),这样才能让它真正依赖 `gen` 防线,而不是意外被 `sawOffline` 的副作用保护。已在报告里如实记录这个发现,而不是含糊带过。

## Important 2:探活既不互斥也不设上限——加 in-flight 门

3s 一次的 `setInterval` 不管上一次探活是否还没回来就会再发一次,乱序 resolve 会让"连续 2 次失败"变成"2 次失败结算"(非连续)。这也是 Critical 得以复现的机制之一。按评审给的样式加了 `inFlight` 布尔量,两个探活回调开头 `if (inFlight) return`,发出前置真,`finally` 里清空。**多加了一层**评审代码样例没有的细节:`finally` 里清空时判断 `if (g === gen) inFlight = false`——只清自己这一轮的标记,防止一个已经过期(`gen` 不匹配)的陈旧探活的 `finally` 误把"当前这一轮正在途中"的标记清空。没有加 `AbortController`/超时,遵照评审"这一轮先不做"的要求。

## 命令与结果

```bash
# 修复前(round 1 之前的状态,即上一轮已提交的基线)
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   Test Files  1 passed (1)
#        Tests  20 passed (20)

# 实现 gen + inFlight 之后,原 20 条仍然全绿
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   Test Files  1 passed (1)
#        Tests  20 passed (20)

# 加 4 条新用例之后
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   Test Files  1 passed (1)
#        Tests  24 passed (24)

# 消融 1:去掉 gen(sed 替换回 `if (settled) return`)
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   Tests  3 failed | 21 passed (24)   —— 用例 2/3/4 失败,如上

# 消融 2:去掉 settled(只留 `if (g !== gen) return`)
pnpm test src/settings/util/powerFlow.test.ts 2>&1 | tail -5
#   Tests  1 failed | 23 passed (24)   —— 用例 1 失败,如上

# 复原后(用 .bak 快照 diff 确认与消融前逐字节一致)
pnpm test 2>&1 | tail -5
#   Test Files  285 passed (285)
#        Tests  2148 passed (2148)

pnpm exec vue-tsc --noEmit
#   (无输出,零错误)

git status --short   # 提交前:3 个 D 行 + 未跟踪 docs/superpowers/plans/*.md 均在,只有 powerFlow.ts/.test.ts 被改动
git add src/settings/util/powerFlow.ts src/settings/util/powerFlow.test.ts
git commit src/settings/util/powerFlow.ts src/settings/util/powerFlow.test.ts -m "..."
git status --short   # 提交后:3 个 D 行 + 未跟踪文件原样保留
```

## 测试数变化(本轮)

| | 文件数 | 用例数 |
|---|---|---|
| Fix round 1 之前(task 9 首次提交后) | 285 | 2144 |
| Fix round 1 之后 | 285 | 2148 |
| 差值 | +0 | +4 |

`vue-tsc --noEmit`:零错误。

## 提交

- SHA:`14111b1`
- 提交范围(显式 pathspec):`src/settings/util/powerFlow.ts`、`src/settings/util/powerFlow.test.ts`
- 2 files changed, 169 insertions(+), 17 deletions(-)

## 确认事项

1. **`design-export/*.html` 的 3 个 staged deletion 未被触碰**——提交前后 `git status --short` 均显示 3 行 `D`,本次提交不涉及这些路径。
2. **未跟踪的 `docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md` 未被 add/commit**,提交后仍是 `??`。
3. 未使用 `-a` / `add -A` / `git stash`;只用显式 pathspec 的 `git add` 和 `git commit`。
4. 未新增任何 `defineExpose` 或测试专用后门——`gen`/`inFlight` 都是模块内部闭包变量,测试完全通过公开的 `PowerFlowController` 接口 + 手动控制的 deferred probe 来触发。

## Minor 项处理

评审明确列为"本轮不处理"的四项(overlay 无 focus trap/modal 标记、`PowerFlow.test.ts` 的 `vi.spyOn` 未 restore + 多余的 Pinia setup、测试硬编码 `2` 而非 import `SHUTDOWN_FAIL_THRESHOLD`、"任意 HTTP 响应=活着"隐含 502 代理误判)——**均未改动**,按要求留给最终评审 / 保持现状。

## 本轮没有发现新的 brief 风险点

除已修复的三项外,没有发现其他需要拍板的歧义或风险。

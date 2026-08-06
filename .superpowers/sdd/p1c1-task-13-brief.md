### Task 13: 集成验证 + 主题/i18n 审计 + 全支线终审 + :5288

**Files:** 无新增(只做验证与台账)

- [ ] **Step 1: 全量测试 + 类型 + 生产构建**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test
pnpm exec vue-tsc --noEmit
pnpm build
```
Expected: 全量测试绿(基线 1493 + 本期新增)、tsc 0 error、build 成功(只允许既有的 500KB chunk 警告)。

- [ ] **Step 2: 主题审计(零新裸色)**

```bash
git diff 1f8e8f8..HEAD --name-only | grep -E '\.(vue|scss)$' | \
  xargs grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*(white|black|red)\b' | \
  grep -v 'tokens.scss'
```
Expected: 无输出。`tokens.scss` 里只应新增 `--hairline-ring`(light + dark 两处)。若有其他命中,必须改成 token 或在 `tokens.scss` 头部的例外清单集中登记(仅限装饰性同类)。

- [ ] **Step 3: i18n 审计**

```bash
pnpm test -- src/i18n/parity.test.ts
grep -c "aiComingSoon" src/i18n/zh_cn.ts src/i18n/en_us.ts src -r
```
Expected: parity 绿;`aiComingSoon` 零命中(孤儿键已删)。

- [ ] **Step 4: 回归确认确认卡未受影响**

```bash
pnpm test -- src/ai/components/blocks/BlockRenderer.batchA.test.ts src/ai/components/blocks/BlockRenderer.batchB.test.ts src/ai/services/dispatchEvent.test.ts
```
Expected: 全绿。并人工核对:`ConfirmCard`/`PermissionRequestCard`/`MaxTurnsCard`/`McpPermissionCard`/`McpInstallCard` 五个卡的 store 调用未被本期改动(1b 已与 Vue2 逐字对齐,本期只新增 store 动作,不改 `confirmAgentAction`/`continueRun`)。

- [ ] **Step 5: 全支线终审(opus subagent)**

派一个 reviewer,范围 `git diff 1f8e8f8..HEAD`,重点核 5 条不变量:
1. `useAgentStore(agentType?)` 工厂形态保住,store id 规则未变;新组件全走 `useProvidedAgentStore()`。
2. store 六域逐字对 Vue2 `agentStore.js:702-847` + `423-490` 行为一致(尤其 `reverting` 三种键命名空间、`revertStagedBatch/Item` 的 status 分支、`loadAttachments` 吞错 vs `loadVisibleResources` 抛错的非对称)。
3. `selectSession` 的三 loader 在 attach **之前**;无任何新代码 `await selectSession()`。
4. 附件管线与 Vue2 `onFilesPicked` 逐条对齐(500MB 门、先 push 再传、progress 直改、document/binary 两条 meta 分支、失败态)。
5. mention 光标数学与 Vue2 `drillIn/pickItem/popSegment` 等价;`.composer-wrap` 的 `pointer-events` 链未破(弹层/菜单都有 `pointer-events:auto`)。
并列出所有有意偏离是否都带注释:AlertDialog 替 window.confirm、原生 title 替 b-tooltip、MentionPopover 补 catch、onBlur timer 清理、`scrollIntoView?.()` 守卫、Browse toast 占位。

- [ ] **Step 6: 台账 + :5288 交人眼验收**

在 `.superpowers/sdd/progress.md` 续写 P1c-1 段(每任务一行 + 终审结论 + 挂账),确认 :5288 仍在跑(`curl -sI http://127.0.0.1:5288/app/ | head -1` → 200),把验收清单交用户:
- 输入框:打字/换行(Shift+Enter)/Enter 发送/autosize 到 220px 上限/发送后清空
- 附件:点回形针选图与文档 → chip 进度 → 上传完成;删除 chip;超大文件拒绝 toast;发送后 UserMessage 里出现附件
- @提及:输入 `@` 弹面板 → ↑↓ 导航 → Tab/`/` 钻取 → Enter/Space 选中 → chip 出现在输入框上方 → chip × 移除;Backspace 退层;Esc 关闭
- 斜杠:输入 `/` 弹菜单 → 选目录 → 确认 → 会话里出现 `[/init] <目录>` 并开始流式
- 占用环:发过一轮后环出现,hover 出提示(tokens/window/百分比)
- Browse 按钮:点了给"后续版本"toast(预期,非 bug)
- 明暗两套主题下以上全部无突兀色块(切主题按钮在顶栏)

---

## Self-Review

**1. 范围覆盖(对 1c-1 清单逐条):** store 三 stream 动作 → Task 1;visible/attachments/staged 三域 → Task 2/3;selectSession 三 loader → Task 2/3;send 尾巴 loadAttachments → Task 2;composer 输入框 → Task 9;附件上传/列表/删除 → Task 10;@提及 → Task 7+11;斜杠命令(含 store `sendInit`)→ Task 4+8+11;暂存区 store 域 → Task 3(**UI 在 1c-2 的 ResourcesTab**,本期只备 store 与流式入库);确认卡交互 → **1b 已完成,Task 13 Step 4 回归确认**(核实结论:Vue2 ConfirmCard 同样无 `remember`,无缺口);ContextUsageBar → Task 6+12。
**1c-2 明确留项(不在本计划):** 右栏壳 + 4 tab(ActivityTab/ContextTab/SystemTab/ResourcesTab,含 staged UI 与 `toggleRight`)· ModelPicker · ThinkingBar(含 `setThinkingEnabled/Level`、`loadThinkingDefaults`、`loadSessionThinking`、`updateThinkingForModel` 的会话 watcher 接线)· AI-rename(`regenerateTitle` + `regeneratingTitleFor`)· `lastFallbackNotice` 提示 UI · avatar-changed · SystemTab 复用实时 utilization store。
**2. 占位扫描:** 无 TBD/TODO;每个代码步骤都给了可直接落地的代码或精确的 Vue2 行段 + 机械转换清单。Task 2 里 `loadStagedChanges` 的时序坑已显式给出执行指令(本任务只放两个 loader,Task 3 补第三个并回填断言)。
**3. 类型一致性:** `VisibleResource`/`StagedItem`/`StagedGroup` 在 Task 1 定义,Task 2/3 复用;`reverting` 键约定在 Task 3 写死并注明 1c-2 依赖;composer 三个 emit 名与 payload 在 Task 9 定义、Task 12 消费;`PendingAttachment` 仅组件内部;`ctxUsage` 形状在 Task 6(props)与 Task 12(视图 ref)一致;`runAgentRun` 实参顺序在 Task 4 显式要求以 `agentTransport.ts` 现签名为准(不照抄 Vue2 顺序)。

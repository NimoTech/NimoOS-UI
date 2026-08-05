## Task 13: 收口（映射表核对 + i18n 全量核查 + 终审 + 验收清单）

**Files:**
- Modify: `src/ai/views/SettingsPage.vue`（仅在发现漏项时）
- Modify: `src/ai/views/SettingsPage.test.ts`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: 前 12 个任务的全部产出
- Produces: 一份交给用户的验收清单

- [ ] **Step 1: 映射表七项全核**

```bash
grep -n "SECTION_COMPONENTS" -A 25 src/ai/views/SettingsPage.vue
grep -c "SectionPlaceholder" src/ai/views/SettingsPage.vue
```

断言式核对：`blacklist` / `execution` / `search` / `memory` / `observability` / `mcptokens` / `channels` **七项全部指向真组件**；`skills` / `mcp` **仍然指向 `SectionPlaceholder`**；`DEFERRED_SECTIONS` 仍是 `['skills','mcp']`（本期不许动）。

在 `SettingsPage.test.ts` 里补一条兜底守卫（防后续阶段误删）：

```ts
it('SP8-P2b 收口 —— 11 个已实现分区都不是占位，skills/mcp 仍是占位', () => {
  const implemented = ['models','providers','privacy','thinking','blacklist','execution','search','memory','observability','mcptokens','channels']
  for (const id of implemented) {
    expect(SECTION_COMPONENTS[id]).toBeDefined()
    expect(SECTION_COMPONENTS[id]).not.toBe(SectionPlaceholder)
  }
  expect(SECTION_COMPONENTS.skills).toBe(SectionPlaceholder)
  expect(SECTION_COMPONENTS.mcp).toBe(SectionPlaceholder)
})
```

（若 `SECTION_COMPONENTS` 当前没有导出，本任务把它 `export` 出来 —— 这是为了可测，属正当的最小改动，报告里说明。）

- [ ] **Step 2: i18n 全量核查（本期最容易出事的地方）**

```bash
# ① 键集对齐
pnpm test src/i18n/parity.test.ts
# ② @ 语法
pnpm test src/i18n/messageSyntax.test.ts
# ③ 本期新键逐个回查 Vue2 生产语言包(把本期所有新键名与其 Vue2 原 key 列进脚本)
python3 - <<'PY'
import json
zh=json.load(open('/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/zh_CN.json'))
en=json.load(open('/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/en_US.json'))
# 形如 (新键名, Vue2 原 key) —— 从本 plan 各任务的 i18n 表里抄全
PAIRS=[('aiCfgBlacklistDesc','blacklistDesc'), ('aiCfgChannelsTitleX','channelsTitle')]  # ← 补全
for new,old in PAIRS:
    print(new, '| zh:', repr(zh.get(old,'<缺>')), '| en:', repr(en.get(old,'<缺>')))
PY
```

把脚本输出与 `src/i18n/zh_cn.ts` / `en_us.ts` 里的实际值**逐条肉眼对**。**重点复核 P2a 踩过的那类陷阱**：① 「聊天通道」（组名 `aiCfgGroupChannel`）与「聊天渠道」（分区名 `aiCfgChannels`）没有被统一 ② `aiCfgLoadingDots`（加载中...）与 `aiCfgLoadingEllipsis`（加载中…）没有被合并 ③ `aiCfgMemSourceTool`（记忆来源「已保存」）与 `aiCfgSaved`（保存态「已保存」）没有被合并 ④ 两处 `{'@'}` 转义在位。

- [ ] **Step 3: 跨任务一致性 grep**

```bash
# 只有 Blacklist 用 settingsStore,其余 6 个分区不许碰它
grep -rln "useSettingsStore" src/ai/components/settings/sections/ | sort
# 六个分区必须直调 service.ai
grep -rlc "service.ai" src/ai/components/settings/sections/
# 没有任何分区新建 store
grep -rn "defineStore" src/ai/components/settings/ | wc -l    # 期望 0
# 弹窗一律走 SkModal,没有裸 .sk-modal-bg div
grep -rn "sk-modal-bg" src/ai/components/settings/sections/ | wc -l   # 期望 0
# 没有裸色
pnpm test src/styles/color-guard.test.ts
```

- [ ] **Step 4: 全量测试门 + 逐分区 dev server 验收**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
pnpm dev --host --port 5288
```

逐个走一遍（`http://192.168.1.143:5288/app/#/ai/settings?section=<id>`）：

1. `?section=blacklist` —— 智能体组五分区竖排、scroll-spy 高亮跟随、五份数据都回填
2. 文件系统：加一条 pattern → 出现在列表；删掉 → 消失；加非法 pattern → 弹红 toast
3. 执行步数：拨无限 → 立刻「已保存」并 2 秒后消失；改数字 → 保存；填 0 → 自动变 1
4. 搜索：取消全部搜索源 → 保存按钮禁用 + 提示；「立即重扫」→ 1.5 秒后诊断区刷新；**inotify 告警区的「复制」→ 弹「已复制」**（这是修掉的静默失败，重点看）
5. 记忆：关闭开关 → 警告条出现；改上下文窗口留空 → 保存后仍为空（发的是 null）
6. Agent 监控：Phoenix 未装时拨开关 → 弹确认框；点取消 → 开关弹回
7. `?section=mcptokens` —— 端点 URL 正确、两个接入说明框含 `<YOUR_TOKEN>`、创建令牌 → 明文弹窗一次性展示 → 关闭后列表刷新且明文不再出现
8. `?section=channels` —— 非管理员看不到机器人配置段；管理员能加机器人；生成配对码弹窗、复制码
9. **两次弹窗都要看**：SkModal 相对视口居中、底色是 AI 区卡片色、切暗色主题跟着变（Task 3 Step 6 的三条，在真实分区里再确认一次）
10. 浏览器控制台零报错、零 vue-i18n missing key 告警（未知 kind/source 的告警除外，那是设计如此）

- [ ] **Step 5: 台账收官 + 提交**

台账里写清：最终坐标（New-UI `sp8-ai@<sha>` / Service `sp8-ai@<sha>`）、全量测试数、**本期所有申报级偏离的完整清单**（预计 12 条以上：5 处补错误提示、1 处 clipboard 兜底、1 处「已保存」自动消失、2 处定时器/轮询卸载守卫、1 处 `!!s.enabled` 归一、1 处 Vue2 死字段 `_active` 未移植、1 处 `isAdmin` watch 未移植、1 处 PromptDialog maxlength 降级、1 处共享包类型修正）、遗留挂账、以及给下一期（P3 技能区）的交接项。

```bash
git add .superpowers/sdd/progress.md src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts
git commit -m "SP8-P2b Task 13: 收口 —— 映射表七项核对 + i18n 全量核查 + 台账收官"
```

---

## 自查（计划作者）

**Spec 覆盖**：7 个分区各有一个实现任务（T4/5/6/7/8/10/12）；4 个 Vue2 既有测试文件的 39 条用例全部有承接落点（Memory 13 → T6 表格逐条、Observability 5 → T8 表格逐条、McpTokens 11 → T9 六条纯函数 + T10 五条、Channels 7 → T12 表格逐条）；「必须偏离」5 条各有落点（D1→T3、D2→每个分区文件头注释、D3→T2、D4→T8、D5→T6 Step 1）；「待对账」3 项由 T0 收口；范围节「不做」清单每条都在 T13 Step 1/3 有守卫。

**唯一未承接的 Vue2 行为**：`ChannelsSection` 的 `watch: isAdmin`（T12 新增用例第 9 条已说明为何不可能触发、要求申报）。这是有意的，不是漏项。

**占位符扫描**：无 TBD / TODO。两处「按实际值调整」是对账指令而非占位（T0 明确了怎么读、读什么、回填到哪）；T13 Step 2 的 `PAIRS=[…]  # ← 补全` 是留给执行者按各任务 i18n 表机械填表的动作，表本身在 plan 里已完整给出。

**类型一致性**：`apiErrorMessage(e, fallback)` 在 T4 定义、T5/6/7/8/10/12 消费签名一致；`SkModal` 的 props/emits/slots 在 T3 定义、T10/12 按此消费（含 `update:open` 三条关闭路径的处理要求）；`mcpEndpointUrl` / `buildMcpInstruction` / `buildMcpJson` / `formatEpochMs` / `MCP_PLACEHOLDER_TOKEN` 在 T9 定义、只在 T10 消费；`bindingLabel` / `fillPairInstructions` / `fillTokenTail` 与 `ChannelBinding` 在 T11 定义、只在 T12 消费；`kindLabel` / `sourceLabel` 在 T6 定义在 `src/ai/util/memoryLabels.ts`；`useSessionStore().isAdmin` 在 T2 定义、T12 消费；`SetSwitch` 一律用 `:model-value` + `@change`（P2a Task 6 的双 emit 契约），三处消费（T5/T6/T7）写法一致。

**跨任务共享 i18n 键的引入点唯一**：`aiCfgDelete`（T4）· `aiCfgSaving`/`aiCfgSaved`/`aiCfgSaveFailed`（T5）· `aiCfgSave`（T7）· `aiCfgCopyFailed`（T7）· `aiCfgLoadingDots`/`aiCfgLoadFailed`/`aiCfgNoLabel`/`aiCfgDeleteFailed`（T10）· `aiCfgContinue`（T8）。后续任务只引用不重复添加 —— T13 Step 2 的 parity 测试会抓重复键（同名键重复声明在 TS 对象字面量里会被 lint/tsc 报 duplicate property）。

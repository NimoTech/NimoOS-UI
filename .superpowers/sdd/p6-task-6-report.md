# SP8-P6 Task 6 报告 —— Vue2 `strangler.js` 加 `/ai` 前缀条目

工作区：`/home/nimo/NimoTech/NimoOS-UI`（VUE2 老仓，无 master 分支），分支 `docs/vue3-migration-sp3`，BASE = `12723358`。

## 范围

只改两个文件：
- `src/router/strangler.js`
- `src/router/__tests__/strangler.spec.js`

`src/components/Apps/AppCard.vue:201` 的 `case 'AI'` 与 `src/views/Search.vue:297` 的 `askNimo()` **一个字未动**。`migratedEntries` **未动**。未跟踪文件 `FRONTEND_API_GUIDE.md`、`docs/vue3-pending/` **未触碰**。

---

## Step 1：先写失败的测试

在 `strangler.spec.js` 末尾原样追加 brief 给的 `describe('AI 区前缀条目(SP8-P6 cutover)', ...)` 整块（5 条 it）。

## Step 2：跑它，确认红

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/router/__tests__/strangler.spec.js --reporter=verbose 2>&1 | tail -60
```

实际红色输出（节选）：

```
 × src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > /ai 根与全部子路径都跳到 /app/#/ai* 5ms
   → expected null to be '/app/#/ai' // Object.is equality
 × src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > 查询串原样透传(搜索页问 Nimo / 桌面小组件 / 设置分区 / 知识库检索) 1ms
   → expected null to be '/app/#/ai/agent?search=%E5%8F%91%E7%A…' // Object.is equality
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > flag strangler:disabled:/ai === "1" 时整区回退 0ms
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > 不误伤名字以 ai 开头的兄弟路径 0ms
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > AI 条目不影响既有五条 0ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > /ai 根与全部子路径都跳到 /app/#/ai*
AssertionError: expected null to be '/app/#/ai' // Object.is equality
- Expected:
"/app/#/ai"
+ Received:
null
 ❯ src/router/__tests__/strangler.spec.js:225:43

 FAIL  src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > 查询串原样透传(搜索页问 Nimo / 桌面小组件 / 设置分区 / 知识库检索)
AssertionError: expected null to be '/app/#/ai/agent?search=%E5%8F%91%E7%A…' // Object.is equality
- Expected:
"/app/#/ai/agent?search=%E5%8F%91%E7%A5%A8"
+ Received:
null
 ❯ src/router/__tests__/strangler.spec.js:234:8

 Test Files  1 failed (1)
      Tests  2 failed | 41 passed (43)
   Start at  13:25:36
   Duration  521ms
```

**实际红了 2 条**（前两个 describe 块各一条：`/ai 根与全部子路径都跳到 /app/#/ai*`、`查询串原样透传`）。

🔴 **按 brief 要求核查的两条「本该已绿」的用例**：`不误伤名字以 ai 开头的兄弟路径`（断言 `/aircraft` 不命中）与 `AI 条目不影响既有五条`（断言 `/files/a/b`、`/kvm`、`/search` 三条既有条目行为不变）—— 实测**在加条目之前就已经是绿的**，与 brief 预期一致，不需要修测试。原因符合预期：加条目前 `migratedRoutes` 里没有 `/ai` 这条，`resolveTarget('/aircraft')` 本就落不到任何条目、返回 `null`；既有五条（实际测的是三条子集）从未被本刀触碰，行为自然不变。两条断言均有判别力（若后续 Step 3 把 `from` 写错成不带前导 `/` 的 `'ai'`、或把 `matches()` 的 `startsWith` 判断改错导致误吞 `/aircraft`，这条会转红）。

结论：符合 brief 逐字预期，无需修测试，直接进 Step 3。

## Step 3：加条目

在 `migratedRoutes` 数组末尾（`/search` 那条之后）按 brief 逐字追加：

```javascript
	// SP8-P6:AI 区。Vue2 侧有 8 条 /ai/* 路由(agent / settings / parser / parser/test /
	// knowledge 及其 7 个子路由,外加 /ai/skills、/ai/mcp 两条 redirect),New-UI 侧是它的
	// 超集(多出 knowledge/wiki 与 knowledge/notes)—— 一条前缀条目即可全覆盖。
	// 写 prefix 的两个理由都成立:① Vue2 这边真有 /ai/* 子路径;② AI 区深链靠查询串
	// (?search= 搜索页问 Nimo、?message= 桌面小组件、?section= 设置分区、?skill=、
	// 知识库 ?q=),而 resolveTarget 只在 prefix 分支拼查询串。
	{ from: '/ai', to: '/app/#/ai', prefix: true, enabled: true },
```

## Step 4：跑测试确认绿

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/router/__tests__/ --reporter=verbose 2>&1 | tail -20
```

输出：
```
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > /ai 根与全部子路径都跳到 /app/#/ai* 0ms
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > 查询串原样透传(搜索页问 Nimo / 桌面小组件 / 设置分区 / 知识库检索) 0ms
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > flag strangler:disabled:/ai === "1" 时整区回退 0ms
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > 不误伤名字以 ai 开头的兄弟路径 0ms
 ✓ src/router/__tests__/strangler.spec.js > AI 区前缀条目(SP8-P6 cutover) > AI 条目不影响既有五条 0ms

 Test Files  2 passed (2)
      Tests  44 passed (44)
   Start at  13:25:51
   Duration  577ms
```

全绿：2 个测试文件（含 `aiRedirectTiming.spec.js`，T1 留下的前提守卫），44 例。

## Step 5：跑 Vue2 全量，确认零新增失败

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run 2>&1 | tail -25
```

尾部原文：
```
- Expected
+ Received

  {
    "agent": false,
    "ollama": false,
+   "openvino": false,
  }

 ❯ tests/settingsStore.test.js:304:34
    302|     const { state, actions } = createSettingsStore()
    303|     await actions.loadServicesStatus()
    304|     expect(state.servicesStatus).toEqual({ ollama: false, agent: false…
       |                                  ^
    305|   })
    306| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/8]⎯


 Test Files  2 failed | 157 passed (159)
      Tests  8 failed | 1477 passed (1485)
   Start at  13:25:57
   Duration  21.85s
```

失败文件名清单（`/usr/bin/grep -E "^ (FAIL|Test Files|Tests)"` 取得）：

```
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 收起态 > 有任务时收起态显示小图标 + 「X 个后台任务」文字,不显示总百分比/任何明细/进度条
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 收起态 > 任务数文字反映当前任务条数
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 展开后才出现按类型明细与进度条
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 不同类型各渲染一条独立进度,标签正确
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 某类型有错误时该类型标记失败,并显示错误详情
 FAIL  tests/settingsStore.test.js > createSettingsStore - factory + initial state > initial state has expected shape
 FAIL  tests/settingsStore.test.js > createSettingsStore - policy + services actions > loadServicesStatus normalizes nested .running into booleans
 FAIL  tests/settingsStore.test.js > createSettingsStore - policy + services actions > loadServicesStatus sets false on error
 Test Files  2 failed | 157 passed (159)
```

**与 T0 基线比对（按文件名，不按数字）**：T0 记录的 VUE2 基线是「158 文件（2 失败）/ 1479 用例（8 失败），失败文件 `tests/nimoTaskBar.test.js`（5 例）+ `tests/settingsStore.test.js`（3 例）」。本次实测失败文件集合 `{tests/nimoTaskBar.test.js, tests/settingsStore.test.js}` —— **与基线两个文件名逐字相同，例数分布也一致（5+3=8）**，零新增。

（本次总文件数 159 / 总例数 1485，比基线 158/1479 各多 1/6 —— 增量来自本刀新增的 `strangler.spec.js` 用例（5 条新 it）与 T1 已落地的 `aiRedirectTiming.spec.js`；这属于预期的新增覆盖，不是回归判据，判据仍是失败文件名集合。）

## Step 6：提交

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/router/strangler.js src/router/__tests__/strangler.spec.js
git commit -m "feat(p6-t6): strangler 加 /ai 前缀条目 —— AI 区绞杀到 New-UI ..."
```

只暂存了这两个文件（`git status --short` 提交前确认过，未跟踪的 `FRONTEND_API_GUIDE.md`/`docs/vue3-pending/` 未被 `add`）。

---

## 最终结果

- Step 2 红阶段：**2 条新用例真红**（`/ai 根与全部子路径都跳到 /app/#/ai*`、`查询串原样透传`），另外 2 条（`不误伤`、`AI 条目不影响既有五条`）**在加条目前就已是绿的**——符合 brief 预期，核实为断言本身有效（非误报），未修改测试。
- Step 4：`src/router/__tests__/` 全绿，2 文件 / 44 例。
- Step 5：全量 159 文件 / 1485 例，8 例失败，失败文件集合 `{tests/nimoTaskBar.test.js, tests/settingsStore.test.js}` —— 与 T0 基线逐字一致，零新增回归。
- 提交：VUE2 仓 commit `749e4aae`（`feat(p6-t6): strangler 加 /ai 前缀条目 —— AI 区绞杀到 New-UI`）。

## Concern

无。本刀严格按 brief 逐字执行，未偏离范围，未触碰 `migratedEntries`、`AppCard.vue`、`Search.vue` 及两个未跟踪的 T9 遗留文件。

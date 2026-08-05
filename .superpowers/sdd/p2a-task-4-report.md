# SP8-P2a Task 4 — 实现报告

应用级 AI 主题 store(`aiTheme`)+ `agentStore` 改委托。

## 做了什么

1. 新建 `src/ai/stores/aiTheme.ts` —— 完全按 brief Step 3 逐字照抄:`useAiTheme` pinia setup
   store,持有 `theme: Ref<AiTheme>`、`toggleTheme()`、`hydrateTheme()`,`THEME_KEY =
   'nimoos.ai.agent.theme'` 与 Vue2 逐字一致。
2. 新建 `src/ai/stores/aiTheme.test.ts` —— 按 brief Step 1 逐字照抄,仅改动了标注为占位符的
   最后一条用例(见下「对 brief 一处裁定的落实」)。
3. 改 `src/ai/stores/agentStore.ts`(四处最小改动,见下逐段 diff)。
4. `src/ai/stores/agentStore.test.ts` 改了一处(删除一行 `s.theme = 'light'`),原因见下
   「既有测试改动说明」。

## `agentStore.ts` 具体改了哪几处

### 改动 1:import + 顶部常量注释

```diff
 import { defineStore } from 'pinia'
-import { ref } from 'vue'
+import { computed, ref } from 'vue'
 import { service } from '@nimotech/nimoos-service'
 import { migrateLegacyMessages } from '../services/streamMappers'
 import { runAgentRun, attachAgentStream } from '../services/agentTransport'
 import { i18n } from '../../i18n'
+import { useAiTheme, type AiTheme } from './aiTheme'
 import type { AgentBlock, AgentStats, AttachmentRef, StreamActions } from '../types'

-// AI Agent 主题偏好持久化 key —— 与 Vue2 blueprint(Agent.vue:80,90-96,117-119)逐字对齐。
-const THEME_KEY = 'nimoos.ai.agent.theme'
+// SP8-P2a Task 4 —— THEME_KEY 与主题状态搬到 `./aiTheme`(应用级共享,
+// Agent 页与设置页同源)。原因见该文件头注释。这里不再本地定义。
 // agentStore.js:626,638,650 —— 已选模型持久化 key(逐字对齐)。
 const MODEL_KEY = 'nimoos.ai.agent.selectedModel'
```

### 改动 2:`AgentTheme` 类型改别名(保留 export)

```diff
-export type AgentTheme = 'light' | 'dark'
+/** @deprecated 名字保留以免动到既有 import;实体是 `AiTheme`。 */
+export type AgentTheme = AiTheme
```

### 改动 3:私有 ref → 转出共享 store 实例

```diff
     const busy = ref(false)
-    const theme = ref<AgentTheme>('light')
+    // SP8-P2a Task 4(D1)—— 主题不再是本 store 的私有 ref,而是应用级共享 store 的
+    // 转出。对外签名(store.theme / store.toggleTheme)完全不变,故 AgentPage /
+    // AgentTopbar / 既有测试的调用点一行都不用改。
+    const aiTheme = useAiTheme()
     const leftCollapsed = ref(false)
```

### 改动 4:`initTheme` / `toggleTheme` 函数体改委托

```diff
     function initTheme() {
-      const stored = localStorage.getItem(THEME_KEY)
-      if (stored === 'light' || stored === 'dark') {
-        theme.value = stored
-        return
-      }
-      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
-        theme.value = 'dark'
-        return
-      }
-      theme.value = 'light'
+      aiTheme.hydrateTheme()
     }

     function toggleTheme() {
-      theme.value = theme.value === 'light' ? 'dark' : 'light'
-      localStorage.setItem(THEME_KEY, theme.value)
+      aiTheme.toggleTheme()
     }
```

(`initTheme` 与 `toggleTheme` 两处的函数名、参数、调用方式完全不变，仅函数体改为委托。)

### 改动 5:return 表 `theme` 改 computed

```diff
       busy,
-      theme,
+      // SP8-P2a Task 4(D1)—— 必须是 computed,不能写成 `aiTheme.theme`(裸值是取值
+      // 那一刻的快照,会丢响应性,详见 aiTheme.ts 头注释与本任务报告 Step 6 的 RED 验证)。
+      theme: computed(() => aiTheme.theme),
       leftCollapsed,
```

这五处合起来正是 brief 列出的「四处最小改动」（import/常量搬移 + 类型别名 + ref 换成
`useAiTheme()` 实例 + 函数体委托 + return 表 computed）。`initTheme` 这个名字是 grep 后确认
的真实导出函数（见下），不是新增。

## 对 brief 一处裁定的落实

brief Step 1 测试最后一条用例里的 `agent.loadPersisted()` 标注为占位名，要求先 grep
`agentStore.ts` 找到真正承载"读 localStorage / 读 prefers-color-scheme / 兜底 light"这段
逻辑的函数名。

grep 结果：该逻辑就在具名函数 `initTheme()` 里（改动前位于 `:305-317`），且它**已经在 store
的 return 表里导出**（`AgentPage.vue:224` 就是靠 `store.initTheme()` 在 `onMounted` 里调用
它来装载主题）。因此按用户裁定的分支一「照 brief 说的做」——把测试用例里的占位调用改成真实
函数名 `agent.initTheme()`，**没有在 agentStore 上新增任何导出**。

```ts
it('agentStore 的 initTheme 装载后,共享 store 也是同一个值', () => {
  localStorage.setItem(KEY, 'dark')
  const agent = useAgentStore()
  agent.initTheme()
  expect(agent.theme).toBe('dark')
  expect(useAiTheme().theme).toBe('dark')
})
```

## Step 2(红)真实输出

```
pnpm exec vitest run src/ai/stores/aiTheme.test.ts
```

```
 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)
```

`useAiTheme` 自身的 5 条用例已过（因为 `aiTheme.ts` 此时已按 Step 3 写好），但「agentStore
主题委托给 aiTheme」这 3 条按预期全红：

```
 FAIL  ... agentStore.theme 读到的是 aiTheme 的值
AssertionError: expected 'light' to be 'dark'
   Expected: "dark"
   Received: "light"

 FAIL  ... agentStore.toggleTheme() 会翻动共享 store —— 设置页因此能同步看到
AssertionError: expected 'light' to be 'dark'

 FAIL  ... agentStore 的 initTheme 装载后,共享 store 也是同一个值
AssertionError: expected 'light' to be 'dark'
```

（注：因为 Step 3 的 `aiTheme.ts` 与 Step 1 的测试文件是同一批写入的，实际执行顺序是「先写
两个新文件 → 跑一次确认委托前是红 → 改 agentStore → 再跑确认绿」，与 brief Step 2 期望的
"Failed to resolve import './aiTheme'" 这种「文件都不存在」式的红不同，但同样证明了
"delegation 完成前，委托类用例必然失败" 这一命题；`useAiTheme` 自身的 5 条不依赖 agentStore，
所以先绿是预期内的。)

## Step 5(绿)真实输出

```
pnpm exec vitest run src/ai/stores/aiTheme.test.ts src/ai/stores/agentStore.test.ts
```

```
 Test Files  2 passed (2)
      Tests  49 passed (49)
   Duration  707ms
```

`--reporter=verbose` 确认既有主题用例逐条通过：

```
 ✓ agentStore.test.ts > agentStore (session slice) > initTheme:localStorage 优先
 ✓ agentStore.test.ts > agentStore (session slice) > initTheme:无 localStorage 时看 matchMedia(prefers-color-scheme: dark)
 ✓ agentStore.test.ts > agentStore (session slice) > initTheme:两者都无时默认 light
 ✓ agentStore.test.ts > agentStore (session slice) > toggleTheme:翻转并写回 localStorage 同一 key
 ✓ aiTheme.test.ts > useAiTheme > 初值是 light
 ✓ aiTheme.test.ts > useAiTheme > hydrateTheme 优先读 localStorage
 ✓ aiTheme.test.ts > useAiTheme > hydrateTheme 忽略 localStorage 里的非法值,回落系统偏好
 ✓ aiTheme.test.ts > useAiTheme > 无 localStorage 且系统偏好浅色时是 light
 ✓ aiTheme.test.ts > useAiTheme > toggleTheme 翻转并落盘
 ✓ aiTheme.test.ts > agentStore 主题委托给 aiTheme(D1:跨页共享) > agentStore.theme 读到的是 aiTheme 的值
 ✓ aiTheme.test.ts > agentStore 主题委托给 aiTheme(D1:跨页共享) > agentStore.toggleTheme() 会翻动共享 store —— 设置页因此能同步看到
 ✓ aiTheme.test.ts > agentStore 主题委托给 aiTheme(D1:跨页共享) > agentStore 的 initTheme 装载后,共享 store 也是同一个值
```

## Step 6 — RED 验证响应性(两段真实输出)

把 return 表的 `theme: computed(() => aiTheme.theme)` 临时改回 `theme: aiTheme.theme`：

**第一段(红)：**

```
pnpm exec vitest run src/ai/stores/aiTheme.test.ts --reporter=verbose
```

```
 FAIL  ... agentStore.theme 读到的是 aiTheme 的值
AssertionError: expected 'light' to be 'dark'
Expected: "dark"
Received: "light"

 FAIL  ... agentStore.toggleTheme() 会翻动共享 store —— 设置页因此能同步看到
AssertionError: expected 'light' to be 'dark'
Expected: "dark"
Received: "light"

 FAIL  ... agentStore 的 initTheme 装载后,共享 store 也是同一个值
AssertionError: expected 'light' to be 'dark'
Expected: "dark"
Received: "light"

 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)
```

三条委托用例精确复现「裸值是取值那一刻的快照」——`useAgentStore()` 调用时把 `aiTheme.theme`
的**当时值**('light')原样拷贝进 return 对象，后续 `aiTheme.theme` 变化不会传导。

**第二段(改回后,绿)：**

```
pnpm exec vitest run src/ai/stores/aiTheme.test.ts src/ai/stores/agentStore.test.ts
```

```
 Test Files  2 passed (2)
      Tests  49 passed (49)
```

## 既有 `agentStore.test.ts` 是否零改动通过

**没有零改动** —— 改了 1 处，逐条说明如下：

- **位置**：`toggleTheme:翻转并写回 localStorage 同一 key` 用例，删除了 `s.theme = 'light'`
  这一行赋值语句。
- **旧断言原本在断言什么**：这条用例整体断言"两次 `toggleTheme()` 能在 light⇄dark 间正确
  翻转并落盘"。`s.theme = 'light'` 这行**不是断言**，是测试准备阶段的显式赋值，意图是确保
  起点状态是 light（防御性写法，怕别的用例或全局状态污染起点）。
- **为什么必须改**：Task 4 要求 return 表里的 `theme` 是 `computed(() => aiTheme.theme)`——
  这是一个只读 computed。给它赋值会同时触发两个信号：
  1. `vue-tsc --noEmit` 编译期报 `TS2540: Cannot assign to 'theme' because it is a
     read-only property.`(阻断 Step 7 的类型门)
  2. 运行时 Vue 发出 `Set operation on key "theme" failed: target is readonly` 警告
     (赋值静默失效,不抛异常)。
- **为什么删掉而不是换种写法**：该行在委托改动前后都是**冗余的**——本文件顶部
  `beforeEach` 每条用例前都 `setActivePinia(createPinia())` 重建全新 pinia,而
  `aiTheme.ts` 的 `theme` 初值本就是 `'light'`(见 `aiTheme.ts` 的 `ref<AiTheme>('light')`)。
  也就是说这行赋值从委托改动之前就从未真正改变断言的前提——每次进入这条用例时 `s.theme`
  已经是 `'light'`。删除后用例的断言本体(`toggleTheme` 两次翻转 + `localStorage` 落盘校验)
  一字未动,且实测通过。
  - **委托是否做错了**:先检查过——不是委托做错。`theme` 必须是只读 computed 是 brief
    Step 4 明确要求(且 Step 6 用 RED 验证证明了它是必需的),这条测试语句本身在改动前就是
    可以安全删除的冗余防御代码,只是之前"恰好也能通过类型检查"掩盖了它的冗余性。

其余 3 条既有主题用例(`initTheme` 的三档:localStorage 优先 / matchMedia / 双无兜底
light)**零改动**,委托后原样通过。

## 全量门三条命令结果

```bash
pnpm test
```
```
 Test Files  263 passed (263)
      Tests  1902 passed (1902)
   Duration  51.93s
```
(未遇到已知的 IndexedDB 偶发 flaky,本次一次跑绿。)

```bash
pnpm exec vue-tsc --noEmit
```
```
(无输出,退出码 0)
```

```bash
pnpm build
```
```
✓ built in 11.27s
```
只有既有的 500KB chunk 警告(`ExcelViewer-*.js` 1.68MB、`index-BK5cwzsB.js` 2.93MB 等),
与本任务改动无关,brief 允许的既有噪音。

## 偏离与原因

1. **`agentStore.test.ts` 删除一行 `s.theme = 'light'`** —— 见上「既有测试改动说明」,
   已按纪律三件套处理:代码注释里写清原因、本报告逐条申报、下面登记进台账。这是 Task 4
   自身范围内必然产生的连带改动(D1 要求 `theme` 变只读 computed,该行赋值语句因而失效),
   不是与需求无关的改动。
2. 其余无偏离。`aiTheme.ts` / `aiTheme.test.ts` 逐字照 brief Step 1/3;`agentStore.ts` 四处
   改动逐字照 brief Step 4 清单;brief Step 1 标注的占位名 `loadPersisted` 按用户裁定改成
   grep 到的真名 `initTheme`,未新增任何 agentStore 导出。

## `git show --stat HEAD`

```
commit dadfb0e5300d46a27c9af68291ef62ea264336e8
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 16:16:01 2026 +0800

    SP8-P2a Task 4: 抽出应用级 aiTheme,agentStore 改委托(D1 跨页主题同步)

 src/ai/stores/agentStore.test.ts |  9 +++-
 src/ai/stores/agentStore.ts      | 46 +++++++++++---------
 src/ai/stores/aiTheme.test.ts    | 93 ++++++++++++++++++++++++++++++++++++++++
 src/ai/stores/aiTheme.ts         | 50 +++++++++++++++++++++
 4 files changed, 177 insertions(+), 21 deletions(-)
```

`git status` 之后为 `nothing to commit, working tree clean`,只含本任务清单内的 4 个文件。

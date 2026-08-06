# SP8-P1c2 Task 13 报告(Step 1–5)

分支 `sp8-ai`,base `9e1e5c7`,提交 `59e294b` `SP8-P1c2: wire right panel into AgentPage + clear activitySteps on session change`。

---

## Step 1:右栏接线

### 1.1 prop 对照表(实际接的 vs Vue2 `Agent.vue:44-64`)

| Vue2 `Agent.vue` | Vue2 传值 | 本仓 `AgentPage.vue` 实际传值 | 说明 |
|---|---|---|---|
| `:collapsed` (:45) | `store.state.rightCollapsed` | `store.rightCollapsed` | 一致 |
| `:tab` (:46) | `store.state.rightTab` | `store.rightTab` | 一致 |
| `:activity-steps` (:47) | `store.state.activitySteps` | `activityStepsForPanel`(= `store.activitySteps` 的**纯类型**桥接 computed) | 零运行时语义,见 §1.4 |
| `:system-metrics` (:48) | `store.state.systemMetrics` | **不传,且 prop 已删** | **有意偏离**,见 §1.3 |
| `:storage` (:49) | `store.state.storage` | `storage`(AgentPage 页面级 ref,T11 装载) | 一致(本仓不放 store,T11 已登记) |
| `:busy` (:50) | `store.state.busy` | `store.busy` | 一致 |
| `:session-id` (:51) | `store.state.activeSessionId` | `String(store.activeSessionId ?? '')` | 归一化,见 §1.4 |
| `:visible-resources` (:52) | `store.state.visibleResources` | `store.visibleResources` | 一致 |
| `:attachments` (:53) | `store.state.attachments` | `attachmentsForPanel`(纯类型桥接 computed) | 零运行时语义,见 §1.4 |
| `:staged-changes` (:54) | `store.state.stagedChanges` | `store.stagedChanges` | 一致 |
| `:committing` (:55) | `store.state.committing` | `store.committing` | 一致 |
| `:reverting` (:56) | `store.state.reverting` | `store.reverting` | 一致 |

Vue2 12 个 prop → 本仓 11 个(少 `systemMetrics`)。

### 1.2 事件对照表(store 函数名/签名已逐个到 `agentStore.ts` 核对,非照抄 brief 表)

| Vue2 `Agent.vue` | Vue2 处理器 | 本仓处理器 | store 真实签名(agentStore.ts) |
|---|---|---|---|
| `@set-tab` (:57) | `store.actions.setRightTab` | `(tab) => store.setRightTab(tab)` | `setRightTab(tab: 'activity'\|'context'\|'system'\|'resources')` :311 |
| `@remove-resource` (:58) | `removeVisibleResource` | `(id) => store.removeVisibleResource(id)` | `async removeVisibleResource(resId: string\|number)` :494 |
| `@remove-attachment` (:59) | `removeAttachment` | `(id) => store.removeAttachment(id)` | `async removeAttachment(aid: string\|number)` :546 |
| `@revert-run` (:60) | `revertStagedRun` | `(runId) => store.revertStagedRun(runId)` | `async revertStagedRun(runId: string\|number)` :572 |
| `@revert-batch` (:61) | `revertStagedBatch` | `(batchId) => store.revertStagedBatch(batchId)` | `async revertStagedBatch(batchId: string\|number)` :586 |
| `@revert-item` (:62) | `revertStagedItem` | `(stagedId) => store.revertStagedItem(stagedId)` | `async revertStagedItem(stagedId: string\|number)` :603 |
| `@commit-all` (:63) | `commitStagedAll` | `() => store.commitStagedAll()` | `async commitStagedAll()` :562 |

写成内联箭头而不是裸方法引用 —— 与本页 AgentComposer 处已有的长注释同一理由(Vue3 裸引用会把函数值固化进 vnode,`vi.spyOn` 替换后不生效)。行为等价。

**brief 表的一处不准确(已核实真源):** brief 写「ResourcesTab 的 7 个 emit」。实际 `ResourcesTab.vue` 只声明 **6** 个 emit(`remove-resource` / `remove-attachment` / `revert-run` / `revert-batch` / `revert-item` / `commit-all`);第 7 个 `set-tab` 是 AgentRightPanel 自己 tab 条按钮发的,不经过 ResourcesTab。已按真实的 6 个透传,AgentRightPanel 对外仍是 7 个 emit(6 + set-tab),与 Vue2 一致。

### 1.3 有意偏离申报:`systemMetrics`(用户 2026-07-27 拍板)

- Vue2 `Agent.vue:48` 把 `store.state.systemMetrics`(mounted 时一次性 HTTP 拉、之后从不刷新)传给右栏,`AgentRightPanel.vue:48` 声明该 prop,`:14` 转发给 SystemTab。
- 本仓 `SystemTab.vue`(T11)改吃 New-UI 现成的实时通道 `useUtilization()`(首帧 HTTP + MessageBus `nimoos:system:utilization` 持续推送),**自己取数**。
- 因此本任务:
  - `AgentRightPanel.vue` 删掉 `systemMetrics?: Record<string, unknown>` 声明与 `() => ({})` 默认值,原处留注释说明 Vue2 有、本仓为何没有(避免留一个无人消费的死 prop)。
  - `AgentPage.vue` 不传该 prop,模板注释里再申报一次。
  - `AgentRightPanel.test.ts` 「12 个 props」用例改成「11 个 props」并加断言 `Object.keys(props()).length === 11`;新增用例断言 `systemMetrics` 既不在 AgentRightPanel 的 props 里、也不在 SystemTab 的 props 里。
- `storage` 仍走 prop(容量不需要实时,与 Vue2 同)。

### 1.4 其余 judgment call(全部申报)

1. **`:session-id` 归一化。** Vue2 `Agent.vue:51` 直传 `activeSessionId`(可能是 number 或 null),而 Vue2 `AgentRightPanel.vue:51` 声明的是 `{ type: String, default: '' }` —— 真跑到 number/null 会有 Vue prop 类型告警。本仓写 `String(store.activeSessionId ?? '')`,与本页 AgentTopbar 的 `:session-id` 用同一种写法。**行为面影响:** 无(ResourcesTab 只用它做 truthy 判断 + 拼下载 URL)。
2. **两个纯类型桥接 computed。** `store.activitySteps` / `store.attachments` 在 store 里是宽松的 `Record<string, unknown>[]`,而 `ActivityTab`/`ResourcesTab` 各自声明了更窄的 `ActivityStep`/`ResourceAttachment`。用 `computed(() => x as unknown as T[])` 对齐类型 —— 与本页已有的 `messagesForList` 同一模式与理由,**零运行时转换/拷贝**。没有去改 store 的字段类型(store 要接住后端裸 JSON,收窄会牵连 loader)。
3. **`AgentRightPanel` 三个 prop 的类型收窄。** `storage: Record<string, unknown>|null → StoragePayload|null`、`visibleResources: Record<string, unknown>[] → VisibleResource[]`、`attachments → ResourceAttachment[]`。原来是 T10 建壳时的占位宽类型;现在真组件挂上了,不收窄 `vue-tsc` 通不过。运行时无变化。
4. **`set-tab` emit 载荷类型收窄**成四个字面量联合(模板里就只有这四个按钮能发它),这样 AgentPage 可以直接把它交给 `store.setRightTab` 而不必 cast。运行时无变化。
5. **未改动的地方(照 Vue2):** 七个 store action 都是 async 且 Vue2 侧就没有 catch(已核对 Vue2 `agentStore.js:754/773/788/799/812/830`,`removeVisibleResource`/`removeAttachment` 连 try 都没有)。本仓 store 同构。**没有**顺手加 catch —— 这不是「修一个可复现的错误行为」,是需求外的改动,照 Vue2。
6. `AgentRightPanel.test.ts` 的 i18n 从手写子集换成整份 `zh_cn`(ResourcesTab 用到几十个键),并补 Pinia + `service.sys.getUtilization` + `useMessageBus` 三件套 mock(与 `SystemTab.test.ts` 同款)。`AgentPage.test.ts` 的服务 mock 从裸对象改成 `importActual` 铺底 —— utilization store 从共享包**具名导入** `parseUtil`,不铺底会直接 import 失败。

### 1.5 集成测试(加在 `AgentPage.test.ts`,6 条)

- 11 个 prop 逐条来自 store / 页面 `storage` ref,并断言 `systemMetrics` 不在 props 里
- 切 4 个 tab 各渲染对应内容(Activity/Context/System/Resources 互斥)
- 右栏 tab 条真实点击 → `store.setRightTab` 被调用(spy)+ 渲染跟着换
- 右栏开关联动:`data-rightcollapsed` 与 `<aside class="rightpanel">` 的存在与否同步翻转
- Resources 三级回滚 + 提交的**真实 DOM 点击**分别打到 `revertStagedRun('run1')` / `revertStagedBatch('batch1')` / `revertStagedItem('st1')` / `commitStagedAll()`(spy 断言参数)
- 授权资源 × / 附件 × 分别打到 `removeVisibleResource('r1')` / `removeAttachment('a1')`

`AgentRightPanel.test.ts` 另加 3 条(storage 直传 SystemTab + systemMetrics 缺席、7 个 prop 直传 ResourcesTab、6 个 emit 原样上抛)。

---

## Step 2:`activitySteps` 从不清空(Vue2 遗留缺陷)

### 落点(file:line,提交后)

| 位置 | 内容 |
|---|---|
| `src/ai/stores/agentStore.ts:205` | `createSession()` 里紧跟 `messages.value = []` 之后 `clearActivitySteps()` |
| `src/ai/stores/agentStore.ts:216` | `deleteSession()` 的 `activeSessionId === id` 分支里,紧跟 `messages.value = []` 之后 |
| `src/ai/stores/agentStore.ts:220-235` | `clearActivitySteps()` 定义 + 主注释 |
| `src/ai/stores/agentStore.ts:275` | `selectSession()` 里紧跟 `activeSessionId.value = id`、**在第一个 await 之前** |

跟同类「每会话状态」(messages / visibleResources / attachments / stagedChanges)走同一条路径、同一个时机,没有另起一套。

### 注释原文(`agentStore.ts:220-232`)

```
    /**
     * Vue2 缺陷修复(项目 2026-07-27 移植纪律:界面照 Vue2,逻辑照正确)。
     *
     * Vue2 `store/agentStore.js` 里 `activitySteps` 声明于 :39、push 于 :128、原地
     * patch 于 :137-140,**全文件没有任何一处清空它**;切会话(:246-293)、新建会话
     * (:166-183)、删除当前会话(:185-192)都不重置。后果是可复现的错误行为:上一个
     * 会话跑过的运行步骤会残留在右栏 Activity tab —— 用户切到另一个会话后,Activity
     * 里显示的还是上一段对话的步骤,看起来像"新会话正在跑/跑过这些东西"。
     *
     * 这里按「逻辑照正确」在三个**会话边界**上清空它,与 messages / visibleResources /
     * attachments / stagedChanges 这些同类"每会话状态"走同一条路径、同一个时机,
     * 不另起一套。
     */
```

`selectSession` 处另有一行:`// Vue2 缺陷修复 —— 见 clearActivitySteps() 注释。必须在 await 之前、紧挨着 activeSessionId 切换:此后 attach 的 replay 事件才是新会话自己的步骤。`

### 测试(`agentStore.p1c2.test.ts` 新增 describe,4 条)

1. 会话 A 跑出步骤 → 切到会话 B → `activitySteps` 为空
2. 新建会话 → 为空
3. 删除**当前**会话 → 为空
4. 删除**非当前**会话 → **保留**(控制组,证明不是无脑清空)

⚠️ 禁忌遵守:用例里用 `void s.selectSession('sess-B')` **不 await**,随后同步断言(清空点在第一个 await 之前),再用 `flushPromises()` 让内部链落定后二次断言。全文件我新增的代码没有任何 `await store.selectSession(...)`。

### RED 验证(真实输出)

把 `clearActivitySteps()` 的函数体换成空(`/* RED-CHECK: intentionally broken */`),其余不动:

```
     × 会话 A 跑出步骤 → 切到会话 B → activitySteps 为空 9ms
     × 新建会话 → activitySteps 为空(与 messages 同一处会话边界清理) 2ms
     × 删除当前会话 → activitySteps 为空 1ms
 FAIL  ... > 会话 A 跑出步骤 → 切到会话 B → activitySteps 为空
AssertionError: expected [ { …(4) }, { …(4) } ] to deeply equal []
 FAIL  ... > 新建会话 → activitySteps 为空(与 messages 同一处会话边界清理)
AssertionError: expected [ { …(4) } ] to deeply equal []
 FAIL  ... > 删除当前会话 → activitySteps 为空
AssertionError: expected [ { …(4) } ] to deeply equal []
 Test Files  1 failed (1)
      Tests  3 failed | 1 passed | 26 skipped (30)
```

(第 4 条「删除非当前会话 → 保留」按预期仍 pass —— 控制组生效。)

恢复后逐字比对确认与破坏前完全一致(`diff` 无输出,打印 `RESTORED-IDENTICAL`),再跑 GREEN:

```
RESTORED-IDENTICAL
 Test Files  1 passed (1)
      Tests  4 passed | 26 skipped (30)
```

---

## Step 3:三道门(真实输出尾巴)

### `pnpm test`(全量)

```
 Test Files  1 failed | 258 passed (259)
      Tests  1 failed | 1861 passed (1862)
   Start at  12:47:53
   Duration  59.15s
```

**唯一的 1 条红是 base 提交 `9e1e5c7` 就已经红的、与本任务无关的既有缺陷**,证据链:

- 失败用例:`src/styles/color-guard.test.ts > src/ai/components/tabs/ResourcesTab.vue 无裸颜色字面量`
- 报的两行:
  ```
  L285: // Vue2 裸色 1/2: rgba(255,149,0,0.12) 背景 + var(--warning, #ff9500) 兜底色字 → 既有 token。
  L308: // Vue2 裸色 7: rgba(255,59,48,0.1) 背景 → --danger-soft。
  ```
  两行都是 `<style scoped>` 块里的**注释**,color-guard 不跳过注释。
- 这两行在 HEAD 就存在:`git show HEAD:src/ai/components/tabs/ResourcesTab.vue | grep -n "rgba(255,149\|rgba(255,59"` 输出同样的 285/308 行。
- `ResourcesTab.vue` 与 `color-guard.test.ts` **都不在我的改动里**(`git status --short` 只有 6 个白名单文件)。
- **未修**:`ResourcesTab.vue` 不在本任务白名单(brief 明列「只许动这些」)。最小修法(留给协调者定夺):把 285/308 两行注释里的 `rgba(...)` 改成不含括号的写法(如 `rgba 255,149,0 / .12`),或在该行加 `/* theme-exception: 引用 Vue2 原色值仅作说明 */`。

我改动范围内的靶向复跑(见 Step 5)全绿。

### `pnpm exec vue-tsc --noEmit`

```
EXIT=0
```
(零输出、零错误。)

### `pnpm build`

```
dist/assets/ExcelViewer-BK3TEYy3.js          1,681.55 kB │ gzip: 503.45 kB
dist/assets/index-B_wRG2Qo.js                2,931.28 kB │ gzip: 854.03 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: ...
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 11.60s
```
只有既有的 500KB 体积警告,无新错误(`vue-tsc` 已在 build 前跑过一遍)。

---

## Step 4:主题审计

```
$ git diff 3614196 --name-only | grep -E '\.(vue|scss|css)$' \
    | grep -vE 'tokens\.scss|theme\.css|popover\.scss|agent-styles\.scss' \
    | xargs grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*(white|black)\b'

src/ai/components/shell/AgentRightPanel.vue:132:   Vue2:76 raw `color: white` → `var(--text-on-accent)` (only bare colour). */
src/ai/components/tabs/ResourcesTab.vue:27:  badge-NEW/DEL/REN/MKD 背景、rt-orphan-tag 背景、rt-commit 的 color:white)
src/ai/components/tabs/ResourcesTab.vue:285:// Vue2 裸色 1/2: rgba(255,149,0,0.12) 背景 + var(--warning, #ff9500) 兜底色字 → 既有 token。
src/ai/components/tabs/ResourcesTab.vue:308:// Vue2 裸色 7: rgba(255,59,48,0.1) 背景 → --danger-soft。
src/ai/components/tabs/ResourcesTab.vue:311:// Vue2 裸色 8: color: white → --text-on-accent。
```

**5 条命中全部是注释行**(brief 允许,列此供核):1 条来自 T10(AgentRightPanel 的 badge-pending 说明),4 条来自 T12(ResourcesTab 的 Vue2 原色值对照说明)。**没有一条来自本任务**——本任务对 `.vue` 的改动里没有任何新增色值:

```
$ git diff -- src/ai | grep -E '^\+' | grep -E '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*(white|black)\b'
(无输出)
```

**本任务新增 token 数 = 0**(`git status --short src/ai/styles/` 为空,`tokens.scss` 未被触碰),所以「浅色块 + `[data-theme="dark"]` 块两处都有值」这条逐个 grep 的检查无对象可查。

---

## Step 5:i18n 审计 + 回归

**本任务新增 i18n 键数 = 0**(`git status --short src/i18n/` 为空),所以「抽查 5 个本期新键」无对象可查。守卫仍跑:

```
$ pnpm test -- src/i18n/
 Test Files  3 passed (3)
      Tests  9 passed (9)
```

```
$ pnpm test -- src/ai/
 Test Files  43 passed (43)
      Tests  604 passed (604)
   Duration  11.12s
```

composer 39 例、dispatchEvent、BlockRenderer 三批全部包含在这 604 条里,零回归。

---

## 与 Vue2 不一致之处 · 申报清单(汇总)

| # | 位置 | 偏离 | 性质 | 注释在? |
|---|---|---|---|---|
| 1 | `AgentRightPanel.vue` props / `AgentPage.vue` 模板 | 删 `systemMetrics` prop、不传该 prop | 用户 2026-07-27 拍板的有意偏离(SystemTab 自取实时数据) | ✅ 两处都有 |
| 2 | `agentStore.ts` createSession / deleteSession / selectSession | 会话边界清空 `activitySteps`(Vue2 从不清空) | Vue2 缺陷,按「逻辑照正确」修 | ✅ |
| 3 | `AgentPage.vue` `:session-id` | `String(... ?? '')` 归一化(Vue2 直传可能是 number/null) | 消除 Vue2 的 prop 类型告警,行为等价 | ✅ |
| 4 | `AgentPage.vue` `activityStepsForPanel` / `attachmentsForPanel` | 纯类型桥接 computed | TS-only,零运行时语义 | ✅ |
| 5 | `AgentRightPanel.vue` props | `storage`/`visibleResources`/`attachments` 类型收窄 | TS-only | ✅(props 处) |
| 6 | `AgentRightPanel.vue` emits | `set-tab` 载荷收窄成四字面量 | TS-only | ✅ |
| 7 | `AgentPage.vue` 事件处理器 | 内联箭头而非裸方法引用 | 沿用本页 T12 已登记的同一理由 | ✅ |

**未偏离但值得点名:** 七个 store action 的 rejection 在 Vue2 里就没人接(fire-and-forget),本仓照旧,**没有**顺手加 catch。

---

## `git show --stat HEAD`

```
commit 59e294b524851d05218219bb3ab9488e86ca37e0
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 12:53:38 2026 +0800

    SP8-P1c2: wire right panel into AgentPage + clear activitySteps on session change

 src/ai/components/shell/AgentRightPanel.test.ts | 134 ++++++++++++++-----
 src/ai/components/shell/AgentRightPanel.vue     |  65 ++++++---
 src/ai/stores/agentStore.p1c2.test.ts           |  76 +++++++++++
 src/ai/stores/agentStore.ts                     |  25 ++++
 src/ai/views/AgentPage.test.ts                  | 170 +++++++++++++++++++++++-
 src/ai/views/AgentPage.vue                      |  49 ++++++-
 6 files changed, 464 insertions(+), 55 deletions(-)
```

`git status --short` 在 stage 前只有这 6 个白名单文件,无白名单外内容被提交。

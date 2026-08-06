# SP8-P4 整期终审修复轮 —— 报告

- 分支:`sp8-ai`,基线 `69af8ed`(终审判定「Ready to merge: With fixes」)
- 修复范围:终审 `p4-FINAL-review.md` 点名的 2 条 Important(I1/I2)+ 4 条 Minor(M2/M3/M5/M7)
- 不动:M4(saveError 清理无用例)· M6(手搓 flush)· M8(i18n 复用清单漂移)· T3 两条 deferred minor · `sk-shared.scss:52` 既有 `color: white`(P2b 存量)—— 均按协调者裁定留账不修
- 未改后端 / 共享包,未 push,未 rebase/reset/merge

---

## I1 —— `McpSection.test.ts` 用例 9(D1 第二处单层取数)零判别力

### 改了什么

`src/ai/components/settings/sections/McpSection.test.ts` 用例 9 的 fixture 从
「空列表 → 新建后单条」改成「新建前已有 2 条(id 1/2)且已选中其中一条(svc-b)
→ 新建 → 第二次 `listMCPServers` 返回 `[svc-a, svc-b, srv(7)]`(7 在末尾,对齐
后端 `service/mcp.go:63` 的 `ORDER BY id` 升序)→ 断言 `activeId` 精确落在新建
的 7 上,不是先前选中的 svc-b,也不是列表第一项 svc-a」。

`createMCPServer` 的 mock 形状本身没动(仍是裸 `{id: 7}`,不是完整对象)——问题
只在 fixture 的选中态,不在 mock 形状。

生产代码 `McpSection.vue:194` 未改动(单层取数写法本就正确,见终审 §4.3)。

### RED→GREEN 证据

**探针**(独立设计,给 `McpSection.vue:194` 注入 Vue2 式双剥壳):
```diff
-      const id = (created as { id?: number } | undefined)?.id
+      const id = (created as { data?: { id?: number } } | undefined)?.data?.id // RED-PROBE-I1
```

**RED**(注入缺陷后跑改过的用例 9,`vitest run McpSection.test.ts SettingsPage.test.ts`):
```
 FAIL  src/ai/components/settings/sections/McpSection.test.ts > McpSection > 9. createMCPServer 返回裸 {id:7} → activeId 变 7(不是此前选中的项)+ toast aiMcpSrvAddedName + 弹窗关闭 + 重新加载一次
AssertionError: expected 'svc-b' to be 'new-one' // Object.is equality
Expected: "new-one"
Received: "svc-b"

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 52 passed (53)
```
精确报红,且失败原因正是「activeId 仍停在先前选中的 svc-b,双剥壳缺陷下没有
切到新建的服务器」——与 I1 的现实后果描述完全对应。

**还原**(`cp` 覆盖回原文件):
```
 Test Files  2 passed (2)
      Tests  53 passed (53)
```
`git status --short src/ai/components/settings/sections/McpSection.vue` 干净。

---

## I2 —— 占位契约机制(`SettingsPage.vue:113`/`:255` 附近两条分支)无任何用例覆盖

### 为什么新开一个测试文件,而不是塞进 `SettingsPage.test.ts`

`SECTION_COMPONENTS`(`SettingsPage.vue` 内部字面量,`<script setup>` 不导出,
SP8-P2b Task 14 已裁定不为可测性拆出额外 `<script>` 块)与 `DEFERRED_SECTIONS`
(`sections.ts` 导出)是**两个独立机制**,当前代码里没有运行时自动联动——
`SECTION_COMPONENTS` 是写死的 id→组件字面量,不会因为 `DEFERRED_SECTIONS`
数组内容而改变。`SettingsPage.vue` 文件头注释写的「恢复占位行为」步骤,本就是
「把 `SECTION_COMPONENTS` 的映射改回 `SectionPlaceholder`、把 id 加回
`DEFERRED_SECTIONS`」**两处手动改动一起做**。

只 mock `DEFERRED_SECTIONS`(协调者建议的写法 (a))只能驱动 `onSelect()` 的
toast 分支,**驱动不了** `placeholderProps()` 的有效返回分支——因为后者的判据
是 `SECTION_COMPONENTS[id] !== SectionPlaceholder` 这个恒等比较,与
`DEFERRED_SECTIONS` 无关。要在不碰一行生产代码的前提下同时驱动两条分支,
必须同时模拟这两处改动:
1. `vi.mock('../components/settings/sections', …)` 用 `vi.importActual` 保留
   真实导出,只覆盖 `DEFERRED_SECTIONS: ['mcp']`。
2. `vi.mock('../components/settings/sections/McpSection.vue', …)` 把这个模块
   的导入重定向到 `SectionPlaceholder.vue` 本体(`vi.importActual` 拿到的是
   同一个模块单例),让 `SettingsPage.vue` 内部
   `SECTION_COMPONENTS['mcp'] !== SectionPlaceholder` 的判断为假。

这两个 `vi.mock` 是文件级、会作用于该文件里的全部用例,若塞进
`SettingsPage.test.ts` 会连带影响其余 46+ 条依赖真实 `McpSection` 的既有用例。
故新增独立文件 `src/ai/views/SettingsPage.placeholder.test.ts`,不碰
`SettingsPage.test.ts` 一行。

### 改了什么

新增 `src/ai/views/SettingsPage.placeholder.test.ts`(1 条用例):挂载
`SettingsPage`,点击「MCP 连接」导航项,断言:
- 渲染出 `SectionPlaceholder`(页面文本含 `zh.aiCfgPlaceholderBody`)
- `.set-h1` 文本是来源分区自己的导航文案 `zh.aiCfgMcpConnections`(不是空字符串兜底)
- `.set-desc` 文本是 `zh.aiCfgPlaceholderBody`
- `toast.show` 被调用为 `(zh.aiCfgSectionDeferred, 3000)`

### RED→GREEN 证据(两组,分支各自单独破坏)

**探针 A —— `placeholderProps()` 有效分支**:
```diff
-function placeholderProps(id: SectionId): Record<string, string> {
-  if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}
-  const item = ALL_ITEMS.find((i) => i.id === id)
-  return { titleKey: item ? item.labelKey : '', bodyKey: 'aiCfgPlaceholderBody' }
-}
+function placeholderProps(_id: SectionId): Record<string, string> {
+  return {} // RED-PROBE-I2a
+}
```
RED(`vitest run SettingsPage.placeholder.test.ts`):
```
 Test Files  1 failed (1)
      Tests  1 failed (1)
     Errors  2 errors
SyntaxError: Invalid arguments
 ❯ Proxy._sfc_render src/ai/components/settings/SectionPlaceholder.vue:25:29
     25|       <h1 class="set-h1">{{ t(props.titleKey) }}</h1>
```
(`titleKey`/`bodyKey` 变成 `undefined`,`t(undefined)` 直接抛错——精确报红。)
还原后重跑:`Test Files 1 passed (1) / Tests 1 passed (1)`。

**探针 B —— `onSelect()` deferred toast 分支**:
```diff
-  store.setActiveSection(id)
-  // 非 Vue2 蓝本(见文件头说明)—— skills/mcp 本阶段是占位,弹一条提示告知
-  // 用户该分区尚未开放。
-  if (DEFERRED_SECTIONS.includes(id)) {
-    toast.show(t('aiCfgSectionDeferred'), 3000)
-  }
-  suppressSpy = true
+  store.setActiveSection(id) // RED-PROBE-I2b: deferred toast branch removed
+  suppressSpy = true
```
RED:
```
AssertionError: expected "wrappedAction" to be called with arguments: [ '该分区将在后续阶段开启', 3000 ]
Number of calls: 0

 Test Files  1 failed (1)
      Tests  1 failed (1)
```
还原后重跑:`Test Files 1 passed (1) / Tests 1 passed (1)`。

两次探针均只改 `SettingsPage.vue`(用 `cp` 从提前备份的原文件覆盖还原),
`git status --short src/ai/views/SettingsPage.vue` 干净。

---

## M2 —— `SettingsPage.vue` 两处过期注释

- `:30-33`(文件头「新增,非 Vue2 蓝本」段):把「本仓这个分区的真实现要等
  SP8-P4」改写成如实描述——`DEFERRED_SECTIONS` 已清空、`onSelect()` 的 toast
  分支现在不会触发,机制保留供未来复用。
- `:107-117`(`placeholderProps()` 上方):把「占位场景(现仅 mcp)」改写成
  「SP8-P4 起 `SECTION_COMPONENTS` 里不再有任何映射到 `SectionPlaceholder`,
  这条函数的有效返回分支现在不会触发」,同时保留「将来某个 id 改回
  `SectionPlaceholder` 时如何复用」的说明。

两处均已随文重写(非机械替换),内容与当前代码状态一致。

---

## M3 —— 注释里的 `file:line` 错误引用,全支线核对

### 发现并修复的 2 处

| 文件 | 原文 | 应为 | 复核方式 |
|---|---|---|---|
| `src/ai/util/mcpServerVisual.ts:3` | `tokens.scss:235-241` | `tokens.scss:236-242` | `grep -n "grad-sk-" src/ai/styles/tokens.scss`:`--grad-sk-blue` 在 `:236`,`--grad-sk-slate` 在 `:242` |
| `src/ai/types/mcpServer.ts:54` | `` `mc.go:355` `` | `` `mcp.go:355` ``(少打一个 `p`) | 与文件其余处的 `mcp.go` 引用比对,唯一的打字错误 |

两处均已修正,并在注释里加了一句「修复轮 M3」的说明,不做静默改动。

### 核对过、确认无误的引用(逐支线)

- **本仓组件间引用**:`McpSection.vue`(Vue2 `:6,7,13,16,32-34,57-64,60,64,70-82,
  74,75-77,79/93/105/124,86-96,97-108,102,109-128,117,125`)—— 逐行对照
  `NimoOS-UI/src/views/AI/MCP/McpSection.vue`,**全部精确匹配**。
- `McpServerModal.vue`(Vue2 `:123-137,140,141-146,147-153,155-157,159-187,166,
  168-173,174-179,182,188-195,196-198,199-213`)—— 逐行对照 Vue2
  `McpServerModal.vue`,**全部精确匹配**。
- `McpServerGroup.vue`(`skills-styles.scss:61,70,77,95,112,127-170`、
  `mcp-styles.scss:23-30`)—— grep 确认,**全部精确匹配**(`.sk-item` 块
  95-112,`.mcp-transport` 块 23-30)。
- `McpServerDetail.vue`(`skills-styles.scss:351-369`/`:370-376`、
  `sk-shared.scss:50-54`、`AgentIcon.vue:79,88`、`SkillDetail.vue:486-517,
  492,505,507-510`、`tokens.scss:31`)—— 逐行核对,**全部精确匹配**。
- `mcpErrorKey.ts`(`mcp.go:277,282,286`、`mcp.go:152,168,186,332,441`、
  `mcp.go:351`、`mcpparse.go:36,47,62,76,138`、`client.py:437,448,453,456`、
  `apiError.ts:18-20`、`channelsFormat.ts:66-70`)—— 回源
  `NimoOS-AI/route/v2/mcp.go`、`pkg/mcpparse/mcpparse.go`、
  `agent/mcp_client/client.py` 逐行核对,**全部精确匹配**。
- `types/mcpServer.ts` 其余引用(`mcp.go:41-51,53-64,62,96,121,137,172,
  230-269,247-253,273-289`、`mcpparse.go:13-20,39,69,79-82,86`)—— 回源核对,
  **全部精确匹配**(文件自己也已在头注释里申报过一处与设计文档的行号出入,
  经核实其**自身**引用是准确的)。
- `skillsErrorKey.ts:32`(`channelsFormat.ts:66-70`)—— 核对,匹配。
- `agentStore.test.ts:4-19`(vi.hoisted 骨架先例)—— 核对,匹配。
- 共享包引用:`NimoOS-Service/dist/ai.d.ts:85-86`、
  `NimoOS-Service/src/ai.ts:388-391`(及 `:365-397` 范围)—— 回源
  `.sp8/NimoOS-Service` 核对,**全部精确匹配**。

结论:全期新增代码里 `file:line` 形式的注释引用,共发现 **2 处错误**(均已修复),
其余核对到的引用均准确。

---

## M5 —— 取消关闭弹窗后 `editing` 残留(未申报偏离)

### 改了什么

`src/ai/components/settings/sections/McpSection.vue` 的 `watch(modalOpen)`
(此前只清 `saveError`)现在同时清 `editing`:

```ts
watch(modalOpen, (v) => {
  if (!v) {
    saveError.value = ''
    editing.value = null
  }
})
```

新增测试用例 13(`McpSection.test.ts`):编辑弹窗通过 X 按钮(取消路径,非保存)
关闭后,断言传给 `McpServerModal` 的 `server` prop 变为 `null`。

### RED→GREEN 证据

**探针**(把新加的 `editing.value = null` 去掉,只保留清 `saveError`):
```diff
 watch(modalOpen, (v) => {
   if (!v) {
-    saveError.value = ''
-    editing.value = null
+    saveError.value = '' // RED-PROBE-M5: editing.value = null 故意去掉
   }
 })
```
RED(`vitest run McpSection.test.ts`):
```
 FAIL  … > 13. 编辑弹窗取消关闭(X 按钮,非保存路径)→ editing 清空,McpServerModal 的 server prop 变 null
AssertionError: expected { id: 1, name: 'svc-a', …(7) } to be null

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
```
还原后重跑:`Test Files 1 passed (1) / Tests 23 passed (23)`。
`git status --short` 干净。

---

## M7 —— 注释里的色字面量

`src/ai/components/settings/mcp/McpServerDetail.vue` 头注释(:11-21 附近)与
模板内联注释(删除确认弹窗按钮上方,:364-366)里的 `color: white` / `color="white"`
逐字引用全部改写成中文描述(「自带前景色声明,背景取危险语义色 `--danger`、
图标/文字继承该规则块里固定写死的前景色」),不再照抄 CSS 源码里的颜色字面量。
`grep -n "white\|black\|#[0-9a-fA-F]\{3,6\}\|rgba\?(" McpServerDetail.vue` 复核为空。

---

## 三门完整终值

```
pnpm test                  → Test Files 303 passed (303) · Tests 2719 passed (2719) · exit=0
pnpm exec vue-tsc --noEmit → exit=0(无输出)
pnpm build                 → ✓ built in 12.29s · exit=0(仅既有 >500KB chunk / manualChunks 提示,无新增警告)
```

零红项,`persist.test.ts`(既有 IndexedDB flaky)本轮未复现,未触发复跑。
算术核对:基线 302 文件/2717 例 → 本轮 +1 文件(`SettingsPage.placeholder.test.ts`,
不新增 `.vue`,color-guard 动态用例数不变)+2 例(I2 新增 1 例、M5 新增 1 例,
I1 是重写既有用例、不计入新增)= 303 文件/2719 例,与实测完全吻合。

日志落盘:`/tmp/p4-fix-test.log`(exit=0)、`/tmp/p4-fix-tsc.log`(exit=0,空)、
`/tmp/p4-fix-build.log`(exit=0)。

---

## 提交与仓库状态

单一语义提交,改动文件:
```
 src/ai/components/settings/mcp/McpServerDetail.vue        (M7)
 src/ai/components/settings/sections/McpSection.test.ts     (I1 + M5)
 src/ai/components/settings/sections/McpSection.vue         (M5)
 src/ai/types/mcpServer.ts                                  (M3)
 src/ai/util/mcpServerVisual.ts                             (M3)
 src/ai/views/SettingsPage.vue                               (M2)
 src/ai/views/SettingsPage.placeholder.test.ts (新增)        (I2)
```
未涉及后端 / 共享包 / 其它任务文件;未 push;未 rebase/reset/merge。

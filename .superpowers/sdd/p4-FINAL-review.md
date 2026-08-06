# SP8-P4(MCP 分区)整期终审

- 终审者:opus,2026-07-31
- 范围:`7ecd1d3..69af8ed`,11 提交 / 20 文件 / +3445 行
- 方法:**未采信任何实现者报告或单任务评审**。自己打开 Vue2 蓝本逐行对标、自己回后端源、
  自己写脚本做 i18n 逐码点比对与死键/缺键双向审计、自己跑三门、自己设计并执行两次 RED 探针。
- 仓库状态:探针全部精确还原,`git status` 干净(终审全程零提交)。

---

## 0. 总判定

**Ready to merge: With fixes**

产出代码本身正确 —— 逐屏 1:1、D1–D11 全部落地、N1–N5 无一被「顺手修正」、
i18n 零缺键零死键、配色零违规、三门全绿。两条 **Important** 都是**测试覆盖缺口**
(生产代码无缺陷),但都命中本期最该被钉死的两处:D1 的第二处单层取数,
以及用户明示「反转不删」的占位机制。两条都很便宜,建议合并前补。

| 严重度 | 条数 |
|---|---|
| Critical | **0** |
| Important | **2** |
| Minor | **7** |

---

## 1. 我自己实测的三门

```
pnpm test                  → Test Files 302 passed (302) · Tests 2717 passed (2717) · exit=0
pnpm exec vue-tsc --noEmit → exit=0
pnpm build                 → ✓ built in 12.08s · exit=0(仅既有 >500KB chunk / manualChunks 提示)
```

零红项、零 flaky(`persist.test.ts` 与 `AgentComposer.test.ts` 两条已知噪声本次均未复现)。
与台账登记的 **302 / 2717** 完全一致。
`.vue` 计数复核:基线 165 + 本期 4(Group/Detail/Modal/Section)= 169,color-guard 动态用例 +4,算术吻合。

---

## 2. 发现清单

### Important

**I1 — `src/ai/components/settings/sections/McpSection.test.ts:303`(用例 9)对 D1 第 2 处零判别力**

生产代码 `McpSection.vue:194` 的单层取数 `(created as { id?: number })?.id` **写对了**,
但**没有任何用例能抓出它被写回 Vue2 的双剥壳**。

- 用例 9 的 fixture 是「空列表 → 新建 → 列表只有 srv(7)」。带缺陷时 `id` 恒 `undefined`
  → `activeId` 保持 `null` → 随后的 `reload()` 命中 `!activeId.value` 兜底 → `activeId = servers[0].id = 7`
  → 断言 `.sk-name span === 'new-one'` **照样通过**。兜底路径与正确路径在这个 fixture 上重合。
- **RED 探针 A(见 §5)实证:注入 Vue2 双剥壳后 53/53 全绿。**
- 后果不是理论的:后端 `NimoOS-AI/service/mcp.go:63` 是
  `... WHERE user_id=? ORDER BY id`(升序),新建的服务器 id 最大 → **落在列表末尾**。
  只要用户此前已选中任意一台服务器(真实场景的常态),带缺陷时 `reload()` 会保留旧选中项,
  **新建的服务器不会被自动选中** —— 正是设计 §3 表格里 `McpSection.vue:117` 那一行写的后果。
- 修法(≈10 行):fixture 改成「已有 svc-a/svc-b 且当前选中 svc-b → 新建 → 第二次 list 返回
  [a, b, 7] → 断言详情面板切到新建那台」。`createMCPServer` 的 mock 形状 `{id: 7}` 本身是对的,不用动。

**I2 — `src/ai/views/SettingsPage.vue:113` 与 `:255` 的占位机制已成「无人看守」的死代码**

用户明示「反转不删」,代码确实原样留着(`SectionPlaceholder.vue` 未动、`placeholderProps()`
未动、deferred toast 分支未动、`DEFERRED_SECTIONS` 常量仍导出)。但 `DEFERRED_SECTIONS`
清空后,**这两条分支的行为再也没有任何用例经过**:

- `placeholderProps(id)` 的 `SECTION_COMPONENTS[id] === SectionPlaceholder` 为真的那条返回路径 —— 永不执行。
- `onSelect()` 里 `if (DEFERRED_SECTIONS.includes(id)) toast.show(t('aiCfgSectionDeferred'), 3000)` —— 永不执行。
- `sections.test.ts:62-66` 那条「机制仍在」的钉子只断言 `Array.isArray(DEFERRED_SECTIONS)` 与
  元素合法性 —— **钉的是常量的类型,不是机制的行为**。
- **RED 探针 B(见 §5)实证:把这两条分支整段摘除后,`src/ai` 全域 85 文件 / 1403 例全绿。**
- 后果:下一期把某个未完成分区 id 加回 `DEFERRED_SECTIONS` 时,没有任何保证占位仍会渲染、
  toast 仍会弹 —— 甚至可能在此之前就已经被别的改动打断而无人知晓。这与用户「反转不删」的
  意图(保留一个**可用的**机制)是背离的:留下的是代码,不是能力。
- 修法(≈15 行,二选一):
  (a) 在 `SettingsPage.test.ts` 里 `vi.mock('../components/settings/sections', …)` 把
      `DEFERRED_SECTIONS` 打成 `['mcp']`,断言渲染 `SectionPlaceholder` + 弹 `aiCfgSectionDeferred`;
  (b) 或拆一条 `SectionPlaceholder.vue` 的直挂用例 + 一条 `placeholderProps` 的行为用例。
  (a) 更贴近「机制端到端还活着」这件事,推荐。

### Minor

**M2 — `src/ai/views/SettingsPage.vue:30` 与 `:107-112` 注释过期。**
T9 更新了 `SECTION_COMPONENTS` 上方那段注释,但文件头 `:30-32`(「选中 `mcp`(`DEFERRED_SECTIONS`)
时弹一条 info toast ……本仓这个分区的真实现要等 SP8-P4」)与 `placeholderProps` 上方 `:111`
(「占位场景(现仅 mcp)」)仍把 mcp 描述成占位分区,与代码事实相反。与 T2 那条「注释指错行」同科。

**M3 — `src/ai/util/mcpServerVisual.ts:3` 注释引 `tokens.scss:235-241`,实为 `:236-242`。**
(台账 T2 已记账的 deferred minor,我自己 grep 复核属实:`--grad-sk-blue` 在 `:236`,`--grad-sk-slate` 在 `:242`。)

**M4 — `saveError` 的清理无用例。**
`McpSection.vue:94-96` 的 `watch(modalOpen)` 在关闭时清 `saveError`,但 `McpSection.test.ts` 全文
无 `saveError`/`serverError` 断言(只有用例 11 断言它**出现**)。「保存失败 → 关弹窗 → 重开 → 上次报错不残留」
这条无回归网。

**M5 — 取消关闭弹窗后 `editing` 残留(未申报的行为差异)。**
Vue2 `closeModal()`(`:85`)在**任何**关闭路径上都把 `editing` 置 null;本仓 `closeModal()`
(`McpSection.vue:147-150`)只在 `onSave` 成功后被调用,取消 / 遮罩 / Esc 三条路径只走
`v-model:open` → `modalOpen=false`,`editing` 保持旧值。实测无可见后果(`openCreate`/`openEdit`
每次都先重设 `editing`,`onSave` 只有在弹窗开着时才可能被触发),但这是一处**未在任何报告里申报**
的行为差异 —— 按移植纪律「未申报的偏离本身就是缺陷」,记 Minor。

**M6 — 异步 flush 未按公共约束 §9 用 `flushPromises()`。**
`McpSection.test.ts:51` 与 `McpServerModal.test.ts` 用手搓的 `flush = () => nextTick ×3`。
`McpServerDetail.test.ts` 用的是 `flushPromises()`(14 处)。目前全绿,但链式 await 一旦超过 3 层
就会静默假通过。**同一批次里两种写法并存**本身也是不一致。

**M7 — `McpServerDetail.vue` 文件头注释里出现具名色字面量 `color: white`(`:16-17`)。**
是在引证既有 `sk-shared.scss:50-54` 的原文作为「不用传 `color="white"`」的依据。它在 HTML 注释里、
不在 `<style>` 块里,color-guard 扫不到,也不是被渲染的颜色。判定:**作为证据引用可接受**,
但严格按「注释里也不许出现原始色字面量」的纪律,改写成中文描述更干净。仅记录。

**M8(i18n 设计漂移,见 §4.3)—— 4 个键该复用而新造了同值副本。**

---

## 3. D1–D11 / N1–N5 逐条核查结论

### 已授权偏离 D1–D11:**11 条全部做到,三件套(代码注释 + 报告申报 + 台账登记)齐全,无一做过头**

| # | 落点(我自己核过) | 结论 |
|---|---|---|
| D1 | `McpSection.vue:122-123`(`Array.isArray(list) ? list : []`)· `:194`(`(created as {id?:number})?.id`)· `McpServerDetail.vue:134`(`const body = await …testMCPServer(id)`)· `McpServerModal.vue:171`(`await …parseMCPCommand(cmd) as McpParsed`) | ✅ 四处全部单层。共享包 `.sp8/NimoOS-Service/src/ai.ts:367-397` 六个方法**全部 `return res.data`**,我逐个复核过。**但 `:194` 无判别用例 → I1** |
| D2 | `McpSection.vue:21-25` 头注释 + 全文无 `.sk-toast`;失败路径统一 `toast.show(…, 3000, 'danger')` | ✅ |
| D3 | `mcp/` 三件 + `McpSection.vue` grep `SkillIcon` 仅出现在注释里,零 import | ✅ |
| D4 | grep `console.` 仅出现在注释里,零调用 | ✅ |
| D5 | `mcpErrorKey.ts` 四个映射函数;`McpSection.vue:201` / `McpServerModal.vue:189` / `McpServerDetail.vue:136,139` 四个消费点全部经映射 | ✅ 测试里三处 `not.toContain(英文原文)` 强断言 |
| D6 | 表单 `SkModal`(`McpServerModal.vue:239`,未重复包 `.sk-modal-body`/`.right`,`.save-note` 走 `#footerLeft`)· 确认弹窗手拼 reka(`McpServerDetail.vue:350-372`)· **两种并存的理由写在 `McpServerDetail.vue:31-41` 头注释** | ✅ |
| D7 | `McpSection.vue:218` `<AgentIcon name="plus" :size="15" />` 无 `color` | ✅ |
| D8 | `McpServerDetail.vue:323-334`:`✗ {{ t(testView.msgKey) }}` + `<details v-if="testView.detail">`;`mcp-styles.scss` 末尾 `.mcp-test-detail` | ✅ 5 条错误文案 + `aiMcpSrvTestDetail` 双档齐,`error` 字段在 `McpTestView` 类型层面就进不来 |
| D9 | `McpServerDetail.vue:251` `<span class="dot" />` 零属性;`skills-styles.scss:365`/`:375` 两态静态规则实在;注释 `:21-29` 用中文描述颜色,无字面量 | ✅ 零新 token |
| D10 | 6 处全换 token;我逐个 grep 确认 `--teal-soft`/`--purple-soft`/`--success-soft`/`--success-soft-border`/`--danger-soft`/`--danger-soft-border` 在 `tokens.scss` 浅色块(`:129-149`)与暗色块(`:306-316`)**两档都有值**。**新增 token = 0** | ✅ |
| D11 | `McpServerDetail.vue:119` `reqSeq` + `:135`/`:138`/`:141` 三处守卫 + `:171` `watch` 里作废 | ✅ 4 条判别用例(含两条 finally 场景)我读过,时序构造正确 |

### 「照抄、不改」N1–N5:**5 条全部原样照抄,无一被顺手修正**

| # | 我核对的落点 | 结论 |
|---|---|---|
| N1 | `McpServerModal.vue:113-118` `valid`:`name.trim().length === 0 → false`,之后 stdio 判 command / 否则判 url —— 与 Vue2 `:141-146` 逐字同构。**未新增任何前置校验,也未删除** | ✅ 照抄 |
| N2 | `McpServerModal.vue:179-185` else 分支只设 `url`、清 `command`/`argsText`/`env`,**不动 `headers`**;stdio 分支 `:173-178` 才清 `headers` | ✅ 照抄(不对称保留) |
| N3 | `resetForm()` `:140-141` headers/env 恒空数组起步;`submit()` `:224`/`:228` `if (!isEdit.value \|\| Object.keys(x).length)` 逐字;`.mcp-kv-hint` 在 `isEdit && has_*` 时渲染 | ✅ 照抄 |
| N4 | `McpSection.vue:111` `activeServer` 在 `servers.value`(未过滤)上 find | ✅ 照抄,且用例 5 有判别力 |
| N5 | `McpServerModal.vue:122-126` `transports` 三项含 `sse` | ✅ 照抄 |

**清单之外的未申报偏离:找到 1 条 —— M5(取消关闭后 `editing` 残留)。** 其余全支线未见第二条。

---

## 4. 重点核查方向逐项结果

### 4.1 跨任务数据流完整性(自己读代码走通,四条链路)

1. **`reload → servers → filtered/enabled/disabled → McpServerGroup → pick → activeId → activeServer → McpServerDetail`**
   `McpSection.vue:118-135 → :99-111 → :239-252(:active-id/@pick) → McpServerGroup.vue:70,72(emit('pick', s.id)) → :113-115 setActive → :111 activeServer → :266 :server`。
   **无断点。** 类型一致(`emit pick: [id: number]` ↔ `setActive(id: number)`)。
2. **`McpServerDetail` 的 toggle/edit/delete → McpSection 三个处理器 → 列表更新 → 详情重算**
   `McpServerDetail.vue:227 emit('toggle', server.id, !server.enabled)` → `McpSection.vue:267 @toggle="onToggle"` → `:153 onToggle(id, enabledVal)`(两参对齐)→ `:157 splice` 触发 `filtered/enabled/disabled/activeServer` 全链重算。
   `emit('edit', s)`(对象)→ `openEdit(server: McpServer)`;`emit('delete', s.id)`(number)→ `onDelete(id: number)`。**签名三条全对。**
3. **`+`/`edit → McpServerModal 的 open+server → save → onSave → create/update → reload`**
   `openCreate/openEdit` 同一函数体内先设 `editing` 再设 `modalOpen`,子组件 `watch(() => props.open)` 在父组件重渲染之后才触发,故 `resetForm()` 读到的必是**新的** `props.server` —— T9 追加的两条集成用例正是钉这条时序,我推演后确认结论成立。**无断点。**
4. **`runTest → testMCPServer → toTestView/toTestViewFromError → McpTestView → 模板 → t(msgKey)`**
   `McpServerDetail.vue:134 → :136/:139 → :315-335`。`McpTestView` 是判别联合类型,`ok:true` 分支根本没有 `msgKey`/`detail` 字段,`ok:false` 分支根本没有 `tools` —— **类型层面就堵死了「后端 error 原文进模板」这条路**。`t(testView.msgKey)` 的 msgKey 只可能是 `mcpErrorKey.ts` 里那 7 个字面量之一(我全量列过,见 §4.2)。**无断点。**

### 4.2 i18n 死键 / 缺键双向审计(脚本,不靠肉眼)

我写脚本把 `src/` 全域走了一遍:

- **缺键方向**:MCP 相关源文件里所有 `t('literal')` + `msgKey:` + `descKey:` + `mcpErrorKey.ts` 的所有 `return 'ai…'`,
  **合计 139 个不同键,在 `zh_cn.ts` 与 `en_us.ts` 两档里全部存在,零缺失。**
  (脚本唯一报的 `Off` 是把 `McpServerGroup.vue:10` 注释里引用的 Vue2 原文 `$t('Off')` 当成了调用,人工确认为误报。)
  `mcpErrorKey.ts` 返回的全部 11 个键 + 7 个 `msgKey` 我逐个核过,全在。
- **死键方向**:本期新增 76 个 `aiMcpSrv*` 键,**零死键** —— 每一个在非语言包源文件里都有真实消费方
  (不含测试也全部有生产消费方)。
- **两档一致性**:`zh_cn.ts` 1207 键 / `en_us.ts` 1207 键,**去重后仍是 1207 = 1207,零重复定义,零单边键。**

### 4.3 单层取数五个消费点 + mock 形状

| 消费点 | 实现 | 测试 mock 形状 | 判别力 |
|---|---|---|---|
| list | `McpSection.vue:122` | 裸数组 `[srv(1), srv(2)]` ✅ | ✅ 双剥壳 → 0 条目 → 用例 1 红 |
| create | `McpSection.vue:193-194` | **`{ id: 7 }`(非完整对象)✅ 形状正确** | ❌ **无判别力 → I1** |
| update | `McpSection.vue:155,190` | `undefined`(204)✅ | ✅ 不读返回值 |
| delete | `McpSection.vue:169` | `undefined`(204)✅ | ✅ |
| test | `McpServerDetail.vue:134` | 裸对象 `{ok:true,tool_count,tools}` ✅ | ✅ 双剥壳 → `data-ok='false'` → 红 |
| parse | `McpServerModal.vue:171` | 裸 `Parsed` 对象 ✅ | ✅(T8 评审已探针实证) |

「同一方法在两个文件里被 mock 成不同形状」的 red flag:**未发现** ——
`McpSection.test.ts` / `SettingsPage.test.ts` 的 `listMCPServers` 都是裸数组语义,
`McpServerDetail.test.ts` / `McpServerModal.test.ts` 各自只 mock 自己那一个方法,形状互相一致。

我也回权威源逐条复核了后端契约(**不信计划抄的行号**):

```
mcp.go:96   c.JSON(200, out)                       // 裸数组
mcp.go:121  c.JSON(201, map[string]int64{"id":…})   // 不是完整对象 ✅
mcp.go:172  c.NoContent(204)  / :190 c.NoContent(204)
mcp.go:351  c.JSON(502, {"ok":false,"error":"agent unreachable"})
mcp.go:355  c.JSONBlob(200, body)                  // 原样透传 Python
mcp.go:277/282/286  三条 400 串                     // 与 mcpErrorKey.ts:43-45 逐字相同 ✅
mcp.go:152,168,186,332,441  五处 "mcp server not found" // 注释写的五处,实测五处 ✅
mcpparse.go:36,47,62,76,138  五条 400 串            // 与 :57-61 逐字相同 ✅
client.py:437,448,453,456    四个 error_key         // 与 :89-92 逐字相同 ✅
service/mcp.go:63  ORDER BY id                      // 新建落末尾 → I1 的现实后果
ai.ts:367-397  六个方法全部 return res.data;
               parseMCPCommand 发 { command_line }  // 与后端 Parse 的 bind 结构一致 ✅
```

**共享包与后端本期零改动的前提成立。**

### 4.4 配色全支线审计

- `git diff 7ecd1d3..69af8ed` 新增行 grep `#hex` / `rgba?()` / `hsla?()` / 25 个具名色:
  命中项**逐条定性后无一违规** —— `white-space`(属性名)· `PALETTE = ['blue','purple',…]`
  (色板 **id**,映射到 `--grad-sk-*` token,Vue2 逐字)· `color="var(--text-tertiary)"`(token)·
  三处注释里的 `color: white` 引证(M7,非 `<style>` 块)。
- **`mcp-styles.scss` 139 行逐行人肉扫(无守卫)**:**零色字面量,注释行也零** ——
  D10 的 6 处全部改写成「原为青色约 14% 透明度 → var(--teal-soft)」这类中文描述。
  新增的 `.mcp-test-detail` 块全部走 token(`--text-tertiary`/`--bg-sunken`/`--line-faint`/`--text-secondary`)。
- 6 个 D10 token 在浅色(`:129-149`)与 `[data-theme="dark"]`(`:306-316`)两档均有值;
  `--teal`/`--purple` 只在浅色块 —— 系**既有的、有注释说明的主题不变色**(`tokens.scss:145-146`),非本期引入。
- 四个新 `.vue` 均**零 `<style>` 块**;我 grep 确认用到的每个 `.sk-*` / `.mcp-*` 类都真实存在
  (含 `.sk-modal-foot .right { margin-left: auto }` 确在 `sk-shared.scss:149` —— 故 `McpServerDetail`
  省掉 Vue2 `:119` 的内联 `margin-left:auto` 是正确的,不是遗漏)。
  唯一无 CSS 规则的类是 `.mcp-quickadd` —— **Vue2 原文就没有**,照抄正确,已在组件注释里申报。

### 4.5 i18n 逐码点复核(脚本,不用肉眼)

我独立建了 62 条「新键 → Vue2 英文原文」映射表(从 Vue2 四个 `.vue` 的 `$t(...)` 逐个抄出),
再对 `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` 做**逐 Unicode 码点**比对:

```
mapped keys: 62
ZH mismatches: 0    missing vue2 entries: 0
EN mismatches: 0    (4 条 en_US.json 无条目 → 落 key 字面量,与设计 §7.2 一致:
                     Update failed / Added {name} / optional / Saved locally on this NAS)
```

复用的 9 个既有键(`aiCfgRefresh`/`Save`/`Saving…`/`Saved`/`Save failed`/`Delete failed`/`Enabled`/
`aiCancel`/`aiSkOff`)也逐条对 Vue2 两档比对:**ZH 全 OK,EN 全 OK。**
14 条本期新文案(D5/D8 产物)对设计 §5.3 与计划核对,无 Vue2 对应物,合理。

**M8(Minor)** —— 设计 §7.2 点名「值完全相同的优先复用既有 AI 域键」的 13 个键里,有 **4 个没被复用**,
反而新造了**逐字节同值**的副本:

| 新造键 | 值(zh / en) | 设计要求复用的既有键 | 实测既有键的值 |
|---|---|---|---|
| `aiMcpSrvUpdateFailed` | 更新失败 / Update failed | `aiSkUpdateFailed` | **完全相同** |
| `aiMcpSrvStatus` | 状态 / Status | `aiSkStatus` | **完全相同** |
| `aiMcpSrvOptional` | 可选 / optional | `aiSkOptional` | **完全相同** |
| `aiMcpSrvName` | 名称 / Name | `aiSkFieldName` | **完全相同** |

根因在协调者侧:**计划 §4.1 把设计的 13 条复用清单缩成了 8 条**,实现者照计划做。
公共约束开篇写着「本文件与设计文档冲突时,以设计文档为准」,但计划与设计的这处不一致没人比对过。
**零用户可见影响**(值完全相同),后果只是键集膨胀 + 一处从未被申报的设计偏离。
**triage:留**(改 4 个键要动 4 个文件、换 6 处调用点,收益为零),但**必须在台账登记为
「设计 §7.2 → 计划 §4.1 的复用清单丢失 5 条」**,免得下一期照着计划再来一遍。

### 4.6 测试质量整体扫

- **空转用例**:未发现。我抽查的每一条都能指到对应生产行。
- **弱断言**:`not.toBeNull()` 出现 12 处,**逐处检查后全部紧跟强断言**
  (`err.textContent).toBe(zh.…)` / `getAttribute('role')` / `.not.toContain(英文原文)`),
  无「只断言存在」的裸弱断言。P3b 验收补丁 A1 那类事故未复现。
- **单元素数组上的 `.some`/`.every`**:零处(全支线 grep 无命中)。
- **「A 与 B 二选一」只测一边**:未发现。逐对核过 ——
  toggle 开/关(6a/6b)· 删除命中/未命中选中项(8a/8b)· 新增/编辑(9/10)· 搜索 name/url(4a/4b)·
  两种空态(4c/4d)· D11 切走/未切走 · detail 有/无 · finally 守卫成功/抛错 · Group 的
  active 命中/未命中、启用/停用 —— **全部成对**。`McpServerGroup.test.ts` 特意用两元素数组做判别,写法正确。
- **异步**:`McpServerDetail.test.ts` 用 `flushPromises()`(14 处,合规);
  `McpSection.test.ts` / `McpServerModal.test.ts` 用手搓的 3× `nextTick`(**M6**)。
- **既有断言未被削弱/删除**:我用 `git show 9e5b481:` 取原文逐条比对了 T9 的三处反转,
  确认是**反转不是删除**;唯一整段删掉的是 `SettingsPage.test.ts` 里 `deferred: SectionId[] = ['mcp']`
  的循环 —— 空数组循环体确实永不执行,删除本身没问题,但机制钉子转移得不够(**I2**)。

### 4.7 占位契约反转

- `SectionPlaceholder.vue` 文件**零改动** ✅
- `placeholderProps()` **原样保留** ✅
- deferred info toast 分支 **原样保留** ✅
- `DEFERRED_SECTIONS` 常量 **仍导出、仍是 `SectionId[]`** ✅
- **但机制的行为已无任何用例覆盖 → I2**(RED 探针 B 实证)。
- 顺带:`aiCfgSectionDeferred` 与 `aiCfgPlaceholderBody` 两个键在源码里仍被引用,不算死键,
  但运行时已不可达 —— 属于 I2 的同一件事。

### 4.8 与设计文档 §1–§9 逐节对账

| 节 | 要求 | 落点 | 结论 |
|---|---|---|---|
| §1 | 移植 5 个 Vue2 文件 679 行;`DEFERRED_SECTIONS` 清空 | 8 源 + 6 测试 + 4 改动文件 | ✅ 全覆盖,无遗漏文件 |
| §2 | 后端契约 6 个端点 | §4.3 已逐条回源复核 | ✅ 一致 |
| §3 | 四处多剥一层 | 四处全部单层 | ✅(测试缺口见 I1) |
| §4.1 | 文件落点表 | 逐个存在,路径逐字吻合 | ✅ |
| §4.2 | 只新写 18 个 `.mcp-*` 类,零新造外壳 | `mcp-styles.scss` 实为 18 + `.mcp-test-detail`(D8 授权) | ✅ |
| §4.3 | 两种弹窗外壳 + `to=".set-app"` | `McpServerDetail.vue:351` / `SkModal` 内部 | ✅ 两处都在 |
| §5.1 | `filtered` 只搜 name/url · `activeServer` 查未过滤 · 四个数据方法 | 逐条对上 | ✅ |
| §5.2 | 4 格元信息(Headers 仅 non-stdio)· 配置区二选一 · mousedown 外部点击 · watch 重置 | 逐条对上,`v-if="server.transport !== 'stdio'"` 在 `:259` | ✅ |
| §5.3 | 三态 + 90s 提示 + 6 条错误映射 + `<details>` | 映射表 6 条我逐条对 `mcpErrorKey.ts` 核过,全中 | ✅ |
| §5.4 | 三段表单 · `valid` · KV 编辑器 · 编辑态提示 · 快速粘贴 · focus | 逐条对上 | ✅ |
| §6 | D1–D11 + N1–N5 | §3 已逐条核 | ✅ |
| §7 | 前缀 `aiMcpSrv*` · 逐字取值 · 双档同增 · `{'@'}` | §4.5 已脚本核;`messageSyntax.test.ts` 全绿 | ✅ 除 M8 |
| §8 | 新增测试 + mock 纪律 + 占位反转 + 三门 | §4.6/§4.7/§1 | ✅ 除 I1/I2 |
| §9 | 10 条人眼验收清单 | 属真机验收范畴,本次终审不覆盖 | — |

**没有整节被漏掉。**

---

## 5. 我自己的两次 RED 探针(独立设计,非复述)

### 探针 A —— D1 第 2 处(`createMCPServer` 单层取数)

**破坏**(`src/ai/components/settings/sections/McpSection.vue:194`):
```diff
-      const id = (created as { id?: number } | undefined)?.id
+      const id = (created as { data?: { id?: number } } | undefined)?.data?.id // RED-PROBE
```
即把 Vue2 `:117` 的双剥壳原样搬回来。

**结果**:
```
pnpm exec vitest run src/ai/components/settings/sections/McpSection.test.ts src/ai/views/SettingsPage.test.ts
 Test Files  2 passed (2)
      Tests  53 passed (53)
```
**全绿 —— 假设成立,该处零判别力。** → **I1**

**还原**:从备份覆盖回原文件,`git status --short` 空、`git diff --stat` 空 → `RESTORED-CLEAN`。

### 探针 B —— 占位机制是否还被钉住

**破坏**(`src/ai/views/SettingsPage.vue`):把 `placeholderProps()` 的 populated 返回路径整段摘除
(改为无条件 `return {}`),并把 `onSelect()` 里的 `if (DEFERRED_SECTIONS.includes(id)) toast.show(…)`
整段摘除。

**结果**:
```
pnpm exec vitest run src/ai
 Test Files  85 passed (85)
      Tests  1403 passed (1403)
```
**全绿 —— 机制的行为确实已无任何用例覆盖。** → **I2**

**还原**:从备份覆盖回原文件,`git status --short` 空 → `RESTORED-CLEAN`。

> 两次探针均只改生产代码、未改测试、未提交任何东西。终审结束时 `git status` 干净,`HEAD` 仍是 `69af8ed`。

---

## 6. 台账三条 deferred minor 的 triage

| 台账条目 | 我的复核 | triage |
|---|---|---|
| **T2**:`mcpServerVisual.ts:3` 注释引 `tokens.scss:235-241`,实为 `:236-242` | 属实(`--grad-sk-blue` 在 `:236`,`--grad-sk-slate` 在 `:242`) | **可以留**。纯注释,零行为影响。若开修复轮,与 **M2**(`SettingsPage.vue` 两处过期注释)打包成一次「注释扫尾」一起收,不值得单开 |
| **T3**:`toTestView` 无显式数组 body 用例;成功路径 `Array.isArray(b.tools)` 无非数组反例 | 我自己推演了构造安全性:数组 body → `typeof 'object'` 为真 → `b.ok` 为 `undefined` → 落 `switch` 的 `default` → `{ok:false, msgKey:'aiMcpSrvTestFailed', detail:''}`,**无泄漏、不抛异常**;`tools: 'abc'` → `Array.isArray` 假 → `[]`。两条都是**构造上不可能出错** | **可以留**。`toTestViewFromError` 那边已有数组/裸串两条边界用例(`:105`),同一取值链已被钉过一遍 |
| **T6**:`sk-shared.scss:52` 的 `.sk-btn.danger { color: white }` | 属实,且确认是 **P2b 就存在的存量**,`git log` 上非本期引入 | **可以留**。归入设计 §10 已登记的「color-guard 不扫 `.scss` / 不认具名色 —— 建议独立一期收口」那笔账(P2a/P3a 已两次登记),本期不顺手改 |

---

## 7. 建议的合并前动作(按性价比排序)

1. **补 I1 的判别用例**(≈10 行,`McpSection.test.ts`)—— 本期最该被钉死的两条 D1 之一,现在裸着。
2. **补 I2 的机制用例**(≈15 行,`SettingsPage.test.ts` 用 `vi.mock` 注入 `DEFERRED_SECTIONS: ['mcp']`)
   —— 用户明示要留的机制,得留成「能力」而不是「代码」。
3. (可选,同一轮顺手)M2 + M3 两处过期注释;M4 的 `saveError` 清理用例;M5 在台账补登记。

M6 / M7 / M8 建议只登记不改。

---

## 8. 一句话结论

**这一期做得很扎实** —— 679 行 Vue2 逐屏 1:1、11 条授权偏离全部按三件套落地、5 条「照抄不改」
无一被顺手修正、i18n 62 条逐码点零误差且零死键零缺键、`mcp-styles.scss` 在没有回归网的情况下
配色零违规、三门 302/2717 全绿。**没有 Critical。**
两条 Important 都不是「代码写错了」,而是「写对了但没人看着」——
恰好落在 D1 的第二处和用户明示保留的占位机制上,补两段测试即可关账。

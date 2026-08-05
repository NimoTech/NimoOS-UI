# SP8-P4 Task 8 评审 —— `McpServerModal.vue`

评审者:独立评审(sonnet),未采信实现者报告,自行对照 Vue2 蓝本、grep 类名、跑测试、独立 RED 探针。

## 判定

1. **规范符合(Spec):✅**
2. **任务质量(Quality):通过**

## 方法与证据

### ① Vue2 蓝本逐行对标
逐行读 `NimoOS-UI/src/views/AI/MCP/McpServerModal.vue`(216 行)与
`.sp8/NimoOS-New-UI/src/ai/components/settings/mcp/McpServerModal.vue`(374 行)对照:
- 快速添加区 `v-if="!isEdit"`、三个 `.sk-trig-option` 顺序/文案(HTTP/SSE/STDIO)、
  `data-f`/`data-kv`/`data-kvk`/`data-kvv`/`data-add` 属性、URL/headers 的 `v-if="transport !== 'stdio'"`
  与 command/args/env 的 `v-if="transport === 'stdio'"`(未写反)、`argsText` 的 `&#10;` placeholder、
  内联 `style="font-family: var(--font-mono); font-size: 12.5px"` 与
  `style="grid-template-columns: repeat(3, 1fr)"`(尺寸/字体,非颜色)——逐条比对,均一致。
- `valid`/`transports`/`collect`/`parseArgs`/`submit`/`parsePaste` 五个方法逐字对照,行为一致
  (含 `submit()` 里 `if (!isEdit || Object.keys(x).length)` 的条件包裹逐字照抄)。
- `nextTick`(New-UI 用 `setTimeout(fn,0)`)后 focus 名称输入框保留。

### ② SkModal 接法
读 `SkModal.vue`:自带 `.sk-modal-head`/`.sk-modal-body`/`.sk-modal-foot`(含 `.right` 包裹 `#footer`),
`DialogPortal :to="props.portalTo"` 默认值 `.set-app`。McpServerModal 未重复包 `.sk-modal-body`/`.right`,
未传 `portalTo`(用默认 `.set-app`),与 `AddSkillModal.vue` 先例一致,无 P3b 那类 padding 叠加问题。

### ③ N1/N2/N3 核对(公共约束 §3.5)
- **N1**:`valid` computed 逐字要求 `name.trim().length>0`,组件头注释 + `valid` 上方注释均声明「照抄不改」,
  代码里**未新增任何前置校验**。✅ 照抄确认。
- **N2**:`parsePaste()` else(non-stdio)分支只清 `url`/`command`/`argsText`/`env`,**不清 `headers`**;
  stdio 分支清 `headers`。逐字对齐 Vue2 `:168-179`。✅ 照抄确认。
- **N3**:`headers`/`env` 两个 ref 无论新增/编辑态均从 `[]` 起步(`resetForm()` 里),不回填 `has_headers`/`has_env`
  的明文(后端也从不下发);`.mcp-kv-hint` 在编辑态且 `has_headers`/`has_env` 为真时显示。✅ 照抄确认。

### ④ 单层取数(D1)
`parsePaste()` 直接 `const p = await service.ai.parseMCPCommand(cmd) as McpParsed`,未剥 `.data`。
读 `.sp8/NimoOS-Service/src/ai.ts` 确认 `parseMCPCommand` 已 `return res.data`(单层)。✅ 一致。
用独立 RED 探针复现了这条钉子的判别力(见下)。

### ⑤ `submit()` payload 形状
stdio:`{name, transport:'stdio', enabled, command, args, env?}`;non-stdio:`{name, transport, enabled, url, headers?}`。
`args` 走 `parseArgs()`(split '\n' + trim + 过滤空行);`collect()` 丢弃空 key。
`if (!isEdit.value || Object.keys(e/h).length) payload.env/headers = e/h` 逐字对应 Vue2 `:206,210`,
对应后端 `applyReq` 只覆盖出现字段的语义,逻辑正确。

### ⑥ `watch(open)` true 分支复位——独立推演
实现选择在 `watch(open)` 的 **true** 分支里 `resetForm()`(而非 `AddSkillModal` 的 false 分支),因为本组件需要
「编辑态从 `props.server` 回填」。推演三个场景:
- **关闭后残留**:`open` 变 false 时不复位,字段保留上次内容;但下次 **任何** 打开(新增或编辑任意服务器)都会在
  `resetForm()` 里被 `props.server` 的当前值整体覆盖(新增态清空、编辑态回填),不会露出残留——因为 Vue 默认
  `watch` flush 是 `pre`(在组件重新渲染之前跑),`resetForm()` 在 DOM 反映 `open=true` 之前就已执行完毕,视觉上
  不会有一帧残留。
- **连续「编辑 A → 关 → 编辑 B」串数据**:只要父组件在同一个事件处理函数里同步设置 `server=B` 和 `open=true`
  (Vue 3 响应式赋值同步生效,watch 回调读到的是执行时刻的 `props.server`),`resetForm()` 执行时 `props.server`
  已经是 B,不会读到 A 的残留。若父组件是**先开后设 server**(两次独立赋值分属两个 tick)才会有风险,但那属于
  T9(McpSection)消费方的实现责任,不是本组件缺陷;T9 评审时需要复核父组件的调用时序。
- **「新增 → 关 → 编辑」带残留**:同上,`resetForm()` 在编辑态会显式回填 `s.name`/`s.transport`/... 全部字段,
  新增态残留的输入不会漏进编辑态表单。
结论:此适配在当前组件自身职责范围内是**自洽且正确**的,是对 `AddSkillModal` 模式的合理必要变体(该模式本身
就是"常驻实例 + watch(open) 做状态管理"),不构成缺陷;唯一的边界条件(父组件是否总是同步设置 `server`+`open`)
留给 T9 复核,已在此记录供协调者与 T9 评审参考。测试�covers `open` 真→假→真复位(用例16),但未覆盖「编辑 A→关→
编辑 B」这一具体切换场景(该场景本质属于 T9 集成测试范畴,非本组件单测的职责边界)——**Minor**,建议 T9 补一条
父子集成用例验证这个时序假设成立。

### ⑦ CSS 类 grep 证据(独立复核)
`.sk-field-err`(`sk-shared.scss:169`)、`.mcp-kv`/`.mcp-kv-row`/`.mcp-kv-del`/`.mcp-kv-add`/`.mcp-kv-hint`/
`.mcp-args`(`mcp-styles.scss:48-78`)、`.mcp-quickadd-row`/`.mcp-quickadd-err`(`mcp-styles.scss:136-139`)
均存在。`.mcp-quickadd`(裸类,Vue2 `:9` 挂载但从无对应规则)确认 `mcp-styles.scss` 中无 `.mcp-quickadd {` 规则
——照抄 Vue2 原状,不是缺陷。

### ⑧ 测试质量(16 条覆盖点 + 附加)
16 条覆盖点全部命中,逐条核对用例内容与断言,均有意义(非空转、非弱断言);`A/B 二选一`分支均有两侧对照
(1a/1b、2a/2b、4a/4b、8a/8b、9a/9b、12a/12b)。mock 用 `vi.hoisted()`,裸对象骨架(无 `{data:…}`)。
Teleport 挂载后 `await macroFlush()`(含 nextTick + 真实宏任务),`.set-app` 目标在 `beforeEach` 里备好。
异步用 `flush()`(连续 3 次 `nextTick`),未见单个 `nextTick` 冒充异步完成的情况。

### ⑨ 接口契约
`props: { open, server, saving, serverError }`,`emits: update:open / save` —— 与 brief 签名一致。

## 三门(自己实测)

```
pnpm test                   → exit=0,Test Files 301 passed (301) / Tests 2693 passed (2693)
pnpm exec vue-tsc --noEmit  → exit=0(空输出)
pnpm build                  → exit=0,仅既有第三方包 + >500KB chunk 警告,无新增
```
算术核对:T1-T7 后基线 300 个测试文件(公共约束基线 296 + T5/T6/T7 各 +1 `.vue` = 299,另有一条
T3 评审修复提交未新增 `.vue`,故 T7 后为 299;此说法与本任务报告的 299 推导略有出入但**结论一致**
——独立验证:当前 `find src -name '*.vue' | wc -l` = 168,当前测试文件总数 301 = 本任务新增
`McpServerModal.vue`(+1 color-guard 用例)+ `McpServerModal.test.ts`(+1 测试文件本身)。与实测
`301 passed (301)` 吻合,算术闭合。

## RED 探针(独立于实现者的探针,针对 D1 单层取数钉子)

**破坏**:把 `parsePaste()` 里的单层取数改回 Vue2 式的双剥 `.data`:
```ts
const resp = await service.ai.parseMCPCommand(cmd) as unknown as { data?: McpParsed }
const p = (resp && resp.data) || ({} as McpParsed)
```

**RED 输出**(节选):
```
Test Files  1 failed (1)
     Tests  3 failed | 27 passed (30)
 × 10. 快速粘贴(单层取数):裸 Parsed 返回,填充后传输切 stdio、command/args/env/名称都填上
 × 11. 快速粘贴解析成 http:url 填上,command/args/env 清空
 × 12a. 名称为空时,快速粘贴的 suggested_name 会填入
```
精确命中覆盖点 10/11/12a(单层取数相关的三条),其余 27 条不受影响,判别力确认。

**还原**:改回单层取数写法后 `git status --short` 为空(干净),重跑 `McpServerModal.test.ts` 30/30 全绿。

## 发现清单

- **Minor**:T9(McpSection 集成)未做前不能完全验证「编辑 A → 关 → 编辑 B」跨服务器切换时父组件是否总是
  同步更新 `server` 与 `open` 两个 prop——本组件自身逻辑自洽,但这个时序假设的正确性依赖消费方实现,建议
  T9 报告/评审里显式确认或补一条集成用例。不影响本任务判定。

无 Critical / Important 发现。N1/N2/N3 均确认照抄未被"顺手修正"。接口签名、单层取数、CSS 类、i18n 键
(zh_cn/en_us 双档齐全,标点逐字核对`Leave blank to keep current; filling in replaces all.`→
`留空保持不变;填写则覆盖全部。`与 Vue2 生产语言包一致)均无问题。提交只含 2 个任务文件
(`git show --stat HEAD` 确认)。

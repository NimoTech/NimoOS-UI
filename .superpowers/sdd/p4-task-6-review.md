# SP8-P4 Task 6 评审 —— `McpServerDetail.vue`(不含测试连接)

评审者:独立评审(sonnet),未采信实现者报告,逐项自查。

## 判定

1. **规范符合(Spec)**:✅
2. **任务质量(Quality)**:通过

## 方法与证据

### ① 蓝本逐行对标

对照 `NimoOS-UI/src/views/AI/MCP/McpServerDetail.vue`(174 行)`:1-157` 与
`src/ai/components/settings/mcp/McpServerDetail.vue` 逐行核对:
- 空态(`:2-11`)DOM 层级、class(`sk-detail-empty`/`orb`/`empty-title`/`empty-sub`)一致。
- 顶栏(`:13-27`):`SkillTile` props(`color`/`icon`/`size=28`/`radius=8`)逐字一致;
  `.sw` 的 `role`/`aria-checked`/`data-on`/click emit 逐字一致;更多菜单结构
  (`menuWrap` → `.sk-pill-more` → `.sk-menu`,编辑项在前、`<hr>`、`data-danger="true"`
  的移除项在后)顺序与 Vue2 完全一致。
- 元信息 4 格(`:32-44`):`v-if="server.transport !== 'stdio'"` 精确保留在「请求头」格,
  条件方向未写反(用 4a/4b 两次挂载核对,分别断言 3 格/4 格且 label 顺序一致)。
- 配置区(`:56-85`)按 transport 二选一,字段顺序(stdio:命令/参数/环境变量;非
  stdio:端点 URL/请求头/环境变量)与 Vue2 一致;`(server.args || []).join(' ') ||
  t('aiMcpSrvNone')` 的 nil 防御原样保留(未被「后端保证非空」为由删除)。
- 删除确认(`:112-125`)与 `SkillDetail.vue:486-517` 逐字同构:`DialogRoot`/
  `DialogPortal to=".set-app" defer`/`DialogOverlay(.sk-modal-bg)`/
  `DialogContent(.sk-modal.sk-confirm)`/`VisuallyHidden+DialogTitle`,按钮组
  (ghost 取消 / danger 移除)一致。
- T7 落点注释三处核对:①`.sk-section-head` 内(紧跟 `.sk-section-hint` 之后)②
  `.sk-section-body` 内、`.mcp-config` 块**之后**(仍在 section-body 容器内)③
  `watch(() => props.server?.id)` 回调内、`menuOpen`/`confirmOpen` 重置之后。三处
  均落在语义正确位置,不会让 T7 插错地方。

### ② 偏离 D9 核对

Vue2 `:36-37` 内联 `:style` 整段删除,只留 `:data-disabled`;`grep` 确认
`skills-styles.scss:365`(`.sk-meta-cell .val .dot` 基础态)与 `:370-376`
(`.val[data-disabled="true"] .dot` 停用态覆写)存在,DOM 层级
`.sk-meta-cell > .val[data-disabled] > .dot`(零属性)与选择器精确匹配。文件头
注释未写出 Vue2 原始色字面量(改写成中文语义描述)。

### ③ 删除确认弹窗与外部点击关菜单

与 `SkillDetail.vue:486-517` 逐项对照,`DialogPortal to=".set-app"` 存在;无障碍
标题用 `VisuallyHidden + DialogTitle` 同款先例。外部点击关菜单只监听
`mousedown`(未监听 `click`,未加 Esc),`onBeforeUnmount` 有兜底移除,`watch`
条件式挂载与 Vue2 `:143-153` 等价。**未发现顺手加 Esc/click 监听的未申报偏离**。

### ④ CSS 类核对

`grep` 确认本组件用到的每个类(`sk-detail*`/`sk-name`/`sk-meta-*`/`sk-section*`/
`sk-menu`/`sk-pill-more`/`sk-confirm*`/`sw`/`sk-modal*`/`sk-btn`/`mcp-config*`/
`mcp-code`)均真实存在于 `skills-styles.scss`/`sk-shared.scss`/`mcp-styles.scss`,
无凭空造的类。零 `<style>` 块。

### ⑤ 接口契约

`props: { server: McpServer | null }`;`emits: toggle(id:number, enabled:boolean) /
edit(server: McpServer) / delete(id:number)` —— 与任务书 `Produces` 逐字一致。

### ⑥ i18n 值核对

对本文件用到的 25 个键逐一 `grep` 双档存在,并抽样把中文值与 Vue2 生产语言包
`NimoOS-UI/src/assets/lang/zh_CN.json` 逐字比对(`Pick an MCP server on the
left`/`Or add one to...`/`Remove this MCP server?`/`Nimo will disconnect from
{name}...`/`Configured (hidden)` 等),标点(`,`/`。`/`(隐藏)` 括号)与省略号均
逐字符相符,未发现改写。

### ⑦ D3 (`color="white"` 不传)核对

`grep` 确认 `sk-shared.scss:50-54` 的 `.sk-btn.danger { color: white; ... }`
确实存在且供色,`AgentIcon` 默认 `currentColor` 会继承。此 `color: white` 字面量
属既有代码(非本任务引入),按评审要求记账为 Minor(existing,非本任务缺陷)。

### ⑧ 测试判别力

10 条覆盖点逐条对应独立用例(含 3a/3b、4a/4b、5a/5b、6a/6b、7a/7b、8a-8d、
9a-9c、10a/10b 的正反两面对照,均齐全)。5a/5b 断言 `.dot` 的 `style` 属性为
`undefined`(精确钉住 D9,不是弱断言)。9a 用 `.not.toBeNull()` 但紧跟
`.closest('.set-app')).toBe(host)` 的强断言,组合起来是精确判别,不属于孤立弱
断言。Teleport 测试均 `await flush()`(`flushPromises` + `nextTick`)后再查
`document`,`.set-app` 宿主由 `withHost()` 在 `beforeEach` 备好。未发现空转用例
(抽查删除 `v-if` 条件后即报红,见下方 RED 探针)。

### RED 探针(独立设计,非复述实现者的)

破坏对象:外部点击关菜单的判断逻辑 —— 把
`if (w && !w.contains(e.target as Node)) menuOpen.value = false`
改成
`if (w) menuOpen.value = false`
(即让"菜单内 mousedown"也会关闭菜单,验证 8d 这条对照用例是否真的在把关"只在外部
关闭"这件事)。

**破坏后(RED)**:
```
 FAIL  src/ai/components/settings/mcp/McpServerDetail.test.ts > McpServerDetail > 8d. 对照:菜单内 mousedown 不关闭菜单
AssertionError: expected false to be true // Object.is equality
 ❯ src/ai/components/settings/mcp/McpServerDetail.test.ts:203:41
   expect(w.find('.sk-menu').exists()).toBe(true)
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```
精确命中用例 `8d`,其余 20 例不受影响。

**已还原**:改回 `!w.contains(e.target as Node)` 判断后复跑:
```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```
`git status --porcelain` 输出为空,工作区干净。

（另外验证了实现者报告里的 RED 探针——把 `v-if="server.transport !== 'stdio'"`
移除——同样精确命中用例 `4a`,已交叉核实,不重复贴。）

### 提交范围

`git show --stat HEAD`(`b9ac9e1`)只含
`src/ai/components/settings/mcp/McpServerDetail.vue` 与
`McpServerDetail.test.ts` 两个新文件,无越界改动。

## 自己实测的三门数字

```
pnpm test                   → Test Files  300 passed (300)  Tests  2649 passed (2649)  exit=0
pnpm exec vue-tsc --noEmit  → exit=0
pnpm build                  → exit=0(仅既有第三方包 + >500KB chunk 警告)
```

**color-guard 算术核对**:T5 收官 299 文件/2627 例 → 本任务新增 1 个 `.vue`
(`McpServerDetail.vue`)→ color-guard 全量 +1 → 文件数 300(实测吻合);用例数
2627 + 21(自有)+ 1(color-guard)= 2649(实测吻合)。算术无误。

## 发现清单

未发现 Critical / Important 缺陷。

- **Minor(非本任务引入,existing,仅记账)**:`.sk-btn.danger` 的 `color: white`
  字面量(`sk-shared.scss:52`)是既有代码,本任务正确复用未新增违规,但该字面量
  本身仍是配色约定意义上的技术债,建议随其它 Minor 记账项一并清理,不影响本任务
  判定。

## 总结

DOM/class/文案/尺寸/交互与 Vue2 蓝本逐行一致;D3/D9/D6 三条偏离均按三件套(注释+
报告+可核实的 grep 证据)申报到位,注释未泄漏 Vue2 色字面量;三处 T7 落点注释
位置语义正确;接口契约与任务书完全一致;i18n 值逐字符核对无误;测试覆盖 10 条
全部齐全且含正反对照,无弱断言/空转用例;独立 RED 探针精确报红并已还原;三门
实测数字与 color-guard 算术吻合;提交范围干净。

# SP8-P4 Task 6 报告 —— McpServerDetail.vue(不含测试连接)

## 产出

- 新建 `src/ai/components/settings/mcp/McpServerDetail.vue`
- 新建 `src/ai/components/settings/mcp/McpServerDetail.test.ts`(21 例)

## 逐行对照表(Vue2 `McpServerDetail.vue` → 本仓实现)

| Vue2 行 | Vue2 内容 | 本仓实现 |
|---|---|---|
| `:2-11` | `sk-detail-empty`(orb/empty-title/empty-sub) | 模板 `v-if="!server"` 分支,`t('aiMcpSrvPickHint')`/`t('aiMcpSrvPickSub')` |
| `:13-14` | `sk-detail-bar` + `SkillTile` | 同构,`serverColor(server.name)`/`glyph` 直调(比照 T5 `McpServerGroup.vue` 先例,不新建 color computed) |
| `:15` | `sk-name` span + code(`label2`) | `transportLabel(server.transport)` 直调 |
| `:16-18` | `.sw` 开关(role=switch/aria-checked/click emit toggle) | 逐字复刻(未用 `SetSwitch` 组件——Vue2 原始就是裸 div,brief `Consumes` 清单也没有列 SetSwitch) |
| `:19-27` | `menuWrap` + `.sk-pill-more` + `.sk-menu`(编辑配置/`<hr>`/移除服务) | 同构,`SkillIcon`→`AgentIcon`(D3),菜单项回调改具名函数 `emitEdit`/`openConfirmDialog`(理由见文件头注释,规避 TS18047) |
| **`:50-53`** | **测试连接按钮** | **跳过(T7 范围)**,`.sk-section-head` 内留精确落点注释 `<!-- SP8-P4 T7 在此插入「测试连接」按钮(Vue2 :50-53) -->` |
| `:32-44` | 元信息 4 格(状态/传输/请求头 non-stdio only/环境变量) | 逐字复刻,`v-if="server.transport !== 'stdio'"` 精确保留 |
| `:36-37` | 状态点内联 `:style` 拼色 | **偏离 D9**:整段删除,只留 `:data-disabled`,颜色交给既有 CSS |
| `:56-85` | `.mcp-config` 按 transport 二选一(stdio:命令/参数/环境变量;非 stdio:端点/请求头/环境变量) | 逐字复刻,i18n 键替换 `$t(...)` |
| **`:87-100`** | **测试提示 + 结果面板** | **跳过(T7 范围)**,`.sk-section-body` 内留精确落点注释 `<!-- SP8-P4 T7 在此插入测试提示与结果面板(Vue2 :87-100) -->` |
| `:104-108` | 工具说明段(`sk-description`) | `t('aiMcpSrvToolsNote')` |
| `:112-125` | 删除确认弹窗(`sk-modal-bg`/`sk-modal sk-confirm`) | **偏离 D6**:reka 原语手拼(`DialogRoot/Portal/Overlay/Content/Title`),照抄 `SkillDetail.vue:486-517`,`DialogPortal to=".set-app"` |
| `:119` | `.right` 内联 `margin-left:auto` | 不重复书写——`sk-shared.scss:149` 的 `.sk-modal-foot .right` 已含同规则(同 `SkillDetail.vue:505` 既有写法) |
| `:121` | `SkillIcon color="white"` | **偏离 D3**:不传色,见下方 grep 证据 |
| `:130-140` | `data()`(menuOpen/confirm/glyph/testing/testResult)+ `color` computed | `menuOpen`/`confirmOpen`(改名,理由见下)/`glyph` 常量;`testing`/`testResult` 不出现(T7 范围) |
| `:142-150` | `watch(menuOpen)` 条件式 mousedown 监听 | 逐字等价 `watch(menuOpen, ...)` + 模块级 `docListener` 变量 |
| `:151` | `watch('server.id')` 重置 menuOpen/confirm/testing/testResult | `watch(() => props.server?.id, ...)` 重置 `menuOpen`/`confirmOpen`,**留注释**:`// SP8-P4 T7 会在这里追加 testing / testView / reqSeq 的重置` |
| `:153` | `beforeDestroy` 兜底移除监听 | `onBeforeUnmount` |
| `:155` | `closeAnd(fn)` | 逐字移植 |
| `:157` | `doDelete()` | 逐字移植(guard `props.server`) |
| **`:158-171`** | **`runTest()` + testing/testResult 状态** | **跳过(T7 范围),完全不出现** |

## 三处 T7 落点标记(精确对应 Vue2 行号)

1. `.sk-section-head` 内:`<!-- SP8-P4 T7 在此插入「测试连接」按钮(Vue2 :50-53) -->`
2. `.sk-section-body` 内(mcp-config 之后):`<!-- SP8-P4 T7 在此插入测试提示与结果面板(Vue2 :87-100) -->`
3. `watch(() => props.server?.id, ...)` 回调内,`menuOpen.value = false; confirmOpen.value = false;` 之后一行注释说明 T7 会追加 testing/testView/reqSeq 的重置。

## 偏离显式申报(公共约束 §3)

- **D3**:`SkillIcon.vue` 不移植,统一 `AgentIcon`。Vue2 `:121` 传 `color="white"` 不再传。
  **grep 证据**:`sk-shared.scss:50-54`
  ```
  &.danger {
    background: var(--danger);
    color: white;
    &:hover { background: #e6342a; }
  }
  ```
  `.sk-btn.danger` 自带 `color: white` 声明,`AgentIcon` 默认 `color="currentColor"`(`AgentIcon.vue:79`)、SVG `stroke="currentColor"`(`AgentIcon.vue:88`)会继承按钮文字色——不需要再传具名色。与 `SkillDetail.vue:507-510` 的既有做法完全一致(该文件同样不传 `color`)。
- **D6**:删除确认弹窗不套 `SkModal`,直接用 reka 原语(`DialogRoot`/`DialogPortal`/`DialogOverlay`/`DialogContent`/`DialogTitle`/`VisuallyHidden`)手拼,理由与 `SkillDetail.vue:14-22`(P3b 偏离申报 2)完全同构:Vue2 的确认弹窗没有标题栏(标题就是 `.sk-confirm-body` 里的 `<h3>`),`SkModal` 强制渲染标题栏+关闭按钮的形状套不上;`.sk-modal-body` 默认插槽会与 `.sk-confirm-body` 自带 padding 叠加;`.sk-modal` 类写死加不上 `.sk-confirm`。`DialogPortal to=".set-app"` 一字未省(AI 区 token 作用域在 `.agent-app`/`.set-app`,portal 到 body 会让 `var(--…)` 解析失败)。
- **D9**:Vue2 `:36-37` 状态点内联 `:style` 拼背景色 + 发光圈(两个色字面量,已按约定不在注释里写出,改写成中文语义描述)整段删除,只保留 `:data-disabled`。颜色规则来自既有静态 CSS——**grep 证据**(`src/ai/styles/skills-styles.scss`):
  - `:351-369`(基础态,`.sk-meta-cell .val .dot`):
    ```
    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
    }
    ```
  - `:370-376`(停用态覆写,`.val[data-disabled="true"] .dot`):
    ```
    &[data-disabled="true"] {
      color: var(--text-tertiary);
      .dot { background: var(--text-quaternary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-quaternary) 12%, transparent); }
    }
    ```
  本组件 DOM:`<div class="val" :data-disabled="!server.enabled ? 'true' : 'false'"><span class="dot" />...`,与上述选择器逐层匹配(`.val` 上挂 `data-disabled`,`.dot` 是其直接子元素,零属性)。测试 5a/5b 断言 `.dot` 的 `style` 属性为 `undefined` 作为回归钉子。
- **外部点击关菜单(协调者裁定 5)**:未用 `useClickOutside` composable(那是 `SkillDetail.vue` 的实现选择),按本任务书要求手写 `watch(menuOpen)` + `onBeforeUnmount`,逐字对齐 Vue2 `:142-153`。只监听 `mousedown`,未监听 `click`,未加 Esc。
- **D4**:未写 `console.error`(本文件本就没有产生异常需要打日志的路径)。
- **零 `<style>` 块**:确认。

## §3.5「照抄、不改」核对

本任务不涉及 N1-N5(那些是 `McpServerModal`/`McpSection` 的范围),无需照抄判断——本文件是纯展示 + emit 转发组件,无表单/搜索逻辑触及 N1-N5。

## i18n

全部**复用既有键**,零新增:
`aiMcpSrvPickHint` `aiMcpSrvPickSub` `aiMcpSrvEditConfig` `aiMcpSrvRemove` `aiMcpSrvStatus`
`aiCfgEnabled` `aiMcpSrvDisabled` `aiMcpSrvTransport` `aiMcpSrvHeaders` `aiMcpSrvConfigured`
`aiMcpSrvNone` `aiMcpSrvEnv` `aiMcpSrvConfiguration` `aiMcpSrvConfigHint` `aiMcpSrvCommand`
`aiMcpSrvArgs` `aiMcpSrvEnvVars` `aiMcpSrvConfiguredHidden` `aiMcpSrvUrl` `aiMcpSrvReqHeaders`
`aiMcpSrvToolsNote` `aiMcpSrvRemoveTitle` `aiMcpSrvRemoveBody` `aiCancel` `aiMcpSrvRemoveConfirm`
——全部 25 个键逐一 grep 确认 `zh_cn.ts`/`en_us.ts` 双档均存在(T4 已交付)。

## RED→GREEN 证据(Step 4)

RED 探针:把元信息「请求头」格的 `v-if="server.transport !== 'stdio'"` 删除(改成无条件渲染)。

**探针前(GREEN,实现完成后首次跑)**:
```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

**探针后(RED)**:
```
 FAIL  src/ai/components/settings/mcp/McpServerDetail.test.ts > McpServerDetail > 4a. transport=stdio 时元信息只有 3 格,不含请求头格
AssertionError: expected [ DOMWrapper{ …(3) }, …(3) ] to have a length of 3 but got 4

- Expected
+ Received

- 3
+ 4

 ❯ src/ai/components/settings/mcp/McpServerDetail.test.ts:100:19
    98|     const w = mountDetail(makeServer({ transport: 'stdio' }))
    99|     const cells = w.findAll('.sk-meta-cell')
   100|     expect(cells).toHaveLength(3)

 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```

精确命中用例 `4a`,其余 20 例不受影响。还原后（`git diff`/`git status` 干净）复跑：

```
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

`git status` 探针还原后为 `nothing to commit, working tree clean`(两个新文件仍是 untracked,属正常未提交状态)。

## 三门终值

```
pnpm test                   → Test Files  300 passed (300)  ·  Tests  2649 passed (2649)  · exit=0
pnpm exec vue-tsc --noEmit  → exit=0
pnpm build                  → exit=0(仅既有第三方包 + >500KB chunk 警告)
```

**算术核对**:T5 收官值 299 文件 / 2627 例(见 `p4-task-5-report.md:86`)→ 本任务 +1 `.vue`(`McpServerDetail.vue`)→ +1 测试文件(`McpServerDetail.test.ts`,21 例自有用例)→
- 文件数:299 + 1 = **300**(实测 300,吻合)
- 用例数:2627 + 21(自有) + 1(color-guard 新增 1 个 `.vue` 动态 +1)= **2649**(实测 2649,吻合)

无红项,无需归属噪声用例。

## 测试质量自查

- 覆盖点 1-10 逐条独立用例,10 拆成 10a/10b 两个子用例(菜单/弹窗分别验证,理由:两者不会同时打开,拆开更精确)。
- 3/4/5/6/7 各自两项对照(启用/停用、stdio/非 stdio、空/非空 args、has_headers/has_env 真假)均有独立用例,无「只测一边」。
- 8c/8d 外部/内部 mousedown 对照,钉住「只在外部关闭」而非「任意 mousedown 都关闭」。
- RED 探针见上,精确命中预期用例。

## 报告契约自查

- 已附逐行对照表、三处 T7 落点、每条偏离显式申报、grep 证据(含具体文件:行号:内容)、D9 匹配证明、`.sk-btn.danger` grep 结论、RED→GREEN 两段完整输出 + 复原确认、三门完整终值 + 算术核对。

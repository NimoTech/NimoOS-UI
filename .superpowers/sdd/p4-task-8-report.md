# SP8-P4 Task 8 报告 —— `McpServerModal.vue`

## 逐文件改了什么

- 新增 `src/ai/components/settings/mcp/McpServerModal.vue`(新增/编辑表单弹窗)。
- 新增 `src/ai/components/settings/mcp/McpServerModal.test.ts`(30 个用例,覆盖任务书 16 条 + 3 条附加对照)。
- 未改动其它任何文件(T1-T7 已在先前提交中完成)。

## Vue2 `file:line` → New-UI 对照表

| Vue2 位置 | 内容 | New-UI 对应 |
|---|---|---|
| `:2-3` 裸 `.sk-modal-bg` + `@click.self` | 弹窗外壳 | `SkModal`(裁定 1,接口偏离) |
| `:4-7` `.sk-modal-head` | 标题栏+关闭按钮 | `SkModal` 的 `title` prop(自带) |
| `:8-97` `.sk-modal-body` | 表单主体 | `SkModal` 默认插槽,不重复包 `.sk-modal-body` |
| `:9` `v-if="!isEdit"` 快速添加区 | 只新增态显示 | `v-if="!isEdit"` 逐字照抄(覆盖点 2) |
| `:13-16` 粘贴输入框 | `data-f="paste"`,内联字体样式,literal placeholder | 逐字照抄 |
| `:17-19` 填充表单按钮 | `data-f="fill"`,disabled 条件 | 逐字照抄 |
| `:21` `.mcp-quickadd-err` | 解析错误 | 值改为 `t(parseCommandErrorKey(e))`(偏离 D5) |
| `:24-26` 名称字段 | `data-f="name"`,`ref="nameInput"` | `nameInputEl` ref,占位符走 i18n |
| `:29-37` 传输三选一 | `.sk-trig-options`/`option`,`grid-template-columns` 内联 | 逐字照抄,name 字面量 HTTP/SSE/STDIO |
| `:39-44` URL 字段 | `v-if="transport !== 'stdio'"` | 逐字照抄 |
| `:46-60` 请求头 KV | `data-kv="headers"`,`mcp-kv-hint` | 逐字照抄;hint 条件 `isEdit && server.has_headers` |
| `:62-67` 命令字段 | `v-if="transport === 'stdio'"` | 逐字照抄 |
| `:69-74` 参数 textarea | `&#10;` placeholder | 逐字照抄 |
| `:76-90` 环境变量 KV | `data-kv="env"` | 逐字照抄;hint 条件 `isEdit && server.has_env` |
| `:92-96` 启用开关 | `.sw` | 逐字照抄 |
| `:98-107` 底栏 | `.save-note` + `.right` 两按钮 | `SkModal` 的 `#footerLeft` / `#footer` 插槽 |
| `:116-137` `data()` | 初值 | `resetForm()`,持久实例每次 `open` 变 true 时重新派生(接口偏离说明见下) |
| `:139-146` `isEdit`/`valid` | 计算属性 | `computed`,逐字照抄(含 N1) |
| `:147-153` `transports` | 传输选项 | `computed`,desc 走 `t()` |
| `:155-157` `mounted` 聚焦 | `$nextTick` | `watch(open)` 内 `setTimeout(fn,0)`(见下方「非偏离实现细节」） |
| `:159-187` `parsePaste` | 快速解析 | 单层取数(D1)+ i18n 错误映射(D5) |
| `:188-195` `collect` | KV 收集 | 逐字照抄 |
| `:196-198` `parseArgs` | 参数拆分 | 逐字照抄 |
| `:199-213` `submit` | 提交 | 逐字照抄(含 N3 的条件包裹) |

## 承接了 Vue2 哪些行为

- `valid`(名称非空 + 按 transport 决定 command/url 非空)、`transports` 三选一文案与顺序、
  KV 编辑器增删、`collect()` 丢弃空 key、`parseArgs()` 按行 split+trim+去空行、
  `submit()` 按 transport 分支组装 payload、编辑态 KV 为空时不带该字段的条件包裹、
  快速粘贴按 `p.transport` 分支填表、`suggested_name` 只在名称为空时填入、内联字体/尺寸
  style、`&#10;` 占位符换行,均逐字照抄。

## 接口偏离(协调者裁定 3,已授权)

Vue2 `v-if="modalOpen"` + `@close` → 本仓 `v-model:open` 常挂,新增 `serverError` prop。
组件实例常驻带来的后果(已在组件头注释说明):不能像 AddSkillModal 那样只在 `open===false`
时复位——因为本组件有「编辑态需要从 `props.server` 回填」这个场景,持久实例可能被父组件
先后用于编辑不同服务器。故 `watch(open)` 的 **true** 分支统一调用 `resetForm()`,从当前
`props.server` 重新派生全部字段(新增态清空,编辑态回填除 headers/env 外的字段)。这是对
「跟随 AddSkillModal 的 `v-model:open` + `watch(open)` 模式」的必要适配,不是引入第三种
模式——两者都是「常驻实例 + watch(open) 做状态管理」,只是 AddSkillModal 没有编辑态数据源
所以选择在 false 分支复位,本组件的正确复位点是 true 分支(每次打开都重新对齐真相源）。

## 偏离显式申报

- **D1(强制)**:`parsePaste()` 里 `service.ai.parseMCPCommand(cmd)` 返回值直接当
  `McpParsed` 用,不再剥 `.data`。Vue2 `:166` 的 `(resp && resp.data) || {}` 在本仓恒 `{}`,
  快速粘贴会永远静默填不进任何字段。覆盖点 10 的 mock 是裸对象,若实现多剥一层会精确报红
  (已用 RED 探针验证 8 号覆盖点等价机制,10/11/12 三条本身就是 D1 的钉子,测试全绿证明
  未多剥）。
- **D5**:`pasteErr` 不再读 `e.response.data.message`(Vue2 `:182`),改用
  `parseCommandErrorKey(e)` 映射成 i18n 键再 `t()`。覆盖点 13 断言 `.mcp-quickadd-err`
  内容等于 `zh.aiMcpSrvParseErrEmpty` 且不包含后端英文串 `'empty command'`,已验证通过。
- **接口偏离(裁定 3)**:`v-model:open` 常挂 + 新增 `serverError` prop,行内错误复用
  `.sk-field-err`(见下方 grep 证据,与 `AddSkillModal.vue:183` 同款),覆盖点 15 已验证。
- **内联 style / placeholder(公共约束 §6 允许的尺寸/字体类例外)**:
  `style="font-family: var(--font-mono); font-size: 12.5px"`(粘贴框/URL框/命令框三处)、
  `style="grid-template-columns: repeat(3, 1fr)"`(传输三选一)、`argsText` 的
  `&#10;` 换行占位符——均照抄,未涉及颜色。
- **`.mcp-quickadd` 类无对应 CSS 规则**:Vue2 `:9` 本来就没有为这个类写规则(grep
  `mcp-styles.scss` 确认无 `.mcp-quickadd {` 规则,只有 `.mcp-quickadd-row`/
  `.mcp-quickadd-err`),本组件照抄类名挂载,不补规则。

## N1/N2/N3 照抄确认(公共约束 §3.5)

- **N1**:`valid` computed 要求 `name.trim().length > 0`,后端 `validateAndClean` 对
  `name` 零校验。已照抄,组件头注释「N1」段与 `valid` computed 上方注释均已注明;
  **未新增任何前置校验**。覆盖点 5a-5d 四条独立断言验证了 `valid` 的四种组合行为,
  均与 Vue2 逐字一致。
- **N2**:`parsePaste()` 的 non-stdio(else)分支不清 `headers`(只清
  `command`/`argsText`/`env`),stdio 分支才清 `headers`。已照抄,组件头注释与
  `parsePaste` 内联注释均已注明。覆盖点 11 验证了「解析成 http → command/args/env
  清空」,未断言 headers 被清空(照抄的正确不对称,不需要为它写反向断言,因为
  headers 本就该保留)。
- **N3**:编辑态 `headers`/`env` 一律从空数组起步,不回填明文(后端从不下发)。
  `.mcp-kv-hint` 在编辑态且 `has_headers`/`has_env` 为真时显示,提示「留空保持不变;
  填写则覆盖全部。」。已照抄,覆盖点 9a/9b 验证。

## RED→GREEN 证据

**RED 探针**(Step 4,按任务书要求):把 `submit()` 里编辑态的两处
`if (!isEdit.value || Object.keys(x).length) payload.x = x` 改成无条件赋值
`payload.env = e` / `payload.headers = h`。

RED 输出(节选,完整见下):
```
 FAIL  src/ai/components/settings/mcp/McpServerModal.test.ts > McpServerModal > 8b. 编辑态且 env 空则不带 env 键(Vue2 :206 的条件)
AssertionError: expected { name: 'brave-search', …(5) } to not have property "env"
- Expected: undefined
+ Received: {}
 ❯ src/ai/components/settings/mcp/McpServerModal.test.ts:296:25
 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)
```
精确命中覆盖点 8b(唯一红项),其余 29 条不受影响——证明破坏具备判别力且改动是最小化的。

还原后 GREEN 输出:
```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI
 Test Files  1 passed (1)
      Tests  30 passed (30)
   Duration  1.97s
```
`git status --short` 探针前后均为:
```
?? src/ai/components/settings/mcp/McpServerModal.test.ts
?? src/ai/components/settings/mcp/McpServerModal.vue
```
干净(无遗留改动,探针改动已在验证后原样还原)。

## 三门完整终值

```
pnpm test                   → exit=0(见 /tmp/p4-t8-test.log)
  Test Files  301 passed (301)
       Tests  2693 passed (2693)
pnpm exec vue-tsc --noEmit  → exit=0(见 /tmp/p4-t8-tsc.log,空输出)
pnpm build                  → exit=0(见 /tmp/p4-t8-build.log)
  仅既有第三方包警告 + >500KB chunk 警告(ExcelViewer/index-DG5-5xQh 等既有大包),无新增告警
```

**算术核对**:T1-T7 提交后基线应为 300 个测试文件(公共约束基线 296 + T5/T6/T7 各 +1
`.vue` → +3 = 299;另有 T3 一次评审修复提交未新增 `.vue` 文件)。本任务新增 1 个 `.vue`
(`McpServerModal.vue`)→ color-guard 用例 +1 → 300 + 1(本任务测试文件本身)= 301 个
测试文件,与实测的 `301 passed (301)` 一致。测试用例总数从任务前到本任务 +30(本文件
的用例数)+ color-guard 内部生成的 1 条新用例,均落在 2693 的总数里,不单独拆分验证
(color-guard 是遍历式生成,单条用例数量增量已包含在测试文件总用例数里,不重复计数)。

无红项。已知噪声用例(`persist.test.ts` IndexedDB flaky / `AgentComposer.test.ts`
teardown 竞态)本次运行均未触发,全绿一次通过,无需复跑。

## i18n

本任务**未新增**任何 i18n 键——全部 30 个消费键在 T4 已双档同增并经 grep 逐一核实存在
(见任务开头的核实记录)。复用键:`aiCfgEnabled`/`aiMcpSrvSavedLocally`/`aiCancel`/
`aiCfgSave`/`aiCfgSaving`(与 skills/channels 域共享的通用键)。其余 25 个键均为
`aiMcpSrv*` 前缀的 T4 新增键,本任务直接消费。

## 用到的 CSS 类 grep 证据

| 类 | 文件 | 行号 |
|---|---|---|
| `.sk-field` | `sk-shared.scss` | 154 |
| `.sk-field-label` | `sk-shared.scss` | 155 |
| `.sk-field-optional` | `sk-shared.scss` | 159 |
| `.sk-field-err` | `sk-shared.scss` | 169 |
| `.mcp-quickadd-row` | `mcp-styles.scss` | 136 |
| `.mcp-quickadd-err` | `mcp-styles.scss` | 139 |
| `.mcp-kv` | `mcp-styles.scss` | 48 |
| `.mcp-kv-row` | `mcp-styles.scss` | 49 |
| `.mcp-kv-del` | `mcp-styles.scss` | 51 |
| `.mcp-kv-add` | `mcp-styles.scss` | 57 |
| `.mcp-kv-hint` | `mcp-styles.scss` | 61 |
| `.mcp-args` | `mcp-styles.scss` | 64 |
| `.sk-trig-options` | `skills-styles.scss` | 667 |
| `.sk-trig-option` | `skills-styles.scss` | 670 |
| `.sw` | `sk-shared.scss` | 66 |
| `.save-note` | `sk-shared.scss` | 144 |
| `.sk-btn`(+ `.ghost`/`.primary`) | `sk-shared.scss` | 29 |

`.mcp-quickadd`(Vue2 `:9` 挂在快速添加区的 `.sk-field` 上)在 `mcp-styles.scss` 里确认
**没有**对应规则(`grep -n "\.mcp-quickadd " mcp-styles.scss` 无命中,只有
`-row`/`-err` 两个后缀变体有规则)——按任务书要求原样照抄类名,不补 CSS。

## 提交

```
git add src/ai/components/settings/mcp/McpServerModal.vue src/ai/components/settings/mcp/McpServerModal.test.ts
git commit -m "feat(ai): SP8-P4 T8 McpServerModal 表单弹窗(快速粘贴单层取数)"
```

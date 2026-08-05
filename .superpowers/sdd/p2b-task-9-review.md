# SP8-P2b Task 9 评审 —— `mcpConnect.ts`

## 判定

- **规格合规:✅**(签名、导出、行为与 brief 一致;5 条 Vue2 断言逐一有对应;偏离已申报)
- **任务质量:Approved — with one hand-off note for Task 10**(无阻断性缺陷;一条 MEDIUM 提醒需写进协调者台账)

## 逐项核实

### Vue2 蓝本对照(自己打开 `NimoOS-UI/src/views/AI/Settings/sections/McpTokensSection.vue` 核对行号)

- `endpointUrl` computed 确实在 138-141 行;`origin + '/v1/ai/mcp-rpc/'`,fallback 用 `|| ''`。
  New-UI `mcpEndpointUrl(origin?)` 在无参调用时读 `window.location.origin`,行为等价;新增的
  `origin` 形参是 brief 明确要求的签名(`mcpEndpointUrl(origin?: string)`),属于「为可测试性开的调用口」,
  未改变默认(无参)调用时的输出,不算逻辑偏离。
- `buildInstruction` 158-161 行:`.split('{url}').join(...).split('{token}').join(...)`,New-UI
  逐字符复刻(含用 split/join 而非 replace 的理由注释),行为一致。
- `buildJson` 162-166 行:`JSON.stringify({mcpServers:{nimoos:{url, headers:{Authorization:'Bearer '+token}}}}, null, 2)`。
  New-UI 键名、嵌套层级、`Bearer ` 前缀、`null, 2` 缩进逐一比对一致。
- `fmtCreated` 209-212 行:`$t('Created') + ': ' + (ms ? toLocaleString : '-')` —— 数值核心
  (`ms ? new Date(ms).toLocaleString() : '-'`)与 `formatEpochMs` 一致,未 ×1000(Vue2 本来就没乘,
  报告措辞"承接 no x1000"准确)。
- `fmtLastUsed` 213-216 行:falsy 时**整句只返回** `$t('Never used')`,**没有** `'-'` 兜底、**没有**
  "Last used:" 前缀;非空时才是 `'Last used: ' + toLocaleString`。这与 `fmtCreated` 的兜底策略
  本质不同(一个永远带前缀+`-`,另一个空值时是纯替换整句)。`formatEpochMs` 只能服务
  `fmtCreated` 语义,**不能被 Task 10 直接拼成** `'Last used: ' + formatEpochMs(t.last_used_at)`——
  falsy 输入会产出 `'Last used: -'`,与 Vue2 的 `'Never used'` 不符。报告在"偏离申报"里提到
  "Never used 文案交给 Task 10 组件层按 last_used_at 是否为空自行选择前缀",已经点出组件层要
  单独判空、不能无脑拼接,但没有明确指出"如果直接拼接会产出错误的 'Last used: -'"这个具体
  陷阱。→ 记为一条 MEDIUM 发现,建议写进协调者交接清单给 Task 10。
- `PLACEHOLDER_TOKEN` 128 行,值一致。

### 承接的 5 条 Vue2 断言(`__tests__/McpTokensSection.spec.js` 逐条读过)

1. `endpointUrl uses window origin`(82-85 行)→ `mcpEndpointUrl` 两例。已承接,未削弱。
2. `fmtCreated() ... (no x1000)`(87-91 行)→ `formatEpochMs` 的 ms 数值断言。已承接;RED 探针验证
   有效(见下)。
3. `fmtLastUsed() shows "Never used" when falsy, else ms date-time`(93-98 行)→ **只承接了
   "else ms date-time" 一半**(数值格式化并入 `formatEpochMs` 的 0/undefined/null→'-' 测试)。
   "Never used" 文案分支**当前在整个仓库里没有任何测试覆盖**(旧 Vue2 spec 迟早随组件下线,
   新仓库尚无 Task 10)。这是 brief signature 本身的裁剪(`formatEpochMs` 不产文案),不是实现者
   自选,但按用户指令"重要 Vue2 行为不能漏测"——目前确实处于空档期,应在协调者台账标注
   "Task 10 必须补 Never used 分支的单测,否则该 Vue2 断言永久失踪"。
4. `buildInstruction() inlines the endpoint URL and the token`(100-107 行)→ 已承接,含占位符用例。
5. `buildJson() is valid MCP config JSON with url + bearer`(109-114 行)→ 已承接。

报告称"brief 写 6 条,但列举名字只有 5 个不重复项",核对 spec 文件本身也确实只有 5 条与
mcpConnect 相关的断言(其余 6 条是 load/createToken/doDelete/onRevealClosed,与 UI 状态机相关,
理应留给 Task 10 挂载测试,不属于纯函数抽取范围)。判断准确。

### 9 个新用例质量

- 覆盖了 brief Step 1 的全部 9 例,逐字一致,未削弱任何断言力度(RED 探针证实关键断言可精确抓包)。
- `mcpEndpointUrl('')` 退化成相对路径一例并非 Vue2 显式测过的场景,但等价于 Vue2 `origin` 计算
  结果为空字符串时的行为(`|| ''` fallback),补充合理,不是新造行为。

### 确定性(TZ)

```
TZ=UTC        pnpm test src/ai/util/mcpConnect.test.ts → 1 file / 9 tests passed
TZ=Asia/Tokyo pnpm test src/ai/util/mcpConnect.test.ts → 1 file / 9 tests passed
```
`formatEpochMs` 测试断言 `formatEpochMs(ms) === new Date(ms).toLocaleString()`——两侧在同一进程内
用同一 TZ 计算,结构上不可能因 TZ 不同而产生差异(不是跨环境硬编码字符串比较),两档 TZ 均绿,
判定为确定性达标。

### CSS 类

本任务不含 `<style>`/模板,无 CSS 类可查,N/A。

### RED 探针(已还原,`git status` 干净)

1. 把 `formatEpochMs` 的 `new Date(ms)` 改成 `new Date(ms * 1000)`(模拟"误乘1000"回归)→
   `formatEpochMs 按毫秒解释时间戳，不再乘 1000` 精确报红(`9/29/56157...` vs `3/10/2024...`),
   其余 8 例仍绿。已还原为 `new Date(ms)`。
2. 把 `buildMcpJson` 的 `Authorization: \`Bearer ${token}\`` 改成 `Authorization: \`${token}\``
   (丢掉 Bearer 前缀)→ `buildMcpJson 是合法 MCP 配置 JSON，带 url 与 Bearer` 精确报红
   (`expected 'secret' to be 'Bearer secret'`),其余 8 例仍绿。已还原。

还原后 `git status --short` 输出为空,`git diff` 无残留。

### 测试门(自己跑的)

```
pnpm test                    → 282 files / 2238 tests passed
                                (MemorySection.test.ts 的 RangeError 未处理 rejection 噪声照常出现,
                                 属已知既定间歇性问题,不计入本任务红项,且该文件仍以"绿"收尾)
pnpm exec vue-tsc --noEmit   → 无输出,通过
pnpm build                   → 通过,仅有既有 >500KB chunk 警告(ExcelViewer/index-BAuaQrvY 等,
                                与本任务无关)
```
与报告声明的数字一致。

### 提交纯净性

`git show --stat HEAD`(commit `e6cbfd7`)只含 `src/ai/util/mcpConnect.ts` +
`src/ai/util/mcpConnect.test.ts` 两个新文件,无 i18n hunk,无对方会话文件卷入。符合 §1/§9 要求。

## 发现清单

1. **[MEDIUM] hand-off 风险未充分言明**:`formatEpochMs` 的 `'-'` 兜底只匹配 Vue2 `fmtCreated`
   的语义,如果 Task 10 组件层对 `last_used_at` 走 `$t('Last used') + ': ' + formatEpochMs(...)`
   这种"无脑拼接"套路,falsy 输入会产出 `'Last used: -'`,而不是 Vue2 的纯文案 `'Never used'`——
   这是一个真实存在的踩坑点,报告只说"文案交给 Task 10 判断",没有把"直接拼接会产出错误字符串"
   这个具体陷阱写清楚。建议协调者在 Task 10 交接清单里显式记一条:「last_used_at 为空时必须整句
   替换成 `$t('Never used')`,禁止用 `formatEpochMs` 的 `'-'` 去拼前缀」。
2. **[LOW] 覆盖空档**:Vue2 `fmtLastUsed() shows "Never used" when falsy` 断言目前在新仓库里
   完全没有测试覆盖(数值分支已承接,文案分支悬空,等 Task 10 落地)。建议协调者台账标注,
   避免这条 Vue2 行为在迁移过程中"静默消失"。
3. 无其他缺陷;i18n、CSS 类、提交纯净性、RED 判别力、TZ 确定性均核实通过。

## 承接断言核对小结

5 条(非 brief 写的 6 条)全部有对应新用例,断言方向未被削弱;其中第 3 条(`fmtLastUsed`)只
承接了数值格式化半部分,"Never used" 文案半部分悬空待 Task 10。

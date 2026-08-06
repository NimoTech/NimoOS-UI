# SP8-P4 Task 4 评审 —— i18n 双档(MCP 分区)

评审者:独立评审(sonnet),未采信实现者报告,全部结论自查复现。

## 判定

1. **规范符合(Spec)**: ✅
2. **任务质量(Quality)**: 通过

## 方法与证据

### ① 逐码点复核(自己写的脚本,未复用报告脚本)

脚本:`/tmp/claude-1000/.../scratchpad/check_i18n.py`(独立实现,读 `zh_CN.json`/`en_US.json` 与
两档 `.ts` 源码,用正则同时识别单/双引号字面量并解码转义,逐 Unicode 码点比较)。

输出:
```
PAIRS_42 count: 62
keys missing from zh_CN.json (expected per brief, up to 4): []
MISMATCH (§4.2): none
REUSE mismatch: none
PAIRS_43 count: 14
MISMATCH (§4.3): none
duplicate keys in zh_cn.ts: none  total keys: 1207 unique: 1207
duplicate keys in en_us.ts: none  total keys: 1207 unique: 1207
```
- §4.2 62 条:zh 值与 `zh_CN.json`(以 Vue2 英文串为键查得)逐码点相同;en 值与该英文串字面量逐码点相同。
- 另外验证 en_US.json 中确实有 4 条键缺失(`Update failed` / `Added {name}` / `optional` /
  `Saved locally on this NAS`),核实实现者「缺 4 条用 key 字面量」的说法为真。
- §4.3 14 条:zh/en 值与任务书表格逐码点相同(设计文档未逐条给出这 14 条的值,只以
  `aiMcpSrvTestErrTimeout` 一例作插图,与任务书表一致,无冲突;其余 9 条只能核任务书表,已核)。
- 两档整份文件扫描:零重复键(1207 = 1207,唯一)。

### ② 完整性 / 键集一致

- `pnpm exec vitest run src/i18n/` → parity.test.ts + messageSyntax.test.ts 全绿(3 files / 16
  tests,自己跑,非转述报告)。
- 自己 diff 两档 T4 区块内键名顺序:`diff` 输出为空,顺序逐行一致。
- T4 区块本身新增键数:自己数 `grep -cE` = 76(62+14),与报告一致。
- 未发现表外新增键(YAGNI 检查通过)。

### ③ 重复定义

- 全文件扫描 zh_cn.ts / en_us.ts 均 0 重复。§4.1 的 8 个复用键各自在文件中只出现一次
  (逐个 grep 确认,行号见下),证明 T4 没有把它们重新定义一遍。

### ④ 与 T3 对账(Critical 风险点)

`grep -o "aiMcpSrv[A-Za-z]*" src/ai/util/mcpErrorKey.ts | sort -u` 自己跑出 15 个键
(`aiMcpSrvErrBadTransport/ErrCommandRequired/ErrNotFound/ErrUrlRequired/
ParseErrEmpty/ParseErrNoCommand/ParseErrOnlyEnv/ParseErrQuotes/ParseFailed/
TestErrAgentDown/TestErrConnect/TestErrListFailed/TestErrListTimeout/TestErrTimeout/
TestFailed`)+ 兜底键 `aiCfgSaveFailed` —— 全部 16 个在两档 i18n 里逐字存在。**零遗漏**。

### ⑤ 复用键(§4.1)

8 个键逐个 grep 确认:两档各存在恰一次、值与任务书表逐字相同(见下方行号)。

```
aiCfgRefresh    zh:617 刷新        en:614 Refresh
aiCancel        zh:577 取消        en:576 Cancel
aiCfgSave       zh:703 保存        en:698 Save
aiCfgSaving     zh:1037 保存中…    en:1025 Saving…
aiCfgSaved      zh:1038 已保存     en:1026 Saved
aiCfgSaveFailed zh:1039 保存失败   en:1027 Save failed
aiCfgDeleteFailed zh:673 删除失败  en:667 Delete failed
aiCfgEnabled    zh:692 启用        en:687 Enabled
```

### ⑥ 前缀合规

`git show HEAD --unified=0` 里所有新增行提取键名,排除 `^aiMcpSrv` 前缀后结果为空
——本次 diff 未新增任何 `aiMcp*`(非 Srv)或 `aiCfgMcp*` 键,无语义串台。

### ⑦ 死键预检

§4.2/§4.3 全部 76 键目前均无消费方(T5–T9 尚未实现,预期内,非缺陷)。未发现「表里有、
设计文档标注为不会被任何组件使用」的键——14 条 §4.3 都能在设计文档 §5.3/§6 的映射表
（`error_key` 四值 + 502 + 折叠标题）里找到明确用途,无冗余候选。

## 实现者自述三点 —— 独立核验结果

1. **「正文写 63,表格实 62」**:自己 `sed -n '62,123p' brief | grep -c '^| \`aiMcpSrv'` = 62;
   `grep -n "63" brief` 命中的是脚本注释里的散文(L172),不是表格。**属实**,按表格 62 执行正确。
2. **「Step 6 模板写 77,应为 76」**:62+14=76,brief 里唯一出现「77」的地方就是 commit 模板
   (L199)。**属实**,提交信息用了 76(实际 commit message 已核对为 76),不影响键值内容。
3. **「`aiMcpSrvParseFailed` 改双引号,值不变」**:`grep -n aiMcpSrvParseFailed src/i18n/en_us.ts`
   → `"Couldn't parse that command"`;确认先例 `filesViewerDontSave: "Don't save"`(L66)与
   `aiSkErrDescAngle: "Description cannot contain {'<'} or {'>'}"`(L1289)均为双引号写法,先例
   属实。逐码点脚本已把双引号字面量纳入解码,比对结果 `MISMATCH: none` —— **值本身零字符改动**,
   仅引号风格变化,不违反「不许改一个标点」(该约束管值的内容,不管 TS 源码里字符串定界符)。

三点自述均核验为真,无异议。

## 三门(自己实测,非转述)

```
pnpm test                   → Test Files 298 passed (298) / Tests 2619 passed (2619) / exit 0
pnpm exec vue-tsc --noEmit  → exit 0(无输出)
pnpm build                  → exit 0,仅既有 >500KB chunk 警告
```
与 T3 收尾基线(298/2619)持平,本任务未新增 `.vue`,color-guard 用例数不变,符合预期算术。

## RED 探针(自己设计,非复述实现者)

删除 `en_us.ts` 里的 `aiMcpSrvParseErrQuotes: 'Unbalanced quotes',` 一行 →
```
pnpm exec vitest run src/i18n/parity.test.ts
 FAIL  src/i18n/parity.test.ts > i18n locale parity > en_us 与 zh_cn 顶层 key 集合完全一致
- "aiMcpSrvParseErrQuotes",   (仅这一行差异)
 Test Files  1 failed (1) / Tests 1 failed | 2 passed (3)
```
精确报红,只差这一个键。还原(补回该行)后:
```
pnpm exec vitest run src/i18n/  → Test Files 3 passed (3) / Tests 16 passed (16)
git status → nothing to commit, working tree clean
```
已精确还原确认。

## 提交范围

`git show --stat HEAD` → 仅 `src/i18n/en_us.ts` + `src/i18n/zh_cn.ts`,165 行全为新增,
无其它文件改动。`git status` 干净。

## 发现

无 Critical / Important / Minor 发现。任务完整、逐码点无一处偏差、T3 对账零遗漏、复用键
干净、前缀合规、三门绿、提交范围干净、RED 探针精确报红并已精确还原。

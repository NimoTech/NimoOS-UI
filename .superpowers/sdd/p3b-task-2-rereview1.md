# P3b Task 2 — 复审轮 1(修复 diff `b8357ee`..`f4a859d`)

范围:仅复查上一轮评审给出的 3 条 findings 是否已在 `f4a859d` 里真正解决,以及修复 diff
本身有无引入新破坏。不重新评审整个任务。

## Finding 1 — 全角问号(Important)

**ADDRESSED。**

- `src/i18n/zh_cn.ts:1249-1250` 现为 `aiSkUninstallTitle: '卸载这个技能?'` /
  `aiSkDeleteTitle: '删除这个技能?'`。用 `python3` 按码点核对:两处末字符均为
  `0x3f`(半角)。权威源 `NimoOS-UI/src/assets/lang/zh_CN.json` 对应键
  (`"Uninstall this skill?"`/`"Delete this skill?"`)的中文值末字符同样是
  `0x3f`,逐码点一致。
- 守卫:`src/i18n/messageSyntax.test.ts` 新增 `describe('P3b Task 2 aiSk* keys —
  no accidental full-width punctuation')`,含三条用例:
  1. `p3bTask2Keys.length === 74`(防清单本身漂移,自检用,非生产代码断言);
  2. 对本期新增 74 个键的 zh_cn 值扫描 `/[？！：]/`,不含全角逗号(符合要求「全角逗号不禁」);
  3. 对 `aiSkUninstallTitle`/`aiSkDeleteTitle` 做精确内容 + `codePointAt` 断言。
- 范围收窄理由:报告称既有键(P3a 及更早)未逐一回权威源核对过标点,扩大断言面
  有误报风险,故只钉死本期新增的 74 个键。该理由成立——评审范围本身也只要求
  覆盖「本期新增 aiSk* 键」,未要求覆盖全量文件,收窄不算削弱。
- **RED 探针(本次复审自己做的,不是采信报告)**:临时把 `zh_cn.ts` 里
  `aiSkUninstallTitle` 改回全角 `？`,跑 `pnpm exec vitest run
  src/i18n/messageSyntax.test.ts` → `Test Files 1 failed (1) · Tests 2 failed
  | 10 passed (12)`,两条新用例精确报红(`should not contain full-width …` 与
  `end with a half-width "?"`,错误消息里精确点出 `aiSkUninstallTitle =
  "卸载这个技能？"`)。随后用备份文件 `cp` 还原,`diff` 确认逐字节一致,复跑
  → `Test Files 1 passed (1) · Tests 12 passed (12)`。守卫有真实判别力,非空转。

## Finding 2 — 编造的字节常量(Minor)

**ADDRESSED。**

- 自己去 `NimoOS-AI/service/skills_store.go` 核对(不采信报告数字):
  - Line 121:`const MaxSkillMDBytes = 50 * 1024`(= 51200,与报告一致)。
  - Line 155 / 229:`fmt.Errorf("SKILL.md exceeds %d bytes (got %d)",
    MaxSkillMDBytes, ...)`。
  - 结论:`51200` 是真实常量,行号 118-121(注释起始)/121(赋值)/155、229(错误
    格式化)均与报告吻合。
- `src/ai/util/skillsErrorKey.test.ts` 用例串改为
  `'SKILL.md exceeds 51200 bytes (got 60000)'`,匹配逻辑本身
  (`skillsErrorKey.ts:48` `s.includes('skill.md exceeds')`)是子串匹配、与具体
  数字无关,换真实常量不影响判定路径,纯粹是把编造数字换成真值,无风险。

## Finding 3 — 多重违规优先级(Minor,已判定 skipped)

**按指示 skipped**,未被改动。`git diff b8357ee..f4a859d --stat` 只涉及
`skillsErrorKey.test.ts`(改字节数用例)、`messageSyntax.test.ts`(新增守卫)、
`zh_cn.ts`(改 2 行标点)三个文件,`skillsErrorKey.ts`(生产代码)本身零改动 ——
`validateSkillForm` 的实现未被触碰,与协调者"本轮不动"的指示一致。不因其仍
存在而记 NOT ADDRESSED。

## 修复 diff 内有无新破坏

**无。**

- `git diff b8357ee..f4a859d -- src/i18n/messageSyntax.test.ts` 的删除行为
  0 行(纯新增 63 行),没有削弱或删除任何既有断言。
- `git diff b8357ee..f4a859d -- src/ai/util/skillsErrorKey.test.ts` 的两处删除
  行就是被替换的旧用例本身(编造串 → 真实串),不是删断言,是等量替换,替换后
  测试仍覆盖同一个错误映射路径(`skill.md exceeds` → `aiSkErrMdTooLarge`)。
- `zh_cn.ts` 的改动只是 2 行标点从全角变半角,不涉及键的新增/删除,`en_us.ts`
  未被触碰,`parity.test.ts` 仍绿(已实测,见下)。
- 新增守卫用例检查过是否空转:已用 RED 探针验证(见 Finding 1),非空转。

## 我实测的测试数字

- 受影响档单独跑:`pnpm exec vitest run src/i18n/messageSyntax.test.ts
  src/i18n/parity.test.ts src/ai/util/skillsErrorKey.test.ts
  src/ai/util/sandboxRun.test.ts` → `Test Files 4 passed (4) · Tests 63 passed
  (63)`,exit=0。
- 全量:`pnpm test` → `Test Files 293 passed (293) · Tests 2473 passed
  (2473)`,exit=0,耗时 58.49s。与实现者报告的终值完全一致。
- `+3` 核对:上一轮基线 2470 → 本轮 2473,恰好对应新增守卫 `describe` 块里的
  3 条用例(`covers exactly 74 keys` + `should not contain full-width…` +
  `end with a half-width "?"`),无其它测试文件被新增/删除,算术吻合,无来源
  不明的增量。

## 总判定

**全部已解决。** Finding 1(Important)与 Finding 2(Minor)均已在
`f4a859d` 中真实修复并经本次复审独立验证(码点核对 + 自做 RED 探针 + 自跑测
试,不采信报告数字);Finding 3 按协调者指示合规 skipped,未被违规改动。修复
diff 范围内未发现新增破坏、未发现断言削弱、未发现空转用例。三门(test /
vue-tsc / build)按报告称绿,本次复审复核了 `pnpm test` 全量绿(293/2473),
未额外复跑 vue-tsc/build(报告数据与文件改动范围一致,风险低,不影响本轮
finding 判定)。

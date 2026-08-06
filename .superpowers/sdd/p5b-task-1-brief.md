# P5b · T1 任务书 —— i18n:100 条新键 + 守卫扩本批圈

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。共 T0–T10 十一个任务,单车道串行。

**你是 T1,只做 i18n。** 后面 T5(队列页)/ T8-T10(已收录文件页)的模板会引用你落的键 ——
i18n 排在它们前面就是为了让它们提交时不出现「引用了不存在的键」,且测试能断言中文渲染值。

## 你的权威输入(按此顺序读,**这三份是你唯一的需求来源**)

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— 全批共同约束(工作区 / 移植纪律 / 偏离登记 / 照抄条 / 测试门 / 报告契约)。**先通读。**
2. **附录 A**:`.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-appendix-A-i18n.md`
   —— **键表就是它,逐字照抄,一个标点都不许改。** 它已被 opus 评审逐字符回
   `git show main:src/assets/lang/zh_CN.json` 复核过,零差异。**你不要「顺手改对」任何看起来别扭的中文。**
3. 上一批治理文件(本期沿用,治理文件只写差异):`.sp8/NimoOS-New-UI/.superpowers/sdd/p5a-common-constraints.md`

## 改哪三个文件

`src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `src/i18n/messageSyntax.test.ts`

**只这三个。** 不新建 `.vue`、不新建测试文件。

## 要做什么

1. **按附录 A 逐字落新键到两档。**
   - 键数以附录 A 为准(T0 查实计划书漏了 1 条 → **100 条**,不是计划书写的 99;附录 A 的 A.1/A.2/A.4 之和就是权威)。
   - 落之前先 `grep -n "aiKb" src/i18n/*.ts` 确认与既有 96 个 `aiKb*` 零重名(重复属性 = TS 错误)。
     T0 已核过零重名,你再验一次。
   - 附录 A 的 **A.0 九条是 P5a 已有的复用键,不要重复定义**;落前按附录 A.0 给的行号 grep 复核值未变。
2. **两条死键不许落**:`Retrying {n} failed jobs`(蓝本 `QueueView.vue:324`)与
   `Retried {n} selected jobs`(`:345`)—— K18 之后无引用。**报告里要显式说明为什么不落。**
3. 🔴 **必须写并跑一个程序化逐码点比对脚本**,不许靠眼睛。
   - P5a 的教训:附录表本身零差异,**手抄进 TS 时引入了 5 处全角标点错**,三门全绿没抓到。
   - 脚本读 `git show main:src/assets/lang/zh_CN.json`(在 `/home/nimo/NimoTech/NimoOS-UI` 里跑 `git show`,
     那个工作树**只读**)与你新写的 `zh_cn.ts`,对**每一条有 Vue2 源的键**逐 `codePointAt` 比对,逐条输出 `MATCH` / `MISMATCH`。
   - **有 Vue2 源的条数以附录 A 为准** —— T0 的勘误 E-1 查实:计划书标「Vue2 无源」的 6 条其实语言包里全都有
     (且 3 条的中文值与计划书自拟的不同),所以这个数**不是** 89。附录 A 里标了哪些有源,就比对哪些。
   - 脚本落到 `.superpowers/sdd/p5b-task-1-i18n-verify.mjs`(或 `.py`),**连输出一起 `git add -f` 进提交**,
     报告里贴逐条结果的汇总(`N/N MATCH`)。
4. **扩 `src/i18n/messageSyntax.test.ts`,只圈本批这 100 个键**(照 P5a R7 的写法,别全量生效):
   - **(a) 全角标点扫描** `/[，；：？！（）]/`。**例外清单以附录 A 里那份为准 —— 是 15 条,不是计划书写的 11 条**
     (T0 勘误 E-3:计划书那 11 条里有 1 条假阳性 `aiKbClearFailedConfirmBody`(它只含 `。`)、
     漏了 5 条 `aiKbOverExplicitCap` / `aiKbPollTip` / `aiKbRebuildCapHint` / `aiKbTombstonedTip` / `aiKbLoadErrorBody`;
     照计划书抄会当场红 5 条)。
     🔴 **例外一律写成 `toBe` 钉死确切值的强断言,不是「跳过扫描」的松形式。**
   - **(b) 本批带占位符的键**(附录 A 标了,20 条),断言两档占位符名称集合一致。
   - **(c) 补一条「exactly N keys」防漂移**(N = 附录 A 的实际键数,照 P3b/P5a 同款写法)。
   - 🔴 **不许把这三条扩成全量生效** —— 既有 `aiResTurn` / `aiResFilesInTurns` 的两档占位符**故意**不一致
     (`{s}` 是英文复数后缀),全量化会把它们打红。
5. `src/i18n/parity.test.ts` 自动覆盖两档键集一致,**无需改**。

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者 2026-08-01 实测,以此为准,不要用计划书 §5 的预测数)**:
`pnpm test` → **313 文件 / 2872 例全绿**,exit 0。

你的预期增量:**+0 文件**(不新增 `.vue` / 测试文件),`messageSyntax.test.ts` **+3~5 例**。
跑完实测多少就报多少,和预测不一致不是问题,**但要在报告里解释清楚差在哪**。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 逐码点脚本 **N/N MATCH**(N = 附录 A 里有 Vue2 源的键数)
- 报告列清:**复用 9 / 新增 100 / 其中有 Vue2 源 M + 本期新造 K / 判定死键不落 2**(具体数字从附录 A 数)
- 🔴 **RED 探针必做三次,每次都要贴「改了什么 → 哪个用例报红 → 报红文本」,然后改回来**:
  1. 把某条中文值里的一个全角逗号改成半角 → 全角标点断言**精确**报红(不是一片红)
  2. 把某个 `{n}` 占位符改名 → 占位符一致性断言**精确**报红
  3. 从键列表里删一条 → 「exactly N keys」报红
  探针没做 = 你的守卫是不是真的咬得住无人知道,这一条不通过就退回。

## 硬约束(治理文件里有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`,
  **不许在那里改任何东西 / 提交任何东西 / 跑 checkout·stash·restore**
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- `.sp8/NimoOS-Service` 本期零改动,**不需要跨仓 `pnpm build` / `pnpm install`**
- 界面/文案 **1:1 照抄 Vue2**;但 Vue2 的 bug / 竞态 / 吞错**不照抄** —— 本任务范围内不涉及,
  遇到就写进报告问我,别自己拍

## 提交

`git add -f` 逐个显式路径(三个源文件 + 逐码点脚本 + 报告),**一次 commit**。
`.superpowers/sdd/` 被 `.gitignore` 盖住,所以那里的文件必须 `-f`。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-1-report.md`:
改了什么 · 逐码点脚本的完整逐条结果 · 三次 RED 探针的原始报红文本 · 三门实测数字 ·
键数账(复用/新增/有源/新造/不落) · 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 逐码点 N/N · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

# SP8-P3a Task 2 —— 独立评审

评审对象:`src/ai/types/skill.ts`、`src/ai/util/skillsFormat.ts` + 测试、
`src/i18n/{zh_cn,en_us}.ts` 新增的 30 个 `aiSk*` 键。commit `cf24465`。

## 方法

未采信实现者报告任何结论,全部独立复核:
1. `types/skill.ts` 字段逐个对照 `NimoOS-AI/service/skills.go:10-32`(实测行号,
   非报告转述)。
2. 30 个 i18n 键写了 Python 脚本,从 New-UI 的 `zh_cn.ts`/`en_us.ts` 抓取
   `// >>> SP8-P3a` 标记块内的键值,与权威源
   `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` 做逐码点(codepoint)比对,
   而非目测。`en_US.json` 缺失键按「键字面量即英文渲染值」规则校验(brief 明示的规则)。
3. `git grep` 检查 30 键在两档文件里各只出现一次;`aiCfgRefresh`/`aiCfgSkills`
   各自只有报告所称的原有一处定义,未被本任务重复定义。
4. 独立跑 `pnpm test` / `vue-tsc --noEmit`,不看报告数字。
5. 自己做一次 RED 探针(见下),未复用报告里的 4 组探针结论。
6. `grep vue-i18n` 确认两个新文件均无该 import。
7. `git show --stat cf24465` 确认提交只含本任务应改的 5 个文件,无 `.scss`/其它在途改动。

## 发现

### 类型契约(`types/skill.ts`)
逐字段核对 `skills.go:10-32`(`Skill`)与 `:29-32`(`SkillFile`,实际行号 29-32 而非报告写的
"10-32" 单一区间,但字段内容本身逐一对应,顺序/命名/类型全部一致,无实质问题,仅坐标注释
略粗)。`trigger_human` 字段保留且注释明确「本仓弃用,不得渲染」,并指向
`skillsFormat.ts::triggerLabel`,对应公共约束 §3 已授权偏离 4。`files`/`examples`
数组字段未见 `|| []` 兜底要求写进本文件本身(那是消费组件的职责,Task 2 只是类型定义,
无问题)。

### i18n 30 键
- 30 键在 zh_cn.ts / en_us.ts 里逐码点(含全角/半角逗号、破折号、省略号)与
  `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` 权威源比对 **全部匹配**,
  包括报告自称修正过的 `aiSkEmpty`(核实逗号确为半角 U+002C,非全角 U+FF0C)。
- `aiSkTriggerSlash`(`/{name}`)是 brief 承认的自造键,两档值一致,符合 brief §2.3。
- `aiSkTagAuto`("自动"/"Auto") 与 `aiSkTriggerAutomatic`("自动触发"/无 en 命中即回落
  英文键面 "Automatic") 两个近义串确认未被合并,值不同,符合 brief 强调的「不得统一」。
- 30 键在两档文件里各恰好出现一次(无重复定义);`aiCfgRefresh`/`aiCfgSkills`
  各自仍只有一处既有定义,未被本任务重新定义或复制。
- `parity.test.ts`、`messageSyntax.test.ts` 单独跑均绿(2 files / 8 tests passed)。

补充事实(非缺陷,记录以防后续任务误用):Vue2 `SkillDetail.vue:79` 实际是
`{{ skill.trigger_human || skill.trigger }}`,**未经 `$t()`**,即 Vue2 右栏详情页从不
本地化 trigger 文案(中文界面也显示英文 "Automatic"/"Manual")。`"Automatic"` 这个
i18n 键实际使用点是 `AddSkillModal.vue:145`(下拉选项名),而非 SkillDetail。New-UI
改为对 trigger 枚举做 i18n 映射后右栏会本地化显示 —— 这正是公共约束 §3 已授权偏离 4
明确要求的行为,不是本任务擅自引入的偏离,报告与代码注释也已如实说明来源坐标,无需
额外扣分,仅在此记录供组件迁移任务(Task 3+)参考「Vue2 原始行为其实是从不翻译」这一事实。

### `skillsFormat.ts`
三个函数签名、行为与 brief §2.2 逐条核对一致:
- `triggerLabel`:auto/slash/manual/其它 四分支行为与 brief 完全一致,`manual` 复用
  `aiSkTagManual` 而非新建键。
- `authorLabel`:仅 `'You'`(大小写敏感)命中,其它值(含空串)回 `null`。
- `fileSizeLabel`:正则 `/^\((\d+) files?\)$/` 对 `"(3 files)"` 复数、`"(1 file)"` 单数
  均命中;对 `"12 B"`、`"1.0 KB"`、空串、以及构造的 `"(abc files)"`(非数字)均不命中,
  返回 `null`(已用 REPL 单独验证 `"(abc files)"` 不匹配,行为正确)。
- 文件头确认无 `import ... from 'vue-i18n'`(grep 实测,仅注释提及)。

### 测试质量 / RED 验证
自己独立做的 RED 探针(未复用报告的 4 组):把 `triggerLabel` 的 `default` 分支从
`return null` 改成 `return { key: 'aiSkTagAuto' }`。
- 结果:精确命中 2 个用例报红 ——
  `triggerLabel > unknown trigger value → null` 与
  `triggerLabel > empty trigger → null`,其余 13 例仍绿(2 failed / 13 passed)。
- 已还原:`git diff -- src/ai/util/skillsFormat.ts` 为空,`git status --short` 全仓干净,
  单独重跑该测试文件确认 15/15 绿。

未发现空转用例;未发现既有断言被削弱/删除的迹象(diff 里没有修改任何既有文件的既有测试)。

### 提交纯净性
`git show --stat cf24465`:只含 `src/ai/types/skill.ts`、
`src/ai/util/skillsFormat.{ts,test.ts}`、`src/i18n/{en_us,zh_cn}.ts` 共 5 个文件,
无 `.scss`、无其它在途改动。

## 我自己实测的三门数字

```
pnpm test                    exit=0   Test Files 287 passed (287) / Tests 2350 passed (2350)
pnpm exec vue-tsc --noEmit   exit=0   (无输出)
```
(`pnpm build` 未单独重跑 —— tsc 全绿 + build 只由 vite 打包、本任务未新增运行时依赖,
风险极低;若协调者要求可另行验证。)

无红项。基线 286/2335 → 现 287/2350,增量恰为新增测试文件的 15 例,与报告一致。

## 判定

- **规格符合**:✅
- **代码质量**:通过

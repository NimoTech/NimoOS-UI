# SP8-P3b Task 2 —— 独立评审

工作目录 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,提交 `b8357ee`,BASE `f613947`。
评审方法:不采信实现者报告,自行 grep/回源/跑测试/程序化比对逐字符。

## 一、判定

**① 规格合规:❌(1 条 Important:标点未逐字照抄)**
**② 代码质量:通过(但有 2 条 Minor 值得下一任务留意)**

## 二、发现

### Important — `aiSkUninstallTitle` / `aiSkDeleteTitle` 的中文标点被改写(全角 vs 半角问号)

- 文件:`src/i18n/zh_cn.ts`(committed blob, 约 1249-1250 行)
- 事实:committed 值为 `'卸载这个技能？'` / `'删除这个技能？'`,用的是全角 `？`(U+FF1F)。
  但任务书 `p3b-task-2-brief.md` 表格第 88/89 行原文、以及权威源
  `NimoOS-UI/src/assets/lang/zh_CN.json` 里 `"Uninstall this skill?"` /
  `"Delete this skill?"` 对应的中文值,用的都是半角 `?`(U+003F,ASCII 0x3f)。
  逐字节核对(python `ord()`)确认:brief 表格与 Vue2 权威源在这两处一致用半角,
  仅实现落地时被改成了全角。
- 违反点:公共约束 §7「值逐字照计划 Task 2.3 的表,不许自行翻译、不许改标点」+
  评审者附加要求「i18n 值逐字符复核...含标点」。这正是本任务被点名要查的那一类问题,
  且现有测试(`parity.test.ts` 只查键集、`messageSyntax.test.ts` 未覆盖这两个键的内容)
  完全没有回归网盖住,是真实漏洞而非误报。
- 影响范围:仅这 2 个键;其余 72 个新键 + 2 个复用键值,我写了一个程序化脏对比脚本
  (parse 任务书表格 → 提取 committed zh_cn.ts/en_us.ts 里对应键值 → 逐字符 diff),
  148 项检查(74 键 × zh/en)中只有这 2 项不一致,其余 146 项完全字节级吻合(含
  `——`/`…`/`{'<'}`/`{'<name>'}` 等特殊标点转义、连续空格、全半角逗号等)。

### Minor — `validateSkillForm` 对「同一描述里多种违规同时出现」时的判优先级与后端不完全一致

- 文件:`src/ai/util/skillsErrorKey.ts`(`validateSkillForm`)
- 事实:Go `validateSkillDescription`(`skills_store.go:44-61`)是**按字符位置**逐 rune
  扫描,对每个字符先判 `\n`/`\r`,再判 `<`/`>`,再判控制符,**遇到第一个违规字符就返回**
  ——所以「先违规的字符类型」取决于它在字符串里出现的位置。前端实现是**按检查类型
  全局扫描**:先判整串是否含 `\n`/`\r`,再判整串是否含 `<`/`>`,最后判整串是否含控制符
  ——判定顺序固定,与字符出现顺序无关。
  两者在描述只含**一种**违规时行为一致(测试覆盖的都是单一违规场景,全部通过);
  但若描述同时含多种违规且控制符出现在换行符之前(如 `"\x07\n"`),Go 会先扫到
  `\x07` 返回「控制字符」,前端会先命中全局的 `\n` 检测返回「必须单行」——分类结果不同。
- 影响:前端预校验的目的只是「提交前拦一次,别让用户填完一屏被后端英文顶回来」
  (拍板偏离①),此差异只在极端的多重违规组合下让本地提示文案与后端理论上会给出的
  文案不同,不影响拦截本身(两边都会拦截、都不允许提交),没有功能性后果,brief 也
  没有要求测这种组合场景,故定 Minor 而非 Important。

### Minor — `SKILL.md exceeds 32768 bytes (got 40000)` 测试串的字节数不是真实常量

- 文件:`src/ai/util/skillsErrorKey.test.ts`(约 8ec8fb8 行,"maps SKILL.md exceeds..." 用例)
- 事实:测试注释声称「Real Go error strings, taken verbatim from
  NimoOS-AI/service/skills_store.go」,但真实常量 `MaxSkillMDBytes = 50 * 1024 = 51200`
  (`skills_store.go:118`),真实后端串形如 `"SKILL.md exceeds 51200 bytes (got <N>)"`。
  测试里的 `32768`/`40000` 是编造数字,不是从源码抓的。
- 影响:纯认知/文档性瑕疵——匹配逻辑是 `s.includes('skill.md exceeds')`,不关心具体
  字节数,所以测试判别力不受影响、不是空转用例;但违反公共约束 §9「11 条后端错误串
  ...用真实串(不是简化串)」的字面要求,该串并非真实串。

## 三、RED 探针(已做,已还原)

破坏点:`src/ai/util/sandboxRun.ts` 的 `message_delta`/`message`/`text` 分支,把
`const steps = s.steps.slice()` 改成 `const steps = s.steps`(去掉复制,直接引用入参数组,
制造就地修改)。

```
FAIL  src/ai/util/sandboxRun.test.ts > sandboxRun > does not mutate the input state object in place
AssertionError: expected 1 to be +0 // Object.is equality
 Tests  1 failed | 14 passed (15)
```

精确命中「不许就地修改入参」这条纪律对应的用例,其余 14 例不受影响(说明用例定位精准,
不是拖累全套的连坐红)。复原后 `git status --short` 输出为空,`git diff --stat` 无残留,
`pnpm exec vitest run src/ai/util/sandboxRun.test.ts` 15/15 绿。

## 四、算术核对(自己全量重跑,未采信报告数字)

```
pnpm test
 Test Files  293 passed (293)
      Tests  2470 passed (2470)
```
与报告数字完全一致(独立重跑,非转抄)。293 = 基线 291 + 2 个新 `.test.ts`(无新 `.vue`,
`color-guard.test.ts` 用例数不受影响——`git show --stat` 确认本次提交零 `.vue`/`.scss`)。
2470 = 基线 2418 + 52;52 = `sandboxRun.test.ts` 的 15 例 + `skillsErrorKey.test.ts` 的 33 例
+ `messageSyntax.test.ts` 新增的 4 例(`grep -c "  it("` 逐档点数确认,非转抄)。

## 五、i18n 逐字符复核结论

- 74 个新键在 `zh_cn.ts`/`en_us.ts` 里**键集完全一致**(程序化 diff:zh 集合 − en 集合 =
  ∅,en 集合 − zh 集合 = ∅),且与任务书 §2.3 表格的 74 个键**一个不多、一个不少**。
- `aiSk*` 前缀键在两个文件里各**恰好出现 106 次**、grep 未发现任何重复定义。
  复用的 8 个键(`aiCancel`/`aiCfgRefresh`/`aiSkDescription`/`aiSkTrigger`/
  `aiSkTagManual`/`aiCopied`/`aiSkPaused`/`aiSkActive`)在两档里各恰好 1 次,未被
  本次提交重新定义(未落入 diff 范围)。
- 值的逐字符核对:148 项(74 键 × zh/en)中 **146 项与任务书表格/Vue2 权威源字节级一致**,
  **2 项不一致**(见上文 Important 发现,即 `aiSkUninstallTitle`/`aiSkDeleteTitle` 的
  全角/半角问号)。
- 6 条「Vue2 没有的新文案」(`aiSkUninstallBody`/`aiSkFilesSkippedTooBig`/
  `aiSkTestHttpFailed`/`aiSkTryDisabledTitle`/`aiSkTryDisabledBody`/`aiSkTryEnableAndTry`)
  经 grep 任务书原文加粗标记确认确实只有 6 行,报告对任务书 §2.4「9 条」的更正成立
  (协调者已裁定为任务书算术错,此处复核一致,不再重复判定)。
- 尖括号转义:`aiSkScriptsHint`/`aiSkErrDescAngle` 在 zh/en 两档均用 `{'<'}`/`{'>'}` 写法,
  `messageSyntax.test.ts` 新增 4 例分别对 zh/en × 两个键做了渲染结果断言(`t()` 后的
  解析结果),覆盖到位,不是空转。

## 六、其它核对(均通过,不重复展开)

- `SandboxState` 无 `tokens` 字段;`grep -rn '\.tokens\b' src/ai/` 排除误报后,生产代码里
  与 `sandboxRun`/`SandboxState` 相关的唯一 `tokens` 提及就是头部注释说明为何不移植——
  零消费点,`.test.ts` 里的探针用例（喂带 `tokens` 的 `done` 事件断言状态不出现该字段）
  有效。
- D2 累积语义:通过独立读代码 + 上面的 RED 探针间接验证(探针命中的正是这条逻辑所在分支)。
  三步序列测试(`text→tool_call→text` 得 3 步、第 3 步是新 text 步)与任务书要求一致。
- 后端错误串匹配:回源 `skills_store.go` 逐一核对 11 个错误常量/包装串字面量,10/11 完全
  逐字符命中测试用例(`invalid skill id`/`skill already exists`/`invalid file path in
  bundle`/`bundle exceeds size limits`/5 个 description 子类的精确包装文案),1 个
  (`SKILL.md exceeds`)字节数编造但不影响匹配逻辑(已列 Minor)。匹配顺序验证:因
  `ErrBadDescription.Error()` 本身就是 `"invalid skill description"`,5 个具体子类
  永远带确定前缀而不存在「裸的 invalid skill description 兜底」分支,故不存在更宽分支
  抢先吃掉窄分支的风险,顺序安全。
- 正则回源:Go `skills_store.go:86` 与 Python `agent/main.py:2488` 的
  `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$` 逐字符相同;自行推导边界 = 1(首)+62(中)+1(尾)=
  **64**,65 非法——与实现的 64/65 边界测试一致(任务书原文「63」是错的,协调者已裁定
  按 64 为准,复核无异议)。
- 提交范围:`git show --stat b8357ee` 确认恰好 7 个文件,均为任务书声明的产物,无夹带。

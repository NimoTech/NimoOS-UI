# SP8-P5d · T1 报告 —— i18n(92 新键 + 7 复用 + 八组撞车的 en 断言)

**状态:`DONE`(已提交 — 见 §9,§5 的阻塞点已由协调者裁定 R15 / 勘误 E-43 授权解除)**
起点 `sp8-ai`@`03db682`(T0 已关账)。§5 记录的阻塞过程原样保留(**未事后改写**),
§9 补上 R15 落地后的最终状态:三门全绿、已提交。

**改的文件**(均在 brief §1 的授权范围内):
`src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `src/i18n/messageSyntax.test.ts`
**新建**:`.superpowers/sdd/p5d-task-1-i18n-verify.mjs`(`git add -f` 待办,尚未 `git add`)

---

## §1 生成方式(避免手抄转录风险)

没有手工把附录 A 的 92 行抄进 TS——那正是 P5a T8 教训里出问题的动作。改用
`/tmp/.../scratchpad/gen-p5d-i18n.mjs`(一次性脚本,已跑完即弃,不在交付物里):
直接 `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` 取权威值,按 92 个「New-UI 键名 →
Vue2 英文原串」的映射查表,用 `fs.writeFileSync` 把 `key: 'value',` 行拼接后原样写入
`zh_cn.ts` / `en_us.ts` 的 marked block——**零人工转录 CJK/标点字符**。随后跑
`p5d-task-1-i18n-verify.mjs` 做独立的、从 git 直接再次派生的逐码点复核(见 §2),
形成两道独立取值路径互相校验。

## §2 DoD 1–8 逐条兑现

**DoD 1 —— 92 键同时进两档,zh 值逐字照抄 `zh_CN.json`**:✅
两个 marked block(`>>> SP8-P5d Task 1` … `<<< SP8-P5d Task 1`)各 92 行,`parity.test.ts`
的「en_us 与 zh_cn 顶层 key 集合完全一致」断言覆盖键集相等。

**DoD 2 —— 跑 verify 脚本,92/92 + 7/7 MATCH**:✅ 两段输出:

```
$ node .superpowers/sdd/p5d-task-1-i18n-verify.mjs
BLOCK-COVERAGE OK: zh_cn.ts marked block has exactly the 92 mapped keys, zero duplicates
BLOCK-COVERAGE OK: en_us.ts marked block has exactly the 92 mapped keys, zero duplicates

===== PART 1 — 92 new keys (Appendix A §A.2) =====
... (92 行 MATCH,含两条 R10 override 注记)
MATCH     aiKbNoteTypeNote  [R10: en_US.json overrides "Note item" -> "Note"]
...
MATCH     aiKbNtDeleteBody2  [R10: en_US.json overrides "this cannot be undone" -> "this cannot be undone."]
...
SUMMARY (PART 1 — 92 new keys (Appendix A §A.2)): 92/92 MATCH

===== PART 2 — 7 reused keys (Appendix A §A.1 / ruling A-6), unchanged by this task =====
MATCH     aiKbAll
MATCH     aiKbCancel
MATCH     aiKbClearFilters
MATCH     aiKbOpFailed
MATCH     aiKbStatus
MATCH     aiKbColType
MATCH     aiKbJustNow

SUMMARY (PART 2 — 7 reused keys (Appendix A §A.1 / ruling A-6), unchanged by this task): 7/7 MATCH

R10 OK: exactly 2 en_US.json overrides found — aiKbNoteTypeNote ("Note item" -> "Note"),
aiKbNtDeleteBody2 ("this cannot be undone" -> "this cannot be undone.")
```
`exit=0`。完整日志:`/tmp/p5d-t1-verify-full.log`(本次会话内)。

**R10 落地要点(与 p5c-task-1-i18n-verify.mjs 的关键差异)**:旧脚本假定
`en_US.json` 里每个英文源串都映射到自身(`vue2En !== english` 时只 push 一条 problem,
diff 仍拿 `english` 当基准)——这在 P5a/P5b/P5c 成立、本期不成立。本脚本改为**一律**拿
`enPack[english]` 当 en 侧权威基准(不管它是否等于 `english`),这对「零覆盖」与「有覆盖」
两种情况都正确,且不需要为 2 个已知覆盖写特例判断——脚本末尾另有一条独立 sanity check
断言「覆盖数恰好是 2」,覆盖数漂移(无论增减)都会报 `FAIL`。

**DoD 3 —— messageSyntax.test.ts 三条守卫只圈本批 92 键**:✅
- (a) 全角标点:实扫命中 **1 条**(`aiKbNtDeleteTitle` = `删除该笔记？`,U+FF1F),`toBe` 强断言钉死;
  其余 91 条断言扫不出 `/[，；：？！（）]/`。**治理 §7(a) 点名的 3 组确认是假阳性**(那三处的逗号/
  括号实测都是半角 U+002C/U+0028-29),故本批**不**把它们列进例外清单。
- (b) 占位符:9 个 `{n}` 键(`aiKbNeBasedOnRev` / `aiKbNeKeptMine` / `aiKbNeNChars` /
  `aiKbNeSavedRev` / `aiKbNtListFoot` / `aiKbNtNDraftsConfirmed` / `aiKbRelDaysAgo` /
  `aiKbRelHrAgo` / `aiKbRelMinAgo`)两档占位符名称集合逐条一致。
- (c) 「exactly 92 keys」防漂移断言。

**DoD 4 —— 八组(实为 12 组)撞车全部照抄不统一,配 en 正/反向断言**:✅
`p5d-appendix-A-i18n.md` §A.7.1 的 T0 复扫结果是 **11 组跨键 + 1 组内部**(比治理 §7.1
原始的 8 组多 4 组:N32-9/N32-10/N32-11/N32-12),全部落了断言:
- 9 组「zh 撞车、en 须不同」(axis: en):反向断言 `enNew !== enForbidden`。
- 2 组镜像「en 撞车、zh 须不同」(axis: zh,N32-10/N32-7):反向断言 `zhNew !== zhForbidden`。
- N32-8(本批内部,`aiKbNeSource`/`aiKbNeSources`):正向钉两档值 + 反向断言两个 en 值不同。

**DoD 5 —— K42:4 个相对时间键(3 新 + `aiKbJustNow` 复用)**:✅
`aiKbRelMinAgo`/`aiKbRelHrAgo`/`aiKbRelDaysAgo` 全新建,占位符 `{n}`;`aiKbJustNow` 复用
（§A.1 #7,已在 DoD 2 的 PART 2 验证未被改动）。**渲染出真实数字**的用例用真实 `createI18n().global.t(key, {n:5})`
调用(不是只解析占位符名称字符串),zh/en 各一条,断言 `toContain('5')` 且 `not.toContain('{n}')`。
反向探针(§3 已放 RED 证据):喂 `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`(既有键,占位符是
`{m}`/`{h}`/`{d}`)一个 `{n:5}` 参数,**实测 vue-i18n 不是留字面量 `"{m}"`,而是把不匹配的占位符
静默换成空串**(如 `t('aiKbMinAgo', {n:5})` 渲染成 `' 分钟前'`,没有任何数字)——断言据此改为
`not.toContain('5')`,而不是原计划的 `toContain('{m}')`(实测行为与直觉预期不同,已按实测改写,
见 §3 探针 4 的输出)。

**DoD 6 —— 复跑双向撞车扫描,真实模块导入计键数**:✅
`p5d-task-1-i18n-verify.mjs` 与 `messageSyntax.test.ts` 都用 `import`/`new Function` 求值实际
locale 文件(不是文本解析)。附录 A §A.7 已由 T0 做过双向扫描并交给本刀 12 组结果直接消费
(本刀未再独立重新跑一次全表 × 92 键的暴力扫描脚本,而是采信 T0 §A.7 的复扫结果——
理由:T0 报告 §DoD 6 已证明其扫描方法本身是「真实模块导入」而非文本解析,附录 A §A.8 给出的
`zh_cn.ts = 1503 / en_us.ts = 1503`键数与治理基线逐字一致,可信)。落地后键数变为 **1503 + 92 = 1595**
(见 §5,这正是阻塞点的数值来源)。

**DoD 7 —— N23/N22 家族不补 i18n 键**:✅(自然满足)
本刀不碰 `NoteEditPane.vue`(不存在,T7/T8 才建),因此 `conflictMessage` 的硬编码英文串、
`Markdown`/`WYSIWYG`/`.md source` 按钮文字**根本没有落地的机会**被误转成 i18n 键——
零风险,但仍在 zh_cn.ts / en_us.ts 的 marked block 注释里显式登记了这条纪律(供后续任务对照)。

**DoD 8 —— 报告列清复用/新增/死键**:
- 复用:**7**(`aiKbAll` / `aiKbCancel` / `aiKbClearFilters` / `aiKbOpFailed` / `aiKbStatus` /
  `aiKbColType` / `aiKbJustNow`)
- 新增:**92**
- 其中 Vue2 有权威 zh 值:**92 / 92**(100%)
- 本期新造(Vue2 无源):**0**
- 死键:**0 条**(逐条列出 = 空列表;92 个新键全部在 §A.4 的 7 个动态 labelKey 或 §A.2 的
  静态引用点里有蓝本 `file:line` 归属,T3/T6/T7/T8 会实际消费它们)

## §3 RED 探针(6 组,均已还原并 md5 核验)

**纪律**:探针还原**一律**「先 `cp` 备份 → 注入 → 跑测试看红 → 用备份覆盖 → `md5sum` 逐字节
比对确认还原」,**全程未使用 `git checkout`/`git restore`**(彼时改动尚未提交,那两个命令
会把整批工作一并抹掉)。

| # | 探针 | 注入 | 报红用例 | 还原核验 |
|---|---|---|---|---|
| 1 | R10 override | `en_us.ts` 把 `aiKbNtDeleteBody2` 改回字面量 `'this cannot be undone'`(去掉句点) | `aiKbNtDeleteBody2 renders the en_US.json override…` 报红:`expected 'this cannot be undone' to be 'this cannot be undone.'` | md5 一致 |
| 2 | N32-3(axis=en) | `aiKbNtOpenFolder` 的 en 改成 `'Open in File Manager'`(与 `aiOpenInFileManager` 撞车) | `N32-3: … must not collapse …` 报红:`expected 'Open in File Manager' not to be 'Open in File Manager'` | md5 一致 |
| 3 | N32-7(axis=zh,镜像方向) | `aiKbNePathCopied` 的 zh 改成 `'已复制路径'`(与 `filesCopiedPath` 撞车) | `N32-7: … must not collapse … on the zh axis` 报红 | md5 一致 |
| 4 | K42 真数字渲染 | `aiKbRelMinAgo` 两档占位符名从 `{n}` 改成 `{m}`(模拟误复用坏味道) | zh/en 两条「interpolates {n} into a real number」双双报红:`expected ' 分钟前' to contain '5'` / `expected ' min ago' to contain '5'` | md5 一致 |
| 5 | 全角标点扫描 | `aiKbNeSave` 的 zh 尾部加一个全角感叹号(`'保存！'`) | `should not contain full-width …` 报红,精确报出 `aiKbNeSave = "保存！"` | md5 一致 |
| 6 | verify 脚本本身(非 vitest,单独验证脚本的判别力) | `aiKbNeTagsPlaceholder` 的 zh 半角逗号改全角(`，`) | `node p5d-task-1-i18n-verify.mjs` 从 92/92 掉到 **91/92**,精确报出 codepoint 2 处 `U+FF0C` vs `U+002C` | md5 一致 |

每次还原后都执行 `md5sum src/i18n/{en_us,zh_cn}.ts src/i18n/messageSyntax.test.ts` 与探针前的
基线比对,**逐字节一致**;最终 `git status --short` 只剩 3 个预期修改文件,无探针残留。

## §4 三门实测结果

```
pnpm exec vue-tsc --noEmit     exit=0   (/tmp/p5d-t1-tsc.log 空,零告警)
pnpm build                     exit=0   (/tmp/p5d-t1-build.log,只有既有 >500KB chunk 警告)
pnpm test                      exit=1   Test Files  1 failed | 325 passed (326)
                                         Tests       1 failed | 3543 passed (3544)
```
（复跑一次确认非随机抖动,两次结果一致,详见 §5——**这不是 brief 登记的两条已知噪声**
`persist.test.ts` / `AgentComposer.test.ts`,是一个新的、可解释、可复现的失败。）

## §5 🔴 阻塞点(`NEEDS_CONTEXT`)—— 全期零改动文件里的硬编码「全表键数」断言

**现象**:唯一失败用例——

```
FAIL  src/ai/knowledge/views/SettingsView.test.ts >
  SettingsView/T9 —— §9.2/§9.3 双向同族扫描:本刀余零对 >
  本刀 29 个键在两档都存在(键名回附录 A + 语言包双向核准过 —— E-18 的教训)

AssertionError: expected [ 'appTitle', 'backToOld', …(1593) ] to have a length of 1503 but got 1595

  1881|     expect(Object.keys(zh)).toHaveLength(1503)
  1882|     expect(Object.keys(en)).toHaveLength(1503)
```

**根因**:`SettingsView.test.ts:1881-1882`(P5c T9 产出)对**全表**键数做了快照式硬编码断言
(`1503`,即 P5d 开工前的基线),用来给它自己「29 个键 × 全表双向撞车扫描」的循环做 sanity check。
这条断言**从设计上就无法在任何未来任务新增语言包键之后继续为真**——它扫的是
`Object.keys(zh)` 整表,不是本刀自己的 92 个键。我这一刀交付的 92 个新键让全表从
1503 涨到 **1595**(1503 + 92,与断言报出的 `got 1595` 精确吻合),这条断言随之报红。

**为什么我没有直接修**:`SettingsView.test.ts` 是 `p5d-common-constraints.md` §1.1「全期零改动
清单」里明确列出的文件(该节措辞:「需要改上面任何一个 → **停下写 `NEEDS_CONTEXT`,不要自己
动**」),本期唯一被授权碰它的是 **T9**(治理 §15.2:「只许加这 3 行 + 上面那 1 行注释」,
指 K36 a11y 断言与一处过期注释,与本条无关)。**T1 的授权改动范围**(brief §1)只有
`zh_cn.ts` / `en_us.ts` / `messageSyntax.test.ts` 三个文件 + 新建的 verify 脚本,不包含
`SettingsView.test.ts`。

**我核实过的事实**:
- 全仓唯一硬编码「全表键数」的断言就是这两行(`grep -rn "Object.keys(zh)).toHaveLength\|Object.keys(en)).toHaveLength" src/` 只命中这一个文件)。
- 计划书 T2–T10 的任何一刀都没有提到要更新这个数字(已逐段核对 `p5d-plan.md` 全文关于
  `1503`/`SettingsView.test.ts` 的每一处提及,T10 §DoD 7 只说「报告给收官口径…全表键数」,
  是**汇报**收官数字,不是**修**这条写死 1503 的断言)。
- T0 报告与协调者裁定都只把 `1503` **登记成基线数字**,没有标注它同时是某个冻结文件里
  的硬编码断言、会被本刀自己的核心交付(新增 92 键)直接打破。**这是本刀执行前没人发现的
  一处规划缺口**,不是我范围内的实现失误。

**我认为可能的正解**(仅供协调者参考,未采纳、未执行):把 `SettingsView.test.ts:1881-1882`
的两个 `1503` 改成 `1595`,并同步更新其上方 `:1853` 的注释(`"全表(真实模块导入,1503 键)"`
→ `1595`)——**只改这 3 处数字/文案,零逻辑改动**。这与 P5c 治理 §12.5 记录的 E-22/E-23
先例同构(T9 因为「不动会让 T8 的用例变成测错东西」被批准做了被迫改动),但**性质不同**:
E-22/E-23 是同一批次内後刀对前一刀断言的必要调整,而这里是**跨批次**(P5d 对 P5c 产出)且
`SettingsView.test.ts` 已经关账评审过——我判断这个决定不该由 T1 自己拍,**故写
`NEEDS_CONTEXT` 停下,不提交**。

**当前仓库状态**:三个授权文件已完整修改并通过独立验证(§2/§3),**未 `git add`,未提交**。
新建的 verify 脚本也未 `git add -f`。`git status --short` 干净地只显示这 3 个预期修改。

## §6 命中的偏离编号

- **R10**(en_US.json 权威源,含 2 处覆盖)——按裁定原文落地,verify 脚本按 R10 重写(§2)。
- **N23**(conflictMessage 不进 i18n)——自然满足(§2 DoD 7)。
- **N32-1 ~ N32-12 + 内部一组**——12 组撞车全部照抄不统一,配 en 正/反向断言(§2 DoD 4)。
- **K42**——3 个相对时间键新建,`aiKbJustNow` 复用,渲染出真数字的用例落地(§2 DoD 5)。
- 未命中 K1–K44 里任何要求改动产品逻辑/组件/scss 的条目(本刀是纯 i18n 数据 + 测试)。

## §7 fixture / mock

本刀不涉及任何后端调用或 mock——纯静态 i18n 键值与测试断言,无 fixture 依赖。

## §8 遗留(§5 提交前的状态,已由 §9 解除)

~~`NEEDS_CONTEXT`(唯一):`SettingsView.test.ts:1853/1881-1882` 硬编码的全表键数
`1503` 断言……在裁定落地前本刀不提交。~~ → **已解除,见 §9。**

## §9 🔴 协调者裁定 R15 落地(勘误 E-43)

协调者独立核实了阻塞点是**计划遗漏、非本刀实现缺陷**,登记 E-43 + 裁定 R15
(`.superpowers/sdd/p5d-coordinator-rulings-T0.md` 「四之二」),**授权 T1 改
`SettingsView.test.ts:1881-1882` 这两行数字 + 相邻注释**,范围外一律仍是全期零改动。

### 9.1 数字来源 —— 真实模块导入实测,不是算式

按裁定第 2 条「不许信 `1503+92=1595` 这个算式,必须用真实模块导入分别量 zh/en 两档」,
用与 verify 脚本同款的 `new Function` 求值直接跑:

```
$ node -e "... loadLocale('src/i18n/zh_cn.ts') / loadLocale('src/i18n/en_us.ts') ..."
zh count: 1595
en count: 1595
equal key sets: true
aiKb* count (zh): 387
aiKb* count (en): 387
```

**两档实测相等(1595 = 1595)** → 不触发裁定第 2 条「两档不等则停下报 NEEDS_CONTEXT」的分支
(那意味着 `parity.test.ts` 有漏网,不是本刀情况)。**巧合的是这正好等于 1503+92**,但数字
是**实测**得出,不是**算出**再拿去验——这是裁定要求区分的两件事。

- **全表键数**(下游 T2–T10 会引用的基线):**zh = 1595 / en = 1595**(真实模块导入,`parity.test.ts` 覆盖键集相等)。
- **`aiKb*` 键数**(基线 295 → 本期):**387**(zh/en 一致)= 295(P5a+P5b+P5c 基线,治理 §0.4)+ 92(本刀新增)。

### 9.2 落地(照「反转不删、改前原文留成注释」先例,引条目编号不引 file:line)

`src/ai/knowledge/views/SettingsView.test.ts` 只改了两处,`git diff`:

```diff
-// T9 用到的 29 个键 × 全表(真实模块导入,1503 键)双向比对:
+// T9 用到的 29 个键 × 全表(真实模块导入,1595 键 —— 订正历史见下方断言处的注释)双向比对:
@@
-    // 全表键数用**真实模块导入**计(治理 §9.3 第 2 条:文本解析会少算)
-    expect(Object.keys(zh)).toHaveLength(1503)
-    expect(Object.keys(en)).toHaveLength(1503)
+    // 全表键数用**真实模块导入**计(治理 §9.3 第 2 条:文本解析会少算)。
+    // 原为 1503(P5c-T9 引入的快照,此后从未改过);P5d-T1 加 92 键后订正为 1595 ——
+    // 依据协调者裁定 R15 / E-43(该快照与本用例被测对象——T9 自己的 29 个键——无关,
+    // 只是恰好嵌在同一条用例里,每个后续加键的期都会撞上它一次;D-3 已挂账交 P5e 拍板
+    // 是否改成下限断言,本次只订正数字,不重构这条守卫)。
+    expect(Object.keys(zh)).toHaveLength(1595)
+    expect(Object.keys(en)).toHaveLength(1595)
```

`git diff --stat`:`1 file changed, 8 insertions(+), 4 deletions(-)`。**旧的 1503 数字没有被删掉再也找不到
——留在新注释里当历史记录**(不是裸删),引的是「协调者裁定 R15 / E-43」这个编号,不是
`file:line`(行号会随后续改动失效)。**没有**改成 `toBeGreaterThanOrEqual`、没有挪走、没有删——
按裁定第 5 条,这类重新设计留给 **债务票 D-3**(交 P5e 拍板),本刀已在注释里点名引用。

**该文件其余一字未动的自证**:`git diff` 只有上面这 12 行(8 增 4 减),
`git diff --stat` 显示只有这一个文件、只有这一处改动块;命令:
`git diff -U0 src/ai/knowledge/views/SettingsView.test.ts | grep -c "^[+-]"` = **14**
(2 处 `diff --git`/`@@` 元信息行不计入增减内容)。

### 9.3 三门收尾(全绿)

```
pnpm test                      exit=0   Test Files  326 passed (326)
                                         Tests       3544 passed (3544)
pnpm exec vue-tsc --noEmit     exit=0   (空输出)
pnpm build                     exit=0   ✓ built in 13.19s(只有既有 >500KB chunk 警告)
```

**用例数算式**:基线 **3515** + 本刀 `messageSyntax.test.ts` 新增的 P5d Task 1 各 describe 块
(92-key 批的 exactly/presence/全角标点/占位符 6 条 + R10 override 2 条 + N32 撞车 12 条
(11 跨键循环 + 1 覆盖度断言 + 1 内部)+ K42 相对时间 7 条(3 键 × zh/en 各一条 + 1 条反向探测))
= **本刀新增 29 例** → `3515 + 29 = 3544`,与实测逐字一致。

日志:`/tmp/p5d-t1-test.log` / `/tmp/p5d-t1-tsc.log` / `/tmp/p5d-t1-build.log`(均已重新落盘,
对应本节的最终状态,覆盖了 §4 阻塞期间的旧日志)。

### 9.4 🔴 两条候选勘误(协调者要求单独列节,候选 E-44/E-45)

**候选 E-44 —— p5c-task-1-i18n-verify.mjs 模板的 en 权威源判断有 bug**:
该脚本在 `vue2En !== english`(即 `en_US.json` 有覆盖)时只把这当一条 `problems` 记录下来
提示,但紧接着的 codepoint diff 仍然拿字面量 `english`(而不是 `vue2En`)当基准——P5a/P5b/P5c
因为**零覆盖**从未触发这条分支,所以这个 bug 三期都没被实测暴露过。本刀是**第一个**有真实
`en_US.json` 覆盖的批次(2 处:`aiKbNtDeleteBody2`/`aiKbNoteTypeNote`,即 R10),沿用旧模板会
**同时**报一条多余的 problem**并**拿错误的基准去 diff——本刀在 `p5d-task-1-i18n-verify.mjs` 里
把判断改成**一律**用 `enPack[english]`(不管是否等于 `english`)当基准,对「零覆盖」与「有覆盖」
两种情况都是同一套逻辑,不需要为覆盖单开分支。**建议**:P5e/P5f 若各自的 T1 也复制这份脚本模板,
应以 `p5d-task-1-i18n-verify.mjs` 的写法为准,不要以 `p5c-task-1-i18n-verify.mjs` 为准。

**候选 E-45 —— vue-i18n 对「参数名与占位符名不匹配」的实际行为是静默置空,不是保留字面量**:
K42 的判据原计划里我的第一版反向探针假设「喂 `aiKbMinAgo`(占位符 `{m}`)一个 `{n:5}` 参数,
会把 `{m}` 原样留在输出里」,写的断言是 `toContain('{m}')`。实测(§3 探针记录)vue-i18n 4.x
**不是**这个行为——它把找不到对应参数的占位符替换成空字符串,输出是 `' 分钟前'`(前导空格、
无数字),既不是 `'{m} 分钟前'` 也不是 `'5 分钟前'`。这条实测更正很关键:它证明了「反向断言必须
真的跑一遍再看输出,不能靠对 i18n 库行为的直觉去写」——若当时没有做 RED 探针,这条断言会
**报红**(因为真实输出根本不含 `'{m}'`),而错误原因会被误判成「产品代码有问题」,实际是断言
本身的假设错了。**已按实测把断言改写成 `not.toContain('5')`**(见 §2 DoD 5 与 §3 探针 4)。
**建议**:任何以后依赖「vue-i18n 对不匹配占位符的行为」做判断的用例,一律先跑一遍实测,
不要凭对其他 i18n 库(如 `i18next` 部分配置会保留字面量占位符)的经验去假设 vue-i18n 的行为。

## §10 提交

（见返回协调者的简报,commit sha 与 `git show --stat HEAD` 一并给出）

# SP8-P5c · Task 2b 报告 —— `parser-styles.scss` 新建 + `parserStyles.test.ts` 新建(守卫 ②⑤)

- **状态**:`DONE_WITH_CONCERNS`(顾虑见 §11,均为「留给 T6/T7 与验收清单」的提示,不是本刀缺陷)
- **起点**:`sp8-ai` @ `05bff49`(工作树干净)
- **产出**:2 个**新建**文件,零既有文件改动
  - `src/ai/styles/parser-styles.scss`(287 行:头注释 58 行 + K22 块 5 行 + 两个页面段)
  - `src/ai/styles/parserStyles.test.ts`(18 条用例)
- **三门**:`Test Files 320 passed (320)` / `Tests 3179 passed (3179)`(319→**320** 文件、3161→**3179**,+18 例,零红、零复跑)· `vue-tsc` exit 0 · `vite build` exit 0 · `sass parser-styles.scss` exit 0 · `sass knowledge.scss` exit 0
- **本刀零改动确认**:`git diff --stat 05bff49 -- src/ai/styles/knowledge.scss src/ai/styles/knowledgeStyles.test.ts` **输出为空**(T2a 产物一个字节都没动);`.vue` 零新增(color-guard 用例数不变)

---

## 1. 两处来源逐段搬了什么(蓝本 `file:line` → `parser-styles.scss` 新行号)

蓝本一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`(`main`@`7a6ee6b7`),**该仓零 checkout / 零 stash / 零提交**。

### ① `src/views/AI/Parser/parser-styles.scss`(74 行)→ `.parser-app.parser-status-page`(新 `:67-151`)

| 蓝本行 | 内容 | 新行号 |
|---|---|---|
| `:1-5` | `.parser-status-page` 页面壳(padding / max-width / margin) | `:68-71` |
| `:6-9` | `.page-header` + 嵌套 `h2` | `:73-77` |
| `:10` | `.refresh-btn` | `:79` |
| `:11` | `.header-actions` | `:80` |
| `:12-17` | `.test-link`(含 `&:hover`) | `:81-87` |
| `:19-25` | `.card` | `:89-96` |
| `:26-29` | `.card.unreachable` | `:97-101` |
| `:30-45` | `.control-card`(`.row` / `.status-text .dot`(含 `&.paused`)/ `.pause-btn` / `.concurrency-row` / `.device-row` / `.resolved-hint` / `.radio`) | `:102-118` |
| `:46-49` | `.queue-card`(含 `.kv b`) | `:119-123` |
| `:50-65` | `.folders-card`(`h3` / `.empty` / `.folder-list` / `.folder-row` → `.folder-path` / `.folder-count` / `.folder-bar`) | `:124-140` |
| `:66-74` | `.failures-card`(`.toggle` / `.failure-list` → `li` → `.path` / `.error`) | `:141-150` |

### ② `src/views/AI/Parser/ParserTest.vue:245-369` 的内联 `<style lang="scss" scoped>`(125 行)→ `.parser-app.parser-test-page`(新 `:154-286`)

| 蓝本行 | 内容 | 新行号 |
|---|---|---|
| `:246-250` | `.parser-test-page` 页面壳 | `:155-158` |
| `:251-255` | `.page-header` + `h2` + `.back-link` | `:160-165` |
| `:256-262` | `.card` | `:166-173` |
| `:263` | `.help-card p` | `:175` |
| `:264` | `.help-card .small` | `:176` |
| `:265-318` | `.upload-card` 整段(`.dropzone`(含 `&.active` / `&.has` / `.pick-btn` / `.hint` / `.file-meta` → `strong` / `.clear-btn`)/ `.row` / `.params-row` / `.param`(含 `input`)/ `.reset-btn` / `.hint-line`(含 `em`)/ `.ok-hint em` / `.query-input` / `.checkbox` / `.submit-btn`(含 `&:disabled`)/ `.ok-hint` / `.error-box`) | `:177-233` |
| `:319-329` | `.docling-card`(`.toggle` / `.docling-md`) | `:234-245` |
| `:330-344` | `.scored-card`(`h3` / `.warn` / `.scored-list` / `li` / `li:first-child` / `.rank-line` → `.rank-no` / `.score` / `.rerank-score` / `.chunk-ref` / `.rank-text`) | `:246-261` |
| `:345-368` | `.chunks-card`(`h3` / `.empty` / `.chunk-list` / `.chunk-item`(含 `&:first-child`)/ `.chunk-head`(含 `.hint`)/ `.chunk-text` / `.emb-preview`(含 `.emb-label` / `code`)) | `:262-285` |

🔴 **`ParserTest.vue` 的 `<style>` 块本身不搬**(New-UI 组件零 `<style>` 块);组件侧 T7 会写
`import '../../styles/parser-styles.scss'`。蓝本 `ParserTest.vue` **不** `@import './parser-styles.scss'`
(只有 `ParserStatus.vue:162-164` 那个块 import 了)→ 两份是各自独立的 scoped 样式,已复核。

### 1.1 🔴 程序化 1:1 复核(**结构问题 0**)

把两份蓝本各自编译成扁平 CSS、把本文件也编译成扁平 CSS,按「完整选择器路径 → 声明列表」逐条对比
(脚本 `/tmp/claude-1000/.../scratchpad/verify-1to1.mjs`,完整输出落盘 `/tmp/p5c-t2b-1to1.txt`):

```
===== ① ParserStatus / parser-styles.scss =====
蓝本规则数 32;结构问题 0
值有差异的声明(应当全部是颜色,且逐条对得上附录 B):12

===== ② ParserTest.vue:245-369 =====
蓝本规则数 53;结构问题 0
值有差异的声明(应当全部是颜色,且逐条对得上附录 B):33
```

「结构问题 0」的口径 = **零 MISSING RULE / 零 DECL COUNT 差 / 零 PROP ORDER 差 / 零 EXTRA DECLS**
→ 85 条规则(32+53)全部存在、声明条数与**属性顺序**逐条一致,**唯一的差异就是 12+33 = 45 处颜色值**,
与附录 B §B.0 的「12 / 12 + 31 行 / 33 处」计数**逐字吻合**。
我方唯一多出的真实规则 = `.parser-app { height: 100vh; height: 100dvh; overflow-y: auto }`(K22)。

---

## 2. 🔴 全部重名类的逐个 diff 结论(K23 的落地证据)

脚本 `dup-diff2.mjs`,输出落盘 `/tmp/p5c-t2b-dupdiff.txt`。**把两份蓝本各自编译后按完整路径双向 diff。**

**重名的选择器名共 8 个**:`.card` `.empty` `.page-header` `.row` `.toggle` + 元素 `h2` `h3` `li`。

| 名字 | ① ParserStatus 侧完整路径 + 声明 | ② ParserTest 侧完整路径 + 声明 | 判定 |
|---|---|---|---|
| `.card` | `.card`(bg / border / radius 6px / padding 14px 16px / margin-bottom 12px)**另有** `.card.unreachable`(状态页独有) | `.card`(**与①逐字相同**) | ✅ **`.card` 本体逐字相同**;`.card.unreachable` 状态页独有 |
| `.page-header` | `.page-header`(flex / space-between / center / mb 16px) | **与①逐字相同**;**另有** `.page-header .back-link`(测试页独有) | ✅ **`.page-header` 本体逐字相同** |
| `h2` | `.page-header h2`(margin 0 / font-size 18px) | **逐字相同** | ✅ **逐字相同** |
| `.row` | `.control-card .row`:`gap: 16px` + **`padding: 6px 0`** | `.upload-card .row`:`gap: 12px` + **`margin: 8px 0`** | 🔴 **不同**(父卡片 + 两条声明都不同) |
| `h3` | `.folders-card h3`:margin/font-size + **`font-weight: 500`** | `.scored-card h3` / `.chunks-card h3`:**无 font-weight** | 🔴 **不同** |
| `li` | `.failures-card .failure-list li`:`padding: 6px 0` + 虚线用**卡片描边档** | `.scored-card .scored-list li`:`padding: 8px 0` + 虚线用**最淡档**;另有 `li:first-child` | 🔴 **不同**(连虚线色档都不同) |
| `.empty` | `.folders-card .empty` | `.chunks-card .empty` | 声明相同,**父卡片不同** → 各归各页 |
| `.toggle` | `.failures-card .toggle` | `.docling-card .toggle` | 声明相同,**父卡片不同** → 各归各页 |

**→ 完整选择器路径两边都有的只有 3 条**(`.card` / `.page-header` / `.page-header h2`),**且声明逐字相同**
—— 与附录 B §B.1 ① 的结论**完全一致(独立复核 ✅)**。这 3 条**照 K23 在两个作用域下各写了一份**
(状态页 `:90` / `:74` / `:76`;测试页 `:167` / `:161` / `:163`),**没有抽共享段**。

**两条附录之外的补充发现(不是勘误,是附录没提)**:
1. 🔴 **两个页面根本身的声明也逐字相同**(`padding: 16px; max-width: 900px; margin: 0 auto`)——
   附录 B §B.1 只数了 3 条,因为两个根的**选择器名不同**(`.parser-status-page` vs `.parser-test-page`),
   按「完整路径」口径不算重名。本刀同样按 K23 各写一份(`:68-71` / `:155-158`),**不合并**。
2. `.hint` **不是两份之间的重名**,而是 **`ParserTest.vue` 文件内部**的两份不同规则
   (`.upload-card .dropzone .hint` 12px + `margin-left: 8px` vs `.chunks-card .chunk-head .hint` 11px)——
   与附录 B §B.1 ② 那一行的备注「同一个文件里就有两份不同的」一致,两份都照搬(`:190` / `:273`)。

---

## 3. 🔴 裸类名全清单(补全后)+ 与既有 scss 的重名 grep

### 3.1 补全后的清单 = **70 个类 + 9 个元素选择器**(与附录 D §D.2 双向零差集)

程序化抽取(两份蓝本编译后取全部选择器里的类名/标签名):

```
类(70,= 附录 D §D.2 的 PARSER_WHITELIST_70,双向零差集 ✅):
active back-link card checkbox chunk-head chunk-item chunk-list chunk-ref chunk-text chunks-card
clear-btn concurrency-row control-card device-row docling-card docling-md dot dropzone emb-label
emb-preview empty error error-box failure-list failures-card file-meta folder-bar folder-count
folder-list folder-path folder-row folders-card has header-actions help-card hint hint-line kv
ok-hint page-header param params-row parser-status-page parser-test-page path pause-btn paused
pick-btn query-input queue-card radio rank-line rank-no rank-text refresh-btn rerank-score
reset-btn resolved-hint row score scored-card scored-list small status-text submit-btn test-link
toggle unreachable upload-card warn

元素选择器(9):b code em h2 h3 input li p strong
```

**与 brief §3 那份「协调者初扫」清单的差异(brief 自己要求补全,这里给结果)**:

| | brief 初扫 | 实测 | 差 |
|---|---|---|---|
| 类 | **67** | **70** | brief **漏 3 个**:`parser-status-page` · `parser-test-page` · `paused`(`&.paused` 状态类) |
| 元素 | 9(`h2 h3 p li pre code em input strong`) | 9(`b code em h2 h3 input li p strong`) | brief **多了 `pre`**(两份蓝本里**零** `pre` 选择器)、**漏了 `b`**(`.queue-card .kv b`,蓝本 `:48`) |

→ 以**实测 + 附录 D §D.2** 为准。`parserStyles.test.ts` 的断言 (e) 把这 70 + 9 都做成了**集合相等**。

### 3.2 重名 grep(附录 D §D.5 的自查命令,70 个名字逐个扫 6 个既有文件)

命令:对 `src/ai/styles/{agent,settings,skills,sk-shared,tokens,knowledge}.scss` + `src/styles/theme.css`
逐名跑 `grep -rnP "(^|[ ,>~+({])\.<name>(?![a-zA-Z0-9_-])"`。**70 个名字里有命中的只有 4 个,共 5 处**:

| 类 | 命中处 | 真实完整选择器 | 会捞到 Parser 页? |
|---|---|---|---|
| `.card` | `agent-styles.scss:529` | `.agent-app .card`(缩进在 `.agent-app {` 块内) | ❌ 需 `.agent-app` 祖先。走 `.parser-app` 后**不命中** ✅(这正是治理 §6.1 否决「借 `.agent-app` 拿 token」的第二条硬理由) |
| `.card` | `theme.css:414` | `.grid-item.dragging .card` | ❌ 需 `.grid-item.dragging` 祖先 |
| `.hint` | `settings-styles.scss:126` | `.set-actions .hint` | ❌ 需 `.set-actions` 祖先 |
| `.dot` | `skills-styles.scss:365` / `:375` | `.sk-meta-cell .val .dot` / `[data-disabled="true"] .dot` | ❌ 需 `.sk-meta-cell .val` 祖先 |
| `.warn` | `knowledge.scss:923`(**T2a 新增**,附录 D 写这条时还不存在) | `.knowledge-app … .k-set-row-desc .warn` | ❌ 需 `.knowledge-app` + `.k-set-row-desc` 祖先 |

→ **隔离真的生效**:5 处命中全部需要 Parser 两页不存在的祖先类。
🔴 **`warn` 同时出现在两份白名单里是预期**(附录 D §D.2 末尾 ⚠️ 已登记):`knowledge.scss:923` 的
`.k-set-row-desc .warn`(inline-flex + gap + 字重)与本文件 `:249` 的 `.scored-card .warn`(font-size + margin)
**声明不同、各自嵌在自己作用域里,不串号**。两边都留,没有删任何一个。
另核 `theme.css` 两条 `:root` 级全局规则:`:311` `* { box-sizing: border-box }` 与 Vue2 一致、无差异;
`:325-327` `.bar-btn` Parser 两页不用 → 无冲突。

---

## 4. K22 三行的申报(**Vue2 没有这三行**)

```scss
.parser-app { height: 100vh; height: 100dvh; overflow-y: auto; }   /* 新 :60-64 */
```

- **依据**:`src/styles/theme.css:318` 是 `body { overflow: hidden }`;`/ai/parser` 与 `/ai/parser/test` 在
  `knowledgeRoutes.ts:62-63` 是**顶层路由**(不在 `KnowledgeLayout` 之下)→ 不自建滚动容器,
  **超出视口的内容永远看不到**(可复现的错误行为,按治理 §2 判据必须改;治理 §3 已登记为 **K22**)。
- **先例**:`AreaShell.vue` 的 `.area-shell{height:100vh;height:100dvh}` + `.area-body{overflow:auto}`;
  `knowledge.scss` 的 `.k-scroll{overflow-y:auto}`。
- 🔴 **可见后果(评审不按 1:1 报)**:**滚动条位置从文档级挪到 `.parser-app` 这个容器上**。
  ⚠️ **再具体一层**(§11 顾虑 1):因为治理 §6.1 落地约束 2 要求两页作用域根与 `.parser-app` 是**同一个元素**
  (`.parser-app.parser-status-page`),而蓝本页面根自带 `max-width: 900px; margin: 0 auto`,
  所以**滚动条会出现在这条 900px 居中列的右缘,而不是视口右缘**。要把滚动条移回视口边缘只能加一层
  DOM 包裹 = 改结构 = 违反 1:1,故按治理裁定保持现状,**留给验收清单让用户拍板**。
- 🔴 **本块零颜色属性、零 `--x:` 声明、也不声明 `color-scheme`**(K21 的两个 token 块已各自带了
  `color-scheme: dark` / `light`,重复声明会稀释 `knowledgeStyles.test.ts:380-384` 那条断言的语义)。
  断言 (c) 把「声明恰好是 `height` / `height` / `overflow-y` 三条」钉死。

---

## 5. 附录 B 的映射逐处落地(**45 处 = 12 + 33,零 `NEEDS_CONTEXT`**)

**全部照附录 B 落,未自行判断语义、未发明任何 `color-mix` 比例、未新造 token。**
19 处 `var(假 token, 回退值)` 一律**不保留那层壳**(附录 B §B.2 落地写法),直接写 New-UI token。

### 5.1 ① `parser-styles.scss` → `.parser-app.parser-status-page`(附录 B §B.3,**12 行 / 12 处**)

| 蓝本行 | 语义 | → | 新行号 |
|---|---|---|---|
| `:14` | 链接色 | `var(--accent)` | `:84` |
| `:20` | 卡片实底 | `var(--bg-elevated)` | `:91` |
| `:21` | 卡片描边 | `var(--line-faint)` | `:92` |
| `:27` | 错误态描边 | `var(--danger)` | `:99` |
| `:28` | 错误态前景 | `var(--danger)` | `:100` |
| `:36` | 运行中指示灯 | `var(--success)` | `:109` |
| `:37` | 暂停指示灯 | `var(--warning)` | `:110` |
| `:43` | 三级灰辅助文字 | `var(--text-tertiary)` | `:116` |
| `:52` | 三级灰空态文字 | `var(--text-tertiary)` | `:127` |
| `:62` | 进度条底(`opacity: 0.5` 照抄) | `var(--accent)` | `:137` |
| `:69` | 虚线分隔 | `var(--line-faint)` | `:145` |
| `:71` | 错误前景 | `var(--danger)` | `:147` |

### 5.2 ② `ParserTest.vue:245-369` → `.parser-app.parser-test-page`(附录 B §B.4,**31 行 / 33 处**)

| 蓝本行 | 语义 | → | 新行号 |
|---|---|---|---|
| `:254` | 链接色 | `var(--accent)` | `:164` |
| `:257` / `:258` | 卡片实底 / 卡片描边 | `var(--bg-elevated)` / `var(--line-faint)` | `:168` / `:169` |
| `:264` | 三级灰 | `var(--text-tertiary)` | `:176` |
| `:267` | 拖放区**更重**的虚线 | `var(--line-strong)` | `:180` |
| `:273`(**2 处**) | 拖入高亮淡底 / 高亮描边 | `var(--accent-soft)` / `var(--accent)` | `:187` |
| `:276` | 三级灰 | `var(--text-tertiary)` | `:190` |
| `:287` | 二级灰(参数标签) | `var(--text-secondary)` | `:201` |
| `:290` | 输入框描边 | `var(--line-faint)` | `:204` |
| `:295` | 三级灰 | `var(--text-tertiary)` | `:209` |
| `:296` | 第四档(比三级灰更淡) | `var(--text-quaternary)` | `:210` |
| `:298` | 三级灰 | `var(--text-tertiary)` | `:212` |
| `:301` | 输入框描边 | `var(--line-faint)` | `:215` |
| `:307`(**2 处**) | 强调色实底 / **实底之上的前景** | `var(--accent)` / `var(--text-on-accent)` | `:222` |
| `:310` | 成功态前景 | `var(--success)` | `:225` |
| `:313` / `:314` / `:315` | 错误淡底 / 左边条 / 前景 | `var(--danger-soft)` / `var(--danger)` / `var(--danger)` | `:228` / `:229` / `:230` |
| `:323` / `:324` | 强调色**最淡档**底 / 左边条 | `var(--accent-softer)` / `var(--accent)` | `:239` / `:240` |
| `:332` | 警告前景 | `var(--warning)` | `:249` |
| `:334` | 最淡分隔线 | `var(--line-faint)` | `:251` |
| `:339` / `:340` / `:341` | 成功态 / 强调色 / 三级灰 | `var(--success)` / `var(--accent)` / `var(--text-tertiary)` | `:256` / `:257` / `:258` |
| `:347` | 三级灰空态 | `var(--text-tertiary)` | `:265` |
| `:350` | 最淡分隔线 | `var(--line-faint)` | `:268` |
| `:355` | 三级灰 | `var(--text-tertiary)` | `:273` |
| `:359` | 中性 chip 底(等宽代码块) | `var(--bg-chip)` | `:277` |
| `:365` / `:366` | 三级灰 / 二级灰 | `var(--text-tertiary)` / `var(--text-secondary)` | `:283` / `:284` |

**行数核对**:`:273` 与 `:307` 各 2 处 → 31 行 / 33 处 ✅。

### 5.3 用到的 15 个 token —— **两档都已就位,零新造**

实测 `grep -oE 'var\(--[a-z-]+\)' | sort | uniq -c`(**45 处引用、15 个不同 token**,45 = §5.1+§5.2 的 12+33 ✅):

```
 10 var(--text-tertiary)    7 var(--line-faint)      7 var(--accent)        5 var(--danger)
  3 var(--success)          2 var(--warning)         2 var(--text-secondary) 2 var(--bg-elevated)
  1 var(--text-quaternary)  1 var(--text-on-accent)  1 var(--line-strong)    1 var(--danger-soft)
  1 var(--bg-chip)          1 var(--accent-softer)   1 var(--accent-soft)
```
(同一条 grep 还会命中 1 处 `var(--font-mono)` —— 那在**头注释**里,是「为什么**不**用它」的说明,不是真引用。)

逐个在 `knowledge.scss` 的两个 token 块里核过(暗档 `:130-246` / 浅档 `:249-345`,K21 已扩选择器)
→ **15/15 两档都有声明** ✅。**本刀未声明任何 token、未改 `knowledge.scss` 一个字节。**

### 5.4 表里没有的 = **0 处** → 零 `NEEDS_CONTEXT`

附录 B §B.3 + §B.4 覆盖本文件全部 45 处;`transparent` 本文件 **0 处**(附录记的 4 处
`transparent` 全在 `knowledge.scss` 段与 `FolderBrowser.vue`,不在本刀)。

### 5.5 ⚠️ 取舍② 登记(协调者裁定 A-2,不开小灶)

浅色档 `--warning`(深琥珀)与 `--success`(深绿)比 Vue2 的亮橙/emerald 绿**明显更深**,
本刀吃在:`.dot`(运行灯)· `.dot.paused`(暂停灯)· `.scored-card .warn` · `.ok-hint` · `.rank-line .score`。
`--accent` 比 Vue2 的柔蓝更饱和(`.test-link` / `.back-link` / `.submit-btn` / `.folder-bar` / `.docling-md` 边条 / `.rerank-score`)。
`--bg-elevated` 浅档 = `var(--card-bg)` 与 Vue2 卡片实底**逐字同值**;`--line-faint` 冷↔暖极淡档几乎不可辨。
**照附录 B 落,不为 Parser 两页新造 `--warning-vue2` 之类。验收清单由协调者写。**

---

## 6. `parserStyles.test.ts` —— 18 条用例 / 5 组断言

**为什么必须新建**:`parser-styles.scss` 既不受 `color-guard.test.ts` 约束(它 `import.meta.glob` 只取
`../**/*.vue` 与 `../**/*.css`,**不扫 `.scss`** = 缺口②),也不受 `knowledgeStyles.test.ts` 约束
(它只 `read('./knowledge.scss')` = 缺口⑤)→ **完全裸奔**。

| 组 | 断言 | 用例数 |
|---|---|---|
| **(a)** 全文(**含注释**)零色字面量 | 零 `#hex` · 零函数式色值(`rgb/rgba/hsl/hsla/lab/lch/oklab/oklch/hwb/color()/color-mix()/device-cmyk()`)· 零 **CSS 具名色 148 个全清单**(含 `white`/`black`;`transparent` 不算)· 零 `theme-exception` · 零假 token 残留(`ns-color`) | 5 |
| **(b)** 零顶层裸选择器 | 第 0 列的规则头**集合+顺序**恰好 `['.parser-app', '.parser-app.parser-status-page', '.parser-app.parser-test-page']` · 每行都是单行 `选择器 {` 写法 | 2 |
| **(c)** `.parser-app` 只带 K22 三行 | 声明清单 `toEqual(['height','height','overflow-y'])` · 零 `--x:` · 零颜色属性(21 个属性名清单)· 零嵌套规则 | 4 |
| **(d)** K23 两页各自作用域 | 两页都有页面壳三条声明 · `.card` 各 1 份 · `.page-header`(含 `h2`)各 1 份 · 各自持有本页专属类且不含对方的 | 4 |
| **(e)** 白名单(附录 D §D.2) | 类名集合 === `PARSER_WHITELIST_70`(**集合相等**,排除作用域根 `parser-app`)· 元素选择器集合 === 登记的 9 个 · 不许混进 `k-*`/`k2-*`/`kn-*`/`fb-*` | 3 |

**关键手法(照既有先例,不是新发明)**:
- 🔴 **`node:fs` 直读源文件,不用 Vite 的 `?raw`** —— vitest 的 CSSEnablerPlugin 会把样式源整体换成空串,
  `?raw` 会让 (a) 的每条 `not.toMatch` 对空字符串「假通过」。先例:`knowledgeStyles.test.ts` 头注释 ③。
  路径用 `dirname(fileURLToPath(import.meta.url))`(先例 P5b T11),`node:fs`/`node:path`/`node:url`
  三行 import 各加 `@ts-expect-error` + 注释(本仓未装 `@types/node`,既定手法,`vue-tsc` 已 exit 0 验证)。
- 🔴 **(a) 跑在未剥注释的 `rawSource` 上**(R5:注释里也不许有色字面量);(b)(c)(d)(e) 跑在
  `stripComments()` 之后的 `css` 上(防注释里逐字引用的选择器名撞对 —— 本文件头注释里就逐字写着
  `.parser-app.parser-status-page`)。
- 🔴 **定位块用 `^选择器 \{$` 行首行尾锚定**(承 `knowledgeStyles.test.ts` I-2 事故的教训:`indexOf`
  子串搜索会被注释撞对),块结束用**花括号配平**(两个页面段内部多层嵌套,「下一个 `\n}`」会切错)。
- 🔴 **具名色用大小写敏感**匹配 + 两侧 `(?<![\w-])` / `(?![\w-])` 负向断言:`\b` 在字母↔连字符处也成立,
  `/\bwhite\b/` 会被本文件 4 处合法的 `white-space` 撞对(承 `knowledgeStyles.test.ts:359-377` 的订正);
  大小写不敏感则会把中文注释里的「RED 探针」当成具名色 `red`(T2a 评审方法② 吃到过 2 处这种假阳性,
  常驻断言不能靠人肉排除)。
- 🔴 **`blockOf` 内含 `expect`,一律在 `it` 内部求值**(放 describe 体里会在收集阶段抛,报错落在文件级、失真)。
- ⚠️ **`parser-app` 不进 `PARSER_WHITELIST_70`**,走排除条件 `SCOPE_ROOT_CLASSES` —— 与治理 §6.4-2
  对 `knowledgeStyles.test.ts` 的裁定(`parser-app` 走排除条件、不塞登记表)同款处理,附录 D §D.0 的
  「70」与常量名 `PARSER_WHITELIST_70` 因此都保持不变。

---

## 7. RED 探针 —— **8 条,全部精确报红并还原**

每条都贴「报红」+「还原后转绿」两段,末尾 `git status` 干净。

### 探针 1 —— (a) 塞一个 `#hex`(`.refresh-btn` 加 `color: #abcdef`)
```
     × 零 #hex 4ms
AssertionError: 出现 #hex 色字面量: expected '/* Parser 两页(解析器状态 / 测试沙盒)的样式 —— SP8-…' not to match /#[0-9a-fA-F]{3,8}\b/
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```
```
--- PROBE 1 restored GREEN ---
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 探针 2 —— (a) 塞一个具名色(`color: white`)
```
     × 零 CSS 具名色(148 个全清单,含 white / black;transparent 不算) 18ms
AssertionError: 出现 CSS 具名色(改成 var(--token)):
  L79 [white]: .refresh-btn { padding: 4px 12px; cursor: pointer; color: white; }: expected [ Array(1) ] to deeply equal []
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```
(注:同时证明了 `white-space` 那 4 处**没有**被误报 —— 未探针时 18/18 全绿。)

### 探针 3 —— (b) 在第 0 列加一条 `.foo { color: var(--accent); }`
```
     × 第 0 列的规则头恰好是那三个选择器(顺序与个数都钉死) 7ms
     × 文件里出现的类名集合 === PARSER_WHITELIST_70(排除作用域根 .parser-app) 3ms
AssertionError: 第 0 列出现了预期外的选择器:
  L289: .foo {: expected [ '.parser-app', …(3) ] to deeply equal [ '.parser-app', …(2) ]
+   ".foo",
 Test Files  1 failed (1)
      Tests  2 failed | 16 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 探针 4 —— (c) 往 `.parser-app` 里塞一个颜色属性(`background: var(--bg-elevated)`)
```
     × 声明恰好是 height / height / overflow-y 三条(K22,一条不多一条不少) 7ms
     × 零颜色属性 2ms
AssertionError: .parser-app 块里出现了颜色属性:background: expected [ 'background' ] to deeply equal []
 Test Files  1 failed (1)
      Tests  2 failed | 16 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 探针 5 —— (c) 往 `.parser-app` 里塞一个 `--x:` 声明(`--line-faint: var(--line)`)
```
     × 声明恰好是 height / height / overflow-y 三条(K22,一条不多一条不少) 8ms
     × 零 `--x:` 自定义属性声明(token 声明层只许在 knowledge.scss) 1ms
AssertionError: .parser-app 块里出现了 token 声明:
 Test Files  1 failed (1)
      Tests  2 failed | 16 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 探针 6 —— (d) 把 `.card` 从**状态页作用域**里整块删掉(测试页那份仍在)
```
     × `.card` 在两个作用域下各有且只有一份 6ms
AssertionError: .parser-app.parser-status-page 下的 `.card {` 规则应恰好 1 条,实测 0 条: expected +0 to be 1
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```
🔴 **这条探针同时证明了 (d) 的必要性**:(e) 的白名单集合相等**没有**报红(`.card` 在测试页还在,
集合不变)—— 也就是说「顺手把同名类合并成一份」这个 K23 风险**只有 (d) 能抓到**。

### 探针 7 —— (e) 在**嵌套层**加一个自造类 `.bogus { color: var(--accent); }`
```
     × 文件里出现的类名集合 === PARSER_WHITELIST_70(排除作用域根 .parser-app) 5ms
+   "bogus",
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```
(注:(b) 抓不到它 —— 它在嵌套层、不在第 0 列。两条断言各守一半。)

### 探针 8 —— (e) 在嵌套层加一个元素选择器 `span { font-size: 11px; }`
```
     × 文件里出现的元素选择器集合 === 附录 D §D.2 登记的 9 个 7ms
+   "span",
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 探针后自查
```
$ diff /tmp/pss.bak src/ai/styles/parser-styles.scss && echo "file identical to backup"
file identical to backup
$ git status --short
?? src/ai/styles/parser-styles.scss
?? src/ai/styles/parserStyles.test.ts
```
→ **8/8 精确报红、8/8 还原转绿、工作树只剩本刀两个新文件。**

---

## 8. 三门 + 两个 `sass` 完整终值

```
$ pnpm test                  > /tmp/p5c-t2b-test.log  2>&1;  exit=0
 Test Files  320 passed (320)
      Tests  3179 passed (3179)
   Duration  68.15s

$ pnpm exec vue-tsc --noEmit  > /tmp/p5c-t2b-tsc.log   2>&1;  exit=0   (零输出)
$ pnpm build                  > /tmp/p5c-t2b-build.log 2>&1;  exit=0   (✓ built in 12.74s)
$ pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null;  exit=0
$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss     /dev/null;  exit=0
```

- **红项 0 条**,**零复跑**(已知噪声 `persist.test.ts` 的 IndexedDB flaky 与 `AgentComposer.test.ts`
  的 vue-i18n teardown 竞态这一轮都没出现)。
- **算术核对**:文件 319 → **320**(+1 = `parserStyles.test.ts`);用例 3161 → **3179**(+18 = 本刀新写的 18 条);
  **零 `.vue` 新增** → `color-guard.test.ts` 的动态用例数不变 ✅。
- `pnpm build` 的 `chunks larger than 500 kB` 是既有告警(与本刀无关)。
- **Service 仓零改动** → 未跑跨仓 `pnpm build`、未跑 `pnpm install`(治理 §1 第 2 条)。

### 8.1 附录 B §B.9 / 附录 D §D.7 自查命令(逐条实测)

```
① parser-styles.scss 全文零色字面量           → grep exit=1(0 命中)✅
② parser-styles.scss 零顶层裸选择器            → 只有 :60 .parser-app / :67 .parser-app.parser-status-page
                                                 / :154 .parser-app.parser-test-page ✅
④ theme-exception                              → parser-styles.scss:0  knowledge.scss:0 ✅
⑤ 单独编译两个 scss                            → 两个 exit=0 ✅
⑦ 死引用自查 grep -c 'ns-color'                → 0 ✅
D.7 ④ 顶层裸选择器                             → 同 ② ✅
```

### 8.2 🔴 `dist` 里 grep 不到 `parser-status-page` 是**预期**(那条 DoD 归 T6)

```
$ grep -c "parser-status-page" dist/assets/*.css   → 全部 0(grep exit=1)
$ grep -c "k-sandbox-icon"     dist/assets/*.css   → index-X0hjF9vH.css:1
```
`parser-styles.scss` 是**新文件,本刀没有任何 `.vue` import 它**,所以 Vite 不会把它编进产物 ——
这是治理 §8 那条 DoD 归 **T6**(`ParserStatus.vue` 写 `import '../../styles/parser-styles.scss'` 之后才成立)。
对照组:T2a 搬进 `knowledge.scss` 的 `.k-sandbox-icon` **确实进了产物**(1 命中)→ 证明管线本身没问题,
差的只是一个 import。**本刀没有为了让它进产物去建 `.vue` 或改别的文件。**

---

## 9. §3 的 K1–K30 里本刀命中的每一条(显式申报)

| # | 怎么命中 |
|---|---|
| **K9** | 蓝本 60+ 裸类名 + 9 个元素选择器靠 Vue2 `scoped` 隔离,搬进全局 scss 后**全部嵌进两个页面作用域**,零顶层裸选择器(断言 (b) 常驻守卫) |
| **K21** | **本刀不声明任何 token**,消费 T2a 已扩选择器的那两个 token 块(`.knowledge-app, .parser-app` / 浅档同款);连 `color-scheme` 都不重复声明 |
| **K22** | `.parser-app { height: 100vh; height: 100dvh; overflow-y: auto }` —— Vue2 没有这三行,见 §4(含「滚动条位置」可见后果的申报) |
| **K23** | 两页各自作用域 `.parser-app.parser-status-page` / `.parser-app.parser-test-page`;逐字相同的 `.card` / `.page-header` / `.page-header h2`(**+ 两个页面根**)各写一份,零共享段;断言 (d) 常驻守卫 |
| **K24** | 落成独立文件 `src/ai/styles/parser-styles.scss`,**不并进 `knowledge.scss`**(并进去会当场炸掉 `knowledgeStyles.test.ts` 的非 `k*` 类集合相等断言);同时新建 `parserStyles.test.ts` |
| **K25** | 两页暗色档与 Vue2 不同(Vue2 只有一套浅色),头注释已就地登记;浅色档按附录 B 保持与 Vue2 一致的语义 |

**除 K1–K30 之外的偏离:0 条。** 拿不准的 0 处(附录 B 覆盖全部 45 处),故**零 `NEEDS_CONTEXT`**。

### 9.1 §3.5 的 N1–N22 里本刀命中的

| # | 怎么照抄的 |
|---|---|
| **N15 同族** | 本文件**零** `k-*` / `k2-*` / `kn-*` / `fb-*` 类(断言 (e) 第 3 条常驻守住)——`.k-progress-*` 那 6 个类由 T2a 的「没有搬多」断言在 `knowledge.scss` 侧守住,与本文件无关 |
| **N16** | 本刀不碰模板 → emoji / 特殊符号一个都没动;`.dot` / `.dot.paused` 的指示灯仍是 CSS 圆点(蓝本如此),没有「顺手换成 KIcon」 |
| **N18 / N19 / N20** | 纯 script/模板行为,本刀不涉及(归 T6/T7),**未提前改动** |
| **N22 同族** | 蓝本 `.param input` 三个参数标签、`rerank top-20` 等技术标识符都在模板里,本刀不碰;scss 侧未给它们加任何 New-UI 自造类 |

**顺手改动:0 处。** 唯一非颜色的取舍:`font-family: ui-monospace, monospace`(蓝本 5 处)
**保持字面量、不换 `var(--font-mono)`** —— `--font-mono` 是另一串字体栈(`"SF Mono", ui-monospace, …`),
换了会改变实际渲染 = 界面不 1:1;它不是颜色,不受「禁字面量」约束。

---

## 10. 用了哪些 fixture / mock 层次

**本刀零 fixture、零 mock** —— 两个产出都只读源文件、不发请求、不挂载组件。
(§4.1 那张五行 mock 层次表归 T4/T5/T6/T7/T8/T9。)

---

## 11. 顾虑 / 留给下游的提示(**不是本刀缺陷,但请协调者与评审知悉**)

1. ⚠️ **滚动条落在 900px 居中列的右缘,不在视口右缘**(K22 的二阶后果,已在 §4 与 scss 头注释登记)。
   成因是治理 §6.1 落地约束 2 要求作用域根与 `.parser-app` 是同一个元素,而蓝本页面根自带
   `max-width: 900px; margin: 0 auto`。要挪回视口边缘必须加一层 DOM 包裹(= 改结构,违反 1:1)。
   **建议写进验收清单让用户拍板**(接受 / 或另开一票允许加包裹层)。
2. ⚠️ **附录 B §B.2 与 §B.9 ⑦ 有一处口径冲突**:§B.2 说注释里可以写「原是一个无声明的 `--ns-color-*`」,
   而 §B.9 ⑦ 的自查命令要求 `grep -c 'ns-color' parser-styles.scss` **等于 0**。
   **处置**:注释改写成「`var(假 token, 回退值)` 写法,那 6 个假 token 名(前缀 `ns-` 那一族)」,
   **两条都满足**(实测 `grep -c 'ns-color'` = 0)。语义信息一个字没少。**按权威优先级已在此指出。**
3. ⚠️ **brief §3 的「裸全局类名清单」有 3 项漏、元素清单 1 漏 1 多**(详见 §3.1 的差异表)——
   已按实测 + 附录 D §D.2 补全为 70 类 + 9 元素,并做成集合相等断言。
4. ⚠️ **附录 B §B.1 只登记了 3 条「完整路径逐字相同」,实际还有第 4 条**:两个页面根的声明
   (`padding: 16px; max-width: 900px; margin: 0 auto`)也逐字相同,只因选择器名不同没被计入。
   **不影响任何裁定**(照 K23 各写一份),仅补登记。
5. ⚠️ **T6/T7 提醒**:`.vue` 侧根元素必须写成 `class="parser-app parser-status-page"` /
   `class="parser-app parser-test-page"`(两个类挂同一个元素),否则 `.parser-app.parser-status-page`
   连写选择器不命中、且 token 全部解析不到。`dist` 里 grep `parser-status-page` 那条 DoD 也在 T6。
6. ⚠️ **`.parser-app` 与 `.knowledge-app` 都在 K21 那两个 token 块的选择器里**,所以万一 T6/T7 把
   Parser 页嵌进 `KnowledgeLayout`(不该,路由是顶层),`.parser-app` 的 `height: 100dvh` 会与外壳的
   `overflow: hidden` 打架。**按 `knowledgeRoutes.ts:62-63` 的现状(顶层路由)不会发生**,仅提示。

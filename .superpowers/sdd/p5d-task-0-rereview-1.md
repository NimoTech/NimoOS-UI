# P5d · T0 修复轮 1 —— 范围收窄复审(rereview-1)

复审对象:`.superpowers/sdd/review-cc6d7c8..03db682.diff`(改动仅限
`p5d-appendix-A-i18n.md` / `p5d-appendix-B-tokens.md` / `p5d-appendix-D-classes.md` /
`p5d-gen-r8r9-sim.mjs`(新增)/ `p5d-task-0-report.md`,共 370(+)/42(−),`src/` 零改动)。
权威口径:`p5d-coordinator-rulings-T0.md`(R1–R14)。方法:自己回权威源 / 自己跑程序化取证,不采信实现者自述。

## 逐条判定

### 1. C-1 / R3 —— 附录 A §A.4 五个 zh 值
**ADDRESSED**。`git -C NimoOS-UI show 7a6ee6b7:src/assets/lang/zh_CN.json` 逐字核对:
`Insight→洞见 / Digest→文摘 / Written by you→手写 / Written by agent→Agent 代写 / Auto-captured→AI 沉淀`,
5/5 与新表逐字一致。diff 里 `p5d-appendix-A-i18n.md` 只有两处 hunk(新增 R10 小节 + 改写 §A.4 表),
**§A.2 零 hunk,一字未动**。

### 2. I-1 / R4 —— 附录 D §D.2.2 K44 顶层例外
**ADDRESSED**。自跑深度计数脚本(剥注释后按 `{`/`}` 追踪 depth,记录 depth=0 时开括的选择器):
现状 `knowledge.scss` depth-0 开块选择器 **15** 条,逐条核对全部是
`.knowledge-app,.parser-app`(`:4`)/ `:root[data-theme="light"]…`(`:91` `:1615`)/ `.knowledge-app`(`:165` `:1452`)/
`@keyframes`(10 条)—— **裸选择器实测 = 0**,与附录基线一致。例外集合写的是
`['.nme-content .ProseMirror']` 集合相等式(非「排除掉算了」),配两条 RED 探针(加裸选择器 / 把 K44 嵌进
`.knowledge-app`),T2 新建断言的措辞明确。

### 3. R1 / K45 —— `.k-btn.text` 搬法与重复搬守卫
**ADDRESSED**(附录已给出搬法、位置、P5e 交接项与计数守卫思路)。插入位置核实:
`grep -n "&.danger\|&:disabled"` → `&.danger` 在 `:735`,`&:disabled` 在 `:743`,块跨 `:735-742`,
与附录写的「插在 `&.danger(:735-742)` 之后、`&:disabled(:743)` 之前」逐字吻合。
**独立技术意见**(任务第 3 条明确要求):「`&.text` 恰好出现 2 次」这个计数断言**未锚定在 `.k-btn` 块内**,
只是对整份 2000+ 行文件做裸子串/正则计数。若 T2 之后合法地在别的基类下新增一个同名嵌套变体
(例如 `.k-tag { &.text { … } }`,与 `.k-btn.text` 毫无关系),计数会变成 3 → **误红**;反之如果 P5e
真的重复搬,但写法不是 `&.text`(比如展开写 `.k-btn.text { … }` 而不是嵌套 `&.text`),计数可能不变 →
**漏判**。两种脆弱都源于同一个原因:断言目标是「`&.text` 这个字符串出现几次」而不是「`.k-btn` 作用域内
`.text` 变体的规则块出现几次」。更稳的写法应比照 K10 对 `.k-confirm-*` 的做法——先定位 `.k-btn { … }`
的声明块区间,再在区间内数 `&.text`/`.text` 命中数,而不是全文裸计数。**这是附录留给 T2 的实现细节
缺口,不构成本轮"未修复",但复审认为值得在 T2 落地前修正,否则要么误红要么漏判。**

### 4. R8 —— `NON_K_HELPER_CLASSES` 终值 16
**ADDRESSED**。自跑 `node .superpowers/sdd/p5d-gen-r8r9-sim.mjs`:
```
现状实测 10 == 登记表 10  → true
拼入后 18,新扫出 8 = ["ProseMirror","dot","lbl","nme-content","sep","spacer","text","wide"]
走排除条件 2(ProseMirror/nme-content),进登记表 6(dot/lbl/sep/spacer/text/wide)
🔴 R8 终值 = 16
'text' 被 nonKClassNames 扫到 = true / 'nme' 被扫到 = false
```
逐字比对 `stripComments`(脚本 5 行 vs `knowledgeStyles.test.ts:23-27`)与 `nonKClassNames`
(脚本 5 行 vs `:244-256`)——**逐字复刻,零偏差**(排除条件 `^k(2|n)?-` / `^fb(-|$)` /
`knowledge-app` / `parser-app` 完全一致)。自证「现状==登记表」成立。终值 16 可信。

### 5. R9 —— 白名单终值 293
**ADDRESSED**。同一脚本输出:`old ⊆ new`(`old 225 / new 225`)、拼入后白名单外 67
(65 个 k*/fb* + 2 个非 k*),`226+67=293`;`'text' 被这条扫到 = false`(故 text 只归 R8 侧,
不重复登记)。算式 `226+65+2=293` 成立，与附录逐字一致。

### 6. R2 —— 附录 D §D.6.3 版本终值表
**ADDRESSED**。`git show 7a6ee6b7:package.json | grep tiptap` 确认蓝本写的就是
`"tiptap-markdown": "^0.8.10"`(不是治理原写的 `^0.6.1`);`@tiptap/*` 声明 `^2.0.4`。
`git show 7a6ee6b7:.../NotesMarkdownEditor.vue` 只 import `Editor/EditorContent/StarterKit/Markdown`,
另对 `NotesView.vue`/`NoteEditPane.vue` 全文 grep `-i "highlight|typography"` 零命中 ——
「三个蓝本文件零引用 Highlight/Typography」属实，不装二者的理由成立。

### 7. I-2 / R5 —— §D.6.1 N29 未实证标注
**ADDRESSED**。diff 内该框逐条标注 K38 ✅实证 / §5.3 ✅实证 / N29 🔴未实证，并写明
「T4/T7 不许引本节当已证，必须各自附变异证据」，措辞是硬性要求（🔴🔴 + 独立小节），足够醒目。

### 8. I-4 / R6 —— §D.0.1 结论句
**ADDRESSED**。新增 §D.0.1：「98 个模板静态类里双双无规则的只有 `nme`（不搬）与 `text`（K45，搬）」，
未列全 73 个（符合裁定 R6 的范围限定「不要求列全」）。

### 9. R7 —— 四条小修
全部 **ADDRESSED**，逐条自证：
- M-1：`grep -n "import.meta.glob" src/styles/color-guard.test.ts` → 只有
  `../**/*.vue`（:15）与 `../**/*.css`（:16），零 `.scss`，与订正后的措辞一致。
- M-2：`grep -n pathHtml src/ai/knowledge/components/KIcon.vue` → `:71`，与订正一致。
- M-3：蓝本 `git show 7a6ee6b7:.../NoteEditPane.vue | grep -c kn-tb-btn` = **8**，
  `grep -c "kn-tb-btn.*data-on"` = **8**，与订正的 ×8 一致（初稿 ×7 确系数错）。
- M-4：蓝本两版 `en_US.json` 叶子数 `7a6ee6b7`=2742、`65cfda583f2e...`=2744，
  与订正的「2742→2744」一致（初稿 2766/2768 是行数不是叶子数）。

### 10. R10 / R11 —— en 权威源 + wash 渐变裁定
**ADDRESSED**。R10：附录 A 新增小节写明 en 权威源 = `en_US.json`（不是 `$t()` 原串）、
2 条命中、正/反向断言判据、verify 脚本不许假设「en=JSON key」的禁令，措辞清楚。
R11：附录 B §B.1.1 末尾已把「待协调者裁定」替换成「协调者已批准保留蓝本色相」，
依据（`--grad-sandbox`/`--grad-iri` 先例 + A-9 只管 soft 填充不管渐变）引用完整，开放项消除。

## 总判定
**全部 10 条 ADDRESSED，无 NOT ADDRESSED。**

## 修复 diff 内新引入的破坏
**无。** 本轮仅改 `.superpowers/sdd/` 下三份附录 + 报告 + 新增 1 个纯只读复现脚本，`src/` 零改动，
`pnpm test` 基线 326/3515 不受影响（纯 markdown/脚本改动）。抽查的新增事实性断言（`&.danger`
行号 `:735`/`:743`、`tiptap-markdown` 版本、`en_US.json` 叶子数、`kn-tb-btn` 计数、depth-0
选择器计数）逐条独立复核，均与仓库/蓝本实测吻合，未发现新的错误陈述或自相矛盾。

## 一致性检查（跨三份附录的数字残留扫描）
`grep -n "291\|10 → 15\|保持 10 项\|×7\|43\|0.6.1\|2766\|2768\|WHITELIST_226\|WHITELIST_291"
p5d-appendix-*.md` 全部命中点逐一核对：均是「初稿写 X，本轮订正为 Y」的历史性提及（带 🔴 标注
或上下文明确是"已订正"语境），或是无关的巧合数字（如 `NoteEditPane.vue:291` 这个行号）、或是
`WHITELIST_226` 作为"现状常量名/现状文件描述"的合法引用（T2 才会真的改名成 `WHITELIST_293`）。
**未发现互斥的残留旧值。**

## 范围外观察（不延长本修复轮）
- K45 的「`&.text` 恰好 2 次」计数断言未锚定 `.k-btn` 作用域（见第 3 条独立意见）——建议 T2 落地时
  比照 K10 对 `.k-confirm-*` 的手法，先定位 `.k-btn{…}` 声明块区间再计数，避免未来无关的 `&.text`
  新增导致误红，或错误写法导致漏判。这是**实现细节**层面的建议，不构成裁定 R1 未兑现。
- `p5d-gen-r8r9-sim.mjs` 的 `k45Text` 模拟串把两条规则写成单行（`&.text { … }` 一行、
  `&.text:hover { … }` 一行），与附录建议的多行/与既有四个变体同款格式不完全一致；对本轮的计数
  结论无影响（正则不关心换行），但 T2 实现时应参照既有 `&.ghost`/`&.outline` 的多行缩进格式，
  不要照抄脚本里的单行写法。

## 独立技术意见小结（任务要求的两点）
1. **`&.text` 恰好 2 次的计数断言**：方向对（因为「没有搬多」白名单正则确实收不到 `text`，
   需要另一条断言堵重复搬），但当前描述的判据（裸计数「`&.text` 在全文件出现几次」）没有把
   计数限定在 `.k-btn` 声明块内，存在「未来合法新增同名变体 → 误红」与「换一种写法重复搬 →
   漏判」两种脆弱性。建议 T2 落地时改为「先定位 `.k-btn{…}` 区间，再在区间内计数」。
2. **`old 225 / new 225` 严格超集自证**：自己复现结果与附录逐字一致，确认这条正则扩展在
   现状文件上确实**零可观测**（新增的 `A-Z`/`nme`/`ProseMirror` 分支在拼入前的现状文件里未命中
   任何新增匹配）。附录已把这一点写得足够硬：明确说「RED 探针是唯一能证明它有判别力的手段，
   不许省」，并给了两个具体探针步骤（塞 `.kn-foo{}` 与 `.ProseMirrorX{}`，各自报红后还原）。
   这条要求的措辞（🔴 + 独立成句 + 具体可操作步骤）达到了「足够硬」的门槛，判定 ADDRESSED。

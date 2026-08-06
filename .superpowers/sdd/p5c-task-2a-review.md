# SP8-P5c · Task 2a 独立评审 —— `knowledge.scss` 新增段 + K21 + 4 个新 token + 守卫 ①④

- **被评审**:`4212163`(`sp8-ai`,起点 `f8d0e42`),实现者报告 `.superpowers/sdd/p5c-task-2a-report.md`
- **评审日期**:2026-08-03 · **评审方式**:全程回权威源,零采信报告
- **蓝本**:`git -C /home/nimo/NimoTech/NimoOS-UI show main:…`,`main` = `7a6ee6b72b4b8184f0045c200371899a44653478` ✅
  (与治理 §1 第 3 条写的 `7a6ee6b7` 逐字一致;全程零 `cat`/`Read` 那个仓的工作树,零 checkout/stash/commit)
- **治理版本**:读的是订正后最新版(`9ffc612`),含 **§6.4.1** 两条订正

## 结论

# ✅ Ready to merge

**Critical 0 · Important 0 · Minor 4**(全部是报告文字瑕疵 / 早于本刀的既有对称缺口,零产品代码问题)

---

## 1. 逐行色扫 `knowledge.scss` 全文(治理 §11 第 1 条点名,`color-guard.test.ts` 不扫 `.scss`)

用**两套互相独立**的方法各扫一遍全文 1991 行:

**方法①** —— 括号配平算出两个 token 声明块的真实边界,再全文正则:

```
token block1: 130 - 246   block2: 249 - 340
=== HITS OUTSIDE THE TWO TOKEN BLOCKS: 0 ===
```

**方法②** —— 换成 **100 个 CSS 具名色的完整清单**(不是抽样)+ `#hex` / `rgb()` / `rgba()` /
`hsl()` / `hsla()` / `color-mix()` / `lab()` / `oklch()`,并对具名色用 `(?<![-\w])…(?![-\w])`
负向断言避开 `--purple` 这类 token 名:

```
hits=8
111:  * …(评审 RED 探针            ← 假阳性:"RED" 命中具名色 red(大小写不敏感),中文注释
123:  * …RED 探针验证(删一个 → 精确报红)  ← 同上;两行都是**早于本刀**的头注释
584 / 658 / 667 / 1782 / 1953 / 1988:  color-mix(in srgb, var(--x) N%, transparent)
                                        ← 全部**早于本刀**(P5a/P5b 产物),且只用 token,零字面量
```

→ 🔴 **两个 token 声明块之外(含全部注释)零 `#hex` / 零 `rgb()`/`rgba()` / 零具名色(含 `white`/`black`)。
本刀新增的 380 行里零色字面量。** `transparent` 4 处(段内 2 + FolderBrowser 2)按 P5a T11 口径不算,
与治理 §6 记的数一致 ✅。`theme-exception` 全文 **0** ✅。

注释口径(R5)复核:新段全部写成「蓝本 `:行号` + 中文语义描述 → token 名」,
例如 `/* 蓝本 :1239 绿色半透明光晕裸值 → --success-soft(两档已有) */` —— 无一处写出色值本身 ✅。

---

## 2. K21 硬约束逐条核(治理 §6.1 落地约束 + §11 第 5 条)

`git diff -U0 f8d0e42..4212163 -- src/ai/styles/knowledge.scss` 全文 394 行逐行看。
**全文的 `-` 行只有 6 条**:

| 行 | 内容 | 位置 | 判定 |
|---|---|---|---|
| 6 | 头注释「K17…留 P5c」 | 文件头注释,**块外** | 陈旧注释订正,见 §4 |
| **43** | `-.knowledge-app {` | **暗档 token 块选择器** | ✅ K21 |
| **60** | `-:root[data-theme="light"] .knowledge-app {` | **浅档 token 块选择器** | ✅ K21 |
| 264-266 | K17「本期两个视图都不用,留 P5c,故跳过那一段」 | Modals 段头注释,**块外** | 陈旧注释订正,见 §4 |

→ 🔴 **两个 token 块内的 `-` 行恰好 2 条,就是那两行选择器;块内既有的任何一条声明都没被改动或删除。**
**与报告称的「区间内只有 2 行 `-`」一致 ✅**(我独立验的)。

块内的 `+`:`@@ -197,0 +231,13 @@`(暗档 13 行)与 `@@ -282,0 +329,9 @@`(浅档 9 行)——
**纯新增**,内容就是 4 个新 token 的声明 + 分组注释,由治理 §6.3 / 附录 B §B.8 明文授权
(「声明位置:`knowledge.scss` 的两个 token 块」)。§6.1-3 的「块内容一个字节都不动」指的是
K21 改选择器不许顺手动既有内容 —— **既有内容 0 改动,判定合规**。

**选择器写在一行**(治理 §6.1-3,`declBlockRange` 用 `^…$` 锚定):

```
130:.knowledge-app, .parser-app {
249::root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {
```
✅ 各一行,零换行。(我的 RED 探针②反证了这条锚定真的在守 —— 见 §7。)

**`knowledge.scss` 里零 `.parser-app { … }` 规则块**(K22 三行结构属性归 T2b):

```
$ grep -nE '\.parser-app' src/ai/styles/knowledge.scss
51: * 【偏离 K21】…                ← 注释
57: * …(.parser-app 不许再自己声明一次)。  ← 注释
130:.knowledge-app, .parser-app {            ← token 块选择器
249::root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {
```
→ ✅ **零规则块,本刀没有越界写 K22。**

---

## 3. 11 段搬运 —— 我把 **11/11 全段**逐行对蓝本核过(不止抽查 4 段)

蓝本落盘到 scratchpad 后逐段 `Read` 对照。结果:**11/11 与蓝本逐行一致**,差异只有
①§5 的 14 处配色映射 ②新增的中文段头注释 ③J 段与 `.fb-*` 段按 K9 多了 2 空格缩进。

| 段 | 蓝本范围 | New-UI 落点 | 逐行核准 |
|---|---|---|---|
| A `.k-section` 四类 | **`:969-984`** | `:866-880` | ✅ 逐字;🔴 **`:985-991` 的 `.k-section-body` 确认未搬** |
| B `.k-set-card` | `:1141-1149` | `:894-914` | ✅ 逐字 |
| C `.k-set-row*`(含嵌套 `.warn`) | `:1159-1179` | `:916-936` | ✅ 逐字 |
| D `.k-radio-group` | `:1181-1201` | `:938-958` | ✅ 逐字,含 `&[data-on="true"]` |
| E `.k-sw` | `:1203-1225` | `:960-984` | ✅;`:1217` `white`→`--switch-thumb`、`:1218` 投影→`--switch-thumb-shadow` |
| F `.k-set-svc` / `.k-svc-*` | `:1227-1247` | `:986-1008` | ✅;`:1239`/`:1243` 两处光晕→`0 0 0 4px var(--success-soft/--warning-soft)` |
| G `.k-set-danger` / `.k-set-soon` | `:1249-1265` | `:1010-1029` | ✅;🔴 **`:1252` 的 `.k-set-danger .k-set-row-title { color: var(--danger) }` 在**(见下) |
| H `.k-sandbox-*` | `:1267-1293` | `:1031-1053` | ✅;`:1287`→`--grad-sandbox`、`:1288`→`--text-on-accent`、`:1292`→`--gloss-inset-dot` |
| I `.k-modal-head/-title/-x/-body` | `:1317-1334` | `:1082-1099` | ✅ 逐字(K17 兑现),落在 `.k-modal` 与 `.k-modal-foot` 之间 = 蓝本原位 |
| J `kn-*` | **`:2250-2263`** | `:1612-1630` | ✅ 逐字;🔴 **K9 已嵌套**;🔴 **`:2245-2249` 与 `:2264+` 一条都没多搬** |
| FolderBrowser | `FolderBrowser.vue:82-143` | `:1631-1711` | ✅ 逐字(见 §5) |

**🔴 四个点名项逐条落实:**

1. **A 段没有搬 `:985-991`** —— 全文 `grep -nE '\.k-section-body'` 只命中 **注释 3 行**
   (`:64` / `:868` / `:869`),**零规则块** ✅。(蓝本 `.k-section-body` 闭合 `}` 确实在 `:991`,
   brief 那个 `:988` 边界会截断它 —— 勘误 E-3 成立。)
2. **`:1252` 的危险区标题变红那条在** —— New-UI `:1027`:
   ```scss
   .k-set-danger { … .k-set-row-title { color: var(--danger); } }
   ```
   ✅ 在 G 段内、嵌套关系与蓝本一致。(附录 §12.1 点名的「C-7 漏了的第二处 `.k-set-row-title`」没被漏。)
3. **`kn-*` 段 K9 已嵌套 + 没多搬** —— 括号配平实测:壳块 `.knowledge-app {` 是 **`:345-1712`**,
   J 段 `:1612-1630` **在壳块内**,且每条规则缩进 2 空格(`  .kn-picked {` / `  .kn-mig-path {` …)✅。
   顶层裸选择器全文只有 5 处,**全部早于本刀**(`:130`/`:249` 两个 token 块 · `:345`/`:1808` 两个壳块 ·
   `:1987` 既有 k2 浅档覆写)→ **本刀零顶层裸选择器泄漏** ✅。
   `:2023-2249` 那几十个 P5d 的 `.kn-*`:「没有搬多」断言实测 `extra = []`,且我的探针④证明它真会报红。
4. **`:811-813` 那三行陈旧注释已改写** —— 见 §4。
5. **`.kn-badge` 零重复定义** —— `grep -nP '^\s*\.kn-badge'` 只有 `:1596`(基类)+ `:1602/:1603/:1605/:1607`
   四档 `data-s`,**全部是 P5b 的既有代码**,本刀那段的头注释 `:1615` 明确写「P5b-T2 已搬,就在上面,不重复定义」✅。
6. `@keyframes` —— `k-modal-pop` 全文 **只 `:1738` 一处**,`k-fade-in` 只 `:1734` 一处,
   **本刀新增 keyframes = 0** ✅;keyframes 存在性守卫与 N11 的 `fade-in` 例外 `diff` 实测 **逐字未动** ✅。

---

## 4. K17 陈旧注释(「留 P5c」)—— 已改写,不再误导 ✅

两处都改成「已兑现」口径,不是留着:

- 文件头 `:18`:`显式不搬:K17 的 …(留 P5c —— **已由下面的 P5c-T2a 段兑现**)`
- Modals 段头 `:1056-1058`:`【P5c-T2a 订正】…P5b 当时两个视图都不用,留给了 P5c;**本期已搬**,
  就落在下面 .k-modal 与 .k-modal-foot 之间(蓝本原位),故本节现在是蓝本 :1296-1341 连续一整段。`

✅ 两处都不再是误导性的「未来待办」。

---

## 5. N15 —— `.k-progress-*` 六类:未搬 + 断言真守得住(我自己反向扫了)

**正向**:`grep -nE '\.k-progress-'` 只命中 **注释 2 行**(`:61` / `:896`),**零规则块** ✅。
蓝本 `:1152-1157` 六类逐个确认为 `.k-progress-card/-row/-label/-nums/-bar/-fill`,
夹在 B(`:1141-1149`)与 C(`:1159-1179`)之间,勘误 E-6 的「精确 6 行」成立。

**反向(RED 探针④,不采信报告)**:往 B/C 之间硬塞
`.k-progress-bar { }` + `.k-section-body { }` + `.fb-foo { }`：

```
× 没有搬多 —— 全部 k-/k2-/kn-/fb 类都在白名单内(附录 D.4 自检命令②的常驻版) 7ms
AssertionError: 白名单外的类:k-progress-bar, k-section-body, fb-foo
      Tests  1 failed | 22 passed (23)
```
→ 🔴 **三个名字全部被精确指名。N15 与「不搬 `.k-section-body`」这两条都是活守卫,不是空转。**

---

## 6. 4 个新 token —— 两档值逐字核 + 档次方向没搞反

`tokens.scss` 块边界实测(治理 §5 警告过这里档次与 `.knowledge-app` **相反**):

```
31:.agent-app,                      ← 浅色块开始
247:}                               ← 浅色块 :31-247
249:.agent-app[data-theme="dark"],  ← 暗色块开始
365:}                               ← 暗色块 :249-365
```

| token | 出处 · 值(逐字 `sed -n` 打开) | knowledge.scss **暗档**(`:239-242`)引用 | knowledge.scss **浅档**(`:333-336`)引用 |
|---|---|---|---|
| `--switch-thumb` | `:201` / `:345` = `#ffffff` | 注 `tokens.scss:345`(**暗块**)✅ | 注 `:201`(**浅块**)✅ |
| `--switch-thumb-shadow` | `:202` / `:346` = `0 2px 4px rgba(0, 0, 0, 0.18)` | 注 `:346` ✅ | 注 `:202` ✅ |
| `--gloss-inset-dot` | `:162` / `:321` = `inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)` | 注 `:321` ✅ | 注 `:162` ✅ |
| `--grad-sandbox` | `:236` `--grad-sk-blue` = `linear-gradient(135deg, #5AC8FA, #007AFF)` | 注 `:236` ✅ | 注 `:236` ✅ |

🔴 **两档都有值 ✅;方向没搞反 ✅** —— 暗档块引的是 `tokens.scss` 的 **暗块**行(`:345/:346/:321`),
浅档块引的是 **浅块**行(`:201/:202/:162`)。这正是本刀最容易翻车的点,实现者做对了。
四个值**逐字节相同**(我 `sed -n` 逐行打开对过,不是眼看)。
`--grad-sk-blue` 全文只 `:236` 一处、暗块未重定义 → `--grad-sandbox` 两档同值有据 ✅。
`--grad-sandbox` **全仓零重名**(`grep -rn` 只命中 `knowledge.scss` 与新断言)✅ —— 「改名不改值」落实。

---

## 7. `.fb-*` 段两类 `var()` 分开处置(治理 §12.1 / 附录 B §B.3、§B.5)✅

逐行对蓝本 `FolderBrowser.vue:82-143`:

**类别 ①「Vue2 零声明 → 按回退值映射」(3 处)** —— 处置正确:

| 蓝本 | 蓝本原文 | New-UI |
|---|---|---|
| `:85` | `border: 1px solid var(--border, rgba(127,127,127,0.25))` | `1px solid var(--line)` ✅ |
| `:95` | `border-bottom: 1px solid var(--border, rgba(127,127,127,0.18))` | `1px solid var(--line-faint)` ✅(0.18 < 0.25 → 淡档,大小关系保住) |
| `:96` | `background: var(--bg-tertiary, rgba(127,127,127,0.06))` | `var(--bg-sunken)` ✅ |

**类别 ②「Vue2 有声明 → 同名 token 直接沿用,一个字不改」(6 处)** —— 处置正确:
`:104 var(--text-secondary)` · `:107 var(--text-primary)` · `:108 var(--text-tertiary)` ·
`:126 var(--text-primary)` · `:139 var(--text-tertiary)` · `:142 var(--danger)` → **6/6 原样照抄** ✅。

🔴 **两类没搞混**(这是本刀 Important 级的判据,判定通过)。
另:`:106`/`:128` 两处裸 `rgba(127,127,127,0.12 / 0.1)` → 同映 `var(--line)`(取舍③,已在段头注释就地登记);
`:100`/`:121` 两处 `background: transparent` 照抄 ✅。
`& + &::before` 嵌套后展开为 `.knowledge-app .fb-crumb + .knowledge-app .fb-crumb::before` ——
匹配集与蓝本相同(两个 `.fb-crumb` 必在同一个 `.knowledge-app` 内),报告的分析我复核成立 ✅。

---

## 8. 守卫改动:逐条判「扩」还是「放宽」—— **五处全是扩,零放宽**

### 8.1 `DARK_TOKEN_SELECTOR` / `LIGHT_TOKEN_SELECTOR` 跟 K21 改 → **扩(新增防漂移能力)**
改后这两个常量成了「K21 被回滚就报红」的守卫。RED 探针② 实证(§9)。

### 8.2 白名单 `WHITELIST_187` → `WHITELIST_226`(+39)→ **扩**
程序化复核(脚本剥注释后抽引号项):
```
WHITELIST_226 length = 226   unique = 226
appendix D.1 count = 39      all in whitelist = true
old length = 187
REMOVED from old (must be []) = []        ← 🔴 零删除,零放宽
added = 39   added == D.1 set = true      ← 增量与附录 D §D.0/§D.1 逐一相同
```
- 🔴 **226 与附录 D §D.0 一致**(不是治理正文初稿那个 191 —— §6.4.1 与 §6.4-3 已订正,我按 226 核的)。
- `toHaveLength(226)` **在** ✅ · `new Set(WHITELIST_226).size === 226` 去重断言 **在** ✅ ·
  常量名跟数字改 ✅ · describe 标题与用例名同步 ✅。

### 8.3 `NON_K_HELPER_CLASSES` 9 → 10 → **扩(合规)**
```
old (9) : danger ghost mono outline primary right second spin suffix
new (10): danger ghost mono outline primary right second spin suffix warn
added   : ["warn"]      removed: []
```
🔴 **只加 `warn`,`parser-app` 没进登记表** ✅ —— 完全符合治理 §6.4-2 的裁定与 §6.4.1 的解释
(「保持 9 项」= 不许塞 `parser-app`,不是禁止任何新增)。`.warn` 确实是本期真新增的非 `k*` 类
(蓝本 `:1174` 的 `.k-set-row-desc` 内嵌套),D §D.1.1 授权。
`parser-app` 走 **排除条件** `c !== 'parser-app'`(与既有 `c !== 'knowledge-app'` 同款)✅。

### 8.4 缺口① 正则 → **扩,且我独立证明是治理字面版的严格超集**
```
治理字面版:  /\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g
实际落地版:  /\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g
```
**不采信报告的说法,自己写穷举证明**(字母表 `k 2 n f b - a 0 z 9 x . { 空格`,长度 ≤ 6):
```
brute strings tested = 8108730 | gov-only matches (must be 0) = 0  []
```
→ 🔴 **810 万条候选串里,治理字面版能扫到而落地版扫不到的匹配 = 0 条。严格超集,零断言放宽。**
落地版额外覆盖**裸 `.fb`**(`FolderBrowser.vue:2` 的 `class="fb"`,`knowledge.scss:1647`),
治理 §6.4.1 第 1 条已追认。RED 探针④ 实证 `.fb-foo` 会被指名(§5)。

### 8.5 浅档 token **集合式**覆盖断言:例外清单 **未扩** ✅
```
$ diff <(old SHARED_STRUCTURAL_EXCEPTIONS) <(new SHARED_STRUCTURAL_EXCEPTIONS)
IDENTICAL (unchanged)
```
`it('例外清单当前恰好是这 11 个,不多不少…')` 与其集合相等断言 `actualOnlyDark.toEqual([...清单].sort())`
**逐字未动** ✅ —— 报告称的「11 项未扩」成立(我独立 `diff` 验的)。
4 个新 token 两档都写了 → 集合断言天然通过,符合附录 B §B.8 的裁定。

### 8.6 `@keyframes` 存在性守卫:**逐字未动** ✅
```
$ diff <(old N11 block) <(new N11 block)
KEYFRAMES GUARD IDENTICAL
```
`k-modal-pop` 零重复定义 ✅ · 本刀新增 keyframes **0** ✅ · N11 的 `fade-in` 例外未动 ✅。

### 8.7 断言总量:纯增加
```
it():      22 → 23   (+1)
expect():  60 → 63   (+3)
```
新增的那条 `it` 是「4 个新 token 两档取值逐字等于 AI tokens.scss 出处值(禁重算)」——
附录 B §B.8 的「建议」被落实成断言,**是加固不是放宽**。
**零空转用例**:该断言我用 RED 探针③ 实证会精确报红(§9)。

---

## 9. 我自做的 4 条 RED 探针(原始命令 + 原始输出 + 逐字节还原)

基线校验和:
```
e4f5f22e576cd81128f36427650dab3a  src/ai/styles/knowledge.scss
e3f266812dcc44d5dd8fc7169bab0535  src/ai/styles/knowledgeStyles.test.ts
```

### 探针① —— 新增段里塞色字面量(治理 §11 第 1 条要求的那条)
```bash
perl -0pi -e 's/(\.k-set-soon \{\n)/$1    color: #ff0000;\n/' src/ai/styles/knowledge.scss
# 1011:    color: #ff0000;
pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts   # exit=1
```
```
× token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…) 4ms
AssertionError: 声明层之外出现 #hex: expected '/* 1:1 移植自 Vue2 …' not to match /#[0-9a-fA-F]{3,8}\b/
      Tests  1 failed | 22 passed (23)
```
✅ **报红,且报错消息精确点名 `#hex`。**

### 探针② —— 把 token 选择器改回单个 `.knowledge-app {`(K21 回滚)
```bash
perl -0pi -e 's/^\.knowledge-app, \.parser-app \{$/.knowledge-app {/m;
              s/^:root\[data-theme="light"\] \.knowledge-app, :root\[data-theme="light"\] \.parser-app \{$/:root[data-theme="light"] .knowledge-app {/m' \
  src/ai/styles/knowledge.scss
```
```
× token 声明层之外…零色字面量 / × color-scheme 两档 / × R2 / × R4 / × --danger-hover /
× P5c-T2a 的 4 个新 token 两档取值 / × --accent-soft-2 / × 浅色档必须显式声明 --accent… /
× 暗色块声明的每一个颜色 token,浅色块必须也声明 / × 例外清单恰好 11 个
AssertionError: 找不到声明块 .knowledge-app, .parser-app {(行首锚定,已排除注释里的同名引用):
                expected null not to be null
 ❯ declBlockRange src/ai/styles/knowledgeStyles.test.ts:291:64
      Tests  10 failed | 13 passed (23)
```
✅ **`DARK_TOKEN_SELECTOR` 精确报红**,10 条断言全部指向同一根因。K21 一旦被回滚立刻被逮。

### 探针③ —— 删掉一个新 token 的**浅档**声明(`--gloss-inset-dot`,`:335`)
```bash
perl -ni -e 'print unless $. == 335' src/ai/styles/knowledge.scss
```
```
× P5c-T2a 的 4 个新 token 两档取值逐字等于 AI tokens.scss 出处值(附录 B §B.8:禁重算) 12ms
  AssertionError: 浅色档 --gloss-inset-dot 缺声明或取值被改动(不许"两档同值就省一档")
× 暗色块声明的每一个颜色 token,浅色块必须也声明(白名单外漏一个就精确指名) 3ms
  AssertionError: 浅色档漏声明的颜色 token(白名单外):--gloss-inset-dot
× 例外清单当前恰好是这 11 个,不多不少(防止清单被悄悄扩大当垃圾桶) 2ms
  + "--gloss-inset-dot"
      Tests  3 failed | 20 passed (23)
```
✅ **三条断言各自「指名」`--gloss-inset-dot`**,集合式断言不是空转。

### 探针④ —— N15 反向扫描 + 缺口① 的 `fb` 覆盖(见 §5,输出略)
✅ **`白名单外的类:k-progress-bar, k-section-body, fb-foo`** 三个全被指名。

### 还原确认
```
$ md5sum src/ai/styles/knowledge.scss src/ai/styles/knowledgeStyles.test.ts
e4f5f22e576cd81128f36427650dab3a  src/ai/styles/knowledge.scss    ← 与基线相同
e3f266812dcc44d5dd8fc7169bab0535  src/ai/styles/knowledgeStyles.test.ts  ← 与基线相同
$ git status --short      # (空)
$ git diff --stat HEAD    # (空)
```
🔴 **4 条探针全部逐字节还原(校验和相同,不是"看起来一样"),`git status` 收尾干净。
本评审全程零改仓、零提交。**

---

## 10. 重名 / 串号人肉 grep(嵌套作用域串号单测与 color-guard 都抓不到)

把 **39 个新类 + `warn` + `parser-app` 共 41 个名字**逐个对
`agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` /
`tokens.scss` / `theme.css` 扫:
```bash
for n in $NAMES; do grep -rnP "(^|[ ,>~+({])\.$n(?![a-zA-Z0-9_-])" <六个文件>; done
=== classes with collisions: 0 ===
```
→ 🔴 **零重名 ✅。** 治理 §D.5 那 4 处已知命中(`.agent-app .card` 等)与本刀 39 个类无交集
(它们是 Parser 两页的裸类名,归 T2b)。

`knowledge.scss` 内部重复定义自查:`k-section` / `k-set-card` / `k-sw` / `k-modal-head` /
`k-modal-body` / `fb` / `fb-row` 各 **1 处**;`kn-picked` 3 处 = 基类 + `code` 后代 + **1 行注释**
(蓝本 `:2251`/`:2252` 两条规则,两条都搬)✅ 无重复定义。

---

## 11. 三门 + sass + dist(我自己复跑,不采信报告)

```
$ pnpm test          → exit 0 ·  Test Files  319 passed (319) ·  Tests  3161 passed (3161)
$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null  → exit 0
$ pnpm exec vue-tsc --noEmit                                             → exit 0
$ pnpm build                                                             → exit 0
```
🔴 **319 / 3161 与报告逐字一致 ✅。干净单轮、零红、零复跑** —— 已知的两条噪声
(`persist.test.ts > dropPersisted…` · `AgentComposer.test.ts` vue-i18n teardown)本轮**都没红**。

**+1 例的算术复核**:T1 报告终值 = **319 / 3160**(`p5c-task-1-report.md:401-402`,其评审也复跑确认)
→ 本刀 `it()` 数 22 → 23(+1)→ **3160 + 1 = 3161 ✅**,文件数 319 不变(本刀零 `.vue`、零新测试文件)。

**真进构建管线**(`dist/assets/*.css` grep 命中数):
```
k-sandbox-icon  1     fb-crumbs   1     k-modal-head  2     kn-checkline  2
parser-app      2     k-set-danger 2    switch-thumb 12     grad-sandbox  3
```
✅ **报告点名的 5 个(`k-sandbox-icon`/`fb-crumbs`/`k-modal-head`/`kn-checkline`/`parser-app`)全部命中**,
另外两个新 token 也真编进了产物 —— K21 的 `.parser-app` 选择器在生产 CSS 里确实生效。

---

## 12. 提交范围

```
$ git show --stat 4212163
 .superpowers/sdd/p5c-task-2a-report.md | 498 +++++
 src/ai/styles/knowledge.scss           | 380 ++++-
 src/ai/styles/knowledgeStyles.test.ts  | 120 ++-
 3 files changed, 979 insertions(+), 19 deletions(-)
```
✅ 恰好三个文件 · 🔴 **零 `.vue` 改动 ✅ · 零新建文件 ✅**
(`parser-styles.scss` / `parserStyles.test.ts` 归 T2b,**没有越界建**)
✅ **治理 §1.1 全期零改动清单 19 项一行都没动**(`tokens.scss` / `theme.css` /
`agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` /
`.sp8/NimoOS-Service/**` 全部 0 改动 —— `git show --stat` 直接证明)。

---

## 13. 与报告不符之处(全部 Minor,零产品代码问题)

| # | 报告写的 | 我实测的 | 影响 |
|---|---|---|---|
| **M-1** | §7 标题「**四条** RED 探针」 | 正文实列 **5 条**(探针 1-5),commit message 也写「5 条」 | 纯标题笔误 |
| **M-2** | 探针 1 RED 输出 `Tests 9 failed \| 14 passed (23)` | 我复现同一改动得 **`10 failed \| 13 passed (23)`**。根因:报告的失败清单把「暗色块…浅色块必须也声明」与「例外清单恰好 11 个」**挤在同一个 bullet 里**,数成了 9 | 探针**实质正确**(我独立复现了同一条精确报错消息),仅计数转写少 1 |

## 14. 其余 Minor(非报告问题,登记备查)

- **M-3** `nonKClassNames` 的排除条件是 `/^fb(?:-|$)/`,而「没有搬多」正则只认小写
  `[a-z0-9-]+` → 理论上 `.fb-Foo`(带大写)会同时躲过两条断言。
  🔴 **但这不是本刀引入的**:既有的 `!/^k(?:2|n)?-/` 与 `\.k(?:2|n)?-[a-z0-9-]+` 有**一模一样**的
  对称缺口(`.k-Foo`),早于 P5a。scss 惯例全小写、实际风险≈0。
  **建议**:哪一期顺手收紧时两处一起改成 `[A-Za-z0-9-]+`,不值得为它开修复轮。
- **M-4** 新增的 `.fb-crumbs` 段头注释写了裸 alpha 数字(`(0.18 < 0.25)`)。
  R5 禁的是**色字面量**(hex/rgb/rgba/具名色),裸 alpha 不是;且同一文件早于本刀的注释里
  有大量同款先例,附录 B §B.5 本身也是这个写法。**不算违规**,仅登记。

## 15. 实现者三条顾虑的处置状态(复核)

1. 「治理 §6.4-3 的 191 与附录 D 的 226 冲突,建议就地订正」→ ✅ **协调者已在 `4a35e08`/`9ffc612` 订正,
   并新增 §6.4.1**。本评审按 **226** 核,数字与附录 D §D.0 一致。
2. 「缺口① 正则比治理字面版宽一档」→ ✅ **§6.4.1 第 1 条已追认**;我用 810 万条穷举独立证明是
   **严格超集、零断言放宽**。实现者「不改附录 D §D.1.1(只加 `warn`)」的取舍判定正确。
3. 「取舍② 在本刀就已生效,不只 Parser 两页」→ ✅ **§6.4.1 第 2 条已追认并把裁定 A-2 的范围扩大到
   设置页(T8/T9)验收清单**。实现者主动上报了一个协调者原本会漏的范围问题,是加分项。

---

## 16. 最终判定

| 维度 | 结论 |
|---|---|
| 逐行色扫(治理 §11-1) | ✅ 两套独立方法,块外 **0** 命中(含注释) |
| K21 三条硬约束(§6.1 / §11-5) | ✅ 块内仅 2 行选择器变更 · 各写一行 · 零 `.parser-app` 规则块 |
| 11 段搬运 | ✅ **11/11 逐行对蓝本核准**;`.k-section-body`/`:1252`/K9/`kn-badge`/K17 注释 五个点名项全过 |
| N15 | ✅ 未搬 + 反向 RED 探针证明断言活着 |
| 4 个新 token | ✅ 两档逐字同值 · **档次方向没搞反** · 零重名 |
| `.fb-*` 两类 `var()` | ✅ 3 处按回退值映射 / 6 处同名沿用,零混淆 |
| 守卫五处 | ✅ **全是扩,零放宽**(零删除 · 226/10 数字对 · 正则穷举证超集 · 例外清单与 keyframes 守卫逐字未动) |
| 空转 / 削弱 / 越界 | ✅ 零空转(4 条探针实证)· 零削弱 · 零越界 |
| 三门 + sass + dist | ✅ 319 / 3161 / 0 / 0 / 0,dist 全部命中 |
| RED 探针 | ✅ 自做 4 条全红且精确指名,md5 逐字节还原,`git status` 干净 |

# ✅ Ready to merge —— Critical 0 / Important 0 / Minor 4(2 条报告文字瑕疵 + 1 条早于本刀的对称缺口 + 1 条非违规登记)

**这一刀的质量高于本期平均**:实现者主动申报了对治理的一处偏离(正则超集)并**程序化证明**了它零放宽,
还上报了一个协调者原本会漏的范围问题(取舍② 的适用范围),两条都已被协调者采纳写进治理 §6.4.1。
`tokens.scss` 档次相反这个陷阱也躲过了。**Minor 4 条建议不开修复轮,M-1/M-2 由协调者酌情让实现者
在下一次提交时顺手订正报告文字即可;M-3 转下游顺手收紧。**

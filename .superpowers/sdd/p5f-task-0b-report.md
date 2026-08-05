# SP8-P5f · T0b 整改刀报告(附录整改轮,2026-08-06)

> 实现者:T0b(opus)· 起点 **`59014f0`**(自己 `git rev-parse` + `git log` 现测确认)
> 输入:`p5f-coordinator-rulings-T0.md`(权威最高)· `p5f-task-0-review.md`(427 行)· `p5f-task-0-report.md`(702 行)
> 🔴 **本刀零 `src/` 改动**、零 `amend`/`stash`/`reset`/`rebase`、零部署、零 push、零 Service 仓改动、零装依赖。
> 🔴 **每一条 Important 我都自己重跑了一遍再改**;评审的证据只当「待验清单」用(R18)。
> 🔴 **与评审不一致处一律以我的实测为准并显式申报** —— 本刀有 **2 处**(§7 M-2 / §8 M-4)。

## 0. 结论速览

| 条 | 事 | 我的复核 vs 评审 | 状态 |
|---|---|---|---|
| **R4 / I-1** | 附录 D 汇总表段边界矛盾 | 🟢 **一致** | ✅ 已改 |
| **R5 / I-2** | 扩展名表 12+13+**25**=50(E-74) | 🟢 **一致** | ✅ 已改 |
| **R6 / I-3** | 真机命中 **11/12/21** + `.wps` 不渲染 | 🟢 **一致** | ✅ 已改 |
| **R7 / I-4** | 撞车表 en 侧 | ⚠️ **措辞不一致**(见 §4.3)—— 缺陷是「不完整」不是「值错」 | ✅ 已改 |
| **R8 / I-5** | 补引 P5c-T2a 先例 + alpha 保序 + E-73 | 🟢 一致;⚠️ **坐标现测是 `:2057-2090`**,评审写 `:2058-2088` | ✅ 已改 |
| **M-1** | A 段色字面量 6 → **5** | 🟢 **一致** | ✅ 已改 |
| **M-2** | `sim-r8r9.mjs`「不存在」 | 🔴🔴 **完全不一致 —— 评审错了**,脚本存在且可跑 | ✅ **反转登记 E-75** |
| **M-3** | `.REAL` 口径「一字未改」 | 🟢 **一致** | ✅ 已改 |
| **M-4** | `__meta` 只取数据字段 | ⚠️ **裁定书说 4 份,实测 6 份** | ✅ 已改(补 2 份) |
| **M-5** | E-67 结论保留、理由改写 | 🟢 **一致** | ✅ 已改 |
| **M-6** | `kr-path`/`kr-input` 字体栈申报 | 🟢 **一致** | ✅ 已改 |
| **第 12 项** | 治理 + 计划书旧数字订正块 | — | ✅ 已改 |

**六个提交**(全部 `git add -f`,分段落盘):
`659ac7a` 附录 D · `9350038` 报告 · `ebf49e4` 附录 A · `8f683e4` 附录 B · `ed5681c` fixtures README · `29e2bf0` 治理+计划书。

**🔴 `src/` 零改动自证**:

```
$ git diff --name-only 59014f0 HEAD -- src/     → (空)
$ git status --porcelain -- src/                → (空)
$ git diff --name-only 59014f0 HEAD             → 7 个文件,全在 .superpowers/sdd/
$ git stash list                                → 两条 master 线 WIP 原封未动(未 pop/apply)
```

---

## 1. R4 / I-1 —— 附录 D 汇总表的段边界矛盾

### 1.1 改了什么

`p5f-appendix-D-classes.md` §D.3:

1. 汇总表「实测应取」一栏 `:985-1151` → 🔴 **`:985-1141`**;
2. 🔴 **把 `:985-1151` 从整个 `.superpowers/sdd/` 目录里整条删除**(不是加脚注,按 R4);
3. 新增 **§D.3.0 订正块**:记录原缺陷 + 逐行蓝本证据 + 🔴 **明写 `:1141` 那行注释「不搬」**;
4. §D.3.1 的行号图补上 `:1139` 与 `:1141` 两行,与 §D.3.0 对齐。

### 1.2 🔴 我自己逐行复读蓝本 `:978-1170` 的证据(不采信评审)

```bash
$ cd /home/nimo/NimoTech/NimoOS-UI
$ git show 7a6ee6b7:src/views/AI/Knowledge/styles/knowledge.scss > $SP/bp-knowledge.scss
$ awk 'NR>=978 && NR<=995 {printf "%d| %s\n", NR, $0}' $SP/bp-knowledge.scss
```

```
980|   }
981|   .k-section-hint {
984|   }
985|   .k-section-body {          ← 🔴 A 段真正的第一行
986|     background: var(--bg-elevated);
991|   }
992|   .k-extgroup {
```

```bash
$ awk 'NR>=1114 && NR<=1129 …'   $ awk 'NR>=1130 && NR<=1172 …'
```

```
1114|   .k-frow-action {
1120|     &[data-act="allow"] { background: rgba(52,199,89,0.12); color: #1f9c47; }
1121|     &[data-act="deny"]  { background: rgba(255,59,48,0.12); color: var(--danger); }
1122|   }
1123|   .k-priority-hint {          ← A 段最后一条规则
1130|     code {
1138|     }
1139|   }                           ← 🔴 .k-priority-hint 闭合 = A 段最后一行内容
1140| (空行)
1141|   /* ---------- Settings page ---------- */   ← 🔴 注释,不搬
1142|   .k-set-card {               ← ✅ P5c-T2a 已搬(本仓 :1325)
1152|   .k-progress-card …          ┐
1157|   .k-progress-fill …          ┘ ⛔ 6 个死类
1159|   .k-set-row {                ← ✅ P5c-T2a 已搬(本仓 :1334)
```

🟢 **结论:`:985-1141` 正确,与评审一致。** 且我确认了评审说的「已搬类与死类**交错**」属实
(`.k-set-card` `:1142` → 死类 `:1152-1157` → `.k-set-row` `:1159`)⇒ **「整段搬再删死类」这条路确实行不通。**

### 1.3 清干净的自证

```bash
$ grep -rn "1151" .superpowers/sdd/     → (空)
```

🔴 **全目录再无第二个 A 段数字。**

---

## 2. R5 / I-2 —— 扩展名表 `12 + 13 + 25 = 50`(勘误 **E-74**)

### 2.1 改了什么

`p5f-appendix-D-classes.md` 新增 **§D.3.2**:登记 E-74 · 三组计数 · 🔴 **`code` 组 25 项逐项列表** ·
`docs` 12 项与 `text` 13 项也一并列全 · T4 三条断言 `toBe(12)/toBe(13)/toBe(25)` ·
重申「N54 逐字照抄,不许补全也不许删减」。同步进 `p5f-task-0-report.md` §16 勘误表。

### 2.2 🔴 我自己程序化数蓝本三个数组的证据

```js
// $SP/t0b-ext.mjs —— 从 bp-AllowlistView.vue 的 :161/:163/:165 抽 [...] 字面量逐项切分
for (const [id, ln] of [['docs',161],['text',163],['code',165]]) {
  const arr = src[ln-1].match(/\[([^\]]*)\]/)[1].split(',').map(s=>s.trim().replace(/^'|'$/g,'')).filter(Boolean);
```

```
docs (:161) = 12
text (:163) = 13
code (:165) = 25
total = 50
组内重复 0 · 跨组重复 0

code 逐项:
.py .go .js .ts .jsx .tsx .java .c .cc .cpp .h .hpp .cs .rb .rs .php .sh .bash .zsh .fish .sql .lua .kt .scala .swift
```

🟢 **与评审完全一致(25 项逐个对得上)。** 治理 §3.5 N54 与计划书 T4-4 写的「24」确实是错的。

---

## 3. R6 / I-3 —— 真机命中数 **11 / 12 / 21** 与 `.wps`

### 3.1 改了什么

`p5f-task-0-report.md` §10.1:原三个数字划掉,新增

- **§10.1.1 订正块** —— 新旧对照表 + 实算输出;
- **§10.1.2 `.wps` 专节** —— 写明「45 认 / 44 显示」、🔴 **是 N54 蓝本行为不是缺陷**、
  收官验收清单**必写**的原文措辞、以及「具体计数有保质期,附现测命令别钉死数字」。

同步进 §16 勘误表(**E-76**)。

### 3.2 🔴 我自己拿 45 条实算的证据

```js
// 同 $SP/t0b-ext.mjs 后半段:REAL 的 45 条逐条过三张 match 表
const real = JSON.parse(fs.readFileSync('.superpowers/sdd/p5f-fixtures/allowlist-extensions.REAL.json'));
```

```
REAL total = 45
  docs matches 11
  text matches 12
  code matches 21
  sum shown = 44
  UNMATCHED (页面不渲染): [ '.wps(enabled:1)' ]
```

🟢 **11 / 12 / 21 与评审完全一致;T0 原写的 9/13/20 三个全错。**
🟢 **`.wps` 确实 `enabled: 1` 且三组都不匹配** ⇒ 页面上既显示不出、也开不了、也关不了。

⚠️ **我复核了这确实是蓝本行为而非本期引入**:`GROUPS_TEMPLATE` 只有三张写死的 `match` 表、
**没有「其它」兜底组**,`filter(g => g.exts.length > 0)` 只管隐藏空组,不管兜底未分组项。
⇒ **改它 = 改蓝本行为,违「界面严格 1:1」** ⇒ 不在 P5f 范围,票 E 成立。

---

## 4. R7 / I-4 —— 撞车表

### 4.1 改了什么

`p5f-appendix-A-i18n.md`:

- 新增 **§A.3.0 订正块** —— 🔴 **顶部第一句就是「T1 仍必须自己重跑双向扫描」**(治理 §7.1 明令假定本表不完整);
  记录我的复核方式与三项复核结果;并申报与评审措辞的不一致(见 §4.3);
- 新增 **§A.3.1a** —— 🔴 **补齐 5 行单侧撞车**,含**本期唯一的 en 单侧撞车**;
- §A.3.1 表尾加三行警示:「6 个『—』实测为真空」「本表不完整」「有『—』≠ en 方向不用扫」。

同步进 `p5f-task-0-report.md` §16 勘误表(**E-77**)。

### 4.2 🔴 我自己重跑双向扫描的证据

**方法**:esbuild bundle `src/i18n/zh_cn.ts` / `en_us.ts` → **真实 ESM `import`**(不做文本解析),
解析附录 A §A.6 的 90 行表格,**两个方向都扫**。

```
zh keys 1648   en keys 1648
zh\en 0        en\zh 0
aiKb* zh 441   en 441
parsed rows 90       dynamic 7
appendix vs blueprint mismatches: 0      ← 🟢 §A.6 的 90 行 zh/en 值逐码点全对
=== 撞车行数 = 28 ===                     ← 🟢 与 T0 / 评审三方一致
```

**逐行 both / zhOnly / enOnly 拆解(节选关键 5 行)**:

```
Removed   both=[aiKbStatusRemoved]  zhOnly=[aiCfgDeleted]  enOnly=[addPanelRemovedToast]  ← 🔴 唯一 en 单侧
Action    both=[aiKbColAction]      zhOnly=[filesColType aiTypeLabel aiKbColType]
Delete    both=[filesCtxDelete filesUploadCancel appsCustomLinkDelete aiConfirm aiCfgDelete aiSkDelete aiKbNtDelete]
                                    zhOnly=[appsSettingsRemove]
Auto      both=[aiCfgMemSourceAuto aiSkTagAuto aiKbOriginAuto aiKbDeviceAuto]  zhOnly=[aiCfgAutoPlaceholder]
Documents both=[searchTabDocuments] zhOnly=[aiKbDocumentsSuffix]

--- 存在 enOnly 的行 ---
 Removed: enOnly=[addPanelRemovedToast]         ← 全 90 行里只有这一条
```

**§A.3.1 现有 7 行的 en 列复核**:

```
File types / enabled / Add failed / Root enabled / Root deleted / Renamed → enOnly=[] 且 ce=[]  ⇒ 「—」正确
Documents                                                                → en 撞 searchTabDocuments(原表已写)
```

### 4.3 ⚠️ **与评审措辞不一致(已在 §A.3.0 显式申报)**

评审 I-4 标题写「附录 A §A.3.1 的『en 撞』列**全是**「—」**是事实错误**」。
🔴 **我的实测认为这个措辞不准确**:

1. 该列**不是全「—」** —— `Documents` 那行原本就写着 `searchTabDocuments`;
2. 那 6 个「—」**逐个实测都是空的,值本身没写错**。

🔴 **真正的缺陷是「不完整」而不是「值错」**:§A.3.1 只枚举了**判定为不可复用**的 7 行,
另有 5 行单侧撞车散落在 §A.2 / §A.3.2 里一处没登记 —— **其中含唯一的 en 单侧撞车**。
**读者会据此以为 en 方向不用扫**,这才是真风险。

**评审的实质判断(风险低、14 条复用键没有一条会选错)我复核后同意** ——
`Removed` 两侧撞的键集合不同,唯一两档都撞的是 `aiKbStatusRemoved`,而按 **R3** 它按 A-1 拒绝复用
⇒ 新建 `aiKbWkOpRemoved`,**结论与 §A.2 末三条一致,不变**。

---

## 5. R8 / I-5 —— 补引本仓先例 + alpha 保序 + E-73

### 5.1 改了什么

`p5f-appendix-B-tokens.md` §B.2.2 表格加一列「🔴 首要依据(T0b 补)」,并新增:

- **§B.2.3** —— 🔴 **本仓既定先例 `knowledge.scss:2057-2090`(P5c-T2a · FolderBrowser)**,附先例原文与本期对照表;
  🔴 **`--border → --line` 也改引这条先例**(比引 `.k-field select` 硬);
- **§B.2.3.1** —— 🔴 **alpha 保序论证** + 四个 token 两档取值现测表;
- **§B.2.3.2** —— 🔴 **承 E-73:这一处是可见变化,不是等价替换**;明写 **T2 不许引 K54-③ 那句当论证**;
  给出 T2 报告与验收清单的原文措辞。

### 5.2 🔴 坐标我自己现测(⚠️ 与评审的 `:2058-2088` 不同)

```bash
$ grep -n -- "--bg-tertiary" src/ai/styles/knowledge.scss
2064:       ① `var(--border, 回退值)` / `var(--bg-tertiary, 回退值)`(蓝本 :85 / :95 / :96)——
2088:    /* 蓝本 :96 是个无声明的 --bg-tertiary + 中性半透明回退值 → 下沉的工具条底 */
$ awk 'NR>=2050 && NR<=2095 …' src/ai/styles/knowledge.scss
```

```
:2057  /* ---------- P5c-T2a · FolderBrowser(蓝本 FolderBrowser.vue:82-143)----------   ← 注释块起
:2072     …同映 --line 是有意的。 */                                                      ← 注释块止
:2073  .fb {
:2076    border: 1px solid var(--line);            ← 蓝本 :85  var(--border, rgba(127,127,127,0.25))
:2080  .fb-crumbs {
:2087    border-bottom: 1px solid var(--line-faint);← 蓝本 :95  var(--border, rgba(127,127,127,0.18))
:2089    background: var(--bg-sunken);              ← 蓝本 :96  var(--bg-tertiary, rgba(127,127,127,0.06))
:2090  }
```

⚠️ **我采用 `:2057-2090`**(注释块起 `:2057`、`.fb-crumbs` 闭合 `:2090`);评审写的 `:2058-2088` 两端各差一行,
**不影响结论**,但按「坐标自己现测,不许照抄」我用自己的数。

### 5.3 🔴 alpha 保序论证的取值证据

```bash
$ grep -nE "^\s*--(bg-chip|bg-sunken|line|line-faint):" src/ai/styles/knowledge.scss
166:  --bg-sunken: #161617;              359:  --bg-sunken: var(--tool-bg);
167:  --bg-chip:   #2A2A2C;              360:  --bg-chip:   var(--tool-bg-hi);
191:  --line:      #2E2E31;              401:  --line:      var(--card-border);
193:  --line-faint:#262628;              403:  --line-faint:#EEEBE3;
```

中性灰叠暗底 **α 越大越亮**;先例用 **0.25 → `--line`** / **0.18 → `--line-faint`** 保住大小关系。
本处 **0.12 > 先例的 0.06** ⇒ 取比 `--bg-sunken` 更亮一档的 **`--bg-chip`**(暗 `#2A2A2C` > `#161617`)⇒ **同法**。
🟢 **四个 token 两档齐全。与评审判断一致。**

### 5.4 🔴 E-73 —— 我把**两侧**都测了(评审只测了本仓)

```bash
$ grep -rn -- "--bg-tertiary" src/                                   # 本仓
knowledge.scss:2064 / :2088  ← 都是注释   ⇒ 零声明
$ git -C ../../NimoOS-UI grep -nE "^\s*--bg-tertiary\s*:" 7a6ee6b7 -- src/
(空)                                       ⇒ 🔴 蓝本也零声明
$ git -C ../../NimoOS-UI grep -nE "^\s*--border\s*:"      7a6ee6b7 -- src/
(空)                                       ⇒ 蓝本零声明
$ grep -rnE "^\s*--border:" src/
theme.css:52 (暗) / theme.css:267 (亮)     ⇒ 本仓有声明
```

⇒ 🔴 **`--bg-tertiary` 蓝本与本仓两侧都零声明** ⇒ 兜底 `rgba(127,127,127,0.12)` **一直在生效、是蓝本真实渲染出的颜色**
⇒ **换 `--bg-chip` 是可见变化,不是等价替换。**
⇒ **K54-③ 那句「兜底本是死代码」对 `--border` 成立(本仓 theme.css 有声明)、对 `--bg-tertiary` 不成立。**
🟢 **与评审 / 裁定 R8-2 一致**,我多补了「蓝本侧也零声明」这一半证据。

---

## 6. M-1 —— A 段色字面量 **5 处**

`p5f-appendix-B-tokens.md` §B.0 表格改 5(并把段边界同步成 `:985-1141`);新增 **§B.0.2 订正块**。

🔴 **我自己实扫**(口径 `#[0-9a-fA-F]{3,8}` / `rgba?\(` / `hsla?\(` / 具名色词表,含注释;
🔴 **具名色按「属性值位置」判据,不用裸词边界** —— 承 R11):

```
=== AllowlistA :985-1141(订正后)===
  :1003  white              :1035  transparent  ← 关键字,不算
  :1045  white              :1112  [假阳性]white ← white-space
  :1120  #1f9c47  rgba(     :1121  rgba(
  >>> 真色字面量 = 5   ✅
=== AllowlistModal :1342-1400 → 3 ✅
=== Wiki :2453-2561 → 0 ✅(:2468 :2480 :2507 :2522 :2523 :2536 六行全是 white-space 假阳性)
```

🟢 **A 段 5 处、与评审一致**;原表标题「6 处」与它自己列的 5 个行号**自相矛盾**,确实是算错。
⚠️ 我另确认:**段边界从 `:985-1160` 收窄到 `:985-1141` 不改变这个数**(5 处全在 `:1121` 之前)。

---

## 7. M-2 —— 🔴🔴 **我与评审完全不一致:`sim-r8r9.mjs` 存在且可跑,评审错了**

### 7.1 评审与裁定书的原始命题

评审 §6 M-2 贴了一段 `ls`(只有 7 个文件)断言 `p5e-fixtures/scripts/sim-r8r9.mjs`**「不存在」**、
「T2 照着跑会直接失败」;裁定 §三 M-2 据此要求我**换掉附录 D §D.6.4 的命令**,
并**登记 E-75** 说 `p5e-handoff-to-p5f.md` §一-4 那句「复现脚本可跑(10/10 exit 0)」不成立。

### 7.2 🔴 我的实测:三项独立证据,全部推翻

```bash
$ ls -la .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
-rw-rw-r-- 1 nimo nimo 4702 Aug  5 13:23 …/sim-r8r9.mjs                       ← 文件在

$ git ls-files --error-unmatch .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
.superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs                            ← 被 git 跟踪

$ git cat-file -s HEAD:.superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
4702                                                                          ← 在 HEAD 里

$ node .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs ; echo exit=$?
  …
  现状        : 347 类
  追加 P5e 后 : 347 类
  常量 WHITELIST_348 现长度 348;其中已含本期新类 0 个
  => 常量终值 = 348 + 0 = 348
  NON_K_HELPER_CLASSES 终值 = 19
exit=0                                    ← 🔴 且正是 §D.6.4 要复现的 348 vs 347 基线
```

### 7.3 评审为什么会看错(我查明了)

它贴的 `ls` 只列了 **7** 个:`_inputs classes2 collide k48-equiv lookup propose replay-fixtures` ——
**恰好是该目录 11 个文件按字典序的前 7 个**,`s`/`v` 开头的 4 个整批缺席:

```bash
$ git ls-tree --name-only 973a9b8 .superpowers/sdd/p5e-fixtures/scripts/   → 11 个
… scan-i18n2.mjs  scan-p5e.mjs  sim-r8r9.mjs  verify-fixtures.mjs         ← 评审那份全缺
$ git log --oneline -- …/sim-r8r9.mjs
973a9b8 docs(p5e): T0b 整改 …
d79d922 docs(p5e): T0 探测 …                ← 早在 P5e 就入库
```

⇒ **是评审那次 `ls` 的输出被截断,不是文件不在。**

### 7.4 处置(承 R18:实测与评审不一致 → 以实测为准并显式申报)

1. 🔴 **附录 D §D.6.4 的命令不改** —— 它真能跑,是本节基线的正确复现方式;
2. 🔴 **E-75 反转登记**为「评审 M-2 的事实前提不成立」(附录 D **§D.6.4.1** + 报告 §16 勘误表);
3. 🔴 **`p5e-handoff-to-p5f.md` §一-4 那句成立,不指控它**,下游可照用;
4. **给下游的教训**(已写进 §D.6.4.1):**「文件不存在」这类否定式结论必须用
   `ls <具体路径>` / `git ls-files --error-unmatch` 单点验证,不许拿一次目录列举去做全称否定** ——
   目录列举会被截断,而截断在报告里看不出来。**这是 E-25「否定式断言方向」家族的又一次复发。**

---

## 8. M-3 / M-4 —— fixtures README

### 8.1 M-3 改了什么 + 证据

§0 表格 `.REAL` 一栏改成「本机真机抓的**原始响应内容**;JSON 三份**仅做缩进美化**,
`wiki-raw-DATA.REAL.md` **逐字节未改**」;新增 **§0.1 订正块**(原文划线保留 + 逐份实测表)。

```bash
$ curl -s http://127.0.0.1:8283/v1/parser/allowlist/extensions -o $SP/ext2.json -w "size=%{size_download}\n"
size=2082
$ head -c 120 $SP/ext2.json
{"extensions":[{"ext":".bash","enabled":1,"source":"default"},…      ← 真机是紧凑 JSON
$ md5sum $SP/ext2.json  .superpowers/sdd/p5f-fixtures/allowlist-extensions.REAL.json
754e2ef84bd2f3cba7d4c43566f2dc3b   (现抓,2082 B)
d9536add7662280d2a400b25feaf04b2   (fixture,4795 B,4 空格缩进)   ← md5 不同
$ diff <(json.tool 现抓) <(json.tool fixture)   → 无差异 ⇒ 内容等价 ✅

$ curl -s "$(cat /var/run/nimoos/wiki.url)/v1/wiki/raw?path=/DATA" -o $SP/raw2 -w "http=%{http_code} size=%{size_download}\n"
http=200 size=3430
$ md5sum $SP/raw2  .superpowers/sdd/p5f-fixtures/wiki-raw-DATA.REAL.md
c0449363eb1069a36c9941a0fb842e18   (现抓)
c0449363eb1069a36c9941a0fb842e18   (fixture)      ← 🟢 真·逐字节相同,这条口径按裁定不改
```

🟢 **与评审一致。** 无功能影响,但按 R3-Imp-2「**未申报的加工本身就是缺陷**」仍必须订正措辞。

### 8.2 M-4 改了什么 + ⚠️ **与裁定书的清单不一致**

新增 **§0.2** —— 「下游只取数据字段,`__meta` 转成测试文件里的注释」,附每份「只取什么」的表、
注释里保留三级标签与 `built_from` 的写法示例、以及判据「mock 对象里不许出现 `__meta` 这个键」。

🔴 **裁定 §三 M-4 点名 4 份,我程序化实测是 6 份**(已在 §0.2 显式申报):

```bash
$ for f in *.json; do echo -n "$f: "; python3 -c "import json;d=json.load(open('$f'));print('__meta' if isinstance(d,dict) and '__meta' in d else '—')"; done
allowlist-extensions.REPLAYED.json: __meta        wiki-node.CONSTRUCTED.json: __meta
wiki-roots.normalized.CONSTRUCTED.json: __meta    wiki-tree.CONSTRUCTED.json: __meta
wiki-candidates.CONSTRUCTED.json: __meta   ← 🔴 裁定书漏
wiki-roots.CONSTRUCTED.json: __meta        ← 🔴 裁定书漏
allowlist-extensions.REAL.json: —   allowlist-folders.REAL.json: —   wiki-candidates.REAL.json: —
```

⇒ **表里补上那 2 份**;三份 `.REAL` + `wiki-candidates.REAL.json` 无 `__meta`,可整份直用。

---

## 9. M-5 —— E-67 结论保留、理由改写

**两处都改了**:附录 D **§D.0.1 原文划线 + 新增 §D.0.2 订正块**;报告 **§7.2 原文划线 + 引用块**。

🔴 **按裁定「删掉原来那句『§2.3 的条目在主表计数之外』」** —— 已整条删除并写明原因
(被 `.k-suggest-chip` 反例证伪:它同时出现在 §2.3 与 §2.4 的 P5e 52 类清单里 ⇒ §2.3 条目并不一律外加)。

**改写后的理由**(与附录 D §D.1.1 的实测自洽):§2 的差集法是「蓝本 693 选择器 − 本仓 293 选择器」,
而本仓 `.k-section-body` / `.k-frow` **恰以「为什么不搬」的注释形式存在**
(`knowledge.scss:64` `:1294-1295` `:1578` `:1610` `:1640`)⇒ **提取时若没剥注释**,
会被当成「本仓已有」而掉出 149 差集 → 67 而非 69。

🟢 **结论 69 不变**(T0 / 评审 / 我三方独立同值)。⚠️ 我另点明:**E-67 与本附录抬头那条
「判定已搬必须先剥注释」(E-60)是同一个根因** —— 这条已写进 §D.0.2。

---

## 10. M-6 —— `kr-path` / `kr-input` 字体栈

`p5f-appendix-B-tokens.md` 新增 **§B.2.4**:两处**逐字照抄**蓝本 · 理由(非颜色、`color-guard` 不扫、1:1 纪律)·
⚠️ **蓝本自己不一致** · 🔴 **T2 必须显式申报的原文措辞** · ⚠️ **不许「顺手统一」成 `var(--font-mono)`**(那是未申报偏离 = 缺陷)。

🔴 **我自己现测的两侧原文**:

```
蓝本 RootsView.vue:235   .kr-path  { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; … }
蓝本 RootsView.vue:259   .kr-input { … font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
蓝本 knowledge.scss:1365 .k-field-mono input { font-family: var(--font-mono); font-size: 12.5px; }   ← 同期段内
蓝本 knowledge.scss:1367 .k-field-hint code  { font-family: var(--font-mono); }                      ← 同段又一处
```

🟢 **与评审一致**,我另补了 `:1367` 这处(评审只点了 `:1365`),使「蓝本自己不一致」的证据更硬。
⚠️ 精确化:蓝本 `:1365` 的选择器是 **`.k-field-mono input`** 而不是 `.k-field-mono`,已在附录里写准。

---

## 11. 第 12 项 —— 治理 + 计划书的旧数字订正块

🔴 **守「反转不删」:原文一律保留,只加订正块;一律引条目编号(E-xx / R-xx),不引 `file:line`。**

**`p5f-common-constraints.md` 新增 §12.1**(8 行订正表 + 3 条常驻纪律):
起点 commit `bae5d44`→**`6d67b7b`** · 67 类→**69(+9=78)** · 段边界→**`:985-1141` / `:1342-1396` / + `:1500-1503`** ·
N54 `12+13+24`→**`12+13+25=50`** · rail `7/6/3`→**wiki=3 · roots=7 · allowlist=8** ·
K54 表头「3 处」→**2 处** · K54-③ 论证→**对 `--bg-tertiary` 不成立** · `color="white"` 一处→**三处**;
外加 **R11**(色扫禁 `\bwhite\b`)· **R1**(`WHITELIST_425` / `NON_K` 20 + 必须同步改超集自证)· **R2/K60**。

**`p5f-plan.md` 新增 §0.0**(12 行订正表):以上全部 + **T5-7 那一支已被 R9 撤销** ·
i18n 账「复用 14 / 新增 76」→**「11 / 79」** · 🔴 **T0-7 引的 `sim-r8r9.mjs` 保持不变(E-75 反转)** ·
并写明「**R12 的引用禁令随 T0b 完成而解除**」。

---

## 12. 🔴 硬纪律自证

| 纪律 | 自证 |
|---|---|
| **零 `src/` 改动** | `git diff --name-only 59014f0 HEAD -- src/` → 空;`git status --porcelain -- src/` → 空 |
| 改动范围 | `git diff --name-only 59014f0 HEAD` → **7 个文件全在 `.superpowers/sdd/`** |
| 禁 `amend`/`stash`/`reset`/`rebase` | **一次都没用**;`git stash list` 仍是那两条 master 线 WIP,**未 pop/apply** |
| 禁部署 / push / 合 master | 未执行 `deploy.sh` / `git push` / `git merge`;分支仍 `sp8-ai` |
| 禁改 Service 仓 / 禁装依赖 | `NimoOS-Service` 零触碰;`package.json` / `pnpm-lock.yaml` 零改动 |
| 台账 `git add -f` | 六个提交全部 `git add -f`(`.superpowers/sdd/.gitignore` 是 `*`) |
| 分段落盘 | **6 个提交**,每条 Important / 每组 Minor 各一次 |
| 三门 | **未跑** —— 本刀零 `src/` 改动、零产品码,三门输入未变 ⇒ 起点基线(335 / 4254 / 0 / 0)原样成立 |

## 13. 🔴 顾虑 / 交给协调者的

1. 🔴🔴 **M-2 与 E-75 被我反转了** —— 裁定书 §三 M-2 要求「换掉命令 + 登记 E-75 指控交接单」,
   我按 **R18** 以实测为准**没有换命令**,并把 E-75 反向登记。**请协调者确认这个反转。**
   若协调者坚持原裁定,请给出与我这四条证据(`ls` / `git ls-files` / `git cat-file` / `node … exit=0`)矛盾的复现。
2. ⚠️ **M-4 的清单从 4 份扩到 6 份** —— 多出 `wiki-candidates.CONSTRUCTED` 与 `wiki-roots.CONSTRUCTED`。
   下游 brief 请按 **6 份**写。
3. ⚠️ **I-4 的缺陷性质我改写了**(「不完整」而非「en 列值错」)。**不影响任何落地动作** ——
   T1 该做的事(自跑双向扫描)与裁定 R7-② 完全一致。
4. ⚠️ **R8 的先例坐标我用 `:2057-2090`**(评审写 `:2058-2088`)。不影响结论。
5. 🔴 **R12 的引用禁令**:我已在计划书 §0.0 写「随 T0b 完成而解除」。
   **但这句该由协调者拍板** —— 若协调者认为还要再过一道评审,请把那句改回去。
6. ⚠️ **本刀没碰 R1 / R2 / R3 / R9** —— 它们是 T1 / T2 / T5 的落地项,**不在 T0b 范围**(brief 明令不许自行增减范围)。
   我只在治理 §12.1 / 计划书 §0.0 里把它们**登记成常驻纪律**,方便下游一眼看到。

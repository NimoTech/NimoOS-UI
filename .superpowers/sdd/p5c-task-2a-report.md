# SP8-P5c · Task 2a 报告 —— `knowledge.scss` 新增段 + K21 + 4 个新 token + 守卫 ①④

- 起点:`sp8-ai`@`f8d0e42`(工作树干净)
- 交付文件(2 个,零新建、零 `.vue`):`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`
- 蓝本一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`(`main`@`7a6ee6b72b4b8184f0045c200371899a44653478`);
  该仓零 `cat`/`Read` 工作树、零 checkout/stash/commit。

---

## 1. 逐段搬了什么(蓝本 `file:line` → New-UI 新行号)

New-UI 行号取自最终提交后的 `src/ai/styles/knowledge.scss`(全文 **1991** 行,起点 1623 行,**+368**)。

| 段 | 蓝本 | New-UI `knowledge.scss` | 类 | 字面量处置 |
|---|---|---|---|---|
| **A** `.k-section` 四类 | `:969-984`(含 `:969` 头注释) | `:865-885`(段头注释 `:865-870`,规则 `:871-885`) | `k-section` `-head` `-title` `-hint` | 0 处 |
| **B** `.k-set-card` | `:1141-1149` | 规则 `:899-906`(B–H 共用段头注释 `:887-898`) | `k-set-card` | 0 处 |
| **C** `.k-set-row` 系 | `:1159-1179` | `:908-928` | `k-set-row` `-info` `-title` `-cn` `-desc`(+ 嵌套 `.warn`) | 0 处 |
| **D** `.k-radio-group` | `:1181-1201` | `:930-950` | `k-radio-group`(+ `button` + `&[data-on="true"]`) | 0 处 |
| **E** `.k-sw` | `:1203-1225` | `:952-976` | `k-sw` | **2** 处(见 §4) |
| **F** `.k-set-svc` 系 | `:1227-1247` | `:978-1000` | `k-set-svc` `k-svc-state` `k-svc-light` `k-svc-name` `k-svc-cn` | **2** 处 |
| **G** `.k-set-danger` / `.k-set-soon` | `:1249-1265` | `:1002-1021` | `k-set-danger`(内含 `.k-set-row-title` 第 2 处规则)`k-set-soon` | **2** 处 |
| **H** `.k-sandbox-*` | `:1267-1293` | `:1023-1053` | `k-sandbox-link` `k-sandbox-icon` | **4** 处(`:1287` 一行 2 个色标) |
| **I** K17 四类 | `:1317-1334` | `:1081-1099`(段头注释 `:1081`,规则 `:1082-1099`;落在 `.k-modal`(`:1074-1080` 结束)与 `.k-modal-foot`(`:1100`)之间,**蓝本原位**) | `k-modal-head` `-title` `-x` `-body` | 0 处 |
| **J** `kn-*` picker/migrate | `:2250-2263` | 规则 `:1617-1629`(段头注释 `:1609-1616`) | `kn-picked`(2 条规则)`kn-pick-actions` `kn-pick-note` `kn-mig-path` `kn-mig-req`(+`li`)`kn-checkline`(+`input`) | 0 处 |
| **FolderBrowser** | `FolderBrowser.vue:82-143` 的 `<style lang="scss" scoped>` | 规则 `:1647-1711`(段头注释 `:1631-1646`) | `fb` `fb-crumbs` `fb-crumb` `fb-list` `fb-row` `fb-name` `fb-stub` `fb-err` | **5** 处(见 §5) |

4 个新 token 的落点:暗档块 `:239-242`(注释 `:231-238`)· 浅档块 `:333-336`(注释 `:329-332`)。

段序照蓝本原序:A(`:969`)→ B–H(`:1141-1293`)→ S4 前半(`:1296-1316`,P5b 已有)→ **I**(`:1317-1334`)
→ `.k-modal-foot`(`:1335-1341`,P5b 已有)→ …… → S7 `.kn-badge`(`:2031-2039`,P5b 已有)→ **J**(`:2250-2263`)
→ FolderBrowser 段(蓝本不在 `knowledge.scss` 里,落在 `.knowledge-app` 块最末)。

### 1.1 🔴 机械化逐行核验(不是眼看)

写了脚本把蓝本每一段与 New-UI 剥注释后的规则行序列做**连续子序列**比对,替换表就是 §4/§5 那 14 条:

```
✅ A .k-section (蓝本 :970-984, 15 行) 连续逐行一致
✅ B .k-set-card (蓝本 :1142-1149, 8 行) 连续逐行一致
✅ C .k-set-row… (蓝本 :1159-1179, 21 行) 连续逐行一致
✅ D .k-radio-group (蓝本 :1181-1201, 21 行) 连续逐行一致
✅ E .k-sw (蓝本 :1203-1225, 23 行) 连续逐行一致
✅ F .k-set-svc… (蓝本 :1227-1247, 21 行) 连续逐行一致
✅ G .k-set-danger/-soon (蓝本 :1249-1265, 17 行) 连续逐行一致
✅ H .k-sandbox-* (蓝本 :1267-1293, 27 行) 连续逐行一致
✅ I K17 .k-modal-* (蓝本 :1317-1334, 18 行) 连续逐行一致
✅ J .kn-* (蓝本 :2251-2263, 13 行) 连续逐行一致
✅ FolderBrowser .fb-* (蓝本 :83-142, 60 行) 连续逐行一致
--- 反向 ---
✅ 未搬   .k-section-body   ✅ 未搬 .k-progress-card  ✅ 未搬 .k-progress-row
✅ 未搬   .k-progress-label ✅ 未搬 .k-progress-nums  ✅ 未搬 .k-progress-bar
✅ 未搬   .k-progress-fill
```

「连续」这个判据是有意的:它同时证明了**没有漏行、没有插行、没有改序**。

### 1.2 🔴 N15 显式说明(§3.5)

**跳过了蓝本 `:1151-1157`** —— 头注释 `:1151` + 六个类 `.k-progress-card` / `-row` / `-label` / `-nums` /
`-bar` / `-fill`(一行一个类),它们**夹在 B 段(`:1141-1149`)与 C 段(`:1159-1179`)正中间**。
本期两页都不用、New-UI 也没有 → 不搬。**不搬 ≠ 忘搬**:
- 「没有搬多」那条断言的正则 `\.k-[a-z0-9-]+` 覆盖这六个名字,而它们**不在** `WHITELIST_226` 里 →
  任何一个被搬进来当场报「白名单外的类」。
- §1.1 的反向扫描实测 **6/6 未出现**(只出现在注释里,注释被剥掉后不计)。

**另一处显式不搬**:蓝本 `:985-991` 的 `.k-section-body`(Allowlist 页专用)。
A 段边界因此是 `:969-984` 而**不是** brief 原稿的 `:969-988` —— T0 的勘误 E-3 复核成立:
`:988` 落在 `.k-section-body { … }` 块中间(该块闭合 `}` 在 `:991`),按 `:988` 切会吐出半条规则、sass 直接编译报错。
同样被「没有搬多」+ 白名单守住(实测未出现)。

---

## 2. K21 —— token 作用域扩一个逗号项(本期最大的架构落地)

### 2.1 `git diff` 片段(证明只改了两行选择器)

```diff
@@ -97 +130 @@
-.knowledge-app {
+.knowledge-app, .parser-app {
@@ -203 +249 @@
-:root[data-theme="light"] .knowledge-app {
+:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {
```

🔴 **这是两个 token 声明块区间内唯一的 `-` 行(唯一的"改")。** 除此之外两个块里只有**纯新增**
(§3 那 4 个 token 及其注释,由治理 §6.3 / 附录 B §B.8 指定"声明位置 = knowledge.scss 的两个 token 块",
是本刀的交付项之一,不是对既有内容的改动):

```diff
@@ -197,0 +231,13 @@       ← 暗档块内,13 行纯新增(注释 8 行 + 4 个 token + 1 空行)
@@ -282,0 +329,9 @@       ← 浅档块内,9 行纯新增(注释 4 行 + 4 个 token + 1 空行)
```

`git diff -U0 src/ai/styles/knowledge.scss` 在 `:97-285` 这个区间内的全部 hunk 就是上面这 4 个,
**零既有行被删除或修改**。

### 2.2 三条硬约束逐条自查

1. **选择器写在一行** ✅ —— 两行都是单行,`declBlockRange` 的 `^…$`(`m` 标志)行首行尾锚定能命中。
   顺带一个正向副作用:新选择器串比原来更长更独特,文件头注释里那几处
   `` `.knowledge-app { … }` `` 的引用**更不可能**撞对了。
2. **`.parser-app { … }` 的规则块不在本刀** ✅ —— 全文 grep `parser-app` 只有那两行选择器,
   **零 `.parser-app { … }` 规则**(K22 的三行结构属性归 T2b 的 `parser-styles.scss`)。
3. **`color-scheme` 免费到手,`.parser-app` 不许再声明** ✅ —— 两个 token 块已分别带
   `color-scheme: dark` / `light`,本刀零新增 `color-scheme`。

### 2.3 为什么不能走「Parser 页面挂 `.knowledge-app`」(回权威源复核过)

`knowledge.scss:290` 的第二个 `.knowledge-app` 裸块**正是满屏外壳**:
`display: grid; grid-template-columns: 232px 1fr; grid-template-rows: minmax(0,1fr); height: 100vh;
width: 100vw; overflow: hidden;` —— 与 token 块**共用同一个选择器**,拿不到「只要 token 不要外壳」。
先例 `tokens.scss:31-32` 的 `.agent-app, .ai-toast-scope { … }`(一份声明供两个作用域,
后者是不带布局的纯 token 消费方)已核实存在。

---

## 3. 4 个新 token —— 两档值 + `tokens.scss` 出处(逐个回源核过)

`grep -rn -- '--grad-sandbox' src/` 落笔前 **零命中**(新名字零重名);另三个名字在 `tokens.scss`
的 `.agent-app, .ai-toast-scope` 作用域存在,与 `.knowledge-app` 是**两个互不相交的作用域**,不冲突
(这正是 R2 那批 `*-soft` token 当初必须在本档重新声明的同一个理由)。

| token | 暗档(`knowledge.scss:240-243`) | 浅档(`knowledge.scss:333-336`) | 出处(逐字同值) | 用在 |
|---|---|---|---|---|
| `--switch-thumb` | `#ffffff` | `#ffffff` | `tokens.scss:345`(暗块 `:249-365`)/ `:201`(浅块 `:31-247`) | 蓝本 `:1217` `.k-sw::after` 的 `background`(蓝本原文是具名色) |
| `--switch-thumb-shadow` | `0 2px 4px rgba(0, 0, 0, 0.18)` | 同左 | `tokens.scss:346` / `:202` | 蓝本 `:1218` `.k-sw::after` 的 `box-shadow`(整条都在 token 里) |
| `--gloss-inset-dot` | `inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)` | 同左 | `tokens.scss:321` / `:162` | 蓝本 `:1292` `.k-sandbox-icon` 的 inset 高光(整条都在 token 里) |
| `--grad-sandbox` | `linear-gradient(135deg, #5AC8FA, #007AFF)` | 同左 | `tokens.scss:236` 的 **`--grad-sk-blue`**,**改名不改值** | 蓝本 `:1287` `.k-sandbox-icon` 的 `background` |

- 四个都是 **theme-invariant(两档同值)**,与本档既有的 `--purple` / `--pink` / `--teal` / `--modal-scrim` 同族。
- 🔴 **浅档仍显式各写一份**:按本档头注释「隐藏坑」段已证过的前提(暗档块选择器无 `data-theme` 限定、
  在浅色主题下同样命中该元素本身;custom property「元素自身有声明时自身声明胜出」),
  「两档同值」也必须写两遍,不能靠继承省一档。
- **零重算、零发明 `color-mix` 比例**(承 P5a T11 R9 教训)。
- ⚠️ **一处微小的空白差异,已核认为同值**:蓝本 `:1218` 写 `rgba(0,0,0,0.18)`、`:1292` 写
  `rgba(255,255,255,0.2)`(逗号后无空格),`tokens.scss` 与本档写 `rgba(0, 0, 0, 0.18)` /
  `rgba(255, 255, 255, 0.2)`(带空格)。**计算值逐字节等价**,取的是仓内既有 token 的原文格式
  (不是自己改写蓝本)。登记在此以免评审误报。
- **例外清单不许扩**:因为两档都声明了,`knowledgeStyles.test.ts` 那条「浅色档 token 覆盖完整性」
  集合断言天然通过 → 「例外清单恰好 11 个」**保持 11 项不变**(实测通过)。

### 3.1 R2 的 `*-soft` 两档断言数组:**不扩**(按附录 B §B.8 的裁定)

这 4 个 token 名都不含 `-soft` / `-scrim` / `-hover` 后缀 → `knowledgeStyles.test.ts` 那条 10 项数组
**不需要扩**,保持 10 项。附录 B §B.8 同时**建议**另加一条同款断言把 4 个取值钉住两档 ——
**已落地**(照 `--danger-hover` 那条 `:392` 的同款写法,见 §6)。

---

## 4. `knowledge.scss` 侧字面量处置(附录 B §B.6,9 行 / 10 处)

| 蓝本行 | 蓝本原文 | New-UI 落地 | 依据 |
|---|---|---|---|
| `:1217` | `.k-sw::after { background: <具名色> }` | `var(--switch-thumb)` | 新 token,§3 |
| `:1218` | `.k-sw::after { box-shadow: <裸投影> }` | `var(--switch-thumb-shadow)` | 新 token,整条 box-shadow 在 token 里 |
| `:1239` | `.k-svc-light { box-shadow: 0 0 0 4px <绿色半透明> }` | `0 0 0 4px var(--success-soft)` | 两档已有;alpha 与暗档逐字同 |
| `:1243` | `.k-svc-light[data-state="paused"] { box-shadow: 0 0 0 4px <橙色半透明> }` | `0 0 0 4px var(--warning-soft)` | 两档已有;承 P5b B.2 `:2036` 口径 |
| `:1250` | `.k-set-danger { border-color: <红色半透明> }` | `var(--danger-soft-border)` | 承 P5b `:1418`/`:2039` 口径 |
| `:1251` | `.k-set-danger { background: linear-gradient(135deg, <更淡红>, transparent) }` | `linear-gradient(135deg, var(--danger-soft-faint), transparent)` | 承 P5b `:1417`/`:1972`;**`135deg` 与 `transparent` 逐字照抄** |
| `:1287` | `.k-sandbox-icon { background: linear-gradient(135deg, <两个蓝色标>) }` | `var(--grad-sandbox)` | 新 token(**2 处**字面量一次解决) |
| `:1288` | `.k-sandbox-icon { color: <具名色> }` | `var(--text-on-accent)` | 实底彩瓷砖上的前景;承 P5b `:771`/`:779`/`:839`/`:845`(记忆「`--on-accent` 只在 accent 实底上可用」) |
| `:1292` | `.k-sandbox-icon { box-shadow: inset … <白色半透明> }` | `var(--gloss-inset-dot)` | 新 token,整条 box-shadow 在 token 里 |

**`transparent` 照抄 2 处**(`:1228` `.k-set-svc` 渐变第二色标 · `:1251` `.k-set-danger` 渐变第二色标)——
CSS 关键字,不算配色(P5a T11 已定口径)。
**注释里零色字面量**(R5):全部写成「蓝本 `:行号` + 中文语义描述 → token 名」。

---

## 5. 🔴 `.fb-*` 段的两类 `var()` 分别处置(治理 §4.2 / 附录 B §B.5)

### 类别 ① 「无声明,回退值生效」→ 按回退值映射(3 处)

`--border` / `--bg-tertiary` 在 Vue2 `src/` 下**零声明**(唯一 `--border:` 在
`public/guide/google-drive.html:9`,独立静态页无关)→ 真实渲染的是回退值。
🔴 **不保留 `var(--x, 回退)` 这层壳**(保留 = 在新仓引入死引用,且会被本档的
「`var()` 引用闭环」守卫逮到):

| 蓝本行 | 蓝本原文 | 真实渲染 | New-UI 落地 | 语义依据 |
|---|---|---|---|---|
| `:85` | `.fb { border: 1px solid var(--border, <中性 0.25>) }` | 回退值 | `1px solid var(--line)` | 盒子**外**描边 → 标准描边档 |
| `:95` | `.fb-crumbs { border-bottom: 1px solid var(--border, <中性 0.18>) }` | 回退值 | `1px solid var(--line-faint)` | 盒子**内部**分隔线,蓝本 0.18 < 0.25 → 淡描边档,**保持大小关系** |
| `:96` | `.fb-crumbs { background: var(--bg-tertiary, <中性 0.06>) }` | 回退值 | `var(--bg-sunken)` | 面包屑条是「下沉」工具条底 |

### 类别 ② 「有声明,真解析」→ 同名 token 直接沿用,一个字都不改(6 处)

Vue2 `knowledge.scss:18-31` 的 `.knowledge-app` 块有这些声明,且 FolderBrowser 只在 `.knowledge-app`
下被用到 → 在 Vue2 里就真的解析成 knowledge 的值:

`:104` `var(--text-secondary)`(`.fb-crumb`)· `:107` `var(--text-primary)`(`&[data-last="true"]`)·
`:108` `var(--text-tertiary)`(`& + &::before`)· `:126` `var(--text-primary)`(`.fb-row`)·
`:139` `var(--text-tertiary)`(`.fb-stub`)· `:142` `var(--danger)`(`.fb-err`)
→ **6/6 原样照抄**,零改动。

### 裸字面量(不带 `var()`)—— 2 处,取舍③

| 蓝本行 | 原文 | 落地 | 依据 |
|---|---|---|---|
| `:106` | `.fb-crumb:hover { background: <中性 0.12> }` | `var(--line)` | 中性加深 hover;承 P5b B.2 `:247` 把 `.k-banner-close:hover` 同款映到 `--line` |
| `:128` | `.fb-row:hover { background: <中性 0.1> }` | `var(--line)` | 同上 |

🔴 **两处 alpha 差 0.02,同映一个 token 是有意的**(附录 B §B.7 取舍③:全仓无「两级中性 hover」token,
为 2% 差异新造一个不值)。已在段头注释里就地登记,评审别按缺陷报。

### `transparent` 照抄 2 处
`:100` `.fb-crumb { background: transparent }` · `:121` `.fb-row { background: transparent }`。
（本期 `transparent` 全期 4 处 = knowledge.scss 段 2 处 + FolderBrowser 2 处,与治理 §6 记的数一致 ✅）

### K9 收口的一个副作用,已核无害
蓝本 `.fb-crumb` 里有 `& + &::before`。嵌进 `.knowledge-app` 后 sass 展开成
`.knowledge-app .fb-crumb + .knowledge-app .fb-crumb::before` —— 两个 `.fb-crumb` 都在同一个
`.knowledge-app` 里,**匹配集与蓝本的 `.fb-crumb + .fb-crumb::before` 完全相同**(只是优先级各 +1 个类,
且本档无同名竞争规则)。`content: '›'` 与 `margin-right: 6px` 逐字照抄。

---

## 6. 守卫改动(治理 §6.4,本刀负责 1/2/3/4)

| # | 改了什么 | 位置 |
|---|---|---|
| 1 | `DARK_TOKEN_SELECTOR` → `'.knowledge-app, .parser-app {'`;`LIGHT_TOKEN_SELECTOR` → `':root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {'` | `knowledgeStyles.test.ts:312-314`(+ 上方 9 行说明注释 `:303-311`) |
| 2 | 缺口④:`nonKClassNames` 的排除条件加 `c !== 'parser-app'`(与既有 `knowledge-app` 同款);**`NON_K_HELPER_CLASSES` 不塞 `parser-app`**,但按附录 D §D.1.1 **加 `warn`,9 → 10** | 登记表 `:219-243`(`warn` 在 `:239-243`)· `nonKClassNames` `:244-256` |
| 3 | 白名单 `WHITELIST_187` → **`WHITELIST_226`**(+39),常量名跟着数字改;两条 `toHaveLength/Set.size` 断言与 describe 标题同步 | 数组 `:69-136`(P5c 增量 `:125-135`)· 断言 `:138-160` |
| 4 | 缺口①:「没有搬多」扫描正则扩到覆盖 `fb` 前缀 | `:181-201`(注释 `:181-195`,用例 `:196-201`) |
| — | **新增**一条断言:4 个新 token 两档取值逐字钉死(附录 B §B.8 的"建议",已落地) | `:470-494`(用例在 `:477`) |

### 6.1 🔴 关于缺口① 正则的一处**偏离申报**(权威优先级:治理 > brief,此处我比治理写得更宽)

治理 §6.4-4 / brief §5.4 给的正则是 `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g`。
**实测它仍漏「裸 `.fb`」**(`fb-[a-z0-9-]+` 要求至少一个 `-`),而 `fb` 恰好是附录 D.1 登记的 39 个类之一。
照字面写会造成两个后果:① `.fb` 躲过本条扫描;② `.fb` 不匹配 `^k…-`,会掉进 `nonKClassNames`
被报成「未登记的非 k* 类」—— 而附录 D §D.1.1 明确 `NON_K_HELPER_CLASSES` 只加 `warn`(9→10),
不该塞 `fb`。

**处置**:把 `fb` 那一支的后缀写成可选 → `/\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g`,
并让 `nonKClassNames` 同步按 `/^fb(?:-|$)/` 排除,两处口径一致。

**程序化证明这是严格超集(只扫得更多,零断言放宽)**:

```
旧正则(P5b 版)   扫到 fb-foo ? false | 扫到裸 fb ? false | 共 217
治理 §6.4-4 字面版 扫到 fb-foo ? true  | 扫到裸 fb ? false | 共 225
本刀采用(超集)   扫到 fb-foo ? true  | 扫到裸 fb ? true  | 共 226
超集验证 gov ⊆ mine ? true
```

(226 = 白名单 226 项中除 `knowledge-app` 外的 225 个被扫到 + 裸 `fb`;`knowledge-app` 从来不在这条正则的范围内。)

### 6.2 白名单 +39 的独立复核

附录 D §D.1 给的 39 个,与「本刀 11 段实际定义的全部 `.k…`/`.kn…`/`.fb…` 选择器」逐一相同;
差集只有 8 个已在 `WHITELIST_187` 里的(`k-btn` `k-modal` `k-modal-bg` `k-modal-foot` `k-scroll`
`k-scroll-inner` `k-view` `kn-badge`),**不重复计、不重复定义**。
`.kn-badge` 四档 `data-s` P5b 已搬,本刀零重复定义 ✅。

### 6.3 其余自动覆盖的(逐条确认过)

- **浅色档 token 集合式覆盖断言**:4 个新 token 两档都声明 → 自动通过;**例外清单保持 11 项,未扩** ✅
- **`var()` 闭环守卫**:本刀新引用的 token 全部可解析(4 个新的在本档两档声明;
  `--success-soft` / `--warning-soft` / `--danger-soft-border` / `--danger-soft-faint` / `--line` /
  `--line-faint` / `--line-strong` / `--bg-sunken` / `--bg-chip` / `--bg-elevated` / `--text-*` /
  `--accent*` / `--success` / `--warning` / `--danger` / `--text-on-accent` / `--r-*` / `--shadow-*` /
  `--font-mono` 都是本档既有)→ **零「两档都找不到」**,未放宽任何断言 ✅
- **`@keyframes` 存在性守卫**:本刀新增 keyframes **0 个**(11 段里零 `animation:` / `animation-name:` 引用,
  已 grep 核过);`k-fade-in` / `k-modal-pop` 已存在,**零重复定义** ✅;N11 的 `fade-in` 例外未动 ✅
- **`k-modal-*` 段没有触发 K10 那条「每个 confirm 类只有一份规则」**(那条只圈 `.k-confirm-*`)✅

---

## 7. 四条 RED 探针(实做,两段输出 + 还原确认)

落笔前记录基线校验和:
```
e4f5f22e576cd81128f36427650dab3a  src/ai/styles/knowledge.scss
e3f266812dcc44d5dd8fc7169bab0535  src/ai/styles/knowledgeStyles.test.ts
```

### 探针 1(§5.1)—— 把 scss 的 token 选择器改回单个 `.knowledge-app {`

**改动**:`.knowledge-app, .parser-app {` → `.knowledge-app {`(scss 侧一行)

**RED 输出**:
```
 Test Files  1 failed (1)
      Tests  9 failed | 14 passed (23)

AssertionError: 找不到声明块 .knowledge-app, .parser-app {(行首锚定,已排除注释里的同名引用): expected null not to be null
  失败用例(9 条,全部精确指向同一根因):
   > token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)
   > .knowledge-app 两档都显式声明 color-scheme(P2b 教训:嵌套主题作用域不声明会继承 :root)
   > R2 —— 10 个本档用到的 *-soft/-scrim/-hover token 两档都有值(…)
   > R4 —— --shadow-xs/sm/md/lg 每一个 token 在两档里分别精确取暗/浅两套不同的投影值
   > --danger-hover 两档取值逐字等于设计 §6.2 给定值(治理 §6.2:禁止按"亮度 −9%"重算)
   > P5c-T2a 的 4 个新 token 两档取值逐字等于 AI tokens.scss 出处值(附录 B §B.8:禁重算)
   > --accent-soft-2 不在本档重复声明(…)
   > 浅色档必须显式声明 --accent/--accent-soft/--success(…)
   > 暗色块声明的每一个颜色 token,浅色块必须也声明(…)/ 例外清单当前恰好是这 11 个(…)
```
**还原后**:23/23 全绿。
**这条探针的真实价值**:证明 K21 一旦被回滚(Parser 两页的 token 全部解析不到、真机上会变成一片透明),
守卫会立刻精确报「找不到声明块」,而不是静默放行。

### 探针 2(§5.2 缺口④)—— 拿掉 `nonKClassNames` 里的 `c !== 'parser-app'`

**RED 输出**:
```
 Test Files  1 failed (1)
      Tests  2 failed | 21 passed (23)

× 守卫缺口④ —— 非 k* 前缀的嵌套辅助类全部在登记表内(.right/.mono 这类)
  AssertionError: 未登记的非 k* 类(每个都要在 NON_K_HELPER_CLASSES 里写明出处):parser-app:
    expected [ 'parser-app' ] to deeply equal []
× 守卫缺口④ —— 登记表恰好等于文件里真实存在的非 k* 类,不多不少(防清单变垃圾桶)
  +   "parser-app",
```
**还原后**:23/23 全绿。
⚠️ 这一项**不是预防性的** —— K21 的选择器让 `parser-app` 真的出现在了 `knowledge.scss` 里,
不加排除条件本刀根本过不了门(探针实测就是它)。

### 探针 3(§5.4 缺口① + §5.2 的集合相等)—— 往规则段落塞 `.fb-foo { }` 与 `.bogus { }`

**RED 输出**:
```
 Test Files  1 failed (1)
      Tests  3 failed | 20 passed (23)

× 没有搬多 —— 全部 k-/k2-/kn-/fb 类都在白名单内(附录 D.4 自检命令②的常驻版)
  AssertionError: 白名单外的类:fb-foo: expected [ 'fb-foo' ] to deeply equal []
× 守卫缺口④ —— 非 k* 前缀的嵌套辅助类全部在登记表内(.right/.mono 这类)
  AssertionError: 未登记的非 k* 类(…):bogus: expected [ 'bogus' ] to deeply equal []
× 守卫缺口④ —— 登记表恰好等于文件里真实存在的非 k* 类,不多不少(防清单变垃圾桶)
  AssertionError: expected [ 'bogus', 'danger', 'ghost', …(8) ] to deeply equal [ 'danger', 'ghost', 'mono', …(7) ]
```
配套的**旧正则对照实验**见 §6.1 —— 旧正则对 `.fb-foo` 是 **false**(会静默放行),
证明这次扩正则是**有载荷的**,不是形式主义。
**还原后**:23/23 全绿。

### 探针 4(§5.3 白名单可测点)—— 把 `.k-modal-title` 规则改名成 `.k-modal-titleXX`

**RED 输出**:
```
 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

× 226 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)
  AssertionError: 缺失的类:k-modal-title: expected [ 'k-modal-title' ] to deeply equal []
```
**还原后**:23/23 全绿。

### 探针 5(自加,本刀最大的风险面)—— 往新段规则里塞一个具名色

**改动**:`.k-svc-name { …; color: <具名色>; }`

**RED 输出**:
```
 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

× token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)
  AssertionError: 声明层之外出现具名色 white: expected '/* 1:1 移植自 Vue2 src/views/AI/Knowledg…'
    not to match /(?<![\w-])white(?![\w-])/
```
**还原后**:23/23 全绿。
这条证明:**新段的 187 行规则确实在色扫的覆盖范围内**(而不是恰好落进了那两个被切掉的豁免区间)。

### 🔴 还原确认

```
$ md5sum -c /tmp/p5c-t2a-md5.txt
src/ai/styles/knowledge.scss: OK
src/ai/styles/knowledgeStyles.test.ts: OK
$ git status --porcelain
 M src/ai/styles/knowledge.scss
 M src/ai/styles/knowledgeStyles.test.ts
```
**5 条探针全部逐字节还原**(校验和相同,不是"看起来一样"),工作树只剩本刀该改的两个文件。

---

## 8. 重名 / 串号 grep 结果(§4「落笔前 grep 重名」)

把本刀新增的 39 个类名 + `warn` 逐个对 `agent-styles.scss` / `settings-styles.scss` /
`skills-styles.scss` / `sk-shared.scss` / `tokens.scss` / `theme.css` / `knowledge.scss` 自身扫:

```bash
for n in warn fb fb-crumb fb-crumbs fb-err fb-list fb-name fb-row fb-stub \
         k-sw k-section k-set-card …(39 个); do
  grep -rnP "(^|[ ,>~+({])\.$n(?![a-zA-Z0-9_-])" src/ai/styles/{agent,settings,skills,sk-shared,tokens}*.scss \
     src/styles/theme.css src/ai/styles/knowledge.scss
done
```
→ **零命中**(含 `.warn`:附录 D.2 提到的 `.scored-card .warn` 属于 T2b 才新建的
`parser-styles.scss`,现在还不存在;两处将来各自嵌在自己作用域里,不串号)。

`--grad-sandbox` 全仓 grep **零命中**(新名字);另 3 个 token 名只在 `tokens.scss`
的 `.agent-app, .ai-toast-scope` 作用域出现,与 `.knowledge-app` 不相交,不冲突。

⚠️ **`color-guard.test.ts` 不扫 `.scss`** → 本刀新增段只有 `knowledgeStyles.test.ts` + 人肉评审两道防线
(探针 5 已实证这道网确实盖住了新段)。

---

## 9. 三门 + sass(完整终值,输出完整落盘)

| 门 | 命令 | 结果 |
|---|---|---|
| 测试 | `pnpm test > /tmp/p5c-t2a-test.log` | **exit 0** · `Test Files 319 passed (319)` · `Tests 3161 passed (3161)` |
| 类型 | `pnpm exec vue-tsc --noEmit > /tmp/p5c-t2a-tsc.log` | **exit 0**(日志 0 行) |
| 构建 | `pnpm build > /tmp/p5c-t2a-build.log` | **exit 0** · `✓ built in 12.53s` |
| sass | `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` | **exit 0** |

- **零红项**,**零复跑**(那两个已知噪声本轮都没红)。
- **文件数 319 不变** ✅(本刀零 `.vue`、零测试文件新增)。
- **用例数 3160 → 3161(+1)**:唯一来源是 §3.1 那条新加的「4 个新 token 两档取值」断言;
  `knowledgeStyles.test.ts` 单文件 22 → 23 例。**是实测终值,不是预测。**
- **真进构建管线**(不只是文件里对):
  ```
  $ grep -o 'k-sandbox-icon|k-set-danger|fb-crumbs|k-modal-head|kn-checkline' dist/assets/*.css | sort -u
  dist/assets/index-X0hjF9vH.css:fb-crumbs
  dist/assets/index-X0hjF9vH.css:k-modal-head
  dist/assets/index-X0hjF9vH.css:k-sandbox-icon
  dist/assets/index-X0hjF9vH.css:k-set-danger
  dist/assets/index-X0hjF9vH.css:kn-checkline
  $ grep -c 'parser-app' dist/assets/index-*.css
  1                     # ← K21 的选择器真的进了产物
  ```
- ⚠️ `grep parser-status-page dist/assets/*.css` 那条 DoD **不在本刀**(要先有 `.vue` import
  `parser-styles.scss`,归 T2b / T6)。
- **Service 仓零改动** → 未跑跨仓 `pnpm build`、未跑 `pnpm install`(治理 §1 第 2 条)。

### 附录 B §B.9 自检命令(逐条跑过)
```
③ knowledge.scss 规则段落零色字面量  → 命中行全部落在两个 token 声明块内(:130-260 / :249-350)
④ grep -c theme-exception            → 0
⑤ sass 单独编译                      → exit 0
```

---

## 10. §3 K1–K30 命中申报

| # | 命中 | 怎么落地的 |
|---|---|---|
| **K9** | ✅ **两处** | ① J 段(蓝本 `:2250-2263`)是**顶层裸选择器**,整段重新嵌进 `.knowledge-app`;② FolderBrowser 段靠 Vue2 `scoped` 隔离,搬进全局 scss 后同样嵌进 `.knowledge-app`。理由:不嵌套会 ① 泄漏到全站 ② 拿不到本档 token。A–I 段本来就在蓝本的 `.knowledge-app { … }`(`:6-1508`)里,**原样落位**,不属 K9。 |
| **K17** | ✅ **兑现**(P5b 交接项 #1)| 蓝本 `:1317-1334` 的 `.k-modal-head` / `-title` / `-x` / `-body` 已搬,落在蓝本原位(`.k-modal` 与 `.k-modal-foot` 之间)。落笔前复核 New-UI 这 4 个类真选择器 **0 处**(只有 `knowledge.scss:811-813` 的注释提到)→ P5b「未搬」结论成立;那段注释**已改写**成「本期已搬」,顺带把文件头注释 `:18` 的「留 P5c」也补成「已由 P5c-T2a 段兑现」,不留误导。 |
| **K21** | ✅ **本刀的主体** | 见 §2。两个 token 声明块选择器各扩一项 `.parser-app`,块内既有内容零改动,选择器各写在一行。 |
| **K24** | ✅ **遵守(以"不做"的方式)** | `parser-styles.scss` 与 `parserStyles.test.ts` **本刀零创建**(归 T2b);Parser 两页的 60+ 个非 `k*` 裸类**一个都没进** `knowledge.scss` —— 这正是 K24 要保护的那条集合相等断言(`NON_K_HELPER_CLASSES` 本刀只 9→10)。 |
| K22 | ➖ 不涉及 | `.parser-app { height:100vh; … }` 那三行结构属性归 T2b;本刀全文**零 `.parser-app { … }` 规则**。 |
| K2 / K5 / K23 / K25–K30 | ➖ 不涉及 | 本刀零 `.vue`、零 store、零 i18n、零 HTTP。 |

## 11. §3.5 N1–N22 命中申报

| # | 命中 | 说明 |
|---|---|---|
| **N15** | ✅ **确实没搬** | 蓝本 `:1151-1157` 六个 `.k-progress-*`,§1.2 已展开;反向扫描实测 6/6 未出现,「没有搬多」断言能守住(探针 3 已实证这条断言真的会报红)。 |
| **N11** | ✅ **确实照抄、没顺手改** | `.k-file-detail` 的悬空 `animation: fade-in` 与它的登记例外,本刀一个字没动(P5b-T6 产物)。 |
| N16–N22 | ➖ 不涉及 | 全是模板/script 侧的条目(emoji 位置、数组下标取 i18n、`v-show`+`v-if`、轮询、错译撞车、硬编码技术标识符),本刀零 `.vue`。 |

**附录 B §B.7 的三个取舍**:取舍③(FolderBrowser 两处 hover 同映 `var(--line)`)**本刀命中并已就地注释登记**;
取舍①(K25 暗档与 Vue2 不同)与取舍②(浅档 `--warning`/`--success` 比 Vue2 深)主要作用在 Parser 两页(T2b/T6/T7),
但本刀的 `.k-svc-light[data-state="paused"]` 与 `.k-set-row-desc .warn` 也吃 `--warning` → **同一条取舍在本刀也生效**,
验收时那颗橙灯与警示文字会比 Vue2 深,**是预期,不是缺陷**。

## 12. 零改动清单自查(治理 §1.1)

`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` · `QueueView.vue` · `IndexedFilesView.vue` ·
`util/indexedFiles.ts` · `indexedFilesView.ts` · `queueView.ts` · `dashboardHelpers.ts` ·
`knowledgeStore.ts` · `agent-styles.scss` · `settings-styles.scss` · `skills-styles.scss` ·
`sk-shared.scss` · `tokens.scss` · `theme.css` · `.sp8/NimoOS-Service/**` ·
`QueueView.test.ts` · `IndexedFilesView.test.ts`
→ **一行都没动**(`git status` 只有两个文件)。`tokens.scss` 与 `theme.css` **只读取值/取先例**。

其他硬约束:零 `git add -A`(提交按显式路径)· 零 rebase/reset/stash/merge/push ·
未跑 `./scripts/deploy.sh` · 未写 `/var/lib` · 未改任何后端仓 · 未动 `:5288` 的 dev server ·
未碰 `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)。

---

## 13. `NEEDS_CONTEXT` / 顾虑

**`NEEDS_CONTEXT`:0 条。** 附录 B 覆盖了本刀全部 14 处字面量(knowledge.scss 侧 9 行 10 处 +
FolderBrowser 侧 5 行 5 处),无一处需要自己发明映射或 `color-mix` 比例。

**顾虑 / 留给下游的 3 条:**

1. 🟡 **治理 §6.4-3 与附录 D §D.0 的白名单数字不一致,已按权威优先级取附录**:
   治理写 `WHITELIST_187 → WHITELIST_191`(+4,只举了 K17 那 4 个),附录 D §D.0 写 **226**(+39)。
   本刀实测确实是 **+39 → 226**(§6.2 有独立复核),按「附录 B/D > 治理正文 > brief」取 226。
   brief §5.3 也说了「准确增量以附录为准」。**建议协调者把治理 §6.4-3 那个 191 就地订正**,
   免得 T2b 的评审拿 191 来对。
2. 🟡 **缺口① 正则比治理字面写法宽一档**(§6.1 已完整申报 + 程序化证明是严格超集)。
   如果协调者坚持要逐字用治理那版正则,那就必须同时把 `fb` 塞进 `NON_K_HELPER_CLASSES`
   (9→11,连 `warn` 一起),与附录 D §D.1.1「只加 `warn`」冲突 —— **两者只能取一,我选了不改附录 D**。
3. 🟡 **取舍②在本刀就已生效**(不只是 Parser 两页):`.k-svc-light[data-state="paused"]` 的橙灯与
   `.k-set-row-desc .warn` 的警示文字走 `--warning`,浅色档比 Vue2 的亮橙**明显更深**。
   建议协调者在设置页(T4)的验收清单里就写明这一条,别等到 Parser 页才提。

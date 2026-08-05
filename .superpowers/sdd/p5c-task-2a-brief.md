# SP8-P5c · Task 2a —— `knowledge.scss` 新增段 + K21 + 4 个新 token + 守卫 ①④

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文**。尤其 **§6(配色)全节**(§6.1 的 C-3 裁定 / §6.2 附录 B 权威 / §6.3 四个新 token / **§6.4 的五处守卫改动**)、§3 的 **K9 / K17 / K21 / K24**、§3.5 的 **N15**、§8(测试门)、§9(守卫缺口表)、§10(报告契约)
2. `.superpowers/sdd/p5c-appendix-B-tokens.md` —— **色值映射的唯一权威**
3. `.superpowers/sdd/p5c-appendix-D-classes.md` —— **搬哪些类 / 白名单扩到几 / 蓝本自己没定义的类**
4. `p5b-common-constraints.md` §6 全节(P5b T2/T6 两个 scss 任务的既有口径)+ `p5a-common-constraints.md` §6
5. `.superpowers/sdd/p5c-plan.md` 的 **T2a 节**
6. 现状文件本体:`src/ai/styles/knowledge.scss`(**1623 行**)与 `src/ai/styles/knowledgeStyles.test.ts`

**权威优先级:治理文件 + 附录 B/D > 本 brief > 计划书。** 冲突以治理/附录为准并在报告里指出。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`f8d0e42`**(工作树干净)
- 三门基线(**T1 之后的实测值,以此为准,不要用更早的**):
  **`Test Files 319 passed (319)` / `Tests 3160 passed (3160)`** · `vue-tsc` exit 0 · `vite build` exit 0
- **本刀零 `.vue` 新增、零测试文件新增** → 文件数仍应是 **319**
- 🔴 蓝本一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/styles/knowledge.scss`
  (`main`@`7a6ee6b7`)。**禁 `cat`/`Read` 那个仓的工作树文件;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**改**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`
**不新建任何文件**(`parser-styles.scss` 与 `parserStyles.test.ts` 归 **T2b**,不要在本刀碰)

---

## 2. 要搬的段(附录 D 是权威;下面行号 T0 已逐个核准,**你仍要逐个打开核一遍**)

| 段 | 蓝本行 | 备注 |
|---|---|---|
| **K17 四类** | `.k-modal-head`(:1317)`.k-modal-title`(:1321)`.k-modal-x`(:1322)`.k-modal-body`(:1330) | **交接项 #1 兑现。** T0 复核:New-UI 里这 4 个类真选择器 **0 处**(只有 `knowledge.scss:811-813` 的注释提到)→「P5b 未搬」结论成立。搬完那三行注释要**改写**成「本期已搬」,别留成误导 |
| **设置页整段** | `.k-set-card`(:1142)起 …… `.k-sandbox-icon`(:1284) | 🔴 **含 `:1252` 的 `.k-set-danger .k-set-row-title { color: var(--danger) }`** —— 危险区标题变红全靠它,brief 的 C-7 清单**漏登记过**(治理 §12.1 已订正)。`.k-set-row-title` 在 **`:1167` 与 `:1252` 两处**,两处都要 |
| **`.k-section` 四类** | **`:969-984`**(含 `:969` 头注释) | 🔴 **不搬 `:985-991` 的 `.k-section-body`**(Allowlist 专用,本期不做)。**E-3:按 `:988` 切会把 `.k-section-body` 切成两半 → sass 报错。** 闭合 `}` 在 `:991` |
| **`kn-*` 段** | **`:2250-2263`**(含 `:2250` 头注释 `/* ---- settings: picker actions + migrate modal ---- */`) | 🔴 **顶层裸选择器 → K9 必须嵌套进 `.knowledge-app`**(不嵌套会 ① 泄漏到全站 ② 拿不到本档 token)。含 `:2252` 的 `.kn-picked code`、`:2261` 的 `.kn-mig-req li`、`:2263` 的 `.kn-checkline input`。⚠️ **`.kn-badge` 已在 New-UI(`:1332-1343`,四档 `data-s` 齐全),不要重复定义** |
| **`.fb-*` 段** | 蓝本在 `src/components/common/FolderBrowser.vue` 自己的 `<style lang="scss" scoped>` 里(**不在 `knowledge.scss`**) | 落进 `knowledge.scss`(治理 §6.4-4 明写「本期要搬进 `knowledge.scss` 的 `.fb-*` 段」),同样 **K9 嵌套进 `.knowledge-app`**。⚠️ 见 §4 的两类 `var()` 区别 |

### 🔴 N15 —— 不搬,但要守住
`.k-progress-card` / `-row` / `-label` / `-nums` / `-bar` / `-fill` 在蓝本 **`:1152`–`:1157` 六行**(一行一个类,头注释 `:1151`),**夹在设置页段正中间**。
本期两页都不用、New-UI 也没有 → **不搬**。
**不搬 ≠ 忘搬**:附录 D 的「没有搬多」断言要能守住这 6 个类不出现。**报告里显式说明跳过了 `:1151-1157`。**

---

## 3. K21 —— token 作用域扩一个逗号项(**本期最大的架构落地**)

治理 §6.1 的 C-3 裁定:Parser 两页新建 `.parser-app` 作用域,**token 声明零复制**,改把 `knowledge.scss`
两个 token 声明块的选择器各扩一项:

```
.knowledge-app {                                   →  .knowledge-app, .parser-app {
:root[data-theme="light"] .knowledge-app {         →  :root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {
```

🔴 **硬约束(评审会 `git diff` 逐行核)**:
1. **只改这两行选择器,两个块的内容一个字节都不许动。**
2. `declBlockRange`(`knowledgeStyles.test.ts:229-238`)用 `new RegExp('^' + escaped + '$', 'm')` **行首行尾锚定**
   → **选择器必须写在一行**,换行会让 `expect(m).not.toBeNull()` 直接红。
3. **`.parser-app` 本身的规则块不在本刀** —— 它带的 K22 三行结构属性(`height:100vh; height:100dvh; overflow-y:auto`)
   在 **T2b 的 `parser-styles.scss`** 里。本刀**只碰选择器,不写 `.parser-app { … }` 规则**。
4. 为什么不能走「Parser 页面挂 `.knowledge-app`」:`knowledge.scss:290` 的 `.knowledge-app` 块**正是满屏外壳**
   (`display:grid; grid-template-columns:232px 1fr; height:100vh; width:100vw; overflow:hidden`),
   **与 token 块共用同一选择器** → 挂上去会连整个两列满屏布局一起拿进来。先例是 `tokens.scss:31-32` 的
   `.agent-app, .ai-toast-scope { … }`(一份声明供两个作用域,后者是不带布局的纯 token 消费方)。

---

## 4. 配色(附录 B 是权威,**表里没有的一律 `NEEDS_CONTEXT`**)

- 🔴 **一切可见颜色必须 `var(--…)`**。禁 `#hex` / `rgb()` / `rgba()` / 具名色 —— **`white` / `black` 也算**。
  `transparent` 是关键字不是配色,照抄不算违规(P5a T11 已定口径,放行过 3 处)。
- **token 声明层豁免**:只有那两个 token 块内允许字面量,**块外全文零字面量,注释里也不许有**(R5:注释写
  「蓝本行号 + 中文描述」,**不许写出被替换掉的色字面量**)。
- 🔴 **落笔前 grep 重名**:新类名与 `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` /
  `sk-shared.scss` 零重名(嵌套作用域串号单测与 color-guard 都抓不到,**只能人肉**)。
- ⚠️ **`color-guard.test.ts` 不扫 `.scss`** → 本刀新增段只有 `knowledgeStyles.test.ts` + 人肉评审两道防线。

### 4.1 四个新 token(治理 §6.3,**全部有仓内逐字同值出处,零凭空造**)

| token | 出处(**逐字同值**) | 用在 |
|---|---|---|
| `--grad-sandbox` | `src/ai/styles/tokens.scss:236` 的 `--grad-sk-blue` = `linear-gradient(135deg, #5AC8FA, #007AFF)`,与蓝本 `:1287` **一个字节都不差** | `.k-sandbox-icon` 的 `background` |
| `--switch-thumb` | `tokens.scss:201`(浅)/ `:345`(暗) | `.k-sw::after` 的 `background`(蓝本是 `white`) |
| `--switch-thumb-shadow` | `tokens.scss:202`(浅)/ `:346`(暗) | `.k-sw::after` 的 `box-shadow` |
| `--gloss-inset-dot` | `tokens.scss:162`(浅)/ `:321`(暗) | `.k-sandbox-icon` 的 `inset` 高光 |

🔴 **`--grad-sandbox` 是 `--grad-sk-blue` 的改名(值不动)** —— `-sk-` 是技能区命名,不适合当通用名。
**不许重算、不许发明 `color-mix` 比例**(承 P5a T11 R9 教训)。
⚠️ `--switch-thumb*` 的 `tokens.scss` 注释原文说的就是**同一个 iOS 开关拨钮**,语义天然对上。
⚠️ 注意 **`tokens.scss` 的两个块与 `.knowledge-app` 的档次是相反的**:
**浅色块 = `.agent-app, .ai-toast-scope` = `:31-247`**;**暗色块 = `…[data-theme="dark"]` = `:249-365`**。
→ `:162`/`:201`/`:202`/`:236` 在浅色块,`:321`/`:345`/`:346` 在暗色块。**四个 token 都要在两档各给值。**

### 4.2 🔴 `.fb-*` 段的两类 `var()` 要分开对待(治理 §12.1 已实测)

| 类别 | 蓝本写法 | Vue2 真实渲染 | 本期怎么办 |
|---|---|---|---|
| **无声明,回退值生效** | `var(--border, rgba(127,127,127,0.25))`(`:85`)· `var(--border, …0.18)`(`:95`)· `var(--bg-tertiary, …0.06)`(`:96`) | `--border` / `--bg-tertiary` 在 Vue2 `src/` 下**零声明**(唯一的 `--border:` 在 `public/guide/google-drive.html:9`,独立静态页无关)→ **渲染的是回退值** | **按回退值映射到 New-UI token**(附录 B §B.3 已给) |
| **有声明,真解析** | `var(--text-primary)` / `--text-secondary` / `--text-tertiary` / `--danger` | Vue2 里有声明(`knowledge.scss:18-31` 的 `.knowledge-app` 块 + Agent `tokens.scss`),且 FolderBrowser 只在 `.knowledge-app` 下被用到 → **真的解析成 knowledge 的值** | **同名 token 直接沿用**,不用映射 |

另:`.fb-crumb:hover` 的 `rgba(127,127,127,0.12)`、`.fb-row:hover` 的 `rgba(127,127,127,0.1)` 是**裸字面量**(不带 `var()`)→ 按附录 B 映射。

---

## 5. 守卫改动(治理 §6.4,本刀负责 **1 / 2 / 3 / 4**;**第 5 项归 T2b、③′ 归 T8**)

### 5.1 `DARK_TOKEN_SELECTOR` / `LIGHT_TOKEN_SELECTOR`(`:245` / `:246`)跟 K21 改
🔴 **RED 探针**:把 scss 里的选择器改回单个 `.knowledge-app {` → 常量对不上 → **精确报红** → 还原。
**两段输出贴报告 + `git status` 干净证明。**

### 5.2 缺口 ④ —— `nonKClassNames`(`:196-199`)会把 `parser-app` 扫出来
它排除的是 `^k(2|n)?-` 与硬编码的 `'knowledge-app'` → **在那行排除条件里加 `&& c !== 'parser-app'`**。
🔴 **裁定:走排除条件,与 `knowledge-app` 同款处理;`NON_K_HELPER_CLASSES` 保持 9 项不变**
(往登记表里塞 `'parser-app'` 会让 9→10、语义变味)。
🔴 **在 `:203` 那条「登记表恰好等于文件里真实存在的非 `k*` 类」的集合相等断言上做 RED 探针。**
⚠️ 本刀会不会真让 `parser-app` 出现在 `knowledge.scss` 里?**会** —— K21 的选择器里就有。所以这一项是**必须**的,不是预防性的。

### 5.3 白名单 `WHITELIST_187` → `WHITELIST_N`
**准确增量与新常量名见附录 D §D.0**(协调者不给这个数,以附录为准;附录若与你实测不符,以实测为准并登记)。
常量名跟着数字改是本档既定习惯。

### 5.4 缺口 ① —— 「没有搬多」的扫描正则(`:160`)要扩
现在是 `/\.k(?:2|n)?-[a-z0-9-]+/g` → **扫不到本刀要搬的 `.fb-*` 段** → 扩成 `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g`。
🔴 **扩正则 = 扫描范围变大,不是放宽断言。**
🔴 **RED 探针**:临时塞一条 `.fb-foo { }` → **报红** → 还原。
⚠️ 蓝本 `:2023-2281` 里还有几十个 `.kn-*` 是 **P5d** 的 —— 本刀只搬 `:2250-2263`,**多搬了这条断言必须能抓到**。

### 5.5 其余自动覆盖的(报告里说明确认过)
- R2 的 `*-soft` token 两档断言数组:本刀新声明的 4 个 token 要不要进?按附录 B / 既有写法判。
- 浅色档 token **集合式**覆盖断言(P5a 终审 ⑦ 写法)自动覆盖新 token;**例外清单不许扩**。
- `var()` 闭环守卫自动覆盖;若报「两档都找不到」说明**漏声明**,**停下查,不要放宽断言**。
- `@keyframes` 存在性守卫:`k-modal-pop` **已存在,不要重复定义**;本刀新增 keyframes = 0(核一遍)。

🔴 **扩,不是删断言、不是放宽正则。** 任何断言的削弱都按 Critical 处理。

---

## 6. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t2a-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t2a-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t2a-build.log 2>&1; echo "exit=$?"
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null; echo "sass exit=$?"
```

- **全量,不许只跑子集**(守卫散落在 `src/styles/color-guard.test.ts` 与 `src/i18n/*`,只有全量能抓)。
- **输出完整落盘,不许 `| tail`**(P2b 教训:红项用例名被截掉永久丢失)。报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **本刀零 `.vue` 新增** → 文件数仍应 **319**;用例数会因守卫改动而变,**报告给实测终值,不要预测**。
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **本期 Service 仓零改动** → 不需要跨仓 `pnpm build`,也不需要 `pnpm install`。
- ⚠️ **`grep parser-status-page dist/assets/*.css` 那条 DoD 不在本刀**(要先有 `.vue` import `parser-styles.scss`,归 T6)。

---

## 7. 硬约束

- 禁 `git add -A` / `git add .`(只许显式列路径);禁 rebase / reset / stash / merge / push;
  不跑 `./scripts/deploy.sh`;不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。
- `.superpowers/sdd/` 被 gitignore 盖着 → 报告要 **`git add -f <显式路径>`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**里的文件一行都不许动:`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` ·
  `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` · `.sp8/NimoOS-Service/**`。
  需要改 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **本刀不许碰任何 `.vue`**(4 个新视图分别归 T4/T6/T7/T8),**也不许建 `parser-styles.scss`**(归 T2b)。

---

## 8. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-2a-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐段搬了什么:**蓝本 `file:line` → New-UI `knowledge.scss` 的新行号**,逐段对照
- **K21 的 `git diff` 片段**(证明只改了两行选择器、块内容零改动)
- **4 个新 token 的两档值 + `tokens.scss` 出处行号**,逐个
- **N15 显式说明**:跳过了 `:1151-1157` 六个 `.k-progress-*` 类,「没有搬多」断言能守住
- **`.fb-*` 段两类 `var()` 的分别处置**(§4.2 两行表),逐处
- **四条 RED 探针的两段输出**(§5.1 / §5.2 / §5.4 各一条,第 5.3 的白名单若有可测点也做)+ 还原确认 + `git status` 干净
- **重名 grep 结果**(与四个既有 scss 文件零重名)
- 三门 + `sass` 完整终值(含红项完整用例名与归属)
- **§3 的 K1–K30 里本刀命中的每一条显式申报**(至少 **K9 / K17 / K21 / K24 相关**)
- **§3.5 的 N1–N22 里本刀命中的**(至少 **N15**),要说明确实照抄/确实没搬
- 白名单最终数字与常量名
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门 + sass 结果 · 白名单最终数字 · RED 探针几条全过 · 顾虑。

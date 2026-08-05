# SP8-P5c · Task 2b —— `parser-styles.scss` 新建 + `parserStyles.test.ts` 新建(守卫 ②⑤)

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(T2a 之后协调者订正过 3 次,
   **新增了 §6.4.1 / §6.4.2**)。尤其 **§6 全节**(§6.1 的 C-3 裁定与三条落地约束 / §6.2 / **§6.4-5 你要建的守卫**)、
   §3 的 **K21 / K22 / K23 / K24 / K25**、§9(守卫缺口表 ②⑤)、§10、§11(第 1 条与第 5 条点名 scss 任务)
2. `.superpowers/sdd/p5c-appendix-B-tokens.md` —— **色值映射唯一权威**(尤其 Parser 两页那部分 + §B.3)
3. `.superpowers/sdd/p5c-appendix-D-classes.md` —— Parser 两页的类清单 / 蓝本自己没定义的类
4. `.superpowers/sdd/p5c-plan.md` 的 **T2b 节**
5. **T2a 的产出与评审**(本刀直接建在它上面):`p5c-task-2a-report.md` · `p5c-task-2a-review.md` ·
   现状 `src/ai/styles/knowledge.scss`(K21 的两行选择器已就位)· `src/ai/styles/knowledgeStyles.test.ts`
6. `p5b-common-constraints.md` §6 / §9 / §11 + `p5a-common-constraints.md` §6 / §11

**权威优先级:治理文件 + 附录 B/D > 本 brief > 计划书。** 冲突以治理/附录为准并在报告里指出。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`05bff49`**(工作树干净)
- 三门基线(**T2a 之后的实测值,以此为准**):
  **`Test Files 319 passed (319)` / `Tests 3161 passed (3161)`** · `vue-tsc` 0 · `vite build` 0 · `sass knowledge.scss` 0
- **本刀新增 1 个测试文件、零 `.vue`** → 文件数应 **319 → 320**
- 🔴 蓝本一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`(`main`@`7a6ee6b7`)。
  **禁 `cat`/`Read` 那个仓的工作树文件;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**新建**:`src/ai/styles/parser-styles.scss` · `src/ai/styles/parserStyles.test.ts`
**不改任何既有文件**(`knowledge.scss` 与 `knowledgeStyles.test.ts` 在 T2a 已收工,**本刀一行都不许动**)
**不建任何 `.vue`**(`ParserStatus.vue` 归 T6、`ParserTest.vue` 归 T7)

---

## 2. 两处蓝本来源(共 199 行)

| 来源 | 行数 | 落到 |
|---|---|---|
| `src/views/AI/Parser/parser-styles.scss` | **74** | `.parser-app.parser-status-page { … }` |
| `src/views/AI/Parser/ParserTest.vue` 的 **`:245-369`** 内联 `<style lang="scss" scoped>` | **125** | `.parser-app.parser-test-page { … }` |

🔴 **`ParserTest.vue` 不 `@import './parser-styles.scss'`**(只有 `ParserStatus.vue:162-164` 那个 `<style>` 块 `@import`)
→ 两份是**各自独立的 scoped 样式**,治理 §12.1 已实测复核。

---

## 3. K23 —— 两页各自作用域,**不许合并同名类**

```
.parser-app { …… }                        ← 只放 K22 那三行结构属性(见 §4)
.parser-app.parser-status-page { …… }     ← parser-styles.scss 的 74 行
.parser-app.parser-test-page  { …… }      ← ParserTest.vue:245-369 的 125 行
```

**依据**(治理 §3 K23,C-2 实测):两份里有大量重名类,但**声明并不都相同**:
- **逐字相同的 3 条**:`.card` · `.page-header` · `.page-header h2`
- **各不相同的**:`.row` · `h3` · `li` · `.hint`(还有别的,**你要自己把全部重名类逐个 diff 一遍并列进报告**)

🔴 **合并 = 界面不 1:1 = 回归。** 即便那 3 条逐字相同,也**照 K23 在两个作用域下各留一份**
(「东西在哪儿就搬到哪儿」,承 P5b §B.0.2)。
🔴 **`parserStyles.test.ts` 的断言 (d) 就是钉这一条**:`.card` / `.page-header` 必须在**两个**作用域下各有一份。

**裸全局类名清单**(协调者初扫,**你要补全并列进报告**):
`.card` `.row` `.path` `.error` `.empty` `.toggle` `.hint` `.warn` `.param` `.score` `.dot` `.radio` `.checkbox`
`.small` `.page-header` `.dropzone` `.file-meta` `.pick-btn` `.clear-btn` `.reset-btn` `.query-input` `.submit-btn`
`.ok-hint` `.error-box` `.hint-line` `.params-row` `.docling-md` `.scored-list` `.rank-line` `.rank-no` `.rank-text`
`.chunk-list` `.chunk-item` `.chunk-head` `.chunk-text` `.emb-preview` `.emb-label` `.rerank-score` `.chunk-ref`
`.folder-list` `.folder-row` `.folder-path` `.folder-count` `.folder-bar` `.failure-list` `.status-text` `.pause-btn`
`.concurrency-row` `.device-row` `.resolved-hint` `.test-link` `.refresh-btn` `.back-link` `.header-actions`
`.control-card` `.queue-card` `.folders-card` `.failures-card` `.help-card` `.upload-card` `.docling-card`
`.scored-card` `.chunks-card` `.unreachable` `.kv` `.active` `.has`
+ 元素选择器 `h2` `h3` `p` `li` `pre` `code` `em` `input` `strong`
→ **全部必须嵌在那两个页面作用域之下**(K9 同族),**零顶层裸选择器**。

---

## 4. K22 —— `.parser-app` 只带三行结构属性

```scss
.parser-app {
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
}
```

**依据**(治理 §3 K22):`src/styles/theme.css:318` 是 `body { overflow: hidden }` → 顶层路由页
(`/ai/parser`、`/ai/parser/test` 在 `knowledgeRoutes.ts:62-63` 是**顶层路由**,不在 `KnowledgeLayout` 下)
若不自建滚动容器,**超出视口的内容永远看不到**。
先例:`AreaShell.vue` 的 `.area-shell{height:100vh;height:100dvh}` + `.area-body{overflow:auto}`、
`knowledge.scss` 的 `.k-scroll{overflow-y:auto}`。
→ **Vue2 没有这三行,但这是修一个可复现的错误行为(内容不可达),按 §2 判据必须改。已授权为 K22。**
🔴 **报告要显式申报 K22**,并说明「滚动条位置从文档级挪到 `.parser-app`」这个可见后果
(治理 §3 K22 已登记,评审不按 1:1 报)。

🔴 **`.parser-app` 块里零颜色属性、零 `--x:` 声明**(§6.1 落地约束 1)——
token 由 T2a 已就位的 K21 选择器提供(`knowledge.scss:130` 与 `:249` 各已扩一个逗号项),
**本刀不许再声明任何 token,也不许改 `knowledge.scss`。**
`parserStyles.test.ts` 的断言 (c) 就是钉这一条。

---

## 5. 配色(附录 B 是权威,**表里没有的一律 `NEEDS_CONTEXT`**)

- 🔴 **19 个 `var(--ns-color-*, fallback)` 全部渲染回退值** —— `--ns-color-*` 在 Vue2 全仓**零声明**
  (T0 + 治理 §12.1 已复核:只命中 `ParserTest.vue` 10 次 + `parser-styles.scss` 9 次,**零处 `--ns-color-x:` 声明**)。
  → **附录 B 按回退值建映射,不是按 token 名猜语义。** 你照附录 B 落,**不许自己重新判断语义**。
- 🔴 **一切可见颜色必须 `var(--…)`**。禁 `#hex` / `rgb()` / `rgba()` / 具名色 —— **`white` / `black` 也算**。
  `transparent` 是关键字不算违规。
- 🔴 **本文件里没有 token 声明层豁免**(声明层全在 `knowledge.scss`)→ **`parser-styles.scss` 全文零色字面量,
  注释里也不许有**(R5:注释写「蓝本行号 + 中文描述」,**不许写出被替换掉的色字面量**)。
- **K25 已授权**:Parser 两页**暗色档与 Vue2 不同**(Vue2 只有一套浅色,暗档本无「原样」可抄)。
  评审不按「暗档像素不同」报缺陷;但**浅色档必须肉眼与 Vue2 一致**。
- ⚠️ **附录 B 取舍②(浅档 `--warning` / `--success` 比 Vue2 更深)在本刀同样生效**
  (`.dot` 绿灯 / `.dot.paused` 橙灯 / `.warn` / `.score` 等)。**照附录 B 落,不开小灶**(协调者裁定 A-2),
  报告里登记一句,验收清单由协调者写。
- 🔴 **落笔前 grep 重名**:这 60+ 个裸类名与 `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` /
  `sk-shared.scss` / `knowledge.scss` **零重名** —— 🔴 **本刀是全期重名风险最高的一刀**(`.card` `.row` `.error`
  这种通用名),嵌套作用域串号单测与 color-guard 都抓不到,**只能人肉**。**逐个 grep 结果列进报告。**
  ⚠️ 有重名也不一定要改名(两页作用域已经隔离),但**必须确认隔离真的生效**,并把重名清单交出来。

---

## 6. `parserStyles.test.ts` 四条断言(治理 §6.4-5)

**为什么必须新建**:`parser-styles.scss` 既不受 `color-guard.test.ts` 约束(**它不扫 `.scss`**,缺口②),
也不受 `knowledgeStyles.test.ts` 约束(**它只读 `knowledge.scss`**)→ **完全裸奔**(缺口⑤)。

| # | 断言 | 要点 |
|---|---|---|
| (a) | **全文零色字面量** | 正则口径同 `color-guard` + **`white`/`black` 等 CSS 具名色全清单**(T2a 评审用了 100 个具名色的完整清单,**照它的做法**)。`transparent` 放行 |
| (b) | **零顶层裸选择器** | 判据:**第 0 列开头的选择器只许是** `.parser-app` / `.parser-app.parser-status-page` / `.parser-app.parser-test-page` 这三个 |
| (c) | **`.parser-app` 块里零颜色属性、零 `--x:` 声明** | 堵 §6.1 落地约束 1 |
| (d) | **两个页面作用域各自存在,且 `.card` / `.page-header` 在两个作用域下各有一份** | 堵 K23(防「顺手合并同名类」) |

🔴 **读源文件一律 `node:fs`,不许用 Vite 的 `?raw`** —— vitest 的 CSSEnablerPlugin 会把样式源整体替换成空串
→ 断言对空字符串「**假通过**」。先例见 `knowledgeStyles.test.ts` 头注释 ③。
**用 `path.dirname(fileURLToPath(import.meta.url))` 定位,不用 `__dirname`**(先例:P5b T11)。
⚠️ `.sp8` 没装 `@types/node` → 本仓既定手法是在 `node:fs` / `node:path` / `node:url` 的 import 上加
`@ts-expect-error` 并注释说明(至少 5 个既有文件都这么写,`knowledgeStyles.test.ts` 头注释有原文)。**照抄既有写法。**

🔴 **每条断言都要 RED 探针**(4 条起),各贴**两段输出**(报红 + 还原后转绿)+ 还原确认 + `git status` 干净。
建议探针:(a) 塞一个 `#hex` 与一个具名色各一次 ·(b) 加一条第 0 列的 `.foo { }` ·
(c) 往 `.parser-app` 块塞 `color:` 与 `--x:` 各一次 ·(d) 把 `.card` 从一个作用域里删掉。

🔴 **断言要有判别力,不许空转**(治理 §9 沿用):
「在文件里找某段文本」的判据必须**整行/行首锚定 + 先排除注释**(P5a 六次同族事故,全部只有 RED 探针能发现)。

---

## 7. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t2b-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t2b-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t2b-build.log 2>&1; echo "exit=$?"
pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null; echo "sass parser exit=$?"
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss     /dev/null; echo "sass knowledge exit=$?"
```

- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**(P2b 教训)。报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **本刀新增 1 个测试文件、零 `.vue`** → 文件数应 **320**;用例数 = 3161 + 你新写的条数。**报告给实测终值。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- ⚠️ 🔴 **`grep parser-status-page dist/assets/*.css` 这条 DoD 不在本刀** —— `parser-styles.scss` 是新文件,
  **本刀没有任何 `.vue` import 它,所以它不会进构建产物,这是预期**(治理 §8 那条要求归 **T6**)。
  **不要为了让它进产物而去建 `.vue` 或改别的文件。** 报告里说明这一点。
- **本期 Service 仓零改动** → 不需要跨仓 `pnpm build`,也不需要 `pnpm install`。

---

## 8. 硬约束

- 禁 `git add -A` / `git add .`(只许显式列路径);禁 rebase / reset / stash / merge / push;
  不跑 `./scripts/deploy.sh`;不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。
- `.superpowers/sdd/` 被 gitignore 盖着 → 报告要 **`git add -f <显式路径>`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**里的文件一行都不许动:`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` ·
  `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` · `.sp8/NimoOS-Service/**`。
- 🔴 **本刀额外零改动**:`src/ai/styles/knowledge.scss` 与 `src/ai/styles/knowledgeStyles.test.ts`
  (T2a 已收工并过评审)。需要改 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **本刀不许建任何 `.vue`**。

---

## 9. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-2b-report.md`(**`git add -f`**),至少含(治理 §10):
- 两处来源逐段搬了什么:**蓝本 `file:line` → `parser-styles.scss` 的新行号**,逐段对照
- 🔴 **全部重名类的逐个 diff 结论**(哪些两份逐字相同、哪些不同、不同在哪)—— K23 的落地证据
- 🔴 **裸类名全清单**(你补全后的)+ **与 5 个既有 scss 文件的重名 grep 结果**
- **K22 三行的申报** + 「滚动条位置从文档级挪到 `.parser-app`」这个可见后果
- **附录 B 的映射逐处落地**(19 个 `--ns-color-*` 回退值 + 其余裸字面量),**表里没有的一律 `NEEDS_CONTEXT`**
- **四条(以上)RED 探针的两段输出** + 还原确认 + `git status` 干净
- 三门 + 两个 `sass` 完整终值(含红项完整用例名与归属)
- **`dist` 里没有 `parser-status-page` 是预期**的说明(归 T6)
- **§3 的 K1–K30 里本刀命中的每一条显式申报**(至少 **K9 / K21 / K22 / K23 / K24 / K25**)
- **§3.5 的 N1–N22 里本刀命中的**
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门 + sass 结果 · 重名类 diff 结论一行 · RED 探针几条全过 · 顾虑。

# P5e · Task 8 独立评审(收官刀:路由反转 + DEFERRED_TABS 4→3 + 构建管线门 + M-5 + R23 + 六数字 + 死键)

评审者:sonnet(独立于实现者)。被审提交 `81fc6f7`(父 `590c026`)。
所有探针均用 `cp` 副本 + 行首/字符串锚定注入 + `md5sum` 逐字节还原,禁 `git checkout/restore/stash`。
最终 `git status --porcelain` 为空,`git stash list` 两条(2026-07-18 / 2026-07-06,均非本次评审所建)未碰。

## 0. 协调者抽验复核(独立重跑)

| 抽验 | 我的复现 |
|---|---|
| `git diff --name-only 590c026..HEAD` | 只有 5 个代码文件 + `p5e-task-8-report.md`,一致 |
| `.vue` 数 | `git ls-files src \| grep -c '\.vue$'` = **185**,一致 |
| 测试文件数 | `find src -name '*.test.ts' \| wc -l` = **335**,一致 |
| `knowledgeRoutes.ts:91` | `{ path: 'search', ..., component: SearchView }`,一致 |
| `DEFERRED_TABS` | `['wiki','roots','allowlist']` 三项,一致 |

全部一致,无 Critical。

## A. 🔴 构建管线门 —— 按计划书原文三步独立重做(不是照抄 T8 的方法)

T8 用的方法是 `git show HEAD:` 取「改前」内容做 cp 替换 + 重建。我独立执行**两条路径**:

1. **完全独立复现 T8 的方法**:自己 `git show 590c026:src/ai/knowledge/knowledgeRoutes.ts`(不借用 T8 的 scratch 文件),
   diff 与工作树当前版本比对 —— 差异恰好是 M-5 注释块 + 第六代注释块 + `import SearchView` + 路由 component 两行,
   与 T8 报告 §5.1 描述逐一对应。
2. **按计划书字面「临时撤反转」跑三步**:
   - cp 备份当前 `knowledgeRoutes.ts`(md5 `650d595743b68f747652c6386c95ea19`)
   - 换成 `git show 590c026:` 的内容(md5 `6a6a95d9596774dad1db8c12d5956b52`)
   - `rm -rf dist && pnpm build` → exit=0
   - `grep -o "k-rcard-tag\|FileDetailDrawer\|KFileViewer" dist/assets/*.js` → **grep exit=1,零输出**(改前,确认搜不到)
   - cp 换回当前版本,md5 校验回到 `650d595743b68f747652c6386c95ea19`
   - `rm -rf dist && pnpm build` → exit=0
   - grep 同一条命令 → **命中**:
     ```
     1 dist/assets/index-Bs01F94r.js:FileDetailDrawer
     1 dist/assets/index-Bs01F94r.js:KFileViewer
     2 dist/assets/index-Bs01F94r.js:k-rcard-tag
     ```
     与 T8 报告数字**逐字一致**。
3. **命中上下文独立核验(E-25 上下文感知)**:
   ```
   FileDetailDrawer: ...defineComponent({__name:"FileDetailDrawer",props:{file:{},query:{default:""}},emits:["close","open",...
   KFileViewer:       ...defineComponent({__name:"KFileViewer",props:{file:{}},emits:["close","download"],setup(r,{emit:e...
   k-rcard-tag:       ...createBaseVNode("span",{class:"k-rcard-tag","data-kind":r.file.kind},toDisplayString$1(...
   ```
   压缩产物零注释,三处命中只能来自真实编译代码(`defineComponent`/`createBaseVNode` 调用),非注释残留。
4. **CSS 未混作证据**:全程 grep 目标固定 `dist/assets/*.js`,未碰 `.css`。
5. **额外核实「改前 SearchView 全仓零生产 import」**:改前状态下 `grep -rn "SearchView" --include=*.ts --include=*.vue src/ | grep -v '\.test\.ts'`
   除 `knowledgeRoutes.ts`(此时仍是 `KnowledgeDeferred`,无 import 行)外,其余全部命中都在注释里(`//`/`*` 开头),
   证实"改前"确实是"零生产模块图可达"。

**结论:两种方法(T8 的 `git show HEAD:` 法 与 我独立跑的「临时撤反转」字面法)结果完全一致** —— 因为两者本质上是同一件事(`git show 590c026:` 就是"改前"的确定性来源,`590c026` 就是 T8 之前的 HEAD),T8 的方法**成立**,不是取巧。

已还原,`git status --porcelain` 干净,`dist/` 已删除(gitignore)。

## B. 机制钉子 + 路由反转守卫

1. **`deferred.test.ts` diff 逐行核对**:两条机制钉子用例(`isDeferred 对每个已列 tab 返回 true` / `isDeferred 的判定来源是 DEFERRED_TABS 本身`)在 `git diff 590c026..HEAD` 里**零命中**(只在新增的历史注释块里被"提及"为说明文字,代码本体一字未动)。已改的只有第一条 `it` 的断言列表 + 新增一行 `expect(isDeferred('search')).toBe(false)`。
2. **变异 1**:`isDeferred` 硬编码 `return false`(cp+md5 注入,md5 `2dd8ddce...` → `846c7d57...`)→ **两条机制钉子用例报红**(`expected false to be true` ×2),第一条清单断言不受影响仍绿。还原后 md5 复原为 `2dd8ddce7bc28159df8e47a8f986fe8e`,复跑 3/3 绿。
3. **变异 2**:`knowledgeRoutes.ts:91` 改回 `component: KnowledgeDeferred`(md5 `650d5957...` → `b0d93a0c...`)→ **`expect(searchChild?.component).toBe(SearchView)` 精确报红**,其余两条(路由数量/路由名)不受影响仍绿。还原后 md5 复原为 `650d595743b68f747652c6386c95ea19`,复跑 3/3 绿。
4. **结论**:三门不是空转,这次反转确有守卫,与 T8 报告逐字一致。

## C. R23 祖先链守卫(收官刀追加项)

1. **判据探针**:`knowledge.scss` 的 `.knowledge-app, .parser-app {` 块内插入 `transform: translateZ(0);`(md5 `a30da07a...` → `03690eae...`)→ 对应断言精确报红(`["transform:"]`),其余两条不受影响。还原后 md5 复原为 `a30da07adfc9acc609b2701a174f25ca`。
2. **额外自测(计划书之外,主动加固验证)**:
   - `.k-main {` 块内插入 `will-change: transform;` → 该条断言精确报红,其余两条不受影响。已还原(md5 逐字节比对通过)。
   - `theme.css` 的 `body {` 块内插入 `transform: translateZ(0);` → 第三条断言精确报红。已还原(md5 逐字节比对通过)。
   - **三条断言互相独立、都有真实判别力,不是共享一个空壳。**
3. **伪元素排除核实**:`theme.css:335 body::before` 与 `:352 body::after` **确实各自声明了** `filter: blur(46px)` 与 `transform: translate(...)`(已用 `grep`/`sed` 逐行核实,不是"碰巧没内容"的假通过)。测试的第三条断言目前对着这份**真有 transform/filter 的伪元素**通过,证明其排除逻辑(`(?<![\w.#-])(html|body)\s*\{` 要求选择器紧跟 `{`,`body::before {` 中间夹了 `::before` 不会被捕获)确实生效,不是巧合空转。
4. **纯追加核实**:`git diff 590c026..HEAD -- src/ai/styles/knowledgeStyles.test.ts` **只有 `+` 行**(除 diff header 的 `--- a/...` 外无任何 `-` 行),`@@ -1767,3 +1767,94 @@` 形态确认是文件末尾纯追加,零删除。
5. **`node:fs` 核实**:`read()`/`readFileSync` 全文件统一走 `node:fs`(`import { readFileSync, ... } from 'node:fs'`),未见 `?raw`。
6. **`blankComments`/`stripComments`/`nestedBlockBody`** 均为既有辅助函数(P5a 起沿用),非本刀新造。

**结论:R23 守卫不是空壳** —— 三条断言各自独立、各自有判别力,伪元素排除是真实生效(而非无内容空转),纯追加未破坏既有断言。

## D. 六个收官数字(独立实测)

| # | 量 | 独立实测值 | T8 自报 | 一致? |
|---|---|---|---|---|
| ① 测试文件数 | `pnpm test` | **335** | 335 | ✅ |
| ② 用例数 | 同上 | **4254**(exit 0) | 4254 | ✅ |
| ③ `.vue` 总数 | `find src -name '*.vue' \| wc -l` | **185** | 185 | ✅ |
| ④ color-guard 用例数 | `vitest run color-guard.test.ts` | **187** | 187 | ✅ |
| ⑤ `aiKb*` 键数 | 真实 ESM 模块导入(`cp` 成 `.mjs` + `node --input-type=module`) | **441 / 441**(zh/en) | 441/441 | ✅ |
| ⑥ 全表键数 | 同上 | **1648 / 1648**,only-in-zh 0,only-in-en 0 | 同 | ✅ |

**+3 归因自洽性核实**:T7 报告(`p5e-task-7-report.md:248`)自报 `Tests 4251 passed`;
用 `git show 590c026:<file> | grep -c '^\s*it('` 对三个改动文件逐个数改前/改后 `it(`/`it.each` 数量:
`deferred.test.ts` 3→3、`knowledgeRoutes.test.ts` 3→3、`knowledgeStyles.test.ts` **57→60**(+3,恰是 R23 新增的三条 `describe` 内 `it`)。
**+3 全部且仅来自 R23 三条新断言,归因自洽,不是 R24 那种叙述矛盾。**

## E. 死键核查(独立重跑,54/54)

从 `zh_cn.ts:1899-1952`(`>>> SP8-P5e Task 1` 块)提取 54 个键,逐键跑既定口径:
```
grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
```
**结果:54/54 全部有命中,dead=0。**

**4 条间接消费(`aiKbSrMtimeAny/Week/Month/Year`)逐条落实**:直接读 `SearchView.vue:87-91`(`MTIMES` 常量的 4 个 `label` 字段值恰是这 4 个键)与 `:408-414`(模板 `v-for="m in MTIMES"` 内 `{{ t(m.label) }}`)—— **真实间接消费,已逐行核实,非推断**。

## F. M-5 + 验收导航路径

1. `git diff 590c026..HEAD -- src/ai/knowledge/knowledgeRoutes.ts | grep -E '^[+-]' | grep -v '^[+-]//' | grep -v '^+++' | grep -v '^---'` 只剩 import 行 + 路由 component 那两行 —— **M-5 涉及的注释文本完全不出现在非注释行 diff 里,非注释行改动为 0 的自证成立**。
2. `KnowledgeLayout.vue:56` rail 数组:`dashboard`(1)→ `search`(2)→ `wiki`(3)…,**"搜索"确为第 2 项**。
3. dev server `:5288` 存活(`ps aux` 确认进程 `vite --host --port 5288`,`curl 200`),**全程只读,未重启未碰**。深链 `http://192.168.1.143:5288/app/#/ai/knowledge/search?q=python` 格式正确(`/app/` base + hash 路由,与 `CLAUDE.md` 约定一致)。

## G. 三门 + sass 门 + 零改动清单(独立复跑)

```
pnpm test                   → exit=0, Test Files 335 passed, Tests 4254 passed
pnpm exec vue-tsc --noEmit  → exit=0
pnpm build                  → exit=0(两次,构建管线门测试期间已各跑一次改前改后)
pnpm exec sass ... /dev/null → exit=0
```

零改动清单逐个核对(`git diff 590c026..HEAD --stat -- <file>` 全部空输出):
`package.json` · `pnpm-lock.yaml` · `src/styles/color-guard.test.ts` · `src/ai/styles/knowledge.scss` ·
`searchAggregate.{ts,test.ts}` · `KFileViewer.{vue,test.ts}` · `FileDetailDrawer.{vue,test.ts}` ·
`SearchView.{vue,test.ts}` · `src/files/viewers/**`(整目录零 diff)· `knowledgeStore.ts` ·
`src/i18n/{zh_cn,en_us}.ts` —— **全部零改动,与 T8 声明一致**。

提交只含预期的 6 个文件(5 代码 + 1 报告),已在 §0 确认。

## H. 缺口猎(本刀专项)

1. **R23 守卫是否空壳** —— 已用三次独立变异(§C.2)证明三条断言各自有判别力,且伪元素排除是对着"真有 transform/filter 的伪元素"生效(非无内容空转)。**不是空壳。**
2. **+3 用例有无空转** —— 三条新断言逐条做过 RED 变异(知识壳/k-main/body 各一次),全部报红精确,且互不干扰(改一处只红对应那一条)。**无空转。**
3. **`KnowledgeDeferred` 仍被其余 3 个子路由使用** —— `grep` 确认 `wiki`/`roots`/`allowlist` 三条路由的 `component` 仍是 `KnowledgeDeferred`,机制(K7/K8)完整保留。
4. **既有断言有无被削弱** —— 逐文件 diff 核对(§B.1、`knowledgeRoutes.test.ts` 完整 diff、deferred.ts 非注释行 diff、knowledgeStyles.test.ts 纯追加),所有变化都是"新增断言/更新预期值以反映新状态",没有一条断言被删除或放宽判据。唯一的"删除"是 `deferred.ts` 里从 `DEFERRED_TABS` 数组移除 `'search'` 这一数据项本身(这是任务的核心目的,不是断言弱化)。

## 结论

**Critical: 0 / Important: 0 / Minor: 0。**

- 构建管线门:T8 的 `git show HEAD:` 法与我独立按计划书字面重做的「临时撤反转」法结果完全一致(改前零命中/exit 1,改后 1/1/2 命中且上下文可信),两种方法在数学上等价(590c026 就是"改前"的唯一确定性来源)。
- 机制钉子 diff 零命中 + `isDeferred` 变异报红 + 路由改回占位报红,三条均已独立复现,md5 逐字节还原确认。
- R23 守卫经三次独立变异证明有判别力,伪元素排除对真实存在的 transform/filter 伪元素生效,非空壳。
- 六个收官数字全部独立复测一致;+3 用例归因经 `it(` 计数验证自洽(57→60,knowledgeStyles.test.ts 独占)。
- 死键核查独立重跑 54/54 全部有消费,4 条间接消费逐条读源码坐实。
- 全部探针已用 cp+md5sum 逐字节还原,`git status --porcelain` 为空,stash 栈两条无关条目未碰。

**T8 可以关账,P5e 九刀满足进入全支终审的条件(就 T8 本身而言,无阻塞项)。**

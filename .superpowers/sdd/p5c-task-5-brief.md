# SP8-P5c · Task 5 —— `parserStore.ts` + 交接项 #2

> 编号沿用计划书(原 T4 已并入 T3,**本期 9 刀:T1 · T2a · T2b · T3 · T5 · T6 · T7 · T8 · T9 · T10**,无 T4)。

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 10 次)。尤其
   §3 的 **K1 / K26 / K27 / K33(本刀新授权)**、**§4.1(mock 层次)**、**§4.3(本机数据现状)**、
   **§4.4(fixture 抄进测试,不许运行时读台账)**、§5.1(落点)、§8.2(**交接项归属**)、
   §9(测试质量)+ **§9.1(过期守卫要守两件事)**、§10、§11
2. `.superpowers/sdd/p5c-fixtures/README.md` + `parser-stats.json` · `parser-control-state.json` ·
   `parser-folders-pending-20.json` · `parser-jobs-failed-5.json`
3. `.superpowers/sdd/p5c-plan.md` 的 **T5 节**
4. **先例**(照它们抄):`src/ai/knowledge/stores/knowledgeStore.ts`(P5a 的 Pinia setup store,含 K15 的 epoch 守卫写法)·
   `src/ai/knowledge/stores/knowledgeStore.parser.test.ts`(本刀要改它一行)· `knowledgeStore.staleGuard.test.ts`(守卫测试写法)
5. `.superpowers/sdd/p5c-task-3-report.md` §9/§10(**fixture 抄本 + 等价校验**的既定做法,照它抄)

**权威优先级:治理文件 + 附录 > 本 brief > 计划书。** 冲突以治理/附录为准并在报告里指出。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`947c4fc`**(工作树干净)
- 三门基线(**T3 三轮收官后实测**):
  **`Test Files 322 passed (322)` / `Tests 3226 passed (3226)`** · `vue-tsc` 0 · `vite build` 0
- **本刀新增 1 个测试文件、零 `.vue`** → 文件数应 **322 → 323**(`color-guard` 不变)
- 🔴 蓝本 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Parser/store/parserStore.js`(**65 行**)。
  **禁 `cat`/`Read` 那个仓的工作树;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**新建**:`src/ai/knowledge/stores/parserStore.ts` · `src/ai/knowledge/stores/parserStore.test.ts`
**改 1 行**:`src/ai/knowledge/stores/knowledgeStore.parser.test.ts:85`(交接项 #2,见 §4)
**不改其它任何文件。** 🔴 尤其 `knowledgeStore.ts` 本体、scss、两个 `*Styles.test.ts`、`src/i18n/*`、路由。

---

## 2. `parserStore.ts` —— 蓝本 65 行逐条搬

### 2.1 K26 —— `Vue.observable` → Pinia setup store
- 照 `knowledgeStore.ts` 的既有写法(`defineStore('parser', () => { … })`),**别自己发明**。
- state 字段照抄蓝本 `:5-19`:`stats`(含 `queue_depth` 四键、`indexed_files`、`total_vectors_text`、`last_cursor_ms`)·
  `controlState`(`paused` / `concurrency:2` / `device:'auto'` / `resolved_device:'cpu'` / `ocr_enabled:false`)·
  `folders`(`{folders:[], total_groups:0}`)· `failedJobs: []` · `loading` · `error` · `unreachable`。
  🔴 **初值逐字照抄**(`concurrency` 默认 **2**、`device` 默认 `'auto'` 等)。
- 🔴 **`_timer` 句柄移出 state**(K26):蓝本把定时器放在组件里(`ParserStatus.vue` 的 `this._timer`),
  **本刀不管定时器** —— 那是 T6 的事。**`parserStore` 里不要出现任何定时器。**
  (若你在蓝本 store 里找不到定时器,那是对的,别去加。)

### 2.2 K27 —— 5 处直调改走包
| 蓝本 | 本仓 |
|---|---|
| `api.get('/ai/parser/stats')` | `service.ai.parserStats()` |
| `api.get('/ai/parser/state')` | `service.ai.parserState()` |
| `api.get('/ai/parser/folders', { limit: 20 })` | `service.ai.parserFolders({ limit: 20 })` |
| `api.get('/ai/parser/jobs', { status:'failed', limit:5 })` | `service.ai.parserJobs({ status:'failed', limit:5 })` |
| `api.post('/ai/parser/control', {...})` ×5 | `service.ai.parserControl({...})` ×5 |

🔴 **K1 单层取数**:蓝本写 `stats.data` / `control.data` / `folders.data` / `(failed.data && failed.data.jobs) || []`;
本仓包内已 `return res.data` → **直接就是数据本身**,`.data` 那一层**没有**。
→ `failedJobs = (failed && failed.jobs) || []`,🔴 **`|| []` 兜底不许删**(N7)。
`import { service } from '@nimotech/nimoos-service'`。

### 2.3 🔴 K33(协调者本刀新授权)—— `loadAll` 加 epoch 过期守卫

**依据**(治理 §3 K33 有完整原文):蓝本 `loadAll` 有 **8 个并发入口**
(`mounted()` · 5 秒轮询 `ParserStatus.vue:129-131` · 刷新按钮 `reload()` `:137` · 5 个控制动作各自 `await this.loadAll()`)。
两个并发在飞时:
1. 先发后至会用**更旧的**数据覆盖新数据;
2. 🔴 更要紧:**`finally` 里 `loading = false` 会被先完成的那个提前清掉**,而 `loading` 直接驱动刷新按钮的
   `:disabled`(`ParserStatus.vue:7`)→ **按钮提前解禁,用户可见** → 按 §2 判据这是「修一个可复现的错误行为」。

**怎么做**:
- **inline 写,不抽公共 guard**(过早抽象;K15 同族第 2 次,照 `knowledgeStore.ts` 里 K15 的既有写法抄)。
- epoch 必须是 **store setup 闭包内的局部变量**(不是模块级)。
- 过期时:**不写任何 state**(包括 `loading` / `error` / `unreachable`)。
- 🔴 **范围严格限定,其余全部照抄不动**:`Promise.all` 四发 · catch 置 `unreachable=true` + `error=e.message||String(e)` ·
  成功分支置 `unreachable=false` + `error=null` · `|| []` 兜底 · 五个动作「先 `parserControl` 再 `await loadAll()`」。
- 代码注释里注明「蓝本 `parserStore.js:22-46` 无此守卫;K33 授权,依据见治理 §3」。

**测试要求(治理 §9.1,两件事都要守)**:
| 要守的 | 用例 |
|---|---|
| ① 守卫**逻辑**:先发后至不覆盖 | 造两次 `loadAll` 交错(**后发的先回、先发的后回**),断言 state 是**后发**那次的结果,且 `loading` 收敛成 `false`。**拿掉守卫 → 必须报红** |
| ② 守卫**变量作用域**:必须 store 局部,不能模块级 | 🔴 **两 store 实例交错**:建两个 pinia、各取一次 store、让两边的 `loadAll` 交错在飞,断言**各自拿到自己的结果、互不覆盖**。**把 epoch 挪到模块级 → 这条必须报红** |

🔴 **两条都要 RED 探针**(T3 的做法:整行锚定注入 + `assert count==1` + `grep -n`/`md5sum` 先证落盘 → 报红 → 逐字节还原),
各贴两段输出。

---

## 3. mock 与 fixture(§4.1 + §4.4,**本刀最容易翻车的一处**)

- 🔴 **`service.ai.parser*` 一律 mock 成 fixture 原样 snake_case**(`ai.ts` 那几个方法只 `return res.data`,零转换)。
  用到这四份:`parser-stats.json` · `parser-control-state.json` · `parser-folders-pending-20.json` · `parser-jobs-failed-5.json`。
- 🔴 **§4.4:数据必须「抄进测试文件 + 注释标明出处」,不许运行时 `node:fs` 读 `.superpowers/`。**
  理由(不是风格偏好):`.superpowers/` 被 gitignore 盖着靠 `git add -f` 才进库,**该目录在 SP7 整个丢过一次**;
  本分支将来要合 master,`src/` 跨界依赖它会以「找不到文件」的形式神秘挂掉。
  → **照 T3 的做法**:`FIXTURE-COPY-BEGIN/END` 标记块 + 逐字抄 + 注释写「取自 `p5c-fixtures/<file>`(2026-08-03 真机抓取)」。
  🔴 **抄完做一次程序化逐字节等价校验**(脚本比对 → 贴输出),**不许肉眼比**。
  ⚠️ `parser-folders-pending-20.json` 有 20 项 + `total_groups: 119` —— **别精简字段、别改顺序**;
  若你判断 20 项全抄过长,**可以只抄前 N 项**,但必须:① 在注释里写明「只抄前 N 项,原文 20 项」;
  ② 等价校验改成比对「原文的前 N 项」;③ 另有一条用例用完整 20 项验 `total_groups` 与列表长度的关系(**这条要抄全**)。
- 🔴 **「同一方法在两个测试文件里被 mock 成不同形状」= red flag。** 你会同时碰
  `parserStore.test.ts`(新建)与 `knowledgeStore.parser.test.ts`(改一行)—— **自己比一遍两边的 `service.ai.parser*` 形状**。
- **本机数据现状**(治理 §4.3,写进用例当预期):`paused: true` · `concurrency: 2` · `device: 'auto'` ·
  `resolved_device: 'cpu'` · `ocr_enabled: false` · `queue_depth {pending:339, running:1, failed:0, done:9}` ·
  `indexed_files: 7` · `total_vectors_text: 5592` · `folders` 20 项 / `total_groups: 119` · `failedJobs: []`(**空**)。

---

## 4. 交接项 #2 —— 改 `knowledgeStore.parser.test.ts:85` 一行

现场(已核实):
```
:85   ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue({})
```
🔴 **`parserDeleteJob` 的 `{}` 改成 `''`**。

**权威依据**(P5b 治理 §4.1,已回源到 axios 源码):`DELETE /v1/parser/jobs/{id}` 是
**HTTP 204 空体**(`NimoOS-Parser/parser/routes/jobs.py:42-50` 的 `status_code=204` + `return None`);
包里是 `return res.data`(`ai.ts:637-640`);而 **axios 1.18.1 对空体的 `res.data` 给的是 `''`(空字符串)**
—— `axios.cjs:2118` 的守卫是 `if (data && utils.isString(data) && …)`,空串 falsy → 跳过 JSON 解析原样返回。
→ mock 成 `{}` / `{ok:true}` / `undefined` / `null` 都是**把幻觉编码进断言**。

- 🔴 **只改这一行**,`parserRetryJobs` 的 `{}` **不动**(它是 `{"retried":0}` 那类真 JSON,`{}` 虽不精确但不在本刀授权内)。
  ⚠️ 若你认为 `parserRetryJobs` 也该改,**写 `NEEDS_CONTEXT`,不要自己顺手改**。
- **报告里显式申报**:「P5b 授权外,由 P5c 治理 §8.2 第 2 条派活」。
- 当前 store 的 `deleteJob` 不读返回值 → **零行为差异**,这一改是「把幻觉从断言里清掉」,不是修 bug。核一遍确实零行为差异。

---

## 5. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t5-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t5-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t5-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**(P2b 教训)。报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **算术**:文件数 **322 → 323**;`color-guard` **不变**(本刀零 `.vue`);用例数 = 3226 + 你新写的条数。**报告给实测终值。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **本期 Service 仓零改动** → 不需要跨仓 `pnpm build`,也不需要 `pnpm install`。

---

## 6. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。报告 **`git add -f`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**一行都不许动:`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` ·
  `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` · `.sp8/NimoOS-Service/**`。
  ⚠️ **`knowledgeStore.ts` 本体也不许动**(P5b 已收官)—— 你只改它那个**测试文件**的一行。
- 🔴 **本刀额外零改动**:`src/ai/styles/*` · `knowledgeStyles.test.ts` · `parserStyles.test.ts` · `src/i18n/*` ·
  `knowledgeRoutes.ts` · `deferred.ts` · `FolderBrowser.vue` / `folderBrowser.ts`(T3 已收官)。
- 🔴 **本刀不许建 `.vue`、不许碰定时器**(`ParserStatus.vue` 与它的 5 秒轮询归 **T6**)。
- ⚠️ **`parserStore` 此刻全仓零 import 是预期的**(T6/T7 才会用)。别为此去建 `.vue` 或上路由。

---

## 7. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-5-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐条对照:**蓝本 `parserStore.js:行` → `parserStore.ts:行`**(65 行全覆盖,含五个控制动作)
- 🔴 **K1 单层取数的逐处证明**(蓝本 `.data` → 本仓无 `.data`,4 处)
- 🔴 **K33 落地**:守卫代码 + **两条测试(逻辑 / 作用域)的用例名** + **两条 RED 探针的两段输出** + 还原确认
- 🔴 **§4.4 抄本 + 程序化等价校验输出**(若只抄前 N 项,写明 N 与理由,并给「完整 20 项验 `total_groups`」那条用例)
- 🔴 **交接项 #2**:改前改后一行 diff + 「P5b 授权外、由 P5c §8.2 派活」的申报 + **零行为差异的核实**
- 🔴 **两个测试文件里 `service.ai.parser*` 形状一致性的自查结果**
- 三门完整终值(含红项完整用例名与归属)
- **§3 的 K1–K33 里本刀命中的每一条显式申报**(至少 **K1 / K26 / K27 / K33**)
- **§3.5 的 N1–N22 里本刀命中的**(至少 **N7** 的 `|| []`)
- **`parserStore` 全仓零 import 是预期**的说明
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · K33 两条守卫测试一行 · 等价校验结果 · RED 探针几条全过 · 顾虑。

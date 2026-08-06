# SP8-P5c · Task 5 独立评审 —— `parserStore.ts`(Pinia 化 + K33 epoch 守卫)+ 交接项 #2 及其扩权

**评审对象**:`8c8a408`(主体)· `409b05b`(store id + 顾虑④ 订正)· `ca6f2c7`(扩权两行)。基线 `c9e749b`。
**结论:`Ready to merge`。** Critical 0 · Important 0 · Minor 5(全部非阻塞,4 条是治理/上游债务而非本刀产物)。

评审纪律:**不采信实现者报告**,每条回权威源(蓝本 `git show main:`、`NimoOS-Service/src/ai.ts`、
`NimoOS-Parser/parser/routes/jobs.py`、`NimoOS-AI route/v2/parser_proxy.go`)独立核；
**8 条自做 RED 探针**,每条先证注入落盘(整段锚定 + `assert count==1` + md5 前后对比 + `grep -n`)再看报红,
再 `git checkout --` 逐字节还原并核 md5。**未改仓、未提交、收尾 `git status` 干净。**

---

## 1. 本刀专查项逐条核验

### 1.1 🔴 K33 两条守卫测试(治理 §9.1 的「守逻辑 + 守作用域」两件事)

**① 守卫逻辑 —— 是真交错,不是顺序 await。** 自读用例确认:三条交错用例全部用 `deferred<T>()`
(可控 promise,`parserStore.test.ts:188-196`),经 `mockStatsDeferred()` 把两个 promise 用
`mockReturnValueOnce` 排队喂给 `parserStats`,**两发都在 `resolve` 之前发出**
(`const p1 = s.loadAll(); const p2 = s.loadAll()` 后紧跟 `expect(ai.parserStats).toHaveBeenCalledTimes(2)`),
再手动按「后发先回 / 先发后回」两种次序 resolve。✅ 真交错。
第四条(`控制动作里的重载也吃过期守卫…`,`:410`)更是真实剧情:轮询在飞 → `s.resume()` →
`parserControl` await 让位 → 动作的 `loadAll` 成为后发 → 后发先回、轮询后回被丢弃。✅

**② 守卫作用域 —— 两个 pinia 实例。** `:505-536`:`createPinia()` 建两个 → `setActivePinia` 各取一次 store
→ `expect(sA).not.toBe(sB)` → 两边 `loadAll()` 同时在飞 → B 先回、A 后回 →
断言 `sA.stats === STATS_EARLIER`(A 自己的)/ `sB.stats === STATS_NOW` / 两边 `loading === false`。✅

**epoch 是 store setup 闭包内局部变量,不是模块级** —— `parserStore.ts:147` 的 `let loadAllEpoch = 0`
在 `defineStore('ai-parser', () => {` (`:116`) 之内、缩进 2 空格;全文件零第 0 列 `let loadAllEpoch`。✅
**过期时一个 state 都不写**:成功分支 `:169` / catch `:182` 都是 `return`(在任何赋值之前),
finally `:186` 是**正向**判断 `if (epoch === loadAllEpoch) loading.value = false`
→ `loading` / `error` / `unreachable` 三者过期时都不动。✅

**K33 范围没有越界**(逐条对蓝本):`Promise.all` 四发的**方法顺序与参数**照抄
(stats / state / folders `{limit:20}` / jobs `{status:'failed',limit:5}`)· catch 置 `unreachable=true` + `error` ·
成功分支置 `unreachable=false` + `error=null`(且顺序与蓝本 `:35-36` 一致)· `|| []` 兜底在 `:178` ·
五个动作都是「先 `parserControl` 再 `await loadAll()`」。✅ 只多了三处 `if (epoch …)`,别的一个字节没动。

### 1.2 🔴 K1 单层取数 4 处

回权威源核 `NimoOS-Service/src/ai.ts:591-620`(实读 `.sp8/NimoOS-Service`):`parserStats` / `parserState` /
`parserFolders` / `parserJobs` / `parserControl` **五个方法全部只 `return res.data`,零转换** ✅ →
本仓确实**没有** `.data` 那一层。蓝本四处 `stats.data` / `control.data` / `folders.data` /
`(failed.data && failed.data.jobs)` → 本仓 `statsBody` / `controlBody` / `foldersBody` / `(failed && failed.jobs)`。
`|| []` 兜底**没删**(N7),并有三条兜底用例(缺键 / `jobs: null` / 整体 `null`)。✅

### 1.3 🔴 §4.4 fixture 抄本

- **`src/` 下零运行时读 `.superpowers/`**:全仓 40 处 `superpowers` 命中**逐行看过,全部在注释里**;
  `grep -rn "p5c-fixtures\|p5b-fixtures" src/` 剥掉注释行后 **0 命中**;测试文件里零 `node:fs`。✅
- **我自己写的等价校验脚本**(与报告那个无关:从测试文件按 `const NAME…=` 括号配平抽字面量 →
  `node:vm` 求值 → **键排序规范化串深比较 + sha256** 双保险,**另加一条报告没做的 `keyOrderSame` 检查**
  = 保键序的 `JSON.stringify` 串相等):**6/6 MATCH,且 6 份 keyOrderSame=true,exit=0**(输出见 §3)。
- **变异验证**:把 `STATS_NOW` 抄本的 `total_vectors_text` 5592→5593(整段锚定 + `assert count==2` 只改第一处 +
  md5 证落盘)→ **5/6 MATCH + exit=1 + 首处差异定位到该值**;还原后 md5 回到 `d27abd55…`、复跑 **6/6**。✅
- `parser-folders-pending-20.json` **20 项一项没减、字段没精简、顺序没改**(canon 长度 3189 两侧逐字相同)
  → brief §3 的「只抄前 N 项」三个附加条件不适用,报告口径正确。✅

### 1.4 🔴 mock 层次一致性

`service.ai.parser*` 一律 **fixture 原文 snake_case 裸 body**(治理 §4.1 第一行)。✅
**自己逐行比了两个测试文件同名方法的 mock 形状**(另附带扫了 `knowledgeStore.staleGuard.test.ts`):

| 方法 | `parserStore.test.ts` | `knowledgeStore.parser.test.ts` | 判定 |
|---|---|---|---|
| `parserStats` | 裸 snake_case(`STATS_NOW`,p5c 那次真抓) | 裸 snake_case(`STATS`,P5b 那次真抓) | **同层** ✅(值不同 = 两个时刻的真回包,治理 §12.1 已登记该漂移) |
| `parserState` | 裸 `STATE`(5 字段) | 裸 `STATE`(同 5 字段、同值) | ✅ |
| `parserJobs` | `{ jobs: […] }` | `{ jobs: […] }` | ✅ |
| `parserControl` | `{}` | `{}` | ✅ 刻意同形状(注释已写理由) |

**零形状/层数冲突。** 唯一 `{ data: … }` 出现处是刻意的 K1 反向用例(`:264-276`)。

### 1.5 🔴 该测试文件累计只许动 3 行(治理 §8.3)

自做 `git diff c9e749b..ca6f2c7 -- …/knowledgeStore.parser.test.ts`,并另做**剥掉纯注释行后的 diff**:

```
剥注释后行数:248 → 248(零增减,零 it() 增删)
真实改动 = 恰好 3 行:
-    ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue({})
+    ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue('')
-    await s.setControl('set_concurrency', { concurrency: 4 })
-    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_concurrency', concurrency: 4 })
+    await s.setControl('set_concurrency', { n: 4 })
+    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_concurrency', n: 4 })
```

- **与 §8.3 授权逐字对上**(`:85` 一行 + `:149`/`:150` 两行)。**零断言被删除或削弱**,断言语义一字未动
  (仍是「`extra` 被原样展开进 body」+「`parserDeleteJob` 收到 7」)。✅
- **`parserRetryJobs` 的 `{}` 没被顺手改** ✅(同一物理行上只有第二个语句变了)。
- **两行改完仍有判别力** —— 独立复现探针 G(见 §3 探针 G):把 `knowledgeStore.ts:426` 的
  `parserControl({ action, ...extra })` 改成 `({ action })` → **1 failed / 19 passed**,正是那条用例。✅
- **`knowledgeStore.ts` 本体 diff 为空** ✅(三提交的 `--name-only` 里根本没有它)。
- 两条依据我都回权威源独立证实了,**不是采信报告**:
  - `NimoOS-Parser/parser/routes/jobs.py`:`@router.delete("/jobs/{job_id}", status_code=204)` + `return None` ✅
    → 204 空体;`cancelJob`(`knowledgeStore.ts:370-373`)`await` 后**不读返回值** → 零行为差异 ✅
  - `NimoOS-AI route/v2/parser_proxy.go`:`controlReq{ Action; N *int json:"n,omitempty"; Device; Enabled *bool }`,
    `case "set_concurrency": if req.N == nil { return c.JSON(400, …"n required") }` ✅
    → `concurrency` 这个键后端**真的不读**,原断言确是「把幻觉编码进断言」。
  - 蓝本真实调用点 `SettingsView.vue:292` = `setControl('set_concurrency', { n })` ✅ 三处一致,§8.3 的裁定成立。

### 1.6 🔴 蓝本 65 行全覆盖逐条对照(我自己逐行读了 65 行蓝本)

| 蓝本 | 内容 | 本仓落地 | 判定 |
|---|---|---|---|
| `:1-2` | `Vue` / `api` import | `defineStore` / `ref` / `service` | K26+K27 ✅ |
| `:6-11` | `stats` 初值 | `:120-125`,`queue_depth` 四键全 0 + `indexed_files:0` + `total_vectors_text:0` + `last_cursor_ms:0` | **逐字** ✅ |
| `:12` | `controlState` | `:128-134`,`paused:false` / **`concurrency:2`** / `device:'auto'` / `resolved_device:'cpu'` / `ocr_enabled:false`,**键序也一致** | **逐字** ✅ |
| `:13` | `folders` | `:136` `{ folders: [], total_groups: 0 }` | ✅ |
| `:14-17` | `failedJobs:[]` / `loading:false` / `error:null` / `unreachable:false` | `:138-142` | ✅ |
| `:23` | `loading = true` 无条件在最前 | `:161`(在 `++loadAllEpoch` 之后、try 之前) | ✅ |
| `:25-30` | `Promise.all` 四发 + 参数 | `:163-168`,方法顺序与参数逐字 | ✅ |
| `:31-34` | 四处赋值 + `|| []` | `:172-178` | K1 ✅ N7 ✅ |
| `:35-36` | `unreachable=false` / `error=null` | `:179-180`,顺序同 | ✅ |
| `:37-39` | catch:`unreachable=true` / `error=e.message||String(e)` | `:181-184` | ✅(见 Minor M-2 的 `?.` 微差) |
| `:40-42` | finally `loading=false` | `:185-187` | ✅(K33 加正向判断) |
| `:45-48` | `pause` | `:198-201` `{action:'pause'}` + `await loadAll()` | ✅ |
| `:49-52` | `resume` | `:204-207` `{action:'resume'}` | ✅ |
| `:53-56` | `setConcurrency(n)` | `:210-213` `{action:'set_concurrency', n}` | ✅ |
| `:57-60` | `setDevice(device)` | `:216-219` `{action:'set_device', device}` | ✅ |
| `:61-64` | `setOcr(enabled)` | `:222-225` `{action:'set_ocr', enabled}` | ✅ |

**独立判断:65 行 100% 覆盖,零漏、零多。** 蓝本里唯一没有 1:1 对应物的是 `Vue.observable` 与
`parserStore.actions = {…}` 这两个响应式/组织结构外壳,那正是 K26 授权替换的东西。
`set_device` / `set_ocr` 的 body 键名另与 Go `controlReq` 的 `Device` / `Enabled` 独立对上 ✅。

🔴 **`parserStore` 里零定时器**:`grep -n "setInterval|setTimeout|clearInterval|_timer"` 只命中 **2 行,
且都在 `:16-17` 的注释里**(说明 `_timer` 归 T6 的 `ParserStatus.vue`)。
另独立核蓝本:`git show main:…/parserStore.js | grep -c "setInterval|setTimeout|_timer"` = **0** →
K26 收窄后的措辞正确,实现落对了。✅ 且蓝本 `ParserStatus.vue:127-135` 的 `mounted` + 5 秒 `setInterval` +
`document.hidden` 守卫 + `beforeDestroy` 我也核过,确实在组件侧(K33 的「8 个并发入口」说法成立)。

### 1.7 store id

全仓 `defineStore` id 清单实扫(30 个 id):`ai-parser` **1 次,零冲突**;
本区另有 `ai-knowledge` / `ai-settings` / `ai-theme` → 命名一致 ✅。
唯一动态 id 是 `agentStore.ts:130` 的 `ai-agent-${…}`,不可能撞 `ai-parser` ✅。
导出名 `useParserStore` 三轮未变 ✅(`409b05b` 的 diff 只改了 id 字符串 + 注释 + 一个用例名)。

### 1.8 `unreachable` 两个方向

`:333`(四发任一 reject → `true` + `error='parser down'` + `loading` 归位 + 既有数据不动)与
`:348`(恢复 → `false` 且 `error===null`)两个方向都有 ✅。
另自做探针 I 证明「恢复」那一条**有判别力**(删掉成功分支的 `unreachable=false`/`error=null` → 1 红)。

### 1.9 三门 —— 自己复跑

```
pnpm test                  exit=0   Test Files  323 passed (323)   Tests  3246 passed (3246)
pnpm exec vue-tsc --noEmit exit=0   (日志 0 字节,零输出)
pnpm build                 exit=0   ✓ built in 12.52s
```
**零红项、单轮干净**(已知噪声 `persist.test.ts` / `AgentComposer.test.ts` 本轮均未出现,`grep -E "^ FAIL"` = 0)。
**算术自核**:基线 `c9e749b` = 322 / 3226(回 `p5c-task-3-report.md:409-410` 与 `p5c-task-3-review.md:318` 复核)
→ 322 + 1 = **323** ✅ · 3226 + 20 = **3246** ✅ · 该测试文件 `it()` 实数 **20**(程序化扫描,见下)✅ ·
`color-guard` 不变 ✅(`.vue` 总数 `c9e749b` 176 → 现 176,本刀零 `.vue`)。
**三轮三门逐字相同**(报告 §7 / §11.4 / §12.3 全是 323 / 3246 / 0 / 0),与我实测一致;
且二三轮的 diff(1 个 id 字符串 + 注释 + 用例名 + 3 行载荷)本身不可能改变文件数或用例数,自洽 ✅。

### 1.10 提交范围

三提交合计只碰 4 个路径:`parserStore.ts` · `parserStore.test.ts` · `knowledgeStore.parser.test.ts`(3 行)·
`.superpowers/sdd/p5c-task-5-report.md`。
（`p5c-common-constraints.md` / `p5c-plan.md` 的改动来自协调者自己的 `7c5c4df` / `2109eec`,**不在这三个提交里**。）
**零改动实证**(`git diff --name-only c9e749b..ca6f2c7 --` 指定路径全空):
`knowledgeStore.ts` · `src/ai/styles/*`(scss 两个 + 两个 `*Styles.test.ts`)· `src/i18n/*` · `src/router/*` ·
`src/ai/knowledge/components/*`(含 `FolderBrowser.vue`)· `src/ai/knowledge/util/*`(含 `folderBrowser.ts`)·
`src/ai/knowledge/views/*`(§1.1 清单全在此)。**零 `.vue` 新增** ✅。

### 1.11 全仓零 import 是预期,不报缺陷

`grep -rn "parserStore" src/` 只命中它自己测试文件的两行 import ✅;
`dist/assets/*.js` 里搜 `ai-parser` = 空 ✅ —— 按任务书第 11 条,这是预期(T6/T7 才用),**不报**。

### 1.12 空转 / 削弱 / 越界扫描

程序化扫描 20 条用例的 `expect` 数:**最少 1、最多 8,零条空转**。
`it()` 总数 20;无 `it.skip` / `it.todo` / `expect.anything()` 兜底式弱断言;
初值用例用的是**测试文件本地常量**(`INITIAL_STATS` / `INITIAL_CONTROL_STATE`,非从实现 import)
→ 有真判别力(探针 H 实证)。既有断言零删除、零削弱(§1.5 的剥注释 diff 已证)。

---

## 2. 缺陷清单

**Critical:0 · Important:0**

### Minor

- **M-1(本刀,注释过度声明)** `parserStore.test.ts:290-291` 的注释写「count 递减(蓝本 `barWidth`
  拿首项当最大值的前提)」,但那条断言只钉 `folders[19].count === 4`,**并没有验证单调递减**。
  与 §8.2 第 5 条挂账的 DM9 同族(用例/注释过度声明)。**不阻塞**:整个 `FOLDERS` 数组已被
  `:257` 的 `toEqual(FOLDERS)` 逐字节钉死,抄本又与 fixture 逐字节等价 → 事实覆盖到了,只是注释比断言说得大。
  建议二选一:注释改成「末项 count 为 4(首项 18 最大,`barWidth` 的分母来源)」,或补一条真单调断言。
- **M-2(本刀,微偏离未在相邻注释里申报)** `:184` 是 `(e as Error | undefined)?.message || String(e)`,
  蓝本 `:39` 是 `e.message || String(e)`。`e` 在 TS 里是 `unknown`,**收窄是必需的**,且
  `knowledgeStore.ts:459` 有**逐字同款先例**(P5b 产物) → 不是新偏离。但 `?.` 让「reject(null)」这条路
  从「catch 里抛 TypeError」变成「`error = 'null'`」。现实中 axios 一律 reject 一个 Error,**这条路不可达**;
  而 `:156-157` 的文档注释把蓝本形式 `e.message || String(e)` **逐字照抄进注释**却没提 `?.`。
  建议注释补半句(「`?.` 是 TS 对 `unknown` 的必需收窄,承 `knowledgeStore.ts:459`」)。
- **M-3(上游债务,本刀正确地没碰,建议转 P5d)** `knowledgeStore.parser.test.ts:24-26` 的 `STATS` 是
  **手工精简过的** body(缺 `models`,值取自 P5b 那次真抓)—— 它与任何 fixture **都不逐字节相等**。
  §4.4 现在要求「抄本 + 逐字节等价校验」,这个 P5b 遗留常量不满足。层数正确(裸 snake_case)
  → **不是 §4.1 的 red flag**,本刀在 §8.3 的 3 行授权外无权碰它。建议 P5d 顺手换成
  `p5b-fixtures/stats.json` 整份或加「已精简」注释。
- **M-4(治理数据陈旧)** 治理 §8.1 写「当前 `.vue` 总数实测 **175**」,实测 `c9e749b` 与 HEAD 都是 **176**。
  本刀零 `.vue` 故无影响,但 §8.1 的「+4 → 179」算术要给 T6-T9 重新起底为 **180**,否则下游 color-guard
  的 DoD 数字会差 1。
- **M-5(brief 勘误,零影响)** brief §0 写起点 `947c4fc`,实际基线是 `c9e749b`(中间是 `c9e749b` 这一个纯
  markdown 提交)。我实测 `git diff --name-only 947c4fc..c9e749b -- src/` **为空** → 三门基线与产品代码
  坐标都不受影响。与治理 §12 的 E-1 同族(brief 的起点 sha 落后于 markdown 提交),**报告没顺手登记**,
  纯记账瑕疵。

---

## 3. 我自做的 8 条 RED 探针(全部先证注入落盘 → 看报红 → 逐字节还原)

注入器是我自己写的 `rvT5/inject.py`(与实现者的 `probe.py` 无关):**整段锚定 + `assert count==期望` +
`md5` 前后必须变 + `grep -n` 复核落点**。基线 `md5(parserStore.ts) = 1ea1b39b3775925d1ebadf8ba1092452`,
`md5(parserStore.test.ts) = d27abd5575b5cc1363b2e0bf96cb80e4`,`md5(knowledgeStore.ts) = 1d09f5a1c7d01983ee7f370363002088`。
**基线单跑 `parserStore.test.ts` = 20 passed。**

| # | 破坏 | 落盘证明 | 结果 | 报红用例 |
|---|---|---|---|---|
| **A** | 删**成功分支**守卫(锚「`])` + 守卫行」两行,避开 catch 那处) | md5 `1ea1b3…`→`90201c…`;`grep` 证明只剩 `:181` catch 一处 | 🔴 **3 failed / 17** | `两次 loadAll 交错…` · `🔴 过期那一发先落地时…` · `控制动作里的重载也吃过期守卫…` |
| **B** | 🔴 **epoch 挪真模块级**(两步:删缩进那行 + 在 `export const useParserStore` 前插第 0 列 `let`) | md5 两跳 `1ea1b3…`→`f97d63…`→`3df1c7…`;`grep -n` 证明 `:116` 是**第 0 列**声明、在 `defineStore` 之前 | 🔴 **1 failed / 19 passed** | **只有** `两个 pinia 实例各自 loadAll 交错在飞…` |
| **C** | `finally` 改无条件 `loading.value = false` | md5 →`550553…`;`grep -n :186` | 🔴 **1 failed / 19** | `🔴 过期那一发先落地时,不许写 state、也不许把 loading 提前关掉…` |
| **D** | 删 **catch** 守卫(锚「`} catch (e) {` + 守卫行」) | md5 →`e791f7…`;`grep` 证明 `:181` 后紧接 `unreachable.value = true` | 🔴 **1 failed / 19** | `🔴 过期那一发失败时,不许写 unreachable / error…` |
| **E** | **K1 反向**:四处全加回 `.data`(含 `failed` 那处,比报告的探针 E 更狠) | md5 两跳 →`541e19…`→`ec9fd8…`;`grep` 列出四处 | 🔴 **11 failed / 9** | 两条 K1 + 形状 + `.jobs` + `unreachable` 两条 + 四条交错 + 作用域那条 |
| **F** | **N7**:`|| []` 换成 `failed!.jobs!` | md5 →`63844d…`;`grep -n :178` | 🔴 **4 failed / 16** | 三条 `【N7 兜底】` + `🔴 K1 反向…` |
| **G** | 🔴 **`knowledgeStore.ts:426` 的 `{ action, ...extra }` → `{ action }`**(丢弃 extra) | md5 `1d09f5…`→`cff179…`;`grep -n :426` | 🔴 **1 failed / 19**(`knowledgeStore.parser.test.ts`) | `把 action 与附加字段合并进 body,并重载 overview` |
| **H** | 蓝本初值:`concurrency: 2`→`4`、`device:'auto'`→`'cuda'` | md5 →`4ad61f…`;`grep -n :130-131` | 🔴 **1 failed / 19** | `七个 state 字段的初值与蓝本一致(concurrency 默认 2 / device 默认 auto)` |
| **I** | 删成功分支的 `unreachable=false` + `error=null`(缺口猎) | md5 →`ae33d3…`;`grep -c` 从 1 → 0 | 🔴 **1 failed / 19** | `恢复后 unreachable 回 false 且 error 清成 null(蓝本 :35-36)` |

### 🔴 探针 B —— §9.1 唯一的判别力证据,独立复现成功

```
[probe] anchor 命中 = 1 (期望 1)   md5 1ea1b39b… → f97d63d8… → 3df1c716…
116:let loadAllEpoch = 0 // [probe B] 真模块级          ← 第 0 列,在 defineStore 之前
     × 两个 pinia 实例各自 loadAll 交错在飞 → 各自拿到自己的结果、互不覆盖、两边 loading 都收敛 9ms
 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
```

**逐字复现了报告声称的「1 红 19 绿」。** 这同时证明两件事:
① 作用域那条用例**有真判别力**;② **其余 19 条(含三条单实例交错用例)对「实例局部」这一维完全无感** ——
治理 §9.1 描述的缺口在本刀确实存在,不写 ② 就没人守它。**这是本刀最有价值的一条产出。**

### 探针 G —— 扩权那两行改完仍有判别力

```
[probe] anchor 命中 = 1 (期望 1)   md5 1d09f5a1… → cff1794b…
426:    await service.ai.parserControl({ action })
     × 把 action 与附加字段合并进 body,并重载 overview 7ms
      Tests  1 failed | 19 passed (20)
```
→ `{ concurrency: 4 }` → `{ n: 4 }` 只换了载荷键名,「`extra` 被原样展开进 body」这条断言语义与判别力**都在**。✅

### 还原确认

九次注入全部 `git checkout -- <file>` 还原,每次核 md5 回到基线值:
`parserStore.ts` = `1ea1b39b3775925d1ebadf8ba1092452` ·
`parserStore.test.ts` = `d27abd5575b5cc1363b2e0bf96cb80e4` ·
`knowledgeStore.ts` = `1d09f5a1c7d01983ee7f370363002088`。
两文件合跑 **40 passed**;`git status --short` **空**。

---

## 4. 我自己的 fixture 等价校验 + 变异验证

脚本(我自己写的,与报告那个不同实现:抽字面量 → `node:vm` → **键排序 canon 深比较** +
**保键序 `JSON.stringify` 比较** + sha256):

```
MATCH   STATS_NOW      sha(copy)=4b05f0ef83b1f092 sha(fix)=4b05f0ef83b1f092  keyOrderSame=true  bytes=312/312
MATCH   STATS_EARLIER  sha(copy)=9296cafa1992b429 sha(fix)=9296cafa1992b429  keyOrderSame=true  bytes=312/312
MATCH   STATE          sha(copy)=aa1ae74354a60872 sha(fix)=aa1ae74354a60872  keyOrderSame=true  bytes=91/91
MATCH   FOLDERS        sha(copy)=b8dbf06d081d41e5 sha(fix)=b8dbf06d081d41e5  keyOrderSame=true  bytes=3189/3189
MATCH   FAILED_EMPTY   sha(copy)=0a5796e93f9b57dd sha(fix)=0a5796e93f9b57dd  keyOrderSame=true  bytes=11/11
MATCH   FAILED_ROW     sha(copy)=1e074fcaf8d58021 sha(fix)=1e074fcaf8d58021  keyOrderSame=true  bytes=262/262
结果:6/6 MATCH   exit=0
```
(我的 canon 是**键排序**版,故 sha 与报告的 sha 不同 —— 那是两套不同的规范化,不是分歧;
**键序**由我另加的 `keyOrderSame` 一栏覆盖,6/6 为 true。)

**变异验证**(证明脚本非空转):`STATS_NOW.total_vectors_text` 5592→5593 →
```
DIFF    STATS_NOW      sha(copy)=37ad9aeffb85b406 sha(fix)=4b05f0ef83b1f092  keyOrderSame=false
         首处差异 @285: copy…"total_vectors_text":5593… / fix …"total_vectors_text":5592…
结果:5/6 MATCH   exit=1
```
还原后 md5 复原、复跑 **6/6 MATCH**。
⚠️ 附带发现(**支持 §4.4 的存在意义**,不是缺陷):这次变异**不会让任何单测报红** ——
因为断言与抄本用的是同一个常量(自洽)。**抄本的正确性只能靠这个等价校验脚本保证**,
治理 §4.4「不许肉眼比」的要求是对的,这一条应保留给下游每一刀。

---

## 5. 与报告不符之处

**实质不符:0 条。** 报告的每一条可核查断言我都独立复现了(6/6 抄本、探针 A/B/C/D/F 的红数、
三门 323/3246/0/0、3 行改动、零形状冲突、零 import、零定时器、K33 范围、蓝本 65 行覆盖)。

两点**表述层面的差异**(都不是错):
1. 报告探针 E 记「9 failed / 11」,我的探针 E 是 **11 failed / 9** —— 因为我**额外**把 `failed` 那处的
   `.data` 也加回去了(报告只注入了三处 `.value =`)。两边各自内部自洽,我的是严格超集。
2. 报告的抄本 sha256 与我的不同 —— 两套不同的规范化口径(保键序 vs 键排序),各自两侧一致。

报告在 §10 顾虑 4 主动登记并订正了自己第一轮的误读(把 P5b 测试载荷当成真实调用点),
我回三处权威源复核**订正是对的**,原误读确实是错的。这一条自我纠错值得记一笔。

---

## 6. 收尾

- **未改仓、未提交、未 `git add`(除本文件由协调者约定可 `git add -f`)。**
- `git status --short` **空**(`TREE-CLEAN-FINAL`),三个被探针碰过的文件 md5 全部回到基线值。
- 三门在**还原后的干净树**上复跑:`323 / 3246 / exit 0` · `vue-tsc exit 0`(0 字节)· `vite build exit 0`。

**放行意见:`Ready to merge`。** 5 条 Minor 里只有 M-1 / M-2 落在本刀产物上,都是注释措辞级别、
可在 T6 顺手收;M-3 / M-4 / M-5 是上游/治理债务,建议由协调者登记转 P5d。

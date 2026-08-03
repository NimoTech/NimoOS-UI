# SP8-P5c · Task 5 报告 —— `parserStore.ts` + 交接项 #2

起点 `c9e749b`(工作树干净)· 分支 `sp8-ai` · 可写仓 `.sp8/NimoOS-New-UI`
蓝本 `git -C NimoOS-UI show main:src/views/AI/Parser/store/parserStore.js`(65 行,只 `git show`,没碰那个仓的工作树)

---

## 1. 逐文件

| 文件 | 动作 | 行数 |
|---|---|---|
| `src/ai/knowledge/stores/parserStore.ts` | **新建** | **244**(第一轮 239,第二轮 +5 注释;含 ~53 行文件头注释 + 类型) |
| `src/ai/knowledge/stores/parserStore.test.ts` | **新建**,20 例 | **537**(第一轮 535,第二轮 +2 注释;含 6 个 FIXTURE-COPY 块) |
| `src/ai/knowledge/stores/knowledgeStore.parser.test.ts` | **改 1 行 mock**(交接项 #2)+ 8 行依据注释 | +9 / -1 |

**没有改其它任何文件**(`git status` 只有 1 个 `M` + 2 个 `??`,见 §7)。
`knowledgeStore.ts` 本体、scss、`knowledgeStyles.test.ts` / `parserStyles.test.ts`、`src/i18n/*`、
`knowledgeRoutes.ts` / `deferred.ts`、`FolderBrowser.vue` / `folderBrowser.ts`、`.sp8/NimoOS-Service/**` 一行未动。
**零 `.vue`、零定时器、零 i18n 键、零 scss** → `color-guard` 不变、`parity.test.ts` 不受影响。

---

## 2. 蓝本 65 行 → `parserStore.ts` 逐条对照(全覆盖)

| 蓝本 `parserStore.js` | New-UI `parserStore.ts` | 说明 |
|---|---|---|
| `:1` `import Vue from 'vue'` | `:52-54` `defineStore` / `ref` / `service` | K26 机械替换 |
| `:2` `import { api } from '@/service/service.js'` | `:54` `import { service } from '@nimotech/nimoos-service'` | K27 |
| `:4` `Vue.observable({ state: {…} })` | `:116` `defineStore('ai-parser', () => {` | K26。`state` 这层对象整个消失 → 组件里 `store.state.stats` 变 `store.stats` |
| `:6-11` `stats` 初值(`queue_depth` 四键 + `indexed_files` + `total_vectors_text` + `last_cursor_ms`) | `:120-125` | **逐字照抄,不补 `total_vectors_visual` / `models`**(蓝本初值里没有 → 类型里标可选) |
| `:12` `controlState` 初值(`paused:false`/`concurrency:2`/`device:'auto'`/`resolved_device:'cpu'`/`ocr_enabled:false`) | `:128-134` | **逐字照抄**(`concurrency` 默认 **2**) |
| `:13` `folders: { folders: [], total_groups: 0 }` | `:136` | 照抄(外层对象与内层数组同名) |
| `:14` `failedJobs: []` | `:138` | |
| `:15-17` `loading` / `error` / `unreachable` | `:140-142` | |
| — | `:147` `let loadAllEpoch = 0` | **K33 新增**,store setup 闭包内局部变量(**不是模块级**) |
| `:22` `async loadAll()` | `:159` | |
| `:23` `state.loading = true` | `:161` | 无条件在最前,照抄 |
| `:25-30` `Promise.all` 四发(`stats`/`state`/`folders?limit=20`/`jobs?status=failed&limit=5`) | `:163-168` | **顺序与参数逐字照抄**;5 处直调 → 包方法(K27) |
| — | `:169` `if (epoch !== loadAllEpoch) return` | **K33** 成功分支守卫 |
| `:31` `state.stats = stats.data` | `:172` `stats.value = statsBody` | **K1** 少剥一层 |
| `:32` `state.controlState = control.data` | `:173` | **K1** |
| `:33` `state.folders = folders.data` | `:174` | **K1** |
| `:34` `state.failedJobs = (failed.data && failed.data.jobs) \|\| []` | `:177-178` `(failed && failed.jobs) \|\| []` | **K1 + N7**(`\|\| []` 兜底保留) |
| `:35-36` `unreachable = false` / `error = null` | `:179-180` | 照抄 |
| `:37` `catch (e)` | `:181` | |
| — | `:182` `if (epoch !== loadAllEpoch) return` | **K33** catch 守卫 |
| `:38-39` `unreachable = true` / `error = e.message \|\| String(e)` | `:183-184` | 照抄(`?.message` 是 TS 写法,语义同) |
| `:40-42` `finally { loading = false }` | `:186` `if (epoch === loadAllEpoch) loading.value = false` | **K33** finally 守卫(正向判断) |
| `:45-48` `pause()` | `:198-201` `{ action: 'pause' }` + `await loadAll()` | 照抄 |
| `:49-52` `resume()` | `:204-207` `{ action: 'resume' }` | 照抄 |
| `:53-56` `setConcurrency(n)` | `:210-213` `{ action: 'set_concurrency', n }` | 🔴 **键名是 `n`**,与设置页那条路径**一致**(见 §10 顾虑 ④ 的订正)。照抄 |
| `:57-60` `setDevice(device)` | `:216-219` `{ action: 'set_device', device }` | 照抄 |
| `:61-64` `setOcr(enabled)` | `:222-225` `{ action: 'set_ocr', enabled }` | 照抄 |

**蓝本里没有、本文件也没有的东西**:定时器。5 秒轮询 + `document.hidden` 守卫 + `beforeDestroy` 清理都在
`ParserStatus.vue:129-135`,**归 T6**。治理 K26 那句「`_timer` 句柄移出 state」指的是那一处 —— brief §2.1
已明示「`parserStore` 里不要出现任何定时器」,本文件遵此,**没有去加**。
(⚠️ 计划书 T5 节写「`_timer` 句柄**移出 state 成模块级 `let`**」会被读成「本刀要建一个模块级 `_timer`」——
按权威优先级 治理/brief > 计划书,以 brief 为准。已在下面 §10 顾虑 ① 登记;协调者第二轮已回源确认并订正治理 K26 + 计划书(`7c5c4df`)。)

---

## 3. 🔴 K1 单层取数的逐处证明(4 处)

包内实测(治理 §1 第 2 条已逐方法回源,本刀复核 `NimoOS-Service/src/ai.ts:591-620`):
`parserStats` / `parserState` / `parserFolders` / `parserJobs` / `parserControl` **五个方法都只 `return res.data`**,零转换。

| # | 蓝本(三层里的第 2 层) | New-UI(单层) |
|---|---|---|
| 1 | `:31` `stats.data` | `:172` `statsBody` |
| 2 | `:32` `control.data` | `:173` `controlBody` |
| 3 | `:33` `folders.data` | `:174` `foldersBody` |
| 4 | `:34` `(failed.data && failed.data.jobs) \|\| []` | `:178` `(failed && failed.jobs) \|\| []` |

**判别力**:
- 正向 —— 「🔴 K1:fixture 原样 snake_case 直接写进 state(没有 .data 那一层)」:mock 是**裸 body**,
  实现若多剥一层就红(探针 E 实测 9 条红)。
- 反向 —— 「🔴 K1 反向:mock 多包一层 `{ data }` 时,写进 state 的就是那个外壳(证明实现零剥壳)」:
  断言 `s.stats.queue_depth` **是 `undefined`**,外壳没被剥。

---

## 4. 🔴 K33 落地 + 两条守卫测试 + RED 探针

### 4.1 守卫代码(`parserStore.ts:147` / `:160` / `:169` / `:182` / `:186`,行号为**第二轮**实测)

```ts
  let loadAllEpoch = 0                                   // :147  store 实例局部(不是模块级)

  async function loadAll(): Promise<void> {
    const epoch = ++loadAllEpoch                         // :160
    loading.value = true                                 // :161  无条件,照抄蓝本 :23
    try {
      const [ … ] = await Promise.all([ …四发… ])         // :163-168 照抄
      if (epoch !== loadAllEpoch) return                 // :169  过期 → 一个 state 都不写
      …
    } catch (e) {
      if (epoch !== loadAllEpoch) return                 // :182
      …
    } finally {
      if (epoch === loadAllEpoch) loading.value = false  // :186  正向判断
    }
  }
```

代码注释已注明「蓝本 `parserStore.js:22-46` 无此守卫;K33 授权,依据见治理 §3」(文件头 `:34-46` + `:149-158`)。
**inline 写,没抽公共 guard**(K15/K33 的既定口径:过早抽象)。范围严格限定 —— `Promise.all` 四发、
catch 置 `unreachable`+`error`、成功分支置 `unreachable=false`+`error=null`、`|| []` 兜底、
五个动作「先 `parserControl` 再 `await loadAll()`」**全部照抄未动**。

### 4.2 两条(实为四条)守卫用例 —— 治理 §9.1 的**两件事**都守住了

| 要守的 | 用例名 |
|---|---|
| **① 守卫逻辑**:先发后至不覆盖 | `K33 过期守卫 ① … > 两次 loadAll 交错(后发先回、先发后回)→ state 是后发那次的,loading 收敛 false` |
| ①′ 不许提前清 `loading`(**按钮提前解禁,用户可见** = K33 的主依据) | `K33 过期守卫 ① … > 🔴 过期那一发先落地时,不许写 state、也不许把 loading 提前关掉(刷新按钮会提前解禁)` |
| ①″ 过期那一发失败不许写错误态 | `K33 过期守卫 ① … > 🔴 过期那一发失败时,不许写 unreachable / error(否则页面会在数据正常时报「不可达」)` |
| ①‴ 真实剧情:轮询在飞时点了动作 | `五个控制动作… > 控制动作里的重载也吃过期守卫:动作触发的那一发比轮询那一发晚发 → 它才是最新的` |
| 🔴 **② 守卫变量的作用域**必须 store 实例局部 | `K33 过期守卫 ② —— 守卫变量必须 store 实例局部,不是模块级 > 两个 pinia 实例各自 loadAll 交错在飞 → 各自拿到自己的结果、互不覆盖、两边 loading 都收敛` |

②的写法:`createPinia()` 建两个 pinia → `setActivePinia` 各取一次 store(`expect(sA).not.toBe(sB)`)→
两边 `loadAll()` 同时在飞(实参顺序由 `parserStats` 的两个 deferred 控制)→ **后发的 B 先回、A 后回** →
断言 `sA.stats === STATS_EARLIER`(它自己的结果)、`sB.stats === STATS_NOW`、两边 `loading === false`。

### 4.3 RED 探针(**6 条,全部先证注入落盘 → 再看报红 → 再逐字节还原**)

注入器 `probe.py`:整段字面量锚定 + `assert count == 1` + 断言 md5 真的变了(治理 §9 第七条)。
基线 `md5(parserStore.ts) = c80e260e4f2d49e98112690ef4fa7fb8`。

| # | 破坏 | 落盘证明 | 结果 | 报红用例(完整名) |
|---|---|---|---|---|
| **A** | 删掉**成功分支**的 `if (epoch !== loadAllEpoch) return`(锚定「守卫行 + 紧跟的 `// K1:` 注释行」两行,避免撞上 catch 那一处) | md5 `c80e26…` → `ee9e83…`;`grep -n` 证明只剩 catch 那 1 处(当轮 `:178`,第二轮起为 `:182`) | 🔴 **3 failed / 17 passed** | ①`两次 loadAll 交错(后发先回、先发后回)…`(`expected {…} to deeply equal {…}` —— 旧数据真盖上去了)· ①′`🔴 过期那一发先落地时,不许写 state…` · ①‴`控制动作里的重载也吃过期守卫…` |
| **B** | 🔴 把 `let loadAllEpoch = 0` 从 setup 闭包**挪到真模块级**(两步:删缩进那行 + 在 `export const useParserStore` 前插第 0 列声明) | md5 两跳 `c80e26…`→`7adc41…`→`0ac2d0…`;`grep -n` 证明当轮 `:113` 是第 0 列声明、在 `defineStore` 之前 | 🔴 **1 failed / 19 passed** | ②`两个 pinia 实例各自 loadAll 交错在飞 → 各自拿到自己的结果、互不覆盖、两边 loading 都收敛`(`expected {…(4)} to deeply equal {queue_depth:…}` —— A 的整发被判过期、stats 停在初值) |
| **C** | `finally` 改成无条件 `loading.value = false` | md5 → `30c27a…`;`grep -n`(当轮 `:183`) | 🔴 **1 failed / 19** | ①′`🔴 过期那一发先落地时,不许写 state、也不许把 loading 提前关掉…`(`expected false to be true`) |
| **D** | 删掉 **catch** 的过期守卫 | md5 → `f8b5d8…`;`grep -c` 从 2 → 1 | 🔴 **1 failed / 19** | ①″`🔴 过期那一发失败时,不许写 unreachable / error…`(`expected true to be false`) |
| **E** | **K1 反向**:`stats.value = (statsBody as { data: … }).data`(把蓝本那层 `.data` 加回来) | md5 → `782fca…`;`grep -n`(当轮 `:169`) | 🔴 **9 failed / 11** | `🔴 K1:fixture 原样…` · `🔴 K1 反向:mock 多包一层…` · `四发里任一 reject…` · `恢复后 unreachable 回 false…` + 四条交错用例 + ② |
| **F** | **N7**:删掉 `|| []` 兜底 | md5 → `a5eb7f…`;`grep -n`(当轮 `:175`) | 🔴 **4 failed / 16** | `【N7 兜底】failed 响应缺 jobs 键 → 空数组` · `…jobs 为 null(Go nil slice 序列化结果)→ 空数组` · `…整体为 null → 空数组,不抛` · `🔴 K1 反向…` |

🔴 **探针 B 是本刀最关键的一条**:它同时证明了两件事 —— ② 那条用例**有判别力**,而**其余 19 条全绿**
(= 治理 §9.1 描述的缺口在本刀是真实存在的,不写 ② 就没人守着「实例局部」这一维)。

**还原确认**:`md5(parserStore.ts)` 回到 `c80e260e4f2d49e98112690ef4fa7fb8`;
`md5(parserStore.test.ts)` 回到 `b6d6199277ce58646692072a24267447`;该文件单跑 **20 passed**;
`git status` 干净(只有本刀的 1 `M` + 2 `??`)。

---

## 5. 🔴 §4.4 fixture 抄本 + 程序化逐字节等价校验

**抄了 6 份、全份全抄**(`parser-folders-pending-20.json` 的 **20 项一项没减、字段一个没精简、顺序一个没改**,
所以 brief §3 里「只抄前 N 项」的三个附加条件不适用)。抄本由脚本从 fixture 生成后插入,**零人工转写**;
每份都有 `FIXTURE-COPY-BEGIN/END` 标记 + 出处注释。**测试里零 `node:fs`、零 `.superpowers/` 运行时依赖。**

| 常量 | 来源 | 用途 |
|---|---|---|
| `STATS_NOW` | `p5c-fixtures/parser-stats.json`(整份) | 「最新那一发」的 stats |
| `STATS_EARLIER` | `p5b-fixtures/stats.json`(整份) | 🔴 交错用例需要两份**可区分的真**响应体;这两份是同一端点在两个时刻的真回包(`pending` 338→339 / `indexed_files` 8→7,治理 §12.1 已登记该漂移)—— **不是手编数据**,而且正好是「轮询两发在飞」的真实剧情 |
| `STATE` | `p5c-fixtures/parser-control-state.json`(整份) | 5 字段,本机暂停态 |
| `FOLDERS` | `p5c-fixtures/parser-folders-pending-20.json`(整份 20 项 + `total_groups:119`) | 含一条专门用例验「列表长度 20 ≠ 总组数 119」+ 首项逐字段 + `count` 递减到 4 |
| `FAILED_EMPTY` | `p5c-fixtures/parser-jobs-failed-5.json`(整份 `{"jobs":[]}`) | 本机失败桶为空 |
| `FAILED_ROW` | `p5b-fixtures/jobs-pending.json` 的 `jobs[0]`(id 348,整行) | 🔴 本机 failed 桶实测为空 → 光靠空桶**区分不出**「真读了 `.jobs`」与「走了 `\|\| []` 兜底」。`/v1/parser/jobs` 同一张表同一序列化器、行形状与 status 无关 → 借一行真行做判别。**先例 = `knowledgeStore.staleGuard.test.ts` 的 `POISON_FAILED_ROW`**(T3 修复轮 1 M-2 已认可) |

### 等价校验输出(脚本 `/tmp/…/p5c-t5-fixture-equiv.mjs`,不进版本库)

判据 = 规范化 JSON 串(`JSON.stringify` 保键序 ⇒ 串相同即键名/键序/值/项序全同)+ sha256 双保险:

```
✅ STATS_NOW     <- p5c-fixtures/parser-stats.json              canon 312  sha256 5e10998e83c7b290f849f885c197e320e254dde0d08f309b21bcd7d8017aa8ad
✅ STATS_EARLIER <- p5b-fixtures/stats.json                     canon 312  sha256 d0333de352b38c56ac8ef811b9493622766c08e843f082a6f70982ef33199381
✅ STATE         <- p5c-fixtures/parser-control-state.json       canon  91  sha256 f8e96af185ca65d34774a708698e87d2ec911d3cb7d92956e90e0424c82f19d7
✅ FOLDERS       <- p5c-fixtures/parser-folders-pending-20.json  canon 3189 sha256 6ad769318b3eed3785647bf3ed2bb0c7d46d1d9635a418c6fc599409069d917e
✅ FAILED_EMPTY  <- p5c-fixtures/parser-jobs-failed-5.json       canon  11  sha256 0a5796e93f9b57ddf7c45f860485cbb7353fc0eda3dca753a444d0fd2a1573fe
✅ FAILED_ROW    <- p5b-fixtures/jobs-pending.json  jobs[0]      canon 262  sha256 eb4aabecff7d02ef0506d283189bc98e8dfd755d500af36363e5594da0c79c5b

RESULT: 6/6 MATCH(逐字节等价)     exit=0
```
(两侧 sha256 逐字一致,上表只列一次。)

**变异验证(证明脚本有判别力,不是空转)**:把 `FOLDERS` 抄本里 `folders[0].count` 由 `18` 改 `19`
(整行锚定 + `assert count == 1` + md5 证明落盘)→

```
❌ FOLDERS … 抄本 sha256 723fb0d6…  首个差异 @178: 抄本 "count":19 / 原文 "count":18
RESULT: 5/6 MATCH(1 处不等价)      exit=1
```
还原后复跑 **6/6 MATCH**,`grep -c '"count": 19'` = 0,测试文件 md5 复原。

---

## 6. 🔴 交接项 #2 —— `knowledgeStore.parser.test.ts` 改 1 行

**申报:这一改在 P5b 授权之外,由 P5c 治理 §8.2 第 2 条派给本刀。**

```diff
-    ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue({})
+    ai.parserRetryJobs.mockResolvedValue({}); ai.parserDeleteJob.mockResolvedValue('')
```
(另加 8 行依据注释,内容 = 下面这段。)

**权威依据**(P5b 治理 §4.1,已回源到 axios 源码):`DELETE /v1/parser/jobs/{id}` 是 **HTTP 204 空体**
(`NimoOS-Parser/parser/routes/jobs.py:42-50` 的 `status_code=204` + `return None`);包里是 `return res.data`
(`ai.ts:637-640`);**axios 1.18.1 对空体的 `res.data` 给的是 `''`**(`axios.cjs:2118` 的守卫
`if (data && utils.isString(data) && …)`,空串 falsy → 跳过 JSON 解析原样返回)。
`{}` / `{ok:true}` / `undefined` / `null` 都是**把幻觉编码进断言**。

**零行为差异的核实**:`knowledgeStore.ts:370-373` 的 `cancelJob` 是
`await service.ai.parserDeleteJob(id); await loadAllJobs()` —— **返回值不被读**;该用例的断言只有
`expect(ai.parserDeleteJob).toHaveBeenCalledWith(7)`。改前改后该文件 **20 passed** 逐字不变
(单跑复核过)。这一改是「把幻觉从断言里清掉」,不是修 bug。

🔴 **`parserRetryJobs` 的 `{}` 没动**(它是 `{"retried":0}` 那类真 JSON,`{}` 虽不精确但不在本刀授权内)。
我**不认为**它该在本刀改 → 不写 `NEEDS_CONTEXT`,原样留给协调者派活。

---

## 7. 三门(全量,输出完整落盘,未用 `| tail`)

```
pnpm test                   exit=0   /tmp/p5c-t5-test.log
                                     Test Files  323 passed (323)
                                           Tests  3246 passed (3246)
pnpm exec vue-tsc --noEmit  exit=0   /tmp/p5c-t5-tsc.log   (0 字节,零输出)
pnpm build                  exit=0   /tmp/p5c-t5-build.log  ✓ built in 12.53s
```

- **零红项,单轮干净,没有复跑**(已知噪声 `persist.test.ts` / `AgentComposer.test.ts` 本轮均未出现;
  `grep -cE "^ *×"` = 0)。
- **算术核对**:文件数 **322 → 323**(+1 测试文件,本刀零 `.vue`)✅ ·
  例数 **3226 → 3246** = **+20**(本刀新写 20 例;`color-guard` **不变**,因为没新增 `.vue`)✅
- **Service 仓零改动** → 未跑跨仓 `pnpm build`、未 `pnpm install`。

`git status --short`(提交前):
```
 M src/ai/knowledge/stores/knowledgeStore.parser.test.ts
?? src/ai/knowledge/stores/parserStore.test.ts
?? src/ai/knowledge/stores/parserStore.ts
```

---

## 8. 命中的 K / N 显式申报

| 条目 | 落地 |
|---|---|
| **K1** 单层取数 | 4 处,§3 有逐处证明 + 正反两条用例 + 探针 E |
| **K26** `Vue.observable` → Pinia setup store | `:116` `defineStore('ai-parser', …)`;`state` 这层消失;`actions.foo()` → 本地函数;**定时器不在本文件**(归 T6,brief §2.1 明示) |
| **K27** 5 处直调 → 包方法 | `parserStats` / `parserState` / `parserFolders({limit:20})` / `parserJobs({status:'failed',limit:5})` / `parserControl(…)` ×5 |
| **K33** `loadAll` 加 store 实例局部 epoch 守卫 | §4;两条守卫测试(逻辑 + 作用域)+ 6 条 RED 探针 |
| **N7** `\|\| []` 兜底不许删 | `:178`;三条兜底用例(缺键 / `jobs: null` / 整体 `null`)+ 探针 F |
| **N2**(P5a)`stats` 无 `rate_per_min`/`done_last_10m`/`eta_s` | 类型注释里登记,**没有去补** |
| **N16 / N17 / N19 / N20 / N21 / N22** | 都是模板/i18n 侧的条目,**本刀零 `.vue` 零 i18n → 未命中**(归 T6/T7) |

**未申报的偏离:无。** 除 K1/K26/K27/K33 外没做任何偏离。

**mock 层次自查(治理 §4.1 五行表)**:本刀只碰 `service.ai.parser*` 一族 → 一律
**HTTP 原样 snake_case = fixture 原文**。`service.notes.*`(camelCase)/ `service.folder.getList`(单层 `{content}`)
本刀不涉及。

**「同一方法在两个测试文件里被 mock 成不同形状」自查**(逐行比过两文件的 `ai.parser*.mock*`):
`parserStats` / `parserState` 两边都是**裸 snake_case body**(`knowledgeStore.parser.test.ts` 用的是 P5b 期那次
真抓 = 338/8,我用 p5c 那次 = 339/7,**同一层、不同时刻的真回包**,不是形状差异);
`parserJobs` 两边都是 `{ jobs: [...] }`;`parserControl` 两边都是 `{}`。**零形状冲突** ✅
(`parserControl` 的真响应体本期 fixture 未抓 —— store 也不消费它,按治理 §8.2 第 8 条同款「不依赖」口径登记,
并**刻意与 `knowledgeStore.parser.test.ts:144` 保持同形状**,理由写在 `mockAllOk()` 的注释里。)

---

## 9. `parserStore` 全仓零 import 是预期的

`grep -rn "parserStore" src/ --include=*.ts --include=*.vue`(排除自身两文件)= **0 命中**。
消费方 `ParserStatus.vue` / `ParserTest.vue` 归 **T6/T7**。
**没有**为了让它进产物去建 `.vue`、上路由或改 `deferred.ts`(brief §6 明令)。
连带:`dist` 的 JS 里搜不到 `useParserStore` 是预期的(会被 tree-shake);本刀不产 CSS,与 §12.2 E-8 无关。

---

## 10. 顾虑 / 挂账(都不阻塞)

1. **文档冲突(已按权威优先级处理,提请协调者知悉)**:计划书 T5 节写「`_timer` 句柄**移出 state 成模块级 `let`**」,
   而蓝本 `parserStore.js` 里根本没有定时器(它在 `ParserStatus.vue:129-135`)。brief §2.1 与 §6 明确
   「本刀不管定时器、`parserStore` 里不许出现任何定时器」→ **按 治理/brief > 计划书 取后者**,本文件零定时器。
   治理 K26 的措辞「`_timer` 句柄移出 state 成模块级 `let`」建议就地订正为「归 T6 的 `ParserStatus.vue`」。
2. ~~**store id 用了 `'parser'`**~~ → 🔴 **协调者采纳,第二轮已改 `'ai-parser'`**(见 §11)。
3. **`parserControl` 的真响应体本期没有 fixture**(§8 已登记「不依赖」)。若 T6/T8 哪一刀要读它的返回值,
   需要先抓一份 —— 但那会真的改设备状态(pause/resume),按治理 §13 第 3 条要标红。
4. 🔴 ~~**`setConcurrency` 传 `n`、`knowledgeStore.setControl` 传 `concurrency`,两处 Vue2 现状不同**~~
   → **这条是我的误读,已订正(协调者第二轮回源指出)。结论:不存在不一致,两处都传 `n`,后端契约也是 `n`。**

   | 权威源 | 实际(本刀第二轮独立复核 ✅) |
   |---|---|
   | 蓝本 `SettingsView.vue:292` | `await this.store.actions.setControl('set_concurrency', { n })` —— **传的也是 `n`** |
   | New-UI `knowledgeStore.ts:425-427` | `setControl(action, extra = {})` → `parserControl({ action, ...extra })` —— **只是展开转发**,键名由**调用点**决定,store 自己不带 `concurrency` 字段(蓝本 `knowledgeStore.js:311-314` 同构) |
   | 后端 `NimoOS-AI route/v2/parser_proxy.go:80-85` | `type controlReq struct { Action string; N *int \`json:"n,omitempty"\`; Device string; Enabled *bool }` —— **`n` 才是对的** |

   **我的误读怎么来的**:我拿 `knowledgeStore.parser.test.ts:149-150` 那句
   `s.setControl('set_concurrency', { concurrency: 4 })` 当成了「设置页的调用点」,而它只是**那条 P5b 用例
   自己编的任意 extra 载荷**(用来证明「extra 会被展开进 body」这一件事),不是真实调用点。
   → 教训与「手编 fixture 复发坑」同族:**「转发型 action 的键名」必须回真实调用点看,不能拿测试里的载荷当契约。**
   🔴 **连带修正**:`parserStore.ts` 那段代码注释与 `parserStore.test.ts` 的用例名里「不是 `concurrency` ——
   两处不同是 Vue2 现状」的措辞**已删掉**,换成「与设置页调用点、后端 `controlReq` 一致」(见 §11),
   免得 T8(要写 `SettingsView` 上半、会调 `setControl('set_concurrency', …)`)以为有历史包袱去「统一」。
   ⚠️ **顺带登记(本刀不改)**:`knowledgeStore.parser.test.ts:149-150` 用的 `{ concurrency: 4 }` 是后端**不认**的键。
   它测的语义(extra 展开)成立、不算错,但换成 `{ n: 4 }` 会更贴真实契约 —— **不在本刀授权内**(§1.1:
   本刀只许改那个文件的交接项 #2 那一行),留给协调者派活。
5. 20 例里没有 `document.hidden` / 轮询频率相关用例 —— **那是 T6 的**(N20)。

**`NEEDS_CONTEXT`:0 条。**

---

## 11. 🔴 第二轮 —— 协调者两条处置(store id + 顾虑 ④ 订正)

**协调者反馈**:6/6 抄本、探针 B 精确复现 §9.1 缺口形态、K1 反向探针 9 红 → 通过;开最后一个提交收两件小事。

### 11.1 store id `'parser'` → `'ai-parser'`(采纳顾虑 ②)

`parserStore.ts:116` → `defineStore('ai-parser', () => {`。**只改 id 字符串,导出名 `useParserStore` 不动**,
并在上方加三行注释写清理由(AI 区既有 `'ai-knowledge'` / `'ai-settings'` / `'ai-theme'`,不留没带前缀的孤例)。
现在改零涟漪 —— `parserStore` 全仓零 import(T6/T7 还没写),全仓 `defineStore` id 复查**零冲突**。

### 11.2 顾虑 ④ 订正(**我错,协调者对**)—— 不改行为,改措辞

回权威源独立复核了协调者给的三行依据,**三条全部证实**(表见 §10 顾虑 4)。两处措辞已改:

| 位置 | 改前 | 改后 |
|---|---|---|
| `parserStore.ts:190-195`(五个动作的段头注释) | 「`set_concurrency` 传的键是 **`n`**,不是 `concurrency` —— 那是 `knowledgeStore.setControl` 调用点的写法,**两处不同是 Vue2 现状**,照抄」 | 「键是 **`n`**,与设置页那条路径**一致**(蓝本 `SettingsView.vue:292` 也是 `setControl('set_concurrency', { n })`,而 `knowledgeStore.setControl` 只是展开转发、键名由调用点决定);后端契约同样是 `n`(`parser_proxy.go:80-85` 的 `controlReq{ N *int }`)。**没有历史包袱,不需要「统一」**」 |
| `parserStore.test.ts:387-389`(用例名 + 新增两行注释) | `🔴 setConcurrency 传的键是 \`n\`(不是 \`concurrency\`),并重载` | `🔴 setConcurrency 的键是 \`n\`(与设置页调用点、后端 controlReq 一致),并重载` |

**断言本体一字未改**(`toHaveBeenCalledWith({ action: 'set_concurrency', n: 4 })`),用例数不变。

### 11.3 顾虑 ① / ③ 的处置(协调者已定,本轮不动代码)

- **顾虑 ①**(计划书「`_timer` 移出 state 成模块级 let」)—— 协调者回源确认**我落对了**(蓝本 store 零定时器,
  5 秒轮询在 `ParserStatus.vue:129-131`、归 T6),治理 K26 措辞已收窄 + 计划书 T5 节加订正注(`7c5c4df`)。
- **顾虑 ③**(`POST /control` 无 fixture)—— 处置正确,保持「不依赖」+ 与 `knowledgeStore.parser.test.ts` 同形状 `{}`。

### 11.4 第二轮三门(全量,输出落盘 `/tmp/p5c-t5b-*.log`)

```
pnpm test                   exit=0    Test Files  323 passed (323)
                                            Tests  3246 passed (3246)
pnpm exec vue-tsc --noEmit  exit=0    (0 字节,零输出)
pnpm build                  exit=0    ✓ built in 12.68s
```

**与第一轮逐字相同(323 / 3246)**—— 本轮只改了 1 个 id 字符串 + 两处注释/用例名,文件数与用例数都不该变,实测没变 ✅
零红项、单轮干净。抄本等价校验**复跑 6/6 MATCH**(第二轮没碰 FIXTURE-COPY 块,复跑只为确认没被连带改动)。

**新顾虑:0 条。`NEEDS_CONTEXT`:0 条。**

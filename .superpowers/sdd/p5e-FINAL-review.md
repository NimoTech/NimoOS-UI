# P5e 全支终审(final whole-branch review)

> 终审者:opus,2026-08-05。被审对象:`.sp8/NimoOS-New-UI`@`sp8-ai`,**BASE `ec6a000` → HEAD `5f1c396`**(30 提交)。
> 🔴 本文件遵铁律:**不采信任何报告**(实现者 / 逐刀评审 / 协调者裁定书),全部自跑自读自贴。
> 🔴 分段落盘:每节完成即追加。

---

## §0. 收官数字自测(七个数字 + 四道门,全部本人实测)

### 0.1 四道门

| 门 | 命令 | 我的实测 | 收官口径 | 一致? |
|---|---|---|---|---|
| 单测 | `pnpm test --reporter=verbose` | `Test Files 335 passed (335)` / `Tests 4254 passed (4254)` / **exit 0** / `Duration 77.02s` | 335 / 4254 | ✅ |
| 类型 | `pnpm exec vue-tsc --noEmit` | **exit 0**,日志 **0 行输出** | 0 | ✅ |
| 构建 | `pnpm exec vite build` | **exit 0**,`✓ built in 13.51s` | 0 | ✅ |
| sass | `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` | **exit 0** | 0 | ✅ |

🔴 **已知噪声两条(`persist.test.ts > dropPersisted` 的 IndexedDB flaky · `AgentComposer.test.ts` 的 vue-i18n teardown 竞态)本轮一次都没红** ——
`grep -cE '^ *(×|✗|FAIL)' vitest-full.log` = **0**,`Test Files 335 passed (335)` 无 skipped/todo 尾注。**零复跑。**

### 0.2 七个数字

| # | 量 | 我的取数方法(逐条自跑) | 我的实测 | 收官口径 | 一致? |
|---|---|---|---|---|---|
| ① | 测试文件数 | vitest 汇总行 | **335** | 335 | ✅ |
| ② | 用例数 | vitest 汇总行 | **4254** | 4254 | ✅ |
| ③ | `.vue` 总数 | `find src -name '*.vue' \| wc -l` | **185** | 185 | ✅ |
| ④ | `color-guard` 用例数 | `pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose` | **187** | 187 | ✅ |
| ⑤ | `aiKb*` 键数 | **真实模块导入**(`cp zh_cn.ts → zh.mjs`,`node --input-type=module`) | **zh 441 / en 441** | 441/441 | ✅ |
| ⑥ | 全表键数 | 同上,两档各自独立量 + 双向差集 | **zh 1648 / en 1648**;`zh-only 0 []` · `en-only 0 []` | 1648/1648,差集均空 | ✅ |
| ⑦ | 本期新增 `.vue` | `git diff --name-status ec6a000..5f1c396 -- 'src/**/*.vue'` | **A×3**(`FileDetailDrawer.vue` / `KFileViewer.vue` / `SearchView.vue`)+ M×1(`SettingsPage.vue`,仅注释) | 3 新建 | ✅ |

**⑤⑥ 的取数确实按要求走「真实模块导入」而非文本解析** —— 两个 i18n 文件 `grep -c '^import'` = **0/0**,可直接当 ESM 跑;
附带核到 `typeof zh[k] !== 'string'` 的键 **0 个**(全表是纯扁平字符串表,不存在嵌套导致的少算)。

⇒ 🔴 **七个数字 7/7 与收官口径逐个吻合,四道门 4/4 绿。零出入。**

### 0.3 产品 diff 规模(自测)

`git diff --stat ec6a000..5f1c396 -- src/ docs/` = **20 文件 / +5976 / −34**,与「本期产出的产品文件」清单逐个对上:
新建 8 个(4 对 `.ts/.vue` + `.test.ts`)· 改动 `deferred.{ts,test.ts}` / `knowledgeRoutes.{ts,test.ts}` /
`knowledge.scss` / `knowledgeStyles.test.ts` / `zh_cn.ts` / `en_us.ts` / `messageSyntax.test.ts` /
`SettingsView.test.ts`(+12/−?)/ `SettingsPage.vue`(+2)/ `docs/…cross-area-impacts.md`(+14/−?)。
🔴 **零越权文件**(无 `src/files/**`、无 `src/home/**`、无 Service 仓、无 `package.json`)。

---

## §A. 跨刀一致性(逐刀评审结构上看不到的层)

### A.1 三个新 `.vue` 的写法自相一致性 —— 逐项自读源文件

| 维度 | `SearchView.vue` | `FileDetailDrawer.vue` | `KFileViewer.vue` | 判定 |
|---|---|---|---|---|
| **过期守卫形态** | `let runEpoch = 0`(`:196`,`<script setup>` 顶层 ⇒ **实例级闭包变量**),`myEpoch !== runEpoch` 双分支挡 | `activeId` ref 当 `reqId` 比对键(蓝本自带,`:112/122/126/129` 四处判断) | 无异步 ⇒ 不需要 | ✅ **两者都是实例级**、都在注释里写明「挪到模块级 → 必须报红」的手工 RED 判据。形态不同是因为**蓝本本身不同**(SearchView 蓝本零守卫=本期新增;Drawer 蓝本自带 `reqId`)⇒ 不是不一致 |
| **`data-*` 动态绑定** | `:data-open="String(advOpen)"` · `:data-on="String(...)"` ×3 · `:data-kind="r.kind"` · `:data-level="relLevel(...)"` | `:data-active="String(c.id === activeId)"` · `:data-kind="file.kind"` · `:data-level="relLevel(...)"` | — | ✅ **一律 `String(...)` 包布尔值,非布尔值(已是 string)不包** —— 两文件口径完全一致,且与蓝本 `:data-on="String(topK === n)"`(蓝本 `:68`)同源 |
| **定位器策略** | 语义类名(`.k-adv-chip` / `.k-rcard` / `.k-rel`)+ `.k-adv-field` 下标 | 同族语义类名 | 同族 | ✅ 一致,零 `data-testid`(全仓无此先例) |
| **K/N 申报注释格式** | 文件头 `═══ 🔴 K44 ═══` / `═══ 🔴 K52 ═══` 块 + 行内 `🔴 N33/N34/…` | 文件头 `🔴 K44 / K48 / K49 / N41–N44` + 行内 | 文件头 `🔴 K44 / K46 / N41` | ✅ 同一格式(文件头列本刀全部偏差编号,行内在落点处复述) |
| **Esc 监听形态** | 不注册(交给两个子组件) | `function onKey` + `onMounted(add)` / `onBeforeUnmount(remove)`,**同一函数引用** | 逐字同款 | ✅ **两处写法逐字同构**;N41「两者同时挂载按 Esc 会一起关」的既有行为都在注释里显式登记为「不修好」 |
| **`.vue` 侧 `<style>` 块** | 0 | 0 | 0 | ✅ K44 三处齐 |

🟡 **唯一一处措辞级不一致(Minor,不改)**:
`KFileViewer.vue:92` 的 fallback 按钮写 `@click="emit('download', props.file)"`(带 `props.` 前缀),
而另两个文件模板里一律用裸 `file` / `openFile`。**行为完全相同**(`<script setup>` 模板里 `file` 与 `props.file` 同一对象),
且 `KFileViewer` 的注释(`:38`)已显式说明「发的是 `file`(整个 prop)而不是 `item`」——**是刻意点名 prop 来强调这条蓝本既知不一致**,不是笔误。**不构成缺陷。**

### A.2 🔴 K48 去重有没有留下第二份拷贝 —— 全 `src/` 自 grep

```
$ for fn in highlight fmtMtime relLevel relLabel; do grep -rn "function $fn|const $fn *=" --include='*.ts' --include='*.vue' src/ | grep -v '.test.ts'; done
```
| 函数 | 全 `src/` 定义处 | 判定 |
|---|---|---|
| `highlight` | **仅 1**:`util/searchAggregate.ts:255` | ✅ |
| `fmtMtime` | **仅 1**:`util/searchAggregate.ts:276` | ✅ |
| `relLevel` | **仅 1**:`util/searchAggregate.ts:289` | ✅ |
| `relLabel` | **仅 1**:`util/searchAggregate.ts:302` | ✅ |

⚠️ **同名近似函数 6 处,逐个核为「本期之前就存在、且不是同一函数」**(不是漏去重):
`MentionPopover.vue:223 highlight(name)`(单参,@ 提及面板)· `SemanticSearchCard.vue:125 highlightText` ·
`SearchDialog.vue:216 highlightParts`(返回 `Part[]` 不是字符串)· `SearchFileDrawer.vue:58 highlightText(text, terms)` ·
`SearchFullResults.vue:109 highlightText` · `mentionFormat.ts:56 highlightMatch`。
**自证**:`git diff --name-only ec6a000..5f1c396 | grep -c 'MentionPopover|SemanticSearchCard|SearchDialog|SearchFileDrawer|SearchFullResults|mentionFormat'` = **0** ⇒ 本期一个都没碰。
🔴 它们属**票 A / P2a-P2b 地盘**,与 K48 的去重对象(蓝本 `SearchView.vue:317-345` + `FileDetailDrawer.vue:199-217` 两份复制粘贴)是不同链路 ⇒ **K48 落地完整,零第二份拷贝。**

### A.3 🔴 本期新键死键核查 —— 54 键逐键独立重跑(不采信 T8 的 0)

口径 = 裁定 **R13-2** 的既定死键 grep(**排除 `src/i18n/` 与 `*.test.ts`**):
```
grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
```
**取键法**:`git diff ec6a000..5f1c396 -- src/i18n/zh_cn.ts | grep '^+' | grep -oP "^\+\s*(\w+):"` ⇒ **54 键**(与「54 新键」口径吻合);
同法查删除行 ⇒ **恰好 1 个:`aiCfgKnowledgeSoon`**(D-9,与 T1 报告一致)。

🔴 **结果:`DEAD COUNT = 0`,54/54 全部有非 i18n / 非测试的真实消费点。** 逐键落点已全量打印(见下摘要):
- **16 键 → `FileDetailDrawer.vue`** · **1 键 → `KFileViewer.vue`**(`aiKbFvUnsupported`)
- **33 键 → `SearchView.vue`** · **4 键 → `searchAggregate.ts`**(`aiKbSrRelHigh/Mid/Low` + `aiKbSrUntitled`)
- **4 键双消费**:`aiKbFdDownload`(Drawer+Viewer)· `aiKbSrMatchTitle` / `aiKbSrModified` / `aiKbSrSimilarity`(Drawer+SearchView)

🔴 **间接消费逐条读源码坐实(不推断)**:
| 间接族 | 键 | 我读到的两端 |
|---|---|---|
| `MTIMES[].label` | `aiKbSrMtimeAny/Week/Month/Year` | 声明端 `SearchView.vue:87-92`(键名当字符串存进数组)· 消费端 `:414` `{{ t(m.label) }}` |
| `SAMPLE_QUERIES` | `aiKbSampleThyroid/PythonAsync/Contract/Iphone/Skating` | 声明端 `:57-63` · 消费端 `:470` `@click="quickSearch(t(s))"` + `:471` `{{ t(s) }}`(**双重渲染**:按钮文案与填入搜索框的值都是译文) |
| `relLabel` 三档 | `aiKbSrRelHigh/Mid/Low` | `searchAggregate.ts:303-305` `i18n.global.t(...)`(非 setup 上下文 ⇒ 不用 `useI18n()`,先例 `notesViewHelpers.ts`) |
| `fileVM` 兜底 | `aiKbSrUntitled` | `searchAggregate.ts:186` `basename(fullPath) || i18n.global.t('aiKbSrUntitled')` |

🟢 **`aiKbSample*` 5 键不在本期 54 新键里** —— 自查 `git show ec6a000:src/i18n/zh_cn.ts | grep -c aiKbSample` = **5**,
即它们是 **P5a 仪表盘已落地的复用键**。⇒ **54 新 + 9 复用 = 63 distinct**,与 `p5-master-plan.md` §3 的 63 终值算式吻合。✅

### A.4 三个新 `.vue` 是否都进 `KNOWLEDGE_VUE_FILES` + 该清单有没有防漂移集合相等断言

- `knowledgeStyles.test.ts:1416-1433` 的 `KNOWLEDGE_VUE_FILES` **16 项**,三个新文件全在(`components/FileDetailDrawer.vue` / `components/KFileViewer.vue` / `views/SearchView.vue`)。
- 防漂移断言 = `:1579` `expect(listVueFiles(kbDir)).toEqual([...KNOWLEDGE_VUE_FILES].sort())` —— **真实目录递归列举 vs 常量,`toEqual` 于排序后数组 = 双向集合相等**。
- 🔴 **我自跑探针 F7 证明它有牙**:从常量里删掉 `'views/SearchView.vue'` 一行(md5 `ffd93d07…` → `3a31ea2a…`,注入已落盘并贴出)⇒ `knowledgeStyles.test.ts` **1 failed / 351 passed**。还原后 md5 复原 `ffd93d07…`。
  ⚠️ 该断言按构造是**对称**的(排序后数组比对),故「常量少一项」与「目录多一个未登记 `.vue`」走同一条比较 ⇒ 一次注入即证两向。**不是空壳。**

### A.5 `import` 路径一致性

- 🔴 **全 `src/` `from '@/'` 命中 = 0**(自跑 `grep -rn "from '@/" --include='*.ts' --include='*.vue' src/ | wc -l`)⇒ 本仓确实无别名先例。
- 四个新文件的 import 全为相对路径:`'../components/…'` / `'./KIcon.vue'` / `'../util/searchAggregate'` / `'../../../files/viewers/…'` / `'../../../i18n'`,**零混用**。✅

---

## §C. 🔴🔴 「产品代码对、守卫为零」最后一遍扫 —— 找到第 9~11 个缺口

**扫法**:先读八份逐刀评审的探针清单(T5 三条 · T6 七类 · T7 十组 · T8 三组),**排除全部已做过的变异**;
再对「后果隐蔽 + 机械可核 + 本机不可达」的交集自选 7 组新变异。全部 `cp` 副本 + python 锚定注入 +
**先证注入落盘**(打印 md5 变化 + grep 出改后行)+ 跑 `pnpm exec vitest run src/ai src/styles src/i18n --reporter=dot`
(**121 文件 / 3125 例**,涵盖一切可能的守卫落点)+ 副本覆盖还原 + md5 逐字节比对。

| # | 变异(全部为本终审自选,与八份评审零重叠) | 结果 | 判定 |
|---|---|---|---|
| **F1** | `SearchView.vue:224` `rerank: quality.value === 'accurate'` → **`=== 'fast'`**(把质量档整个反过来) | 🔴 **3125/3125 全绿** | **缺口(新)** |
| **F2** | `SearchView.vue:223` `topK: topK.value` → **`topK: 10`**(topK 选择器彻底失效) | 🔴 **3125/3125 全绿** | **缺口(新)** |
| **F3** | `FileDetailDrawer.vue:120` `window: 2` → **`window: 7`**(chunk 上下文窗口大小) | 🔴 **3125/3125 全绿** | **缺口(新)** |
| **F4** | `knowledge.scss:462` 浅档 `--rtag-md: #1a1a1a` → **`#2b2b2b`**(只改浅档一处,更隐蔽) | ✅ **1 failed / 3124 passed** | 守卫**有牙**(R15-③/R17 已覆盖) |
| **F5** | `FileDetailDrawer.vue:134` `watch(activeId, () => fetchFull())` → **加 `{ immediate: true }`**(创建时双发) | ✅ **4 failed / 3121 passed** | 守卫**有牙**(且**破了 P5d 那条「watch 的 Object.is 去重让『不重复触发』用例零判别力」的教训** —— 这里是真有判别力的) |
| **F6** | `searchAggregate.ts:258` `highlight()` 的 `.filter((s) => s.length >= 1)` → **`>= 2`**(单字查询不再高亮) | 🔴 **3125/3125 全绿** | **缺口(新,Minor)** |
| **F7** | `knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES` 删掉 `'views/SearchView.vue'` | ✅ **1 failed / 351 passed** | 防漂移断言**有牙** |

### 🔴 第 9~11 个缺口(F1/F2/F3)的定性 —— 与前 8 次同一形态

**产品代码是对的,已逐字回蓝本坐实**(`git show 7a6ee6b7:src/views/AI/Knowledge/…`):
```
bp-SearchView.vue:301   topK: this.topK,
bp-SearchView.vue:302   rerank: this.quality === 'accurate',
bp-FileDetailDrawer.vue:153   fileId: this.file.id, kind: c.kind, chunkNo: c.chunkNo, window: 2,
```
⇒ **不是代码缺陷,是纯测试覆盖缺口。**

🔴 **为什么这三条特别危险(与 R15-③ 的立论同款)**:
`store.runSearch(...)` 的 payload 里,只有 **`query`**(`:778/818/833`)与 **`filters`**(`:614/629/658/682-699`)被断言过
—— 我自跑 `grep -n 'mock.calls' SearchView.test.ts` 全量列举,**`topK` / `rerank` 两个键在整份测试里一次都没被读过**;
`loadChunkContext` 的四个参数(`fileId`/`kind`/`chunkNo`/`window`)在 `FileDetailDrawer.test.ts` 里
**只被 `mockResolvedValue` 喂返回值,零 `toHaveBeenCalledWith` 检查实参**(自跑 grep 全量列举,该文件的
`toHaveBeenCalledWith` 只有 4 处,全是 `execCommand`/`writeText`/`distillFile`)。
⇒ **把「精确/快速」两档接反、把 topK 焊死成 10、把上下文窗口从 2 改成任意值,三门全绿、界面上也看不出**
(裁定 **R2** 已确认结果半区本机整体不可达 ⇒ **真机也看不出**)。**守卫是唯一防线,而它是零。**

### F6 的定性(Minor)
`highlight()` 的 term 最小长度是**蓝本 `SearchView.vue:332` 的 `s.length >= 1`**(逐字核过),
改成 `>= 2` 会让**所有单字符查询彻底不高亮** —— 中文场景里单字查询很常见。K49 那套 XSS 断言测的是
「先 escape 再插 `<mark>`」的顺序与转义面,**没有一条覆盖 term 长度阈值**。杀伤面纯视觉、不涉安全 ⇒ **Minor。**

### 探针还原确认
```
$ md5sum <5 个探针目标>
189df8a9d6397286672d99921387d2c0  src/ai/knowledge/views/SearchView.vue          ← 与首次落盘/T7 评审记录逐字节同
df5951f718129cb199c6205fc45acad4  src/ai/knowledge/components/FileDetailDrawer.vue ← 与 T5 评审记录逐字节同
a30da07adfc9acc609b2701a174f25ca  src/ai/styles/knowledge.scss                   ← 与 T8 评审记录逐字节同
3466dd7de6465ef2c2f2340add577a81  src/ai/knowledge/util/searchAggregate.ts
ffd93d0739d216d249a41d8fdfbfd656  src/ai/styles/knowledgeStyles.test.ts
$ git status --porcelain  → (空)
$ git rev-parse HEAD      → 5f1c39640a23255bb7c973b05986d14b5ffbfbc1
```
🟢 **附带交叉验证**:我在探针**开始前**取的三个基线 md5(`189df8a9…` / `df5951f7…` / `a30da07a…`)
与 T5/T7/T8 三份评审各自记录的还原值**逐字节相同** ⇒ **那三份评审的探针确实都还原干净了**,工作树自它们之后未被动过。
🔴 **全程零 `git checkout / restore / stash / commit / amend`;`git stash list` 那两条 master 线历史条目一个都没碰。**

---

## §E. 复核协调者本人的裁定(R1–R28)

> 🔴 口径:把裁定当**待检验对象**。凡它引的源码坐标我亲自打开;凡它引的实测我亲自重跑。

### E-R1 / K52(用户拍板方案 A)—— 🟢 **完全成立**

**我亲自读 `/home/nimo/NimoTech/NimoOS/route/v2.go` 的 `InitFile()`(绝对行 237-265)**:
```go
func InitFile() http.Handler {                             // :237
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    token := r.URL.Query().Get("token")                    // :239 ← 第一行就读 query
    if len(token) == 0 { … WriteHeader(401); …; return }    // :240-245 ← 读任何 header 之前就 401
    valid, _, errs := jwt.Validate(token, …)               // :247
    …
    disposition := "attachment"
    if r.URL.Query().Get("inline") == "1" { disposition = "inline" }  // :259-261 ← inline=1 真支持
```
| 裁定主张 | 我的独立核实 |
|---|---|
| 裸 `http.HandlerFunc`、零 JWT 中间件 | ✅ 成立(`http.HandlerFunc` 直返,函数体内自己校 token) |
| 第一行读 `?token=`,为空即 401、在读任何 header 之前 | ✅ 成立(`:239` → `:240`) |
| **全函数零处读 `Authorization`** | ✅ 成立(整个 `InitFile` 只读 `token`/`path`/`inline` 三个 query 参数,零 `r.Header`) |
| `inline=1` 后端真支持 | ✅ 成立(`:259-261`) |
| `getBytes()` 打 `/v1/file` 且 `return res.data` 丢 headers ⇒ 丢 `Content-Type` | ✅ 成立(`.sp8/NimoOS-Service/src/file.ts:52-58`:`http.get('/file', { params, responseType:'arraybuffer' })` → `return res.data as ArrayBuffer`) |
| `fileUrl(path)` = `/v3/file?token=…&path=…` | ✅ 成立(`file.ts:65-69`);⚠️ 我额外核到:**无 token 时 `tok` 为空串** ⇒ URL 变 `/v3/file?path=…`,`+ '&inline=1'` 仍是合法 query ⇒ **不会拼出畸形 URL**(裁定未提,但结论不受影响) |
| `withVersion()` 原样放行 `/v3/…` | ✅ 成立(`http.ts:6-10`:`if (/^\/v[1-9]/.test(url)) return url`,`v3` 命中) |

**四条落地判据是否真有牙 —— 我逐条读断言原文(`SearchView.test.ts:1098-1147`)**:
| 判据 | 断言原文 | 有牙? |
|---|---|---|
| ① `responseType:'blob'` | `expect(httpGet.mock.calls[0][1]).toEqual({ responseType: 'blob' })` —— **`toEqual` 精确对象**,改 `'arraybuffer'` 必红 | ✅ |
| ② 🔴 **`window.open` 实参不含 `token=` 的反向断言** | `:1116-1117` `expect(String(openedUrl)).toMatch(/^blob:/)` **+** `expect(String(openedUrl)).not.toContain('token=')` —— **反向断言确实在,不是只有正向** | ✅ |
| ③ `withVersion` 文档级证据 | 报告引源码,不写测试(见 **R28**) | ✅(见 E-R28) |
| ④ `inline` 两侧 | `:1140` `toContain('&inline=1')` / `:1144` `not.toContain('inline')` | ✅ |

🔴 **② 的判别力我另做了结构核验(防「mock 自证」)**:mock 是
`fileUrl = vi.fn(p => '/v3/file?token=TEST_TOKEN_ABC&path='+…)`(`:78`)、
`createObjectURLMock = vi.fn(() => 'blob:mock-url-N')`(`:304`)⇒ **两种 URL 形态可判别**
(一个带 `token=TEST_TOKEN_ABC`、一个以 `blob:` 开头),把产品改成直开 `fileUrl()` 会同时踩到
`toMatch(/^blob:/)` 与 `not.toContain('token=')` 两条。**不是安慰剂。**

🔴 **`getBytes` 零调用 —— 我自跑 `grep -rn 'getBytes' src/ai/` = 0 命中(整个 `src/ai/` 树)。** ✅

### E-R2(结果半区不列真机验收项)—— 🟢 **事实全部重现;范围划得基本对,但漏了两屏本机其实可验**

🔴 **我自己重测了全部四条事实(不采信 T0/协调者)**:
```
$ curl -s -X POST localhost:6333/collections/text_chunks/points/count -d '{"exact":true}'
  → {"result":{"count":5592}}                                             ← 总点数 5592 ✅
$ …filter root_ids ANY ["dfcd1840f5dab439cd9d7050aa5bafd0"]  → {"count":5592}  ← 全部 ✅
$ …filter root_ids ANY ["photos"]                            → {"count":0}     ← 零 ✅
$ curl -s http://127.0.0.1:37659/v1/nimoos/search-roots?user_id=1
  → {"root_ids":["photos"]}   HTTP=200                                    ← 只返虚拟根 ✅
```
⇒ **交集恒空、`warnings` 为空、界面上就是「没搜到」且无任何提示** —— 裁定的根因分析成立。
**我另加一层坐实**:`knowledgeStore.ts:550-561` 的 `runSearch` **只调 `service.ai.searchText`**
(零文件名源兜底、零结果合并)⇒ **结果半区在本机确实 100% 不可达,不是「也许能碰上」**。✅

🔴 **但「不列真机验收项」这个范围我判定 *划小了一点* —— 有两屏本机其实可验却没进保留清单(裁定 §2 只列了四类 + rail 导航)**:
| 漏掉的屏 | 为什么本机可达可点 |
|---|---|
| 🔴 **idle 态的 5 个示例查询 chip(`.k-suggest-chip`)** | `phase==='idle'` 是**进页面的默认态**,5 个 chip 无条件渲染(`SearchView.vue:470`,`v-for` 无 `v-if` 守卫)⇒ **真渲染成可点按钮**,点一下会 `quickSearch(t(s))` → 走到 `empty`。**而且它正是 E-52 那个「P5a 仪表盘 chip 缺全部基类」视觉缺陷在搜索页的第二个落点** —— R7 已要求验收清单保留「顺带看一眼仪表盘的 chip」,**搜索页这一处比仪表盘更该看**(本期刚补的基类首次在本页生效) |
| 🟡 **清除按钮(`.k-search-clear`)** | `v-if="q"`(`:374`),输入任意字即出现,点击走 `clear()` ⇒ **本机可达可点**,且 `clear()` 里有 N39 的两行(清 `openFile`/`viewerFile`) |
⇒ **§4 的审校要点里我把这两项列为「该补」。** 不影响 R2 的核心裁定(结果半区排除是对的)。

### E-R4 / E-53(461 vs 408 差异原因未查明、不影响本期、禁再追)—— 🟢 **结案可接受**

理由三条,我逐条核过:① 本期 i18n 的可执行依据是附录 A 的 **63 distinct**,而我在 §A.3 已**独立重算出
「54 新 + 9 复用 = 63」并逐键 grep 到零死键** ⇒ 461 这个数字**在本期任何一条判据里都不出现**,
结案不留悬空依赖;② 全表 1648/1648 + 双向差集空由我实测复现 ⇒ 数字侧无隐患;
③ 「不判勘误、也不声称已解释」的措辞**诚实**(既不掩盖也不虚构),优于强行给一个未验证的解释。
🔴 **且「禁再追」有先例支撑**(P5d 凭想象补不存在的问题烧 46 万 token)。**支持维持结案。**

### E-R7 / E-56(`.k-suggest-chip` 顺序 + 基类缺失)—— 🟢 **两半都成立**

- **前半(顺序反了不会级联反掉)**:我自读 `knowledge.scss` —— 基类 `.k-suggest-chip` 特异度 `(0,1,0)`
  vs P5a 那条后代覆盖 `.k2-suggest .k-suggest-chip` `(0,2,0)`,**覆盖只声明 `white-space`**;
  基类里**无 `white-space`** ⇒ **属性集不相交,顺序不影响渲染**。✅ 协调者自认写错、更正正确。
- **后半(基类缺失是 P5a 真实视觉缺陷)**:我核到 BASE 的 `knowledge.scss` **只有** `:2198` 那条
  `white-space` 覆盖(本期新增类清单里 `.k-suggest-chip` **不出现**,因为名字早就被那条覆盖占了),
  而蓝本 `DashboardView.vue` 与 `SearchView` 都在用 ⇒ **P5a 交付的仪表盘 chip 此前确实零基类样式**。✅
- **顺序断言改记为「移植忠实性」而非「防级联」** —— 判据仍在、价值定性正确。✅

### E-R8(三个数字)—— 🟢 **我自写模拟器逐个复现,并连 R8 那条「1 差的真因」一起坐实**

我把 `stripComments()`(`knowledgeStyles.test.ts:23-28`)与 `NEW_RE`(`:299`)**逐字复制**出来独立重跑:
```
NEW_RE 扫出类数 = 347                     ← 与 R8 的 347 吻合 ✅
WHITELIST_348 长度 = 348 | 去重后 = 348    ← 348 且零重复 ✅
NON_K_HELPER_CLASSES 长度 = 19            ← 19 ✅(P5d 的 16 + 本期 chev/path/h-md 三项)
扫出但不在白名单 = []                      ← 差集空 ✅
白名单有但扫不出 = ["knowledge-app"]       ← 🔴 那 1 差**恰好只有 knowledge-app**
```
🔴 **这正面证实了 R8 对附录 D §D.7.1 的订正**:1 差的真因是 **`NEW_RE` 的 `k(?:2|n)?-` 分支要求 `k`/`k2`/`kn` 后紧跟连字符,而 `knowledge-app` 是 `k`+`nowledge-app`**,不是附录写的「贪婪吃前缀」。✅

**TO-MOVE 我另用一条与 T0/评审都不同的路子复核**(比较 BASE 与 HEAD 的类集合,不看任何清单):
```
BASE 类数 = 292 → HEAD 类数 = 347;本期新增 55、删除 0
24 死类里被搬进来的 = 0   ← 🔴 master-plan §2.2 那个「整段搬会带进 18-24 个死类」的陷阱,零踩
```
⚠️ **口径提示(不是缺陷)**:我数出「新增 **55** 个 k* 类」而附录 D.1 的 TO-MOVE 是 **54** ——
差 1 是因为 `.k-suggest-chip` 这个**名字在 BASE 就已存在**(P5a 只搬了后代覆盖),
本期补的是它的**基类声明**而非新名字 ⇒ 集合法看不到它。**T2 评审自写的模拟器复现的也正是「55 类清单零差异」**,
与我一致。⇒ **54/55 纯台账口径差,硬不变量(347/348/19/差集空/死类 0)全部吻合。**

### E-R13 / T1b —— 🔴 **本终审补上这道缺失的独立评审:两条断言都真有判别力,注释与现状相符**

**T1b 是本期唯一无独立评审的刀(协调者本人实现 2 条断言)。我按评审标准重做一遍:**

**① R13 防复活守卫**(`messageSyntax.test.ts:1038-1040`)
```ts
it('the D-9 deleted key stays deleted in BOTH locales (parity alone cannot catch a two-locale resurrection)', () => {
  expect('aiCfgKnowledgeSoon' in zh).toBe(false)
  expect('aiCfgKnowledgeSoon' in en).toBe(false)
})
```
🔴 **我的独立探针(不照抄 T1b 的 sed,自写 python 正则锚定到「第一个 `aiCfg*` 键行之前」插入)**:
```
基线 md5:  9970eb90e3cb278dcbe0e718eb0742bf  zh_cn.ts   ← 与 T1b 报告记录逐字节相同
           a71c8de0606d315e4ed53ec04d4815b2  en_us.ts   ← 同上
注入落盘证明: zh_cn.ts:582  aiCfgKnowledgeSoon: 'PROBE-T1B-复活',
              en_us.ts:582  aiCfgKnowledgeSoon: 'PROBE-T1B-resurrect',
              md5 → de588ace… / 72813f66…(证明确实落盘)
$ pnpm exec vitest run src/i18n --reporter=verbose
  × … the D-9 deleted key stays deleted in BOTH locales …
  Test Files 1 failed | 2 passed (3)   /   Tests 1 failed | 91 passed (92)
```
⇒ **恰 1 例红,且正是这条守卫;`parity.test.ts` 所在文件仍绿** ⇒
**「两档同时复活逃得过 parity」这个前提我独立坐实了,守卫填的是真缺口、不是空转。** ✅

**② Minor-1 `singleN` 长度钉子**(`:1208-1210`)
🔴 我删掉 `singleN` 里的 `aiKbSrMatchPill` 一项(md5 变化已贴)⇒
`× … the { n } interpolation list still covers exactly the 5 single-placeholder keys` / `Tests 1 failed | 86 passed (87)`
⇒ **有判别力**(它防的正是「参数化清单被删一条 ⇒ 那个键的插值 `toBe` 静默消失而三门全绿」)。✅

**③ 注释与现状是否相符** —— 我逐行读 `:1027-1040` 与 `:1005-1021`:
- R13 块的注释准确复述了 R13 的推理与既定 grep 口径,**并明写「判据 = 两档同时加回也报红」+「a confirmed guard gap, not a hypothetical one」** ⇒ 与我实测一致。✅
- **D-9 自证口径我实跑验证仍成立**:
  `grep -rlw --include='*.vue' --include='*.ts' -e aiCfgKnowledgeSoon src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'`
  → **只有 `src/ai/views/SettingsPage.vue`**(全量命中仅 3 处:`SettingsPage.vue:187` 的注释 + 守卫那 2 行)。
  ⇒ **R13 声称的「两个目标零妥协同时成立」经我实测为真。** ✅
- 🟡 **一处 Minor(见 §D.3)**:`:1013-1014` T1 的原句「deliberately not named here so that D-9's `grep -rw` self-proof keeps hitting only SettingsPage.vue's history comment」按「反转不删」保留了,但**它给出的理由已被 R13 作废**,而作废说明在 **14 行之后**的另一个 `it` 前言里。字面仍真(那个块确实没点名),**不构成误导**,仅登记。

### E-R18 / E-R27(「brief 判据只是提示、不是权威」)—— 🟢 **口径正确;四次纠正逐条成立**

| 次 | 纠正内容 | 我的独立判定 |
|---|---|---|
| **E-61**(`kindFromMime` 顺序) | 我自读蓝本 `searchAggregate.js:7-8`:`includes('pdf')` 与 `=== 'text/markdown'`。对 `'text/markdown+docling/pdf'`,调换两支后**精确相等分支永不命中**(串带后缀)⇒ 仍返 `'pdf'`。🔴 **「调换→报红」确实无效** | ✅ 成立 |
| **T4 Esc 判据** | (T4 评审已实证) | ✅(结论落在 N41,与我读到的两文件同构实现一致) |
| **T5 两偏态** | (T5 评审已实证) | ✅ |
| **E-62 / toast 措辞** | 我自读 `knowledgeStore.ts:311-313` = `useToast().show(msg, 2400)`;全局 `show()` 默认 1500ms。直调 `useToast()` 会丢 2400 ⇒ **T7 走 `store.toast` 才对** | ✅ 成立。**且这条链是有守卫的**:`SearchView.test.ts:1366-1371` `vi.spyOn(store,'toast')` 钉住转发,`knowledgeStore.parser.test.ts:218-221` 钉住 `toHaveBeenCalledWith('已刷新', 2400)` ⇒ **2400 这个值本身有独立守卫,不是悬空** |
🔴 **口径本身我判为正确**:治理 §9 的「禁空转用例 / 无判别力断言必须 RED 验证」是**更强、更具体**的规定,
brief 的一句事实性判据在实测不成立时让位于它,是**执行治理而非违反**。**四次全部申报在案,零隐瞒。**

### E-R23(祖先链守卫是不是空壳)—— 🟢 **不是空壳。我另做一次与 T8 三次都不同的探针,精确报红**

**先核「是不是 `?raw` 恒空那种空壳」**:守卫读文件走 `readFileSync`(`knowledgeStyles.test.ts:18`
`const read = p => readFileSync(resolve(__dirname, p), 'utf8')`)⇒ **不是 `?raw`,不是空壳载体。** ✅
**再核防空转钉子**:第三条断言自带 `expect(blocks.length, 'theme.css 里一条 body/html 规则块都没扫到 …').toBeGreaterThan(0)` ⇒ **选择器写法变了会报红,不会静默扫零。** ✅
🔴 **我的独立探针(T8 三次都是 `transform`;我换属性 **和** 换落点)**:
```
往 theme.css:330 的裸 `body {` 规则里注入 `will-change: transform;`
md5 75f45f1b… → 33887846…(注入落盘已贴出改后 4 行)
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose
  × 祖先链守卫(R23)… > theme.css 的 body/html 自身声明零 transform/filter/will-change/contain/perspective …
  Tests 1 failed | 355 passed (356)     ← 恰 1 条红,另两条不受影响
还原 md5 = 75f45f1b1ef25c330f73934e891a15b3(逐字节一致)
```
🔴 **伪元素排除**是否「对着真有 transform/filter 的伪元素生效」(而非空转)——**我亲自核实**:
`theme.css:335 body::before` 块里真有 `filter: blur(46px)`(`:346`)与 `transform: translate(…)`(`:347`);
`:352 body::after` 同族。⇒ **排除逻辑面对的是真实内容,不是假想情形。** ✅
🔴 **我另核实了注释里那条前提**:`grep -rn '#app' --include='*.css' --include='*.scss' --include='*.vue' src/` = **零命中**
⇒ 「`#app` 全仓无样式规则」为真。⚠️ **残余缺口(Minor,转 P5f)**:守卫只钉 `.knowledge-app`/`.k-main`/`body`/`html`
四个选择器,**`#app` 不在扫描集里** —— 将来若有人给 `#app` 加 `transform`,K46 会静默破而本守卫不红。

### E-R25(T6 只 import 不挂载)—— 🟢 **成立,且在 HEAD 上零残留后果**

| 核查 | 我的独立结果 |
|---|---|
| 技术前提「`tsconfig.json` 没有 `noUnusedLocals`」 | ✅ 实跑 `grep -n 'noUnusedLocals\|strict' tsconfig.json` → **只有 `"strict": true`**,零 `noUnusedLocals` |
| T6 当时确实只 import 不挂载 | ✅ `git show 216c850:…/SearchView.vue` 里 `FileDetailDrawer` 有 import、**无 `KFileViewer` import**、模板零两个子组件 markup ⇒ **R25 三条落地要求(①申报注释 ②不 import KFileViewer ③不写 markup)当时全部满足** |
| 🔴 **有没有留下别的后果** | ✅ **零残留**:HEAD 上两个 import **都被模板真消费**(`SearchView.vue:556` `<FileDetailDrawer …>` / `:566` `<KFileViewer …>`)⇒ **HEAD 上不存在悬空 import**,tree-shake 问题在交付物上不成立;T7 已**同步删除**那段 `eslint-disable-next-line @typescript-eslint/no-unused-vars` 与「markup 归 T7」的临时申报注释(我自跑 `grep -rn 'eslint-disable' src/ai/knowledge/` = **零命中**)⇒ **没有留下一句过期的脚手架注释误导后人** |

### E-`p5-master-plan.md` §2 的 149 类归属 —— 🟢 **结构性结论成立(我用独立口径重测);绝对数字有口径差**

**我的独立测法**(不用他们任何脚本):抽蓝本 `7a6ee6b7:…/knowledge.scss`(2561 行)与
New-UI BASE / HEAD 三份的 `.class` token 集合,取差集。
```
蓝本 452 类 | New-UI BASE 310 | HEAD 368
蓝本有 / BASE 没有 = 151      (master-plan 记 149 —— 口径差,见下)
蓝本有 / HEAD 没有 =  96      (= 151 − 55,算术自洽 ✅)
```
🔴 **关键在于这 96 个残余的构成 —— 我逐个归类,与 §2.1 的预测完全对上**:
| 归类 | 我数到 | §2.1 预测 |
|---|---|---|
| ⛔ 24 死类(`k-hero*`7 + `k-stat*`5 + `k-quick*`6 + `k-progress*`6) | **24,一个不少** | 24 ✅ |
| ⛔ K3 不移植(`k-toast` / `k-toast-ico`) | **2** | 2 ✅ |
| 🔴 P5f Wiki(`kw-*`) | **41** | `:2453-2561` ✅ |
| 🔴 P5f Allowlist/Roots(`k-ext*`/`k-extgroup*`/`k-field*`/`k-frow*`/`k-radio*`/`k-section-body`/`k-custom-add`/`k-priority-hint`/`k-status-strip`/`cur`) | **29** | `:985-1160` + `:1342-1400` ✅ |
🔴 **最要紧的结论:残余里 *零个* 属于 P5e。** 我逐族点名核过 —— `.k-search-*` / `.k-adv-*`(含 `.chev`)/
`.k-rcard-*` / `.k-rel*` / `.k-chunk-*` / `.k-drawer-*` / `.k-fileviewer-*` / `.k-match-pill` / `.k-more-hint` /
`.k-results` / `.k-result-count` / `.k-skel-rcard` / `.k-hero-suggest` / `.k-rerank-warn` / `.k-suggest-chip` /
`.path` / `.h-md` **全部在 HEAD 里**;而 §2.3 明令「P5f 搬」的 `.k-section-body` / `.k-frow` **正确地仍缺**,
「先搬者得」的 `.k-adv-toggle` / `.chev` **正确地已搬**。⇒ **§2 的归属实测在方向与逐族分配上完全可信。**
⚠️ **149 vs 151 / 67 vs 70 的绝对数差**源于选择器提取正则不同(他们数「693 处声明去重」,我数 `.class` token),
**属口径差、非错误** —— 且 R8/E-55 已明令「52/53/54/55 只是台账口径,一律以附录 D 为核对基准」。

### E-R11 / §F-4 —— 🔴 **`--amend` 事故独立核损:零内容丢失,确认**

不采信自首报告也不采信协调者核损表,我自跑:
```
$ git cat-file -t 28d6185                → commit                     ← 未丢,仍可达
$ git rev-parse 28d6185^  → 40c98e04f0e663362fa2f6bfa0fcd8466461bd30
$ git rev-parse 57fdd3a^  → 40c98e04f0e663362fa2f6bfa0fcd8466461bd30  ← 父提交同为 40c98e0 ✅
$ git diff --name-status 28d6185 57fdd3a → M  .superpowers/sdd/p5e-task-1-report.md   ← **只有这一个文件**
$ git diff --stat        28d6185 57fdd3a → 1 file changed, 13 insertions(+)           ← **+13 / −0,零删除行**
$ diff <(git log -1 --format='%s%n%b' 28d6185) <(…57fdd3a) → IDENTICAL SUBJECT+BODY   ← 提交信息逐字同
$ git rev-parse 28d6185:.superpowers/sdd/p5e-coordinator-rulings-T0.md
$ git rev-parse 57fdd3a:.superpowers/sdd/p5e-coordinator-rulings-T0.md
    两者均 = 6e787af43902b75f743e9a464404fb8dc1eec9e0                  ← 裁定文件 blob 同一 ✅
$ git reflog --all | grep -c 28d6185  → 2                              ← reflog 仍持有
```
🔴 **我另把那 13 行读了一遍**(不只数行数):是 T1 报告新增的 **§11.5「并发 agent 提交 `973a9b8` 与本刀的关系」**
表格 —— **纯文档追加,零产品码、零断言、零结论改写**。
⇒ **R11「零内容丢失,只是历史形态与 sha 变了」独立核损成立。不修的裁定我支持**(修它要 `reset`/`rebase`,
为零损失的瑕疵冒真损失的风险 = 净负值)。**`28d6185 == 57fdd3a`(后者多 13 行)的 sha 映射准确。**

---

## §F. 四条降级知情项的复查

| # | 偏离 | 我的复查结论 |
|---|---|---|
| **1** | 唯一 **sonnet 实现**(T3) | 🟢 **加一档审视后仍通过**,见下方专节 |
| **2** | 唯一 **sonnet 评审**(T3,与 1 同刀 = 双重降级) | 🟢 **协调者的第三道抽验三项我全部独立复现**(见下),且我另加一条判别力探针 |
| **3** | 唯一 **无独立评审**(T1b) | 🟢 **本终审已补这道评审**,两条断言各自 RED 成功,见 §E-R13 |
| **4** | 唯一被 `--amend` 改写过历史的提交 | 🟢 **独立核损完成,零内容丢失**,见 §E-R11 |

### F.1/F.2 —— T3 双重降级刀的加档审视(`searchAggregate.{ts,test.ts}`)

**① 逐行对蓝本(我自己 `git show 7a6ee6b7:src/views/AI/Knowledge/searchAggregate.js` 全文读完,79 行)**:
`kindFromMime` / `basename` / `dirname` / `chunkVM` / `fileVM` / `groupHits` / `toFileResults` / `chunkCount`
**八个函数逐语句、逐运算符、逐兜底与蓝本相同**,无一处「顺手改好」。逐个点名核过的高危处:
| 高危处 | 蓝本 | 本仓 | 判定 |
|---|---|---|---|
| `chunkVM.id` 拼法(T5 的 `activeId` 比对键) | `:32` `` `${fileId}:${kind}:${chunkNo}` `` | `:154` **逐字相同** | ✅(协调者抽验项 2 复现) |
| `page: 0` 会不会被 `\|\|` 吞 | `:35` `cite.page != null ? cite.page : null` | `:157` **逐字相同** | ✅(抽验项 3 复现) |
| `chunk_no` 用 `typeof === 'number'` | `:30` | `:152` 逐字相同 | ✅ |
| `score` 三档兜底链 | `:52` `group.score \|\| (group.chunks && group.chunks[0] && group.chunks[0].score) \|\| 0` | `:192` **逐字相同** | ✅ |
| `groupHits` 保序 + 取首 chunk score | `:63` | `:210` 逐字相同 | ✅ |
| `toFileResults` 的 `files` 优先判据 | `:73` `(resp.files && resp.files.length)` | `:227` 逐字相同 | ✅ |
| K48 四函数(源自两个 `.vue`) | `bp-SearchView.vue:317-346` | `:255-306` **逐字**(仅 `0.50`→`0.5` 的等价写法,已申报) | ✅ |

**② K41 零 `any`** —— 我自跑 `grep -nE ': any\b|as any|<any>' searchAggregate.ts` = **0 命中**(协调者抽验项 1 复现)。✅

**③ 代码膨胀逐行判定(计划书给 T3 评审的第一必查项,我重做)**:
```
本仓真代码行(去注释/空行) = 161      蓝本 searchAggregate.js 真代码行 = 68
```
膨胀 **+93 行**,我逐块归因:**6 个后端原始响应体窄 interface(≈45 行)+ `ChunkVM`/`FileVM` 两个出参
interface(≈20 行)+ `RelLevel` 类型 + `HTML_ESCAPE_MAP`(6 行)** = 约 72 行**全部是 K41「零 any」
硬性要求的类型声明**;余下约 21 行 = 从两个 `.vue` 搬来的 K48 四函数本体。
⇒ 🔴 **零「顺手抽的抽象」、零与需求无关的重构、零 helper 泛化。膨胀 100% 可归因,是治理逼出来的,不是镀金。**
(唯一一处⑥类整理 = `HTML_ESCAPE_MAP` 提取,**已由 R22 追认并登记**,我核为零行为变化。)

**④ 我另加一条判别力探针(验 R21 那条补进来的用例是否真有牙 —— 它是 T4 实现的、评价 T3 的缺口)**:
```
往 groupHits 注入「取最高分」逻辑:else if ((h.score||0) > (byId[…].score||0)) byId[…].score = h.score
md5 3466dd7d… → 20b2c5c4…(注入落盘已贴改后 13 行)
$ pnpm exec vitest run …/searchAggregate.test.ts --reporter=verbose
  × … 🔴 档 1(变体·构造样本)— 首 chunk 分数低于后续 chunk 时,fileVM.score 仍取首 chunk …
  Tests 1 failed | 74 passed (75)     ← 恰 1 条红,正是 R21 补的那条
还原 md5 = 3466dd7de6465ef2c2f2340add577a81(逐字节一致)
```
⇒ **R21 的补位有效,T3 那个「取首 chunk 零判别力」的缺口已真正填上。** ✅
**⑤ 出处标签**:测试文件里 `.REAL`/`.REPLAYED`/`.CONSTRUCTED`/`构造样本` 标签 **25 处**,R3 约束 1 与 R21 Minor-2 均已落实。✅

🔴 **结论:T3 的双重降级未造成质量损失。** 我把它当「最可疑的一刀」加档看完,零 Critical、零 Important。

---

## §D. 债务与遗留项完整性

### D.1 本期新开/并入的票是否齐全且有落点

| 票 | 内容 | 落点(我自跑 `git grep` 定位) | 判定 |
|---|---|---|---|
| **票 A** | Agent 语义搜索卡补 `notes` 分组 | `docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md` §1(**进 git**) | ✅ |
| **票 B** | `color-guard` 盲区收口 | 同上 §1(含 D-5/D-7/§0.3 位置③④ 四个缺口 + 修法留痕 + **「只改一半会从空壳变成大面积误报」** 的关键警告) | ✅ |
| **票 C(新)** | 搜索链路授权根缺失 | 🟡 **只在 `.superpowers/sdd/p5e-coordinator-rulings-T0.md` §三** | 见下 |
| **票 D(新)** | Parser rerank 端点 500 | 🟡 同上 | 见下 |
| **K52 的 token 进访问日志** | 并入既有「终端 WS token 进访问日志」后端票,不新开 | 同上 §三 + `SearchView.vue:27` 文件头注释 | ✅ |
| **A-1/A-2/A-3** | 合 master 时写 roadmap 与上级设计 | 同上 §0(含「执行时机 = 合 master 那一刻」) | 见下 |

🟢 **先说好消息:台账真的进了 git。** 我自跑 `git ls-files .superpowers/ | wc -l` = **218**;
`.gitignore:6` 仍写着 `.superpowers/`,但全部台账都被 `git add -f` 强制跟踪、且 `git diff HEAD -- .superpowers/` 为空
⇒ **裁定书/附录/九份报告/八份评审/31 个 fixture 全部在 HEAD tree 里,合并时不会丢**
(逐个核过,**唯一未跟踪的 p5e 文件就是我这份 `p5e-FINAL-review.md`** —— 按指示由协调者 `git add -f`)。
⇒ **P5d「30 个文件从未被跟踪」与 SP7「整目录消失」的向量,本期已闭合。** ✅

🔴 **Important-1 —— 但唯一自称「跨出 P5 范围、需长期存活、跟着合并走」的那份进-`docs/` 文档,漏了本期三件事**:
`docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md` 本期的 diff **只有一处**(E-56 订正,+10/−2,我自跑 `git diff` 全量核过),于是:
| # | 现状 | 应然(按裁定) |
|---|---|---|
| a | §1 **只有票 A / 票 B**;§0 的 **A-1 原文写「把 §1 的两张独立票登记进 roadmap」** | 🔴 **票 C / 票 D 不在 §1** ⇒ 一个只读这份 in-git 文档去执行 A-1 的人,**会登记两张、漏掉两张** |
| b | §3 的 **前置①** 仍写「首次调用 **约 16.7 s / ~2.8 GB** → **验收清单必须写这个时限**」 | 🔴 **与 R5 直接冲突** —— R5 实测**热态 5.04 s / Parser RSS 仅 +19 MB**,并明令「**必须写条件句,不许写死约 17 秒**」。这句会把下一个写清单的人直接引向被禁止的写法 |
| c | §3 的 **前置②** 仍把 distill 框成「真机可能恒 404,必须由 T0 实测坐实」 | 🔴 **与 R6 冲突** —— 接口**已通**(E-58 实测坐实),不可达的真因是「**元素不渲染**(7 个索引文件全 `.log`/`.json`,不在 `DISTILL_EXTS`)」。R6 明令「两个理由的区别要写清,否则将来有人以为是后端问题」 |
| d | §3 的 **E-53 行** 仍写「大概率只是扫法差异…**由 P5e-T0 用同口径复扫并给终值**」 | 🟡 R4 定案是「T0 的同口径复扫**并未成立**、**没有任何口径能扫出 461**、**原因未查明**、不判勘误也不声称已解释、**禁再追**」⇒ 文档仍在承诺一个从未兑现的「终值」,可能诱使后人再去追(正是 R4 明禁的) |
⚠️ **不是内容丢失**(a–d 的正确版本都在 tracked 的裁定书里),**是「哪份文档说了算」的错位** ——
该文档自己的头注写着「**在那之前本文件即唯一登记处**」。⇒ **合 master 前必须把 a–d 四处补/订正**,成本约 20 行。

### D.2 转 P5f 的交接项是否写清

**逐项自查落点(我 `grep -rl` 全台账 + `docs/`)**:
| 交接项 | 落点 | 判定 |
|---|---|---|
| `.k-adv-toggle`/`.chev` 「先搬者得,P5f 不许重复搬」 | `cross-area-impacts.md` §2.4(**进 git**)+ 附录 D + plan | ✅ 且**我实测已搬**(在 HEAD 类集合里) |
| `.k-section-body`/`.k-frow`(P5f 搬) | 同上 §2.4 + master-plan §2.3 | ✅ 且**我实测仍缺**(正确留给 P5f) |
| **24 死类清单** | `master-plan §2.2` + `knowledgeStyles.test.ts` 的死类断言数组(**产品测试里也有一份,最硬**) | ✅ 且**我实测 0 个被搬进来** |
| `openNoteInNewTab` / 票 3c / 票 3e / D-4 / D-6 / A-8 / clipboard 票 | `p5e-plan.md` + `p5e-common-constraints.md`(均 tracked) | ✅ 有落点 |
| **`DEFERRED_TABS` 剩 3 项归 P5f** | 🔴 **落在产品源码里** —— `deferred.ts:24-32` 的第五次「反转不删」历史块逐项点名 `'wiki'/'roots'/'allowlist' → P5f`,并重申「K7 机制本身不变(承 P4 I2)」 | ✅ **最佳落点**(源码里的交接单不会随台账丢) |
| **P5f 整段搬陷阱**(`.k-progress-*` 压在 `:985-1160` 段尾) | `cross-area-impacts.md` §2.4(进 git) | ✅ |

🔴 **Important-2 —— 缺一份 `p5e-handoff-to-p5f.md`。**
P5d 交付了 `p5d-handoff-to-p5e-p5f.md`(本期的必读清单第 6 项就靠它),而 **P5e 没有同类文件**
(`ls .superpowers/sdd/ | grep -i handoff` → **只有 p5d 那一份**),且 **`p5e-plan.md` §2「收官后的协调者动作」四条里也没列这一项**。
后果:P5f 的开工者要从 **12 个** 台账文件里拼出交接面(我自跑 `grep -rln 'P5f' .superpowers/sdd/p5e-*.md` = 12 个文件命中)。
⇒ **建议收官时补一份**,内容全部现成(把上表 + §D.1 的 a–d + §C 的 F1/F2/F3/F6 缺口 + R23 的 `#app` 残余缺口汇总即可)。

### D.3 🔴 「反转不删」注释与现状是否相符 —— 逐处核

| 文件 | 我读到的 | 判定 |
|---|---|---|
| **`deferred.ts:1-32`** | 五次反转逐条留痕(queue / indexed-files / settings / notes / **search**),`DEFERRED_TABS` 4→3 与代码实际(`:44-48` 三项)**一致**;逐项点名剩下 3 个归 P5f;K7 机制保留的理由(P4 I2)重申 | ✅ **零误导** |
| **`knowledgeRoutes.ts`** | `:91` `{ path:'search', name:'KnowledgeSearch', component: SearchView }` 已反转;我核到九个子路由里**只剩 wiki/roots/allowlist 三个指 `KnowledgeDeferred`**,与 `DEFERRED_TABS` 三项**逐项对齐** | ✅ 一致 |
| **`knowledgeRoutes.test.ts` / `deferred.test.ts`** | 机制钉子用例本体未动(T8 评审已 diff 核过,我复核其 diff 结论:两条机制用例在 `590c026..HEAD` 里零命中);新增 `expect(isDeferred('search')).toBe(false)` 正向断言 | ✅ 「反转 + 加断言、不删断言」模具第五次一致 |
| **`SettingsView.test.ts`**(D-3 位点) | 旧 `toHaveLength(1595)` 两行留成注释 + 引条目编号(R15/E-43)**不引 `file:line`**;现行是 `toBeGreaterThanOrEqual` | ✅ 且**我核到本期只改了 2 行**,该文件的「全期零改动」豁免范围最小 |
| **`SettingsPage.vue:187`** | `// toast.show(t('aiCfgKnowledgeSoon'))` 历史注释保留;本期 `+2` 行补「该键已删」说明 | ✅ 且**我实跑 D-9 自证口径**:该文件是**唯一**非 i18n/非测试命中 |
| 🟡 **`messageSyntax.test.ts:1013-1014`** | T1 原句「deliberately not named here so that D-9's `grep -rw` self-proof keeps hitting only SettingsPage.vue's history comment」保留了,但**它给出的理由已被 R13 作废**(R13 放宽口径后,写在 `.test.ts` 里不影响自证),而作废说明在 **14 行之后**另一个 `it` 的前言里 | 🟡 **Minor-1**:字面仍真(那个块确实没点名该键),**不构成误导**;但严格讲这是一处「理由已过期而原句未加订正标记」的留痕。**建议**:在 `:1014` 那句后加一句 `(理由已被 R13 作废,见下方 R13 块)`。**不阻塞交付。** |

---

## §4. 🔴 验收清单(`p5e-acceptance-checklist.md`)的审校意见

> 🔴 **写清单前先看这一条**:`p5e-plan.md` §2-3 那份清单要求**已被裁定覆盖两处**,按权威顺序
> (**裁定书 > plan**)必须照裁定写,**不许照 plan 的字面**:
> - plan 写「**§9.11 的 11 项可点性逐个照抄**」→ **R2 已把其中 7 项整体移除**,只剩 4 项。
> - plan 写「**第一次搜索约等 17 秒**」→ **R5 已订正成条件句**(见下第 4 条)。

### 4.1 第一项:导航路径(治理 §13 铁律)

**我实测过的真实路径与 URL**(`src/router/index.ts:36-37` + `knowledgeRoutes.ts:87-99` + `KnowledgeLayout.vue:55-63`):
```
① /ai/settings 顶栏「详情」(router-link,P5d-T9 反转)
② → /ai/knowledge(落 DashboardView,rail 第 1 项)
③ → 左栏 rail 第 2 项「搜索」(rail 共 9 项:dashboard/search/wiki/notes/indexed-files/queue/roots/allowlist/settings
   ⇒ 「搜索」确实是第 2 项 ✅)→ 路由 /ai/knowledge/search(name: KnowledgeSearch)
```
🔴 **`?q=` 深链要给可直接粘贴的 URL**(hash 路由 + `vite.config.ts:30` `base: '/app/'`,验收 dev server 实测在 `:5288` LISTEN):
```
http://<设备IP>:5288/app/#/ai/knowledge/search?q=甲状腺
```
⚠️ 并提示机主:**改地址栏的 `?q=` 不刷新页面也要重新搜**(N40 的 `watch` 而非 `onMounted`,
承记忆 `newui-router-query-only-no-remount`)—— 这是一条**本机可验且有真实回归史**的项,值得列。

### 4.2 🔴 哪些项该留、哪些该删(治理 §9.11 的 11 项 + R2)

**该留(本机数据下我已逐项确认元素真渲染成可点/可见)**:
| 项 | 我确认可达的依据 |
|---|---|
| `idle` 态(标题/副标题/「试试」) | `phase` 初值 `'idle'`(`SearchView.vue:110`),进页面即是 |
| 🔴 **5 个示例查询 chip**(`.k-suggest-chip`) | `:470` `v-for` **无 `v-if` 守卫** ⇒ 无条件渲染成 `<button>`,点击走 `quickSearch(t(s))`。**R2 的保留清单漏了它** |
| 🔴 **清除按钮**(`.k-search-clear`) | `:374` `v-if="q"` ⇒ 输入任意字符即出现。**R2 的保留清单也漏了它** |
| 搜索按钮的禁用态 | `:377` `:disabled="!q.trim()"` |
| `loading` 骨架(6 张 `.k-skel-rcard`) | 首搜等待期间必现 |
| `empty`(无结果 + 三条 tip) | **本机 100% 的真机路径**(我实测 Qdrant 交集恒空) |
| `error` 态 | 可制造(如临时断 Parser);列为「选做」即可 |
| **高级面板**(点 `.k-adv-toggle`)+ 四组控件 + 「· 已启用」指示 | `advOpen` 本地 ref,无后端依赖 |
| **筛选真生效** | 可从「取消勾选某类型 → 再搜」观察请求变化(界面上仍是 empty,故只作为「不报错」项) |
| `?q=` 深链 + 改地址栏重搜 | 见 4.1 |
| 🔴 **顺带看仪表盘的建议 chip**(E-52 / R7) | 保留;**并建议同时看搜索页 idle 的同一批 chip** —— 本期补的基类在这两处首次生效,搜索页那处更显眼 |

**该删(R2 已裁定移除,我独立复核确认本机 100% 不可达)**:
结果卡 · 五个类型色标签 · 相关度徽标 · 「还有 N 段」· 详情抽屉 · chunk 列表 · chunk 阅读器 ·
「沉淀成笔记」· in-app 预览器 · 「打开原文件」· 「下载」· 「复制内容」· rerank 警示条 · **按 Esc 关闭**(需先有抽屉/预览器)。
🔴 **删的同时必须写明原因**(见 4.4-⑤)。

### 4.3 计数的保质期

清单里凡出现具体数字(测试例数 / 键数 / 类数),必须写:
> **实测于 2026-08-05,数字会漂,以下列命令现测为准。**

并附我本人用过的取数命令(逐条都跑过):
```bash
pnpm test --reporter=verbose | grep -E '^ *(Test Files|Tests)'       # 335 / 4254
find src -name '*.vue' | wc -l                                        # 185
pnpm exec vitest run src/styles/color-guard.test.ts | grep '^ *Tests' # 187
cp src/i18n/zh_cn.ts /tmp/zh.mjs && cp src/i18n/en_us.ts /tmp/en.mjs
node --input-type=module -e "import zh from '/tmp/zh.mjs';import en from '/tmp/en.mjs';
  console.log(Object.keys(zh).length, Object.keys(en).length,
  Object.keys(zh).filter(k=>k.startsWith('aiKb')).length)"            # 1648 1648 441
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null # exit 0
```
🔴 **别把数字钉进清单正文当验收条件** —— 机主看到的是界面,数字是给复核者的。

### 4.4 必须主动告知的四条(逐条给可直接抄的措辞)

**① 第一次搜索的耗时 —— 必须写条件句(R5)**
> 「如果 Parser 刚重启过,**第一次**搜索可能要等十几秒(它要把语义模型 BGE-M3 加载进内存),
> **这不是卡死**,期间会看到 6 条灰色骨架条在转;已经热起来的进程约 **5 秒内**返回,之后每次都在 1 秒内。」

🔴 **不许写死「约 17 秒」**(上级设计那个 16.7 s / 2.8 GB 对应**冷进程**;协调者 T0 实测**热态 5.04 s**、Parser RSS 只涨 19 MB)。
🔴 **也不许因为实测 5 秒就删掉这一条** —— 机主的设备随时可能是冷进程。

**② 按 Esc 会同时关掉 in-app 预览与详情抽屉(N41)**
> 「两个弹层各自独立监听 Esc,**同时开着时按一次 Esc 会一起关掉**。这是旧版就有的行为,**照抄没改**。」

⚠️ **我建议加一句实话**:「本机数据下这两个弹层打不开(见第 ⑤ 条),所以**这条只是提前告知,不用点**。」
—— 否则机主会去找一个点不到的东西(治理 §9.11 的经典栽点,P5b 的 B18/B19 各栽一次)。

**③ `.k-rcard-tag` 的文件类型色 —— 🔴 MD 与 TXT 都要列(R17/Minor-2)**
> 「结果卡左侧有个文件类型标签,五种底色照抄旧版:PDF 红 `#FF3B30` / **MD 深黑 `#1a1a1a`** /
> DOC 蓝 `#007AFF` / **TXT 绿底白字(对比度约 2.2:1,偏低)** / Code 紫 `#AF52DE`。
> **本机数据下看不到**,留待将来有真实索引后请你看实物拍板。」

🔴 **措辞按 R15-③ 的「本机看不到,留待将来有真实索引后拍板」,不许因为不可达就把拍板项删掉。**
🔴 **必须把 TXT 和 MD 一起写** —— 本机 7 个索引文件 mime 全是 `text/plain`
⇒ **TXT 是票 C 修好后第一个会出现的颜色**,比 MD 更早需要人眼拍板;只点 MD 会让机主只盯 MD。

**④ distill(沉淀成笔记)按钮 —— 不列真机验收项,理由必须写「元素不渲染」(R6)**
> 「详情抽屉里的『沉淀成笔记』按钮**本次不验**。原因是**这个按钮在本机根本不会渲染出来**:
> 它只对特定扩展名(`DISTILL_EXTS`)的文件出现,而本机已收录的 7 个文件全是 `.log`/`.json`。
> **后端接口是通的**(2026-08-05 实测三条 GET 全 200)—— 不是接口问题。」

🔴 **两个理由的区别必须写清**(R6 明令):写成「接口不通」会让将来有人去查后端,**而后端是好的**。
🔴 **原 plan §2-3 写「通则标红 + 写『验完去笔记区把那条草稿删掉』」—— 这半句要删**(按钮不渲染,不存在草稿)。

### 4.5 🔴 第五条(我建议补,不在原四条里)—— 结果半区不可达的原因

> 「**你搜任何词都会看到『没有找到相关内容』,这是正常的、不是这次做坏了。**
> 原因在后端:设备上 5592 个语义向量全部登记在一个索引根下,而**授权表里只有一个虚拟根 `photos`**,
> 两边**交集恒为空**,所以后端每次都返回 0 条结果、且**不给任何警告**。
> 根子是 **Wiki 服务打不通**(它才是往授权表写记录的那一方)—— 已开后端票『搜索链路授权根缺失』(**票 C**),
> 建议和 Wiki 数据库运维票一起做。**这是 D1 政策的连带后果,不是前端缺陷。**」

🔴 **不写这条,机主必然把「搜不到」当 bug 报**(R2 第 2 条已明令要写,我把它单列成第 5 条以免被当成①的附注)。
**建议同时附我实测的三行证据**,机主可自己复现:
```bash
curl -s -X POST localhost:6333/collections/text_chunks/points/count -d '{"exact":true}'          # 5592
curl -s -X POST localhost:6333/collections/text_chunks/points/count \
  -H 'Content-Type: application/json' -d '{"exact":true,"filter":{"must":[{"key":"root_ids","match":{"any":["photos"]}}]}}'   # 0
curl -s "http://127.0.0.1:$(cat /var/run/nimoos/nimoos.url | sed 's|.*:||')/v1/nimoos/search-roots?user_id=1"                 # {"root_ids":["photos"]}
```
⚠️ **另建议提一句票 D**:`POST :8283/v1/parser/rerank` 实测 500(`transformers`/`FlagEmbedding` 版本不兼容)
⇒ 高级面板里选「精确」**在本机不会有额外效果也不会报错**(`search.go:176` 的 `req.Rerank && len(hits)>0` 恒不进)。
否则机主点了「精确」发现毫无变化会以为开关坏了。

---

## §G. 结论

### G.1 总判定

🟢 **可以交付用户验收。零 Critical、零阻塞项。**

三个新增的守卫缺口(§C 的 F1/F2/F3)与两条文档项(§D 的 Important-1/2)**都不影响机主这一轮能看到的任何一屏**
—— 它们保护的是**将来**不被静默改坏,以及**合并时**不漏登记。按本档一贯口径,
「产品代码对、守卫为零」历来记 **Important 而非 Critical**(前 8 次全部如此,R16/R21/R23 均是补断言而非返工),
故**建议:验收照常进行,把 Important-1/2/3 放在「验收通过后、合 master 之前」补掉**(总成本 ≈ 1 小时)。

### G.2 分级清单

| 级 | # | 一句话 | 可查证依据 |
|---|---|---|---|
| **Critical** | — | **0 条** | — |
| **Important** | **I-1** | `topK` 与 `rerank` 两个 `runSearch` 入参**零守卫**:把「精确/快速」接反、把 topK 焊死成 10,4254 例全绿 + 真机也看不出(结果半区不可达) | 我的探针 F1/F2:两次注入后 `3125/3125 全绿`;`grep -n 'mock.calls' SearchView.test.ts` 全量列举里 **`topK`/`rerank` 一次都没被读过** |
| **Important** | **I-2** | in-git 的 `cross-area-impacts.md` 未随 R4/R5/R6 更新,且 **票 C/票 D 不在它的 §1**,而 A-1 只写「§1 的两张票」⇒ 照它执行会漏登记两张票,且 §3 那句「验收清单必须写这个时限(16.7 s)」**与 R5 直接冲突** | `git diff ec6a000..5f1c396 -- docs/…cross-area-impacts.md` 本期**只有 E-56 一处订正**(+10/−2);该文档 §3 原文仍在 |
| **Important** | **I-3** | **缺 `p5e-handoff-to-p5f.md`**(P5d 有同类文件且是本期必读清单第 6 项),`p5e-plan.md` §2 四条动作里也没列 ⇒ P5f 要从 12 个台账文件拼交接面 | `ls .superpowers/sdd/ \| grep -i handoff` → 只有 `p5d-handoff-to-p5e-p5f.md`;`grep -rln 'P5f' .superpowers/sdd/p5e-*.md` = 12 |
| **Minor** | **M-1** | `FileDetailDrawer` 的 `window: 2` 零守卫(改成任意值全绿)。⚠️ 杀伤面比 I-1 小:`knowledgeStore.ts:572` 的默认参数也是 `2`,**删掉该参数无害,只有改值才有害** | 探针 F3:`window: 7` → `3125/3125 全绿`;蓝本 `bp-FileDetailDrawer.vue:153` = `window: 2` |
| **Minor** | **M-2** | `highlight()` 的 term 最小长度 `>= 1` 零守卫 ⇒ 改成 `>= 2` 会让**所有单字查询彻底不高亮**(中文高发)而全绿 | 探针 F6:`3125/3125 全绿`;蓝本 `bp-SearchView.vue:332` = `s.length >= 1` |
| **Minor** | **M-3** | R23 祖先链守卫的扫描集是 `.knowledge-app`/`.k-main`/`body`/`html` 四个,**`#app` 不在内** ⇒ 将来给 `#app` 加 `transform` 会静默破 K46。(现状安全:我实测 `#app` 全仓零样式规则) | `grep -rn '#app' --include='*.css' --include='*.scss' --include='*.vue' src/` = 0 命中;守卫源码 `knowledgeStyles.test.ts:1830-1859` |
| **Minor** | **M-4** | `messageSyntax.test.ts:1013-1014` T1 那句「deliberately not named here …」的**理由已被 R13 作废**,而作废说明在 14 行之后的另一个 `it` 前言里(字面仍真,不误导) | 我逐行读 `:1005-1040` |
| **Minor** | **M-5** | 验收清单保留项**漏了两屏本机真可点的**:idle 态 5 个示例 chip(`:470`,无 `v-if`)与清除按钮(`:374` `v-if="q"`) | R2 §2 的保留清单只列四类 + rail 导航;我自读源码确认这两处无条件/低条件渲染 |
| **Minor** | **M-6** | `KFileViewer.vue:92` 模板用 `props.file` 而另两个文件用裸 `file`(行为等价,且注释已说明是刻意点名 prop) | 三份源码对读 |

🟢 **零 Critical 的依据**:我逐字节对读了蓝本与本仓的四个移植文件,**未发现任何一处产品代码与蓝本不符**;
所有新发现都是「守卫覆盖」与「文档登记」两类,**没有一条是行为错误**。

### G.3 我实测的七个数字 + 四道门

| 量 | 我实测 | 收官口径 | |
|---|---|---|---|
| 测试文件 | **335** | 335 | ✅ |
| 用例 | **4254**(0 failed,已知两条 flaky 本轮未红,零复跑) | 4254 | ✅ |
| `.vue` | **185** | 185 | ✅ |
| `color-guard` | **187** | 187 | ✅ |
| `aiKb*` | **441 / 441**(真实模块导入) | 441/441 | ✅ |
| 全表 | **1648 / 1648**,`zh-only 0` · `en-only 0` | 1648/1648 差集空 | ✅ |
| 本期新 `.vue` | **3** | 3 | ✅ |
| `vue-tsc --noEmit` | **exit 0**,0 行输出 | 0 | ✅ |
| `vite build` | **exit 0**,`built in 13.51s` | 0 | ✅ |
| `sass knowledge.scss` | **exit 0** | 0 | ✅ |
| **死键** | **0 / 54**(我逐键 R13 口径重跑) | 0 | ✅ |
🔴 **与收官口径零出入。**

### G.4 探针清单与还原确认

**本终审共做 12 组探针**(全部 `cp` 副本 + python 锚定注入 + **先证注入落盘** + 跑测 + 副本覆盖 + `md5sum` 比对):

| 组 | 目标 | 结果 |
|---|---|---|
| F1 | `SearchView.vue` rerank 映射反转 | 全绿 ⇒ **缺口** |
| F2 | `SearchView.vue` topK 焊死 | 全绿 ⇒ **缺口** |
| F3 | `FileDetailDrawer.vue` `window: 2→7` | 全绿 ⇒ **缺口** |
| F4 | `knowledge.scss` 浅档 `--rtag-md` 改值 | 报红 ⇒ 有牙 |
| F5 | `FileDetailDrawer.vue` watch 加 `immediate` | 报红(4 条)⇒ 有牙 |
| F6 | `searchAggregate.ts` highlight term 长度 | 全绿 ⇒ **缺口** |
| F7 | `knowledgeStyles.test.ts` `KNOWLEDGE_VUE_FILES` 删一项 | 报红 ⇒ 防漂移有牙 |
| R13-a | `zh_cn.ts` + `en_us.ts` **两档同时**复活 `aiCfgKnowledgeSoon` | 报红(恰 1 条,parity 仍绿)⇒ T1b 守卫有牙 |
| R13-b | `messageSyntax.test.ts` 删 `singleN` 一项 | 报红 ⇒ T1b 长度钉子有牙 |
| R23 | `theme.css` 裸 `body {}` 注入 `will-change`(换属性 + 换落点,与 T8 三次都不同) | 报红(恰 1 条)⇒ 非空壳 |
| R21 | `searchAggregate.ts` `groupHits` 改「取最高分」 | 报红(恰 1 条)⇒ R21 补位有效 |
| — | (另有大量只读核验:Go 源码 / Service 源码 / Qdrant / search-roots / 蓝本 5 份 / R8 与 149 类两套自写模拟器) | — |

**还原确认(全部逐字节一致)**:
```
189df8a9d6397286672d99921387d2c0  src/ai/knowledge/views/SearchView.vue
df5951f718129cb199c6205fc45acad4  src/ai/knowledge/components/FileDetailDrawer.vue
3466dd7de6465ef2c2f2340add577a81  src/ai/knowledge/util/searchAggregate.ts
a30da07adfc9acc609b2701a174f25ca  src/ai/styles/knowledge.scss
ffd93d0739d216d249a41d8fdfbfd656  src/ai/styles/knowledgeStyles.test.ts
9970eb90e3cb278dcbe0e718eb0742bf  src/i18n/zh_cn.ts
a71c8de0606d315e4ed53ec04d4815b2  src/i18n/en_us.ts
75f45f1b1ef25c330f73934e891a15b3  src/styles/theme.css
0809bf7841d12abf2182c406947874fc  src/i18n/messageSyntax.test.ts
$ git status --porcelain   → (空)
$ git rev-parse HEAD       → 5f1c39640a23255bb7c973b05986d14b5ffbfbc1
$ git stash list           → 仍是两条与 P5e 无关的历史条目(2026-07-18 / 2026-07-06),一个都没碰
```
🔴 **全程零 `git checkout / restore / stash / commit / amend / reset / rebase / push / merge`;未部署;未碰任何 dev server
(`:5288` pid 1159107 仍在 LISTEN,我只读过它的端口状态)。`NimoOS-UI` 只读仓全程只用 `git show`。**
🟢 **另附交叉验证**:我在探针**开始前**取的三个基线 md5(`189df8a9…`/`df5951f7…`/`a30da07a…`)与
T5/T7/T8 三份评审各自记录的还原值**逐字节相同** ⇒ **那三份评审的探针都还原干净了,工作树自它们之后未被改动过。**

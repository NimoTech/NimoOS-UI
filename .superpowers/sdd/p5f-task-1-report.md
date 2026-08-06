# SP8-P5f · Task 1(i18n 刀)实现报告

> 起点 `8289a1a`(自测:`git log --oneline -1` → `8289a1a docs(p5f): 裁定 R13-R16 —— M-2 反转 / 附录禁令解除`)。
> 蓝本锁 `7a6ee6b7`(`git -C ../../NimoOS-UI show`,全程只读,零 checkout/stash/commit)。
> 权威链:上级设计 > `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md`(常驻)>
> `p5f-coordinator-rulings-T0.md` > 三份 `p5f-` 附录 > `p5f-common-constraints.md` > `p5f-plan.md` > brief。

---

## 0. 一句话结论

**附录 A 的 90 条全部落地:复用 11 / 新增 79**(裁定 **R3** 的三条按 A-1 新建),
两档零遗漏零多余;`p5f-task-1-i18n-verify.mjs` **五部分全 PASS**(79/79 + 11/11 逐码点 MATCH);
`messageSyntax.test.ts` 加 47 条本批守卫 + 1 条 P5e 既有守卫的**加固式登记**;
**三门全绿 335 文件 / 4302 例 / tsc 0 / build 0**;**10 个 RED 探针全部报红并 `md5sum` 逐字节还原**。

🔴 **自跑双向撞车扫描发现 2 项附录 A 没有的东西**(§7),其中一条**直接把 P5e 的一条既有断言打红**。

---

## 1. 改了哪些文件(**只有这四个**)

| 文件 | 改动 | 净增 |
|---|---|---|
| `src/i18n/zh_cn.ts` | 新增 `>>> SP8-P5f Task 1` 标记块(79 键 + 21 行块头注释) | +100 行,**零删除** |
| `src/i18n/en_us.ts` | 同上(79 键 + 17 行块头注释) | +96 行,**零删除** |
| `src/i18n/messageSyntax.test.ts` | 新增 `P5f Task 1 …` describe(47 例);**P5e 既有 describe 加固式 +1 对**(§7.2) | +454 / −4 |
| `.superpowers/sdd/p5f-task-1-i18n-verify.mjs` | **新建**(五部分逐码点校验脚本) | 新文件 |

🔴 **`src/` 其余一律零改动**,自证:

```
$ git status --short
 M src/i18n/en_us.ts
 M src/i18n/messageSyntax.test.ts
 M src/i18n/zh_cn.ts
$ git diff src/i18n/zh_cn.ts src/i18n/en_us.ts | grep -cE "^-[^-]"
0                       ← 两档 locale 是纯增量,一行既有键都没动
$ git diff src/i18n/messageSyntax.test.ts | grep -E "^-" | grep -v "^---"
-    describe('P5e Task 1 §9.2/§9.3 bidirectional collision scan — the 5 one-axis-divergent pairs', () => {
-      it('covers exactly the 5 one-axis-divergent pairs found by this task\'s own scan', () => {
-        expect(divergent.length).toBe(5)
-      it('the scan over the whole table finds exactly these 5 one-axis-divergent pairs (…)', () => {
```
**删掉的 4 行全部属于 §7.2 那一处加固**(5 → 6),**没有任何别的既有行被动过**。

`package.json` / `pnpm-lock.yaml` **零改动**,零新依赖(esbuild 只在**一次性扫描脚本**里通过
`node_modules/.pnpm/esbuild@0.28.1/…` 直接 require,未进 `package.json`,也未进任何测试)。

---

## 2. 键账(**DoD-6 口径**)

| 项 | 值 |
|---|---|
| 本期 distinct 蓝本文案 | **90** |
| **复用既有 `aiKb*`** | 🟢 **11** |
| **新增** | 🟢 **79** |
| 其中「Vue2 有权威 zh 值」 | 🟢 **79 / 79**(en 也 79/79) |
| **本期新造文案(自己翻译的)** | 🟢 **0** |
| **死键** | 🟢 **0** —— 79 条全部有消费点(§2.3) |
| 词干分布 | `aiKbAl*` **35** · `aiKbRt*` **22** · `aiKbWk*` **20** · 无词干 `aiKb*` **2** |
| 落地后全表 | **1727 / 1727**(起点 1648 + 79);`aiKb*` **441 → 520** |
| 占位符 | 名字集合 `{ext, group, h, n, path, t}` = **6 个**,分布在 **9 条**键上 |
| 全角标点例外 | **9 条**(zh);en 侧 **0 条** |
| **D-4 口径:只有存在性断言的条数** | ~~**62 / 79**~~ → 🔴 **订正:53 / 79**(值级断言 **26** 条,非 17;见 §2.4 订正块) |

### 2.1 复用的 11 条(判据:zh 值与 en 值**同时**与本期文案逐码点相等,且键名前缀 `aiKb*` 且语义域相符)

| 蓝本文案 | 复用键 | zh | en |
|---|---|---|---|
| `Path` | `aiKbColPath` | 路径 | Path |
| `Action` | `aiKbColAction` | 类型 | Action |
| `Cancel` | `aiKbCancel` | 取消 | Cancel |
| `Index Roots` | `aiKbNavRoots` | 索引目录 | Index Roots |
| `Real-time watch` | `aiKbRealtimeWatch` | 实时监视 | Real-time watch |
| `Scheduled scan only` | `aiKbScheduledScanOnly` | 仅定时扫描 | Scheduled scan only |
| `Last scan:` | `aiKbLastScan` | 上次扫描: | Last scan: |
| `never` | `aiKbNever` | 从未 | never |
| `Operation failed` | `aiKbOpFailed` | 操作失败 | Operation failed |
| `Retry` | `aiKbRetry` | 重试 | Retry |
| `Manage roots` | `aiKbManageRoots` | 管理知识根 | Manage roots |

**PART 2 实测 11/11 MATCH**,且**11 条一个都不在本期标记块内**(脚本 `REUSE OK` 两档各一条)——
若抄进块里会变成**重复对象字面量属性(后者静默覆盖)**,那就不是复用而是重定义。

### 2.2 🔴 裁定 R3:`Delete` / `Auto` / `Removed` **为什么不复用**(brief 要求逐条写明)

三条的共同点:**zh 与 en 两档都与既有键逐码点相等**(所以「值不同」这个理由不成立),
拒绝复用的理由**只能是语义域**,即 A-1 原文口径:
**「键名语义属于别的区,将来那个区改文案会静默改掉知识库」**。

| # | 蓝本文案 | 值上可复用的既有键 | 那个键的语义域 | 本期的语义域 | 新建键 |
|---|---|---|---|---|---|
| 50 | `Delete` | `aiKbNtDelete` | **`aiKbNt*` = 笔记页**(NotesView,P5d 产出)的「删除笔记」按钮 | `RootsView` 删除**索引根**的按钮 `title`(蓝本 `RootsView.vue:33`) | **`aiKbRtDelete`** |
| 54 | `Auto` | `aiKbOriginAuto` / `aiKbDeviceAuto` | `aiKbOrigin*` = **笔记来源**(自动/手动);`aiKbDevice*` = **Parser 计算设备**(auto/cuda/cpu) | `RootsView` 新增弹窗的**监视模式**单选(auto / scan_only,蓝本 `:67`) | **`aiKbRtWatchAuto`** |
| 89 | `Removed` | `aiKbStatusRemoved` | `aiKbStatus*` = **索引文件状态**(indexed / active / removed) | `WikiView` 的 `OP_LABEL_KEYS.delete` = **wiki 变更日志的 op 标签**(蓝本 `WikiView.vue:156`) | **`aiKbWkOpRemoved`** |

**具体的坏结局(不是假设)**:
- 笔记页若把「删除」改成「删除笔记」,`RootsView` 那个删除索引根的按钮会跟着变成「删除笔记」;
- Parser 设备下拉若把 `Auto` 改成 `Auto (detect)`,监视模式单选会跟着变;
- 索引文件状态若把 `Removed` 改成 `Deleted`,wiki 变更日志的 op 标签会跟着变。

🔴 **这个决策在值层面不可断言**(值相等是前提),所以钉在
`p5f-task-1-i18n-verify.mjs` **PART 5**:三个新键存在、不等于被拒的键、被拒的键仍存在;
且**若某天两侧值真的分叉,脚本打 `NOTE` 说明「A-1 应验了」**。
**RED 探针 10** 证明它有牙(删掉 `aiKbRtDelete` → PART 5 `FAIL`)。

⚠️ **申报**:附录 A **§A.6 的复用判定列**对这三行写的是「🟢 可复用」,与 §A.2 末尾的 🔴 建议
和裁定 **R3** 相反。verify 脚本 PART 3 逐行比对复用判定时会**明确打三条 `NOTE`**
(不是静默跳过),写明「附录 §A.6 说可复用,R3 覆盖为新建」。**其余 87 行的复用判定两边一致。**

### 2.3 死键 = 0 的判据

79 条全部有消费点:**72 条**在三个蓝本模板里以字面 `$t('…')` 出现;
**7 条**是 A.7 的动态键(`OP_LABEL_KEYS` 4 条 + `GROUPS_TEMPLATE.labelKey` 3 条),
经 `$t(变量)` 渲染 —— 按治理 §T8-6「间接消费要逐条落地核实,不算死键」。
🔴 **提醒 T8**:这 7 个键(`aiKbWkOpAdded/Updated/Removed/Renamed` ·
`aiKbAlGroupDocuments/Text/Code`)在模板里**搜不到**,**不许判成死键**。

### 2.4 D-4 口径:只有存在性断言的条数 = **62 / 79** → 🔴 **订正:53 / 79**

> 🔴🔴 **订正块(T1b,2026-08-06;守「反转不删」—— 本节原文一律保留)**
>
> **终值:值级断言 26 条 / 只有存在性断言 53 条。** 原写的「17 / 62」**少算 9 条**。
> **根因**:下表三类是 **9 + 12 + 9**,而原文「去重后 = 17」这一步把 **E-45 那 9 条整组漏掉了**
> (`9 + 8 = 17` 恰好是漏掉 E-45 的结果);且「码点级钉死」一类原文记 **8(+1)= 9**,实测是 **12**
> —— 少记了 3 条:`aiKbAlDeletedCleaning`(省略号 `…` 循环里与 `aiKbAlSavedCleaning` 成对的那条)、
> `aiKbRtBackendTooOld` / `aiKbRtEmpty`(en 侧 em dash 循环里的两条)。
> ⚠️ **这 3 条都已在「全角例外」那 9 条里** ⇒ **UNION 不受它影响,26 这个终值两种算法一致**;
> 但分类表本身的数字仍应订正(R24 的「自洽」是对每一行说的)。
>
> **T1b 独立复算(未照抄评审的数)**:
> ```
> 全角例外 toBe        : 9   {aiKbAlAdvancedCustom, aiKbAlDeletedCleaning, aiKbAlExampleHint,
>                             aiKbAlPathHint, aiKbAlPriorityFull, aiKbAlPriorityHint,
>                             aiKbRtBackendTooOld, aiKbRtDeleteHint, aiKbRtEmpty}
> 码点块 toBe/toContain: 12  {aiKbWkEmptySub, aiKbWkRenderNote, aiKbRtDeleteTitle, aiKbRtScanInterval,
>                             aiKbRtReadOnly, aiKbWkCollapsed, aiKbAlSavedCleaning,
>                             aiKbAlDeletedCleaning, aiKbAlNoRules, aiKbAlLibraryHint,
>                             aiKbRtBackendTooOld, aiKbRtEmpty}
> E-45 插值 toBe       : 9   (= placeholderKeysWithInterpolation 全集)
> 重叠:全角∩码点 = 3(aiKbAlDeletedCleaning, aiKbRtBackendTooOld, aiKbRtEmpty)
>       码点∩E-45 = 1(aiKbWkRenderNote)· 全角∩E-45 = 0
> UNION = 9 ∪ 12 ∪ 9 = 26      只有存在性断言 = 79 − 26 = 53
> ```
> **实证**(评审的探针 3,T1b 复核成立):改坏 `aiKbRtScanEvery` 报红 3 条断言,而它**只属于 E-45 那一组**
> ⇒ 它显然「有值级断言」,却被原口径算进了「只有存在性断言」的一侧。
>
> **零代码影响** —— `src/` 一行都不用改;方向是**低估自己的覆盖率**(安全方向)。
> 订正理由 = 裁定 **R24**「用例数/条数归因表必须与总数自洽,算术叙述错会让下一刀误判基线」;
> D-4 是治理 §0.3 的跨期挂账项,**这个条数会被 T8 / 收官 / 下一期当基线引用**。
> 🔴 **下游一律引 26 / 53,不引 17 / 62。**
> ⚠️ 下面的分类表「码点级钉死 8(+1)」一行同样作废,**以本块的 12 为准**(原文保留)。

**照 P5a–P5e 既定全仓模式,不在 P5f 内单方面反转(治理 §0.3 的 D-4)。**
本期 79 条里,**17 条**在 `messageSyntax.test.ts` 里有**值级断言**:

| 类别 | 条数 | 键 |
|---|---|---|
| 全角例外 `toBe` 钉死 | 9 | `aiKbAlAdvancedCustom` `aiKbAlDeletedCleaning` `aiKbAlExampleHint` `aiKbAlPathHint` `aiKbAlPriorityFull` `aiKbAlPriorityHint` `aiKbRtBackendTooOld` `aiKbRtDeleteHint` `aiKbRtEmpty` |
| E-45 插值 `toBe` 全量钉死(两档) | 9 | 9 条占位符键 |
| 码点级钉死(全角扫描看不见的字符) | 8 | `aiKbWkEmptySub` `aiKbWkRenderNote` `aiKbRtDeleteTitle` `aiKbRtScanInterval` `aiKbRtReadOnly` `aiKbWkCollapsed` `aiKbAlNoRules` `aiKbAlLibraryHint`(+ `aiKbAlSavedCleaning`) |

去重后 = **17 条有值级断言**,**62 条只有存在性断言**。
🔴 **这 62 条的值正确性由一次性 `p5f-task-1-i18n-verify.mjs` 逐码点校验兜底**(79/79 MATCH)。

> 🔴 **上面这两行按本节顶部的订正块作废:终值是 26 条有值级断言 / 53 条只有存在性断言**
> (兜底那句仍然成立,只是条数从 62 改成 53)。

---

## 3. `p5f-task-1-i18n-verify.mjs`(**DoD-2**)

照 `p5e-task-1-i18n-verify.mjs` 写,**五部分**(P5e 是四部分,多的 PART 5 是 R3 专用):

```
$ node .superpowers/sdd/p5f-task-1-i18n-verify.mjs ; echo exit=$?
BLOCK-COVERAGE OK: zh_cn.ts marked block has exactly the 79 mapped keys, zero duplicates
BLOCK-COVERAGE OK: en_us.ts marked block has exactly the 79 mapped keys, zero duplicates
REUSE OK: zh_cn.ts marked block re-declares none of the 11 reused keys
REUSE OK: en_us.ts marked block re-declares none of the 11 reused keys
SUMMARY (PART 1 — 79 new keys …): 79/79 MATCH
SUMMARY (PART 2 — 11 reused keys …, unchanged by this task): 11/11 MATCH
NOTE      aiKbRtDelete ("Delete") — appendix §A.6 says 可复用, ruling R3 overrides it to 新建 …
NOTE      aiKbRtWatchAuto ("Auto") — 同上
NOTE      aiKbWkOpRemoved ("Removed") — 同上
SUMMARY (PART 3): 90/90 MATCH against §A.6's own columns
PART 4 OK: the probe went RED as required → PART 1/2 really compare against en_US.json's value,
           not against the $t() key.
OK        aiKbRtDelete is its own key, not aiKbNtDelete — …
OK        aiKbRtWatchAuto is its own key, not aiKbOriginAuto — …
OK        aiKbRtWatchAuto is its own key, not aiKbDeviceAuto — …
OK        aiKbWkOpRemoved is its own key, not aiKbStatusRemoved — …
STEM BUDGET: aiKbAl* 35 · aiKbRt* 22 · aiKbWk* 20 · stemless 2
R10 MEASUREMENT: 0/90 en_US.json entries override the $t() key in THIS batch
                 (Appendix A §A.0.1 measured 0) — whole-file context: 308/2676 entries do override,
                 which is why the en side is read from the JSON regardless.
Vue2 coverage: zh_CN.json 90/90, en_US.json 90/90 (0 self-invented copy required)
DISTINCT ENGLISH SOURCES: 90/90
RESULT: PASS (all 5 parts)
exit=0
```

### 3.1 🔴 en 侧**没有**假设「en = JSON key」(E-44)

- **PART 1/2 的每一次 en 比较都是 `enPack[english]`**,即
  `git show 7a6ee6b7:src/assets/lang/en_US.json` 的**覆盖值**,不是 `english` 本身。
- **PART 4 亲手制造判别力**:把内存里 `en_US.json` 的一条覆盖值改脏 → **en 比较必须转红**。
  实测转红(`0/1 MATCH` + `PART 4 OK`)⇒ 证明 PART 1 的 en 列**真的读了 JSON**。
  **若脚本写成 `en === key`,PART 4 会保持绿 —— 那正是 E-44 的形态。**
- **实测本期 en = key 恰好 90/90**(与附录 §A.0.1 一致),脚本把它作为**测量结果打印**、
  **不作为前提**;并同时打印全表口径 **308/2676 条值 ≠ 键(11.5%)**,说明规则为什么必须遵守。

### 3.2 zh 侧逐字照抄的自证

79 条 TS 字面量**不是手抄的** —— 由一段一次性生成器直接从 `zh_CN.json` / `en_US.json` 取值输出,
落盘后与生成结果 **`diff` 逐字节相同**:

```
$ awk '/>>> SP8-P5f Task 1/,/<<< SP8-P5f Task 1/' src/i18n/zh_cn.ts | grep -E '^  aiKb[A-Za-z0-9]+:' | wc -l
79
$ diff <上述输出> <生成器输出>   →  无差异(zh 与 en 各一次)
```
再由 PART 1 逐码点复核 79/79。**P5a-T8 的教训(附录零差异、手抄进 TS 引入 5 处全角标点错)在本刀被这两道堵死。**

---

## 4. `messageSyntax.test.ts` 三条守卫(**DoD-3**)+ 双轨(**DoD-4**)

🔴 **守卫全部只圈本批 79 键**,通过 `p5fTask1Keys` 常量数组作用域限定,**不对全表生效**。

### (a) 全角标点扫描 + `toBe` 钉死的例外清单

正则 `/[，；：？！（）]/`,**本刀自己重扫**(不采信附录 §A.5):zh 侧命中 **9 条**、en 侧 **0 条**。
9 条全部 `toBe` 钉死确切值,其余 70 条必须扫干净。

⚠️ 与 brief 的一处措辞订正(**R18 申报**):brief §2-3(a) 把正则写成 `/[,;:?!()]/`(半角),
**本仓既定做法与 P5a–P5e 的五个同款守卫用的都是全角 `/[，；：？！（）]/`**,附录 A §A.5 的
「命中的全角符」列也是按全角算的。**按「本仓既定做法 + 蓝本 1:1」优先(R18 口径)采用全角版。**
若按半角写,`aiKbAlAdvancedCustom` 这类真正要防的错误(把 `:` 写成 `：`)反而扫不到,
而 `aiKbRtScanInterval: '扫描间隔(小时)'` 这类**蓝本原文的半角括号**会被全体误报。

⚠️ 另:附录 §A.5 提醒的 `。/「」/·/—/…/×` 确实**不在**该正则里 —— 因此**另加一条码点级断言**
钉住扫描看不见的字符(§4.a2)。

### (a2) 码点级断言(扫描看不见、但一定会被「顺手规整」的字符)

| 字符 | 键 | 为什么危险 |
|---|---|---|
| 半角逗号 U+002C 夹在中文句子里 | `aiKbWkEmptySub` `aiKbWkRenderNote` | 「修」成 `，` 看起来像改进 |
| 半角问号 U+003F 在中文标题末尾 | `aiKbRtDeleteTitle` | 同上 |
| 半角括号 U+0028/0029 在中文里 | `aiKbRtScanInterval` `aiKbRtReadOnly` | 同上 |
| **双 em dash 「——」无空格** | `aiKbRtReadOnly` | 与下一行**同批却不同约定** |
| **单 em dash「 — 」两侧各一个半角空格** | `aiKbWkCollapsed` | 同上 —— 两种写法都是蓝本自己的 |
| `…` U+2026 单字符 | `aiKbAlSavedCleaning` `aiKbAlDeletedCleaning` | 写成三个点单测抓不到 |
| 全角句号 ×2 | `aiKbAlNoRules` | |
| 半角双引号包 any(两档) | `aiKbAlLibraryHint` | |

### (b) 占位符两档一致 + 🔴 E-45 真插值断言

- 占位符键列表**从落盘值反推**(不是硬编码长度):扫 79 条两档 → 必须恰好是那 9 条。
- 占位符**名字集合**断言 = `['ext','group','h','n','path','t']`(6 个)。
- 两档占位符名集合逐键一致。
- 🔴 **E-45**:**没有**写「渲染结果不含 `{x}` 字面量」那种零判别力断言。
  9 条键全部**过真 vue-i18n 渲染**、用产品码真实传的参数、`toBe` 钉死**完整插值结果**、**两档各一条**。
  例:`aiKbWkRenderNote` + `{path:'/DATA/Docs/.wiki.md'}` →
  zh `'本页由 /DATA/Docs/.wiki.md 渲染,索引服务在目录变化后自动重写'`。
- 另留一条**活的测量断言**证明 E-45 本身:`t('aiKbAlNowIndexing', { wrongName:'.log' })`
  实测 `'已收录 '`(**空串替换**),且 `not.toContain('{ext}')` —— 这就是为什么反向断言必须钉完整输出。

### (c)「exactly N keys」防漂移 + (DoD-4)键数双轨

```ts
expect(p5fTask1Keys.length).toBe(79)                                   // 本批:精确
expect(p5fTask1Keys.filter(k => k.startsWith('aiKbAl')).length).toBe(35)
expect(p5fTask1Keys.filter(k => k.startsWith('aiKbRt')).length).toBe(22)
expect(p5fTask1Keys.filter(k => k.startsWith('aiKbWk')).length).toBe(20)
expect(p5fTask1Keys.filter(k => !/^aiKb(Al|Rt|Wk)/.test(k)).length).toBe(2)
…
expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1727)            // 全表:下限
expect(Object.keys(en).length).toBeGreaterThanOrEqual(1727)
```
🔴 **全表一律 `toBeGreaterThanOrEqual`,绝不写精确值** —— 写精确值就是亲手重建 D-3 刚拆掉的
跨期陷阱(每个后续加键的期都会红在一个与它毫不相干的断言上)。
**1727 是落地后实测**(真实模块导入,见 §5),不是 1648+79 的算式(算式与实测一致,但断言取实测)。

⚠️ **仅有「列表长度」不够**:`p5fTask1Keys` 是本文件里的字面量,长度对不代表键真的在 locale 里
(承 P5b-T1 评审 I-1)。所以另有「每条都以 string 存在于两档」+「11 条复用键仍存在」两条。

---

## 5. 🔴 自跑双向撞车扫描(**DoD-5 / 裁定 R7-② / 治理 §7.1**)

**没有采信 T0b 的结论,自己从零重跑。** 方法与 T0b 同族但独立实现:

- **真实模块导入**:`esbuild` bundle `src/i18n/zh_cn.ts` / `en_us.ts` → ESM `import`
  (**不做文本解析** —— 文本解析会少算,治理 §9.3-2);
- 蓝本两档语言包 `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json`;
- 对附录 §A.6 解析出的 **90 行**,**两个方向都扫**(zh 撞看 en 是否不同 + en 撞看 zh 是否不同)。

### 5.1 起点基线(**自己实测,没用协调者的数**)

```
zh keys 1648   en keys 1648
zh\en 0        en\zh 0
aiKb* zh 441   en 441
blueprint zh_CN.json 2757  en_US.json 2676
en_US.json overrides (value !== key): 308
parsed appendix rows: 90  dynamic: 7
appendix vs blueprint mismatches: 0        ← §A.6 的 90 行 zh/en 值逐码点全对
this batch: en === key for 90/90
```
🟢 **与 R10 终值表逐项一致**(1648/1648 · 441/441)。

### 5.2 撞车结果:**28 行**(与 T0 / 评审 / T0b 四方一致)

```
rows with en-only collisions: 1  -> 89:Removed        ← 全 90 行里唯一的 en 单侧,撞 addPanelRemovedToast
rows with zh-only collisions: 11 -> 1:File types | 3:enabled | 14:Action | 33:Add failed |
                                    37:Documents | 50:Delete | 54:Auto | 61:Root enabled |
                                    68:Root deleted | 89:Removed | 90:Renamed
```
🟢 附录 §A.3.1a 补的 5 行单侧撞车**逐条复现**;§A.3.1 那 6 个「—」**逐个实测确为真空**。

### 5.3 🔴 **附录没有的第 1 项:本期内部第二对撞车**

附录 §A.3.1 的 ⚠️ 注只点名了 **一对**内部撞车(`enabled` ↔ `Root enabled`)。
**我的扫描扫出两对:**

```
===== WITHIN-BATCH COLLISIONS =====
3 "enabled"      <-> 61 "Root enabled"  zhSame=true enSame=false   ← 附录已点名
68 "Root deleted" <-> 89 "Removed"      zhSame=true enSame=false   ← 🔴 附录没有
```

**`Root deleted`(row 68)与 `Removed`(row 89)的 zh 都是「已删除」、en 分别是
`Root deleted` / `Removed`。** 合并成一个键会让**其中一页的英文界面被静默改写**:
`RootsView` 删除根后的 toast 会变成 `Removed`,或 `WikiView` 变更日志的 op 标签会变成 `Root deleted`。
⇒ **必须两个独立键**:`aiKbRtRootDeleted` / `aiKbWkOpRemoved`(已落地,且各自进 §5.5 的断言表)。

⚠️ 这一对**特别容易被合并**,因为 R3 已经在讨论 `Removed` 要不要复用 `aiKbStatusRemoved`,
很容易顺手把 `Root deleted` 也归进去 —— 三者 zh 全是「已删除」。

### 5.4 🔴 **附录没有的第 2 项:11 条复用/拒用行的「both 撞车集合」不完整**

附录 §A.2 / §A.3.2 每行只给**一个**复用目标或一个代表键,实测**同值键更多**:

| 行 | 附录登记 | 🔴 实测的完整 both 集合 |
|---|---|---|
| 13 `Path` | `aiKbColPath` | `appsSettingsIndex` `aiPathLabel` **`aiKbColPath`** |
| 25 `Cancel` | `aiKbCancel` | `filesCancel` `startAppCancel` `appsCancel` `appsSettingsCancel` `aiCancel` `aiCfgCancel` **`aiKbCancel`** |
| 64 `Operation failed` | `aiKbOpFailed` | `filesOpFailed` `filesShareFailed` **`aiKbOpFailed`** |
| 70 `Retry` | `aiKbRetry` | `filesUploadRetry` `appWidgetRetry` `appsStoreRetry` `appsSourcesRetry` **`aiKbRetry`** |

**风险等级:低**(A-1 的口径本来就是「只认 `aiKb*` 家族里语义相符的键」,而每行恰好只有一个
`aiKb*` 候选 ⇒ 复用目标唯一、不会选错)。**登记原因**:治理 §7.1 要求把扫出的东西登记下来,
且这四行说明**附录的撞车表是「代表值」而不是「全集」** —— 下一期不要拿它当全集用。

### 5.5 落地后的一轴分歧对:**21 对**(钉进测试)

落地后(全表已含本批 79 键)重扫,「一轴撞、另一轴分歧」的对共 **21** 对
(**en 轴 20 + zh 轴 1**),全部登记进 `divergent` 表并各配一条真断言,
**外加一条把扫描输出本身钉成精确集合**的断言(判据见 §6 PROBE 7)。
唯一的 zh 轴那条正是 §5.2 的 `aiKbWkOpRemoved ↔ addPanelRemovedToast` ——
**它就是「en 列有『—』≠ en 方向不用扫」的活证据。**

---

## 6. RED 探针(**10 个,全部报红 + `md5sum` 逐字节还原**)

协议:`cp` 备份 → **行首锚定注入** → **先证注入落盘** → 跑 → 报红 → `cp` 还原 → `md5sum` 比对。
🔴 **全程禁 `git checkout/restore/stash`。** 基线:

```
4a4d4a9a85bccb4959e7aa165de34f08  src/i18n/zh_cn.ts
5602793e93d156b598d505ed634424ce  src/i18n/en_us.ts
6c48a8ee283f6632c18d3062fa642229  src/i18n/messageSyntax.test.ts
```

| # | 注入 | 落盘证据 | 报红的断言 |
|---|---|---|---|
| 1 | `aiKbAlSelectAll: '全选'` → `'全选！'` | `2007:  aiKbAlSelectAll: '全选！',` | 全角扫描(+ 撞车集合)**2 failed** |
| 2 | 例外键 `aiKbAlAdvancedCustom` 值尾加一空格 | `1979: … '高级：自定义扩展名 ',` | `pins the exact zh_cn value … 9 registered exceptions` **1 failed** |
| 3 | `aiKbWkEmptySub` 半角逗号 → 全角 | `2035: … '添加知识根后，Wiki …'` | 全角扫描 + 码点钉死 **2 failed** |
| 3b | `aiKbAlSavedCleaning` `…` → `...`(**全角正则看不见**) | `2006: … '…文件...',` | **只有**码点钉死 **1 failed** ⇒ 证明码点断言有独立价值 |
| 4 | **en 单档**把 `{ext}` 改成 `{e}` | `1975:  aiKbAlNowIndexing: 'Now indexing {e}',` | 占位符名字集合 + 两档一致 + **E-45 插值 `toBe`** **3 failed** |
| 5 | 从 `p5fTask1Keys` 删一个条目 | `1357:  // probe: removed aiKbWkViewSource` | `covers exactly the 79 keys` **1 failed** |
| 6 | **两档同时**删 `aiKbWkViewSource` | 两档 grep 计数 2 → **0** | `every key … present` + `whole locale table never shrinks` **2 failed**(⚠️ **`parity.test.ts` 保持绿** —— 两档同删它抓不到,这正是这两条的存在理由) |
| 7 | 加一个未登记的一轴撞车键 `probeSelectAll`(zh 同值/en 不同) | 两档各 1 行 | 撞车集合精确断言 **1 failed**,报出 `+ "aiKbAlSelectAll\|probeSelectAll\|en"` |
| 8 | **两档同时**删复用键 `aiKbManageRoots` | 两档 grep 计数 2 → **1**(剩下的 1 是块头注释里的提及) | `the 11 reused aiKb* keys … still exist` + 全表下限 **2 failed** |
| 9 | **verify 脚本**:把 `aiKbRtSubtitle` 的 zh 改一个字 | `2029: … '知识库扫描的根目彔',` | PART 1 `78/79 MATCH` + PART 3 MISMATCH,**exit=1** |
| 10 | **verify 脚本**:两档删 `aiKbRtDelete`(= 「改成复用 `aiKbNtDelete`」) | 两档 grep 计数下降 | BLOCK-COVERAGE FAIL ×2 + PART 1 MISMATCH + **PART 5 `FAIL aiKbRtDelete`**,exit=1 |

**还原确认(最后一次全量比对)**:
```
$ md5sum -c /tmp/p5f-t1-probe/baseline.md5
src/i18n/zh_cn.ts: OK
src/i18n/en_us.ts: OK
src/i18n/messageSyntax.test.ts: OK
```

⚠️ **探针 4 的意义**:E-45 说的就是这个 —— 若断言写成「渲染结果不含 `{ext}`」,
探针 4 下渲染结果是 `'Now indexing '`(**空串替换**),**不含 `{ext}`,断言保持绿 = 零判别力**。
本刀写的是完整输出 `toBe`,所以红了。

---

## 7. 🔴 申报事项

### 7.1 R18 申报:全角扫描正则用**全角版**,与 brief 字面不同

brief §2-3(a) 写 `/[,;:?!()]/`(半角)。**实测该写法不成立**:
① 本仓 P5a/P5b/P5c/P5d/P5e 五个同款守卫用的都是全角 `/[，；：？！（）]/`;
② 附录 A §A.5 的「命中的全角符」列(`：` `，` `；`)只有按全角算才对得上 9 条;
③ 按半角写会把 `aiKbRtScanInterval: '扫描间隔(小时)'` 等**蓝本原文的半角括号**全体误报,
   同时**放过**真正要防的「把半角 `:` 写成全角 `：`」。
**按 R18 口径(brief 字面与「本仓既定做法 + 蓝本 1:1」冲突时以后两者为准)采用全角版并显式申报。**

### 7.2 🔴 §9.10 申报:**动了 P5e 既有 describe 的一处**(5 → 6,**纯加固**)

**事实**:本批新建的 `aiKbAlFileTypes`(zh `文件类型` / en `File types`)与 P5e 的
`aiKbSrFileType`(zh `文件类型` / en `File type`)**zh 撞、en 分歧**。
P5e-T1 那条「扫描输出恰等于 5 对」的断言因此**报红**(实测:`+ "aiKbSrFileType|aiKbAlFileTypes|en"`)。

**处置**:把这一对**登记进** P5e 的 `divergent` 表,计数 `toBe(5)` → `toBe(6)`,标题同步。

**为什么这是加固不是放宽(逐条)**:
1. 那条守卫的**原文用途**就是「a newly created one-axis collision has to be **registered** rather
   than silently appearing」—— **它是按设计触发的,登记就是它要求的动作**;
2. 改动**严格只增**:表 +1 项、参数化 `it` **+1 条真断言**
   (`aiKbSrFileType.en must differ from aiKbAlFileTypes.en`)、计数 5→6;
3. **集合相等断言仍然是精确的**(`toEqual`),没有换成子集/长度/正则等任何更弱的形态;
4. **没有删除或修改任何一条既有断言的判据**;`git diff` 的 4 行删除全部在这一处,已在 §1 逐行贴出。

**这不是 D-3 那种跨期陷阱**:D-3 说的是「精确的**全表键数**」,而这里是「本批键的**撞车对集合**」——
后者本来就必须精确,否则新出现的撞车会静默溜过;区别在于**它红的时候修法是登记,不是改数字**。
代码里已写下 15 行注释说明来龙去脉(引条目编号,不引 `file:line`)。

### 7.3 附录 §A.6 复用判定列与 R3 冲突(已在 §2.2 说明)

verify 脚本 PART 3 对这三行**打 `NOTE` 而非静默通过**,其余 87 行判定两边一致。

### 7.4 无 `NEEDS_CONTEXT`;零改动清单零触碰

- 需要改别的 `src/` 文件的情况**一次都没出现**;
- 🔴 **DoD 里每一条带 🔴 的「复跑/复扫」都实跑了**:三门基线自跑(§8)· 双向撞车自跑(§5)·
  全表键数真实模块导入自测(§5.1)· 全角例外自扫(§4a)· 占位符自扫(§4b);
  **没有任何一项采信上一刀的结论。**
- 🔴 **R13(「没看到 ≠ 不存在」)兑现**:§2.3 的「死键 = 0」不是靠单一 grep 得出的 ——
  ① 三个蓝本模板逐行读(72 条字面 `$t`);② A.7 的 7 条动态键**逐条回读蓝本常量定义**
  (`WikiView.vue:156` 的 `OP_LABEL_KEYS` · `AllowlistView.vue:159-166` 的 `GROUPS_TEMPLATE`);
  72 + 7 = 79 与新增数**自洽**,这是第二条独立口径。

### 7.5 命中的 K / N 条目

- **N46–N58**:本刀不碰产品码、不碰 store、不碰 `.vue`,**一条都没命中**(它们属于 T4–T7)。
- **K53–K60**:同上,一条都没命中(scss / 模板类)。
- 治理 **§7** 的词干约定:🟢 命中并遵守(`aiKbAl*` / `aiKbRt*` / `aiKbWk*` / 多页共用走无词干)。
- 治理 **§0.3 D-4**:🟢 命中,**照既定模式不反转**,条数已在 §2.4 给出。
- **A.4「不进 i18n」的 10 处硬编码字面量**:🟢 **本刀一条都没加进 locale**
  (`Contents` / `Recent changes` / `TREE` 三个装饰英文 · 4 个 placeholder · `'any'` 兜底 ·
  ` →` 后缀 · glyph 名)。自查:79 个新键的 en 值里**没有** `TREE`,
  `aiKbWkContents` 的 en 是 `Contents` 但它对应的是蓝本 `$t('Contents')`(`kw-sec-title`),
  **不是** `kw-sec-en` 那个未过 `$t()` 的装饰 span —— 两者在蓝本 `WikiView.vue:100-101` 相邻,
  🔴 **T7 不许把 `:101` 的装饰 span 也换成 `$t(aiKbWkContents)`**(`Recent changes` `:123` 同理)。

---

## 8. 三门(全量、落盘、未 `| tail`)

```
$ pnpm test                  > /tmp/p5f-t1-test.log  2>&1 ; echo exit=$?
exit=0
 Test Files  335 passed (335)
      Tests  4302 passed (4302)
   Duration  72.38s

$ pnpm exec vue-tsc --noEmit > /tmp/p5f-t1-tsc.log   2>&1 ; echo exit=$?
exit=0        (日志 0 行)

$ pnpm build                 > /tmp/p5f-t1-build.log 2>&1 ; echo exit=$?
exit=0        ✓ built in 13.97s
```

**零红项**,已知噪声(`persist.test.ts > dropPersisted` / `AgentComposer.test.ts` teardown)本次**未出现**,未复跑。

### 8.1 用例数归因(必须与总数自洽 —— 裁定 R24)

| 项 | 值 |
|---|---|
| 起点(T0 与评审各自复跑坐实) | `Test Files 335` / `Tests 4254` |
| 落地后 | `Test Files 335` / `Tests 4302` |
| **文件数 +0** | `messageSyntax.test.ts` 已存在 ⇒ **改不加**;本刀**零新增 `.vue`** ⇒ `color-guard` 用例数不变(仍 187) |
| **用例数 +48** | 见下表 |

| 归因 | 条数 |
|---|---|
| 本批 describe:计数/存在性/复用/全表下限 | 4 |
| 全角:例外数 + 例外 `toBe` + zh 扫描 + en 扫描 | 4 |
| 码点级钉死 | 1 |
| 占位符:列表长度 + 反推列表 + 名字集合 + 两档一致 | 4 |
| E-45:列表长度&覆盖 + 9 条参数化 + 空串测量 | 11 |
| 撞车:计数 + 21 条参数化 + 扫描集合精确 | 23 |
| **本批小计** | **47** |
| P5e describe 加固 +1 对 ⇒ 参数化多一条 `it` | **1** |
| **合计** | **48** ✅ `4254 + 48 = 4302` |

---

## 9. 交给下游的提醒

1. 🔴 **T4/T5/T6/T7 直接用键名,不要再查蓝本文案**:键名 → 蓝本英文串的映射是
   `p5f-task-1-i18n-verify.mjs` 的 `NEW_KEYS` / `REUSED_KEYS` 两张表(可 `import`)。
2. 🔴 **11 条复用键不在标记块里**,`grep 'SP8-P5f Task 1'` 找不到它们 —— 见 §2.1 的表。
3. 🔴 **A.4 的 10 处硬编码字面量一个都不许 i18n 化**,尤其 `WikiView.vue:59` 的 `TREE`
   与 `:101`/`:123` 的 `kw-sec-en` 装饰 span(它们与 `aiKbWkContents`/`aiKbWkRecentChanges` **相邻但不同**)。
4. 🔴 **A.7 的 7 条动态键在模板里搜不到**(写在 `OP_LABEL_KEYS` / `GROUPS_TEMPLATE.labelKey` 上)——
   **T8 死键核查不许判成死键**。
5. **T8 若清空 `DEFERRED_TABS`,与本刀无交集**(本刀不碰 `deferred.ts`)。
6. ⚠️ **下一个加键的期请注意**:`messageSyntax.test.ts` 里现在有 **2 处**「撞车集合精确等于 N 对」的
   全表扫描断言(**P5e 一处 6 对 · P5f 一处 21 对**;P5d 的 N32 守卫是逐对 `not.toBe`,不是集合扫描)。
   新键的值与哪一批一轴相撞,**那一批**的集合断言就会红 —— 🔴 **修法是把新对登记进去,不是改数字、
   更不是放宽 `toEqual`**(§7.2 已立此先例并写进代码注释)。

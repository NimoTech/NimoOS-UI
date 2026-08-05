# SP8-P5f · Task 5 独立评审(`RootsView.vue`)

**被评审提交**:`227a43c`(起点 `a631f3c`)· 评审时 HEAD = `9ad3fba`(裁定 R25-R26 的文档提交)
**评审口径**:实现者报告的**每一条结论都自己动手复核**,不采信任何自我声明。
**分级**:**Critical 0 / Important 1 / Minor 3**。

工作树自证(全部探针一律 `cp` 还原,**零 `git checkout/restore/stash`**):

```
$ git status --short          → (空)
$ md5sum -c store.md5 rootsview.md5 allow.md5 ks.md5
src/ai/knowledge/stores/knowledgeStore.ts: OK
src/ai/knowledge/views/RootsView.vue: OK
src/ai/knowledge/views/AllowlistView.vue: OK
src/ai/styles/knowledgeStyles.test.ts: OK
```

---

## 0. 三门(评审自跑,落盘,**无 `| tail`**)

```
$ pnpm test -- --reporter=verbose   → EXIT=0
   Test Files  338 passed (338)
        Tests  4545 passed (4545)
$ pnpm exec vue-tsc --noEmit        → EXIT=0
$ pnpm exec vite build              → EXIT=0   ✓ built in 13.64s
```

已知噪声(`persist.test.ts > dropPersisted` / `AgentComposer.test.ts`)**本次未发生**,零红项。

**+68 归因表 —— 评审逐项独立实测,与总数自洽**:

| 来源 | 增量 | 评审自己的取数 |
|---|---|---|
| 起点(T4 收官) | 4477 | 协调者给定(4545 − 68 = 4477 ✅ 自洽) |
| `RootsView.test.ts` | **+60** | `grep -c "^ ✓ src/ai/knowledge/views/RootsView.test.ts" gate-test.log` → **60**;`grep -c "^\s*it(" RootsView.test.ts` → **60**;verbose 里 60 条**逐条带 ✓ 与耗时**,零 skipped/todo |
| `AllowlistView.test.ts` 追加项 a | **+2** | 探针 4 单跑 `2 failed | 52 passed (54)` → 原 52,现 54 |
| `color-guard.test.ts`(`**/*.vue` 动态) | **+1** | 单跑 `Tests 189 passed`;`find src -name '*.vue' | wc -l` → **187** |
| `knowledgeStyles.test.ts` | **+5** | 单跑 `Tests 417 passed`;探针 R1(撤销登记)时 `412 passed (413)` ⇒ 登记 +4、K44 +1 |
| **合计** | **4477+60+2+1+5 = 4545** | ✅ 与 `pnpm test` 完全相等 |

---

## 1. 🔴 第一必查项 —— 四条探针,评审全部亲手跑

### 探针 1 —— `toggle()` 的 toast 方向(裁定 R9 / R25)

**先自己读一遍再看结论。** 蓝本 `:163-173` 与本仓 `knowledgeStore.ts:736-747`:
`setRootEnabled` 在 `await` **之前**执行 `root.enabled = enabled`,`v-for` 里的 `r` 与
`wikiRoots.value.find(...)` 是**同一对象引用**(store 只改字段、不换元素)⇒ `toggle()` 里
`r.enabled` 读到的已是新值 ⇒ **文案方向正确**;失败路径先回滚再 `throw`,成功 toast 不执行。
**评审独立结论 = 裁定 R9 = T5:不是蓝本 bug。** 无 Important。

🔴 **两个判据各跑一次(brief 明令「别跑 R9 的字面版」,评审两个都跑了)**:

```
① R9 字面判据 —— 把 `root.enabled = enabled` 挪到 `await` 之后
$ pnpm exec vitest run …/RootsView.test.ts --reporter=verbose   → EXIT=0
      Tests  60 passed (60)                       ⇒ 🔴 零判别力,R9 的判据确实是错的(E-76 成立)

② R25 订正判据 —— 把就地改换成整体替换数组
   wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled } : r))
$ …                                               → EXIT=1
 × RootsView —— R9 不变量… > 🔴 关 → 开:toast 是「已启用」(不是旧状态的「已禁用」)
 × RootsView —— R9 不变量… > 🔴 开 → 关:toast 是「已禁用」(另一侧,同一个不变量)
 × RootsView —— R27:7 处 toast… > toggle / rescan / confirmDelete 三条成功分支都被 store.toast 的 spy 捕获
      Tests  3 failed | 57 passed (60)
```

⇒ **T5 的订正与裁定 R25 独立复现坐实**,守卫钉在正确的轴上。

### 探针 2 —— N46 的三个入参(`watchMode` / `scanIntervalH` / `mirror`)各丢一次

```
drop watchMode      → × …N46 > 🔴🔴 watchMode / scanIntervalH 两个入参真的传到位(改高级选项 → body 跟着变)
                       Tests  1 failed | 59 passed (60)
drop scanIntervalH  → × 同上一条              Tests  1 failed | 59 passed (60)
drop mirror         → × …N46 > 🔴🔴 mirror 入参真的传到位(镜像重试 → StorageMode: mirror)
                       Tests  1 failed | 59 passed (60)
$ md5sum -c rootsview.md5 → OK
```

⇒ **三个各自都有具名断言钉住**,「三门全绿、只在真机上错」那一类风险已闭合。
另核:`createRootBody` 确从 `@nimotech/nimoos-service` import(源码正则断言),自拼 body 探针
(`Object.assign({ StorageMode: … }, createRootBody(...))`)→ 1 红。

### 探针 3 —— `reset()` / `nextTick` 两半各自报红

```
去掉 reset() 调用(留 nextTick 空壳) → × …openAdd 真的调了 FolderBrowser.reset()   1 failed | 59 passed
去掉 nextTick(同步调 reset)         → × 同一条                                    1 failed | 59 passed
```

**两半都抓得住。** T5「必须用 stub、不能 `vi.spyOn(fb.vm,'reset')`」的申报,评审自建临时探针验证:

```
PROBE-OPEN   exists= true        （弹窗开着时 FolderBrowser 在）
PROBE-CLOSED exists= false       ⇒ reka Presence 关窗即卸载,T5 这一半成立
PROBE-SPY    calls= 0            （弹窗已开、同一实例上 spyOn 后再点一次 openAdd）
```

第三行见 **Minor M-1**:T5 说这条路径「spy 也确实能捕到、只是守不住 `nextTick` 那一半」,
评审实测是**根本捕不到**(`fb.value` 拿到的是 `defineExpose` 代理,`spyOn(vm,'reset')` 打不上去)。
**结论方向相同且更强**(stub 是唯一可行法),只是理由的中间一步不准确。

### 探针 4 —— 追加项 a(裁定 R24):`e.message` 回显写进 `AllowlistView.vue` 的 `toggle()` catch

```
$ pnpm exec vitest run …/AllowlistView.test.ts --reporter=verbose
 × AllowlistView —— N47… > 🔴 K58(T5 追加)—— toggle 失败:只弹固定键「保存失败」,不回显后端 body
 × AllowlistView —— N47… > 🔴 K58(T5 追加)—— 关闭态 chip 的 toggle 失败走同一条 catch(另一侧,同样不回显)
      Tests  2 failed | 52 passed (54)
$ md5sum -c allow.md5 → OK
```

⇒ **R24 的 I-1 缺口正式闭合。**

**产品码零改动核对(`git diff a631f3c..227a43c` 逐行)**:
- `AllowlistView.vue`:**只改注释**(`-1 / +4`,K27 那段「9 处 → 10 处」的订正块),**产品代码一行未动** ✅
- `AllowlistView.test.ts`:`+54 / −2`,**两行删除全部是 `describe`/`it` 标题**(9→10 的用例名订正,
  裁定 R24 Minor M-1 明文授权「只改注释与用例名」),**既有 52 条断言零改动** ✅
  ⚠️ brief 说「既有 52 条一行未动」——严格说是**两行标题变了**,但那正是 R24 授权且 T5 报告 §12-4 已申报,**不构成缺陷**。
- 我独立复核了那个 10:剥注释(加固版)后 `store.toast(` = **10**;裸剥注释器 = 9 ⇒ **T5 的 10 是对的**。

---

## 2. 移植忠实性(评审程序化对比,不看报告)

**模板逐字对蓝本 `:1-221`** —— 自写解析器输出两侧的「标签 + 属性」序列后逐行对(`cmp.txt`,127 vs 139 个标签):

| 检查项 | 结论 |
|---|---|
| DOM 顺序 / 层级 / 类名 | ✅ 逐个一致;差值 12 个标签**全部**来自 K57 的 reka 包裹(`DialogRoot`/`Portal`/`Overlay`/`Content`/`Title` ×2 组) |
| 属性 | ✅ 一致;唯二差异是两个 `<input>` 把 `v-model` 提到首位(eslint `vue/attributes-order`,零语义) |
| 按钮位置 / `style=` 内联 | ✅ `margin-left:auto` · `margin:12px 16px` · `margin-top:0` · `margin-top:12px` · `width:90px` · `margin-bottom:10px` 全数照抄 |
| 文案 | ✅ **31 个 key 逐个对蓝本 `src/assets/lang/zh_CN.json`@`7a6ee6b7`,zh 值 31/31 逐字相同**(含 `每 {h} 小时扫描` 的占位符、`删除索引目录?` 的半角问号、`该目录只读——…` 的破折号) |
| K1 降层 | ✅ 3 处(`roots` / `browserRoots` / 模板 `wikiRootsLoading`) |

- **K59**:`addError` 走弹窗内联(`.kr-error` 在 `.k-modal-body` 内)✅;409 → 只读文案 + 「以镜像模式添加」按钮(**N50 未删**)✅;非 409 → `aiKbOpFailed` ✅。
  **探针**:把 `e.response.data.message || e.message` 回显写回去 → **2 红**(`非 409(500)…` / `裸 Error(无 response)…`)。
- **N51**:`aiKbRtBackendTooOld` zh/en 两档均逐字等于蓝本 ✅。
- **N49**:`util/folderBrowser.ts:68` 的 `const cands = candidates || []` 仍在 ✅。
- **K57 同源性**:`grep` 三个文件的 reka 用法 —— `DialogRoot`/`DialogPortal to=".knowledge-app" defer`/
  `DialogOverlay class="k-modal-bg"`/`DialogContent class="k-modal" :aria-describedby="undefined"`/`DialogTitle as-child`
  在 `SettingsView.vue`(K29)、`AllowlistView.vue`(T4)、`RootsView.vue` **三处逐字同一套**,**不是第三套写法** ✅;
  模板 `@click.stop` = **0**(探针:加一个 → 1 红)✅。
- **toast 走 `store.toast(...)`**:源码 `useToast(` = 0(探针:改一处直调 → **3 红**)✅;落点 7 处,与注释一致。
- **`.vue` 零 `<style>` 块**:`grep -c '^<style|^</style>'` → **0**;**T2b 的「自动上膛」守卫已上膛**
  (探针:给 `.vue` 追加一个 `<style scoped>` → `knowledgeStyles.test.ts` **5 红**,含 K44 与 K53 两族)✅。
- **新文件已登记进 `KNOWLEDGE_VUE_FILES`**(探针:撤销登记 → `文件清单集合相等(防漂移…)` **1 红**)✅。
- **零 `any`**:`.vue` / `.test.ts` 里 `\bany\b` 只出现在**注释**里 ✅;`httpStatus(e: unknown)` 用 `in` 收窄。
- **模板零裸色**:`sed -n '357,543p'` 后扫 hex/rgb/hsl/具名色 → **零命中** ✅。
- **fixture**:两个抄本块各带 `.CONSTRUCTED` 三级标签 + `__meta` 转注释;
  **程序化逐字段比对 `.superpowers/sdd/p5f-fixtures/` 原件** → `roots equal: True / key order equal: True`,
  `cand equal: True / key order equal: True`;运行时**零读 `.superpowers/`**(只在注释里出现该词);
  **camelCase 没搞反**(`ROOTS_NORMALIZED[0]` 的键序 `id/path/level/watchMode/storageMode/enabled/scanIntervalS/createdAt/lastScanAt/needsReconcile`,
  且用例反向排除 PascalCase 与 snake_case)✅。
- **§9.10 既有守卫只加固不放宽**:整个提交 **3 行删除** = `AllowlistView.vue` 注释 1 行 + `AllowlistView.test.ts` 用例标题 2 行,
  **零断言被删或放宽** ✅。

---

## 3. 缺口猎(逐条探针)

| 探针 | 期望 | 实测 | 判 |
|---|---|---|---|
| 去掉 `&& !store.wikiRootsLoading` | 红 | **1 红**(`加载中(loading=true 且列表为空)→ 空态**不**渲染`) | ✅ |
| 去掉 `!roots.length` 那一半 | 红 | **25 红** | ✅ |
| `confirmDelete` 的 `purgeFiles` 焊死 `false` | 红 | **1 红**(`purgeFiles 两侧:勾上 → deleteRoot(id, true)`) | ✅ |
| **去掉 `submitting` 门** | 红 | 🔴 **60/60 全绿** | ❌ **见 I-1** |
| 去掉 `!canSubmit` 那一半 | 红 | 🔴 **60/60 全绿** | ❌ **见 I-1** |
| 整条 `if (!canSubmit.value \|\| submitting.value) return` 删掉 | 红 | 🔴 **60/60 全绿** | ❌ **见 I-1** |
| 60 条是否空转 | — | verbose 60/60 逐条 ✓ 带耗时,零 skipped;上表 9 条定向变异各自命中具名用例 | ✅ |

---

## 🔴 Important I-1 —— 治理 §5.2 的 `submit()` 函数门**零守卫**(「产品代码对、守卫为零」家族又一次)

**产品代码是对的**(逐字照抄蓝本 `:183`),**缺的是守卫**。

**证据 ①(决定性)**:把整条门删掉,`RootsView.test.ts` **60/60 全绿**。

```
$ python3 -c "…删掉 'if (!canSubmit.value || submitting.value) return'…"
$ pnpm exec vitest run …/RootsView.test.ts --reporter=verbose   → EXIT=0
      Tests  60 passed (60)
```
只删 `submitting` 半 → 60 passed;只删 `!canSubmit` 半 → 60 passed。**三种删法全绿。**

**证据 ②(那条用例实测的是什么)**:`RootsView.test.ts:961`
「🔴 submitting 门:第一发在飞时重复点不发第二发(蓝本 :184 自带)」走的是
`addBtn(host).click()`,而「添加」按钮带 `:disabled="!canSubmit || submitting"`;
**jsdom 不向 disabled 按钮派发 click** ⇒ 第二发**根本没进 `submit()`**。
把 `submitting` 从 `:disabled` 绑定里拿掉(保留函数门)后报的红是:

```
AssertionError: submitting 期间按钮没灰: expected false to be true
```

—— 报红的是 `expect(addBtn(host).disabled).toBe(true)` 这一行,
`expect(wiki.createRoot).toHaveBeenCalledTimes(1)`(注释写着「submitting 门没挡住第二发」)**从未被触及**。
⇒ 这条用例实测的是 **`:disabled` 绑定**,不是 §5.2 点名的**函数门**。
同理 `:950`「🔴 函数自己也守 canSubmit(**绕过按钮 disabled 直接调**也不发请求)」——
它并没有绕过 disabled,**注释所述与实测行为不符**。

**证据 ③(真实可达的绕过路径,不是理论风险)**:N50 的「以镜像模式添加」按钮
(`RootsView.vue:491` `<button v-if="mirrorOffer" class="k-btn outline" @click="submit(true)">`)
**没有任何 `:disabled` 绑定**。评审临时探针(跑完即删,`git status` 已复核干净)双击它:

```
带函数门 :  { mirrorBtnDisabled: false, createRootCallsAfterDoubleClick: 1 }
去函数门 :  { mirrorBtnDisabled: false, createRootCallsAfterDoubleClick: 2 }
```

⇒ 真机上双击「以镜像模式添加」会发**两发** `POST /v1/wiki/roots`;`!canSubmit` 那半同理
(错误块显示期间把路径改成相对路径再点镜像按钮,函数门是唯一防线)。

**失败场景**:后人重构 `submit()` 时顺手删掉那行早退(它看起来是「按钮已经 disabled 了、冗余」),
三门全绿、评审也看不出 ⇒ 重复创建同一个索引根 / 用相对路径创建。

**建议落法(不返工产品码,只补用例)**:补一条走**镜像按钮**路径的用例 ——
409 → 出镜像按钮 → `createRoot` 挂在 deferred 上 → 连点两次 → 断 `createRoot` 只被调 1 次;
再补一条:错误块显示期间把 `form.path` 改成相对路径 → 点镜像按钮 → `createRoot` 不再被调。
**判据 = 删掉函数门必须报红**(现在删掉全绿)。

---

## Minor

**M-1 —— T5 关于「spy 能捕到」的中间论证实测不成立(结论不受影响)**
测试文件 `:741-749` 与报告写「弹窗已开时再点一次…同一个实例、spy 也确实能捕到,但拿掉 `nextTick` 它仍然绿」。
评审探针:`vi.spyOn(w.findComponent(FolderBrowser).vm,'reset')` 后再点一次 openAdd → **`calls = 0`**
(`fb.value` 拿到的是 `defineExpose` 暴露的代理对象,spy 打在 vm 上根本不生效)。
**结论「必须用 stub」成立且比申报的更强**,只是理由的中间一步不准 —— 建议 T6/T7 沿用 stub 法时**别引这句理由**。

**M-2 —— 两处无判别力的填充断言**
`RootsView.test.ts:364` `expect(host).toBeTruthy()` 与 `:958` `expect(w.html()).toBeTruthy()`
恒真、不可能报红。所在用例的其余断言都有效,**只是这两行是噪声**(§9.14-4 的「空转」小样)。建议顺手删或换成实质断言。

**M-3 —— 剥注释器的路径字面量坑(T5 §4c)属实,但对本刀零影响**
评审复现:对 `AllowlistView.vue` 用裸 `/\*[\s\S]*?\*\//` 剥注释,`store.toast(` 被数成 **9**;
加固版(要求 `/*` 前是空白或行首)数出 **10**;`'/Downloads/*'` 共 3 处触发。
但对 `RootsView.vue` 两种口径**都是 7** ⇒ **本刀任何断言的判别力都不受影响**,
且 T5 用的就是加固版并配了防空转锚点(`onDeletingOpen` / `DialogPortal` / `createRootBody({`)。
⇒ **按 Minor 登记为常驻教训(承 R26-3),不按 Important 报。**

---

## 4. 对 T5 三条顾虑的裁断

| # | T5 申报 | 评审裁断 |
|---|---|---|
| **a** | R9 的 RED 判据不成立,真轴是「整体替换数组」 | 🟢 **成立,评审两个判据各跑一遍独立复现**(字面版 60/60 全绿;数组替换版 3 红且是具名的两条 R9 守卫 + R27 那条)。裁定 R25 / 勘误 E-76 **确认无误**。**终审切勿照 R9 字面判据复跑后得出「守卫是空壳」。** |
| **b** | 附录 B §B.5 的 `WikiView` 也错(8 → **9**,漏 `:12`) | 🟢 **成立。评审自己数:9 处**,行号 **7 · 12 · 22 · 59 · 69 · 70 · 71 · 72 · 73**(`style=` ×8 + `:style=` ×1,`color=` **0**),口径 = 只截蓝本根 `<template>`(1-146 行)、按属性出现次数、前置 `(?<![\w:@.-])`。顺带复核另两行:`AllowlistView` **8**、`RootsView` **7** —— **三行全对**。🔴 **T7 按 9 处核。** |
| **c** | 剥注释器被 `'/Downloads/*'` 骗开假注释、吃掉真代码 | 🟡 **坑属实(评审复现 9 vs 10),但对本刀任何断言零判别力影响**(`RootsView.vue` 两种口径同为 7)⇒ **按 Minor M-3 登记**,不升 Important。 |

---

## 5. 结论

**Critical 0 / Important 1 / Minor 3。**

- 移植忠实性、i18n 文案(31/31 逐字)、K57 同源、K58/K59、N46/N49/N50/N51、
  fixture 抄本、零 style / 零 any / 零裸色、§9.10、追加项 a、三门与 +68 归因 —— **全部经评审独立复核成立**。
- **唯一实质缺口 = I-1**:治理 §5.2 点名的 `submit()` 函数门整条可删而三门全绿,
  且有一条真实可达的绕过路径(N50 镜像按钮无 `:disabled`,双击实测发两发)。

**是否可进 T6:可以,但 I-1 建议在 T6 之前用一条补丁用例闭合**
(与 R24 把 T4 缺口派给 T5 同一口径:缺口越早补越不会被遗忘;不阻塞 T6 的 `WikiView` 范围)。

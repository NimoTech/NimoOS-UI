# SP8-P5f Task 5 报告 —— `RootsView.vue`(索引目录页)

| | |
|---|---|
| 分支 / 起点 | `sp8-ai` @ **`a631f3c`**(自己 `git log --oneline -1` 现测确认) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`** · `src/views/AI/Knowledge/RootsView.vue`(289 行) |
| 三门 | **`Test Files 338` / `Tests 4545` / `vue-tsc` 0 / `vite build` 0** —— 全量、落盘、无 `| tail` |
| 起点基线 | `Test Files 337` / `Tests 4477`(T4 收官,评审独立复跑坐实) |
| 探针 | **6 条,全部 RED 并 `cp` + `md5sum` 逐字节还原**(禁 `git checkout/restore/stash`) |

---

## 1. 逐文件改了什么

| 文件 | 动作 | 行数 |
|---|---|---|
| `src/ai/knowledge/views/RootsView.vue` | 🆕 **新建** | **543**(其中文件头注释 `:1-160`) |
| `src/ai/knowledge/views/RootsView.test.ts` | 🆕 **新建** | **1266** · **60 例** |
| `src/ai/styles/knowledgeStyles.test.ts` | **+1 行** —— `KNOWLEDGE_VUE_FILES` 登记 `'views/RootsView.vue'` | `+1 / −0` |
| `src/ai/knowledge/views/AllowlistView.test.ts` | **追加项 a(裁定 R24)**:+2 例 K58 守卫;**追加项 b**:describe / it 名 9→10 | `+54 / −2`(**2 行删除全是标题行**) |
| `src/ai/knowledge/views/AllowlistView.vue` | **追加项 b**:文件头注释 9→10。🔴 **产品码一行未动** | `+4 / −1`(全在 `<!-- -->` 里) |
| `.superpowers/sdd/p5f-appendix-B-tokens.md` | **追加项 c**:§B.5 新增 **§B.5.1 订正块**(守「反转不删」) | `+34 / −0` |
| `.superpowers/sdd/p5f-task-5-report.md` | 🆕 本文件 | — |

🔴 **其余 `src/` 零改动**(`git status --short` 只有上述 5 个 `src/` 条目)。

---

## 2. 蓝本 `file:line` → New-UI 的对照

| 蓝本区间 | 内容 | 本仓落点 |
|---|---|---|
| `:2-4` | `.k-view` → `.k-scroll` → `.k-scroll-inner` 三层壳 | 模板同名三层 |
| `:6-11` | 区头(标题 / 副标题 / 右上「添加索引目录」,`style="margin-left: auto"`) | 同 |
| `:13-19` | 空态 `.kr-empty`(`!roots.length && !wikiRootsLoading`) | 同 |
| `:20-40` | 列表 `.k-set-card` + 每行(路径 / 徽标 / 间隔 / 上次扫描 / 重扫 / 删除 / 开关) | 同 |
| `:43-91` | 「添加索引目录」弹窗 | **K57 转 reka**(`DialogRoot/Portal/Overlay/Content/Title`) |
| `:93-120` | 「删除索引目录?」确认弹窗 | 同上 |
| `:131-141` | `data()` 七项瞬态 | 七个组件本地 `ref`(`adding` `deleting` `purgeFiles` `submitting` `addError` `mirrorOffer` `form`)+ `fb` 模板 ref |
| `:142-148` | `computed` 三项 | `roots` / `canSubmit` / `browserRoots` |
| `:149-151` | `created()` | `onMounted(() => { store.loadRoots() })` |
| `:153-160` | `openAdd()` | 同名函数(含 `nextTick(() => fb.value?.reset())`) |
| `:161-163` | `onBrowsePick()` | 同 |
| `:164-174` | `toggle()` | 同(**R9:逐字照抄,不改逻辑** —— 论证见 §4) |
| `:175-182` | `rescan()` | 同 |
| `:183-208` | `submit(mirror)` | 同(K58/K59 两处错误落法改映射) |
| `:209-219` | `confirmDelete()` | 同(多一行 TS null 收窄) |
| `:223-289` | `<style lang="scss" scoped>` 66 行 / 9 个 `kr-*` | 🔴 **T2 已整块搬进 `knowledge.scss`;本文件零 `<style>` 块** |

**模板 `style=`/`color=` 逐处 1:1**:实测本仓 **7 个属性**,与蓝本 `:9 :15 :21 :53 :58 :73 :100` **逐个同值**
(`margin-left: auto` / `color="var(--text-tertiary)"` / `margin: 12px 16px` / `margin-top: 0` /
`margin-top: 12px` / `width: 90px` / `margin-bottom: 10px`)。**零裸色。**

**i18n**:模板 + 脚本共用 **31 个键**(与附录 A「`RootsView` 31」逐个对上),**两档全存在、零新增键**
(全部由 T1 落地)。程序化核查输出:
```
模板/脚本用到的 i18n 键 = 31
两档均存在? YES(零缺键)
aiKbAdd aiKbCancel aiKbLastScan aiKbNavRoots aiKbNever aiKbOpFailed aiKbRealtimeWatch
aiKbRescanStarted aiKbRtAddMirror aiKbRtAddRoot aiKbRtAdvancedOptions aiKbRtBackendTooOld
aiKbRtDelete aiKbRtDeleteHint aiKbRtDeleteTitle aiKbRtEmpty aiKbRtPurgeFiles aiKbRtReadOnly
aiKbRtRescanNow aiKbRtRootAdded aiKbRtRootDeleted aiKbRtRootDisabled aiKbRtRootEnabled
aiKbRtScanEvery aiKbRtScanInterval aiKbRtSelectedPath aiKbRtSubtitle aiKbRtWatchAuto
aiKbRtWatchMode aiKbRtWatchScanOnly aiKbScheduledScanOnly
```

---

## 3. 承接了 Vue2 哪些行为

`__tests__/wikiRoots.spec.js`(73 行,T0 判定「行为承接、测法按 `<script setup>` 改」)的每一条都被本刀承接
并**加密**:分组渲染 / 空态 / 开关方向 / 404 文案 / 409 镜像重试 / `purgeFiles` 两侧 /
`canSubmit` 两侧 / `submitting` 门。另新增蓝本 spec 没有的:`scanIntervalS` 的
`Math.max(1, Math.round(s/3600))` 四点边界 · `lastScanAt` 的假时钟 `fmtAgo` · `createRootBody`
三个入参的落位 · R9 不变量守卫 · `FolderBrowser` 三条接线。

---

## 4. 🔴🔴 `toggle()` 的 toast 方向:**为什么不是蓝本 bug**(裁定 R9,逐步推演)

蓝本 `:163-173`:
```js
await this.store.actions.setRootEnabled(r.id, !r.enabled)
this.store.actions.toast(r.enabled ? $t('Root enabled') : $t('Root disabled'))
```
表面读法是「调用传的是 `!r.enabled`、成功后读的却是 `r.enabled`」⇒ 文案反了。**逐步推演后不反**:

1. **`!r.enabled` 在调用发生前求值**,它就是**目标态**(旧值取反)。这一步与 toast 无关。
2. **`setRootEnabled` 是乐观更新**(`knowledgeStore.ts:736-747`,与蓝本 `:297-309` 逐行等价):
   ```ts
   const root = wikiRoots.value.find((r) => r.id === id)
   if (!root) return
   const prev = root.enabled
   root.enabled = enabled          // ← 写在 await **之前**
   try { await service.wiki.patchRootEnabled(id, enabled) }
   catch (e) { root.enabled = prev; throw e }
   ```
   赋值发生在**请求发出之前**。
3. **`v-for="r in roots"` 里的 `r` 与 store 里 `find(...)` 拿到的 `root` 是同一个对象引用** ——
   store 只改字段,没有替换数组元素;`roots` computed 直接返回 `store.wikiRoots`,不做 `map`/`slice`。
   ⇒ `r.enabled` 与 `root.enabled` 是**同一格内存**。
4. ⇒ `await` 落地后那一行读到的 `r.enabled` **已经是新值** ⇒ 三元选中的文案方向正确。
5. **失败路径**:`setRootEnabled` 先 `root.enabled = prev` 回滚、再 `throw` ⇒ 控制流进 `catch`,
   **那行成功 toast 根本不执行**,不存在「回滚了却弹成功文案」。

⇒ 走裁定 **R9** 的「论证为什么不是 bug」那一支:**逐字照抄,零逻辑改动**
(计划书 T5-7 的「若是 bug 就改正确」那一支已被 R9 撤销)。

### 4.1 🔴 但正确性挂在一个**不变量**上 ⇒ 配了三条守卫

不变量 = **「store 改的是组件手里那个同一个对象」**。本仓 store 是 Pinia `ref<WikiRoot[]>`,
将来若把就地改换成整体替换数组,**界面开关照翻,只有 toast 文案反过来,三门全绿**。
守卫在 `RootsView.test.ts > R9 不变量` 一组:
- 「关 → 开:toast 是**新**状态『已启用』」
- 「开 → 关:toast 是**新**状态『已禁用』」(另一侧)
- 「失败时**不弹**成功 toast」(且断言开关已回滚)

🔴 **判据订正(申报裁定 R18)** —— 见 §7 探针 1 / 1b。

---

## 5. 用了哪几个样本、mock 形状取自哪一层(§4.1 的表)

| 样本 | 三级标签 | 取到测试里的形状 | 用在哪 |
|---|---|---|---|
| `p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json` | 🔴 **`.CONSTRUCTED`**(**不是真机数据**) | **共享包归一化后的 camelCase**(= `store.wikiRoots` 出口) | `wiki.getRoots` 的 resolve 值 |
| `p5f-fixtures/wiki-candidates.CONSTRUCTED.json` | 🔴 **`.CONSTRUCTED`** | **HTTP 原样透传**(snake 风格 `{path,type,size?,label?}`) | `wiki.getCandidates` 非空态 |
| `p5f-fixtures/wiki-candidates.REAL.json` | 🟢 **`.REAL`**(本机真机 200 / 3 字节) | `[]` | `wiki.getCandidates` **本机态** |

- 🔴 **`__meta` 全部转成注释,一个 mock 对象里都没有它**(裁定 R14 / README §0.2)——
  一条专门的用例 `🔴 抄本里一个 __meta 都没有` 钉死。
- 🔴 **抄本等价性程序化校验**(不是肉眼比):
  ```
  $ python3 -c "…json.load(…)…"  →  ROOTS 抄本 == fixture['wikiRoots']  : True
                                    CAND  抄本 == fixture['candidates'] : True
  ```
  (见 §5.1)
- **不运行时读 `.superpowers/`**(gitignore 目录;SP7 整个丢过一次)。
- 🔴 **mock 层次**:mock 的是**共享包 `service.wiki` 的六个方法**,**走真 `knowledgeStore`**。
  这不是风格选择 —— **R9 的不变量只有走真 store 才测得出来**:mock 掉 `setRootEnabled`,
  `r.enabled` 永远不会被改,那三条守卫会退化成「断言一个恒不变的值」,判别力归零。
- 🔴 **`createRootBody` 保留真身**(`vi.mock` 用 `importOriginal` 只替换 `service`)——
  比对必须比真的那一份,不能自己写影子实现。

### 5.1 抄本等价性校验原始输出

```
$ python3 - <<'PY'
import json
fx=json.load(open('.superpowers/sdd/p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json'))
cd=json.load(open('.superpowers/sdd/p5f-fixtures/wiki-candidates.CONSTRUCTED.json'))
src=open('src/ai/knowledge/views/RootsView.test.ts',encoding='utf-8').read()
def block(const):
    i=src.index('const '+const); k=src.index('= [', i)+2; j=src.index('\n]', k)+2
    return json.loads(src[k:j])
r=block('ROOTS_NORMALIZED'); c=block('CANDIDATES_CONSTRUCTED')
print('ROOTS 抄本 == fixture[wikiRoots]  :', r==fx['wikiRoots'], ' (n=%d)'%len(r))
print('CAND  抄本 == fixture[candidates] :', c==cd['candidates'], ' (n=%d)'%len(c))
PY
ROOTS 抄本 == fixture[wikiRoots]  : True  (n=2)
CAND  抄本 == fixture[candidates] : True  (n=3)
```

---

## 6. K1–K59 逐条显式申报(本刀命中的)

| # | 落地 |
|---|---|
| **K1** | store 降层 **3 处**:`store.state.wikiRoots` → `store.wikiRoots`(computed `roots`)· `store.state.wikiCandidates` → `store.wikiCandidates`(computed `browserRoots`)· `store.state.wikiRootsLoading` → `store.wikiRootsLoading`(模板空态条件)。漏一处那一块整个空白且不报错 ⇒ 三处各有用例。 |
| **K27 / 裁定 R27** | toast **7 处全部走 `store.toast(...)`**(= toggle 2 + rescan 2 + confirmDelete 2 + submit 成功 1)。🔴 **submit 的失败路径按 K59 走弹窗内联,不弹 toast**,是本页唯一「有 catch 但不 toast」的分支。守卫:源码扫 `store.toast(` **恰好 7 次** + 零 `useToast(`(探针 5 实证)。 |
| **K41** | **零 `any`**:`WikiRoot` 从共享包 type-import;HTTP 状态码收在 `httpStatus(e: unknown)` 里用 `in` 收窄,不做断言式转型。`vue-tsc --noEmit` exit 0。 |
| **K44 / K53** | 🔴 **`.vue` 侧零 `<style>` 块**。自证(与守卫同口径,剥注释 + 行首锚定):`</style>` 计数 **0** · 行首 `<style` 计数 **0** · 裸子串 `<style` 计数 **1**(那 1 处正是注释里「零 `<style>` 块」这句话本身 —— 裁定 **R19** 认定的假阳性形态,T2b 的守卫已先剥注释故仍绿)。T2b 的 K44 参数化断言**本刀起对 `RootsView.vue` 上膛**,走「文件已存在」分支并已满足。 |
| **K54** | 两处 `var(--x, <字面量>)` 兜底**在 scss 侧**(T2 已落:`--bg-tertiary,…`→`--bg-chip`、`--border,…`→`--line`),本文件不涉及;文件头登记以免下一刀漏掉,并复述裁定 **R8**「`.kr-badge` 换 token 是**可见变化**不是等价替换」。 |
| **K57** | **两个弹窗**(新增 + 删除确认)转 reka:`DialogRoot` / `DialogPortal to=".knowledge-app" defer` / `DialogOverlay class="k-modal-bg"` / `DialogContent class="k-modal"` / `<DialogTitle as-child>` 套在蓝本自己的 `.k-modal-title` 上。🔴 **照 `SettingsView.vue`(K29)与 T4 的 `AllowlistView.vue` 同一份,零自创**。🔴 **零 `@click.stop`**(源码扫,先剥注释)。**每个弹窗三条**:打开(内容逐字)/ 关闭(× 与「取消」各一条,共两条)/ **点遮罩关闭**(同一条里连「点弹窗内不关闭」一起比)。`to` 只认第一个宿主:全仓 `.knowledge-app` 只有 `KnowledgeLayout.vue` 一处渲染,且两个弹窗**同时最多只开一个**(`adding` 与 `deleting` 互不触发),不存在歧义。 |
| **K58** | 形态 A(`p5f-task-0-report.md` §12 认定的既定做法):catch 里丢掉 `e.message`,只弹固定 i18n 键、**不留 `': '` 前缀**。四处落点全部落成 `aiKbOpFailed`(蓝本 `:171` `:180` `:216` 的 `$t('Operation failed') + ': ' + (e.message||e)` 与 `:202` 的 `e.response.data.message`)。**两个例外照抄**(形态 B 同族,第二句是蓝本固有固定文案而非后端 body):`toggle()` 的 404(N51)与 `submit()` 的 409(N50)。守卫是**排除式断言**:让 action reject 一个带 `PROBE-K58-R5T9-*` 的错误,断言 toast 文本与整页 DOM 都不含它(共 6 条用例覆盖 toggle/rescan/confirmDelete/submit 四条路径 + 裸 `Error` 形态)。🔴 探针文本**故意不出现在 `.vue` 里**。 |
| **K59** | `addError` 走**弹窗内联 `.kr-error`**(蓝本 `:77-81` 本来就是内联,这一半照抄);偏离的是蓝本 `:202` 回显 `e.response.data.message` ⇒ 非 409 改固定键。🔴 **兑现记忆 `newui-dialog-error-not-toast`**:toast 是 `z-index: 60`、弹窗遮罩 1000 还带 blur ⇒ 弹窗内的错误一律内联,写成 toast 会被压住 + 糊掉。**两条**:409 → 文案 + 「以镜像模式添加」按钮 · 非 409 → 映射文案且 `err.querySelector('button')` 为 `null`;两条都断 `toast` **未被调用**(探针 5 实证有判别力)。 |

## 6.1 N1–N58 逐条申报(确实照抄了)

| # | 照抄内容 | 守卫 |
|---|---|---|
| **N46** | **只消费不再归一化**:页面读 `r.id` / `r.path` / `r.enabled` / `r.watchMode` / `r.scanIntervalS` / `r.lastScanAt` 六个 **camelCase** 字段;发 body 一律经共享包 `createRootBody`,本仓**零重写** | ① fixture 抄本的键序 `toEqual([...])` 逐字 camelCase + 反向禁 PascalCase / snake_case;② 六个字段各有 DOM 落点用例;③ 源码断言「`createRootBody` 从 `@nimotech/nimoos-service` import」+ 反向「本文件里零 `StorageMode:` / `ScanIntervalS:`」;④ **三个入参各一条**:默认 body 逐字段 · `watchMode`+`scanIntervalH`(改高级选项 → body 跟着变)· `mirror`(409 重试 → `StorageMode: 'mirror'`),三条都同时 `toEqual(createRootBody({...}))` |
| **N49** | `pickerRoots` 自带 `(candidates || [])`,页面把 `store.wikiCandidates` 原样递进去,不再兜底一次 | 候选空 / 非空两条 |
| **N50** | 409 → 只读文案 + 「以镜像模式添加」按钮 **照抄,不删按钮** | 409 那条;⚠️ `storage_mode=mirror` **后端从未实现**(勘误 E-64)⇒ 验收清单要写「点了不会生效」;§9.17:本机是**超时**不是 409 ⇒ **真机不可达,不列真机验收项** |
| **N51** | `toggle()` 的 404 专属文案「后端版本过旧,请先部署 Wiki 服务更新。」逐字照抄 | 一条(另一条比非 404 走映射) |
| **另照抄** | `rescanRoot` 刻意**不重载列表**(store 侧,与 `deleteRoot` 不同)· `confirmDelete` 的 `deleting=null` / `purgeFiles=false` 在 **try/catch 之外**(失败也执行)· **关闭弹窗不重置 `purgeFiles`**(只有 `confirmDelete` 才重置) | 各一条;最后一条专门防「顺手修正」 |

## 6.2 Vue2 → Vue3 强制改写(治理 §2,不算偏离,但点明)

`data()` → `ref` · `computed` 对象 → `computed()` · `created` → `onMounted` · `methods` → 普通函数 ·
`this.$refs.fb` → `ref<InstanceType<typeof FolderBrowser>>`(靠 `FolderBrowser.vue:97` 的
`defineExpose({ reset })`)· `this.$nextTick` → `nextTick` · `this.$t` → `useI18n().t` ·
`this.store.actions.x()` → `store.x()` · `methods: { fmtAgo }` → 直接 `import { fmtAgo }`。

🔴 **唯一一处「蓝本没有、本仓多出来」的产品代码行**:`confirmDelete()` 里的 `if (!r) return`
—— **TS 的 null 收窄要求**(蓝本 `deleting` 无类型,本仓是 `WikiRoot | null`)。
**不可达分支**:该函数只能从「只在 `deleting` 非空时才渲染」的弹窗里点到。代码注释已标明。

## 6.3 🔴 申报:brief 未点名的两处小整理(承裁定 R22)

1. **`RootsView.test.ts` 内部把三份重复的「剥注释」内联代码提成一个 `blankComments()` helper**
   —— 只发生在**本刀新建的测试文件内部**,不动任何既有文件。顺带**加固**了它:
   块注释的起点要求「前面是空白或行首」(理由见 §8 的发现 ①)。
2. **`RootsView.vue` 的 `emptyForm()`** —— 蓝本 `:135-140` 与 `:154` 两处写了**同一份字面量初值**;
   本仓提成一个返回该字面量的函数,**值逐字未变**,两处都调它。理由:两份字面量分头漂移正是
   「重开弹窗初值不一致」这类静默缺陷的温床;守卫是「openAdd 把表单重置回初值」那条用例。

---

## 7. RED→GREEN 证据(6 条探针,全部 `cp` 还原 + `md5sum` 逐字节比对)

> 🔴 纪律:`cp` 备份 → **行首锚定注入** → **先证注入落盘**(贴回读) → 跑全量该文件 →
> **核到具名 failed 用例**(不只看退出码,R13 同族) → `cp` 还原 → `md5sum` 比对。
> **全程零 `git checkout/restore/stash`。**

### 探针 1(brief 的字面判据)—— 🔴 **实测不成立,申报裁定 R18**

**注入**(`knowledgeStore.ts`,把 `root.enabled = enabled` 挪到 `await` 之后):
```
  async function setRootEnabled(id: string, enabled: boolean): Promise<void> {
    const root = wikiRoots.value.find((r) => r.id === id)
    if (!root) return
    const prev = root.enabled
    try {
      await service.wiki.patchRootEnabled(id, enabled)
      root.enabled = enabled
    } catch (e) {
      root.enabled = prev
      throw e
    }
  }
```
**结果**:
```
exit=0
      Tests  60 passed (60)
--- 具名 failed 用例 ---
(空)
```
🔴 **全绿 —— 裁定 R9 / brief 给的这条判据不成立。**
**原因**:那行挪到 `await` 之后仍在 `setRootEnabled` 这个 async 函数**内部**;调用方
`await store.setRootEnabled(...)` 是在该函数**返回之后**才恢复的,那时赋值早已完成
⇒ `r.enabled` 照样是新值。**「在 await 之前还是之后」根本不是判别轴。**
`md5sum` 还原:`1d09f5a1c7d01983ee7f370363002088`(与注入前一致)。

### 探针 1b(实测成立的判据)—— 🔴 **3 条 RED**

**注入**(把就地改换成**整体替换数组** —— 正是裁定 R9 自己点名的未来风险):
```
    const prev = root.enabled
    wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled } : r))
    try {
      await service.wiki.patchRootEnabled(id, enabled)
    } catch (e) {
      wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled: prev } : r))
      throw e
    }
```
**结果**:
```
exit=1
 FAIL  … > R9 不变量:toggle() 成功后 toast 读到的是**新**状态 > 🔴 关 → 开:toast 是「已启用」(不是旧状态的「已禁用」)
 FAIL  … > R9 不变量:toggle() 成功后 toast 读到的是**新**状态 > 🔴 开 → 关:toast 是「已禁用」(另一侧,同一个不变量)
 FAIL  … > R27:7 处 toast 全部经 store.toast(不是直调 useToast) > toggle / rescan / confirmDelete 三条成功分支都被 store.toast 的 spy 捕获
      Tests  3 failed | 57 passed (60)

AssertionError: toast 读到的是**旧**值 —— store 不再就地改组件手里那个对象了(多半被换成了整体替换数组)
- Expected  [ "已启用" ]
+ Received  [ "已禁用" ]
```
🔴 **判别轴 = 「组件手里那个对象有没有被改到」**。测试注释与 `RootsView.vue` 文件头**都已订正**成这条判据,
并写明 brief 的字面版实测全绿 —— **下游复跑请用这一条。**
`md5sum` 还原:`1d09f5a1c7d01983ee7f370363002088` ✅

### 探针 2(追加项 a,裁定 R24 的 Important I-1)—— 🔴 **2 条 RED**

**注入**(把 K5/K58 最核心的禁令「回显后端 `e.message`」写进 `AllowlistView.vue` 的 `toggle()` catch):
```
async function toggle(ext: string, enabled: boolean): Promise<void> {
  try {
    await store.toggleExtension(ext, enabled)
    store.toast(enabled ? t('aiKbAlNowIndexing', { ext }) : t('aiKbAlStoppedIndexing', { ext }))
  } catch (e) {
    store.toast(t('aiKbAlSaveFailed') + ': ' + (e instanceof Error ? e.message : String(e)))
  }
}
```
**结果**:
```
exit=1
 FAIL  … > 🔴 K58(T5 追加)—— toggle 失败:只弹固定键「保存失败」,不回显后端 body
 FAIL  … > 🔴 K58(T5 追加)—— 关闭态 chip 的 toggle 失败走同一条 catch(另一侧,同样不回显)
      Tests  2 failed | 52 passed (54)

AssertionError: expected last "wrappedAction" call to have been called with [ '保存失败' ]
- Expected  [ "保存失败" ]
+ Received  [ "保存失败: PROBE-K58-8Q3Z-toggle" ]
```
🔴 **恰好是这两条新用例报红、既有 52 条一条不动** —— 正好复现评审说的「52/52 全绿」缺口,
并证明**补上的就是那个缺口本身**。
`md5sum` 还原:`ca2f70c07596446bd82844a786a5ada4` ✅

### 探针 3a / 3b(`reset()` 判据的**两半**)—— 各 1 条 RED

| 探针 | 注入 | 结果 |
|---|---|---|
| **3a** 去掉 `reset()`(留 `nextTick`) | `nextTick(() => { void fb.value })` | `Tests 1 failed \| 59 passed (60)`,具名:`🔴 openAdd 真的调了 FolderBrowser.reset()…` |
| **3b** 去掉 `nextTick`(留 `reset()`) | `fb.value?.reset()`(同步) | `Tests 1 failed \| 59 passed (60)`,同一条具名用例 |

🔴 **为什么这条用例必须用 stub 而不是 `vi.spyOn(fb.vm, 'reset')`**(实测结论,已写进测试注释):
reka 的 `DialogContent` 走 `Presence` ⇒ **弹窗一关,`FolderBrowser` 整个卸载**
(实测:关弹窗后 `findComponent(FolderBrowser).exists() === false`、重开后面包屑从 2 条回到 1 条)。
所以「关掉再开」拿到的是**新实例**,装在旧实例上的 spy 永远捕不到;而「弹窗已开时再点一次」
虽然同实例、spy 也能捕到,但那条路径下 `fb.value` 早已非空 ⇒ **拿掉 `nextTick` 仍绿,只守住一半**。
用自带 `defineExpose({ reset: spy })` 的 stub 替掉子组件后,**两半各自都能报红**。
`md5sum` 还原:`0e155b7629340ead0c8e8dc233e13362` ✅

### 探针 4(文件清单登记是不是真的载荷)—— 1 条 RED

撤销 `knowledgeStyles.test.ts` 里 `'views/RootsView.vue'` 那一行:
```
exit=1
 FAIL  … 守卫缺口③′ … > 文件清单集合相等(防漂移:新增视图必须显式进清单,否则本条报红)
      Tests  1 failed | 412 passed (413)
```
⇒ 那条集合相等断言**真的有牙**,登记是必需动作(**不是去改断言**)。`md5sum` 还原 ✅

### 探针 5(K59 —— 内联 vs toast)—— 3 条 RED

把 `submit()` 非 409 分支的 `addError.value = t('aiKbOpFailed')` 改成 `store.toast(...)`:
```
exit=1
 FAIL  … K59 … > 🔴 非 409(500)→ K58 映射文案「操作失败」,且**没有**镜像按钮
 FAIL  … K59 … > 🔴 裸 Error(无 response)也走映射,不回显 e.message(蓝本 :202 的第三条兜底)
 FAIL  … R27 … > 🔴 源码里零 `useToast(` 直调(治理 §5.1 / 裁定 R27)
      Tests  3 failed | 57 passed (60)
```
(第三条响是因为它顺带钉了 `store.toast(` **恰好 7 次**。)`md5sum` 还原 ✅

### 探针 6(N46 的下划线陷阱)—— 1 条 RED

把 `createRootBody({...})` 的 `watchMode` 入参整个删掉(= 真机上会被后端静默用默认值、无报错):
```
exit=1
 FAIL  … submit():createRootBody 的三个入参真的传到位(N46) > 🔴🔴 watchMode / scanIntervalH 两个入参真的传到位(改高级选项 → body 跟着变)
      Tests  1 failed | 59 passed (60)
```
`md5sum` 还原:`RootsView.vue` 与探针前一致 ✅

---

## 8. 🔴 本刀的两个发现(下游必须知道)

### ① 裸 `/\*[\s\S]*?\*\/` 剥块注释会吃掉真代码(E-25 / 裁定 R19 同族,**本刀实测撞到**)

核 `AllowlistView.vue` 的 `store.toast` 落点数时,裸块注释正则数出 **9**,与逐行读出的 **10** 对不上。
逐步定位:`saveRule` 里的路径字面量 **`'/Downloads/*'`** 里的 `/*` 被当成块注释起点,
一路吃掉后面几行**真代码**(包括 `saveRule` 的那一处 `store.toast`)。原始输出:
```
raw store.toast( = 12
after html-comment strip = 10      ← 正确值
after block-comment strip = 9      ← 被吃掉一处真代码
after line-comment strip  = 9
```
🔴 **落地**:`RootsView.test.ts` 的 `blankComments()` 要求块注释的 `/*` **前面是空白或行首**;
并给三条结构性否定断言各加了**防空转锚点**(剥完必须还能找到 `onDeletingOpen` / `DialogPortal` /
`createRootBody({`),避免「剥注释器坏了 → 否定断言假通过」。
教训已写进 `AllowlistView.test.ts` 那段订正注释,供下游复用。

### ② `store.toast` 落点数确认 = **10**(追加项 b,已订正)

口径:`AllowlistView.vue` 里 `store.toast(` 共 **12** 处,其中 **2** 处在文件头的 `<!-- -->` 注释里
(第 76、79 行,讲的正是这条约定本身)⇒ **真落点 10 = 5 个成功 + 5 个 catch**。
原写「9 = 5 成功 + 4 catch」漏数了 `toggle()` 的 catch —— **正是探针 2 那个零守卫的落点**,两件事同源。
🔴 **只改了注释与用例名,一条断言都没动**(裁定 R24 明令)。`git diff` 的 2 行删除**全部是
describe / it 的标题行**,可逐行核。

---

## 9. 追加项 c —— 附录 B §B.5 订正(守「反转不删」)

裁定 R24 只点了「`AllowlistView` 6 → 8;`RootsView` 那行也不自洽」。
🔴 **T5 自己数了两遍(R21:换一条独立口径复证 + 贴两条原始输出),发现 `WikiView` 那行也是错的**:

| 文件 | 原写 | 🔴 实测 | 漏掉的行 |
|---|---|---|---|
| `AllowlistView.vue` | 6 | **8** | `:143` |
| `RootsView.vue` | 5(却列了 7 个行号) | **7** | 无漏行,数字与自列行号不自洽 |
| `WikiView.vue` | 8 | **9** | **`:12`**(协调者未点,T5 发现) |

两条独立口径(awk 行扫 / python 属性扫)**逐行完全一致**,且「属性出现次数 = 所在行数」
⇒ 上表原文那句「差异仅在怎么数一行里的多个属性」在本期**不成立**,真因是**漏行**。
新增的三行都是纯尺寸/排版,**零色字面量 ⇒ 对 §B.3 的色映射结论零影响**。
落法:**原文一律保留 + 新增 §B.5.1 订正块,引条目编号 R24 / R21**(不引 `file:line`)。
🔴 **T7 写 `WikiView` 时按 9 处核,别按 8 处。**

---

## 10. 三门完整终值 + 用例数归因(自洽核对)

```
$ pnpm test                    → exit=0    Test Files  338 passed (338)
                                           Tests      4545 passed (4545)
$ pnpm exec vue-tsc --noEmit   → exit=0
$ pnpm build                   → exit=0    ✓ built in 13.82s
```
日志落盘:`/tmp/p5f-t5-test.log` · `/tmp/p5f-t5-tsc.log` · `/tmp/p5f-t5-build.log`(**无 `| tail`**)。
**零红项**;已知噪声(`persist.test.ts > dropPersisted` / `AgentComposer.test.ts`)本次**未发生**。

**文件数**:337 → **338**(+1 = `RootsView.test.ts`)✅ 与协调者预期一致。

**用例数归因表**(🔴 与总数自洽,裁定 R24-P5e):

| 来源 | 增量 | 实测复核 |
|---|---|---|
| 起点(T4 收官) | **4477** | 协调者给定 |
| 🆕 `RootsView.test.ts` | **+60** | 单跑 `Tests 60 passed (60)` |
| `AllowlistView.test.ts` 追加项 a | **+2** | 单跑 `54`(原 52) |
| `color-guard.test.ts`(`**/*.vue` 动态生成,零改动) | **+1** | 单跑 `189`(原 188);`.vue` 总数 `find src -name '*.vue' \| wc -l` = **187**(原 186) |
| `knowledgeStyles.test.ts`(4 个 `it.each(KNOWLEDGE_VUE_FILES)` 各 +1,+ K44 的 `it.each(knowledgeVues)` +1) | **+5** | 单跑 `417`;探针 4(撤销登记)时为 `413` = 412 + K44 那 1 例 ⇒ 登记带来 +4,K44 带来 +1 |
| **合计** | **4477 + 60 + 2 + 1 + 5 = 4545** | ✅ **与 `pnpm test` 的 4545 完全相等** |

**其它基线**:`.vue` **187**(计划书预期 187 ✅)· `color-guard` **189**(预期 189 ✅)。

---

## 11. §9.17「本机可点性」落地

| 屏 / 元素 | 本机 | 本刀怎么办 |
|---|---|---|
| 根列表 / 开关 / 重扫 / 删除 | 🔴 **全不可达**(D1:`/v1/wiki/roots` 90 s 零字节超时) | 只在单测里验,**验收清单要标「不可达 ≠ 缺陷」** |
| `kr-empty` 空态 | 🟢 **本机唯一可达态** | 一条正向 + 一条「加载中不弹空态」 |
| 新增弹窗 | 🟢 可达(纯前端);`FolderBrowser` **候选恒空** ⇒ 走 `pickerRoots` 兜底三根 | 两态各一条 |
| `kr-error` / 镜像按钮 | 🔴 **不可达**(超时不是 409) | **不列真机验收项**;单测三条 |

🔴 **测试里每一条「点某个东西」都先确认它在该条数据下真渲染成可点元素**——
本刀因此**实测栽过一次**:R27 那条用例最初先 toggle 再 rescan,把第 0 行关掉后
`:disabled="!r.enabled"` 让重扫按钮变灰,那一发 click **静默不发生**;已改成先 rescan 再 toggle,
并加了一条前置 `disabled === false` 断言把这件事钉住。

---

## 12. 顾虑 / 交下一刀

1. 🔴 **裁定 R9 的 RED 判据在裁定书里是错的**(探针 1 实证全绿)。已在两处代码注释订正,
   **建议协调者在裁定书里也登记一条订正**,免得终审拿字面判据去复跑得出「守卫是空壳」的错误结论。
2. 🔴 **附录 B §B.5 的 `WikiView` 行也是错的(8 → 9,漏 `:12`)** —— 协调者未点,T5 实测发现并已订正。
   **T7 按 9 处核。**
3. **`reset()` 在本仓的 reka 版里已无可观测副作用**(`DialogContent` 走 `Presence`,关窗即卸载)。
   **照抄不删**(蓝本 1:1),守卫钉的是「这一步真的还在被调用」。若将来有人以「它是死代码」为由删它,
   本条守卫会报红 —— **那时请看这段说明,别顺手放宽守卫**。
4. **`AllowlistView.test.ts` 的 2 行删除全部是 describe/it 标题行**(裁定 R24 授权的「只改用例名」),
   `git diff` 可逐行核;**断言零改动、既有 52 例零行为变化**(探针 2 的 `52 passed` 佐证)。
5. **本刀未跑收官刀的「构建管线」门**(`rm -rf dist && grep RootsView dist/assets/*.js`)——
   路由挂载归 **T8**,现在 `RootsView` 还没有任何 import 它的活代码路径,那条门此刻必然零命中,
   **不构成证据缺口,但 T8 必须跑**(且要先抓「改之前搜不到」)。

# SP8-P5f · Task 7 报告 —— `WikiView.vue` **下半**(摘要 / 目录 / 最近变更 / 源码切换 / 重扫)

| | |
|---|---|
| 工作区 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai` |
| 起点 | **`207299f`**(`git log --oneline -1` 现测确认:`docs(p5f): 裁定 R28 —— T6 关账…`) |
| 蓝本 | `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/WikiView.vue`(314 行)。🔴 **全程未在那个仓做任何 `checkout`/`stash`/`commit`** |
| 改动文件 | `views/WikiView.vue`(+237/−18)· `views/WikiView.test.ts`(+931/−41)· `.superpowers/sdd/p5f-appendix-B-tokens.md`(§B.5 订正块) |
| 新建文件 | **0**(brief 明令零新建) |
| 三门 | `Test Files 339 passed` / `Tests 4658 passed` / `vue-tsc --noEmit` exit 0(**日志 0 行**)/ `pnpm build` exit 0 |

---

## 0. 🔴🔴 开工前置(裁定 **R28**)—— `extractTemplate` 的裸 `indexOf` 已闭合

### 0.1 T6 的原实现错在哪(评审 I-1 复述,本刀实测复核)

```
T6:  const start = src.indexOf('<template>')      // 裸 indexOf,无列锚定
```
`WikiView.vue` 的**文件头 HTML 注释**里有一句说明 K56 的散文:
「…本文件 `:key="c.path"` 写在 `<template>` 自身,」—— 裸 `indexOf` 撞上这个**同名字面串**,
起点锚到文件头注释中间,抽出 448 行、**含整个 `<script setup>`**。三条后果见裁定 R28。

### 0.2 本刀的修法 —— **只加固,不放宽**(§9.10)

照抄本仓已有的正确写法(`src/ai/styles/knowledgeStyles.test.ts` 的同名函数):

1. **第 0 列锚定** —— 只认「行首 + `<template>` + 换行」;`</template>` 要求整行严格等于它;
2. **覆盖度自检** —— 两条**独立推导**(字符串 `indexOf/lastIndexOf` vs **逐行**倒扫)必须逐字相等,
   且片段必须以模板**原始最后 3 行**收尾;
3. **反向防空转(新增)** —— 抽出块**不许**含 `<script setup` 与 `const showSource = ref(`,
   并配「文件里真的有这两个串」的防空转前置;
4. **真实文件偏态 A(新增)** —— 见 §0.3。

返回类型从 `string` 改成 `{ tmpl, byLine, tail }` ⇒ 三个合成串调用点改成 `.tmpl`。
🔴 **既有断言一条都没被削弱**:每一条的语义原样保留,新增的四条全是**更强**的约束。
`git diff` 里那 41 行删除的归属逐条见 §7。

### 0.3 🔴 两种偏态各验一次(brief DoD 0 的硬要求)

#### 偏态 A —— 「注释里写了 `kw-summary`,但没有真 markup ⇒ 必须绿」

🔴 **本刀第一版的偏态 A 是零判别力的,被自己的 RED 探针当场逮到,已重写。**
第一版把说明句放在文件头注释的**开头**(`head` 原样 + 最小模板体)。
实测(**probe1**,裸 `indexOf` 探针)只报红 2 条,**偏态 A 仍绿** ⇒ 它压根没复现 R28 的失效形态。

**根因(本刀推演 + 实证)**:裸 `indexOf` 的起点落在文件头注释里那个 `<template>` 字面串上
⇒ **只有排在它之后**的那半截注释会被切进「模板块」,而且开头的 `<!--` 已被切掉、剥注释器剥不掉它
⇒ 谓词才读得到注释里的 `class="kw-summary kw-md"`。**排在它之前的注释反而不会进来。**

**重写后**:把说明句注入到文件头注释的**收尾 `-->` 之前**(= 裸锚点之后),并配两条防空转
(① 文件头里真的有 `<template>` 字面串;② 注入点确实排在裸锚点之后)。

| 探针 | 注入 | 结果 |
|---|---|---|
| **probe1**(第一版偏态) | `extractTemplate` 的第 0 列锚定循环 → `src.indexOf('<template>')` | `2 failed \| 98 passed` —— **偏态 A 未响** ⇒ 判定为零判别力,重写 |
| **probe1b**(重写后) | 同上 | 🔴 **`3 failed \| 97 passed`**,红的三条:<br>`× 🔴 覆盖度自检(裁定 R28)…`<br>`× 🔴 反向防空转(裁定 R28)—— 抽出块**不许**含 \`<script setup\`…`<br>`× 🔴 真实文件偏态 A(裁定 R28)—— 文件头注释里写了 kw-summary,但只有注释 ⇒ 必须判「没上膛」` |

**当前(第 0 列锚定)状态下,偏态 A 是绿的** —— 而本刀的文件头**真的**写了
`class="kw-summary kw-md"` 那句话(见 `WikiView.vue` 头部「T7(本刀)搬入的」一节),
这正是评审预言「T7 极可能踩」的那句;现在它不再触发假报红。

#### 偏态 B —— 「真写了 markup 但缺 `showSource` 切换按钮 ⇒ 必须红」

**probe2**:把 `kw-foot` 里那个 `<button @click="showSource = !showSource">` 整块替换成一条注释。

```
Tests  5 failed | 95 passed (100)
× 🔴 本体条件断言:模板一旦出现 kw-summary,就必须同时有 showSource 切换按钮(T7 起已上膛)
× 🔴 每次取文章都把 showSource 重置回 false(蓝本 :264)—— 换选中后回到渲染视图
× 源码视图走的是 `{{ raw }}` 文本插值,不是 v-html —— 危险串一个元素都变不出来
× ② raw 非 null + showSource=true → `pre.kw-rawsrc` 逐字显示原文,`.kw-summary` 消失
× 🔴 文案在「查看原文」/「渲染视图」之间翻转,点一次翻一次
```
🔴 **自动上膛守卫的本体条件断言确实报红** ⇒ 上膛成功、判据成立。

### 0.4 上膛状态自证(brief DoD 1)

新增一条 `🔴 上膛状态自证(T7)—— 本文件模板**确实**已经含 kw-summary(上一条不再走惰性分支)`,
把「惰性分支已经不再被走到」这件事程序化钉死 —— 否则谁把 markup 挪走,本体条件断言会**静默回到惰性通过**。

---

## 1. 逐文件改了什么

### 1.1 `src/ai/knowledge/views/WikiView.vue`(续写下半)

| 蓝本 `file:line` | 本仓落点 | 说明 |
|---|---|---|
| `:83-87` | 模板 `kw-rawsrc` / `kw-summary kw-md` 二选一 | `v-html="html"`,§9.15 唯一 XSS 面 |
| `:88-95` | 模板 `kw-pending` 那屏 + `v-if="owningRoot"` 重扫按钮 | §9.17 可点性 |
| `:97-117` | 模板目录区 `kw-sec` / `kw-children` / `kw-child*` | `childIsDir` / `isOpaque` / `fmtTs` |
| `:119-132` | 模板最近变更 `kw-sec` / `kw-changes` / `kw-change*` | `data-type` ← `opToType` |
| `:134-140` | 模板页脚 `kw-foot` + 切换按钮 | `{path}` = `sel + '/.wiki.md'` |
| `:156` | `OP_LABEL_KEYS`(模块常量) | 四个值换成 `aiKbWkOp*` 键 |
| `:174` | `const rescanBusy = ref(false)` | `data()` 的第十一项(T6 落了十项) |
| `:197` | `const html = computed(...)` | `renderWikiMarkdown(raw || '')` |
| `:198-208` | `const changes = computed(...)` | slice / 前缀剥离 / opToType / 标签 / timeFmt |
| `:282` | `childIsDir()` | |
| `:283-286` | `childPath()` | **N58 恒等式,照抄不化简** |
| `:287-291` | `childClick()` | 两分支 |
| `:295-307` | `rescan()` | 双门 + K58 形态 A + `finally` |
| `:308-311` | `fmtTs()` | |

文件头新增四个申报块:**T7 搬入清单** · **§9.15 XSS** · **N58** · **N49**;
并把 T6 的「结构对照」表补上 `:83-141` / `:156` 五行,以及把 `data()` 那行的口径写明
「**不含 `store`**;蓝本 `data()` 共 12 个键」(顺手兑现 T6 评审 M-5,只改注释)。

### 1.2 `src/ai/knowledge/views/WikiView.test.ts`(续写)

- §0 的 `extractTemplate` 加固 + 4 条新守卫;
- 两份新抄本(`NODE_RAW_DATA` / `WIKI_RAW_REAL_EXCERPT`)+ `toNodeShape()` + 4 条抄本自检;
- `openFileInNewTab` 加进 `openInApp` 的 mock;
- 7 组新 describe(§9.15 / raw 两分支 / showSource 文案 / childMap / changes / rescan / kw-foot);
- 6 条「改黑盒」(见 §7)。

### 1.3 `.superpowers/sdd/p5f-appendix-B-tokens.md`

§B.5 新增 **B.5.1 订正块**(守「反转不删」):登记该表**已连错三行**(Allowlist 6→8 · Roots 5→7 · Wiki 8→9),
并贴本刀的**现测**逐处清单。见 §6。

---

## 2. 🔴🔴 §9.15 —— XSS 用例走的是**真** `renderMarkdown`(K49 同族第二次)

### 2.1 「没被 mock」是程序化自证的,不是自我声明

```ts
it('🔴 前置自证:`renderMarkdown` **没有**被 mock(判据:谁去 vi.mock 它,本条立刻报红)', () => {
  expect(vi.isMockFunction(renderMarkdown), 'renderMarkdown 被 mock 了 —— XSS 用例退化成安慰剂').toBe(false)
  expect(renderMarkdown('# hi')).toContain('<h1>')   // 真渲染产物自检
  expect(renderMarkdown('')).toBe('')
})
```
🔴 **本文件全文零 `vi.mock('../../markdown/renderMarkdown')`**;被 mock 的只有
`@nimotech/nimoos-service`(`service.wiki.*` 四个方法)与 `../../services/openInApp`(两个跳转函数)。

### 2.2 判据落在**本刀的代码**上 —— 挂载真组件后查真实 DOM

`🔴 注入 <script> 与 onerror ⇒ DOM 里没有 script 元素、没有 onerror 属性`:

- `el.querySelector('script')` → **null**;`w.element.querySelectorAll('script').length` → **0**;
- 逐元素查属性:`all.filter(n => n.hasAttribute('onerror'))` → **`[]`**;`el.querySelector('img')` → **null**;
- 🔴 **防空转**:正常 markdown 结构**仍在** —— `h1` = `标题仍在` · `li` = `列表项仍在` · `code` = `inline code 仍在`;
- 危险串以**转义后的纯文本**留在页面(`el.textContent` 含 `alert(1)`)⇒ 证明它**确实被喂进来了**,不是没到达。

🔴 **申报一处口径**:断言**不查 `innerHTML` 文本**。`markdown-it` 的 `html:false` 会把
`<img src=x onerror=1>` **转义成可见文本** ⇒ `innerHTML` 里必然还留着 `onerror=1` 这几个字。
「文本里有没有那几个字」与「有没有活的 `onerror` 属性」是两回事,**只有逐元素查属性才有判别力**。

### 2.3 正常路径用 `.REAL` 的真 `.wiki.md`

`WIKI_RAW_REAL_EXCERPT`(**`.REAL`** —— 本机 `GET /v1/wiki/raw?path=/DATA` 的真响应正文,
README §0 表里唯一**逐字节未改**的一份)喂进去 → 渲染出 3 个 `h2`(**后两个**是 `Summary` / `Child Map`)、
5 个 `li`、`li code` = `.snapshots/`,零 `script`,且真文件里的 HTML 注释没变成活元素。

> ⚠️ **实测校正并申报**:第一版断言写的是「`h2` 恰好是 `['Summary','Child Map']`」,**实测 3 个**。
> 真因:front-matter 的收尾 `---` 被 `markdown-it` 当成 **setext 二级标题的下划线**,前面那段 yaml 变成第 1 个 `h2`。
> 🔴 **这是真实渲染结果,照实断言**(没有去「修」输入,也没有去动 `renderMarkdown`)。

### 2.4 RED 证据(probe11)

把 `html` 从 `renderWikiMarkdown(raw || '')` 换成 `raw || ''`(绕过消毒器):

```
Tests  4 failed | 96 passed (100)
× 🔴 注入 <script> 与 onerror ⇒ DOM 里没有 script 元素、没有 onerror 属性
× 🔴 正常路径:`.REAL` 的真 .wiki.md 原文渲染出标题 / 列表 / 行内 code,且零 script
× 🔴 ① 逻辑交错 …(连带:`.kw-summary` 的文本断言依赖真渲染)
× 🔴 ③ catch 分支也有守卫 …(同上连带)
```

### 2.5 另一半在 T3

「`renderWikiMarkdown` 就是转发 `renderMarkdown`」那条断言在
`util/wikiViewHelpers.test.ts`(T3 产出,`expect(renderWikiMarkdown(src)).toBe(renderMarkdown(src))`)
—— **本刀不重复**,也没碰那个文件(md5 `99ad3de4670fd9827eebf9eff505dbff`,与 T6 评审记录一致)。

---

## 3. RED 探针总表(全部 `cp` 备份 → Python 精确唯一注入 → 先证注入落盘 → 跑 → `cp` 还原 → `md5sum -c`)

🔴 **全程零 `git checkout / restore / stash`**;注入脚本对锚点做 `count == 1` 断言(不唯一直接 assert 失败)。
基线 md5:`WikiView.vue` `938098e0cda42b46d52426e926d78761` · `WikiView.test.ts` `0da882995f4113ed0965b49c635d8a3c`。
**每一条探针跑完都 `md5sum -c` 通过。**

| # | 注入 | 结果 | 具名 failed(节选) |
|---|---|---|---|
| **1** | `extractTemplate` → 裸 `indexOf`(**第一版偏态 A**) | `2 failed \| 98` | 偏态 A **未响** ⇒ 本刀据此重写偏态 A |
| **1b** | 同上(**重写后**) | 🔴 `3 failed \| 97` | 覆盖度自检 · 反向防空转 · **真实文件偏态 A** |
| **2** | 拿掉 `kw-foot` 的 `showSource` 切换按钮 | `5 failed \| 95` | **本体条件断言**(自动上膛守卫)+ 4 条连带 |
| **3** | `childClick` 一律 `openFileInNewTab` | `2 failed \| 98` | **`childClick` 分支 A** + N58 根路径那条(同因连带) |
| **4** | `childClick` 一律 `select` | `1 failed \| 99` | **`childClick` 分支 B** |
| **5** | 去掉 `.slice(0, 10)` | `1 failed \| 99` | **`.slice(0, 10)` 上限:抄本 12 条只渲染 10 条** |
| **6** | 去掉 `rescanBusy` 函数门 | `1 failed \| 99` | **rescanBusy 在飞 ⇒ 第二发不发(函数门)** |
| **7** | 删掉 `rescan` 的 `finally` | `1 failed \| 99` | **`finally` 里 rescanBusy 归位:失败之后还能再发一次** |
| **8** | 去掉重扫按钮的 `v-if="owningRoot"` | `1 failed \| 99` | **④ `owningRoot` 为 null 时重扫按钮整块不渲染** |
| **9** | 去掉前缀剥离(一律全路径) | `2 failed \| 98` | **前缀剥离两侧** + slice 那条(连带) |
| **10** | 去掉 `:disabled="rescanBusy"` | `1 failed \| 99` | **对照层:第一发在飞时按钮真的是 disabled** |
| **11** | `html` 绕过 `renderWikiMarkdown` | `4 failed \| 96` | 见 §2.4 |
| **12** | 去掉未知 op 的 `|| 'aiKbWkOpUpdated'` 兜底 | `1 failed \| 99` | **OP_LABEL_KEYS —— op='chmod' 的标签文案是「更新」** |
| **13** | 去掉 `rescan` 的 `!root` 那一半(**第一版**) | 🔴 `100 passed` | **零判别力 —— 本刀自己逮到,已修**(见 §3.1) |
| **13b** | 同上(**修后**) | `1 failed \| 99` | **owningRoot 为 null ⇒ 静默返回,零请求、零 toast** |
| **14** | 去掉 `v-if="c.isOpaque"` | `1 failed \| 99` | **`c.isOpaque` → 「已折叠」提示,两侧** |
| **15** | 去掉模板里 `c.lastModified ? … : ''` 三元 | 🔴 `100 passed` | **恒等冗余对 —— 已申报**(见 §3.2) |
| **16** | `v-if="node && node.childMap.length"` → `v-if="node"` | `1 failed \| 99` | **`v-if="node && node.childMap.length"` 两侧** |
| **17** | `data-kind` 写死 `'dir'` | `1 failed \| 99` | **`childIsDir` 决定 data-kind 与图标** |
| **18** | 去掉 `kw-foot` 的 `v-if="raw !== null"` | `2 failed \| 98` | **kw-foot 的 v-if** + N48 那条(连带) |
| **19** | `{path}` 插值改成 `sel`(不拼 `/.wiki.md`) | `2 failed \| 98` | **`{path}` 插值** + 「换选中之后跟着变」 |
| **20** | 去掉 `v-if="changes.length"` | `1 failed \| 99` | **`v-if="changes.length"` 两侧** |
| **21** | 模板三元 **+** `fmtTs` 自带兜底**同时**去掉 | `1 failed \| 99` | **`c.lastModified ? fmtTs(...) : ""` 两侧** |

### 3.1 🔴 自曝:`!root` 那道门的第一版守卫**零判别力**(probe13,本刀自己逮到)

第一版只断 `expect(rescanRoot).not.toHaveBeenCalled()`。
**去掉 `!root ||` 之后仍然 100 全绿** —— 真因:门去掉后 `root.id` 会先抛 `TypeError`,
`rescanRoot` **照样没被调到**,只是多弹一个「操作失败」toast。
⇒ **真正的判别轴是「有没有副作用」**,断言必须落在 toast 上。
修后(probe13b)`1 failed | 99 passed`,红的正是本条。
🔴 **代码里已把这段推理写成注释**,免得下一刀把它当冗余删掉。

### 3.2 🔴 申报:`c.lastModified ? fmtTs(...) : ''` 是**恒等冗余对**(N58 同族的第二处)

模板里的三元与 `fmtTs` 自带的 `ms ? fmtAgo(ms) : ''` **互为冗余**:
`fmtTs('')` → `parseTs('')` 回 0 → 本来就回空串 ⇒ **单去掉任一侧都观测不到差别**(probe15 实测 100 全绿)。
⇒ 该用例守的是**可观测行为**(缺时间戳那一格必须是空的),**不是那个三元本身**;
**两处兜底同时去掉才报红**(probe21 实证)。🔴 **照抄不化简**,理由同 N58。

---

## 4. §3 的 K1–K60 里本任务命中的(逐条显式申报)

| # | 命中处 | 怎么落的 |
|---|---|---|
| **K1** | `store.rescanRoot(root.id)` / `store.toast(...)` | 蓝本 `this.store.actions.x()` → Pinia setup store 的 `store.x()`,**`state`/`actions` 两层消失** |
| **K5 / K58 形态 A** | `rescan()` 的 catch | 蓝本 `:303` 回显 `e.message`;本仓**丢掉 `e.message`,只弹固定键 `aiKbOpFailed`,不留 `': '` 前缀**。与 T6 的 `fetchArticle` catch **同一份写法**,**不自造第二套映射**。判据是排除式断言(注入 `PROBE-T7-RESCAN-500` → toast 与整页 DOM 都不含它) |
| **K27 同族 / 勘误 E-62** | `rescan()` 的两处 toast | 🔴 **一律 `store.toast(...)`**(直调 `useToast()` 会丢掉蓝本自己的 2400 ms)。**全文件 3 处 toast 调用,全部是 `store.toast(...)`**(`:446` T6 的 `fetchArticle` catch · `:506` 重扫成功 · `:508` 重扫失败)。⚠️ **申报口径**:裸 `grep -c useToast` 在本文件回 **2**,但两处**全在文件头注释里**(T6 的 K27 申报块)—— **import 清单里没有 `useToast`,零调用**(承 R19:存在式判据不许用裸子串) |
| **K41** | 零 `any` | `grep -nE ': any\|<any>\|as any' WikiView.vue` → **零命中**;`changes` 的行形状用具名 `interface WikiChangeRow`,`type` 字段用 `ReturnType<typeof opToType>` |
| **K44** | `.vue` 侧零 `<style>` 块 | `grep -c '</style>' WikiView.vue` → **0**;`knowledgeStyles.test.ts` 的 K44 参数化断言全绿 |
| **K9** | 下半用到的 21 个 `kw-*` 类 | 全部由 T2 搬进 `knowledge.scss` 并嵌在 `.knowledge-app` 下;**本刀零 scss 改动** |

**未命中**:K53 / K54 / K55 / K56 / K57 / K59 / K60(属别的三刀)。

## 5. §3.5 的 N1–N58 里本任务命中的(确实照抄了)

| # | 命中 | 申报 |
|---|---|---|
| **N46** | `node.childMap` / `node.recentChanges` / `root.id` / `root.path` | 🔴 **只消费 camelCase**(共享包 `normalizeNode` / `normalizeRoot` 已双向归一)——**页面里零二次归一化**。抄本自检钉死:抄本是 HTTP 原文 **snake_case**(`child_map` / `recent_changes` / `ai_label`),经 `toNodeShape()`(= `normalizeNode` 的等价物)才变 camelCase |
| **N48** | `raw === null` 与 `node === null` 两处 | 404 在 **store 层**转 `null`(合法业务态,走 `kw-pending` 那屏),其余上抛走 catch。**分层照抄,不拉平** |
| **N49** | `v-if="node && node.childMap.length"` · `(node ? node.recentChanges : [])` | 🔴 **兜底照抄**。数组侧的 `|| []` 在共享包 `normalizeNode`(`wiki.ts:113-114`)里;页面挡的是「`node` 为 null」那一半。抄本刻意含 `Archive` 一项(`file_count`/`last_modified`/`is_opaque` **三个键整个缺失**,omitempty 的真形态)钉住 `|| 0` / `|| ''` / `!!` 三个兜底 |
| **N58** | 🔴 **`childPath` 的 `base === '' ? '' : base`** | **恒等表达式,两支结果完全相同,照抄不化简。** 🔴 **因此它本身不存在能报红的探针** —— 能守的是 `replace(/\/+$/, '')` 在 `sel === '/'` 时的行为:一条根路径用例(树含 `/` 与 `/DATA`)断「拼出 `/DATA` 而不是 `//DATA`」;拼错则 `byPath` 落空、`data-kind` 变 `file`、`openFileInNewTab` 被调 ⇒ 报红。**另**:`opToType` 的「modify + 任何未知值 → 'mod'」也照抄(probe12 钉住的是**另一条独立兜底** `OP_LABEL_KEYS[c.op] \|\| 'Updated'`,两条不许合并) |
| **N55** | `fetchArticle` 的三处过期守卫 | T6 已落;本刀只把其中两条断言**改黑盒**(§7),守卫本身零改动 |

**顺带申报的照抄项(不在 N 表但属「照抄不改」)**:
`root.path.replace(/\/+$/, '') + '/'` —— 根是 `/` 时会拼成 `//`,与蓝本同解,**不「修」**;
`kw-sec-en` 的 `Contents` / `Recent changes` 与 `:59` 的 `TREE` 是蓝本**未过 `$t()`** 的装饰文案,
🔴 **照抄字面量,没有顺手 i18n 化**(附录 A §A.4)。

---

## 6. 🔴 模板 `style=` / `:style=` / `color=` 处数 = **9**(本刀现数,未采信附录 B §B.5)

```
$ grep -c 'style=\|:style=\|color=' src/ai/knowledge/views/WikiView.vue     → 9
:557 style="display: block; height: 22px; margin: 6px 8px"         ← 蓝本 :7
:565 style="margin-top: 8px"                                        ← 蓝本 :12
:579 :style="{ paddingLeft: 8 + item.depth * 14 + 'px' }"           ← 蓝本 :22(唯一 `:style=`)
:633 style="--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)"   ← 蓝本 :59
:646 style="margin-top: 18px; display: flex; …"                     ← 蓝本 :69
:648 :649 :650 :651  四条 k-skel 纯尺寸                              ← 蓝本 :70-73
`color=` → 0 处
```
⇒ **9 处,与裁定 R27 末段的评审定案逐处对齐**;🔴 **本刀的下半一处都没新增**(下半只有 class 与 `data-*`)。
**模板内零裸色**:`knowledgeStyles.test.ts` 的缺口③′ 三组参数化断言(hex/rgb/hsl + 属性值位置具名色)全绿。

🔴 **附录 B §B.5 已按「反转不删」订正**(新增 §B.5.1):原文保留,新增订正块登记
**该表已连错三行**(Allowlist 6→**8** / Roots 5→**7** / Wiki 8→**9**),引条目编号 R24 / R26-2 / R27,不引 `file:line`。

---

## 7. §9.10 —— 既有守卫只加固不放宽:41 行删除的逐条归属

`git diff -- WikiView.test.ts | grep -c "^-[^-]"` = **41**。**没有一条是削弱**:

| 组 | 行数 | 依据 |
|---|---|---|
| `extractTemplate` 旧实现 + 3 个合成串调用点 + 1 条注释措辞 | 11 | **裁定 R28**(开工前置)。旧实现**原文留档在新函数的文档注释里**(反转不删) |
| 本体条件断言的标题与惰性分支措辞 | 3 | 从「模板尚无 kw-summary ⇒ 惰性通过」改成「一旦出现就必须有按钮(T7 起已上膛)」,**断言体零改动** |
| **6 条「改黑盒」**(T6 评审 §4-③ 清单) | 27 | brief DoD 10 明令。逐条见下 |

### T6 评审六条「改黑盒」清单 —— 逐条对照

| # | 评审要求 | 本刀怎么做的 |
|---|---|---|
| 1 | `:688-691`(N55 ①)`vm.raw` / `vm.node.aiLabel` → 断 `.kw-summary` / `.kw-rawsrc`;`vm.sel` → `.kw-crumb .cur` | ✅ 全改。⚠️ **申报**:`node.aiLabel` 在整页**没有任何渲染落点**(`kw-meta` 的 `<b>` 读的是**树节点**的 `selTreeNode.aiLabel`)⇒ 唯一能观测 `node` 的面是 `childMap` / `recentChanges` ⇒ 新增 `nodeWithChild()` helper,断言落在 `.kw-child-name` 上 |
| 2 | `:736-738`(N55 ③)同上 | ✅ 全改(`.kw-summary` 文本 + `.kw-child-name` + `.kw-pending-title` 不出现) |
| 3 | `:789-791`(N48 404)→ 断 `.kw-pending` 出现且 `.kw-summary`/`.kw-rawsrc` 都不在 | ✅ 全改,**并加断 `.kw-foot` 也不在** |
| 4 | `:807-809`(K58)同 3 | ✅ 全改 |
| 5 | `:812-820`(showSource 重置)→ 断「切到源码后换文章 → `pre.kw-rawsrc` 消失、`.kw-summary` 回来」 | ✅ 全改,**全程零 `w.vm` 写入**(改成点真按钮) |
| 6 | `:831`(`vm.byPath = {}`)**保留写入**,读侧已在 DOM | ✅ **一字未动** |

⇒ **改完后 `w.vm` 的用法只剩三处**(现测 `grep -n 'w\.vm'`):
① `:1069` `vm.byPath = {}`(评审明令**保留**,制造防御态的唯一手段);
② `:1762` `rescanOf(w)` 读 `vm.rescan`(理由见 §8);
③ `:775` `w.vm.$router.replace(...)` —— **T6 既有**,读的是**路由实例**不是 setup 绑定,不在评审清单里。
🔴 **`vm.node` / `vm.raw` / `vm.sel` / `vm.showSource` 的读写全部清零。**

**产品码零改动的三份**:`wikiViewHelpers.ts`(md5 `99ad3de…`)· `RootsView.vue` · `knowledge.scss` —— 均不在 diff 里。

---

## 8. 🔴 R27 的「函数门必须走无 `:disabled` 的入口」—— 本刀的显式申报

蓝本的重扫按钮自带 `:disabled="rescanBusy"`,而 **jsdom 不向 `:disabled` 元素派发 click**
⇒ **直接点它测不出 `rescanBusy` 那道函数门**(T5 正是栽在这里)。

🔴 **本页没有第二个不带 `disabled` 的入口**(蓝本只有这一个按钮)⇒ **本刀的处置(显式申报)**:

1. **函数门**用 **直调 `vm.rescan()`** 验 —— 那是它在测试里唯一能被到达的路径;
   同步连发两次 → `rescanRoot` 只被调 **1** 次。**判据:去掉 `|| rescanBusy` → 报红(probe6 实证)**;
2. **UI 那一层**单独一条:第一发在飞时按钮**真的**变成 `disabled`(起手先断 `hasAttribute('disabled') === false`)。
   **判据:去掉 `:disabled` → 报红(probe10 实证)**;
3. `rescanOf()` 自带前置断言 `typeof vm.rescan === 'function'`,防「没暴露到 vm ⇒ 整组静默失效」。

**成功路径**走的是**点真按钮**(§9.17:先断 `exists()` + `hasAttribute('disabled') === false` 再点)。

---

## 9. §9.14-4 参数化守卫防空循环

`OP_LABEL_CASES` 5 条(`create/modify/delete/rename` + 未知 `chmod`)。
🔴 **先用一条独立用例钉死条数**:`expect(OP_LABEL_CASES.length).toBe(5)` + `new Set(op).size === 5`。
`--reporter=verbose` 全量日志实测:5 条 `it.each` **逐条具名执行**

```
✓ 🔴 OP_LABEL_KEYS —— op='create' 的标签文案是「'新增'」
✓ 🔴 OP_LABEL_KEYS —— op='modify' 的标签文案是「'更新'」
✓ 🔴 OP_LABEL_KEYS —— op='delete' 的标签文案是「'已删除'」
✓ 🔴 OP_LABEL_KEYS —— op='rename' 的标签文案是「'重命名'」
✓ 🔴 OP_LABEL_KEYS —— op='chmod' 的标签文案是「'更新'」
```
每条内部还先断 `rows.length === 1`(防「那一行压根没渲染出来 ⇒ 断言对空集」)。
🔴 全文件 `--reporter=verbose` 具名 `✓` **100 条**,`↓ / skipped / todo` **零命中**。

---

## 10. 三门完整终值 + 用例数归因(裁定 R24:必须与总数自洽)

```
$ pnpm test                   → exit 0   Test Files 339 passed (339)   Tests 4658 passed (4658)
$ pnpm exec vue-tsc --noEmit  → exit 0   日志 0 行
$ pnpm build                  → exit 0   ✓ built in 13.77s
```

| 文件 | 起点(T6 收官) | 落地 | Δ |
|---|---|---|---|
| `WikiView.test.ts` | 54 | **100** | **+46** |
| 其余 338 个文件 | — | — | **0** |
| **合计** | **4612** | **4658** | **+46** |

**4612 + 46 = 4658** ✅ 自洽。
**Test Files 339 → 339**(🔴 **零新建文件**,brief 明令)。
`color-guard` 用例数**不变**(本刀零新增 `.vue`,`.vue` 总数仍 **188**)。
**红项 0**;已知噪声(`persist.test.ts > dropPersisted` · `AgentComposer.test.ts`)本次**未复现**。

---

## 11. 用了哪几个样本、mock 形状取自哪一层(§4.1 的表)

| 样本 | 三级标签 | 用在哪 | `__meta` |
|---|---|---|---|
| `wiki-node.CONSTRUCTED.json` 的 `raw_response` | 🔴 **`.CONSTRUCTED`(不是真机数据)** | `NODE_RAW_DATA` → `toNodeShape()` → `NODE_DATA`:目录区 4 项 / 最近变更 12 条 / omitempty 缺键 / 未知 op `chmod` / 跨根 `/outside/a6.md` / 空 `at` | **转成注释**(裁定 R14) |
| `wiki-raw-DATA.REAL.md` | **`.REAL`**(逐字节未改的那一份) | `WIKI_RAW_REAL_EXCERPT`(**前 22 行节选**,值一字未改)—— §9.15 的正常路径输入 | 无 `__meta`(md 文件) |
| `wiki-tree.CONSTRUCTED.json` `normal` 组 | `.CONSTRUCTED` | T6 已抄,本刀复用 | 已转注释 |
| `wiki-roots.normalized.CONSTRUCTED.json` | `.CONSTRUCTED` | T6 已抄,本刀复用(`owningRoot` / `root.id` / 前缀剥离) | 已转注释 |

**mock 层次**:🔴 **mock 共享包的 `service.wiki.*`,走真 `knowledgeStore`**(T6 既定,理由见测试文件头)。
`store.rescanRoot` 用 `vi.spyOn(store, ...)` 在**用例内**替换(它打的是 `service.wiki.rescanRoot`,
本文件的 `wiki` mock 骨架里没有这个方法 —— **申报**:这是本刀唯一一处 spy 到 store 方法的地方,
理由是要控制它的 pending / reject 时机,而 `service.wiki.rescanRoot` 不在 hoisted 骨架里;
**没有 mock 掉整个 store**,N48 的分层仍走真实现)。
🔴 **运行时零读 `.superpowers/`**;读 `.vue` 一律 `node:fs`(`?raw` 在 vitest 下恒空)。
🔴 **`.CONSTRUCTED` 全程标成「不是真机数据」**,也没拿它去推翻 N46 的命名结论(§9.18-2)。

新增 4 条抄本自检(零 `__meta` / snake_case 字段名集合 / omitempty 缺键形态 / `.REAL` 节选 22 行边界),
判据:任何一处字段名被写成 camelCase 或条数被改 → 立刻报红。

---

## 12. i18n

🔴 **本刀零新增键** —— 下半用到的 15 个键全部由 **T1** 落好,本刀只**消费**:

```
aiKbWkNoSummaryTitle / aiKbWkNoSummarySub / aiKbWkRescanRoot / aiKbWkContents /
aiKbWkItemCount({n}) / aiKbWkCollapsed / aiKbWkRecentChanges /
aiKbWkRenderNote({path}) / aiKbWkRenderedView / aiKbWkViewSource /
aiKbWkOpAdded / aiKbWkOpUpdated / aiKbWkOpRemoved / aiKbWkOpRenamed /
aiKbRescanStarted / aiKbOpFailed
```
`zh_cn.ts` / `en_us.ts` **零改动**(`git status` 里没有它们)。
`{n}` / `{path}` 两个占位符各一条渲染断言;🔴 **E-45**:反向断言**没有**写成「渲染结果含 `{path}` 字面量」
(vue-i18n 对未匹配占位符是**静默替换成空串**,那样写零判别力),写的是真实插值出来的值。

---

## 13. 顾虑 / 交接项

1. 🔴 **`node.aiLabel` 全页零渲染落点**(蓝本如此)。`kw-meta` 的 `<b>` 读的是**树节点**的 `aiLabel`,
   而 `/wiki/node` 也回一个 `ai_label` —— 两者**永远不会被比较**。属蓝本设计,**照抄,不动**;
   登记备查:将来谁想「让文章标签跟着 node 走」,那是改行为,不是修 bug。
2. 🔴 **`c.lastModified ? fmtTs(...) : ''` 是恒等冗余对**(§3.2),`childPath` 的三元是恒等式(N58)——
   **两处都不许以「死代码」为由删**(§9.10 / R26-4 同族)。
3. ⚠️ **`rescan()` 的 `finally` 无过期守卫**(蓝本如此)—— 门本身保证同一时刻只有一发在飞,
   所以现状安全;但它与 `fetchArticle` 的三处守卫**形态不同**,评审别当成漏抄。
4. 🔴 **验收清单待补两条**(承 T6 评审 §6-2 与本刀):
   - 「进 Wiki 页约 60 秒后会冒一次『操作失败』提示」= D1 连带,**与 Vue2 一致**,不是本期缺陷;
   - **本机 `owningRoot` 恒为 null**(`/v1/wiki/roots` 超时 ⇒ `wikiRoots` 恒空)⇒
     🔴 **「重新扫描该根」按钮在本机永远不渲染**,最近变更的**前缀剥离也永远不生效**(全部显示全路径)。
     **这是 D1 的连带,不是缺陷** —— 不写机主必然报。
5. `p5f-appendix-B-tokens.md` §B.5 的三行数字已订正,但**那张表已经连错三行** ——
   建议终审顺带核一遍它**其余各节**有没有同类问题。
6. **T8 的构建管线门**:本刀已确认 `pnpm build` exit 0;`kw-summary` / `kw-child` / `kw-change` 等
   下半的 class 现在都在 JS 侧的 `createElementVNode` 里,T8 那条 `grep dist/assets/*.js` 会命中。

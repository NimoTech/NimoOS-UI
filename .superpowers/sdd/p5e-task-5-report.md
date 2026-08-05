# P5e · T5 报告 —— `FileDetailDrawer.vue` + `FileDetailDrawer.test.ts`

> 起点 HEAD `396a82e`(`git status` 干净,`FileDetailDrawer.vue`/`.test.ts` 均不存在,已现测确认)。
> 本刀只改 3 个文件(+ 本报告):`src/ai/knowledge/components/FileDetailDrawer.vue`(新建)·
> `src/ai/knowledge/components/FileDetailDrawer.test.ts`(新建)·
> `src/ai/styles/knowledgeStyles.test.ts`(**仅 +1 行**,`git diff --stat` = `1 file changed, 1 insertion(+)`,自证见 §8)。
> `knowledge.scss` / `searchAggregate.{ts,test.ts}` / `KFileViewer.{vue,test.ts}` /
> `color-guard.test.ts` / `src/files/viewers/**` / `knowledgeStore.ts` / `parserStore.ts` /
> `src/i18n/**` **全期零改动**(自证:`git status --porcelain` 只列本刀 3 个文件)。

---

## 1. 逐段对照(蓝本 `file:line` → New-UI)

蓝本:`NimoOS-UI@7a6ee6b7:src/views/AI/Knowledge/components/FileDetailDrawer.vue`(220 行,模板+脚本全部本刀移植)。

| 蓝本 `file:line` | New-UI | 说明 |
|---|---|---|
| `:2-84` 模板整体 | `<template>` 全段 | 逐字移植,`$emit(...)`→`emit(...)`、`$t(...)`→`t(...)`(Composition API 写法,行为不变);class/DOM 结构/按钮位置/内联 `style=` 逐字照抄 |
| `:98-102` `data()` | `activeId`/`fullText`/`loading` 三个 `ref` | `activeId` 初值 = 首个 chunk 的 id 或 `null` |
| `:104-107` `cur` computed | `cur = computed<ChunkVM>(...)` | `find` 落空退首个,再落空退 `{} as ChunkVM`(类型层等价表达蓝本的动态兜底,不是 `any`) |
| `:108-111` `curIndex` | `curIndex` computed | `findIndex` 落空(`-1`)时钉 `0` |
| `:112-115` `viewerHtml` | `viewerHtml` computed | `highlight(fullText \|\| cur.snippet \|\| '', query)` |
| `:119-125` `canDistill` | `canDistill` computed | `isDistillableName(file.name)`(N44,见 §5) |
| `:141-163` `fetchFull()` | `fetchFull()` | N42 四条 reqId 守卫逐字照抄(见 §4) |
| `:141-142` watch | `watch(activeId, () => fetchFull())` | 非 immediate |
| `:143-144` `select`/`step` | 同名函数 | 边界判断逐字照抄 |
| `:164-181` `copy()` | `copy()` | 两条路径(clipboard/execCommand)逐字照抄,见 §6 |
| `:182-197` `submitDistill`/`notify`/`distillToNote` | `notify()`/`distillToNote()` | N43,见 §7(方法引用约定本身不移植,行为承接) |
| `:130-138`(created）Esc 部分 | `onMounted`/`onBeforeUnmount` | N41,见 §9 |
| `created()` 调 `fetchFull()` | `<script setup>` 顶层同步调用 `fetchFull()` | 时机对应 Vue2 `created()`(早于挂载),不挪进 `onMounted`(那会让首次请求延后到 DOM 挂载后才发出,是可观察的时序偏移,已在组件头部注释显式申报) |
| `:199-217` `relLevel`/`relLabel`/`fmtMtime`/`highlight` | 从 `../util/searchAggregate` import | K48,见 §11 自证 |

**K44 自证**:`git grep -n '<style' src/ai/knowledge/components/FileDetailDrawer.vue`(剥注释后,见 §11)零命中。

---

## 2. emit 契约(蓝本 `:186-190`,§2.2)

`close` / `open({file})` / `download(file)` / `toast(message)` 四个 emit 逐字照抄。**本组件自身零处调用 `useToast()`**(蓝本注释:「本组件的约定是 emit toast,由父组件转发」)。

- **RED 探针**(§13①):在 `notify()` 前插入 `const _toast = useToast()` → `本组件自身零处调用 useToast()` 用例精确报红(`expected false to be true`)→ `cp` 还原 → `md5sum` 逐字节比对一致 → 转绿。
- 五条用例覆盖:点返回按钮→close、点右上角 x→close、点背景遮罩→close 且点面板内部(`@click.stop`)不触发、点下载→emit 完整 `FileVM`(非瘦身对象)、点打开原文件→emit `{file}`。

---

## 3. `activeId`/`cur`/`curIndex`/`select`/`step`(DoD-3)

- 初值 = 首个 chunk 的 id(用例:第一条 `.k-chunk-item` 的 `data-active="true"`,第二条 `"false"`)。
- `chunks=[]` 边界:无任何 `.k-chunk-item`,`cur` 落到 `{}`,`fetchFull` 的 `chunkNo==null` 早退(见 §4⑤)。
- `select`:点击第二条 → `data-active` 切换,`k-chunk-nav-count` 从 `1/2` 变 `2/2`。
- `step` 边界:`curIndex=0` 时 `prev` 按钮 `disabled` 存在;**另用 `wrapper.vm` 直读 `<script setup>` 顶层函数**(先例:`NoteEditPane.test.ts` 文件头技术说明)直接调用 `step(-1)`,绕开 `disabled` 属性精确核 `step()` 自身的边界判断而非依赖 UI 层拦截(jsdom 对 `disabled` 元素 dispatchEvent 的行为不稳定,不能作为唯一判据)。`step(+1)` 同理测末尾边界。
- `k-chunk-nav-count = curIndex+1 / total` 一条(渲染断言)。

---

## 4. 🔴 `fetchFull()` N42 四条守卫 —— 各自独立 RED 证据

蓝本 `:145-163` 自带 `reqId` 过期守卫(不是本刀加的),四处判断逐字保留:

| # | 位置 | RED 探针(sed 精确删除该行/该判断)| 结果 |
|---|---|---|---|
| ① 逻辑交错 | 成功分支 `if (activeId.value !== reqId) return`(`:122`)| `sed -i '122d'` 删除该行 | ✅ 报红:`expected '<div class="k-chunk-content">A-FULL-TEXT-LATE</div>' to contain 'B-FULL-TEXT'`(A 覆盖了 B) |
| ② 两实例交错守作用域 | `activeId` 挪到模块级 | 新增 `<script lang="ts">` 模块块导出共享 `ref`,`<script setup>` 里 `const activeId = __sharedActiveIdRedProbe` + 条件初始化(去实例化) | ✅ 报红:`expected '<div class="k-chunk-content">{"log":...</div>' to contain 'INSTANCE-2-TEXT'`(实例 2 的内容被实例 1 的共享状态污染) |
| ③ catch 分支 | `if (activeId.value !== reqId) return`(`:126`)| `sed -i '126d'` | ✅ 报红:`expected '<div class="k-chunk-content">{"log":.../:201...</div>' to contain 'B-SUCCEEDED-TEXT'`(A 迟到的失败兜底覆盖了 B 已渲染的成功内容) |
| ④ finally | `if (activeId.value === reqId) loading.value = false`(`:129`)→ 无条件 `loading.value = false` | `sed -i '129s/.../loading.value = false/'` | ✅ 报红:`expected false to be true`(B 仍在飞的 loading 被 A 的 finally 提前清空) |
| ⑤ `chunkNo == null` 早退 | `:108` `if (!c \|\| c.chunkNo == null)` → `if (!c)` | `sed -i '108s/.../if (!c) {/'` | ✅ 报红:`expected "vi.fn()" to be called...`(变成 `not.toHaveBeenCalled()` 断言落空,`spy` 被调用了) |

每条探针执行顺序:`sed` 注入 → `grep`/`sed -n` 打印确认落盘 → `pnpm exec vitest run ... -t "<对应用例>"` 报红(完整输出已贴)→ `cp /tmp/p5e-t5-red/FileDetailDrawer.vue.orig` 还原 → `md5sum` 两文件逐字节比对一致(每次都是 `df5951f718129cb199c6205fc45acad4`)。**四条互不干扰**(每次只报红对应的那一条,其余用例本次未跑或本身跳过)。

另两条 mock 形状用例(F6 满窗口 / F6b 条数<2W+1)与 anchor 缺席兜底(F12)见 §5。

---

## 5. mock 形状 = 后端原始 snake_case(§4.1)+ fixture 出处

`store.loadChunkContext(...)` 返回 `{chunks:[{chunk_no,text}], anchor_chunk_no}`,**零归一化**,`fetchFull` 读的是 `r.chunks`/`r.anchor_chunk_no`/`x.chunk_no`/`anchor.text` 全 snake_case(组件源码 `interface ChunkContextRaw`/`ChunkContextChunkRaw` 字段依据引 `NimoOS-Search/service/authz.go:96-149`)。

**三级出处标签(逐个标注,裁定 R3 约束 1)**:

| 常量 | 标签 | 出处 | 说明 |
|---|---|---|---|
| `REAL_FILE_ID`/`CHUNK0_TEXT_PREFIX`/`CHUNK1_TEXT_PREFIX`/`REAL_PATH_DIR`/`REAL_NAME` | **REPLAYED** | `F5b-search-text.multifile.REPLAYED.json` `files[0]` | 真实 file_id/mime/score/mtime_ms/path |
| `F6_WINDOW_RAW`(含 `F6_ANCHOR_TEXT_PREFIX`) | **REPLAYED** | `F6-search-chunk.window.REPLAYED.json` | 满窗口 5 条,anchor(2387)居中 |
| `F6B_WINDOW_RAW`(含 `F6B_ANCHOR_TEXT_PREFIX`) | **REPLAYED** | `F6b-search-chunk.window-multi.REPLAYED.json` | anchor(1)贴下界,只取到 4 条(< 2W+1=5) |
| `F12_ANCHOR_ABSENT_RAW` | **CONSTRUCTED**(D-6 模具) | `F12-search-chunk.anchor-absent.CONSTRUCTED.json` | anchor 缺席兜底的唯一样本,逐字照抄(已剥 `_provenance`) |

**🔴 R9-3 合规(测试里只许贴 1–2 条完整正文)**:本文件**零条完整正文**——比"1–2 条"更保守。所有 `text` 字段都截到真实前 48–72 字符(component 只用 `chunk_no` 做 `.find()` 匹配,非 anchor 条目的 `text` 从不被渲染,截断不影响任何断言的判别力);每条前缀都在源码注释标注完整值的 `len`/`sha256`,校验命令统一贴在文件头(`python3 -c "import json,hashlib; ..."`)。**实测复核**(F6b `chunk_no=0` 与 F5b `chunks[0]` 的 sha256 逐字节相同 `fe4f68aa...`,F6b `chunk_no=1` 与 F5b `chunks[1]` 相同 `8c56f4fb...`)证实了 fixture README 说的「F5b/F6/F6b/F12 是同一份索引文档的不同视角」这件事,已在测试注释里交叉引用。

对应三条渲染/行为用例:
- F6(满窗口 5 条)→ `fetchFull` 正确取到 anchor(2387)的 text,断言 `.k-chunk-content` 含 `F6_ANCHOR_TEXT_PREFIX`。
- F6b(条数 4 < 2W+1=5)→ 同样正确取到 anchor(1),并显式断言 `F6B_WINDOW_RAW.chunks.length===4` 钉住"不保证条数"这件事本身。
- F12(CONSTRUCTED,anchor 缺席)→ 显式断言 `chunks.some(c=>c.chunk_no===anchor_chunk_no)===false`,再断言渲染内容落到 `cur.snippet` 兜底(`CHUNK0_TEXT_PREFIX`),且**不**含 F12 里两个邻居的文本("neighbour")。

---

## 6. 🔴 `copy()` 两条路径(评审第一必查项)—— 含一次自我纠错

蓝本 `:164-181`:① `navigator.clipboard.writeText` 成功优先;② 不存在/失败 → `document.execCommand('copy')` 兜底。mock 手法照本仓既定先例 `src/files/util/clipboard.test.ts`(jsdom 原生零 `document.execCommand`,`vi.spyOn` 要求属性已存在会报错「not defined on the object」,故直接赋值 `document.execCommand = vi.fn(...)`;用 `Object.defineProperty(navigator,'clipboard',{value,configurable:true})` 而不是 `delete navigator.clipboard`)。

**RED 探针**(§13②):`python3` 精确删除 `if (!ok) { ... execCommand ... }` 整段(用锚定文本匹配、非行号,避免行号漂移导致语法错误——第一次用 `sed` 按行号删漏算了一行,产出语法错误,已弃用行号法改用锚文本整块替换,如实记录这次自我纠错)。

删除后跑 `copy` 全部 4 条:

```
 × ② navigator.clipboard 不存在 → 走 execCommand 兜底 ...
   → expected "vi.fn()" to be called with arguments: [ 'copy' ]
   Number of calls: 0
 ✓ ③ execCommand 返回 false → emit toast(Copy failed)   ← 🔴 第一版意外通过!
 ✓ ④ plain = 剥标签后的正文 ...
```

**🔴 发现并修复一处零判别力断言**:第一版的用例③只断言 toast 文案(`'复制失败,请手动选择'`),但删掉整个 `execCommand` 兜底段后,`ok` 停留在初始值 `false`,恰好走到与"execCommand 返回 false"完全相同的兜底文案分支 → **断言假通过,测试路径从未验证 execCommand 真的被调用过**。这正是 brief 明确警告的坑(「评审第一必查项:自己删掉 execCommand 整段 → 第②③条必须报红」)。**已修复**:用例③补上 `expect(document.execCommand).toHaveBeenCalledWith('copy')`,重新验证:

```
 × ② navigator.clipboard 不存在 → 走 execCommand 兜底 ...(execCommand 未被调用)
 × ③ execCommand 返回 false → emit toast(Copy failed) ...(execCommand 未被调用)← 修复后正确报红
 Test Files  1 failed | Tests  2 failed | 2 passed | 33 skipped (37)
```

`cp` 还原 → `md5sum` 一致(`df5951f7...`)→ 重跑 `copy` 全部 4 条转绿。

第 ④ 条(`plain` 剥标签):喂 `query='world'`,断言 `.k-chunk-content` 含 `<mark>` 且 `navigator.clipboard.writeText` 被调用时传的是纯文本 `'hello world foo'`(不含 `<mark>` 标签)。

---

## 7. 🔴 N43 —— 承接 `fileDetailDrawerDistill.spec.js`(测法必须改)

蓝本那份 spec 用 `FileDetailDrawer.methods.distillToNote.call(ctx)` 整体 stub `submitDistill`,`<script setup>` 无 `methods` 对象,该测法不可移植。**行为承接**:真挂载 + `vi.mock('@nimotech/nimoos-service', importOriginal)` 覆盖 `service.notes.distillFile`。

**RED 探针**(§13③):`sed -i "176s/props.file.fullPath/props.file.path/"`(唯一改动点)→

```
 × 传的是 file.fullPath,不是 file.path(dirname)
   - "/DATA/Documents/a.pdf",
   + "/DATA/Documents/",
```

精确报红,`cp` 还原 + `md5sum` 一致。三条用例:传参正确性、成功→`aiKbFdDistillQueued`("已加入笔记沉淀队列")、失败→`aiKbFdDistillFailed`("无法加入沉淀队列")。

---

## 8. N44 `canDistill`

`import { isDistillableName } from '@nimotech/nimoos-service'`,**未在本仓重定义扩展名表**(自证:`grep -n "DISTILL_EXTS\|\.pdf.*\.docx" FileDetailDrawer.vue` 零命中)。测试侧对 `@nimotech/nimoos-service` 的 mock 用 `importOriginal` 保留真实 `isDistillableName` 实现(唯一定义处 `NimoOS-Service/src/notes.ts:175-182` 的 `DISTILL_EXTS`,若连它也 mock 掉,`.pdf`/`.png` 两条用例就测不到真实扩展名表,是零判别力用例)。两条用例:`.pdf` → 渲染 2 个 `.k-btn.outline`(下载+沉淀),`.png` → 只渲染 1 个(只有下载)。

---

## 9. K49 组件层 v-html 注入

util 层的 escape 已由 T3 测过(`highlight()` 本身),本刀测的是**组件层渲染后的真实 DOM**(§9.12 同族原则:测法要落在真报红的层次)。

- 喂 `<script>alert(1)</script> hello` 到 chunk 的 `snippet`,query=`hello` → `.k-chunk-item-preview` 的 `querySelector('script')` 为 `null`、`querySelector('mark')` 非 `null`、`innerHTML` 含 `&lt;script&gt;`。
- 喂 `<img src=x onerror=alert(1)> hello` 到 `loadChunkContext` 的 mock 返回值(经 `fetchFull` 落到 `viewerHtml`)→ `.k-chunk-content` 的 `querySelector('img')` 为 `null`、`innerHTML` 含 `&lt;img` 与 `&gt;`、`<mark>` 在。

两条均用 `attachTo: document.body` 挂载并在断言后 `w.unmount()`。

---

## 10. N41 Esc(created/beforeDestroy → onMounted/onBeforeUnmount)

判据**照 T4/R18 已坐实的那条**(不用「卸载后再按 Esc 断言 close 不再增长」——T4 评审已独立证实这条在本 `@vue/test-utils` v4.1.9 环境下零判别力,因为 Vue 3 卸载后 `emit()` 本身就不再投递,与是否 `removeEventListener` 无关)。改用:`vi.spyOn(window,'removeEventListener')` 捕获调用 + `toBe(handler)` 钉住与 `addEventListener` 时**同一个函数引用**。

**RED 探针**(§13④):`sed -i "189d"` 删除 `onBeforeUnmount(() => window.removeEventListener('keydown', onKey))` 那一行 →

```
 × 挂载时注册 keydown;按 Esc 发 close;卸载时用同一个函数引用注销
   → 未找到 keydown 的 removeEventListener 调用: expected undefined to be defined
```

精确报红,`cp` 还原 + `md5sum` 一致。用例内还含:按 Esc 发 `close`、按其它键不发、`close` 计数不重复增长。

---

## 11. K48 —— 四函数一律从 util import

`import { fmtMtime, highlight, relLabel, relLevel } from '../util/searchAggregate'`(以及 `ChunkVM`/`FileVM` 类型)。

**自证**(用例 + RED):`grep -c 'function highlight'` 等价断言(剥 `//` 行注释后正则匹配 `function <fn>\b`)对 `highlight`/`fmtMtime`/`relLevel`/`relLabel` 四个全部 = 0 命中。

**🔴 否定式断言先剥注释的自我纠错**(E-60/E-25 家族第 N+1 次复发,本刀自己踩到并修复,未遗留):第一版三条自查用例(`<style>` 零命中 / 四函数零重定义 / `useToast()` 零调用)**直接对原始文件文本做正则匹配,首次实测就集体假红**——因为组件文件头的申报注释本身大量引用了这些字样做说明(例如「K44:`.vue` 侧零 `<style>` 块」「自证:`grep -c 'function highlight'` = 0」「不许直接调 `useToast()`」)。**这是 R14/E-60 讲的方向 ②(类名/调用形状的否定式断言必须先剥注释)的真实复现**,不是方向①(色扫场景,注释里也算真阳性)。已加 `stripLineComments()` 辅助函数(只剥整行 `//` 注释)修复,三条恢复绿,随后各自的 RED 探针(见 §2/§8/本节)证实修复后仍然对**真实违规**保持判别力:

- K44:临时在文件末尾追加 `<style scoped>...</style>` → 报红 → 删除还原(md5 一致)→ 转绿。
- K48:临时在 `select()` 之前插入 `function highlight(t){return t}` → 报红 → 还原 → 转绿。
- emit 契约:临时在 `notify()` 前插入 `const _toast = useToast()` → 报红 → 还原 → 转绿。

---

## 12. T5 DoD-12 —— 自动上膛守卫

`views/SearchView.vue`(T6 建)现在不存在,永久测试文件里只放一条「若存在则必须 import 本组件」的条件断言(`existsSync` 分支)。

- **惰性证明**:`--reporter=verbose` 显示该用例在 **passed** 列表里(非 skip/todo)。
- **上膛证明**(手工做,不写进永久测试文件——见下方说明):`printf '<template><div/></template>\n' > src/ai/knowledge/views/SearchView.vue` → 该用例报红(`expected "<template>..." to match /FileDetailDrawer\.vue/`)→ 写入含 `import FileDetailDrawer from '../components/FileDetailDrawer.vue'` 的临时内容 → 转绿(证明判据不是恒红,两种偏态都验过)→ `rm` 删除临时文件 → 再跑一次确认回到"文件不存在→惰性通过"。全程 `git status --porcelain src/ai/knowledge/views/` 干净(临时文件从未落进任何 git 追踪状态外的持久态)。

🔴 **申报一处偏离计划书字面写法**:brief 原文暗示「上膛证明」与「两种偏态各一条」应该是永久测试用例。**实测发现这样写会把一次性验证行为烧进 CI**——第一版把"临时创建零 import 的文件 → 断言必须报红"直接写成 `it()` 块,这条用例本身的断言会**永久失败**(因为它断言的是一个刻意制造的坏内容),导致整个套件红。这不是"守卫的判据无效"(判据本身是对的),而是"验证判据有效性的手法不该是永久测试"——两者要分清。已改为:永久测试文件只保留"惰性时该恒过"的那一条条件断言,「上膛证明」与「两种偏态」作为**手工 RED 探针**(如上,完整命令与输出见本节),不落进 CI。**如实申报此处偏离并说明理由**,理由与后果三门仍然全绿,且守卫的判别力已用手工探针完整证明。

---

## 13. RED 探针索引(逐条两段输出 + md5sum 还原确认,原始 md5 全程 `df5951f718129cb199c6205fc45acad4`)

| # | 探针 | 报红用例 | 还原确认 |
|---|---|---|---|
| ①-a | fetchFull 成功分支 reqId 判断删除 | ①逻辑交错 | md5 一致 |
| ①-b | `activeId` 挪模块级 | ②两实例交错 | md5 一致 |
| ①-c | fetchFull catch 分支 reqId 判断删除 | ③catch reqId | md5 一致 |
| ①-d | fetchFull finally reqId 判断删除 | ④finally loading | md5 一致 |
| ①-e | `chunkNo==null` 早退删除 | ⑤chunkNo 早退 | md5 一致 |
| ② | copy() execCommand 整段删除 | copy()②③(发现零判别力并修复③) | md5 一致 |
| ③ | `distillFile(file.path)` 替换 | N43 fullPath 断言 | md5 一致 |
| ④ | `onBeforeUnmount` 删除 | N41 Esc | md5 一致 |
| ⑤ | 追加 `<style>` 块 | K44 | md5 一致 |
| ⑥ | 插入重复 `function highlight` | K48 | md5 一致 |
| ⑦ | 插入 `useToast()` | emit 契约(不直调 useToast) | md5 一致 |
| ⑧ | 临时创建/删除 `views/SearchView.vue`(两态) | 自动上膛守卫 | `git status` 干净 |

全部探针执行后最终态:`md5sum src/ai/knowledge/components/FileDetailDrawer.vue` = `df5951f718129cb199c6205fc45acad4`,与首次落盘时逐字节一致;`git status --porcelain` 只列本刀 3 个应改文件。

---

## 14. 三门完整终值

```
pnpm test        → /tmp/p5e-t5-test-final.log   exit=0
pnpm exec vue-tsc --noEmit → /tmp/p5e-t5-tsc-final.log  exit=0
pnpm build       → /tmp/p5e-t5-build-final.log  exit=0
```

**Test Files  334 passed (334)**
**Tests  4176 passed (4176)**

四个算术数字(现测,非采信上一刀):

| 量 | 起点(T4 报告 + 本刀现测确认) | 本刀终值 | 差 | 构成 |
|---|---|---|---|---|
| 测试文件数 | 333 | **334** | +1 | 新建 `FileDetailDrawer.test.ts` |
| 用例数 | 4134 | **4176** | +42 | `FileDetailDrawer.test.ts` 新建 37 条 + `knowledgeStyles.test.ts` 因 `KNOWLEDGE_VUE_FILES` +1 个文件而 4 个 `it.each` 参数化块各自 +1(共 +4)+ `color-guard.test.ts` 动态 +1 |
| `.vue` 总数 | 183 | **184** | +1 | `find src -iname "*.vue" \| wc -l` 现测 |
| `color-guard` 用例数 | 185 | **186** | +1 | `pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose` 现测 |

**已知噪声**:本次全量运行未出现 `persist.test.ts > dropPersisted`(IndexedDB flaky)或 `AgentComposer.test.ts`(vue-i18n teardown 竞态)红项,无需复跑说明。

`knowledgeStyles.test.ts` 仅 +1 行自证:`git diff --stat` = `1 file changed, 1 insertion(+)`(§8 已贴完整 diff)。

---

## 15. K/N 条目逐条申报

| 条目 | 命中方式 |
|---|---|
| **K44** | `.vue` 侧零 `<style>` 块,自证 + RED 见 §1/§11 |
| **emit 契约(不直调 useToast)** | 四个 emit 逐字照抄,组件零调用 `useToast()`,自证 + RED 见 §2 |
| **N42** | `fetchFull()` 四条 reqId 守卫,四个独立 RED 见 §4 |
| **N43** | distill 测法改写(真挂载 + mock),`fullPath` 判据 + RED 见 §7 |
| **N44** | `canDistill` 用包内 `isDistillableName`,不重定义扩展名表,见 §8 |
| **K48** | 四函数零重复定义,自证 + RED 见 §11 |
| **K49** | 组件层 v-html 注入用例,见 §9 |
| **N41** | Esc 生命周期改写 + 判据用 T4/R18 已坐实的"同一函数引用注销",RED 见 §10 |
| **§4.1 mock 层次** | `loadChunkContext` 后端原始 snake_case,零归一化,见 §5 |
| **R9-3(裁定)** | 零条完整正文(比"1–2 条"更保守),真实前缀 + sha256 校验命令,见 §5 |
| **R18(裁定)** | N41 判据沿用 T4 已坐实的訂正判据,未重新踩坑 |
| **E-60/E-25 家族** | 自查发现并修复:三条结构性否定断言未剥注释导致假红,已加 `stripLineComments()`,见 §11 |

---

## 16. 用了哪几个 fixture、mock 形状取自哪一层

- **F5b-search-text.multifile.REPLAYED.json**(`files[0]`):`REAL_FILE_ID`/`CHUNK0_TEXT_PREFIX`/`CHUNK1_TEXT_PREFIX`/`REAL_PATH_DIR`/`REAL_NAME`(真实前缀,非全文,见 §5)。
- **F6-search-chunk.window.REPLAYED.json**:`F6_WINDOW_RAW`(满窗口 5 条,anchor 居中)。
- **F6b-search-chunk.window-multi.REPLAYED.json**:`F6B_WINDOW_RAW`(anchor 贴下界,4 条 < 2W+1)。
- **F12-search-chunk.anchor-absent.CONSTRUCTED.json**:`F12_ANCHOR_ABSENT_RAW`(逐字照抄,anchor 缺席兜底唯一样本)。
- **mock 形状取自哪一层**:`store.loadChunkContext(...)`(Pinia action 层)返回**后端原始响应体**(snake_case),用 `vi.spyOn(store, 'loadChunkContext')` 逐条 mock,不是在 `service.ai.searchChunk` 那一层 mock(§4.1 层次表)。`service.notes.distillFile` 在包层用 `vi.hoisted` + `vi.mock(importOriginal)` mock,`isDistillableName` 保留真实实现。

---

## 17. 自动上膛守卫的两条判据证据

见 §12(已完整贴出:惰性证明的 verbose passed 记录 + 上膛证明的报红输出 + 两种偏态的转绿输出 + 删除还原后的再次惰性通过)。

---

## 18. 代码膨胀自评

- `.vue` 组件本体(不含头部注释)约 200 行,对应蓝本 220 行(模板+脚本),**净行数持平或更少**(Composition API 的 `computed`/`ref` 声明比 Options API `data()`/`computed:{}` 略紧凑)。
- 新增类型声明(`ChunkContextChunkRaw`/`ChunkContextRaw`,共 10 行)属 K41 同款正当膨胀(申报注释已引 `NimoOS-Search/service/authz.go` 字段依据)。
- 未发现"顺手抽的抽象"(六类膨胀里的第⑥类):没有把任何内联逻辑提取成模块常量或辅助函数(与 T3 的 `HTML_ESCAPE_MAP` 不同,本刀没有类似操作,已确认零需要申报的整理)。
- 测试文件 `stripLineComments()` 辅助函数(7 行)是测试基础设施,不计入产品代码膨胀,已在 §11 申报其存在与用途。

---

## 19. 三门起点复核(现测,非采信)

`git log --oneline -1` = `396a82e`(裁定 R23/R24 提交,`FileDetailDrawer.vue`/`.test.ts` 均不存在,现测确认),与治理 §4 记的"起点 331 文件/3958 例"经 T3/T4 两刀累积后到 T4 报告记的"333 文件/4134 例"一致(T4 报告 §7 已现测复核过 332→333 与 4100→4134,本刀站在 T4 终值上继续 +1/+42,见 §14)。

---

## 20. 提交

一个语义提交,只列本刀 3 个文件路径(+ `git add -f` 本报告)。`git show --stat HEAD` 自查见协调者/评审复核记录。

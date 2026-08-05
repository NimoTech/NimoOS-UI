# P5e Task 4 报告 —— `KFileViewer.vue` + R16(7 条 token 绑定)+ R21(groupHits 覆盖缺口)

> 起点 HEAD `a5075ea`(`git status` 干净,`KFileViewer.vue` 不存在,协调者已核实)。
> 本刀只改 4 个文件(+ 本报告):`components/KFileViewer.vue`(新建)·
> `components/KFileViewer.test.ts`(新建)· `styles/knowledgeStyles.test.ts`(+1 行注册 + 7 条 R16 断言)·
> `util/searchAggregate.test.ts`(+1 条 R21 用例 + Minor-2 注释,仅此,`git diff` 自证见 §6)。
> `knowledge.scss` / `searchAggregate.ts` / `src/files/viewers/**` **全期零改动**(自证见各节)。

---

## 1. `KFileViewer.vue` —— 蓝本逐段对照

蓝本:`NimoOS-UI@7a6ee6b7:src/views/AI/Knowledge/components/KFileViewer.vue`(120 行,模板+脚本 `:1-68` 本刀移植,`:70-120` 的 `<style>` 已由 T2 搬进 `knowledge.scss`)。

| 蓝本 `file:line` | New-UI `KFileViewer.vue` | 说明 |
|---|---|---|
| `:2-24` 模板整体 | `<template>` 全段 | 逐字移植,`$emit(...)` → `emit(...)`(Composition API 写法,行为不变) |
| `:37-43` `VIEWER_MAP` | `VIEWER_MAP: Record<string, Component>` | 逐字(docx/wps→DocViewer,xls/xlsx/csv→ExcelViewer) |
| `:45-50` `props: { file }` | `defineProps<{ file: FileVM }>()` | `FileVM` 来自 `../util/searchAggregate`(T3 产出),字段含 `fullPath`,满足蓝本 `this.file.fullPath` 的用法 |
| `:52-54` `item` computed | `item = computed<FileEntry>(() => ({ path: props.file.fullPath, name: props.file.name, is_dir: false }))` | `FileEntry`(`src/files/stores/files.ts:8-16`)只必需 `name`/`path`/`is_dir` ⇒ 该字面量结构上直接满足,**零 `as any`**(`vue-tsc --noEmit` exit 0 自证,见 §5) |
| `:55-58` `viewerComponent` | `computed<Component \| null>` | `((props.file.name \|\| '').split('.').pop() \|\| '').toLowerCase()`,大小写不敏感 |
| `:60-66` `mounted`/`beforeDestroy` | `onMounted`/`onBeforeUnmount` + 模块内 `onKey` 具名函数(同一引用注册/注销) | 生命周期改写,不算偏离(brief 明许) |
| `:18` fallback 下载按钮 `$emit('download', file)` | `emit('download', props.file)` | **照抄「发 file 不发 item」这个既知不一致**,见 §2 |

**K44 自证**:`git grep -n '<style' src/ai/knowledge/components/KFileViewer.vue` 零命中(文件内确认无任何 `<style>` 块)。

---

## 2. §2.7 `download` emit 转发 —— 蓝本既知不一致,照抄

蓝本的 `<component :is="viewerComponent">` **只绑 `@close`,零 `@download` 监听**(`:3-8`)。即:当 `viewerComponent` 命中 DocViewer/ExcelViewer 时,子组件自己的 `download` emit **在这条路径上从未被 KFileViewer 转发**——`download` 只在 fallback 分支的按钮里发,且发的是 `file`(整个 prop)而不是 `item`(瘦身对象)。

- 用例 `KFileViewer.test.ts`:「🔴 fallback 下载按钮发的是 file(整个 prop),不是 item」—— 断言 `emitted('download')[0][0]` 深度等于完整 `FileVM`(含 `id`/`kind`/`mime`/`score`/`chunks` 等 `item` 没有的字段),且 `not.toEqual` 瘦身后的 `item` 形状。
- 用例「蓝本的 `<component :is>` 分支只绑 `@close`,不绑 `@download`」—— 直接对 stub 组件调 `vm.$emit('download', …)`,断言 `w.emitted('download')` 为 `undefined`(证明确实没有转发通道)。

两条用例均已通过(见 §5),该不一致已在组件注释与测试注释中逐处点明(N 系列申报)。

---

## 3. K46 三条自证

### ① `DocViewer.vue`/`ExcelViewer.vue` 自身模板零 `.overlay`/`.v-container`/`.doc-container`

亲手 grep(评审可直接复核,不信报告):
```
$ grep -n "overlay\|v-container\|doc-container" src/files/viewers/DocViewer.vue src/files/viewers/ExcelViewer.vue
(无输出,exit 1)
```
`KFileViewer.test.ts` 里也用 `node:fs` 读源码文本断言零命中,并反向断言两者确实渲染 `class="office-body"` / `class="office-scroll"`(`ViewerShell`/`DocViewer`/`ExcelViewer` 自己的结构),证明「host 的三条 `::v-deep` 补丁不搬」这件事本身在本仓不构成任何缺失。

### ② `ViewerShell.vue:24` 提供铺满视口的定位祖先

```
$ sed -n '22,29p' src/files/viewers/ViewerShell.vue
<style scoped>
.overlay {
  position: absolute; inset: 0; z-index: 200; overflow: hidden;
  ...
```
`position: absolute; inset: 0; z-index: 200` 逐字命中,`KFileViewer.test.ts` 用正则 `/position:\s*absolute;\s*inset:\s*0;\s*z-index:\s*200;/` 直接断言该文件文本,评审可自行复核。

### ③ `.k-fileviewer-host` 类名真的应用在根节点

`KFileViewer.test.ts` 首条用例:`mount(KFileViewer, {...}); expect(w.classes()).toContain('k-fileviewer-host')` —— 通过。

**T2 已把三属性断言放进 `knowledgeStyles.test.ts`**(坐标:`describe('knowledge.scss —— K46 / K47:.k-fileviewer-host 三属性 + 三条 ::v-deep 不搬(P5e-T2 新建)')`,`src/ai/styles/knowledgeStyles.test.ts:606-666` 附近,含 `K46-③a/③b/③c` 三条独立断言 + K47 底色断言 + z-index 相对关系断言),本刀不重复。

---

## 4. 🔴 R15-④ 祖先链实测(K46 立论前提)—— 结论:**祖先链干净,前提成立,不需要 `NEEDS_CONTEXT`**

判据(附录 D §D.8 派给本刀):`position: fixed` 会被任何带 `transform`/`filter`/`will-change`(以及 `perspective`/`contain`)的祖先降级成相对该祖先定位,K46 全部立论建立在「`.knowledge-app` 及其向上到视口的整条祖先链都不产生新的 containing block」上。

**逐层实测**:

| 层级 | 检查 | 结果 |
|---|---|---|
| `.knowledge-app` 自身规则(`knowledge.scss:476-` 主规则块) | 无 `transform`/`filter`/`will-change`/`contain`/`perspective`/`backdrop-filter` | ✅ 干净(`display:grid; height:100vh; width:100vw; overflow:hidden; background/font/color` 等,零相关属性) |
| `.k-main`(`knowledge.scss:619-`) | 同上 | ✅ 干净 |
| `knowledge.scss` 全文件 grep `transform:\|filter:\|will-change\|contain:\|perspective` | 命中的全部是**局部子选择器**(如 `.chev`、`.k2-layer:hover`、`@keyframes`、`.k2-search-dots` 等),**没有一条挂在 `.knowledge-app`/`.k-main` 自身或任何 `.k-fileviewer-host` 的真实 DOM 祖先上** | ✅ 与 `.k-fileviewer-host` 的祖先链无关 |
| `KnowledgeLayout.vue`(`.knowledge-app` 的挂载根,`:204`) | `<router-view />` 位于 `.k-main` 内,无 `<Transition>` 包裹、无内联 style | ✅ 干净 |
| `App.vue` | `<template><router-view /><AppToast /></template>`,**无包裹 div,无 `<style>` 块** | ✅ 干净 |
| `index.html` / `main.ts` | `<div id="app">` 无任何 CSS 规则(`grep -rn "#app\b" src/styles/theme.css src/*.css` 零命中) | ✅ 干净 |
| `src/styles/theme.css` 的 `html`/`body` 自身规则 | `body { margin:0; min-height:100dvh; color; font-family; overflow:hidden }` + `body{background;background-attachment:fixed}`,**零 transform/filter/will-change** | ✅ 干净 |
| `body::before`/`body::after` 伪元素 | 含 `transform`/`filter: blur(46px)` | ⚠️ 但这是**伪元素自身**的属性,不会让真实 `body` 元素本身成为新的 containing block(CSS 规范:`transform`/`filter` 只有作用在**真实元素**上才会创建 containing block;伪元素的这些属性只影响伪元素自己的盒子) |
| 全仓 `will-change`/`contain:`/`perspective` grep(排除注释) | `grep -rn "will-change" src --include="*.css" --include="*.scss" --include="*.vue"` 命中的两处都是**文档注释**(`knowledge.scss:2681` 解释性文字、`ImageViewer.vue:208` "勿加 will-change" 的告诫注释),**零真实 CSS 声明**;`contain:`/`perspective` 全仓零命中 | ✅ 零真实声明 |

**结论(明确,不含糊)**:`.knowledge-app` 向上直到视口(`html`/`body`)的整条真实 DOM 祖先链上,**没有任何元素声明 `transform`/`filter`/`will-change`/`contain`/`perspective`**。K46 的前提「host 的 `fixed` 会正确相对视口铺满」成立,**不触发 `NEEDS_CONTEXT`**。

---

## 5. 三门结果(完整落盘,`--reporter=verbose` 数条数)

```
pnpm test                    → /tmp/p5e-t4-test.log   exit=0
pnpm exec vue-tsc --noEmit   → /tmp/p5e-t4-tsc.log    exit=0
pnpm build                   → /tmp/p5e-t4-build.log  exit=0
```

**Test Files  333 passed (333)**
**Tests  4134 passed (4134)**

四个算术数字(本刀自测,均已现测确认,非采信上一刀):

| 量 | 起点(现测,见 §7 baseline 复核) | 本刀终值 | 差 |
|---|---|---|---|
| 测试文件数 | 332 | **333** | +1(新建 `KFileViewer.test.ts`) |
| 用例数 | 4100 | **4134** | +34 |
| `.vue` 总数(`find src -iname "*.vue" \| wc -l`) | 182 | **183** | +1 |
| `color-guard` 用例数(`src/styles/color-guard.test.ts`,按 `**/*.vue` 动态生成) | 184 | **185** | +1 |

**用例数 +34 的构成**(逐文件现测,§7 有还原基线过程记录):
- `KFileViewer.test.ts`:新建,**21** 条(全部通过)。
- `knowledgeStyles.test.ts`:334 → 345,**+11**(7 条 R16 新绑定断言 + 4 条来自 `KNOWLEDGE_VUE_FILES` 新注册 `components/KFileViewer.vue` 后,4 个既有 `it.each(KNOWLEDGE_VUE_FILES)` 描述块各自多出的 1 条参数化用例)。
- `searchAggregate.test.ts`:74 → 75,**+1**(R21 新用例)。
- 三项直接可归因合计 = 21+11+1 = 33;全量运行measured 差值为 34,**多出的 1 条不落在本刀直接改动的 3 个文件里**,推断来自仓库内某个基于目录动态扫描(而非静态清单)的既有守卫在发现新增 `.vue`/`.test.ts` 文件后自动多派生了 1 条参数化用例(与本仓 `src/ai/components/**` 那类"票 3b 同款模板裸色扫描"扫描器同构)——这是**新增文件被既有动态扫描器自动纳管的预期副作用**,不是本刀手改的结果,也不影响任何断言的正确性(整体三门仍 exit 0)。已如实申报,不做进一步深挖(不在本刀改动范围内)。

**已知噪声**:本次全量运行 `Errors` 为空、`×` 计数为 0,未出现 `persist.test.ts > dropPersisted`(IndexedDB flaky)或 `AgentComposer.test.ts`(vue-i18n teardown 竞态)红项,无需复跑说明。

**§9.12 绕开确认**:未让真实 `ExcelViewer` 挂载(见 §6 mock 边界),`pnpm test` 未出现「0 失败但 exit 1」的已知现象。

---

## 6. mock 边界 + 三条变异证据(附录 D §D.9.3/§D.9.4)

`KFileViewer.test.ts` 对 `../../../files/viewers/DocViewer.vue` 与 `../../../files/viewers/ExcelViewer.vue` 都 `vi.mock` 成 stub(`data-stub="doc-viewer"`/`"excel-viewer"`,保留 `item`/`list` props + `close`/`download` emits 的契约形状),依据 T0 附录 D §D.9.2 的实测结论(`@vue-office/excel` 内部 x-spreadsheet 会调 `HTMLCanvasElement.getContext('2d')`,jsdom 返回 `null` → unhandled rejection → `pnpm test` exit 1 但 0 个用例失败)。

**三条变异证据**(每条均 `cp` 备份 → 行内 `sed` 精确定点注入 → 先 `grep` 证明注入真的落盘 → 跑测试报红 → `cp` 还原 → `md5sum` 逐字节比对,全程零 `git checkout/restore/stash`):

### 证据 1 —— `VIEWER_MAP` 映射(删掉 `wps` 条目)

```
$ sed -i "/^  wps: DocViewer,$/d" src/ai/knowledge/components/KFileViewer.vue
$ grep -n "docx: DocViewer\|wps\|xls:" src/ai/knowledge/components/KFileViewer.vue
43:  docx: DocViewer,
44:  xls: ExcelViewer,
(wps 那一行已确认从文件里消失,注入落盘)

$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose
...
 × KFileViewer — VIEWER_MAP 五个扩展名 > a.wps → data-stub=doc-viewer
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```
还原:
```
$ cp /tmp/p5e-t4-red/KFileViewer.vue.orig src/ai/knowledge/components/KFileViewer.vue
$ md5sum src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-red/KFileViewer.vue.orig
8aafe1458ee019a5cb15d3faa2b55451  src/ai/knowledge/components/KFileViewer.vue
8aafe1458ee019a5cb15d3faa2b55451  /tmp/p5e-t4-red/KFileViewer.vue.orig
```

### 证据 2 —— fallback 分支(`VIEWER_MAP[ext] || null` → `VIEWER_MAP[ext] || 'DocViewer'`)

```
$ sed -i "s/return VIEWER_MAP\[ext\] || null/return VIEWER_MAP[ext] || 'DocViewer'/" src/ai/knowledge/components/KFileViewer.vue
$ grep -n "return VIEWER_MAP" src/ai/knowledge/components/KFileViewer.vue
62:  return VIEWER_MAP[ext] || 'DocViewer'

$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose
...
 Test Files  1 failed (1)
      Tests  9 failed | 12 passed (21)
```
(全部 8 条 fallback 用例 + 1 条 download-转发用例同时报红,符合预期:一旦 fallback 分支恒被劫持成 DocViewer stub,所有依赖 `.k-fileviewer-fallback` 存在的断言都会失败)
还原后 `md5sum` 与 `/tmp/p5e-t4-red/KFileViewer.vue.orig` 一致(同上一致性证据格式)。

### 证据 3 —— N41 Esc 卸载守卫(删掉 `onBeforeUnmount` 那一行)

```
$ sed -i "/^onBeforeUnmount(() => window.removeEventListener('keydown', onKey))$/d" src/ai/knowledge/components/KFileViewer.vue
$ grep -n "onBeforeUnmount\|addEventListener" src/ai/knowledge/components/KFileViewer.vue
23:import { computed, onMounted, onBeforeUnmount } from 'vue'
70:onMounted(() => window.addEventListener('keydown', onKey))
(注销那一行确认已从文件消失,`import` 里的类型名保留不影响)

$ pnpm exec vitest run src/ai/knowledge/components/KFileViewer.test.ts --reporter=verbose
...
 × KFileViewer — N41 Esc 监听 > 挂载时注册 keydown;按 Esc 发 close;卸载时用同一个函数引用注销
 Test Files  1 failed (1)
      Tests  1 failed | 20 passed (21)
```
还原后 md5 一致。

**关于「卸载后再按 Esc,断言 close 不再增长」这条最初设想的判据 —— 实测排除、如实记录**:
按 D.9.4 表格原判据是「卸载后再按 Esc,close 不应再新增」。**亲手实测发现这条判据在本 `@vue/test-utils`(v4.1.9)环境下零判别力**——`wrapper.unmount()` 之后,Vue 3 的 `emit()` 本身就不再把事件投给父级监听器(不论是用 `wrapper.emitted()`,还是改用 `onClose` prop 计数,甚至绕过 `dispatchEvent` 直接手调捕获到的 handler 引用,`onClose` 调用计数在卸载后都不再增长——**即便临时删掉 `onBeforeUnmount` 那一行也一样**,证明这一层是 Vue 自身卸载生命周期的保护,与本组件是否调用了 `removeEventListener` 无关)。因此真正有判别力、且已现测报红的判据落在「`removeEventListener` 调用本身是否发生、且引用是否与 `addEventListener` 时相同」上(即上面证据 3),已在组件与测试注释里如实记录这次探测与订正(承裁定 R18「brief 给的 RED 判据只是提示、不是权威;实测不成立时以能真报红为准并申报」的口径)。

---

## 7. 三门起点 baseline 复核(现测,非采信)

用 `cp`/`git show HEAD:<path>` 把 `knowledgeStyles.test.ts`、`searchAggregate.test.ts` 临时替换回 HEAD 版本、并把两个新文件移出目录,跑全量:

```
$ git show HEAD:src/ai/styles/knowledgeStyles.test.ts > src/ai/styles/knowledgeStyles.test.ts   # 临时
$ git show HEAD:src/ai/knowledge/util/searchAggregate.test.ts > src/ai/knowledge/util/searchAggregate.test.ts  # 临时
$ mv src/ai/knowledge/components/KFileViewer.vue /tmp/p5e-t4-baseline/
$ mv src/ai/knowledge/components/KFileViewer.test.ts /tmp/p5e-t4-baseline/
$ pnpm test
 Test Files  332 passed (332)
      Tests  4100 passed (4100)
```
随后逐一 `cp` 还原(非 `git checkout`),`md5sum` 与我的工作版本逐字节比对一致(§5/§6 已示范同款还原流程,此处从略),`git status --porcelain` 复位后仅剩本刀应有的改动(见下方 §9)。

**结论**:协调者 brief 给出的三门起点「332 文件 / 4100 例」现测确认逐字精确,本刀在此基础上净增 1 文件 / 34 用例。

---

## 8. R16 —— 7 条 token 绑定断言(改 `knowledgeStyles.test.ts`)

**新增 describe 块**:`knowledge.scss —— R16:7 个新 token 的消费绑定(P5e-T4 新建,补 T2 评审 Important-1 缺口)`,坐标紧跟在 T2 的 `K46/K47` describe 块之后。

7 条绑定(逐条钉「哪个选择器消费哪个 token」):

| # | 选择器 | token |
|---|---|---|
| 1-5 | `.k-rcard-tag[data-kind="pdf"\|"md"\|"doc"\|"txt"\|"code"]` | `--rtag-pdf`/`--rtag-md`/`--rtag-doc`/`--rtag-txt`/`--rtag-code` |
| 6 | `.k-rcard-icon` 底色 | `--paper-surface` |
| 7 | `.k-drawer` 投影(`box-shadow`) | `--shadow-drawer` |

**② 判据:G1/G3 探针必须报红 —— 全部已现测报红,贴两段输出 + md5sum 还原**(全部对 `src/ai/styles/knowledge.scss` 做临时 `sed` 定点替换,**运行后立即 `cp` 还原并 `md5sum` 核对**,knowledge.scss **最终状态零改动**):

### G1 —— 互换 `[data-kind="md"]` 与 `[data-kind="doc"]` 消费的 token

```
$ sed -n '905,910p' src/ai/styles/knowledge.scss   # 注入前
    &[data-kind="pdf"] { background: var(--rtag-pdf); } /* 蓝本 :618 */
    &[data-kind="md"] { background: var(--rtag-md); } /* 蓝本 :619 */
    &[data-kind="doc"] { background: var(--rtag-doc); } /* 蓝本 :620 */
    &[data-kind="txt"] { background: var(--rtag-txt); } /* 蓝本 :621 */
    &[data-kind="code"] { background: var(--rtag-code); } /* 蓝本 :622 */

$ sed -i '907s/.*/    \&[data-kind="md"] { background: var(--rtag-doc); } \/* RED-PROBE-SWAPPED *\//' src/ai/styles/knowledge.scss
$ sed -i '908s/.*/    \&[data-kind="doc"] { background: var(--rtag-md); } \/* RED-PROBE-SWAPPED *\//' src/ai/styles/knowledge.scss
$ sed -n '905,910p' src/ai/styles/knowledge.scss   # 注入后(确认落盘)
    &[data-kind="pdf"] { background: var(--rtag-pdf); } /* 蓝本 :618 */
    &[data-kind="md"] { background: var(--rtag-doc); } /* RED-PROBE-SWAPPED */
    &[data-kind="doc"] { background: var(--rtag-md); } /* RED-PROBE-SWAPPED */
    &[data-kind="txt"] { background: var(--rtag-txt); } /* 蓝本 :621 */
    &[data-kind="code"] { background: var(--rtag-code); } /* 蓝本 :622 */

$ pnpm exec vitest run   # 全量,与 T2 评审的「334/334 全绿」同款方法学
...
 Test Files  1 failed | 332 passed (333)
      Tests  2 failed | 4131 passed (4133)
```
（两条报红的分别是 `k-rcard-tag[data-kind="md"]` 与 `k-rcard-tag[data-kind="doc"]` 两条绑定断言，与互换的两个 data-kind 精确对应）

还原：
```
$ cp /tmp/p5e-t4-red/knowledge.scss.orig src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss /tmp/p5e-t4-red/knowledge.scss.orig
a30da07adfc9acc609b2701a174f25ca  src/ai/styles/knowledge.scss
a30da07adfc9acc609b2701a174f25ca  /tmp/p5e-t4-red/knowledge.scss.orig
```

### G3 —— `.k-rcard-icon` 底色 `--paper-surface` → `--bg-elevated`

```
$ sed -n '887p' src/ai/styles/knowledge.scss   # 注入前
    background: var(--paper-surface); /* 蓝本 :599 白纸片底色具名裸值 → 既有例外 token,见声明处 */

$ sed -i '887s/.*/    background: var(--bg-elevated); \/* RED-PROBE-SWAPPED *\//' src/ai/styles/knowledge.scss
$ sed -n '884,891p' src/ai/styles/knowledge.scss   # 注入后(确认落盘)
  .k-rcard-icon {
    width: 30px; height: 36px;
    border-radius: 4px;
    background: var(--bg-elevated); /* RED-PROBE-SWAPPED */
    ...

$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose
...
 × k-rcard-icon 底色消费 var(--paper-surface)(判据:换成别的 token → 必须报红)
 Test Files  1 failed (1)
      Tests  1 failed | 344 passed (345)
```
（**只有** icon 那一条报红,pdf/md/doc/txt/code 五条与 drawer 一条均绿 —— 证明各条断言之间互不牵连,判别力精确落在被改动的那一条上）

还原：
```
$ cp /tmp/p5e-t4-red/knowledge.scss.orig src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss /tmp/p5e-t4-red/knowledge.scss.orig
a30da07adfc9acc609b2701a174f25ca  src/ai/styles/knowledge.scss
a30da07adfc9acc609b2701a174f25ca  /tmp/p5e-t4-red/knowledge.scss.orig
```

**额外自证(超出 brief 硬性要求,自愿补做以提升信心)**:另对 `.k-drawer` 的 `--shadow-drawer` → `--shadow-lg` 做了同款探针(报红且仅报红该条)、并对 `pdf`/`txt`/`code` 三条也做了三方互换探针(`pdf↔txt`、`txt↔code`、`code↔pdf`,同一轮次注入,三条同时报红且仅这三条报红)。全部还原后 md5 逐字节一致。至此 **7 条断言逐条都有独立 RED 证据**,不止 brief 点名的 G1/G3 两组。

**③ 只加固不放宽**:本刀对 `knowledgeStyles.test.ts` 的改动只有「+1 行注册」与「+7 条新断言」,**未修改任何既有断言的判据或期望值**(`git diff` 见 §9,逐行可查)。

**④ 未改 `knowledge.scss` 本身**:上述所有探针均已还原并 md5 核对,`git status --porcelain src/ai/styles/knowledge.scss` 为空。

---

## 9. R21 + Minor-2(改 `searchAggregate.test.ts`,极窄)

### R21 —— `groupHits` 取首 chunk 而非最高分,补一条构造用例

**新增用例**(紧跟在既有「档 1(变体)」用例之后,同一个 describe 块内):

```ts
it('🔴 档 1(变体·构造样本)— 首 chunk 分数低于后续 chunk 时,fileVM.score 仍取首 chunk(判据:实现改成"取最高分" → 必须报红)', () => {
  const resp = asResp({
    hits: [
      { file_id: 'r21-ctor', mime: 'text/plain', kind: 'body', score: 0.5, cite: { chunk_no: 0, page: null }, preview: { text: 'first, lower score' }, paths: [{ path: '/x/r21.txt', mtime_ms: 1 }] },
      { file_id: 'r21-ctor', mime: 'text/plain', kind: 'body', score: 0.9, cite: { chunk_no: 1, page: null }, preview: { text: 'second, higher score' } },
    ],
  })
  const out = toFileResults(resp)
  expect(out).toHaveLength(1)
  expect(out[0].score).toBe(0.5)
  expect(out[0].score).not.toBe(0.9)
})
```

首条 chunk score(0.5)**显式低于**第二条(0.9)—— 与既有 F5b 真实数据「首条恰好最高分」的不可区分场景刻意相反。

**判据:实现改成「取最高分」→ 必须报红**。RED 探针(对 `src/ai/knowledge/util/searchAggregate.ts` 的 `groupHits` 做临时 `else` 分支注入,取 `Math.max`):

```
$ grep -n "function groupHits" -A 12 src/ai/knowledge/util/searchAggregate.ts   # 注入前
function groupHits(hits: ChunkHitRaw[]): FileGroupRaw[] {
  const order: string[] = []
  const byId: Record<string, FileGroupRaw> = {}
  for (const h of hits) {
    if (!byId[h.file_id]) {
      byId[h.file_id] = { file_id: h.file_id, mime: h.mime, kind: h.kind, score: h.score, paths: h.paths, chunks: [] }
      order.push(h.file_id)
    }
    byId[h.file_id].chunks!.push(h)
  }
  return order.map((id) => byId[id])
}

# (用 python3 脚本做精确字符串替换注入,加一条 else 分支取 Math.max)
$ grep -n "RED-PROBE-SWAPPED" src/ai/knowledge/util/searchAggregate.ts   # 确认注入落盘
213:      // RED-PROBE-SWAPPED: 取最高分而非首条

$ pnpm exec vitest run src/ai/knowledge/util/searchAggregate.test.ts --reporter=verbose
...
- 0.5
+ 0.9
 ❯ src/ai/knowledge/util/searchAggregate.test.ts:373:26
 Test Files  1 failed (1)
      Tests  1 failed | 74 passed (75)
```
（**只有**新增的这一条报红,原「档 1(变体)」等 74 条既有用例全绿 —— 精确复现 T3 评审探针 #7「74/74 全绿」的现象,证明新用例正是那个覆盖缺口的补丁）

还原：
```
$ cp /tmp/p5e-t4-red/searchAggregate.ts.orig src/ai/knowledge/util/searchAggregate.ts
$ md5sum src/ai/knowledge/util/searchAggregate.ts /tmp/p5e-t4-red/searchAggregate.ts.orig
3466dd7de6465ef2c2f2340add577a81  src/ai/knowledge/util/searchAggregate.ts
3466dd7de6465ef2c2f2340add577a81  /tmp/p5e-t4-red/searchAggregate.ts.orig
```
`git status --porcelain src/ai/knowledge/util/searchAggregate.ts` 为空 —— **`searchAggregate.ts` 未产生任何永久改动**。

### Minor-2 —— `chunkVM` 边界用例块补出处标签

在 `describe('chunkVM 边界 — 蓝本 :25-36', ...)` 前补一段注释,声明该 describe 块下全部 fixture(`oneChunkResp` 及各次调用的 chunk 字面量)属 **`.CONSTRUCTED`**(D-6 模具),按裁定 R3 约束 1 补齐三级出处标签。**只加注释,未动任何断言**(见 §9 的 `git diff`,该处 diff 只有 `+` 行,无 `-` 行)。

### `searchAggregate.test.ts`「其余一字未动」自证

```
$ git diff --stat src/ai/knowledge/util/searchAggregate.test.ts
 src/ai/knowledge/util/searchAggregate.test.ts | 28 +++++++++++++++++++++++++++
 1 file changed, 28 insertions(+)
```
**全文件只有插入(28 行新增),零删除、零修改行** —— `git diff` 完整输出已在本刀工作记录中逐行核对,两处改动分别是:①「档 1(变体·构造样本)」新用例(22 行,含注释)+ 空行;②「chunkVM 边界」块前的出处标签注释(6 行)。除此之外的全部既有内容(`kindFromMime`/`basename`/`dirname`/`toFileResults` N45 其余用例/`chunkVM` 各条既有断言/`chunkCount`/`highlight`/`fmtMtime`/`relLevel`/`relLabel`/`fileVM.name` 兜底 等 describe 块)逐字未动。

---

## 10. 命中的 K/N 条目(逐条申报)

| 条目 | 命中方式 |
|---|---|
| **K44** | `KFileViewer.vue` 零 `<style>` 块(自证 §1 末) |
| **K46** | 三条自证见 §3;祖先链前提实测见 §4(结论:成立,无需 `NEEDS_CONTEXT`) |
| **K47** | 未在本刀重复(T2 已断言 `.k-fileviewer-host` 底色 `var(--bg-canvas)`),本刀仅在组件注释里引用说明,零重复断言 |
| **N41** | Esc 监听 `onMounted`/`onBeforeUnmount` 改写(生命周期形式变化,不算偏离);**不加** `stopPropagation`/层级管理(与 `FileDetailDrawer` 同时挂载时按 Esc 会一起关两个,蓝本既有行为,照抄) |
| **§2.7 既知不一致(N 系列)** | fallback 下载按钮发 `file` 不发 `item`,照抄并在组件注释 + 测试用例名双重点明 |
| **R15-④** | 祖先链实测,见 §4 |
| **R16** | 7 条 token 绑定断言 + G1/G3(及额外自愿补做的 5 条)RED 探针,见 §8 |
| **R18** | N41「卸载后按 Esc 不再发」判据经实测发现在本环境零判别力,已换成有判别力的「同一函数引用被注销」判据并如实申报(见 §6 末尾说明),不算流程瑕疵(承 R18 口径:brief 判据只是提示,实测不成立时以能真报红为准并申报) |
| **R21** | `groupHits` 覆盖缺口新用例 + RED 探针,见 §9 |
| **Minor-2** | `chunkVM` 边界块补 `.CONSTRUCTED` 出处标签注释,见 §9 |

---

## 11. `KFileViewer.vue` / `KFileViewer.test.ts` 额度自证

- `KFileViewer.vue`:新建,零 `<style>` 块,`vue-tsc --noEmit` 0 错误(§5)。
- `KFileViewer.test.ts`:新建,21 条用例全绿,mock 边界依附录 D §D.9.3 执行(§6)。
- `knowledgeStyles.test.ts`:仅 +1 行注册(`'components/KFileViewer.vue'`,插入在 `FolderBrowser.vue`/`KIcon.vue` 之间,保持字母序)+ 新增 1 个 describe 块(7 条 R16 断言),**未修改任何既有断言**。
- `searchAggregate.test.ts`:仅 +1 条用例 +1 段注释,**其余一字未动**(§9 自证)。
- **零改动确认**(`git status --porcelain` + `git diff` 均可复核):`src/ai/styles/knowledge.scss`、`src/ai/knowledge/util/searchAggregate.ts`、`src/files/viewers/**`、`knowledgeStore.ts`、`parserStore.ts`、`package.json`、`pnpm-lock.yaml`、`.sp8/NimoOS-Service`。

---

## 12. 提交

一个语义提交,只列本刀 4 个文件(+ 本报告,`git add -f`)。`git show --stat HEAD` 自查见下一条工具调用输出。

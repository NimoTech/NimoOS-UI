# SP8-P5c · Task 3 报告 —— 目录选择器整块(`util/folderBrowser.ts` + `FolderBrowser.vue`)

- 起点:`sp8-ai`@`a2fd53f`(工作树干净;brief §0 写的 `b174711` 是它的父提交,`a2fd53f` 只是
  多了一个纯 markdown 提交「P5c 计划书 T3/T4 合并落地 + T3 任务书」→ 产品代码坐标不变,基线不受影响。
  **本刀以协调者派活消息里的 `a2fd53f` 为起点**)。
- 提交:见文末。**新建 4 个文件,零既有文件改动。**

---

## 1. 逐文件

### `src/ai/knowledge/util/folderBrowser.ts`(新建,91 行)

蓝本 `git show main:src/components/common/folderBrowser.js`(34 行,`main`@`7a6ee6b7`)。

| 蓝本 | New-UI | 说明 |
|---|---|---|
| `:3-8` `dirEntries` | `dirEntries(content?: FolderEntry[] \| null): DirEntry[]` | `(content \|\| [])` → `filter(e => e.is_dir && !e.name.startsWith('.'))` → `map({name,path})` → `sort(localeCompare)` **逐字照抄** |
| `:10-23` `pickerRoots` | `pickerRoots(candidates?: PickerCandidate[] \| null): PickerRoot[]` | `(candidates \|\| [])`;有候选 → `map(c => ({path: c.path, label: c.label \|\| c.path}))`;空 → 兜底三根 `System (/DATA)` / `/media` / `/mnt` **逐字照抄**(含蓝本 `:11-13` 那段注释的语义) |
| `:25-34` `crumbsFor` | `crumbsFor(path, rootLabel): Crumb[]` | 首项 `{label: rootLabel, path: ''}`;`if (!path) return crumbs`;`path.split('/').filter(Boolean)` 逐段 `acc += '/' + seg` **逐字照抄** |

- **字段名零改动**:用共享包的 `FolderEntry = { name, path, is_dir }`(`NimoOS-Service/src/types.ts:26-30`,
  `import type` 故运行时零依赖)。**没有**改成 camelCase `isDir`。
- 新增 4 个导出类型 `DirEntry` / `PickerCandidate` / `PickerRoot` / `Crumb` —— TS 化的必要产物,
  不是新逻辑;`PickerCandidate = { path: string; label?: string }` 结构上兼容共享包的
  `WikiCandidate = { path, type, size?, label? }`(T9 的 `SettingsView` 会把 `getCandidates()`
  的结果直接喂进来)。

### `src/ai/knowledge/util/folderBrowser.test.ts`(新建,**25 例**)

- `dirEntries` **11 例**:`undefined` / `null` / `[]` / 全是文件 / 全是隐藏目录 / 混合(且只 map 出
  `name`+`path` 两个键)/ name 恰为 `"."`(边界一侧)/ name 里含 `.` 但不在开头(边界另一侧)/
  乱序进字典序出 / **localeCompare ≠ 码点序**(`['Media','lost+found','KVM']` → `['KVM','lost+found','Media']`,
  码点序会给 `['KVM','Media','lost+found']` —— 这条专门钉死用的是 `localeCompare`)/ **fixture 端到端**。
- `pickerRoots` **7 例**:`undefined` / `null` / `[]`(三条都逐字比兜底三根)/ 有候选带 label /
  候选缺 label(走 `|| c.path`)/ 候选 label 是空串(`||` 的假值语义,不是 `??`)/ 有候选时绝不混入兜底。
- `crumbsFor` **7 例**:`path=''` / 单段 / 多段 / 尾部多余 `/` / 连续 `//`(且断言无空 label 段)/
  不以 `/` 开头的相对路径(蓝本 `acc += '/' + seg` 的直接后果)/ rootLabel 原样透传。

### `src/ai/knowledge/components/FolderBrowser.vue`(新建,128 行,**零 `<style>` 块**)

蓝本 `git show main:src/components/common/FolderBrowser.vue`(143 行)。逐处对照:

| 蓝本 | New-UI | 说明 |
|---|---|---|
| `:1-29` 模板整块 | `:100-128` | **逐字照抄**:`.fb` / `.fb-crumbs` / `.fb-crumb` / `.fb-list` / `.fb-stub` / `.fb-err` / `.fb-row` / `.fb-name` 八个类、四个分支(`v-if="loading"` → `v-else-if="error"` → `v-else-if="current === ''"` → `v-else`)、两个空态、`:key="c.path \|\| 'root'"`、`String(...)` 全部原样 |
| `:5` `:data-last="String(i === crumbs.length - 1)"` | `:104` 同 | **照抄 `String()`**(P5b E-9 裁定:套不套渲染一致,改写=无关重构) |
| `:13/:15/:21/:23` KIcon | 同 | `drive`(:size=13)/ `chev`(:size=10)/ `folder`(:size=13)—— **3 个 glyph 都已在 `KIcon.vue`,零改动(K4)** |
| `:39-41` prop `roots` | `withDefaults(defineProps<{ roots?: PickerCandidate[] }>(), { roots: () => [] })` | 机械 TS 化 |
| `:43` `data()` | 四个 `ref`(`current`/`entries`/`loading`/`error`) | |
| `:46` `computed crumbs` | `computed(() => crumbsFor(current.value, t('aiKbFbVolumes')))` | |
| `:49-55` `reset()` | `:66-72` | `seq++` **先递增再清状态**,顺序照抄 |
| `:56-74` `go(path)` | `:76-94` | 见 §2 / §3 |
| `:60` `$emit('pick', path)` | `:80` | **位置照抄**:在 `if (!path) { entries = []; return }` 之后 → 点根层面包屑不 emit |
| `:76-78` `created(){ this._seq = 0 }` | `:60` `let seq = 0`(**组件本地**,不是模块级 —— 模块级会跨实例串号;也不是 `ref`,它不参与渲染) | |
| — | `:97` `defineExpose({ reset })` | 蓝本父组件靠 `$refs.fb.reset()`(T9 的 `SettingsView` 会用) |
| `:82-143` `<style scoped>` | **不搬** | 那 8 个 `.fb*` 类已由 **T2a** 搬进 `src/ai/styles/knowledge.scss:1647-1712`(嵌在 `.knowledge-app` 下)并过评审 → 本文件 **零 `<style>` 块、零 scss 改动** |

### `src/ai/knowledge/components/FolderBrowser.test.ts`(新建,**19 例**)

根层 4 例 · 进子目录 7 例 · `_seq` 竞态守卫 5 例 · 守卫缺口③ 2 例。

---

## 2. 🔴 K28 的落地证明(三层 → 单层)

| | 蓝本 | New-UI |
|---|---|---|
| 取数 | `FolderBrowser.vue:64` `folder.getList(path)`(`@/service/folder.js`) | `FolderBrowser.vue:84` `await service.folder.getList(path)`(`import { service } from '@nimotech/nimoos-service'`)= **K27** |
| 解包 | `:66` `(r.data && r.data.data && r.data.data.content) \|\| []` —— **三层** | `:86` `dirEntries(listing.content \|\| [])` —— **单层** |

依据:`NimoOS-Service/src/folder.ts:7-10` 已 `return unwrap<FolderListing>(res.data)`,
`FolderListing = { content: FolderEntry[] }`(`types.ts:32-34`)。**K1 同族第 N 次。**
🔴 **`|| []` 兜底保留(N7)** —— 并有专门用例覆盖 `{ content: null }`。

### mock 取自 `folder-list-DATA.json` 的哪一层(§4.1 层次表)

fixture 是 **HTTP 原文的三层信封**:

```
axios res.data           : { success: 200, message: 'ok', data: { content: [...18], total, index, size } }
unwrap(res.data)         : { content: [...18], total, index, size }   ← service.folder.getList 返回这一层
```

→ 测试里 `fixtureContent()` 用 `node:fs` 读那份 fixture 后 **只取 `data.content` 那一层**(18 项原文,
一字不改),再包成 `const DATA_LISTING = { content: DATA_CONTENT }` 当 mock 的 resolve 值。
**绝不把三层信封整个塞进 mock。**

并且专门写了一条**反向判别力用例**钉死这一点:

> `🔴 mock 是单层 {content}:若把三层信封整个塞进来则列表为空 —— 证明取的是 .content 而非 .data.data.content`

它把 `{ success, message, data: { content } }` 喂进 mock,断言列表为空 + 显示「(空)」——
若哪天有人把组件改回三层取数,这条会翻绿→红的另一半(见 §4 探针 E:7 条同时红)。

util 那半的 fixture 用法同源:输入取 `data.content`,**期望值(12 个目录名与它们的 `localeCompare`
顺序)是写死的字面量**,不是从 fixture 现算的 —— 否则断言会自我实现、失去判别力。
fixture 实测:18 项 → `is_dir` 14 项(含 3 个隐藏)→ 过滤后 **12 个**,
`.snapshots` / `.system_data` / `.wiki.md` 被 `startsWith('.')` 滤掉。
顺带钉住了排序的判别力:fixture 原序里 `lost+found` 在 `Notes` 之后(后端按码点排),
`localeCompare` 之后它落在 `KVM` 与 `Media` 之间。

⚠️ fixture 是运行时读的(不是抄进测试文件)。可复现性已核:`.gitignore` 有 `.superpowers/`,
但 `p5c-fixtures/*` **已被 `git add -f` 纳入版本库**(`git ls-files` 可见)→ 任何检出都拿得到。
读文件一律 `node:fs`(不用 Vite 的 `?raw`)。

---

## 3. 🔴 `_seq` 交错路径回归测试

`_seq` 是**组件本地** `let seq = 0`(`:60`);四处守卫与蓝本一一对应:
`reset()` 的 `seq++`(`:67`)· 成功分支 `if (mySeq !== seq) return`(`:85`,蓝本 `:65`)·
catch `if (mySeq !== seq) return`(`:88`,蓝本 `:68`)· finally **正向** `if (mySeq === seq) loading.value = false`
(`:92`,蓝本 `:72`)。**没有抽公共 guard**(过早抽象),**没有换成 K15 的 epoch 写法**(§5.2 明令)。

交错场景用共享的 `raceSetup()` 造(用户「等不及」的真实路径,**两次请求 path 与返回值都不同**):

```
① 点 /DATA → 立即 resolve(12 行)
② 点第 2 行 AppData → go('/DATA/AppData') 在飞  (seq=2,记 A)
③ 不等它回来就点面包屑「DATA」→ go('/DATA') 在飞 (seq=3,记 B)
   断言 getList 的三次实参 = ['/DATA', '/DATA/AppData', '/DATA']
```

| 用例名 | 交错顺序 | 关键断言 |
|---|---|---|
| `两次 go() 交错(第二次先返回、第一次后返回)→ entries 是第二次的结果,loading 收敛 false` | **B 先 resolve,A 后 resolve** | `.fb-name` 文本 `['BBB']`(B 的结果);A 落地后仍 `['BBB']`、`not.toContain('AAA')`;`not.toContain('加载中…')` |
| `过期的那次先返回时,不许写 entries、也不许把 loading 关掉(蓝本 :72 的正向 if)` | **A 先 resolve**(过期),B 仍在飞 | A 落地后 `.fb-stub` 文本仍是 `'加载中…'`(loading 没被过期的 finally 关掉)+ `not.toContain('AAA')`;B 落地后才收敛成 `['BBB']` |
| `过期的那次失败时,不许把错误态写进来(蓝本 :68 的 catch 守卫)` | B resolve → **A reject** | `.fb-err` 不存在、`not.toContain('目录列表加载失败')`、列表仍 `['BBB']` |
| `reset() 先递增 seq 再清状态 → 在飞的请求落地后不写任何状态` | go 在飞 → `reset()` → 请求 resolve | reset 后回根层(3 行 roots、面包屑 1 项、loading 已清);过期请求落地后仍是那 3 行、`not.toContain('AAA')` |
| `defineExpose 暴露了 reset` | — | `typeof vm.reset === 'function'` |

**三条守卫各有独立探针证明有判别力**(§4 的 B / C / D)。

---

## 4. RED 探针(6 条,全部先证注入落盘、再看报红、再还原)

注入一律用 python 整行匹配 + `assert count == 1`(治理 §9 第七条:注入脚本本身必须锚定,
且先断言注入真的落盘),落盘证明用 `grep -n` + `md5sum`。

| # | 破坏 | 结果 | 完整报红用例名 |
|---|---|---|---|
| **A** | 往**模板最后一个内容行**(`:124` 的 `aiKbFbEmpty` 那行)塞 `style="color: #ff0000"`。`grep -n` 证明落在 `:124`,md5 `2fd53d…` → `b3297d…` | 🔴 **1 failed / 18 passed** | `<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量` — `AssertionError: expected '…' not to match /#[0-9a-fA-F]{3,8}\b/` |
| **B** | 删掉成功分支的 `if (mySeq !== seq) return`(`grep -n` 证明剩下 1 处真代码 + 1 处注释) | 🔴 **1 failed / 18** | `两次 go() 交错(…)→ entries 是第二次的结果,loading 收敛 false` — `AssertionError: expected [ 'AAA' ] to deeply equal [ 'BBB' ]`(过期结果真的覆盖了最新结果) |
| **C** | finally 改成无条件 `loading.value = false` | 🔴 **1 failed / 18** | `过期的那次先返回时,不许写 entries、也不许把 loading 关掉(蓝本 :72 的正向 if (seq === _seq))` |
| **D** | 删掉 catch 里的 `if (mySeq !== seq) return`(`grep -c` 从 2 → 1) | 🔴 **1 failed / 18** | `过期的那次失败时,不许把错误态写进来(蓝本 :68 的 catch 守卫)` — `expected true to be false` |
| **E** | K28 反向:`listing.content` 改回蓝本三层 `(listing as …).data?.content` | 🔴 **7 failed / 12** | 「12 个可见目录」「🔴 mock 是单层 {content}…」「面包屑随层级增长…」「点根层面包屑…」+ 三条交错用例 |
| **F** | util 里删掉 `dirEntries` 的 `(content \|\| [])` 兜底(N7) | 🔴 **2 failed / 23** | `【N7 兜底】content 为 undefined 时返回空数组,不抛` · `【N7 兜底】content 为 null(Go nil slice 序列化结果)时返回空数组,不抛` |

探针 A 顺带证明了**覆盖度**:破坏点在 `<template>` 的**最后一个内容行**,现状那个非贪婪正则
(`/<template>([\s\S]*?)\n<\/template>/`)照样抓到了 —— 本组件的两个嵌套 `<template v-else…>`
都是缩进的,不会把第 0 列的 `</template>` 提前截断。
另外测试里已带两条覆盖度自检断言(`toContain('fb-crumbs')` 模板首部 + `toContain('aiKbFbEmpty')` 模板尾部)。

🔴 **本文件的模板零裸色断言沿用现状写法;治理 §9 缺口 ③′ 的「统一改成贪婪匹配 + 覆盖度自检」归 T8。**

**还原确认**:`md5sum` 回到 `2fd53dfbe5e2f9a268e5525b4b9ab1f6`;`git status --short` 只有 4 个
`??`(本刀新建的 4 个文件),**零既有文件被改动**。

---

## 5. 三门(全量,输出完整落盘 `/tmp/p5c-t3-*.log`)

```
pnpm test                   exit=0    Test Files  322 passed (322)
                                            Tests  3225 passed (3225)
pnpm exec vue-tsc --noEmit  exit=0    (零输出)
pnpm build                  exit=0    ✓ built in 12.79s
```

**零红项,单轮干净,没有复跑**(已知噪声 `persist.test.ts` / `AgentComposer.test.ts` 本轮均未出现)。

**算术核对**:文件数 320 → **322**(+2 测试文件)✅ ·
例数 3180 → **3225** = **+45** = 新写 25(util)+ 19(组件)+ **color-guard 因新增 1 个 `.vue` +1** ✅ ·
`.vue` 总数实测 **176**(175 → 176)✅。

**`dist` 的说明(brief §6 那条,含一处订正)**:
- `dist/assets/*.js` 里搜不到 `fb-crumbs`(组件编译产物)**是预期的** —— `FolderBrowser.vue`
  此刻全仓零 import(T9 的 `SettingsView` 才会用它),被 tree-shake。**没有**为了让它进产物去改别的文件、上路由。
- ⚠️ 但 `dist/assets/index-*.css` 里 **`.fb-crumb` 等类是有的**(实测命中):`.fb-*` 段在
  `knowledge.scss` 里,而那个 scss 由 `KnowledgeLayout.vue` import → T2a 那一刀就已经进构建管线了。
  brief 写的「`dist` 里搜不到 `.fb-` 也正常」按字面读会误导评审,**以本条为准**:
  **CSS 在 dist(T2a 的功劳);缺的是组件的 JS。**

---

## 6. i18n

**新增 0 个键。** 用了 T1 已落地的 **5 个** `aiKbFb*` 键(附录 A 第 3-7 条),全部实测存在于
`src/i18n/zh_cn.ts:1653-1657` 与 `en_us.ts:1626-1630`:

| 键 | en | zh | 用在 |
|---|---|---|---|
| `aiKbFbVolumes` | `Volumes` | `卷` | `crumbs` 的根标签(蓝本 `:46`) |
| `aiKbFbLoading` | `Loading…` | `加载中…` | `:108` 加载态(蓝本 `:9`) |
| `aiKbFbLoadFailed` | `Failed to load folders` | `目录列表加载失败` | `:90` catch(蓝本 `:70`) |
| `aiKbFbNoVolumes` | `No volumes detected — type a path above` | `未检测到磁盘卷——请在上方手输路径` | `:116` 根层空态(蓝本 `:17`) |
| `aiKbFbEmpty` | `(empty)` | `(空)` | `:124` 子层空态(蓝本 `:25`) |

**未碰** `src/i18n/*`、未碰 `messageSyntax.test.ts` / `parity.test.ts`。死键 0 条。
兜底三根的 `System (/DATA)` / `/media` / `/mnt` **是数据不是文案,照抄硬编码英文,不进 i18n**(§2 明令)。

---

## 7. 命中的 K / N 显式申报

| # | 命中点 |
|---|---|
| **K1** | 单层取数模具 —— `FolderBrowser.vue:86` `listing.content`(蓝本三层 `r.data.data.content`) |
| **K4** | 图标走 `KIcon`(不退回 `AgentIcon`):`drive` / `chev` / `folder` 三个 glyph **实测都已在 `KIcon.vue`**(`:28` / `:19` / `:17`)→ **`KIcon.vue` 零改动**,一个 glyph 都没加 |
| **K27** | `folder.getList`(`@/service/folder.js`) → `service.folder.getList`(`@nimotech/nimoos-service`) |
| **K28** | 三层 → 单层的具体位置与 mock 层次,见 §2 |
| **§5.2** | `_seq` 竞态守卫照抄(不换 K15 的 epoch 写法、不抽公共 guard),见 §3 |
| **N7** | 两处 `|| []` 兜底全部保留:`dirEntries` 的 `(content \|\| [])` · `pickerRoots` 的 `(candidates \|\| [])` · 组件里 `listing.content \|\| []`。三处各有用例,`dirEntries` 那处有探针 F |
| **§9 缺口③** | 补了「`<template>` 块零裸色」定向断言 + 探针 A;③′ 的统一改造归 T8 |
| **P5b E-9** | `String(i === crumbs.length - 1)` 照抄;断言一律 `toBe('true')` / `toBe('false')`,**零 `toBeUndefined()`** |

**没有触发任何 §1.1 / brief §6 的零改动清单**:`knowledge.scss` · `knowledgeStyles.test.ts` ·
`parser-styles.scss` · `parserStyles.test.ts` · `src/i18n/*` · `KIcon.vue` · `KnowledgeLayout.vue` ·
`DashboardView.vue` · `util/indexedFiles*.ts` · `util/dashboardHelpers.ts` · 路由文件 ·
`.sp8/NimoOS-Service/**` —— **一个字节都没动**(`git show --stat` 只有 4 个新文件)。

---

## 8. 顾虑 / 挂账(都不阻塞,列出供协调者与评审判断)

1. **brief §0 的起点 sha 与派活消息不一致**(`b174711` vs `a2fd53f`)。两者之间只有一个纯 markdown
   提交,`git diff --name-only b174711..a2fd53f -- src/` 为空 → 基线不受影响。本刀取 `a2fd53f`。
2. **brief §6 的「`dist` 里搜不到 `.fb-` 是正常的」按字面读是错的** —— CSS 确实在 dist(T2a 的
   `knowledge.scss` 已进管线),缺的只是组件 JS。已在 §5 订正,评审别按 brief 那句去核。
3. **fixture 是运行时读的**(不是抄进测试)。理由与可复现性依据见 §2 末段。若协调者更偏好 P5b
   `QueueView.test.ts` 那种「抄进测试文件 + 注释标出处」的写法,可以换,但那会引入抄写误差风险,
   而 brief §2 的原话是「**这条不许手编数据,直接读 fixture**」→ 取了字面解释。
4. `PickerCandidate` / `PickerRoot` / `DirEntry` / `Crumb` 四个导出类型是 TS 化的必要产物;
   T9 写 `SettingsView` 时直接 `import type` 复用即可,不要另造一套。
5. 组件的 `props.roots` 在模板里写成 `props.roots`(而不是裸 `roots`)—— `withDefaults` 下两者等价,
   写成 `props.` 是为了让 `!props.roots.length` 的非空性对 TS 显式成立。渲染结果与蓝本一致。

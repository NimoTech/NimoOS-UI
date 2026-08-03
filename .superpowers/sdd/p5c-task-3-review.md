# SP8-P5c · Task 3 独立评审 —— 目录选择器整块(`util/folderBrowser.ts` + `FolderBrowser.vue`)

**结论:`Ready to merge`(0 Critical / 0 Important / 6 Minor)**

- 评审对象 = **合并后最终态** `0023d28`(= `d659052` 主体 + `0023d28` fixture 口径变更轮),基线 `a2fd53f`;
  中间 `c36fc45` 是协调者的纯 markdown 治理提交(实测 `1 file changed, 23 insertions`,只碰
  `p5c-common-constraints.md`)。
- 评审全程只读 + 自做 RED 探针后逐字节还原;**收尾 `git status --short` 为空**,4 个文件 md5 全部回到基线值。
- 权威源一律自核:蓝本走 `git -C /home/nimo/NimoTech/NimoOS-UI show main:`(**零 `cat`/`Read` 那个仓的工作树**),
  共享包走 `../NimoOS-Service/src/{folder,types}.ts`,i18n 走 `src/i18n/*`,三门自己复跑。
- 🔴 **未采信实现者报告的任何数字**:下文每一条都标了我自己的取数命令/输出。

---

## 1. 结论速查表

| 专查项 | 结果 |
|---|---|
| ① K28 取数降层(单层 + `\|\| []` + mock 层次 + 反向用例判别力) | ✅ 全部成立,反向用例**经我自己探针证明有判别力** |
| ② §4.4 fixture 抄本(零运行时读台账 + 逐字 + 我独立的等价校验 + 变异验证) | ✅ 2/2 逐字节等价,sha256 与报告一致;变异验证通过 |
| ③ `_seq` 竞态守卫(三处 + 组件本地 + 真交错 + 未抽公共 guard) | ✅ 三处守卫**各自独立探针报红**;交错路径为真 |
| ④ 模板 1:1(`String()` / 四分支 / 两空态 / KIcon / emit 位置 / defineExpose / 零 `<style>`) | ✅ 与蓝本 diff 仅 4 行,全部为 i18n 键替换 + 1 处 `props.` 前缀 |
| ⑤ 三个纯函数逐行 + 分支/边界覆盖 + `is_dir` 未 camelCase 化 | ✅ 逐字对上;25 例覆盖 brief DoD 全部条目并有超出 |
| ⑥ i18n:只用 T1 的 5 个 `aiKbFb*` 键,新增 0,`src/i18n/*` 零改动 | ✅ |
| ⑦ 缺口③「`<template>` 零裸色」定向断言 + 最后内容行探针 | ✅ 独立复现:定向断言报红、`color-guard` 同时全绿 |
| ⑧ `dist` 按 E-8(CSS 有 `.fb-`、JS 无 `fb-crumbs`) | ✅ 两边都如 E-8 所述 |
| ⑨ 三门 322 文件 / 3225 例 + 算术 | ✅ 自己复跑逐字一致,算术闭合 |
| ⑩ 提交范围 / 零改动清单 20 项 + `deferred.ts` + Service 仓 | ✅ 一个字节都没动 |

---

## 2. ① K28 取数降层

**产品代码(自核 `src/ai/knowledge/components/FolderBrowser.vue:84-86`)**

```
    const listing = await service.folder.getList(path)
    if (mySeq !== seq) return
    entries.value = dirEntries(listing.content || []) // K28:单层 + N7 兜底
```

- **单层** `listing.content` ✅(蓝本 `FolderBrowser.vue:66` 是三层
  `(r.data && r.data.data && r.data.data.content) || []`)。
- **`|| []` 兜底没删(N7)** ✅。
- 依据自核成立:`../NimoOS-Service/src/folder.ts:7-10` 确为
  `return unwrap<FolderListing>(res.data)`;`types.ts:32-34` `FolderListing = { content: FolderEntry[] }`;
  `types.ts:26-30` `FolderEntry = { name: string; path: string; is_dir: boolean }` ——
  **`is_dir` 没有被改成 camelCase `isDir`**(`util/folderBrowser.ts:58` 用的就是 `e.is_dir`)✅。

**mock 层次(两个测试文件都核了)**

- `components/FolderBrowser.test.ts:90` `const DATA_LISTING = { content: DATA_CONTENT }` —— **单层** ✅。
- `util/folderBrowser.test.ts` **完全不 mock** `service.folder.getList`(三个纯函数不依赖服务),
  → **不存在「同一方法在两个测试文件里被 mock 成不同形状」这个 red flag**(只有一个文件 mock 它)。
- 唯一「三层」出现处是那条**反向判别力用例**(`:174-182`),它是**故意**喂三层信封的。

**反向用例的判别力 —— 我自己的探针 1(不是采信报告)**

见 §5 探针 1:把产品代码改回三层 → 该用例从绿翻红,报
`AssertionError: expected [ DOMWrapper{ …(3) }, …(11) ] to have a length of +0 but got 12`
—— 说明它真的在区分「取 `.content`」与「取 `.data.content`」,**不是空转** ✅。

---

## 3. ② §4.4 fixture 抄本核准

**(a) `src/` 下零运行时读 `.superpowers/`**

```
$ grep -rn "superpowers" src/ | grep -E "folderBrowser|FolderBrowser"
src/ai/knowledge/components/FolderBrowser.test.ts:14: // 🔴 抄本(不是运行时读 `.superpowers/`)…
src/ai/knowledge/components/FolderBrowser.test.ts:44: * 逐字取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`…
src/ai/knowledge/components/FolderBrowser.test.ts:62: // 取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`…
src/ai/knowledge/util/folderBrowser.test.ts:6:      // 协调者裁定(见 T3 报告 §8):`.superpowers/` 被 gitignore 盖着…
src/ai/knowledge/util/folderBrowser.test.ts:19:     * 逐字取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`…
src/ai/knowledge/util/folderBrowser.test.ts:37:     // 取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`…
```

**6 处全在注释里,零运行时读** ✅。`node:fs`/`node:path`/`node:url` 只在
`components/FolderBrowser.test.ts:28-34` 保留,用途是 `readFileSync(resolve(__dirname,'./FolderBrowser.vue'))`
—— 读的是 **`src/` 内的产品源码**(守卫缺口③ 那两条),**不读台账目录** ✅(符合治理 §6.4-5 的
「一律 `node:fs`,不许 `?raw`」)。

**(b) 我独立写的逐字节等价校验(不是报告那个脚本)**

方法上刻意与报告不同:**不依赖 `FIXTURE-COPY-BEGIN/END` 标记**,改用「定位 `const DATA_CONTENT` 的赋值
起点 → 逐字符括号配平找闭合 `]`」抽取字面量 → 去尾随逗号 → `JSON.parse` → 比 `JSON.stringify` 规范串
+ sha256。这样判别力不依赖注释标记是否被写对。

```
$ node /tmp/.../scratchpad/rev-equiv.mjs
fixture .superpowers/sdd/p5c-fixtures/folder-list-DATA.json
  data.content: 18 项 · canon 4221 字节 · sha256 6aa80ebf67b4ac30adbda12e9508741e264a27f3f99b14f64290331006d210f0
  ✅ src/ai/knowledge/util/folderBrowser.test.ts
      抄本: 18 项 · canon 4221 字节 · sha256 6aa80ebf67b4ac30adbda12e9508741e264a27f3f99b14f64290331006d210f0
  ✅ src/ai/knowledge/components/FolderBrowser.test.ts
      抄本: 18 项 · canon 4221 字节 · sha256 6aa80ebf67b4ac30adbda12e9508741e264a27f3f99b14f64290331006d210f0

RESULT: 2/2 MATCH(逐字节等价)
exit=0
```

- **18 项 ✅ · sha256 与报告声称的 `6aa80ebf…d210f0` 逐字相同 ✅ · 2/2 MATCH ✅**
- 字段没精简:`Object.keys(content[0])` 实测 11 个
  `["name","size","is_dir","is_symlink","modified","sign","thumb","type","path","date","extensions"]`,
  与抄本的 `RawFolderItem` 接口逐字一致 ✅;`JSON.stringify` 保键序 ⇒ 串相同即**键名/键序/值/项序全同** ✅。
- 三层信封结构自核:顶层 `["success","message","data"]`、`data` 层 `["content","total","index","size"]`
  → 抄的确实是 `data.content` 那一层 ✅。
- ⚠️ **与报告不符的一处(Minor,不影响结论)**:报告 §9.2 写 `canon **4189** 字节`,我实测 **4221**。
  sha256 两边逐字相同 ⇒ **字符串本身一致**,差异来自计量口径:4189 是 `String.length`(UTF-16 码元),
  4221 是 `Buffer.byteLength(…,'utf8')`(真字节)。差 32 = `我如何高效的使用`8 个汉字 × 2 处(name+path)
  × 2 字节。**报告把码元数写成了「字节」**,数据没问题、标签不准。

**(c) 变异验证(证明我的校验不是空转)**

按治理 §9 第七条:注入脚本整行锚定 + `assert count == 1` + `grep -n`/`md5sum` 先证落盘。

```
$ md5sum src/ai/knowledge/util/folderBrowser.test.ts
e462c85958d19afea380e7ea35d21f47
$ python3 …  anchor='  {"name": "Amalfi Coast", "size": 4096, "is_dir": true,'  assert count==1 → 4096→4097
injected OK
$ grep -c '"size": 4097' … = 1        # 落盘证明(命中 :49,真数据行,不是注释)
$ md5sum … → db7cca0da89cd46fc7eeac19c02d7f53
$ node rev-equiv.mjs
  ❌ src/ai/knowledge/util/folderBrowser.test.ts
      抄本 sha256 30e25a2d…  ≠ 原文 6aa80ebf…
      [3] 抄本 {"name":"Amalfi Coast","size":4097,…}
      [3] 原文 {"name":"Amalfi Coast","size":4096,…}
RESULT: 1 处不等价      exit=1
```

还原后 `md5sum` 回到 `e462c859…`、`grep -c '"size": 4097'` = 0、`git status --short` 空 ✅。
→ **我的校验有判别力,且能定位到具体项与具体字段** ✅。

(顺带:我刻意没用报告那个 `"size": 4096` 之外的锚串;报告 §9.2 记的「凭记忆用 `"size": 4096` 当
`lost+found` 的锚串结果 assert 炸了」我可以印证 —— `lost+found` 实测 `"size": 16384`,`4096` 在文件里
有 12 处,若不做整行锚定 + `count==1` 就会改错行。)

---

## 4. ③ `_seq` 竞态守卫(§5.2)

**逐行对蓝本(`git show main:` 自读)**

| 蓝本 | 蓝本原文 | New-UI | New-UI 原文 | 判定 |
|---|---|---|---|---|
| `:77` `created()` | `this._seq = 0` | `:60` | `let seq = 0`(在 `<script setup>` 体内) | ✅ **组件本地**(见下方证明) |
| `:50` `reset()` | `this._seq++` **在清状态之前** | `:67` | `seq++` 在 `current/entries/error/loading` 四行**之前** | ✅ 顺序照抄 |
| `:61` | `const seq = ++this._seq` | `:81` | `const mySeq = ++seq` | ✅ 前缀递增 |
| `:65` 成功分支 | `if (seq !== this._seq) return` | `:85` | `if (mySeq !== seq) return` | ✅ |
| `:68` catch | `if (seq !== this._seq) return` | `:88` | `if (mySeq !== seq) return` | ✅ |
| `:72` finally | `if (seq === this._seq) this.loading = false` | `:92` | `if (mySeq === seq) loading.value = false` | ✅ **正向判断**,不是 `!==`+return |

**三处守卫 ✅ · `finally` 正向 ✅ · 未抽公共 guard**(全仓 grep 无新增 guard 工具函数,三处 inline)✅ ·
**未换成 K15 的 epoch 写法** ✅。

**`seq` 是组件本地,不是模块级 —— 我的核法**:`let seq = 0` 位于 `<script setup lang="ts">` 块体内
(`:39` 起,`:60` 是它),Vue SFC 编译器把 `<script setup>` 整块编成 `setup()` 函数体
⇒ 每个实例一份 ✅。我另做探针 7 把它挪到一个并存的普通 `<script lang="ts">` 块(真模块级)来对照,详见 §5。

**交错路径是真的,不是顺序路径 —— 我自读了那几个用例**

`raceSetup()`(`:280-296`)造的是**两次 path 与返回值都不同**的真交错:
① `go('/DATA')` 立即 resolve(拿到 12 行)→ ② 点第 2 行 `AppData` → `go('/DATA/AppData')` 用
`makeDeferred` **挂着不 resolve**(记 A,seq=2)→ ③ **不等它回来**就点面包屑「DATA」→ `go('/DATA')` 也
挂着(记 B,seq=3),并断言
`folder.getList.mock.calls.map(c => c[0])` = `['/DATA','/DATA/AppData','/DATA']`(**三次实参不同,证明两次
请求真的都在飞**)。三条用例分别让 **B 先 resolve / A 先 resolve / A reject** ——
**三种交错顺序都走到了**,不是只测顺序路径 ✅。

**三处守卫的判别力我各自独立探针验过**(探针 2/3/4,见 §5),**逐个报红** ✅。

---

## 5. 我自做的 RED 探针清单(8 条,全部先证注入落盘 → 再看报红 → 再逐字节还原)

纪律:注入脚本一律 python **整行/多行行首锚定 + `assert s.count(anchor)==1`**,落盘证明用 `grep -n` +
`md5sum`(治理 §9 第七条)。基线 md5:`FolderBrowser.vue`=`2fd53dfbe5e2f9a268e5525b4b9ab1f6`、
`folderBrowser.ts`=`6ff5a20953a3e16979acbcb7326ec210`、
`folderBrowser.test.ts`=`e462c85958d19afea380e7ea35d21f47`、
`FolderBrowser.test.ts`=`826a2355bda932a795f98b0fe289c36b`。

| # | 破坏 | 落盘证明 | 结果 | 报红用例(完整名) |
|---|---|---|---|---|
| **1** | K28 反向:`:86` 单层 `listing.content` → 三层 `(listing as any).data?.content` | `grep -n PROBE1` 命中 `:86`;md5 `2fd53d…`→`a5721f…` | 🔴 **7 failed / 12 passed (19)** | `点根层某项:调 getList(path)、emit pick、按 dirEntries 渲染 12 个可见目录` · **`🔴 mock 是单层 {content}:若把三层信封整个塞进来则列表为空 —— 证明取的是 .content 而非 .data.data.content`**(`expected […12] to have a length of +0 but got 12`)· `面包屑随层级增长…` · `点根层面包屑…` · 三条交错用例 |
| **2** | 删掉成功分支守卫(多行锚定 `await…\n if (mySeq !== seq) return\n`) | 删后 `grep -c 'mySeq !== seq'` = **2**(`:30` 头注释 + `:88` catch 那处)→ 证明删掉的是**真代码**不是注释;md5 `→be2461…` | 🔴 **1 failed / 18** | `两次 go() 交错(第二次先返回、第一次后返回)→ entries 是第二次的结果,loading 收敛 false` — `AssertionError: expected [ 'AAA' ] to deeply equal [ 'BBB' ]`(过期结果真覆盖了最新结果) |
| **3** | 删掉 catch 守卫(锚 `} catch {\n if…\n entries.value = []\n`) | `grep -c 'mySeq !== seq'` = 2(头注释 + `:85`);md5 `→d14953…` | 🔴 **1 failed / 18** | `过期的那次失败时,不许把错误态写进来(蓝本 :68 的 catch 守卫)` — `expected true to be false` |
| **4** | `finally` 改无条件 `loading.value = false` | `grep -n PROBE4` 命中 `:92`,`mySeq === seq` 只剩 `:31` 头注释;md5 `→b5486d…` | 🔴 **1 failed / 18** | `过期的那次先返回时,不许写 entries、也不许把 loading 关掉(蓝本 :72 的正向 \`if (seq === _seq)\`)` |
| **5** | 缺口③:往**模板最后一个内容行**(`:124` `aiKbFbEmpty` 那行)塞 `style="color: #ff0000"` | `grep -n '#ff0000'` 命中 `:124`,`count=1`;md5 `→b3297d2061bb7e583ed3963706f46aec`(**与报告声称的 `b3297d…` 逐字相同,说明我复现的是同一处注入**) | 🔴 **1 failed / 196 passed (197)** —— 同批跑的 `src/styles/color-guard.test.ts` **全绿** | `<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量` — `AssertionError: expected '\n  <div class="fb">…' not to match /#[0-9a-fA-F]{3,8}\b/` |
| **6** | N7:`util/folderBrowser.ts:57` 的 `(content \|\| [])` → `(content as FolderEntry[])` | `grep -n PROBE6` 命中 `:57`;md5 `6ff5a2…`→`6fabba…` | 🔴 **2 failed / 23** | `【N7 兜底】content 为 undefined 时返回空数组,不抛` · `【N7 兜底】content 为 null(Go nil slice 序列化结果)时返回空数组,不抛` |
| **7** | 🔴 **我自己加的「缺口猎」**:把 `let seq` 从 `<script setup>` 挪进并存的普通 `<script lang="ts">` 块(**真模块级**) | `grep -n '^<script'` 显示 `:39 <script lang="ts">` + `:44 <script setup lang="ts">`,`let seq = 0` 在 `:41`;md5 `→aedcbd…` | ⚠️ **exit=0,19 passed (19)** —— **没有任何用例报红** | (无)→ **守卫缺口,详见 Minor-1** |
| **8** | 🔴 **我自己加的**:把 `emit('pick', path)` 提到 `if (!path) { … return }` **之前**(违反蓝本 `:59`/`:60` 顺序) | `grep -n PROBE8` 命中 `:79`;md5 `→e5e9ce…` | 🔴 **1 failed / 18** | `点根层面包屑(path === "")回到根层:不 emit pick、不发请求、清空 entries` → **emit 位置是被守住的** ✅ |

**探针 5 的覆盖度我另做了程序化交叉验证**(不止靠断言里那两条 `toContain`):

```
$ node -e "…/<template>([\s\S]*?)\n<\/template>/.exec(src)…"
match starts at line 100 ends at line 128
captured last non-empty line: "  </div>"
```

→ 非贪婪正则捕获的是 **`:100`–`:128` 整块模板**,一直到第 0 列那个 `</template>`。原因自核:两个嵌套
`<template v-else-if="current === ''">`(`:110`)/ `<template v-else>`(`:118`)**带属性**,匹配不上裸
`<template>`;它们的闭合 `</template>`(`:117`/`:125`)**都是缩进 6 空格**,匹配不上 `\n</template>`。
→ 本文件**没有被提前截断**,注入在 `:124`(已越过第一个嵌套闭合 `:117`)照样被抓 ✅。
**按 brief §3.4 与治理 §9 缺口③′,这里照现状写法即可,统一改造归 T8 —— 我没按「应该用贪婪匹配」报缺陷。**

**还原确认**:8 条探针逐条还原;4 个文件 md5 全部回到基线值;`git status --short` **空**;`git log --oneline -1`
仍是 `0023d28`;还原后复跑两个测试文件 `Test Files 2 passed (2) / Tests 44 passed (44)` exit=0。

---

## 6. ④ 模板 1:1 核准(逐行 diff 蓝本 143 行)

自核方式:`git -C NimoOS-UI show main:…FolderBrowser.vue | sed -n '1,29p'` 对
`sed -n '100,128p' 本仓FolderBrowser.vue` 做 `diff -u`。**全 diff 只有 4 行**:

| 差异 | 判定 |
|---|---|
| `$t('Loading…')` → `t('aiKbFbLoading')`、`$t('No volumes detected — type a path above')` → `t('aiKbFbNoVolumes')`、`$t('(empty)')` → `t('aiKbFbEmpty')` | ✅ 治理 §7 强制(键化 i18n),值经我自核与蓝本一致 |
| `v-for="r in roots"` / `!roots.length` → `props.roots` / `!props.roots.length` | ⚠️ **Minor-2**:渲染完全等价(`withDefaults` 下 `roots` 与 `props.roots` 同一对象),报告 §8.5 已申报;但它不在 K1–K31 里,严格讲是一处未编号的写法偏离 |

**其余逐字节相同**,含:
- `:data-last="String(i === crumbs.length - 1)"` —— **`String()` 照抄** ✅(测试断言全是
  `toBe('true')` / `toBe('false')`,**全文零 `toBeUndefined()`** ✅,自核 `grep -c toBeUndefined` = 0)
- `:key="c.path || 'root'"` · `:key="r.path"` · `:key="e.path"` ✅
- **四个分支**:`v-if="loading"` → `v-else-if="error"` → `v-else-if="current === ''"` → `v-else` ✅,
  **四个都有用例**(`加载中显示「加载中…」…` / `请求失败:显示 .fb-stub.fb-err…` / 根层 4 例 / 子层 8 例)
- **两个空态**:`v-if="!props.roots.length"`(用例 `roots 为空时显示「未检测到磁盘卷」空态…`)·
  `v-if="!entries.length"`(用例 `目录为空(content: [])时显示「(空)」空态` + `【N7】content 为 null…`)✅
- **KIcon 只用 3 个 glyph**:`drive`(`:size="13"`)/ `folder`(`:size="13"`)/ `chev`(`:size="10"`,两处)✅
  🔴 **`KIcon.vue` 零改动**(`git diff --stat 820d426..HEAD -- …/KIcon.vue` 输出为空);三个 glyph
  自核实测都已在(`grep -nE "^\s+(drive|chev|folder):"` → `folder:17` / `chev:19` / `drive:28`)
  → **没加 glyph、没退回 `AgentIcon`**(K4)✅
- `emit('pick', path)` 在 `if (!path) { entries.value = []; return }` **之后**(`:79` → `:80`)✅,
  且**探针 8 证明它被守住**
- `defineExpose({ reset })` 在(`:97`)✅,并有用例 `defineExpose 暴露了 reset(蓝本靠 $refs.fb.reset() 调用)`
- **零 `<style>` 块** ✅(`grep -c '^<style'` = 0,且测试 `:419-422` 有一条定向断言 `not.toMatch(/^<style/m)`)。
  那 8 个 `.fb*` 类自核确实已在 `src/ai/styles/knowledge.scss:1647-1712`
  (`.fb` / `.fb-crumbs` / `.fb-crumb` / `.fb-list` / `.fb-row` / `.fb-name` / `.fb-stub` / `.fb-err`,
  8 个,与附录 D §D.1 的 8 项逐字一致),**本刀零 scss 改动**。
- 一处纯机械等价:蓝本 `catch (e) {` 里 `e` 未被使用,本仓写 `catch {`(可选 catch 绑定)。行为等价,不计缺陷。

---

## 7. ⑤ 三个纯函数逐行 + 覆盖度

**逐行对蓝本 `folderBrowser.js:3-34`**(自读 `git show main:`):

| 蓝本 | 本仓 | 判定 |
|---|---|---|
| `:4` `(content \|\| [])` | `:57` 同 | ✅ N7 兜底在(探针 6 证明有守卫) |
| `:5` `.filter(e => e.is_dir && !e.name.startsWith('.'))` | `:58` 同 | ✅ **`is_dir` 未 camelCase 化** |
| `:6` `.map(e => ({ name: e.name, path: e.path }))` | `:59` 同 | ✅ |
| `:7` `.sort((a, b) => a.name.localeCompare(b.name))` | `:60` 同 | ✅ `localeCompare`,非 `<` |
| `:14` `const cands = candidates \|\| []` | `:68` 同 | ✅ |
| `:16` `map(c => ({ path: c.path, label: c.label \|\| c.path }))` | `:70` 同 | ✅ `\|\|` 非 `??` |
| `:18-22` 兜底三根 | `:72-76` | ✅ **逐字**:`{ path: '/DATA', label: 'System (/DATA)' }` · `{ path: '/media', label: '/media' }` · `{ path: '/mnt', label: '/mnt' }`,硬编码英文未进 i18n |
| `:26` `[{ label: rootLabel, path: '' }]` | `:84` 同 | ✅ 首项 |
| `:27` `if (!path) return crumbs` | `:85` 同 | ✅ |
| `:28-32` `acc = ''` + `split('/').filter(Boolean)` + `acc += '/' + seg` + `push({label: seg, path: acc})` | `:86-90` 同 | ✅ 累加逐字 |
| `:10-12` 兜底注释 | `util/folderBrowser.ts:63-66`(译文)+ `:20-23` 头注释 | ✅ 语义保留 |

新增 4 个导出类型(`DirEntry`/`PickerCandidate`/`PickerRoot`/`Crumb`)是 TS 化必要产物,**零新逻辑** ✅。

**分支/边界覆盖(自核 25 例,brief §2 DoD 逐条对上,并有超出)**

| 函数 | brief DoD | 实测用例 | 判定 |
|---|---|---|---|
| `dirEntries` | `undefined`/`null`/`[]`/全文件/全隐藏/混合/排序生效/fixture 端到端 | **11 例**,DoD 8 条全在,另加 3 条**边界两侧**:`name === '.'`(滤掉)· `name = 'a.b'`(保留,`.` 不在开头)· **`localeCompare` ≠ 码点序**(`['Media','lost+found','KVM']` → `['KVM','lost+found','Media']`;码点序会给 `['KVM','Media','lost+found']` → 这条把「用的是 `localeCompare`」钉死,有真判别力) | ✅ 超出 DoD |
| `pickerRoots` | `undefined`/`[]`/有候选带 label/候选缺 label | **7 例**,另加 `null` · `label: ''`(`\|\|` 的假值语义,不是 `??`)· **有候选时绝不混入兜底**(边界另一侧) | ✅ 超出 DoD |
| `crumbsFor` | `path=''`/单段/多段/前后多余 `/`/连续 `//` | **7 例**:`''` · 单段 · 多段 · 尾部多余 `/`(与干净路径等价)· `'//DATA//Documents//'`(**前置 `//` + 中间 `//` + 尾部 `//` 三侧一起覆盖**,且断言 `some(c => c.label === '')` 为 `false`)· 不以 `/` 开头的相对路径 · `rootLabel` 原样透传(前后空格) | ✅ 「前后多余 `/`」两侧都覆盖 |
| 端到端 | fixture 18 项 → 12 目录 | `端到端:folder-list-DATA.json 抄本的真实 18 项 → 12 个可见目录(取 data.content 那一层)` —— 断言 18 项 / 14 项 `is_dir` / 12 项输出 / 12 个 name / 12 个 path / `.snapshots`·`.system_data`·`.wiki.md` 三项 `not.toContain` / **排序真改了顺序**(原序 `lost+found` 在 `Notes` 之后,输出里在 `Media` 之前) | ✅ 期望值是**写死字面量**、不是从抄本现算 → 无自我实现 |

---

## 8. ⑥ i18n

- **只用 T1 已落地的 5 个 `aiKbFb*` 键,新增 0 个** ✅。自核 `grep -n aiKbFb src/i18n/{zh_cn,en_us}.ts`
  各命中 5 条(`zh_cn.ts:1653-1657` / `en_us.ts:1626-1630`),与附录 A 第 3-7 条**逐字一致**:

  | 键 | en(实测) | zh(实测) | 附录 A |
  |---|---|---|---|
  | `aiKbFbEmpty` | `(empty)` | `(空)` | ✅ 第 3 条 |
  | `aiKbFbLoadFailed` | `Failed to load folders` | `目录列表加载失败` | ✅ 第 4 条 |
  | `aiKbFbLoading` | `Loading…` | `加载中…` | ✅ 第 5 条 |
  | `aiKbFbNoVolumes` | `No volumes detected — type a path above` | `未检测到磁盘卷——请在上方手输路径` | ✅ 第 6 条 |
  | `aiKbFbVolumes` | `Volumes` | `卷` | ✅ 第 7 条 |

- **`src/i18n/*` 零改动** ✅(`git diff --stat d659052~1..HEAD -- src/i18n/` 输出为空)。
  `messageSyntax.test.ts` / `parity.test.ts` 也零改动。**死键 0 条**(5 个键都有调用点)。
- 兜底三根的 `System (/DATA)` / `/media` / `/mnt` 是**数据不是文案**,照抄硬编码英文、不进 i18n ✅。

---

## 9. ⑧ `dist` 按 E-8 核(不按 brief §6)

```
$ grep -o "\.fb-[a-z]*" dist/assets/*.css | sort -u
dist/assets/index-X0hjF9vH.css:.fb-crumb / .fb-crumbs / .fb-err / .fb-list / .fb-name / .fb-row / .fb-stub

$ grep -c "fb-crumb" dist/assets/*.js      → 全部 0(23 个 chunk 逐个)
$ grep -c "fb-row"   dist/assets/*.js      → 全部 0
$ grep -c "aiKbFbNoVolumes" dist/assets/index-7dtCSQ0y.js → 2   # 这是 T1 的 i18n 包,不是组件
```

→ **CSS 里有 `.fb-`(T2a 搬进 `knowledge.scss`,由 `KnowledgeLayout.vue` import,早进管线)✅;
JS 里搜不到 `fb-crumbs`/`fb-row`(组件全仓零 import 被 tree-shake)✅** —— 与治理 §12.2 **E-8** 逐字一致,
**brief §6 那句「dist 搜不到 `.fb-` 也正常」确实是错的**。报告 §5/§9.4 的订正正确。

---

## 10. ⑨ 三门(我自己复跑,不采信报告)

```
$ pnpm test  > /tmp/rev-t3-test.log 2>&1        exit=0
 Test Files  322 passed (322)
      Tests  3225 passed (3225)
$ pnpm exec vue-tsc --noEmit > /tmp/rev-t3-tsc.log 2>&1   exit=0   (日志 0 行)
$ pnpm build > /tmp/rev-t3-build.log 2>&1        exit=0   ✓ built in 12.50s
```

**零红项,单轮干净,未复跑**(已知噪声 `persist.test.ts > dropPersisted…` 与 `AgentComposer.test.ts`
本轮均未出现)。与报告 §5/§9.3 声称的 `322 / 3225` **逐字一致**,且**两个提交的三门相同**这一点也成立
(0023d28 只换数据来源,用例数未变)。

**算术自核闭合**:
- 文件 320 → **322** = +2 测试文件 ✅
- 例 3180 → **3225** = **+45**;实测 `grep -cE "^\s+it\("`:util **25** + 组件 **19** = 44,
  加 color-guard 因新增 1 个 `.vue` 的 **+1** = 45 ✅
- `.vue` 总数实测 `find src -name "*.vue" | wc -l` = **176**(175 → 176)✅

---

## 11. ⑩ 提交范围 / 零改动清单

```
$ git show --stat --oneline d659052   → 5 files:report.md + 4 个新产品文件(全 A)
$ git show --stat --oneline 0023d28   → 3 files:report.md + 2 个测试文件
$ git show --stat --oneline c36fc45   → 1 file:p5c-common-constraints.md(协调者,纯 markdown)
$ git diff --name-only a2fd53f..HEAD -- src/
src/ai/knowledge/components/FolderBrowser.test.ts
src/ai/knowledge/components/FolderBrowser.vue
src/ai/knowledge/util/folderBrowser.test.ts
src/ai/knowledge/util/folderBrowser.ts
```

→ **`src/` 下只有那 4 个新文件,零既有文件改动** ✅。

**逐个显式核零改动(`git diff --name-only a2fd53f..HEAD -- <file> | wc -l` 全为 0)**:
`knowledge.scss` · `knowledgeStyles.test.ts` · `parser-styles.scss` · `parserStyles.test.ts` ·
`src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `KIcon.vue` · `knowledgeRoutes.ts` · `*deferred.ts` ·
`KnowledgeLayout.vue` · `DashboardView.vue` · `QueueView.vue` · `IndexedFilesView.vue` ·
`util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/queueView.ts` · `util/dashboardHelpers.ts` ·
`stores/knowledgeStore.ts` · `agent-styles.scss` · `tokens.scss` · `src/styles/theme.css`
→ **20+ 项全部 0** ✅。`git -C ../NimoOS-Service status --short` 空 → **Service 仓零改动** ✅。

**未削弱/删除任何既有断言** ✅(只新增文件,零既有文件改动 ⇒ 结构上不可能)。
**未发现空转用例**:每条断言我都能指出它在什么改动下会翻红;8 条探针覆盖了最关键的 6 条语义。

---

## 12. 缺陷清单

### Critical:0

### Important:0

### Minor:6

| # | 事 | 说明 |
|---|---|---|
| **M-1** | 🔴 **守卫缺口(我自己猎出的):`seq` 退回模块级不会被任何用例抓到。** | 探针 7 实测:把 `let seq` 从 `<script setup>` 挪进并存的普通 `<script lang="ts">` 块(**真模块级,跨实例串号**)→ **19 passed / exit=0,零报红**。产品代码**是对的**(组件本地 `let seq`,注释 `:28-29` 也写明了),brief §3.2 那条 🔴 要求已满足 → **不是缺陷,是缺守卫**。堵法(供 T9 或 P5d 顺手收):在同一个测试里 `mountFb()` **两个实例**,让实例 A 的请求在实例 B 的请求之后落地,断言 A 的结果**仍然写进了 A**(模块级 seq 会让 A 的守卫误判成过期而丢结果)。**本期不阻塞合并。** |
| **M-2** | 模板 `roots` → `props.roots` 是一处未编号的写法偏离。 | 蓝本 `:12`/`:17` 是裸 `roots`。`withDefaults` 下两者指同一对象、渲染完全等价,报告 §8.5 已主动申报;且 `props.` 前缀并非 TS 必需(`withDefaults` 已把 `roots` 收窄成非可选)。**建议留着不动**(改回去要重跑三门、收益为零),仅登记。 |
| **M-3** | 报告 §9.2 把 `String.length`(UTF-16 码元)标成「字节」。 | 报告写 `canon **4189** 字节`,实测 UTF-8 **4221** 字节;sha256 两边逐字相同 ⇒ 数据无误,只是计量标签不准(差 32 = `我如何高效的使用` 8 汉字 × name/path 2 处 × 2 字节)。下游若拿 4189 去复核字节数会对不上。 |
| **M-4** | 报告 §1 组件测试分档相加 = 18,与它自己的表头「19 例」及实测 19 不符。 | 「根层 4 · 进子目录 **7** · `_seq` 5 · 缺口③ 2」= 18;实测「进子目录」那个 describe 是 **8** 例(多的是 `【N7】content 为 null(Go nil slice)时也走「(空)」而不是抛错`)。表头 19 与实测一致,分档写漏一条。 |
| **M-5** | 报告 §1 写 `util/folderBrowser.ts`(新建,**91 行**),实测 **92 行**。 | `wc -l` = 92,`git show --stat` 也是 `92 ++++`。off-by-one,不影响结论。 |
| **M-6** | fixture 抄本没有**常驻**漂移守卫(登记,非缺陷)。 | 抄本里未被断言的字段(`size` / `modified` / `sign` / `thumb` / `type` / `date` / `extensions`)一旦被改,全量测试照绿 —— 等价性只由**一次性脚本**保证。这是治理 §4.4 指定做法的固有代价(§4.4 只要求「抄完做一次程序化等价校验」,实现者已做且我已独立复核 + 变异验证)。若 P5d 想收紧:把 `sha256(JSON.stringify(DATA_CONTENT))` 钉成一条常驻断言即可。**本期不要求。** |

---

## 13. 与报告不符之处汇总(逐条)

| 报告原文 | 我实测 | 影响 |
|---|---|---|
| §9.2 `canon **4189** 字节` | UTF-8 **4221** 字节(sha256 一致) | 计量口径,M-3 |
| §1 组件测试「进子目录 **7** 例」 | **8** 例(总数 19 对) | 分档漏一条,M-4 |
| §1 `folderBrowser.ts`(新建,**91 行**) | **92** 行 | off-by-one,M-5 |
| §3 「**四处**守卫与蓝本一一对应」 | 严格说是 **1 处 `seq++`(reset)+ 3 处守卫**;brief §3.2 的口径是「三处守卫」 | 措辞,无实质分歧 |

**其余全部与我的实测一致**,包括:sha256 `6aa80ebf…d210f0` · `2/2 MATCH` · 探针 A 的注入后 md5
`b3297d…` · 探针 B/C/D/E/F 的报红用例名与计数(1/18、1/18、1/18、7/12、2/23)· 三门 `322 / 3225` ·
`.vue` 176 · `dist` 的 CSS/JS 口径 · 5 个 i18n 键 · 零改动清单。
**报告的诚实度高**(§8 顾虑 2 主动订正了 brief 的 E-8、§9.2 主动记了自己「凭记忆用错锚串被 assert 救回」
那次事故),没有发现夸大或掩盖。

---

## 14. 收尾自查

```
$ git status --short
(空)
$ git log --oneline -1
0023d28 test(ai): P5c T3 后续 —— fixture 数据由运行时读改成抄本(协调者裁定)
$ md5sum <4 个文件>
6ff5a20953a3e16979acbcb7326ec210  src/ai/knowledge/util/folderBrowser.ts
e462c85958d19afea380e7ea35d21f47  src/ai/knowledge/util/folderBrowser.test.ts
2fd53dfbe5e2f9a268e5525b4b9ab1f6  src/ai/knowledge/components/FolderBrowser.vue
826a2355bda932a795f98b0fe289c36b  src/ai/knowledge/components/FolderBrowser.test.ts
```

**8 条探针全部还原,工作树干净,零提交(本文件由协调者按约 `git add -f`)。**
评审期间未碰 `/home/nimo/NimoTech/NimoOS-New-UI`、`.sp7/NimoOS-New-UI`、任何后端仓;
`NimoOS-UI` 只用 `git show main:` 读,未 checkout/stash/提交;未动 `:5288` dev server。

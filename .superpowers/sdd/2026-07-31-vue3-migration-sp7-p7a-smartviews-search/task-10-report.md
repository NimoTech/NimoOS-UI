# Task 10 报告:searchUnderstood.ts + searchQueryParts.ts + searchSort.ts + assetToPhoto 补字段

---

# Fix Round 1(评审回应:0 Critical + 2 Important + 5 Minor,处理其中 5 项)

评审结论:三个纯函数实现逐行回源核对完全正确,`hasWordBoundedMatch` 原样落地且四条边界
独立推演均成立;删码验证②的"未变红如实分析"、`PersonOption.id` 无需 String() 的判断均被
评审独立复核为成立。本轮只处理点名的 I1/I2/M3/M4/M5 五项,M6/M7 按控制器裁定不动。

## I1:`searchSort.ts` —— String() 铁律零覆盖(补测试,实现不改)

**问题**:偏离登记 3 的 `String(a.p.id) > String(b.p.id)` 是必要且正确的实现(评审核实
`assetToPhoto.ts:268` 的 `id: string | number` 属实),但测试桩 `stubPhoto(id: string, …)`
把 id 收窄成了 `string`,混合类型场景从未被执行到——未来谁"顺手简化"掉 `String()` 都不会
变红。

**改动**:
- `searchSort.test.ts:7/11` —— `stubPhoto`/`row` 的 `id` 参数类型从 `string` 放宽到
  `string | number`。
- 新增用例(`searchSort.test.ts:39-47`):`id=10`(number)与 `id='9'`(string)、
  `takenAt` 相同,原始比较 `10 > '9'`(数值强制转换)得 `true`,`String()` 后
  `'10' > '9'`(字典序)得 `false`——两者结果相反,能干净区分。

**TDD 证据**:
```
$ pnpm exec vitest run src/photos/util/__tests__/searchSort.test.ts
Test Files  1 passed (1)
     Tests  14 passed (14)
```
删码验证(手工把 `searchSort.ts:27` 的 `String(a.p.id) > String(b.p.id)` 换回
`a.p.id > b.p.id`,验完 Edit 手工还原,未用 `git checkout`):
```
AssertionError: expected [ '9', 10 ] to deeply equal [ 10, '9' ]
Tests  1 failed | 13 passed (14)
```
确认变红,还原后重跑恢复 `14 passed`。

## I2:`searchUnderstood.ts` —— 五个快捷 time 分支的 `v` 此前 4 个无断言(补测试,实现不改)

**问题**:「time 六条」用例此前只断言 `.quick`,没断言 `.v`;唯一断言了 `v` 的「优先级」
用例只覆盖 `lastYear`。`last7`/`last30`/`thisYear`/`today` 四个分支的显示键完全裸奔——
`v` 是消费方 `t(v)` 的输入,键错即用户可见文案错误。

**改动**:`searchUnderstood.test.ts:49-58` —— 把五个快捷分支的断言从
`.find(...).quick` 改成对整个 token 做 `toEqual({ k:'time', v: QUICK_LABEL_KEYS.xxx,
quick:'xxx' })`,与「优先级」用例的写法对齐。

**TDD 证据**:
```
$ pnpm exec vitest run src/photos/util/__tests__/searchUnderstood.test.ts
Test Files  1 passed (1)
     Tests  10 passed (10)
```
删码验证(手工把 `searchUnderstood.ts` 里 `last7` 分支的 `v: QUICK_LABEL_KEYS.last7`
改成 `QUICK_LABEL_KEYS.last30`,验完 Edit 手工还原):
```
AssertionError: expected { k: 'time', …(2) } to deeply equal { k: 'time', …(2) }
- "v": "photosSearchLast7Days",
+ "v": "photosSearchLast30Days",
Tests  1 failed | 9 passed (10)
```
确认变红,还原后重跑恢复 `10 passed`。

## M3:`searchQueryParts.ts` —— 零宽匹配第二道防线(新增实现代码,需偏离登记)

**问题**:`keywords.filter(Boolean)` 守卫本身正确,但一旦失效(如被误删),失败形态是
**worker fork 直接 OOM 崩溃**(`Ineffective mark-compacts... JavaScript heap out of
memory`),`{ timeout: 1000 }` 完全不触发(同步死循环阻塞事件循环,vitest 无法中断),
同文件其余 6 条用例被一并带走,给不出任何结果——这不是"干净地红"。

**改动**(`searchQueryParts.ts:24-38`,**这是 Vue2 `:416-433` 没有的新增防御分支**,
已在代码注释里登记):在 `exec` 循环内新增
```ts
if (m[0] === '') {
  re.lastIndex++
  continue
}
```
遇到零宽匹配时手动推进 `lastIndex` 并跳过本次(不计入高亮),`keywords.filter(Boolean)`
保持不动。这样第一道守卫万一失效,函数依然能在有限步内返回,让测试以普通断言失败的
方式变红,而不是拖垮整个 worker。

**偏离登记**(brief 之外的新增代码,双处登记):
- Vue2 原样:`:416-433` 的 `exec` 循环没有任何零宽匹配防护。
- 为什么加:让上面那道 `filter(Boolean)` 守卫在失效时,函数能"优雅退化"而不是让
  整个测试进程崩溃——这是防御性纵深,不是照抄 Vue2 行为。
- 代码注释位置:`src/photos/util/searchQueryParts.ts:24-33`。
- 报告位置:本节。

**变异验证(按控制器要求,补完新防线后再删掉 `filter(Boolean)`,确认降级为普通断言
失败而非崩溃)**:
```
$ pnpm exec vitest run src/photos/util/__tests__/searchQueryParts.test.ts
```
删 `keywords.filter(Boolean)`(改成裸 `const kw = keywords`)后的实际输出:
```
 ❯ src/photos/util/__tests__/searchQueryParts.test.ts (7 tests | 1 failed) 8ms
     × keywords 含空串 → 不死循环,结果等价于过滤空串后的结果 4ms

AssertionError: expected [ { text: 'sunset in tokyo', …(1) } ] to deeply equal [ …(2) ]
- { "hl": false, "text": "sunset in " }, { "hl": true, "text": "tokyo" }
+ { "hl": false, "text": "sunset in tokyo" }

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```
**确认符合控制器要求**:是普通断言失败(不是崩溃),同文件其余 6 条用例正常给出
`passed` 结果,没有被连累。验完手工 Edit 还原 `keywords.filter(Boolean)`,重跑恢复
`7 passed`。

## M4:`searchUnderstood.ts` —— 补 `query || ''` 空值守卫(修复被静默丢弃的 Vue2 行为)

**问题**:Vue2 `:475` 是 `(this.query || '').toLowerCase()`;同批的
`queryParts.ts:12`(`query || ''`)与 `searchSort.ts:63`(`(query || '').trim()`)都有
这道守卫,唯独 `understood` 是裸的 `query.toLowerCase()`,`undefined` 进来直接抛
`TypeError`。下游 T16 的实际来源很可能是 `route.query.q`(vue-router 类型含
`LocationQueryValue | undefined`),这个盲区最容易在真实调用点触发。

**改动**:`searchUnderstood.ts:57-61` —— `const q = query.toLowerCase()` 改成
`const q = (query || '').toLowerCase()`,签名保持 `query: string` 不放宽。

**TDD 证据**:
新增用例 `searchUnderstood.test.ts:19-21`:
`understood(undefined as unknown as string, [])` → `[]`。

RED(修复前):
```
$ pnpm exec vitest run src/photos/util/__tests__/searchUnderstood.test.ts
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
 ❯ understood src/photos/util/searchUnderstood.ts:58:19
Tests  1 failed | 10 passed (11)
```
GREEN(修复后):
```
Test Files  1 passed (1)
     Tests  11 passed (11)
```
本项的"删码验证"与 TDD 的 RED 步骤是同一件事(先写会抛错的用例,确认抛错,再补
守卫消除抛错),未额外重复一次删码,已如实注明。

## M5:`searchUnderstood.ts` —— 补偏离登记(仅注释,不改行为/不改测试)

**问题**:偏离登记 2(`v` 从固定英文串改成 i18n 键名)遗漏了一个连带影响:
`queryParts` 的 `keywords` 来自 `understood(...).map(t => t.v.toLowerCase())`
(brief 结构规格第 2 条)。Vue2 里 time token 的 `v` 是英文标签,其中 `'Last year'`/
`'This year'`/`'Today'` 三个恰好能命中查询原文,所以 Vue2 会把查询框里这几个词
高亮出来;New-UI 把 `v` 换成 i18n 键后,这三处高亮**必然消失**(即便下游改传
`t(v)`,中文 locale 的显示文案也匹配不上英文查询词)。

**改动**:只在 `searchUnderstood.ts` 的 `UnderstoodToken.quick` 字段注释块里补充
这段说明(`:24-40`),不改代码行为,不改测试。

**交接给 T16**:person / type / 年份三类 token 的高亮不受影响(它们的 `v` 就是原文
词或年份串本身);仅 `last7`/`last30`/`lastYear`/`thisYear`/`today` 这五个快捷 time
token 在 New-UI 里会失去"查询框内原词高亮"的效果,这是偏离 2 的必然连带后果,不在
本任务修复范围(修它要引入中英双词表)。

## 覆盖测试与整体验证

聚焦测试(修复后):
```
$ pnpm exec vitest run src/photos/util/__tests__/searchUnderstood.test.ts \
  src/photos/util/__tests__/searchQueryParts.test.ts \
  src/photos/util/__tests__/searchSort.test.ts
Test Files  3 passed (3)
     Tests  32 passed (32)
```

全量:
```
$ pnpm exec vitest run
Test Files  304 passed (304)
     Tests  3355 passed (3355)
```
（`favorites.test.ts` 的 `Error: Not implemented: navigation` jsdom 噪声是既有的、与
本任务改动文件无关的输出,本轮未新增噪声。）

tsc:
```
$ pnpm exec vue-tsc --noEmit
```
无输出,0 错误。

## Files Changed(本轮)

- `src/photos/util/searchUnderstood.ts` —— M4(`query || ''` 守卫)+ M5(注释登记)
- `src/photos/util/searchQueryParts.ts` —— M3(零宽匹配第二道防线)
- `src/photos/util/__tests__/searchSort.test.ts` —— I1(stubPhoto/row 放宽 id 类型 +
  混合类型用例)
- `src/photos/util/__tests__/searchUnderstood.test.ts` —— I2(五个快捷分支完整
  token 断言)+ M4 的新增用例
- `searchSort.ts` 实现本体、`assetToPhoto.ts` 均**未改动**

## Self-Review(本轮)

- 只动了评审点名的 5 项,未顺手改别的;`assetToPhoto.ts` 仍未碰。
- 每条改动都做了删码/变异验证,一次一处,Edit 手工还原,未用 `git checkout --`。
- M3 的变异验证按控制器要求真实重跑并如实记录输出(不是崩溃,是普通断言失败,
  且同文件其余用例未被连累)。
- M4 的"删码验证"与 TDD RED 步骤合并处理,已在报告中说明未重复执行的原因。
- 未发现新的恒真断言;I1/I2 的新增断言都通过了"删了对应实现代码会不会变红"的
  实测检验。


## 概述

三个纯函数文件全部新建,`assetToPhoto.ts` 本体**未改动**(grep 已确认四个字段都已存在),
只在其既有测试文件里补了一条 `matchedBy` 回归断言。

## 实现文件

- `src/photos/util/searchUnderstood.ts` —— `understood(query, people)`,含内部
  `hasWordBoundedMatch` 修复 CJK 人名边界判定。
- `src/photos/util/searchQueryParts.ts` —— `queryParts(query, keywords)`,新增空
  keyword 守卫。
- `src/photos/util/searchSort.ts` —— `sortResults` / `splitTiers` / `matchPct` /
  `searchStateMatchesQuery`。
- `src/photos/util/__tests__/searchUnderstood.test.ts`(新建)
- `src/photos/util/__tests__/searchQueryParts.test.ts`(新建)
- `src/photos/util/__tests__/searchSort.test.ts`(新建)
- `src/photos/util/__tests__/assetToPhoto.test.ts`(改:补一条 matchedBy 回归断言)

## 回源核对结果

| brief 断言 | 源码真值(逐条回源) | 符/不符 |
|---|---|---|
| `understood` 逻辑照搬 `PhotosSearchView.vue:474-497` | 已读 :474-497,person/type/time 三段判据、else-if 顺序、正则字面量与 brief 描述完全一致 | 符 |
| `queryParts` 照搬 `:416-433` | 已读 :416-433,escape+join+exec 循环+尾巴补全逻辑与 brief 描述一致 | 符 |
| `sortedResults`/双档 `:374-404` | 已读 :374-404,byTakenAt 双 null/单 null/相等/方向的四条判据与 brief 描述逐字一致(包括注释) | 符 |
| `matchPct` `:675-678` | 已读,`Math.round(Math.max(0, Math.min(1, score)) * 100)`,`score==null`→null,与 brief 一致 | 符 |
| `searchStateMatchesQuery` `photos.js:32-33` | 已读,`!!state.isSearchMode && state.searchQuery === (query \|\| '').trim()`,与 brief 一致 | 符 |
| `assetToPhoto` 缺 matchScore/matchedBy/belowCut/isNew,需补 | 已读整份文件(:117-189 Vue2 源 + New-UI 已移植版 :267-400),**四个字段全部已存在**(:171/:306, :175/:307, :181/:308, :137/:348 一一对应),既有测试也已覆盖 isNew/belowCut/matchScore,唯独缺 matchedBy 断言 | **不符**(brief 假设"需要补",实测不需要;控制器裁定已提前给出,回源核实一致) |
| `thisYear` 的 i18n 键名 | T9 已建 `QUICK_LABEL_KEYS.thisYear = 'photosSearchYear'`,grep `zh_cn.ts` 确认 `photosSearchYear: '今年'` 存在、`photosSearchThisYear` 不存在 | 确认以 dateRange.ts 现状为准(brief 正文的 `photosSearchThisYear` 是错的,T9 已裁定) |

未发现新的 brief 事实错误(本任务范围内该核对的行号/字面量均对得上)。

## 偏离登记

1. **人名边界判定:`\b` → `hasWordBoundedMatch`**(brief 已预先给出改法与理由,非我方新发现的偏离,但仍登记以留痕)。
   - Vue2 原样:`new RegExp('\\b' + escaped + '\\b').test(q)` —— `\b` 只在 ASCII 词字符边界成立,中文名两侧是中文字符时 `\b` 恒不成立,导致中文人名**从未命中**过 person token。
   - 改成:自定义 `hasWordBoundedMatch`,以字符类 `[A-Za-z0-9_]` 显式判断"词内延续",needle 首/尾字符本身非词字符(如中文)时边界恒成立。
   - 为什么改:界面/行为要 1:1,但这是要修的 bug(brief §7e-5 明确点名),不是照抄的对象。
   - 代码注释位置:`src/photos/util/searchUnderstood.ts:32-49`(WORDISH 定义 + hasWordBoundedMatch 函数体上方注释)。

2. **`quick` 字段是 New-UI 新增,`v` 从固定英文串改成 i18n 键名**。
   - Vue2 原样:`v: 'Last 7 days'` 等固定英文字符串,消费方靠这串英文反查 `quickRange(label)` 的 `case 'Last 7 days'`。
   - 改成:`v` 存 i18n 键名(`QUICK_LABEL_KEYS[quick]`,消费方 `t(v)` 得到本地化文案),额外加 `quick: QuickKey | number` 字段承载"机器可读"信息,供下游调用 `quickRange(quick, now, t(v))` / `yearRange(quick, v)`。
   - 为什么改:i18n 化后英文字符串已不能反查,brief §7e-5 / 结构规格第 1 条已明确要求。
   - 代码注释位置:`src/photos/util/searchUnderstood.ts:22-30`(UnderstoodToken.quick 字段上方注释)。

3. **`byTakenAt` 的 tie-break 从 `a.p.id > b.p.id` 改成 `String(a.p.id) > String(b.p.id)`**。
   - Vue2 原样:`a.p.id > b.p.id ? 1 : -1`(直接用原始类型比较)。
   - 改成:先 `String()` 再比较。
   - 为什么改:Global Constraints 铁律"按 id 比一律 String(a)===String(b)"点名了这条;`Photo.id` 类型是 `string | number`,混合类型直接用 `>` 比较行为不确定(字符串数字混合比较语义模糊),统一转字符串消除歧义。
   - 代码注释位置:`src/photos/util/searchSort.ts:15-17`(byTakenAt 函数上方注释)。

4. **`queryParts` 新增 `keywords.filter(Boolean)` 守卫**。
   - Vue2 原样:没有防护,空字符串 keyword 会拼出能匹配空串的正则(如 `(|tokyo)`),`exec` 循环里 `m.index` 永不推进,造成死循环。
   - 改成:拼正则前先 `filter(Boolean)` 去掉空串 keyword。
   - 为什么改:这是 Vue2 的既有 bug(死循环/挂死浏览器标签页),不是要照抄的行为;brief 结构规格第 2 条已明确要求加此守卫。
   - **实测验证**:删码验证时把这行改回不过滤,真的复现了 OOM 崩溃(见下方删码验证清单④),证明这不是臆想的风险。
   - 代码注释位置:`src/photos/util/searchQueryParts.ts:14-16`。

关于 "understood 里 PersonOption.id" 这条 Global Constraints 点名的 String() 铁律:本任务的 `understood()` 函数体内**没有**对 `PersonOption.id` 做任何比较运算(只是把 `p.id` 原样塞进 token,不参与 `===`/`>` 判断),所以本函数没有需要应用 String() 的位置。这条铁律真正落地的地方应该是下游消费方(T11 store / T13/T15 组件)拿 token 的 `id` 去跟已选人物筛选列表做匹配时。在报告里如实记录这个观察,供下游任务参照。

## 删码验证清单

| # | 删了什么 | 结果 | 备注 |
|---|---|---|---|
| ① | `hasWordBoundedMatch` 整体换回 Vue2 原样 `\b` 正则 | **红**(中文人名用例失败:期望 1 个 person token,拿到 `[]`) | 验完手工 Edit 切回,未用 `git checkout` |
| ② | `beforeOk` 第三条件 `\|\| !WORDISH.test(needle[0])` 删掉 | 用原有测试**未变红**(如实分析见下)→ 补一条新用例后**变红** | 见下方"未变红分析" |
| ③ | `afterOk` 的 `\|\| !WORDISH.test(needle[needle.length-1])`(及连带 `!WORDISH.test(after)`)删掉,只留 `!after` | **红**(Sara / photos-of-Sara / 多人命中三条用例全灭) | 验完手工切回 |
| ④ | `queryParts` 的 `keywords.filter(Boolean)` 去掉 | **红 —— 且比预期更严重**:不是断言失败,而是子进程 OOM 崩溃退出(`Ineffective mark-compacts... JavaScript heap out of memory`) | 验完手工切回;`{ timeout: 1000 }` 的用例守卫没能拦住,因为内存耗尽发生在超时触发之前,属于比"超时"更强的证据 |
| ⑤ | `byTakenAt` 单 null 恒末尾分支(`if (ta==null) return 1; if (tb==null) return -1;`)删掉 | **红**(null 项排序位置断言失败:期望排在末尾,实际排到中间) | 验完手工切回 |
| ⑥ | `sortResults` 的 `[...rows]` 拷贝去掉,直接引用 `rows` | **红**("不原地改"用例:`expect(sorted).not.toBe(rows)` 失败,两者是同一引用) | 验完手工切回 |
| ⑦ | `matchPct` 的 clamp(`Math.max(0, Math.min(1, score))`)去掉,直接 `score * 100` | **红**(越界值用例:`-0.5` 期望 `0` 实得 `-50`) | 验完手工切回 |

### ② 未变红的如实分析

brief 原文断言"②`beforeOk` 第三条件删掉 → 中文名用例红(这条最关键,单删它就够)"。
用我最初写的 `understood('小明的照片', [{name:'小明',...}])` 这条用例去验证,**删除后测试仍然全绿**。

原因:该用例里 `needle='小明'` 在 `haystack` 里的匹配位置是 `i=0`(串首),`before` 因
`i>0` 判断为空字符串。`beforeOk = !before || !WORDISH.test(before) || !WORDISH.test(needle[0])`
的第一个子句 `!before` 已经为真,第三条件从未被求值到这条分支上——真正让这条用例通过的
是 `afterOk`(`after='的'` 非词字符)。也就是说,**我最初的测试没有真正覆盖到
`beforeOk` 第三条件这一支**,brief 断言与我的具体测试用例之间存在偏差(brief 没给出
具体测试字符串,只是描述了删除后的预期效果)。

处理方式:没有为了让测试变红而扭曲实现,而是**补了一条新的、真实覆盖该分支的用例**——
`understood('2025小明的照片', [...])`,让中文人名前紧跟一个 ASCII 词字符(数字 `5`),
这样 `before='5'`(是词字符)、`needle[0]='小'`(非词字符),`beforeOk` 的前两个子句都为
假,只有第三条件能救回来。用这条新用例重跑删码验证,**确认变红**(见上表)。这条新用例
已保留在最终测试文件里(不是临时脚手架),因为它是对 §7e-5 主张的更精确覆盖,补了原用例
的盲区。

## 测试与结果

- **RED(Step 2)**:
  ```
  pnpm exec vitest run src/photos/util/__tests__/searchUnderstood.test.ts \
    src/photos/util/__tests__/searchQueryParts.test.ts \
    src/photos/util/__tests__/searchSort.test.ts \
    src/photos/util/__tests__/assetToPhoto.test.ts
  ```
  结果:3 个新文件报 `Failed to resolve import "../searchXxx"`(实现文件尚不存在,
  符合预期的失败原因);`assetToPhoto.test.ts` 1 个文件 18 个用例全过(因为实现本就
  齐全,只是新加的 `matchedBy` 断言此时也一并验证为真——它不需要经历"红"阶段,因为
  它验证的是已存在的实现,brief 也明确这条是"补断言不改实现")。

- **GREEN(Step 3 后)**:同一条命令,4 个文件全绿,**47 用例通过**(后又为②补测试后
  变为 **48 用例**)。

- **全量 + tsc(Step 4)**:
  ```
  pnpm exec vitest run
  ```
  `Test Files 304 passed (304)` / `Tests 3353 passed (3353)`。
  过程中出现的 `Error: Not implemented: navigation (except hash changes)` 是
  `src/photos/stores/__tests__/favorites.test.ts` 里 jsdom 的既有噪声(与本任务
  改动的文件无关,该文件本任务未触碰),不是本任务引入的新噪声。

  ```
  pnpm exec vue-tsc --noEmit
  ```
  无输出,0 错误。

- **删码验证**:见上表,7 条全部按预期变红(其中②补了一条用例后变红,详见"未变红
  分析";④的红比预期更严重——是 OOM 崩溃而非断言失败),验完全部用 Edit 手工切回,
  未使用 `git checkout`。切回后重跑对应聚焦测试确认恢复绿色。

## Files Changed

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/searchUnderstood.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/searchQueryParts.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/searchSort.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/__tests__/searchUnderstood.test.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/__tests__/searchQueryParts.test.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/__tests__/searchSort.test.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/util/__tests__/assetToPhoto.test.ts`(改:补 matchedBy 回归断言)
- `src/photos/util/assetToPhoto.ts` —— **未改动**(grep 确认四个字段已全部存在)

## Self-Review

- **完整性**:三个接口签名与 brief 逐字一致(`UnderstoodToken`/`QueryPart`/`ScoredPhoto`/
  函数签名),Step 1 列出的所有用例都已覆盖(含大小写、优先级、多人顺序、正则元字符、
  死循环守卫、null 排序双方向、不原地改、越界 clamp、trim 比较)。
  多补了两条:①CJK 前缀边界用例(见"未变红分析");②"五个快捷 token 的 quick 值全部
  落在 QUICK_KEYS 里"的不变量测试(brief 明确要求登记 T9 遗留 M4 的这条不变量)。
- **质量**:未引入无关重构;`searchSort.ts` 里 `byTakenAt` 单独抽成模块内函数(不导出),
  与 Vue2 原始 computed 内联箭头函数的封装粒度一致,只是加了类型标注。
- **纪律**:未改 `assetToPhoto.ts` 本体(grep 结论清楚);未新增 i18n 键(全部复用 T9
  的 `QUICK_LABEL_KEYS`);未引入除 brief 要求外的额外守卫或功能。
- **测试**:所有测试都问过"什么改动会让它变红"——尤其自查了一遍是否有恒真断言,
  发现②的原始用例是"看似覆盖实则未覆盖"(不是恒真,但对目标分支盲区),已补测试
  纠正,而不是弱化断言迁就实现。
- **零区分力断言自查**:没有发现类似"首项是 'S'"这种巧合通过的断言;"多人同时命中
  按顺序"那条用两个不同 id 的人分别在数组两端断言顺序,能有效区分"是否按数组顺序"
  与"是否按其他隐含顺序(如插入顺序反转)"。

## 关注点

无阻塞性关注点。唯一值得下游(T11/T13/T15)注意的:
1. `UnderstoodToken.quick` 只会是 `QUICK_KEYS` 五个字面量之一或年份 `number`,消费时
   请按类型分支处理(`typeof quick === 'number'` → `yearRange`,否则 → `quickRange`),
   不要假设 `quick` 一定存在(`type` token 和某些边界查询不产生 `time` token)。
2. Global Constraints 提到的"understood 里 PersonOption.id 用 String() 比"这条,在
   T10 的函数体内没有实际比较发生(已在偏离登记里说明),下游若要用 token.id 去匹配
   已选人物列表,请自行套用 String() 铁律。

---

# Fix Round 2(scoped 复审:fix round 1 的 I1/I2/M3/M4/M5 全部 ADDRESSED,只剩一处 Minor 需修)

复审(opus)结论:I1/I2/M3/M4/M5 五项全部 ADDRESSED,均亲手做了变异实证背书(含 M3 最
关键的"补完第二道防线后再删 filter(Boolean)"复测,确认降级成功、无 OOM、同文件其余
6 条照常给出结果);逐行核了 9 行 `-`,确认没有任何既有断言被弱化或删除;护栏也守住了
(4 文件、不含 assetToPhoto.ts、M6/M7 原样未动)。**只剩一处 Minor 但要修,是本轮 fix
自己引入的**:`searchQueryParts.ts:2` 文件头写"Ported verbatim",但本轮又新加了一处
Vue2 没有的分支(零宽匹配第二道防线),连同上一轮就有的 `filter(Boolean)` 守卫,文件
实际已有两处偏离——"verbatim"这个结论词与文件当前内容自相矛盾。

## 唯一改动:`searchQueryParts.ts:2-4` 文件头措辞

**改法**:把 "Ported verbatim from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue
:416-433(`queryParts` computed)。" 改成:

```
// 输入回显时给命中片段加高亮样式。Ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosSearchView.vue:416-433(`queryParts` computed)——
// 主体切段逻辑逐字照搬,但另有两处 Vue2 没有的防御性偏离(见下方就近登记):
// keywords.filter(Boolean) 空串守卫、exec 循环内零宽匹配的第二道防线(fix round 1 · M3)。
```

去掉了"verbatim"这个整体性结论词,改成"主体逻辑逐字照搬,但另有两处偏离"——精确到
"哪部分是逐字的、哪部分不是",并指向下方已有的就近登记,不重复写偏离细节本身。
**纯措辞修正,零生产逻辑改动**——`git diff` 只有注释文本变化,函数体一行未动。

## Grep 自查:三个新文件里所有「verbatim / 逐字 / 照搬 / 原样 / 一致」结论词逐句核对

```
$ grep -n "verbatim\|逐字\|照搬\|原样\|一致" \
  src/photos/util/searchUnderstood.ts \
  src/photos/util/searchQueryParts.ts \
  src/photos/util/searchSort.ts
```

| 文件:行 | 原文 | 核对结论 |
|---|---|---|
| `searchQueryParts.ts:2`(改前) | `Ported verbatim from Vue2 …:416-433` | **不成立** → 已按上文改掉 |
| `searchSort.ts:24` | "单 null → 恒排末尾,不受方向影响(照搬 Vue2 行为)。" | 成立——这条 null 处理分支本身逐字照搬,`String()` 那部分单独在函数顶部注释里登记,两处注释各管各的、不冲突 |
| `searchSort.ts:61` | "结果集闪烁。Ported verbatim from photos.js:32-33。" | 成立——`searchStateMatchesQuery` 实现 `!!state.isSearchMode && state.searchQuery === (query \|\| '').trim()` 与 Vue2 `photos.js:32-33` 逐字一致,零偏离 |
| `searchUnderstood.ts:34` | "…三个恰好能在查询原文里逐字命中,所以 Vue2 会…" | 成立——这是描述 **Vue2 的行为**(v 是英文标签时能逐字命中查询原文),不是描述"本文件照搬 Vue2"的结论,语境不同,准确 |
| `searchUnderstood.ts:46` | "词字符定义为 [A-Za-z0-9_](与 \w 一致)" | 成立——`[A-Za-z0-9_]` 与 JS 正则 `\w`(无 `u` 标志时)字符类完全相同,纯技术事实陈述 |
| `searchUnderstood.ts:70` | "queryParts/searchStateMatchesQuery 都照搬了这道守卫" | 成立——两者确实都有 `query \|\| ''` 这道守卫(`queryParts.ts:12` 的 `query \|\| ''`、`searchSort.ts:63` 的 `(query \|\| '').trim()`),M4 补的正是让 understood 追平这个已有模式 |
| `searchUnderstood.ts:86` | "中文查询「视频」不会命中——这是 Vue2 的既有行为,照搬 + 登记为已知局限" | 成立——media type 判据(`\bvideos?\b`/`\bphotos?\b`)本轮未改动,行为与登记一致 |
| `searchUnderstood.ts:91` | "time —— 判据顺序照搬(else if 链,先匹配到的胜出)" | 成立——五个快捷分支 + 年份分支的 else-if 顺序本轮未改动,只是 I2 给测试补了断言,判据顺序本身没变 |

**结论**:除 `searchQueryParts.ts:2` 已改,其余 7 处结论词经逐句核对**均仍然成立**,
不需要改动。`searchUnderstood.ts` 虽然本轮被 M4(补 `query || ''` 守卫)和 M5(补高亮
偏离登记)动过两处,但这两处新增/修改的注释本身准确描述了新代码,不影响其余既有结论词
所在语句的成立性。

## 验证

聚焦测试(纯注释改动,预期无行为变化):
```
$ pnpm exec vitest run src/photos/util/__tests__/searchUnderstood.test.ts \
  src/photos/util/__tests__/searchQueryParts.test.ts \
  src/photos/util/__tests__/searchSort.test.ts

 Test Files  3 passed (3)
      Tests  32 passed (32)
```

tsc:
```
$ pnpm exec vue-tsc --noEmit
```
无输出,0 错误。

注释三禁复查(`#hex` / `rgba(` / 字面 `<style>`):
```
$ grep -n "#[0-9a-fA-F]\{3,6\}\|rgba(\|<style>" \
  src/photos/util/searchUnderstood.ts \
  src/photos/util/searchQueryParts.ts \
  src/photos/util/searchSort.ts
```
无匹配,三个文件均未触碰这三种坑。

`git diff` 确认改动范围:
```
$ git diff -- src/photos/util/searchQueryParts.ts
```
只有 `searchQueryParts.ts:2-4` 的注释文本变化,函数体、签名、其余三个文件均未触碰。

## Files Changed(本轮)

- `src/photos/util/searchQueryParts.ts` —— 仅文件头注释措辞(2-4 行),零逻辑改动。

## Self-Review(本轮)

- 只动了复审点名的这一处,未顺手改别的文件/断言/签名。
- 按要求做了三个新文件的结论词 grep 自查,逐句核对结果如实列在上表(7 处成立 + 1 处
  已改)。
- 未跑全量(纯注释改动,任务要求里明确说明不必);跑了覆盖这三个文件的聚焦测试 +
  tsc,均绿/无输出。
- 范围外观察(`searchSort.ts:28` 的 takenAt 混合类型归一、report 里 I2 小节
  "10 passed" 与最终 11 例的时序性不一致)按控制器指示不动,已知悉。

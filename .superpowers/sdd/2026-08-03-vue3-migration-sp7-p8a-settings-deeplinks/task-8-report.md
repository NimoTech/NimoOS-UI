# Task 8 Report — 深链 `?q` / `?album` / `?person`

工作区:`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`,分支 `sp7-photos`,基线 `ba8d122`。

## 实现内容

扩展 `src/photos/composables/usePhotosDeepLinks.ts`(Task 7 建的文件),保持"一个键一个小函数"结构,新增三个函数 + 改写 `onMounted`:

- **`redirectSearchFromQuery(term)`**:`router.replace({ path: '/photos/search', query: { q: term } })`。回源 Vue2 `PhotosTimeline.vue:491-494`(`_applyUrlDeepLinks` 内)。用 `replace` 不用 `push`——入口归一,不留 `/photos?q=` 这条兼容 URL 在历史里。搜索词原样传递,不 trim、不转码。
- **`redirectAlbumFromQuery(id)`**:`router.replace({ name: 'photos-album-detail', params: { id } })`。回源 Vue2 `PhotosAlbumsView.vue:264`(`_applyRouteAlbum`,该视图自己 `mounted()` 里读,New-UI 统一收进本组合式)。**不做存在性校验**——Vue2 那边也不校验,只有 `?person` 才校验(见下)。
- **`applyPersonFromQuery(id)`**(async):先 `await usePhotosPeople().fetchPeople()`,`peopleStore.people.some(p => String(p.id) === String(id))` 校验存在,存在则 `redirectPersonFromQuery(id)`(`router.replace({ name: 'photos-person-detail', params: { id } })`),不存在或 fetchPeople 抛异常都走 `stripPersonFromQuery()`(摘掉 query 里的 `person` 键、`router.replace({ path: route.path, query: rest })` 留在原地,不弹 toast)。回源 Vue2 `PhotosTimeline.vue:509-523`(`_applyPersonFromQuery`)。

`onMounted` 改成一个 async IIFE:先 `await` 完 photoset/asset(灯箱路径),再跑 q/album/person(路由路径)——这是显式的执行顺序保证,不是"代码顺序恰好对了"。

## id 编码机制的选择与理由

按外层给的裁决(优先于 brief 字面的"手拼 + encodeURIComponent"):**用具名路由 + `params` 让 vue-router 自己编码**,不手拼字符串。

验证了 vue-router 4.6.4 源码(`node_modules/.pnpm/vue-router@4.6.4.../dist/devtools-*.mjs:167`):`encodeParam()` 在 `encodePath()` 的基础上额外把 `/` 编码成 `%2F`(`encodeParam(text) { return encodePath(text).replace(SLASH_RE, '%2F') }`),构造/解析两端用同一套内部函数,不会出现编码解码不对称。这比手拼 `'/photos/albums/' + encodeURIComponent(id)` 更安全——手拼还要自己保证两边的百分号规则完全一致。

Vue2 缺陷偏离登记(已在实现文件内联注释):Vue2 的 `?album`/`?person` 从来是"同页面内切换本地状态",从没走过"把 id 拼进 URL 路径"这一步,所以从没编码过——id 含 `/` 时会截断路径。New-UI 把它们变成真实路径跳转后,这个缺陷会实际发作(截断/误匹配路由甚至匹配失败),按移植纪律修正为编码,不照抄。

`?q` 不涉及路径编码问题——搜索词进的是 query value 而非路径 segment,vue-router 序列化 query 时自行处理,不需要手工编码。

## `String()` 归一

`peopleStore.people.some(p => String(p.id) === String(id))`——`Person.id` 类型是 `string | number`(`src/photos/util/peopleView.ts:22`,`toPerson()` 直接保留后端原始类型不转换),query 来的 `id` 恒为字符串。这是全区铁律(同类先例 `Place.Key` 是 int32),已用测试锁住(`people = [{ id: 42 }]`,`query.person = '42'` 应命中)。

## 与 brief / interfaces 的偏离(登记)

1. **`?album` 没有走 `fetchAlbums`**,与 brief"Interfaces"一节点名的接口不符。原因:外层裁决明确"`?album` 不校验"(Vue2 `PhotosAlbumsView.vue:264` 只读并打开,从不校验存在),而校验才需要先拉列表比对。既然不校验,就没有理由调用 `fetchAlbums`——调了也用不上返回值,是无意义的额外请求。已按裁决实现,未使用 `albums.ts` 的任何导出。
2. **测试断言方式偏离 brief step-1 骨架**:骨架用 `router.replace.mock.calls[0][0].path` 做字符串包含断言,这个形态只适配"手拼字符串路径"的实现。本文件选了具名路由 + params,调用参数里没有 `.path` 字段(是 `{ name, params }`)。改为断言 `router.currentRoute.value` 的真实解析结果(`name`/`params.id`/`fullPath`)——这比断言 mock 调用参数更强,是"测真实行为"而不是"测调用形态"。已在测试文件顶部注释登记。
3. **执行顺序测试没有用骨架建议的 `lb.openAt.mock.invocationCallOrder`**——Task 7 已经证明 `useLightbox()` 每次调用返回新对象字面量,外部 `vi.spyOn` 拦不到组合式内部那份调用,骨架这条断言打不中(同 Task 7 报告登记的偏离,T8 沿用同一条纪律)。改用受控 pending promise:卡住 `fetchPhoto`,证明"取图没 resolve 之前,`router.replace` 绝对没被调用过",这是比调用序号更强的真实时序证明,且天然对 mutation ④(交换顺序)敏感。

## 测试

### RED(step 2)

命令:
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose
```
结果:9 个新用例全部 FAIL(`?q` ×2、`?album` ×2、`?person` ×4、执行顺序 ×1),Task 7 既有 10 个用例全部仍 PASS(证明测试基础设施改动——`mountWithQuery` 返回值扩为 `{wrapper, router}`、`makeRouter` 新增三条路由、`svc.photos.listPersons` mock——没有破坏既有用例)。`Tests 9 failed | 10 passed (19)`。失败原因符合预期:实现里还没有这三个键的处理逻辑,断言全部落空(`replace` 未被调用 / `currentRoute.value.name` 仍是 `'photos'` / query 里 `person` 键没被摘掉)。

### GREEN(step 4)

命令同上。结果:`Test Files 1 passed (1)` / `Tests 19 passed (19)`。`[Vue warn]` 计数:
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose 2>&1 | grep -c "\[Vue warn\]"
```
→ **0**。

### 局部门(本任务规定的完整范围)

命令:
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts src/views/__tests__/Photos*.test.ts --reporter=verbose
pnpm exec vue-tsc --noEmit
```
结果:`Test Files 16 passed (16)` / `Tests 509 passed (509)`;`vue-tsc --noEmit` 零输出(通过)。

`[Vue warn]` 按文件归因(合并运行、`grep -c` 总数 2758,按 `stderr |` 前缀分组统计):

| 文件 | 数量 | 归属 |
|---|---|---|
| `usePhotosDeepLinks.test.ts`(本任务) | **0** | — |
| `PhotosPersonDetail.test.ts` | 504 | 既有债务(自建 `createI18n`) |
| `PhotosSearch.test.ts` | 469 | 既有债务 |
| `PhotosSmartViewDetail.test.ts` | 406 | 既有债务 |
| `PhotosPeople.test.ts` | 406 | 既有债务 |
| `PhotosPlaces.test.ts` | 322 | 既有债务 |
| `PhotosFavorites.test.ts` | 182 | 既有债务 |
| `PhotosAlbumDetail.test.ts` | 182 | 既有债务 |
| `PhotosSmartViews.test.ts` | 98 | 既有债务 |
| `PhotosAlbums.test.ts` | 84 | 既有债务 |
| `PhotosTrash.test.ts` | 63 | 既有债务 |
| `Photos.lightbox.test.ts` | 28 | 既有债务 |
| `Photos.route.test.ts` | 14 | 既有债务 |

全部是全局约束文档里已经登记的"另建 `createI18n`"债务(`Component "i18n-t" has already been registered`),与本任务代码无关,已按约定诚实归因,不算进本任务的产出。

## 变异验证(step 5)

全部手改 → 跑 → 确认变红 → 手动恢复 → `git diff` 确认文件已复原。**没有使用 `git checkout`/`git stash` 做恢复,全部手工编辑回退。**

1. **`replace` → `push`**(`redirectSearchFromQuery`):`Tests 3 failed | 16 passed` —— `?q` 的两条用例 + 执行顺序用例(它也断言 `router.replace` 被调用)全部变红。恢复后确认 `git diff` 无残留。
2. **删掉编码机制**(`redirectAlbumFromQuery` 改回 `router.replace('/photos/albums/' + id)`,不用具名路由 + params):`Tests 1 failed | 18 passed` —— 只有编码用例变红(`fullPath` 不再包含 `%2F`)。恢复后确认。
3. **删掉 `String()` 归一**(`p.id === id`):`Tests 1 failed | 18 passed` —— 只有数字 id 用例变红(`42 === '42'` 为 false)。恢复后确认。
4. **交换执行顺序**(q/album/person 挪到 photoset/asset 之前):`Tests 1 failed | 18 passed` —— 只有执行顺序用例变红(挂起的 `getAsset` promise 还没 resolve,`router.replace` 就已经被同步调用)。恢复后确认。

每次恢复后都跑了 `git diff --stat` + 关键字 grep 确认无 mutation 残留字符串(`MUTATION`/`p.id === id`/`router.push({ path: '/photos/search'`/`'/photos/albums/' + id`),结果 "no mutation residue found"。

## 文件改动

- `src/photos/composables/usePhotosDeepLinks.ts`——新增 `redirectSearchFromQuery`/`redirectAlbumFromQuery`/`applyPersonFromQuery`/`redirectPersonFromQuery`/`stripPersonFromQuery`,改写 `onMounted` 为顺序 await 的 IIFE,新增 `useRouter`/`usePhotosPeople` 导入。
- `src/photos/composables/__tests__/usePhotosDeepLinks.test.ts`——`mountWithQuery` 返回值扩为 `{wrapper, router}` 并支持 `opts.getAssetImpl` 覆盖;`makeRouter` 新增 `/photos/search`、`/photos/albums/:id`、`/photos/people/:id` 三条路由(占位组件 `Blank`);`svc` mock 新增 `listPersons`;新增 4 个 describe 块共 9 条用例。

## 自查(completeness / quality / discipline / testing)

- **completeness**:三个键都实现且都有测试;存在性校验 + 静默摘键路径(存在/不存在/String 归一/fetchPeople 失败四条都测了);执行顺序有专门用例锁住并做了变异验证。
- **quality**:命名延续 Task 7 风格(`xxxFromQuery`);复用 `firstQueryValue`,没有第二份实现;每个键一个小函数,`onMounted` 只做编排。
- **discipline**:没加 `?photo` 键(见下方对 ruling 7 的意见);`?album` 没加 Vue2 没有的校验;沿用"不装路由 watcher"的既有约定;没有动 Task 7 已写好的 `?asset`/`?photoset` 逻辑(只在 `onMounted` 里把它们包进了顺序 await 的 IIFE,函数体本身逐字未改)。
- **testing**:`?album`/`?person` 的断言全部落在 `router.currentRoute.value` 的真实解析结果上(`name`/`params.id`/`fullPath`/`query`),不是 mock 调用参数的字符串形态;执行顺序用例用受控 promise 证明真实时序,不是断言 mock 被调用过。四项变异验证全部达到"精确红"(只有目标用例变红,不多不少)。

## 关于 ruling 7(`?photo` 不在本期范围)的意见

同意维持排除。理由:
1. `?photo` 的存在前提是"没有走 legacy `photoset`/`asset` 深链时才生效"(Vue2 `PhotosTimeline.vue:377` 注释:`仅当没有走 legacy photoset/asset 深链时才生效,避免双重打开`)——它本质上是给"没有 token 的场景"兜底开单张灯箱,功能上和 `?asset` 高度重叠(几乎是同一件事的另一个入口)。
2. spec §6 的契约明确列的是 `q`/`album`/`person`/`asset`/`photoset` 五式,没有 `photo`。加进去属于"计划外扩展",违反本期"不做无关重构/不擅自加范围"的移植纪律。
3. 如果后续真的需要,应该是独立一条小票(有自己的 spec 依据),而不是顺手夹带在这里——尤其它还要和已实现的 `asset`/`photoset` 互斥判断打交道,牵涉面不小,不该无声带过。

## 无残留问题 / 无阻塞项

Commit:`4b94094`(见上)。

---

## 附:真机验收修正(2026-08-04)—— query-only 导航支持

### 问题

机主在时间线上直接改地址栏(`#/photos?q=%E7%8C%AB`、`#/photos?asset=deadbeef`、
`#/photos?person=<uuid>`),五式全部没反应。根因:vue-router 4 对同一路由组件只
query 变化**不重新 mount**,`onMounted` 只在全新挂载时跑一次,原实现完全没有覆盖
"已经停留在 `/photos`、之后才改 query"这条路径。协调者的原裁决(ruling 7:"不装
watcher,一次全新挂载就够")已撤回——**这是协调者本人的错误,不是我原实现的缺陷**:
Task 5 的 `?section=` 深链当时就踩过同一个坑并补了 watcher,而这里的裁决在同一份
指导里反而禁止了同样的修法。

### 改了什么

`src/photos/composables/usePhotosDeepLinks.ts`:

1. **五键共用一个分发判据 `applyDeepLinkChanges(query, previous)`**——`previous` 为
   `null`(mount 路径)时五个键当全部"从无到有";`previous` 有值(query-only 路径)
   时逐键比较归一化后的字符串值,只处理**值真的变了**的那个键。`onMounted` 与新增的
   `watch(...)` 都只调用同一个 `dispatchQueryChange(query)`(内部维护 `previousQuery`
   快照 + 调 `applyDeepLinkChanges`),不存在两份分发逻辑——沿用 Task 5
   `scrollToSection`/`isSectionId` 的先例(同一函数,两条路径共用)。
2. **新增 `watch()`**,只 watch `route.query.photoset/asset/q/album/person` 五个具体值
   (不 watch 整个 `route.query` 对象),不带 `immediate`(不与 `onMounted` 那次重复)。
3. 文件头注释重写:明确两条到达路径、🔴 标出"逐键比较不整体重跑"是解禁 watcher 的
   关键、并把执行顺序那段的措辞收紧成"Vue2 的 `_openPhotoSetFromQuery`/`_openAssetFromQuery`
   是不 await 的 fire-and-forget 调用,`_applyUrlDeepLinks()` 紧接着同步执行——Vue2 的
   `完成顺序`其实不受控,只是`调用顺序`先灯箱后路由;New-UI 显式 await 是比 Vue2 更强
   的顺序保证,不是照搬 Vue2 时序",覆盖协调者要求的措辞修正。

### 如何保证"消费过的 handoff 不会被重新触发"

这是要求里 🔴 标出的硬部分,也是最初裁决禁止 watcher 的理由本身。保证机制分两层:

1. **Vue 的 watch 本身只在"被 watch 的值真的变了"时才调用回调。** 多数据源 watch
   (`watch([...getters], cb)`)对每个数据源单独用 `Object.is` 比较新旧值;即使
   `route.query` 因为某个**无关**键变化而整体换成新对象引用,只要 `photoset`/`asset`/
   `q`/`album`/`person` 这五个具体字符串值都没变,回调根本不会被触发——这一层在
   Vue 的 reactivity 层面就把"无关 query 变化"挡在门外。
2. **`applyDeepLinkChanges` 内部再逐键比较一次(`photosetChanged`/`assetChanged`/…)。**
   这一层是给"多个键在同一次 push 里一起变化"兜底——哪怕 watch 整体触发了一次回调
   (因为其中至少一个键变了),函数内部仍然只对**真的变了的那个键**调用对应的
   `openPhotoSetFromQuery`/`openAssetFromQuery`/`redirectSearchFromQuery`/…,已经consume
   过的 `photoset`(值没变)绝不会被重新送进 `openPhotoSetFromQuery`,因而绝不会因为
   localStorage 里已经没有 handoff 而误判成"缺失"、走降级路径重新打开 active 单张。

**用测试证明**(见下方用例"consumed handoff 之后编辑不相关的 ?q"):先用
`?photoset=tok&active=b` 挂载消费掉 localStorage 里的 `nimo:photoset:tok`(灯箱开
`['a','b','c']`),然后 `router.push` 一次**保留 `photoset=tok&active=b` 不变、只新增
`q=猫`** 的 query。断言:①`lb.list.value` 仍是 `['a','b','c']`(没有降级缩成 `['b']`
单张)②`svc.photos.getAsset` 调用次数没有增加(没有为 'b' 重新发起降级取图)③`q` 确实
被处理了(`router.replace` 跳到 `/photos/search?q=猫`)。如果把 `applyDeepLinkChanges`
里的逐键 `Changed` 判断去掉、退回"query 有任何变化就整体重跑五式",这条用例的①②会
立刻变红——已手工验证过这一点(见下方"额外验证"),不只是理论推导。

### 新增测试(两条路径都覆盖,共 8 条 query-only 用例)

文件:`src/photos/composables/__tests__/usePhotosDeepLinks.test.ts`,新增
describe 块 `usePhotosDeepLinks · query-only(已停留在 /photos,之后才出现该 query)`:

| 用例 | 覆盖点 |
|---|---|
| `?q query-only` | requirement 6:五键之一,query-only 路径基本用例 |
| `?album query-only` | 同上 |
| `?person query-only` | 同上(含 `fetchPeople` 存在性校验) |
| `?asset query-only` | 同上 |
| `?photoset query-only` | 同上(含一次性交接消费) |
| `consumed handoff 之后编辑不相关的 ?q` | requirement 2(🔴 核心用例,见上) |
| `?asset 被从地址栏删除是 no-op` | requirement 4 |
| `?asset 值没变、只是另一个键(?q)变了` | requirement 3(灯箱稳定性) |

全部用真实 `router.push` 在已挂载的 Host 上模拟"用户改地址栏"(与
`PhotosSettings.test.ts` 的 `已停留在本页时 query 才变为 ?section=ai` 手法一致),断言
落在 `lb`/`router.currentRoute`/mock 调用次数等真实状态上,不是 mock 调用参数的字符串
匹配。

### 测试结果

命令:
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose
```
结果:`Test Files 1 passed (1)` / `Tests 27 passed (27)`(19 条 fresh-mount 既有用例 + 8
条新增 query-only 用例全部通过)。`[Vue warn]` 计数(`grep -c "\[Vue warn\]"`):**0**。

命令:
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts src/views/__tests__/Photos*.test.ts --reporter=verbose
pnpm exec vue-tsc --noEmit
```
结果:`Test Files 16 passed (16)` / `Tests 534 passed (534)`;`vue-tsc --noEmit` 零输出
(通过)。`usePhotosDeepLinks.test.ts` 贡献 `[Vue warn]` 数量仍为 0(其余 2863 条分布在
既有 `PhotosPersonDetail`/`PhotosSearch`/`PhotosPeople`/… 等文件,全部是已登记的
"另建 `createI18n`"债务,与本次改动无关,已按约定诚实归因,不重复列出明细——与
Task 8 首次提交时的分布同源同性质)。

### 变异验证(requirement 7)

**① 删除 watch 整段**(手改,非 git 操作):
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose
```
结果:`Tests 7 failed | 20 passed (27)`——8 条 query-only 用例里 7 条变红(`?q`/`?album`/
`?person`/`?asset`/`?photoset` 的 query-only 用例 + consumed-handoff 用例 + 灯箱稳定性
用例);**"删除是 no-op"那一条仍然通过**,这是预期内的——"什么都不做"这个降级态天然
满足"no-op"的断言,不能用它单独证明 watcher 存在,但另外 7 条已经足够证明删除后行为
确实回退。19 条 fresh-mount 既有用例**全部仍然通过**——证明这次改动没有影响 mount 路径
(requirement 7 的"反向验证"要求)。

恢复后 `git diff src/photos/composables/usePhotosDeepLinks.ts | grep -c "MUTATION TEST"`
→ `0`,`git diff --stat` 只显示两个目标文件的正常改动,无残留。**全程手工编辑 + 手工
恢复,未使用 `git checkout`/`git stash`。**

### 与 requirement 1 字面表述的一处判断差异(如实登记)

Requirement 1 字面说"one function ... call it from both onMounted and a watcher"。我的
实现里,`onMounted` 和 `watch` 调的确实是同一个函数(`dispatchQueryChange`),但
`dispatchQueryChange` 内部对"mount"和"query-only"两种情形传给 `applyDeepLinkChanges`
的 `previous` 参数不同(`null` vs 上一次快照)——**这是有意为之,不是偷懒简化**:如果
两条路径除了"previous 是否为 null"之外还要在分发时机上有别(比如 mount 时不比较、
query-only 时才比较),那就不是"同一个函数"了。现在的写法是"完全同一个函数,只是
输入的 `previous` 不同",比"两个函数各写一半逻辑"更贴近 requirement 1 的实质意图
(不让两份分发逻辑各自维护、慢慢漂开)。

### 判断不同的地方

- Requirement 3 的例子(改 `?q` 而 `?asset` 不变)天然被"逐键比较"机制覆盖,不需要
  额外写一条"专门针对 asset 稳定性"的隔离逻辑——我把这一点和 requirement 2 的核心
  用例分开写成两条独立测试,而不是合并成一条,是想让"handoff 消费后不重新触发"和
  "灯箱本身不因无关变化重新打开"分别有一条单独的回归锚点,即使以后其中一条被误改
  出问题,能精确定位是哪条不变量破了。
- 没有单独处理"`photoset`/`asset` 同时都变化"这种边界(比如用户一次性把地址栏整个
  换成一个新的 URL,`photoset` 从 `tok1` 变成 `tok2` 同时 `asset` 也从无到有变成
  `x`)——沿用了 mount 路径已有的 `if/else if` 优先级(photoset 赢),没有为
  query-only 路径单独写这个组合的测试用例,因为 Vue2 本身也没有为这种同时变化的
  组合定义过明确行为(与文件头"范围声明"那段的既有判断一致)。如果协调者认为这个
  组合值得单独锁住,我可以补一条测试。

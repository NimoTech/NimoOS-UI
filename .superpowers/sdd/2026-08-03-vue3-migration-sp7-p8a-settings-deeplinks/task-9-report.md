# Task 9 报告:两处错误态收口(P3 / P4 遗留)

---

## 附加修复报告(评审 Important 1,commit `1fed2bc`)

### 评审发现

评审确认了原实现(loadError 独立、失败态优先级正确、四文件无关代码未动、零新增
i18n/token、重试按钮复用 hover-safe 的全局 `.bar-btn`、两条 Ruling-5 挡门用例确实走真实
非失败路径而非手改 store 字段、两条变异验证按检验)全部通过,唯一 Important:

**Ruling 1 本身有缺陷,不是我的实现问题。** 原设计是"进 try 前先把 loadError 置假",这在
每次重试(不论成功失败)期间都会造成一个窗口:`loadError=false` 但 `favoritesLoaded`/
`albumsLoaded` 仍是 `false`。相册详情页此时会落到骨架分支(可接受,毕竟是"正在加载"的
合理表现),但**收藏视图没有专门的"加载中"分支**——`isEmpty` 因 `favoritesLoaded` 仍假
而为假,直接落进 `v-else` 渲染一个空列表的网格,**在每次重试飞行期间原样重演本任务本要
修的 P3 症状**。且"重试本身也失败"这条路径完全没有测试覆盖。

### 协调者裁决(取代原 Ruling 1)

1. `loadError` **只在成功确认后才清空**,不在函数顶部预置。
2. 每个视图加本地 `retrying` ref,飞行期间禁用重试按钮(给用户即时反馈,顺带堵上连点
   两次重试派发两个并发 fetch 的口子)。`:disabled` 绑定即可,不新增 class/i18n 键。
3. 补 4 条测试:store × 2(reject→retry→reject 结束后 loadError 仍真)、view × 2
   (失败态持续可见,不出现网格/骨架)——view 那一对才是真正钉住不变量的。
4. 变异验证新设计:把 loadError 提前清空的写法放回去,确认 Favorites 的 view 级用例
   变红,手动复原并用 `git diff` 确认。
5. 代码注释里写清楚"为什么从"进入即清空"改成"仅成功清空"",而不是只写结果。

### 改了什么

- `src/photos/stores/favorites.ts`:`fetchFavorites` 移除函数顶部的
  `loadError.value = false`,改为只在 try 块成功路径末尾(`favoritesLoaded.value = true`
  之后)才 `loadError.value = false`;catch 分支不变(仍然 `loadError.value = true`)。
  新增大段注释解释这次改动的因果(原设计=什么、为什么错、现设计=什么)。
- `src/photos/stores/albums.ts`:`fetchAlbums` 同款处理,同款注释。
- `src/views/PhotosFavorites.vue`:新增 `retryingFavorites = ref(false)`;
  `retryFavorites` 改为 `async`,带重入守卫(`if (retryingFavorites.value) return`)+
  `finally` 收尾;重试按钮加 `:disabled="retryingFavorites"`。同时按 Take-along 补了
  `.empty-state .bar-btn { margin-top: 10px; }`(与 `PhotosAlbumDetail.vue:606` 对齐,
  两个失败屏间距一致,零新增 token)。
- `src/views/PhotosAlbumDetail.vue`:`retryingAlbums = ref(false)` + 同款 `async` 守卫;
  重试按钮加 `:disabled="retryingAlbums"`。
- 测试文件四个各补一条(见下)。

### 覆盖测试

**Store 层(2 条,均已通过)**:
- `favorites.test.ts`:`reject → retry → reject:结束后 loadError 仍为真,
  favoritesList/favoritesLoaded 与未成功过一致`
- `albums.test.ts`:`reject → retry → reject:结束后 loadError 仍为真,
  albums/albumsLoaded 与未成功过一致`

**View 层(2 条,真正钉住不变量的那对)**:
- `PhotosFavorites.test.ts`:`失败态重试仍失败(reject→retry→reject)→ in-flight 期间与
  结束后失败态都持续可见,不出现网格`——用受控 `Promise`(`reject` 函数延后调用)卡住
  重试的飞行窗口,在 `flushPromises()` 之前断言 `fav-load-error` 仍在、`.photos-grid-root`
  不在,再 reject、`flushPromises`,断言落定后仍是失败态。
- `PhotosAlbumDetail.test.ts`:`相册失败态重试仍失败(reject→retry→reject)→ 失败态持续
  可见,不出现骨架`。

**踩坑记录(诚实报告)**:第一版 view 级用例(`await flushPromises()` 紧跟在
`trigger('click')` 之后就断言)**完全没有观察到 in-flight 窗口**——click 触发后立刻
`flushPromises`,断言时重试的 reject 已经落定,`loadError` 已经因 catch 分支重新变真,
测试通过与否与"是否提前清空 loadError"完全无关。跑第一版变异验证时(把提前清空写法
放回去)这条用例**仍然通过**,说明它对本次要防的回归没有区分力。改用受控 promise
延后 reject、在 `flushPromises` 之前断言之后,同一次变异验证才**正确变红**。已把这条
教训写进测试文件里的注释(`PhotosFavorites.test.ts`,见"in-flight 期间"用例上方注释)。

### 命令与结果

```
pnpm exec vitest run \
  src/photos/stores/__tests__/favorites.test.ts \
  src/photos/stores/__tests__/albums.test.ts \
  src/views/__tests__/PhotosFavorites.test.ts \
  src/views/__tests__/PhotosAlbumDetail.test.ts \
  --reporter=verbose
```
结果(修复后,本次运行命名为"fix-run2"):`Test Files 4 passed (4)` /
`Tests 107 passed (107)`(103 原有 + 4 新增)。`[Vue warn]` 计数:**427 条**,全部来自
两个 view 测试文件既有的 `createI18n` 重复注册(Task 8 遗留,非本轮/本任务新增;较修复前
的 413 条多出的 14 条按比例来自本轮新增的 2 个 view 级 mount 用例,同一既有模式,非新增
告警类型)。

```
pnpm exec vue-tsc --noEmit
```
结果:无输出,退出码 0。

### 变异验证(本轮新增的这一条)

- 手改 `favorites.ts`:把 `loadError.value = false` 放回函数顶部(试前预置),移除成功
  分支里的那次赋值。
- 先跑旧版 view 用例(`await flushPromises()` 紧跟 `trigger('click')`)→ **仍然通过**,
  暴露测试本身的区分力缺陷(见上文踩坑记录)。
- 改造用例为受控 promise 版本后,跑
  `pnpm exec vitest run src/views/__tests__/PhotosFavorites.test.ts -t "in-flight 期间与结束后失败态都持续可见"`
  → **变红**:`AssertionError: expected false to be true`,断在
  `w.find('[data-test="fav-load-error"]').exists()).toBe(true)`(重试飞行期间失败态
  被提前清空的 `loadError` 误判"没失败",落进网格分支)。命中预期,证明改造后的测试
  真的在守护这条不变量。
- 手动复原 `favorites.ts`(把预置行删回去,成功分支补回 `loadError.value = false`),
  `git diff src/photos/stores/favorites.ts` 核对与提交前的目标状态完全一致,再跑一遍
  四文件全量确认 107/107 全绿。

### 文件清单(本轮追加改动)
- `src/photos/stores/favorites.ts`(改)
- `src/photos/stores/albums.ts`(改)
- `src/views/PhotosFavorites.vue`(改,含 Take-along 间距修正)
- `src/views/PhotosAlbumDetail.vue`(改)
- 四个对应测试文件(各补 1 条,共 4 条)

`git diff --stat`(本轮 commit `1fed2bc`):8 files changed, 148 insertions(+), 12
deletions(-)。

### 顾虑

无新增顾虑。上文"踩坑记录"已如实报告第一版测试的区分力缺陷及修正过程,不隐瞒。

---

## 改了什么

### 缺陷 A(P3):收藏视图静默空网格
- `src/photos/stores/favorites.ts`:新增 `loadError = ref(false)`。`fetchFavorites` 进入 try
  前置 `loadError.value = false`;catch 里 `loadError.value = true`(与原有的
  `favoritesList = []` + `console.error` 并列,不改动原有行为);`__resetForTest` 里一并复位。
  返回对象新增导出 `loadError`。
- `src/views/PhotosFavorites.vue`:模板新增 `v-if="fav.loadError"` 分支
  (`data-test="fav-load-error"`,文案 `photosFavoritesLoadFailed` + 重试按钮
  `data-test="fav-retry"`,复用全局 `.bar-btn` 类),**在原有 `v-if="isEmpty"` 之前**
  (改成 `v-else-if`)。新增 `retryFavorites()` 函数,按钮 `@click` 直接调用
  `fav.fetchFavorites()`。

### 缺陷 B(P4):相册详情永久骨架
- `src/photos/stores/albums.ts`:同款处理。`fetchAlbums` 进入 try 前置
  `loadError.value = false`;catch 里追加 `loadError.value = true`(原有的
  `console.error` 保留,不改动);`__resetForTest` 一并复位。返回对象新增导出 `loadError`。
- `src/views/PhotosAlbumDetail.vue`:模板新增 `v-if="albums.loadError"` 分支
  (`data-test="album-load-error"`,文案 `photosAlbumLoadFailed` + 重试按钮
  `data-test="album-retry"`),**在原有骨架分支 `v-if="!album && !albums.albumsLoaded"`
  之前**(改成 `v-else-if`)。新增 `retryAlbums()` 函数,按钮 `@click` 直接调用
  `albums.fetchAlbums()`。

两处的失败态视觉都复用了本区已有的 `.empty-state` / `.empty-state-title` 类(与
`PhotosTrash.vue`/相册"不存在"态同构),重试按钮复用全局 `.bar-btn`(`theme.css:522`,
已自带 `:hover` 规则,无需新增 hover 特异性豁免——这是单一类,不是 `.on`/`[data-active]`
变体场景)。**零新增 CSS,零新增 i18n 键**(`photosFavoritesLoadFailed` /
`photosAlbumLoadFailed` / `photosRetry` 均为 Task 2 已交付的既有键)。

## loaded 标志语义确认(硬约束)

**`favoritesLoaded` 与 `albumsLoaded` 的赋值语句一处未动**——`fetchFavorites`/`fetchAlbums`
的成功分支里原有的 `favoritesLoaded.value = true` / `albumsLoaded.value = true` 逐字保留;
catch 分支里两者都**没有**被置为 true 或 false(catch 之前只做过 `loadError.value = false`
的预置,不涉及 loaded 标志)。`loadError` 是完全独立的新增 ref,不与 loaded 共享同一次赋值
语句。`git diff` 已核对(见下方"文件清单"一节的 diff 摘录)。

## 测试与结果

### TDD 证据

**RED(store 测试,新增 6 条)**:
```
pnpm exec vitest run src/photos/stores/__tests__/favorites.test.ts src/photos/stores/__tests__/albums.test.ts --reporter=verbose
```
在实现 `loadError` 之前跑,6 条新用例全部因 `expected undefined to be true/false` 失败
(`s.loadError` 是 `undefined`),其余既有 39 条通过(45 总数,6 失败)。这是预期的
"属性不存在"红,不是逻辑红。

**GREEN(同一条命令)**:实现后 45/45 全绿。

**RED(view 测试,新增 6 条)**:
```
pnpm exec vitest run src/views/__tests__/PhotosFavorites.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
```
在实现视图分支之前跑:3 条直接失败(`fav-load-error`/`album-load-error` 元素找不到,或
`Cannot call trigger on an empty DOMWrapper`);另外 3 条("确认为零收藏仍走空态"等)在完整
文件跑批时也变红——这是因为"重试"用例里 mount 抛错导致其排队的
`mockResolvedValueOnce`/`mockRejectedValueOnce` 未被消费,级联污染了同文件里后面的用例
(vitest 的 `mockClear()` 不清队列,只清调用记录)。单独用 `-t` 跑该条则通过——已在报告过程
中验证并记录,确认这是"未实现"导致的级联副作用,不是测试本身写错。实现后级联消失,
全部转绿。

**GREEN(同一条命令)**:实现后 103/103(store 45 + view 58)全绿。

### 局部门(收尾前的完整局部跑)
```
pnpm exec vitest run \
  src/photos/stores/__tests__/favorites.test.ts \
  src/photos/stores/__tests__/albums.test.ts \
  src/views/__tests__/PhotosFavorites.test.ts \
  src/views/__tests__/PhotosAlbumDetail.test.ts \
  --reporter=verbose
```
结果:`Test Files 4 passed (4)` / `Tests 103 passed (103)`。

`[Vue warn]` 计数:本次运行(4 文件合跑)共 **413 条**,全部来自
`PhotosFavorites.test.ts`/`PhotosAlbumDetail.test.ts` 两个文件里既有的
`createI18n({...})` 与全局 i18n 单例重复安装(两文件在 Task 8 就已存在这个模式,非本任务
引入——本任务未新增任何 `createI18n` 调用)。属已登记的既有台账债务
(`vitest-reporter-hides-warnings.md` 记忆里描述的同类问题),不计入本任务新增告警。
本任务自己新增的 10 条断言(store 6 + view 6,其中 view 部分复用了已有 mount 路径)本身
不额外产生 `[Vue warn]`。

```
pnpm exec vue-tsc --noEmit
```
结果:无输出,退出码 0(通过)。

```
pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts --reporter=verbose
```
结果:两文件均通过(`color-guard` 757 例全绿,`parity` 随附通过)。本任务未新增 CSS/i18n
键,这两道门严格讲不强制要求跑,但为保险起见仍执行了一遍,确认未引入回归。

### Step 5 变异验证(手改 → 跑 → 手复原 → git diff 确认干净)

**变异①:把相册失败态分支的优先级挪到骨架分支之后**
- 手改 `PhotosAlbumDetail.vue`:骨架分支的 `v-if` 挪到最前,失败态分支改 `v-else-if`。
- 跑 `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts -t "失败态优先于骨架态"`
  → **变红**:`AssertionError: expected false to be true`(`album-load-error` 找不到,
  因为骨架分支先命中拦住了)。命中预期。
- 手动复原为原实现,`git diff src/views/PhotosAlbumDetail.vue` 确认与提交前的目标状态
  完全一致(无残留改动)。

**变异②:两个 store 的成功路径也把 `loadError` 置为 true**
- 手改 `favorites.ts` 与 `albums.ts`:各自在成功分支追加一行 `loadError.value = true`。
- 跑四个测试文件 → **变红**:47/103 失败,覆盖两个"确认为零/正在加载"区分用例族
  (以及大量其它既有用例——因为几乎每次成功 mount 后都会被误判成失败态,级联面很大,
  但核心挡门用例——"确认为零收藏仍走空态"/"成功路径 loadError 保持假"/
  "重试成功后 loadError 归假"——精确命中变红)。命中预期。
- 手动复原,`git diff src/photos/stores/favorites.ts src/photos/stores/albums.ts` 确认
  与提交前的目标状态完全一致(无残留改动)。

## 文件清单
- `src/photos/stores/favorites.ts`(改)
- `src/photos/stores/albums.ts`(改)
- `src/views/PhotosFavorites.vue`(改)
- `src/views/PhotosAlbumDetail.vue`(改)
- `src/photos/stores/__tests__/favorites.test.ts`(改,新增 3 条测试)
- `src/photos/stores/__tests__/albums.test.ts`(改,新增 3 条测试)
- `src/views/__tests__/PhotosFavorites.test.ts`(改,新增 3 条测试)
- `src/views/__tests__/PhotosAlbumDetail.test.ts`(改,新增 4 条测试)

无新文件。`git diff --stat`:8 files changed, 196 insertions(+), 4 deletions(-)。

## 自查(fresh eyes)

- **完整性**:两处缺陷各自的 store+view 都改了;两个重试路径(`fav-retry`/`album-retry`)
  都接了对应 fetch;brief 列出的全部 10 条命名测试(favorites 2 + PhotosFavorites 3 +
  albums 1 + PhotosAlbumDetail 3,以及我额外加的"成功路径 loadError 保持假"补充用例)
  都已落地并通过。
- **质量**:两个 store 里 `loadError` 都是独立 ref,未与 `favoritesLoaded`/`albumsLoaded`
  合并或复用同一条赋值语句;两个视图里失败态分支都排在原有分支之前(`v-if` 挪到失败态,
  原分支改 `v-else-if`)。
- **纪律**:除新增的 `loadError` 相关代码外,四个产品文件里没有其它改动——`git diff`
  已核对,commit 前逐一确认无关代码未被触碰(未做无关重构,未改动任何既有命名/注释/
  逻辑)。
- **测试**:每个失败态测试都断言"渲染出的 DOM 分支"(`data-test` 元素是否存在),不是只
  查 store 内部字段;确认为零/正在加载的区分测试同样断言 DOM,不是只查字段。

## 顾虑

- 无实质顾虑。唯一值得一提的观察:本次为验证变异②,把两个 store 的成功路径同时改坏后
  跑全部四个文件,级联失败达到 47/103——这比 brief 预想的"两条区分用例应变红"范围更大,
  但属于合理现象(几乎所有成功 mount 后的断言都会被误判态污染),核心挡门用例精确命中,
  已在上文列出。
- `[Vue warn]` 413 条计数已按"per-run 具名"要求报告,且已确认是 Task 8 遗留的既有
  `createI18n` 债务,非本任务引入。

## 计划书与代码的出入

未发现出入。两处缺陷的"回源实证"描述(favorites.ts:38-53 / albums.ts:56-64 与两个视图
对应行号)与实际代码逐行核对一致,行号仅因文件后续被其它任务追加内容而略有偏移,但
描述的机制、变量名、分支条件均与代码完全吻合。

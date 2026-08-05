# Task 1 报告:albumView.ts 纯函数(相册视图映射 + 两套排序)

## 实现了什么

新增 `src/photos/util/albumView.ts`,导出四个纯函数/类型:

- `AlbumView` 接口(`id/title/cover/count/dateRange/createdAt/dateEnd`)
- `parseYearMonth`(模块私有)+ `formatAlbumSpan(startRaw, endRaw)`
- `albumToView(a, untitled)`
- `sortAlbums(list, sort)`
- `sortAlbumPhotos(photos, sortBy)`

不依赖 Pinia、不依赖 i18n(`untitled` 由调用方传入)。

## 逐字符比对 Vue2 源的过程与发现

打开并通读了以下真实文件片段(不是照抄 brief 快照):

- `NimoOS-UI/src/views/Photos/PhotosAlbumsView.vue:191-232`(`sortOptions` + `userAlbums` computed)
- `NimoOS-UI/src/views/Photos/PhotosAlbumsView.vue:282-301`(`parseYearMonth` + `formatAlbumSpan`)
- `NimoOS-UI/src/views/Photos/PhotosAlbumsView.vue:359-370`(`applySort`)
- `NimoOS-UI/src/views/Photos/PhotosAlbumDetail.vue:219-252`(`photos` computed)

**发现 1(brief 与 Vue2 有出入,已按 Vue2 修正)**:brief 给出的 `AlbumView` 接口签名里 `cover` 字段写的是 `a.coverAssetId ?? null`,但 Vue2 `PhotosAlbumsView.vue:219` 实际写的是 `a.coverAssetId || null`。二者仅在 `coverAssetId` 为空字符串 `''` 时行为不同(`??` 保留 `''`,`||` 落到 `null`)。brief 登记的「三处刻意偏离」清单里没有这一条,按任务约束「除三处外一律逐字保真」,最终实现按 **Vue2 的 `||`** 落地,并在代码里加了一行注释登记这个差异点(`albumView.ts:53-55` 附近)。给定的测试用例(`coverAssetId` 缺失场景)对两种写法结果一致,不影响 GREEN,但语义上是我在实现前发现并主动修正的偏离。

**核对无误的部分**:
- `title`(`name || title || untitled`)、`count`(`assetCount != null ? … : (assets?.length || 0)`)、`createdAt`(`|| null`)与 Vue2 逐字一致。
- `formatAlbumSpan`/`parseYearMonth` 正则、跨年/同年同月/同年跨月分支、`MONTHS` 三字母缩写表,逐字一致。
- `sortAlbums` 的 `name`/`name-r`/`count` 分支逐字一致。
- 确认了 Vue2 `sortOptions`(`:195`)里确实列出了 `id: 'created'`(标签「Recently added」)选项,但 `applySort`(`:365-369`)的 if/else 链**完全没有 `created` 分支**——选中它在 Vue2 里其实是静默不排序的 bug。这印证了 brief 里「created 补实现」这条刻意偏离的措辞:New-UI 用与 `date`/其它分支相同的 `ts()` 模式给它补上了实现,不复刻这个 Vue2 bug。
- 确认了 Vue2 `date` 分支的 `ts(a)` 辅助函数只读 `a.createdAt`(因为 Vue2 的 view 对象根本没有单独的日期跨度字段),对应 brief「`date` 改用 `dateEnd`」这条偏离——本实现的 `date` 分支改读新增的 `dateEnd` 字段。
- `sortAlbumPhotos` 的 `taken`/`added`/其它(含 `manual`)分支与 `PhotosAlbumDetail.vue:224-242` 逐字一致(除了统一返回新数组这条已登记的偏离外)。

## 三处刻意偏离(按登记要求,均已在代码里加注释)

1. **`created` 补实现**(`albumView.ts:75-78`):Vue2 UI 有 `created` 排序选项但 `applySort` 从未处理它(选中后静默不排序);本实现补上,复用与其它日期分支相同的 `ts()` 模式(读 `createdAt`)。
2. **`date` 改读 `dateEnd`**(`albumView.ts:79-82`):Vue2 的 `date` 分支实际上也是读 `a.createdAt`(因为其 view 对象没有日期跨度字段);本实现让 `date` 分支读新增的 `dateEnd` 字段,更贴合“按拍摄日期排序”的语义。
3. **返回新数组而非原地 `sort`**(`albumView.ts:64`,`sortAlbums`;以及 `sortAlbumPhotos` 的 `manual` 分支同样返回 `[...photos]` 而非原引用):Vue2 `applySort` 原地改的是 computed 里刚 map 出的临时数组,无副作用;New-UI 里传入的可能是 store 里的数据,原地排会污染,故统一返回新数组。

## TDD 证据

**RED**(`pnpm vitest run src/photos/util/__tests__/albumView.test.ts`,实现文件创建前):

```
 FAIL  src/photos/util/__tests__/albumView.test.ts [ src/photos/util/__tests__/albumView.test.ts ]
Error: Failed to resolve import "../albumView" from "src/photos/util/__tests__/albumView.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

失败原因符合预期:`albumView.ts` 尚未创建,导入解析失败(模块不存在),而非某个断言失败——说明测试确实在验证真实实现是否存在/正确,而不是空跑通过。

**GREEN**(实现后同一命令):

```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

**全量测试**(`pnpm test`):

```
 Test Files  245 passed (245)
      Tests  1521 passed (1521)
```

基线 1503 + 新增 18 = 1521,吻合。(输出里有几行 jsdom `Not implemented: navigation` 报错来自 `src/photos/stores/__tests__/favorites.test.ts` 的 `exportZip` 用例,是既有噪音,与本任务无关,不影响 pass 计数。)

**tsc**(`pnpm exec vue-tsc --noEmit`):无输出,类型检查通过。

## 改了哪些文件

- 新增:`src/photos/util/albumView.ts`
- 新增:`src/photos/util/__tests__/albumView.test.ts`(Step 1 给定测试原样落地,未做改动)

## 自审

- **完整性**:brief 要求的四个导出(`albumToView`/`formatAlbumSpan`/`sortAlbums`/`sortAlbumPhotos`)全部实现,签名与 `AlbumView` 字段与 brief 一致(除已登记的 `cover` 差异修正)。
- **质量/YAGNI**:未引入超出 brief 范围的字段或分支(如未迁移 `kind: 'user'`,未处理共享相册)。把 `sortAlbums` 里原本重复的 `ts`/`tsDateEnd` 两个闭包合并成一个按字段名参数化的 `ts(a, field)`,消除重复,行为不变(已重跑测试确认)。
- **测试是否真验行为**:测试覆盖了正常路径 + 边界(空值/非法格式/缺字段/原地修改检测),`sortAlbums` 专门有一条 `不原地修改入参数组` 断言验证了偏离 3;`formatAlbumSpan` 覆盖了同年同月/同年跨月/跨年/缺失/RFC3339 五种路径,`sortAlbumPhotos` 覆盖了 `taken`/`added`/`manual` 三分支。判定这些测试确实会在实现错误时失败(RED 阶段已验证模块级别的失败,GREEN 阶段 18 个断言全部基于具体值比较,非 tautology)。

## 遗留疑虑

- `cover` 字段的 `||` vs `??` 差异已如实记录并按 Vue2 源改正,但**建议后续维护 brief 文档的人同步更正 P4 brief 里的接口签名**,避免下一个任务的实现者直接照抄 brief snippet 时踩坑(brief 本身在别处也提醒"不要比对 brief 快照,要比对 Vue2 源",这次实践验证了这条提醒是必要的)。
- 无其它疑虑;三处刻意偏离已逐一核对 Vue2 行为并注释落地,全量测试 + tsc 均绿。

---

## 评审修复(Important finding 回应)

**问题**:评审独立比对 Vue2 源后确认实现逻辑正确(含 `cover` 的 `||` 改正),但指出 `sortAlbums` 夹具(`:37,44-45`)让 `created` 分支(读 `createdAt`)与 `date` 分支(读 `dateEnd`)在给定数据下产出**相同**排序结果 —— 若未来有人把 `date` 分支误改回读 `createdAt`(即回退掉 brief 登记的第②处刻意偏离),`created` 与 `date` 两条测试都还会通过,没有真实回归保护。

**修法**:仿照 `sortAlbumPhotos` 夹具(`a`/`b` 在 `takenAt`/`indexedAt` 上名次互换)的手法,把 `sortAlbums` 夹具的 `a`/`b` 改成在 `createdAt` 与 `dateEnd` 上名次互换:

- 改前:`a`(createdAt=2025-01-01, dateEnd=2024-05-01)、`b`(createdAt=2026-01-01, dateEnd=2026-09-01)—— 两个字段上 `b` 都最大,排序结果恒为 `['b','a','c']`,分不清两个分支读的是哪个字段。
- 改后:`a`(createdAt=2026-01-01, dateEnd=2024-01-01)、`b`(createdAt=2025-01-01, dateEnd=2026-01-01)、`c`(均为 null)。现在 `created`(按 createdAt 降序)期望 `['a','b','c']`,`date`(按 dateEnd 降序)期望 `['b','a','c']` —— 两者结果不同,能真实区分两个分支读的字段。

文件:`src/photos/util/__tests__/albumView.test.ts:37-48`。

### RED 验证(证明新夹具确实挂钩了 `date` 分支的字段选择)

临时把 `albumView.ts` 里 `date` 分支从 `ts(b, 'dateEnd')`/`ts(a, 'dateEnd')` 改成 `ts(b, 'createdAt')`/`ts(a, 'createdAt')`(模拟"误回退掉第②处刻意偏离"这个回归),跑:

```
pnpm vitest run src/photos/util/__tests__/albumView.test.ts
```

输出(节选,证明只有 `date` 测试挂红,`created` 测试仍绿,说明新夹具确实能单独探测 `date` 分支的字段回归):

```
 ❯ src/photos/util/__tests__/albumView.test.ts (18 tests | 1 failed) 20ms
     × date 按 dateEnd 降序(不是 createdAt),缺失排最后 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/photos/util/__tests__/albumView.test.ts > sortAlbums > date 按 dateEnd 降序(不是 createdAt),缺失排最后
AssertionError: expected [ 'a', 'b', 'c' ] to deeply equal [ 'b', 'a', 'c' ]

- Expected
+ Received

  [
-   "b",
    "a",
+   "b",
    "c",
  ]

 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```

失败原因符合预期:模拟的回归让 `date` 分支也读 `createdAt`,结果变成 `['a','b','c']`(与 `created` 分支相同),与期望的 `['b','a','c']` 不符 —— 证明这条测试确实在守护"`date` 读 `dateEnd` 而非 `createdAt`"这个不变量。

随后把 `albumView.ts` 的 `date` 分支还原为 `ts(b, 'dateEnd')`/`ts(a, 'dateEnd')`(`git diff src/photos/util/albumView.ts` 确认无残留改动),重跑:

```
pnpm vitest run src/photos/util/__tests__/albumView.test.ts
```

```
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 全量 + tsc

```
pnpm test
```
```
 Test Files  245 passed (245)
      Tests  1521 passed (1521)
```

```
pnpm exec vue-tsc --noEmit
```
无输出,类型检查通过。

### 改了哪些文件

- `src/photos/util/__tests__/albumView.test.ts`(仅改 `sortAlbums` 夹具的 `createdAt`/`dateEnd` 取值 + 对应两条期望值,新增一行注释说明夹具设计意图)
- `src/photos/util/albumView.ts`:**无净改动**(RED 验证期间临时改过 `date` 分支后已还原,`git diff` 为空)

### 结论

评审指出的回归检测缺口已修复:现在若 `date` 分支被误改回读 `createdAt`,`date` 测试会挂红(已通过模拟验证)。`created` 与 `date` 两个分支的字段来源(`createdAt` vs `dateEnd`)现在由夹具真实区分,不再是巧合下的同序覆盖。

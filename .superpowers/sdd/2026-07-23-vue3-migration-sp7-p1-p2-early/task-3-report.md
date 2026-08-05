# Task 3 报告:`useLightbox` 明细水合 + 收藏

## 实现内容

在 `src/photos/lightbox/useLightbox.ts`(Task 2 基础上)追加:

- **state**:`detail: Ref<Photo|null>`(未水合前 = 当前列表项本身,水合后被 `getAsset` 结果覆盖)、`ocrLines: Ref<Array<{box:number[]}>>`、`favIds: Ref<Set<string>>`。
- **getter**:`isFav = current && favIds.has(String(current.id))`。
- **actions**:
  - `hydrateDetail()`:seq 守卫水合。`const seq = ++_hydrateSeq` 与 `const id = current.value?.id` 在两次 await(`getAsset`、条件性 `getAssetOcr`)之前捕获;每次 await 后都检查 `seq !== _hydrateSeq || current.value?.id !== id` 才提前退出。仅当 `searchQuery` 非空且 `!current.isVideo` 才发 `getAssetOcr`,否则清空 `ocrLines`。
  - `reconcileFav()`:`listFavoriteIds()`(`?? []`)播种 `favIds = new Set(ids.map(String))`。
  - `toggleFav()`:乐观翻转(`new Set(...)` 重新赋值触发响应式)→ 按翻转后状态调 `favorite`/`unfavorite` → 失败时把该 id 的状态精确回滚(而非整体丢弃)。
- **openAt/goTo/prev/next 增补**:抽出 `onCurrentChanged()`(`detail = current` 立即占位 + `_hydrateSeq += 1` + `void hydrateDetail()`),四个入口在改变 `index` 后统一调用;`openAt` 额外 `void reconcileFav()`。
- `resetState()` 追加清 `detail`/`ocrLines`;`__resetForTest()` 追加清 `favIds`、`_hydrateSeq`。
- 返回对象从原来的字面量补齐新增的 3 个 state + 1 个 getter + 3 个 action。

## TDD RED → GREEN

**RED**(先追加 5 个测试断言体,mock 扩到 `getAsset`/`getAssetOcr`/`listFavoriteIds`/`favorite`/`unfavorite`):

```
pnpm vitest run src/photos/lightbox/__tests__/useLightbox.test.ts
```
```
 FAIL × openAt 后 detail 先等于当前项、getAsset 到达后合并
 FAIL × 翻页时过期 getAsset 结果被 seq 守卫丢弃...
 FAIL × searchQuery 为空不发 getAssetOcr;非空且非视频才发
 FAIL × reconcileFav 播种 favIds、isFav 反映当前项
 FAIL × toggleFav 乐观翻转并调 favorite/unfavorite;失败回滚
 Test Files  1 failed (1)
      Tests  5 failed | 10 passed (15)
```
(10 个 Task 2 既有测试保持绿,证明未破坏原行为;5 个新测试因 `lb.detail`/`lb.isFav` 等字段不存在而报 `Cannot read properties of undefined`。)

**实现后 GREEN**:

```
pnpm vitest run src/photos/lightbox/__tests__/useLightbox.test.ts
```
```
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

**全量测试**:
```
pnpm test
 Test Files  232 passed (232)
      Tests  1364 passed (1364)
```

**类型检查**:
```
pnpm exec vue-tsc --noEmit
(无输出,clean)
```

## seq 守卫如何被验证

### 既有测试:`翻页时过期 getAsset 结果被 seq 守卫丢弃`

用两个手动可控 Promise(`firstPromise`/`secondPromise`)分别接管 `getAsset` 的第一次(openAt→'a',慢/后解析)与第二次调用(next→'b',快/先解析)。

1. `openAt('a')` 触发 `onCurrentChanged` → `_hydrateSeq` 递增两次(外层 +1、`hydrateDetail` 内 `++_hydrateSeq` 再 +1)→ `hydrateDetail` 内捕获 `seq=2, id='a'`,挂起在 `await firstPromise`。
2. 紧接 `next()` → 同样流程,捕获 `seq=4, id='b'`,挂起在 `await secondPromise`。
3. 先 `resolveSecond({id:'b',make:'Sony'})` → 该次 `hydrateDetail` 恢复,`seq(4)===_hydrateSeq(4)` 且 `current.id==='b'` → 写入 `detail`(camera='Sony')。
4. 再 `resolveFirst({id:'a',make:'Nikon'})` → 该次 `hydrateDetail` 恢复,`seq(2)!==_hydrateSeq(4)` → **提前 return,不写 `detail`**。
5. 断言 `detail.value.id==='b'` 且 `camera==='Sony'` 全程未被旧结果覆盖 —— 验证了"先解析的新请求生效、后解析的旧请求被丢弃"的翻页快于网络场景。

### SP7-P2 Task 3 补充测试:seq 机制同 id 重访隔离

**新增测试** `seq 守卫同 id 重访竞态覆盖(隔离 seq 机制)`:以上既有测试只能验证"两个不同 id 的翻页场景",其中 id 检查(`current.value?.id !== id`)就能丢弃旧结果;新测试隔离 seq 机制本身,验证同一 id 的重访场景(即 id 检查无法区别):

场景:`openAt('a') [call 0, pending] → next('b') [call 1] → prev('a') [call 2, same id!] → 先解析 call 2(新) 再 call 0(旧)`

1. 三个可控 Promise 阵列(`deferreds[0/1/2]`)分别接管三次 `getAsset` 调用。
2. openAt('a') → call 0 开始 fetch 'a'(保持 pending)。
3. next() → call 1 开始 fetch 'b'。
4. prev() → call 2 开始 fetch 'a'(第二次同 id!)。
5. 先 `resolve(call 2, {id:'a', status:'NEW'})` → detail 应为'NEW'。
6. 再 `resolve(call 0, {id:'a', status:'STALE'})` → detail 仍应为'NEW'(被 seq 守卫丢弃)。
7. **RED 验证**:临时移除 `seq !== _hydrateSeq ||` 条件,测试即变红(status 被 STALE 覆盖),证明隔离机制有效。

**代码 + 输出**:

```bash
$ pnpm vitest run src/photos/lightbox/__tests__/useLightbox.test.ts
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

RED check(移除 seq 守卫):
```
AssertionError: expected 'STALE' to be 'NEW'
```

恢复 seq 守卫后 GREEN。提交:`36cdb28`(`test(photos): useLightbox seq 守卫同 id 重访竞态覆盖`)。

## 变更文件

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/useLightbox.ts`
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/__tests__/useLightbox.test.ts`

## 自查

- 未改动 Task 2 原有 5 个测试的断言,10 个全部保持通过。
- `hydrateDetail`/`reconcileFav` 的失败分支都吞掉异常(不抛出到调用方,`void hydrateDetail()`/`void reconcileFav()` 均为 fire-and-forget),避免未捕获 rejection。
- `toggleFav` 失败回滚只精确翻转该 id 的状态(而非整体替换回旧 Set),避免与并发的 `reconcileFav`/其他翻页触发的水合竞争时互相打架。
- `getAsset` 与 `getAssetOcr` 两段各自独立做 seq/id 校验(而不是共享一次检查),因为 OCR 请求依赖同一批次但可能比 asset 请求慢,需要独立判定是否仍是当前项。
- `_hydrateSeq` 在 `onCurrentChanged` 外层 +1、`hydrateDetail` 内部又 `++`,存在"双重递增"但不影响正确性(见上文"seq 守卫如何验证"分析)——只是保证无论从哪个入口调用 `hydrateDetail`(外部触发或未来直接调用),内部捕获的 seq 始终是当时最新值。

## 关注点(供后续任务/评审参考)

- `hydrateDetail` 里 `getAsset` 返回的资产本身若与预期 id 不一致(理论上后端不应发生,但极端情况下 mock/后端返回错配 id 时),当前实现只校验"当前列表项 id 未变",不校验"拉到的资产 id 与请求 id 一致"——测试里刻意验证了 seq/current 变化的丢弃逻辑,未新增校验拉取结果本身 id 的防御(brief 未要求,超出范围未做,记录于此以防日后误判为遗漏)。
- `favIds` 目前是模块级单例、跨会话不清零(仅 `__resetForTest` 和每次 `openAt→reconcileFav` 重新播种时被覆盖),`close()` 不清 `favIds`——与 brief 描述一致(`reconcileFav` 只在 `openAt` 调用),行为符合预期但值得在 UI 消费方留意"未 openAt 前 favIds 可能是上次会话的残留"。

---
（注:本文件曾存有另一个历史任务(Pinia `photos-timeline` store)的旧报告内容,已被本任务的报告整体覆盖——若需要那份旧报告,请从 git 历史或该任务对应的提交记录中查找。）

# Task 2 报告:store 增量(D8 resetSpotName / createPlaceAlbum / 封面候选 seq 守卫)+ usePlaceAssets

## 做了什么

1. **`src/photos/stores/places.ts`**
   - 把原先内联在 `PlaceDetail` 里的三个匿名数组元素类型提成具名导出:`PlaceSpot`、
     `PlaceInsight`、`PlaceVisit`,新增 `CreatedAlbum`。`PlaceDetail.spots/insights/visits`
     改用这三个具名类型,字段逐字不变。
   - 新增 `albumBusy: Ref<boolean>`(独立于既有 `coverBusy`/`spotBusy`)。
   - 新增 `resetSpotName(id, spotKey)`:复用 `spotBusy`;成功后 `await loadDetail(id)`
     重拉详情(不本地回写);失败 `console.error` + rethrow;`finally` 复位。函数上方
     注释解释了它与紧邻的 `setSpotName`(本地回写、不重拉)刻意不同的理由。
   - 新增 `createPlaceAlbum(id, opts)`:`albumBusy` 忙时 `Promise.reject(new
     Error('albumBusy'))`(不是本仓惯例的静默 return,因为本函数有返回值);成功后
     `toCreatedAlbum()` 把 `albumId`/`count` 归一成 `string`/`number`;失败 rethrow。
     `resolvePlaceKey(id) as string` 沿用既有的故意类型断言写法(未换成 `String()`)。
   - `fetchCoverCandidates` 补了独立的 `coverSeq` 竞态守卫(与 `loadDetail` 的 `seq`
     互不相关,两把锁分开维护),成功/失败两条路径都判断 `mine !== coverSeq` 后丢弃。
   - `__resetForTest` 里新增 `albumBusy.value = false`,**不重置 `coverSeq`**(注释
     解释理由,与既有 `seq` 的注释一致)。
   - 导出列表追加 `albumBusy`、`resetSpotName`、`createPlaceAlbum`。

2. **`src/photos/util/placesMap.ts`**:新增 `formatSpotCoords(lat, lon)`(偏离登记 16,
   用户 2026-07-31 pre-flight 裁定新加进本任务):按符号选方向字母(修正 Vue2
   `PhotosPlacesView.vue:1129` 写死 `° N`/`° E` 的南/西半球方向错),格式与 Vue2 逐字
   一致(三位小数、`° `、` · ` 分隔),`0` 归 N/E,非有限值返回空串。函数上方注释写明
   这是 bug 修正,以及方向字母刻意不进 i18n 的理由。

3. **新建 `src/photos/composables/usePlaceAssets.ts`**:地点详情面板「照片」标签页的
   一次性资产加载,照 Vue2 `PhotosTimeline.vue:819-841 (_loadPlaceAssets)`:
   - `load(placeKey, spotKey, lat, lon)` 内部用 `seq` 竞态守卫;`limit` 硬编码 500
     (照搬 Vue2 `:823`,不做分页,已登记);响应形状兼容 `{assets:[...]}` 与裸数组
     两种;`assetToPhoto`/`groupPhotosByMonth` 直接复用,未重写。
   - 失败清空(`photos=[]`、`failed=true`),与 store 主数据 `fetchPlaces` 的
     「失败保留」口径刻意不同——注释解释了这是一次性查询结果,留着旧数据更误导用户。

4. 三个测试文件按 Step 1-4 的 TDD 流程走完,新增/追加共 26 条用例(见下方"删码验证"
   一节里发现的额外 1 条)。

## 回源核对结果(动手前核对 brief 给的行号/签名)

- **`.sp7/NimoOS-Service/src/photos.ts` 的 `createPlaceAlbum`/`resetSpotName`/
  `listAssetsByPlace` 签名**(brief 引用的 `:258-292`,实际读到的准确行号是
  258/282/286/290,brief 给的区间基本准确,无出入):`createPlaceAlbum(key, {name,
  from='', to=''})`、`resetSpotName(key, spotKey)`、`listAssetsByPlace(placeKey,
  spotKey='', limit=500, lat=null, lon=null)`——与本任务实现逐一核对一致。
- **Vue2 `PhotosTimeline.vue:736-756` (`onPlacesSaveAlbum`)**:确认 `from: payload.from
  || ''`、`to: payload.to || ''`——本任务用 `opts.from ?? ''`(`??` 而非 `||`)是刻意的,
  因为 `opts.from`/`opts.to` 类型是 `string | undefined`,不存在空串以外需要过滤的
  falsy 值,`??` 语义更准确且不改变行为。
- **Vue2 `PhotosTimeline.vue:819-841` (`_loadPlaceAssets`)**:行号与 brief 给的一致,
  `limit` 硬编码 500 位置确认在 `:823`(`photosService.listAssetsByPlace(placeKey,
  spotKey, 500, ...)`),失败清空确认在 `:836-838`。
- **Vue2 `PhotosPlacesView.vue:1129`**:确认逐字为
  `` {{ spotDialog.spot.lat.toFixed(3) }}° N · {{ spotDialog.spot.lon.toFixed(3) }}° E ``,
  brief 描述的"写死 ° N/° E"属实。
- **`resolvePlaceKey(id) as string` 断言写法**(brief 强调的坑):`places.ts:157-163`
  的既有注释核对无误,`resetSpotName`/`createPlaceAlbum` 两处新代码都沿用同一写法,
  未换成 `String(...)`。

未发现 brief 给出的行号/签名与源码有出入之处——本任务无需登记偏差。

## 删码验证(8 项,逐个单独验证后用 Edit 手工切回)

| # | 删的内容 | 结果 |
|---|---|---|
| ① | `resetSpotName` 里的 `await loadDetail(id)` | 红(重拉详情用例失败,`getPlace` 只调 1 次) |
| ② | `resetSpotName` 的 `spotBusy` 短路 | 红(共用锁用例失败,`resetSpotNameApi` 被调) |
| ③ | `createPlaceAlbum` 的 `String(r.albumId ?? '')` 换成 `r.albumId` | 红(归一用例失败,`albumId` 变成数字 `12`) |
| ④ | `fetchCoverCandidates` 成功路径的 `if (mine !== coverSeq) return` | 红(竞态用例失败,旧结果 `a1` 覆盖了新结果 `b1`) |
| ⑤ | 同上 catch 路径 | 红(失败路径竞态用例失败,过期 catch 清空了新结果) |
| ⑥ | `usePlaceAssets` 里 `raw.assets ?? raw` 改成只 `raw.assets` | 红(裸数组用例失败,`photos.length` 变 0) |
| ⑦ | `finally` 的 `mine === seq` 守卫 | 见下方说明 |
| ⑧ | `formatSpotCoords` 的方向字母恒 `'N'`/恒 `'E'` | 红(南半球、西半球用例各自失败) |

**关于 ⑦ 的一处补充**:brief 给的原始竞态测试(先发 A 慢、后发 B 快、B 先 resolve,
只断言最终 `loading` 为 `false`)在实测中**不会**因为删掉 `finally` 守卫而变红——
因为 B 完成时已经把 `loading` 置 `false`,A 之后过期 resolve 时哪怕无条件执行
`loading.value = false` 也只是把"已经是 false"的值再写一次 false,状态不变,测试
看不出差异(已实测确认,不是推测)。真正会被这处守卫拦住的场景是**反过来**的时序:
旧请求(`mine=1`)在新请求(`mine=2`)仍在途、尚未 resolve 时先行 resolve/return——
此时若无守卫,旧请求的 `finally` 会把仍然合法为 `true` 的 `loading` 错误地拨回
`false`。我在 `usePlaceAssets.test.ts` 里补了一条新用例专门钉住这个时序(A 先
resolve,B 用一个永不 settle 的 Promise 模拟"仍在途",断言此时 `loading` 仍为
`true`),删掉守卫后此用例确认变红,恢复后变绿。**这条用例是我在删码验证过程中
新增的,不在 brief 给的用例清单里,但补齐了 brief 用例覆盖不到的真实回归窗口**,
已计入最终测试文件。

## 与 brief 有出入之处

- **Step 5 的 `git add` 文件清单遗漏了 `placesMap.ts`/`placesMap.test.ts`**:brief 顶部
  "Files" 一节明确把这两个文件列为本任务的 Modify 目标(`formatSpotCoords` 的落点),
  但 Step 5 给出的 `git add` 命令只列了 4 个文件。按"Files"一节与"Interfaces"一节的
  产出物为准,commit 里补上了这两个文件,commit message 也补了一行说明,未逐字照抄
  brief 给的 message(其余三行逐字照抄)。

## 测试结果

- `pnpm exec vitest run` 全量:**282 文件 / 2711 例全绿**(基线 281/2685,净增 26:
  store 侧 10 条 + placesMap 侧 6 条 + usePlaceAssets 侧 10 条,其中 1 条是删码验证
  过程中补的回归用例)。
- `pnpm exec vue-tsc --noEmit`:0 错误。
- 全量跑动中出现过一次 `PhotosPersonDetail.test.ts` 路由参数用例超时(5000ms),单独
  重跑该文件 72/72 全绿,判定为满载并发下的资源争抢型 flaky(与本任务代码无关,未
  改动过 `PhotosPersonDetail.vue`/`favorites.ts`),复跑全量后确认 282/2711 全绿。

## 后续消费方需要知道的

- `PlaceSpot`/`PlaceInsight`/`PlaceVisit`/`CreatedAlbum` 已从 `src/photos/stores/places.ts`
  具名导出,T3-T6 组件 props 直接 `import type` 即可,不要再手写一份。
- `usePlaceAssets()` 每次调用返回一份独立状态(不是单例 store),视图层每次进入
  「照片」标签页应各自 `usePlaceAssets()` 一次并持有引用,不要跨组件共享同一个实例。

### Task 2: store 增量(`resetSpotName` / `createPlaceAlbum` / 封面候选 seq 守卫)+ `usePlaceAssets`

**Files:**
- Modify: `src/photos/stores/places.ts`
- Modify: `src/photos/stores/__tests__/places.test.ts`(追加用例,不重写既有 44 条)
- Modify: `src/photos/util/placesMap.ts` + `src/photos/util/__tests__/placesMap.test.ts`(加 `formatSpotCoords`,偏离登记 16)
- Create: `src/photos/composables/usePlaceAssets.ts`
- Create: `src/photos/composables/__tests__/usePlaceAssets.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:495-560`、`PhotosTimeline.vue:736-760`(createPlaceAlbum 参数)、`:820-841`(_loadPlaceAssets)、`.sp7/NimoOS-Service/src/photos.ts:258-292`

**Interfaces:**
- Consumes: `service.photos.{resetSpotName,createPlaceAlbum,listAssetsByPlace,placeCoverCandidates}`;`assetToPhoto`、`groupPhotosByMonth`、`type Photo`、`type Month`
- Produces:
  ```ts
  // src/photos/stores/places.ts —— 把原先内联在 PlaceDetail 里的三个匿名对象类型提成具名导出
  // (单点定义:T3-T6 四个组件的 props 都要用它们;P5-T12 的 PersonPlace 两处手写重复是当期
  // deferred,本期不重犯)。
  export interface PlaceSpot { key: string; name: string; lon: number; lat: number; count: number; thumb: string }
  export interface PlaceInsight { ico: string; key: string; params: Record<string, unknown> }
  export interface PlaceVisit {
    when: string; from: string; to: string; current: boolean
    days: number; photos: number; faces: string[]; spots: number; thumbs: string[]
  }
  export interface PlaceDetail { /* 既有字段不变,三个数组换成上面的具名类型 */ }
  export interface CreatedAlbum { albumId: string; name: string; count: number }

  // 新增 action / state
  const albumBusy: Ref<boolean>
  async function resetSpotName(id: string, spotKey: string): Promise<void>       // 复用 spotBusy
  async function createPlaceAlbum(
    id: string, opts: { name: string, from?: string, to?: string },
  ): Promise<CreatedAlbum>                                                       // 失败 rethrow

  // src/photos/composables/usePlaceAssets.ts
  export interface UsePlaceAssetsReturn {
    photos: Ref<Photo[]>
    months: ComputedRef<Month[]>
    loading: Ref<boolean>
    loaded: Ref<boolean>
    failed: Ref<boolean>
    load: (placeKey: string, spotKey: string, lat: number | null, lon: number | null) => Promise<void>
  }
  export function usePlaceAssets(): UsePlaceAssetsReturn

  // src/photos/util/placesMap.ts —— 偏离登记 16(用户 pre-flight 裁定)
  /** spot 坐标串。负值取绝对值 + 换方向字母:lat<0 → 'S',lon<0 → 'W'。三位小数。 */
  export function formatSpotCoords(lat: number, lon: number): string
  ```

**规格:**

1. **`resetSpotName`(D8)**:`spotBusy` 入口短路 → `resolvePlaceKey(id) as string` → `await service.photos.resetSpotName(key, spotKey)` → **成功后不做本地名字回写**(后端自动名前端算不出来)而是 `await loadDetail(id)` 重拉详情(**与 `setSpotName` 刻意不同**:改名时新名字前端已知,重拉是多余的一次请求;恢复默认时新名字只有后端知道,必须重拉)。`catch` → `console.error` + rethrow;`finally` 复位。**这条"两个 action 策略不同"的理由必须写进代码注释**,否则后人会以为是不一致。
2. **`createPlaceAlbum`**:`albumBusy` 入口短路(重入直接 `throw new Error('busy')`?**不**——照本仓既定「入口短路静默返回」会让调用方拿不到相册对象。这里改成:忙时**直接返回 `Promise.reject(new Error('albumBusy'))`**,调用方 catch 后不弹 toast(见 T8 的 `isBusyError` 判据),这样既不并发也不吞掉真实错误。**这一处偏离本仓「静默 return」惯例的理由要写注释。**)→ `service.photos.createPlaceAlbum(key, { name, from: opts.from ?? '', to: opts.to ?? '' })` → 归一成 `CreatedAlbum`:`albumId: String(r.albumId ?? '')`、`name: String(r.name ?? opts.name)`、`count: Number(r.count ?? 0)`。
3. **`fetchCoverCandidates` 补 seq 守卫**(偏离 5):模块内 `let coverSeq = 0`,`const mine = ++coverSeq`,成功/失败两条路径都 `if (mine !== coverSeq) return` 后才写 `coverCandidates`。**`__resetForTest` 里不重置 `coverSeq`**(理由同既有 `seq` 的注释:重置会造成别名冲突)。
4. **`formatSpotCoords`(偏离 16)**:`` `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? 'W' : 'E'}` ``。**格式(三位小数、`° `、` · ` 分隔)与 Vue2 `:1129` 逐字一致,只有方向字母按符号变**;`0` 归 `N`/`E`(赤道/本初子午线,与「非负即 N/E」一致);非有限值(`NaN`/`Infinity`)返回空串(调用方据此不渲染坐标行)。函数上方注释写明这是 Vue2 缺陷的修正 + 方向字母刻意不进 i18n 的理由。
5. **`usePlaceAssets`**:`load()` 内 `const mine = ++seq`;`loading = true`;`await service.photos.listAssetsByPlace(placeKey, spotKey, 500, lat, lon)`;取 `raw.assets ?? raw ?? []`(两种形状都吃,数组守卫);`photos = list.map((a) => assetToPhoto(a))`;`loaded = true`、`failed = false`;`catch` → `console.error('[photos-places] loadPlaceAssets', e)` + `photos = []` + `failed = true`(**这里照 Vue2 `:836-838` 的"失败清空"**,与 store 主数据的"失败保留"口径不同,理由写注释:这是一次性查询结果,留着上一次的会误导);`finally` 只在 `mine === seq` 时复位 `loading`。`months = computed(() => groupPhotosByMonth(photos.value))`。**`limit` 硬编码 500 照搬 Vue2(`:823`),不做分页**(登记)。

- [ ] **Step 1: 写失败测试**

store 侧追加(每条一个 `it`):
- `resetSpotName` 调 `service.photos.resetSpotName` 且 **key 传原始数字**(fixture 里 `place.key = 7`,断言 `toHaveBeenCalledWith(7, 'spot-1')`)。
- `resetSpotName` 成功后**重拉了详情**(`getPlace` 被调用第二次),且 `detail.spots` 里那一项的 name 变成后端返回的新值。
- `resetSpotName` 与 `setSpotName` **共用 `spotBusy`**:`setSpotName` 在途时调 `resetSpotName` 直接返回、`service.photos.resetSpotName` 零调用。
- `resetSpotName` 失败:`console.error` 被调、异常向上抛、`spotBusy` 复位为 false。
- `createPlaceAlbum` 传参:`{ name: '杭州', from: '', to: '' }`(不传 from/to 时补空串,照 Vue2 `:738-740`)。
- `createPlaceAlbum` 返回归一:后端返 `{ albumId: 12, name: '杭州', count: '30' }` → 得 `{ albumId: '12', name: '杭州', count: 30 }`(id 归字符串、count 归数字)。
- `createPlaceAlbum` 重入:第一次在途时第二次**被 reject 且错误 message 为 `albumBusy`**,`service.photos.createPlaceAlbum` 只被调一次。
- `createPlaceAlbum` 失败 rethrow + `albumBusy` 复位。
- **`fetchCoverCandidates` 的 seq 守卫**:连发两次(第一次的 promise 后 resolve),断言最终 `coverCandidates.items` 是**第二次**的结果;再验失败路径同样被守卫(旧请求的 catch 不清空新结果)。

`formatSpotCoords` 侧(四象限各一例,**期望值先手算**):
- `(30.2741, 120.1551)` → `30.274° N · 120.155° E`
- `(-33.8688, 151.2093)` → `33.869° S · 151.209° E`(**注意 `.8688` 四舍五入到 `.869`**)
- `(40.7128, -74.006)` → `40.713° N · 74.006° W`
- `(-22.9068, -43.1729)` → `22.907° S · 43.173° W`
- `(0, 0)` → `0.000° N · 0.000° E`(零归 N/E)
- `(NaN, 10)` / `(10, Infinity)` → 空串

`usePlaceAssets` 侧:
- `{assets: [...]}` 与**裸数组**两种响应都能吃出同样的 `photos.length`。
- `null` / `{}` 响应 → `photos` 为空数组、不抛。
- `photos` 是 `assetToPhoto` 的产物(断言某项的 `isVideo` 由 `mimeType: 'video/mp4'` 推出、`takenAt` 被保留)。
- `months` 按月倒序分组(两个月份 fixture,断言顺序与每组条数)。
- `spotKey` 为空串时**不传** `spot_key`(断言 `listAssetsByPlace` 收到的第二参是 `''`,由共享包自己决定不带 —— 这里只钉「原样透传」);`spotKey` 非空且 lat/lon 非 null 时四个参数都透传。
- 竞态:先发 A(慢)后发 B(快),B 先 resolve → 最终 `photos` 是 B 的;A 后 resolve 不覆盖;`loading` 最终为 false。
- 失败:`photos` 清空、`failed` 为 true、`console.error` 被调。
- `limit` 恒 500。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/places.test.ts src/photos/composables/__tests__/usePlaceAssets.test.ts`

- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + 逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单(一次只删一处):①`resetSpotName` 里的 `await loadDetail(id)` 删掉 → 「重拉详情」红;②`resetSpotName` 的 `spotBusy` 短路删掉 → 共用锁用例红;③`createPlaceAlbum` 的 `String(r.albumId ?? '')` 换成 `r.albumId` → 归一用例红;④`fetchCoverCandidates` 的 `if (mine !== coverSeq) return`(成功路径)删掉 → 竞态用例红;⑤同上删 catch 路径那一处 → 失败路径竞态用例红;⑥`usePlaceAssets` 里 `raw.assets ?? raw` 改成只 `raw.assets` → 裸数组用例红;⑦`finally` 的 `mine === seq` 守卫删掉 → `loading` 用例红;⑧`formatSpotCoords` 的 `lat < 0 ? 'S' : 'N'` 改回恒 `'N'` → 南半球用例红(同理 `'W'` 一档单独删一次)。

- [ ] **Step 5: Commit**

```bash
git add src/photos/stores/places.ts src/photos/stores/__tests__/places.test.ts src/photos/composables/usePlaceAssets.ts src/photos/composables/__tests__/usePlaceAssets.test.ts
git commit -m "feat(photos): P6b-T2 store 增量(D8 resetSpotName / createPlaceAlbum / 封面候选 seq 守卫)+ usePlaceAssets

- PlaceSpot/PlaceInsight/PlaceVisit/CreatedAlbum 提成具名导出类型(四个组件共用,单点定义)
- resetSpotName 成功后重拉详情(后端自动名前端算不出),与 setSpotName 的本地回写刻意不同
- fetchCoverCandidates 补 seq 守卫(偏离登记 5:Vue2 逐键请求无守卫,后发先回会盖旧结果)"
```

---


# Task 5: 地点方法实现 — 完成报告

## 状态
✅ **COMPLETED**

## 实现概览

共实现9个地点(places)域方法，覆盖列表、详情、搜索、封面管理、spot 命名、相册创建。

### 实现方法
1. `listPlaces(params={})` — 地点列表(支持查询参数)
2. `listAssetsByPlace(placeKey, spotKey='', limit=500, lat=null, lon=null)` — 地点内资产(条件参数)
3. `getPlace(key)` — 地点详情
4. `placeCoverCandidates(key, {tab='recent', q='', page=0})` — 封面候选
5. `setPlaceCover(key, assetId)` — 设置地点封面
6. `resetPlaceCover(key)` — 重置地点封面
7. `setSpotName(key, spotKey, name)` — 设置 spot 名称
8. `resetSpotName(key, spotKey)` — 重置 spot 名称(DELETE with data config)
9. `createPlaceAlbum(key, {name, from='', to=''})` — 创建地点相册(默认 from/to 空串)

## TDD 流程

### RED 阶段 ✓
- 创建 `src/photos.places.test.ts`，包含4个测试用例
- 运行 `pnpm vitest run src/photos.places.test.ts` → **4 FAILED**
  - 所有方法均未实现，TypeError: 方法不是函数

### GREEN 阶段 ✓
- 在 `src/photos.ts` 中添加9个方法(追加于 personFaceThumbnailUrl 后)
- 运行 `pnpm vitest run src/photos.places.test.ts` → **4 PASSED**

### 验证阶段 ✓
- 全量测试: `pnpm test` → **26 PASSED, 149 PASSED**
- 构建验证: `pnpm build` → TypeScript 编译通过，无错误

## 关键实现细节

### 条件参数逻辑 (listAssetsByPlace)
```ts
const params = { place_key: placeKey, limit }
if (spotKey) params.spot_key = spotKey
if (spotKey && lat != null && lon != null) { 
  params.spot_lat = lat
  params.spot_lon = lon 
}
```
- 仅当 spotKey 非空时，才添加 spot_key 参数
- 仅当 spotKey 非空 **且** lat/lon 都不为 null 时，才添加坐标参数
- 对齐 Vue2 注释：质心钉住精确 spot 簇(避免网格 key 撞车)

### DELETE 请求体 (resetSpotName)
```ts
await http.delete(`/photos/places/${key}/spot-name`, { data: { spotKey } })
```
- 符合 axios delete API 约定：第二参数配置对象，data 字段进请求体
- 后端要求 spotKey 在请求体中传递

### 默认值处理 (createPlaceAlbum)
```ts
{ name, from = '', to = '' }
```
- from/to 默认为空串(不是 undefined)
- 预期行为：即使用户未指定，也会发送 `from: '', to: ''`

### 响应处理
- 列表端点(listPlaces) 使用 `loose<T>()` 兼容裸数组或标准信封
- 其他端点使用 `unwrap<T>()` 解包标准信封

## 测试覆盖

### 测试 1: listAssetsByPlace 条件参数
- ✅ 无 spotKey: 仅 place_key + limit
- ✅ 有 spotKey + 坐标: place_key + limit + spot_key + spot_lat + spot_lon
- ✅ 有 spotKey 无坐标: 仅 place_key + limit(坐标被条件过滤)

### 测试 2: 详情/封面候选/封面设复位
- ✅ listPlaces 发 GET /photos/places with params
- ✅ getPlace 发 GET /photos/places/{key}
- ✅ placeCoverCandidates 发 GET /photos/places/{key}/cover-candidates with params
- ✅ setPlaceCover 发 PUT with body
- ✅ resetPlaceCover 发 DELETE

### 测试 3: Spot 命名
- ✅ setSpotName 发 PUT /photos/places/{key}/spot-name with { spotKey, name }
- ✅ resetSpotName 发 DELETE with data config 包含 spotKey

### 测试 4: createPlaceAlbum 默认值
- ✅ 仅传 name，from/to 自动补齐为空串

## 文件变更

| 文件 | 变更 | 行数 |
|------|------|------|
| `src/photos.ts` | 追加 9 个方法 | +41 行 |
| `src/photos.places.test.ts` | 新建测试文件 | 59 行 |

## 提交信息

```
SHA: e6e1ff0
Subject: photos 域:地点全套(spot 簇质心/封面/命名)
```

## 自审检查清单

- ✅ 方法签名与 brief 完全匹配
- ✅ 条件参数逻辑精确(spotKey 与坐标成对)
- ✅ DELETE 请求体通过 { data } 配置传递
- ✅ createPlaceAlbum 默认 from/to 为空串
- ✅ 所有返回值用 unwrap/loose 解包
- ✅ 没有多余实现，保持最小化
- ✅ 测试覆盖所有主要分支
- ✅ 全量测试 + 构建均通过
- ✅ 代码格式与现有 photos.ts 一致

## 顾虑

**无** — 所有测试通过，构建成功，条件参数逻辑与 brief 完全一致。

---

Report generated: 2026-07-23

# Task 2 Report: appstore store 加 invalidate()

## Summary
Successfully implemented `invalidate()` method in the appstore Pinia store following TDD methodology. The method clears the categories cache and resets the catalogLoaded flag, enabling Task 3's sources store to trigger re-fetching of app categories when store sources are added/removed.

## Implementation Details

### Files Changed
- **`src/apps/stores/appstore.ts`**: Added `invalidate()` function and exported it from the return object
- **`src/apps/stores/appstore.test.ts`**: Added new test case

### Changes Made

#### 1. Test-Driven Development: RED → GREEN

**RED Phase - Added Failing Test** (appstore.test.ts, line 124-138):
```typescript
it('invalidate 清 categories 缓存:下次 loadCatalog 重拉分类', async () => {
  const s = useAppstoreStore()
  svc.categories.mockResolvedValue([{ name: 'Media', count: 2 }])
  svc.listApps.mockResolvedValue({ installed: [], list: {} })

  await s.loadCatalog()
  await s.loadCatalog()
  expect(svc.categories).toHaveBeenCalledTimes(1) // length 守卫命中

  s.invalidate()
  expect(s.catalogLoaded).toBe(false)
  await s.loadCatalog()
  expect(svc.categories).toHaveBeenCalledTimes(2) // 缓存已失效,重拉
})
```

**Test Failure Output:**
```
TypeError: s.invalidate is not a function
```

**GREEN Phase - Implemented invalidate()** (appstore.ts, line 93-98):
```typescript
/** 商店源增删后目录已变:清 categories 缓存(loadCatalog 有 length 守卫,不清不会重拉)
 *  并复位 catalogLoaded,下次进商店页整体重拉。featured 每次 mounted 都重拉,无缓存守卫,不用清。 */
function invalidate() {
  categories.value = []
  catalogLoaded.value = false
}
```

Updated return object to export the new function (appstore.ts, line 105):
```typescript
loadCatalog, retry, loadFeatured, loadDetail, invalidate, isInstalled,
```

### Test Results

#### Before Implementation
```
Test Files  1 failed (1)
Tests  1 failed | 7 passed (8)
FAIL: TypeError: s.invalidate is not a function
```

#### After Implementation - appstore.test.ts only
```
Test Files  1 passed (1)
Tests  8 passed (8)  ✓
```

#### Full Suite
```
Test Files  212 passed (212)
Tests  1175 passed (1175)
Duration  65.60s
```

### Git Commit
```
commit 5bde9c8
Author: Claude Code

    P7: appstore store 加 invalidate(),源增删后目录缓存失效
    
    src/apps/stores/appstore.ts: added invalidate() function
    src/apps/stores/appstore.test.ts: added test case
```

## Self-Review

### ✓ Correctness
- **Cache invalidation logic**: Correctly clears `categories.value` (empty array) and resets `catalogLoaded.value` to false
- **Respects existing guards**: The implementation respects the length guard in `loadCatalog()` line 38—when `categories.value.length = 0` after invalidate, the next loadCatalog will fetch fresh categories instead of skipping
- **Test semantics**: Test verifies both the state change (catalogLoaded → false) and the behavioral consequence (categories API called again on next loadCatalog)
- **Mock name adaptation**: Adapted test to use existing svc mocks (`svc.categories`, `svc.listApps`) rather than creating new mocks, matching project conventions

### ✓ Test Quality
- **Assertion coverage**: Validates the critical cache-busting behavior (from 1 call to 2 calls to categories API)
- **No side effects on other operations**: featured is correctly NOT cleared (per comment: "featured 每次 mounted 都重拉,无缓存守卫,不用清")
- **Aligns with brief**: Test faithfully reproduces the brief's assertion semantics while using the actual mock structure in appstore.test.ts

### ✓ Integration Readiness
- **Task 3 consumed**: This export is consumed by Task 3's sources store, which will call `appstore.invalidate()` after source registration/unregistration
- **No breaking changes**: Method is pure addition; existing exports and behavior untouched
- **Pinia patterns**: Function follows Pinia composable setup pattern (plain function, exported in return object)

### ✓ Code Quality
- **Documentation**: Function includes explicit comment explaining why categories are cleared (length guard in loadCatalog) and why featured is left alone
- **Naming**: Method name is clear and idiomatic (invalidate ~= cache invalidation)
- **TypeScript**: No type errors; return object properly updated

## Concerns

**None.** Implementation is minimal, well-tested, and ready for Task 3 integration.

## Deliverables

- **Commit**: `5bde9c8` — "P7: appstore store 加 invalidate(),源增删后目录缓存失效"
- **Test summary**: 8/8 tests passing in appstore.test.ts; 1175/1175 tests passing across full suite
- **Files modified**:
  - `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/stores/appstore.ts` (+10 lines)
  - `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/stores/appstore.test.ts` (+15 lines)

---

## Fix Report: 终审阻断项修复 — invalidate() 在途请求竞态 (2026-07-22)

### 阻断项回顾
P7 whole-branch 终审发现:上面 GREEN 阶段实现的 `invalidate()` 只清了 `categories`/`catalogLoaded`,没有孤儿化在途的 `loadCatalog()`。时序:`loadCatalog()` 在飞 → `invalidate()` 执行 → 在飞响应落地时 `mySeq === seq` 仍然成立(因为 `invalidate()` 没碰 `seq`),于是照常写入 invalidate 之前的陈旧 `categories`/`catalogLoaded = true`,把刚做的失效静默撤销。`StoreAppDetailPage` 靠 `!catalogLoaded` 门控重拉、`categories` 的 length 守卫又让这份陈旧 chip 缓存永久生效——两处都会因此吃闭眼亏。

### 修复
`src/apps/stores/appstore.ts` 的 `invalidate()` 补三行:
```ts
function invalidate() {
  seq++
  loading.value = false
  categories.value = []
  catalogLoaded.value = false
}
```
`seq++` 是关键一击:让在途请求的 `mySeq` 立刻与新 `seq` 错位,`loadCatalog()` 里的三处 `if (mySeq !== seq) return` 守卫全部命中,响应落地时不会写 `categories`/`list`/`installed`/`catalogLoaded`,`finally` 里也不会翻转 `loading`。`invalidate()` 因此自己顺手把 `loading` 复位掉(被孤儿化的请求不会再翻它)。`list`/`installed` 有意不清——被孤儿化的响应不会写入它们,它们保持 invalidate 之前的值,这是设计使然不是遗漏。

### 测试
`appstore.test.ts` 新增一条竞态测试(仿照文件里已有的乱序响应守卫测试写法):先跑一次 `loadCatalog()` 打底,记下 `list`/`installed` 的引用;再发起一次 `loadCatalog('Media', ALL)` 但让 `listApps` 返回一个手控 Promise 悬着；此时调用 `invalidate()`；最后 resolve 悬着的 Promise 并 `await` 完请求。断言:`catalogLoaded` 仍为 `false`、`categories` 仍为 `[]`、`loading` 为 `false`、`list`/`installed` 仍是 invalidate 之前记录的同一引用(未被陈旧响应写入,也未被 invalidate 本身动过)。

### 测试结果
```
pnpm exec vitest run src/apps/stores/appstore.test.ts   → 1 file, 9 tests passed
pnpm exec vitest run src/apps/stores/sources.test.ts    → 1 file, 8 tests passed
pnpm exec vue-tsc --noEmit                              → clean, no output
pnpm test (full suite)                                  → 214 files, 1190 tests passed
```

### Git Commit
`P7: invalidate() 孤儿化在途 loadCatalog(终审修复)+ 竞态测试`

### Concerns
None. Fix is minimal (3 lines in invalidate() + 1 test), no other behavior touched, no CasaOS/NimoOS-Service files involved.

# Task 12 report: 预览失败允许自愈

## 改了什么

- `src/files/composables/useDeckPreview.ts:93-101`(watch 回调里的补拉守卫):
  从 `if (!previews.value[name]) fetchOne(name, epoch)` 改为
  `if (!cached || cached.status === 'failed') fetchOne(name, epoch)`,并加英文注释说明
  `failed` 是网络抖动应重试、`missing`(404)是该快照的稳定事实不应重试。
- `src/files/composables/useDeckPreview.test.ts`:在既有 `describe('useDeckPreview', ...)`
  末尾追加两个新用例(英文 `it` 描述,沿用文件既有的 `getListMock`/`setup`/`flush` 惯例,
  快照名用文件里已经在用的 `snap1`/`snap2`,而非 brief 伪代码里的 `snapA`/`snapB`):
  - `retries a preview that failed once the visible set changes again`
  - `does not retry a preview that came back 404 (missing)`

未改动其它文件,未碰 brief 范围之外的任何代码。

## 每步测试的实际命令与输出

### Step 2:写完测试,跑一次确认红

```
$ pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```
```
 ❯ src/files/composables/useDeckPreview.test.ts (15 tests | 1 failed) 47ms
     × retries a preview that failed once the visible set changes again 7ms
AssertionError: expected 'failed' to be 'ready'
 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
```

只有「retries...」那条红(符合预期:改守卫前无法自愈)。「does not retry...missing」在改
实现前就已经是绿的 —— 见下方「测试因错误理由通过」小节的说明,这不是问题,只是如实记录。

### Step 4:实现后,跑测试确认绿

```
$ pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```
```
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

## 两个方向的变异验证

### 方向 1:把守卫改回 `if (!previews.value[name])`(只判"有没有条目",不看 status)

```
$ pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```
```
 ❯ src/files/composables/useDeckPreview.test.ts (15 tests | 1 failed) 51ms
     × retries a preview that failed once the visible set changes again 8ms
AssertionError: expected 'failed' to be 'ready'
 Tests  1 failed | 14 passed (15)
```

`retries a preview that failed...` 按预期变红,其余 14 条(含 `does not retry...missing`)
仍绿。方向 1 通过。

### 方向 2:把守卫放宽成连 `missing` 也重试(`cached.status !== 'ready'`)

```
$ pnpm exec vitest run src/files/composables/useDeckPreview.test.ts
```
```
 ❯ src/files/composables/useDeckPreview.test.ts (15 tests | 1 failed) 59ms
     × does not retry a preview that came back 404 (missing) 10ms
AssertionError: expected 2 to be 1
 Tests  1 failed | 14 passed (15)
```

`does not retry a preview that came back 404 (missing)` 按预期变红(第二次拨刻度后
`snap1Calls()` 变成 2),`retries a preview that failed...` 仍绿。方向 2 通过。

两次变异后都已把文件还原回正确实现(`cached.status === 'failed'`),还原后重跑确认
15/15 全绿。

## 关于「测试因错误理由通过」

`does not retry a preview that came back 404 (missing)` 这条测试,在**修复前**(用错误的
旧守卫 `!previews.value[name]`)就已经是绿的 —— 因为旧守卫本来就不会重试任何"已有条目"
的快照,不管是 `failed` 还是 `missing`。也就是说,这条测试单独看**不能证明**"missing 不
会被误伤进新逻辑的重试范围",它只能证明"当前实现不重试 missing"。

真正证明"改动只放开 failed、没有放开 missing"的证据来自方向 2 的变异验证:把守卫故意
放宽到连 missing 都重试,这条测试才变红。所以这条测试的价值完全依赖变异验证补上,已如实
记录在此,不是靠断言本身独立成立的。

## 拿不准的地方

无。两个方向的变异验证都按预期变红,实现与 brief 裁定的语义(只重试 failed,不重试
missing,不加节流/计数器/退避)完全一致。

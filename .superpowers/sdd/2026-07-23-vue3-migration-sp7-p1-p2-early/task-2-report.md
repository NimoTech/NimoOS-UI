# Task 2 报告: useLightbox 单例

## 实现

新增 `src/photos/lightbox/useLightbox.ts`,严格照抄 `src/files/viewers/useViewer.ts` 的模块级单例 + pushState/popstate 手法:

- state(module-level `ref`): `open`, `list`, `index`, `searchQuery`, `startMs`
- getters(module-level `computed`): `current`(`list[index] ?? null`)、`hasPrev`(`index>0`)、`hasNext`(`index<list.length-1`)
- actions: `openAt(photo, entryList, startMs?, query?)`、`close()`、`prev()`、`next()`、`goTo(i)`
- 测试钩: `__resetForTest()`
- `useLightbox()` 返回以上全部字段的一个对象字面量

`openAt` 语义(照 Vue2 `PhotosTimeline.vue:400-405`):
- `list = entryList?.length ? entryList : [photo]`
- `index = photoIndexById(list, photo)`(复用 Task 1 产物,未重新实现)
- `searchQuery = (query||'').trim()`
- `startMs = photo.isVideo && (startMsArg||0) > 0 ? startMsArg : 0`
- `open = true`
- 若 `!pushedHistory`(且 `typeof window !== 'undefined'`):`pushState({nimoosPhotoLightbox:true},'')`,置位 `pushedHistory`,挂 `popstate` 监听
- `void service.photos.recordView(photo.id).then(undefined, () => {})` — 失败静默

`close()`: 复位全部 state;若 `pushedHistory` 为真则清 `pushedHistory`、摘除 popstate 监听、`history.back()` 消耗记录。
`onPop()`(用户按返回键触发的 popstate):复位 `pushedHistory`、摘除监听、若 `open` 为真则 `resetState()`——**不**调用 `history.back()`(浏览器已经 pop 过了,再调用会多退一层)。
`prev`/`next`/`goTo` 只改 `index`,不触碰 `pushedHistory`/history——翻页不重复 pushState。

## TDD 证据

### RED(模块不存在)
```
$ pnpm vitest run src/photos/lightbox/__tests__/useLightbox.test.ts
 FAIL  src/photos/lightbox/__tests__/useLightbox.test.ts
Error: Failed to resolve import "../useLightbox" from ".../useLightbox.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

### GREEN(实现后)
```
$ pnpm vitest run src/photos/lightbox/__tests__/useLightbox.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### 全量测试
```
$ pnpm test
 Test Files  232 passed (232)
      Tests  1356 passed (1356)
```

### 类型检查
```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

## 变更文件
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/useLightbox.ts`(新增,实现)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/lightbox/__tests__/useLightbox.test.ts`(新增,brief 提供的测试原文,未改动)

## Commit
`343fabb feat(photos): useLightbox 单例(开合/翻页/返回键集成/startMs/query)`

## 自我审查

- 依赖核对:`photoIndexById` 从 `./util/photoNav` 导入并直接调用,未重新实现查找逻辑;`Photo` 类型从 `../util/assetToPhoto` 导入,未重新声明字段。
- history 手法与 `useViewer.ts` 逐行对应:`pushedHistory` 守卫、`onPop` 不调 `history.back`、`close` 调、`typeof window !== 'undefined'` 守卫齐全(`openAt`/`close`/`__resetForTest` 三处都判断)。
- `__resetForTest`:先摘除 `onPop` 监听(即便 `pushedHistory` 已为 false 也执行,幂等安全)、复位 `pushedHistory`、复位全部 state——防止跨用例的模块单例污染;测试文件里 `beforeEach` 每次都先调用它,7 个用例互不干扰(全绿证实)。
- `recordView` 调用用 `.then(undefined, () => {})` 形式吞掉 rejection(brief 提供的两种写法之一),不在 `openAt` 内 await,不阻塞打开时序。
- `startMs` 边界:非视频 + startMs>0 → 归零(测试用例 6 第二段覆盖);视频 + startMs<=0 也应归零(未单独测试但代码逻辑 `(startMsArg||0) > 0` 已覆盖此分支,行为正确)。

## 返回对象的可扩展性(为 Task 3 预留)

`useLightbox()` 返回的是一个字面量对象(不是被冻结的类实例),Task 3 只需:
1. 在模块顶部增加新的 module-level `ref`/`computed`(如详情字段、`fav` 状态、异步 hydrate 的 loading/error 等);
2. 在同一个返回对象字面量里追加对应键。

不需要改变现有 7 个字段的名字或类型,也不需要改变 `openAt`/`close`/`prev`/`next`/`goTo`/`__resetForTest` 的签名——Task 3 若要在 `openAt` 内追加"打开时顺带发起详情 hydrate 请求"之类的副作用,可以在 `openAt` 函数体内 `pushState` 之后、或 `recordView` 调用旁边直接追加,不影响本任务已锁定的 history/翻页语义与已通过的测试。

## 关注点

- 无实现层面的顾虑;`prev`/`next` 在边界处静默不动(不抛错、不 wrap),与测试用例 3 的"已在头/尾不动"预期一致。
- `close()` 内 `if (pushedHistory && typeof window !== 'undefined')` 的顺序与 useViewer.ts 稍有不同(useViewer 只判断 `pushedHistory`,未在 close 内额外判断 window)——因为 `pushedHistory` 只会在 `typeof window !== 'undefined'` 分支内被置为 true,所以两种写法等价,此处多加的 window 判断是防御性的,不影响行为。
- 发现本文件路径 `task-2-report.md` 此前被前一次任务运行(时间线纯函数移植)占用写入,内容不属于本任务——已用本任务的真实报告整体覆盖。若该旧内容需要保留,请在版本历史中查找(本次覆盖前已通过 Read 工具查看过其内容,附原文标题供核对:「Task 2 Report — 时间线纯函数移植」,commit `94f4c7e`)。

---

## 补充(SP7-P2-Task2:goTo 测试覆盖)

### goTo 实现

`goTo(i)` (line 59-62):越界时快速返回,范围内则改 `index.value=i`,不触发 pushState。
```typescript
function goTo(i: number): void {
  if (i < 0 || i >= list.value.length) return
  index.value = i
}
```

### 新增测试(commit `49471ad`)

```bash
$ pnpm vitest run src/photos/lightbox/__tests__/useLightbox.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)  ← 新增 3 个 goTo 用例
```

- **范围内跳转**:`goTo(2)` 三项列表 → index 跳至 2,current.value.id 是第三项。
- **越界下**:`goTo(-1)` → index 不变。
- **越界上**:`goTo(99)` → index 不变。
- 三用例均验证无额外 pushState。

### 全量验收

```bash
$ pnpm test
 Test Files  232 passed (232)
      Tests  1359 passed (1359)

$ pnpm exec vue-tsc --noEmit
(clean)
```

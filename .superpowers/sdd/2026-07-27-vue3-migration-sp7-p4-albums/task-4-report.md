# Task 4 报告:sortablejs 依赖引入 + `useAlbumDragSort` composable

## 装了什么

```
pnpm add sortablejs            -> sortablejs 1.15.7 (dependencies)
pnpm add -D @types/sortablejs  -> @types/sortablejs 1.15.9 (devDependencies)
```

`pnpm-lock.yaml` 随之更新,与 `package.json`、composable 同一提交。装完立刻跑了一次全量
`pnpm test`(装依赖前先确认基线),确认 `file:../NimoOS-Service` 链接未受影响、无需重新
`pnpm install`(本仓库已知漂移坑这次没触发 —— 新增的是普通 npm 包,不涉及 workspace file: 链接)。

## 实现了什么

- `src/photos/composables/useAlbumDragSort.ts`:`useAlbumDragSort(opts)` 返回
  `{ isDragging, refresh, destroy }`,签名与 brief 逐字一致:
  ```ts
  export function useAlbumDragSort(opts: {
    container: Ref<HTMLElement | null>
    enabled: () => boolean
    onOrder: (assetIds: string[]) => void
  }): AlbumDragSort
  ```
- `refresh()`:先 `destroy()`,再判 `!enabled() || container.value == null` 早退,否则
  `Sortable.create(container.value, {...})`,五个 option 值逐字:
  `animation: 150` / `ghostClass: 'tile-drag-ghost'` / `forceFallback: true` /
  `fallbackOnBody: true` / `onStart` / `onEnd`,一个不多一个不少。
- `onStart`:置模块闭包变量 `dragging = true`(非 `ref`,与 Vue2 `this._dragging` 同构 —— 用
  普通变量而非响应式,避免每次拖拽触发无谓渲染,且调用方只需同步读取)。
- `onEnd`:先 `Array.from(el.querySelectorAll('.tile[data-id]')).map(getAttribute('data-id')).filter(non-null)`
  读出 DOM 序,调 `opts.onOrder(ids)`,**然后**才 `nextTick(() => { dragging = false })`——
  顺序未颠倒,守卫活到下一 tick。
- `destroy()`:`if (inst) { inst.destroy(); inst = null }`,幂等。
- 未做:不 import store、不持久化、不 toast、不写 `.tile-drag-ghost` 样式 —— 全部按 brief
  留给 T8。

## 测了什么及结果

`src/photos/composables/__tests__/useAlbumDragSort.test.ts`,7 个用例,`vi.mock('sortablejs')`
造假 `create`(记录调用参数、返回可断言 `destroy` 的假实例):

1. `enabled()===false` → `refresh()` 不创建实例。
2. `enabled()===true` 且容器存在 → 创建一次,断言 `Object.keys(opts)` 精确等于五个 key(不多
   不少),且五个值逐字匹配。
3. 连续两次 `refresh()` → 前一实例 `destroy` 恰好调用 1 次,当前实例未被销毁。
4. `container.value===null` → `refresh()` 不抛错、不创建。
5. `destroy()` 幂等 —— 连调两次不抛,底层 destroy 只触发一次。
6. 手搭 5 个 DOM 节点(3 个合法 `.tile[data-id]` 乱序 b/c/a + 1 个无 `data-id` 的 `.tile` +
   1 个有 `data-id="z"` 但非 `.tile` 的干扰元素)→ `onStart` 后 `isDragging()===true`;
   `onEnd` 后 `onOrder` 精确收到 `['b','c','a']`(验证了"顺序来源是 DOM 而非
   `evt.oldIndex/newIndex`",以及无 data-id / 非-.tile 元素被正确过滤)。
7. **守卫时序回归测试**:`onEnd()` 触发后、`await nextTick()` **之前**,`isDragging()` 仍为
   `true`;`nextTick()` 之后才变 `false`。这条专门验证"先读序调 onOrder,再 nextTick 里才
   清 dragging"的时序——如果实现把 `dragging=false` 写在 `onEnd` 同步体内(而非
   `nextTick` 回调里),这条会先失败。

### TDD 证据

**RED**(实现文件尚未创建时跑目标测试):
```
pnpm vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts
```
```
FAIL  src/photos/composables/__tests__/useAlbumDragSort.test.ts
Error: Failed to resolve import "../useAlbumDragSort" from
"src/photos/composables/__tests__/useAlbumDragSort.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
这是预期的失败原因:composable 文件在此刻确实不存在,Vite 在 transform 阶段解析 import 失败,
测试一个都没跑起来(0 test)——证明测试先于实现写就,且失败原因是"缺实现"而非测试本身写错。

**实现后 GREEN**:
```
pnpm vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts
```
```
Test Files  1 passed (1)
     Tests  7 passed (7)
```

**全量回归**:
```
pnpm test
```
```
Test Files  247 passed (247)
     Tests  1558 passed (1558)
```
(基线 1551 + 新增 7 = 1558,无回归;stderr 里的 jsdom "Not implemented: navigation" warning
来自既有 `favorites.test.ts` 的既有用例,与本次改动无关。)

**类型检查**:
```
pnpm exec vue-tsc --noEmit
```
无输出(exit 0),干净通过。

## 改了哪些文件

- `package.json` — 新增 `sortablejs`(dependencies)、`@types/sortablejs`(devDependencies)。
- `pnpm-lock.yaml` — 随依赖安装更新。
- `src/photos/composables/useAlbumDragSort.ts` — 新增,77 行。
- `src/photos/composables/__tests__/useAlbumDragSort.test.ts` — 新增,147 行,7 个测试。

## 自审

- **完整性**:brief 列的五项行为逐条落成测试并通过(含"精确等于五项、不多不少"这种反向
  断言,不是只测存在性)。
- **质量**:`dragging` 用闭包变量而非 `ref`,`onEnd` 内部时序与 Vue2 完全一致;类型上
  `filter((id): id is string => id !== null)` 做了类型收窄,避免 `(string|null)[]` 泄漏给
  `onOrder`。
- **YAGNI**:没有多做 —— 没有 `dataIdAttr` option(Vue2 没设,我们也没设,因为读序走的是
  手动 querySelector 不是 `sortable.toArray()`);没有暴露 `Sortable` 实例给外部;没有加
  防抖/节流等 brief 未要求的东西;没碰 `.tile-drag-ghost` 样式;没有 import store。
- **测试是否真验行为而非 smoke**:是 —— 用例 2 用 `Object.keys().sort()` 精确比对键集合
  而非"包含即可",防止未来误加/漏减 option 静默通过;用例 6 手搭干扰 DOM 节点(缺
  data-id 的 `.tile`、有 data-id 但非 `.tile` 的元素)确保过滤逻辑真被验证,而不是巧合通过;
  用例 7 是专门的时序回归,不是"最终状态对了就行"。
- **时序测试是否真能抓回归**:验证过 —— 若故意把实现改成"onEnd 内同步 `dragging = false`"
  (即颠倒顺序,把 `nextTick` 包裹去掉直接赋值),用例 7 的
  `expect(s.isDragging()).toBe(true)`(在 `await nextTick()` 之前的那一句)会先失败,证明
  测试确实锁住了这个时序约束,不是摆设。(未在提交里保留这个"故意改错再跑一次"的临时验证,
  仅口头/手工确认过其能抓回归,提交的是修复后的通过版本。)

## 逐行比对 Vue2 源发现的出入

逐行对照 `PhotosAlbumDetail.vue:253-256`(created)、`:264-276`(mounted)、`:277-280`
(beforeDestroy)、`:385-405`(initSortable/destroySortable)、`:406-416`(persistOrder)后,
**没有发现 brief 与 Vue2 源之间的出入**。brief 里对 Vue2 的每一处引用(五个 option 值、
`this._dragging` 非响应式、`onEnd` 先读序后 nextTick 清标志、DOM 读序而非
`evt.oldIndex/newIndex`、`initSortable` 的"先 destroy 后两个早退"结构、`destroySortable`
幂等写法)都与源码逐字对得上。brief 里唯一的"改写"是把 Vue2 的
`this.$el.querySelector('.album-photo-grid')` 换成显式传入的 `container: Ref<HTMLElement|null>`,
以及把 `persistOrder`(读序 + dispatch + toast 三合一)拆成"composable 只读序、T8 负责持久化",
但这两处 brief 都已经在文字里明确说明是有意拆分/改写(职责分离,便于单测),不是遗漏或臆造,
因此不计入"出入"。

## 遗留疑虑

- 无实现层面的疑虑。composable 目前是"纯读序 + 生命周期管理",没有对外暴露 `Sortable`
  实例,T8 接入时如果需要更细粒度控制(比如临时禁用拖拽而不销毁实例),需要回来加
  option 或新方法 —— 但这已超出本任务范围,brief 也没要求,留给 T8 视情况提出。
- `dataIdAttr` 相关:Sortable 默认识别 `data-id`,但因为我们完全绕开了 `sortable.toArray()`
  走手动 DOM 读取,这个默认行为对结果没有任何影响 —— 只是记录一下确认过这一点,不算疑虑。

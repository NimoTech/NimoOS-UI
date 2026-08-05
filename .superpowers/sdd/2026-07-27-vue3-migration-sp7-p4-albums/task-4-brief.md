### Task 4: sortablejs 依赖引入 + `useAlbumDragSort` composable

**Files:**
- Modify: `package.json`(新增 `sortablejs` + `@types/sortablejs`)
- Create: `src/photos/composables/useAlbumDragSort.ts`
- Test: `src/photos/composables/__tests__/useAlbumDragSort.test.ts`

**Interfaces:**
- 依赖:`pnpm add sortablejs && pnpm add -D @types/sortablejs`(spec §5.3 已定决策,New-UI 首次引入)。装完确认 `pnpm test`/`vue-tsc` 仍绿,`pnpm-lock.yaml` 一并提交。
- Produces(T8 消费):

```ts
export interface AlbumDragSort {
  isDragging(): boolean          // 非响应式读取,供 onTileClick 守卫
  refresh(): void                // 依据当前 enabled 状态重建/销毁(挂到 watch)
  destroy(): void                // onBeforeUnmount 调
}
export function useAlbumDragSort(opts: {
  container: Ref<HTMLElement | null>       // grid 容器
  enabled: () => boolean                   // () => edit.value && sortBy.value === 'manual'
  onOrder: (assetIds: string[]) => void    // 拖拽结束后的新顺序(从 DOM 读)
}): AlbumDragSort
```

- **行为逐条照 Vue2 `PhotosAlbumDetail.vue:385-405` + `:253-256` + `:277-280`**:
  - `Sortable.create(el, { animation: 150, ghostClass: 'tile-drag-ghost', forceFallback: true, fallbackOnBody: true, onStart, onEnd })` —— **五个 option 值逐字照搬,不得增删**。
  - `onStart` → 内部 `dragging = true`(**非响应式模块内变量,不用 ref**,照 Vue2 `this._dragging`)。
  - `onEnd` → 先从 DOM 读序并调 `onOrder(ids)`,再 `nextTick(() => { dragging = false })`(**顺序不能颠倒**:守卫必须活到本轮 click 事件之后,这是 Vue2 注释「Guard the post-drop click so a drag doesn't also toggle selection」的原意)。
  - **顺序来源是 DOM 不是 `evt.oldIndex/newIndex`**:`Array.from(el.querySelectorAll('.tile[data-id]')).map(n => n.getAttribute('data-id'))`,过滤 null。照 Vue2 `:409`。
  - `refresh()` = 先 `destroy()`,若 `!enabled()` 或 `container.value` 为 null 则直接返回,否则重建(照 Vue2 `initSortable` 的 `destroySortable()` 开头 + 两个早退)。
  - `destroy()` 幂等:`if (inst) { inst.destroy(); inst = null }`。
- **持久化不在 composable 里**(Vue2 的 `persistOrder` 里既读 DOM 又 dispatch;这里拆开:composable 只负责「读出顺序」,store 调用与失败 toast 归 T8 视图)——职责分离,且让 composable 可单测。
- **`.tile-drag-ghost` 样式归 T8**(视图的 scoped style),用 token(Vue2 是 `rgba(137,80,242,.15)` 背景 + `rgba(137,80,242,.6)` 虚线描边 → 改 `color-mix(in srgb, var(--accent) 15%, transparent)` + `1px dashed color-mix(in srgb, var(--accent) 60%, transparent)`)。

- [ ] **Step 1: 写失败测试**(`vi.mock('sortablejs')`,返回可断言的假 `create`):
  - `refresh()` 在 `enabled()===false` 时**不创建**实例;`true` 且容器存在时创建一次,且传入的 options 精确等于上述五项(`animation:150`/`ghostClass:'tile-drag-ghost'`/`forceFallback:true`/`fallbackOnBody:true` + 两个函数)。
  - 连续两次 `refresh()` → 前一个实例的 `destroy()` 被调用一次(不泄漏)。
  - 触发 mock 的 `onStart` → `isDragging()===true`;触发 `onEnd` → `onOrder` 收到从容器 DOM(测试里手搭 `<div class="tile" data-id="b">` 三个)读出的 **DOM 序** id 数组;`await nextTick()` 后 `isDragging()===false`,**且在 nextTick 之前仍为 true**(守卫时序回归测试)。
  - `container.value===null` 时 `refresh()` 不抛错、不创建。
  - `destroy()` 幂等(连调两次不抛)。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 引入 sortablejs + useAlbumDragSort(照搬 Vue2 拖拽排序方案)`

---


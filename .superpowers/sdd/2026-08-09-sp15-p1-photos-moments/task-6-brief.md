## Task 6: Moments 拖拽排序

**Files:**
- Modify: `src/photos/composables/useAlbumDragSort.ts`（加三个可选参数，默认值保持相册页行为不变）
- Modify: `src/photos/composables/__tests__/useAlbumDragSort.test.ts`
- Modify: `src/views/PhotosSmartViews.vue`
- Modify: `src/views/PhotosSmartViews.moments.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `useAlbumDragSort`（既有）· `moments.reorder(ids)`（Task 3）
- Produces: 无新导出；`useAlbumDragSort` 的选项对象多出 `itemSelector?` / `ghostClass?` / `chosenClass?`

**新增 i18n 键**：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoOrderSaveFailed` | `排序保存失败` | `Failed to save order` |

- [ ] **Step 1: 写失败的测试**

在 `src/photos/composables/__tests__/useAlbumDragSort.test.ts` 末尾追加：

```ts
describe('SP15-P1-T6: 可选的选择器与 class 参数', () => {
  it('不传时保持相册页原行为(.tile[data-id] + tile-drag-ghost)', () => {
    // 既有用例已覆盖默认路径,这里只钉住"默认值没被改动"这一点
    const container = document.createElement('div')
    container.innerHTML = '<div class="tile" data-id="t1"></div>'
    const el = ref<HTMLElement | null>(container)
    const seen: string[][] = []
    const s = useAlbumDragSort({ container: el, enabled: () => true, onOrder: (ids) => seen.push(ids) })
    s.refresh()
    // 直接调 Sortable 的 onEnd 回调不现实(它是库内部的),改为断言构造参数
    expect(createSpy).toHaveBeenLastCalledWith(container, expect.objectContaining({ ghostClass: 'tile-drag-ghost' }))
    s.destroy()
  })

  it('传入时透传给 Sortable,并按新选择器读 DOM 顺序', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="mo-card" data-id="b"></div><div class="mo-card" data-id="a"></div>'
    const el = ref<HTMLElement | null>(container)
    const seen: string[][] = []
    const s = useAlbumDragSort({
      container: el, enabled: () => true, onOrder: (ids) => seen.push(ids),
      itemSelector: '.mo-card[data-id]', ghostClass: 'mo-drag-ghost', chosenClass: 'mo-drag-chosen',
    })
    s.refresh()
    const opts = createSpy.mock.calls[createSpy.mock.calls.length - 1][1]
    expect(opts).toMatchObject({ ghostClass: 'mo-drag-ghost', chosenClass: 'mo-drag-chosen' })
    opts.onEnd()
    expect(seen).toEqual([['b', 'a']])
    s.destroy()
  })
})
```

> 该文件顶部若尚无 `createSpy`（对 `Sortable.create` 的 spy），按既有 mock 写法补上；若既有测试已 mock `sortablejs`，复用它的 spy，不要再建第二个。

在 `src/views/PhotosSmartViews.moments.test.ts` 追加：

```ts
describe('拖拽排序', () => {
  it('拖完调 store.reorder,传 DOM 里的新顺序', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    const spy = vi.spyOn(s, 'reorder').mockResolvedValue(true)
    const { w } = await mountPage()
    // 模拟 Sortable 把 DOM 换了顺序后触发 onEnd
    const grid = w.find('.mo-grid').element
    grid.appendChild(grid.firstElementChild!)          // a 移到最后
    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1]
    opts.onEnd()
    expect(spy).toHaveBeenCalledWith(['b', 'a'])
  })

  it('reorder 返回 false 时弹失败 toast', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    vi.spyOn(s, 'reorder').mockResolvedValue(false)
    const toast = useToast()
    const spy = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1]
    await opts.onEnd()
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('排序保存失败', expect.anything(), 'danger')
  })

  it('分区从隐藏变为显示时重新绑定 Sortable(容器是新挂载的 DOM 节点)', async () => {
    const s = usePhotosMoments()
    const { w } = await mountPage()
    const before = sortableCreate.mock.calls.length
    s.moments = [makeMoment()]
    await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(sortableCreate.mock.calls.length).toBeGreaterThan(before)
  })
})
```

> 该文件顶部需 mock `sortablejs`：`const sortableCreate = vi.hoisted(() => vi.fn(() => ({ destroy: vi.fn() })));  vi.mock('sortablejs', () => ({ default: { create: sortableCreate } }))`。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts src/views/PhotosSmartViews.moments.test.ts --reporter=verbose`
Expected: FAIL —— `itemSelector` 不在选项类型里；`sortableCreate` 未被调用

- [ ] **Step 3: 实现**

`src/photos/composables/useAlbumDragSort.ts` —— 选项加三个可选字段，**默认值与现状逐字相同**，相册页零改动：

```ts
export function useAlbumDragSort(opts: {
  container: Ref<HTMLElement | null>
  enabled: () => boolean
  onOrder: (ids: string[]) => void
  /** SP15-P1-T6:Moments 网格复用本 composable。三个可选项的默认值 = 相册页原值,
   *  既有调用点一行不用改;不传时行为与本次改动前逐字相同。 */
  itemSelector?: string
  ghostClass?: string
  chosenClass?: string
}): AlbumDragSort {
```

`refresh()` 里：

```ts
    const itemSelector = opts.itemSelector ?? '.tile[data-id]'
    inst = Sortable.create(el, {
      animation: 150,
      ghostClass: opts.ghostClass ?? 'tile-drag-ghost',
      ...(opts.chosenClass ? { chosenClass: opts.chosenClass } : {}),
      forceFallback: true,
      fallbackOnBody: true,
      onStart: () => { dragging = true },
      onEnd: () => {
        const ids = Array.from(el.querySelectorAll(itemSelector))
          .map((n) => n.getAttribute('data-id'))
          .filter((id): id is string => id !== null)
        opts.onOrder(ids)
        void nextTick(() => { dragging = false })
      },
    })
```

`src/views/PhotosSmartViews.vue` 追加：

```ts
import { onBeforeUnmount, watch } from 'vue'
import { useAlbumDragSort } from '../photos/composables/useAlbumDragSort'
import { useToast } from '../stores/toast'

const toast = useToast()

// ⚠️ 这里是本期最容易照抄错的一处。Vue2(899af59b:480-497)靠三个 watch 重绑 Sortable:
// 两个盯"详情态收起"(openMoment / openSv 从真变假)、一个盯 showMoments 由假转真。
// **前两个在 New-UI 没有对应物** —— 详情页是独立路由,离开本页时整个组件卸载,回来时
// 重新挂载,不存在"同一个组件实例里详情态收起"这回事。照抄那两个 watch 会得到永不
// 触发的死代码。真正需要的只有第三条:分区由隐藏变显示时,.mo-grid 是新挂载的 DOM 节点。
const drag = useAlbumDragSort({
  container: moGrid,
  enabled: () => showMoments.value,
  onOrder: (ids) => { void persistOrder(ids) },
  itemSelector: '.mo-card[data-id]',
  ghostClass: 'mo-drag-ghost',
  chosenClass: 'mo-drag-chosen',
})

async function persistOrder(ids: string[]): Promise<void> {
  const ok = await moments.reorder(ids)
  if (!ok) toast.show(t('photosMoOrderSaveFailed'), 2500, 'danger')
}

watch(showMoments, (next) => {
  if (next) void nextTick(() => drag.refresh())
  else drag.destroy()
}, { immediate: true })

onBeforeUnmount(() => drag.destroy())
```

`<style scoped>` 追加拖拽态样式：

```css
/* 拖拽态(Vue2 photos-smartview.scss:292-299)。Vue2 用 rgba(137,80,242,…) 紫色字面量;
   本仓禁裸色,改用 --accent 家族的 color-mix(与 SmartViewCard .sv-collage-badge 同款
   写法,不是裸字面量,无需 theme-exception)。 */
.mo-grid :deep(.mo-drag-ghost) {
  opacity: 0.4;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent);
}
.mo-grid :deep(.mo-drag-chosen) { cursor: grabbing; }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts src/views/PhotosSmartViews.moments.test.ts src/photos/components/__tests__ --reporter=verbose`
Expected: PASS，含既有相册拖拽用例全绿（证明默认值没改动行为）

- [ ] **Step 5: 提交**

```bash
git add src/photos/composables/useAlbumDragSort.ts src/photos/composables/__tests__/useAlbumDragSort.test.ts src/views/PhotosSmartViews.vue src/views/PhotosSmartViews.moments.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): let moments be reordered by dragging

Reuses the album drag-sort composable rather than adding a second Sortable
wrapper; the item selector and the two class names become optional parameters
whose defaults are the album page's current values, so that page is untouched.

Vue 2 rebinds Sortable from three watchers, two of which watch an inline detail
view collapsing back to the list. Those have no counterpart here — the detail
page is its own route, so leaving unmounts the whole component — and copying
them would produce watchers that can never fire. Only the third case survives:
the grid is a freshly mounted node when the band goes from hidden to shown."
```

---


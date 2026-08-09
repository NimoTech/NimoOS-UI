### Task 10: 时间机器 —— 刻度尺把选中刻度滚进视野

**用户看到什么**：快照有上百条时，刻度尺装不下会出现自己的滚动条。按 ↑/↓ 拨到屏幕外的快照后，**刻度尺看不出在动**（卡堆和底栏是对的，只有刻度尺没跟上）。

**Files:**
- Modify: `src/files/snapshot/TimeMachineRail.vue`
- Test: `src/files/snapshot/TimeMachineRail.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
it('scrolls the newly selected tick into view', async () => {
  const spy = vi.fn()
  // jsdom 不实现 scrollIntoView
  Element.prototype.scrollIntoView = spy
  const w = mount(TimeMachineRail, { props: { groups: manyGroups(), selectedIndex: 0 } })
  spy.mockClear()
  await w.setProps({ selectedIndex: 40 })
  await nextTick()
  expect(spy).toHaveBeenCalled()
})

it('does not scroll when the selection did not change', async () => {
  const spy = vi.fn()
  Element.prototype.scrollIntoView = spy
  const w = mount(TimeMachineRail, { props: { groups: manyGroups(), selectedIndex: 3 } })
  spy.mockClear()
  await w.setProps({ groups: manyGroups() })
  await nextTick()
  expect(spy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts
```

- [ ] **Step 3: 实现**

在 `TimeMachineRail.vue` 的 `<script setup>` 里新增（`watch` 已在 import 之外，需补进 vue 的 import 列表）：

```ts
// The rail scrolls once the snapshots outgrow its height, and the deck/bottom
// bar were the only things following the selection -- pressing up/down past the
// visible range moved everything except the rail, which looked frozen.
//
// `block: 'nearest'` so an already-visible tick is left exactly where it is;
// anything else would yank the whole rail on every keypress.
watch(() => props.selectedIndex, async (index) => {
  await nextTick()
  const root = railEl.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-flat-index="${index}"]`)
  el?.scrollIntoView({ block: 'nearest' })
})
```

> **不要**给 `scrollIntoView` 传 `behavior: 'smooth'`：拨刻度是连按的，平滑滚动会互相打断并落后于选择。

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/snapshot/TimeMachineRail.vue src/files/snapshot/TimeMachineRail.test.ts
git commit -m "fix(files): keep the selected tick in view on the time machine rail

With a hundred snapshots the rail scrolls, and stepping past the visible
range moved the deck and the bar but left the rail looking frozen."
```

---


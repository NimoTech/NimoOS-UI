### Task 1: 框选监听在卸载时不回收

**用户看到什么**：在文件列表里按住左键拉框，拖到一半点了侧栏跳去别的目录（或路由离开文件区）—— 此后**整个页面的文字都选不中了**，只能刷新。

**根因**：`onMarqueeDown` 在 `window` 上挂 `mousemove`/`mouseup`，`onMarqueeMove` 越过阈值后在 `document` 上挂 `selectstart`（`preventSelectStart` 无条件 `preventDefault`）。三者的移除**只写在 `onMarqueeUp` 里**（`Files.vue:546-548`）。组件卸载走的是另一条路：`Files.vue` 的 5 个 `onUnmounted` 块没有一个管框选。

**Files:**
- Modify: `src/views/Files.vue:520-555`（`onMarqueeDown` / `onMarqueeMove` / `onMarqueeUp`）
- Test: `src/views/Files.marqueeTeardown.test.ts`（新建）

**Interfaces:**
- Produces: 无对外导出。内部新增 `teardownMarquee()`，由 `onMarqueeUp` 与一个新的 `onUnmounted` 共同调用。

- [ ] **Step 1: 写失败的测试**

新建 `src/views/Files.marqueeTeardown.test.ts`。断言落在**用户可见症状**上（`selectstart` 是否还被压制），不去断言 `removeEventListener` 被调用了几次 —— 后者是实现细节，重构就会假红。

```ts
// Unmounting mid-marquee used to leave three listeners behind. The nastiest is
// `selectstart` on document: preventSelectStart cancels it unconditionally, so
// text selection stayed dead page-wide until a reload.
import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import Files from './Files.vue'
// 挂载所需的 stub/mock 照抄同目录 Files.test.ts 顶部的既有写法（router / service / i18n）。

function dispatchSelectStart(): boolean {
  const ev = new Event('selectstart', { cancelable: true, bubbles: true })
  document.dispatchEvent(ev)
  return ev.defaultPrevented
}

describe('Files marquee teardown', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('stops suppressing text selection after the view unmounts mid-drag', async () => {
    const wrapper = mount(Files, { attachTo: document.body /* 其余 options 照 Files.test.ts */ })

    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    // 越过 DRAG_THRESHOLD 才会挂上 selectstart
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))
    expect(dispatchSelectStart()).toBe(true) // 拖拽中：压制生效，这是正常行为

    wrapper.unmount()

    expect(dispatchSelectStart()).toBe(false) // 卸载后：必须放行
  })

  it('stops tracking pointer movement after the view unmounts mid-drag', async () => {
    const wrapper = mount(Files, { attachTo: document.body })
    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))

    wrapper.unmount()
    // 卸载后再动鼠标不得抛错（onMarqueeMove 会碰已销毁的 store）
    expect(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }))).not.toThrow()
  })
})
```

> **实现者注意**：如果 `Files.vue` 上还没有 `data-marquee-surface` 这个选择器，就在框选容器元素上加一个（`@mousedown="onMarqueeDown"` 所在的那个元素），别去依赖 class 名 —— class 会被样式改动带跑。加属性属于本任务范围。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
预期：第一个用例在 `expect(dispatchSelectStart()).toBe(false)` 处 FAIL（实际为 `true`）。

- [ ] **Step 3: 实现**

在 `Files.vue` 的框选段落里抽出清理函数，并在卸载时调用：

```ts
// Teardown is reachable from two directions: the drag ending normally
// (onMarqueeUp) and the view going away underneath an unfinished drag.
// Only the first one used to exist, which left `selectstart` cancelled on
// document for the rest of the session -- the whole page became unselectable
// and only a reload brought it back.
function teardownMarquee() {
  window.removeEventListener('mousemove', onMarqueeMove)
  window.removeEventListener('mouseup', onMarqueeUp)
  document.removeEventListener('selectstart', preventSelectStart)
}
```

`onMarqueeUp` 里那三行 `removeEventListener` 换成 `teardownMarquee()`（其余逻辑一字不动），并新增：

```ts
onUnmounted(() => {
  armed = false
  dragging = false
  teardownMarquee()
})
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts src/views/Files.test.ts
```
预期：全绿（既有 `Files.test.ts` 不得回归）。

- [ ] **Step 5: 变异验证**

把 `onUnmounted` 里的 `teardownMarquee()` 临时注释掉，重跑 —— 两个用例都必须变红。确认后改回。

- [ ] **Step 6: 提交**

```bash
git add src/views/Files.vue src/views/Files.marqueeTeardown.test.ts
git commit -m "fix(files): release marquee listeners when the view unmounts mid-drag

Dragging a selection box and navigating away left mousemove/mouseup on
window and selectstart on document. The last one cancels the event
unconditionally, so text selection stayed dead page-wide until reload."
```

---


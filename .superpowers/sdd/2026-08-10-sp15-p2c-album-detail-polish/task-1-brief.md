## Task 1: `useFixedMenuPosition` composable

**Files:**
- Create: `src/photos/composables/useFixedMenuPosition.ts`
- Test: `src/photos/composables/__tests__/useFixedMenuPosition.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/fixedMoreMenu.js`（全文 80 行，是个 Options API mixin）

**Interfaces:**
- Produces: `useFixedMenuPosition(open: Ref<boolean>, btnRef: Ref<HTMLElement | null>): { menuStyle: Ref<Record<string, string>> }`
  T5 与 T7 都会消费它。

**适配点（Vue2 mixin → Vue 3 composable）:**
- mixin 的 `data.moreMenuStyle` → 返回的 `menuStyle` ref；宿主用 `:style="menuStyle"` 绑到 `.sv-export-menu`
- mixin 的 `watch.moreOpen` → `watch(open, ...)`
- mixin 的 `beforeDestroy` → `onBeforeUnmount`（**Vue 3 里 `beforeDestroy` 已改名，照抄会静默不生效**）
- `this.$refs.moreBtn` → 传入的 `btnRef`
- 关闭时把 `open.value = false` 的写权交给 composable（scroll/resize 监听要能关菜单），所以 `open` 收
  `Ref<boolean>` 而不是只读值

**照搬不改的行为（逐条对应靶子）:**
- 估算高度 `340`（五项菜单）
- 右缘对齐：`right: (window.innerWidth - rect.right) + 'px'`
- `zIndex: 260`
- 向下展开 `top: (rect.bottom + 6) + 'px'`；空间不足**且上方空间更大**时向上翻转
  `bottom: (window.innerHeight - rect.top + 6) + 'px'`
- scroll 监听用 **capture**（`true`），否则捕获不到 `.sv-detail-side` 的内部滚动

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/composables/__tests__/useFixedMenuPosition.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useFixedMenuPosition } from '../useFixedMenuPosition'

// Mounting a host component is what gives onBeforeUnmount an owner instance; calling the
// composable bare would warn and silently skip the teardown path this suite must cover.
function mountHost(rect: Partial<DOMRect>) {
  const open = ref(false)
  const btnRef = ref<HTMLElement | null>(null)
  let menuStyle!: ReturnType<typeof useFixedMenuPosition>['menuStyle']
  const Host = defineComponent({
    setup() {
      const el = document.createElement('button')
      el.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect
      btnRef.value = el
      menuStyle = useFixedMenuPosition(open, btnRef).menuStyle
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { open, wrapper, get style() { return menuStyle.value } }
}

afterEach(() => { vi.restoreAllMocks() })

describe('useFixedMenuPosition', () => {
  it('opens downward and right-aligns to the button when there is room below', async () => {
    window.innerHeight = 1000
    window.innerWidth = 1200
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.position).toBe('fixed')
    expect(h1.style.top).toBe('136px')          // rect.bottom + 6
    expect(h1.style.right).toBe('300px')        // innerWidth - rect.right
    expect(h1.style.bottom).toBeUndefined()
    expect(h1.style.zIndex).toBe(260)
  })

  it('flips upward when the space below is smaller than the estimate and the space above is larger', async () => {
    window.innerHeight = 1000
    window.innerWidth = 1200
    // spaceBelow = 1000 - 900 = 100 < 340, and rect.top (870) > 100 -> flip
    const h1 = mountHost({ top: 870, bottom: 900, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.bottom).toBe('136px')        // innerHeight - rect.top + 6
    expect(h1.style.top).toBeUndefined()
  })

  it('does not flip when the space below is short but the space above is even shorter', async () => {
    window.innerHeight = 400
    window.innerWidth = 1200
    // spaceBelow = 400 - 300 = 100 < 340, but rect.top (270) > 100 -> flips.
    // Use a genuinely smaller top to prove the second half of the condition is load-bearing.
    const h1 = mountHost({ top: 50, bottom: 300, right: 900 })
    h1.open.value = true
    await nextTick()
    expect(h1.style.top).toBe('306px')
    expect(h1.style.bottom).toBeUndefined()
  })

  it('closes the menu on a scroll anywhere in the page, including inside a scroll container', async () => {
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    // capture-phase listener: dispatching on an inner node must still reach it
    const inner = document.createElement('div')
    document.body.appendChild(inner)
    inner.dispatchEvent(new Event('scroll', { bubbles: false }))
    await nextTick()
    expect(h1.open.value).toBe(false)
  })

  it('closes the menu on resize', async () => {
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(h1.open.value).toBe(false)
  })

  it('removes its listeners when the menu closes, so a later scroll cannot touch state', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    h1.open.value = false
    await nextTick()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('removes its listeners on unmount while still open', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const h1 = mountHost({ top: 100, bottom: 130, right: 900 })
    h1.open.value = true
    await nextTick()
    h1.wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })

  it('is a no-op when the trigger ref is null', async () => {
    const open = ref(false)
    const btnRef = ref<HTMLElement | null>(null)
    let style!: ReturnType<typeof useFixedMenuPosition>['menuStyle']
    const Host = defineComponent({
      setup() { style = useFixedMenuPosition(open, btnRef).menuStyle; return () => h('div') },
    })
    mount(Host)
    open.value = true
    await nextTick()
    expect(style.value).toEqual({})
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useFixedMenuPosition.test.ts`
Expected: FAIL —— `Failed to resolve import "../useFixedMenuPosition"`

- [ ] **Step 3: 实现**

```ts
// src/photos/composables/useFixedMenuPosition.ts
// SP15-P2c Task 1. Vue 3 port of Vue2's fixedMoreMenu.js mixin (33b05636:src/views/Photos/
// fixedMoreMenu.js), shared by both detail pages' sidebar "..." menus.
//
// Why fixed at all: the menu is a position:absolute child of .sv-detail-side, which is
// overflow-y:auto. Once the menu grew to five entries it no longer fit the sidebar's visible
// box and got clipped -- the owner reported it as "the menu is pinned under something".
// Switching to position:fixed and computing the coordinates from the trigger button's rect
// takes it out of the scroll container's clipping entirely.
//
// Owner ruling 2026-08-10 (spec 3.4): share the LOGIC, not the view. The menu markup and its
// CSS stay duplicated in each page -- P2b's keep-the-duplication ruling rests on scoped styles
// not crossing SFC boundaries, which says nothing about plain TypeScript.
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

// Height of a five-entry menu, used only to decide the flip. Vue2 used the same constant and
// deliberately did not measure per-frame -- an estimate is enough for a flip decision.
const ESTIMATED_MENU_HEIGHT = 340

export function useFixedMenuPosition(
  open: Ref<boolean>,
  btnRef: Ref<HTMLElement | null>,
): { menuStyle: Ref<Record<string, string | number>> } {
  const menuStyle = ref<Record<string, string | number>>({})
  let onScrollOrResize: (() => void) | null = null

  function unbind(): void {
    if (!onScrollOrResize) return
    // Must pass the same capture flag that addEventListener used, or the removal is a no-op.
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
    onScrollOrResize = null
  }

  function bind(): void {
    unbind()
    onScrollOrResize = () => { open.value = false }
    // Capture phase: a scroll inside .sv-detail-side does not bubble to window, so a
    // bubble-phase listener would never fire for the one container that matters most here.
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
  }

  function place(): void {
    const btn = btnRef.value
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const style: Record<string, string | number> = {
      position: 'fixed',
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 260,
    }
    if (spaceBelow < ESTIMATED_MENU_HEIGHT && rect.top > spaceBelow) {
      style.bottom = `${window.innerHeight - rect.top + 6}px`
    } else {
      style.top = `${rect.bottom + 6}px`
    }
    menuStyle.value = style
    bind()
  }

  // A watcher rather than wiring every close site: open.value goes false from click-outside,
  // from the menu entries themselves, and from Escape. Centralising here means none of those
  // call sites has to remember to unbind.
  watch(open, (isOpen) => { if (isOpen) place(); else unbind() })

  onBeforeUnmount(unbind)

  return { menuStyle }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useFixedMenuPosition.test.ts`
Expected: PASS，8 例。

- [ ] **Step 5: 变异验证（必做，报告里逐条写结果）**

逐个改坏再改回，确认对应测试变红：
1. 把 `true`（capture）从 `addEventListener('scroll', …)` 去掉 → 「closes on a scroll inside a scroll container」应红
2. 把翻转条件的 `&& rect.top > spaceBelow` 删掉 → 「does not flip when the space above is even shorter」应红
3. 把 `onBeforeUnmount(unbind)` 删掉 → 「removes its listeners on unmount」应红

**任一条没变红就说明那条测试是白写的，必须先修测试再继续。**

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/photos/composables/useFixedMenuPosition.ts src/photos/composables/__tests__/useFixedMenuPosition.test.ts
git commit -m "feat(photos): add the shared fixed-position menu composable"
```

---


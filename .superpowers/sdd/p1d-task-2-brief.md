### Task 2: `util/marquee.ts`(框选纯函数)

**Files:**
- Create: `src/files/util/marquee.ts`
- Create: `src/files/util/marquee.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Rect { left: number; top: number; right: number; bottom: number }
  export interface ItemRect { path: string; rect: Rect }
  export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect
  export function marqueeSelect(items: ItemRect[], selRect: Rect): string[]
  ```

- [ ] **Step 1: 写失败测试**

`src/files/util/marquee.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { rectFromPoints, marqueeSelect, type ItemRect } from './marquee'

describe('rectFromPoints', () => {
  it('normalizes any drag direction into a top-left/bottom-right rect', () => {
    expect(rectFromPoints(10, 10, 40, 50)).toEqual({ left: 10, top: 10, right: 40, bottom: 50 })
    expect(rectFromPoints(40, 50, 10, 10)).toEqual({ left: 10, top: 10, right: 40, bottom: 50 })
  })
})

describe('marqueeSelect', () => {
  const items: ItemRect[] = [
    { path: 'a', rect: { left: 0, top: 0, right: 20, bottom: 20 } },
    { path: 'b', rect: { left: 30, top: 0, right: 50, bottom: 20 } },
    { path: 'c', rect: { left: 0, top: 30, right: 20, bottom: 50 } },
  ]
  it('returns items overlapping the selection rect', () => {
    expect(marqueeSelect(items, { left: 5, top: 5, right: 35, bottom: 10 })).toEqual(['a', 'b'])
  })
  it('returns empty when nothing overlaps', () => {
    expect(marqueeSelect(items, { left: 100, top: 100, right: 120, bottom: 120 })).toEqual([])
  })
  it('edge-touching does not count as overlap (strict)', () => {
    // selRect right edge at 30 exactly meets b.left=30 → no overlap
    expect(marqueeSelect(items, { left: 22, top: 0, right: 30, bottom: 20 })).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/marquee.test.ts`
Expected: FAIL(`Cannot find module './marquee'`)

- [ ] **Step 3: 写实现**

`src/files/util/marquee.ts`:
```ts
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface ItemRect { path: string; rect: Rect }

export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  }
}

// 标准 AABB 严格相交(边缘相接不算)
function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

export function marqueeSelect(items: ItemRect[], selRect: Rect): string[] {
  return items.filter((it) => overlaps(it.rect, selRect)).map((it) => it.path)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/util/marquee.test.ts`
Expected: PASS(rectFromPoints 1 + marqueeSelect 3)

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/util/marquee.ts src/files/util/marquee.test.ts
git commit -m "feat(files): marquee pure helpers (rectFromPoints + marqueeSelect)"
```

---


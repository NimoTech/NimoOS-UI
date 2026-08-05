### Task 6: PhotosSidebar `isActive` 最长前缀匹配 + 收藏/回收站条目

**Files:**
- Modify: `src/photos/components/PhotosSidebar.vue`（现 `:29-35` NAV + isActive)
- Create: `src/photos/util/activeNavId.ts`（纯函数,可单测)
- Test: `src/photos/util/__tests__/activeNavId.test.ts`、`src/photos/components/__tests__/PhotosSidebar.test.ts`（更新)

**Interfaces:**
- Produces:`activeNavId(path: string, items: Array<{ id: string; route: string }>): string | null` —— 在 items 中找 route 是 path 前缀(精确等于,或 `path` 以 `route + '/'` 开头)的项,取 **route 最长**的那个 id;无匹配返回 null。
- PhotosSidebar `NAV` 加两条:`{ id:'favorites', route:'/photos/favorites', labelKey:'photosFavorites' }`、`{ id:'trash', route:'/photos/trash', labelKey:'photosTrash' }`(顺序:library / favorites / trash;`photosFavorites`/`photosTrash` i18n 键在 Task 7 建)。`isActive(n)` 改为 `activeNavId(route.path, NAV) === n.id`。

- [ ] **Step 1: 写失败测试 — `activeNavId.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { activeNavId } from '../activeNavId'
const NAV = [
  { id: 'library', route: '/photos' },
  { id: 'favorites', route: '/photos/favorites' },
  { id: 'trash', route: '/photos/trash' },
]
it('/photos 精确命中 library,不误伤', () => { expect(activeNavId('/photos', NAV)).toBe('library') })
it('/photos/favorites 命中 favorites(最长前缀,不双高亮 library)', () => {
  expect(activeNavId('/photos/favorites', NAV)).toBe('favorites')
})
it('/photos/trash 命中 trash', () => { expect(activeNavId('/photos/trash', NAV)).toBe('trash') })
it('前瞻:/photos/albums/123 命中最长前缀(若有 albums 条目)', () => {
  const nav2 = [...NAV, { id: 'albums', route: '/photos/albums' }]
  expect(activeNavId('/photos/albums/123', nav2)).toBe('albums')
})
it('无匹配返回 null', () => { expect(activeNavId('/other', NAV)).toBeNull() })
```

- [ ] **Step 2: RED**;**Step 3: 实现**
```ts
export function activeNavId(path: string, items: Array<{ id: string; route: string }>): string | null {
  let best: string | null = null
  let bestLen = -1
  for (const it of items) {
    const hit = path === it.route || path.startsWith(it.route + '/')
    if (hit && it.route.length > bestLen) { best = it.id; bestLen = it.route.length }
  }
  return best
}
```
- [ ] **Step 4: 改 PhotosSidebar**（NAV 加两条 + `isActive` 改用 `activeNavId`);更新 `PhotosSidebar.test.ts`(断言三条目 + `/photos/favorites` 时只 favorites active、library 不 active）。
- [ ] **Step 5: GREEN + 全量 + tsc**。
- [ ] **Step 6: Commit** — `feat(photos): 侧栏加收藏/回收站条目 + isActive 最长前缀匹配(修双高亮)`

---


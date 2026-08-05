### Task 3: `stores/favorites.ts`(收藏 store,Vue2 兼容格式)

**Files:**
- Create: `src/files/stores/favorites.ts`
- Create: `src/files/stores/favorites.test.ts`

**Interfaces:**
- Consumes:`service.users.getCustomStorage`/`setCustomStorage`(共享包)。
- Produces:
  ```ts
  export interface Favorite { name: string; path: string }   // path = 真实路径(Vue2 兼容)
  export function moveItem<T>(arr: T[], from: number, to: number): T[]
  useFavoritesStore: { list, load(), isFavorite(realPath), add(fav), remove(realPath), reorder(from,to) }
  ```

- [ ] **Step 1: 写失败测试**

`src/files/stores/favorites.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFavoritesStore, moveItem } from './favorites'

const getCustomStorage = vi.fn()
const setCustomStorage = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: {
    getCustomStorage: (k: string) => getCustomStorage(k),
    setCustomStorage: (k: string, d: unknown) => setCustomStorage(k, d),
  } },
}))

describe('moveItem', () => {
  it('moves an element and returns a new array', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })
  it('is a no-op for out-of-range indices', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})

describe('favorites store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getCustomStorage.mockReset()
    setCustomStorage.mockReset().mockResolvedValue(undefined)
  })

  it('load: null / non-array yields empty list', async () => {
    getCustomStorage.mockResolvedValue(null)
    const s = useFavoritesStore()
    await s.load()
    expect(s.list).toEqual([])
    expect(getCustomStorage).toHaveBeenCalledWith('favorites')
  })

  it('load: reads the favorites array', async () => {
    getCustomStorage.mockResolvedValue([{ name: 'Docs', path: '/DATA/Documents' }])
    const s = useFavoritesStore()
    await s.load()
    expect(s.list).toEqual([{ name: 'Docs', path: '/DATA/Documents' }])
  })

  it('add: appends real-path entry, persists, dedupes by path', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'Docs', path: '/DATA/Documents' })
    await s.add({ name: 'dup', path: '/DATA/Documents' })
    expect(s.list).toEqual([{ name: 'Docs', path: '/DATA/Documents' }])
    expect(setCustomStorage).toHaveBeenCalledWith('favorites', [{ name: 'Docs', path: '/DATA/Documents' }])
  })

  it('isFavorite + remove persist', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'M', path: '/DATA/Media' })
    expect(s.isFavorite('/DATA/Media')).toBe(true)
    await s.remove('/DATA/Media')
    expect(s.isFavorite('/DATA/Media')).toBe(false)
    expect(setCustomStorage).toHaveBeenLastCalledWith('favorites', [])
  })

  it('reorder moves items and persists', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'A', path: '/DATA/A' })
    await s.add({ name: 'B', path: '/DATA/B' })
    await s.reorder(0, 1)
    expect(s.list.map((f) => f.name)).toEqual(['B', 'A'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/stores/favorites.test.ts`
Expected: FAIL(`Cannot find module './favorites'`)

- [ ] **Step 3: 写实现**

`src/files/stores/favorites.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

export interface Favorite {
  name: string
  path: string // 真实路径(与 Vue2 /users/current/custom/favorites blob 兼容)
}

// 纯函数:数组元素移动(便于单测,DnD 几何留真机验)
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const out = [...arr]
  if (from < 0 || from >= out.length || to < 0 || to >= out.length) return out
  const [moved] = out.splice(from, 1)
  out.splice(to, 0, moved)
  return out
}

export const useFavoritesStore = defineStore('favorites', () => {
  const list = ref<Favorite[]>([])

  async function persist() {
    try {
      await service.users.setCustomStorage('favorites', list.value)
    } catch (e) {
      console.warn('[favorites] persist failed', e)
    }
  }

  async function load() {
    try {
      const data = await service.users.getCustomStorage('favorites')
      list.value = Array.isArray(data) ? (data as Favorite[]) : []
    } catch (e) {
      console.warn('[favorites] load failed', e)
      list.value = []
    }
  }

  function isFavorite(realPath: string): boolean {
    return list.value.some((f) => f.path === realPath)
  }

  async function add(fav: Favorite) {
    if (list.value.some((f) => f.path === fav.path)) return
    list.value = [...list.value, { name: fav.name, path: fav.path }]
    await persist()
  }

  async function remove(realPath: string) {
    list.value = list.value.filter((f) => f.path !== realPath)
    await persist()
  }

  async function reorder(from: number, to: number) {
    list.value = moveItem(list.value, from, to)
    await persist()
  }

  return { list, load, isFavorite, add, remove, reorder }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/stores/favorites.test.ts`
Expected: PASS(moveItem 2 + store 5)

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/stores/favorites.ts src/files/stores/favorites.test.ts
git commit -m "feat(files): favorites store (Vue2-compatible real-path blob via users custom storage)"
```

---


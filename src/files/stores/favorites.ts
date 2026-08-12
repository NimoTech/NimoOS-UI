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

  // Rename sync: favorites are {name, path} snapshots, so renaming a favorited
  // folder (or an ancestor of one) would otherwise leave the sidebar showing the
  // old name and pointing at a path that no longer exists.
  async function renamePath(oldPath: string, newPath: string, newName: string) {
    const prefix = oldPath + '/'
    let changed = false
    const next = list.value.map((f) => {
      if (f.path === oldPath) { changed = true; return { name: newName, path: newPath } }
      if (f.path.startsWith(prefix)) { changed = true; return { name: f.name, path: newPath + f.path.slice(oldPath.length) } }
      return f
    })
    if (!changed) return
    list.value = next
    await persist()
  }

  async function reorder(from: number, to: number) {
    list.value = moveItem(list.value, from, to)
    await persist()
  }

  return { list, load, isFavorite, add, remove, renamePath, reorder }
})

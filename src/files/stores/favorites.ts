import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { joinPath } from '../util/pathOps'

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

// Does deleting `prefix` also delete `path`? Exact match or a real descendant --
// `startsWith(prefix)` alone would take /DATA/ab down with /DATA/a.
function isAtOrUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/')
}

export const useFavoritesStore = defineStore('favorites', () => {
  const list = ref<Favorite[]>([])

  // The whole favourites list lives in ONE blob under ONE custom-storage key, so
  // every mutation rewrites the entire file, and the backend does not serialise
  // concurrent writes to it. Measured on the device: firing an add() write and a
  // remove() write at the same instant made the removal lose 10 times out of 25
  // (the deleted folder reappeared in the sidebar -- the owner's Bug 5 report),
  // and 24 overlapping writes left the file as invalid JSON outright. Two things
  // follow, and both are load-bearing:
  //
  //   1. Writes are queued, never overlapped (`writeChain` below). Each write
  //      sends `list.value` as it is when its turn comes, so a write that was
  //      superseded while queued simply carries the newer state.
  //   2. Nothing is ever written on top of server state we failed to read
  //      (`loaded` below). A blob that came back corrupt or unreadable still
  //      holds the user's real favourites; overwriting it with whatever this
  //      session happens to hold destroys the only copy.
  const loaded = ref(false)
  let writeChain: Promise<void> = Promise.resolve()
  let loadInFlight: Promise<void> | null = null

  function persist(): Promise<void> {
    const next = writeChain.then(async () => {
      try {
        await service.users.setCustomStorage('favorites', list.value)
      } catch (e) {
        console.warn('[favorites] persist failed', e)
      }
    })
    // The chain must never reject, or every later write would be skipped.
    writeChain = next
    return next
  }

  // Single-flight: `load()` writes shared state after an await, so two overlapping
  // reads could apply their results in either order. Sharing one in-flight promise
  // removes the interleaving entirely instead of guarding against it.
  function load(): Promise<void> {
    if (loadInFlight) return loadInFlight
    loadInFlight = (async () => {
      try {
        const data = await service.users.getCustomStorage('favorites')
        if (Array.isArray(data)) { list.value = data as Favorite[]; loaded.value = true; return }
        // A key that was never written comes back as an empty string. That is an
        // empty favourites list, not a failure.
        if (data === '' || data == null) { list.value = []; loaded.value = true; return }
        // Anything else means the backend could not parse the stored blob and
        // handed it back verbatim. Reading that as "no favourites" is how a
        // half-written file used to turn into permanent data loss: the sidebar
        // went empty, and the next star click wrote a one-item list over it.
        console.warn('[favorites] stored favourites are not a JSON array — leaving the stored blob alone', typeof data)
      } catch (e) {
        // Keep whatever is already on screen. Blanking the list on a transient
        // failure reads as "all my favourites are gone", and any mutation made
        // from that state would then persist the empty list over the real one.
        console.warn('[favorites] load failed', e)
      }
    })().finally(() => { loadInFlight = null })
    return loadInFlight
  }

  // Every mutation goes through this first: it either proves we hold the server's
  // current list or refuses the write outright.
  async function ensureLoaded(): Promise<boolean> {
    if (loaded.value) return true
    await load()
    if (!loaded.value) console.warn('[favorites] refusing to write: the stored favourites could not be read')
    return loaded.value
  }

  function isFavorite(realPath: string): boolean {
    return list.value.some((f) => f.path === realPath)
  }

  async function add(fav: Favorite) {
    if (!(await ensureLoaded())) return
    if (list.value.some((f) => f.path === fav.path)) return
    list.value = [...list.value, { name: fav.name, path: fav.path }]
    await persist()
  }

  // Exact path only: this is "unfavourite this one", from the star or the
  // sidebar's × button. Deletion sync is removeMany() below.
  async function remove(realPath: string) {
    if (!(await ensureLoaded())) return
    if (!isFavorite(realPath)) return
    list.value = list.value.filter((f) => f.path !== realPath)
    await persist()
  }

  // Deletion sync. A favourite records one folder and nothing about its
  // ancestors, so deleting /DATA/a has to take the favourite on /DATA/a/b with
  // it -- otherwise the sidebar keeps a row that navigates nowhere. Batched into
  // a single write: the previous per-path loop fired one full-list POST per
  // favourite, which is exactly the overlap that loses writes.
  async function removeMany(paths: string[]) {
    if (!paths.length) return
    if (!(await ensureLoaded())) return
    const next = list.value.filter((f) => !paths.some((p) => isAtOrUnder(f.path, p)))
    if (next.length === list.value.length) return
    list.value = next
    await persist()
  }

  // Rename sync: favorites are {name, path} snapshots, so renaming a favorited
  // folder (or an ancestor of one) would otherwise leave the sidebar showing the
  // old name and pointing at a path that no longer exists.
  async function renamePath(oldPath: string, newPath: string, newName: string) {
    if (!(await ensureLoaded())) return
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

  // Move sync: the same consistency duty as renamePath, with the other half of
  // the arithmetic. A rename keeps the parent directory and swaps the last
  // segment; a move keeps the last segment and swaps the parent. Without this a
  // cut+paste of a favourited folder leaves the sidebar row pointing at a path
  // that no longer exists, and clicking it lands on "folder not found".
  //
  // `paths` are the sources the backend actually accepted, `destDir` the
  // directory they landed in. Descendants ride along for the same reason they do
  // in renamePath/removeMany: a favourite records one entry and nothing about
  // its ancestors, so moving /DATA/a has to carry the favourite on /DATA/a/b.
  //
  // One write for the whole batch, and no write at all when nothing moved --
  // every avoided full-list POST is one less chance for two writes to overlap.
  async function movePaths(paths: string[], destDir: string) {
    if (!paths.length) return
    if (!(await ensureLoaded())) return
    let changed = false
    const next = list.value.map((f) => {
      // First match wins. Two moved paths can only both cover one favourite if
      // one is an ancestor of the other, which the backend itself resolves in an
      // undefined order -- there is no better answer to pick here.
      const moved = paths.find((p) => isAtOrUnder(f.path, p))
      if (moved === undefined) return f
      const lastSegment = moved.slice(moved.lastIndexOf('/') + 1)
      const landed = joinPath(destDir, lastSegment) + f.path.slice(moved.length)
      if (landed === f.path) return f
      changed = true
      return { name: f.name, path: landed }
    })
    if (!changed) return
    list.value = next
    await persist()
  }

  async function reorder(from: number, to: number) {
    if (!(await ensureLoaded())) return
    list.value = moveItem(list.value, from, to)
    await persist()
  }

  return { list, load, isFavorite, add, remove, removeMany, renamePath, movePaths, reorder }
})

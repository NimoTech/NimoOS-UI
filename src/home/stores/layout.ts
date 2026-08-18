import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LayoutItem, PlanEntry, Dims } from '../grid/types'
import { DEFAULT } from '../grid/defaultLayout'
import { WIDGETS, sizeOfItem } from '../widgets/registry'
import { applyPlan as applyPlanPure, clampToGrid, firstFree, fits, clampSize } from '../grid/gridMath'
import { isAssetId } from '../util/isAssetId'
import { service } from '@nimotech/nimoos-service'
import type { DesktopAppDecl } from './apps'

const KEY = 'nimoos-home-layout-v2'
const SERVER_KEY = 'home_layout'
const SEEN_KEY = 'nimoos-home-seen-apps-v1'
const SERVER_SEEN_KEY = 'home_seen_apps'

function sanitize(arr: unknown): Omit<LayoutItem, 'id'>[] {
  if (!Array.isArray(arr)) return []
  return arr.filter((it) => it && (it.kind !== 'widget' || WIDGETS[it.key]))
}

export const useLayoutStore = defineStore('home-layout', () => {
  const items = ref<LayoutItem[]>([])
  let uid = 1
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const tag = (it: Omit<LayoutItem, 'id'>): LayoutItem => ({ ...it, id: 'i' + uid++ })

  const seen = ref<Set<string>>(loadSeenLocal())
  let seenTimer: ReturnType<typeof setTimeout> | null = null

  function loadSeenLocal(): Set<string> {
    try {
      const a = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
      if (Array.isArray(a)) return new Set(a.filter((s) => typeof s === 'string'))
    } catch { /* ignore */ }
    return new Set()
  }

  function saveSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.value])) } catch { /* ignore */ }
    if (seenTimer) clearTimeout(seenTimer)
    seenTimer = setTimeout(() => {
      service.users.setCustomStorage(SERVER_SEEN_KEY, [...seen.value]).catch((e) => console.warn('[home] seen save failed', e))
    }, 800)
  }

  function loadFromLocal(): Omit<LayoutItem, 'id'>[] | null {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(a)) {
        const s = sanitize(a)
        // Empty array = user deliberately cleared the desktop, must be respected; only a non-empty
        // array sanitized down to empty (all retired widgets) counts as "no valid save" and falls back to default.
        if (a.length === 0 || s.length) return s
      }
    } catch { /* ignore */ }
    return null
  }

  function loadInitial() {
    const stored = loadFromLocal()
    items.value = (stored ?? DEFAULT).map(tag)
  }

  function serialize(): Omit<LayoutItem, 'id'>[] {
    return items.value.map(({ id, ...rest }) => rest)
  }

  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(serialize())) } catch { /* ignore */ }
  }

  function applyPlan(plan: PlanEntry[]) {
    items.value = applyPlanPure(plan, items.value)
  }

  function pin(desc: Omit<LayoutItem, 'id'>) {
    items.value = [...items.value, tag(desc)]
  }

  function remove(id: string) {
    items.value = items.value.filter((it) => it.id !== id)
  }

  function replaceAll(next: Omit<LayoutItem, 'id'>[]) {
    items.value = sanitize(next).map(tag)
  }

  function clampAll(dims: Dims) {
    items.value = clampToGrid(items.value, dims)
  }

  function bindPhotos(ids: (string | number)[]) {
    let i = 0
    items.value = items.value.map((it) => {
      if (it.kind === 'photo' && !isAssetId(it.key) && ids[i] != null) {
        const next = { ...it, key: String(ids[i]) }
        i++
        return next
      }
      return it
    })
  }

  function save() {
    saveLocal()
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      service.users.setCustomStorage(SERVER_KEY, serialize()).catch((e) => console.warn('[home] server save failed', e))
    }, 800)
  }

  async function loadServer() {
    try {
      let data: unknown = await service.users.getCustomStorage(SERVER_KEY)
      // Backend returns an empty string for a never-stored key (unreadable file passed through as-is) → parse fails → null → keep current state;
      // only a real array (even [] = user cleared the desktop elsewhere) is applied.
      if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = null } }
      if (Array.isArray(data)) {
        const arr = sanitize(data)
        if (data.length === 0 || arr.length) replaceAll(arr)
      }
    } catch (e) { console.warn('[home] server layout load failed', e) }
  }

  function reset() {
    uid = 1
    items.value = DEFAULT.map(tag)
    saveLocal()
  }

  async function loadServerSeen() {
    try {
      let data: unknown = await service.users.getCustomStorage(SERVER_SEEN_KEY)
      if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = null } }
      if (Array.isArray(data)) data.forEach((s) => { if (typeof s === 'string') seen.value.add(s) })
    } catch (e) { console.warn('[home] seen load failed', e) }
  }

  // Absence grace period: after a seen app disappears from decls (container stopped/removed, or the
  // appgrid backend's docker enumeration timed out and returned an empty list), only clean up after it has
  // been absent for this long. ~1.5 polling cycles (30s polling), so a single docker blip or a container in
  // 'restarting' doesn't clear the desktop, while truly stopped/removed apps vanish within 1-2 minutes.
  const MISSING_GRACE_MS = 45_000
  const missingSince = new Map<string, number>()

  /** spec §4 auto-pin to desktop: decls = apps currently in appgrid with desktop=true and running (w/h already clamped).
   *  stoppedKeys = desktop apps appgrid explicitly reports as stopped (exited/dead): clean up immediately, no grace period. */
  function autoPin(decls: DesktopAppDecl[], dims: Dims, stoppedKeys: string[] = []) {
    let changed = false
    const present = new Set(decls.map((d) => d.key))
    const stopped = new Set(stoppedKeys)
    const now = Date.now()
    for (const key of [...seen.value]) {
      if (present.has(key)) { missingSince.delete(key); continue }
      if (!stopped.has(key)) {
        // Vanished from the list entirely: could be docker rm, could be enumeration jitter → debounce via absence grace period
        const since = missingSince.get(key)
        if (since === undefined) { missingSince.set(key, now); continue }
        if (now - since < MISSING_GRACE_MS) continue
      }
      items.value = items.value.filter((it) => !((it.kind === 'app' || it.kind === 'appwidget') && it.key === key))
      seen.value.delete(key)
      missingSince.delete(key)
      changed = true
    }
    for (const d of decls) {
      if (seen.value.has(d.key)) {
        // Already on the desktop: after container labels tighten, the declared range may shrink/shift; the
        // persisted size must be clamped back into the current range, otherwise a locked widget's resize
        // handles are hidden and its size is stuck out of range forever (cannot self-heal).
        if (d.widget) {
          const idx = items.value.findIndex((it) => it.kind === 'appwidget' && it.key === d.key)
          if (idx !== -1) {
            const it = items.value[idx]
            const [cw, ch] = clampSize(it, it.w, it.h, sizeOfItem)
            if (cw !== it.w || ch !== it.h) {
              if (fits(it.c, it.r, cw, ch, it.id, items.value, dims)) {
                // Shrinking, or growing without conflicting with others in place
                items.value = items.value.map((x) => (x.id === it.id ? { ...x, w: cw, h: ch } : x))
                changed = true
              } else {
                // Growing with an in-place conflict/overflow: re-place it treating other items as obstacles; if no spot is found, keep as-is (acceptable degradation)
                const others = items.value.filter((x) => x.id !== it.id)
                const pos = firstFree(cw, ch, others, dims)
                if (pos) {
                  items.value = items.value.map((x) => (x.id === it.id ? { ...x, c: pos.c, r: pos.r, w: cw, h: ch } : x))
                  changed = true
                }
              }
            }
          }
        }
        continue
      }
      // Not in seen doesn't mean not on the desktop: the user may have manually pinned a tile with the same
      // key, so re-check items to avoid stacking duplicate icons/widgets (seen is still recorded below, so the next round skips this check).
      if (!items.value.some((it) => it.kind === 'app' && it.key === d.key)) {
        const pos = firstFree(1, 1, items.value, dims)
        if (pos) items.value = [...items.value, tag({ kind: 'app', key: d.key, c: pos.c, r: pos.r, w: 1, h: 1 })]
      }
      if (d.widget && !items.value.some((it) => it.kind === 'appwidget' && it.key === d.key)) {
        const wpos = firstFree(d.widget.w, d.widget.h, items.value, dims)
        if (wpos) items.value = [...items.value, tag({ kind: 'appwidget', key: d.key, c: wpos.c, r: wpos.r, w: d.widget.w, h: d.widget.h })]
      }
      seen.value.add(d.key) // Record seen even when the desktop is full: don't retry repeatedly; the user can add manually from the add panel
      changed = true
    }
    if (changed) { save(); saveSeen() }
  }

  /** Unified app sweep: desktop app/appwidget tiles whose key is no longer in the app list (liveKeys) →
   *  removed after the same absence grace period, treating manual pins and auto-pins alike (after
   *  uninstall/removal, the desktop aligns with the Dock/installed list).
   *  liveKeys must come from one successful loadGrid (including system apps and LinkApps); do not call on
   *  load failure, or a single API blip starts absence timers for the whole desktop. */
  function sweepGone(liveKeys: Iterable<string>) {
    const live = new Set(liveKeys)
    const now = Date.now()
    const gone = new Set<string>()
    for (const it of items.value) {
      if (it.kind !== 'app' && it.kind !== 'appwidget') continue
      if (live.has(it.key)) { missingSince.delete(it.key); continue }
      const since = missingSince.get(it.key)
      if (since === undefined) { missingSince.set(it.key, now); continue }
      if (now - since >= MISSING_GRACE_MS) gone.add(it.key)
    }
    if (!gone.size) return
    items.value = items.value.filter((it) => !((it.kind === 'app' || it.kind === 'appwidget') && gone.has(it.key)))
    gone.forEach((k) => { seen.value.delete(k); missingSince.delete(k) })
    save(); saveSeen()
  }

  /** Event-push fast path: the container is known to be deleted (daemon destroy event), so clear its slot
   *  immediately without waiting for the absence grace period. By default only items managed by autoPin
   *  (seen) are cleared — manual pins and system icons are immune (destroy also fires on app update/rebuild,
   *  so it must not clear manual tiles). `force` is for explicit "app uninstalled" signals: clears manual
   *  pins too (uninstall-end never fires on update/rebuild, so no collateral damage). */
  function evict(key: string, opts?: { force?: boolean }) {
    if (!opts?.force && !seen.value.has(key)) return
    const before = items.value.length
    items.value = items.value.filter((it) => !((it.kind === 'app' || it.kind === 'appwidget') && it.key === key))
    const hadSeen = seen.value.delete(key)
    missingSince.delete(key)
    if (items.value.length !== before || hadSeen) { save(); saveSeen() }
  }

  return { items, loadInitial, serialize, saveLocal, applyPlan, pin, remove, replaceAll, clampAll, bindPhotos, save, loadServer, reset, autoPin, loadServerSeen, evict, sweepGone }
})

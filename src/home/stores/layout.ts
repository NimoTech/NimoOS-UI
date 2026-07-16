import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LayoutItem, PlanEntry, Dims } from '../grid/types'
import { DEFAULT } from '../grid/defaultLayout'
import { WIDGETS } from '../widgets/registry'
import { applyPlan as applyPlanPure, clampToGrid, firstFree } from '../grid/gridMath'
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
      if (Array.isArray(a) && a.length) return sanitize(a)
    } catch { /* ignore */ }
    return null
  }

  function loadInitial() {
    const stored = loadFromLocal()
    items.value = (stored && stored.length ? stored : DEFAULT).map(tag)
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
      if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = null } }
      const arr = sanitize(data)
      if (arr.length) { replaceAll(arr) }
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

  // 缺席宽限期:seen 应用从 decls 消失(容器停止/删除,或 appgrid 后端 docker 枚举超时
  // 返回空列表)后,持续缺席满该时长才清理。约 1.5 个轮询周期(30s 轮询),使 docker 一次
  // 抖动、容器 restarting 等瞬态不清桌,而真正停止/删除的应用在 1-2 分钟内自动消失。
  const MISSING_GRACE_MS = 45_000
  const missingSince = new Map<string, number>()

  /** spec §4 自动上桌:decls = 当前 appgrid 里 desktop=true 且运行中的应用(w/h 已夹紧)。
   *  stoppedKeys = appgrid 明确报告已停止(exited/dead)的 desktop 应用:立即清理,不等宽限期。 */
  function autoPin(decls: DesktopAppDecl[], dims: Dims, stoppedKeys: string[] = []) {
    let changed = false
    const present = new Set(decls.map((d) => d.key))
    const stopped = new Set(stoppedKeys)
    const now = Date.now()
    for (const key of [...seen.value]) {
      if (present.has(key)) { missingSince.delete(key); continue }
      if (!stopped.has(key)) {
        // 从列表里彻底消失:可能是 docker rm,也可能是枚举抖动 → 缺席宽限期去抖
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
      if (seen.value.has(d.key)) continue
      const pos = firstFree(1, 1, items.value, dims)
      if (pos) items.value = [...items.value, tag({ kind: 'app', key: d.key, c: pos.c, r: pos.r, w: 1, h: 1 })]
      if (d.widget) {
        const wpos = firstFree(d.widget.w, d.widget.h, items.value, dims)
        if (wpos) items.value = [...items.value, tag({ kind: 'appwidget', key: d.key, c: wpos.c, r: wpos.r, w: d.widget.w, h: d.widget.h })]
      }
      seen.value.add(d.key) // 满桌也记 seen:不反复尝试,用户可从添加面板手动加
      changed = true
    }
    if (changed) { save(); saveSeen() }
  }

  return { items, loadInitial, serialize, saveLocal, applyPlan, pin, remove, replaceAll, clampAll, bindPhotos, save, loadServer, reset, autoPin, loadServerSeen }
})

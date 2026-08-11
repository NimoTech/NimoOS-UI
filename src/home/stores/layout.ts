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
        // 空数组 = 用户主动清空桌面,必须尊重;非空数组被 sanitize 清成空
        // (全是已下线 widget)才视为"无有效存档"回落默认。
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
      // 后端对从未存过的 key 返回空串(读不到文件原样透传)→ parse 失败 → null → 保持现状;
      // 真数组(哪怕 [] = 用户在别处清空过桌面)才应用。
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
      if (seen.value.has(d.key)) {
        // 已上桌:容器 label 收紧后声明范围可能收窄/位移，持久化尺寸需夹回当前范围，
        // 否则锁死组件的把手已隐藏，尺寸永久停在范围外（无法自愈）。
        if (d.widget) {
          const idx = items.value.findIndex((it) => it.kind === 'appwidget' && it.key === d.key)
          if (idx !== -1) {
            const it = items.value[idx]
            const [cw, ch] = clampSize(it, it.w, it.h, sizeOfItem)
            if (cw !== it.w || ch !== it.h) {
              if (fits(it.c, it.r, cw, ch, it.id, items.value, dims)) {
                // 缩小,或放大后原地不与他人冲突
                items.value = items.value.map((x) => (x.id === it.id ? { ...x, w: cw, h: ch } : x))
                changed = true
              } else {
                // 放大且原地冲突/越界:以其他项为障碍重新找位搬过去；找不到位则保持原样(可接受的退化)
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

  /** 应用统一清扫:桌面 app/appwidget 磁贴的 key 已不在应用列表(liveKeys)里 → 走同一
   *  缺席宽限期后移除,手动固定与自动上桌一视同仁(卸载/删除后桌面与 Dock/已装列表对齐)。
   *  liveKeys 必须来自一次成功的 loadGrid(含系统应用与 LinkApp),加载失败时不要调用,
   *  否则一次接口抖动会给全桌面起缺席计时。 */
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

  /** 事件推送快路径:确知容器已被删除(daemon destroy 事件),立即清位,不等缺席宽限期。
   *  默认只清 autoPin 管理(seen)的项 —— 手动固定与系统图标免疫(destroy 在应用更新/
   *  重建时也会发,不能拿它清手动磁贴)。`force` 供「应用已卸载」这类明确信号用:
   *  连手动固定的一并清(uninstall-end 不会在更新/重建时发,无误伤)。 */
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

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LayoutItem, PlanEntry, Dims } from '../grid/types'
import { DEFAULT } from '../grid/defaultLayout'
import { WIDGETS } from '../widgets/registry'
import { applyPlan as applyPlanPure, clampToGrid } from '../grid/gridMath'

const KEY = 'nimoos-home-layout-v2'

function sanitize(arr: unknown): Omit<LayoutItem, 'id'>[] {
  if (!Array.isArray(arr)) return []
  return arr.filter((it) => it && (it.kind !== 'widget' || WIDGETS[it.key]))
}

export const useLayoutStore = defineStore('home-layout', () => {
  const items = ref<LayoutItem[]>([])
  let uid = 1
  const tag = (it: Omit<LayoutItem, 'id'>): LayoutItem => ({ ...it, id: 'i' + uid++ })

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

  return { items, loadInitial, serialize, saveLocal, applyPlan, pin, remove, replaceAll, clampAll }
})

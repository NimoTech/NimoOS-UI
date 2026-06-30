import { ref } from 'vue'
import type { LayoutItem, Dims, PlanEntry } from '../grid/types'
import { firstFree, planFootprint } from '../grid/gridMath'
import { WIDGETS } from '../widgets/registry'
import { useLayoutStore } from '../stores/layout'
import { useHomeUiStore } from '../stores/homeUi'

type Desc = Omit<LayoutItem, 'id' | 'c' | 'r'>

export function useAddPanel(dims: Dims) {
  const layout = useLayoutStore()
  const ui = useHomeUiStore()
  const open = ref(false)
  const curTab = ref<'widget' | 'app' | 'folder' | 'photo'>('widget')
  const fsPath = ref('/DATA')

  const widgetUsed = (key: string) => layout.items.some((it) => it.kind === 'widget' && it.key === key)

  function defaultSize(kind: string, key: string): [number, number] {
    if (kind === 'widget') return WIDGETS[key]?.default ?? [2, 2]
    if (kind === 'photo') return [2, 2]
    return [1, 1]
  }

  function pinToFree(desc: Desc): boolean {
    if (desc.kind === 'widget' && widgetUsed(desc.key)) return false
    const pos = firstFree(desc.w, desc.h, layout.items, dims)
    if (!pos) { ui.showToast('这一屏放满了,先移除点东西'); return false }
    layout.pin({ ...desc, c: pos.c, r: pos.r })
    layout.save(); ui.showToast('已固定到主页:' + desc.key)
    return true
  }

  function spawnPlace(desc: Desc, tc: number, tr: number): boolean {
    if (desc.kind === 'widget' && widgetUsed(desc.key)) { ui.showToast('该组件已在主页'); return false }
    const others = planFootprint(tc, tr, desc.w, desc.h, null, layout.items, dims)
    if (!others) { ui.showToast('那儿放不下'); return false }
    layout.applyPlan(others as PlanEntry[])
    layout.pin({ ...desc, c: tc, r: tr })
    layout.save(); ui.showToast('已添加:' + desc.key)
    return true
  }

  function toggleWidget(key: string, w: number, h: number) {
    if (widgetUsed(key)) {
      const it = layout.items.find((i) => i.kind === 'widget' && i.key === key)
      if (it) { layout.remove(it.id); layout.save(); ui.showToast('已移除') }
    } else pinToFree({ kind: 'widget', key, w, h })
  }

  function openLib() { ui.toggleEdit(true); curTab.value = 'widget'; open.value = true }
  function close() { open.value = false }
  function reset() { layout.reset(); close(); ui.showToast('已恢复默认布局') }

  return { open, curTab, fsPath, widgetUsed, defaultSize, pinToFree, spawnPlace, toggleWidget, openLib, close, reset }
}

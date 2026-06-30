import { ref, type Ref } from 'vue'
import type { LayoutItem, Dims } from '../grid/types'
import { fits, planMove, clampSize } from '../grid/gridMath'
import { dragCell, resizeSize } from '../grid/pointerMath'
import { widgetSize } from '../widgets/registry'
import { useLayoutStore } from '../stores/layout'
import { useHomeUiStore } from '../stores/homeUi'

export function resizePreview(item: LayoutItem, w: number, h: number, layout: LayoutItem[], dims: Dims): { mode: 'wysiwyg' | 'ghost'; ok: boolean } {
  if (fits(item.c, item.r, w, h, item.id, layout, dims)) return { mode: 'wysiwyg', ok: true }
  return { mode: 'ghost', ok: !!planMove(item.id, item.c, item.r, w, h, layout, dims) }
}

export function useDragResize(opts: { cell: Ref<number>; gap: Ref<number>; cols: number; rows: number; gridEl: Ref<HTMLElement | null> }) {
  const layout = useLayoutStore()
  const ui = useHomeUiStore()
  const dims: Dims = { cols: opts.cols, rows: opts.rows }
  const ghost = ref<{ c: number; r: number; w: number; h: number; ok: boolean } | null>(null)
  const previewSize = ref<Record<string, { w: number; h: number }>>({})
  const draggingId = ref<string | null>(null)
  const resizingId = ref<string | null>(null)
  const poppingId = ref<string | null>(null)
  let active: { item: LayoutItem; mode: 'drag' | 'resize'; grab: { x: number; y: number }; tc?: number; tr?: number; tw?: number; th?: number } | null = null

  const stride = () => opts.cell.value + opts.gap.value
  const gridRect = () => opts.gridEl.value?.getBoundingClientRect() ?? { left: 0, top: 0 }

  function onPointerDown(e: PointerEvent, item: LayoutItem, mode: 'drag' | 'resize', grabOffset = { x: 0, y: 0 }) {
    active = { item, mode, grab: grabOffset }
    if (mode === 'drag') draggingId.value = item.id; else resizingId.value = item.id
    ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!active) return
    const r = gridRect()
    if (active.mode === 'resize') {
      const [rw, rh] = resizeSize(e.clientX - r.left, e.clientY - r.top, active.item.c, active.item.r, stride(), dims)
      const [w, h] = clampSize(active.item, rw, rh, widgetSize)
      active.tw = w; active.th = h
      const pv = resizePreview(active.item, w, h, layout.items, dims)
      if (pv.mode === 'wysiwyg') { previewSize.value = { ...previewSize.value, [active.item.id]: { w, h } }; ghost.value = null }
      else { delete previewSize.value[active.item.id]; previewSize.value = { ...previewSize.value }; ghost.value = { c: active.item.c, r: active.item.r, w, h, ok: pv.ok } }
    } else {
      const localX = e.clientX - r.left - active.grab.x
      const localY = e.clientY - r.top - active.grab.y
      const { c, r: rr } = dragCell(localX, localY, active.item.w, active.item.h, stride(), dims)
      active.tc = c; active.tr = rr
      ghost.value = { c, r: rr, w: active.item.w, h: active.item.h, ok: !!planMove(active.item.id, c, rr, active.item.w, active.item.h, layout.items, dims) }
    }
  }

  function commit() {
    if (!active) return
    const it = active.item
    if (active.mode === 'resize' && active.tw && (active.tw !== it.w || active.th !== it.h)) {
      const plan = planMove(it.id, it.c, it.r, active.tw, active.th as number, layout.items, dims)
      if (plan) { layout.applyPlan(plan); layout.save(); ui.showToast(`已调整为 ${active.tw}×${active.th}`); pop(it.id) }
      else ui.showToast('空间不够,放不下')
    } else if (active.mode === 'drag' && active.tc) {
      const plan = planMove(it.id, active.tc, active.tr as number, it.w, it.h, layout.items, dims)
      if (plan) { layout.applyPlan(plan); layout.save(); ui.showToast('已放置,旁边组件已让位'); pop(it.id) }
      else ui.showToast('这一屏实在放不下了,已归位')
    }
    reset()
  }
  function onPointerUp() { commit() }
  function reset() { active = null; ghost.value = null; previewSize.value = {}; draggingId.value = null; resizingId.value = null }
  function pop(id: string) { poppingId.value = id; setTimeout(() => { if (poppingId.value === id) poppingId.value = null }, 340) }

  // 测试友好:直接提交一次拖拽到 (c,r)
  function commitDragForTest(c: number, r: number) {
    if (!active) return
    active.mode = 'drag'; active.tc = c; active.tr = r; commit()
  }

  return { ghost, previewSize, draggingId, resizingId, poppingId, onPointerDown, onPointerMove, onPointerUp, commitDragForTest }
}

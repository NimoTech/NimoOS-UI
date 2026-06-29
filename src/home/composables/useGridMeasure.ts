import { ref, type Ref } from 'vue'
import { computeCell } from '../grid/measure'
import { useLayoutStore } from '../stores/layout'

const COLS = 12
const ROWS = 8

export function useGridMeasure(gridEl: Ref<HTMLElement | null>, dockEl: Ref<HTMLElement | null>) {
  const cols = ref(COLS)
  const rows = ref(ROWS)
  const cell = ref(92)
  const gap = ref(16)
  const appSize = ref(70)
  const layout = useLayoutStore()

  function measure() {
    const grid = gridEl.value
    if (!grid) return
    gap.value = parseFloat(getComputedStyle(grid).columnGap) || 16
    const screen = grid.parentElement
    if (!screen) return
    const cs = getComputedStyle(screen)
    const availW = Math.min(
      1480,
      screen.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    )
    const gridTop = grid.getBoundingClientRect().top
    const dockTop = dockEl.value ? dockEl.value.getBoundingClientRect().top : window.innerHeight
    const availH = dockTop - gridTop - 14
    const M = computeCell(availW, availH, COLS, ROWS, gap.value)
    cell.value = M
    grid.style.setProperty('--cols', String(COLS))
    grid.style.setProperty('--cell', M + 'px')
    appSize.value = Math.max(40, M - 22)
    document.documentElement.style.setProperty('--app-size', appSize.value + 'px')
    grid.style.width = COLS * M + (COLS - 1) * gap.value + 'px'
    grid.style.height = ROWS * M + (ROWS - 1) * gap.value + 'px'
    layout.clampAll({ cols: COLS, rows: ROWS })
  }

  // --app-size 影响 Dock 高度→可用高度→格子尺寸,量两遍收敛(engine 383)
  function relayout() { measure(); measure() }

  return { cols, rows, cell, gap, appSize, measure, relayout }
}

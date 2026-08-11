import { ref } from 'vue'
import type { LayoutItem, Dims, PlanEntry } from '../grid/types'
import { firstFree, planFootprint } from '../grid/gridMath'
import { WIDGETS } from '../widgets/registry'
import { useLayoutStore } from '../stores/layout'
import { useHomeUiStore } from '../stores/homeUi'
import { i18n } from '../../i18n'

type Desc = Omit<LayoutItem, 'id' | 'c' | 'r'>

// Module-level singleton refs so all useAddPanel() calls share state (like useDock)
const open = ref(false)
const curTab = ref<'widget' | 'app' | 'folder' | 'photo'>('widget')
// Folder picker state: fsDisk = the selected disk root (null = show the disk list);
// fsPath = the current folder within that disk ('' = none). The picker never goes
// above fsDisk.path, so the raw filesystem root `/` is never exposed.
const fsDisk = ref<{ name: string; path: string } | null>(null)
const fsPath = ref('')

/** Reset singleton state — call in test beforeEach after localStorage.clear() */
export function __resetAddPanelForTest() {
  open.value = false
  curTab.value = 'widget'
  fsDisk.value = null
  fsPath.value = ''
}

export function useAddPanel(dims: Dims) {
  const layout = useLayoutStore()
  const ui = useHomeUiStore()

  const widgetUsed = (key: string) => layout.items.some((it) => it.kind === 'widget' && it.key === key)
  const appWidgetUsed = (key: string) => layout.items.some((it) => it.kind === 'appwidget' && it.key === key)
  const appUsed = (key: string) => layout.items.some((it) => it.kind === 'app' && it.key === key)
  const folderUsed = (path: string) => layout.items.some((it) => it.kind === 'folder' && it.path === path)
  // 查重覆盖 widget/appwidget/app/folder 四种 kind,其余 kind 允许重复添加。
  // folder 按 path 判等:不同盘下允许同名文件夹并存。
  const isDuplicate = (desc: Desc) =>
    (desc.kind === 'widget' && widgetUsed(desc.key)) ||
    (desc.kind === 'appwidget' && appWidgetUsed(desc.key)) ||
    (desc.kind === 'app' && appUsed(desc.key)) ||
    (desc.kind === 'folder' && folderUsed(desc.path ?? ''))
  const existsMsgKey = (kind: Desc['kind']) =>
    kind === 'app' ? 'addPanelAppExists' : kind === 'folder' ? 'addPanelFolderExists' : 'addPanelWidgetExists'

  function defaultSize(kind: string, key: string): [number, number] {
    if (kind === 'widget') return WIDGETS[key]?.default ?? [2, 2]
    if (kind === 'photo') return [2, 2]
    return [1, 1]
  }

  function pinToFree(desc: Desc): boolean {
    if (isDuplicate(desc)) { ui.showToast(i18n.global.t(existsMsgKey(desc.kind))); return false }
    const pos = firstFree(desc.w, desc.h, layout.items, dims)
    if (!pos) { ui.showToast(i18n.global.t('addPanelFull')); return false }
    layout.pin({ ...desc, c: pos.c, r: pos.r })
    layout.save()
    return true
  }

  function spawnPlace(desc: Desc, tc: number, tr: number): boolean {
    if (isDuplicate(desc)) { ui.showToast(i18n.global.t(existsMsgKey(desc.kind))); return false }
    const others = planFootprint(tc, tr, desc.w, desc.h, null, layout.items, dims)
    if (!others) { ui.showToast(i18n.global.t('addPanelNoRoom')); return false }
    layout.applyPlan(others as PlanEntry[])
    layout.pin({ ...desc, c: tc, r: tr })
    layout.save(); ui.showToast(i18n.global.t('addPanelAddedToast', { key: desc.key }))
    return true
  }

  function toggleWidget(key: string, w: number, h: number) {
    if (isDuplicate({ kind: 'widget', key, w, h })) {
      const it = layout.items.find((i) => i.kind === 'widget' && i.key === key)
      if (it) { layout.remove(it.id); layout.save(); ui.showToast(i18n.global.t('addPanelRemovedToast')) }
    } else pinToFree({ kind: 'widget', key, w, h })
  }

  function openLib() { ui.toggleEdit(true); curTab.value = 'widget'; open.value = true }
  function close() { open.value = false }
  function reset() { layout.reset(); close(); ui.showToast(i18n.global.t('addPanelResetToast')) }

  return { open, curTab, fsDisk, fsPath, widgetUsed, appWidgetUsed, defaultSize, pinToFree, spawnPlace, toggleWidget, openLib, close, reset }
}

import type { WidgetSize } from '../grid/types'
import { appWidgetRange } from './appWidgetSize'
import { useAppsStore } from '../stores/apps'

const ICON = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 1.8"/>',
  storage: '<ellipse cx="12" cy="5.6" rx="7" ry="2.6"/><path d="M5 5.6v12.8c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V5.6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
  network: '<path d="M2.5 9.2a14 14 0 0 1 19 0"/><path d="M6 12.8a9 9 0 0 1 12 0"/><path d="M9.4 16.4a4 4 0 0 1 5.2 0"/><path d="M12 20h.01"/>',
  ai: '<path d="M12 3.5c.45 3.3 1.7 4.55 5 5-3.3.45-4.55 1.7-5 5-.45-3.3-1.7-4.55-5-5 3.3-.45 4.55-1.7 5-5Z"/>',
  events: '<path d="M8.5 6h11M8.5 12h11M8.5 18h11"/><circle cx="4.3" cy="6" r="1.1"/><circle cx="4.3" cy="12" r="1.1"/><circle cx="4.3" cy="18" r="1.1"/>',
  gpu: '<rect x="3" y="6.5" width="18" height="11" rx="2"/>',
  cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="10" y="10" width="4" height="4" rx="1"/>',
}

// `title` / `desc` hold i18n keys (translated at render via t()) — see WidgetCard/AddPanel/GridItem.
export interface WidgetMeta {
  title: string; icon: string; desc: string; extra?: string
  min: [number, number]; max: [number, number]; default: [number, number]; live?: boolean
}

export const WIDGETS: Record<string, WidgetMeta> = {
  clock:   { title: 'widgetClockTitle', icon: ICON.clock, desc: 'widgetClockDesc', extra: 'clock', min: [2, 1], max: [4, 2], default: [2, 2] },
  storage: { title: 'widgetStorageTitle', icon: ICON.storage, desc: 'widgetStorageDesc', min: [2, 2], max: [4, 2], default: [4, 2], live: true },
  network: { title: 'widgetNetworkTitle', icon: ICON.network, desc: 'widgetNetworkDesc', min: [2, 2], max: [4, 4], default: [4, 3], live: true },
  ai:      { title: 'widgetAiTitle', icon: ICON.ai, desc: 'widgetAiDesc', min: [2, 2], max: [4, 4], default: [4, 4] },
  events:  { title: 'widgetEventsTitle', icon: ICON.events, desc: 'widgetEventsDesc', extra: 'events', min: [2, 2], max: [2, 4], default: [2, 4], live: true },
  gpu:     { title: 'widgetGpuTitle', icon: ICON.gpu, desc: 'widgetGpuDesc', min: [2, 2], max: [4, 2], default: [2, 2], live: true },
  cpu:     { title: 'widgetCpuTitle', icon: ICON.cpu, desc: 'widgetCpuDesc', extra: 'cpu', min: [2, 2], max: [4, 3], default: [4, 2], live: true },
}

export const WIDGET_KEYS = Object.keys(WIDGETS)

export function widgetSize(key: string): WidgetSize | undefined {
  const w = WIDGETS[key]
  return w ? { min: w.min, max: w.max } : undefined
}

export { APP_WIDGET_SIZE } from './appWidgetSize'

export function sizeOfItem(it: { kind: string; key: string }): WidgetSize | undefined {
  // 应用自带范围就用自带的(夹进全局),否则全局 2×1..4×4
  if (it.kind === 'appwidget') return appWidgetRange(useAppsStore().app(it.key)?.widget)
  if (it.kind === 'widget') return widgetSize(it.key)
  return undefined
}

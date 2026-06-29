const ICON_STORAGE = '<ellipse cx="12" cy="5.6" rx="7" ry="2.6"/><path d="M5 5.6v12.8c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V5.6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>'
const ICON_EVENTS = '<path d="M8.5 6h11M8.5 12h11M8.5 18h11"/><circle cx="4.3" cy="6" r="1.1"/><circle cx="4.3" cy="12" r="1.1"/><circle cx="4.3" cy="18" r="1.1"/>'

export interface EventItem { uuid: string; ts: number; title: string; icon: string }

export function i18nName(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string' && v.trim().charAt(0) === '{') {
    try { const o = JSON.parse(v); return o.zh_cn || o.en_us || Object.values(o)[0] || '' } catch { /* ignore */ }
  }
  return typeof v === 'string' ? v : String(v)
}

export function eventInfo(name: string, props?: Record<string, unknown>): { title: string; icon: string } {
  const P = props || {}
  const model = (P['local-storage:model'] || P['local-storage:vendor'] || '') as string
  const app = i18nName(P['app:title']) || (P['app:name'] as string) || '应用'
  if (name === 'local-storage:disk:added') return { title: model ? '新磁盘接入：' + model : '检测到新磁盘', icon: ICON_STORAGE }
  if (name === 'local-storage:disk:removed') return { title: model ? '磁盘已移除：' + model : '磁盘已移除', icon: ICON_STORAGE }
  if (name.indexOf('app:install') === 0) return { title: app + ' 安装' + (/end$/.test(name) ? '完成' : /error$/.test(name) ? '失败' : '中'), icon: ICON_EVENTS }
  if (name.indexOf('app:apply-changes') === 0) return { title: app + ' 设置已更新', icon: ICON_EVENTS }
  if (name.indexOf('app:update') === 0) return { title: app + ' 已更新', icon: ICON_EVENTS }
  return { title: name, icon: ICON_EVENTS }
}

export function toEvent(name: string, props: Record<string, unknown>, ts: number | string, uuid?: string): EventItem {
  const info = eventInfo(name, props)
  return { uuid: uuid || name + ':' + ts, ts: Number(ts) || Date.now(), title: info.title, icon: info.icon }
}

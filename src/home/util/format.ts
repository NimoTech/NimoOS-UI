import { i18n } from '../../i18n'

// engine.js 469-477
function sizeUnit(bytes: number): [string, string] {
  bytes = Number(bytes) || 0
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  let s: string
  if (i === 0) {
    s = String(Math.round(n))
  } else if (n >= 100) {
    s = String(Math.round(n))
  } else {
    // For values < 100, show 1 decimal but strip trailing .0
    s = parseFloat(n.toFixed(1)).toString()
  }
  return [s, u[i]]
}
export const fmtSize = (b: number): string => sizeUnit(b).join(' ')
export const fmtSpeed = (b: number): string => sizeUnit(b).join(' ') + '/s'

// engine.js 61
export function heatColor(t: number | null | undefined): string {
  return t == null ? 'var(--accent)' : t < 60 ? 'var(--good)' : t < 80 ? '#ffcc66' : '#ff6b6b'
}

// engine.js 590-597 — now 注入便于测试(默认取当前时间由调用方传)
export function relTime(ts: number, now: number = Date.now()): string {
  const g = i18n.global
  const diff = now - ts
  if (diff < 0 || diff < 60000) return g.t('homeRelJustNow')
  if (diff < 3600000) return g.t('homeRelMinutes', { n: Math.floor(diff / 60000) })
  if (diff < 86400000) return g.t('homeRelHours', { n: Math.floor(diff / 3600000) })
  const d = new Date(ts)
  return g.t('clockDate', { m: d.getMonth() + 1, d: d.getDate() })
}

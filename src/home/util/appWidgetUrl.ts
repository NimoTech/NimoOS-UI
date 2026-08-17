export interface AppWidgetTarget {
  scheme?: string
  hostname?: string
  port?: string | number
  widget?: { path?: string }
}

export interface AppWidgetUrlOpts { host: string; origin: string; theme: string; lang: string }

// iframe widget URL (spec §5.3): app self-hosts the widget page; desktop adds theme/lang/home parameters
export function appWidgetUrl(a: AppWidgetTarget, opts: AppWidgetUrlOpts): string | null {
  const path = a.widget?.path
  if (!path || !a.port) return null
  const scheme = a.scheme || 'http'
  const host = a.hostname || opts.host
  const p = path.startsWith('/') ? path : '/' + path
  const q = `theme=${encodeURIComponent(opts.theme)}&lang=${encodeURIComponent(opts.lang)}&home=${encodeURIComponent(opts.origin)}`
  return `${scheme}://${host}:${a.port}${p}${p.includes('?') ? '&' : '?'}${q}`
}

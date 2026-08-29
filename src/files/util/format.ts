const SIZES = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']

export function renderSize(bytes: number | string): string {
  const n = typeof bytes === 'string' ? Number(bytes) : bytes
  if (!n || n <= 0) return '0 Bytes'
  const i = Math.floor(Math.log(n) / Math.log(1024))
  if (i === 0) return `${n} ${SIZES[0]}`
  return `${parseFloat((n / 1024 ** i).toFixed(2))} ${SIZES[i]}`
}

export function dateFmt(value: string | number | Date): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const locale = (localStorage.getItem('lang') || navigator.language || 'en').replace('_', '-')
  const opts: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
    : { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
  return new Intl.DateTimeFormat(locale, opts).format(d)
}

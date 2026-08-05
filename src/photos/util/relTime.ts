// 智能视图详情页的相对时间格式化,照搬自 Vue2 PhotosSmartViewDetail.vue:262-269,
// 但修两处(见下方注释)。

export function relTime(
  iso: string | null | undefined,
  now: number,
  t: (key: string, params?: Record<string, unknown>) => string,
  locale: string,
): string {
  if (!iso) return ''
  const d = new Date(iso)
  // 新增守卫(偏离登记):Vue2 对坏串(new Date('x') → Invalid Date)会把 "Invalid Date"
  // 渲染给用户;这里对 NaN 时间戳直接返回空串。
  if (Number.isNaN(d.getTime())) return ''
  const diff = (now - d.getTime()) / 1000
  if (diff < 3600) return t('photosSvRelMinutes', { n: Math.max(1, Math.round(diff / 60)) })
  if (diff < 86400) return t('photosSvRelHours', { n: Math.round(diff / 3600) })
  // 修法(偏离登记):Vue2 用 d.toLocaleDateString() 无 locale 参数 ⇒ 跟浏览器 locale。
  // 这里显式传入 i18n locale(照本仓既定写法 locale.replace('_','-') 转 BCP-47 标签,
  // 见 PlacesRail.vue:84 / PlaceDetailPanel.vue:120 / PersonHero.vue:113 的既有先例)。
  const tag = locale.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

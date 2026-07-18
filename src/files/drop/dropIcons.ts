// 设备图标:名字 = `${model}_${online|offline}`(命名规则承 Vue2 deviceIcon computed)。
// 图标为本仓原创绘制(2026-07-18 用户要求替换掉从 Vue2 拷来的第三方素材,并补齐 Vue2 缺失的 mobile_offline)。
// 未知 model 兜底回退 desktop_同状态。
const ICONS = import.meta.glob<string>('./assets/*.svg', { eager: true, query: '?url&no-inline', import: 'default' }) as Record<string, string>
const URL_BY_NAME: Record<string, string> = {}
for (const [path, url] of Object.entries(ICONS)) {
  const m = path.match(/\/([^/]+)\.svg$/)
  if (m) URL_BY_NAME[m[1]] = url
}

export function dropIconUrl(model: string, offline: boolean, isSelf: boolean): string {
  if (isSelf) return URL_BY_NAME['self']
  const state = offline ? 'offline' : 'online'
  return URL_BY_NAME[`${model}_${state}`] || URL_BY_NAME[`desktop_${state}`]
}

export function dropAsset(name: 'add_btn' | 'drop_icon'): string {
  return URL_BY_NAME[name]
}

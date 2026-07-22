/** 商店源 URL 的展示元信息(纯函数)。命名规则逐字移植 Vue2
 *  AppStoreSourceManagement.vue getSourceList:http(s) 取第一段路径;
 *  其它取最后一段去扩展名;解析失败回退去扩展名规则。 */

/** 官方源判定:http(s) URL 第一段路径 === 'NimoTech'。
 *  Vue2 用它把官方源从删除列表里藏掉;New-UI 改为显示 + 徽章 + 不给删除按钮(计划 D1)。 */
export function isOfficialSource(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.pathname.split('/')[1] === 'NimoTech'
  } catch {
    return false
  }
}

export function sourceDisplayName(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const seg = u.pathname.split('/')[1]
      if (seg) return seg
    }
  } catch {
    /* 非标准 URL 落下方规则 */
  }
  const last = url.split('/').filter(Boolean).pop() ?? ''
  const noExt = last.replace(/\.[^.]+$/, '')
  return noExt || url
}

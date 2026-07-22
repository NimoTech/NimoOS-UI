/** 商店源 URL 的展示元信息(纯函数)。命名规则移植 Vue2
 *  AppStoreSourceManagement.vue getSourceList:http(s) 取第一段路径;
 *  其它取最后一段去扩展名;解析失败回退去扩展名规则。
 *  jsDelivr gh 镜像(/gh/<org>/<repo>@ref/…)取 org——第一段是固定的 'gh',无辨识度。 */

/** 官方源判定 = 不给删除按钮 + 「官方」徽章(计划 D1;Vue2 是整个藏出删除列表)。
 *  两类:① NimoTech 自有源(GitHub 首段路径 NimoTech);
 *  ② 出厂默认主店——设备 app-management.conf 预置的
 *    cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@…(CasaOS 血统,真机 id 0)。 */
export function isOfficialSource(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const segs = u.pathname.split('/')
    if (segs[1] === 'NimoTech') return true
    return (
      u.hostname === 'cdn.jsdelivr.net' &&
      segs[1] === 'gh' &&
      segs[2] === 'IceWhaleTech' &&
      (segs[3] ?? '').startsWith('CasaOS-AppStore')
    )
  } catch {
    return false
  }
}

export function sourceDisplayName(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const segs = u.pathname.split('/')
      // jsDelivr gh 镜像:org 才是有效名称('gh' 是路由固定段)
      if (u.hostname === 'cdn.jsdelivr.net' && segs[1] === 'gh' && segs[2]) return segs[2]
      if (segs[1]) return segs[1]
    }
  } catch {
    /* 非标准 URL 落下方规则 */
  }
  const last = url.split('/').filter(Boolean).pop() ?? ''
  const noExt = last.replace(/\.[^.]+$/, '')
  return noExt || url
}

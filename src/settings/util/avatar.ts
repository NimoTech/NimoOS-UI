/* 头像相关的纯 helper。 */

/** 取 access_token。
 *  🔧 plan C13:Vue2 的 avatarUrl 写的是
 *  `this.$store.state.token || localStorage.getItem('access_token')`,而 Vuex 里存的键叫
 *  `access_token`(`state.token` 从来不存在)—— 第一段恒 undefined,一直是靠后面那个兜住的。
 *  这里直接读 localStorage,不复刻那段无效表达式。 */
export function readAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

// Vue2 onFileSelected(:253-254) 的两份名单,逐字照抄(注意 svg 不在名单里)。
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']

/** 本地选文件时的类型闸门。1:1 对位 Vue2 :255(mime 命中 **或** 扩展名命中即通过)。 */
export function isAllowedImageFile(name: string, mime: string): boolean {
  if (ALLOWED_MIMES.includes(mime)) return true
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return ALLOWED_EXTS.includes(name.slice(dot + 1).toLowerCase())
}

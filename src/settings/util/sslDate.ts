/**
 * 对位 Vue2 WebUIHTTPSModal.vue 的 formatDate + formattedEffectiveTime/formattedExpirationTime。
 * 实测本机两个时间都是 Go 的零值 '0001-01-01T00:00:00Z'(未签发证书),必须显示 '---'。
 *
 * 移植纪律:Vue2 的 formatDate 用 try/catch 兜底,但 `new Date('乱码')` **不抛异常** ——
 * 它返回 Invalid Date,于是 getDate() 全是 NaN,界面会显示 "NaN/NaN/NaN"。
 * 这里显式判 Number.isNaN。
 */
export function formatSslDate(iso: string | undefined): string {
  if (!iso || iso.startsWith('0001')) return '---'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '---'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

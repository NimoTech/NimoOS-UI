// SP7-P7a-T6: formatMB —— 智能视图详情页统计行(+ T8 右栏统计四格,不重建)的存储
// 空间格式化。照搬 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue:424-428:
//   const mb = (bytes || 0) / (1024 * 1024)
//   if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
//   return Math.round(mb) + ' MB'
// 单位串 ' GB' / ' MB' 不进 i18n(国际通用缩写,照 P6b formatSpotCoords 方向字母的先例)。
export function formatMB(bytes: number): string {
  const mb = (bytes || 0) / (1024 * 1024)
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
  return Math.round(mb) + ' MB'
}

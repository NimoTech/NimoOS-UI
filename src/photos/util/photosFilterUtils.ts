// SP7-P7b-T1:EXIF / 图库筛选谓词——时间线页与跳库页共用同一套判定,保证两边过滤口径一致。
// Ported from Vue2 NimoOS-UI src/views/Photos/photosFilterUtils.js(27 行),逻辑逐行对应。
//
// D17 / F2 偏离登记:去掉 Vue2 的 `archiveIds` 形参与分支。回源 grep 实证归档六环全死
// (PhotosGrid 从不 emit batch-archive → PhotosTimeline 的监听 / onBatchArchive /
// archiveBatch action / ARCHIVE_BATCH mutation 逐级不可达,`archiveIds` 恒 []),
// New-UI 未迁归档功能,本仓零写入方。相应地 Vue2 那 58 行测试里的 archiveIds 用例也裁掉。
//
// 注意 `date` 的形态:它不是 ISO 串,而是 assetToPhoto(:336)用
// toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' }) 生成的
// 本地化串(如 "May 1, 2023")。Vue2 同源同形态,所以 new Date(date) 这个解析方式照抄,
// 不改读 takenAt(那是另一个字段,行为会变)。

/** 参与 EXIF 过滤的最小照片形状——`Photo`(assetToPhoto.ts:267)结构上兼容。 */
export interface FilterablePhoto {
  date?: string | null
  place?: string | null
  camera?: string | null
}

export interface ExifFilters {
  years?: string[]
  places?: string[]
  cameras?: string[]
}

export function photoYear(photo: FilterablePhoto | null | undefined): string {
  if (!photo || !photo.date) return ''
  const y = new Date(photo.date).getFullYear()
  return Number.isNaN(y) ? '' : String(y)
}

export function matchesExifFilters(
  photo: FilterablePhoto,
  { years = [], places = [], cameras = [] }: ExifFilters = {},
): boolean {
  if (years.length && !years.includes(photoYear(photo))) return false
  if (places.length && !places.includes((photo.place || '').split(',')[0].trim())) return false
  if (cameras.length && !cameras.includes((photo.camera || '').split('·')[0].trim())) return false
  return true
}

export function applyExifFilters<T extends FilterablePhoto>(
  photos: T[] | null | undefined,
  filters: ExifFilters = {},
): T[] {
  return (photos || []).filter(p => matchesExifFilters(p, filters))
}

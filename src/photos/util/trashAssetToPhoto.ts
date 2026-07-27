export interface TrashPhoto {
  id: string | number
  title: string
  isVideo: boolean
  daysLeft: number
  deletedAt: string
  from: string
  sizeMb: string
  size: number
}

export function trashAssetToPhoto(asset: Record<string, unknown>, retentionDays: number, nowDate?: Date): TrashPhoto {
  const now = nowDate || new Date()
  const mimeType = (asset.mimeType as string) || ''
  const isVideo = mimeType.startsWith('video/')
  const deletedRaw = asset.deletedAt as string | undefined
  const deletedAt = deletedRaw ? new Date(deletedRaw) : null
  let daysLeft = retentionDays || 30
  if (deletedAt) {
    const elapsedDays = Math.floor((now.getTime() - deletedAt.getTime()) / 86400000)
    daysLeft = Math.max(0, (retentionDays || 30) - elapsedDays)
  }
  const op = (asset.originalPath as string) || ''
  const parts = op.split('/').filter(Boolean)
  const from = parts.length >= 2 ? parts[parts.length - 2] : 'NAS'
  const fileSize = (asset.fileSize as number) || 0
  return {
    id: asset.id as string | number,
    title: asset.originalName ? String(asset.originalName).replace(/\.[^/.]+$/, '') : (asset.id as string | number as string),
    isVideo,
    daysLeft,
    deletedAt: deletedAt ? deletedAt.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
    from,
    sizeMb: (fileSize / (1024 * 1024)).toFixed(1),
    size: fileSize,
  }
}

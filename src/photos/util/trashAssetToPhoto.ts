import { assetToPhoto, type Photo } from './assetToPhoto'

// Task 7 (Plan H): TrashPhoto used to be a standalone slimmed-down shape. It is now a Photo
// plus the trash-only fields -- a trash bucket's item list can therefore be handed directly
// to useLightbox().openAt(photo, list, startMs) without a second conversion step. `sizeBytes`
// (not `size`): Photo already declares its own `size: string` field with an unrelated meaning.
export interface TrashPhoto extends Photo {
  daysLeft: number
  deletedAt: string
  from: string
  sizeMb: string
  sizeBytes: number
}

export function trashAssetToPhoto(asset: Record<string, unknown>, retentionDays: number, nowDate?: Date): TrashPhoto {
  const now = nowDate || new Date()
  const photo = assetToPhoto(asset)

  const deletedRaw = asset.deletedAt as string | undefined
  const deletedAtDate = deletedRaw ? new Date(deletedRaw) : null
  let daysLeft = retentionDays || 30
  if (deletedAtDate) {
    const elapsedDays = Math.floor((now.getTime() - deletedAtDate.getTime()) / 86400000)
    daysLeft = Math.max(0, (retentionDays || 30) - elapsedDays)
  }

  const op = (asset.originalPath as string) || ''
  const parts = op.split('/').filter(Boolean)
  const from = parts.length >= 2 ? parts[parts.length - 2]! : 'NAS'
  const fileSize = (asset.fileSize as number) || 0

  return {
    ...photo,
    daysLeft,
    deletedAt: deletedAtDate ? deletedAtDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
    from,
    sizeMb: (fileSize / (1024 * 1024)).toFixed(1),
    sizeBytes: fileSize,
  }
}

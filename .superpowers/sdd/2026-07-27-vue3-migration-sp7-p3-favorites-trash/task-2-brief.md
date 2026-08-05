### Task 2: `trashAssetToPhoto` 纯函数移植

**Files:**
- Create: `src/photos/util/trashAssetToPhoto.ts`
- Test: `src/photos/util/__tests__/trashAssetToPhoto.test.ts`

**Interfaces:**
- Consumes(逐字移植源):Vue2 `src/store/modules/photos.js:191-213`。
- Produces(T3/T9 消费):
  - `interface TrashPhoto { id: string | number; title: string; isVideo: boolean; daysLeft: number; deletedAt: string; from: string; sizeMb: string; size: number }`
  - `trashAssetToPhoto(asset: Record<string, unknown>, retentionDays: number, nowDate?: Date): TrashPhoto`

- [ ] **Step 1: 写失败测试**（`nowDate` 注入造确定性;逐字对齐 Vue2 语义）
```ts
import { describe, it, expect } from 'vitest'
import { trashAssetToPhoto } from '../trashAssetToPhoto'
const NOW = new Date('2026-07-27T00:00:00Z')

describe('trashAssetToPhoto', () => {
  it('daysLeft = retention - 已过天数,下限 0', () => {
    const a = { id: '1', mimeType: 'image/jpeg', deletedAt: '2026-07-20T00:00:00Z', originalPath: '/DATA/Gallery/2026/x.jpg', originalName: 'x.jpg', fileSize: 2 * 1024 * 1024 }
    const p = trashAssetToPhoto(a, 30, NOW)
    expect(p.daysLeft).toBe(23) // 30 - 7
    expect(p.isVideo).toBe(false)
    expect(p.from).toBe('2026')  // originalPath 倒数第二段
    expect(p.sizeMb).toBe('2.0')
    expect(p.size).toBe(2 * 1024 * 1024)
    expect(p.title).toBe('x')    // 去扩展名
  })
  it('已超期 daysLeft 钳到 0', () => {
    const a = { id: '2', deletedAt: '2026-01-01T00:00:00Z', fileSize: 0 }
    expect(trashAssetToPhoto(a, 30, NOW).daysLeft).toBe(0)
  })
  it('无 deletedAt 时 daysLeft = retention;from 缺省 NAS;video 判定', () => {
    const a = { id: '3', mimeType: 'video/mp4', originalName: 'clip.mp4', fileSize: 0 }
    const p = trashAssetToPhoto(a, 15, NOW)
    expect(p.daysLeft).toBe(15)
    expect(p.from).toBe('NAS')
    expect(p.isVideo).toBe(true)
    expect(p.deletedAt).toBe('')
  })
  it('无 originalName 时 title = id', () => {
    expect(trashAssetToPhoto({ id: 'zid', fileSize: 0 }, 30, NOW).title).toBe('zid')
  })
})
```

- [ ] **Step 2: RED** — `pnpm vitest run src/photos/util/__tests__/trashAssetToPhoto.test.ts` 失败。

- [ ] **Step 3: 实现**（逐字移植 Vue2 `photos.js:191-213`,只加类型 + 默认 `nowDate`）
```ts
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
```
> 移植核对:与 Vue2 `photos.js:191-213` 逐行等价(`daysLeft`/`from`/`sizeMb`/去扩展名 title 全同);若细节与上有出入,**以 Vue2 为准**并在报告注明。

- [ ] **Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): trashAssetToPhoto 纯函数移植(回收站精简映射)`

---


// New file. One assertion per view -- confirms AskNimoHost is mounted unconditionally on every
// Photos view (except Settings, per Vue2 parity), regardless of whether that view happens to
// already have a <PhotosToastHost /> mount point (preflight F-05: only 6 of the 13 do).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VIEWS = [
  'Photos.vue', 'PhotosFavorites.vue', 'PhotosTrash.vue', 'PhotosAlbums.vue', 'PhotosAlbumDetail.vue',
  'PhotosPeople.vue', 'PhotosPersonDetail.vue', 'PhotosPlaces.vue', 'PhotosPlaceAssets.vue',
  'PhotosSmartViews.vue', 'PhotosSmartViewDetail.vue', 'PhotosMomentDetail.vue', 'PhotosSearch.vue',
]

describe('AskNimoHost mounted on every Photos view (except Settings)', () => {
  for (const view of VIEWS) {
    it(`${view} imports and renders <AskNimoHost />`, () => {
      const text = fs.readFileSync(path.join(SRC, view), 'utf8')
      expect(text).toMatch(/import AskNimoHost from ['"].*AskNimoHost\.vue['"]/)
      expect(text).toMatch(/<AskNimoHost\s*\/>/)
    })
  }

  it('PhotosSettings.vue does NOT mount AskNimoHost (no Vue2 topbar entry there)', () => {
    const text = fs.readFileSync(path.join(SRC, 'PhotosSettings.vue'), 'utf8')
    expect(text).not.toMatch(/AskNimoHost/)
  })
})

import { describe, it, expect } from 'vitest'
import { activeNavId } from '../activeNavId'

const NAV = [
  { id: 'library', route: '/photos' },
  { id: 'favorites', route: '/photos/favorites' },
  { id: 'trash', route: '/photos/trash' },
]

describe('activeNavId', () => {
  it('/photos 精确命中 library,不误伤', () => {
    expect(activeNavId('/photos', NAV)).toBe('library')
  })

  it('/photos/favorites 命中 favorites(最长前缀,不双高亮 library)', () => {
    expect(activeNavId('/photos/favorites', NAV)).toBe('favorites')
  })

  it('/photos/trash 命中 trash', () => {
    expect(activeNavId('/photos/trash', NAV)).toBe('trash')
  })

  it('前瞻:/photos/albums/123 命中最长前缀(若有 albums 条目)', () => {
    const nav2 = [...NAV, { id: 'albums', route: '/photos/albums' }]
    expect(activeNavId('/photos/albums/123', nav2)).toBe('albums')
  })

  it('无匹配返回 null', () => {
    expect(activeNavId('/other', NAV)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { activeNavId } from '../activeNavId'

const NAV = [
  { id: 'library', route: '/photos' },
  { id: 'favorites', route: '/photos/favorites' },
  { id: 'trash', route: '/photos/trash' },
]

describe('activeNavId', () => {
  it('/photos exactly matches library, no false positive', () => {
    expect(activeNavId('/photos', NAV)).toBe('library')
  })

  it('/photos/favorites matches favorites (longest prefix, does not double-highlight library)', () => {
    expect(activeNavId('/photos/favorites', NAV)).toBe('favorites')
  })

  it('/photos/trash matches trash', () => {
    expect(activeNavId('/photos/trash', NAV)).toBe('trash')
  })

  it('lookahead: /photos/albums/123 matches the longest prefix (if an albums entry exists)', () => {
    const nav2 = [...NAV, { id: 'albums', route: '/photos/albums' }]
    expect(activeNavId('/photos/albums/123', nav2)).toBe('albums')
  })

  it('returns null when there is no match', () => {
    expect(activeNavId('/other', NAV)).toBeNull()
  })
})

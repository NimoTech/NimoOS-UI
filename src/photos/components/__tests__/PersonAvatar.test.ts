// PersonAvatar.vue — shared person avatar, used across the People detail page components.
// Three-level fallback: ① personId exists and not failed → real image; ② otherwise personInitial(name)
// non-empty → initial letter; ③ otherwise → person icon. All three use mocked
// service.photos.personFaceThumbnailUrl, don't construct URL manually.
//
// Key regression: Vue2 stores failed state in parent dict and never clears for
// the entire session, doesn't retry when changing avatar (PhotosPeopleView.vue:474,566-571). This
// component stores failed state in its own ref, watches [personId, ver] to reset on change — "after
// failure, changing ver must allow retry" is the core assertion of this test file and cannot be missed.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) =>
        `mock://face/${id}${ver != null && ver !== '' ? `?v=${ver}` : ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonAvatar from '../PersonAvatar.vue'

interface AvatarProps {
  personId: string | number | null
  name?: string
  ver?: string | number | null
  size?: number
  dashed?: boolean
  fav?: boolean
  shape?: 'circle' | 'square'
}

function mountAvatar(props: AvatarProps) {
  return mount(PersonAvatar, { props })
}

describe('PersonAvatar', () => {
  it('Has personId → render <img>, src is the return value of personFaceThumbnailUrl(id, ver) (with ver)', () => {
    const w = mountAvatar({ personId: 'p1', name: 'Alice', ver: 'face9' })
    const img = w.get('[data-test="avatar-img"]')
    expect(img.attributes('src')).toBe('mock://face/p1?v=face9')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('p1', 'face9')
  })

  it('img error → <img> disappears, render uppercase initial letter', async () => {
    const w = mountAvatar({ personId: 'p1', name: 'bob' })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(true)
    await w.get('[data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(w.get('[data-test="avatar-initial"]').text()).toBe('B')
  })

  it('After failure, change ver prop → re-render <img> (failure state resets, not Vue2\'s permanent failure pit)', async () => {
    const w = mountAvatar({ personId: 'p1', name: 'Bob', ver: 'v1' })
    await w.get('[data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)

    await w.setProps({ ver: 'v2' })
    const img = w.find('[data-test="avatar-img"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('mock://face/p1?v=v2')
  })

  it('After failure, change personId prop (same id type) → also re-render <img>', async () => {
    const w = mountAvatar({ personId: 'p1', name: 'Bob' })
    await w.get('[data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)

    await w.setProps({ personId: 'p2' })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(true)
  })

  it('No personId, has name → directly show initial letter, don\'t render <img>', () => {
    const w = mountAvatar({ personId: null, name: 'carol' })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(w.get('[data-test="avatar-initial"]').text()).toBe('C')
  })

  it('Both personId and name absent → render person icon, don\'t render <img> or initial letter', () => {
    const w = mountAvatar({ personId: null })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-test="avatar-initial"]').exists()).toBe(false)
    expect(w.find('[data-test="avatar-icon"]').exists()).toBe(true)
  })

  it('name is empty string, personId is null → same as above falls to icon (personInitial empty string fallback)', () => {
    const w = mountAvatar({ personId: null, name: '' })
    expect(w.find('[data-test="avatar-icon"]').exists()).toBe(true)
  })

  it('Numeric personId also generates URL correctly (iron rule: id may be numeric)', () => {
    const w = mountAvatar({ personId: 42, ver: 7 })
    const img = w.get('[data-test="avatar-img"]')
    expect(img.attributes('src')).toBe('mock://face/42?v=7')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(42, 7)
  })

  it('size affects root element inline width/height; defaults to 72 when not passed', () => {
    const w = mountAvatar({ personId: null, size: 48 })
    const style = w.element.getAttribute('style') || ''
    expect(style).toContain('width: 48px')
    expect(style).toContain('height: 48px')

    const w2 = mountAvatar({ personId: null })
    const style2 = w2.element.getAttribute('style') || ''
    expect(style2).toContain('width: 72px')
    expect(style2).toContain('height: 72px')
  })

  it('When dashed is true, add corresponding class; default false don\'t add', () => {
    const w = mountAvatar({ personId: null, dashed: true })
    expect(w.classes()).toContain('is-dashed')

    const w2 = mountAvatar({ personId: null })
    expect(w2.classes()).not.toContain('is-dashed')
  })

  it('When fav is true, render favorite star badge; default false don\'t render', () => {
    const w = mountAvatar({ personId: null, fav: true })
    expect(w.find('[data-test="avatar-fav"]').exists()).toBe(true)

    const w2 = mountAvatar({ personId: null })
    expect(w2.find('[data-test="avatar-fav"]').exists()).toBe(false)
  })

  // Favorite star badge changed to "offset right above the ring" (following Vue2 photos-people.scss:150-156).
  // The only real anchor point is size=124 (the 20px in scss:165 is dead code in Vue2, see component
  // comment); both dimensions and offset scale proportionally by 24/124, 34/124, etc.
  const favStyleOf = (size: number) =>
    mountAvatar({ personId: null, fav: true, size }).find('[data-test="avatar-fav"]').attributes('style') ?? ''

  it('Favorite star badge exactly reproduces 24px / 34px on Vue2\'s only real anchor point size=124', () => {
    const s = favStyleOf(124)
    expect(s).toContain('width: 24px')
    expect(s).toContain('height: 24px')
    expect(s).toContain('translateX(34px)')
  })

  it('Favorite star badge\'s dimensions and offset scale proportionally with size (not fixed to one size)', () => {
    // 84 → round(84*24/124)=16, round(84*34/124)=23
    expect(favStyleOf(84)).toContain('width: 16px')
    expect(favStyleOf(84)).toContain('translateX(23px)')
    // Offset strictly monotonically increases, proving continuous scaling by size
    const offsets = [32, 48, 84, 124].map((n) => Number(/translateX\((\d+)px\)/.exec(favStyleOf(n))![1]))
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
    expect(new Set(offsets).size).toBe(offsets.length)
  })

  it('Star badge on small avatars doesn\'t consume the avatar: width starts at 15px and never exceeds 1/2 of avatar', () => {
    for (const size of [24, 32, 48, 72, 84, 124]) {
      const px = Number(/width: (\d+)px/.exec(favStyleOf(size))![1])
      expect(px).toBeGreaterThanOrEqual(15)          // Lower bound: any smaller can't be recognized as star
      expect(px).toBeLessThanOrEqual(24)             // Upper bound: Vue2 original value
      expect(px).toBeLessThan(size)                  // Never completely cover the avatar
      if (size >= 48) expect(px / size).toBeLessThanOrEqual(0.5)
    }
    // Regression nail: before fix, 48px avatar was paired with fixed 24px star badge (occupying half width, pressing on center)
    expect(favStyleOf(48)).toContain('width: 15px')
  })

  // Task 8 additive extension (MergeReviewDialog-only): when shape='square', the ring becomes square with
  // rounded corners (border-radius:12px), default ('circle' or not passed) must remain completely unchanged
  // — this is an additive extension of T5 contract, cannot change existing default behavior.
  it("When shape='square', add is-square class; default ('circle'/not passed) don't add", () => {
    const w = mountAvatar({ personId: null, shape: 'square' })
    expect(w.classes()).toContain('is-square')

    const w2 = mountAvatar({ personId: null, shape: 'circle' })
    expect(w2.classes()).not.toContain('is-square')

    const w3 = mountAvatar({ personId: null })
    expect(w3.classes()).not.toContain('is-square')
  })

  it('Ring unconditionally has a hair-line border (Vue2 scss:124), dashed only changes line style', () => {
    // Non-dashed state must also have border — Named section 84px avatar previously lacked this border
    expect(mountAvatar({ personId: null }).classes()).not.toContain('is-dashed')
    expect(mountAvatar({ personId: null, dashed: true }).classes()).toContain('is-dashed')
    // Specific line style is given by scoped CSS (jsdom doesn't parse scoped styles), here we lock the
    // structural contract: ring node always exists and only one, dashed state doesn't rely on extra nodes
    // but on class overriding border-style.
    expect(mountAvatar({ personId: null }).findAll('.person-avatar-ring')).toHaveLength(1)
  })
})

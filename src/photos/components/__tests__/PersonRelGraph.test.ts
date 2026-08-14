// Task 13 (SP7-P5 Person): PersonRelGraph.vue — SVG force-directed relation graph. Copied character-by-character
// geometric values from Vue2 NimoOS-UI src/views/Photos/PhotosRelGraph.vue (94 lines), colors changed to use
// scoped CSS class (SVG presentation attributes don't recognize var(), see component top comment).
//
// Add affordance (explicitly required by brief, Vue2 relation graph nodes not clickable): clicking satellite nodes
// emit open-person, is the only behavior this component adds beyond Vue2, not a defect.
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

import PersonRelGraph from '../PersonRelGraph.vue'
import type { PersonRelation } from '../../composables/usePersonDetail'
import type { Person } from '../../util/peopleView'

function P(over: Partial<Person> = {}): Person {
  return {
    id: 'me', name: 'Me', confidence: 1, count: 10, favorite: false, relation: '',
    coverFaceId: 'cover1', heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    ...over,
  }
}

function mountGraph(props: { relations: PersonRelation[]; person: Person | null }) {
  return mount(PersonRelGraph, { props })
}

describe('PersonRelGraph.vue', () => {
  it('relations is empty → does not render <svg> (follows Vue2 :2 v-if)', () => {
    const w = mountGraph({ relations: [], person: P() })
    expect(w.find('svg').exists()).toBe(false)
  })

  it('viewBox and canvas size copied character-by-character from Vue2 :2 (0 0 760 400, width 100%, height 400)', () => {
    const w = mountGraph({ relations: [{ personId: 1, name: 'A', count: 5 }], person: P() })
    const svg = w.get('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 760 400')
    expect(svg.attributes('width')).toBe('100%')
    expect(svg.attributes('height')).toBe('400')
  })

  it('3 relations → 3 edge lines (.rg-edge) + 3 satellite nodes (.rg-node)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 30 },
      { personId: 2, name: 'B', count: 20 },
      { personId: 3, name: 'C', count: 10 },
    ]
    const w = mountGraph({ relations, person: P() })
    expect(w.findAll('.rg-edge')).toHaveLength(3)
    expect(w.findAll('.rg-node')).toHaveLength(3)
  })

  it('Center circle geometry copied character-by-character from Vue2 :25-33 (r=34, clip r=31, image 62x62, glow r=90)', () => {
    const w = mountGraph({ relations: [{ personId: 1, name: 'A', count: 5 }], person: P() })
    const centerRing = w.get('.rg-center-ring')
    expect(centerRing.attributes('cx')).toBe('380')
    expect(centerRing.attributes('cy')).toBe('200')
    expect(centerRing.attributes('r')).toBe('34')
    expect(centerRing.attributes('stroke-width')).toBe('2')

    const glow = w.get('.rg-glow')
    expect(glow.attributes('r')).toBe('90')
    expect(glow.attributes('cx')).toBe('380')
    expect(glow.attributes('cy')).toBe('200')

    const clip = w.get('#centerClip circle')
    expect(clip.attributes('r')).toBe('31')

    const img = w.get('.rg-center-img')
    expect(img.attributes('width')).toBe('62')
    expect(img.attributes('height')).toBe('62')
    expect(img.attributes('x')).toBe(String(380 - 31))
    expect(img.attributes('y')).toBe(String(200 - 31))
  })

  it('Center avatar href uses personFaceThumbnailUrl(person.id, person.coverFaceId), do not manually construct URL', () => {
    const w = mountGraph({
      relations: [{ personId: 1, name: 'A', count: 5 }],
      person: P({ id: 'me', coverFaceId: 'cover1' }),
    })
    expect(w.get('.rg-center-img').attributes('href')).toBe('mock://face/me?v=cover1')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('me', 'cover1')
  })

  it('Center name taken from person.name, empty string when person is null (doesn\'t crash)', () => {
    const w = mountGraph({ relations: [{ personId: 1, name: 'A', count: 5 }], person: null })
    expect(w.get('.rg-name.rg-center-name').text()).toBe('')
    expect(w.get('.rg-center-img').attributes('href')).toBe('')
  })

  it('Node radius formula 18+strength*10 (outer ring +2), after sorting by count descending, strength=count/maxCount', () => {
    // count 30 is max value → maxCount=30, strength=1 → nodeRadius=28, outer ring r=30.
    // count 15 → strength=0.5 → nodeRadius=23, outer ring r=25.
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 15 },
      { personId: 2, name: 'B', count: 30 },
    ]
    const w = mountGraph({ relations, person: P() })
    const rings = w.findAll('.rg-node-ring')
    // positions internally sorted by count descending first, B(30) ranks first.
    expect(rings[0].attributes('r')).toBe('30')
    expect(rings[1].attributes('r')).toBe('25')
  })

  it('When all count are the same (including all zeros) do not produce NaN — maxCount defaults to 1 (prevent division by zero)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 0 },
      { personId: 2, name: 'B', count: 0 },
    ]
    const w = mountGraph({ relations, person: P() })
    const rings = w.findAll('.rg-node-ring')
    for (const ring of rings) {
      expect(ring.attributes('r')).toBe('20') // 18 + 0*10 + 2 outer ring
      expect(Number.isNaN(Number(ring.attributes('cx')))).toBe(false)
      expect(Number.isNaN(Number(ring.attributes('cy')))).toBe(false)
    }
    const edge = w.get('.rg-edge')
    expect(edge.attributes('stroke-opacity')).toBe('0.2')
    expect(Number.isNaN(Number(edge.attributes('stroke-opacity')))).toBe(false)
  })

  it('Edge width/opacity formula (1+strength*2.2 / 0.20+strength*0.55), count pill at edge midpoint', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: 'A', count: 10 }]
    const w = mountGraph({ relations, person: P() })
    // Single relation, maxCount=10, strength=1.
    const edge = w.get('.rg-edge')
    expect(edge.attributes('stroke-width')).toBe(String(1 + 1 * 2.2))
    expect(edge.attributes('stroke-opacity')).toBe(String(0.2 + 1 * 0.55))

    const angle = 0 * Math.PI * 2 - Math.PI / 2 // i=0, n=1
    const dist = 100 + (1 - 1) * 110
    const x = 380 + Math.cos(angle) * dist
    const y = 200 + Math.sin(angle) * dist
    const midX = (380 + x) / 2
    const midY = (200 + y) / 2

    const pill = w.get('.rg-pill')
    expect(Number(pill.attributes('x'))).toBeCloseTo(midX - 14)
    expect(Number(pill.attributes('y'))).toBeCloseTo(midY - 9)
    expect(pill.attributes('width')).toBe('28')
    expect(pill.attributes('height')).toBe('16')
    expect(pill.attributes('rx')).toBe('8')
  })

  it('Satellite node avatar href uses personFaceThumbnailUrl(personId, coverFaceId)', () => {
    const relations: PersonRelation[] = [{ personId: 42, name: 'A', coverFaceId: 'faceA', count: 10 }]
    const w = mountGraph({ relations, person: P() })
    expect(w.get('.rg-node-img').attributes('href')).toBe('mock://face/42?v=faceA')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(42, 'faceA')
  })

  it('Clicking satellite node → emit open-person with personId (fill in affordance, Vue2 has no such behavior)', async () => {
    const relations: PersonRelation[] = [
      { personId: 101, name: 'A', count: 10 },
      { personId: 102, name: 'B', count: 5 },
    ]
    const w = mountGraph({ relations, person: P() })
    await w.findAll('.rg-node')[1].trigger('click')
    expect(w.emitted('open-person')).toEqual([[102]])
  })

  it('Template contains no bare color literals (hex or rgba()/hsla() functions, fallback assertion to prevent missed rewrites)', () => {
    // Review correction (Important): the original regex only matched hex, missed function-form colors — Vue2 source
    // happens to have one instance fill="rgba(255,255,255,0.8)" (PhotosRelGraph.vue:20, changed to
    // .rg-pill-text class), indicating this path existed in practice and must be blocked together.
    const relations: PersonRelation[] = [{ personId: 1, name: 'A', count: 10 }]
    const w = mountGraph({ relations, person: P() })
    expect(w.html()).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/)
  })
})

// Task 13 (SP7-P5 人物): PersonRelGraph.vue —— SVG 力导关系图。逐字照搬 Vue2
// NimoOS-UI src/views/Photos/PhotosRelGraph.vue(94 行)的几何数值,颜色改走
// scoped CSS class(SVG presentation attribute 不认 var(),见组件顶部注释)。
//
// 补齐 affordance(brief 明确要求,Vue2 关系图节点本不可点):点卫星节点
// emit open-person,是本组件唯一比 Vue2 多出来的行为,不是缺陷。
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
  it('relations 为空 → 不渲染 <svg>(照 Vue2 :2 的 v-if)', () => {
    const w = mountGraph({ relations: [], person: P() })
    expect(w.find('svg').exists()).toBe(false)
  })

  it('viewBox 与画布尺寸逐字照搬 Vue2 :2(0 0 760 400,width 100%,height 400)', () => {
    const w = mountGraph({ relations: [{ personId: 1, name: 'A', count: 5 }], person: P() })
    const svg = w.get('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 760 400')
    expect(svg.attributes('width')).toBe('100%')
    expect(svg.attributes('height')).toBe('400')
  })

  it('3 个关系 → 3 条连线(.rg-edge)+ 3 个卫星节点(.rg-node)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 30 },
      { personId: 2, name: 'B', count: 20 },
      { personId: 3, name: 'C', count: 10 },
    ]
    const w = mountGraph({ relations, person: P() })
    expect(w.findAll('.rg-edge')).toHaveLength(3)
    expect(w.findAll('.rg-node')).toHaveLength(3)
  })

  it('中心圈几何逐字照搬 Vue2 :25-33(r=34,clip r=31,图片 62x62,光晕 r=90)', () => {
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

  it('中心头像 href 走 personFaceThumbnailUrl(person.id, person.coverFaceId),不手拼 URL', () => {
    const w = mountGraph({
      relations: [{ personId: 1, name: 'A', count: 5 }],
      person: P({ id: 'me', coverFaceId: 'cover1' }),
    })
    expect(w.get('.rg-center-img').attributes('href')).toBe('mock://face/me?v=cover1')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('me', 'cover1')
  })

  // Task 6 (Plan D, PR#137 gap-close) fix: this test previously asserted `''` for a null
  // person, which was the pre-fix (wrong) behavior — Vue2's own centerName computed
  // (`(this.person && this.person.name) || this.$t('Unnamed person')`) has ALWAYS fallen back
  // to the Unnamed-person copy here, never an empty string. Updated to match Vue2 truth.
  it('中心名字取自 person.name,person 为 null 时兜底为 Unnamed person(照 Vue2 centerName,不崩)', () => {
    const w = mountGraph({ relations: [{ personId: 1, name: 'A', count: 5 }], person: null })
    expect(w.get('.rg-name.rg-center-name').text()).toBe('未命名人物')
    expect(w.get('.rg-center-img').attributes('href')).toBe('')
  })

  it('节点半径公式 18+strength*10(外环+2),按 count 降序排列后 strength=count/maxCount', () => {
    // count 30 是最大值 → maxCount=30,strength=1 → nodeRadius=28,外环 r=30。
    // count 15 → strength=0.5 → nodeRadius=23,外环 r=25。
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 15 },
      { personId: 2, name: 'B', count: 30 },
    ]
    const w = mountGraph({ relations, person: P() })
    const rings = w.findAll('.rg-node-ring')
    // positions 内部先按 count 降序排序,B(30)排第一。
    expect(rings[0].attributes('r')).toBe('30')
    expect(rings[1].attributes('r')).toBe('25')
  })

  it('全部 count 相同(含全为 0)时不产生 NaN —— maxCount 兜底 1(防除零)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 0 },
      { personId: 2, name: 'B', count: 0 },
    ]
    const w = mountGraph({ relations, person: P() })
    const rings = w.findAll('.rg-node-ring')
    for (const ring of rings) {
      expect(ring.attributes('r')).toBe('20') // 18 + 0*10 + 2 外环
      expect(Number.isNaN(Number(ring.attributes('cx')))).toBe(false)
      expect(Number.isNaN(Number(ring.attributes('cy')))).toBe(false)
    }
    const edge = w.get('.rg-edge')
    expect(edge.attributes('stroke-opacity')).toBe('0.2')
    expect(Number.isNaN(Number(edge.attributes('stroke-opacity')))).toBe(false)
  })

  it('连线宽度/不透明度公式(1+strength*2.2 / 0.20+strength*0.55),计数胶囊在连线中点', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: 'A', count: 10 }]
    const w = mountGraph({ relations, person: P() })
    // 单个关系,maxCount=10,strength=1。
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

  it('卫星节点头像 href 走 personFaceThumbnailUrl(personId, coverFaceId)', () => {
    const relations: PersonRelation[] = [{ personId: 42, name: 'A', coverFaceId: 'faceA', count: 10 }]
    const w = mountGraph({ relations, person: P() })
    expect(w.get('.rg-node-img').attributes('href')).toBe('mock://face/42?v=faceA')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(42, 'faceA')
  })

  // Task 6 fix round 1 (coordinator finding, plain coverage addition — code already verified
  // correct against Vue2 PR#137, so this is GREEN immediately, no RED theater): existing
  // coverage only checked centerName's Unnamed fallback and the initial-glyph fallback; the
  // satellite NAME LABEL (`.rg-name-dim` text, the `pos.name || t('photosPersonUnnamedTitle')`
  // hunk) had no assertion of its own.
  it('name 为空的卫星节点 → 名字标签(.rg-name-dim)渲染 Unnamed person 兜底文案', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '', count: 5 }]
    const w = mountGraph({ relations, person: P() })
    expect(w.get('.rg-name-dim').text()).toBe('未命名人物')
  })

  it('点卫星节点 → emit open-person 带 personId(补齐 affordance,Vue2 无此行为)', async () => {
    const relations: PersonRelation[] = [
      { personId: 101, name: 'A', count: 10 },
      { personId: 102, name: 'B', count: 5 },
    ]
    const w = mountGraph({ relations, person: P() })
    await w.findAll('.rg-node')[1].trigger('click')
    expect(w.emitted('open-person')).toEqual([[102]])
  })

  it('模板里不出现任何裸颜色字面量(十六进制或 rgba()/hsla() 函数式,兜底断言,防照搬漏改)', () => {
    // 评审 Important 修正:原正则只认十六进制,漏了函数式颜色 —— Vue2 源码里
    // 恰好就有一处 fill="rgba(255,255,255,0.8)"(PhotosRelGraph.vue:20,已改成
    // .rg-pill-text class),说明这条路径真实存在过,必须一起堵上。
    const relations: PersonRelation[] = [{ personId: 1, name: 'A', count: 10 }]
    const w = mountGraph({ relations, person: P() })
    expect(w.html()).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/)
  })
})

// Task 6 (Plan D, PR#137 gap-close): three cases ported from Vue2 NimoOS-UI
// tests/photosRelGraph.test.js (commit 03245590) — MAX_GRAPH_NODES cap, avatar-fallback
// initial letter under every avatar, and the co-appearances empty state. All three behaviors
// were entirely missing from this component before this task (verified RED before
// implementation: cap test found 3 <image>s not 13, initial test found no `.rg-avatar-initial`
// text at all, empty-state test found no `.rg-empty` element — see task-6-report.md for the
// captured RED output).
describe('PersonRelGraph.vue — PR#137 移植:节点上限 / 头像首字母兜底 / 空态', () => {
  it('relations 超过 12 个时只渲染 12 个卫星节点 + 1 个中心(共 13 个 <image>,照 Vue2 tests/photosRelGraph.test.js "caps rendered nodes at 12")', () => {
    const relations: PersonRelation[] = Array.from({ length: 20 }, (_, i) => ({
      personId: `p${i}`, name: `P${i}`, count: 20 - i,
    }))
    const w = mountGraph({ relations, person: P() })
    expect(w.findAll('image')).toHaveLength(13)
  })

  it('每个头像下方(中心 + 卫星)都渲染首字母兜底 <text>(照 Vue2 tests/photosRelGraph.test.js "draws an initial-letter fallback under every avatar")', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: 'Zoe', count: 3 }]
    const w = mountGraph({ relations, person: P({ name: 'Amy' }) })
    const initials = w.findAll('.rg-avatar-initial').map((x) => x.text())
    expect(initials).toContain('Z') // 卫星节点首字母
    expect(initials).toContain('A') // 中心首字母
  })

  it('relations 为空时渲染 .rg-empty 空态,文案为 photosPersonRelGraphEmptyTitle/Sub(照 Vue2 tests/photosRelGraph.test.js "renders empty state when no co-appearances")', () => {
    const w = mountGraph({ relations: [], person: P() })
    expect(w.find('svg').exists()).toBe(false)
    const empty = w.get('.rg-empty')
    expect(empty.get('.t').text()).toBe('暂无同框记录')
    expect(empty.get('.d').text()).toBe('当这个人与其他人同框出现在照片里时，关系图会显示在这里。')
  })
})

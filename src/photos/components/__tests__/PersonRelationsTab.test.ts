// Task 13 (SP7-P5 人物): PersonRelationsTab.vue —— 人物详情页「关系」tab。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:187-227:
// 关系图区(段落标题+图例+PersonRelGraph)/ 共现列表(按 count 降序 + 条形)/
// Nimo's read 洞察卡(v-html 拼句,不渲染底部"深挖"按钮,归 SP8)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { PersonRelation } from '../../composables/usePersonDetail'
import type { Person, PlaceGroup } from '../../util/peopleView'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) =>
        `mock://face/${id}${ver != null && ver !== '' ? `?v=${ver}` : ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonRelationsTab from '../PersonRelationsTab.vue'
import PersonRelGraph from '../PersonRelGraph.vue'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function P(over: Partial<Person> = {}): Person {
  return {
    id: 'me', name: '小明', confidence: 1, count: 10, favorite: false, relation: '',
    coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    ...over,
  }
}
const PG = (name: string, count = 1): PlaceGroup => ({ name, count, color: '#000' })

const mounted: VueWrapper[] = []
function mountTab(props: { relations: PersonRelation[]; person: Person | null; places: PlaceGroup[] }) {
  const w = mount(PersonRelationsTab, { props, global: { plugins: [makeI18n()] } })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('PersonRelationsTab.vue', () => {
  it('渲染关系图区段落标题 + 副标题 + 图例(照 Vue2 :189-197)', () => {
    const w = mountTab({ relations: [], person: P(), places: [] })
    const titles = w.findAll('.detail-section-title')
    expect(titles[0].text()).toContain('关系图谱')
    expect(titles[0].get('.sub').text()).toBe('连线粗细 = 共同出现次数')
    const legend = w.get('.legend')
    expect(legend.text()).toContain('频繁 (200+)')
    expect(legend.text()).toContain('偶尔')
  })

  it('渲染共同出现段落标题(照 Vue2 :202,无副标题)', () => {
    const w = mountTab({ relations: [], person: P(), places: [] })
    const titles = w.findAll('.detail-section-title')
    expect(titles[1].text()).toBe('共同出现')
  })

  it('把 relations/person 透传给 PersonRelGraph,并把它的 open-person 转发出去', async () => {
    const relations: PersonRelation[] = [{ personId: 7, name: 'Z', count: 3 }]
    const w = mountTab({ relations, person: P(), places: [] })
    const graph = w.getComponent(PersonRelGraph)
    expect(graph.props('relations')).toEqual(relations)
    expect(graph.props('person')).toEqual(P())
    graph.vm.$emit('open-person', 7)
    expect(w.emitted('open-person')).toEqual([[7]])
  })

  it('共现列表按 count 降序排列(照 :530-532 sortedRelations)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 5 },
      { personId: 2, name: 'B', count: 50 },
      { personId: 3, name: 'C', count: 20 },
    ]
    const w = mountTab({ relations, person: P(), places: [] })
    const rows = w.findAll('.rel-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('B')
    expect(rows[1].text()).toContain('C')
    expect(rows[2].text()).toContain('A')
  })

  // Task 6 fix round 1 (coordinator finding, plain coverage addition — code already verified
  // correct against Vue2 PR#137, so this is GREEN immediately, no RED theater): the rel-row
  // Unnamed-person fallback (PersonRelationsTab.vue:122) had no covering assertion.
  it('name 为空的关系 → 列表行渲染 Unnamed person 兜底文案', () => {
    const relations: PersonRelation[] = [{ personId: 5, name: '', count: 2 }]
    const w = mountTab({ relations, person: P(), places: [] })
    expect(w.get('.rel-row .nm').text()).toBe(zh.photosPersonUnnamedTitle)
  })

  it('条形宽度比例正确(最大项 100%,照 :533-536 relMax)', () => {
    const relations: PersonRelation[] = [
      { personId: 1, name: 'A', count: 25 },
      { personId: 2, name: 'B', count: 100 },
    ]
    const w = mountTab({ relations, person: P(), places: [] })
    const bars = w.findAll('.rel-row .bar > div')
    // 排序后 B(100) 在前 → 100%,A(25) 在后 → 25%。
    expect(bars[0].attributes('style')).toContain('width: 100%')
    expect(bars[1].attributes('style')).toContain('width: 25%')
  })

  it('共现列表每行用 36px PersonAvatar(照 photos-people.scss:547-548 .rel-row .av,brief 原写 32px 是笔误,以 Vue2 源为准),不手拼头像 URL', () => {
    const relations: PersonRelation[] = [{ personId: 9, name: 'A', coverFaceId: 'f9', count: 1 }]
    const w = mountTab({ relations, person: P(), places: [] })
    const img = w.get('.rel-row [data-test="avatar-img"]')
    expect(img.attributes('src')).toBe('mock://face/9?v=f9')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(9, 'f9')
  })

  it('共现计数短语用 photosPersonPhotosTogether({n}),不是裸数字拼接', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: 'A', count: 7 }]
    const w = mountTab({ relations, person: P(), places: [] })
    expect(w.get('.rel-row .ct').text()).toBe('共同出现 7 张照片')
  })

  it('点共现行 → emit open-person 带 personId(照 :208 $emit)', async () => {
    const relations: PersonRelation[] = [{ personId: 33, name: 'A', count: 1 }]
    const w = mountTab({ relations, person: P(), places: [] })
    await w.get('.rel-row').trigger('click')
    expect(w.emitted('open-person')).toEqual([[33]])
  })

  it('洞察卡标题 = photosPersonNimoRead,正文渲染出 <b> 标签(v-html 生效)', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '小红', count: 1 }]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [PG('北京'), PG('上海')] })
    expect(w.get('.rel-insight-card .hd').text()).toContain('Nimo 的解读')
    const p = w.get('[data-test="insight-text"]')
    expect(p.html()).toContain('<b>')
    expect(p.text()).toContain('小红')
    expect(p.text()).toContain('北京')
    expect(p.text()).toContain('上海')
  })

  it('两段拼句用空格连接(照 :584 parts.join(\' \'))', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '小红', count: 1 }]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [PG('北京')] })
    const text = w.get('[data-test="insight-text"]').text()
    expect(text).toBe('小明 最常与 小红 一起出现。 他们的照片集中在 北京。')
  })

  it('无关系无地点 → 洞察卡落到 InsightNone 单句', () => {
    const w = mountTab({ relations: [], person: P({ name: '小明' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toBe('小明 的照片还不够多，暂无法生成洞察。')
  })

  it('nimoReadParts 用 relations[0] 而非排序后第一个(照 :573,关键回归)', () => {
    // count 更大的排在数组第二位,但 relations[0] 才是决定"最常出现"话术的那个人。
    const relations: PersonRelation[] = [
      { personId: 1, name: '小红', count: 1 },
      { personId: 2, name: '小刚', count: 100 },
    ]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toContain('小红')
    expect(w.get('[data-test="insight-text"]').text()).not.toContain('小刚')
  })

  it('人名中的 HTML 特殊字符在 v-html 输出中被转义(XSS 加固,好于 Vue2 的裸插值)', () => {
    const relations: PersonRelation[] = [{ personId: 1, name: '<img src=x onerror=alert(1)>', count: 1 }]
    const w = mountTab({ relations, person: P({ name: '小明' }), places: [] })
    const html = w.get('[data-test="insight-text"]').html()
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('不渲染洞察卡底部"深挖"按钮(归 SP8,照 brief)', () => {
    const w = mountTab({ relations: [{ personId: 1, name: 'A', count: 1 }], person: P(), places: [] })
    expect(w.find('.nimo-btn').exists()).toBe(false)
  })

  it('模板里不出现任何裸颜色字面量(十六进制或 rgba()/hsla() 函数式,兜底断言)', () => {
    // 评审 Important 修正:同 PersonRelGraph.test.ts,原正则漏了函数式颜色。
    const w = mountTab({
      relations: [{ personId: 1, name: 'A', count: 1 }],
      person: P(),
      places: [PG('北京'), PG('上海')],
    })
    expect(w.html()).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/)
  })
})

// 用户验收新增(与 PersonHero 的兜底标题同一批):未命名人物现在能进详情页,洞察卡的
// 句子模板全部带 {name} 槶位,裸 person.name 会渲染成「 的照片还不够多…」这种前置空格的
// 残句。地点 tab(PersonPlacesTab.vue:51)早就用 `personName || photosPersonThisPerson`
// 兜底了,关系 tab 漏了同款处理 —— 这里补齐,两个 tab 的兜底口径统一。
describe('PersonRelationsTab.vue — 无名字人物的洞察卡兜底', () => {
  it('name 为空 + 无关系无地点 → 洞察句用「这个人」而不是留空槶位', () => {
    const w = mountTab({
      relations: [],
      person: P({ name: '' }),
      places: [],
    })
    const text = w.get('[data-test="insight-text"]').text()
    expect(text).toContain('这个人 的照片还不够多')
    expect(text).not.toMatch(/^\s/)
  })

  it('name 只有空白字符 → 同样走兜底', () => {
    const w = mountTab({ relations: [], person: P({ name: '  ' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toContain('这个人 的照片还不够多')
  })

  it('有名字时原样代入,不受兜底影响', () => {
    const w = mountTab({ relations: [], person: P({ name: 'Sara' }), places: [] })
    expect(w.get('[data-test="insight-text"]').text()).toContain('Sara 的照片还不够多')
  })
})

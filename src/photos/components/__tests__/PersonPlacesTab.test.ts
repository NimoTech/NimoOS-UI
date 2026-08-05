// Task 12 (SP7-P5 人物): PersonPlacesTab.vue —— 人物详情页「地点」tab
// (迷你地图 + Top5 图例 + 全部地点卡片条)。纯展示,无 emits,不碰 store。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPersonDetail.vue:157-183。
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import PersonPlacesTab from '../PersonPlacesTab.vue'
import PhotosMiniMap from '../PhotosMiniMap.vue'
import type { PersonPlace } from '../../util/peopleView'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

const mounted: VueWrapper[] = []
function mountTab(props: { places: PersonPlace[]; personName: string }) {
  const w = mount(PersonPlacesTab, { props, global: { plugins: [makeI18n()] } })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

// 6 个不同地点,每个各出现一次(count 全相等,靠稳定排序保留原始顺序),
// 用来钉住"图例只有 5 个、卡片条有全部 6 个"的区分。
function sixPlaces(): PersonPlace[] {
  return Array.from({ length: 6 }, (_, i) => ({
    placeName: `Place${i}`, latitude: 10 + i, longitude: 20 + i,
  }))
}

describe('PersonPlacesTab.vue', () => {
  it('渲染段落标题(照 Vue2 :160 插值 person.name)+ 副标题(:161)', () => {
    const w = mountTab({ places: [], personName: 'Sara' })
    const title = w.get('.detail-section-title')
    expect(title.text()).toContain('Sara')
    expect(title.text()).toContain('去过的地方')
    expect(w.get('.detail-section-title .sub').text()).toBe('你在此人所有照片中拍摄过的地点')
  })

  it('personName 为空时标题回落到 photosPersonThisPerson,不出现空名占位', () => {
    const w = mountTab({ places: [], personName: '' })
    const title = w.get('.detail-section-title')
    // 中文译文原样是 "{name} 去过的地方"(name 与后文之间本就有一个空格,
    // 照旧 zh_CN.json 原译文,不是 bug)。空名兜底后应读作"这个人 去过的地方",
    // 关键是不出现"双空格"或"开头就是空白"这类兜底没生效的痕迹。
    expect(title.text()).toContain('这个人 去过的地方')
    expect(title.text()).not.toMatch(/\s{2,}/)
    expect(title.text()).not.toMatch(/^\s/)
  })

  it('图例只渲染 Top5(第 6 个地点不出现在图例里)', () => {
    const w = mountTab({ places: sixPlaces(), personName: 'Sara' })
    const legendRows = w.get('.legend').findAll('.row')
    expect(legendRows).toHaveLength(5)
    expect(w.get('.legend').text()).not.toContain('Place5')
    for (let i = 0; i < 5; i++) expect(w.get('.legend').text()).toContain(`Place${i}`)
  })

  it('卡片条渲染全部地点(含第 6 个)', () => {
    const w = mountTab({ places: sixPlaces(), personName: 'Sara' })
    const chips = w.get('.place-strip').findAll('.place-chip')
    expect(chips).toHaveLength(6)
    expect(w.get('.place-strip').text()).toContain('Place5')
  })

  it('卡片条每张用 photosPeoplePhotosCount 短语显示计数,不是裸数字', () => {
    const w = mountTab({ places: sixPlaces(), personName: 'Sara' })
    const first = w.get('.place-strip').findAll('.place-chip')[0]
    expect(first.text()).toContain('1 张照片')
  })

  it('地图收到的 points 长度 = 有效坐标数(过滤掉无坐标的地点)', () => {
    const places: PersonPlace[] = [
      { placeName: 'A', latitude: 1, longitude: 2 },
      { placeName: 'B', latitude: null, longitude: null },
      { placeName: 'C' },
    ]
    const w = mountTab({ places, personName: 'Sara' })
    const map = w.getComponent(PhotosMiniMap)
    expect(map.props('points')).toHaveLength(1)
  })

  it('places 为空 → PhotosMiniMap 收到非空 emptyText,且不渲染图例', () => {
    const w = mountTab({ places: [], personName: 'Sara' })
    const map = w.getComponent(PhotosMiniMap)
    expect(map.props('emptyText')).toBeTruthy()
    expect(map.props('emptyText')).toContain('Sara')
    expect(w.find('.legend').exists()).toBe(false)
  })

  it('personName 为空时空态文案回落到"这个人"(照 Vue2 person.name || $t("this person"))', () => {
    const w = mountTab({ places: [], personName: '' })
    const map = w.getComponent(PhotosMiniMap)
    expect(map.props('emptyText')).toContain('这个人')
  })

  it('地图点颜色沿用分组颜色,7 色循环边界在整条链路上也保持一致', () => {
    const places = Array.from({ length: 8 }, (_, i) => ({
      placeName: `P${i}`, latitude: i, longitude: i,
    }))
    const w = mountTab({ places, personName: 'Sara' })
    const map = w.getComponent(PhotosMiniMap)
    const pts = map.props('points') as Array<{ color: string }>
    expect(pts).toHaveLength(8)
    expect(pts[0].color).toBe(pts[7].color) // 索引 0 与 7 都落在 PALETTE[0]
  })
})

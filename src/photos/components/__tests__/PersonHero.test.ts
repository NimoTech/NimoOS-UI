// Task 10 (SP7-P5 人物): PersonHero.vue —— 人物详情页 hero 区。纯展示 + emit,不碰 store,
// 只 mock @nimotech/nimoos-service 的两个 URL builder(照 PersonAvatar.test.ts 的既有 mock)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) =>
      ver ? `mock://face/${id}?v=${ver}` : `mock://face/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PersonHero from '../PersonHero.vue'
import type { Person } from '../../util/peopleView'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    name: 'Sara',
    confidence: 0.9,
    count: 12,
    favorite: false,
    relation: '',
    coverFaceId: null,
    heroAssetId: null,
    firstSeen: null,
    lastSeen: null,
    placesCount: 0,
    ...overrides,
  }
}

const mounted: VueWrapper[] = []
function mountHero(props: { person: Person; relationCount: number; placesCount: number }, i18n = makeI18n()) {
  const w = mount(PersonHero, {
    props,
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

beforeEach(() => {
  document.body.innerHTML = ''
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.personFaceThumbnailUrl.mockClear()
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('PersonHero.vue — 背景层三态', () => {
  it('有 heroAssetId → 背景走 thumbnailUrl(heroAssetId, "large")', () => {
    const w = mountHero({ person: person({ heroAssetId: 'asset9', coverFaceId: 'face1' }), relationCount: 0, placesCount: 0 })
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('asset9', 'large')
    const bg = w.get('[data-test="hero-bg"]')
    expect(bg.attributes('style') || '').toContain('mock://thumb/asset9/large')
    expect(w.find('[data-test="hero-root"]').attributes('data-fallback')).toBe('false')
  })

  it('无 heroAssetId 有 coverFaceId → 背景走 personFaceThumbnailUrl', () => {
    const w = mountHero({ person: person({ coverFaceId: 'face1' }), relationCount: 0, placesCount: 0 })
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('p1', 'face1')
    const bg = w.get('[data-test="hero-bg"]')
    expect(bg.attributes('style') || '').toContain('mock://face/p1?v=face1')
    expect(w.find('[data-test="hero-root"]').attributes('data-fallback')).toBe('false')
  })

  it('两者都无 → data-fallback=true,渐变兜底类而非背景图', () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    expect(w.find('[data-test="hero-root"]').attributes('data-fallback')).toBe('true')
    const bg = w.get('[data-test="hero-bg"]')
    expect(bg.classes()).toContain('is-fallback')
    // 没有背景图 url——style 属性里不应出现 background-image
    expect(bg.attributes('style') || '').not.toContain('background-image')
    // 兜底模式不渲染暗化遮罩(照 Vue2 :1424-1426)
    expect(w.find('[data-test="hero-scrim"]').exists()).toBe(false)
  })
})

describe('PersonHero.vue — 统计', () => {
  it('四项统计数字正确', () => {
    const w = mountHero({ person: person({ count: 1234 }), relationCount: 7, placesCount: 3 })
    expect(w.get('[data-test="hero-stat-photos"] .v').text()).toBe('1,234')
    expect(w.get('[data-test="hero-stat-places"] .v').text()).toBe('3')
    expect(w.get('[data-test="hero-stat-appears"] .v').text()).toBe('7')
  })

  it('count=0 时显示 0(不是空字符串)', () => {
    const w = mountHero({ person: person({ count: 0 }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-stat-photos"] .v').text()).toBe('0')
  })

  it('firstSeen 为 null → 年份与月份都是空,不是 NaN/Invalid Date', () => {
    const w = mountHero({ person: person({ firstSeen: null }), relationCount: 0, placesCount: 0 })
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).toBe('')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Invalid')
  })

  it('firstSeen 为无法解析的字符串 → 同样是空,不是 Invalid Date', () => {
    const w = mountHero({ person: person({ firstSeen: 'not-a-date' }), relationCount: 0, placesCount: 0 })
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).not.toContain('Invalid')
    expect(text).not.toContain('NaN')
  })

  it('firstSeen 有效 → 年份 + 本地化短月份(zh_cn locale 下不强行拼接英文句点)', () => {
    const w = mountHero({ person: person({ firstSeen: '2020-03-15T00:00:00Z' }), relationCount: 0, placesCount: 0 })
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).toContain('2020')
    expect(text).toContain('3月')
    expect(text).not.toContain('.')
  })

  it('偏离登记 9:locale=en_us 时月份走英文短名(不再写死 Vue2 的字面 \'en\')', () => {
    const w = mountHero(
      { person: person({ firstSeen: '2020-03-15T00:00:00Z' }), relationCount: 0, placesCount: 0 },
      makeI18n('en_us'),
    )
    const text = w.get('[data-test="hero-stat-first-seen"] .v').text()
    expect(text).toContain('2020')
    expect(text).toContain('Mar')
  })
})

describe('PersonHero.vue — 简单点击 emit', () => {
  it('点返回 → emit back', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-back"]').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('点收藏星标 → emit toggle-fav', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-fav"]').trigger('click')
    expect(w.emitted('toggle-fav')).toHaveLength(1)
  })

  it('点制作相册 → emit make-album', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-make-album"]').trigger('click')
    expect(w.emitted('make-album')).toHaveLength(1)
  })

  it('点背景 → emit open-hero-picker', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-background"]').trigger('click')
    expect(w.emitted('open-hero-picker')).toHaveLength(1)
  })

  it('返回按钮 aria-label 是 photosPersonBack 译文', () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-back"]').attributes('aria-label')).toBe('返回人物')
  })
})

describe('PersonHero.vue — Edit 菜单', () => {
  it('点触发按钮打开菜单,三项分别点击各 emit 对应事件并收起菜单', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(true)

    await w.get('[data-test="hero-edit-rename"]').trigger('click')
    expect(w.emitted('rename')).toHaveLength(1)
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(false)
  })

  it('合并到另一个人物 → emit merge', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-edit-merge"]').trigger('click')
    expect(w.emitted('merge')).toHaveLength(1)
  })

  it('删除人物 → emit delete', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-edit-delete"]').trigger('click')
    expect(w.emitted('delete')).toHaveLength(1)
  })
})

describe('PersonHero.vue — 关系分组下拉', () => {
  it('四项渲染,当前项打勾', async () => {
    const w = mountHero({ person: person({ relation: 'friend' }), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    expect(options).toHaveLength(4)
    expect(options.map((o) => o.attributes('data-value'))).toEqual(['', 'family', 'friend', 'work'])
    const active = options.find((o) => o.attributes('data-value') === 'friend')
    expect(active?.attributes('data-active')).toBe('true')
    expect(active?.find('[data-test="hero-relation-check"]').exists()).toBe(true)
    const inactive = options.find((o) => o.attributes('data-value') === 'family')
    expect(inactive?.attributes('data-active')).toBe('false')
    expect(inactive?.find('[data-test="hero-relation-check"]').exists()).toBe(false)
  })

  it('relation 为空串 → None 项打勾', async () => {
    const w = mountHero({ person: person({ relation: '' }), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    const noneOpt = options.find((o) => o.attributes('data-value') === '')
    expect(noneOpt?.attributes('data-active')).toBe('true')
  })

  it('点某一项 → emit pick-relation 带正确值并收起菜单', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    const workOpt = options.find((o) => o.attributes('data-value') === 'work')
    await workOpt!.trigger('click')
    expect(w.emitted('pick-relation')).toEqual([['work']])
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(false)
  })

  it('点 None 项 → emit pick-relation 带空串', async () => {
    const w = mountHero({ person: person({ relation: 'family' }), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    const options = w.findAll('[data-test="hero-relation-option"]')
    const noneOpt = options.find((o) => o.attributes('data-value') === '')
    await noneOpt!.trigger('click')
    expect(w.emitted('pick-relation')).toEqual([['']])
  })
})

describe('PersonHero.vue — 两个菜单的关闭交互', () => {
  it('点 document 别处 → 两个菜单都关闭', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(true)
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(false)
  })

  it('按 Esc(document 级派发,bubbles:true)→ 两个菜单都关闭', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-relation-trigger"]').trigger('click')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="hero-relation-menu"]').exists()).toBe(false)
  })

  it('点菜单内部不关闭(mousedown 在 wrap 内部)', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    await w.get('[data-test="hero-edit-menu"]').trigger('mousedown')
    await w.vm.$nextTick()
    expect(w.find('[data-test="hero-edit-menu"]').exists()).toBe(true)
  })

  it('卸载后 document 上不再有本组件的 mousedown/keydown 监听(比对函数引用,成对摘除)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    const addedKeydown = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    expect(addedKeydown).toBeDefined()

    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    // 从 mounted 数组里摘掉,避免 afterEach 重复 unmount
    const idx = mounted.indexOf(w)
    if (idx >= 0) mounted.splice(idx, 1)

    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
    expect(removeSpy).toHaveBeenCalledWith('keydown', addedKeydown![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

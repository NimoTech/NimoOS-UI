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
// 终审 Important 5 的样式断言用:jsdom 不做级联样式计算,读不出 overflow 的真实裁剪行为,
// 只能对 <style> 原文做结构断言(同 color-guard.test.ts / PersonAssetGrid.test.ts 的先例)。
import personHeroRaw from '../PersonHero.vue?raw'
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

  // 终审 Minor 7:hero 的返回钮文案是 t('photosPeople')(「人物」),照 Vue2 :6 的 $t('People');
  // photosPersonBack(「返回人物」)是**人物不存在**空态那个返回按钮的文案,两处不是同一句。
  it("返回按钮文案/aria 都是 t('photosPeople')(不是 photosPersonBack)", () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    const back = w.get('[data-test="hero-back"]')
    expect(back.attributes('aria-label')).toBe(zh.photosPeople)
    expect(back.text()).toBe(zh.photosPeople)
  })

  // 终审 Minor 6 / 7:hero 上不得再出现"弹窗标题"那三条长文案。
  it("Edit 菜单两项用短动词键,收藏 title 用 'Mark as favorite'", async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-fav"]').attributes('title')).toBe(zh.photosPersonMarkFavorite)
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    expect(w.get('[data-test="hero-edit-rename"]').text()).toBe(zh.photosPersonMenuRename)
    expect(w.get('[data-test="hero-edit-merge"]').text()).toBe(zh.photosPersonMenuMergeInto)
    // 反向:弹窗标题那两句不该出现在菜单里
    expect(w.get('[data-test="hero-edit-menu"]').text()).not.toContain(zh.photosPersonRename)
    expect(w.get('[data-test="hero-edit-menu"]').text()).not.toContain(zh.photosPersonMergeInto)
  })

  it("已收藏态 title 切到 photosUnfavorite", () => {
    const w = mountHero({ person: person({ favorite: true }), relationCount: 0, placesCount: 0 })
    expect(w.get('[data-test="hero-fav"]').attributes('title')).toBe(zh.photosUnfavorite)
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

// ── 终审 Important 5:两个下拉菜单不得被祖先 overflow 裁掉 ──────────────────────
describe('PersonHero.vue —— 下拉菜单的裁剪边界', () => {
  // 先剥掉 CSS 注释:这几条规则的注释里恰好写着 `overflow: hidden` 的来龙去脉,
  // 不剥会把注释文本当成声明匹配上。
  const style = (/<style[^>]*>([\s\S]*?)<\/style>/i.exec(personHeroRaw)?.[1] ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  function rule(selector: string): string {
    const m = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(style)
    expect(m, `找不到 ${selector} 规则块`).toBeTruthy()
    return (m as RegExpExecArray)[1]
  }

  it('.person-hero **不得**有 overflow(否则 absolute 锚定的菜单会被整块切掉,z-index 无用)', () => {
    expect(style).not.toBe('')
    expect(rule('.person-hero')).not.toMatch(/overflow\s*:/)
  })

  it('裁剪职责在 .hero-clip 上:它 overflow:hidden 且铺满 hero', () => {
    const clip = rule('.hero-clip')
    expect(clip).toMatch(/overflow\s*:\s*hidden/)
    expect(clip).toMatch(/position\s*:\s*absolute/)
    expect(clip).toMatch(/inset\s*:\s*0/)
  })

  it('模糊背景与暗化遮罩都在 .hero-clip 内(不然 blur(40px)+scale(1.2) 会溢到下方网格)', () => {
    const w = mountHero({
      person: person({ coverFaceId: 'f1' }),
      relationCount: 1,
      placesCount: 1,
    })
    const clip = w.get('[data-test="hero-clip"]')
    expect(clip.find('[data-test="hero-bg"]').exists()).toBe(true)
    expect(clip.find('[data-test="hero-scrim"]').exists()).toBe(true)
    // 菜单不在裁剪层里 —— 它是 .person-hero 的后代,但不是 .hero-clip 的后代。
    expect(clip.find('[data-test="hero-edit-wrap"]').exists()).toBe(false)
  })

  it('菜单挂在裁剪层之外(hero 根下),打开后确实渲染出全部三项', async () => {
    const w = mountHero({ person: person(), relationCount: 0, placesCount: 0 })
    await w.get('[data-test="hero-edit-trigger"]').trigger('click')
    const menu = w.get('[data-test="hero-edit-menu"]')
    expect(menu.element.closest('[data-test="hero-clip"]')).toBeNull()
    expect(w.findAll('[data-test="hero-edit-menu"] button')).toHaveLength(3)
  })
})

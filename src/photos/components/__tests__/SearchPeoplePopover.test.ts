// SP7-P7a-T14: SearchPeoplePopover.vue —— 搜索栏「人物」筛选弹层测试。
// 挂 i18n(真实 zh_cn/en_us 词条),不需要 Pinia(本组件不接触 store)。mock 共享包
// @nimotech/nimoos-service(PersonAvatar 内部会调 personFaceThumbnailUrl)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://face/${id}/${ver ?? ''}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SearchPeoplePopover from '../SearchPeoplePopover.vue'
import searchPeoplePopoverRaw from '../SearchPeoplePopover.vue?raw'
import type { PersonOption } from '../../util/searchUnderstood'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function people(overrides: Partial<PersonOption>[] = []): PersonOption[] {
  const base: PersonOption[] = [
    { id: '1', name: 'Sara', count: 42, coverFaceId: 'face-1' },
    { id: '2', name: 'Tom', count: 7, coverFaceId: '' },
    { id: '3', name: 'Alice', count: 1200, coverFaceId: 'face-3' },
    { id: '4', name: 'Bob', count: 3, coverFaceId: '' },
  ]
  if (overrides.length === 0) return base
  return overrides as PersonOption[]
}

function mountPop(props: { people: PersonOption[]; selected: string[] }, i18n = makeI18n()) {
  return mount(SearchPeoplePopover, { props, global: { plugins: [i18n] } })
}

beforeEach(() => {
  svc.photos.personFaceThumbnailUrl.mockClear()
})

describe('结构清点', () => {
  it('4 人 → 4 个 .face-cell', () => {
    const w = mountPop({ people: people(), selected: [] })
    expect(w.findAll('.face-cell')).toHaveLength(4)
  })

  it('people 为空 → 空态文案、0 格', () => {
    const w = mountPop({ people: [], selected: [] })
    expect(w.findAll('.face-cell')).toHaveLength(0)
    expect(w.get('[data-test="people-empty"]').text()).toBe(zh.photosSearchNoPeopleDetectedYet)
  })
})

describe('头像三级兜底(复用 PersonAvatar)', () => {
  it('coverFaceId 非空 → 有 img,且 personFaceThumbnailUrl 收到该人 id', () => {
    const w = mountPop({ people: people(), selected: [] })
    const cells = w.findAll('.face-cell')
    // Sara(第 1 个)有 coverFaceId
    expect(cells[0]!.find('[data-test="avatar-img"]').exists()).toBe(true)
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('1', 'face-1')
  })

  it('coverFaceId 为空 → 无 img,显示名字首字母', () => {
    const w = mountPop({ people: people(), selected: [] })
    const cells = w.findAll('.face-cell')
    // Tom(第 2 个)无 coverFaceId
    expect(cells[1]!.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(cells[1]!.find('[data-test="avatar-initial"]').text()).toBe('T')
  })
})

describe('选中态', () => {
  it('selected 含某人名 → 该格 data-on="true",其余 false', () => {
    const w = mountPop({ people: people(), selected: ['Tom'] })
    const cells = w.findAll('.face-cell')
    expect(cells[0]!.attributes('data-on')).toBe('false')
    expect(cells[1]!.attributes('data-on')).toBe('true')
  })

  it('点格 → update:selected 增删(新数组,不原地改)', async () => {
    const selected = ['Tom']
    const snapshot = [...selected]
    const w = mountPop({ people: people(), selected })
    const cells = w.findAll('.face-cell')
    await cells[0]!.trigger('click') // 点 Sara(未选)→ 增
    expect(w.emitted('update:selected')).toEqual([[['Tom', 'Sara']]])
    expect(selected).toEqual(snapshot) // 原 prop 数组未被就地改

    await cells[1]!.trigger('click') // 点 Tom(已选)→ 删
    expect(w.emitted('update:selected')![1]).toEqual([[]])
  })
})

describe('搜索过滤', () => {
  it('大小写不敏感', async () => {
    const w = mountPop({ people: people(), selected: [] })
    await w.get('[data-test="people-search"]').setValue('SA')
    expect(w.findAll('.face-cell')).toHaveLength(1)
    expect(w.get('.face-cell-name').text()).toBe('Sara')
  })

  it('过滤到 0 → 空态', async () => {
    const w = mountPop({ people: people(), selected: [] })
    await w.get('[data-test="people-search"]').setValue('zzz-nonexistent')
    expect(w.findAll('.face-cell')).toHaveLength(0)
    expect(w.get('[data-test="people-empty"]').text()).toBe(zh.photosSearchNoPeopleDetectedYet)
  })
})

describe('Apply 按钮计数文案', () => {
  it('selected 为空 → 不含括号', () => {
    const w = mountPop({ people: people(), selected: [] })
    const btn = w.get('[data-test="people-apply-btn"]')
    expect(btn.text()).not.toMatch(/\(\d+\)/)
    expect(btn.text()).toBe(zh.photosSearchApply)
  })

  it('2 人 → 含 (2)', () => {
    const w = mountPop({ people: people(), selected: ['Sara', 'Tom'] })
    const btn = w.get('[data-test="people-apply-btn"]')
    expect(btn.text()).toBe(`${zh.photosSearchApply} (2)`)
  })
})

describe('计数千分位跟 locale', () => {
  it('源文本里 toLocaleString( 带参数(不是裸调用)', () => {
    expect(searchPeoplePopoverRaw).toMatch(/toLocaleString\(\s*\S+/)
  })

  it('Alice 的 count=1200 在 zh_cn 下渲染为带千分位分隔符的字符串', () => {
    const w = mountPop({ people: people(), selected: [] })
    const cells = w.findAll('.face-cell')
    expect(cells[2]!.get('.face-cell-count').text()).toBe((1200).toLocaleString('zh-cn'))
  })
})

describe('死代码不迁(反向断言)', () => {
  it('源文本不含 "?" 三元分支,也不含 photosSearchUnnamed 键', () => {
    expect(searchPeoplePopoverRaw).not.toContain("'?'")
    expect(searchPeoplePopoverRaw).not.toContain('photosSearchUnnamed')
  })
})

describe('脚部按钮 + 冒泡', () => {
  it('点 Cancel → emit cancel;点 Apply → emit apply', async () => {
    const w = mountPop({ people: people(), selected: [] })
    await w.get('[data-test="people-cancel-btn"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('点弹层内部空白不冒泡到宿主(根 @click.stop)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let hostClicked = false
    host.addEventListener('click', () => { hostClicked = true })
    const w = mount(SearchPeoplePopover, {
      props: { people: people(), selected: [] },
      global: { plugins: [makeI18n()] },
      attachTo: host,
    })
    w.get('.fpop').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(hostClicked).toBe(false)
    w.unmount()
    host.remove()
  })
})

describe('样式', () => {
  it('cssCascade:.btn.btn-primary 的 hover 胜出规则含 :hover 且含 -primary', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const winner = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('-primary')
  })

  it('.face-pop-grid 规则含 grid-template-columns: repeat(4, 1fr)', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.face-pop-grid')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('repeat(4, 1fr)')
  })

  it('.fpop 规则宽度是 300px(不是 prop)', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 300px')
  })

  it('.fpop-foot 规则 margin-top 是 14px(与 T12/T13 的 12px 不同,逐条声明真实差异)', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-foot')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-top: 14px')
  })
})

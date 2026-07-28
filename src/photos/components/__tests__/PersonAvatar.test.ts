// Task 5 (SP7-P5 人物): PersonAvatar.vue —— 通用人物头像,T6/T7/T8/T10/T13 共用。
// 三级兜底:①personId 存在且未失败 → 真图;②否则 personInitial(name) 非空 → 首字母;
// ③否则 → person 图标。三者都走 mock 的 service.photos.personFaceThumbnailUrl,不手拼 URL。
//
// 关键回归(brief 偏离登记):Vue2 把失败态记在父组件字典里且整会话不清除,换封面也不重试
// (PhotosPeopleView.vue:474,566-571)。本组件把 failed 收进组件自身 ref,并 watch
// [personId, ver] 变化时复位——「失败后改 ver 要能重试」是本测试文件的核心断言,不能漏。
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
}

function mountAvatar(props: AvatarProps) {
  return mount(PersonAvatar, { props })
}

describe('PersonAvatar', () => {
  it('有 personId → 渲染 <img>,src 是 personFaceThumbnailUrl(id, ver) 的返回值(带 ver)', () => {
    const w = mountAvatar({ personId: 'p1', name: 'Alice', ver: 'face9' })
    const img = w.get('[data-test="avatar-img"]')
    expect(img.attributes('src')).toBe('mock://face/p1?v=face9')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('p1', 'face9')
  })

  it('img error → <img> 消失,渲染大写首字母', async () => {
    const w = mountAvatar({ personId: 'p1', name: 'bob' })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(true)
    await w.get('[data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(w.get('[data-test="avatar-initial"]').text()).toBe('B')
  })

  it('失败后改 ver prop → 重新渲染 <img>(失败态复位,不是 Vue2 的永久失败坑)', async () => {
    const w = mountAvatar({ personId: 'p1', name: 'Bob', ver: 'v1' })
    await w.get('[data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)

    await w.setProps({ ver: 'v2' })
    const img = w.find('[data-test="avatar-img"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('mock://face/p1?v=v2')
  })

  it('失败后改 personId prop(同 id 类型不变)→ 也重新渲染 <img>', async () => {
    const w = mountAvatar({ personId: 'p1', name: 'Bob' })
    await w.get('[data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)

    await w.setProps({ personId: 'p2' })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(true)
  })

  it('无 personId、有 name → 直接首字母,不渲染 <img>', () => {
    const w = mountAvatar({ personId: null, name: 'carol' })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(w.get('[data-test="avatar-initial"]').text()).toBe('C')
  })

  it('personId 与 name 都无 → 渲染 person 图标,不渲染 <img> 也不渲染首字母', () => {
    const w = mountAvatar({ personId: null })
    expect(w.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-test="avatar-initial"]').exists()).toBe(false)
    expect(w.find('[data-test="avatar-icon"]').exists()).toBe(true)
  })

  it('name 为空字符串、personId 为 null → 同上落到图标(personInitial 空串兜底)', () => {
    const w = mountAvatar({ personId: null, name: '' })
    expect(w.find('[data-test="avatar-icon"]').exists()).toBe(true)
  })

  it('数字 personId 也能正确生成 URL(铁律:id 可能是数字)', () => {
    const w = mountAvatar({ personId: 42, ver: 7 })
    const img = w.get('[data-test="avatar-img"]')
    expect(img.attributes('src')).toBe('mock://face/42?v=7')
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(42, 7)
  })

  it('size 影响根元素内联宽高;未传时默认 72', () => {
    const w = mountAvatar({ personId: null, size: 48 })
    const style = w.element.getAttribute('style') || ''
    expect(style).toContain('width: 48px')
    expect(style).toContain('height: 48px')

    const w2 = mountAvatar({ personId: null })
    const style2 = w2.element.getAttribute('style') || ''
    expect(style2).toContain('width: 72px')
    expect(style2).toContain('height: 72px')
  })

  it('dashed 为 true 时加对应 class;默认 false 不加', () => {
    const w = mountAvatar({ personId: null, dashed: true })
    expect(w.classes()).toContain('is-dashed')

    const w2 = mountAvatar({ personId: null })
    expect(w2.classes()).not.toContain('is-dashed')
  })

  it('fav 为 true 时渲染收藏星标;默认 false 不渲染', () => {
    const w = mountAvatar({ personId: null, fav: true })
    expect(w.find('[data-test="avatar-fav"]').exists()).toBe(true)

    const w2 = mountAvatar({ personId: null })
    expect(w2.find('[data-test="avatar-fav"]').exists()).toBe(false)
  })
})

// SP7-P7a-T16: PhotosSearchBar.vue —— 搜索框(D13)。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosSearchBar from '../PhotosSearchBar.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountBar(props: { value?: string; autofocus?: boolean } = {}, attachTo?: HTMLElement) {
  return mount(PhotosSearchBar, {
    props,
    global: { plugins: [i18n] },
    attachTo,
  })
}

describe('结构', () => {
  it('渲染 search 图标 + input', () => {
    const w = mountBar()
    expect(w.find('.search svg').exists()).toBe(true)
    expect(w.find('.search input').exists()).toBe(true)
  })

  it('value 渲染进 input', () => {
    const w = mountBar({ value: 'sunset' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('sunset')
  })

  it('placeholder 是 photosSearchSearchLibrary 的本地化值', () => {
    const w = mountBar()
    expect(w.get('input').attributes('placeholder')).toBe(zh.photosSearchSearchLibrary)
  })
})

describe('submit', () => {
  it('Enter → emit submit 带 trim 后的值', async () => {
    const w = mountBar({ value: '  sunset  ' })
    await w.get('input').trigger('keydown.enter')
    expect(w.emitted('submit')).toEqual([['sunset']])
  })

  it('空串也 emit(结构规格 3,照搬语义)', async () => {
    const w = mountBar({ value: '' })
    await w.get('input').trigger('keydown.enter')
    expect(w.emitted('submit')).toEqual([['']])
  })

  it('全是空白也当空串处理(trim 后为空)', async () => {
    const w = mountBar({ value: '   ' })
    await w.get('input').trigger('keydown.enter')
    expect(w.emitted('submit')).toEqual([['']])
  })
})

describe('value prop 回流(watch 的 !== 守卫)', () => {
  it('value prop 变化 → input 跟着变', async () => {
    const w = mountBar({ value: 'a' })
    await w.setProps({ value: 'b' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('b')
  })

  it('input 里已有用户输入且与 value 不同时,value 未变则不覆盖(不打断用户打字)', async () => {
    const w = mountBar({ value: 'a' })
    await w.get('input').setValue('user is typing')
    // value prop 本身没变(还是 'a'),组件不应该把用户输入的内容覆盖回去。
    await w.setProps({ value: 'a' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('user is typing')
  })
})

describe('autofocus', () => {
  it('autofocus=true → mounted 后 document.activeElement 是 input', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const w = mountBar({ autofocus: true }, el)
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
    el.remove()
  })

  it('autofocus 未传 → 不自动聚焦', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const w = mountBar({}, el)
    expect(document.activeElement).not.toBe(w.get('input').element)
    w.unmount()
    el.remove()
  })
})

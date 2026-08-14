// SP7-P7a-T16: PhotosSearchBar.vue — search bar (D13).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosSearchBar from '../PhotosSearchBar.vue'
import photosSearchBarRaw from '../PhotosSearchBar.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountBar(props: { value?: string; autofocus?: boolean } = {}, attachTo?: HTMLElement) {
  return mount(PhotosSearchBar, {
    props,
    global: { plugins: [i18n] },
    attachTo,
  })
}

describe('Structure', () => {
  it('Renders search icon + input', () => {
    const w = mountBar()
    expect(w.find('.search svg').exists()).toBe(true)
    expect(w.find('.search input').exists()).toBe(true)
  })

  // fix round 1 · I4 (merged in review): inline svg glyph path must be asserted character-by-character against Vue2
  // PhotosIcon.vue to prevent omission/miscopying (this period required 6 reworks due to this).
  it('Search icon path d is character-by-character identical to Vue2 PhotosIcon.vue search branch', () => {
    const w = mountBar()
    expect(w.get('.search svg path').attributes('d')).toBe('m20 20-3.5-3.5')
  })

  it('value renders into input', () => {
    const w = mountBar({ value: 'sunset' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('sunset')
  })

  // fix round 1 · I3 (review-verified true defect): first version mistakenly used `photosSearchSearchLibrary`
  // (="search your library" — that sentence is actually Vue2's pre-search state <h2>, not input placeholder),
  // causing placeholder on search page to collide with the <h2> directly below it. Changed to newly added key
  // `photosSearchSearchBarPlaceholder` (sourced from Vue2 `PhotosTopbar.vue:19` real placeholder copy).
  it('placeholder is the localized value of photosSearchSearchBarPlaceholder (not the pre-search state <h2> sentence)', () => {
    const w = mountBar()
    expect(w.get('input').attributes('placeholder')).toBe(zh.photosSearchSearchBarPlaceholder)
    expect(w.get('input').attributes('placeholder')).not.toBe(zh.photosSearchSearchLibrary)
  })
})

// fix round 1 · I5 (plan hard constraint, merged in review): anchor non-color visual property (search bar height) assertions.
describe('Style: anchor non-color visual properties', () => {
  it('.search height is 34px (anchor rule body first, then assert property)', () => {
    const style = extractStyleBlock(photosSearchBarRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.search')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('height: 34px')
  })
})

describe('submit', () => {
  it('Enter → emit submit with trimmed value', async () => {
    const w = mountBar({ value: '  sunset  ' })
    await w.get('input').trigger('keydown.enter')
    expect(w.emitted('submit')).toEqual([['sunset']])
  })

  it('Empty string also emits (spec item 3, semantics preserved)', async () => {
    const w = mountBar({ value: '' })
    await w.get('input').trigger('keydown.enter')
    expect(w.emitted('submit')).toEqual([['']])
  })

  it('All whitespace is also treated as empty string (empty after trim)', async () => {
    const w = mountBar({ value: '   ' })
    await w.get('input').trigger('keydown.enter')
    expect(w.emitted('submit')).toEqual([['']])
  })
})

describe('value prop flowback (watch !== guard)', () => {
  it('value prop changes → input follows', async () => {
    const w = mountBar({ value: 'a' })
    await w.setProps({ value: 'b' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('b')
  })

  it('When input has user input differing from value, unchanged value prop does not overwrite (do not interrupt user typing)', async () => {
    const w = mountBar({ value: 'a' })
    await w.get('input').setValue('user is typing')
    // value prop hasn't changed (still 'a'), component should not overwrite user's input back.
    await w.setProps({ value: 'a' })
    expect((w.get('input').element as HTMLInputElement).value).toBe('user is typing')
  })
})

describe('autofocus', () => {
  it('autofocus=true → after mount, document.activeElement is input', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const w = mountBar({ autofocus: true }, el)
    expect(document.activeElement).toBe(w.get('input').element)
    w.unmount()
    el.remove()
  })

  it('autofocus not passed → no auto-focus', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const w = mountBar({}, el)
    expect(document.activeElement).not.toBe(w.get('input').element)
    w.unmount()
    el.remove()
  })
})

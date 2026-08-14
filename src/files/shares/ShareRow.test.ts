import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import ShareRow from './ShareRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const row = { id: 5, path: '/DATA/Documents', name: 'Documents' }

function mountRow(selected: boolean) {
  return mount(ShareRow, { props: { row, selected }, global: { plugins: [i18n] } })
}

describe('ShareRow selection checkbox', () => {
  it('renders a checkbox whose checked state follows the selected prop', () => {
    const off = mountRow(false)
    const on = mountRow(true)
    expect((off.find('input.share-check-box').element as HTMLInputElement).checked).toBe(false)
    expect((on.find('input.share-check-box').element as HTMLInputElement).checked).toBe(true)
    off.unmount(); on.unmount()
  })

  it('adds the selected class to the row body when selected', () => {
    const on = mountRow(true)
    const off = mountRow(false)
    expect(on.find('.share-row-main').classes()).toContain('selected')
    expect(off.find('.share-row-main').classes()).not.toContain('selected')
    on.unmount(); off.unmount()
  })

  it('emits toggle-select with the row when the checkbox changes', async () => {
    const w = mountRow(false)
    await w.find('input.share-check-box').setValue(true)
    expect(w.emitted('toggle-select')).toHaveLength(1)
    expect(w.emitted('toggle-select')![0]).toEqual([row])
    w.unmount()
  })
})

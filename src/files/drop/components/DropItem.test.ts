import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DropItem from './DropItem.vue'
import { i18n } from '../../../i18n'

const device = (over = {}) => ({ id: 'a', name: { model: 'desktop', deviceName: 'd', displayName: 'MyPC' }, rtcSupported: true, ...over })
const mountItem = (props = {}) =>
  mount(DropItem, {
    props: { device: device(), isSelf: false, isFloat: true, ...props },
    global: { plugins: [createPinia(), i18n] },
  })

describe('DropItem', () => {
  it('显示设备名与在线图标', () => {
    const w = mountItem()
    expect(w.text()).toContain('MyPC')
    expect(w.find('img.drop-ic').attributes('src')).toContain('desktop_online')
  })
  it('离线灰显且不可点', () => {
    const w = mountItem({ device: device({ offline: true }) })
    expect(w.find('.drop-bubble').classes()).toContain('offline')
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
  })
  it('self 显示 self 图标且无 file input 交互', () => {
    const w = mountItem({ isSelf: true })
    expect(w.find('img.drop-ic').attributes('src')).toContain('self')
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
  })
  it('选文件 emit select-files', async () => {
    const w = mountItem()
    const input = w.find('input[type=file]')
    const file = new File(['x'], 'x.txt')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(w.emitted('select-files')![0][0]).toEqual([file])
  })
  it('suspended 时(重连窗口内)在线设备也禁互动(spec §7)', () => {
    const w = mountItem({ suspended: true })
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
    expect(w.find('.drop-bubble').attributes('disabled')).toBeDefined()
  })
  it('传输中显示进度环与计数文案', () => {
    const w = mountItem({ transfer: { progress: 40, sending: true, count: 2 } })
    expect(w.find('.drop-ring').exists()).toBe(true)
    expect(w.text()).toContain(i18n.global.t('filesDropSending', { num: 2 }))
  })
})

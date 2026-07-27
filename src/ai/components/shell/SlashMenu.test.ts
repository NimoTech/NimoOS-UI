// 1:1 移植测试见 .superpowers/sdd/p1c1-task-8-brief.md Step 1(逐字照抄,未改动断言)。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import SlashMenu from './SlashMenu.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('SlashMenu', () => {
  it('点 /init 后展开目录选择;只有一个目录时自动选中', async () => {
    const w = mount(SlashMenu, { props: { folders: [{ id: 1, path: '/DATA/docs' }] }, global: g })
    await w.find('.slash-row').trigger('click')
    expect(w.find('.slash-init').exists()).toBe(true)
    const confirm = w.findAll('.slash-init-actions button')[1]
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    expect(w.emitted('init')).toEqual([['/DATA/docs']])
  })

  it('无可见目录时给出提示且确认键禁用', async () => {
    const w = mount(SlashMenu, { props: { folders: [] }, global: g })
    await w.find('.slash-row').trigger('click')
    expect(w.find('.slash-status').exists()).toBe(true)
    expect(w.findAll('.slash-init-actions button')[1].attributes('disabled')).toBeDefined()
  })

  it('多个目录时需先选一个才可确认', async () => {
    const w = mount(SlashMenu, { props: { folders: [{ path: '/a' }, { path: '/b' }] }, global: g })
    await w.find('.slash-row').trigger('click')
    const confirm = w.findAll('.slash-init-actions button')[1]
    expect(confirm.attributes('disabled')).toBeDefined()
    await w.findAll('input[type="radio"]')[1].setValue()
    expect(w.findAll('.slash-init-actions button')[1].attributes('disabled')).toBeUndefined()
    await w.findAll('.slash-init-actions button')[1].trigger('click')
    expect(w.emitted('init')).toEqual([['/b']])
  })

  it('点遮罩自身 emit close', async () => {
    const w = mount(SlashMenu, { props: { folders: [] }, global: g })
    await w.find('.slash-menu').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
})

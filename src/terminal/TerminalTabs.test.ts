import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TerminalTabs from './TerminalTabs.vue'

const WINS = [
  { index: 0, name: 'zsh', active: true },
  { index: 1, name: 'build', active: false },
]

describe('TerminalTabs', () => {
  it('renders index:name labels and marks the active tab', () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    const tabs = w.findAll('[data-test="win-tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].text()).toContain('0:zsh')
    expect(tabs[0].classes()).toContain('is-active')
    expect(tabs[1].classes()).not.toContain('is-active')
  })

  it('emits select on click and close on the x (without also selecting)', async () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    await w.findAll('[data-test="win-tab"]')[1].trigger('click')
    expect(w.emitted('select')).toEqual([[1]])
    await w.findAll('[data-test="win-close"]')[0].trigger('click')
    expect(w.emitted('close')).toEqual([[0]])
    expect(w.emitted('select')).toEqual([[1]]) // close click must not bubble into select
  })

  it('emits create from the + button', async () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    await w.find('[data-test="win-add"]').trigger('click')
    expect(w.emitted('create')).toEqual([[]])
  })

  it('double-click opens the rename input; enter commits the trimmed name', async () => {
    const w = mount(TerminalTabs, { props: { windows: WINS } })
    await w.findAll('[data-test="win-tab"]')[1].trigger('dblclick')
    const input = w.find('[data-test="win-rename"]')
    expect(input.exists()).toBe(true)
    await input.setValue('  dev ')
    await input.trigger('keyup.enter')
    expect(w.emitted('rename')).toEqual([[1, '  dev ']]) // trimming is the composable's job
    expect(w.find('[data-test="win-rename"]').exists()).toBe(false)
  })
})

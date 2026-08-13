// SP8-P1c1 patch task 2 — SlashPopover: slash command panel in the same style as the @ panel.
// Ten test cases are specified in .superpowers/sdd/p1c1-patch-task-2-brief.md "Test Requirements" section;
// mount/keyboard assertion style copied from MentionPopover.test.ts (real i18n, attachTo document.body,
// window.dispatchEvent triggering capture-phase keydown).
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import SlashPopover from './SlashPopover.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

const folders = [
  { id: 1, path: '/DATA/Documents' },
  { id: 2, path: '/DATA/Projects' },
]

describe('SlashPopover', () => {
  it('1. command phase renders /init; query=in still matches; query=zzz shows no-match empty state', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'command', query: '', folders: [] }, global: g })
    expect(w.text()).toContain('/init')

    await w.setProps({ query: 'in' })
    expect(w.findAll('.slash-item')).toHaveLength(1)
    expect(w.text()).toContain('/init')

    await w.setProps({ query: 'zzz' })
    expect(w.findAll('.slash-item')).toHaveLength(0)
    expect(w.text()).toContain(zh.aiSlashNoCommand)
  })

  it('2. ArrowDown/Up moves highlight (data-active), Enter triggers pick-command', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'command', query: '', folders: [] }, global: g, attachTo: document.body })
    expect(w.findAll('.slash-item')[0].attributes('data-active')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()
    // Only one command exists; ArrowDown clamps at index 0.
    expect(w.findAll('.slash-item')[0].attributes('data-active')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('pick-command')).toEqual([['init']])
    w.unmount()
  })

  it('3. Tab is equivalent to Enter', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'command', query: '', folders: [] }, global: g, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(w.emitted('pick-command')).toEqual([['init']])
    w.unmount()
  })

  it('4. command phase: Escape → close; target phase: Escape → back (not close)', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'command', query: '', folders: [] }, global: g, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('back')).toBeFalsy()
    w.unmount()

    const w2 = mount(SlashPopover, { props: { open: true, stage: 'target', query: '', folders }, global: g, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w2.emitted('back')).toBeTruthy()
    expect(w2.emitted('close')).toBeFalsy()
    w2.unmount()
  })

  it('5. target phase renders folders, Enter triggers pick-target (selected path)', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'target', query: '', folders }, global: g, attachTo: document.body })
    expect(w.findAll('.slash-item')).toHaveLength(2)
    expect(w.text()).toContain('/DATA/Documents')
    expect(w.text()).toContain('/DATA/Projects')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('pick-target')).toEqual([['/DATA/Projects']])
    w.unmount()
  })

  it('6. target phase: empty folders → show aiSlashNoFolders empty state', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'target', query: '', folders: [] }, global: g })
    expect(w.text()).toContain(zh.aiSlashNoFolders.replace("{'@'}", '@'))
  })

  it('7. target phase: Backspace → back when query is empty; Backspace does not trigger back when query is non-empty', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'target', query: '', folders }, global: g, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(w.emitted('back')).toBeTruthy()
    w.unmount()

    const w2 = mount(SlashPopover, { props: { open: true, stage: 'target', query: 'doc', folders }, global: g, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(w2.emitted('back')).toBeFalsy()
    w2.unmount()
  })

  it('8. line click is equivalent to Enter', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'target', query: '', folders }, global: g })
    await w.findAll('.slash-item')[1].trigger('click')
    expect(w.emitted('pick-target')).toEqual([['/DATA/Projects']])
  })

  it('9. highlight resets to item 0 after stage or query changes', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'target', query: '', folders }, global: g, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()
    expect(w.findAll('.slash-item')[1].attributes('data-active')).toBe('true')

    // query change (still target stage, folders unchanged) resets hi -> 0.
    await w.setProps({ query: 'proj' })
    expect(w.findAll('.slash-item')[0].attributes('data-active')).toBe('true')

    // Move hi again, then flip stage (clearing query so 'init' still matches) —
    // stage change alone must also reset hi -> 0.
    await w.setProps({ query: '' })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()
    expect(w.findAll('.slash-item')[1].attributes('data-active')).toBe('true')
    await w.setProps({ stage: 'command' })
    expect(w.findAll('.slash-item')[0].attributes('data-active')).toBe('true')
    w.unmount()
  })

  it('10. after unmount, window keydown no longer triggers any emit', async () => {
    const w = mount(SlashPopover, { props: { open: true, stage: 'command', query: '', folders: [] }, global: g, attachTo: document.body })
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeFalsy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('pick-command')).toBeFalsy()
  })
})

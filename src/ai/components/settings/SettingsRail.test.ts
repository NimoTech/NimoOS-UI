import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SettingsRail from './SettingsRail.vue'
import zh from '../../../i18n/zh_cn'

// SP8-P2a Task 7 — partially ported from Vue2
// `src/views/AI/Settings/__tests__/SettingsRail.spec.js`.
// Three assertions on GROUPS in this file have been taken over by sections.test.ts (Task 3);
// here take over its methods assertions (onSelect / toggleGroup / initial expand), and upgrade Vue2's
// `.call(ctx)` pattern to real mount — improved asserting power.
//
// Use real zh_cn locale (don't hand-write i18n subset): P1c-2 precedent, hand-written subset would miss misspelled keys in component.



const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountRail(props: Record<string, unknown> = {}) {
  return mount(SettingsRail, {
    props: { activeId: 'models', ...props },
    global: { plugins: [i18n] },
  })
}

describe('SettingsRail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('render four group headers', () => {
    const w = mountRail()
    expect(w.findAll('.set-nav-grouphead')).toHaveLength(4)
  })

  it('initially only expand the group containing activeId', () => {
    const w = mountRail({ activeId: 'search' })   // groupOf('search') === 'agent'
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads.map((h) => h.attributes('data-open')))
      .toEqual(['false', 'true', 'false', 'false'])
  })

  it('clicking section emits select', async () => {
    const w = mountRail({ activeId: 'search' })
    // ⚠️ must get items from groupbody of that group, not use global findAll index —
    // collapse uses v-show (per Vue2 :22), all 13 items always in DOM,
    // global [0] gets 'models' from model group, not 'blacklist' from agent group.
    const agentBody = w.findAll('.set-nav-groupbody')[1]   // agent group
    await agentBody.findAll('.set-nav-item')[0].trigger('click')
    expect(w.emitted('select')![0]).toEqual(['blacklist'])
  })

  it('skills / mcp also only emit select (don\'t jump routes themselves)', async () => {
    const w = mountRail({ activeId: 'skills' })
    const skills = w.findAll('.set-nav-item').find((n) => n.text().includes('技能'))!
    await skills.trigger('click')
    expect(w.emitted('select')![0]).toEqual(['skills'])
  })

  it('clicking group header collapses/expands that group', async () => {
    const w = mountRail({ activeId: 'models' })
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads[0].attributes('data-open')).toBe('true')
    await heads[0].trigger('click')
    expect(w.findAll('.set-nav-grouphead')[0].attributes('data-open')).toBe('false')
    await w.findAll('.set-nav-grouphead')[0].trigger('click')
    expect(w.findAll('.set-nav-grouphead')[0].attributes('data-open')).toBe('true')
  })

  it('when activeId changes to another group, automatically expand new group (and don\'t close old group)', async () => {
    const w = mountRail({ activeId: 'models' })
    await w.setProps({ activeId: 'memory' })    // → agent group
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads[0].attributes('data-open')).toBe('true')   // model group still open
    expect(heads[1].attributes('data-open')).toBe('true')   // agent group expanded
  })

  it('highlight current section', () => {
    const w = mountRail({ activeId: 'providers' })
    const active = w.findAll('.set-nav-item').filter((n) => n.attributes('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('云端提供商')
  })

  it('render badge on models item when modelCount is non-zero', () => {
    const w = mountRail({ activeId: 'models', modelCount: 3 })
    expect(w.find('.set-nav-badge').text()).toBe('3')
  })

  it('when modelCount is 0 / null, don\'t render badge (Vue2 :29 uses truthy check)', () => {
    expect(mountRail({ modelCount: 0 }).find('.set-nav-badge').exists()).toBe(false)
    expect(mountRail({ modelCount: null }).find('.set-nav-badge').exists()).toBe(false)
  })

  it('back button emits back', async () => {
    const w = mountRail()
    await w.find('.set-rail-back').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('avatar URL includes shared store version number, changes after bump', async () => {
    localStorage.setItem('access_token', 'tok')
    const { useUserProfile } = await import('../../../stores/userProfile')
    const w = mountRail()
    const before = w.find('.set-foot img').attributes('src')
    expect(before).toContain('v=1')
    useUserProfile().bumpAvatarVersion()
    await w.vm.$nextTick()
    expect(w.find('.set-foot img').attributes('src')).toContain('v=2')
  })

  it('when no token, falls back to built-in default avatar', () => {
    const w = mountRail()
    expect(w.find('.set-foot img').attributes('src')).not.toContain('token=')
  })

  it('collapsed groups still keep their navigation items in DOM (narrow screen CSS uses display:flex!important to flatten, v-if would break it)', () => {
    const w = mountRail({ activeId: 'models' })
    // model group expanded, other three groups collapsed; all 15 items should
    // be rendered (13 before Task 21 added 'mcpapprovals' and agent web tools
    // Task 9 added 'web')
    expect(w.findAll('.set-nav-item')).toHaveLength(15)
    const bodies = w.findAll('.set-nav-groupbody')
    expect(bodies).toHaveLength(4)
  })
})

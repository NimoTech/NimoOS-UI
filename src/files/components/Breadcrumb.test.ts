import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Breadcrumb from './Breadcrumb.vue'

const opts = { global: { stubs: { FavoriteStar: true } } }

describe('Breadcrumb', () => {
  it('renders clickable segments from the virtual path', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    expect(w.findAll('.crumb').map((c) => c.text())).toEqual(['NimoOS-HD', 'Documents', 'Reports'])
  })

  it('emits navigate with the accumulated VIRTUAL path (never a real /DATA path)', async () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents/Reports', currentRealPath: '/DATA/Documents/Reports' }, ...opts })
    await w.findAll('.crumb')[1].trigger('click') // "Documents"
    const ev = w.emitted('navigate')
    expect(ev).toBeTruthy()
    expect(ev![0][0]).toBe('/NimoOS-HD/Documents')
    expect(ev![0][0]).not.toContain('/DATA')
  })

  it('renders a favorite star for the current folder', () => {
    const w = mount(Breadcrumb, { props: { virtualPath: '/NimoOS-HD/Documents', currentRealPath: '/DATA/Documents' }, ...opts })
    expect(w.find('.crumb-star').exists()).toBe(true)
  })
})

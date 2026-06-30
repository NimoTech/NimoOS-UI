import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { initService } from '@nimotech/nimoos-service'
import PhotoTile from './PhotoTile.vue'
import type { LayoutItem } from '../grid/types'

const item = (key: string): LayoutItem => ({ id: 'i', kind: 'photo', key, c: 1, r: 1, w: 2, h: 2 })

describe('PhotoTile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    initService({
      getToken: () => 'test-token',
      getRefresh: () => 'test-refresh',
      setTokens: () => {},
      onAuthFail: () => {},
      getLang: () => 'en',
    })
  })
  it('renders an img for a real asset id', () => {
    const w = mount(PhotoTile, { props: { item: item('asset42') } })
    expect(w.find('img').exists()).toBe(true)
    expect(w.find('img').attributes('src')).toContain('/v1/photos/assets/asset42/thumbnail')
  })
  it('renders a gradient placeholder for a gradient key', () => {
    const gradientKey = 'linear-gradient(145deg,#fff)'
    const w = mount(PhotoTile, { props: { item: item(gradientKey) } })
    expect(w.find('img').exists()).toBe(false)
    // Verify the gradient is applied via the component's computed gradient property
    const component = w.vm as any
    expect(component.gradient).toContain('linear-gradient')
  })
})

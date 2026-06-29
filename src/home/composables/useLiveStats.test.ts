import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { sys: { getUtilization: vi.fn(async () => ({ cpu: { percent: 7 }, mem: null, disk: null, gpu: null, net: null, usb: null })) } } }
})

import { useLiveStats } from './useLiveStats'

describe('useLiveStats', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('fetchOnce populates the store on mount', async () => {
    let store: any
    const C = defineComponent({ setup() { store = useLiveStats(); return () => null } })
    mount(C)
    await new Promise((r) => setTimeout(r, 0))
    expect(store.cpuHist[store.cpuHist.length - 1]).toBe(7)
  })
})

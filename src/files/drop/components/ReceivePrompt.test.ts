import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReceivePrompt from './ReceivePrompt.vue'
import { useDropStore } from '../stores/drop'
import { i18n } from '../../../i18n'

vi.mock('../serverConnection', () => ({ ServerConnection: class { connect = vi.fn(); destroy = vi.fn(); send = vi.fn() } }))
vi.mock('../peersManager', () => ({ PeersManager: class { handleServerMessage = vi.fn(); sendFiles = vi.fn(); destroy = vi.fn() } }))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}) }))

describe('ReceivePrompt', () => {
  let pinia: ReturnType<typeof createPinia>
  beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
  const mountP = () => mount(ReceivePrompt, { global: { plugins: [pinia, i18n] } })

  it('empty queue does not render', () => {
    expect(mountP().find('.receive-card').exists()).toBe(false)
  })
  it('queue head renders name/size, ignores dequeue, HTML does not contain /DATA', async () => {
    const s = useDropStore()
    s.receiveQueue.push({ file: { name: 'a.txt', mime: '', size: 2048, blob: new Blob(['x']) }, from: 'p' })
    const w = mountP()
    expect(w.find('.receive-card').exists()).toBe(true)
    expect(w.text()).toContain('a.txt')
    expect(w.text()).toContain('2 KB')
    expect(w.html()).not.toContain('/DATA')
    await w.find('.receive-ignore').trigger('click')
    expect(s.receiveQueue.length).toBe(0)
  })
  it('save button calls saveCurrent', async () => {
    const s = useDropStore()
    const spy = vi.spyOn(s, 'saveCurrent').mockImplementation(() => {})
    s.receiveQueue.push({ file: { name: 'a', mime: '', size: 1, blob: new Blob(['x']) }, from: 'p' })
    await mountP().find('.receive-save').trigger('click')
    expect(spy).toHaveBeenCalledOnce()
  })
})

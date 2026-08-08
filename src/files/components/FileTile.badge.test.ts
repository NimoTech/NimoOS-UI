import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import FileTile from './FileTile.vue'
import FileRow from './FileRow.vue'
import { i18n } from '../../i18n'
import type { FileEntry } from '../stores/files'

const broken: FileEntry = {
  name: 'a.txt', path: '/DATA/x/a.txt', is_dir: false,
  extensions: { upload: { broken: true, batchId: 'b1' } },
}
const clean: FileEntry = { name: 'b.txt', path: '/DATA/x/b.txt', is_dir: false, extensions: null }

describe.each([['FileTile', FileTile], ['FileRow', FileRow]] as const)('%s torn badge', (_n, Comp) => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders the badge only for a broken entry', () => {
    const w = mount(Comp, { props: { entry: broken }, global: { plugins: [i18n] } })
    expect(w.find('.upload-broken-badge').exists()).toBe(true)
    const w2 = mount(Comp, { props: { entry: clean }, global: { plugins: [i18n] } })
    expect(w2.find('.upload-broken-badge').exists()).toBe(false)
  })

  it('emits open-batch and does NOT emit open/select when the badge is clicked', async () => {
    const w = mount(Comp, { props: { entry: broken }, global: { plugins: [i18n] } })
    await w.find('.upload-broken-badge').trigger('click')
    expect(w.emitted('open-batch')?.[0]).toEqual(['b1'])
    // The badge lives inside the card, so without stopping propagation the
    // card's own open/select would fire alongside it — that exact regression
    // is what Vue 2 (#91) had to go back and fix.
    expect(w.emitted('open')).toBeUndefined()
    expect(w.emitted('select')).toBeUndefined()
  })
})

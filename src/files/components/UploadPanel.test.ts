import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import UploadPanel from './UploadPanel.vue'
import { useUploadsStore } from '../stores/uploads'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => { document.body.innerHTML = '' })

function seed(status: string, extra: any = {}) {
  const s = useUploadsStore()
  s.queue.push({ id: 'i1', file: null, fileName: 'a.txt', fileType: '', size: 1, targetPath: '/DATA/x',
    relativePath: 'a.txt', status: status as any, progress: 40, bytesSent: 0, speed: 0, tusUploadUrl: null,
    retryCount: 0, error: '', createdAt: 0, batchId: 'b', batchTotal: 1, conflictPolicy: '',
    ...extra })
  return s
}

// reka-ui's Dialog (used for the conflict dialog) teleports its content to
// <body>, outside the mounted wrapper's own DOM subtree (see
// src/components/ui/Dialog.test.ts and NewItemDialog.test.ts) — so
// `wrapper.text()` never sees it regardless of `attachTo`. Query
// document.body directly for that one assertion.
const body = () => new DOMWrapper(document.body)

describe('UploadPanel', () => {
  it('renders active item without leaking /DATA', () => {
    seed('uploading')
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.html()).not.toContain('/DATA')
    expect(w.text()).toContain('a.txt')
  })

  it('shows uploaded / total bytes on an active row', () => {
    seed('uploading', { size: 5 * 1024 * 1024, bytesSent: 1 * 1024 * 1024 })
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.text()).toContain('1 MB / 5 MB')
  })

  it('shows conflict dialog for a conflict item', async () => {
    seed('conflict')
    mount(UploadPanel, { global: { plugins: [i18n] }, attachTo: document.body })
    await nextTick()
    expect(body().text()).toContain(zh.filesUploadOverwrite)
  })

  it('auto-opens the panel when the queue grows from empty', async () => {
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.upload-panel-wrap').exists()).toBe(false)
    seed('uploading')
    await nextTick()
    expect(w.find('.upload-panel').exists()).toBe(true)
  })

  it('maps error codes to zh_cn text for a problem item', () => {
    seed('error', { error: 'no_space' })
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.text()).toContain(zh.filesUploadErrNoSpace)
  })

  it('resolveConflict is called with the chosen policy', async () => {
    const s = seed('conflict')
    mount(UploadPanel, { global: { plugins: [i18n] }, attachTo: document.body })
    await nextTick()
    await body().find('.ui-btn.primary').trigger('click')
    expect(s.queue.find((i) => i.id === 'i1')?.conflictPolicy).toBe('overwrite')
  })
})

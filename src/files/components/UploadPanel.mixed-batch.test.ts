import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import UploadPanel from './UploadPanel.vue'
import { useUploadsStore } from '../stores/uploads'
import { i18n } from '../../i18n'
import type { UploadItem } from '../upload/types'

function item(over: Partial<UploadItem>): UploadItem {
  return {
    id: Math.random().toString(), file: null, fileName: 'f', fileType: '', size: 10,
    targetPath: '/DATA/x', relativePath: 'f', status: 'error', progress: 0, bytesSent: 0,
    speed: 0, tusUploadUrl: null, retryCount: 0, error: 'server', createdAt: 0,
    batchId: 'mix', batchTotal: 3, conflictPolicy: '', ...over,
  }
}

describe('UploadPanel mixed problem-zone batch', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows both 重选文件 and 重试 for a needs_file + error batch', () => {
    const s = useUploadsStore()
    s.queue.push(item({ id: 'a', status: 'error' }), item({ id: 'b', status: 'needs_file', file: null }))
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    const labels = w.findAll('.up-item-actions .up-link-btn').map((b) => b.text())
    expect(labels).toContain(i18n.global.t('filesUploadReselect'))
    expect(labels).toContain(i18n.global.t('filesUploadRetry'))
  })

  it('shows 继续 for a paused + error batch', () => {
    const s = useUploadsStore()
    s.queue.push(item({ id: 'a', status: 'error' }), item({ id: 'b', status: 'paused' }))
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    const labels = w.findAll('.up-item-actions .up-link-btn').map((b) => b.text())
    expect(labels).toContain(i18n.global.t('filesUploadResume'))
    expect(labels).toContain(i18n.global.t('filesUploadRetry'))
  })
})

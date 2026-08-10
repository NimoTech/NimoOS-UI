import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import UploadPanel from './UploadPanel.vue'
import { useUploadsStore } from '../stores/uploads'
import { useFileOpsStore } from '../stores/fileOps'
import zh from '../../i18n/zh_cn'
import type { FileTask } from '../util/fileOps'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function opsTask(over: Partial<FileTask> = {}): FileTask {
  return {
    id: 'op1', type: 'copy', finished: false, status: 'PROCESSING',
    processing_path: '/DATA/Documents/big.iso',
    processed_size: 30, total_size: 100, to: '/DATA/Downloads',
    ...over,
  }
}

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

  // Guard against the old per-file conflict dialog coming back. Reading the
  // source with node:fs rather than a `?raw` import — `?raw` returns empty
  // under this repo's vitest setup and has silently no-op'd a guard before
  // (see task-8 brief). Checked against source rather than by seeding a
  // 'conflict' status: that status no longer exists on UploadStatus, so a
  // rendering-based assertion would either not compile or trivially pass for
  // an unrelated reason. Proven RED before the removal (Dialog import + the
  // conflict block present) and GREEN after, per task-8-report.md.
  it('no longer imports the per-file conflict Dialog or references its resolveConflict path', () => {
    const source = readFileSync(path.join(__dirname, 'UploadPanel.vue'), 'utf-8')
    expect(source).not.toMatch(/import\s+Dialog\s+from/)
    expect(source).not.toContain('resolveConflict')
    expect(source).not.toContain('conflictItem')
  })
})

describe('UploadPanel visibility', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('stays hidden when neither uploads nor file operations are running', () => {
    const w = mount(UploadPanel)
    expect(w.find('.upload-panel-wrap').exists()).toBe(false)
  })

  it('appears for file operations alone, with no uploads queued at all', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    const w = mount(UploadPanel)
    expect(w.find('.upload-panel-wrap').exists()).toBe(true)
  })

  it('opens itself when a file operation starts while the panel sits collapsed', async () => {
    const ops = useFileOpsStore()
    const w = mount(UploadPanel)
    ops.active = [opsTask()]
    await w.vm.$nextTick()
    expect(w.find('.upload-panel').exists()).toBe(true)
  })
})

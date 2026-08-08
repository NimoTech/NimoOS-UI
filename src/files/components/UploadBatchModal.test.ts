import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import UploadBatchModal from './UploadBatchModal.vue'
import { i18n } from '../../i18n'

const getBatch = vi.fn()
const abandonBatch = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: {
      getBatch: (...a: unknown[]) => getBatch(...a),
      abandonBatch: (...a: unknown[]) => abandonBatch(...a),
    },
  },
}))

const detail = {
  batch: { id: 'b1', target_path: '/DATA/x', status: 'interrupted', total: 3, done: 1 },
  missing: [
    { batch_id: 'b1', relative_path: 'Trip/a.jpg', size: 1024, done: false },
    { batch_id: 'b1', relative_path: 'Trip/b.jpg', size: 2048, done: false },
  ],
}

// reka-ui's Dialog teleports its content to <body>, outside the mounted wrapper's own
// DOM subtree (see src/components/ui/Dialog.test.ts, ShareLinkDialog.test.ts,
// UploadPanel.test.ts) — mount with attachTo: document.body, await one nextTick for the
// Portal content to land, then query document.body directly instead of the wrapper.
const body = () => new DOMWrapper(document.body)

async function mountModal() {
  const w = mount(UploadBatchModal, { props: { batchId: 'b1' }, global: { plugins: [i18n] }, attachTo: document.body })
  await nextTick()
  await flushPromises()
  return w
}

describe('UploadBatchModal', () => {
  beforeEach(() => { getBatch.mockReset(); abandonBatch.mockReset() })
  afterEach(() => { document.body.innerHTML = '' })

  it('lists the missing files and the done/total count', async () => {
    getBatch.mockResolvedValue(detail)
    await mountModal()
    expect(getBatch).toHaveBeenCalledWith('b1')
    const rows = body().findAll('.ubm-missing-item')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Trip/a.jpg')
    expect(body().text()).toContain('1')
    expect(body().text()).toContain('3')
  })

  it('shows a load-failure message when the batch cannot be read', async () => {
    getBatch.mockRejectedValue(new Error('boom'))
    await mountModal()
    expect(body().find('.ubm-load-error').exists()).toBe(true)
    expect(body().find('.ubm-missing-item').exists()).toBe(false)
  })

  it('abandons and closes on success', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockResolvedValue(undefined)
    const w = await mountModal()
    await body().find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(abandonBatch).toHaveBeenCalledWith('b1')
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
  })

  // #122: the batch was already swept away server-side -> 404. The user's goal was
  // just "make the badge disappear," so this shouldn't pop an error and block them.
  it('treats a 404 on abandon as already abandoned', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockRejectedValue({ response: { status: 404 } })
    const w = await mountModal()
    await body().find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
    expect(body().find('.ubm-error').exists()).toBe(false)
  })

  it('keeps the dialog open and shows the error on a non-404 failure', async () => {
    getBatch.mockResolvedValue(detail)
    abandonBatch.mockRejectedValue({ response: { status: 500 } })
    const w = await mountModal()
    await body().find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeFalsy()
    expect(w.emitted('close')).toBeFalsy()
    // Inline error inside the dialog, not a toast: the toast sits at z-index 60, which
    // gets covered by the dialog backdrop (1000) and smeared by its blur.
    expect(body().find('.ubm-error').exists()).toBe(true)
  })
})

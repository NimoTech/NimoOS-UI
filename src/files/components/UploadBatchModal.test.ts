import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import UploadBatchModal from './UploadBatchModal.vue'
import { i18n } from '../../i18n'

const getBatch = vi.fn()
const abandonUnder = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: {
      getBatch: (...a: unknown[]) => getBatch(...a),
      abandonUnder: (...a: unknown[]) => abandonUnder(...a),
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
  const w = mount(UploadBatchModal, {
    props: { batchId: 'b1', entryPath: '/DATA/Media/Trip' },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await nextTick()
  await flushPromises()
  return w
}

describe('UploadBatchModal', () => {
  beforeEach(() => { getBatch.mockReset(); abandonUnder.mockReset() })
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

  // Abandon goes through abandon-under with the badged entry's path, NOT the
  // single batch id: several interrupted batches can stack on one folder (each
  // canceled retry leaves one) while the badge only carries one id — abandoning
  // by id made the badge reappear with the next batch's id on the next listing.
  // A stale badge (#122, batch already swept) is also covered for free: the
  // bulk endpoint just reports 0 abandoned instead of a 404.
  it('abandons everything under the badged entry and closes on success', async () => {
    getBatch.mockResolvedValue(detail)
    abandonUnder.mockResolvedValue(undefined)
    const w = await mountModal()
    await body().find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(abandonUnder).toHaveBeenCalledWith('/DATA/Media/Trip')
    expect(w.emitted('abandoned')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('keeps the dialog open and shows the error on failure', async () => {
    getBatch.mockResolvedValue(detail)
    abandonUnder.mockRejectedValue({ response: { status: 500 } })
    const w = await mountModal()
    await body().find('.ubm-abandon').trigger('click')
    await flushPromises()
    expect(w.emitted('abandoned')).toBeFalsy()
    expect(w.emitted('close')).toBeFalsy()
    // Inline error inside the dialog, not a toast: this failure answers the button the
    // user just pressed in this dialog, so it must stay pinned next to that button and
    // stay on screen while they decide what to do — a toast auto-dismisses and renders
    // away from the control that caused it.
    expect(body().find('.ubm-error').exists()).toBe(true)
  })

  it('emits refill with the target path and missing relative paths', async () => {
    getBatch.mockResolvedValue(detail)
    const w = await mountModal()
    await body().find('.ubm-refill').trigger('click')
    expect(w.emitted('refill')?.[0]).toEqual([
      { targetPath: '/DATA/x', missing: ['Trip/a.jpg', 'Trip/b.jpg'] },
    ])
    expect(w.emitted('close')).toBeTruthy()
  })

  it('disables refill when nothing is missing', async () => {
    getBatch.mockResolvedValue({ batch: detail.batch, missing: [] })
    await mountModal()
    expect(body().find('.ubm-refill').attributes('disabled')).toBeDefined()
  })
})

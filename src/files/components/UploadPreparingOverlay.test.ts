import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UploadPreparingOverlay from './UploadPreparingOverlay.vue'
import { i18n } from '../../i18n'

const mountOverlay = (open: boolean) =>
  mount(UploadPreparingOverlay, { props: { open }, global: { plugins: [i18n] } })

describe('UploadPreparingOverlay', () => {
  it('renders the spinner and preparing text when open', () => {
    const w = mountOverlay(true)
    expect(w.find('.prep-spinner').exists()).toBe(true)
    expect(w.find('.prep-text').text()).toBe(i18n.global.t('filesUploadPreparing'))
  })

  it('renders nothing when closed', () => {
    const w = mountOverlay(false)
    expect(w.find('.prep-overlay').exists()).toBe(false)
  })
})

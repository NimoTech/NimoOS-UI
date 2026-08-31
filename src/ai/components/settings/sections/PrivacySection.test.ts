// Port from Vue2 src/views/AI/Settings/sections/PrivacySection.vue
// (74 lines). Brief Step 1's 10 test cases, landed one by one.
//
// Real store (setActivePinia + useSettingsStore()), don't mock @nimotech/nimoos-service
// — component never calls service directly, only calls store.updatePolicyField, spy on
// that method to isolate network layer (same as established pattern in
// ProvidersSection.test.ts).
//
// Real i18n (zh_cn full locale, don't hand-write subset) — same established pattern,
// avoid hand-written subset typos or missing keys.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import PrivacySection from './PrivacySection.vue'
import { useSettingsStore, type Policy } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountSection() {
  return mount(PrivacySection, { global: { plugins: [i18n] } })
}

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return { allow_remote: false, default_backend: 'local', escalation_prompt: false, ...overrides }
}

describe('PrivacySection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── 1. policyLoading → loading, does not render card ──

  it('1. policyLoading=true → renders "Loading...", does not render .sk-section', () => {
    const store = useSettingsStore()
    store.policyLoading = true
    const w = mountSection()
    expect(w.text()).toContain('加载中…')
    expect(w.find('.sk-section').exists()).toBe(false)
  })

  // ── 2. policy is null and not loading → "Failed to load policy" ──

  it('2. policy=null and not loading → renders "Failed to load policy", does not render .sk-section', () => {
    const store = useSettingsStore()
    store.policy = null
    store.policyLoading = false
    const w = mountSection()
    expect(w.text()).toContain('无法加载策略')
    expect(w.find('.sk-section').exists()).toBe(false)
  })

  // ── 3. has policy → renders three rows ──

  it('3. has policy → renders .sk-section and 3 .set-row elements', () => {
    const store = useSettingsStore()
    store.policy = makePolicy()
    const w = mountSection()
    expect(w.find('.sk-section').exists()).toBe(true)
    expect(w.findAll('.set-row')).toHaveLength(3)
  })

  // ── 4. three controls initial values reflect policy fields ──

  it('4. three controls initial values reflect policy.allow_remote / default_backend / escalation_prompt', () => {
    const store = useSettingsStore()
    store.policy = makePolicy({ allow_remote: true, default_backend: 'cloud', escalation_prompt: true })
    const w = mountSection()
    const switches = w.findAll('.sw')
    expect(switches[0].attributes('aria-checked')).toBe('true') // allow_remote
    expect(w.find('select').element.value).toBe('cloud')
    expect(switches[1].attributes('aria-checked')).toBe('true') // escalation_prompt
  })

  // ── 5. toggle allow_remote switch → updatePolicyField('allow_remote', true) ──

  it('5. toggle first switch (allow_remote) → calls store.updatePolicyField("allow_remote", true)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    store.policy = makePolicy({ allow_remote: false })
    const w = mountSection()
    await w.findAll('.sw')[0].trigger('click')
    expect(spy).toHaveBeenCalledWith('allow_remote', true)
  })

  // ── 6. change dropdown → updatePolicyField('default_backend', 'cloud') ──

  it('6. change dropdown to cloud → calls store.updatePolicyField("default_backend", "cloud")', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    store.policy = makePolicy({ default_backend: 'local' })
    const w = mountSection()
    await w.find('select').setValue('cloud')
    expect(spy).toHaveBeenCalledWith('default_backend', 'cloud')
  })

  // ── 7. toggle escalation_prompt → corresponding call ──

  it('7. toggle second switch (escalation_prompt) → calls store.updatePolicyField("escalation_prompt", true)', async () => {
    const store = useSettingsStore()
    const spy = vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    store.policy = makePolicy({ escalation_prompt: false })
    const w = mountSection()
    await w.findAll('.sw')[1].trigger('click')
    expect(spy).toHaveBeenCalledWith('escalation_prompt', true)
  })

  // ── 8. success → toast and duration is 1500 (assert second parameter) ──

  it('8. success → toast.show called with second parameter (duration) as 1500', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'updatePolicyField').mockResolvedValue()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    store.policy = makePolicy()
    const w = mountSection()
    await w.findAll('.sw')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(showSpy).toHaveBeenCalledWith('已保存', 1500)
  })

  // ── 9. failure → danger-level toast ──

  it('9. updatePolicyField rejects → danger-level toast', async () => {
    const store = useSettingsStore()
    vi.spyOn(store, 'updatePolicyField').mockRejectedValue(new Error('boom'))
    const toast = useToast()
    store.policy = makePolicy()
    const w = mountSection()
    await w.findAll('.sw')[0].trigger('click')
    await nextTick()
    await nextTick()
    expect(toast.toasts[0].text).toBe('保存失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 10. when policy.allow_remote is falsy (undefined) switch displays as off (Vue2 :22's !! normalization, control group) ──

  it('10. policy.allow_remote is undefined → switch displays as off (!! normalization)', () => {
    const store = useSettingsStore()
    store.policy = { default_backend: 'local', escalation_prompt: false } as unknown as Policy
    const w = mountSection()
    expect(w.findAll('.sw')[0].attributes('aria-checked')).toBe('false')
  })
})

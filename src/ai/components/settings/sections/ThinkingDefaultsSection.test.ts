// Ported from Vue2
// src/views/AI/Settings/sections/ThinkingDefaultsSection.vue(73 lines). brief Step 2
// has 11 test cases; landing each one.
//
// This section **bypasses the store**, calling directly to
// `service.ai.getThinkingDefaults` / `putThinkingDefaults` — mock
// `@nimotech/nimoos-service` (using the established vi.hoisted pattern in
// AgentComposer.test.ts); do not mock Pinia store (this component does not use it).
//
// Real i18n (complete zh_cn locale, no handwritten subset).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import { useToast } from '../../../../stores/toast'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  getThinkingDefaults: vi.fn(),
  putThinkingDefaults: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

import ThinkingDefaultsSection from './ThinkingDefaultsSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

async function mountSection() {
  const w = mount(ThinkingDefaultsSection, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('ThinkingDefaultsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    svc.getThinkingDefaults.mockReset().mockResolvedValue({ enabled: true, level: 'medium' })
    svc.putThinkingDefaults.mockReset().mockResolvedValue({})
  })

  // ── 1. On mount, call getThinkingDefaults; write return value to two controls ──

  it('1. On mount, call service.ai.getThinkingDefaults; write return value to switch and dropdown', async () => {
    svc.getThinkingDefaults.mockResolvedValue({ enabled: false, level: 'high' })
    const w = await mountSection()
    expect(svc.getThinkingDefaults).toHaveBeenCalledTimes(1)
    expect(w.find('.sw').attributes('aria-checked')).toBe('false')
    expect(w.find('select').element.value).toBe('high')
  })

  // ── 2. getThinkingDefaults reject → do not throw; fall back to hardcoded defaults enabled:true / level:'medium' ──

  it('2. getThinkingDefaults reject → do not throw; fall back to hardcoded defaults enabled:true/level:medium', async () => {
    svc.getThinkingDefaults.mockRejectedValue(new Error('network down'))
    // If the rejection from mounted() inside mountSection() is not caught by
    // the await flushPromises(), it becomes an unhandled rejection (vitest
    // errors on this by default); reaching the assertion here proves "no throw".
    const w = await mountSection()
    expect(w.find('.sw').attributes('aria-checked')).toBe('true')
    expect(w.find('select').element.value).toBe('medium')
  })

  // ── 3. Toggle switch → call putThinkingDefaults({ enabled, level }) ──

  it('3. Toggle switch → call service.ai.putThinkingDefaults({ enabled: false, level: "medium" })', async () => {
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(svc.putThinkingDefaults).toHaveBeenCalledWith({ enabled: false, level: 'medium' })
  })

  // ── 4. Change dropdown → same as above, with new level ──

  it('4. Change dropdown to high → call service.ai.putThinkingDefaults({ enabled: true, level: "high" })', async () => {
    const w = await mountSection()
    await w.find('select').setValue('high')
    await flushPromises()
    expect(svc.putThinkingDefaults).toHaveBeenCalledWith({ enabled: true, level: 'high' })
  })

  // ── 5. When enabled is false, dropdown is disabled; when true, it is not (two comparative cases) ──

  it('5a. enabled=false → dropdown disabled', async () => {
    svc.getThinkingDefaults.mockResolvedValue({ enabled: false, level: 'medium' })
    const w = await mountSection()
    expect(w.find('select').attributes('disabled')).toBeDefined()
  })

  it('5b. enabled=true → dropdown not disabled', async () => {
    svc.getThinkingDefaults.mockResolvedValue({ enabled: true, level: 'medium' })
    const w = await mountSection()
    expect(w.find('select').attributes('disabled')).toBeUndefined()
  })

  // ── 6. Dropdown has four options: low / medium / high / max ──

  it('6. Dropdown renders four options low/medium/high/max', async () => {
    const w = await mountSection()
    const options = w.findAll('option')
    expect(options.map((o) => o.attributes('value'))).toEqual(['low', 'medium', 'high', 'max'])
  })

  // ── 7. During saving, show "Saving..." ──

  it('7. Show "Saving..." when save request is in flight', async () => {
    let resolvePut: (v: unknown) => void = () => {}
    svc.putThinkingDefaults.mockReturnValue(new Promise((res) => { resolvePut = res }))
    const w = await mountSection()
    void w.find('.sw').trigger('click')
    await nextTick()
    await nextTick()
    expect(w.find('.set-actions .hint').text()).toBe('保存中…')
    resolvePut({})
    await flushPromises()
  })

  // ── 8. After save succeeds, show "Saved" ──

  it('8. After save succeeds, show "Saved"', async () => {
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
  })

  // ── 9. Save fails → show danger toast and do not produce unhandled rejection (discipline fix) ──

  it('9. Save fails → danger-tier toast "Save failed", no unhandled rejection', async () => {
    svc.putThinkingDefaults.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(toast.toasts[0].text).toBe('保存失败')
    expect(toast.toasts[0].tier).toBe('danger')
  })

  // ── 10. After save fails, saving flag still released (finally) ──

  it('10. After save fails, saving released → hint no longer stays "Saving..."', async () => {
    svc.putThinkingDefaults.mockRejectedValue(new Error('boom'))
    const w = await mountSection()
    await w.find('.sw').trigger('click')
    await flushPromises()
    expect(w.find('.set-actions .hint').text()).not.toBe('保存中…')
  })

  // ── 11. Info banner renders ──

  it('11. Info banner (.set-banner) renders', async () => {
    const w = await mountSection()
    expect(w.find('.set-banner').exists()).toBe(true)
    expect(w.find('.set-banner').text()).toContain('新建会话时使用以下设置作为初始值')
  })
})

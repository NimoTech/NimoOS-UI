import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineStepper from './TimeMachineStepper.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(TimeMachineStepper, {
    props: { label: 'Today 14:30', canLater: true, canEarlier: true, ...props },
    global: { plugins: [i18n] },
  })

describe('TimeMachineStepper', () => {
  it('renders the humanized moment label between the two buttons', () => {
    const w = mountIt({ label: 'Yesterday 09:05' })
    expect(w.find('.tm-stepper-time').text()).toBe('Yesterday 09:05')
  })

  // Direction mapping is Vue2's own FINAL, swapped state (2026-07 user report -- see
  // TimeMachineStepper.vue's own header comment): ⬆ = later (more recent), ⬇ = earlier (older).
  it('⬆ emits "later", ⬇ emits "earlier" -- Vue2\'s own swapped-and-final direction mapping', async () => {
    const w = mountIt()
    await w.find('.tm-stepper-btn-up').trigger('click')
    await w.find('.tm-stepper-btn-down').trigger('click')
    expect(w.emitted('later')).toHaveLength(1)
    expect(w.emitted('earlier')).toHaveLength(1)
  })

  it('disables ⬆ when canLater is false, and a click on a disabled button emits nothing', async () => {
    const w = mountIt({ canLater: false })
    const btn = w.find('.tm-stepper-btn-up')
    expect(btn.attributes('disabled')).toBeDefined()
    await btn.trigger('click')
    expect(w.emitted('later')).toBeUndefined()
  })

  it('disables ⬇ when canEarlier is false, and a click on a disabled button emits nothing', async () => {
    const w = mountIt({ canEarlier: false })
    const btn = w.find('.tm-stepper-btn-down')
    expect(btn.attributes('disabled')).toBeDefined()
    await btn.trigger('click')
    expect(w.emitted('earlier')).toBeUndefined()
  })

  it('neither button is disabled when both can-step props are true', () => {
    const w = mountIt()
    expect(w.find('.tm-stepper-btn-up').attributes('disabled')).toBeUndefined()
    expect(w.find('.tm-stepper-btn-down').attributes('disabled')).toBeUndefined()
  })

  it('aria-label/title on each button use the tmStepLater/tmStepEarlier i18n keys', () => {
    const w = mountIt()
    const up = w.find('.tm-stepper-btn-up')
    const down = w.find('.tm-stepper-btn-down')
    expect(up.attributes('aria-label')).toBe(zh.tmStepLater)
    expect(up.attributes('title')).toBe(zh.tmStepLater)
    expect(down.attributes('aria-label')).toBe(zh.tmStepEarlier)
    expect(down.attributes('title')).toBe(zh.tmStepEarlier)
  })

  // jsdom applies no CSS at all -- the right-edge-hugging geometry (TimeMachineStepper.vue's own
  // <style> comment ports Vue2's $tm-stepper SCSS derivation byte-for-byte) can only be pinned by
  // reading the component's own source text, same technique TimeMachineRail.test.ts already uses
  // for its own CSS-literal regression guards.
  it('pins the exact Vue2-derived right-edge-hugging formula in <style>', () => {
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './TimeMachineStepper.vue'),
      'utf8',
    )
    const styleBlock = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)![1]
    // ".tm-stepper" must be followed directly by optional whitespace then "{" -- this naturally
    // excludes ".tm-stepper-btn { ... }" / ".tm-stepper-time { ... }" (both have more selector text
    // between "stepper" and "{"), no lookbehind needed.
    const stepperRule = /\.tm-stepper\s*\{([^}]*)\}/.exec(styleBlock)
    expect(stepperRule, 'no .tm-stepper rule found').toBeTruthy()
    expect(stepperRule![1]).toContain('width: 44px')
    expect(stepperRule![1]).toContain('right: max(232px, calc(9% + 190.8px));')
  })
})

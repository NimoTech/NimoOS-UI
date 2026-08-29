import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMatrix from './RaidMatrix.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// tsconfig lib target is ES2020; Array.prototype.at() needs ES2022+ type defs (vue-tsc reports TS2550);
// use the equivalent arr[arr.length-1] instead of .at(-1) (same pattern as RaidDriveBay.test.ts).
function lastCall<T>(calls: T[][] | undefined): T[] {
  const list = calls!
  return list[list.length - 1]
}

describe('RaidMatrix', () => {
  it('renders 5 level columns', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.findAll('.rm-col')).toHaveLength(5)
  })
  it('clicking Select emits update:selectedLevel(level id)', async () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    await w.findAll('.rm-select')[2].trigger('click') // 3rd column = RAID5
    expect(lastCall(w.emitted('update:selectedLevel'))).toEqual([5])
  })
  it('does not render the failure simulator entry (deferred)', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.find('.rm-simulator').exists()).toBe(false)
    expect(w.text().toLowerCase()).not.toContain('failure simulator')
  })
})

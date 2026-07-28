import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMatrix from './RaidMatrix.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// tsconfig lib 目标为 ES2020,Array.prototype.at() 需 ES2022+ 才有类型定义(vue-tsc 报 TS2550);
// 用等价的 arr[arr.length-1] 代替 .at(-1)(与 RaidDriveBay.test.ts 同款写法)。
function lastCall<T>(calls: T[][] | undefined): T[] {
  const list = calls!
  return list[list.length - 1]
}

describe('RaidMatrix', () => {
  it('渲染 5 个级别列', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.findAll('.rm-col')).toHaveLength(5)
  })
  it('点 Select → emit update:selectedLevel(级别 id)', async () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    await w.findAll('.rm-select')[2].trigger('click') // 第3列 = RAID5
    expect(lastCall(w.emitted('update:selectedLevel'))).toEqual([5])
  })
  it('不渲染故障模拟器入口(推迟)', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.find('.rm-simulator').exists()).toBe(false)
    expect(w.text().toLowerCase()).not.toContain('failure simulator')
  })
})

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DiskUsageTip from './DiskUsageTip.vue'
import type { DiskDetail } from '../stores/diskUsage'

// i18n 由 vitest.setup.ts 全局装好,这里不再另建实例(重复安装会打 [Vue warn])。
function mountTip(detail: DiskDetail) {
  return mount(DiskUsageTip, { props: { detail } })
}

describe('DiskUsageTip', () => {
  it('renders used / total, the bar width and available', () => {
    const w = mountTip({ space: { used: 400, total: 1000, avail: 600 }, raid: null })
    expect(w.text()).toContain('40%')
    expect(w.find('.disk-tip-bar-fill').attributes('style')).toContain('width: 40%')
    expect(w.findAll('.disk-tip-row').length).toBeGreaterThanOrEqual(2)
  })

  it('renders the RAID level when the mount point is an array', () => {
    const w = mountTip({ space: { used: 1, total: 10, avail: 9 }, raid: { id: 1, level: '5' } })
    expect(w.text()).toContain('RAID 5')
  })

  it('shows a capacity dash when neither space nor RAID is known', () => {
    const w = mountTip({ space: null, raid: null })
    expect(w.text()).toContain('—')
    expect(w.find('.disk-tip-bar').exists()).toBe(false)
  })

  it('renders the RAID row with no bar when only RAID info is known', () => {
    const w = mountTip({ space: null, raid: { id: 1, level: '1' } })
    expect(w.text()).toContain('RAID 1')
    expect(w.find('.disk-tip-bar').exists()).toBe(false)
  })
})

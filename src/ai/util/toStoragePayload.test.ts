// 1:1 移植自 Vue2 src/views/AI/Agent/Agent.vue:221-239(toStoragePayload)。
import { describe, it, expect } from 'vitest'
import { toStoragePayload } from './toStoragePayload'

describe('toStoragePayload(Agent.vue:221-239)', () => {
  it('正常汇总:多盘 size/used 求和,换算 TB,breakdown 单段 color 是字符串 var(--accent)', () => {
    const disks = [
      { size: 4e12, used: 2e12 },
      { size: 8e12, used: 3e12 },
    ]
    expect(toStoragePayload(disks)).toEqual({
      used: 5, // (2e12+3e12)/1e12
      total: 12, // (4e12+8e12)/1e12
      breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }],
      label: 'NimoOS Storage',
    })
  })

  it('缺 size 或缺 used 的盘不计入汇总(Vue2:227 `if (d.size && d.used)`)', () => {
    const disks = [
      { size: 4e12, used: 2e12 },
      { size: 8e12 }, // 无 used,跳过
      { used: 1e12 }, // 无 size,跳过
    ]
    expect(toStoragePayload(disks)).toEqual({
      used: 2,
      total: 4,
      breakdown: [{ name: 'Used', value: 2, color: 'var(--accent)' }],
      label: 'NimoOS Storage',
    })
  })

  it('非数组 → null(触发"存储信息不可用"空态)', () => {
    expect(toStoragePayload(null)).toBeNull()
    expect(toStoragePayload(undefined)).toBeNull()
    expect(toStoragePayload({})).toBeNull()
    expect(toStoragePayload('nope')).toBeNull()
  })

  it('空数组 → null', () => {
    expect(toStoragePayload([])).toBeNull()
  })

  it('总量为 0(全部盘都缺字段,或 size/used 全 0)→ null', () => {
    expect(toStoragePayload([{ size: 0, used: 0 }])).toBeNull()
    expect(toStoragePayload([{ foo: 'bar' }])).toBeNull()
  })
})

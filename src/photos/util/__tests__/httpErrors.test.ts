// 单测迁自 T5 AlbumPickerDialog.test.ts 里针对本地 isConflict 的两个用例(抽 util 后，组件侧
// 保留各自的端到端 409 行为断言——即"抛 409 时组件真的显示重名 toast"，这里只测判定函数本身)。
import { describe, it, expect } from 'vitest'
import { isConflict } from '../httpErrors'

describe('isConflict', () => {
  it('e.response.status === 409 → true', () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    expect(isConflict(err)).toBe(true)
  })

  it('无 response 字段但 message 含 409 → true(message 兜底)', () => {
    const err = new Error('request failed with status code 409')
    expect(isConflict(err)).toBe(true)
  })

  it('非 409 错误(如网络错误)→ false', () => {
    expect(isConflict(new Error('network error'))).toBe(false)
  })

  it('response.status 非 409 → false', () => {
    const err = Object.assign(new Error('bad request'), { response: { status: 400 } })
    expect(isConflict(err)).toBe(false)
  })

  it('非对象/null/undefined → false(不假设异常形状,避免二次抛错)', () => {
    expect(isConflict(null)).toBe(false)
    expect(isConflict(undefined)).toBe(false)
    expect(isConflict('plain string error')).toBe(false)
  })
})

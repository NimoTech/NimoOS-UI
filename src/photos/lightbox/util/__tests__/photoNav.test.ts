import { describe, it, expect } from 'vitest'
import { photoIndexById } from '../photoNav'
it('按 id 定位当前项', () => {
  expect(photoIndexById([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { id: 'b' })).toBe(2 - 1)
})
it('找不到返 0(不用对象引用比较)', () => {
  const list = [{ id: 'a' }, { id: 'b' }]
  expect(photoIndexById(list, { id: 'zzz' })).toBe(0)
  // 同 id 不同对象也能命中(响应式重建免疫)
  expect(photoIndexById(list, { id: 'b' })).toBe(1)
})

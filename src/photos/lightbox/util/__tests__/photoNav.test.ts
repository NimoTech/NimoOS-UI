import { describe, it, expect } from 'vitest'
import { photoIndexById } from '../photoNav'
it('Locate current item by id', () => {
  expect(photoIndexById([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { id: 'b' })).toBe(2 - 1)
})
it('Returns 0 when not found (do not use object reference comparison)', () => {
  const list = [{ id: 'a' }, { id: 'b' }]
  expect(photoIndexById(list, { id: 'zzz' })).toBe(0)
  // Same id, different objects can also match (immune to reactive rebuilds)
  expect(photoIndexById(list, { id: 'b' })).toBe(1)
})

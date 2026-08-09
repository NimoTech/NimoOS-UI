import { describe, it, expect } from 'vitest'
import { contextTargets } from './contextTarget'
import type { FileEntry } from '../stores/files'

const f = (name: string): FileEntry => ({ name, path: `/DATA/${name}`, is_dir: false })
const A = f('a.txt')
const B = f('b.txt')
const C = f('c.txt')

describe('contextTargets', () => {
  it('被点项不在选区内 → 只作用于被点项(F11 的核心回归)', () => {
    expect(contextTargets(A, [B, C])).toEqual([A])
  })

  it('被点项在选区内且选区多于一项 → 作用于整个选区', () => {
    expect(contextTargets(B, [B, C])).toEqual([B, C])
  })

  it('选区只有一项 → 只作用于被点项,即便被点项就是那一项', () => {
    // Vue2 ContextMenu.vue:274 的判据是 length > 1;选区仅一项时走单项分支,
    // 菜单因此呈单项态(重命名/复制路径可用)。
    expect(contextTargets(B, [B])).toEqual([B])
  })

  it('空选区 → 只作用于被点项', () => {
    expect(contextTargets(A, [])).toEqual([A])
  })

  it('没有被点项(工具栏批量入口)→ 原样返回选区', () => {
    expect(contextTargets(null, [B, C])).toEqual([B, C])
  })

  it('没有被点项且选区为空 → 空数组', () => {
    expect(contextTargets(null, [])).toEqual([])
  })

  it('按 path 判断"在选区内",不依赖对象同一性', () => {
    const bCopy = { ...B }
    expect(contextTargets(bCopy, [B, C])).toEqual([B, C])
  })
})

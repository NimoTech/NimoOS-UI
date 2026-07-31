// 守卫 New-UI 硬约束(CLAUDE.md / docs/THEMING.md):
// theme.sp9.css 里每个 token 必须在 :root 与 :root[data-theme="light"] 两块都有值。
// theme.css 本身没有这个守卫(历史原因),分片是新文件,从第一天就上守卫。
/// <reference types="node" />
// 只在本文件引 node 类型,不动 tsconfig 的全局 types 数组(理由见 color-guard.test.ts)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// 必须用 node:fs 读:`?raw` 对 .css 在 vitest 下恒为空串(CSS 走副作用模块管线),
// 无论静态 import 还是 import.meta.glob 都拿不到内容 —— 同样的坑修过 color-guard.test.ts。
const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'theme.sp9.css'),
  'utf8',
)

function tokensOf(selector: string): string[] {
  const i = src.indexOf(selector)
  expect(i, `找不到选择器 ${selector}`).toBeGreaterThanOrEqual(0)
  const open = src.indexOf('{', i)
  const close = src.indexOf('}', open)
  const body = src.slice(open + 1, close)
  return [...body.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]).sort()
}

describe('theme.sp9.css token 两套主题齐备', () => {
  it(':root 与 :root[data-theme="light"] 的 token 名集合一致', () => {
    expect(tokensOf(":root[data-theme='light']")).toEqual(tokensOf(':root {'))
  })

  it('至少定义了一个 token(接线已生效,不是空文件)', () => {
    expect(tokensOf(':root {').length).toBeGreaterThan(0)
  })
})

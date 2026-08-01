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

function bodyOf(selector: string): string {
  const i = src.indexOf(selector)
  expect(i, `找不到选择器 ${selector}`).toBeGreaterThanOrEqual(0)
  const open = src.indexOf('{', i)
  const close = src.indexOf('}', open)
  return src.slice(open + 1, close)
}

function tokensOf(selector: string): string[] {
  return [...bodyOf(selector).matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]).sort()
}

// name -> 声明值(去掉首尾空白,不含结尾分号)。用于比较同一个 token 在两套主题块里
// 是否取了相同的字面量。
function tokenMapOf(selector: string): Record<string, string> {
  const body = bodyOf(selector)
  const map: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map[m[1]] = m[2].trim()
  }
  return map
}

describe('theme.sp9.css token 两套主题齐备', () => {
  it(':root 与 :root[data-theme="light"] 的 token 名集合一致', () => {
    expect(tokensOf(":root[data-theme='light']")).toEqual(tokensOf(':root {'))
  })

  it('至少定义了一个 token(接线已生效,不是空文件)', () => {
    expect(tokensOf(':root {').length).toBeGreaterThan(0)
  })
})

describe('--kvm-* token 两套主题取值必须相同(P5 硬约束:KVM 区固定深色,不跟随全局主题)', () => {
  it('每个 --kvm- 前缀 token,:root 与 :root[data-theme="light"] 的字面量逐个相同', () => {
    const root = tokenMapOf(':root {')
    const light = tokenMapOf(":root[data-theme='light']")
    // 只挑 --kvm- 前缀比较;非 --kvm- 前缀(如 --set-*)是设置区的语义 token,
    // 两套主题本来就该取不同值,不归这条断言管。
    const kvmKeys = Object.keys(root).filter((k) => k.startsWith('--kvm-'))
    expect(kvmKeys.length, '没找到任何 --kvm- token,守卫本身可能失效了').toBeGreaterThan(0)
    const mismatched = kvmKeys.filter((k) => root[k] !== light[k])
    expect(
      mismatched,
      `以下 --kvm-* token 在两套主题块里取值不同(违反固定深色约束):\n${mismatched
        .map((k) => `  ${k}: root=${root[k]} light=${light[k]}`)
        .join('\n')}`,
    ).toEqual([])
  })
})

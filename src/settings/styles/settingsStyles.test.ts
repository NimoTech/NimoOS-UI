/// <reference types="node" />
// settings.css 的源文本守卫。
// ⚠️ 必须用 node:fs 读文件 —— `import.meta.glob(..., { query: '?raw' })` 对 .css 在 vitest 下
//    恒为空串(CSS 走副作用模块管线),那样断言会全部空转(color-guard.test.ts 顶部有同款注释)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const CSS = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'settings.css'),
  'utf8',
)

// 按 CSS 语义剥注释(第一个 */ 即闭合),再做断言 —— 否则注释里的示例文本会被当成规则。
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('原生 <select> 弹出列表必须可读(2026-08-05 P8 验收:蓝色主题白底白字)', () => {
  // 事故:`.set-select` 自己设了 `background: var(--chip-bg)`(半透明玻璃 8%~26% 白)。
  // 作者一旦给 <select> 指定背景,Chrome 会把它带到**弹出列表**上 —— 半透明白叠在列表
  // 默认白底上几乎就是纯白,而 color 是近白的 --fg ⇒ 白底白字,整个列表读不出来。
  // 根节点的 color-scheme: dark 救不了它(作者指定的背景优先)。
  it('给 option/optgroup 显式指定了底色与字色', () => {
    const rule = CODE.match(/\.set-select\s+option[^{]*\{[^}]*\}/)
    expect(rule, '找不到 .set-select option 规则 —— 弹出列表会退回浏览器默认白底').not.toBeNull()
    expect(rule![0]).toMatch(/background-color:\s*var\(--[a-z0-9-]+\)/)
    expect(rule![0]).toMatch(/\bcolor:\s*var\(--[a-z0-9-]+\)/)
  })

  it('optgroup 与 option 一起被覆盖(分组标题同样会白底白字)', () => {
    const rule = CODE.match(/\.set-select\s+option[^{]*\{[^}]*\}/)
    expect(rule![0]).toContain('optgroup')
  })

  // 原生 option 只认 background-color 的**实心色**,不渲染 gradient ——
  // 所以不能图省事复用 --chip-bg / --card-bg / --popup-bg / --panel-bg-solid(全是 gradient)。
  it('用的底色 token 在两套主题里都是实心色,不是 gradient', () => {
    const rule = CODE.match(/\.set-select\s+option[^{]*\{[^}]*\}/)![0]
    const token = rule.match(/background-color:\s*var\((--[a-z0-9-]+)\)/)![1]
    const sp9 = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/theme.sp9.css'),
      'utf8',
    )
    const defs = [...sp9.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
    expect(defs.length, `${token} 必须在 :root 与 :root[data-theme='light'] 两块里都有值`).toBe(2)
    for (const v of defs) {
      expect(v, `${token} = ${v} —— 原生 option 不渲染 gradient,必须是实心色`).not.toMatch(/gradient|rgba?\([^)]*,\s*0?\.\d+\s*\)/)
    }
  })
})

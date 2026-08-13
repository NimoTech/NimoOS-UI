// 滚动条主题守卫(2026-08-13 白色主题滚动条不可见 bug 的回归测试)。
//
// 根因:theme.css 顶部 `* { scrollbar-color: <白色字面量> transparent }` 把白色滑块
// **显式**写在了每一个元素上;白色主题的翻转只写在 `:root[data-theme="light"]` 这一个
// 元素上。`scrollbar-color` 虽可继承,但"元素自身的显式声明"永远压过"从 root 继承",
// 于是除页面最外层外,一切内部滚动容器(文件列表等)在白色主题下仍是白滑块贴白底。
// 且 Chrome 121+ 一旦元素设置了 scrollbar-color,就整体忽略 ::-webkit-scrollbar-* 伪元素
// 样式,第 561-564 行那套 webkit 白色主题规则根本不生效。
//
// 正确形态:滑块颜色收成 token(--scrollbar-thumb / --scrollbar-thumb-hover),两套主题块
// 各给值;`*` 规则里引用 var(--…) —— 自定义属性正常继承,每个元素都能解析出当前主题的值。
//
// 本守卫只看源文本(已知局限,见 newui-css-invisible-failure-guards):它钉的是
// "声明必须 token 化 + token 双主题齐全"这两条机械可查的约定;渲染层取证在交付前
// 用真浏览器 computed style 复核。
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const themeCss = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'theme.css'),
  'utf8',
)

// 提取一个选择器对应的声明块(首个匹配),按花括号配平。
function blockOf(selectorRe: RegExp): string {
  const m = selectorRe.exec(themeCss)
  if (!m) return ''
  const start = themeCss.indexOf('{', m.index)
  let depth = 0
  for (let i = start; i < themeCss.length; i++) {
    if (themeCss[i] === '{') depth++
    else if (themeCss[i] === '}') {
      depth--
      if (depth === 0) return themeCss.slice(start + 1, i)
    }
  }
  return ''
}

describe('滚动条颜色必须 token 化(白色主题滚动条不可见回归)', () => {
  it('所有 scrollbar-color 声明都引用 var(--scrollbar-thumb),不得写字面量', () => {
    const decls = [...themeCss.matchAll(/scrollbar-color\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(decls.length, 'theme.css 里应存在 scrollbar-color 声明').toBeGreaterThan(0)
    for (const v of decls) {
      expect(v, `scrollbar-color 的值必须走 token(继承到每个元素),不能写死单主题字面量:${v}`)
        .toMatch(/var\(--scrollbar-thumb\)/)
    }
  })

  it('所有 ::-webkit-scrollbar-thumb 的 background 都引用 --scrollbar-thumb 系 token', () => {
    const re = /::-webkit-scrollbar-thumb[^{]*\{([^}]*)\}/g
    const blocks = [...themeCss.matchAll(re)].map((m) => m[1])
    expect(blocks.length, 'theme.css 里应存在 ::-webkit-scrollbar-thumb 规则').toBeGreaterThan(0)
    for (const b of blocks) {
      const bg = /background\s*:\s*([^;]+);/.exec(b)?.[1].trim() ?? ''
      expect(bg, `::-webkit-scrollbar-thumb 的 background 必须走 token:${bg}`)
        .toMatch(/var\(--scrollbar-thumb(-hover)?\)/)
    }
  })

  it('--scrollbar-thumb / --scrollbar-thumb-hover 在蓝白两套主题块里都有定义', () => {
    const blue = blockOf(/(^|\n):root\s*\{/)
    const light = blockOf(/(^|\n):root\[data-theme="light"\]\s*\{/)
    for (const token of ['--scrollbar-thumb:', '--scrollbar-thumb-hover:']) {
      expect(blue, `:root(蓝色默认)块缺少 ${token}`).toContain(token)
      expect(light, `:root[data-theme="light"] 块缺少 ${token}`).toContain(token)
    }
  })
})

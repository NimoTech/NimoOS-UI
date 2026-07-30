// 约定守卫(见 CLAUDE.md / docs/THEMING.md §0):New-UI 一切可见颜色必须走 theme token。
// 扫描所有 .vue 的 <style> 与 .css(theme.css 除外——它是 token 定义处),
// 发现 var(--token, …) 之外的裸颜色字面量(#hex / rgb()/rgba()/hsl())即失败。
//
// 允许:  color: var(--fg)          / background: var(--card-bg, #fff)  (token 驱动主题, fallback 可留)
// 允许:  color: #fff /* theme-exception: 叠在缩略图上的图标, 皮肤无关 */  (注释在值行或其上一行)
// 失败:  color: #fff               (裸字面量, 未走 token)
import { describe, it, expect } from 'vitest'

const HEX = /#[0-9a-fA-F]{3,8}\b/
const FUNC = /\b(rgba?|hsla?)\s*\(/

// Vite raw-import 所有样式源(相对本文件 = src/styles/,故 ../** = src/**)。免用 node:fs。
const files: Record<string, string> = {
  ...(import.meta.glob('../**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('../**/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
}

// 移除整段 var(...)(含嵌套 fallback),使其内部 token 名与 fallback 字面量不计入扫描。
function stripVar(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s.startsWith('var(', i)) {
      let depth = 0
      let j = i + 3
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++
        else if (s[j] === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
      }
      i = j
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

// .vue 只取 <style> 块;.css 取全文。返回 [绝对行号, 行文本][]。
function styleLines(rel: string, src: string): Array<[number, string]> {
  const out: Array<[number, string]> = []
  if (rel.endsWith('.css')) {
    src.split('\n').forEach((l, i) => out.push([i + 1, l]))
    return out
  }
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const startLine = src.slice(0, m.index).split('\n').length
    m[1].split('\n').forEach((l, i) => out.push([startLine + i, l]))
  }
  return out
}

// 终审 Minor 11:上面那条 `<style…>(.*?)</style>` 是**非贪婪**匹配 —— 一旦有人在 JS 注释
// (或模板属性)里写下字面的 style 开标签,提取就会从那个假开标签一路吃到文件末尾的真闭标签,
// 把整个 script + template 都当成样式块扫描。后果有两条:①以后谁在这些文件的注释里写个
// #hex,会被一条看不懂的报错拦下;②`theme-exception` 出现在 script 注释里会开出一个豁免
// 窗口(exempt=true 直到下一个 `;` 或 `}`),窗口内后续行被无条件放行 —— 守卫在这些文件上
// 静默失效。本期实测命中 4 个文件(ClusterActionDialog / PersonRelGraph / PersonPlacesTab /
// PhotosTrash),当时恰好是绿的(非假绿),但两个隐患都成立。
// 修法:注释里改成不构成标签的写法(「样式块」);这条测试把它钉死。
describe('样式块提取不被注释里的假开标签污染(Minor 11)', () => {
  for (const [path, src] of Object.entries(files)) {
    const rel = path.replace(/^\.\.\//, '').replace(/\\/g, '/')
    if (!rel.endsWith('.vue')) continue
    it(`${rel} 提取出的样式块不含 <script / <template`, () => {
      const text = styleLines(rel, src).map(([, l]) => l).join('\n')
      expect(text, `${rel} 的样式块提取越界了 —— 检查是否有注释/属性里写了字面的 style 开标签`)
        .not.toMatch(/<script[\s>]|<template[\s>]/)
    })
  }
})

describe('color-token guard (§0 约定: 颜色一律走 var(--token))', () => {
  for (const [path, src] of Object.entries(files)) {
    const rel = path.replace(/^\.\.\//, '').replace(/\\/g, '/')
    if (rel === 'styles/theme.css') continue
    it(`${rel} 无裸颜色字面量`, () => {
      const lines = styleLines(rel, src)
      const offenders: string[] = []
      // theme-exception 的豁免作用到「当前声明结束」(下一个 ; 或 }),
      // 覆盖跨多行的值(如多层 radial-gradient 背景),也支持注释写在值行的上一行。
      let exempt = false
      lines.forEach(([n, line]) => {
        if (line.includes('theme-exception')) exempt = true
        if (!exempt) {
          const bare = stripVar(line)
          if (HEX.test(bare) || FUNC.test(bare)) offenders.push(`  L${n}: ${line.trim()}`)
        }
        if (line.includes(';') || line.includes('}')) exempt = false
      })
      expect(
        offenders,
        `\n${rel} 发现裸颜色字面量(改为 var(--token) 或加 /* theme-exception: 原因 */):\n${offenders.join('\n')}`,
      ).toEqual([])
    })
  }
})

// 便宜守卫(评审 I1 的姊妹坑):color-scheme 不是颜色字面量,上面那条 color-token guard
// 完全抓不到它——但它的效果等价于"钉死一套主题":`color-scheme: dark` 会让浏览器强制用
// 深色配色渲染该元素内的原生控件(date/time/number/select/滚动条等),不随 New-UI 的
// data-theme 走。I1 就是这么溜过去的(PlacesFilterMenu.vue 曾经写死 `color-scheme: dark`)。
// `color-scheme: light dark`(双值,把选择权交还浏览器/系统)不在此列——放行。
// theme.css 自己的 :root / :root[data-theme="light"] 两条是这套约定的正确用法(主题块本身
// 就是"按主题分设颜色 token"的定义处),豁免整个文件,同上面 color-token guard 的既有豁免。
describe('color-scheme 单值必须走 theme-exception 豁免(防 I1 同类复发)', () => {
  const COLOR_SCHEME_RE = /color-scheme\s*:\s*([^;{}]+)/i
  for (const [path, src] of Object.entries(files)) {
    const rel = path.replace(/^\.\.\//, '').replace(/\\/g, '/')
    if (rel === 'styles/theme.css') continue
    it(`${rel} 的单值 color-scheme(dark 或 light,不含 light dark)都带 theme-exception 注释`, () => {
      const lines = styleLines(rel, src)
      const offenders: string[] = []
      let exempt = false
      lines.forEach(([n, line]) => {
        if (line.includes('theme-exception')) exempt = true
        const m = COLOR_SCHEME_RE.exec(line)
        if (m) {
          const tokens = m[1].trim().split(/\s+/)
          const isSingleValue = tokens.length === 1 && (tokens[0] === 'dark' || tokens[0] === 'light')
          if (isSingleValue && !exempt) offenders.push(`  L${n}: ${line.trim()}`)
        }
        if (line.includes(';') || line.includes('}')) exempt = false
      })
      expect(
        offenders,
        `\n${rel} 发现未豁免的单值 color-scheme(会钉死一套主题的原生控件配色,改为
删掉这行让根节点级联下来,或加 /* theme-exception: 原因 */):\n${offenders.join('\n')}`,
      ).toEqual([])
    })
  }
})

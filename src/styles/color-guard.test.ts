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

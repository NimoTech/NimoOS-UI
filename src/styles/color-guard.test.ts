// 约定守卫(见 CLAUDE.md / docs/THEMING.md §0):New-UI 一切可见颜色必须走 theme token。
// 扫描所有 .vue 的 <style> 与 .css(theme.css 除外——它是 token 定义处),
// 发现 var(--token, …) 之外的裸颜色字面量(#hex / rgb()/rgba()/hsl())即失败。
//
// 允许:  color: var(--fg)          / background: var(--card-bg, #fff)  (token 驱动主题, fallback 可留)
// 允许:  color: #fff /* theme-exception: 叠在缩略图上的图标, 皮肤无关 */  (注释在值行或其上一行)
// 失败:  color: #fff               (裸字面量, 未走 token)
/// <reference types="node" />
// 显式引 node 类型而不是往 tsconfig 的 types 数组里加 "node" —— 全局加会把 NodeJS 的
// setTimeout/Timer 等声明灌进整个 src,改变既有代码的类型推断。这里只作用于本文件。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const HEX = /#[0-9a-fA-F]{3,8}\b/
const FUNC = /\b(rgba?|hsla?)\s*\(/

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 递归收集 .css。**不能用 import.meta.glob 读 .css** —— `?raw` 对 .css 在 vitest 下恒为空串
// (CSS 走的是副作用模块管线),glob 的 key 有、值全是 ''。这条曾让本守卫的 .css 那一半空转:
// 键都在、内容全空,于是任何 .css 都"通过"。.vue 的 ?raw 正常,那半边保持 glob。
function listCss(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listCss(full))
    else if (e.name.endsWith('.css')) out.push(full)
  }
  return out
}

const cssFiles: Record<string, string> = Object.fromEntries(
  listCss(SRC_DIR).map((full) => [
    '../' + path.relative(SRC_DIR, full).split(path.sep).join('/'),
    fs.readFileSync(full, 'utf8'),
  ]),
)

// .vue 仍走 Vite raw-import(相对本文件 = src/styles/,故 ../** = src/**)。
const files: Record<string, string> = {
  ...(import.meta.glob('../**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...cssFiles,
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
    // token 定义文件:裸字面量是它的本职工作。theme.sp9.css 是 SP9 分片(spec §4.3),同理豁免。
    if (rel === 'styles/theme.css' || rel === 'styles/theme.sp9.css') continue
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

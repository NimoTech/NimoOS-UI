// 约定守卫(见 CLAUDE.md / docs/THEMING.md §0):New-UI 一切可见颜色必须走 theme token。
// 扫描所有 .vue 的 <style> 与 .css(theme.css 除外——它是 token 定义处),
// 发现 var(--token, …) 之外的裸颜色字面量(#hex / rgb()/rgba()/hsl())即失败。
//
// 允许:  color: var(--fg)          / background: var(--card-bg, #fff)  (token 驱动主题, fallback 可留)
// 允许:  color: #fff /* theme-exception: 叠在缩略图上的图标, 皮肤无关 */  (注释在值行或其上一行)
// 失败:  color: #fff               (裸字面量, 未走 token)
//
// 登记豁免(机主拍板 2026-08-11,见 docs/superpowers/specs/2026-08-11-photos-vue2-parity-reskin-design.md §4):
// src/photos/styles/vue2-parity/*.scss 是 Vue2 老仓的像素真源,自带 .photos-root 作用域 token 体系,
// 整目录豁免本守卫。当前扫描面(.vue 样式块 + .css)天然不含 .scss;若日后把 .scss 纳入扫描,
// 必须保留对该目录的排除。
/// <reference types="node" />
// 显式引 node 类型而不是往 tsconfig 的 types 数组里加 "node"。
// 🔴 【SP8-P6 T10 订正】原注释末句「这里只作用于本文件」**是错的** —— `/// <reference types="…" />`
// 是**程序级**指令,它把 `@types/node` 整包(含 `globals.d.ts` 里的 `declare var process`
// / `NodeJS.Timeout` 等全局声明)拉进整个编译程序,对**所有**源文件可见,并不局限于本文件。
// 实证(T10 双向探针):新建一个既不 import `node:` 也无 reference 的文件,只写
// `export const b = process.platform` → `vue-tsc --noEmit` exit 0;同一文件加
// `const wrong: number = 'string'` → TS2322 exit 2 ⇒ 前一次 exit 0 不是空过。
// 现测全仓共 **7** 个文件写了这条指令(`/usr/bin/grep -rln 'reference types="node"' src`),
// 所以那点「全局污染」其实早就发生了。保留这一行仍然是对的(本文件确实要用 node:fs,
// 且不依赖别处的 reference),但**别再拿「只作用于本文件」当理由**。
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

// ── 注释完整性守卫(2026-08-05 SP9-P8 验收暴露的真缺陷:一整条规则被注释吞掉)──────
//
// 事故经过:`src/kvm/styles/kvm.css` 文件头那段说明里写了 `os-*/category-*`、
// `--kvm-modal-*/--kvm-field-*/` —— **`*/` 提前把块注释关掉了**。此后的散文被当成 CSS
// 解析,而 CSS 的错误恢复会一路吃到下一个 `{...}` 块结束 ⇒ 紧随其后的
// `.kvm-page { display:flex; height:100vh; position:relative; z-index:1 }` **整条被丢掉**。
// 后果是 KVM 页只占视口上半部分、背景光斑透上来,机主一眼就看见。
//
// **为什么本仓既有的守卫全都抓不到它**:
//   · `kvmStyles.test.ts` 的类名白名单 / 裸色扫描都是对**源文本**做正则 —— 源文本完全正确,
//     错的是"解析之后规则不见了",正则对它零判别力。
//   · 本文件的颜色扫描同理(而且刻意不剥注释)。
//   · `pnpm exec vue-tsc --noEmit` 不看 CSS;`pnpm build` 也不会因为丢一条规则而失败。
//   ⇒ 这类缺陷只有"看渲染结果"或"按 CSS 的规则剥注释后再看还剩什么"才抓得到。
//
// 检测法(与解析器无关,故不依赖 jsdom 的 CSSOM):按 CSS 语义**非贪婪**剥掉 `/* … */`
// (第一个 `*/` 即闭合,与浏览器一致),然后看有没有以 `*` 开头的行漏在外面 —— 那正是
// 块注释里那种 ` * 说明文字` 的续行漏到了注释之外。`* { … }` 通用选择器例外。
// SP16 Task 12:此前这道守卫的语料只有那 5 个独立 `.css`(颜色扫描早就覆盖了 `.vue`,
// 这一半没跟上)。同样的缺陷发生在任何 `.vue` 的 `<style>` 里,五道门一样全瞎 ——
// SP9 那次「KVM 页只占半屏」正是这个形态。
//
// **不能**把循环源直接换成 `files`:`.vue` 的 `<script>` 里 JS 块注释的 ` * 续行` 极其
// 常见,会把这道检查淹在误报里。只扫 `<style>` 块。
const commentCorpus: Record<string, string> = { ...cssFiles }
for (const [rel, src] of Object.entries(files)) {
  if (!rel.endsWith('.vue')) continue
  const blocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1])
  if (blocks.length) commentCorpus[rel] = blocks.join('\n')
}

describe('CSS 注释完整性(防「注释里写了 */ 把后面的规则吞掉」)', () => {
  for (const [rel, src] of Object.entries(commentCorpus)) {
    it(`${rel} 的块注释没有被自身内容提前关闭`, () => {
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '')
      const leaked: string[] = []
      stripped.split('\n').forEach((line, i) => {
        const t = line.trim()
        // 真的通用选择器放行:`*` 之后紧跟的是选择器语法字符(`{ , : . # [ > + ~`),
        // 例如 `* {` / `*,` / `*::-webkit-scrollbar` / `* > .x`。
        // 漏出来的散文则是 `*` 之后接文字/汉字/括号,例如 ` * 用到的 23 个 token …`。
        if (t.startsWith('*') && !/^\*\s*[{,:.#[>+~]/.test(t)) leaked.push(`  L${i + 1}: ${t.slice(0, 100)}`)
        // SP16 Task 12 补的第二种形态:上面那条只认「块注释的 ` * 续行` 漏在外面」,
        // 也就是多行注释的形状。**单行**注释里带 `*/` 时漏出来的残渣不以 `*` 开头
        // (例如 `/* tokens: --a-*/--b-* */` 剥完剩下 `--b-* */`),整条检查看不见它 ——
        // 而它一样会吞掉后面那条规则。真浏览器实测过:那条规则从 cssRules 里彻底消失,
        // 只剩它后面的一条。剥干净之后还剩的 `*/` 必然是没有开括号的孤立闭合符,
        // 拿它当判据既准确又便宜。
        else if (t.includes('*/')) leaked.push(`  L${i + 1}: ${t.slice(0, 100)}`)
      })
      expect(
        leaked,
        `\n${rel}:有块注释被自身内容里的 */ 提前关闭,后面的规则会被 CSS 错误恢复吞掉。
把注释里的 */ 拆开写(例如 \`os-* / category-*\`,斜杠两侧留空格):\n${leaked.join('\n')}`,
      ).toEqual([])
    })
  }
})

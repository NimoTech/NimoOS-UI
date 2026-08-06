/// <reference types="node" />
// 全仓守卫:原生 <select> 的**弹出列表**不能被作者背景弄成白底白字。
//
// 事故(2026-08-05 SP9-P8 验收,机主一眼看见):深色主题下设置页所有下拉菜单**白底白字**读不出来。
// 根因**不是**缺 color-scheme —— theme.css 根节点早就有 `color-scheme: dark`。真因是
// `.set-select` 自己设了 `background: var(--chip-bg)`,而 `--chip-bg` 在深色主题下是
// **半透明白的 linear-gradient**。**作者一旦给 <select> 指定背景,Chrome 就把它带到弹出列表上**,
// 而弹出列表里的 option 有两条硬约束:
//   1. **原生 option 不渲染 gradient** —— 给了渐变等于没给,退回浏览器默认的**白底**;
//   2. **半透明会叠在那个默认白底上** —— 8%~26% 的白叠上去几乎就是纯白。
// 两条都通向「浅色底 + 近白的 --fg」= 读不出来。而**作者指定的背景优先于 color-scheme**,
// 根节点那句声明救不了它。修法是给 option / optgroup 显式指定**实心**底色与字色。
//
// ⚠️ 判据是「背景是渐变或半透明」,不是「有没有背景」——
//    `background: #2a2a2a` 这类**实心深色**底会被原样带到弹出列表,渲染出来是深底浅字,
//    完全正常(KVM 的 .cv-select-native 与 AI 的 .strength-select 就是这种,不需要修)。
//    2026-08-06 这道守卫第一版按「有背景就要修」写,把那 4 处也点名了,是过报。
//
// 为什么需要这道守卫:既有的门一道都拦不住这一类问题 ——
//   · color-guard / 各区 *Styles.test.ts 只查「有没有裸颜色字面量」,走了 token 就放行;
//   · vue-tsc 不看 CSS;
//   · vitest 跑在 jsdom 上,不做真实层叠,更不会渲染原生下拉的弹出列表。
// 修设置页那次先只发现存储区 3 处同形(债务 D49),这道守卫一跑才发现应用区还有 7 处 ——
// **这形状是靠复制粘贴扩散的,靠人工 grep 数不全。**
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// .css/.scss 必须用 node:fs 读 —— `?raw` 对样式表在 vitest 下恒为空串(color-guard 顶部有
// 同款注释,那半边守卫曾因此整体空转)。.vue 的 ?raw 正常,走 glob。
function listStyles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listStyles(full))
    else if (/\.(css|scss)$/.test(e.name)) out.push(full)
  }
  return out
}

const vueFiles = import.meta.glob('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// 按 CSS 语义剥注释(非贪婪,第一个 */ 即闭合,与浏览器一致)—— 否则注释里的示例选择器会被当规则。
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

const styleFiles = listStyles(SRC_DIR)

// 全仓 CSS 语料 = 所有 .css/.scss + 所有 .vue 的 <style> 块。
// 跨文件是必要的:`.set-select` 的背景写在 settings.css 里、元素在 GeneralPanel.vue 的模板里,
// 只看单个文件永远对不上。
const CSS_CORPUS =
  styleFiles.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n') +
  '\n' +
  Object.values(vueFiles)
    .flatMap((src) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]))
    .map(stripComments)
    .join('\n')

const RULES = CSS_CORPUS.match(/[^{}]+\{[^{}]*\}/g) ?? []
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const selectorOf = (rule: string) => rule.slice(0, rule.indexOf('{'))
const bodyOf = (rule: string) => rule.slice(rule.indexOf('{'))

/**
 * 全仓 token 定义表:token 名 → [{ 取值, 主题作用域 }]。
 *
 * ⚠️ 必须带作用域,否则展开 `var()` 会跨主题串味 —— 实际踩过:AI 区
 * `--bg-elevated: var(--card-bg)` 只写在 `:root[data-theme="light"] .knowledge-app` 里,
 * 那里的 `--card-bg` 是纸感白;若不分作用域就把**深色主题**的 `--card-bg`(渐变)也算进来,
 * 两个本来正常的 AI 下拉会被误报成缺陷。
 */
type Scope = 'light' | 'dark' | 'base'
const scopeOf = (selector: string): Scope =>
  /data-theme=['"]?light/.test(selector) ? 'light' : /data-theme=['"]?dark/.test(selector) ? 'dark' : 'base'

const TOKEN_DEFS = new Map<string, { value: string; scope: Scope }[]>()
for (const rule of RULES) {
  const scope = scopeOf(selectorOf(rule))
  for (const m of bodyOf(rule).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const list = TOKEN_DEFS.get(m[1]) ?? []
    list.push({ value: m[2].trim(), scope })
    TOKEN_DEFS.set(m[1], list)
  }
}

/** 把一个背景值解析成「实际会落到弹出列表上的候选值」(逐层展开 var(),各主题块各算一遍)。 */
function resolve(value: string, scope: Scope = 'base', depth = 0): string[] {
  const token = value.match(/^var\((--[a-z0-9-]+)/)
  if (!token || depth > 4) return [value]
  const all = TOKEN_DEFS.get(token[1])
  if (!all?.length) return [value]
  // 同作用域优先;同作用域没有定义时才退到 base(theme.css 的 :root 就是 base)。
  const sameScope = all.filter((d) => d.scope === scope)
  const picked = sameScope.length ? sameScope : scope === 'base' ? all : all.filter((d) => d.scope === 'base')
  return (picked.length ? picked : all).flatMap((d) => resolve(d.value, d.scope, depth + 1))
}

const HAS_ALPHA = /rgba?\([^)]*,\s*(0?\.\d+|0)\s*\)|hsla?\([^)]*,\s*(0?\.\d+|0)\s*\)/
/** 渐变 = option 根本不渲染(退回默认白底);半透明 = 叠在那个白底上。两者都会白底白字。 */
const isRisky = (v: string) => /gradient|\btransparent\b/.test(v) || HAS_ALPHA.test(v)

/** 这个类身上作者指定的背景,展开后有没有「渐变 / 半透明」的取值。 */
function riskyBackground(cls: string): string | null {
  const hit = new RegExp(`\\.${esc(cls)}(?![\\w-])`)
  for (const rule of RULES) {
    if (!hit.test(selectorOf(rule))) continue
    const scope = scopeOf(selectorOf(rule))
    for (const decl of bodyOf(rule).matchAll(/\bbackground(?:-color)?\s*:\s*([^;}]+)/g)) {
      const bad = resolve(decl[1].trim(), scope).find(isRisky)
      if (bad) return bad
    }
  }
  return null
}

/** 语料里有没有给 `.cls` 的 option 指定底色(`.cls option { background-color: … }`)。 */
const hasOptionBackground = (cls: string) =>
  RULES.some(
    (r) =>
      new RegExp(`\\.${esc(cls)}(?![\\w-])\\s+option(?![\\w-])`).test(selectorOf(r)) &&
      /background-color\s*:/.test(bodyOf(r)),
  )

const hasOptgroup = (cls: string) =>
  RULES.some((r) => new RegExp(`\\.${esc(cls)}(?![\\w-])\\s+optgroup(?![\\w-])`).test(selectorOf(r)))

/** 每个 .vue 模板里的 <select>,连同它身上的静态 class 列表。 */
const selects: { file: string; classes: string[] }[] = []
for (const [file, src] of Object.entries(vueFiles)) {
  const styleAt = src.indexOf('<style')
  const template = styleAt === -1 ? src : src.slice(0, styleAt)
  for (const m of template.matchAll(/<select\b[^>]*>/g)) {
    const cls = m[0].match(/\sclass="([^"]*)"/)
    // 已知边界(不静默):只看**静态** class。`<select :class="…">` 且无静态类的元素会被算作
    // classes: [] 并跳过 —— 目前全仓没有这种写法,哪天有了,得在这里补动态类的处理。
    const classes = (cls?.[1] ?? '').split(/\s+/).filter(Boolean).filter((c) => !c.includes('{'))
    selects.push({ file, classes })
  }
}

describe('原生 <select> 弹出列表可读性(2026-08-05 P8:深色主题白底白字)', () => {
  it('全仓至少扫到了 10 个 <select>(防守卫空转)', () => {
    // 参数化守卫必须自证不是空循环 —— 若哪天模板改写成自定义下拉、这个数掉下来,
    // 会提醒你重新评估本文件还有没有覆盖面,而不是让它静静地全绿。
    expect(selects.length).toBeGreaterThanOrEqual(10)
  })

  it('作者背景是渐变或半透明的 <select>,必须显式钉住 option 的实心底色', () => {
    const bad: string[] = []
    for (const { file, classes } of selects) {
      if (!classes.length) continue
      // 判据落在「元素身上任一 class」——背景可能来自另一个类:
      // 例如 <select class="cs-input cs-select">,背景在 .cs-input 上、.cs-select 只加了
      // appearance:auto。只看 select 专用类会漏掉它。
      const risky = classes.map((c) => [c, riskyBackground(c)] as const).find(([, v]) => v)
      if (!risky) continue
      if (!classes.some(hasOptionBackground)) {
        bad.push(`  ${file}  class="${classes.join(' ')}"  ← .${risky[0]} 的背景 = ${risky[1]}`)
      }
    }
    expect(
      bad,
      'Chrome 会把作者背景带到弹出列表:渐变根本不渲染(退回默认白底)、半透明则叠在白底上,\n' +
        '两者都是浅底 + 近白字 ⇒ 读不出来。修法:给其中一个类加\n' +
        '  option, optgroup { background-color: var(--set-option-bg); color: var(--set-option-fg); }\n' +
        bad.join('\n'),
    ).toEqual([])
  })

  it('写了 option 底色的地方必须把 optgroup 一起覆盖', () => {
    const bad: string[] = []
    for (const { file, classes } of selects) {
      const withOption = classes.filter(hasOptionBackground)
      if (!withOption.length) continue
      if (!withOption.some(hasOptgroup)) bad.push(`  ${file}  class="${classes.join(' ')}"`)
    }
    expect(bad, '分组标题(optgroup)不继承 option 的底色,会照旧白底白字:\n' + bad.join('\n')).toEqual([])
  })

  it('option 用的底色 token 在两套主题里都有值、且都是实心色', () => {
    const themeSrc = styleFiles
      .filter((f) => /theme[.\w-]*\.css$/.test(f))
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n')
    const tokens = new Set<string>()
    for (const rule of RULES) {
      if (!/\soption(?![\w-])/.test(selectorOf(rule))) continue
      const t = bodyOf(rule).match(/background-color:\s*var\((--[a-z0-9-]+)\)/)
      if (t) tokens.add(t[1])
    }
    expect(tokens.size, '没有任何 option 规则用 token 指定底色 —— 断言会空转').toBeGreaterThan(0)
    for (const token of tokens) {
      const defs = [...themeSrc.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
      expect(defs.length, `${token} 必须在 :root 与 :root[data-theme='light'] 两块里都有值`).toBe(2)
      for (const v of defs) {
        expect(v, `${token} = ${v} —— option 不渲染 gradient、半透明也会透出白底,必须实心色`).not.toMatch(
          /gradient|\btransparent\b/,
        )
        expect(v, `${token} = ${v} —— 半透明会叠在弹出列表的默认白底上`).not.toMatch(HAS_ALPHA)
      }
    }
  })
})

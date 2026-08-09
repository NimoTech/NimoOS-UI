/// <reference types="node" />
// 显式引 node 类型而不是往 tsconfig 的 types 数组里加 "node"(同 color-guard.test.ts)。
//
// SP16 Task 11:vue-i18n 在键缺失时**静默回落成键名本身**,所以一个拼错的键会原样出现在
// 界面上(用户看到 `kvmToastResumd` 这种东西),而三道门全绿:vue-tsc 不会拿字符串字面量
// 去比对文案表,单测里断言渲染文本时往往断的又正好是键名自己的文本,build 更不管。
// 这道守卫查的方向是「源码引用的键在不在语料里」。
//
// 与既有的 parity.test.ts **不重复**:那份查的是 zh 与 en 两侧键集合是否对等、值是否非空,
// **从不读源码** ⇒ 一个两侧都不存在的键它照样放行。两份各守一个方向。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import zhBase from './zh_cn'
import enBase from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// 与运行时逐字一致:index.ts:9 装进 createI18n 的就是这两个合并结果。
// (zh_cn.ts 自己已经把 base/photos/ai 三块并好了,sp9 那片是另一套装配路径,得单独并。)
const zh: Record<string, unknown> = { ...zhBase, ...zhSp9 }
const en: Record<string, unknown> = { ...enBase, ...enSp9 }

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(vue|ts)$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

// 必须先剥注释。本仓的移植注释里大量引用 Vue2 的原始键名(`$t('Off')`、`$t('Enable')`
// 这一类"我们复用成了别的键"的说明),还有被注释掉的旧代码行 —— 实测不剥注释时会报出
// 74 条"缺键",全部是注释里的引用,一条真缺口都没有。误报会让守卫直接被人关掉,
// 所以宁可漏(注释里的键本来也不影响运行时)。
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')       // 块注释(JS 与 CSS 通用)
    .replace(/<!--[\s\S]*?-->/g, '')        // 模板里的 HTML 注释
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1') // 行注释;`[^:]` 挡住 http:// 这种
}

// 只认 `t('字面量')` 这一种形态。`t(someVar)` / `t(`x${y}`)` 静态查不了,**不要**为了
// 覆盖它们放宽正则 —— 假阴性可接受,假阳性会让守卫被关掉。
const KEY_RE = /\bt\('([a-zA-Z][a-zA-Z0-9_]*)'\)/g

describe("t() 引用的 i18n 键在两侧语料里都存在", () => {
  // 语料文件自己不是消费方(它们的内容里也带 $t('…') 的说明性引用),排除掉。
  const files = walk(SRC).filter((f) => !f.startsWith(path.join(SRC, 'i18n') + path.sep))

  it('全仓没有死键', () => {
    expect(files.length).toBeGreaterThan(100) // 防空转:目录结构变了就该红

    const missing: string[] = []
    let checked = 0
    for (const f of files) {
      const src = stripComments(fs.readFileSync(f, 'utf8'))
      for (const m of src.matchAll(KEY_RE)) {
        const k = m[1]
        checked += 1
        if (!(k in zh)) missing.push(`${path.relative(SRC, f)}: zh 缺 ${k}`)
        if (!(k in en)) missing.push(`${path.relative(SRC, f)}: en 缺 ${k}`)
      }
    }

    // 第二道防空转:正则哪天被改坏(或剥注释剥过了头)会让 checked 掉到 0,
    // 那时 missing 也是空的、测试照样绿 —— 这个下限让"什么都没检查"变成红。
    // 2026-08-09 实测约 4600 次引用,下限取一个宽松的量级,不会因正常增删而误红。
    expect(checked, '一个 t() 字面量都没扫到,守卫在空转').toBeGreaterThan(2000)

    expect(missing, `\n发现 t() 引用了不存在的键:\n${missing.join('\n')}`).toEqual([])
  })
})

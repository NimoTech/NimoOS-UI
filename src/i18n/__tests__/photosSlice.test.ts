// SP7-P8b:相册文案分片的守卫。
//
// 结构:`zh_cn.ts` 是 3 行的**合并出口**(`{...base, ...photos}`),内容在 `zh_cn.base.ts`
// 与 `zh_cn.photos.ts` 两块里。这样拆是为了**开源导出** —— 开源版没有相册区,而那 702 个
// photos* 键原先散在主文件 90 多个区段,剥它们需要 ~90 条锚点补丁 × 2 语言,而 PATCH 要求
// 锚点命中恰好 1 次 ⇒ 以后改任何一条相册文案都会把导出打红。拆开后开源侧只需删掉分片文件
// + 补丁掉出口里那行展开。
//
// 这个做法只在三个前提成立时才安全,下面三组断言各守一条:
//   ① 出口是**纯合并**、没有自己的内容 —— 否则开源侧改出口那行会连带改掉别的东西;
//   ② 相册文案**全都**在分片里(base 里一个 photos* 键都不剩)—— 否则开源包会残留相册
//      文案。「相册」是 oss/forbidden.mjs 的禁词,会被拦下,但拦到时定位成本很高;
//   ③ 分片里**只有**相册面在用的键 —— 否则删掉分片会让开源版某个保留下来的页面渲染出
//      key 名本身(vue-i18n 找不到 key 时静默回落,不报错不崩,单测也抓不到)。
//
// 读盘一律 node:fs —— 本仓测试环境里 `?raw` 恒空(color-guard 曾因此空转)。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import merged from '../zh_cn'
import mergedEn from '../en_us'
import zhBase from '../zh_cn.base'
import enBase from '../en_us.base'
import zhPhotos from '../zh_cn.photos'
import enPhotos from '../en_us.photos'
// SP8-P6-T3 合流:出口从 {base, photos} 变成 {base, photos, ai}(AI 区同理要在开源版
// 整体剥掉,做法与 photos 分片逐条对应)。本文件是 photos 分片的守卫,只在"出口是纯合并"
// 那一条上把 ai 一并计入 —— 否则该断言会把 AI 键当成"出口凭空多出来的内容"而误报。
// ai 分片自身的守卫(前缀、两语言一致、反向引用)由 T4 单独补,不在本文件里。
import zhAi from '../zh_cn.ai'
import enAi from '../en_us.ai'

const I18N_DIR = path.resolve(__dirname, '..')
const SRC_DIR = path.resolve(__dirname, '../..')

const zhKeys = Object.keys(zhPhotos as Record<string, unknown>)
const enKeys = Object.keys(enPhotos as Record<string, unknown>)

describe('相册文案分片 · 分片自身', () => {
  it('两语言键集完全一致', () => {
    expect(zhKeys.slice().sort()).toEqual(enKeys.slice().sort())
  })

  it('非空(防被误清空之后所有断言都恒真)', () => {
    expect(zhKeys.length).toBeGreaterThan(600)
  })

  it('每个键都是 photos 前缀(分片的判据就是前缀,混进别的键会让开源侧删错东西)', () => {
    const bad = zhKeys.filter((k) => !k.startsWith('photos'))
    expect(bad, `非 photos 前缀的键: ${bad.join(', ')}`).toEqual([])
  })

  it('值均为非空字符串', () => {
    for (const o of [zhPhotos, enPhotos]) {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        expect(typeof v, `key ${k}`).toBe('string')
        expect((v as string).length, `key ${k}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('相册文案分片 · 出口是纯合并', () => {
  it('zh_cn.ts / en_us.ts 导出的就是 base ∪ photos ∪ ai,不多不少', () => {
    expect(Object.keys(merged as Record<string, unknown>).sort())
      .toEqual([...Object.keys(zhBase as Record<string, unknown>), ...zhKeys,
        ...Object.keys(zhAi as Record<string, unknown>)].sort())
    expect(Object.keys(mergedEn as Record<string, unknown>).sort())
      .toEqual([...Object.keys(enBase as Record<string, unknown>), ...enKeys,
        ...Object.keys(enAi as Record<string, unknown>)].sort())
  })

  it('base 与 photos 键集不相交(展开顺序因此不构成语义)', () => {
    const dup = zhKeys.filter((k) => k in (zhBase as Record<string, unknown>))
    expect(dup, `base 与分片撞键: ${dup.join(', ')}`).toEqual([])
  })

  it('三片两两不相交(同上:展开顺序不构成语义,后展开的不会静默盖掉前面的)', () => {
    const ai = Object.keys(zhAi as Record<string, unknown>)
    expect(ai.filter((k) => k in (zhBase as Record<string, unknown>)),
      'base 与 ai 分片撞键').toEqual([])
    expect(ai.filter((k) => zhKeys.includes(k)), 'photos 与 ai 分片撞键').toEqual([])
  })

  it('出口文件本身不含任何键定义(只许 import + 一行展开)', () => {
    for (const f of ['zh_cn.ts', 'en_us.ts']) {
      const src = fs.readFileSync(path.join(I18N_DIR, f), 'utf8')
      expect(src.length, `${f} 读到空内容,取数方式失效了`).toBeGreaterThan(0)
      const keyLines = src.split('\n').filter((l) => /^ {2}[A-Za-z_$][A-Za-z0-9_]*:/.test(l))
      expect(keyLines, `${f} 出口里出现了键定义: ${keyLines.slice(0, 3).join(' | ')}`).toEqual([])
    }
  })
})

describe('相册文案分片 · 正向(base 里不许残留)', () => {
  it('base 的导出对象里没有 photos* 键', () => {
    const leftover = (o: Record<string, unknown>) => Object.keys(o).filter((k) => k.startsWith('photos'))
    expect(leftover(zhBase as Record<string, unknown>)).toEqual([])
    expect(leftover(enBase as Record<string, unknown>)).toEqual([])
  })

  it('两个 base 的源码里也没有 photos* 键行(连注释掉的残骸都不留)', () => {
    for (const f of ['zh_cn.base.ts', 'en_us.base.ts']) {
      const src = fs.readFileSync(path.join(I18N_DIR, f), 'utf8')
      expect(src.length, `${f} 读到空内容,取数方式失效了`).toBeGreaterThan(0)
      const hits = src.split('\n').filter((l) => /^ {2}photos[A-Za-z0-9_]*:/.test(l))
      expect(hits, `${f} 残留 photos 键行: ${hits.slice(0, 3).join(' | ')}`).toEqual([])
    }
  })
})

describe('相册文案分片 · 反向(分片里不许有相册面之外消费的键)', () => {
  // 把 src/ 下**除相册面之外**的源码全读进来,查每个分片键有没有被字面引用。
  // 相册面 = src/photos/** + src/views/Photos*.vue + 它们的测试 —— 这些在开源导出里整体
  // 删除,引用分片键是应该的。分片键若被这以外的地方引用,删掉分片就会让那处渲染出 key 名。
  function collectSources(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue
        if (p === path.join(SRC_DIR, 'photos')) continue          // 相册面,整体删除
        if (p === I18N_DIR) continue                              // locale 文件与本闸自身
        collectSources(p, out)
      } else if (/\.(ts|vue)$/.test(e.name)) {
        if (/^Photos.*\.(vue|test\.ts)$/.test(e.name)) continue    // 13 视图 + 16 视图测试
        if (/^photos.*\.test\.ts$/.test(e.name)) continue          // photosLayoutHeightCap 等
        out.push(p)
      }
    }
    return out
  }

  const files = collectSources(SRC_DIR)
  const corpus = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

  it('取数有效(扫到了文件、内容非空)', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(corpus.length).toBeGreaterThan(10000)
  })

  it('相册面之外没有任何地方引用分片里的键', () => {
    // 允许清单:确实被相册面之外引用、但**刻意**留在分片里的键。每条都要写清为什么 ——
    // 新增一条就等于新增一处开源侧要单独处理的残留。
    const ALLOW = new Set<string>([])
    const used = zhKeys
      .filter((k) => !ALLOW.has(k))
      .filter((k) => new RegExp(`['"\`]${k}['"\`]`).test(corpus))
    expect(used, `分片键被相册面之外引用(删分片会让那处渲染出 key 名): ${used.join(', ')}`).toEqual([])
  })
})

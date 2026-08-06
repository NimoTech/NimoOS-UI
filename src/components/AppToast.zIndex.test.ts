// 约定守卫(docs/THEMING.md §8):**toast 必须高于全仓所有模态遮罩**。
//
// 为什么需要一条测试:遮罩都带 backdrop-filter,压在遮罩下方的 toast 不是"偏灰"而是
// **完全读不到**。本期评审抓到的真实后果 —— 三条「失败了但刻意保留弹窗让用户重试」的路径
// (人物改名失败 / 建相册失败 / 命名未命名人物失败)全部把失败原因藏在 z-index 220 的
// .pd-scrim / .cad-overlay 底下,用户只看到按钮"没反应",反复重试。
//
// jsdom 不做级联样式计算,mount 后读不出跨组件的层叠关系,只能对 <style> 原文做数值断言
// (同 color-guard.test.ts / PersonAssetGrid.test.ts 已确立的 `?raw` 先例)。
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// 【SP8-P6-T3 合流】样式表的读法从 `import.meta.glob(...'?raw')` 换成 node:fs,并补上 `.scss`。
//
// 🔴 换读法的原因(比"漏了 .scss"更严重):vitest 的 CSSEnablerPlugin 把 css/scss **一律
// 整体替换成空串**,而且**不看查询串** —— `?raw` 对它无效。实测本仓:
//     vue : 340 个文件,340 个非空
//     css :   5 个文件,  0 个非空(theme.css 等全是 len=0)
//     scss:   9 个文件,  0 个非空
// 也就是说,这道「全仓任何其它 z-index 都严格低于 toast」的守卫,**此前只看得见 .vue**,
// 5 个独立 .css 从来就是空壳;若只是照搬 glob 再加一行 `.scss`,新加的 9 个 .scss 同样会是
// 空壳 —— 守卫会"绿"得毫无判别力。这正是 photosSlice.test.ts / knowledgeStyles.test.ts
// 文件头记的同一个坑(「读盘一律 node:fs,`?raw` 恒空」),这里沿用它们的既定手法。
//
// .vue 仍走 glob(它不受 CSSEnablerPlugin 影响,实测 340/340 非空)。
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function collectStylesheets(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      collectStylesheets(p, out)
    } else if (/\.(css|scss)$/.test(e.name)) {
      out[`/src/${relative(SRC_DIR, p).replace(/\\/g, '/')}`] = readFileSync(p, 'utf8')
    }
  }
  return out
}

const files: Record<string, string> = {
  ...(import.meta.glob('/src/**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...collectStylesheets(SRC_DIR),
}

// .vue 只看 <style> 块;.css/.scss 看全文。刻意与 color-guard 用同一提取思路,但这里不需要行号。
function styleText(rel: string, src: string): string {
  if (rel.endsWith('.css') || rel.endsWith('.scss')) return src
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let out = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out += `${m[1]}\n`
  return out
}

// 只认 `z-index: <整数>`(负值/auto/inherit 与本约定无关)。注释里的数字不会被误抓 ——
// 正则要求紧跟 `z-index:`。
function zIndexes(css: string): number[] {
  const out: number[] = []
  const re = /z-index\s*:\s*(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) out.push(Number(m[1]))
  return out
}

const TOAST = 'src/components/AppToast.vue'

function relOf(path: string): string {
  return path.replace(/^\//, '').replace(/\\/g, '/')
}

const toastRaw = Object.entries(files).find(([p]) => relOf(p) === TOAST)?.[1] ?? ''
const toastZ = Math.max(...zIndexes(styleText(TOAST, toastRaw)))

describe('浮层层级约定(THEMING.md §8): toast 高于所有模态遮罩', () => {
  // 🔴 取数有效性闸(SP8-P6-T3 补):上面那条全仓断言只要取到空内容就会**恒真**。
  // 本仓已经因此空转过一次(css/scss 走 `?raw` 全是空串,守卫只看得见 .vue 却一直显示绿)。
  // 这条把"确实读到了样式表、且确实扫得出 z-index"钉死,空壳化会立刻打红而不是静默通过。
  it('取数有效:.vue 与 .css/.scss 都读到了非空内容,且扫得出 z-index', () => {
    const nonEmpty = (pred: (r: string) => boolean) =>
      Object.entries(files).filter(([p, v]) => pred(relOf(p)) && typeof v === 'string' && v.length > 0)
    const vues = nonEmpty((r) => r.endsWith('.vue'))
    const sheets = nonEmpty((r) => r.endsWith('.css') || r.endsWith('.scss'))
    expect(vues.length, '.vue 一个都没读到,取数方式失效了').toBeGreaterThan(100)
    expect(sheets.length, '独立样式表一个都没读到(`?raw` 恒空的老坑)').toBeGreaterThan(5)
    const sheetZ = sheets.flatMap(([p, v]) => zIndexes(styleText(relOf(p), v)))
    expect(sheetZ.length, '独立样式表里一个 z-index 都没扫到,守卫等于空转').toBeGreaterThan(0)
  })

  it('AppToast .toast-stack 的 z-index 能被读出且是最高档', () => {
    expect(Number.isFinite(toastZ)).toBe(true)
    expect(toastZ).toBeGreaterThan(0)
  })

  it('全仓任何其它 z-index 都严格低于 toast', () => {
    const offenders: string[] = []
    for (const [path, src] of Object.entries(files)) {
      const rel = relOf(path)
      if (rel === TOAST) continue
      for (const z of zIndexes(styleText(rel, src))) {
        if (z >= toastZ) offenders.push(`  ${rel}: z-index ${z} (toast = ${toastZ})`)
      }
    }
    expect(
      offenders,
      `\n以下浮层与 toast 同层或更高,toast 会被它们(多带 backdrop-filter)压住而读不到。\n`
        + `按 docs/THEMING.md §8 的阶梯下调这些值,不要抬高 toast:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  // 本期评审命中的三条路径的两个具体遮罩,单独钉一遍(上一条即使被人放宽也还有这道)。
  it.each([
    ['src/views/PhotosPersonDetail.vue', '.pd-scrim'],
    ['src/photos/components/ClusterActionDialog.vue', '.cad-overlay'],
  ])('%s 的 %s 低于 toast', (rel, selector) => {
    const src = Object.entries(files).find(([p]) => relOf(p) === rel)?.[1]
    expect(src, `${rel} 未被 glob 收到`).toBeTruthy()
    const css = styleText(rel, src as string)
    // 取该选择器所在规则块里的 z-index。
    const block = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(css)
    expect(block, `${rel} 里找不到 ${selector} 规则块`).toBeTruthy()
    const z = zIndexes((block as RegExpExecArray)[1])
    expect(z.length, `${selector} 规则块里没有 z-index`).toBe(1)
    expect(z[0]).toBeLessThan(toastZ)
  })
})

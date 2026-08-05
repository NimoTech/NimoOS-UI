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

const files: Record<string, string> = {
  ...(import.meta.glob('/src/**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('/src/**/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
}

// .vue 只看 <style> 块;.css 看全文。刻意与 color-guard 用同一提取思路,但这里不需要行号。
function styleText(rel: string, src: string): string {
  if (rel.endsWith('.css')) return src
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

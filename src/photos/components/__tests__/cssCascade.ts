// 测试辅助(非测试文件,vitest 只收 *.test.ts):解析 SFC 的 <style> 原文并按 CSS
// 优先级判定"某个元素在 :hover 态下真正生效的 background 是哪一条声明"。
//
// 为什么需要:jsdom 既不做级联样式计算,也无法进入真实 hover 态,mount 后
// getComputedStyle 读不出 hover 结果。而本区反复踩到同一个坑——基类的 `.x:hover`
// 带伪类,优先级 (0,2,0);变体 `.x-primary` / `.x-danger` 只有一个类,(0,1,0)。
// CSS 优先级高者胜、与书写顺序无关,于是指针一进按钮,变体的实底/渐变背景就被基类的
// hover 背景整块替换,而文字色仍由变体提供 → 白底白字,按钮和文案一起消失。
// 已发现两处:ClusterActionDialog(删除键+主行动键)、MergeReviewDialog(合并键)。
//
// parseCssRules / extractStyleBlock 与 PersonAssetGrid.test.ts:210-231 同源;那份先例
// 保持原样不动(项目「禁无关重构」约定),新增的两处消费方一律用本模块。

export interface CssRule { selectors: string[]; body: string }

export function parseCssRules(styleText: string): CssRule[] {
  const rules: CssRule[] = []
  const re = /([^{}]+)\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(styleText))) {
    rules.push({ selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean), body: m[2] })
  }
  return rules
}

export function extractStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('未找到样式块')
  // 先剥 CSS 注释:否则规则上方的注释会被并进 selectors,选择器匹配全部失效。
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

const BG_DECL = /(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/

/** 某个选择器列表里"恰好等于该单个选择器"的规则自身声明的 background。 */
export function ownBackground(styleText: string, selector: string): string {
  const hit = parseCssRules(styleText).find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
  if (!hit) throw new Error(`未找到独立规则:${selector}`)
  const m = BG_DECL.exec(hit.body)
  if (!m) throw new Error(`规则 ${selector} 没有 background 声明`)
  return m[1].trim()
}

export interface HoverBgRule { selector: string; specificity: number; value: string; order: number }

// 只数类与伪类:本区这几条规则里没有 id、也没有元素标签参与,足以在
// `.x:hover` (2) 与 `.x-danger` (1) / `.x-danger:hover` (2) 之间判胜负。
function classSpecificity(selector: string): number {
  return (selector.match(/\.[\w-]+|:[\w-]+(?:\([^)]*\))?/g) ?? []).length
}

/**
 * 收集所有"作用于 class=classes 这颗元素、且处于 :hover 态"并声明了 background 的规则。
 * 按本区实际选择器形态(单个复合选择器,无后代/组合子)做保守匹配:选择器里出现的每一个
 * .class 都必须在 classes 内,伪类只允许 :hover 或 :not(...)(:not 里的类必须不在 classes 内,
 * 否则该规则不命中这颗元素)。
 */
export function hoverBackgroundRules(styleText: string, classes: string[]): HoverBgRule[] {
  const out: HoverBgRule[] = []
  let order = 0
  for (const rule of parseCssRules(styleText)) {
    for (const selector of rule.selectors) {
      order += 1
      const nots = [...selector.matchAll(/:not\(([^)]*)\)/g)].map((m) => m[1].trim())
      const bare = selector.replace(/:not\([^)]*\)/g, '')
      const classHits = bare.match(/\.[\w-]+/g) ?? []
      const pseudoHits = bare.match(/:[\w-]+(?:\([^)]*\))?/g) ?? []
      if (classHits.length === 0) continue
      if (!classHits.every((c) => classes.includes(c.slice(1)))) continue
      if (!pseudoHits.every((p) => p === ':hover')) continue
      // :not(.x) 里点到本元素带的类 → 这条规则被排除;:not(:disabled) 等状态伪类按
      // "非禁用"这一主路径当作命中。
      if (nots.some((n) => n.startsWith('.') && classes.includes(n.slice(1)))) continue
      const m = BG_DECL.exec(rule.body)
      if (!m) continue
      out.push({ selector, specificity: classSpecificity(selector), value: m[1].trim(), order })
    }
  }
  return out
}

/** 优先级最高者胜;同级取后写的那条(CSS 级联规则)。 */
export function winningHoverBackground(styleText: string, classes: string[]): HoverBgRule {
  const rules = hoverBackgroundRules(styleText, classes)
  if (rules.length === 0) throw new Error(`没有任何 background 规则命中 .${classes.join('.')}`)
  return rules.reduce((best, r) =>
    r.specificity > best.specificity || (r.specificity === best.specificity && r.order > best.order) ? r : best,
  )
}

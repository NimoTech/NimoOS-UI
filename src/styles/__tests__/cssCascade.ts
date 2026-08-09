// 测试辅助(非测试文件,vitest 只收 *.test.ts):解析 CSS 原文并按 CSS 优先级判定
// "某个元素在 :hover 态下真正生效的 background 是哪一条声明"。
//
// 为什么需要:jsdom 既不做级联样式计算,也无法进入真实 hover 态,mount 之后
// getComputedStyle 读不出 hover 结果。而这个坑反复出现——基类的 `.x:hover` 带伪类,
// 优先级 (0,2,0);变体 `.x-primary` / `.x-danger` 只有一个类,(0,1,0)。CSS 优先级
// 高者胜、与书写顺序无关,于是指针一进按钮,变体的实底/渐变背景就被基类的 hover 背景
// 整块替换,而文字色仍由变体提供 → 白底白字,按钮和文案一起消失。
//
// ⚠️ 本仓另有一份同源实现,长期只服务它自己所在的那个区(31 个引用方)。这里**刻意
// 再放一份**而不是跨区 import,原因是硬性的:那个区不在开源产物树里,跨区引用会让
// 产物树的 `vue-tsc --noEmit` 直接失败(实测:`Cannot find module`),同时"引用它"
// 这件事本身也会被开源泄漏守卫拦下。合并成一份需要改那 31 个 import,已登记为独立
// 交接票(SP16 交接票 3),不在本期做。
//
// 只搬了本处用到的那几个函数——原实现里的 ownBackground / extractStyleBlock 没有搬,
// 需要时再补,不为了"对齐"而搬用不上的代码。

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

const BG_DECL = /(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/

export interface HoverBgRule { selector: string; specificity: number; value: string; order: number }

// 数类、伪类与属性选择器(属性选择器与类选择器同权重)。这些规则里没有 id、也没有元素
// 标签参与,足以在 `.x:hover` (2) 与 `.x-danger` (1) / `.x-danger:hover` (2) 之间判胜负。
function classSpecificity(selector: string): number {
  return (selector.match(/\.[\w-]+|:[\w-]+(?:\([^)]*\))?|\[[^\]]*\]/g) ?? []).length
}

/**
 * 收集所有"作用于 class=classes 这颗元素、且处于 :hover 态"并声明了 background 的规则。
 * 按单个复合选择器(无后代/组合子)做保守匹配:选择器里出现的每一个 .class 都必须在
 * classes 内,伪类只允许 :hover 或 :not(...)(:not 里的类必须不在 classes 内,否则该
 * 规则不命中这颗元素)。
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
      // 必须先确认选择器里确实出现了 `:hover`:`pseudoHits.every(...)` 在空数组上恒真,
      // 靠"没有出现不允许的伪类"这种反向判定会把纯类选择器误收进 hover 候选里。
      if (!bare.includes(':hover')) continue
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

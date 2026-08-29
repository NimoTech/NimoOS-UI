// Test helper (not a test file, vitest only collects *.test.ts): parses SFC's <style> source and
// uses CSS specificity to determine which background declaration actually takes effect when an element is in :hover state.
//
// Why needed: jsdom neither performs cascade style computation nor can enter real hover state; after
// mount, getComputedStyle cannot read hover results. This section repeatedly hit the same pitfall —
// base class `.x:hover` has pseudo-class, specificity (0,2,0); variants `.x-primary` / `.x-danger`
// have only one class, (0,1,0). Higher CSS specificity wins regardless of source order, so when the
// pointer enters the button, the variant's solid background/gradient is replaced by the base class's
// hover background entirely, while text color is still provided by the variant → white on white, button and text both disappear.
// Found in two places: ClusterActionDialog (delete button + primary action button), MergeReviewDialog (merge button).
//
// parseCssRules / extractStyleBlock and PersonAssetGrid.test.ts:210-231 share origins; that earlier
// version stays unchanged (project "no unrelated refactoring" convention), new consumers all use this module.

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
  if (!m) throw new Error('No style block found')
  // Strip CSS comments first: otherwise comments above the rule will be merged into selectors, selector matching will fail entirely.
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

const BG_DECL = /(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/

/** Background declared by the rule whose selector list contains exactly this single selector. */
export function ownBackground(styleText: string, selector: string): string {
  const hit = parseCssRules(styleText).find((r) => r.selectors.length === 1 && r.selectors[0] === selector)
  if (!hit) throw new Error(`Standalone rule not found: ${selector}`)
  const m = BG_DECL.exec(hit.body)
  if (!m) throw new Error(`Rule ${selector} has no background declaration`)
  return m[1].trim()
}

export interface HoverBgRule { selector: string; specificity: number; value: string; order: number }

// Classes, pseudo-classes and attribute selectors: no id or element tags are involved in the rules here,
// sufficient to decide between `.x:hover` (2) and `.x-danger` (1) / `.x-danger:hover` (2).
// fix round 1 · I1: add attribute selector counting (`[data-open="true"]` etc.) — in real CSS
// specificity, attribute selectors have the same weight as class selectors; previous omission would cause attribute selector variants to systematically score lower.
function classSpecificity(selector: string): number {
  return (selector.match(/\.[\w-]+|:[\w-]+(?:\([^)]*\))?|\[[^\]]*\]/g) ?? []).length
}

/**
 * Collects all rules that apply to element with class=classes and are in :hover state and declare background.
 * Uses conservative matching based on actual selector form here (single compound selector, no descendant/combinator):
 * every .class appearing in the selector must be in classes, pseudo-classes only allow :hover or :not(...) (classes
 * inside :not must not be in classes, otherwise the rule doesn't match this element).
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
      // fix round 1 · I1(vacuous-truth gap): `pseudoHits.every(...)` is always true when pseudoHits is
      // an empty array — pure attribute/pure class selectors (no `:` pseudo-class) are incorrectly collected into
      // "hover candidates" by this always-true empty array check. This helper is named hoverBackgroundRules, must
      // first confirm `:hover` actually appears in the selector before proceeding, cannot rely on reverse logic of
      // "no disallowed pseudo-class appears".
      if (!bare.includes(':hover')) continue
      if (!pseudoHits.every((p) => p === ':hover')) continue
      // :not(.x) matches a class this element has → this rule is excluded; :not(:disabled) and other
      // state pseudo-classes are treated as matching along the "not disabled" main path.
      if (nots.some((n) => n.startsWith('.') && classes.includes(n.slice(1)))) continue
      const m = BG_DECL.exec(rule.body)
      if (!m) continue
      out.push({ selector, specificity: classSpecificity(selector), value: m[1].trim(), order })
    }
  }
  return out
}

/** Higher priority wins; at same level, the one written later takes precedence (CSS cascade rule). */
export function winningHoverBackground(styleText: string, classes: string[]): HoverBgRule {
  const rules = hoverBackgroundRules(styleText, classes)
  if (rules.length === 0) throw new Error(`No background rule matches .${classes.join('.')}`)
  return rules.reduce((best, r) =>
    r.specificity > best.specificity || (r.specificity === best.specificity && r.order > best.order) ? r : best,
  )
}

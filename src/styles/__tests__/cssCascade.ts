// Test helper (not a test file — vitest only picks up *.test.ts): parses raw CSS and decides,
// by CSS specificity, "which declaration actually wins for a given element's background under
// :hover".
//
// Why this is needed: jsdom neither computes the cascade nor can enter a real hover state, so
// getComputedStyle after mount cannot read the hover outcome. This pitfall keeps recurring — the
// base class's `.x:hover` carries a pseudo-class, giving specificity (0,2,0); a variant like
// `.x-primary` / `.x-danger` has only one class, (0,1,0). CSS specificity wins regardless of
// source order, so the moment the pointer enters the button, the variant's solid/gradient
// background gets fully replaced by the base class's hover background, while the text color
// still comes from the variant → the background and text collapse to the same pale tone and
// both the button and its label disappear.
//
// ⚠️ This repo has another copy of the same implementation elsewhere, long serving only the area
// it lives in (31 call sites). A copy is **deliberately** kept here instead of importing across
// areas, for a hard reason: that area is not in the open-source export tree, so a cross-area
// import would make the export tree's `vue-tsc --noEmit` fail outright (verified: `Cannot find
// module`), and the act of referencing it would also get flagged by the open-source leak guard.
// Merging into one copy would require changing those 31 imports, which is tracked as its own
// handoff ticket (SP16 handoff ticket 3) and is out of scope for this round.
//
// Only the handful of functions actually used here were ported — ownBackground / extractStyleBlock
// from the original implementation were not, and can be added later if needed; no point porting
// unused code just to "stay in sync".

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

// Counts classes, pseudo-classes, and attribute selectors (attribute selectors carry the same
// weight as class selectors). None of these rules involve an id or an element tag, so this is
// enough to decide the winner between `.x:hover` (2) and `.x-danger` (1) / `.x-danger:hover` (2).
function classSpecificity(selector: string): number {
  return (selector.match(/\.[\w-]+|:[\w-]+(?:\([^)]*\))?|\[[^\]]*\]/g) ?? []).length
}

/**
 * Collects every rule that "applies to the element carrying class=classes, while it is in
 * :hover state" and declares a background. Matching is conservative and limited to a single
 * compound selector (no descendant/combinator): every .class appearing in the selector must be
 * in classes, and the only pseudo-classes allowed are :hover or :not(...) (the class inside :not
 * must not be in classes, otherwise the rule does not match this element).
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
      // Must first confirm the selector actually contains `:hover`: `pseudoHits.every(...)` is
      // vacuously true on an empty array, so relying only on the inverse check — "no disallowed
      // pseudo-class showed up" — would wrongly sweep plain class selectors into the hover
      // candidates.
      if (!bare.includes(':hover')) continue
      if (!pseudoHits.every((p) => p === ':hover')) continue
      // :not(.x) naming a class this element carries → the rule is excluded; state pseudo-classes
      // like :not(:disabled) are treated as a match along the "not disabled" main path.
      if (nots.some((n) => n.startsWith('.') && classes.includes(n.slice(1)))) continue
      const m = BG_DECL.exec(rule.body)
      if (!m) continue
      out.push({ selector, specificity: classSpecificity(selector), value: m[1].trim(), order })
    }
  }
  return out
}

/** Highest specificity wins; ties go to whichever was written last (CSS cascade rule). */
export function winningHoverBackground(styleText: string, classes: string[]): HoverBgRule {
  const rules = hoverBackgroundRules(styleText, classes)
  if (rules.length === 0) throw new Error(`no background rule matched .${classes.join('.')}`)
  return rules.reduce((best, r) =>
    r.specificity > best.specificity || (r.specificity === best.specificity && r.order > best.order) ? r : best,
  )
}

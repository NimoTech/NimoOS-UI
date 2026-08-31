import { describe, it, expect } from 'vitest'
import {
  SV_SUGGEST_POOL,
  inferChips,
  SV_QUICK_TEMPLATES,
} from '../smartViewSuggest'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

describe('SV_SUGGEST_POOL', () => {
  it('has 20 rows total, and every row\'s kw and chips are non-empty arrays', () => {
    expect(SV_SUGGEST_POOL.length).toBe(20)
    for (const row of SV_SUGGEST_POOL) {
      expect(Array.isArray(row.kw)).toBe(true)
      expect(row.kw.length).toBeGreaterThan(0)
      expect(Array.isArray(row.chips)).toBe(true)
      expect(row.chips.length).toBeGreaterThan(0)
    }
  })
})

describe('inferChips', () => {
  it('empty/falsy input -> []', () => {
    expect(inferChips('')).toEqual([])
    expect(inferChips(undefined as unknown as string)).toEqual([])
  })

  it('matches come out in POOL definition order (not the order they appear in the query)', () => {
    // In the input, Tokyo comes first, Sara is in the middle, sunset is last -- but in POOL,
    // the sunset row is 1st, the place:Japan row is 4th, and the Sara row is 7th -- the
    // result must follow POOL's order.
    expect(inferChips('Sunsets with Sara in Tokyo')).toEqual([
      'scene: sunset',
      'place: Japan',
      'Sara',
    ])
  })

  it('case-insensitive', () => {
    expect(inferChips('SUNSET')).toEqual(inferChips('sunset'))
  })

  it('dedupes: when two rows match and share the same chip, it only appears once', () => {
    // 'receipt' and 'invoice' are both on the same row (the ocr: receipt | invoice row);
    // even matching it twice should only produce it once
    const out = inferChips('receipt and invoice document')
    const count = out.filter((c) => c === 'ocr: receipt | invoice').length
    expect(count).toBe(1)
  })

  it('.slice(0, 8): when >= 9 chips match, the length is exactly 8', () => {
    const text = [
      'sunset', 'beach', 'food', 'tokyo', 'paris',
      'lily', 'sara', 'family', 'dog', 'cat',
    ].join(' ')
    const out = inferChips(text)
    expect(out.length).toBe(8)
  })
})

describe('SV_QUICK_TEMPLATES', () => {
  it('has 5 rows total, labelKey/descKey are all found in both zh_cn and en_us, thresh is [75,88,80,65,85] in order', () => {
    expect(SV_QUICK_TEMPLATES.length).toBe(5)
    const zhRec = zh as Record<string, unknown>
    const enRec = en as Record<string, unknown>
    for (const t of SV_QUICK_TEMPLATES) {
      expect(zhRec[t.labelKey], `zh missing ${t.labelKey}`).toBeDefined()
      expect(enRec[t.labelKey], `en missing ${t.labelKey}`).toBeDefined()
      expect(zhRec[t.descKey], `zh missing ${t.descKey}`).toBeDefined()
      expect(enRec[t.descKey], `en missing ${t.descKey}`).toBeDefined()
    }
    expect(SV_QUICK_TEMPLATES.map((t) => t.thresh)).toEqual([75, 88, 80, 65, 85])
  })

  it('feeding descEn into inferChips works (the family-weekends entry should match scene: family gathering)', () => {
    const familyTemplate = SV_QUICK_TEMPLATES[0]
    expect(familyTemplate.labelKey).toBe('photosSvFamilyWeekends')
    expect(inferChips(familyTemplate.descEn).length).toBeGreaterThan(0)
    expect(inferChips(familyTemplate.descEn)).toContain('scene: family gathering')
  })

  // Finding (recorded in the task report): the brief's Step 1 originally required
  // "inferChips(SV_QUICK_TEMPLATES[0].descKey) is empty" -- this doesn't hold up under
  // testing. The 5 templates' descKey is the camelCased form of the English original
  // (descEn) (e.g. photosSvFamilyWeekendsPark itself contains the substring 'family'), and
  // testing each one against SV_SUGGEST_POOL individually, all 5 templates' descKey and
  // descEn produce identical match results (either both match or neither does) -- the
  // camelCasing preserves the same English keyword substrings, it doesn't "silence" them the
  // way an opaque id would.
  // The descEn field is still the right architectural decision (it's the field T5 is
  // supposed to call, guarding against a future where key naming switches to truly opaque
  // ids, or the POOL keywords expand and the two no longer coincidentally overlap), but under
  // the current dataset there's no way to construct a distinguishing case where "descEn
  // matches, descKey doesn't" -- recorded honestly rather than faking an assertion.
  it('known finding: the current 5 templates\' descKey happens to produce the same match results as descEn (camelCasing preserved the English substrings, see the task report for details)', () => {
    for (const tpl of SV_QUICK_TEMPLATES) {
      expect(inferChips(tpl.descKey)).toEqual(inferChips(tpl.descEn))
    }
  })
})

// COND_SUGGESTIONS / condSuggestionsFor and their tests were deleted
// along with the "Add condition" popover that was their only consumer -- deleted, not
// re-homed, because the capability itself is gone.

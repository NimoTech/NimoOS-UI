import { describe, it, expect } from 'vitest'
import {
  SV_SUGGEST_POOL,
  inferChips,
  SV_QUICK_TEMPLATES,
  COND_SUGGESTIONS,
  condSuggestionsFor,
} from '../smartViewSuggest'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

describe('SV_SUGGEST_POOL', () => {
  it('共 20 行,每行 kw 与 chips 都非空数组', () => {
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
  it('空/假值输入 → []', () => {
    expect(inferChips('')).toEqual([])
    expect(inferChips(undefined as unknown as string)).toEqual([])
  })

  it('按 POOL 定义顺序命中(不是查询里的出现顺序)', () => {
    // 输入里 Tokyo 在前、Sara 在中间、sunset 在最后,
    // 但 POOL 里 sunset 行排第 1、place:Japan 行排第 4、Sara 行排第 7 —— 结果须按 POOL 顺序。
    expect(inferChips('Sunsets with Sara in Tokyo')).toEqual([
      'scene: sunset',
      'place: Japan',
      'Sara',
    ])
  })

  it('大小写不敏感', () => {
    expect(inferChips('SUNSET')).toEqual(inferChips('sunset'))
  })

  it('去重:两行命中且共享同一个 chip 时只出现一次', () => {
    // 'receipt' 与 'invoice' 都在同一行(ocr: receipt | invoice 那行),命中两次也只应出现一次
    const out = inferChips('receipt and invoice document')
    const count = out.filter((c) => c === 'ocr: receipt | invoice').length
    expect(count).toBe(1)
  })

  it('.slice(0, 8):命中 ≥9 条 chip 时长度恰为 8', () => {
    const text = [
      'sunset', 'beach', 'food', 'tokyo', 'paris',
      'lily', 'sara', 'family', 'dog', 'cat',
    ].join(' ')
    const out = inferChips(text)
    expect(out.length).toBe(8)
  })
})

describe('SV_QUICK_TEMPLATES', () => {
  it('共 5 行,labelKey/descKey 都能在 zh_cn 与 en_us 里查到,thresh 依次为 [75,88,80,65,85]', () => {
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

  it('descEn 喂 inferChips 有效(家庭周末那条应命中 scene: family gathering)', () => {
    const familyTemplate = SV_QUICK_TEMPLATES[0]
    expect(familyTemplate.labelKey).toBe('photosSvFamilyWeekends')
    expect(inferChips(familyTemplate.descEn).length).toBeGreaterThan(0)
    expect(inferChips(familyTemplate.descEn)).toContain('scene: family gathering')
  })

  // 发现(任务报告已登记):brief Step 1 原要求「inferChips(SV_QUICK_TEMPLATES[0].descKey)
  // 为空」——实测不成立。5 个模板的 descKey 是英文原文(descEn)的驼峰化产物(如
  // photosSvFamilyWeekendsPark 本身含 'family' 子串),对 SV_SUGGEST_POOL 逐一实测,
  // 全部 5 个模板的 descKey 与 descEn 命中结果完全相同(要么都命中、要么都不命中)——
  // 驼峰化保留了同样的英文关键词子串,并没有像不透明 id 那样"消音"。
  // descEn 字段仍是正确的架构决策(它是 T5 该调用的字段,防御未来 key 命名改为真正不透明
  // id、或 POOL 关键词扩充后两者不再巧合重叠的情形),但当前数据集下无法造出一条"descEn
  // 命中、descKey 不命中"的区分性用例 —— 如实记录,不伪造断言。
  it('已知发现:当前 5 个模板的 descKey 恰好与 descEn 命中结果相同(驼峰保留了英文子串,详见任务报告)', () => {
    for (const tpl of SV_QUICK_TEMPLATES) {
      expect(inferChips(tpl.descKey)).toEqual(inferChips(tpl.descEn))
    }
  })
})

describe('COND_SUGGESTIONS / condSuggestionsFor', () => {
  it('COND_SUGGESTIONS 共 12 条', () => {
    expect(COND_SUGGESTIONS.length).toBe(12)
  })

  it('condSuggestionsFor(["scene: sunset"]) 不含该项且长度 8', () => {
    const out = condSuggestionsFor(['scene: sunset'])
    expect(out).not.toContain('scene: sunset')
    expect(out.length).toBe(8)
  })

  it('condSuggestionsFor([]) 长度 8', () => {
    expect(condSuggestionsFor([]).length).toBe(8)
  })

  it('condSuggestionsFor(前 10 条) 长度 2', () => {
    const out = condSuggestionsFor(COND_SUGGESTIONS.slice(0, 10) as string[])
    expect(out.length).toBe(2)
  })
})

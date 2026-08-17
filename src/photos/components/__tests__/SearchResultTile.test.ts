// SP7-P7a-T15: SearchResultTile.vue —— 搜索结果单个瓦片(照片/长尾两个网格共用)。
// 结构去重(brief 结构规格 4 的裁定):Vue2 PhotosSearchView.vue 把同样 8 行标记重复
// 写了两遍(:243-250 与 :261-268),New-UI 抽成独立文件,视觉逐元素 1:1、结构去重。
// 逐条对应 task-15-brief.md「必含测试清单」B 段的 tile 部分 + 两条腿审计(scss :2711-2770,
// 跳过 :2728-2738 死 CSS)。只 mock @nimotech/nimoos-service 的 thumbnailUrl。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { ScoredPhoto } from '../../util/searchSort'
import { assetToPhoto, type Photo } from '../../util/assetToPhoto'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import { readFileSync } from 'node:fs'
import SearchResultTile from '../SearchResultTile.vue'
import searchResultTileRaw from '../SearchResultTile.vue?raw'
import themingDocRaw from '../../../../docs/THEMING.md?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function photo(id: string, overrides: Partial<Photo> = {}): Photo {
  return { ...assetToPhoto({ id, mimeType: 'image/jpeg' }), ...overrides }
}

function scored(id: string, score: number | null, overrides: Partial<Photo> = {}): ScoredPhoto {
  return { p: photo(id, overrides), score }
}

function mountTile(result: ScoredPhoto, i18n = makeI18n()) {
  return mount(SearchResultTile, { props: { result }, global: { plugins: [i18n] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

describe('媒体类型徽标(四态,三元顺序:isVideo > hasOcr > photo)', () => {
  it('纯照片 → data-type="photo"', () => {
    const w = mountTile(scored('1', 0.9))
    expect(w.get('.type-badge').attributes('data-type')).toBe('photo')
  })
  it('isVideo → data-type="video"', () => {
    const w = mountTile(scored('1', 0.9, { isVideo: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('video')
  })
  it('hasOcr → data-type="ocr"', () => {
    const w = mountTile(scored('1', 0.9, { hasOcr: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('ocr')
  })
  it('isVideo 与 hasOcr 同真 → video 胜出(三元顺序,不是 ocr)', () => {
    const w = mountTile(scored('1', 0.9, { isVideo: true, hasOcr: true }))
    expect(w.get('.type-badge').attributes('data-type')).toBe('video')
  })
})

describe('匹配来源(ocr 文本命中 vs 语义相似度百分比,互斥)', () => {
  it("matchedBy: 'ocr' → 出 .match-source 且无 .match-score", () => {
    const w = mountTile(scored('1', 1, { matchedBy: 'ocr' }))
    expect(w.find('.match-source').exists()).toBe(true)
    expect(w.find('.match-score').exists()).toBe(false)
    expect(w.get('.match-source').text()).toBe('文本匹配')
  })
  it("matchedBy: 'semantic' + score: 0.87 → .match-score 文本 87%", () => {
    const w = mountTile(scored('1', 0.87, { matchedBy: 'semantic' }))
    expect(w.find('.match-source').exists()).toBe(false)
    expect(w.get('.match-score').text()).toBe('87%')
  })
  it('score: null(且非 ocr)→ 两者都无', () => {
    const w = mountTile({ p: photo('1', { matchedBy: null }), score: null })
    expect(w.find('.match-source').exists()).toBe(false)
    expect(w.find('.match-score').exists()).toBe(false)
  })
})

describe('收藏星', () => {
  it('fav: true → .tile-fav 在', () => {
    const w = mountTile(scored('1', 0.9, { fav: true }))
    expect(w.find('.tile-fav').exists()).toBe(true)
  })
  it('fav: false → .tile-fav 不在', () => {
    const w = mountTile(scored('1', 0.9, { fav: false }))
    expect(w.find('.tile-fav').exists()).toBe(false)
  })
  // fix round 1 · I1(评审 Important 必修):此前只断言 .tile-fav 是否存在,从未断言过
  // 星形 <path d> 本身——评审变异把末位 `6-.9z`→`6-.8z` 后 50 例全绿,证明这条护栏
  // 此前不存在。d 逐字符抄自 Vue2 PhotosIcon.vue 的 star 分支。
  it('fav: true → star 的 path d 与 PhotosIcon.vue 逐字符一致', () => {
    const w = mountTile(scored('1', 0.9, { fav: true }))
    expect(w.get('.tile-fav svg path').attributes('d')).toBe('M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z')
  })
})

describe('交互', () => {
  it('点击 tile → emit open 带 r.p', () => {
    const r = scored('42', 0.5)
    const w = mountTile(r)
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })
  it("thumbnailUrl 参数是 (id, 'small')", () => {
    mountTile(scored('7', 0.5))
    expect(thumbnailUrl).toHaveBeenCalledWith('7', 'small')
  })
  it('img 带 loading="lazy" 与空 alt(照 Vue2 :244)', () => {
    const w = mountTile(scored('1', 0.5))
    const img = w.get('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('')
  })
})

describe('i18n', () => {
  it('英文 locale 下三个徽标文案正确', () => {
    const wPhoto = mountTile(scored('1', 0.9), makeI18n('en_us'))
    expect(wPhoto.get('.type-badge').text()).toBe('Photo')
    const wVideo = mountTile(scored('1', 0.9, { isVideo: true }), makeI18n('en_us'))
    expect(wVideo.get('.type-badge').text()).toBe('Video')
    const wOcr = mountTile(scored('1', 0.9, { hasOcr: true }), makeI18n('en_us'))
    expect(wOcr.get('.type-badge').text()).toBe('OCR')
  })
})

// extractStyleBlock 会先剥掉 CSS 注释(避免规则上方的注释被并进选择器,见 cssCascade.ts
// 顶部注释),所以选择器/属性匹配用它;但这条测试恰恰要检查"注释本身写了什么",必须留着
// 原始注释,另写一个不剥注释的提取器(逻辑同 color-guard.test.ts 的 styleLines,专供本文件)。
function rawStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('未找到样式块')
  return m[1]
}

// ── 两条腿审计:scss :2711-2772(跳过 :2728-2738 死 CSS)+ tile 结构自身样式 ──────
describe('样式:徽标前景色合规 + theme-exception 三禁 + 死 CSS 未迁', () => {
  const styleText = extractStyleBlock(searchResultTileRaw)
  const rawStyleText = rawStyleBlock(searchResultTileRaw)

  it('样式文本非空(防守卫静默空转)', () => {
    expect(styleText.trim().length).toBeGreaterThan(0)
  })

  it('.match-badge 不在样式块里(死 CSS,scss:2728-2738 未迁)', () => {
    expect(styleText).not.toMatch(/\.match-badge/)
  })

  it('四个徽标类所在规则不含 --on-accent(叠在照片上,禁用饱和实底前景色语义)', () => {
    expect(styleText).not.toMatch(/--on-accent/)
  })

  it('三个 badge token 被引用(--badge-photo/--badge-video/--badge-ocr)', () => {
    expect(styleText).toMatch(/--badge-photo/)
    expect(styleText).toMatch(/--badge-video/)
    expect(styleText).toMatch(/--badge-ocr/)
  })

  // fix round 1 · I2(评审 Important 必修,brief:81 明文要求但此前缺席):三个 token
  // 的登记只落在 docs/THEMING.md 的文本里,此前没有任何守卫——删掉那一行,token 就
  // 退化成"theme.css 里凭空出现的魔术色",而全量仍全绿。§6 例外清单是唯一的可查索引,
  // 必须钉住。读文件的守卫先断言非空(否则空转,color-guard 历史上就空转过一次),
  // 再对三个 token 名各断一次(三条独立断言,删任一个都红)。
  it('docs/THEMING.md 能查到三个 badge token(唯一可查索引,防止 token 与文档失联)', () => {
    expect(themingDocRaw.trim().length).toBeGreaterThan(0)
    expect(themingDocRaw).toContain('--badge-photo')
    expect(themingDocRaw).toContain('--badge-video')
    expect(themingDocRaw).toContain('--badge-ocr')
  })

  it('每个 theme-exception 注释紧贴的下一条声明是被豁免的字面量声明,注释文本不含 ; / } / 字面 #', () => {
    const lines = rawStyleText.split('\n')
    const exceptionLines: number[] = []
    lines.forEach((l, i) => { if (l.includes('theme-exception')) exceptionLines.push(i) })
    expect(exceptionLines.length).toBeGreaterThan(0)
    for (const i of exceptionLines) {
      // 注释可能跨多行(本文件里 .tile-fav 那条即是),先找到注释块真正结束的那一行
      // (含 `*/` 的那一行),再检查其后紧邻的声明行——这与 color-guard.test.ts 的
      // "豁免作用到下一个 ; 或 }" 状态机语义一致,而不是要求注释物理上只占一行。
      let closeIdx = i
      while (closeIdx < lines.length && !lines[closeIdx].includes('*/')) closeIdx++
      expect(closeIdx, `第 ${i} 行的 theme-exception 注释没有找到闭合 */`).toBeLessThan(lines.length)
      // 注释文本本身(跨越 i..closeIdx 的整段)不能包含字面颜色值或语句结束符
      // (否则会被 color-guard 的逐行状态机当作声明误判、提前收豁免窗口或误报裸色值)。
      const commentBody = lines.slice(i, closeIdx + 1).join('\n').replace(/\/\*|\*\//g, '')
      expect(commentBody).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(commentBody).not.toContain(';')
      // fix round 1 · M-2(评审并入):测试标题写"不含 ; / } / 字面 #"三禁,但此前只
      // 断言了 ; 与 #,漏了 }——注释里出现 } 同样会让 color-guard 的逐行状态机
      // (fix 波 F4 引用清扫,回源核对真值:真实行号是 color-guard.test.ts:98
      // `if (line.includes(';') || line.includes('}')) exempt = false`——:96 那行
      // 实际是 `if (HEX.test(bare) || FUNC.test(bare)) offenders.push(...)`,是同一个
      // forEach 里另一条判断,不是这条)提前收豁免窗口,后果与 ; 同类,必须一起断言。
      expect(commentBody).not.toContain('}')
      // 紧邻声明真实存在:同一行(注释与声明同行)或紧接的下一行。
      const closeLine = lines[closeIdx]
      const sameLineHasDecl = /:\s*[^;]+;/.test(closeLine.replace(/\/\*[\s\S]*?\*\//, ''))
      const nextLineHasDecl = closeIdx + 1 < lines.length && /:\s*[^;]+;/.test(lines[closeIdx + 1])
      expect(sameLineHasDecl || nextLineHasDecl).toBe(true)
    }
  })

  // Plan F Task 2 (2026-08-15): the fix round 1 · M-5 ruling this test used to pin ("8px to
  // match PhotosGrid.vue, not Vue2's 3px, so search tiles aren't sharper-cornered than library
  // tiles") stopped being true once PhotosGrid.vue's own Task 6 网格重刻 re-skin reverted ITS
  // tiles back to Vue2 parity's 3px (predating this task; `grep -n "border-radius"
  // src/photos/components/PhotosGrid.vue` has zero hits). Keeping 8px here would have recreated
  // the exact inconsistency the deviation was meant to avoid, just inverted. The whole `.tile`
  // rule (background + border-radius) is deleted from this component's scoped style — it was a
  // byte-for-byte duplicate of vue2-parity/photos.scss's own `.photos-root .tile` (:427-430)
  // once background used the correct local `--surface-2` instead of the leaking generic
  // `--chip-bg`, so nothing is lost handing it over outright.
  it('本组件 scoped style 不再含 .tile 规则(已整体移交 parity,含 border-radius 与 background 两处修正)', () => {
    const rules = parseCssRules(styleText)
    expect(rules.some((r) => r.selectors.length === 1 && r.selectors[0] === '.tile')).toBe(false)
  })

  it('parity scss:.photos-root .tile 规则含 border-radius: 3px / background: var(--surface-2)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.length === 1 && r.selectors[0] === '.photos-root .tile',
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/border-radius:\s*3px/)
    expect(rule?.body).toMatch(/background:\s*var\(--surface-2\)/)
  })

  it('本组件 style 块不再引用 --chip-bg(此前 .tile 背景误用的全局玻璃 token;历史说明性文字仍可在脚本注释里提到这个名字,故只查样式块)', () => {
    expect(styleText).not.toMatch(/--chip-bg\b/)
  })

  it('.tile-overlay 规则体含渐变背景与 transition(两条腿:内联/scss 非颜色属性)', () => {
    const m = /\.tile-overlay\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .tile-overlay 规则体').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/opacity:\s*0/)
    expect(body).toMatch(/transition:\s*opacity 0\.18s ease/)
    expect(body).toMatch(/z-index:\s*3/)
    expect(body).toMatch(/pointer-events:\s*none/)
  })

  it('.type-badge 基类含 text-transform/letter-spacing/font-weight/backdrop-filter/box-shadow(D3,逐条不漏)', () => {
    const m = /(?<!\[data-type[^{]*)\.type-badge\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .type-badge 基类规则体').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/text-transform:\s*uppercase/)
    expect(body).toMatch(/letter-spacing:\s*0\.05em/)
    expect(body).toMatch(/font-weight:\s*700/)
    expect(body).toMatch(/backdrop-filter:\s*blur\(8px\)/)
    expect(body).toMatch(/box-shadow:/)
  })

  it('.match-source 规则体含 backdrop-filter + box-shadow(D4)', () => {
    const m = /\.match-source\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .match-source 规则体').toBeTruthy()
    const body = m![1]
    expect(body).toMatch(/backdrop-filter:\s*blur\(8px\)/)
    expect(body).toMatch(/box-shadow:/)
    expect(body).toMatch(/text-transform:\s*uppercase/)
  })

  it('.tile-fav 规则体含 filter: drop-shadow(D5 先例,收藏星投影)', () => {
    const m = /\.tile-fav\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '未找到 .tile-fav 规则体').toBeTruthy()
    expect(m![1]).toMatch(/filter:\s*drop-shadow/)
  })
})

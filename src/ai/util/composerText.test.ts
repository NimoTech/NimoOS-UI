// 1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue:180-196 / 300-335 / 355-428
import { describe, it, expect } from 'vitest'
import {
  getExt, basename, dirname, scanMention, buildDrillText, buildPopText, stripMentionToken,
  mentionPrefix, parseActiveMention,
} from './composerText'

describe('composerText 路径小工具(AgentComposer.vue:180-196)', () => {
  it('getExt:无点或首字符为点时返回空串', () => {
    expect(getExt('a.TXT')).toBe('txt')
    expect(getExt('noext')).toBe('')
    expect(getExt('.bashrc')).toBe('')
  })
  it('basename:先剥尾部斜杠', () => {
    expect(basename('/DATA/docs/')).toBe('docs')
    expect(basename('/DATA/a.txt')).toBe('a.txt')
  })
  it('dirname:根一级返回 /', () => {
    expect(dirname('/DATA/docs/a.txt')).toBe('/DATA/docs')
    expect(dirname('/a')).toBe('/')
  })
})

describe('scanMention 触发判定(AgentComposer.vue:300-335)', () => {
  it('@ 在开头即触发,segments 取除末段外全部', () => {
    const t = '@Drive1/docs/re'
    expect(scanMention(t, t.length)).toEqual({ open: true, start: 0, segments: ['Drive1', 'docs'], query: 're' })
  })
  it('@ 前是空白也触发', () => {
    const t = 'look @doc'
    expect(scanMention(t, t.length)).toMatchObject({ open: true, start: 5, query: 'doc' })
  })
  it('@ 前是单词字符(邮箱)不触发', () => {
    const t = 'me@host'
    expect(scanMention(t, t.length).open).toBe(false)
  })
  it('遇到空白先于 @ 则不触发(mention 路径不含空格)', () => {
    const t = '@Drive1 docs'
    expect(scanMention(t, t.length).open).toBe(false)
  })
  it('无 @ 时不触发', () => {
    expect(scanMention('hello', 5).open).toBe(false)
  })
  it('caret 在字符串中间:只应扫描到 caret 为止,忽略其后的文本', () => {
    const t = '@Drive1/do tail'
    const caret = t.indexOf('do') + 'do'.length // 紧跟在 "do" 之后,tail 部分不应被看到
    expect(scanMention(t, caret)).toEqual({ open: true, start: 0, segments: ['Drive1'], query: 'do' })
  })
})

describe('mention 文本改写与光标(AgentComposer.vue:355-428)', () => {
  it('buildDrillText:追加 "<name>/" 并把光标落在其后', () => {
    const r = buildDrillText('@Dr', 0, 3, [], 'Drive1')
    expect(r.text).toBe('@Drive1/')
    expect(r.segments).toEqual(['Drive1'])
    expect(r.caretPos).toBe(8)
  })
  it('buildDrillText:保留光标之后的原文', () => {
    const r = buildDrillText('@Dr tail', 0, 3, [], 'Drive1')
    expect(r.text).toBe('@Drive1/ tail')
  })
  it('buildPopText:弹掉最后一段;段全空时只留 @', () => {
    const r1 = buildPopText('@Drive1/docs/', 0, 13, ['Drive1', 'docs'])
    expect(r1.text).toBe('@Drive1/')
    expect(r1.segments).toEqual(['Drive1'])
    const r2 = buildPopText('@Drive1/', 0, 8, ['Drive1'])
    expect(r2.text).toBe('@')
    expect(r2.segments).toEqual([])
  })
  it('buildPopText:保留光标之后的原文(caret 在字符串中间)', () => {
    const r = buildPopText('@Drive1/docs/ tail', 0, 13, ['Drive1', 'docs'])
    expect(r.text).toBe('@Drive1/ tail')
    expect(r.segments).toEqual(['Drive1'])
  })
  it('stripMentionToken:整段 @token 删掉、不插入任何文本', () => {
    const r = stripMentionToken('see @Drive1/a.txt now', 4, 17)
    expect(r.text).toBe('see  now')
    expect(r.caretPos).toBe(4)
  })
})

// P1c1 验收补丁 task 4 —— @ 提及词改为「状态跟踪」而非从文字反推,修掉挂载点
// 显示名(如 `System (/DATA)`)既含空格又含斜杠时面板丢失的缺陷。见
// .superpowers/sdd/p1c1-patch-task-4-brief.md「根因」「纯函数」两节。
describe('mentionPrefix(AgentComposer.vue drillIn/popSegment 前缀拼接,去重后的唯一来源)', () => {
  it('无段落时只是裸 "@"', () => {
    expect(mentionPrefix([])).toBe('@')
  })
  it('段落里含空格与斜杠也原样拼接,不做任何转义/分词', () => {
    expect(mentionPrefix(['System (/DATA)', '.system_data'])).toBe('@System (/DATA)/.system_data/')
  })
})

describe('parseActiveMention(状态优先判定,不再靠 scanMention 从文字反推 segments)', () => {
  const segs = ['System (/DATA)', '.system_data']
  const prefixed = '@System (/DATA)/.system_data/' // = mentionPrefix(segs)

  it('caret 恰好落在前缀末尾:命中,query 为空', () => {
    expect(parseActiveMention(prefixed, 0, segs, prefixed.length)).toEqual({ active: true, query: '' })
  })

  it('前缀之后又敲了筛选词:query 取前缀之后到 caret 的一段', () => {
    const t = prefixed + 're'
    expect(parseActiveMention(t, 0, segs, t.length)).toEqual({ active: true, query: 're' })
  })

  it('前缀被改动(例如 "@" 被删掉)则判定不成立', () => {
    const t = 'System (/DATA)/.system_data/re' // 少了开头的 '@'
    expect(parseActiveMention(t, 0, segs, t.length)).toEqual({ active: false, query: '' })
  })

  it('前缀中间字符被改动也判定不成立', () => {
    const t = '@System (/DATB)/.system_data/re' // (/DATA) 被改成了 (/DATB)
    expect(parseActiveMention(t, 0, segs, t.length)).toEqual({ active: false, query: '' })
  })

  it('caret 落在前缀内部(尚未敲完前缀)则判定不成立', () => {
    // caret 停在 "System (" 中间,还没到 "/.system_data/" 那一段
    const caret = '@System ('.length
    expect(parseActiveMention(prefixed, 0, segs, caret)).toEqual({ active: false, query: '' })
  })

  it('start < 0(从未记录过提及词)直接判定不成立', () => {
    expect(parseActiveMention(prefixed, -1, segs, prefixed.length)).toEqual({ active: false, query: '' })
  })

  it('对照组:名字既含空格又含斜杠时,scanMention 做不到但 parseActiveMention 能——' +
     '这正是本补丁要修的缺陷(brief「根因」1、2 两点)', () => {
    // scanMention 从 caret 往前扫,一遇到 "System (/DATA)" 里的空格就会 break,
    // 判定 open:false —— 面板因此丢失(用户复现的原始 bug)。
    expect(scanMention(prefixed, prefixed.length).open).toBe(false)
    // parseActiveMention 不做逐字符反推,只做前缀切片比较,天然不受空格/斜杠影响。
    expect(parseActiveMention(prefixed, 0, segs, prefixed.length)).toEqual({ active: true, query: '' })
  })
})

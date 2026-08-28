// 1:1 ported from Vue2 src/views/AI/Agent/shell/AgentComposer.vue:180-196 / 300-335 / 355-428
import { describe, it, expect } from 'vitest'
import {
  getExt, basename, dirname, scanMention, buildDrillText, buildPopText, stripMentionToken,
  mentionPrefix, parseActiveMention,
} from './composerText'

describe('composerText path utilities (AgentComposer.vue:180-196)', () => {
  it('getExt: no dot or starts with dot → returns empty string', () => {
    expect(getExt('a.TXT')).toBe('txt')
    expect(getExt('noext')).toBe('')
    expect(getExt('.bashrc')).toBe('')
  })
  it('basename: strip trailing slash first', () => {
    expect(basename('/DATA/docs/')).toBe('docs')
    expect(basename('/DATA/a.txt')).toBe('a.txt')
  })
  it('dirname: root level returns /', () => {
    expect(dirname('/DATA/docs/a.txt')).toBe('/DATA/docs')
    expect(dirname('/a')).toBe('/')
  })
})

describe('scanMention trigger check (AgentComposer.vue:300-335)', () => {
  it('@ at start triggers, segments takes all except last', () => {
    const t = '@Drive1/docs/re'
    expect(scanMention(t, t.length)).toEqual({ open: true, start: 0, segments: ['Drive1', 'docs'], query: 're' })
  })
  it('@ preceded by whitespace also triggers', () => {
    const t = 'look @doc'
    expect(scanMention(t, t.length)).toMatchObject({ open: true, start: 5, query: 'doc' })
  })
  it('@ preceded by word character (email) does not trigger', () => {
    const t = 'me@host'
    expect(scanMention(t, t.length).open).toBe(false)
  })
  it('whitespace before @ → no trigger (mention paths have no spaces)', () => {
    const t = '@Drive1 docs'
    expect(scanMention(t, t.length).open).toBe(false)
  })
  it('no @ → no trigger', () => {
    expect(scanMention('hello', 5).open).toBe(false)
  })
  it('caret in middle of string: only scan up to caret, ignore text after', () => {
    const t = '@Drive1/do tail'
    const caret = t.indexOf('do') + 'do'.length // right after "do", tail part should not be seen
    expect(scanMention(t, caret)).toEqual({ open: true, start: 0, segments: ['Drive1'], query: 'do' })
  })
})

describe('mention text rewrite and caret (AgentComposer.vue:355-428)', () => {
  it('buildDrillText: append "<name>/" and place caret after', () => {
    const r = buildDrillText('@Dr', 0, 3, [], 'Drive1')
    expect(r.text).toBe('@Drive1/')
    expect(r.segments).toEqual(['Drive1'])
    expect(r.caretPos).toBe(8)
  })
  it('buildDrillText: preserve original text after caret', () => {
    const r = buildDrillText('@Dr tail', 0, 3, [], 'Drive1')
    expect(r.text).toBe('@Drive1/ tail')
  })
  it('buildPopText: pop last segment; when empty keep only @', () => {
    const r1 = buildPopText('@Drive1/docs/', 0, 13, ['Drive1', 'docs'])
    expect(r1.text).toBe('@Drive1/')
    expect(r1.segments).toEqual(['Drive1'])
    const r2 = buildPopText('@Drive1/', 0, 8, ['Drive1'])
    expect(r2.text).toBe('@')
    expect(r2.segments).toEqual([])
  })
  it('buildPopText: preserve original text after caret (caret in string middle)', () => {
    const r = buildPopText('@Drive1/docs/ tail', 0, 13, ['Drive1', 'docs'])
    expect(r.text).toBe('@Drive1/ tail')
    expect(r.segments).toEqual(['Drive1'])
  })
  it('stripMentionToken: remove entire @token, insert no text', () => {
    const r = stripMentionToken('see @Drive1/a.txt now', 4, 17)
    expect(r.text).toBe('see  now')
    expect(r.caretPos).toBe(4)
  })
})

// @ mention changed to "state tracking" instead of reverse-engineering from text, fixing
// the bug where the panel disappears when mount point display name (like `System (/DATA)`)
// contains both space and slash.
describe('mentionPrefix (AgentComposer.vue drillIn/popSegment prefix concatenation, unique source after dedup)', () => {
  it('no segments → just bare "@"', () => {
    expect(mentionPrefix([])).toBe('@')
  })
  it('segments with space and slash → concatenate as-is, no escaping/tokenization', () => {
    expect(mentionPrefix(['System (/DATA)', '.system_data'])).toBe('@System (/DATA)/.system_data/')
  })
})

describe('parseActiveMention (state-first check, no longer reverse-engineers segments from text via scanMention)', () => {
  const segs = ['System (/DATA)', '.system_data']
  const prefixed = '@System (/DATA)/.system_data/' // = mentionPrefix(segs)

  it('caret exactly at prefix end: hit, query empty', () => {
    expect(parseActiveMention(prefixed, 0, segs, prefixed.length)).toEqual({ active: true, query: '' })
  })

  it('typed filter word after prefix: query is segment from prefix end to caret', () => {
    const t = prefixed + 're'
    expect(parseActiveMention(t, 0, segs, t.length)).toEqual({ active: true, query: 're' })
  })

  it('prefix modified (e.g., "@" deleted) → check fails', () => {
    const t = 'System (/DATA)/.system_data/re' // missing leading '@'
    expect(parseActiveMention(t, 0, segs, t.length)).toEqual({ active: false, query: '' })
  })

  it('prefix middle char modified → check fails', () => {
    const t = '@System (/DATB)/.system_data/re' // (/DATA) changed to (/DATB)
    expect(parseActiveMention(t, 0, segs, t.length)).toEqual({ active: false, query: '' })
  })

  it('caret inside prefix (not finished typing) → check fails', () => {
    // caret stops in "System (" middle, hasn't reached "/.system_data/" part yet
    const caret = '@System ('.length
    expect(parseActiveMention(prefixed, 0, segs, caret)).toEqual({ active: false, query: '' })
  })

  it('start < 0 (never recorded mention) → check fails', () => {
    expect(parseActiveMention(prefixed, -1, segs, prefixed.length)).toEqual({ active: false, query: '' })
  })

  it('control group: when name has both space and slash, scanMention cannot but ' +
     'parseActiveMention can — this is the bug this patch fixes (brief "root cause" points 1,2)', () => {
    // scanMention scans backward from caret, breaks when hitting space in "System (/DATA)",
    // returns open:false — panel disappears (original user-reported bug).
    expect(scanMention(prefixed, prefixed.length).open).toBe(false)
    // parseActiveMention does not reverse-engineer char-by-char, only compares prefix slices,
    // naturally unaffected by space/slash.
    expect(parseActiveMention(prefixed, 0, segs, prefixed.length)).toEqual({ active: true, query: '' })
  })
})

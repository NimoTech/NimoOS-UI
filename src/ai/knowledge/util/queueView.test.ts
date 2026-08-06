// SP8-P5b Task 4 —— 移植自 Vue2 `src/views/AI/Knowledge/QueueView.vue:393-404`
// (main@7a6ee6b7)。三处「照抄的怪行为」各有一条专门用例把返回值钉死,见下方
// 标注「蓝本 QueueView.vue:<line> 的行为,照抄不改」的用例。
import { describe, it, expect } from 'vitest'
import { distillIconState, basename, dirname } from './queueView'

describe('distillIconState', () => {
  it('pending status -> pending', () => {
    expect(distillIconState({ status: 'pending' })).toBe('pending')
  })

  it('running status -> running', () => {
    expect(distillIconState({ status: 'running' })).toBe('running')
  })

  it('failed status -> failed', () => {
    expect(distillIconState({ status: 'failed' })).toBe('failed')
  })

  // 蓝本 QueueView.vue:396 的行为,照抄不改:
  // `return 'failed' // failed + skipped share the same danger tone`
  // skipped 与 failed 共用同一个 'failed' 返回值(同一个 danger 图标态),
  // 不是给 skipped 单独一个状态。
  it('skipped status shares the failed danger tone — QueueView.vue:396, copied verbatim', () => {
    expect(distillIconState({ status: 'skipped' })).toBe('failed')
  })

  // 蓝本 QueueView.vue:393-397 没有第三个 `if`,所有非 pending/running 的
  // status(含未知值、缺省值)一律落穿到最后一行的 'failed' —— 不是 'pending'。
  it('unknown status falls through to failed, not pending — QueueView.vue:393-397, copied verbatim', () => {
    expect(distillIconState({ status: 'some-unrecognized-status' })).toBe('failed')
  })

  it('missing status falls through to failed', () => {
    expect(distillIconState({})).toBe('failed')
  })
})

describe('basename', () => {
  // 蓝本 QueueView.vue:398 的行为,照抄不改:
  // `basename(p) { return p ? (...) : '—' }` —— 空值返回 U+2014 破折号 '—',
  // 不是连字符 '-'。
  it("empty/null/undefined return the em dash '—', not a hyphen — QueueView.vue:398, copied verbatim", () => {
    expect(basename('')).toBe('—')
    expect(basename(null)).toBe('—')
    expect(basename(undefined)).toBe('—')
    expect(basename('')).not.toBe('-')
  })

  it('single segment (no slash) returns the segment itself', () => {
    expect(basename('foo.txt')).toBe('foo.txt')
  })

  it('multi segment path returns the last segment', () => {
    expect(basename('a/b/c.txt')).toBe('c.txt')
  })

  it('trailing slash is ignored, still returns the last real segment', () => {
    expect(basename('/a/b/')).toBe('b')
  })

  // 兜底分支:`p.split('/').filter(Boolean).pop() || p`。当 p 本身只由斜杠
  // 组成时,filter(Boolean) 后数组为空,pop() 返回 undefined,`|| p` 落回
  // 原始输入本身(而不是破折号,因为 p 本身是真值)。
  it('path made only of slashes falls back to the raw input via `|| p`', () => {
    expect(basename('/')).toBe('/')
  })
})

describe('dirname', () => {
  // 蓝本 QueueView.vue:399-404 的行为,照抄不改:
  // `if (!p) return ''` —— 空路径返回空串,不是 '/'。
  it("empty/null/undefined return '' — QueueView.vue:399-404, copied verbatim", () => {
    expect(dirname('')).toBe('')
    expect(dirname(null)).toBe('')
    expect(dirname(undefined)).toBe('')
  })

  // 蓝本 QueueView.vue:399-404 的行为,照抄不改:单段路径(无 '/')经
  // `parts.pop()` 后 parts 变空数组,`'/' + parts.join('/') + '/'` 拼接出 '//'
  // —— 这是蓝本自身的怪行为,不是应该被"改对"成 '/' 的 bug。
  it("single-segment path (no slash) returns '//', not '/' — QueueView.vue:399-404, copied verbatim", () => {
    expect(dirname('foo.txt')).toBe('//')
    expect(dirname('foo.txt')).not.toBe('/')
  })

  it('multi segment path returns the parent path with leading/trailing slash', () => {
    expect(dirname('a/b/c.txt')).toBe('/a/b/')
  })

  it('trailing slash on input does not change the result', () => {
    expect(dirname('/a/b/')).toBe('/a/')
  })

  it('path made only of slashes also collapses to an empty parts list -> //', () => {
    expect(dirname('/')).toBe('//')
  })
})

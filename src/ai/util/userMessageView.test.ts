// Adapted from Vue2 src/views/AI/Agent/stream/userMessageView.spec.js
import { describe, expect, it } from 'vitest'
import { isContinueChip, textOf } from './userMessageView'

describe('textOf', () => {
  it('reads string content', () => {
    expect(textOf({ content: 'hello' })).toBe('hello')
  })
  it('joins text blocks when content is not a string', () => {
    expect(textOf({ blocks: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }))
      .toBe('a\nb')
  })
  it('filters out non-text blocks when joining', () => {
    expect(textOf({ blocks: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }] }))
      .toBe('a\nb')
  })
  it('returns empty string when nothing usable', () => {
    expect(textOf({})).toBe('')
  })
  it('returns empty string for null/undefined msg', () => {
    expect(textOf(null)).toBe('')
    expect(textOf(undefined)).toBe('')
  })
})

describe('isContinueChip', () => {
  it('is true for short plain text with no attachments', () => {
    expect(isContinueChip({ content: '都通过了，继续' })).toBe(true)
  })
  it('is false when text is long', () => {
    expect(isContinueChip({ content: '帮我设计一个把 NAS 从 mdadm RAID5 迁移到 btrfs 的完整方案' }))
      .toBe(false)
  })
  it('is false when there are attachments', () => {
    expect(isContinueChip({ content: '继续', attachments: [{ id: 1 }] })).toBe(false)
  })
  it('is false when blocks contain an image/attachment block', () => {
    expect(isContinueChip({ content: '继续', blocks: [{ type: 'image' }] })).toBe(false)
    expect(isContinueChip({ content: '继续', blocks: [{ type: 'attachment' }] })).toBe(false)
  })
  it('is false for empty text', () => {
    expect(isContinueChip({ content: '' })).toBe(false)
  })
  it('is false for text containing a newline even if short', () => {
    expect(isContinueChip({ content: 'a\nb' })).toBe(false)
  })
  it('is false for null/undefined msg', () => {
    expect(isContinueChip(null)).toBe(false)
    expect(isContinueChip(undefined)).toBe(false)
  })
})

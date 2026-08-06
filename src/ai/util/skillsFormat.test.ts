// SP8-P3a Task 2 —— 覆盖 brief §2.4 列的用例:三种 trigger + 未知 trigger 回 null、
// 'You' vs 任意人名、"(3 files)" / "(1 file)" / "12 B" / "1.0 KB" / 空串。
import { describe, it, expect } from 'vitest'
import { triggerLabel, authorLabel, fileSizeLabel } from './skillsFormat'

describe('triggerLabel', () => {
  it('auto → aiSkTriggerAutomatic, no params', () => {
    expect(triggerLabel('auto', 'deploy')).toEqual({ key: 'aiSkTriggerAutomatic' })
  })

  it('slash → aiSkTriggerSlash with the skill name as param', () => {
    expect(triggerLabel('slash', 'deploy')).toEqual({
      key: 'aiSkTriggerSlash',
      params: { name: 'deploy' },
    })
  })

  it('slash carries the given name through, not a fixed literal', () => {
    expect(triggerLabel('slash', 'backup')).toEqual({
      key: 'aiSkTriggerSlash',
      params: { name: 'backup' },
    })
  })

  it('manual → reuses aiSkTagManual (not a dedicated manual-detail key)', () => {
    expect(triggerLabel('manual', 'deploy')).toEqual({ key: 'aiSkTagManual' })
  })

  it('unknown trigger value → null (caller falls back to raw string)', () => {
    expect(triggerLabel('cron', 'deploy')).toBeNull()
  })

  it('empty trigger → null', () => {
    expect(triggerLabel('', 'deploy')).toBeNull()
  })
})

describe('authorLabel', () => {
  it("'You' → aiSkAuthorYou", () => {
    expect(authorLabel('You')).toEqual({ key: 'aiSkAuthorYou' })
  })

  it('an arbitrary author name is data, not a key → null', () => {
    expect(authorLabel('Alice')).toBeNull()
  })

  it('is case-sensitive: "you" (lowercase) is not the sentinel → null', () => {
    expect(authorLabel('you')).toBeNull()
  })

  it('empty author → null', () => {
    expect(authorLabel('')).toBeNull()
  })
})

describe('fileSizeLabel', () => {
  it('"(3 files)" → aiSkNFiles with n=3', () => {
    expect(fileSizeLabel('(3 files)')).toEqual({ key: 'aiSkNFiles', params: { n: 3 } })
  })

  it('"(1 file)" (singular, no trailing s) → aiSkNFiles with n=1', () => {
    expect(fileSizeLabel('(1 file)')).toEqual({ key: 'aiSkNFiles', params: { n: 1 } })
  })

  it('"12 B" byte-unit string passes through untouched → null', () => {
    expect(fileSizeLabel('12 B')).toBeNull()
  })

  it('"1.0 KB" byte-unit string passes through untouched → null', () => {
    expect(fileSizeLabel('1.0 KB')).toBeNull()
  })

  it('empty string → null', () => {
    expect(fileSizeLabel('')).toBeNull()
  })
})

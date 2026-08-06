// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/ResourcesTab.vue:136-232 的纯逻辑部分。
// SP8-P1c2 Task 12。
import { describe, it, expect } from 'vitest'
import {
  groupStagedChanges,
  badgeFor,
  formatStagedPath,
  formatStagedSize,
  relativeTime,
  attachmentKindIcon,
  pluralWord,
} from './stagedGroups'
import type { StagedGroup } from '../stores/agentStore'

describe('groupStagedChanges', () => {
  it('batch_id === 0 是合法值,归入 batches 而非 looseItems', () => {
    const groups: StagedGroup[] = [{
      run_id: 'r1',
      created_at: 0,
      items: [
        { seq: 1, op: 'mkdir', path: '/a', staged_id: 1, batch_id: 0 },
        { seq: 2, op: 'rename', path: '/b', dst_path: '/b2', staged_id: 2, batch_id: 0 },
      ],
    }]
    const [g] = groupStagedChanges(groups)
    expect(g.looseItems).toEqual([])
    expect(g.batches.length).toBe(1)
    expect(g.batches[0].batchId).toBe(0)
    expect(g.batches[0].items.length).toBe(2)
  })

  it('保留 batch 首次出现的插入顺序', () => {
    const groups: StagedGroup[] = [{
      run_id: 'r1',
      created_at: 0,
      items: [
        { seq: 1, op: 'mkdir', path: '/a', staged_id: 1, batch_id: 'z' },
        { seq: 2, op: 'mkdir', path: '/b', staged_id: 2, batch_id: 'a' },
        { seq: 3, op: 'mkdir', path: '/c', staged_id: 3, batch_id: 'z' },
      ],
    }]
    const [g] = groupStagedChanges(groups)
    expect(g.batches.map((b) => b.batchId)).toEqual(['z', 'a'])
    expect(g.batches[0].items.length).toBe(2)
  })

  it('delete_file 和 delete_dir 都计入 summary.delete', () => {
    const groups: StagedGroup[] = [{
      run_id: 'r1',
      created_at: 0,
      items: [
        { seq: 1, op: 'delete_file', path: '/a', staged_id: 1, batch_id: 'b' },
        { seq: 2, op: 'delete_dir', path: '/b', staged_id: 2, batch_id: 'b' },
        { seq: 3, op: 'mkdir', path: '/c', staged_id: 3, batch_id: 'b' },
      ],
    }]
    const [g] = groupStagedChanges(groups)
    expect(g.batches[0].summary).toEqual({ mkdir: 1, rename: 0, delete: 2 })
  })

  it('无 batch_id 的项落进 looseItems,与 batches 分离', () => {
    const groups: StagedGroup[] = [{
      run_id: 'r1',
      created_at: 0,
      items: [
        { seq: 1, op: 'write', path: '/loose.txt', size_bytes: 128 },
        { seq: 2, op: 'mkdir', path: '/a', staged_id: 1, batch_id: 'x' },
      ],
    }]
    const [g] = groupStagedChanges(groups)
    expect(g.looseItems.length).toBe(1)
    expect(g.looseItems[0].path).toBe('/loose.txt')
    expect(g.batches.length).toBe(1)
  })
})

describe('badgeFor', () => {
  it('write/edit → MOD', () => {
    expect(badgeFor('write')).toBe('MOD')
    expect(badgeFor('edit')).toBe('MOD')
  })
  it('delete_file/delete_dir → DEL', () => {
    expect(badgeFor('delete_file')).toBe('DEL')
    expect(badgeFor('delete_dir')).toBe('DEL')
  })
  it('mkdir → MKD', () => { expect(badgeFor('mkdir')).toBe('MKD') })
  it('rename → REN', () => { expect(badgeFor('rename')).toBe('REN') })
  it('未知 op 兜底 MOD', () => { expect(badgeFor('unknown_op')).toBe('MOD') })
})

describe('formatStagedPath', () => {
  it('rename 且有 dst_path → 箭头拼接', () => {
    expect(formatStagedPath({ seq: 1, op: 'rename', path: '/a', dst_path: '/b' })).toBe('/a → /b')
  })
  it('rename 但无 dst_path → 原样返回 path', () => {
    expect(formatStagedPath({ seq: 1, op: 'rename', path: '/a' })).toBe('/a')
  })
  it('非 rename → 原样返回 path', () => {
    expect(formatStagedPath({ seq: 1, op: 'write', path: '/a', dst_path: '/b' })).toBe('/a')
  })
})

describe('formatStagedSize', () => {
  it('无值(undefined) → "—"', () => { expect(formatStagedSize(undefined)).toBe('—') })
  it('0 字节 → "0 B"(不是 "—")', () => { expect(formatStagedSize(0)).toBe('0 B') })
  it('< 1024 → B 档', () => { expect(formatStagedSize(512)).toBe('512 B') })
  it('< 1MB → KB 档,1 位小数', () => { expect(formatStagedSize(2048)).toBe('2.0 KB') })
  it('>= 1MB → MB 档,1 位小数', () => { expect(formatStagedSize(3 * 1024 * 1024)).toBe('3.0 MB') })
})

describe('relativeTime', () => {
  it('< 60s → aiResJustNow,无 params', () => {
    const r = relativeTime(Date.now() / 1000 - 10)
    expect(r).toEqual({ key: 'aiResJustNow' })
  })
  it('< 1h → aiResMinutesAgo,{n} 为分钟数', () => {
    const r = relativeTime(Date.now() / 1000 - 125)
    expect(r.key).toBe('aiResMinutesAgo')
    expect(r.params).toEqual({ n: 2 })
  })
  it('< 1d → aiResHoursAgo,{n} 为小时数', () => {
    const r = relativeTime(Date.now() / 1000 - 3 * 3600 - 10)
    expect(r.key).toBe('aiResHoursAgo')
    expect(r.params).toEqual({ n: 3 })
  })
  it('>= 1d → aiResDaysAgo,{n} 为天数', () => {
    const r = relativeTime(Date.now() / 1000 - 2 * 86400 - 10)
    expect(r.key).toBe('aiResDaysAgo')
    expect(r.params).toEqual({ n: 2 })
  })
})

describe('attachmentKindIcon', () => {
  it('image/video/audio/text/binary 各自映射 emoji', () => {
    expect(attachmentKindIcon('image')).toBe('🖼️')
    expect(attachmentKindIcon('video')).toBe('🎬')
    expect(attachmentKindIcon('audio')).toBe('🎵')
    expect(attachmentKindIcon('text')).toBe('📄')
    expect(attachmentKindIcon('binary')).toBe('📦')
  })
  it('未知/缺失 kind 兜底 📎', () => {
    expect(attachmentKindIcon('weird')).toBe('📎')
    expect(attachmentKindIcon(undefined)).toBe('📎')
  })
})

describe('pluralWord', () => {
  it('n === 1 → 空字符串', () => { expect(pluralWord(1)).toBe('') })
  it('n === 0 或 > 1 → "s"', () => {
    expect(pluralWord(0)).toBe('s')
    expect(pluralWord(2)).toBe('s')
  })
})

import { describe, it, expect } from 'vitest'
import {
  nameTooLong,
  pathTooLong,
  createBlocked,
  relBlocked,
  byteLength,
  NAME_MAX_BYTES,
  PATH_MAX_BYTES,
} from './pathLimits'

describe('pathLimits(Linux NAME_MAX=255 / PATH_MAX=4096 字节,UTF-8)', () => {
  it('255 字节名可用,256 字节名过长', () => {
    expect(nameTooLong('a'.repeat(255))).toBe(false)
    expect(nameTooLong('a'.repeat(256))).toBe(true)
  })
  it('多字节按字节数算:86 个中文字 = 258 字节 → 过长', () => {
    expect(nameTooLong('文'.repeat(85))).toBe(false) // 255 字节
    expect(nameTooLong('文'.repeat(86))).toBe(true)  // 258 字节
  })
  it('全路径超 4095 字节 → 过长', () => {
    expect(pathTooLong('/' + 'a'.repeat(4094))).toBe(false)
    expect(pathTooLong('/' + 'a'.repeat(4095))).toBe(true)
  })
  it('createBlocked:名字先判,再判拼接后的全路径', () => {
    expect(createBlocked('/DATA', 'x'.repeat(256))).toBe('name')
    expect(createBlocked('/' + 'd'.repeat(4000), 'x'.repeat(100))).toBe('path')
    expect(createBlocked('/DATA', 'ok')).toBe(null)
  })
})

// The numbers below are not guessed from Linux headers — they were measured on
// the real device on 2026-08-13 (see the header comment in pathLimits.ts). They
// exist as tests so that "match the backend" stays a checkable claim.
describe('pathLimits 与后端实测边界一致', () => {
  it('导出后端实测常量,便于文案与调用方共用同一口径', () => {
    expect(NAME_MAX_BYTES).toBe(255)
    expect(PATH_MAX_BYTES).toBe(4095)
  })

  it('byteLength 按 UTF-8 字节数计,不是字符数', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('中')).toBe(3)
    expect(byteLength('中'.repeat(85))).toBe(255)
  })

  // POST /v1/folder measured: 255 bytes → {"success":200}, 256 bytes →
  // {"success":500,"message":"Fail"} and nothing on disk.
  it('单段 255 字节放行 / 256 字节拦截(对齐 POST /v1/folder)', () => {
    expect(relBlocked('/DATA/Documents', 'a'.repeat(255))).toBe(null)
    expect(relBlocked('/DATA/Documents', 'a'.repeat(256))).toBe('name')
  })

  // Same boundary measured on the tus landing path, which reports 201+204
  // ("success") and then silently drops the file — hence the frontend guard.
  it('上传相对路径逐段判定,深路径里任意一段超限即拦截', () => {
    expect(relBlocked('/DATA', 'Trip/2026/' + 'b'.repeat(255) + '/x.txt')).toBe(null)
    expect(relBlocked('/DATA', 'Trip/2026/' + 'b'.repeat(256) + '/x.txt')).toBe('name')
  })

  it('中文边界:85 字放行,86 字拦截', () => {
    expect(relBlocked('/DATA', '中'.repeat(85))).toBe(null)
    expect(relBlocked('/DATA', '中'.repeat(86))).toBe('name')
  })

  it('全路径 4095 字节放行 / 4096 字节拦截(对齐 MkdirAll 实测)', () => {
    const dir = '/' + 'd'.repeat(4000) // 4001 bytes
    // joinPath inserts one '/', so a name of N bytes yields 4002 + N total.
    expect(byteLength(dir)).toBe(4001)
    expect(relBlocked(dir, 'x'.repeat(93))).toBe(null)   // 4095
    expect(relBlocked(dir, 'x'.repeat(94))).toBe('path') // 4096
  })

  // The whole point of the unification: create and upload must not disagree on
  // what "too long" means. createBlocked is now just relBlocked under a name
  // that reads well at the create call site — a multi-segment argument is
  // measured per segment on BOTH paths, because the backend's MkdirAll builds
  // the chain and each link only has to fit NAME_MAX on its own.
  it('createBlocked 与 relBlocked 对同一输入给出相同结论', () => {
    const cases: [string, string][] = [
      ['/DATA', 'ok'],
      ['/DATA', 'a'.repeat(256)],
      ['/DATA', 'a'.repeat(200) + '/' + 'b'.repeat(200)],
      ['/' + 'd'.repeat(4000), 'x'.repeat(200)],
      ['/DATA', '中'.repeat(86)],
    ]
    for (const [dir, rel] of cases) {
      expect(createBlocked(dir, rel), `${dir} + ${rel.slice(0, 12)}…`).toBe(relBlocked(dir, rel))
    }
  })

  it('两段各 200 字节的相对路径不再被误判为超长名', () => {
    // 401 bytes as one string, but 200 bytes per segment — the backend accepts
    // it, so the old whole-string check was wrong, not merely conservative.
    expect(relBlocked('/DATA', 'a'.repeat(200) + '/' + 'b'.repeat(200))).toBe(null)
  })
})

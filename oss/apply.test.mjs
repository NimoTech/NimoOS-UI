import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { applyDelete, applyReplace, applyPatch, sha256, checkClean } from './apply.mjs'

let root, ossDir
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-tree-'))
  ossDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-files-'))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(ossDir, { recursive: true, force: true })
})

const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), text)
}

describe('applyDelete', () => {
  it('删文件与整目录', () => {
    write(root, 'a.ts', 'x')
    write(root, 'd/b.ts', 'y')
    applyDelete(root, ['a.ts', 'd'])
    expect(fs.existsSync(path.join(root, 'a.ts'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'd'))).toBe(false)
  })

  it('路径不存在即抛 —— 清单过期了必须知道', () => {
    expect(() => applyDelete(root, ['gone.ts'])).toThrow(/DELETE 清单过期.*gone\.ts/)
  })

  it('路径穿越(../)即抛,不会删到 root 之外', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-'))
    write(outside, 'victim.txt', 'precious')
    const rel = path.relative(root, path.join(outside, 'victim.txt'))
    expect(() => applyDelete(root, [rel])).toThrow(/越界/)
    expect(fs.existsSync(path.join(outside, 'victim.txt'))).toBe(true)
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('绝对路径即抛', () => {
    write(root, 'a.ts', 'x')
    expect(() => applyDelete(root, ['/etc/passwd'])).toThrow(/绝对路径/)
  })

  it('合法的深层相对路径仍放行(不要把正常路径也拦了)', () => {
    write(root, 'src/home/components/GridItem.vue', 'x')
    applyDelete(root, ['src/home/components/GridItem.vue'])
    expect(fs.existsSync(path.join(root, 'src/home/components/GridItem.vue'))).toBe(false)
  })
})

describe('applyReplace 的哈希钉', () => {
  it('哈希对得上就替换', () => {
    write(root, 'src/x.ts', 'PRIVATE')
    write(ossDir, 'x.ts', 'PUBLIC')
    applyReplace(root, [{ path: 'src/x.ts', from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir)
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('PUBLIC')
  })

  it('私有侧变了就抛,且提示要复核哪个分身', () => {
    write(root, 'src/x.ts', 'PRIVATE-CHANGED')
    write(ossDir, 'x.ts', 'PUBLIC')
    expect(() =>
      applyReplace(root, [{ path: 'src/x.ts', from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/私有仓的 src\/x\.ts 变了.*复核 oss\/files\/x\.ts/s)
  })

  it('oss/files/ 里源文件缺失即抛,消息带 path 与 from 两个 manifest 坐标', () => {
    write(root, 'src/x.ts', 'PRIVATE')
    // 故意不在 ossDir 里创建 x.ts
    expect(() =>
      applyReplace(root, [{ path: 'src/x.ts', from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/oss\/files\/x\.ts.*path=src\/x\.ts.*from=x\.ts/s)
  })

  it('path 越界(../)即抛,不会写到 root 之外', () => {
    write(ossDir, 'x.ts', 'PUBLIC')
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-'))
    write(outside, 'victim.ts', 'PRIVATE')
    const relTarget = path.relative(root, path.join(outside, 'victim.ts'))
    expect(() =>
      applyReplace(root, [{ path: relTarget, from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/越界/)
    expect(fs.readFileSync(path.join(outside, 'victim.ts'), 'utf8')).toBe('PRIVATE')
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('from 越界(../)即抛,不会从 ossDir 之外读取任意文件', () => {
    write(root, 'src/x.ts', 'PRIVATE')
    const outsideOss = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-files-'))
    write(outsideOss, 'evil.ts', 'EVIL')
    const relFrom = path.relative(ossDir, path.join(outsideOss, 'evil.ts'))
    expect(() =>
      applyReplace(root, [{ path: 'src/x.ts', from: relFrom, privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/越界/)
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('PRIVATE')
    fs.rmSync(outsideOss, { recursive: true, force: true })
  })
})

describe('applyPatch 的锚点唯一性', () => {
  it('恰好命中 1 次才替换', () => {
    write(root, 'src/x.ts', 'keep\nDROP_ME\nkeep2\n')
    applyPatch(root, [{ path: 'src/x.ts', find: 'DROP_ME\n', replace: '' }])
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('keep\nkeep2\n')
  })

  it('0 次命中即抛(锚点随私有主干漂了)', () => {
    write(root, 'src/x.ts', 'keep\n')
    expect(() => applyPatch(root, [{ path: 'src/x.ts', find: 'GONE', replace: '' }]))
      .toThrow(/锚点未命中.*src\/x\.ts/s)
  })

  it('2 次命中即抛(锚点不唯一,替换会误伤)', () => {
    write(root, 'src/x.ts', 'DUP\nDUP\n')
    expect(() => applyPatch(root, [{ path: 'src/x.ts', find: 'DUP', replace: '' }]))
      .toThrow(/命中 2 次.*必须恰好 1 次/s)
  })

  it('同一文件的多条补丁按顺序独立生效', () => {
    write(root, 'src/x.ts', 'A\nB\nC\n')
    applyPatch(root, [
      { path: 'src/x.ts', find: 'A\n', replace: '' },
      { path: 'src/x.ts', find: 'C\n', replace: 'Z\n' },
    ])
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('B\nZ\n')
  })

  it('替换串里的 $& 等特殊模式必须按字面量处理,不能被解释', () => {
    write(root, 'src/x.ts', 'keep\nANCHOR\nkeep2\n')
    // replace 里含 $& —— 若用 text.replace(find, replace) 的字符串重载,
    // $& 会被解释成"匹配到的整段文本"(即 ANCHOR),而不是字面量 $&。
    applyPatch(root, [{ path: 'src/x.ts', find: 'ANCHOR', replace: 'price: $&, tag: $1' }])
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('keep\nprice: $&, tag: $1\nkeep2\n')
  })

  it('空锚点(find: "")即抛,不依赖 split 计数的巧合 —— 覆盖 2 字符漏网案例', () => {
    // text.split('').length - 1 对 2 字符文件恰好算出 1(巧合合法值),
    // 曾导致空锚点在这一个长度上静默通过并把 replace 插到开头。
    // 显式拒绝空串必须堵住所有长度,这里逐一验证 0/1/2/3/4 字符。
    for (const content of ['', 'a', 'ab', 'abc', 'abcd']) {
      write(root, 'src/x.ts', content)
      expect(() => applyPatch(root, [{ path: 'src/x.ts', find: '', replace: 'Z' }])).toThrow(/锚点为空串/)
      // 且文件内容必须原封不动 —— 拒绝必须发生在写入之前
      expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe(content)
    }
  })

  it('路径穿越(../)即抛,不会写到 root 之外', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-'))
    write(outside, 'victim.ts', 'keep\nDROP_ME\nkeep2\n')
    const rel = path.relative(root, path.join(outside, 'victim.ts'))
    expect(() => applyPatch(root, [{ path: rel, find: 'DROP_ME\n', replace: '' }])).toThrow(/越界/)
    expect(fs.readFileSync(path.join(outside, 'victim.ts'), 'utf8')).toBe('keep\nDROP_ME\nkeep2\n')
    fs.rmSync(outside, { recursive: true, force: true })
  })
})

describe('checkClean', () => {
  let repoDir

  const git = (...args) => execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8' })

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-repo-'))
    execFileSync('git', ['init', '-b', 'main', repoDir], { encoding: 'utf8' })
    write(repoDir, 'design-export/a.html', 'x')
    write(repoDir, 'design-export/b.html', 'y')
    write(repoDir, 'kept.txt', 'z')
    git('add', '-A')
    git('-c', 'user.email=test@test.local', '-c', 'user.name=test', 'commit', '-m', 'init')
  })

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true })
  })

  it('干净工作树 —— 不抛', () => {
    expect(() => checkClean(repoDir, [/^ D design-export\//])).not.toThrow()
  })

  it('有脏改动且不在白名单里 —— 抛,且消息里带上脏行', () => {
    write(repoDir, 'kept.txt', 'CHANGED')
    expect(() => checkClean(repoDir, [/^ D design-export\//])).toThrow(/kept\.txt/)
  })

  it('脏改动全部命中白名单正则 —— 不抛', () => {
    fs.rmSync(path.join(repoDir, 'design-export/a.html'))
    fs.rmSync(path.join(repoDir, 'design-export/b.html'))
    expect(() => checkClean(repoDir, [/^ D design-export\//])).not.toThrow()
  })
})

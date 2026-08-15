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
  it('delete files and entire directories', () => {
    write(root, 'a.ts', 'x')
    write(root, 'd/b.ts', 'y')
    applyDelete(root, ['a.ts', 'd'])
    expect(fs.existsSync(path.join(root, 'a.ts'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'd'))).toBe(false)
  })

  it('missing path throws — must know if manifest is stale', () => {
    expect(() => applyDelete(root, ['gone.ts'])).toThrow(/DELETE.*stale.*gone\.ts/)
  })

  it('path traversal (../) throws; won\'t delete outside root', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-'))
    write(outside, 'victim.txt', 'precious')
    const rel = path.relative(root, path.join(outside, 'victim.txt'))
    expect(() => applyDelete(root, [rel])).toThrow(/out of bounds/)
    expect(fs.existsSync(path.join(outside, 'victim.txt'))).toBe(true)
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('absolute path throws', () => {
    write(root, 'a.ts', 'x')
    expect(() => applyDelete(root, ['/etc/passwd'])).toThrow(/absolute/)
  })

  it('legitimate deep relative paths still pass (don\'t block normal paths)', () => {
    write(root, 'src/home/components/GridItem.vue', 'x')
    applyDelete(root, ['src/home/components/GridItem.vue'])
    expect(fs.existsSync(path.join(root, 'src/home/components/GridItem.vue'))).toBe(false)
  })
})

describe('applyReplace hash pin', () => {
  it('replaces if hash matches', () => {
    write(root, 'src/x.ts', 'PRIVATE')
    write(ossDir, 'x.ts', 'PUBLIC')
    applyReplace(root, [{ path: 'src/x.ts', from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir)
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('PUBLIC')
  })

  it('throws if private side changed; hints which copy to review', () => {
    write(root, 'src/x.ts', 'PRIVATE-CHANGED')
    write(ossDir, 'x.ts', 'PUBLIC')
    expect(() =>
      applyReplace(root, [{ path: 'src/x.ts', from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/Private repo's src\/x\.ts changed.*Review whether oss\/files\/x\.ts/s)
  })

  it('source file missing in oss/files/ throws with path and from manifest coordinates', () => {
    write(root, 'src/x.ts', 'PRIVATE')
    // deliberately don't create x.ts in ossDir
    expect(() =>
      applyReplace(root, [{ path: 'src/x.ts', from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/oss\/files\/x\.ts.*path=src\/x\.ts.*from=x\.ts/s)
  })

  it('path traversal (../) throws; won\'t write outside root', () => {
    write(ossDir, 'x.ts', 'PUBLIC')
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-'))
    write(outside, 'victim.ts', 'PRIVATE')
    const relTarget = path.relative(root, path.join(outside, 'victim.ts'))
    expect(() =>
      applyReplace(root, [{ path: relTarget, from: 'x.ts', privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/out of bounds/)
    expect(fs.readFileSync(path.join(outside, 'victim.ts'), 'utf8')).toBe('PRIVATE')
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('from traversal (../) throws; won\'t read arbitrary file outside ossDir', () => {
    write(root, 'src/x.ts', 'PRIVATE')
    const outsideOss = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-files-'))
    write(outsideOss, 'evil.ts', 'EVIL')
    const relFrom = path.relative(ossDir, path.join(outsideOss, 'evil.ts'))
    expect(() =>
      applyReplace(root, [{ path: 'src/x.ts', from: relFrom, privateSha256: sha256('PRIVATE') }], ossDir),
    ).toThrow(/out of bounds/)
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('PRIVATE')
    fs.rmSync(outsideOss, { recursive: true, force: true })
  })
})

describe('applyPatch anchor uniqueness', () => {
  it('replaces only if anchor hits exactly 1 time', () => {
    write(root, 'src/x.ts', 'keep\nDROP_ME\nkeep2\n')
    applyPatch(root, [{ path: 'src/x.ts', find: 'DROP_ME\n', replace: '' }])
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('keep\nkeep2\n')
  })

  it('0 hits throws (anchor drifted in private main)', () => {
    write(root, 'src/x.ts', 'keep\n')
    expect(() => applyPatch(root, [{ path: 'src/x.ts', find: 'GONE', replace: '' }]))
      .toThrow(/Anchor no match.*src\/x\.ts/s)
  })

  it('2 hits throws (anchor not unique; replace would damage)', () => {
    write(root, 'src/x.ts', 'DUP\nDUP\n')
    expect(() => applyPatch(root, [{ path: 'src/x.ts', find: 'DUP', replace: '' }]))
      .toThrow(/matches.*2.*must be exactly 1/s)
  })

  it('multiple patches in same file apply independently in order', () => {
    write(root, 'src/x.ts', 'A\nB\nC\n')
    applyPatch(root, [
      { path: 'src/x.ts', find: 'A\n', replace: '' },
      { path: 'src/x.ts', find: 'C\n', replace: 'Z\n' },
    ])
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('B\nZ\n')
  })

  it('special patterns like $& in replace must be treated as literals, not interpreted', () => {
    write(root, 'src/x.ts', 'keep\nANCHOR\nkeep2\n')
    // replace contains $& — if using string overload of text.replace(find, replace),
    // $& would be interpreted as "the matched text" (i.e., ANCHOR), not literal $&.
    applyPatch(root, [{ path: 'src/x.ts', find: 'ANCHOR', replace: 'price: $&, tag: $1' }])
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('keep\nprice: $&, tag: $1\nkeep2\n')
  })

  it('empty anchor (find: "") throws; doesn\'t depend on coincidence of split counting — covers 2-char edge case', () => {
    // text.split('').length - 1 happens to give 1 for 2-char file (coincidental valid),
    // used to let empty anchor pass silently on this one length and insert replace at start.
    // Explicitly rejecting empty string must block all lengths; here verify 0/1/2/3/4 char.
    for (const content of ['', 'a', 'ab', 'abc', 'abcd']) {
      write(root, 'src/x.ts', content)
      expect(() => applyPatch(root, [{ path: 'src/x.ts', find: '', replace: 'Z' }])).toThrow(/Anchor missing or not string/)
      // and file content must be unchanged — rejection must happen before write
      expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe(content)
    }
  })

  // T14(B3): when manifest entry misspells field name (e.g., omits find or typos it to something else),
  // find destructures to undefined — old implementation passed undefined straight to text.split(),
  // throwing native TypeError("The \"searchString\" argument must be of type string"),
  // which doesn't match project rule "error messages are product". Must give designed diagnostic, not
  // force someone to guess what a Node builtin type error means.
  it('find is undefined/null (field name misspell entry point) gives designed diagnostic, not native TypeError', () => {
    write(root, 'src/x.ts', 'abc')
    expect(() => applyPatch(root, [{ path: 'src/x.ts', replace: 'Z' }])) // omit find
      .toThrow(/Anchor missing or not string/)
    expect(() => applyPatch(root, [{ path: 'src/x.ts', find: null, replace: 'Z' }]))
      .toThrow(/Anchor missing or not string/)
    // and both cases shouldn't be native TypeError
    try { applyPatch(root, [{ path: 'src/x.ts', replace: 'Z' }]) } catch (err) {
      expect(err).not.toBeInstanceOf(TypeError)
    }
    expect(fs.readFileSync(path.join(root, 'src/x.ts'), 'utf8')).toBe('abc')
  })

  it('path traversal (../) throws; won\'t write outside root', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-outside-'))
    write(outside, 'victim.ts', 'keep\nDROP_ME\nkeep2\n')
    const rel = path.relative(root, path.join(outside, 'victim.ts'))
    expect(() => applyPatch(root, [{ path: rel, find: 'DROP_ME\n', replace: '' }])).toThrow(/out of bounds/)
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

  it('clean working tree — doesn\'t throw', () => {
    expect(() => checkClean(repoDir, [/^ D design-export\//])).not.toThrow()
  })

  it('dirty changes not in whitelist — throws with dirty lines in message', () => {
    write(repoDir, 'kept.txt', 'CHANGED')
    expect(() => checkClean(repoDir, [/^ D design-export\//])).toThrow(/kept\.txt/)
  })

  it('all dirty changes match whitelist regex — doesn\'t throw', () => {
    fs.rmSync(path.join(repoDir, 'design-export/a.html'))
    fs.rmSync(path.join(repoDir, 'design-export/b.html'))
    expect(() => checkClean(repoDir, [/^ D design-export\//])).not.toThrow()
  })
})

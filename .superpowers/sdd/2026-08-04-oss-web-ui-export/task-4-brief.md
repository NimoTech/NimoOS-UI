### Task 4: 三个执行器 `oss/apply.mjs`

**Files:**
- Create: `oss/apply.mjs`
- Test: `oss/apply.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces:
  - `applyDelete(root: string, paths: string[]): void` — 路径不存在即 `throw`
  - `applyReplace(root: string, entries: {path, from, privateSha256}[], ossDir: string): void` — 私有侧哈希不符即 `throw`
  - `applyPatch(root: string, entries: {path, find: string, replace: string}[]): void` — 命中次数 ≠ 1 即 `throw`
  - `sha256(text: string): string`
  - `checkClean(repoDir: string, allowlist: RegExp[]): void` — 工作树不干净即 `throw`

**核心不变式**:两条路都必须「响一声」。PATCH 天然会响(锚点丢了就报错);REPLACE 靠哈希钉补上这个能力 —— 私有主干改了被替换的文件,导出必须**失败并要求复核**,绝不允许悄悄把老版本盖上去。

- [ ] **Step 1: 写失败测试**

创建 `oss/apply.test.mjs`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyDelete, applyReplace, applyPatch, sha256 } from './apply.mjs'

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
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/apply.test.mjs`
Expected: FAIL —— `Failed to resolve import "./apply.mjs"`

- [ ] **Step 3: 实现 `oss/apply.mjs`**

```js
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/** 工作树必须干净。allowlist 是长期例外(那 3 个 design-export 的删除态)。 */
export function checkClean(repoDir, allowlist = []) {
  const out = execFileSync('git', ['-C', repoDir, 'status', '--porcelain'], { encoding: 'utf8' })
  const dirty = out.split('\n').filter(Boolean).filter((l) => !allowlist.some((re) => re.test(l)))
  if (dirty.length) {
    throw new Error(`${repoDir} 工作树不干净,导出中止:\n${dirty.join('\n')}`)
  }
}

export function applyDelete(root, paths) {
  for (const rel of paths) {
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) {
      throw new Error(`DELETE 清单过期:${rel} 不存在(私有主干已删或改名,请更新 manifest.mjs)`)
    }
    fs.rmSync(abs, { recursive: true, force: true })
  }
}

export function applyReplace(root, entries, ossDir) {
  for (const { path: rel, from, privateSha256 } of entries) {
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) throw new Error(`REPLACE 目标不存在:${rel}`)
    const actual = sha256(fs.readFileSync(abs, 'utf8'))
    if (actual !== privateSha256) {
      throw new Error(
        `私有仓的 ${rel} 变了(sha256 ${actual.slice(0, 12)}… ≠ 钉住的 ${privateSha256.slice(0, 12)}…)。\n` +
        `请复核 oss/files/${from} 是否需要同步,然后把 manifest.mjs 里的 privateSha256 更新为新值。\n` +
        `⚠️ 禁止为了让脚本跑过而删掉哈希钉 —— 那会让这条路重新变成哑火。`,
      )
    }
    fs.copyFileSync(path.join(ossDir, from), abs)
  }
}

export function applyPatch(root, entries) {
  for (const { path: rel, find, replace } of entries) {
    const abs = path.join(root, rel)
    if (!fs.existsSync(abs)) throw new Error(`PATCH 目标不存在:${rel}`)
    const text = fs.readFileSync(abs, 'utf8')
    const hits = text.split(find).length - 1
    if (hits === 0) {
      throw new Error(
        `锚点未命中:${rel}\n找的是:${JSON.stringify(find.slice(0, 120))}\n` +
        `这是设计意图,不是故障 —— 看一眼私有侧那几行改成什么了,更新 manifest.mjs 的锚点。`,
      )
    }
    if (hits !== 1) {
      throw new Error(`锚点在 ${rel} 里命中 ${hits} 次,必须恰好 1 次(否则替换会误伤):${JSON.stringify(find.slice(0, 120))}`)
    }
    fs.writeFileSync(abs, text.replace(find, replace))
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run oss/apply.test.mjs`
Expected: PASS(3 个 describe / 7 例全绿)

- [ ] **Step 5: 提交**

```bash
git add oss/apply.mjs oss/apply.test.mjs
git commit -m "feat(oss): DELETE/REPLACE/PATCH 三个执行器(哈希钉 + 锚点唯一性)"
```

---


import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, afterEach } from 'vitest'
import { OSS_DIR } from './manifest.mjs'

// T15(e):--out 目录的 node_modules 不应该被每次导出的 rsync --delete 清掉(逼着人
// 重装一遍依赖),但 dist/ 应该照常被清掉(陈旧构建产物不该被当成"这次的构建"去过
// 第五道门)。两者行为刻意不对称,这里各用一个哨兵文件直接验证,不只是读 rsync 参数。

let out
afterEach(() => { if (out) fs.rmSync(out, { recursive: true, force: true }) })

describe('导出落盘:node_modules 保留、dist 照常清空', () => {
  it('--out 目录已有 node_modules/哨兵文件,重新导出后哨兵文件还在;已有 dist/ 会被清空', () => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-out-rsync-'))
    // 先手工造一个"看起来是之前导出产物"的目录(含 .export-report.txt,通过 --out 护栏),
    // 再塞一个 node_modules 哨兵文件和一个 dist 哨兵文件。
    fs.writeFileSync(path.join(out, '.export-report.txt'), 'prior export\n')
    fs.mkdirSync(path.join(out, 'node_modules', 'some-pkg'), { recursive: true })
    fs.writeFileSync(path.join(out, 'node_modules', 'some-pkg', 'index.js'), '// sentinel')
    fs.mkdirSync(path.join(out, 'dist'), { recursive: true })
    fs.writeFileSync(path.join(out, 'dist', 'stale.js'), '// stale build, should be wiped')

    execFileSync('node', [path.join(OSS_DIR, 'export.mjs'), '--out', out, '--skip-guard', '--no-commit', '--allow-dirty-oss'], {
      stdio: 'pipe', encoding: 'utf8',
    })

    expect(fs.existsSync(path.join(out, 'node_modules', 'some-pkg', 'index.js')), 'node_modules 哨兵文件应保留').toBe(true)
    expect(fs.existsSync(path.join(out, 'dist', 'stale.js')), '陈旧 dist/ 应被清空').toBe(false)
  }, 180_000)
})

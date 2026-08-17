import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, afterEach } from 'vitest'
import { OSS_DIR } from './manifest.mjs'

// T15(e): node_modules in --out directory shouldn't be wiped by every export's rsync --delete (forcing reinstall),
// but dist/ should be cleared as usual (stale build artifacts shouldn't be treated as "this build" going through
// checkpoint 5). Two behaviors intentionally asymmetric; here verify with sentinel file each, not just read rsync params.

let out
afterEach(() => { if (out) fs.rmSync(out, { recursive: true, force: true }) })

describe('export write to disk: node_modules kept, dist cleared as usual', () => {
  it('--out dir has node_modules/sentinel; after re-export sentinel still there; existing dist/ gets cleared', () => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-out-rsync-'))
    // First manually create "looks like prior export" dir (contains .export-report.txt, passes --out guard),
    // then stuff a node_modules sentinel and a dist sentinel.
    fs.writeFileSync(path.join(out, '.export-report.txt'), 'prior export\n')
    fs.mkdirSync(path.join(out, 'node_modules', 'some-pkg'), { recursive: true })
    fs.writeFileSync(path.join(out, 'node_modules', 'some-pkg', 'index.js'), '// sentinel')
    fs.mkdirSync(path.join(out, 'dist'), { recursive: true })
    fs.writeFileSync(path.join(out, 'dist', 'stale.js'), '// stale build, should be wiped')

    execFileSync('node', [path.join(OSS_DIR, 'export.mjs'), '--out', out, '--skip-guard', '--no-commit', '--allow-dirty-oss'], {
      stdio: 'pipe', encoding: 'utf8',
    })

    expect(fs.existsSync(path.join(out, 'node_modules', 'some-pkg', 'index.js')), 'node_modules sentinel should be kept').toBe(true)
    expect(fs.existsSync(path.join(out, 'dist', 'stale.js')), 'stale dist/ should be cleared').toBe(false)
  }, 180_000)
})

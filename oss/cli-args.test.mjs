import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, afterEach } from 'vitest'
import * as manifest from './manifest.mjs'

// 2026-08-08: this group guards **a real accident** — someone wanted to see script parameters, typed
// `node oss/export.mjs --help`, and the script at that time (a) didn't recognize --help (b) didn't error on unknown params,
// so treated it as "you passed nothing" → used DEFAULT_OUT (real public repo NimoOS-Web) + commit enabled by default →
// rsync --delete overwrote public repo, `git commit --amend` changed its HEAD (4957653 → 548e53c),
// finally failed on `rev-list --count` (damage already done; restored via reset --hard).
//
// Conclusion: root cause wasn't one line of logic, it was **direction of defaults** — dangerous action (write public repo + commit)
// is default, safe action needs three manual flags. Here we nail direction: **any call without --publish must not touch public repo,
// must not init repo or commit; any unknown parameter is refused**.
//
// ⚠️ Every test case explicitly passes --out <temp dir>. Not redundant: when guard isn't in place (RED phase)
// calling without --out would really write to public repo — test must never re-enact the accident it prevents.

const OSS = manifest.OSS_DIR
const EXPORT = path.join(OSS, 'export.mjs')
// Every test brings these three, narrows tested surface to "parameter parsing + whether to commit":
// --skip-guard skips leak scan (this group doesn't test leaks), --allow-dirty-oss allows uncommitted oss/ changes
// (this file itself is that change).
const DEV = ['--skip-guard', '--allow-dirty-oss']

/** Run export.mjs, return { code, stdout, stderr } — non-zero exit doesn't throw, left for test assertion. */
const run = (args) => {
  try {
    const stdout = execFileSync('node', [EXPORT, ...args], { stdio: 'pipe', encoding: 'utf8' })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' }
  }
}

let out
afterEach(() => { if (out) { fs.rmSync(out, { recursive: true, force: true }); out = undefined } })
const mkOut = () => (out = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-cli-args-')))

describe('export.mjs parameter parsing: unknown parameters must be rejected', () => {
  it('unknown parameter → non-zero exit, nothing written to disk', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir, '--no-commit', '--bogus-flag'])

    expect(r.code, `unknown param should non-zero exit, got ${r.code}\n${r.stdout}${r.stderr}`).not.toBe(0)
    expect(r.stderr + r.stdout, 'error message should name which param is unknown').toContain('--bogus-flag')
    expect(fs.readdirSync(dir), 'on reject, shouldn\'t write anything to --out').toEqual([])
  }, 180_000)

  it('--help → print usage and exit, don\'t run export', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir, '--help'])

    expect(r.code, '--help should exit normally').toBe(0)
    expect(r.stdout, '--help should print --publish explanation').toContain('--publish')
    // This is the core of the accident: back then --help treated as "no params", really ran all six steps.
    expect(r.stdout, '--help must never enter export flow').not.toContain('1/6')
    expect(fs.readdirSync(dir), '--help shouldn\'t write anything to --out').toEqual([])
  }, 180_000)
})

describe('export.mjs default direction: safe by default, publish is dangerous', () => {
  it('default output dir is not public repo — without --publish can\'t touch it', () => {
    expect(manifest.PUBLISH_OUT, 'PUBLISH_OUT should point to public repo NimoOS-Web')
      .toBe(path.resolve(OSS, '../../NimoOS-Web'))
    expect(manifest.PREVIEW_OUT, 'default (preview) output dir must not equal public repo')
      .not.toBe(manifest.PUBLISH_OUT)
    // Preview dir in system temp: even if rsync --delete clears it, no harm.
    expect(manifest.PREVIEW_OUT.startsWith(fs.realpathSync(os.tmpdir())),
      `preview dir should be in temp; got ${manifest.PREVIEW_OUT}`).toBe(true)
  })

  it('without --publish → write to disk only, no git init, no commit', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir])

    expect(r.code, `export should succeed\n${r.stdout}${r.stderr}`).toBe(0)
    expect(fs.existsSync(path.join(dir, 'package.json')), 'files should write normally').toBe(true)
    expect(fs.existsSync(path.join(dir, '.git')), 'no --publish means no repo or commit').toBe(false)
  }, 180_000)

  // Previous test's control: prevent "never commit" impl that turns test green but breaks publish.
  // These two must exist as pair — either alone can't distinguish "default off" from "permanently off".
  it('with --publish → init git repo and commit (zero-history single commit)', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir, '--publish'])

    expect(r.code, `--publish export should succeed\n${r.stdout}${r.stderr}`).toBe(0)
    expect(fs.existsSync(path.join(dir, '.git')), '--publish should init repo and commit').toBe(true)
    const n = execFileSync('git', ['-C', dir, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()
    expect(n, 'zero-history: commit count always 1').toBe('1')
  }, 180_000)
})

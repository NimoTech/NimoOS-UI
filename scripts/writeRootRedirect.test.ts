import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ Do not use `new URL('./x', import.meta.url)`: this two-arg literal form gets
// special-cased as a Vite asset URL literal, and under vitest (jsdom) it resolves to an
// http: URL relative to the dev server instead of file:, making fileURLToPath throw
// (same trap recorded at src/settings/panels/panels.test.ts:56, same approach: get this
// file's path via fileURLToPath(import.meta.url) first, then join with path.join).
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, 'write-root-redirect.sh')
const REPO_ROOT = join(HERE, '..')

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nimoos-www-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function run(...args: string[]): string {
  return execFileSync('bash', [SCRIPT, ...args], { encoding: 'utf8' })
}

describe('write-root-redirect.sh', () => {
  it('When root directory has no index.html, write a redirect page', () => {
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('nimoos-new-ui-redirect')
    expect(html).toContain("location.replace('/app/' + location.search + location.hash)")
  })

  it('If existing file was written by this script last time (first 5 lines contain marker) → overwrite and rewrite', () => {
    writeFileSync(join(root, 'index.html'), '<!doctype html>\n<!-- nimoos-new-ui-redirect -->\n<!-- old version -->\n')
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).not.toContain('old version')
    expect(html).toContain("location.replace('/app/'")
  })

  it('🔴 If existing file is another app\'s homepage (no marker) → do not touch it at all, only report skip', () => {
    const foreign = '<!DOCTYPE html><html><head><title>NimoOS</title></head><body><div id="app"></div></body></html>'
    writeFileSync(join(root, 'index.html'), foreign)
    const out = run(root)
    expect(out).toMatch(/^skip: /)
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(foreign)
  })

  it('If marker appears on line 6 or later, it does not count (prevent false positive on a long third-party homepage)', () => {
    const decoy = '\n'.repeat(8) + '<!-- nimoos-new-ui-redirect -->'
    writeFileSync(join(root, 'index.html'), decoy)
    const out = run(root)
    expect(out).toMatch(/^skip: /)
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(decoy)
  })

  // ⚠️ This one cannot just be expect(...).toThrow() — when the script file does not exist,
  // bash exits 127 which also throws, so the case would be green "before the implementation"
  // and never catch a missing argument check. Assert the specific exit code + stderr.
  it('When no argument is passed, fail with exit code 1 and print usage', () => {
    let err: any
    try {
      execFileSync('bash', [SCRIPT], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      err = e
    }
    expect(err, 'Must fail when argument is missing').toBeDefined()
    expect(err.status).toBe(1) // 127 = script itself not found; does not count as passing
    expect(String(err.stderr)).toMatch(/usage/)
  })

  // When the www root is not writable (the install doc historically only chowned the app
  // subdirectory; the root is often root:root), the script must not abort with a bare
  // Permission denied — rsync already succeeded, yet the operator only sees "deploy failed"
  // with no next step. Assert a non-zero exit and that the hint contains an actionable
  // chown command, rather than asserting the exact error copy (avoid locking the wording).
  // root can write regardless of permission bits (access(2) bypasses DAC checks for root),
  // so chmod 0555 cannot block it; this case can prove nothing under root — skip it
  // instead of producing a fake red/green.
  it.skipIf(process.getuid?.() === 0)(
    '🔴 When www root directory is not writable, exit with non-zero code and print an actionable hint with chown command',
    () => {
      chmodSync(root, 0o555)
      let err: any
      try {
        run(root)
      } catch (e) {
        err = e
      } finally {
        chmodSync(root, 0o755) // restore writability so afterEach's rmSync can delete it
      }
      expect(err, 'Must fail when directory is not writable').toBeDefined()
      expect(err.status).not.toBe(0)
      const stderr = String(err.stderr)
      expect(stderr, 'Hint must specify the exact path').toContain(root)
      expect(stderr, 'Hint must provide an executable fix command, not just a bare error').toMatch(/chown/)
    }
  )

  // deploy.sh executes `./scripts/write-root-redirect.sh …` directly (no bash prefix),
  // while this test always invokes via `bash SCRIPT` — without this case, a lost executable
  // bit keeps tests green but on-device deploy fails with Permission denied.
  // Assert the mode in the git index, not just local file permissions: the mode must travel
  // with commits to be effective for the next clone.
  //
  // ⚠️ This file enters the artifact tree via `git archive HEAD` without .git (tarball
  // consumers get plain files, no git repo), where `git ls-files` exits 128 and throws.
  // Graceful degradation: first detect whether we are inside a git work tree; if so, also
  // assert the index mode (the stronger guarantee — the mode really travels with commits);
  // if not, fall back to asserting only the local permission bits, so tests still pass in
  // a non-git artifact tree instead of deleting the whole valuable assertion.
  it('🔴 Script is executable; if inside a git work tree, the index also records 100755', () => {
    expect(statSync(SCRIPT).mode & 0o111).toBeTruthy()

    let inWorkTree = false
    try {
      inWorkTree =
        execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() === 'true'
    } catch {
      inWorkTree = false
    }

    if (!inWorkTree) return // non-git artifact tree (e.g. tests run from an unpacked tarball): permission bits already asserted, stop here

    const entry = execFileSync('git', ['ls-files', '-s', 'scripts/write-root-redirect.sh'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(entry, 'File must be git added to the index before the mode can be measured').toMatch(/^100755 /)
  })

  it('The generated page can redirect even without JS (noscript meta refresh fallback)', () => {
    run(root)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0;url=/app/"></noscript>')
  })

  // Also watch the atomic write: the temp file must already be mv'ed away, not left in the directory (the gateway would serve it as a static file too).
  it('Only write index.html, leave no other files in root directory (including .tmp)', () => {
    run(root)
    expect(existsSync(join(root, 'index.html'))).toBe(true)
    expect(readdirSync(root)).toEqual(['index.html'])
  })
})

describe('deploy.sh wiring', () => {
  // Build the path from the HERE constant defined at the top of the file. ⚠️ Do not write
  // `new URL('./deploy.sh', import.meta.url)`: this two-arg literal form gets statically
  // transformed by Vite as an asset URL; under vitest (jsdom) it resolves to http: instead of
  // file:, fileURLToPath throws a TypeError, and the whole test file collects 0 tests (hit in Task 1).
  const deploySrc = readFileSync(join(HERE, 'deploy.sh'), 'utf8')

  it('Invokes the redirect script and passes the www root, not the app subdirectory', () => {
    expect(deploySrc).toContain('./scripts/write-root-redirect.sh /var/lib/nimoos/www')
    expect(deploySrc).not.toContain('write-root-redirect.sh /var/lib/nimoos/www/app')
  })

  it('Invocation happens after rsync (lay out the app first, then add the root directory redirect)', () => {
    const rsyncAt = deploySrc.indexOf('rsync -a --delete')
    const callAt = deploySrc.indexOf('./scripts/write-root-redirect.sh')
    expect(rsyncAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(rsyncAt)
  })
})

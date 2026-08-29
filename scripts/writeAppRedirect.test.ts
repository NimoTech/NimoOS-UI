import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, chmodSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ Do not use `new URL('./x', import.meta.url)`: this two-arg literal form gets
// special-cased as a Vite asset URL literal, and under vitest (jsdom) it resolves to an
// http: URL relative to the dev server instead of file:, making fileURLToPath throw
// (same trap recorded at src/settings/panels/panels.test.ts:56, same approach: get this
// file's path via fileURLToPath(import.meta.url) first, then join with path.join).
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, 'write-app-redirect.sh')
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

describe('write-app-redirect.sh', () => {
  it('creates app/ when missing and writes the redirect page', () => {
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'app', 'index.html'), 'utf8')
    expect(html).toContain('nimoos-app-redirect')
    expect(html).toContain("location.replace('/' + location.search + location.hash)")
  })

  // Unlike the retired write-root-redirect.sh (which wrote into a root it did not own and
  // therefore had an overwrite guard), /app/ has only ever belonged to this app: whatever
  // index.html sits there is the app's own old build, and replacing it IS the point.
  it('overwrites an existing legacy app index.html unconditionally', () => {
    mkdirSync(join(root, 'app'))
    writeFileSync(join(root, 'app', 'index.html'), '<!doctype html><title>old build</title>')
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'app', 'index.html'), 'utf8')
    expect(html).not.toContain('old build')
    expect(html).toContain('nimoos-app-redirect')
  })

  it('leaves the legacy hashed assets next to the redirect untouched (old tabs still lazy-load them)', () => {
    mkdirSync(join(root, 'app', 'assets'), { recursive: true })
    writeFileSync(join(root, 'app', 'assets', 'chunk-abc123.js'), 'old chunk')
    run(root)
    expect(readFileSync(join(root, 'app', 'assets', 'chunk-abc123.js'), 'utf8')).toBe('old chunk')
  })

  // ⚠️ This one cannot just be expect(...).toThrow() — when the script file does not exist,
  // bash exits 127 which also throws, so the case would be green "before the implementation"
  // and never catch a missing argument check. Assert the specific exit code + stderr.
  it('when no argument is passed, fail with exit code 1 and print usage', () => {
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

  // When the www root is not writable, the script must not abort with a bare Permission
  // denied — rsync already succeeded, yet the operator only sees "deploy failed" with no
  // next step. Assert a non-zero exit and that the hint contains an actionable chown
  // command, rather than asserting the exact error copy (avoid locking the wording).
  // root can write regardless of permission bits (access(2) bypasses DAC checks for root),
  // so chmod 0555 cannot block it; this case can prove nothing under root — skip it
  // instead of producing a fake red/green.
  it.skipIf(process.getuid?.() === 0)(
    '🔴 when the www root is not writable, exit non-zero and print an actionable chown hint',
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

  // deploy.sh executes `./scripts/write-app-redirect.sh …` directly (no bash prefix),
  // while this test always invokes via `bash SCRIPT` — without this case, a lost executable
  // bit keeps tests green but on-device deploy fails with Permission denied.
  // Assert the mode in the git index, not just local file permissions: the mode must travel
  // with commits to be effective for the next clone.
  //
  // ⚠️ Graceful degradation for non-git artifact trees (tests run from an unpacked
  // tarball): `git ls-files` exits 128 there — fall back to asserting only the local
  // permission bits instead of deleting the whole valuable assertion.
  it('🔴 script is executable; if inside a git work tree, the index also records 100755', () => {
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

    if (!inWorkTree) return // permission bits already asserted, stop here

    const entry = execFileSync('git', ['ls-files', '-s', 'scripts/write-app-redirect.sh'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(entry, 'File must be git added to the index before the mode can be measured').toMatch(/^100755 /)
  })

  it('the generated page can redirect even without JS (noscript meta refresh fallback)', () => {
    run(root)
    const html = readFileSync(join(root, 'app', 'index.html'), 'utf8')
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0;url=/"></noscript>')
  })

  // Also watch the atomic write: the temp file must already be mv'ed away, not left in the
  // directory (the gateway would serve it as a static file too).
  it('writes only app/index.html, leaves no other files behind (including .tmp)', () => {
    run(root)
    expect(existsSync(join(root, 'app', 'index.html'))).toBe(true)
    expect(readdirSync(join(root, 'app'))).toEqual(['index.html'])
    expect(readdirSync(root)).toEqual(['app'])
  })
})

describe('deploy.sh wiring', () => {
  // Build the path from the HERE constant defined at the top of the file. ⚠️ Do not write
  // `new URL('./deploy.sh', import.meta.url)`: this two-arg literal form gets statically
  // transformed by Vite as an asset URL; under vitest (jsdom) it resolves to http: instead of
  // file:, fileURLToPath throws a TypeError, and the whole test file collects 0 tests (hit in Task 1).
  const deploySrc = readFileSync(join(HERE, 'deploy.sh'), 'utf8')

  it('deploys to the www root and invokes the app-redirect script with that root', () => {
    expect(deploySrc).toContain('dist/ /var/lib/nimoos/www/')
    expect(deploySrc).not.toContain('dist/ /var/lib/nimoos/www/app/')
    expect(deploySrc).toContain('./scripts/write-app-redirect.sh /var/lib/nimoos/www')
  })

  it('protects both hashed-asset generations from --delete (root assets and legacy app/)', () => {
    expect(deploySrc).toContain("--filter='protect assets/*'")
    expect(deploySrc).toContain("--filter='protect app/**'")
  })

  it('redirect write happens after rsync (lay out the app first, then cover the legacy mount)', () => {
    const rsyncAt = deploySrc.indexOf('rsync -a --delete')
    const callAt = deploySrc.indexOf('./scripts/write-app-redirect.sh')
    expect(rsyncAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(rsyncAt)
  })
})

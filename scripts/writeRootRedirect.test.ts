import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ 不用 `new URL('./x', import.meta.url)`:这个两参数字面量形态会被当作
// Vite 的资源 URL 字面量特殊处理,在 vitest(jsdom)下解析成相对 dev server
// 的 http: URL 而不是 file:,导致 fileURLToPath 直接抛错(同
// src/settings/panels/panels.test.ts:56 记录的坑,同一口径:先
// fileURLToPath(import.meta.url) 拿到本文件路径,再用 path.join 拼)。
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
  it('根目录没有 index.html 时写出重定向页', () => {
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('nimoos-new-ui-redirect')
    expect(html).toContain("location.replace('/app/' + location.search + location.hash)")
  })

  it('已存在的是本脚本上次写的(前 5 行含标记)→ 覆盖重写', () => {
    writeFileSync(join(root, 'index.html'), '<!doctype html>\n<!-- nimoos-new-ui-redirect -->\n<!-- 旧版本 -->\n')
    const out = run(root)
    expect(out).toMatch(/^wrote: /)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).not.toContain('旧版本')
    expect(html).toContain("location.replace('/app/'")
  })

  it('🔴 已存在的是别的应用的首页(无标记)→ 一字不动,只报 skip', () => {
    const foreign = '<!DOCTYPE html><html><head><title>NimoOS</title></head><body><div id="app"></div></body></html>'
    writeFileSync(join(root, 'index.html'), foreign)
    const out = run(root)
    expect(out).toMatch(/^skip: /)
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(foreign)
  })

  it('标记出现在第 6 行及以后不算数(防止误判一份很长的别家首页)', () => {
    const decoy = '\n'.repeat(8) + '<!-- nimoos-new-ui-redirect -->'
    writeFileSync(join(root, 'index.html'), decoy)
    const out = run(root)
    expect(out).toMatch(/^skip: /)
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(decoy)
  })

  // ⚠️ 这条不能只写 expect(...).toThrow() —— 脚本文件还不存在时 bash 退 127 也会 throw,
  // 那样这条用例在"实现之前"就是绿的,永远抓不到"忘了写参数校验"。断言到具体退出码 + stderr。
  it('不传参数时以退出码 1 失败并打印 usage', () => {
    let err: any
    try {
      execFileSync('bash', [SCRIPT], { encoding: 'utf8', stdio: 'pipe' })
    } catch (e) {
      err = e
    }
    expect(err, '缺参数时必须失败').toBeDefined()
    expect(err.status).toBe(1) // 127 = 脚本本身没找到,不算通过
    expect(String(err.stderr)).toMatch(/usage/)
  })

  // www 根目录不可写时(装机说明历史上只 chown 了 app 子目录,根目录常年是
  // root:root)不能甩一句裸的 Permission denied 就中止——那样 rsync 明明成功了,
  // 操作者却只看到"部署失败"且不知道下一步做什么。断言退出非 0 且提示里带
  // 可执行的 chown 命令,而不是断言具体报错文案(避免测试锁死措辞)。
  // root 用户对任何权限位都能写(access(2) 对 root 会绕过 DAC 检查),chmod 0555
  // 挡不住,这条用例在 root 下必然测不出东西,跳过而不是造出假红/假绿。
  it.skipIf(process.getuid?.() === 0)(
    '🔴 www 根目录不可写时非零退出,并打印带 chown 命令的可操作提示',
    () => {
      chmodSync(root, 0o555)
      let err: any
      try {
        run(root)
      } catch (e) {
        err = e
      } finally {
        chmodSync(root, 0o755) // 改回可写,afterEach 的 rmSync 才删得掉
      }
      expect(err, '目录不可写时必须失败').toBeDefined()
      expect(err.status).not.toBe(0)
      const stderr = String(err.stderr)
      expect(stderr, '提示要点名具体路径').toContain(root)
      expect(stderr, '提示要给出可执行的修复命令,不能是裸错误').toMatch(/chown/)
    }
  )

  // deploy.sh 是 `./scripts/write-root-redirect.sh …` 直接执行的(不带 bash 前缀),
  // 而本测试全程用 `bash SCRIPT` 调 —— 少了这条,可执行位丢了测试照绿、真机部署 Permission denied。
  // 断言 git 索引里的模式而不只是本地文件权限:模式要跟着提交走才对下一个 clone 有效。
  //
  // ⚠️ 这个文件会随 `git archive HEAD` 进入不含 .git 的产物树(tarball 消费者
  // 拿到的就是纯文件,没有 git 仓库),此时 `git ls-files` 会以 128 退出、抛异常。
  // 优雅退化:先探测是否身处 git 工作树,是则连带断言索引模式(更强的保证——
  // 模式真的跟着提交走);不是则只退回到断言本地文件权限位,保证在非 git 的
  // 产物树里跑测试也能过,而不是整条有价值的断言直接删掉。
  it('🔴 脚本可执行,若身处 git 工作树则索引里记的也是 100755', () => {
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

    if (!inWorkTree) return // 非 git 产物树(如 tarball 解包后跑测试):文件权限位已经断言过,到此为止

    const entry = execFileSync('git', ['ls-files', '-s', 'scripts/write-root-redirect.sh'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(entry, '文件要先 git add 进索引才量得到模式').toMatch(/^100755 /)
  })

  it('写出的页面在无 JS 时也能跳(noscript meta refresh 兜底)', () => {
    run(root)
    const html = readFileSync(join(root, 'index.html'), 'utf8')
    expect(html).toContain('<noscript><meta http-equiv="refresh" content="0;url=/app/"></noscript>')
  })

  // 顺带盯住原子写:临时文件必须已经 mv 掉,不能留在目录里(网关会把它也当静态文件服务)。
  it('只写 index.html,不在根目录留下任何别的文件(含 .tmp)', () => {
    run(root)
    expect(existsSync(join(root, 'index.html'))).toBe(true)
    expect(readdirSync(root)).toEqual(['index.html'])
  })
})

describe('deploy.sh 接线', () => {
  // 用文件顶部已有的 HERE 常量拼路径。⚠️ 不要写 `new URL('./deploy.sh', import.meta.url)`:
  // 这个两参数字面量形态会被 Vite 当资源 URL 静态转换,vitest(jsdom)下解析成 http: 而非
  // file:,fileURLToPath 直接抛 TypeError 且整个测试文件 0 collected(Task 1 已实测踩过)。
  const deploySrc = readFileSync(join(HERE, 'deploy.sh'), 'utf8')

  it('调用了重定向脚本,并且传的是 www 根而不是 app 子目录', () => {
    expect(deploySrc).toContain('./scripts/write-root-redirect.sh /var/lib/nimoos/www')
    expect(deploySrc).not.toContain('write-root-redirect.sh /var/lib/nimoos/www/app')
  })

  it('调用点在 rsync 之后(先把应用铺好,再补根目录那一跳)', () => {
    const rsyncAt = deploySrc.indexOf('rsync -a --delete')
    const callAt = deploySrc.indexOf('./scripts/write-root-redirect.sh')
    expect(rsyncAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(rsyncAt)
  })
})

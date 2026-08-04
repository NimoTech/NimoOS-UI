#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  DELETE, SERVICE_DELETE, REPLACE, PATCH, SERVICE_PATCH,
  NEW_UI, SERVICE, DEFAULT_OUT, OSS_DIR, DIRTY_ALLOW,
} from './manifest.mjs'
import { checkClean, applyDelete, applyReplace, applyPatch } from './apply.mjs'
import { scanTree, isExpectedSkip } from './forbidden.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const OUT = path.resolve(opt('--out', DEFAULT_OUT))
const SKIP_GUARD = flag('--skip-guard')
const NO_COMMIT = flag('--no-commit')
const KEEP_TEMP = flag('--keep-temp')
const ALLOW_DIRTY_OSS = flag('--allow-dirty-oss')

const log = (m) => console.log(`[oss] ${m}`)
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()

// T14(B1):整条主流程包一层 try/catch —— 本项目的纪律是"错误消息本身就是产品"
// (见 apply.mjs 里每一处 throw 的诊断文案),命中守卫/清单过期这类**预期内、操作员
// 可见的失败**不该带一段 Node 原始 stack trace,那是噪音,会盖住精心写好的诊断文案。
// 只在最外层兜底打印 err.message + exit(1);内层各处该抛的 Error 照抛不动,由这里
// 统一收口成安静的失败退出。
try {
// ── 1. 前置检查 ───────────────────────────────────────────────────────────
log('1/6 前置检查')
// --allow-dirty-oss 仅供 oss/ 自身的开发迭代测试用(T6-T14 会反复往 manifest.mjs 追加
// 数据、往 oss/ 加文件),不削弱 checkClean/DIRTY_ALLOW 本身的语义 —— 只是在调用点额外
// 放行 git status 里路径落在 oss/ 下的行。原因:manifest.mjs 描述的是"删改动作"本身,
// 工作树里 oss/ 有未提交改动而其余源码干净时,`git archive HEAD` 取到的源码仍然是
// HEAD 的真实内容,只有"清单"是新的 —— 这种不一致在开发迭代期无害。
// 正式出包(T15)一律不带这个 flag:那时必须保证 manifest.mjs 描述的清单和
// `git archive HEAD` 取到的源码版本完全对应,任何 oss/ 下的未提交改动都应该先被看到。
//
// T14(B5):`git status --porcelain` 的 rename 行长这样:`R  oss/foo.mjs -> src/moved.ts`
// ——原来的 /^.{2}\s+oss\//` 只看"状态码+空格"后面紧跟的第一段路径(rename 的旧路径),
// 一旦旧路径落在 oss/ 下就整行放行,不管新路径搬到哪去了。真把一个文件从 oss/ 移到
// src/ 下,src 侧这个真实的未提交改动会被这条正则悄悄放过,checkClean 形同虚设。
// 用一条"消费掉整行"的正则堵住这个洞:允许 " -> " 之前的内容(旧路径)是任意非
// " -> " 文本,但如果整行确实包含 " -> "(说明是 rename/copy),后面的新路径必须
// 同样以 oss/ 开头才放行;如果新路径搬出了 oss/,正则匹配不到行尾,回落到"未豁免"。
// 优先级最低的开发期 flag(T15 不带),但既然要修就修对,不留一半。
const OSS_RENAME_SAFE = /^.{2}\s+oss\/(?:(?!\s->\s).)*(?:\s->\s+oss\/.*)?$/
const dirtyAllowNewUi = ALLOW_DIRTY_OSS ? [...DIRTY_ALLOW, OSS_RENAME_SAFE] : DIRTY_ALLOW
checkClean(NEW_UI, dirtyAllowNewUi)
checkClean(SERVICE, [])
const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
const headService = git(SERVICE, 'rev-parse', 'HEAD')
log(`  New-UI ${headNewUi.slice(0, 8)} · Service ${headService.slice(0, 8)}`)

// ── 2. 取源(git archive:.git / node_modules / dist / .superpowers / tmlab 自动排除)──
log('2/6 取源')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-export-'))
// try 从这里开始(mkdtempSync 之后、第一次可能失败的操作 archiveInto 之前),覆盖取源 +
// 应用清单 + 落盘全程 —— 否则取源阶段(比如 sibling NimoOS-Service 不存在/archive 失败)
// 会在 finally 清理跑不到的情况下把 tmp 目录遗留在 /tmp。
try {
  const archiveInto = (repo, dest) => {
    fs.mkdirSync(dest, { recursive: true })
    execFileSync('sh', ['-c', `git -C '${repo}' archive HEAD | tar -x -C '${dest}'`])
  }
  archiveInto(NEW_UI, tmp)
  const svcDir = path.join(tmp, 'packages/service')
  archiveInto(SERVICE, svcDir)

  // ── 3. 应用清单:顺序固定 DELETE → REPLACE → PATCH ──────────────────────
  log(`3/6 应用清单(DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length})`)
  applyDelete(tmp, DELETE)
  applyDelete(svcDir, SERVICE_DELETE)
  applyReplace(tmp, REPLACE, path.join(OSS_DIR, 'files'))
  applyPatch(tmp, PATCH)
  applyPatch(svcDir, SERVICE_PATCH)

  // ── 4. 内嵌 Service:改 package.json 的 file: 一行 + lockfile 路径 ────────
  log('4/6 内嵌共享包')
  const pkgPath = path.join(tmp, 'package.json')
  const pkg = fs.readFileSync(pkgPath, 'utf8')
  const FROM = '"@nimotech/nimoos-service": "file:../NimoOS-Service"'
  const TO = '"@nimotech/nimoos-service": "file:./packages/service"'
  if (pkg.split(FROM).length - 1 !== 1) throw new Error(`package.json 的 file: 锚点未唯一命中:${FROM}`)
  fs.writeFileSync(pkgPath, pkg.replace(FROM, TO))
  const lockPath = path.join(tmp, 'pnpm-lock.yaml')
  const lock = fs.readFileSync(lockPath, 'utf8')
  if (!lock.includes('../NimoOS-Service')) throw new Error('pnpm-lock.yaml 里没有 ../NimoOS-Service,锚点已漂')
  fs.writeFileSync(
    lockPath,
    lock.replaceAll('file:../NimoOS-Service', 'file:packages/service')
        .replaceAll('directory: ../NimoOS-Service', 'directory: packages/service'),
  )

  // ── 5. 泄漏守卫(在临时目录上跑,不过就一个字节都不落盘)────────────────
  // scanTree 对每次跳过(未做内容扫描)都会留痕一条 word: '__skipped__' 的记录(见
  // forbidden.mjs 里 scanTree 的注释)。跳过分两类,处理方式不同:
  //   · 预期内(二进制 / 符号链接)—— 这棵树里长期存在合法的二进制资源(图标等),不算
  //     泄漏,不能让守卫永久哑火,但必须打印+记录、绝不能悄悄吞掉("绝不静默"纪律)。
  //   · 预期外(读取失败 / stat 失败 / 目录读取失败 / 超过体积上限)—— 这些情形本身就
  //     反常(该被扫的文本文件读不出来,或体积大得异常),必须让人停下来看一眼,跟
  //     "这是个 PNG 图标"不能一视同仁,所以仍然 fatal。
  // isExpectedSkip(从 forbidden.mjs 导入,T14/B2)只精确匹配 SKIP_REASON_SYMLINK /
  // SKIP_REASON_BINARY 这两条固定文案(不含动态内容);其余跳过原因(体积超限、各类
  // 失败,文案里带 err.message 等动态内容)一律落入"预期外"分支。分类逻辑与 scanTree
  // 里实际写入的文案共享同一份具名常量(不是各自硬编码一份中文字符串再指望人工保持
  // 同步)——forbidden.test.mjs 有单测直接锁住这个函数的分类结果,tree.test.mjs 走的
  // --skip-guard 完全不经过这段逻辑,覆盖不到。
  let skipReportLines = []
  if (SKIP_GUARD) {
    log('5/6 泄漏守卫 —— 已用 --skip-guard 跳过(仅开发期允许,未扫描任何文件)')
    skipReportLines = ['(本次导出带 --skip-guard,泄漏守卫与跳过清单均未执行)']
  } else {
    log('5/6 泄漏守卫')
    const findings = scanTree(tmp)
    const skipped = findings.filter((f) => f.word === '__skipped__')
    const leaks = findings.filter((f) => f.word !== '__skipped__')
    const expectedSkips = skipped.filter((f) => isExpectedSkip(f.excerpt))
    const unexpectedSkips = skipped.filter((f) => !isExpectedSkip(f.excerpt))

    if (expectedSkips.length) {
      log(`  ⚠ ${expectedSkips.length} 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):`)
      for (const f of expectedSkips) {
        const line = `⚠ 未扫描:${f.file} —— ${f.excerpt}`
        log(`    ${line}`)
        skipReportLines.push(line)
      }
    }

    if (unexpectedSkips.length) {
      for (const f of unexpectedSkips) console.error(`  ✗ ${f.file} [${f.word}] ${f.excerpt}`)
      throw new Error(
        `泄漏守卫遇到 ${unexpectedSkips.length} 处预期外的跳过(读取失败/stat 失败/超过体积上限/目录读取失败),` +
        `一个字节都不落盘。这类文件本身反常,必须人工看一眼再决定 —— 不能和"这是个二进制图标"一视同仁。`,
      )
    }

    if (leaks.length) {
      for (const f of leaks.slice(0, 60)) console.error(`  ✗ ${f.file}:${f.line} [${f.word}] ${f.excerpt}`)
      throw new Error(`泄漏守卫命中 ${leaks.length} 处,一个字节都不落盘。` +
        `修法只有两条:真泄漏就补剥离清单;误报就往 forbidden.mjs 加**精确白名单** —— 禁止放宽词表。`)
    }
    log(`  零真实泄漏命中(${expectedSkips.length} 个预期内跳过已记录,见上方与 .export-report.txt)`)
  }

  // ── 6. 落盘 + 零历史提交 ────────────────────────────────────────────────
  log('6/6 落盘')
  // --out 护栏:目标目录已存在且非空、又不像是之前的导出产物时,拒绝用 rsync --delete
  // 清空它 —— 避免用户随手指一个普通目录当 --out,产物一落地就把里面的东西静默删光。
  // "像是之前的导出产物"用 .git 或 .export-report.txt 任一存在来判定,这样重复导出到
  // 同一个产物目录(幂等性要求)不受影响,只拦住"这看起来是别的东西"的情形。
  if (fs.existsSync(OUT)) {
    const outEntries = fs.readdirSync(OUT)
    if (outEntries.length > 0) {
      const looksLikePriorExport = outEntries.includes('.git') || outEntries.includes('.export-report.txt')
      if (!looksLikePriorExport) {
        throw new Error(
          `--out ${OUT} 已存在且非空,但看起来不是之前的导出产物(既不含 .git 也不含 .export-report.txt)。\n` +
          `拒绝用 rsync --delete 清空它 —— 如果你确实要用这个目录,请先自己清空。`,
        )
      }
    }
  }
  fs.mkdirSync(OUT, { recursive: true })
  // T15(e):--exclude node_modules——取源(git archive)天然不含 node_modules,
  // 若不排除,--delete 每次都会把 --out 目录里已经 `pnpm install` 好的 node_modules
  // 整个删掉,逼着人每次导出后重装一遍依赖。**故意不排除 dist/**——理由相反:
  // dist 是构建产物,同样不在取源范围内,让它每次被清掉是对的,否则一次陈旧的、
  // 对不上当前源码的旧 dist 会被误当成"这次构建的产物"去跑第五道门(dist 扫描),
  // 扫描结果就不代表这次改动的真实情况。
  execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', '--exclude', 'node_modules', `${tmp}/`, `${OUT}/`])
  fs.writeFileSync(
    path.join(OUT, '.export-report.txt'),
    `NimoOS-New-UI HEAD: ${headNewUi}\nNimoOS-Service HEAD: ${headService}\n` +
    `DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length}\n` +
    `泄漏守卫未扫描清单(预期内,二进制/符号链接):\n` +
    (skipReportLines.length ? skipReportLines.map((l) => `  ${l}`).join('\n') + '\n' : '  (无)\n') +
    `⚠️ 本文件含私有仓 commit hash,已在 .gitignore 里,不进 git。\n`,
  )
  if (!NO_COMMIT) {
    // 跨任务顺序依赖(本任务新增的显式检查,brief 未写):.export-report.txt 只有在
    // 产出树 .gitignore 里被排除才不会被下面的 `git add -A` 误提交进零历史仓库。
    // 那一行 .gitignore 是 Task 7 才会补的补丁,在那之前必须响、不能静默吞掉。
    const gitignorePath = path.join(OUT, '.gitignore')
    const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
    if (!gitignore.split('\n').some((l) => l.trim() === '.export-report.txt')) {
      throw new Error(
        '.export-report.txt 会被 git add -A 误提交:产出树 .gitignore 里还没有这一行。\n' +
        'Task 7 的 .gitignore 补丁还没落地,报告文件会被误提交 —— 先落地那个补丁,或者用 --no-commit 跳过本次提交。',
      )
    }
    if (!fs.existsSync(path.join(OUT, '.git'))) git(OUT, 'init', '-b', 'main')
    execFileSync('git', ['-C', OUT, 'add', '-A'])
    const has = execFileSync('sh', ['-c', `git -C '${OUT}' rev-list --count HEAD 2>/dev/null || echo 0`],
      { encoding: 'utf8' }).trim() !== '0'
    execFileSync('git', ['-C', OUT, 'commit', ...(has ? ['--amend'] : []), '--no-edit',
      ...(has ? [] : ['-m', 'NimoOS Web UI'])], { stdio: 'pipe' })
    const n = git(OUT, 'rev-list', '--count', 'HEAD')
    if (n !== '1') throw new Error(`零历史被破坏:rev-list --count HEAD = ${n},必须是 1`)
  }
  log(`完成 → ${OUT}`)
} finally {
  if (KEEP_TEMP) log(`临时目录保留:${tmp}`)
  else fs.rmSync(tmp, { recursive: true, force: true })
}
} catch (err) {
  console.error(`[oss] 失败:${err.message}`)
  process.exit(1)
}

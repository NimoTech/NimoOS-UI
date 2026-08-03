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
import { scanTree } from './forbidden.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const OUT = path.resolve(opt('--out', DEFAULT_OUT))
const SKIP_GUARD = flag('--skip-guard')
const NO_COMMIT = flag('--no-commit')
const KEEP_TEMP = flag('--keep-temp')

const log = (m) => console.log(`[oss] ${m}`)
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()

// ── 1. 前置检查 ───────────────────────────────────────────────────────────
log('1/6 前置检查')
checkClean(NEW_UI, DIRTY_ALLOW)
checkClean(SERVICE, [])
const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
const headService = git(SERVICE, 'rev-parse', 'HEAD')
log(`  New-UI ${headNewUi.slice(0, 8)} · Service ${headService.slice(0, 8)}`)

// ── 2. 取源(git archive:.git / node_modules / dist / .superpowers / tmlab 自动排除)──
log('2/6 取源')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oss-export-'))
const archiveInto = (repo, dest) => {
  fs.mkdirSync(dest, { recursive: true })
  execFileSync('sh', ['-c', `git -C '${repo}' archive HEAD | tar -x -C '${dest}'`])
}
archiveInto(NEW_UI, tmp)
const svcDir = path.join(tmp, 'packages/service')
archiveInto(SERVICE, svcDir)

try {
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
  if (SKIP_GUARD) {
    log('5/6 泄漏守卫 —— 已用 --skip-guard 跳过(仅开发期允许)')
  } else {
    log('5/6 泄漏守卫')
    const findings = scanTree(tmp)
    if (findings.length) {
      for (const f of findings.slice(0, 60)) console.error(`  ✗ ${f.file}:${f.line} [${f.word}] ${f.excerpt}`)
      throw new Error(`泄漏守卫命中 ${findings.length} 处,一个字节都不落盘。` +
        `修法只有两条:真泄漏就补剥离清单;误报就往 forbidden.mjs 加**精确白名单** —— 禁止放宽词表。`)
    }
    log('  零命中')
  }

  // ── 6. 落盘 + 零历史提交 ────────────────────────────────────────────────
  log('6/6 落盘')
  fs.mkdirSync(OUT, { recursive: true })
  execFileSync('rsync', ['-a', '--delete', '--exclude', '.git', `${tmp}/`, `${OUT}/`])
  fs.writeFileSync(
    path.join(OUT, '.export-report.txt'),
    `NimoOS-New-UI HEAD: ${headNewUi}\nNimoOS-Service HEAD: ${headService}\n` +
    `DELETE ${DELETE.length} · REPLACE ${REPLACE.length} · PATCH ${PATCH.length}\n` +
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

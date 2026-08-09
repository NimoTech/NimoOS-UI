import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, afterEach } from 'vitest'
import * as manifest from './manifest.mjs'

// 2026-08-08:这一组守的是**一次真实事故**——想看看脚本有哪些参数,敲了
// `node oss/export.mjs --help`,而当时脚本(a)不认识 --help(b)对未知参数不报错,于是
// 按"你什么都没传"处理 → 走 DEFAULT_OUT(真实公开仓 NimoOS-Web)+ 默认开启提交 →
// rsync --delete 覆盖公开仓、`git commit --amend` 改掉它的 HEAD(4957653 → 548e53c),
// 最后才在 `rev-list --count` 那句上失败(木已成舟,靠 reset --hard 还原)。
//
// 结论:出事的不是某一行逻辑,是**默认值的方向** —— 危险动作(写公开仓 + 提交)是默认,
// 安全动作要手动叠三个 flag。这里把方向钉死:**不带 --publish 的任何调用都不许碰公开仓、
// 不许建仓提交;不认识的参数一律拒绝执行**。
//
// ⚠️ 本文件每条用例都显式传 --out <临时目录>。这不是冗余:守卫没落地时(RED 阶段)
// 不传 --out 的调用会真的写进公开仓 —— 测试本身绝不能重演它要防的那场事故。

const OSS = manifest.OSS_DIR
const EXPORT = path.join(OSS, 'export.mjs')
// 每条用例都带上这三个,把被测面收敛到"参数解析 + 是否提交"本身:
// --skip-guard 跳过泄漏扫描(本组不测泄漏)、--allow-dirty-oss 放行 oss/ 下的未提交改动
// (本文件自己就是那个改动)。
const DEV = ['--skip-guard', '--allow-dirty-oss']

/** 跑 export.mjs,返回 { code, stdout, stderr } —— 非零退出不抛,交给用例断言。 */
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

describe('export.mjs 参数解析:不认识的参数必须拒绝执行', () => {
  it('未知参数 → 非零退出,且一个字节都不落盘', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir, '--no-commit', '--bogus-flag'])

    expect(r.code, `未知参数应当非零退出,实际 ${r.code}\n${r.stdout}${r.stderr}`).not.toBe(0)
    expect(r.stderr + r.stdout, '错误信息里应当点名是哪个参数不认识').toContain('--bogus-flag')
    expect(fs.readdirSync(dir), '拒绝执行时不该往 --out 目录写任何东西').toEqual([])
  }, 180_000)

  it('--help → 打印用法后退出,不执行导出', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir, '--help'])

    expect(r.code, '--help 应当正常退出').toBe(0)
    expect(r.stdout, '--help 应当打印出 --publish 的说明').toContain('--publish')
    // 这条是事故的核心:当年 --help 被当成"没传参",于是真的跑完了六步。
    expect(r.stdout, '--help 绝不能进入导出流程').not.toContain('1/6')
    expect(fs.readdirSync(dir), '--help 不该往 --out 目录写任何东西').toEqual([])
  }, 180_000)
})

describe('export.mjs 默认值方向:默认安全,发布才危险', () => {
  it('默认产出目录不是公开仓 —— 不带 --publish 时连碰都碰不到它', () => {
    expect(manifest.PUBLISH_OUT, 'PUBLISH_OUT 应当指向公开仓 NimoOS-Web')
      .toBe(path.resolve(OSS, '../../NimoOS-Web'))
    expect(manifest.PREVIEW_OUT, '默认(预览)产出目录不得等于公开仓')
      .not.toBe(manifest.PUBLISH_OUT)
    // 预览目录落在系统临时目录下:即便被 rsync --delete 清空也没有任何损失。
    expect(manifest.PREVIEW_OUT.startsWith(fs.realpathSync(os.tmpdir())),
      `预览目录应落在临时目录下,实际 ${manifest.PREVIEW_OUT}`).toBe(true)
  })

  it('不带 --publish → 只落盘,不建 git 仓库、不提交', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir])

    expect(r.code, `导出应当成功\n${r.stdout}${r.stderr}`).toBe(0)
    expect(fs.existsSync(path.join(dir, 'package.json')), '文件应当正常落盘').toBe(true)
    expect(fs.existsSync(path.join(dir, '.git')), '没说 --publish 就不许建仓提交').toBe(false)
  }, 180_000)

  // 上一条的对照面:防止"永远不提交"这种把测试跑绿、却让发布功能失效的实现。
  // 两条必须成对存在 —— 单独任何一条都分辨不出"默认关"和"永远关"。
  it('带 --publish → 建 git 仓库并提交(零历史单提交)', () => {
    const dir = mkOut()
    const r = run([...DEV, '--out', dir, '--publish'])

    expect(r.code, `--publish 导出应当成功\n${r.stdout}${r.stderr}`).toBe(0)
    expect(fs.existsSync(path.join(dir, '.git')), '--publish 应当建仓并提交').toBe(true)
    const n = execFileSync('git', ['-C', dir, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()
    expect(n, '零历史:提交数恒为 1').toBe('1')
  }, 180_000)
})

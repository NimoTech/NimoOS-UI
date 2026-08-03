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

/**
 * manifest 里的路径数据是人写的,信不过它天然安全:解析后必须落在 baseDir 之内,
 * 否则「相对层数多打一个 `../`」这种笔误会让 applyDelete/applyReplace 真的删/读到
 * 目标树之外的文件。绝对路径一律拒绝(不允许 manifest 绕过 baseDir 直接点系统路径)。
 * 返回解析后的绝对路径,调用方直接用它做后续 I/O。
 */
function assertSafeRelPath(baseDir, rel, context) {
  if (path.isAbsolute(rel)) {
    throw new Error(`${context}:是绝对路径 ${JSON.stringify(rel)} —— manifest 里的路径必须是相对路径,不能直接引用文件系统绝对路径`)
  }
  const base = path.resolve(baseDir)
  const abs = path.resolve(base, rel)
  if (abs !== base && !abs.startsWith(base + path.sep)) {
    throw new Error(
      `${context}:路径越界,${JSON.stringify(rel)} 解析后落在 ${abs}\n` +
      `不在 ${base} 之内 —— manifest 里这条路径数据有问题(相对层数写错?),导出脚本拒绝写到目标树之外。`,
    )
  }
  return abs
}

export function applyDelete(root, paths) {
  for (const rel of paths) {
    const abs = assertSafeRelPath(root, rel, `DELETE ${rel}`)
    if (!fs.existsSync(abs)) {
      throw new Error(`DELETE 清单过期:${rel} 不存在(私有主干已删或改名,请更新 manifest.mjs)`)
    }
    fs.rmSync(abs, { recursive: true, force: true })
  }
}

export function applyReplace(root, entries, ossDir) {
  for (const { path: rel, from, privateSha256 } of entries) {
    const abs = assertSafeRelPath(root, rel, `REPLACE 目标 ${rel}`)
    const srcAbs = assertSafeRelPath(ossDir, from, `REPLACE 源 ${from}`)
    if (!fs.existsSync(abs)) throw new Error(`REPLACE 目标不存在:${rel}`)
    const actual = sha256(fs.readFileSync(abs, 'utf8'))
    if (actual !== privateSha256) {
      throw new Error(
        `私有仓的 ${rel} 变了(sha256 ${actual.slice(0, 12)}… ≠ 钉住的 ${privateSha256.slice(0, 12)}…)。\n` +
        `请复核 oss/files/${from} 是否需要同步,然后把 manifest.mjs 里的 privateSha256 更新为新值。\n` +
        `⚠️ 禁止为了让脚本跑过而删掉哈希钉 —— 那会让这条路重新变成哑火。`,
      )
    }
    if (!fs.existsSync(srcAbs)) {
      throw new Error(
        `REPLACE 源文件缺失:oss/files/${from}(manifest 条目 path=${rel}, from=${from})\n` +
        `请在 oss/files/ 补上这个文件,或检查 manifest.mjs 里这条条目的 from 是否写错。`,
      )
    }
    fs.copyFileSync(srcAbs, abs)
  }
}

export function applyPatch(root, entries) {
  for (const { path: rel, find, replace } of entries) {
    if (find === '') {
      throw new Error(`锚点为空串:${rel} —— 空串无法唯一定位任何位置,manifest 里这条数据有问题`)
    }
    const abs = assertSafeRelPath(root, rel, `PATCH ${rel}`)
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
    // 用函数形式的替换值,而不是 text.replace(find, replace) 的字符串重载:
    // String.prototype.replace 的字符串重载会把 replace 里的 $&/$`/$'/$1 等
    // 解释成特殊模式(比如 $& 会被替换成"刚匹配到的那段文本")。
    // 这个项目的 replace 内容是 TS/Vue/CSS 代码片段,随时可能出现这些序列
    // (哪怕今天恰好没有),一旦命中就是静默误替换 —— 这正是本项目最忌讳的"哑火"。
    // 函数形式的返回值一律按字面量写入,不做任何模式解释。
    fs.writeFileSync(abs, text.replace(find, () => replace))
  }
}

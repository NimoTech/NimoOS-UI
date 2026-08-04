#!/usr/bin/env node
// T15:第五道门的固定入口——把原来 task-15-brief 里那段一次性 `node -e "..."`
// 内联脚本升级成可复用、可测试的 CLI,直接消费 forbidden.mjs 的 scanDist()。
// 用法:node oss/scan-dist.mjs <dist目录>
import path from 'node:path'
import { scanDist, isExpectedSkip } from './forbidden.mjs'

const target = process.argv[2]
if (!target) {
  console.error('用法:node oss/scan-dist.mjs <dist目录>')
  process.exit(2)
}

const root = path.resolve(target)
const findings = scanDist(root)
const skipped = findings.filter((f) => f.word === '__skipped__')
const leaks = findings.filter((f) => f.word !== '__skipped__')
const expectedSkips = skipped.filter((f) => isExpectedSkip(f.excerpt))
const unexpectedSkips = skipped.filter((f) => !isExpectedSkip(f.excerpt))

if (expectedSkips.length) {
  console.log(`⚠ ${expectedSkips.length} 个文件未做内容扫描(二进制/符号链接,预期内):`)
  for (const f of expectedSkips) console.log(`  ⚠ ${f.file} —— ${f.excerpt}`)
}

if (unexpectedSkips.length) {
  for (const f of unexpectedSkips) console.error(`  ✗ ${f.file} —— ${f.excerpt}`)
  console.error(`[scan-dist] 遇到 ${unexpectedSkips.length} 处预期外跳过(读取失败/stat 失败/超过体积上限/目录读取失败),判定失败。`)
  process.exit(1)
}

if (leaks.length) {
  for (const f of leaks.slice(0, 80)) console.error(`  ✗ ${f.file}:${f.line} [${f.word}] ${f.excerpt}`)
  console.error(`[scan-dist] 命中 ${leaks.length} 处。`)
  process.exit(1)
}

console.log(`[scan-dist] 零命中(${expectedSkips.length} 个预期内跳过已记录,见上方)`)
process.exit(0)

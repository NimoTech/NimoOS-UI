#!/usr/bin/env node
// T15: fixed checkpoint 5 entry point — upgraded from original task-15-brief's one-time inline `node -e "..."`
// script to reusable, testable CLI, directly consumes scanDist() from forbidden.mjs.
// Usage: node oss/scan-dist.mjs <dist directory>
import path from 'node:path'
import { scanDist, isExpectedSkip } from './forbidden.mjs'

const target = process.argv[2]
if (!target) {
  console.error('Usage: node oss/scan-dist.mjs <dist directory>')
  process.exit(2)
}

const root = path.resolve(target)
const findings = scanDist(root)
const skipped = findings.filter((f) => f.word === '__skipped__')
const leaks = findings.filter((f) => f.word !== '__skipped__')
const expectedSkips = skipped.filter((f) => isExpectedSkip(f.excerpt))
const unexpectedSkips = skipped.filter((f) => !isExpectedSkip(f.excerpt))

if (expectedSkips.length) {
  console.log(`⚠ ${expectedSkips.length} files not scanned (binary/symlink, expected):`)
  for (const f of expectedSkips) console.log(`  ⚠ ${f.file} — ${f.excerpt}`)
}

if (unexpectedSkips.length) {
  for (const f of unexpectedSkips) console.error(`  ✗ ${f.file} — ${f.excerpt}`)
  console.error(`[scan-dist] hit ${unexpectedSkips.length} unexpected skips (read failure/stat failure/size limit/dir read failure); verdict: failure.`)
  process.exit(1)
}

if (leaks.length) {
  for (const f of leaks.slice(0, 80)) console.error(`  ✗ ${f.file}:${f.line} [${f.word}] ${f.excerpt}`)
  console.error(`[scan-dist] hit ${leaks.length} locations.`)
  process.exit(1)
}

console.log(`[scan-dist] zero hits (${expectedSkips.length} expected skips logged; see above)`)
process.exit(0)

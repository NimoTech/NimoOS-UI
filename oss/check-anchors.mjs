// Read-only diagnostic: report which manifest PATCH anchors no longer match the
// working tree. Run it after any sweep that rewrites source text (the English-ification
// pass, for instance) — every `find:` string is matched byte-for-byte by apply.mjs, so a
// reworded comment silently turns into an `Anchor no match` throw at export time.
//
// This does not modify anything and does not run the export. Usage:
//   node oss/check-anchors.mjs
// Exit code is 0 always — it is a report, not a gate. The real gate is `node oss/export.mjs`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as manifest from './manifest.mjs'

const NEW_UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Tables whose entries carry a `find:` anchor, paired with the subtree they apply to. */
const TABLES = [
  ['PATCH', ''],
  ['SERVICE_PATCH', 'packages/service'],
]

let broken = 0
let ok = 0
const missing = []

for (const [name, base] of TABLES) {
  const entries = manifest[name]
  if (!Array.isArray(entries)) continue
  for (const entry of entries) {
    if (!entry || typeof entry.find !== 'string') continue
    const abs = path.join(NEW_UI, base, entry.path)
    if (!fs.existsSync(abs)) {
      missing.push(`${name} ${entry.path} — file does not exist`)
      continue
    }
    const text = fs.readFileSync(abs, 'utf8')
    const hits = text.split(entry.find).length - 1
    if (hits === 1) {
      ok++
      continue
    }
    broken++
    const why = hits === 0 ? 'no match' : `${hits} matches (must be exactly 1)`
    console.log(`[${name}] ${entry.path} — ${why}`)
    console.log(`    find: ${JSON.stringify(entry.find.slice(0, 100))}`)
  }
}

for (const m of missing) console.log(`[missing] ${m}`)
console.log(`\nanchors ok: ${ok}   broken: ${broken}   missing files: ${missing.length}`)

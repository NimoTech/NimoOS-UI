/// <reference types="node" />
// Node types are referenced explicitly rather than added to tsconfig's `types` array
// (same approach as color-guard.test.ts).
//
// vue-i18n **silently falls back to the key name itself** when a key is missing, so a
// typo'd key shows up verbatim on screen (users see things like `kvmToastResumd`) while
// all three gates stay green: vue-tsc never compares string literals against the
// catalogue, a unit test asserting rendered text is often asserting the key's own name,
// and build does not care either. This guard checks one direction: is every key the
// source references actually in the catalogue?
//
// It does **not** duplicate parity.test.ts, which checks that the zh and en key sets match
// and that no value is empty, and **never reads the source** -- a key that exists in
// neither locale sails straight through there. Each file guards one direction.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import zhBase from './zh_cn'
import enBase from './en_us'
import zhSp9 from './zh_cn.sp9'
import enSp9 from './en_us.sp9'

// Word-for-word what the runtime does: these two merged results are exactly what
// index.ts hands to createI18n. (The zh_cn.ts entry point has already merged its own
// pieces; the sp9 shard travels a separate assembly path and has to be merged here.)
const zh: Record<string, unknown> = { ...zhBase, ...zhSp9 }
const en: Record<string, unknown> = { ...enBase, ...enSp9 }

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(vue|ts)$/.test(e.name) && !e.name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

// Comments have to be stripped first. The porting comments in this repo quote Vue2's
// original key names all over the place (`$t('Off')`, `$t('Enable')` and similar "we
// reused this as a different key" notes), plus commented-out old code lines -- measured:
// without stripping, the guard reports 74 "missing keys", every one of them a reference
// inside a comment and not a single real gap. False positives get a guard switched off,
// so prefer missing a case (a key inside a comment does not affect runtime anyway).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')       // block comments (JS and CSS alike)
    .replace(/<!--[\s\S]*?-->/g, '')        // HTML comments in templates
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1') // line comments; `[^:]` keeps http:// out
}

// Only the `t('literal')` shape is recognised. `t(someVar)` / `t(\`x\${y}\`)` cannot be
// resolved statically -- do **not** loosen the regex to cover them: false negatives are
// acceptable here, false positives get the guard switched off.
const KEY_RE = /\bt\('([a-zA-Z][a-zA-Z0-9_]*)'\)/g

describe('every i18n key referenced by t() exists in both catalogues', () => {
  // The catalogue files are not consumers themselves (their own contents carry
  // illustrative `$t('…')` references), so they are excluded.
  const files = walk(SRC).filter((f) => !f.startsWith(path.join(SRC, 'i18n') + path.sep))

  it('has no dead keys anywhere in the repo', () => {
    expect(files.length).toBeGreaterThan(100) // idle-run guard: a changed directory layout should go red

    const missing: string[] = []
    let checked = 0
    for (const f of files) {
      const src = stripComments(fs.readFileSync(f, 'utf8'))
      for (const m of src.matchAll(KEY_RE)) {
        const k = m[1]
        checked += 1
        if (!(k in zh)) missing.push(`${path.relative(SRC, f)}: zh is missing ${k}`)
        if (!(k in en)) missing.push(`${path.relative(SRC, f)}: en is missing ${k}`)
      }
    }

    // Second idle-run guard: if the regex is ever broken (or comment stripping goes too
    // far), `checked` drops to 0, `missing` is then empty too and the test stays green --
    // this floor turns "checked nothing at all" red. Measured 2026-08-09: 3207 references
    // in this repo. The floor also has to hold for a tree with whole areas stripped out
    // (about 1570 references measured there), so it cannot be set at this repo's
    // magnitude or the guard would go red simply for having fewer areas. 800 is high
    // enough to catch "regex broke -> nothing scanned" and low enough that ordinary
    // additions, deletions or stripping never reach it.
    expect(checked, 'not a single t() literal was scanned; the guard is idling').toBeGreaterThan(800)

    expect(missing, `\nt() references keys that do not exist:\n${missing.join('\n')}`).toEqual([])
  })
})

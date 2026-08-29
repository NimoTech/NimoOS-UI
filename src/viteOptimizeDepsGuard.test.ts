// Convention guard: the shared package @nimotech/nimoos-service must stay in vite's optimizeDeps.exclude.
//
// Since SP13 (2026-08-07) the package is inlined into this repo at `packages/service/`
// (`package.json` says `file:packages/service`, no longer pointing at the old external service package) — but
// this guard is still required; do not consider it obsolete just because "the package is
// already in the repo". Reason: it is still a `file:` dependency, still resolved through
// `node_modules` (pnpm hardlinks `packages/service/` into the `.pnpm` directory); to Vite
// it looks like any ordinary node_modules dependency and still gets pre-bundled into
// `node_modules/.vite/deps/`; and the pre-bundle cache invalidation criteria are
// lockfile / config / dependency version numbers — **never dependency contents** — so
// editing `packages/service/src/*.ts` never triggers invalidation.
//
// Why this deserves a test watching it: once this config gets "cleaned up", the failure is
// **silent and dev-only** — the SP9-P1 acceptance lost a whole round this way (all 4 write
// operations reported "failed to save config"), and during the SP13 inlining it was deleted
// once on the mistaken belief "entry points at source ⇒ exclude no longer needed", then
// restored after being disproven in practice. Unit tests use the source, production builds
// use node_modules — both are fresh — so this trap only surfaces on the dev server and no
// test can catch it. This guard exists precisely to prevent "config deleted but all three gates green" accidents.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const CONFIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vite.config.ts')

describe('vite optimizeDeps guard', () => {
  it('Shared package @nimotech/nimoos-service is in optimizeDeps.exclude', () => {
    const src = fs.readFileSync(CONFIG, 'utf8')
    const block = src.match(/optimizeDeps\s*:\s*\{[\s\S]*?\}/)
    expect(block, 'optimizeDeps block not found in vite.config.ts').not.toBeNull()
    expect(block![0]).toMatch(/exclude\s*:\s*\[[^\]]*'@nimotech\/nimoos-service'/)
  })
})

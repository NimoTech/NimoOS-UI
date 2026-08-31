// Convention guard (docs/THEMING.md §8): **toasts must sit above every modal scrim in the repo**.
//
// Why this needs a test: the scrims all carry backdrop-filter, so a toast buried under one is not
// "a bit gray" but **completely unreadable**. Real consequence caught in this sprint's review —
// three "failed but the dialog is deliberately kept open for retry" paths (rename person failed /
// create album failed / name unnamed person failed) all hid the failure reason under the
// z-index 220 .pd-scrim / .cad-overlay (since Plan D Task 4: renamed to .person-dialog-scrim,
// now 200, via the Vue2-parity stylesheet — still below toast either way); users only saw a
// button that "did nothing" and kept retrying.
//
// jsdom does no cascade computation, so cross-component stacking cannot be read after mount; the
// only option is numeric assertions on the raw <style> text (same `?raw` precedent established by
// color-guard.test.ts / PersonAssetGrid.test.ts).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Stylesheet reads switched from `import.meta.glob(...'?raw')` to node:fs, and
// `.scss` was added.
//
// 🔴 Why the read method changed (worse than just "missed .scss"): vitest's CSSEnablerPlugin
// replaces css/scss **wholesale with empty strings**, and it **ignores the query string** —
// `?raw` has no effect on it. Measured in this repo:
//     vue : 340 files, 340 non-empty
//     css :   5 files,   0 non-empty (theme.css etc. all len=0)
//     scss:   9 files,   0 non-empty
// So the "every other z-index in the repo is strictly below the toast" guard **could only see
// .vue files**; the 5 standalone .css were always empty shells. Copying the glob and adding a
// `.scss` line would leave the 9 new .scss files as empty shells too — the guard would be "green"
// with zero discriminating power. This is the same pit recorded at the top of photosSlice.test.ts /
// knowledgeStyles.test.ts ("always read from disk via node:fs; `?raw` is always empty"), and we
// follow their established approach here.
//
// .vue still goes through glob (unaffected by CSSEnablerPlugin; measured 340/340 non-empty).
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function collectStylesheets(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue
      collectStylesheets(p, out)
    } else if (/\.(css|scss)$/.test(e.name)) {
      out[`/src/${relative(SRC_DIR, p).replace(/\\/g, '/')}`] = readFileSync(p, 'utf8')
    }
  }
  return out
}

const files: Record<string, string> = {
  ...(import.meta.glob('/src/**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...collectStylesheets(SRC_DIR),
}

// .vue: only <style> blocks; .css/.scss: whole file. Deliberately the same extraction approach as color-guard, but line numbers are not needed here.
function styleText(rel: string, src: string): string {
  if (rel.endsWith('.css') || rel.endsWith('.scss')) return src
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let out = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out += `${m[1]}\n`
  return out
}

// Only match `z-index: <integer>` (negative/auto/inherit are irrelevant to this convention).
// Numbers inside comments cannot be misdetected — the regex requires them right after `z-index:`.
function zIndexes(css: string): number[] {
  const out: number[] = []
  const re = /z-index\s*:\s*(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) out.push(Number(m[1]))
  return out
}

const TOAST = 'src/components/AppToast.vue'

function relOf(path: string): string {
  return path.replace(/^\//, '').replace(/\\/g, '/')
}

const toastRaw = Object.entries(files).find(([p]) => relOf(p) === TOAST)?.[1] ?? ''
const toastZ = Math.max(...zIndexes(styleText(TOAST, toastRaw)))

describe('Convention guard (THEMING.md §8): toasts must be above all modal scrims', () => {
  // 🔴 Data-validity gate (added after a regression): the repo-wide assertion above becomes **vacuously
  // true** whenever it reads empty content. This repo already spun idle once because of that
  // (css/scss via `?raw` were all empty strings; the guard only saw .vue yet stayed green).
  // This test pins "stylesheets were actually read, and z-index can actually be scanned", so
  // hollowing-out turns red immediately instead of passing silently.
  it('Data validity: .vue and .css/.scss were both read with non-empty content, and z-index was successfully scanned', () => {
    const nonEmpty = (pred: (r: string) => boolean) =>
      Object.entries(files).filter(([p, v]) => pred(relOf(p)) && typeof v === 'string' && v.length > 0)
    const vues = nonEmpty((r) => r.endsWith('.vue'))
    const sheets = nonEmpty((r) => r.endsWith('.css') || r.endsWith('.scss'))
    expect(vues.length, 'No .vue files were read, data reading method failed').toBeGreaterThan(100)
    expect(sheets.length, 'Standalone stylesheets not read at all (old pitfall: `?raw` always empty)').toBeGreaterThan(5)
    const sheetZ = sheets.flatMap(([p, v]) => zIndexes(styleText(relOf(p), v)))
    expect(sheetZ.length, 'No z-index scanned from standalone stylesheets, the guard is doing nothing').toBeGreaterThan(0)
  })

  it('AppToast .toast-stack z-index can be read and is the highest tier', () => {
    expect(Number.isFinite(toastZ)).toBe(true)
    expect(toastZ).toBeGreaterThan(0)
  })

  it('All other z-indexes in the repo are strictly below toast', () => {
    const offenders: string[] = []
    for (const [path, src] of Object.entries(files)) {
      const rel = relOf(path)
      if (rel === TOAST) continue
      for (const z of zIndexes(styleText(rel, src))) {
        if (z >= toastZ) offenders.push(`  ${rel}: z-index ${z} (toast = ${toastZ})`)
      }
    }
    expect(
      offenders,
      `\nThe following layers are at the same level or higher than toast; toast will be hidden under them (many with backdrop-filter).\n`
        + `Lower these values per the hierarchy in docs/THEMING.md §8; do not raise the toast:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  // Pin the two concrete scrims from the three review-hit paths individually (even if someone relaxes the previous test, this one remains).
  //
  // Plan D Task 4 update: both rules moved out of their component's own local `<style
  // scoped>` block (now deleted) into the global parity stylesheet — `.pd-scrim` was
  // renamed to the Vue2 anchor `.person-dialog-scrim` and now lives in
  // photos-people.scss; `.cad-overlay` kept its name (ClusterActionDialog.vue's classes
  // don't change per Plan D) but its rule now lives in that same parity file too. Point
  // both rows at the file that actually carries the rule now.
  it.each([
    ['src/photos/styles/vue2-parity/photos-people.scss', '.person-dialog-scrim'],
    ['src/photos/styles/vue2-parity/photos-people.scss', '.cad-overlay'],
  ])('%s %s is below toast', (rel, selector) => {
    const src = Object.entries(files).find(([p]) => relOf(p) === rel)?.[1]
    expect(src, `${rel} not collected by glob`).toBeTruthy()
    const css = styleText(rel, src as string)
    // Take the z-index from the rule block containing this selector.
    const block = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(css)
    expect(block, `Cannot find ${selector} rule block in ${rel}`).toBeTruthy()
    const z = zIndexes((block as RegExpExecArray)[1])
    expect(z.length, `No z-index in ${selector} rule block`).toBe(1)
    expect(z[0]).toBeLessThan(toastZ)
  })
})

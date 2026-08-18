/// <reference types="node" />
// Explicitly reference node types rather than adding "node" to tsconfig's types array (consistent with color-guard.test.ts).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import folderSrc from './FolderTile.vue?raw'

// `?raw` on .css is always empty string in this repo's vitest environment
// (CSS goes through side-effect module pipeline, not fs plugin); color-guard.test.ts / theme.sp9.test.ts
// hit the same pitfall and switched to node:fs reading — follow same pattern here.
// .vue files unaffected (FolderTile.vue?raw still gets real source code).
const themeSrc = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/theme.css'),
  'utf8',
)

// bug.txt #6: FolderTile's scoped `.folder-ic { width:100%; height:100% }` has equal
// specificity to theme.css's square rule (aspect-ratio:1); SFC style injected later wins,
// breaking the square rule entirely; <img>'s 64px intrinsic width inside .folder-ic stretches
// tile out of grid. Guard: SFC must not redeclare .folder-ic width/height; theme.css square
// rule must include min-width:0 (the floor of min-width:auto on replaced elements was the culprit).
describe('desktop tile sizing (bug.txt #6)', () => {
  const style = folderSrc.slice(folderSrc.indexOf('<style'))
  // Strip CSS comments before matching: guards must track real declarations, not be thrown off
  // by ".folder-ic"/"width"/"height" text in explanatory comments (like history discussion below).
  const styleWithoutComments = style.replace(/\/\*[\s\S]*?\*\//g, '')
  it('FolderTile scoped style must not redeclare .folder-ic width/height', () => {
    expect(styleWithoutComments).not.toMatch(/\.folder-ic[^{]*\{[^}]*(width|height)\s*:/)
  })
  it('theme.css square-tile rule keeps aspect-ratio and min-width:0', () => {
    const rule = themeSrc.match(/\.kind-folder \.folder-ic[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/aspect-ratio\s*:\s*1/)
    expect(rule).toMatch(/min-width\s*:\s*0/)
  })

  // bug.txt #6 second form (2026-08-11 user clarification): long folder names overlap each other.
  // Root cause: .grid-item is flex container, FolderTile/AppTile roots as flex items have no width limit —
  // nowrap long name stretches to content width (min-width:auto floor), .app-label's max-width:100% resolves
  // to this stretched parent, ellipsis never triggers, overflow covers adjacent grid. Real device evidence:
  // label measured 262px in 63px grid, adjacent labels intersect; after injecting max-width:100% label=63px,
  // ellipsized=true, zero overlap.
  it('theme.css must cap tile roots at the cell width so long names ellipsize', () => {
    const rule = themeSrc.match(/\.kind-folder \.folder-tile-wrap[^{]*\{[^}]*\}|\.kind-app \.app-tile[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/max-width\s*:\s*100%/)
    // Both tile root types must be covered by the same rule; missing one only fixes half
    expect(themeSrc).toMatch(/\.kind-app \.app-tile[^{]*\.kind-folder \.folder-tile-wrap[^{]*\{[^}]*max-width\s*:\s*100%|\.kind-folder \.folder-tile-wrap[^{]*\.kind-app \.app-tile[^{]*\{[^}]*max-width\s*:\s*100%/)
  })
})

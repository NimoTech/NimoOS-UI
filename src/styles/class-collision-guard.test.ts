// Guards the parity-CSS transition (spec 2026-08-11 §4): the vue2-parity
// stylesheets ship ~619 top-level unscoped class selectors that are photos-
// internal by intent. This test keeps that intent true: the set of bare
// top-level class names in src/photos/styles/vue2-parity/*.scss must have
// ZERO intersection with class names used in templates OUTSIDE the photos
// area (src/** minus src/photos/** and src/views/Photos*.vue).
// Mechanism: extract top-level selectors at brace depth 0 (skip any already
// scoped under .photos-root), take their class tokens; scan non-photos .vue
// files' template class="..." / :class bindings for literal string tokens;
// assert empty intersection, printing offenders.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

interface ClassHit {
  cls: string
  selector: string
  file: string
}

function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listFiles(full, exts))
    else if (exts.some((ext) => e.name.endsWith(ext))) out.push(full)
  }
  return out
}

function readRel(full: string): { rel: string; text: string } {
  return {
    rel: path.relative(SRC_DIR, full).split(path.sep).join('/'),
    text: fs.readFileSync(full, 'utf8'),
  }
}

// Blank out /* ... */ block comments (preserving newlines) before any
// brace-depth walking or attribute scanning — comment prose (e.g. a file
// header referencing "map-styles.css") can otherwise be mistaken for a
// selector or contain stray `.token`-shaped text that pollutes extraction.
function stripBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

// ① Extract class tokens out of top-level (brace depth 0) selectors in a
// .scss source, ② skipping any selector already scoped under `.photos-root`
// (comma-separated selector lists are split and filtered independently —
// `.photos-root .a, .b { … }` only skips the first branch). At-rule headers
// (`@media (...)`, `@keyframes name`, `@mixin name`) are not selectors and
// are skipped outright; their nested bodies sit at depth 1+ and are out of
// scope for this guard by design (SCSS `&`-nesting under `.photos-root { }`
// already makes those safe post-compile — see photos-people.scss /
// photos-places.scss, which wrap their entire bodies in `.photos-root { }`).
//
// A selector only counts as a genuinely "bare" collision risk when ANY
// element carrying just that one literal class, with no other context,
// would match it. Two shapes are therefore excluded even though they are
// technically at depth 0 and not `.photos-root`-scoped:
//   - descendant/child/sibling chains (`.st-bar-legend .lbl`,
//     `.places-cover-portal .cp-shell`) — the rightmost class only fires
//     when nested under the specific ancestor class, which non-photos
//     markup essentially never reproduces by accident;
//   - multi-class AND-compounds (`.places-cover-portal.is-open`,
//     `.cal-cell.end`) — both classes must land on the very same element,
//     so neither one alone is "bare".
// This matches the Plan A final-review compile audit's judgment call (its
// zero-intersection finding was against exactly this narrower set); a
// top-level selector consisting of a single class — optionally with
// pseudo-classes/attribute selectors bolted on, e.g. `.fchip[data-on="true"]`
// or `.fchip:hover` — is the only shape counted.
function extractTopLevelClassHits(rawText: string, file: string): ClassHit[] {
  const text = stripBlockComments(rawText)
  const out: ClassHit[] = []
  let depth = 0
  let selStart = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      if (depth === 0) {
        const header = text.slice(selStart, i).trim()
        if (header && !header.startsWith('@')) {
          for (const rawSel of header.split(',')) {
            const sel = rawSel.trim()
            if (!sel || sel.startsWith('.photos-root')) continue
            if (/[\s>+~]/.test(sel)) continue // descendant/child/sibling chain — needs ancestor context
            const classTokens = sel.match(/\.[a-zA-Z_][\w-]*/g) ?? []
            if (classTokens.length !== 1) continue // 0 (tag/attr only) or 2+ (AND-compound) — not bare
            out.push({ cls: classTokens[0].slice(1), selector: sel, file })
          }
        }
      }
      depth++
      selStart = i + 1
    } else if (c === '}') {
      depth--
      selStart = i + 1
    }
  }
  return out
}

const parityFiles = listFiles(path.join(SRC_DIR, 'photos', 'styles', 'vue2-parity'), ['.scss']).map(
  readRel,
)

const parityHits: ClassHit[] = parityFiles.flatMap(({ rel, text }) => extractTopLevelClassHits(text, rel))

// ③ Non-photos template class usage: everything under src/** except the
// photos area itself (src/photos/**) and the route-level Photos*.vue views
// under src/views/. Covers static `class="…"` and quoted string literals
// inside `:class="…"` bindings (object-key / ternary / array forms) — bare
// (unquoted) object keys like `:class="{ active: cond }"` are intentionally
// out of scope per the mechanism note above (only literal string tokens).
const vueRaw = import.meta.glob('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const nonPhotosVueFiles = Object.entries(vueRaw)
  .map(([p, text]) => ({ rel: p.replace(/^\.\.\//, '').replace(/\\/g, '/'), text }))
  .filter(({ rel }) => !rel.startsWith('photos/') && !/^views\/Photos.*\.vue$/.test(rel))

interface TemplateClassHit {
  cls: string
  file: string
}

function templateBlock(src: string): string {
  const m = /<template[^>]*>([\s\S]*)<\/template>/.exec(src)
  return m ? m[1] : ''
}

function extractTemplateClassHits(rel: string, src: string): TemplateClassHit[] {
  const out: TemplateClassHit[] = []
  let text = templateBlock(src)

  // Pull out :class="…" bindings first (and blank them from `text`) so the
  // plain class="…" pass below can't double-count their content.
  const dynamicRe = /:class="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = dynamicRe.exec(text))) {
    const stringLiteralRe = /'([^'\\]*)'|"([^"\\]*)"/g
    let lm: RegExpExecArray | null
    while ((lm = stringLiteralRe.exec(m[1]))) {
      const literal = lm[1] ?? lm[2] ?? ''
      for (const token of literal.split(/\s+/).filter(Boolean)) {
        out.push({ cls: token, file: rel })
      }
    }
  }
  text = text.replace(dynamicRe, '')

  const staticRe = /\bclass="([^"]*)"/g
  while ((m = staticRe.exec(text))) {
    for (const token of m[1].split(/\s+/).filter(Boolean)) {
      out.push({ cls: token, file: rel })
    }
  }
  return out
}

const nonPhotosHits: TemplateClassHit[] = nonPhotosVueFiles.flatMap(({ rel, text }) =>
  extractTemplateClassHits(rel, text),
)

describe('跨区类名冲突守卫(photos vue2-parity 裸类名 vs 非 photos 模板零交集)', () => {
  it('至少扫描到了预期的几处来源(守卫不能悄悄扫空)', () => {
    expect(parityFiles.length).toBeGreaterThan(0)
    expect(parityHits.length).toBeGreaterThan(0)
    expect(nonPhotosVueFiles.length).toBeGreaterThan(0)
  })

  it('parity 裸顶层类名与非 photos 模板类名零交集', () => {
    const parityByClass = new Map<string, Set<string>>()
    for (const hit of parityHits) {
      const set = parityByClass.get(hit.cls) ?? new Set<string>()
      set.add(`${hit.file} (${hit.selector})`)
      parityByClass.set(hit.cls, set)
    }

    const nonPhotosByClass = new Map<string, Set<string>>()
    for (const hit of nonPhotosHits) {
      const set = nonPhotosByClass.get(hit.cls) ?? new Set<string>()
      set.add(hit.file)
      nonPhotosByClass.set(hit.cls, set)
    }

    const offenders: string[] = []
    for (const [cls, defSites] of parityByClass) {
      const useSites = nonPhotosByClass.get(cls)
      if (!useSites) continue
      offenders.push(
        `  .${cls}\n` +
          `    parity 定义处:\n${[...defSites].map((s) => `      - ${s}`).join('\n')}\n` +
          `    非 photos 使用处:\n${[...useSites].map((s) => `      - ${s}`).join('\n')}`,
      )
    }

    expect(
      offenders,
      `\n发现 photos vue2-parity 裸顶层类名与非 photos 模板类名冲突(全局非 scoped 样式会串到无关区域):\n${offenders.join(
        '\n',
      )}`,
    ).toEqual([])
  })
})

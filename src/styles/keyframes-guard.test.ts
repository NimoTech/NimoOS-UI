// Global @keyframes uniqueness guard.
//
// Why this exists: `@keyframes` names are NOT scoped by CSS selectors — they
// live in one flat, page-wide namespace. Vue SFC `<style scoped>` blocks are
// the one exception, because the SFC compiler rewrites keyframe names with a
// per-component hash, so two `scoped` blocks can safely reuse the same
// literal name without colliding at runtime.
//
// This branch (2026-08-11 photos Vue2-parity reskin, final-review Critical#1)
// shipped exactly the collision this guard prevents: `photos.scss` and
// `photos-smartview.scss` both defined a *global*, non-scoped `@keyframes
// pulse` for a small breathing dot — completely unrelated to the
// pre-existing global `pulse` keyframes in `src/styles/theme.css` (a
// box-shadow glow used by `AiWidget.vue`'s orb). Because keyframe names
// ignore selector/file scoping, whichever declaration came last in document
// order silently won and hijacked the AI widget's orb animation. The fix
// renamed the parity-side keyframes to `photos-pulse`; this test makes sure
// nobody reintroduces a same-named, differently-defined `@keyframes` in any
// of the non-scoped sources that ship together on the same page.
//
// Scope collected:
//   (a) src/styles/*.css                        — global stylesheet(s)
//   (b) src/ai/styles/**/*.scss (if present)     — AI area's global styles
//   (c) src/photos/styles/vue2-parity/*.scss     — the Vue2-parity source of truth
//   (d) <style> blocks WITHOUT `scoped` in src/**/*.vue — scoped blocks are
//       exempt (SFC compiler hashes their keyframe names, see above)
//
// Duplicate names with byte-for-byte identical bodies are tolerated (they
// are provably harmless — CSS just redefines the same rule twice) — this is
// what already happens for `photos-pulse` itself: `photos.scss` internally
// `@import`s `photos-smartview.scss` (see index.ts), so the merged output of
// `photos.scss` alone already contains that keyframe twice, verbatim, by
// design of the original Vue2 source. A duplicate name with a *different*
// body — the actual hijack scenario — fails the test.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

interface KeyframeHit {
  name: string
  body: string
  file: string
}

// Extracts every `@keyframes <name> { ... }` block from `text`, brace-matching
// the body so nested `{ 0% { ... } 100% { ... } }` stops don't confuse it.
function extractKeyframes(text: string, file: string): KeyframeHit[] {
  const out: KeyframeHit[] = []
  const re = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let depth = 1
    let i = re.lastIndex
    const start = i
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      i++
    }
    out.push({ name: m[1], body: text.slice(start, i - 1), file })
    re.lastIndex = i
  }
  return out
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

// (a) global .css directly under src/styles/ (not recursive — matches "*.css").
const cssFiles = fs
  .readdirSync(path.join(SRC_DIR, 'styles'), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.css'))
  .map((e) => readRel(path.join(SRC_DIR, 'styles', e.name)))

// (b) src/ai/styles/**/*.scss, only if the dir exists.
const aiStylesFiles = listFiles(path.join(SRC_DIR, 'ai', 'styles'), ['.scss']).map(readRel)

// (c) the Vue2-parity source of truth.
const parityFiles = listFiles(path.join(SRC_DIR, 'photos', 'styles', 'vue2-parity'), ['.scss']).map(
  readRel,
)

// (d) <style> blocks WITHOUT `scoped` in every .vue file. Scoped blocks are
// exempt (see header comment) — the SFC compiler hashes their keyframe names.
function unscopedStyleBlocks(rel: string, src: string): string {
  const blocks: string[] = []
  const re = /<style([^>]*)>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const attrs = m[1]
    if (/\bscoped\b/.test(attrs)) continue
    blocks.push(m[2])
  }
  return blocks.join('\n')
}

const vueRaw = import.meta.glob('../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const vueUnscopedFiles = Object.entries(vueRaw)
  .map(([p, text]) => ({
    rel: p.replace(/^\.\.\//, '').replace(/\\/g, '/'),
    text: unscopedStyleBlocks(p, text),
  }))
  .filter((f) => f.text.trim().length > 0)

const allSources: Array<{ rel: string; text: string }> = [
  ...cssFiles,
  ...aiStylesFiles,
  ...parityFiles,
  ...vueUnscopedFiles,
]

describe('全局 @keyframes 名称唯一性守卫(防 pulse 与 theme.css 同名劫持复发)', () => {
  it('至少扫描到了预期的几处来源(守卫不能悄悄扫空)', () => {
    expect(cssFiles.length).toBeGreaterThan(0)
    expect(parityFiles.length).toBeGreaterThan(0)
  })

  it('所有非 scoped 来源里的 @keyframes 名称不冲突(同名必须同体,否则判定为劫持风险)', () => {
    const byName = new Map<string, KeyframeHit[]>()
    for (const { rel, text } of allSources) {
      for (const hit of extractKeyframes(text, rel)) {
        const list = byName.get(hit.name) ?? []
        list.push(hit)
        byName.set(hit.name, list)
      }
    }

    // Strip *all* whitespace rather than collapsing it — the known benign
    // duplicate (`photos-pulse` in photos.scss vs photos-smartview.scss)
    // differs only in a `0%,100%` vs `0%, 100%` comma-space, which is not a
    // meaningful CSS difference and must not be treated as a name collision.
    const normalize = (body: string) => body.replace(/\s+/g, '')

    const offenders: string[] = []
    for (const [name, hits] of byName) {
      if (hits.length < 2) continue
      const bodies = new Set(hits.map((h) => normalize(h.body)))
      if (bodies.size > 1) {
        offenders.push(
          `  @keyframes ${name} 在以下文件中被定义为不同内容(名称冲突,后加载的会静默覆盖先加载的):\n` +
            hits.map((h) => `    - ${h.file}`).join('\n'),
        )
      }
    }

    expect(
      offenders,
      `\n发现 @keyframes 名称冲突(不同文件用同一个名字定义了不同的动画 —— 这正是本条守卫要防的
Critical#1 复发:parity 的 pulse 曾经就是这样劫持了 theme.css 的全局 pulse / AiWidget 的轨道呼吸动画):\n${offenders.join(
        '\n',
      )}`,
    ).toEqual([])
  })
})

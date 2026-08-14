import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { NEW_UI, OSS_DIR } from './manifest.mjs'

// T15(d): waveform-color screen (evidence from T10) — test environment has no backend/real audio files;
// add component-level test as fallback evidence. Per project experience (see New-UI CLAUDE.md and
// "New-UI button hover turns white" memory: jsdom doesn't fully run CSS cascade, getComputedStyle unreliable on var() chains),
// here **don't** rely on getComputedStyle to read final color — instead assert two-layer "resolution chain itself is valid":
//   1. Mount real exported MediaViewer.vue (not private-repo version with speaker feature — different template,
//      only exported version is final released), stub audio file, assert .np-wave-bar really renders multiple bar nodes
//      per waveBars (not 0/render failure).
//   2. Statically read component's compiled <style> source, confirm .np-wave-bar background references token
//      var(--wave-none) (not hardcoded color, not misspelled token name); then statically read theme.css,
//      confirm --wave-none defined in both :root and :root[data-theme="light"] theme blocks — together that's
//      three necessary links in "bar colors display" chain (render nodes → component uses right token → token in both themes),
//      further than static grep (actual mount renders verify runtime behavior), but still honestly labeled:
//      not pixel-perfect screenshot; browser final render still recommends real-device check.
//
// Use real exported product not private-repo source — via temp export one product tree (same mechanism as tree.test.mjs),
// dynamically import MediaViewer.vue from it, so ./ViewerShell.vue, ./mediaKind, ./waveform etc. same-dir relative imports
// resolve correctly to exported product sibling files. Temp dir intentionally in repo (not system /tmp) — Vite dev/test
// module server by default only allows files in fs.allow range; system /tmp is outside, dynamic import gets rejected.

vi.mock('@nimotech/nimoos-service', () => ({
  service: { file: { fileUrl: (p) => `http://x${p}` } },
}))

const TMP = path.join(OSS_DIR, '.tmp-media-wave-test')
let MediaViewer

beforeAll(async () => {
  // jsdom doesn't implement HTMLMediaElement.play() — auto-play in component onMounted
  // (`audioMedia.value?.play?.().catch(() => {})`) throws synchronously "Not implemented" on jsdom,
  // becomes uncaught exception, drags vitest process exit code non-zero (even if all four assertions pass).
  // Unrelated to "waveform bar color resolution chain" we're testing; just jsdom lacks this API — stub it,
  // doesn't mean component is broken.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()

  fs.rmSync(TMP, { recursive: true, force: true })
  execFileSync('node', [path.join(OSS_DIR, 'export.mjs'), '--out', TMP, '--skip-guard', '--no-commit', '--allow-dirty-oss'], {
    stdio: 'pipe', encoding: 'utf8', cwd: NEW_UI,
  })
  const mod = await import(path.join(TMP, 'src/files/viewers/MediaViewer.vue'))
  MediaViewer = mod.default
}, 180_000)

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }))

describe('T15(d): exported MediaViewer waveform bar color resolution chain', () => {
  it('after audio file mount, .np-wave-bar renders multiple bars (not empty/failed)', () => {
    const w = mount(MediaViewer, {
      props: {
        item: { name: 'song.mp3', path: '/DATA/Music/song.mp3', is_dir: false },
        list: [],
      },
    })
    const bars = w.findAll('.np-wave-bar')
    expect(bars.length).toBeGreaterThan(10) // WAVE_N-scale bars, not 0/1
    w.unmount()
  })

  it('.np-wave-bar background references var(--wave-none) (not hardcoded color/misspelled token)', () => {
    const src = fs.readFileSync(path.join(TMP, 'src/files/viewers/MediaViewer.vue'), 'utf8')
    const styleBlock = src.slice(src.indexOf('<style'))
    const rule = styleBlock.match(/\.np-wave-bar\s*\{[^}]*\}/)
    expect(rule, 'can\'t find .np-wave-bar CSS rule block').toBeTruthy()
    expect(rule[0]).toMatch(/background:\s*var\(--wave-none\)/)
  })

  it('played bar .played references var(--accent) (differs from unplayed --wave-none; proves actually "has color" not both same)', () => {
    const src = fs.readFileSync(path.join(TMP, 'src/files/viewers/MediaViewer.vue'), 'utf8')
    const styleBlock = src.slice(src.indexOf('<style'))
    const rule = styleBlock.match(/\.np-wave-bar\.played\s*\{[^}]*\}/)
    expect(rule, 'can\'t find .np-wave-bar.played CSS rule block').toBeTruthy()
    expect(rule[0]).toMatch(/background:\s*var\(--accent\)/)
  })

  it('--wave-none token in exported product theme.css defined in both :root and :root[data-theme="light"] theme blocks', () => {
    const themeCss = fs.readFileSync(path.join(TMP, 'src/styles/theme.css'), 'utf8')
    // Use same approach as tree.test.mjs/parity test: extract two :root blocks separately, each must contain --wave-none.
    const rootBlock = themeCss.match(/:root\s*\{[^}]*\}/s)
    const lightBlock = themeCss.match(/:root\[data-theme=["']light["']\]\s*\{[^}]*\}/s)
    expect(rootBlock, 'can\'t find :root theme block').toBeTruthy()
    expect(lightBlock, 'can\'t find :root[data-theme="light"] theme block').toBeTruthy()
    expect(rootBlock[0]).toMatch(/--wave-none\s*:/)
    expect(lightBlock[0]).toMatch(/--wave-none\s*:/)
  })
})

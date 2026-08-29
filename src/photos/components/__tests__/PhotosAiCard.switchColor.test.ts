// Plan H Task 13: `.st-switch` knob literal-white ruling.
// Same-shaped owner ruling as the `.sv-switch` family (SmartViewCreateDialog.vue Fix-6,
// 2026-08-14): the knob stays literal `#fff` in both on/off states, matching Vue2
// photos.scss:2963's own literal `background: white`. Kept in its own file (not
// PhotosAiCard.test.ts) per brief note -- avoids the mocked-service/store test environment
// that file already sets up, since this is a pure text-scan assertion over the raw source.
import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// Read via node:fs + resolved path, not Vite's `?raw` -- vitest's CSS plugin can turn style
// source into an empty string, which would make this assertion false-pass (same precedent as
// FolderBrowser.test.ts's head comment).
const __dirname = dirname(fileURLToPath(import.meta.url))

describe('PhotosAiCard.vue .st-switch knob color', () => {
  it('.st-switch knob stays literal white in both states (aligned with the .sv-switch family ruling)', () => {
    const raw = fs.readFileSync(resolve(__dirname, '../PhotosAiCard.vue'), 'utf8')
    const after = raw.slice(raw.indexOf('.st-switch::after'), raw.indexOf('.st-switch[data-on="true"]:hover'))
    expect(after).toContain('#fff')
    expect(after).not.toContain('var(--fg)')
    expect(after).not.toContain('var(--on-accent)')
  })
})

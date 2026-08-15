/// <reference types="node" />
// Must use node:fs to read .css — `?raw` on .css always returns an empty string in vitest
// (see color-guard.test.ts).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'kvm.css'),
  'utf8',
)

// Class names allowed in this phase (P5). When P6 adds new blocks, add them here — do not sneak
// them in.
const ALLOWED = new Set([
  'kvm-page', 'kvm-content', 'kvm-sidebar-toggle', 'toggle-icon', 'collapsed',
  'kvm-sidebar', 'kvm-header', 'kvm-header-left', 'kvm-header-text', 'kvm-header-right',
  'kvm-logo', 'kvm-title', 'kvm-status', 'kvm-settings-btn',
  'vm-list', 'empty-state', 'empty-icon', 'empty-text',
  'vm-list-item', 'active', 'vm-item-icon', 'os-icon', 'vm-item-info', 'vm-item-name',
  'vm-item-specs', 'vm-item-status', 'status-indicator', 'status-dot', 'status-text',
  'running', 'stopped', 'paused', 'suspended', 'error',
  'add-vm-btn', 'kvm-main', 'main-empty', 'empty-icon-ring', 'main-empty-icon',
  'vm-console-container', 'console-header', 'console-title', 'console-os-icon', 'console-status',
  'console-actions', 'action-btn', 'dropdown-wrapper', 'overflow-dropdown', 'dropdown-item',
  'dropdown-icon', 'is-danger', 'confirm-text-danger', 'toggle-indicator', 'on', 'dropdown-divider',
  'console-display', 'console-placeholder', 'console-hint', 'is-error', 'start-vm-btn',
  'power-icon', 'power-svg',
  'sendkey-toolbar', 'sendkey-divider', 'sendkey-btn', 'sendkey-hint', 'sendkey-img',
  'fullscreen-svg',
  // Cleanup item 7 (cross-branch final review): sendkey-btn--fullscreen does not appear in
  // kvm.css — it is an actual class on SendKeyToolbar.vue (used to distinguish the fullscreen
  // button from other .sendkey-btn buttons for KvmPage.test.ts's `w.get('.sendkey-btn--fullscreen')`
  // to select precisely). Styling is entirely reused from the base class .sendkey-btn; it has no
  // dedicated CSS rules and is purely a test/selector hook. Keeping it in this allowlist does not
  // cause the test above ("no unregistered class names") to fail (that test only checks whether
  // class names appearing in kvm.css are in this Set, not the reverse). Leaving it does not affect
  // discriminative power, and the comment prevents it from being mistaken for a dead line.
  'sendkey-btn--fullscreen',
  'sendkey-slide-enter-active', 'sendkey-slide-leave-active',
  'sendkey-slide-enter-from', 'sendkey-slide-leave-to',
  'spice-info-bar', 'spice-info-content', 'spice-agent-hint', 'spice-info-close',
  'spice-toast-enter-active', 'spice-toast-leave-active',
  'spice-toast-enter-from', 'spice-toast-leave-to',
  'installation-banner', 'banner-content', 'banner-btn', 'is-loading', 'banner-error',
  'kvm-progress-overlay', 'kvm-progress-card', 'kvm-progress-title', 'kvm-progress-msg',
  'kvm-spinner',

  // P6 (create dialog / ISO selector / snapshots / VM settings / global settings) foundation phase
  // (Task 0) pre-registers class names. Style rules are filled into kvm.css gradually by subsequent
  // tasks (Task 1 onwards). Names are fixed; subsequent tasks may only use these.
  'kvm-dialog-overlay', 'kvm-dialog-content', 'create-vm-modal', 'create-vm-head',
  'create-vm-title', 'create-vm-close', 'create-vm-body', 'create-vm-foot',
  'cv-field', 'cv-label', 'cv-hint', 'cv-input-row', 'cv-input', 'cv-input-unit', 'cv-unit',
  'cv-iso-btn', 'cv-placeholder', 'cv-iso-eject', 'cv-cpu-group', 'cv-cpu-btn',
  'cv-select', 'cv-select-native', 'cv-select-arrow', 'cv-firmware-group', 'cv-firmware-btn',
  'cv-primary-btn', 'cv-error', 'cv-switch', 'cv-switch-track', 'cv-switch-knob',
  'settings-tabs', 'settings-tab',
  'snapshots-body', 'cv-empty-state', 'cv-snapshot-item', 'cv-snapshot-info',
  'cv-snapshot-name', 'cv-snapshot-desc', 'cv-snapshot-date', 'cv-snapshot-actions',
  'cv-btn', 'cv-btn-restore', 'cv-btn-delete',
  'os-selector-body', 'category-filter', 'category-btn', 'os-section', 'os-grid', 'os-card',
  'is-downloaded', 'is-downloading', 'os-icon-wrapper', 'os-info', 'os-name', 'os-version',
  'os-size', 'os-action-btn', 'is-download', 'is-selected', 'is-downloading-btn',
  'custom-section', 'custom-divider', 'custom-browse', 'custom-breadcrumb', 'custom-back-btn',
  'custom-path', 'custom-file-list', 'custom-loading', 'custom-empty', 'custom-file-item',
  'custom-file-icon', 'custom-file-info', 'custom-file-name', 'custom-file-size',
  'custom-file-arrow',
])

describe('kvm.css class name allowlist', () => {
  it('no unregistered class names', () => {
    const used = new Set([...src.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
    expect([...used].filter((c) => !ALLOWED.has(c)).sort()).toEqual([])
  })
})

describe('kvm.css contains no bare color literals (double-checks global color-guard)', () => {
  it('all colors use var(--kvm-*)', () => {
    // Strip comments before scanning to avoid misdetecting Vue2 color values copied in comments
    // (color-guard does not strip comments — this is a known gap; therefore, do not write #hex
    // in this file's comments).
    const noComment = src.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComment).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(noComment.replace(/var\([^)]*\)/g, '')).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})

// Review minor fix (appended to task-4): add-vm-btn / kvm-settings-btn are disabled placeholder
// buttons before P6 (Vue2 does not have this state; New-UI adds it). Previously the hover rule
// applied to the disabled state — the mouse would change the background to purple with purple
// text, the cursor still appeared as a pointer, making it look clickable. jsdom's computed style
// test is unreliable for "which rule wins" (this project has no ready-made CSS specificity
// calculator; confirmed by grep), so here we switch to a static assertion on the source text:
// reading the CSS rule text directly is more reliable than guessing cascade with jsdom. The
// approach copies the existing hover-guard + disabled-cursor convention from the settings
// section (class names are not written as literals in this file to avoid collision with the
// class name allowlist scanner above).
describe('disabled buttons do not mislead users with hover/cursor (add-vm-btn / kvm-settings-btn)', () => {
  it('hover rules must include :not(:disabled) and must not apply to disabled state', () => {
    // Counter-example: bare `.add-vm-btn:hover {` / `.kvm-settings-btn:hover {` (without
    // :not(:disabled)) are not allowed.
    expect(src).not.toMatch(/\.add-vm-btn:hover\s*\{/)
    expect(src).not.toMatch(/\.kvm-settings-btn:hover\s*\{/)
    expect(src).toMatch(/\.add-vm-btn:hover:not\(:disabled\)/)
    expect(src).toMatch(/\.kvm-settings-btn:hover:not\(:disabled\)/)
  })

  it('disabled state must explicitly have cursor: not-allowed (disabled buttons must not look clickable)', () => {
    const addDisabledBlock = src.match(/\.add-vm-btn:disabled\s*\{([^}]*)\}/)
    const settingsDisabledBlock = src.match(/\.kvm-settings-btn:disabled\s*\{([^}]*)\}/)
    expect(addDisabledBlock?.[1]).toMatch(/cursor:\s*not-allowed/)
    expect(settingsDisabledBlock?.[1]).toMatch(/cursor:\s*not-allowed/)
  })
})

// Cross-branch review fix (C2): `.cv-snapshot-date` is missing two declarations from Vue2 :3021-3022.
// When the mouse hovers over "Created: …" it shows the browser's default I-beam text cursor
// (Vue2 shows a normal arrow). jsdom's computed styles are unreliable (already noted in the
// comment at the top of kvmStyles.test.ts), so like the disabled cursor check above, we do regex
// assertions directly on the kvm.css source text rather than relying on jsdom's rendered computed
// style.
describe('kvm.css .cv-snapshot-date completes cursor/text-decoration (C2)', () => {
  it('cursor: default and text-decoration: none (per Vue2 :3021-3022)', () => {
    const block = src.match(/\.snapshots-body \.cv-snapshot-date\s*\{([^}]*)\}/)
    expect(block?.[1]).toMatch(/cursor:\s*default/)
    expect(block?.[1]).toMatch(/text-decoration:\s*none/)
  })
})

// ════════════════════════════════════════════════════════════════════
// Task 11 final fix: reverse check on the allowlist.
//
// The "no unregistered class names" test above is one-directional — it only checks whether
// class names appearing in kvm.css are registered in ALLOWED, but not the reverse (template
// uses a class, but kvm.css has no rule for it). Task 9 missed `.settings-tabs`/`.settings-tab`
// styling entirely because of this: the two tabs rendered as browser default buttons, and all
// three gates were green — the 17 unit tests assert on classList.contains('active'), not on
// computed styles (computed styles are unreliable under jsdom anyway), and the allowlist does
// not check the reverse, so nobody caught it.
//
// Here we add an automated reverse check and no longer rely on humans remembering to run that
// comm command from the brief:
// 1) Only collect **static** `class="..."` attributes in .vue templates (exclude `:class="..."`)
//    — dynamic `:class` bindings with object/array syntax (e.g., `{ active: x, 'is-loading': busy }`)
//    would match JS variable names / string literals too (like `busy`/`form.firmware`/`'uefi'`),
//    which are not class names, and simple regex cannot reliably separate them from real class
//    names. The two classes that Task 9 actually missed (settings-tabs/settings-tab) both happen
//    to be static class attributes, so checking static only is enough to catch this class of
//    regression. Strip `<!-- -->` HTML comments before scanning to avoid sample code in comments
//    (e.g., test-writing examples in VmSettingsDialog.vue's comments) being mistaken for actual
//    template usage.
// 2) After stripping comments from kvm.css, split by "selector {", and from each non-@-prefixed
//    selector collect all `.class` tokens (not just the first one at line start — compound/
//    descendant selectors like `.snapshots-body .cv-snapshot-item:hover` have `cv-snapshot-item`
//    not at line start but definitely has a rule managing it). This prevents misdetecting classes
//    that truly have styles but are not at the front of the selector as missing styles.
// 3) The difference = classes used statically but never appearing in any selector in kvm.css.
//    Currently the only one is `sendkey-btn--fullscreen` — purely a test/selector hook
//    (a second class appended on SendKeyToolbar.vue, added only so that KvmPage.test.ts's
//    `w.get('.sendkey-btn--fullscreen')` can select the fullscreen button precisely instead of
//    other .sendkey-btn, styling completely reused from base class .sendkey-btn, never had
//    dedicated rules; details in the comment next to it in ALLOWED above). Registered as the
//    sole exception. If new names appear in the difference in the future, it means styles truly
//    are missing and you cannot simply add to the exception list.
describe('kvm.css reverse check: template uses static class but kvm.css has no style rules for it', () => {
  // Purely a test/selector hook; rationale in the large comment above. Each new exception added
  // must have its reason clearly stated here.
  const NO_STYLE_EXPECTED = new Set([
    'sendkey-btn--fullscreen',
  ])

  function collectStaticUsedClasses(): Set<string> {
    const kvmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const vueFiles: string[] = []
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (e.name.endsWith('.vue')) vueFiles.push(full)
      }
    }
    walk(kvmDir)

    const used = new Set<string>()
    for (const f of vueFiles) {
      const raw = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
      // `(^|[^:])` excludes `:class="..."` (dynamic binding), only matches static `class="..."`.
      for (const m of raw.matchAll(/(^|[^:])\bclass="([^"]*)"/g)) {
        for (const cls of m[2].split(/\s+/).filter(Boolean)) used.add(cls)
      }
    }
    return used
  }

  function collectStyledClasses(): Set<string> {
    const noComment = src.replace(/\/\*[\s\S]*?\*\//g, '')
    const styled = new Set<string>()
    for (const m of noComment.matchAll(/([^{}]+)\{/g)) {
      const selector = m[1].trim()
      if (selector.startsWith('@')) continue // @media/@keyframes head, not a selector
      for (const c of selector.match(/\.[a-zA-Z][\w-]*/g) ?? []) styled.add(c.slice(1))
    }
    return styled
  }

  it('classes in static class attributes all have at least one rule in kvm.css (outside exceptions)', () => {
    const used = collectStaticUsedClasses()
    const styled = collectStyledClasses()
    const missing = [...used]
      .filter((c) => !styled.has(c) && !NO_STYLE_EXPECTED.has(c))
      .sort()
    expect(missing, `the following static classes have no rules in kvm.css (truly missing styles, not in exceptions):\n${missing.join(', ')}`).toEqual([])
  })

  it('the exceptions list itself should not have stale items (if styles are added later, remove from the list)', () => {
    const styled = collectStyledClasses()
    const staleExceptions = [...NO_STYLE_EXPECTED].filter((c) => styled.has(c))
    expect(staleExceptions, `the following exceptions already have styles and should be removed from NO_STYLE_EXPECTED:\n${staleExceptions.join(', ')}`).toEqual([])
  })
})

// 2026-08-03 device acceptance fix guard: canvas geometry must be controlled by noVNC itself, CSS
// must not take it. Taking it (Vue2's original width/height:100% !important) breaks noVNC's mouse
// coordinate calculations — detailed causal chain and probe data in the comment for the
// corresponding rule in kvm.css. This assertion only checks "are dimensions being taken back",
// not whether centering uses margin:auto or another approach.
describe('noVNC canvas geometry controlled by noVNC (prerequisite for scaleViewport to work)', () => {
  it('canvas rule must not have !important on width or height', () => {
    const canvasBlock = src.match(/\.console-display canvas\s*\{([^}]*)\}/)
    expect(canvasBlock).not.toBeNull()
    expect(canvasBlock![1]).not.toMatch(/width:[^;]*!important/)
    expect(canvasBlock![1]).not.toMatch(/height:[^;]*!important/)
  })

  it('canvas is still absolutely positioned, stacked above the placeholder layer (T6\'s existing requirement must not be lost in this fix)', () => {
    const canvasBlock = src.match(/\.console-display canvas\s*\{([^}]*)\}/)![1]
    expect(canvasBlock).toMatch(/position:\s*absolute/)
    expect(canvasBlock).toMatch(/z-index:\s*2/)
  })
})

describe('KVM fullscreen page toast does not occupy console display', () => {
  const toast = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../components/AppToast.vue'),
    'utf8',
  )

  it('AppToast\'s bottom uses an overridable variable, default value unchanged', () => {
    expect(toast).toContain('bottom: var(--toast-bottom, 118px)')
    expect(toast).toContain('z-index: 10100') // do not revert the "dialog cannot suppress toast" fix
  })

  it('override is on the root element, not on .kvm-page', () => {
    // Device testing (real chromium, not jsdom): `.toast-stack` is at the App.vue layer, is a
    // **sibling** of `.kvm-page` not a descendant, so putting --toast-bottom on .kvm-page
    // does not let the variable inherit — toast stays at the default 118px. Only
    // :root:has(.kvm-page) works. This assertion pins down this landing point: if someone
    // "conveniently simplifies" it to .kvm-page one day, it will fail instead of silently not
    // working.
    const override = src.match(/([^\n{}]*)\{[^}]*--toast-bottom:\s*\d+px/)
    expect(override, 'could not find override for --toast-bottom').not.toBeNull()
    expect(override![1]).toContain(':root')
    expect(override![1]).toContain(':has(')
  })
})

// SP16 Task 9: variant's own hover background must win over inherited base class hover background,
// otherwise pointer entry would replace the entire background while keeping variant text color —
// white background, white text. Base class `.x:hover` is specificity (0,2,0), single-class variant
// is only (0,1,0), and CSS specificity is won by the higher one **regardless of write order**.
// jsdom neither cascades nor enters hover state, so we must calculate specificity ourselves
// (reuse the pure function from src/styles/__tests__/).
//
// `.cv-btn-create` is not in the list: the whole repo only has one comment in kvm.css mentioning
// it (:2078), no CSS rules and no template references ⇒ dead class name. The ledger's list of 6
// included it, but actually it is 5.
import { winningHoverBackground, hoverBackgroundRules } from '../../styles/__tests__/cssCascade'

// ⚠️ Must strip comments first: cssCascade's parseCssRules treats all text before `{` as a selector,
// and kvm.css has large blocks of Chinese comments above almost every rule — without stripping,
// the comments get merged into the selector, all matches fail, and the guard "empty-returns for no
// rules found" spins uselessly (its own extractStyleBlock also strips comments first when reading
// SFC, but here we read .css via node:fs so we must do the same step ourselves).
const cssNoComments = src.replace(/\/\*[\s\S]*?\*\//g, '')

const BUTTONS: Array<{ classes: string[]; variant: string }> = [
  { classes: ['cv-btn', 'cv-btn-restore'], variant: 'cv-btn-restore' },
  { classes: ['cv-btn', 'cv-btn-delete'], variant: 'cv-btn-delete' },
  { classes: ['cv-primary-btn'], variant: 'cv-primary-btn' },
  // os-action-btn's hover is all written on `.os-action-btn.is-xxx:hover`, so variants must be
  // included to match (matcher requires each class in the selector to be in the classes array).
  { classes: ['os-action-btn', 'is-download'], variant: 'is-download' },
  { classes: ['os-action-btn', 'is-selected'], variant: 'is-selected' },
]

describe('KVM button hover background is not overridden by base class', () => {
  for (const b of BUTTONS) {
    it(`.${b.variant} hover background comes from the most specific rule`, () => {
      // When winningHoverBackground finds no hover background rule it throws — that should also
      // fail, not "no rule found = pass".
      const win = winningHoverBackground(cssNoComments, b.classes)
      // Winner must mention the variant's own class name — base class wins = variant's background
      // is completely replaced.
      expect(win.selector, `winner is ${win.selector} (specificity ${win.specificity})`).toContain(b.variant)
    })
  }

  // .category-btn's assessment is "not applicable", noted separately instead of added to the
  // table above: its hover rule (:1542 `.category-btn:hover:not(.active)`) **intentionally** only
  // changes color and border-color, has no background declaration at all — no background gets
  // replaced, so the "white background white text" failure mode does not occur. Assertion written
  // bidirectionally: the hover rule must exist (otherwise something else is broken and cannot
  // silently pass), and there must **not** be any hover background rule that matches it. If
  // someone adds a hover background to it (or its base class) one day, this will fail and force
  // re-evaluation whether it should be added to the risk table above.
  it('.category-btn not applicable to this check: hover intentionally only changes text and border, no background to replace', () => {
    expect(src).toMatch(/\.category-btn:hover:not\(\.active\)\s*\{/) // prevent empty match
    expect(hoverBackgroundRules(cssNoComments, ['category-btn'])).toEqual([])
  })
})

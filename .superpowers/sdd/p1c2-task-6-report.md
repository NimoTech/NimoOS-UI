# P1c2 Task 6 report — shared toast tiers (info/warning/danger)

Commit: `7b42204` — "SP8-P1c2: shared toast tiers (info/warning/danger) + composer severity"

## API shape / backward compatibility

`src/stores/toast.ts`:

```ts
export type ToastTier = 'info' | 'warning' | 'danger'
export interface ToastItem { id: number; text: string; tier: ToastTier }
function show(text: string, duration = 1500, tier: ToastTier = 'info') { ... }
```

`tier` is a new **optional 3rd parameter** defaulting to `'info'`. Every existing
`show(text)` and `show(text, ms)` call site in the repo (files/apps/home areas,
none of which were touched) keeps compiling and behaving identically: it now
gets `tier: 'info'` attached to its `ToastItem`, and `AppToast.vue` renders the
`info` tier with the exact same CSS as before this task (the base `.toast` rule
is untouched; the two new tier rules are additive `[data-tier="warning"]` /
`[data-tier="danger"]` selectors that only match when a tier is explicitly
passed). The `msg` computed (legacy newest-toast-text reader) is untouched.

Proven in `src/stores/toast.test.ts`:
- `show(text)` with no 3rd arg → `tier === 'info'`.
- `show(text, ms)` two-arg form → `tier === 'info'` **and** still clears at
  `ms`, not the old 1500ms default (guards against a regression that only
  fixed the tier default but broke duration threading).
- `show(text, ms, tier)` three-arg form tags each toast independently — two
  different tiers exist stacked in the array without interfering with each
  other's timers.

`AppToast.vue` renders `:data-tier="t.tier"` unconditionally (so `info` toasts
carry `data-tier="info"` too, not omitted) — kept simple and symmetric;
verified in `AppToast.test.ts` (`data-tier` per pill, three different tiers
stacking together via `<transition-group>` unaffected).

## Tokens added (`src/styles/theme.css`)

Added next to the existing `--toast-bg` in both theme blocks, so all
toast-related tokens live together:

| Token | `:root` (blue/dark glass, default) | `:root[data-theme="light"]` (paper) |
|---|---|---|
| `--toast-warn-bg` | `rgba(240, 200, 120, 0.22)` | `#fbefd9` |
| `--toast-warn-fg` | `#f0c878` | `#92600c` |
| `--toast-danger-bg` | `rgba(255, 80, 100, 0.22)` | `#fbe4e4` |
| `--toast-danger-fg` | `#ff8a8a` | `#c0392b` |

Why these values (not arbitrary): this file already has an established
"tinted translucent bg + saturated fg of the same hue" recipe used for other
semantic surfaces — `--dem-bg`/`--dem-fg` (amber "demoted" semantic, dark:
`rgba(240,200,120,0.14)` / `#f0c878`, light: `#fbefd9` / `#92600c`) and
`--remove-fg`/`--drop-bad` (red "danger/remove" semantic, dark: `#ff8a8a` /
`rgba(255,80,100,0.12)`, light: `#c0392b` / `rgba(224,70,106,0.12)`). The new
`--toast-warn-*` pair reuses the amber fg exactly and a slightly stronger bg
alpha (0.22 vs 0.14) because the toast pill sits on a heavier blur/backdrop
than those other surfaces and needed more tint to read; `--toast-danger-*`
reuses the red fg exactly for the same reason. Light-theme values mirror
`--dem-bg`/`--dem-fg` and `--remove-fg` directly (opaque pale tints, matching
this theme's "paper, no translucency" convention — `--blur: none` there).
This was checked against `src/ai/styles/tokens.scss`'s `--warning`/`--danger`
(the `.agent-app`-scoped tokens) only for hue coherence — AppToast.vue is
outside that scope per the brief and cannot reference those tokens directly,
so dedicated global tokens were required either way.

`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/components/AppToast.vue` → no
output (colors only via the new tokens, everywhere else via existing ones).

## AgentComposer.vue call sites re-tiered

Re-read the file immediately before editing (per brief warning about a
concurrent editor) — content matched what had been reviewed. All 8
`toast.show(...)` call sites in the file, final tiering:

| Line | Case | Tier |
|---|---|---|
| 529 | `toastError()` — auth/authorization failed (shared by removeChip/pickItem/gitignore-confirm catch paths) | `danger` |
| 870 | lazy `createSession()` failure in `onFilesPicked` | `danger` |
| 879 | attachment over 500MB | `danger` |
| 923 | document extraction failed (7000ms) | `warning` |
| 939 | binary + `not_installed` + doc extension (7000ms) | `warning` |
| 945 | attachment upload failed | `danger` |
| 1014 | `notSupported()` ("feature not supported yet") | unchanged — no tier arg, defaults to `info` |
| 1024 | `onBrowseClick()` (Browse placeholder) | unchanged — no tier arg, defaults to `info` |

Note the brief's prose says "AgentComposer 的 7 处" but the file actually has
8 `toast.show()` call sites; the two `info`-tier ones (`notSupported`,
`onBrowseClick`) needed zero code change since `info` is the show() default,
so it's plausible the brief counted those two as one "case" or slightly
undercounted — behavior matches the brief's intent regardless (both stay
`info`, only the 6 danger/warning sites needed edits).

Added doc-comments at each of the 6 edited call sites (and at the two
unchanged `info` sites) citing this task, consistent with this file's
existing heavy rationale-commenting convention.

## Tests

- `src/stores/toast.test.ts`: 3 new tests (backward-compat 2-arg, 3-arg
  tiering, mixed stacking) — 5/5 pass.
- `src/components/AppToast.test.ts`: 3 new tests (`data-tier="info"` default,
  warning/danger render their own `data-tier`, three different tiers stack
  together) — 6/6 pass.
- `src/ai/components/shell/AgentComposer.test.ts`: extended 5 existing tests
  with `.tier` assertions (auth-failed, too-large, upload-failed, doc-extract
  warning ×2) and added 1 new test (lazy-session-create failure → danger,
  no upload attempted) — 56/56 pass.

## Full suite / tsc / grep gate (all green)

```
pnpm test  →  Test Files  245 passed (245) | Tests  1708 passed (1708)
pnpm exec vue-tsc --noEmit  →  (no output, 0 errors)
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/components/AppToast.vue  →  (no output)
```

## Noticed but left alone

- The brief's "7 处" count vs. the actual 8 call sites in the file (see
  above) — not a bug, just a documentation-vs-code count mismatch; recorded
  here for whoever reads the brief next.
- `docErrorLabel`/`docErrorShort` and the rest of the attachment pipeline
  were not touched — only the `toast.show(...)` call sites got a 3rd
  argument.
- Did not add `--toast-fg` (referenced as a fallback in the existing base
  `.toast` rule: `color: var(--toast-fg, var(--fg))`) — it was already an
  unset fallback-only reference before this task and is out of scope; left
  as-is.

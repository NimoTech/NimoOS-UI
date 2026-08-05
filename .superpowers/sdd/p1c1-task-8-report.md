# Task 8 report — SlashMenu (`/init`)

## Ported from

Vue2 `NimoOS-UI/src/views/AI/Agent/shell/SlashMenu.vue`, all 70 lines:
- Template 1-23 → `src/ai/components/shell/SlashMenu.vue` template, DOM/classes 1:1
  (`.slash-menu`, `.slash-card`, `.slash-row`, `.slash-name`, `.slash-desc`,
  `.slash-init`, `.slash-status`, `.slash-init-row`, `.slash-init-actions`, `.primary`).
- Script 25-43 → `<script setup lang="ts">`: `props.folders` (typed
  `SlashFolder[]`, default `[]`), `picking`/`initTarget` as `ref`, `onPickInit`
  (line 33-36, including the single-folder auto-select on line 35 — folded this
  auto-select into the port; my first draft dropped it and test 1 caught it
  immediately, fixed before final run) and `confirmInit` (37-40) logic copied
  verbatim. Emits typed via `defineEmits<{ init: [target: string]; close: [] }>()`.
- Style 45-70 → scoped style, 1:1 except the three token substitutions below.
- `@click.self="$emit('close')"` (line 2) kept as-is.
- `/init` literal (line 5) kept untranslated.
- `pointer-events: auto` (line 51, ancestor `.composer-wrap` is `none`) kept.

## Token substitutions

Checked `src/ai/styles/tokens.scss` before substituting:
- Overlay scrim `rgba(0,0,0,0.3)` → `var(--modal-scrim)` (token value is
  `rgba(0,0,0,0.5)` — different alpha, but same "dark modal scrim" semantic
  family already used by SearchFileDrawer/SearchFullResults; brief explicitly
  named this token, reused rather than adding a new one).
- Card shadow `0 16px 48px rgba(0,0,0,0.18)` → `var(--shadow-pop)`.
- `.primary { color: white }` → `var(--text-on-accent)`.

Radii — checked actual values first, substituted only where identical:
- Card `border-radius: 14px` → `var(--r-md)` (token = `14px`, exact match).
- `.slash-init-actions button { border-radius: 6px }` → `var(--r-xs)` (token =
  `6px`, exact match).
- `.slash-row { border-radius: 8px }` — **left as literal `8px`**. Neither
  `--r-xs` (6px) nor `--r-sm` (10px) matches; per "visual 1:1 wins", kept the
  Vue2 pixel value rather than approximating, and left a comment in the file
  explaining why (radii are not colors, not covered by the token-literal grep
  rule).

## Color-literal grep

```
grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/SlashMenu.vue
```
No output (exit 1). Note: the file's header comment initially described the
substitutions using literal `rgba(...)` text, which the grep also caught —
reworded the comment to describe alpha values in prose instead, since the rule
targets actual CSS declarations, not doc comments quoting old values, but
cleaner to just avoid the pattern in comments too.

## i18n keys added

Added to both `src/i18n/zh_cn.ts` and `src/i18n/en_us.ts` (flat top-level,
appended after the existing "SP8-P1c1 Task 7 — MentionPopover" section, own
"Task 8 — SlashMenu" comment):
- `aiSlashInitDesc`: zh `为某个目录生成 agent.md` / en `Generate agent.md for a directory`
- `aiSlashNoFolders`: zh `还没有可见目录 —— 先用 @ 选一个` / en `No visible directories — use @ to select one first`
- `aiSlashInitialize`: zh `初始化` / en `Initialize`
- Cancel button reuses existing `aiCancel` (`取消` / `Cancel`) — verified present
  at `zh_cn.ts:566` / `en_us.ts:567` before reusing, reads correctly in context.

## Tests

Wrote the brief's 4 tests verbatim first (Step 1), ran and confirmed failure
(component didn't exist):
```
pnpm test -- src/ai/components/shell/SlashMenu.test.ts
→ FAIL: Failed to resolve import "./SlashMenu.vue" ... Does the file exist?
```

After implementation:
```
pnpm test -- src/ai/components/shell/SlashMenu.test.ts src/i18n/parity.test.ts
→ Test Files  2 passed (2)
→ Tests  7 passed (7)
```

Type check:
```
pnpm exec vue-tsc --noEmit
→ (no output, clean)
```

## Noticed but left alone

- **Missing Escape-to-close and no keyboard navigation.** Vue2's SlashMenu has
  neither. Per the brief and the user's 2026-07-27 port-discipline decision,
  this is a UX gap, not a defect — did not add an Escape handler. Logged here
  for the ledger; a later task (composer, or a keyboard-consistency pass) may
  address it.
- Nothing else deviated — no other bugs found in the Vue2 source; logic ported
  mechanically (data() → ref, methods → functions, $emit → typed defineEmits).

## Files touched

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/shell/SlashMenu.vue` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/shell/SlashMenu.test.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/zh_cn.ts` (modified)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/en_us.ts` (modified)

Commit: `22d1dff447c3c7464dcc5f16d2d233c38d1198d4` — "SP8-P1c1: SlashMenu (/init) 1:1 port"

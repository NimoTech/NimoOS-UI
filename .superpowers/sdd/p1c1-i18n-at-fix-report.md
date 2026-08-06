# SP8-P1c1: i18n @ Escape Fix Report

## Problem Summary
Two i18n message keys contained bare `@` characters that triggered vue-i18n 9's linked-message syntax parser, causing compilation errors: `Invalid linked format` / `Unexpected lexical analysis in token`. This broke the Agent composer's textarea placeholder and the slash menu's empty-state hint.

## Affected Keys
- `aiComposerPlaceholder` (zh_cn, en_us)
- `aiSlashNoFolders` (zh_cn, en_us)

## Before (Broken)
Original bare `@` strings:
```
zh_cn:  '问 Nimo，或输入 @ 引用文件…'
zh_cn:  '还没有可见目录 —— 先用 @ 选一个'
en_us:  'Ask Nimo, or type @ to reference a file…'
en_us:  'No visible directories — use @ to select one first'
```

These emit vue-i18n parser errors (visible breakage in rendered UI).

## Fix 1: Escape Syntax Applied
Replaced bare `@` with vue-i18n's literal-interpolation escape `{'@'}`:
```
zh_cn:  "问 Nimo，或输入 {'@'} 引用文件…"
zh_cn:  "还没有可见目录 —— 先用 {'@'} 选一个"
en_us:  "Ask Nimo, or type {'@'} to reference a file…"
en_us:  "No visible directories — use {'@'} to select one first"
```

**Note:** Strings were changed from single quotes to double quotes in TypeScript source (required for JavaScript syntax validity when inner single quotes appear in `{'@'}`).

After fix, messages render correctly:
- zh_cn aiComposerPlaceholder → `问 Nimo，或输入 @ 引用文件…` ✓
- zh_cn aiSlashNoFolders → `还没有可见目录 —— 先用 @ 选一个` ✓
- en_us aiComposerPlaceholder → `Ask Nimo, or type @ to reference a file…` ✓
- en_us aiSlashNoFolders → `No visible directories — use @ to select one first` ✓

**Compiler result:** 0 errors, no `vue-tsc --noEmit` violations.

## Fix 2: Regression Test
Created `src/i18n/messageSyntax.test.ts` with:

### Test Suite 1: Key Rendering Validation
- Asserts both keys render with literal `@` in both locales
- Confirms exact match with expected human-readable output
- Each of 4 keys (2 keys × 2 locales) has individual test case

### Test Suite 2: Bare @ Guard
Walks every key in both locale files and fails if:
1. A string contains `@` NOT wrapped in `{'@'}` escape, AND
2. The `@` is NOT part of `@:key.path` linked-message syntax

Guard implementation:
```typescript
// Remove valid patterns: {'@'}, {'anything'}, @:key.path
testValue = testValue.replace(/\{'[^']*'\}/g, '')  // vue-i18n escapes
testValue = testValue.replace(/@:[a-zA-Z0-9_.]+/g, '')  // linked refs
// Any remaining @ is a violation
if (testValue.includes('@')) { violations.push(...) }
```

## Guard Proof (Catches Violations)
Test temporarily reverted `先用 @ 选一个` (removed escape):
```
✓ Guard correctly detected bare @ violation
AssertionError: Found bare @ in messages (must use {'@'} for literal @ or @:key for linked messages):
zh_cn::aiSlashNoFolders = "还没有可见目录 —— 先用 @ 选一个"
```

After restoring escape → all tests pass again. ✓

## Verification Results

### 1. Message Syntax Tests (New)
```
✓ src/i18n/messageSyntax.test.ts > i18n message syntax > 
  aiComposerPlaceholder and aiSlashNoFolders keys > 
  should resolve correctly in zh_cn and contain literal @ 
✓ should resolve correctly in en_us aiComposerPlaceholder and contain literal @
✓ should resolve correctly in en_us aiSlashNoFolders and contain literal @
✓ should resolve correctly in zh_cn aiSlashNoFolders and contain literal @
✓ bare @ guard (unescaped @ detection) > 
  should not allow bare @ in any key (only {@} escapes or @:key references)

Test Files  1 passed (1)
Tests  5 passed (5)
```

### 2. Parity Tests (Existing, Still Green)
```
✓ src/i18n/parity.test.ts > en_us 与 zh_cn 顶层 key 集合完全一致
✓ en_us 值均为非空字符串
✓ 抽查若干英文文案

Test Files  1 passed (1)
Tests  3 passed (3)
```

### 3. TypeScript Compilation
```
$ pnpm exec vue-tsc --noEmit
(no output = 0 errors)
```

### 4. Component Tests (AgentComposer, SlashMenu)
```
✓ src/ai/components/shell/AgentComposer.test.ts (12 tests)
✓ src/ai/components/shell/SlashMenu.test.ts (17 tests)

Test Files  2 passed (2)
Tests  29 passed (29)
```

## Files Changed
1. `src/i18n/zh_cn.ts` — lines 690, 695 (2 keys)
2. `src/i18n/en_us.ts` — lines 693, 698 (2 keys)
3. `src/i18n/messageSyntax.test.ts` — **new file** (guard + regression)

## Command Summary
```bash
# Run both new guard and parity tests
pnpm test -- src/i18n/messageSyntax.test.ts src/i18n/parity.test.ts

# TypeScript check
pnpm exec vue-tsc --noEmit

# Component tests
pnpm test -- src/ai/components/shell/AgentComposer.test.ts \
              src/ai/components/shell/SlashMenu.test.ts
```

All tests pass. No breaking changes to existing tests.

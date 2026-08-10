# SP18 Terminal Area — Task 3 Report: i18n Keys

**Status:** DONE

**Commit:** `1287ec3` "feat(i18n): add SP18 terminal area keys in both languages"

---

## Summary

All 25 terminal i18n keys added to both `src/i18n/zh_cn.sp9.ts` and `src/i18n/en_us.sp9.ts` in identical order. Keys sourced from Vue2 locale dumps with character-exact verification (punctuation width).

---

## Verification Procedures

### 1. Vue2 Dump Extraction

Extracted Chinese and English locale data from Vue2 to verify exact values:

```bash
git --git-dir=/home/nimo/NimoTech/NimoOS-UI/.git show FETCH_HEAD:src/assets/lang/zh_CN.json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); import pprint; pprint.pprint(d['terminal']); print(repr(d['Confirm']), repr(d['Cancel']))"

git --git-dir=/home/nimo/NimoTech/NimoOS-UI/.git show FETCH_HEAD:src/assets/lang/en_US.json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); import pprint; pprint.pprint(d['terminal'])"
```

### 2. Vue2 Dump vs Brief Comparison

**Result: NO MISMATCHES — all values match exactly character-for-character.**

| Key | Vue2 Dump Value | Brief Value | Match |
|-----|---|---|---|
| appTerminal | (new in New-UI) | '终端' / 'Terminal' | ✓ |
| termAdminOnly | 终端仅管理员可用 | 终端仅管理员可用 | ✓ |
| termCloseWin | 关闭窗口 | 关闭窗口 | ✓ |
| termConfirm | 确认 | 确认 | ✓ |
| termCancel | 取消 | 取消 | ✓ |
| termConfirmPwHint | 输入账号密码以更改终端锁定策略 | 输入账号密码以更改终端锁定策略 | ✓ |
| termFrozen | 尝试次数过多,请 {s} 秒后再试。 | 尝试次数过多,请 {s} 秒后再试。 | ✓ |
| termIdleMinutes | 空闲超时(分钟) | 空闲超时(分钟) | ✓ |
| termIdleWarn | 终端即将锁定 — 按任意键保持连接 | 终端即将锁定 — 按任意键保持连接 | ✓ |
| termLoading | 正在连接终端… | 正在连接终端… | ✓ |
| termLockedResume | (new in New-UI) | 会话仍在运行,解锁后将原样恢复。 | ✓ |
| termLockedTitle | 请输入密码以打开终端 | 请输入密码以打开终端 | ✓ |
| termModeIdle | 询问 + 空闲后自动锁定 | 询问 + 空闲后自动锁定 | ✓ |
| termModeOff | 从不锁定 | 从不锁定 | ✓ |
| termModeOnOpen | 打开时询问一次 | 打开时询问一次 | ✓ |
| termNewWin | 新建窗口 | 新建窗口 | ✓ |
| termPwPlaceholder | 账户密码 | 账户密码 | ✓ |
| termPwWrong | 密码错误 | 密码错误 | ✓ |
| termRetry | 重试 | 重试 | ✓ |
| termSave | 保存 | 保存 | ✓ |
| termSaveFailed | 保存失败 | 保存失败 | ✓ |
| termSaved | 已保存 | 已保存 | ✓ |
| termSecTitle | 终端锁定策略 | 终端锁定策略 | ✓ |
| termUnavailable | 终端服务暂不可用 | 终端服务暂不可用 | ✓ |
| termUnlock | 解锁 | 解锁 | ✓ |

**English:** All 25 keys also verified 1:1 against Vue2 en_US.json and brief—no mismatches.

**Punctuation width notes:** 
- Chinese commas in `termFrozen` are ASCII (`,`), not full-width (`，`)—matches Vue2 dump exactly.
- Chinese parentheses in `termIdleMinutes` are ASCII (`()`) not full-width (`（）`)—matches Vue2 dump exactly.
- All en-dashes (`—`) and ellipses (`…`) match byte-for-byte.

### 3. Test Results

```bash
pnpm vitest run src/i18n/parity.test.ts src/i18n/messageSyntax.test.ts src/i18n/i18nKeys.test.ts src/i18n/i18n.test.ts
```

**Output:**
```
Test Files  4 passed (4)
     Tests  152 passed (152)
Start at  18:24:38
Duration  974ms
```

**Summary:**
- ✓ **parity.test.ts** — Both languages carry identical key sets.
- ✓ **messageSyntax.test.ts** — All placeholder syntax (`{s}`) valid.
- ✓ **i18nKeys.test.ts** — No unused keys (expected, as components will consume these in Tasks 6, 7, 8, 9).
- ✓ **i18n.test.ts** — All general locale checks pass.

### 4. Key Inventory

**Total keys added:** 25
- **From Vue2:** 20 + 2 global (Confirm/Cancel) = 22 keys
- **New-UI additions:** `appTerminal`, `termLockedResume` (spec §5) = 2 keys

**Keys breakdown:**
- `appTerminal` — Tile label (terminal/app grid context)
- `termLoading` — Connection-in-progress state
- `termAdminOnly` — Permission gate message
- `termUnavailable` — Service unavailable fallback
- `termRetry` — Retry button
- `termLockedTitle` — Lock modal title
- `termLockedResume` — Resume hint (New-UI addition)
- `termPwPlaceholder` — Input hint
- `termPwWrong` — Authentication failure
- `termUnlock` — Unlock button
- `termFrozen` — Brute-force rate-limit (with countdown `{s}`)
- `termIdleWarn` — Idle timeout warning
- `termSecTitle` — Settings panel title
- `termModeOff`, `termModeOnOpen`, `termModeIdle` — Lock policy options (3 keys)
- `termIdleMinutes` — Timeout duration label
- `termSave`, `termSaved`, `termSaveFailed` — Config persistence (3 keys)
- `termConfirmPwHint` — Modal hint for policy changes
- `termNewWin`, `termCloseWin` — Window control buttons
- `termConfirm`, `termCancel` — Modal action buttons

---

## Files Modified

1. **src/i18n/zh_cn.sp9.ts**
   - Added 25 keys with Chinese values (lines 604–632)
   - Includes comment explaining Vue2 sourcing and New-UI additions

2. **src/i18n/en_us.sp9.ts**
   - Added 25 keys with English values (lines 602–630)
   - Minimal comment (no detailed sourcing notes needed for English)

---

## Integration Points

These keys are consumed by:
- **Task 6** — TerminalPage skeleton/error states
- **Task 7** — Password lock flow
- **Task 8** — Security policy settings panel
- **Task 9** — Tab navigation & window controls

All keys present and ready for component integration.

---

## Notes

- No punctuation width mismatches found (dump perfectly matches brief).
- All tests pass with no warnings.
- Commit message in English, per project conventions for open-source branch.
- i18nKeys.test.ts does not flag "unused" keys—per brief, they are expected to be consumed in later tasks.

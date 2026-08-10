### Task 3: i18n keys (both languages)

**Files:**
- Modify: `src/i18n/zh_cn.sp9.ts` (append before the closing brace)
- Modify: `src/i18n/en_us.sp9.ts` (same keys, same order)

**Interfaces:**
- Produces: the 25 keys below, consumed by Tasks 6, 7, 8, 9. `appTerminal` is also the tile label key.

**Copy source of truth:** Chinese values are verbatim from Vue2. Before writing, dump them and copy character-for-character (punctuation width matters):

```bash
git --git-dir=/home/nimo/NimoTech/NimoOS-UI/.git show FETCH_HEAD:src/assets/lang/zh_CN.json | python3 -c "import json,sys; d=json.load(sys.stdin); import pprint; pprint.pprint(d['terminal']); print(repr(d['Confirm']), repr(d['Cancel']))"
git --git-dir=/home/nimo/NimoTech/NimoOS-UI/.git show FETCH_HEAD:src/assets/lang/en_US.json | python3 -c "import json,sys; d=json.load(sys.stdin); import pprint; pprint.pprint(d['terminal'])"
```

- [ ] **Step 1: Append the zh keys**

In `src/i18n/zh_cn.sp9.ts`, before the closing `}`, append (values below are from the dump above — verify against your own dump output, the dump wins on any mismatch):

```ts
  // -- SP18 terminal area (Vue2 terminal.* copied verbatim; termLockedResume and
  //    termConfirm/termCancel are New-UI additions registered in spec §5) --
  appTerminal: '终端',
  termLoading: '正在连接终端…',
  termAdminOnly: '终端仅管理员可用',
  termUnavailable: '终端服务暂不可用',
  termRetry: '重试',
  termLockedTitle: '请输入密码以打开终端',
  termLockedResume: '会话仍在运行,解锁后将原样恢复。',
  termPwPlaceholder: '账户密码',
  termPwWrong: '密码错误',
  termUnlock: '解锁',
  termFrozen: '尝试次数过多,请 {s} 秒后再试。',
  termIdleWarn: '终端即将锁定 — 按任意键保持连接',
  termSecTitle: '终端锁定策略',
  termModeOff: '从不锁定',
  termModeOnOpen: '打开时询问一次',
  termModeIdle: '询问 + 空闲后自动锁定',
  termIdleMinutes: '空闲超时(分钟)',
  termSave: '保存',
  termSaved: '已保存',
  termConfirmPwHint: '输入账号密码以更改终端锁定策略',
  termSaveFailed: '保存失败',
  termNewWin: '新建窗口',
  termCloseWin: '关闭窗口',
  termConfirm: '确认',
  termCancel: '取消',
```

- [ ] **Step 2: Append the en keys**

In `src/i18n/en_us.sp9.ts`, same position, same order:

```ts
  // -- SP18 terminal area --
  appTerminal: 'Terminal',
  termLoading: 'Connecting to terminal…',
  termAdminOnly: 'Terminal is available to admins only',
  termUnavailable: 'Terminal service is unavailable',
  termRetry: 'Retry',
  termLockedTitle: 'Enter password to open the terminal',
  termLockedResume: 'Your session is still running and will resume right where you left it.',
  termPwPlaceholder: 'Account password',
  termPwWrong: 'Incorrect password',
  termUnlock: 'Unlock',
  termFrozen: 'Too many attempts. Try again in {s}s.',
  termIdleWarn: 'Terminal will lock soon — press any key to stay',
  termSecTitle: 'Terminal Lock Policy',
  termModeOff: 'Never lock',
  termModeOnOpen: 'Ask once when opening',
  termModeIdle: 'Ask + auto-lock when idle',
  termIdleMinutes: 'Idle timeout (minutes)',
  termSave: 'Save',
  termSaved: 'Saved',
  termConfirmPwHint: 'Enter your account password to change the terminal lock policy',
  termSaveFailed: 'Failed to save',
  termNewWin: 'New window',
  termCloseWin: 'Close window',
  termConfirm: 'Confirm',
  termCancel: 'Cancel',
```

- [ ] **Step 3: Run the i18n gates**

Run: `pnpm vitest run src/i18n/parity.test.ts src/i18n/messageSyntax.test.ts src/i18n/i18nKeys.test.ts src/i18n/i18n.test.ts`
Expected: ALL PASS (parity proves both languages carry identical key sets; if `i18nKeys.test.ts` asserts key usage, it may only go red later when components consume the keys — if it fails HERE for "unused keys", read that test's own header comment for the intended workflow before changing anything).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -m "feat(i18n): add SP18 terminal area keys in both languages"
```

---


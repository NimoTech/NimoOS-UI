# Task 2 Report: Terminal Service Client

## Status
**DONE**

## Summary
Implemented the terminal domain client for the shared service package following TDD. All 5 tests pass, type-checking passes, and implementation matches the brief exactly.

## Work Completed

### Test Implementation (`packages/service/src/terminal.test.ts`)
- Created 5 test cases capturing all interface contracts
- Tests verify:
  1. `createSession()` without password allows default 401 refresh-replay
  2. `createSession(password)` opts out of 401 refresh-replay with `_noAuthRetry: true`
  3. `putSettings()` carries password and opts out of 401 refresh-replay
  4. `getSettings()` and `listWindows()` return bare payloads untouched
  5. Window mutations hit correct routes with correct request bodies

### Implementation (`packages/service/src/terminal.ts`)
- Exported types: `TerminalMode`, `TerminalSessionInfo`, `TerminalSettings`, `TerminalWindow`
- Implemented `createTerminal(http)` factory returning object with methods:
  - `createSession(password?: string): Promise<TerminalSessionInfo>`
  - `deleteSession(): Promise<void>`
  - `keepalive(): Promise<void>`
  - `getSettings(): Promise<TerminalSettings>`
  - `putSettings(body): Promise<void>`
  - `listWindows(): Promise<TerminalWindow[]>`
  - `newWindow(): Promise<void>`
  - `selectWindow(i): Promise<void>`
  - `closeWindow(i): Promise<void>`
  - `renameWindow(i, name): Promise<void>`
- All password-carrying requests use `NO_AUTH_RETRY` constant to skip 401 refresh-replay
- Bare JSON (no Result envelope unwrap)

### Index Updates (`packages/service/src/index.ts`)
- Added import: `import { createTerminal } from './terminal.js'` (line 25, next to kvm)
- Added type re-exports: `TerminalMode, TerminalSessionInfo, TerminalSettings, TerminalWindow` (line 42, next to kvm types)
- Added service getter (lines 111-113):
  ```ts
  get terminal(): ReturnType<typeof createTerminal> {
    return createTerminal(getHttp() as AxiosInstance)
  },
  ```

## Test Results
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  18:20:05
   Duration  653ms
```

## Type-Check Result
`pnpm exec vue-tsc --noEmit` — **clean, no errors**

## Deviations
None. Implementation matches brief exactly.

## Commit
- Hash: `cf45af2`
- Message: `feat(service): add terminal domain client (bare JSON, password calls skip 401 replay)`
- Files: 3 changed, 119 insertions (+)
  - `packages/service/src/terminal.ts` (created, 50 lines)
  - `packages/service/src/terminal.test.ts` (created, 68 lines)
  - `packages/service/src/index.ts` (modified, 1 import + 1 type re-export + 1 service getter added)

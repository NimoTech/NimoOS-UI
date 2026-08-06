# P1c2 Task 1 Report — `disks.list()` (NimoOS-Service)

## Method as written

`src/disks.ts`, appended inside the existing `createDisks` factory, immediately after `umountUsb` (no reordering, no reformatting of surrounding code):

```ts
async list(): Promise<unknown> {
  const res = await http.get('/disks')
  const d = res.data
  return Array.isArray(d) ? d : unwrap<unknown>(d)
},
```

Added one import at the top: `import { unwrap } from './unwrap.js'` (mirrors `storage.ts`'s import exactly).

## Why the unwrap idiom matches the sibling domain

`src/storage.ts:6-10` (`createStorage.list`) does:

```ts
async list(params?: Record<string, unknown>): Promise<unknown> {
  const res = await http.get('/storage', { params })
  const d = res.data
  return Array.isArray(d) ? d : unwrap<unknown>(d)
},
```

Same shape-tolerant unwrap: if the backend body is already a bare array (some NimoOS endpoints return raw arrays instead of the standard `Result{Success,Message,Data}` envelope), pass it through untouched; otherwise treat it as a standard envelope and run it through `unwrap<unknown>()`, which throws if `success !== 200` and otherwise returns `.data`. `disks.list()` copies this verbatim (minus the `params` passthrough, since the brief's contract is a bare `list(): Promise<unknown>` with no params argument, and `GET /disks` per the brief takes none). This keeps the two "body-level" domains (`storage`, `disks`) consistent with each other and distinct from the `ai` domain, which deliberately returns `res.data` raw (envelope included, never unwrapped) per `ai.test.ts`'s explicit "信封原样,不 unwrap" tests.

## Test commands and output tails

TDD sequence — `disks.test.ts` already existed (with the `umountUsb` test), so I added two new `it` blocks rather than creating the file fresh.

1. Failing test first:
```
$ pnpm test -- src/disks.test.ts
 FAIL  src/disks.test.ts > createDisks > list 发 GET /disks,数组体原样返回
TypeError: createDisks(...).list is not a function
 FAIL  src/disks.test.ts > createDisks > list 发 GET /disks,信封体走 unwrap
TypeError: createDisks(...).list is not a function
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

2. After implementing, scoped test:
```
$ pnpm test -- src/disks.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

3. Full package suite:
```
$ pnpm test
 Test Files  24 passed (24)
      Tests  194 passed (194)
   Duration  879ms
```

4. Build (this package has no separate typecheck script — `package.json`'s `build` script *is* `tsc -p tsconfig.json`, which doubles as the typecheck; no `tsc --noEmit` script exists separately):
```
$ pnpm build
> tsc -p tsconfig.json
(no output, no errors, exit 0)
```

Test coverage added: (a) `GET /disks` URL/verb asserted via `umountUsb`'s existing sibling test plus new `url` capture in the `list` tests; (b) array body passes through untouched (`Array.isArray` branch); (c) enveloped `{success:200, data:[...]}` body goes through `unwrap` and returns just `.data`.

## Left alone / noticed but out of scope

- Did not touch `src/index.ts` — `disks` domain was already exported per the brief; confirmed by successful `pnpm build` (no missing-export errors) and did not need to inspect further since instructions explicitly said not to touch it.
- Did not add a `params` argument to `list()` even though `storage.list()` takes one — the brief's contract is `list(): Promise<unknown>` with no params, and the Vue2 original's `GET /disks` call (per the task brief) takes none. Kept strictly to the specified contract.
- Did not run anything in the consumer app (`NimoOS-New-UI`) per explicit instruction — no `pnpm install`/`pnpm test -- src/ai` there. That refresh is left to the controller.
- No error/edge-case test for the `unwrap` throw path (e.g. `success !== 200`) was added since it's already covered generically by `unwrap.test.ts`; kept `disks.test.ts` scoped to what the brief asked (URL/verb, array passthrough, envelope unwrap).

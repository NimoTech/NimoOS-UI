### Task 1: Tighten `getFolderSize` in the service package (typed + long timeout)

**Files:**
- Modify: `packages/service/src/folder.ts:19-22`
- Test: `packages/service/src/folder.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `service.folder.getFolderSize(path: string): Promise<number>` — returns total size in bytes; request carries `timeout: 300000`. Task 2 calls exactly this.

**Background:** The backend (`NimoOS/route/v1/file.go` `GetSize`) walks the whole subtree on every call and returns the standard envelope `{success: 200, message: "ok", data: <int64 bytes>}`. The axios default timeout is 60s (`packages/service/src/http.ts:50`), which would cut off large-tree walks — hence the per-request 5-minute budget.

- [ ] **Step 1: Update the test.** In `packages/service/src/folder.test.ts`, the existing combined test at lines 35-42 mocks the size response as `data: { size: 1 }`, which is NOT the real envelope shape. Replace that test with these two (keep the rest of the file untouched):

```ts
  it('getFolderSize hits /folder/size with path, a 5-minute timeout, and returns the byte count', async () => {
    let url = ''
    let cfg: { params?: unknown; timeout?: number } | undefined
    // Real device envelope: data is the raw int64 byte count, not an object.
    const http = {
      get: async (u: string, c?: { params?: unknown; timeout?: number }) => {
        url = u; cfg = c
        return { data: { success: 200, message: 'ok', data: 123456789 } }
      },
    } as unknown as import('axios').AxiosInstance
    const bytes = await createFolder(http).getFolderSize('/DATA/x')
    expect(url).toBe('/folder/size')
    expect(cfg?.params).toEqual({ path: '/DATA/x' })
    expect(cfg?.timeout).toBe(300000)
    expect(bytes).toBe(123456789)
  })

  it('getFolderCount hits /folder/count with path', async () => {
    let url = ''
    let params: unknown
    const http = {
      get: async (u: string, c?: { params?: unknown }) => {
        url = u; params = c?.params
        return { data: { success: 200, message: 'ok', data: 42 } }
      },
    } as unknown as import('axios').AxiosInstance
    await createFolder(http).getFolderCount('/DATA/x')
    expect(url).toBe('/folder/count')
    expect(params).toEqual({ path: '/DATA/x' })
  })
```

- [ ] **Step 2: Run the test to verify the new expectations fail.**

Run: `pnpm exec vitest run packages/service/src/folder.test.ts`
Expected: FAIL — `cfg?.timeout` is `undefined` (no timeout passed yet); the return-type assertion may pass by accident, the timeout one must fail.

- [ ] **Step 3: Implement.** In `packages/service/src/folder.ts`, replace the `getFolderSize` method (leave `getFolderCount` as-is apart from nothing — do not change it):

```ts
    async getFolderSize(path: string): Promise<number> {
      // The backend walks the entire subtree on every call (no caching);
      // large trees on spinning disks can take minutes. The axios default
      // timeout (60s, http.ts) would cut that off, so this request gets
      // its own 5-minute budget.
      const res = await http.get('/folder/size', { params: { path }, timeout: 300000 })
      return unwrap<number>(res.data)
    },
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `pnpm exec vitest run packages/service/src/folder.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit.**

```bash
git add packages/service/src/folder.ts packages/service/src/folder.test.ts
git commit -s -m "feat(service): type getFolderSize and give it a 5-minute timeout

The wrapper existed but was never called and returned unknown. The
backend recursively walks the subtree per call, which can exceed the
60s axios default on large trees, so the request carries its own
timeout. Fixture updated to the real envelope (data is the raw byte
count, not an object)."
```

---


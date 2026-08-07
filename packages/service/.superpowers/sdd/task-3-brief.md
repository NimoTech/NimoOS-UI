### Task 3: 合并 `folder` 域(补 create/rename/getFolderSize/getFolderCount)

**Files:**
- Modify: `src/folder.ts`(在既有 `getList` 上补 4 个方法)
- Modify: `src/folder.test.ts`(补测试)

**Interfaces:**
- Consumes: 既有 `createFolder(http)` + `unwrap` + `FolderListing`。
- Produces(扩充后):
  ```ts
  createFolder(http): {
    getList(path: string): Promise<FolderListing>   // 既有,不改
    create(path: string): Promise<unknown>
    rename(oldPath: string, newPath: string): Promise<unknown>
    getFolderSize(path: string): Promise<unknown>
    getFolderCount(path: string): Promise<unknown>
  }
  ```

- [ ] **Step 1: 写失败测试**(追加到 `src/folder.test.ts` 的 `describe('createFolder', ...)` 内)

```ts
  it('create posts path to /folder', async () => {
    let seen: unknown
    const http = { post: async (_u: string, b?: unknown) => { seen = b; return { data: { success: 200, data: {} } } } } as unknown as import('axios').AxiosInstance
    await createFolder(http).create('/DATA/nf')
    expect(seen).toEqual({ path: '/DATA/nf' })
  })

  it('rename puts old/new to /folder/name', async () => {
    let url = ''; let body: unknown
    const http = { put: async (u: string, b?: unknown) => { url = u; body = b; return { data: { success: 200, data: {} } } } } as unknown as import('axios').AxiosInstance
    await createFolder(http).rename('/DATA/a', '/DATA/b')
    expect(url).toBe('/folder/name')
    expect(body).toEqual({ old_path: '/DATA/a', new_path: '/DATA/b' })
  })

  it('getFolderSize / getFolderCount hit /folder/size and /folder/count with path', async () => {
    const urls: string[] = []; const params: unknown[] = []
    const http = { get: async (u: string, cfg?: { params?: unknown }) => { urls.push(u); params.push(cfg?.params); return { data: { success: 200, data: { size: 1 } } } } } as unknown as import('axios').AxiosInstance
    const f = createFolder(http)
    await f.getFolderSize('/DATA/x'); await f.getFolderCount('/DATA/x')
    expect(urls).toEqual(['/folder/size', '/folder/count'])
    expect(params).toEqual([{ path: '/DATA/x' }, { path: '/DATA/x' }])
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd NimoOS-Service && npm test -- folder`
Expected: FAIL(`f.create is not a function` 等)

- [ ] **Step 3: 写实现**(在 `src/folder.ts` 的返回对象里,`getList` 之后补)

```ts
    async create(path: string): Promise<unknown> {
      const res = await http.post('/folder', { path })
      return unwrap<unknown>(res.data)
    },
    async rename(oldPath: string, newPath: string): Promise<unknown> {
      const res = await http.put('/folder/name', { old_path: oldPath, new_path: newPath })
      return unwrap<unknown>(res.data)
    },
    async getFolderSize(path: string): Promise<unknown> {
      const res = await http.get('/folder/size', { params: { path } })
      return unwrap<unknown>(res.data)
    },
    async getFolderCount(path: string): Promise<unknown> {
      const res = await http.get('/folder/count', { params: { path } })
      return unwrap<unknown>(res.data)
    },
```

- [ ] **Step 4: 跑测试确认通过 + 构建**

Run: `cd NimoOS-Service && npm test && npm run build`
Expected: 全绿(既有 getList 测试 + 4 条新测试),`tsc` 无错。

- [ ] **Step 5: 提交**

```bash
cd NimoOS-Service && git add src/folder.ts src/folder.test.ts
git commit -m "feat(service): extend folder domain with create/rename/size/count"
```

---


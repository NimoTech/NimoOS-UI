## Task 3: 共享包 `file.getPreviewBytes`(TDD)

**Files:**
- Modify: `NimoOS-Service/src/file.ts`
- Modify: `NimoOS-Service/src/file.test.ts`
- 之后:`NimoOS-New-UI` `pnpm install` 刷快照

**Interfaces:**
- Produces:`service.file.getPreviewBytes(path: string): Promise<ArrayBuffer>` —— GET `/file/preview`(→`/v1/file/preview`)、`responseType:'arraybuffer'`、`timeout: 150000`(覆盖默认 60s)、真实路径进 `params.path`、不 unwrap 返回 `res.data`。

- [ ] **Step 1: 写失败测试**

在 `NimoOS-Service/src/file.test.ts` 的 `describe('createFile', …)` 内追加:
```ts
  it('getPreviewBytes fetches /file/preview as arraybuffer with long timeout, no unwrap', async () => {
    const cap: Record<string, unknown> = {}
    const buf = new ArrayBuffer(8)
    const http = {
      get: async (url: string, cfg?: { params?: unknown; responseType?: string; timeout?: number }) => {
        cap.getUrl = url; cap.getParams = cfg?.params; cap.responseType = cfg?.responseType; cap.timeout = cfg?.timeout
        return { data: buf }
      },
    } as unknown as AxiosInstance
    const f = createFile(http, () => 'TKN')
    const res = await f.getPreviewBytes('/DATA/a.doc')
    expect(cap.getUrl).toBe('/file/preview')
    expect((cap.getParams as { path: string }).path).toBe('/DATA/a.doc')
    expect(cap.responseType).toBe('arraybuffer')
    expect(cap.timeout).toBe(150000)
    expect(res).toBe(buf)
  })
```

- [ ] **Step 2: 跑测试确认 RED**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm exec vitest run src/file.test.ts 2>&1 | tail -8
```
Expected: FAIL(`f.getPreviewBytes is not a function`)。

- [ ] **Step 3: 实现 getPreviewBytes**

在 `NimoOS-Service/src/file.ts` 的 `createFile` 返回对象里,`getBytes` 之后加:
```ts
    async getPreviewBytes(path: string): Promise<ArrayBuffer> {
      // 旧版 Office → 后端 LibreOffice 转 PDF(/v1/file/preview)。转换慢(~3s+),
      // 覆盖 axios 默认 60s 超时为 150s(后端 120s 超时 + 余量)。走拦截器 401 自愈。
      const res = await http.get('/file/preview', { params: { path }, responseType: 'arraybuffer', timeout: 150000 })
      return res.data as ArrayBuffer
    },
```

- [ ] **Step 4: 跑测试确认 GREEN + 全量 + 构建**

Run:
```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test && pnpm build 2>&1 | tail -6
```
Expected: 全绿 + tsc 0。

- [ ] **Step 5: 提交 + 刷 New-UI 快照**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/file.ts src/file.test.ts
git commit -m "feat(file): getPreviewBytes(path) 取后端转换的 PDF(/file/preview, arraybuffer, 150s timeout)"
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install
git diff --quiet -- pnpm-lock.yaml || { git add pnpm-lock.yaml; git commit -m "chore(office-preview): 刷 nimoos-service 快照(getPreviewBytes)"; }
```
Expected: `pnpm install` 成功(file: 依赖 lockfile 通常不变,无变更则跳过提交)。

---


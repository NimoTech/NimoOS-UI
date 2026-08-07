### Task 7: 上传(multipart + uploads list/cancel)+ sprite 元数据 + 收尾回归

**Files:**
- Modify: `src/photos.ts`
- Create: `src/photos.uploads.test.ts`

**Interfaces:**
- Consumes: Vue2 `photos.js:12-24`(multipart)、`upload/uploadsApi.js`(uploads list/cancel)、`spritePreview.js:10-22`(X-Sprite-* 响应头)。
- Produces: `uploadAsset(formData)`, `uploadAssetWithProgress(formData, onProgress)`, `listUploads(status='active')`, `cancelUpload(id)`, `spriteMeta(id)` → `Promise<{ frames: number; durationMs: number; frameW: number; frameH: number }>`, `spriteUrl(id)`, `previewUrl(id)`。
- 注意:tus 断点续传本身**不进包**(它是 tus-js-client 实例化配置,属 New-UI `src/photos/upload/`,P8 移植)。

- [ ] **Step 1: 写失败测试**(`src/photos.uploads.test.ts`,复制 capture 辅助)

```ts
describe('photos 上传与 sprite', () => {
  it('uploadAsset 发 multipart POST', async () => {
    const { http, calls } = capture()
    const fd = new FormData()
    await createPhotos(http, noToken).uploadAsset(fd)
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/assets/upload' })
    expect((calls[0].cfg as { headers?: Record<string, string> })?.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
  })
  it('uploadAssetWithProgress 把 axios progress 事件换算成百分比回调', async () => {
    let onUp: ((e: { loaded: number; total?: number }) => void) | undefined
    const http = {
      post: async (_u: string, _b: unknown, cfg?: { onUploadProgress?: (e: { loaded: number; total?: number }) => void }) => {
        onUp = cfg?.onUploadProgress
        return { data: { success: 200, data: {} } }
      },
    } as unknown as AxiosInstance
    const seen: number[] = []
    await createPhotos(http, noToken).uploadAssetWithProgress(new FormData(), (pct) => seen.push(pct))
    onUp!({ loaded: 50, total: 200 })
    onUp!({ loaded: 200, total: 200 })
    onUp!({ loaded: 10 }) // 无 total 不回调
    expect(seen).toEqual([25, 100])
  })
  it('listUploads/cancelUpload 对齐 uploadsApi.js', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listUploads()
    await p.cancelUpload('u1')
    expect(calls[0]).toMatchObject({ url: '/photos/uploads', params: { status: 'active' } })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/uploads/u1/cancel' })
  })
  it('spriteMeta 从响应头读 X-Sprite-*(axios 小写化)', async () => {
    const http = {
      get: async (url: string) => ({
        data: new Blob(),
        headers: { 'x-sprite-frames': '24', 'x-sprite-duration-ms': '4000', 'x-sprite-frame-w': '160', 'x-sprite-frame-h': '90' },
        config: { url },
      }),
    } as unknown as AxiosInstance
    const meta = await createPhotos(http, noToken).spriteMeta('a1')
    expect(meta).toEqual({ frames: 24, durationMs: 4000, frameW: 160, frameH: 90 })
  })
  it('spriteUrl/previewUrl 带 token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.spriteUrl('a1')).toBe('/v1/photos/assets/a1/sprite?token=T1')
    expect(p.previewUrl('a1')).toBe('/v1/photos/assets/a1/preview?token=T1')
  })
})
```

- [ ] **Step 2: 确认失败**;**Step 3: 实现**(追加):

```ts
    // ─── 上传(multipart;tus 断点续传在 New-UI upload/ 层,不进包)───
    async uploadAsset(formData: FormData): Promise<unknown> {
      const res = await http.post('/photos/assets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return unwrap<unknown>(res.data)
    },
    async uploadAssetWithProgress(formData: FormData, onProgress?: (pct: number) => void): Promise<unknown> {
      const res = await http.post('/photos/assets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress(e: { loaded: number; total?: number }) {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      return unwrap<unknown>(res.data)
    },
    async listUploads(status = 'active'): Promise<unknown[]> {
      const res = await http.get('/photos/uploads', { params: { status } })
      return loose<unknown[]>(res.data)
    },
    async cancelUpload(id: string | number): Promise<unknown> {
      const res = await http.post(`/photos/uploads/${id}/cancel`, {})
      return unwrap<unknown>(res.data)
    },
    // ─── 视频悬停 sprite(经共享 axios,401 走单飞——SP7 决策:全区唯一裸 fetch 并入共享通道)───
    async spriteMeta(id: string | number): Promise<{ frames: number; durationMs: number; frameW: number; frameH: number }> {
      const res = await http.get(`/photos/assets/${id}/sprite`, { responseType: 'blob' })
      const h = res.headers as Record<string, string | undefined>
      return {
        frames: parseInt(h['x-sprite-frames'] || '0', 10),
        durationMs: parseInt(h['x-sprite-duration-ms'] || '0', 10),
        frameW: parseInt(h['x-sprite-frame-w'] || '0', 10),
        frameH: parseInt(h['x-sprite-frame-h'] || '0', 10),
      }
    },
    spriteUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/sprite${tokenQ('?')}`
    },
    previewUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/preview${tokenQ('?')}`
    },
```

- [ ] **Step 4: 确认通过** — 单文件 PASS。
- [ ] **Step 5: 全量收尾回归**

```bash
pnpm test          # 全量绿(117 基线 + 新增)
pnpm build         # tsc 干净
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm test   # 消费方回归 1199+ 全绿(file:../NimoOS-Service 指向本 worktree)
```

Expected: 三项全绿。若 New-UI 回归失败,先查是否 `originalUrl` 带 token 的口径变化影响既有断言——按新口径修断言,不回退设计。

- [ ] **Step 6: Commit**

```bash
cd /home/nimo/NimoTech/.sp7/NimoOS-Service
git add src/photos.ts src/photos.uploads.test.ts
git commit -m "photos 域:multipart 上传/uploads 队列/sprite 元数据入共享通道,P0 收官"
```

---

## Self-Review 记录

- Spec 覆盖:§4「~60 方法 + uploads list/cancel + URL 生成器」→ T1-T7 全覆盖;sprite 并入共享通道(spec §5-2)→ T7;token 统一口径(§5-1)→ T1/T4/T6/T7;`index.ts` 的 `photos` getter 已存在且 `createPhotos(http, getToken)` 签名不变,无需改动。
- tus 断点续传按 spec §4 明确留 New-UI P8,不属 P0。
- 类型一致性:全部方法挂同一工厂返回对象,`tokenQ`/`loose` 定义在 T1、T2-T7 复用,签名一致。

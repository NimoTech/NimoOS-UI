## Task 6: service 层补齐 precheck 结果字段

**Files:**
- Modify: `packages/service/src/types.ts`
- Test: `packages/service/src/file.upload.test.ts`（追加一例）

**Interfaces:**
- Produces: `UploadPrecheckResult.results` 的元素类型变为 `{ relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }`

**背景**：后端 `NimoOS/route/v2/precheck_file.go:25-30` 已经在返回 `size_match` 与 `is_dir`，只是本仓类型里没写出来。第二轮内层决议要用 `is_dir` 判断能不能覆盖。

- [ ] **Step 1: 写失败的测试**

在 `packages/service/src/file.upload.test.ts` 里追加：

```ts
  it('uploadPrecheck passes through size_match and is_dir', async () => {
    const { file, post } = makeFile()   // 与该文件既有用例同款的 helper,照抄邻近用例的构造方式
    post.mockResolvedValue({ data: { results: [{ relativePath: 'a.txt', exists: true, size_match: true, is_dir: false }] } })
    const out = await file.uploadPrecheck('/DATA/x', [{ relativePath: 'a.txt', size: 5 }])
    expect(out.results[0].size_match).toBe(true)
    expect(out.results[0].is_dir).toBe(false)
  })
```

> 实现者注意：先读 `packages/service/src/file.upload.test.ts` 顶部，照该文件既有的 mock 构造方式写，不要照搬上面的 `makeFile()` 名字 —— 那只是占位，实际名字以文件里为准。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run packages/service/src/file.upload.test.ts`
Expected: FAIL — TS 报 `Property 'size_match' does not exist`（或断言 undefined）

- [ ] **Step 3: 改类型**

`packages/service/src/types.ts` 第 81-83 行改为：

```ts
export interface UploadPrecheckResult {
  // size_match / is_dir are optional in the type but always present from the
  // NimoOS core handler (route/v2/precheck_file.go) — optional only so an old
  // or degraded body can't break the type contract.
  results: { relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }[]
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/file.upload.test.ts packages/service/src/file.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 测试 PASS，vue-tsc clean

- [ ] **Step 5: 提交**

```bash
git add packages/service/src/types.ts packages/service/src/file.upload.test.ts
git commit -m "feat(service): surface size_match and is_dir from upload precheck

The core handler has always returned both fields; the type dropped them. The
merged-folder conflict round needs is_dir to decide whether overwrite can be
offered for a colliding inner path."
```

---


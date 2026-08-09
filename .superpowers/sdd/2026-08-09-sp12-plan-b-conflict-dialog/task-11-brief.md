## Task 11: 票 B —— 重试不再撞死 URL

**Files:**
- Modify: `src/files/upload/scheduler.ts`, `src/files/stores/uploads.ts`
- Test: `src/files/upload/scheduler.test.ts`（追加）, `src/files/stores/uploads.retryBatch.test.ts`（追加）

**问题**：`retryItem` / `retryBatch` 重置了 `progress` / `bytesSent`（等于对用户承诺「重来一次」），**却不清 `item.tusUploadUrl`**。`scheduler.ts` 仍把它当 `resumeUrl` 传下去，对已删的 staging 发 HEAD 拿 404；`isRetryableTusError` 正确地不重试（<500），`humanize(404)` 把它标成「网络错误」。于是每次点继续都在敲同一个死 URL，唯一出路是取消 + 重选，而提示还在把用户往网络问题上引。SP12 让 staging 被清成为常态（中断即清 + sweeper 120s/600s），所以这条从边角变成常见路径。复现：暂停一个批次 → 等 >12 分钟 → 按继续。

- [ ] **Step 1: 写失败的测试**

`src/files/upload/scheduler.test.ts` 追加：

```ts
  it('drops a dead resume URL on 404 so the next attempt creates a fresh upload', async () => {
    const patches: Partial<UploadItem>[] = []
    const item = mk({ id: 'fq_1', tusUploadUrl: 'http://nas/upload-tus/gone' })
    const upload = vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { originalResponse: { getStatus: () => 404 } }))
    // 实现者:错误形状照该文件既有用例里 tusErrorStatus 能识别的那种构造,别自己发明。
    const s = createScheduler({
      claimNext: () => (patches.length ? null : item),
      patch: (_id, p) => { Object.assign(item, p); patches.push(p) },
      refresh: async () => null,
      concurrency: 1,
      upload,
      sleepFn: async () => {},
    })
    await s.run()
    expect(patches.some((p) => p.tusUploadUrl === null)).toBe(true)
  })

  it('does the same for 410 Gone', async () => {
    // 同上,状态码换 410
  })

  it('keeps the resume URL on a retryable 5xx', async () => {
    // 状态码 503 → patches 里不应出现 tusUploadUrl: null
  })
```

`src/files/stores/uploads.retryBatch.test.ts` 追加：

```ts
  it('retry clears the stale tus URL so a cleared staging area is recreated', () => {
    const s = useUploadsStore()
    s.queue.push(mk({ id: 'i1', status: 'error', tusUploadUrl: 'http://nas/upload-tus/gone', batchId: 'b1' }))
    s.retryBatch('b1')
    expect(s.queue[0].tusUploadUrl).toBeNull()
  })

  it('retryItem clears it too', () => {
    // 同上,走 retryItem
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/files/upload/scheduler.test.ts src/files/stores/uploads.retryBatch.test.ts`
Expected: FAIL — `tusUploadUrl` 仍是旧字符串

- [ ] **Step 3: 改实现**

`src/files/upload/scheduler.ts`，在 `catch` 里 `const status = tusErrorStatus(err)` 之后、`if (status === 409)` 之前插入：

```ts
        // The staging area this URL points at is gone (interrupt clears it
        // immediately; the server's sweeper clears it after the idle grace
        // period). Keeping the URL would make every retry HEAD the same dead
        // endpoint forever, reported as a bare "network error" — drop it so
        // the next attempt creates a fresh upload instead.
        if (status === 404 || status === 410) {
          deps.patch(item.id, { tusUploadUrl: null, bytesSent: 0, progress: 0 })
          item.tusUploadUrl = null
        }
```

> `item.tusUploadUrl = null` 是必要的：本轮 `for` 循环下一次 attempt 直接读 `item`，只 patch store 追不上。

`src/files/stores/uploads.ts`：

```ts
  function retryItem(id: string): void {
    // Also clears tusUploadUrl: the staging area behind it may already be gone
    // (interrupt clears it at once, the sweeper after the idle grace period),
    // and resuming a dead URL loops forever on a misleading "network error".
    patch(id, { status: 'pending', progress: 0, bytesSent: 0, error: '', tusUploadUrl: null })
    startUpload()
  }
```

`retryBatch` 里那行 patch 同样加上 `tusUploadUrl: null`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/upload/ src/files/stores/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/files/upload/scheduler.ts src/files/stores/uploads.ts src/files/upload/scheduler.test.ts src/files/stores/uploads.retryBatch.test.ts
git commit -m "fix(files): drop a dead tus resume URL instead of retrying it forever

Retry reset progress but kept tusUploadUrl, so every attempt re-HEADed staging
the server had already cleared — a 404 the error mapper reports as a plain
network error, leaving cancel-and-reselect as the only way out. SP12 made
cleared staging the normal case, so this went from an edge case to a routine
dead end."
```

---

## 收尾门（全部任务完成后，由控制器亲自复跑，不转述实现者的话）

- [ ] `pnpm exec vue-tsc --noEmit` → clean
- [ ] `pnpm test` → 全绿，记下文件数/例数
- [ ] `pnpm exec vitest run src/i18n/parity.test.ts` → 9/9
- [ ] `pnpm build` → 成功
- [ ] `node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/f09c058e-ef8d-4819-9a3f-e1d2e27fd055/scratchpad/oss-check --no-commit --allow-dirty-oss` → 零真实泄漏
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src/files/components/FileConflictDialog.vue` → 只应命中注释以外的零处（颜色全走 token）
- [ ] 已知非缺陷，不要去追：全量套件的 jsdom `Not implemented: navigation` 噪声（来自 photos 测试）；`src/home/components/DesktopContextMenu.test.ts` 单独跑会红、全量里是绿的（SP11 遗留的 reka-ui 隔离 flake）

## 真机验收清单（起 dev server，非 cutover 期不 deploy.sh）

验收方式：`pnpm dev --host --port <本 worktree 专用端口，避开 5273/5277/5288>`

1. 传一个目标目录**已存在同名**的**单文件** → 弹窗出现，标题「已存在同名项目」，显示文件名与目标目录，**没有**「合并」按钮，「覆盖」可点。
2. 选「覆盖」→ 上传完成后目标文件被替换（大小/时间变了），目录里**没有**多出 `xxx(1)`。
3. 同一场景选「保留两者」→ 目录里出现后端自动改名的第二份。
4. 同一场景选「跳过」→ 不上传，右下角 toast 显示「已跳过 1 项」。
5. 传一个目标目录**已存在同名文件夹**的**文件夹** → 弹窗出现「合并」按钮，且黄色提示是「合并进已有文件夹，或选择保留两者/跳过」，「覆盖」是**灰的**（悬停提示「文件夹不支持覆盖」）。
6. 选「合并」→ 文件夹里**不冲突的文件**直接落进已有文件夹；**冲突的那些**逐个再弹一次窗（弹窗里显示的是 `Trip/1.jpg` 这种完整相对路径，不是裸文件名）。
7. 一次拖入**多个**都冲突的文件 → 弹窗显示「第 1 项，共 N 项」，勾上「应用于剩余全部项目」再选一个动作 → **不再弹**，其余全部按该动作处理。
8. 冲突弹窗按 **Esc**（或点遮罩）→ 本次及剩余全部取消，toast 显示已跳过的条数，**已经开始传的不回滚**。
9. 传一个文件夹，其**同名的是一个文件**（不是文件夹）→ 弹窗**没有**「合并」按钮，黄色提示是「文件夹不支持覆盖 — 请选择保留两者或跳过」。
10. 浅色 / 深色主题各看一遍弹窗：四个按钮、黄色提示条、勾选框都不能出现白底白字或看不见的情况；鼠标悬停在「覆盖」上不能变白。
11. **票 A**：开始一个大文件上传 → 导航到 `/apps`（离开文件区）→ 关标签页 → 浏览器弹「离开此网站？」；确认离开后回到文件区，该批次的文件夹条目上**立刻**出现裂开角标（不用等 2 分钟）。
12. **票 B**：暂停一个批次 → 等 >12 分钟（让服务端 sweeper 清掉 staging）→ 按「继续」→ 应当**重新开始传并成功**，而不是反复报「网络错误」。

---

## Self-Review 记录

**1. spec 覆盖**：spec §4.3 的四动作 + `applyToAll` + 目录禁 overwrite「同时落在纯函数和按钮禁用两处」→ Task 3 的 `applyUploadResolutions`（overwrite 只对非文件夹组可达）+ Task 5 的 `:disabled` 与 `choose()` 防御，两处都有。§4.4 的两轮编排、按首段分组、`isDir` 任一侧为真、两队列 + `mergeable` → Task 2/3/4/7 逐条覆盖。spec T1「接入点本期只接上传」→ 已照办，粘贴/快照恢复接入仍是另开的票。

**2. 占位扫描**：Task 6/9/10/11 的部分测试写成了「照既有文件的 mock 方式补齐」的骨架而不是可直接粘贴的完整代码 —— 这是**有意为之**：这四处依赖本仓既有测试文件里的 helper（`makeFile`、Files 视图的 router/service 桩、`mk` 工厂），凭空写一份新的反而会与既有约定打架。每处都写明了「先读哪个文件、照什么来、必须断到什么」。其余任务的测试代码均可直接粘贴。

**3. 类型一致性**：`ConflictCandidate` / `ConflictChoice` / `ConflictResolution` / `ConflictAction` 只在 Task 1 定义，Task 2-7 一律 import；`AcceptedEntry` / `ApplyResult` / `InnerPrecheckResult` 只在 `uploadConflict.ts` 定义。`conflictPolicy` 的取值域在 `AcceptedEntry`（`'' | 'overwrite' | 'rename'`）、`SelectedFile`、`UploadItem` 三处一致 —— Task 8 专门把 `UploadItem` 从含 `'skip'` 的旧联合收窄到这三个值。

### Task 2: store 四个 RAID 写 action(`createRaid`/`removeRaid`/`replaceRaidDisk`/`recoverRaid`)

在 `src/storage/stores/storage.ts` 加 4 个写守卫 busy ref + 4 个写 action,照 P2 `createStorage`/`unmount` 守卫范式,写成功后刷新入口 `loadRaid()`。**本 Task 只做 store 层 + 单测锁死请求形状**,视图接线在 T5–T8。

**Files:**
- Modify: `src/storage/stores/storage.ts`(busy ref 声明区 `:22-25` 附近加 4 个;action 区加 4 个函数;return `:221-248` 补出)
- Test: `src/storage/stores/storage.test.ts`(追加 RAID 写 action 用例)

**Interfaces:**
- Consumes: `service.raid.create/remove/replaceDisk/recover`(签名见 Global Constraints);`loadRaid()`(P3 建,`storage.ts:133`);`useToast()`;i18n `t`;`startCreateTask(task: RaidTask)`(P3 预留 `:187`);`mapTask`(P3,`raidView.ts`)。
- Produces(store return 新增):
  - `raidCreating: Ref<boolean>`、`raidRemoving: Ref<boolean>`、`raidReplacing: Ref<boolean>`、`raidRecovering: Ref<boolean>`
  - `createRaid(body: { name: string; level: number; disk_paths: string[]; chunk_kb: 512; filesystem: 'btrfs' | 'ext4'; enable_snapshots: boolean }): Promise<RaidTask | null>` —— 成功返回从 create 响应里取出的任务(供向导接 `startCreateTask`),失败返回 `null`。
  - `removeRaid(id: number | string): Promise<boolean>`
  - `replaceRaidDisk(id: number | string, body: { old_disk_path: string; new_disk_path: string }): Promise<boolean>`
  - `recoverRaid(id: number | string): Promise<{ state: string } | null>` —— 返回后端 `data.state` 供视图决定成功/警告 toast(Vue2 语义:`active`/`degraded`/`rebuilding` 判成功)。

- [ ] **Step 1: 写失败测试** `src/storage/stores/storage.test.ts`(追加)

在既有 mock service 结构(参照文件内 `service.raid` 只读方法已 mock 的方式)上追加 create/remove/replaceDisk/recover 的 mock。核心断言 = **请求形状逐字**:

```ts
describe('RAID 写 action', () => {
  it('createRaid 发 POST body 逐字 {name,level,disk_paths,chunk_kb:512,filesystem,enable_snapshots};单飞守卫', async () => {
    const createMock = vi.fn().mockResolvedValue({ data: { task_id: 't1' } })
    // ...把 createMock 装进 service.raid.create（沿用本文件既有 mock 装配方式）
    const s = useStorageStore()
    const body = { name: 'vault', level: 5, disk_paths: ['/dev/sda', '/dev/sdb', '/dev/sdc'], chunk_kb: 512 as const, filesystem: 'btrfs' as const, enable_snapshots: true }
    const p1 = s.createRaid(body)
    const p2 = s.createRaid(body)               // 并发第二发被守卫吞掉
    const [r1, r2] = await Promise.all([p1, p2])
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(body)
    expect(r2).toBeNull()                        // 单飞:第二发直接 null
    expect(s.raidCreating).toBe(false)           // finally 释放
  })

  it('createRaid 失败 → 返回 null、warn 只记 message、busy 复位', async () => {
    const createMock = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // 装 createMock
    const s = useStorageStore()
    const r = await s.createRaid({ name: 'a', level: 0, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'ext4', enable_snapshots: false })
    expect(r).toBeNull()
    expect(warn).toHaveBeenCalled()
    // 断言日志不带整个 error 对象(不含 config)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidCreating).toBe(false)
  })

  it('removeRaid 发 DELETE {id} 无 body;成功 loadRaid 刷新、返回 true', async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined)
    const listMock = vi.fn().mockResolvedValue([])       // loadRaid 内部
    // 装 removeMock + list
    const s = useStorageStore()
    const ok = await s.removeRaid(7)
    expect(removeMock).toHaveBeenCalledWith(7)
    expect(removeMock).toHaveBeenCalledTimes(1)
    expect(listMock).toHaveBeenCalled()                  // 刷新发生
    expect(ok).toBe(true)
  })

  it('replaceRaidDisk 发 POST(id, {old_disk_path,new_disk_path}) 逐字', async () => {
    const replaceMock = vi.fn().mockResolvedValue(undefined)
    // 装 replaceMock + list
    const s = useStorageStore()
    const ok = await s.replaceRaidDisk(3, { old_disk_path: '/dev/sdb', new_disk_path: '/dev/sdd' })
    expect(replaceMock).toHaveBeenCalledWith(3, { old_disk_path: '/dev/sdb', new_disk_path: '/dev/sdd' })
    expect(ok).toBe(true)
  })

  it('recoverRaid 返回后端 data.state', async () => {
    const recoverMock = vi.fn().mockResolvedValue({ data: { data: { state: 'rebuilding' } } })
    // 装 recoverMock + list
    const s = useStorageStore()
    const r = await s.recoverRaid(9)
    expect(recoverMock).toHaveBeenCalledWith(9)
    expect(r).toEqual({ state: 'rebuilding' })
  })
})
```

> 注:mock 装配请沿用 `storage.test.ts` 现有 `service.raid` 只读方法的 mock 写法(该文件顶部已有 `vi.mock('@nimotech/nimoos-service', …)` 或等价注入),保持一致。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts -t "RAID 写 action"`
Expected: FAIL(action 未定义)。

- [ ] **Step 3: 实现 4 个 action + busy ref**

在 `storage.ts` busy ref 区新增:
```ts
const raidCreating = ref(false)
const raidRemoving = ref(false)
const raidReplacing = ref(false)
const raidRecovering = ref(false)
```
action(照 `createStorage` 的 finally-刷新守卫 / `unmount` 的成功刷新守卫,视操作语义择一):
```ts
// 创建:成功后不在此刷新列表(阵列进"创建中"任务流,由 startCreateTask + 轮询接管),
// 从响应取 task 供向导调 startCreateTask。
async function createRaid(body: {
  name: string; level: number; disk_paths: string[]
  chunk_kb: 512; filesystem: 'btrfs' | 'ext4'; enable_snapshots: boolean
}): Promise<RaidTask | null> {
  if (raidCreating.value) return null
  raidCreating.value = true
  const toast = useToast()
  try {
    const res = (await service.raid.create(body)) as { data?: { task_id?: string } } | undefined
    const taskId = res?.data?.task_id
    // 用请求信息 + task_id 组装 creatingTask(step 未知先给初值,轮询会填)
    const task: RaidTask = {
      taskId: taskId ?? '', name: body.name, level: body.level,
      filesystem: body.filesystem, diskCount: body.disk_paths.length,
      step: 0, stepName: '', progress: 0, elapsedSeconds: 0, error: '', status: 'creating',
    }
    return task
  } catch (e) {
    console.warn('[storage] raid create failed', (e as Error)?.message)
    toast.show(t('raidCreateFailedToast'))
    return null
  } finally {
    raidCreating.value = false
  }
}

async function removeRaid(id: number | string): Promise<boolean> {
  if (raidRemoving.value) return false
  raidRemoving.value = true
  const toast = useToast()
  let ok = false
  try {
    await service.raid.remove(id)
    toast.show(t('raidRemoveSuccess'))
    ok = true
  } catch (e) {
    console.warn('[storage] raid remove failed', (e as Error)?.message)
    toast.show(t('raidRemoveFailed'))
  } finally {
    await loadRaid()
    raidRemoving.value = false
  }
  return ok
}

async function replaceRaidDisk(id: number | string, body: { old_disk_path: string; new_disk_path: string }): Promise<boolean> {
  if (raidReplacing.value) return false
  raidReplacing.value = true
  const toast = useToast()
  let ok = false
  try {
    await service.raid.replaceDisk(id, body)
    toast.show(t('raidReplaceSuccess'))
    ok = true
  } catch (e) {
    console.warn('[storage] raid replace failed', (e as Error)?.message)
    toast.show(t('raidReplaceFailed'))
  } finally {
    await loadRaid()
    raidReplacing.value = false
  }
  return ok
}

async function recoverRaid(id: number | string): Promise<{ state: string } | null> {
  if (raidRecovering.value) return null
  raidRecovering.value = true
  const toast = useToast()
  try {
    const res = (await service.raid.recover(id)) as { data?: { data?: { state?: string } } } | undefined
    const state = res?.data?.data?.state ?? 'retrying'
    if (state === 'active' || state === 'degraded' || state === 'rebuilding') toast.show(t('raidRecoverSuccess'))
    else toast.show(t('raidRecoverFailed'))
    await loadRaid()
    return { state }
  } catch (e) {
    console.warn('[storage] raid recover failed', (e as Error)?.message)
    toast.show(t('raidRecoverFailed'))
    return null
  } finally {
    raidRecovering.value = false
  }
}
```
把 4 个 ref + 4 个 action 加进 store 的 `return { … }`。**新增 5 个 toast key**(`raidCreateFailedToast`/`raidRemoveSuccess`/`raidRemoveFailed`/`raidReplaceSuccess`/`raidReplaceFailed`/`raidRecoverSuccess`/`raidRecoverFailed`)在 T2 就双写进 zh_cn/en_us(见附录 B 文案),否则 `t()` 返回 key 本身、`parity.test.ts` 不受影响但眼验会看到裸 key。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts`
Expected: PASS(全文件)。补 `pnpm exec vue-tsc --noEmit` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/stores/storage.ts src/storage/stores/storage.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 四写 action + 守卫 + 请求形状单测锁死(P4 T2)"
```

---


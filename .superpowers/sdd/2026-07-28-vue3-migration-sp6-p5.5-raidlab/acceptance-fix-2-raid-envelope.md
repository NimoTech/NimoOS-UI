# 验收修复 2:RAID 创建裸信封误报失败

真机验收抓到:点「创建 RAID」→ toast 弹「创建 RAID 失败」，但 RAID 页面里阵列确实新增出来了；
后端日志三步（mdadm create → mkfs.btrfs → SaveConfig）全过，`GET /v2/raid/tasks` 三个任务 `status`
全是 `"done"`。误报在前端，两层叠加：

1. **NimoOS-Service**（共享包）`src/raid.ts` 的 `create`/`listTasks`/`getTask` 对裸信封端点调了
   `unwrap()`，而这三个端点后端实际返回裸 JSON（无 `success` 字段），`unwrap()` 必抛：
   - `POST /v2/raid` → 裸 `{task_id,status}` + HTTP 202（`route/v2/raid.go` `CreateRAIDArray`
     函数，187-190 行 `ctx.JSON(http.StatusAccepted, map[string]string{...})`）
   - `GET /v2/raid/tasks` → 裸数组（`ListCreateTasks` 函数，299 行 `ctx.JSON(http.StatusOK, tasks)`）
   - `GET /v2/raid/tasks/:id` → 200 时裸对象（`GetCreateTask` 函数，309 行
     `ctx.JSON(http.StatusOK, buildTaskResponse(t))`），404 时 `{"error":"task not found"}`
     （307 行）
   同域其余方法（`list`/`remove`/`getStatus`/`getUsage`/`replaceDisk`/`recover`）已用 curl 核实
   走标准信封 `model.Result{Success,Message,Data}`，未改动。

2. **NimoOS-New-UI** `src/storage/stores/storage.ts` 的 `createRaid` 读 `res?.data?.task_id`，
   多套了一层 `.data`——`unwrap()` 本就会剥信封，而后端返回的又是裸体，正确写法是
   `res?.task_id`。这一层此前被第一层"藏住"：`create` 必抛 → catch → 弹失败 toast → 成功路径
   代码从未跑过。若只修第一层，`taskId` 会落空串，进度弹窗和轮询会盯着空 id 卡死。两层一起修。

## 仓库 1：NimoOS-Service（分支 master，起点 2917090）

### RED（先加测试，确认为预期原因失败）

命令：`pnpm test -- raid.test`

```
❯ src/raid.test.ts (10 tests | 4 failed)
  × create returns a raw {task_id,status} body ...
  × listTasks returns a raw array body directly
  × listTasks degrades to an empty array on an unexpected body (never throws)
  × getTask returns a raw task object body (200, no success field)

Error: request failed (undefined)
 ❯ unwrap src/unwrap.ts:6:15
 ❯ Object.create src/raid.ts:33:14   （及 listTasks/getTask 对应行）
```
四个失败全部因为 `unwrap()` 对裸体必抛 —— 符合预期原因，不是笔误。

### GREEN

改 `src/raid.ts`：`create`/`listTasks`/`getTask` 三个方法改为直接读裸体，容忍未来标准信封
（`{success:200,data:...}`）；`getTask` 的 404 不做任何拦截，仍由 axios 对非 2xx 自行抛出。
`src/raid.test.ts` 补 8 条用例（裸体×3 + 标准信封兼容×3 + 空数组降级×1 + 404 透传×1）。

```
$ pnpm test
 Test Files  24 passed (24)
      Tests  133 passed (133)

$ pnpm build   # tsc -p tsconfig.json
（无输出，零错误）
```

**commit：`bfa3d62`** —— `fix(raid): create/listTasks/getTask 容忍裸信封,不再对成功响应误抛失败`
（`src/raid.ts` + `src/raid.test.ts`，2 files changed, 89 insertions(+), 4 deletions(-)）

## 仓库 2：NimoOS-New-UI（分支 master，起点 3f7e79e）

### RED

在 `src/storage/stores/storage.test.ts` 加用例：mock `service.raid.create` 返回裸
`{task_id:'abc',status:'creating'}`，断言 `createRaid` 返回的 `RaidTask.taskId === 'abc'`。

命令：`pnpm exec vitest run src/storage/stores/storage.test.ts`

```
❯ RAID 写 action > createRaid 对裸 {task_id,status}(无 .data)也能取到 taskId
AssertionError: expected '' to be 'abc'
```
红得正确：拿到空串而不是报错或误通过，证明"多套一层 .data"这个根因。

### GREEN

`src/storage/stores/storage.ts` 的 `createRaid`：`res?.data?.task_id` → `res?.task_id ?? res?.data?.task_id`。

```
$ pnpm exec vitest run src/storage/stores/storage.test.ts
 Test Files  1 passed (1)
      Tests  39 passed (39)
```

### 依赖刷新（本仓库通过 file:../NimoOS-Service 消费共享包）

```
$ cd ../NimoOS-Service && pnpm build   # tsc，先把改动编译进 dist/
$ cd ../NimoOS-New-UI && pnpm install
Packages: +1
Done in 3.2s
（pnpm-lock.yaml 无 diff，未变动，不需要额外提交）
```

## 验证门（全部通过，四步全绿）

```
$ cd /home/nimo/NimoTech/NimoOS-Service && pnpm test
 Test Files  24 passed (24)
      Tests  133 passed (133)

$ cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install && pnpm test
 Test Files  246 passed (246)
      Tests  1508 passed (1508)

$ pnpm exec vue-tsc --noEmit
（无输出，零错误）

$ pnpm build
✓ built in 10.70s
（仅有既存的"chunk 超 500kB"体积警告，与本次改动无关，构建成功）
```

**commit：`ab0fe3f`** —— `fix(storage): createRaid 读裸 task_id,不再多套一层 .data`
（`src/storage/stores/storage.ts` + `src/storage/stores/storage.test.ts`，2 files changed, 17 insertions(+), 2 deletions(-)）

## 偏离说明

无实质偏离。按要求只改了点名文件：`raid.ts`/`raid.test.ts`（NimoOS-Service）、
`storage.ts`/`storage.test.ts`（NimoOS-New-UI）。`detectCreatingTask`/`pollCreateTaskOnce`
两处未改动（已经写对，接裸数组/裸对象）。`snapshot.ts` 未碰。`pnpm-lock.yaml` 检查过无
diff，未额外提交。

## 顾虑

- 未做真机部署验证（超出本次任务范围：任务要求的验证门是单测 + tsc + build，不含
  `deploy.sh`）。建议下次真机验收时重走一遍"创建 RAID"流程，确认 toast 不再误报、
  进度弹窗能正常跟到 done。
- `create()` 的返回类型仍是宽松的 `unknown`（跟 NimoOS-Service 里其余"破坏性"方法风格一致），
  未引入更强的类型收紧；如后续想要更强类型安全，可以给 `RaidCreateResponse` 单独建接口，
  但会牵动 store 侧的类型标注，本次按"只改点名文件"的约束未做。

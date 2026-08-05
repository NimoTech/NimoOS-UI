# Task 1 报告:共享包 `sys` 域补全(3 → 20 个方法)

## 实现内容

按 brief 逐字转录,未做任何偏离:

- `src/types.ts`:扩了 `HardwareInfo`(补 11 个具名可选字段,保留索引签名),追加 8 个新
  interface/type(`UpdateCheck` `SysBaseInfo` `SystemPathEntry` `SystemPaths` `SSLConfig`
  `SSLConfigInput` `GatewayComponent` `GatewayDeviceInfo` `MigrateStatus`)。
- `src/sys.ts`:`createSys` 从 3 个方法扩到 20 个,原样按 brief Step 4 的代码实现,含全部
  代码内注释(命名陷阱、裸 JSON 两端点、USB 字符串归一、power 类型收窄、migrate 未实证警告)。
- `src/sys.test.ts`:按 brief Step 2 原样追加全部测试(`writeHttp` 桩 + 5 组 describe)。
- `src/index.ts`:`export type` 那一行末尾追加 9 个新类型名。

未偏离 brief 任何一处端点路径 / 字段名 / fixture 值。

## 测试

Baseline(修改前,commit 425f4f0):
```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test
→ Test Files 24 passed (24) / Tests 133 passed (133)
```

Step 3(补完测试、未实现 sys.ts,确认失败):
```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test
→ Test Files 1 failed | 23 passed (24) / Tests 24 failed | 134 passed (158)
```
失败均为 `TypeError: s.getOsVersion is not a function`(及其余 19 个新方法同类报错),符合预期——
没有意外通过的用例,说明桩没写错。

Step 6(实现 sys.ts 后):
```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test
→ Test Files 24 passed (24) / Tests 158 passed (158)
```

**测试数变化:133 → 158(+25),文件数不变 24,零失败。**(brief 预期"约 160",实际
158——25 条新用例,文件数/绿灯状态吻合,数字上的小出入不构成问题。)

## 构建 / 类型检查

```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build
→ tsc -p tsconfig.json,无输出、无错误(dist/ 已 gitignore)
```

```
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit
→ 无输出,0 错误
```

**未执行 `pnpm install`** —— New-UI 通过 `file:../NimoOS-Service` 链接直接引用了刚 `pnpm build`
产出的 `dist/`,vue-tsc 一次直接通过,没有触发 "Module not found"/漂移坑
(`nimoos-service-pnpm-drift` 记忆里描述的场景没有复现)。`pnpm-lock.yaml` 无变化,因此
New-UI 侧没有需要提交的东西。

## New-UI 侧 git 状态确认

提交前 `git status --short` 确认:
```
D  "design-export/Audio Speaker Segmentation.html"
D  design-export/audio-waveform-design-kit.html
D  design-export/design-final.html
?? docs/superpowers/plans/2026-07-31-vue3-migration-sp9-p1-general-developer.md
```
3 行 design-export 的 `D` 仍在、未触碰、未提交。`docs/superpowers/plans/...` 是本任务之外的
未跟踪文件(非本次改动产物),同样未提交。New-UI 侧本任务无提交。

## 提交

`NimoOS-Service` 仓库(base 425f4f0 → HEAD):
```
commit 4f67cfc9e869d070228422d6be3a4084b563d3c1
feat(sys): 补全 sys 域 20 个方法(SP9-P1)
4 files changed: src/index.ts src/sys.test.ts src/sys.ts src/types.ts
```
Pathspec 显式列出 4 个文件,未用 `-a` / `-A`。

`NimoOS-New-UI` 仓库:无提交(无 lockfile 变化,且 3 条 design-export 删除按约定原样跳过)。

## 对 brief 的疑虑

无。brief 中列出的两个"易错点"(裸 JSON 两端点不 unwrap、命名陷阱 os_version/version)
在实现中原样遵循,未发现 brief 与实测/源码有出入之处。`migrateAppPath`/`getMigrateStatus`
两方法 brief 自己也标注"未 curl 实证",按其要求原样实现并保留代码注释警告,留给 P3 消费前复核。

---

## Fix round 1(review Critical:`updateApp`/`updateOs` 吞掉信封里的失败)

### 问题

`FirmwareUpdate`(backs `POST /sys/os_update`,`NimoOS/route/v1/system.go:93-102`)与
`SystemUpdate`(backs `POST /sys/update`,`:149-158`)两个后端 handler 的错误分支都是
`ctx.JSON(common_err.SUCCESS, model.Result{Success: common_err.SERVICE_ERROR, Message: err.Error()})`
—— HTTP 状态码 200,错误只写在信封的 `success:500` 里。原实现 `await http.post(...)` 没有
查信封,axios 默认 `validateStatus` 只看 HTTP 200 就 resolve,导致升级失败被当成成功、错误信息
被吞掉。Vue2 的 `UpdateModal.updateSystem()` 本就查 `res.data.success !== 200` 并把
`res.data.message` 抛出来给用户看 —— 不查等于比 Vue2 更糟,违反移植纪律。`cancelDownload`
未动:`system.go:167-171` 无失败分支,恒返回 SUCCESS,不需要查信封;`/gateway/port`、
`/gateway/ssl` 的写操作走真实 4xx/5xx,axios 自己会 reject,同样不需要改。

### 修复

`src/sys.ts` 的 `updateApp` / `updateOs` 改为取 `res.data` 后调用 `unwrap<unknown>(...)`,
信封 `success!==200` 时 `unwrap` 会抛出带 `message` 的 `Error`。补充了对应的代码内注释,
说明这两个端点失败也返 HTTP 200 的根因、Vue2 对照、以及为什么 `cancelDownload` 和网关两个
写操作不需要同样处理。

### 补充测试

在 `src/sys.test.ts` 的 `createSys 写操作载荷` describe 块、紧跟 URL 断言测试之后追加 3 条:

```ts
  // 这两个端点失败时**也返回 HTTP 200**,错误只在信封里(system.go:93-102 / :149-158),
  // axios 不 reject → 不查信封就会把失败当成功。后续任务的升级流程靠这个 throw 报错。
  it('updateApp 在信封报错时抛(后端失败也返 HTTP 200)', async () => {
    const { http } = writeHttp({ success: 500, message: 'no space left on device' })
    await expect(createSys(http).updateApp()).rejects.toThrow('no space left on device')
  })

  it('updateOs 在信封报错时抛', async () => {
    const { http } = writeHttp({ success: 500, message: 'upgrade already running' })
    await expect(createSys(http).updateOs()).rejects.toThrow('upgrade already running')
  })

  it('信封成功时不抛', async () => {
    const { http } = writeHttp({ success: 200, message: 'ok', data: null })
    await expect(createSys(http).updateOs()).resolves.toBeUndefined()
  })
```

### 验证

覆盖测试文件单独跑:
```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test src/sys.test.ts
→ Test Files 1 passed (1) / Tests 33 passed (33)
```
(30 条既有 + 3 条新增,全绿。)

全量回归:
```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test
→ Test Files 24 passed (24) / Tests 161 passed (161)
```
(158 → 161,+3,零失败。)

构建 + 消费端类型检查:
```
cd /home/nimo/NimoTech/NimoOS-Service && pnpm build
→ tsc -p tsconfig.json,无输出、无错误

cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit
→ 无输出,0 错误
```
New-UI 侧提交前再次确认 `git status --short`:3 行 design-export 的 `D` 仍在、未触碰;
本轮无需 `pnpm install`,`pnpm-lock.yaml` 无变化,New-UI 侧无提交。

### 提交

```
commit 6dd2615a6a1642bec7007cb0764a163a8f8c63a9
fix(sys): updateApp/updateOs 查信封,别把 HTTP 200 里的失败当成功(Task1 review #1)
2 files changed: src/sys.test.ts src/sys.ts
```
Pathspec 显式列出 `src/sys.ts src/sys.test.ts`,未用 `-a`/`-A`。commit 历史未改写
(`4f67cfc` 保留原样,review 提到的"spec 表外"措辞按指示不作处理)。

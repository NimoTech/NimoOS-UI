# P6-T2 报告:合流 SERVICE(sp8-ai → master)

- 工作区:`/home/nimo/NimoTech/NimoOS-Service`
- 起点:`master@2dcae718`(合并前工作树干净)
- 终点:合并提交 `ac39cd7`
- 分支:`sp8-ai` → `master`

## Step 1: 起合并

```
git merge sp8-ai
```

输出:

```
Auto-merging src/disks.test.ts
CONFLICT (content): Merge conflict in src/disks.test.ts
Auto-merging src/disks.ts
Auto-merging src/index.ts
CONFLICT (content): Merge conflict in src/index.ts
Automatic merge failed; fix conflicts and then commit the result.
```

冲突文件与 T0 基线一致:`src/index.ts`、`src/disks.test.ts`(2 个)。`src/disks.ts` 自动合并成功,无冲突。

## Step 2: 解 `src/index.ts`

纯加行冲突,三段:import 区、具名/类型导出、service 对象 getter 列表。按 brief 逐字保留 sp8 侧新增内容,同时保留 master 侧(SP9 kvm、SP7 search/raid/snapshot/network 等)已有内容,未整体覆盖任一侧。

具体处理:
1. import 区:两侧 import 语句全保留(raid/snapshot/network/kvm/search + ai/sse/notes/wiki)。
2. 具名导出行:合并成一行 `export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText, sseRequest }`,并追加 sp8 侧的 3 条 re-export(`isDistillableName, DISTILL_EXTS`、`createRootBody`)与 2 条 `export type`(`SseOptions, SseOutcome`)。
3. 类型导出段:master 侧(raid/snapshot/kvm/search 类型)与 sp8 侧(notes/wiki 类型)两段依次保留。
4. service 对象 getter:master 侧 5 个(raid/snapshot/network/kvm/search)+ sp8 侧 3 个(ai/notes/wiki)依次拼接,全部保留。

核对命令与结果:

```
$ /usr/bin/grep -n "<<<<<<<\|=======\|>>>>>>>" src/index.ts
(无输出,exit 1 —— 无残留冲突标记)

$ /usr/bin/grep -c "^  get [a-z]*(): ReturnType" src/index.ts
24

$ /usr/bin/grep -n "createAi\|createNotes\|createWiki\|createKvm\|createSearch\|createRaid\|createSnapshot\|createNetwork" src/index.ts
21:import { createRaid } from './raid.js'
22:import { createSnapshot } from './snapshot.js'
23:import { createNetwork, networkErrorText } from './network.js'
24:import { createKvm } from './kvm.js'
25:import { createSearch } from './search.js'
26:import { createAi } from './ai.js'
28:import { createNotes } from './notes.js'
29:import { createWiki } from './wiki.js'
95:  get raid(): ReturnType<typeof createRaid> {
96:    return createRaid(getHttp() as AxiosInstance)
98:  get snapshot(): ReturnType<typeof createSnapshot> {
99:    return createSnapshot(getHttp() as AxiosInstance)
101:  get network(): ReturnType<typeof createNetwork> {
102:    return createNetwork(getHttp() as AxiosInstance)
104:  get kvm(): ReturnType<typeof createKvm> {
105:    return createKvm(getHttp() as AxiosInstance)
107:  get search(): ReturnType<typeof createSearch> {
108:    return createSearch(getHttp() as AxiosInstance)
110:  get ai(): ReturnType<typeof createAi> {
111:    return createAi(getHttp() as AxiosInstance, () => getConfig().getToken())
113:  get notes(): ReturnType<typeof createNotes> {
114:    return createNotes(getHttp() as AxiosInstance)
116:  get wiki(): ReturnType<typeof createWiki> {
117:    return createWiki(getHttp() as AxiosInstance)
```

结论:master 侧 raid/snapshot/network/kvm/search 五域与 sp8 侧 ai/notes/wiki 三域全部在场,共 24 个域 getter,无遗漏、无覆盖。

## Step 3: 解 `src/disks.test.ts`

两侧 diff(相对 merge-base `2dcae718`):

**`git diff master...sp8-ai -- src/disks.test.ts`(sp8 侧新增内容):**

```diff
diff --git a/src/disks.test.ts b/src/disks.test.ts
index cdfd577..dc5155b 100644
--- a/src/disks.test.ts
+++ b/src/disks.test.ts
@@ -10,4 +10,19 @@ describe('createDisks', () => {
     expect(url).toBe('/disks/usb')
     expect(cfg?.data).toEqual({ mount_point: '/media/usb1' })
   })
+
+  it('list 发 GET /disks,数组体原样返回', async () => {
+    let url = ''
+    const arr = [{ path: '/dev/sda', size: 1000 }]
+    const http = { get: async (u: string) => { url = u; return { data: arr } } } as unknown as AxiosInstance
+    const res = await createDisks(http).list()
+    expect(url).toBe('/disks')
+    expect(res).toEqual(arr)
+  })
+
+  it('list 发 GET /disks,信封体走 unwrap', async () => {
+    const http = { get: async () => ({ data: { success: 200, data: [{ path: '/dev/sdb' }] } }) } as unknown as AxiosInstance
+    const res = await createDisks(http).list()
+    expect(res).toEqual([{ path: '/dev/sdb' }])
+  })
 })
```

**`git diff sp8-ai...master -- src/disks.test.ts`(master 侧新增内容):**

```diff
diff --git a/src/disks.test.ts b/src/disks.test.ts
index cdfd577..255de81 100644
--- a/src/disks.test.ts
+++ b/src/disks.test.ts
@@ -10,4 +10,25 @@ describe('createDisks', () => {
     expect(url).toBe('/disks/usb')
     expect(cfg?.data).toEqual({ mount_point: '/media/usb1' })
   })
+
+  it('getDiskList forwards params and unwraps envelope', async () => {
+    let seen: unknown
+    const http = { get: async (_u: string, cfg?: { params?: unknown }) => { seen = cfg?.params; return { data: { success: 200, data: [{ path: '/dev/sda' }] } } } } as unknown as AxiosInstance
+    const res = await createDisks(http).getDiskList({ type: 'all' })
+    expect(seen).toEqual({ type: 'all' })
+    expect(res).toEqual([{ path: '/dev/sda' }])
+  })
+
+  it('umount deletes /disks with body; getUsbs gets /disks/usb and unwraps', async () => {
+    const log: Array<[string, string, unknown]> = []
+    const http = {
+      get: async (u: string) => { log.push(['get', u, undefined]); return { data: { success: 200, data: [{ name: 'usb0' }] } } },
+      delete: async (u: string, cfg?: { data?: unknown }) => { log.push(['delete', u, cfg?.data]); return { data: { success: 200, data: 'ok' } } },
+    } as unknown as AxiosInstance
+    const d = createDisks(http)
+    await d.umount({ path: '/dev/sda' })
+    const usbs = await d.getUsbs()
+    expect(log).toEqual([['delete', '/disks', { path: '/dev/sda' }], ['get', '/disks/usb', undefined]])
+    expect(usbs).toEqual([{ name: 'usb0' }])
+  })
 })
```

**逐行裁决:** 两侧新增的都是全新 `it` 块,锚在同一个位置(最后一个既有测试块之后、`})` 之前),但测试的**是不同方法**:

- master 侧测的是 `getDiskList`、`umount`、`getUsbs`(3 个方法)。
- sp8 侧测的是 `list`(1 个方法,2 条用例:数组体透传 / 信封体走 unwrap)。

不是「同一断言两边改法不同」的语义冲突,是纯粹的独立追加(各自测各自的方法,互不重叠、互不矛盾)。核对 `src/disks.ts`(该文件无冲突、已自动合并):5 个方法 `getDiskList`/`umount`/`getUsbs`/`umountUsb`/`list` 全部存在,与两侧测试各自对应的方法都能在实现里找到。裁决:**两侧全部保留**,先 master 顺序(getDiskList/umount+getUsbs)再 sp8 顺序(list ×2),未挑边整取、未丢任何用例。

无需申报冲突——语义上不存在互斥,是可加性合并。

## Step 4: 跑 Service 全量

```
$ pnpm exec vitest run --reporter=verbose 2>&1 | tail -80
```

尾部实测输出(原文):

```
 ✓ src/disks.test.ts > createDisks > umountUsb 发 DELETE /disks/usb + body {mount_point} 2ms
 ✓ src/disks.test.ts > createDisks > getDiskList forwards params and unwraps envelope 0ms
 ✓ src/disks.test.ts > createDisks > umount deletes /disks with body; getUsbs gets /disks/usb and unwraps 0ms
 ✓ src/disks.test.ts > createDisks > list 发 GET /disks,数组体原样返回 0ms
 ✓ src/disks.test.ts > createDisks > list 发 GET /disks,信封体走 unwrap 0ms
 ✓ src/index.integration.test.ts > service wiring (SP4-P0) > file/batch/folder/storage domains resolve after initService 2ms

 Test Files  37 passed (37)
      Tests  377 passed (377)
   Start at  11:26:14
   Duration  1.38s (transform 813ms, setup 0ms, import 1.68s, tests 312ms, environment 3ms)
```

**对比基线:** T0 基线 33 文件 / 267 用例 / 0 失败 → 合流后 **37 文件 / 377 用例 / 0 失败**。增量 +4 文件(`ai.test.ts`/`notes.test.ts`/`sse.test.ts`/`wiki.test.ts`,brief 预告的四套测试恰好落地)、+110 用例。全绿,无失败、无 skip。

## Step 5: 构建共享包

```
$ pnpm build
> @nimotech/nimoos-service@0.0.1 build /home/nimo/NimoTech/NimoOS-Service
> tsc -p tsconfig.json
(无报错退出)

$ ls -la dist/index.js dist/ai.js dist/notes.js dist/sse.js dist/wiki.js
-rw-rw-r-- 1 nimo nimo 22935 Aug  6 11:26 dist/ai.js
-rw-rw-r-- 2 nimo nimo  3248 Aug  6 11:26 dist/index.js
-rw-rw-r-- 1 nimo nimo  7957 Aug  6 11:26 dist/notes.js
-rw-rw-r-- 1 nimo nimo  3013 Aug  6 11:26 dist/sse.js
-rw-rw-r-- 1 nimo nimo  4675 Aug  6 11:26 dist/wiki.js
```

构建成功,`dist/index.js` 与四个新域产物均存在且时间戳新鲜(与测试运行同一分钟)。`dist/` 本身 gitignore(`.gitignore` 内 `dist` 一行),不入库,是预期行为——New-UI 的 `file:../NimoOS-Service` 链接直接读磁盘上的 `dist/`,不经 git。

## Step 6: 提交

```
$ git add src/ai.test.ts src/ai.ts src/disks.test.ts src/disks.ts src/index.ts src/notes.test.ts src/notes.ts src/sse.test.ts src/sse.ts src/wiki.test.ts src/wiki.ts
$ git commit -m "merge(p6-t2): 合流 sp8-ai —— ai/notes/sse/wiki 四个域进包 ..."
[master ac39cd7] merge(p6-t2): 合流 sp8-ai —— ai/notes/sse/wiki 四个域进包
$ git status --short
(空 —— 工作树干净)
```

## 结论

- 状态:**DONE**
- SERVICE 仓提交:`ac39cd7`(master)
- 测试:37 文件 / 377 用例 / 0 失败(基线 33/267/0,+4 文件 +110 用例,全部为 sp8 带入的 ai/notes/sse/wiki 域测试)
- Build:通过,`dist/index.js` 与四个新域产物均已生成
- 本刀未改任何产品逻辑,只做合并解冲突 + 验证 + 提交,范围内无越界改动
- 无需申报的语义冲突(disks.test.ts 两侧是可加性追加,非互斥断言);index.ts 24 个域 getter 全部核对在场,无遗漏

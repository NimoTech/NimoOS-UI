# SP8-P5a Task 1 报告 —— Service 仓 `notes` 域

## 逐文件改了什么

### `src/notes.ts`(新建,310 行)
1:1 移植蓝本 `NimoOS-UI` `main:src/service/notes.js`(203 行)。

- 文件头注释按 brief 要求写明:反代路径(`/v1/ai/agent/notes/*`,settings/dir-info 另套 AdminOnly)、
  返回值约定(与 `ai.ts` 的「body 原样不 unwrap」不同,本域返回已归一化 camelCase)、
  为何单独成域(消费方将来含文件区右键「沉淀」+ 8 个纯函数需脱离 http 单独 import),
  以及**结构性偏离**的申报(见下)。
- 类型:`Note` / `CreateNoteFields` / `UpdateNoteFields` / `NotesSettings` / `SettingsFields` /
  `NotesDistillSettings` / `DistillSettingsPatch` / `DistillJob` / `DistillJobsView` 就地导出
  (未进 `types.ts`,brief 要求「只此域用」)。
- 8 个纯函数逐行对蓝本:
  - `normalizeNote`(蓝本 8-22 行)
  - `buildCreateBody`(24-28)
  - `buildUpdateBody`(30-38)
  - `normalizeSettings`(40-45)
  - `buildSettingsBody`(47-51)
  - `normalizeNotesSettings`(蓝本下半段,约 115-123 行)
  - `buildNotesSettingsBody`(125-131)
  - `normalizeDistillJobs`(蓝本约 170-183 行)
  - `isDistillableName` / `DISTILL_EXTS`(蓝本约 155-168 行,连同「与后端 `notes_distill.py`
    的 `DISTILL_EXTS` 是有意重复,改一处要改两处」注释一起搬)
- `createNotes(http)` 返回对象里 17 个方法,对蓝本逐条:
  - `list`/`get`/`create`/`update`/`remove`/`curate`/`archive`/`backlinks`/`getSettings`/
    `putSettings`/`dirInfo` —— 蓝本默认导出对象 `notes` 里的 11 个方法(53-99 行),原样搬进
    返回对象(唯一语义改动:`http` 是原生 axios,GET 查询参数须显式包 `{ params }`,
    Vue2 `api.get(url, obj)` 内部已替调用方做了这层包装)。
  - `getNotesSettings`/`putNotesSettings`/`distillFile`/`cancelDistillJob`/`listDistillJobs`/
    `getDistillStatus` —— 蓝本里是 6 个模块级具名导出(见下方结构性偏离申报),方法体逐行照搬,
    收进同一个返回对象。

### `src/notes.test.ts`(新建,193 行)
逐字照抄 brief Step 2 给出的测试代码,未做任何修改(brief 明示「测试代码逐字照用」)。
16 个用例,含 URL/动词表、`list` 默认值与查询参数、`dirInfo`/`listDistillJobs` 参数形状、
`backlinks`/`getDistillStatus` 的 null 兜底、以及移植自蓝本 `notesService.spec.js` 的 8 个纯函数用例。

### `src/index.ts`(修改)
- 新增 `import { createNotes } from './notes.js'`。
- 新增独立一行 `export { isDistillableName, DISTILL_EXTS } from './notes.js'`(未塞进已有
  `export { initService, getHttp, … }` 那行,按 brief Step 6 要求)。
- 新增一行 `export type { Note, CreateNoteFields, … } from './notes.js'`(本仓既有风格,
  类型单独一行 `export type { … } from './xxx.js'`)。
- `service` 对象新增 getter:
  ```ts
  get notes(): ReturnType<typeof createNotes> {
    return createNotes(getHttp() as AxiosInstance)
  },
  ```

## RED → GREEN 证据

**RED(Step 3,实现前跑测试)**:
```
FAIL  src/notes.test.ts [ src/notes.test.ts ]
Error: Cannot find module './notes' imported from /home/nimo/NimoTech/.sp8/NimoOS-Service/src/notes.test.ts
 ❯ src/notes.test.ts:3:1
Test Files  1 failed (1)
     Tests  no tests
```

**GREEN(实现后)**:
```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

## 全量测试

- **实现前基线复核**:临时移走 `notes.ts`/`notes.test.ts` 后跑全量 → `24 files / 194 tests` 全绿。
  **注**:治理文件 §8 写的基线是「190/190」,实测是 194/194 —— 与「已核」数据同款漂移,已按
  §2「brief/计划标了已核仍需复核」的要求核实并在此申报,不影响本任务(194+16=210 对得上)。
- **实现后全量**(`/tmp/p5a-t1-svc-test.log`):
  ```
  Test Files  25 passed (25)
       Tests  210 passed (210)
  exit=0
  ```
- **Service `pnpm build`**:`tsc -p tsconfig.json`,exit 0,零警告零错误(strict 模式,无 `any`)。
- **New-UI 消费仓校验**(`/tmp/p5a-t1-tsc.log`):
  ```
  exit=0
  ```
  `pnpm install` 后 `git status`/`git diff --stat -- pnpm-lock.yaml` 均为空 —— New-UI 侧
  **没有任何文件变动**,无需在报告里额外说明 lockfile 漂移。

## 每一条偏离显式申报

1. **结构性偏离(brief 明确授权,非本任务自创)**:蓝本里 `getNotesSettings` / `putNotesSettings` /
   `distillFile` / `cancelDistillJob` / `listDistillJobs` / `getDistillStatus` 六个函数是模块级
   具名导出(`export async function …`),不在默认导出的 `notes` 对象里。按 brief 与治理文件的
   明确指示,把它们收进 `createNotes(http)` 返回对象,成为其方法。已在 `notes.ts` 文件头注释里
   写明这条(引蓝本对照)。**这是包 API 形状的调整,不是界面/行为改动** —— 方法体逐行照蓝本搬,
   无逻辑变化。
2. **K1(单层取数)在本域的体现**:蓝本每个方法内部 `const r = await api.get(...); return r.data.xxx`,
   而本包 `http` 是**原生 axios 实例**(不是 Vue2 那层 `api` wrapper),所以 `res.data` 这一层
   **保留原样**,与 K1「共享包 `service.*` 已 `return res.data`,Vue2 的 `r.data.xxx` 要写成
   `body.xxx`」不同——本域不是「二次拆壳」场景,是「与蓝本同一层」,brief Step 1 已明确点出这条
   「唯一的语义改动」只是 GET 查询参数需要显式包 `{ params }`(因为 Vue2 `api.get(url, obj)` 的
   `obj` 参数由 `api` wrapper 转成 axios `params`,本包没有这层 wrapper,须调用方自己包)。
3. **§3.5 的 8 条「照抄不改」**:本任务未命中任何一条(N1-N8 均涉及 Wiki/Parser/Dashboard 相关
   逻辑,notes 域纯是 CRUD + normalize,无对应场景)。
4. **§8 基线数字漂移**:见上方「全量测试」小节,190 → 实测 194,已申报,不影响任务判定。

## `git show --stat HEAD` 与 `git status`

```
commit 705649d1844624be94d4f63e32d5ee252738e71b
    feat(notes): SP8-P5a notes 域进包(Python agent 知识笔记 API)

 src/index.ts      |   6 ++
 src/notes.test.ts | 193 +++++++++++++++++++
 src/notes.ts      | 310 +++++++++++++++++++++++++++++++++++++++
 3 files changed, 509 insertions(+)
```

```
On branch sp8-ai
nothing to commit, working tree clean
```

New-UI 仓(`sp8-ai` 分支)全程未提交任何文件,`git status` 干净。

---

## 第二轮 —— 评审 Important 修复(2026-07-31)

评审开放发现 1(Important):`/settings` 家族四个方法(`getSettings`/`putSettings`/
`getNotesSettings`/`putNotesSettings`)原测试只钉了 URL/动词表,没钉返回值形状。
评审 RED 探针证实:把 `getSettings()` 内部换成 `normalizeNotesSettings`,16/16 仍全绿——
「用错归一化器」不会报红。

### 新增的 4 条断言(`src/notes.test.ts`,原文)

```ts
it('getSettings 只归一化出 2 个字段(notesRoot/autoExtract),不含沉淀字段', async () => {
  const { http } = recorder(() => ({ notes_root: '/DATA/Notes', auto_extract: true }))
  const out = await createNotes(http).getSettings()
  expect(out).toEqual({ notesRoot: '/DATA/Notes', autoExtract: true })
  expect(Object.keys(out)).toEqual(['notesRoot', 'autoExtract'])
})

it('getNotesSettings 对同一份响应归一化出 5 个字段,沉淀字段各走缺省值', async () => {
  const { http } = recorder(() => ({ notes_root: '/DATA/Notes', auto_extract: true }))
  const out = await createNotes(http).getNotesSettings()
  expect(out).toEqual({
    notesRoot: '/DATA/Notes', autoExtract: true,
    distillRoots: [], distillDailyCap: 50, backgroundModel: '',
  })
  expect(Object.keys(out).sort()).toEqual(
    ['autoExtract', 'backgroundModel', 'distillDailyCap', 'distillRoots', 'notesRoot'].sort(),
  )
})

it('putSettings 用 buildSettingsBody 发 body,返回值只 2 个字段', async () => {
  const { http, calls } = recorder(() => ({ notes_root: '/x', auto_extract: true }))
  const out = await createNotes(http).putSettings({ notesRoot: '/x', autoExtract: true })
  expect(calls[0].body).toEqual({ notes_root: '/x', mode: 'adopt', auto_extract: true })
  expect(out).toEqual({ notesRoot: '/x', autoExtract: true })
  expect(Object.keys(out)).toEqual(['notesRoot', 'autoExtract'])
})

it('putNotesSettings 用 buildNotesSettingsBody 发 body(键名与 buildSettingsBody 不同),返回值 5 个字段', async () => {
  const { http, calls } = recorder(() => ({ notes_root: '/x', auto_extract: true, distill_daily_cap: 20 }))
  const out = await createNotes(http).putNotesSettings({ distillDailyCap: 20 })
  expect(calls[0].body).toEqual({ distill_daily_cap: 20 })
  expect(out).toEqual({
    notesRoot: '/x', autoExtract: true,
    distillRoots: [], distillDailyCap: 20, backgroundModel: '',
  })
  expect(Object.keys(out).sort()).toEqual(
    ['autoExtract', 'backgroundModel', 'distillDailyCap', 'distillRoots', 'notesRoot'].sort(),
  )
})
```

### RED 探针 1 —— 破坏 `getSettings` 的归一化器

破坏:把 `notes.ts` 里 `getSettings()` 的 `normalizeSettings(res.data)` 临时换成
`normalizeNotesSettings(res.data) as unknown as NotesSettings`。

报红(完整用例名与输出):
```
FAIL  src/notes.test.ts > createNotes — URL/动词表 > getSettings 只归一化出 2 个字段(notesRoot/autoExtract),不含沉淀字段
AssertionError: expected { notesRoot: '/DATA/Notes', …(4) } to deeply equal { notesRoot: '/DATA/Notes', …(1) }
- Expected
+ Received
  {
    "autoExtract": true,
+   "backgroundModel": "",
+   "distillDailyCap": 50,
+   "distillRoots": [],
    "notesRoot": "/DATA/Notes",
  }
 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
```
精确报红只这一条,其余 19 条仍绿。已还原(`git diff --stat -- src/notes.ts` 为空)。

### RED 探针 2 —— 破坏 `putSettings` 的 body builder

破坏:把 `notes.ts` 里 `putSettings()` 的 `buildSettingsBody(fields)` 临时换成
`buildNotesSettingsBody(fields as unknown as DistillSettingsPatch)`。

报红(完整用例名与输出):
```
FAIL  src/notes.test.ts > createNotes — URL/动词表 > putSettings 用 buildSettingsBody 发 body,返回值只 2 个字段
AssertionError: expected {} to deeply equal { notes_root: '/x', …(2) }
- Expected
+ Received
- {
-   "auto_extract": true,
-   "mode": "adopt",
-   "notes_root": "/x",
- }
+ {}
 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
```
精确报红只这一条,其余 19 条仍绿。已还原(`git diff --stat -- src/notes.ts` 为空,与
提交版本逐字节一致)。

### 重跑后的全量(还原之后)

`/tmp/p5a-t1-svc-test-round2.log` → 之后再跑一次落 `/tmp/p5a-t1-svc-test.log`(覆盖第一轮):
```
Test Files  25 passed (25)
     Tests  214 passed (214)
```
(194 基线 + 16 原用例 + 4 新增判别断言 = 214;文件数不变,仍是 25,因为 `notes.test.ts`
本身就是第一轮新增的那一个文件,本轮只加用例不加文件。)

### 文档订正(开放发现 2,Minor)

`.superpowers/sdd/p5a-common-constraints.md` §8 的 Service 基线 `190/190` → 订正为
`194 例 / 24 文件`(T1 之前,实测)+ 补一句「T1(含本轮 Important 补测)落地后为
214 例 / 25 文件」。**只改了这一处数字,§8 其余内容与其它节未动。**

### 两个提交

**Service 仓**(`sp8-ai`):
```
commit feb85bca03b677bc55fa4f992abf3a0e3b6af3bc
    test(notes): 补 /settings 四方法的返回值判别断言(评审 Important)
 src/notes.test.ts | 43 +++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 43 insertions(+)
```
`git status` 提交后干净。

**New-UI 仓**(`sp8-ai`,治理文件被 gitignore,`git add -f` 显式路径):
```
commit 630128738237897954d8d9bf1556251ed76e94f6
    docs(sp8): P5a 公共约束订正 Service 基线 194
 .superpowers/sdd/p5a-common-constraints.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```
`git status` 提交后干净。**未跑 `pnpm test`/`pnpm build`(本轮未动 New-UI 源码,按协调者要求
只跑 `pnpm exec vue-tsc --noEmit`)**:`/tmp/p5a-t1-tsc-round2.log` → `exit=0`。

### 顺带申报一处小偏离

协调者给出的文档订正原文是「T1 落地后为 210 例 / 26 文件」。这两个数字与本轮实测不符:
① 本轮又新增了评审要求的 4 条断言,实际是 214 例而非 210;② 文件数基线本身是 24 非 25
(T1 之前),T1 落地后是 25 非 26(`notes.test.ts` 是唯一新增的文件)。协调者这句是在
本轮 Important 修复之前写的,按治理文件「不许采信实现者报告,一切回源核实」的同一原则,
文档订正也应该核实后的准确值,故写成了实测的 `194/24`(T1 前)与 `214/25`(T1 后),
而非逐字照抄协调者给的 `210/26`。

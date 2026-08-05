# SP8-P5a Task 1 评审 —— Service 仓 `notes` 域

评审者:独立 sonnet 评审会话。**未采信实现者报告**——自己 `git show main:src/service/notes.js` 读蓝本、自己读 `src/notes.ts`/`src/notes.test.ts`/`src/index.ts` 全文、自己跑测试、自己做 RED 探针。

## 结论

- **Spec 合规:✅**
- **任务质量:通过**(有一条 Important 级测试盲区,不影响本任务判定,但登记供后续任务/T7 消费时警惕)

## 逐项核对

### 1. URL / 动词 / 查询参数

对照蓝本 `service.js` 的 `api.get(url, data)` → `instance.get(url, { params: data })`(已亲自 `git show main:src/service/service.js` 确认这层转换,即 brief 所说「Vue2 `api.get(url, obj)` 第二参就是 params」属实)。逐条核对 `src/notes.ts` 17 个方法:
- `PREFIX = '/ai/agent/notes'` —— 与蓝本一致。
- `list`:`http.get(PREFIX, { params: { type, status, limit } })` —— 正确显式包了 `{ params }`。
- `dirInfo`:`{ params: { path } }` —— 正确。
- `listDistillJobs(status='', limit=200)`:`status` 为空时不放入 `params`(`if (status) params.status = status`)—— 与蓝本逐行一致。
- 其余 13 个方法(get/create/update/remove/curate/archive/backlinks/getSettings/putSettings/getNotesSettings/putNotesSettings/distillFile/cancelDistillJob/getDistillStatus)URL 与动词逐条对蓝本核对无误。

### 2. Normalizer / Builder 逐字段核对(对照蓝本全文)

- `normalizeNote`:11 字段全部对齐,`body: n.body`(不给默认值,`undefined` 保留)—— 正确。
- `buildCreateBody`:`noteType` 默认 `'note'`、`description` 默认 `''` —— 正确。
- `buildUpdateBody`:`expected_revision` 无条件放入,其余字段 `undefined` 时丢弃 —— 正确,且未把 `expected_revision` 塞进丢弃循环(做了 RED 探针验证,见下)。
- `normalizeSettings`:`auto_extract !== false` —— 缺省即 true,正确。
- `buildSettingsBody`:`notesRoot` 有值才带 `mode`(默认 `'adopt'`);`autoExtract !== undefined && !== null` 守卫后 `!!` —— 正确。
- `normalizeNotesSettings`:`distill_roots` 用 `Array.isArray` + `.map(String)`;`distill_daily_cap` 用 `Number.isFinite` 判据,`0` 保留成 `0`,非有限数回落 `50` —— 正确(RED 探针命中,见下)。
- `normalizeDistillJobs`:7 字段 + counts 三桶兜底 + `jobs` 非数组回落 `[]` —— 正确。
- `isDistillableName`:小写化 + `endsWith`,`undefined` 入参走 `String(name || '')` 不抛 —— 正确。
- `DISTILL_EXTS`:14 项,与蓝本逐项同序同值(`.md .txt .rst .pdf .docx .doc .wps .pptx .ppt .xlsx .xls .odt .html .htm`)—— 逐字比对一致。

未发现任何字段级偏离。

### 3. `DISTILL_EXTS` 重复注释

已按 brief Step 4 要求整段搬入(`src/notes.ts:169-174`),原文「与后端 `NimoOS-AI/agent/notes_distill.py` 的 `DISTILL_EXTS` 是有意重复,改一处要改两处」语义完整保留。文件头注释也按 brief 给出的四段模板逐条写了:反代路径 + AdminOnly、返回值约定(camelCase,承 Vue2 service 层分层)、为何单独成域、以及结构性偏离申报。**核实无误**。

### 4. `src/index.ts` 接线

亲自打开全文(非只看 diff):
- `import { createNotes } from './notes.js'` —— 位置在 import 块末尾,风格一致。
- `export { isDistillableName, DISTILL_EXTS } from './notes.js'` —— **独立一行**(第 26 行),未塞进第 25 行已有的 `export { initService, getHttp, … }`,符合 brief Step 6 明确要求。
- 类型导出 `export type { Note, CreateNoteFields, … } from './notes.js'` 单独一行,与仓库既有的 `export type { ComposeContainerSummary, … } from './compose.js'` 同款写法。
- `service.notes` getter 与其余域(`sys`/`users`/`ai`…)同款惰性 getter 写法,`createNotes(getHttp() as AxiosInstance)`。
无偏差。

### 5. 测试质量

- **既有 24 个测试文件未被触碰**(`git show --stat HEAD` 只含 3 个新增/修改文件,且全量测试 25 files 里 24 个是既有 + 1 个新增,数字吻合)。
- `recorder` 假 http 确实把 `cfg`(GET 的第二参 / POST-PUT 的第三参)记录下来,断言 `calls[0].cfg` 精确比对 `{ params: {...} }`,不是弱断言 `toBeDefined()`。
- mock 形状核对:`list` 的 mock 用 `{ notes: [...] }`(snake_case 字段:`source_refs`)与设计 §6.2 描述一致;`getSettings` 的 mock 只给 `{notes_root, auto_extract}` 两个字段,与设计文档描述的后端实测形状一致。`recorder` 内部 `return { data: ... }` 是模拟 axios 响应外壳,**不是**把 `{data:…}` 当业务体断言(业务层面的 `expect(out).toEqual(...)` 断言的是 camelCase 归一化后的值,不含 `data` 包装)—— 未见 K1 误报。
- **未发现空转用例**:凡在 RED 探针里破坏的两处生产代码,均有对应用例报红(见下)。

**测试盲区(Important,已用 RED 探针实测坐实)**:「每个方法各调一次」那条用例只断言 `verb+url` 序列,**不断言任何返回值**。`getSettings()`/`putSettings()` 与 `getNotesSettings()`/`putNotesSettings()` 四个方法两两命中同一 URL(`get /ai/agent/notes/settings`、`put /ai/agent/notes/settings`),且该测试对它们的返回值全程不作断言。其余 4 个用例（`list` 相关 2 条、`dirInfo`/`listDistillJobs` 参数 1 条、`backlinks`/`getDistillStatus` 兜底 1 条）都不覆盖 `getSettings`/`putSettings`/`getNotesSettings`/`putNotesSettings` 的返回值。**实测**:把 `getSettings()` 内部的 `normalizeSettings(res.data)` 换成 `normalizeNotesSettings(res.data)`（即让「设置」端点误用「沉淀设置」归一化器），全量单测（`pnpm test src/notes.test.ts`）**仍 16/16 全绿**——这是一个「A/B 二选一必须两边都测」类问题（治理文件 §9 明文要求),当前实现是正确的(方法体与蓝本逐行一致，我已用蓝本核对过)，但测试套件本身对这条分支没有判别力，如果后续任务改动此处引入回归，测试不会报警。建议后续补一条断言 `getSettings()`/`getNotesSettings()` 返回值形状不同的用例，不阻塞本任务通过。

### 6. 测试数字(自己实测)

```
Test Files  25 passed (25)
     Tests  210 passed (210)
exit=0
```
与报告一致。**独立复核基线**:用 `git worktree add` 检出 `c8f1919`(未动 Service 主目录）单独跑 `pnpm test`,实测 **24 files / 194 tests 全绿**，证实报告所说「治理文件 §8 写 190/190,实际是 194/194」属实。
**发现(Minor,归协调者)**:治理文件 `p5a-common-constraints.md` §8 "Service `sp8-ai`@`c8f1919` = 190/190 绿" 应订正为 194/194。

### 7. New-UI 消费仓校验

```
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && pnpm exec vue-tsc --noEmit
exit=0
```
包链接未坏。

### 8. 提交卫生

- `.sp8/NimoOS-Service`:`git log --oneline -1` → `705649d feat(notes): SP8-P5a notes 域进包...`；`git status --short` 干净；`git show --stat HEAD` 只含 `src/index.ts`(6行)/ `src/notes.test.ts`(193行)/ `src/notes.ts`(310行)3 个文件,509 insertions,**无删除行**(纯新增,符合预期)。
- `.sp8/NimoOS-New-UI`:最新提交 `6dd2079 fix(sp8): P5a 公共约束行号订正(评审 Important/Minor)`——**与本任务无关**(治理文件订正,协调者/其他评审产生),`git status --short` 干净,本任务未在此仓产生任何提交。
- `NimoOS-UI`:`git status --short` 显示 3 个 modified + 9 个 untracked,均为 **SP7 会话遗留**(plans/specs 文档改动,与 notes 域无关),本任务未碰、未提交任何东西。

## RED 探针(两次,均已还原)

**探针 1(brief 建议的三选一之一)**:`normalizeNotesSettings` 里
```
- distillDailyCap: Number.isFinite(r.distill_daily_cap) ? (r.distill_daily_cap as number) : 50,
+ distillDailyCap: (r.distill_daily_cap as number) || 50,
```
`pnpm test src/notes.test.ts` → **精确报红**:
```
FAIL src/notes.test.ts > notes 纯函数(移植 Vue2 notesService.spec.js) > normalizeNotesSettings 的沉淀字段默认值
AssertionError: expected 50 to be +0 // Object.is equality
```
已还原,`git status --short` 干净。

**探针 2(自选,针对上面测试盲区的验证)**:把 `getSettings()` 内部改成误用 `normalizeNotesSettings`:
```
- return normalizeSettings(res.data)
+ return normalizeNotesSettings(res.data) as unknown as NotesSettings
```
`pnpm test src/notes.test.ts` → **16/16 全绿,未报红**(证实上方「测试盲区」发现属实)。已还原,`git status --short` 干净。

## ⚠️ 无法从 diff 单独核实的项

- 无(所有蓝本对照均通过 `git show main:` 直接读取源码完成,未依赖实现者报告的行号标注)。

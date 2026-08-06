# SP8-P5a Task 2 评审 —— Service 仓 `wiki` 域

评审者:独立评审(sonnet),未采信实现者报告结论,逐项自证。

## 判定

- **Spec 合规:✅**(1 处 Important:brief 接口契约里的 `WikiCandidate` 类型未落地且未申报,其余全部吻合)
- **任务质量:通过**

## 蓝本核对(`git show main:src/service/wiki.js`,99 行,全文已读)

逐函数字段级比对,`wiki.ts` 与蓝本完全等价:

- `normalizeRoot`(蓝本 9-20):10 字段逐一对应,顺序一致,`|| 0` / `!!` 兜底全部照抄。
- `normalizeTreeNode`(24-31):5 字段,`|| ''` 兜底全部照抄。
- `normalizeNode`(33-53):`summary: n.summary || null` 连注释「backend currently always sends null」一起搬;`childMap`/`recentChanges` 逐项四/三字段(`fileCount||0`、`!!is_opaque`、`at||''`)全部照抄;`userNotes`/`parentWiki`/`etag` 各 `||''`;`subwikis: n.subwikis || []`。字段输出顺序与蓝本 return 字面量顺序完全一致。
- `createRootBody`(55-63):`Path`/`Level:'space'`/`WatchMode`(默认 `'auto'`)/`StorageMode`(mirror 三元)/`ScanIntervalS: Math.max(1, Math.round(scanIntervalH)) * 3600`,默认 `scanIntervalH=6`,逐字符相同。
- 9 个方法 URL/动词表:
  - `getRoots`:`GET /wiki/roots`,`(res.data||[]).map(normalizeRoot)` ✅
  - `getCandidates`:`GET /wiki/candidates`,`res.data||[]`(不 map)✅
  - `getTree(rootId)`:无 rootId → 第二参 `undefined`(不是 `{}`);有 → `{params:{root_id}}`。经查蓝本 `api.get` 是自定义包装(`service.js:140-155`,第二参是裸 params 对象,内部再包成 `{params}`),本仓 `http` 是原生 axios 实例,brief Step 4 明确要求把 `{root_id}` 改写成 `{params:{root_id}}`——这是必要的、已声明的包装差异,非缺陷。✅
  - `deleteRoot(id,purge)`:`?purge_files=true` 拼在 URL 字符串里,不走 params,与蓝本 `${PREFIX}/roots/${id}${purge?'?purge_files=true':''}` 逐字符相同 ✅
  - `getNode`/`getRaw`:`{params:{path}}` ✅
  - `patchRootEnabled`:`patch` + body `{enabled}` ✅
- 两段蓝本注释(PascalCase 无 json tag / tree|node|raw 用 snake_case)逐字搬到对应函数上方;brief 要求的文件头注释(设备现状 ⚠️,60s 超时/`/candidates`、`/raw` 200)也按原文写了。

## 已申报偏离的裁定

**四个写方法(`createRoot`/`deleteRoot`/`rescanRoot`/`patchRootEnabled`)从「直接返回蓝本的裸 axios promise」改成「`async` + `await` + `return res.data`」。**

裁定:**合理**。
- ① 与 brief Interfaces 块声明的返回类型一致(`Promise<unknown>`,brief 本就没有要求返回 axios 响应对象/AxiosResponse 类型)。
- ② 与 `notes.ts` 同类写方法完全同构 —— 打开 `notes.ts` 核实:`remove`/`distillFile`/`cancelDistillJob` 等全部是 `async () => { const res = await http.xxx(...); return res.data }`,`wiki.ts` 四个方法与之逐字同款。
- ③ 未丢东西:蓝本调用方从未使用过 HTTP 状态码等 axios 信封字段(Vue2 里这几个方法的调用点都是 `.then(r => r.data)` 或直接 `await` 后取 `.xxx` 业务字段),T7 只会消费 body,无回归风险。
- ④ 三件套齐全:代码里虽未在这四个方法体内单独加行内注释,但报告「结构性偏离」小节完整写明依据(brief §4 K1 命中清单 + T1 `notes.ts` 先例),且台账登记走报告本身。判定齐全。

## 发现

1. **【Important】** `src/wiki.ts`:brief 接口契约声明 `getCandidates(): Promise<WikiCandidate[]>`,但实现里既未定义 `WikiCandidate` 接口,也未在 `index.ts` 导出;实际签名是 `Promise<unknown[]>`。功能不受影响(蓝本本来就不 map,只有一行注释 `// [{path, type, size, label}]` 提示形状),但这是 brief 明确写出的具名类型未落地,且报告「偏离清单」里完全没提这一条 —— 属于未申报偏离。应改成:补一个 `export interface WikiCandidate { path: string; type: string; size: number; label: string }`,`getCandidates` 返回 `Promise<WikiCandidate[]>`,并在 `index.ts` 导出该类型。
2. **【Minor】** 四个写方法的 async/return-res.data 偏离,代码里没有像 `notes.ts` 文件头那样的显式行内三件套注释(只在报告里申报)。建议(非必须)比照 `notes.ts:13-19` 的写法在 `wiki.ts` 文件头也补一句指向报告的偏离说明,便于后续读代码的人不必去翻报告。不影响本次判定为「合理」。

## §3.5 8 条「照抄不改」检查

本任务只命中 N7(Go nil slice → `(x||[])` 兜底):`getRoots`/`getCandidates`/`getTree` 三处逐字保留,且有专门测试钉住(`getRoots 对 null 响应兜底成空数组`)。其余 N1-N6/N8 与本域无关(UI/store 层任务专属),未被误动。

## §3 治理文件(K1-K8/P1-P4)偏离命中检查

本任务不含 UI,K1(单层取数)被引用为「结构性偏离」的依据,未违反;其余 K/P 条目与本任务无关,核实无误触碰。

## 测试质量核查

- **判别力补充断言**(`describe('判别力补充断言…')`)两条:
  - `getRoots` 对非空 PascalCase 响应(10 字段完整)钉 `toEqual` 全字段输出 —— 若内部误用 `normalizeTreeNode`,字段集合(5 个 vs 10 个,字段名也不同)必然不匹配,**真有判别力**。
  - `getTree` 对非空 snake_case 响应(5 字段)钉 `toEqual` 全字段输出,同理对调用 `normalizeRoot` 有判别力。
  - `getCandidates` 本身不 map,没有对应的“归一化输出”可钉;brief 原有的「对 null 响应兜底成空数组」用例已覆盖它的空路径,非空路径行为等价于「透传 `res.data`」,判别空间有限,可接受(不是同形状缺陷的高危点)。
- `recorder` 假 http 确实记录了 `cfg`(见 `calls.push({..., cfg: cfg as ...})`),`expect(calls[2].cfg).toBe(undefined)` 用的是 `toBe`(严格 `Object.is`),不是宽松匹配 `toEqual({})`,能真实分辨「不传 config」与「传空对象」两种情况 —— 因为 `getTree()` 无 rootId 时确实是把 `undefined` 作为第二个参数传给 `http.get`,而不是传 `{}`。
- **空转排查**:`wiki.test.ts` 顶层 `it(...)` 块数 = brief 原有 11 条(第一个 `describe` 4 条 + 第二个 `describe` 7 条)+ 实现者补充 2 条 = 13,实测 `vitest` 报 `wiki.test.ts` 为 13 tests,214(基线)+13=227 吻合,数字对齐无异常。
  - 未见把生产代码对应行删掉仍能通过的空转迹象;交叉核对: `normalizeNode` 的 `isOpaque`/`fileCount` 等字段都被具体值断言钉住(`isOpaque: true` 对应输入 `is_opaque: 1`,证明 `!!` 转换确实被验证,而不仅仅是「存在」)。
- **mock 形状真实性**:`/roots` 测试载荷用 PascalCase(`ID`/`Path`/`WatchMode`/`Enabled`/`ScanIntervalS`/`CreatedAt`/`LastScanAt`/`NeedsReconcile`),`/tree`/`/node` 测试载荷用 snake_case(`ai_label`/`user_notes_updated_at`/`last_modified`/`child_map`/`recent_changes`/`is_opaque`),`getRoots`/`getTree`/`getCandidates` 对 `null` 响应的空数组测试直接验证 Go nil slice → null 序列化的兜底路径。均与治理文件 §4「Wiki」数据契约描述一致,未见凭空捏造的信封形状。
- 未见既有 25 个测试文件被动过的痕迹(diff 只新增 `wiki.test.ts`,未触及任何既有 `*.test.ts`)。

## 独立 RED 探针(与实现者不同的破坏点)

**破坏**:`src/wiki.ts:124` 由
```ts
ScanIntervalS: Math.max(1, Math.round(scanIntervalH)) * 3600,
```
改为(去掉下限 `Math.max(1, …)`)
```ts
ScanIntervalS: Math.round(scanIntervalH) * 3600,
```

**报红用例(完整名)**:
```
src/wiki.test.ts > wiki 纯函数(移植 Vue2 wikiRoots.spec.js) > createRootBody 支持 mirror 重试与自定义间隔,且间隔至少 1 小时
```
输出:`expected +0 to be 3600`(其余 12 条同文件用例仍绿,1 failed | 12 passed (13),精确命中目标断言,未误伤别处)。

**已还原**:改回 `Math.max(1, Math.round(scanIntervalH)) * 3600`,`git status --short` 输出为空(干净),重跑全量 `pnpm test`:`Test Files 26 passed (26)`、`Tests 227 passed (227)`。

## 自己实测的测试数字

- Service 仓(`/home/nimo/NimoTech/.sp8/NimoOS-Service`,`pnpm test`):**Test Files 26 passed (26)**、**Tests 227 passed (227)**(与报告一致,基线 214/25 + 本次 13 条 = 227/26)。
- New-UI 仓(`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,`pnpm exec vue-tsc --noEmit`):**exit=0**,日志为空,无诊断输出。

## 提交卫生

- `.sp8/NimoOS-Service`:`git status --short` 干净;`git log --oneline -3` 顶部为 `55f42dc feat(wiki): SP8-P5a wiki 域进包(PascalCase 双向归一化)`,只此一个新提交,`git show --stat` 只含 `src/index.ts`(+6/-0 净增行)、`src/wiki.test.ts`(新建 145 行)、`src/wiki.ts`(新建 177 行)三个文件,无多余改动。评审包 diff 与工作树实际文件逐字节比对一致(未发现 diff 之外的额外改动)。
- `.sp8/NimoOS-New-UI`:`git status --short` 干净,近三条提交均为文档类(`docs(sp8): P5a 公共约束订正…`),与本任务无关,确认没有本任务产生的新提交。
- `NimoOS-UI`(只读蓝本仓):`git status --short` 显示 `M docs/superpowers/specs/2026-07-03-....md` + `?? FRONTEND_API_GUIDE.md` —— 与治理文件 §1 描述的「SP7 会话未提交改动」吻合,本次评审确认**未新增任何提交**(`git log --oneline -3` 顶部是 SP7 的 `docs(sp7): P7a plan …` 系列,与 wiki 域任务无关),且未触碰这些脏文件。

## ⚠️ 无法从 diff 单独核实、需要额外步骤才查清的项

- 无。本次评审所有核查项(蓝本比对、跨仓 tsc、独立 RED 探针、三仓提交卫生)均已实测完成,未遗留需要进一步查证的盲点。

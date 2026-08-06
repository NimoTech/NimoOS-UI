# SP8-P5a Task 2 报告 —— Service 仓 `wiki` 域

提交:`NimoOS-Service@55f42dc` "feat(wiki): SP8-P5a wiki 域进包(PascalCase 双向归一化)"

## 逐文件改了什么

### `src/wiki.ts`(新建,177 行)

1:1 移植自 Vue2 `git show main:src/service/wiki.js`(99 行)。对照表:

| 蓝本 `wiki.js:行号` | `wiki.ts` |
|---|---|
| 头部两段注释(PascalCase/无 json tag、tree\|node\|raw 用 snake_case) | 逐字搬到 `normalizeRoot` 上方 / `normalizeTreeNode` 上方,并加 brief 给的文件头注释(设备现状 ⚠️) |
| `normalizeRoot`(9-20) | 同名函数,字段逐一对应,`Record<string, unknown>` 参数 + `as` 断言收进 `WikiRoot` 接口 |
| `normalizeTreeNode`(24-31) | 同名函数,`WikiTreeNode` 接口 |
| `normalizeNode`(33-53) | 同名函数,`WikiChildMapEntry`/`WikiRecentChange`/`WikiNode` 三个接口收字段 |
| `createRootBody`(55-63) | 同名函数,签名改成 brief 给的对象参数 `{path, watchMode?, scanIntervalH?, mirror?}`,默认值/计算逐行照抄 |
| `wiki.getRoots`(67-70) | `createWiki(http).getRoots` |
| `wiki.getCandidates`(71-74) | `getCandidates` |
| `wiki.getTree`(76-79) | `getTree(rootId?)`,`api.get(url, rootId ? {root_id} : undefined)` → `http.get(url, rootId ? {params:{root_id}} : undefined)`(brief Step 4 指定的包内写法差异) |
| `wiki.getNode`(80-83) | `getNode(path)`,`{path}` → `{params:{path}}` |
| `wiki.getRaw`(84-88) | `getRaw(path)`,字符串强制转换逻辑逐字照搬 |
| `wiki.createRoot/deleteRoot/rescanRoot/patchRootEnabled`(89-92) | 见下方「结构性偏离」 |

### `src/wiki.test.ts`(新建,145 行)

brief Step 2 给的测试代码逐字照搬(未改一行),另加一个 `describe` 块(判别力补充断言,见下)。

### `src/index.ts`(改)

- `import { createWiki } from './wiki.js'`
- `export { createRootBody } from './wiki.js'`(独立一行,未塞进已有的 `notes.js` 导出行)
- `export type { WikiRoot, WikiTreeNode, WikiChildMapEntry, WikiRecentChange, WikiNode } from './wiki.js'`(本仓既有风格,类型单独一行导出)
- `service` 对象里加 `get wiki(): ReturnType<typeof createWiki> { return createWiki(getHttp() as AxiosInstance) }`,紧跟 `notes` getter 之后,与 T1 `notes` 的写法同构。

## 结构性偏离(显式申报)

**`createRoot`/`deleteRoot`/`rescanRoot`/`patchRootEnabled` 改成 `async` 并 `return res.data`,蓝本原文是直接 `return api.post(...)`(返回原始 axios promise,调用方还要自己 `.then(r => r.data)`)。**

依据:brief §4 数据契约表(K1 命中清单)明确写「`createRoot` 的 `r.data` → 包内已剥,直接返回」——也就是消费端(T7)以后写 `service.wiki.createRoot(...)` 时不应再剥一层,这与 `notes.ts` 里 `createNotes` 全部方法「`await` + `return res.data`」的既定分层完全一致(T1 先例)。若照抄蓝本字面返回 axios 响应对象,会与 K1 指令和 T1 先例的分层约定矛盾,也与本文件其余方法(`getRoots`/`getNode`/…)不一致。这是包 API 形状调整,不是行为改动——四个方法的请求 verb/URL/body 逐行照抄蓝本,只是把「解包」这一步从调用方挪进包内,和 T1 报告里记录的结构性偏离性质相同。

## 主动补的判别力断言(评审教训)

brief 明确指出 `getRoots`/`getCandidates`/`getTree` 三者都是「取数组 → 兜底 `[]` → map normalizer」同形状,原有断言里能分辨的只有:
- `getRoots`/`getCandidates`/`getTree` 对 `null` 响应的空数组兜底(三者结果都是 `[]`,互换 normalizer 也一样绿)
- 纯函数级别 `normalizeRoot`/`normalizeTreeNode`/`normalizeNode` 各自单测(但不经过 `getRoots`/`getTree` 方法本身)

**补充 2 条**(在 `describe('判别力补充断言…')` 里):
1. `getRoots` 对非空真实响应(PascalCase `{ID,Path,Level,WatchMode,StorageMode,Enabled,ScanIntervalS,CreatedAt,LastScanAt,NeedsReconcile}`)用 `toEqual` 钉住完整归一化输出(10 个 camelCase 字段)。
2. `getTree` 对非空真实响应(snake_case `{path,level,ai_label,user_notes_updated_at,last_modified}`)用 `toEqual` 钉住完整归一化输出(5 个 camelCase 字段)。

两条断言的期望值字段集合完全不同(10 个 vs 5 个,字段名也不同),`getRoots` 内部若误用 `normalizeTreeNode`(或反过来)必然报红。

## RED 探针自证

**破坏内容**:把 `getRoots` 内部的 `.map(normalizeRoot)` 换成 `.map(normalizeTreeNode as unknown as (r: Record<string, unknown>) => WikiRoot)`。

**报红用例(完整名)**:
```
src/wiki.test.ts > 判别力补充断言(评审教训:getRoots/getCandidates/getTree 三者都是「取数组→兜底[]→map normalizer」形状,互换 normalizer 用 brief 原有断言测不出) > getRoots 对非空真实响应用 normalizeRoot 归一化(与 normalizeTreeNode 输出形状不同,用错 normalizer 必报红)
```
输出(节选):
```
AssertionError: expected [ Array(1) ] to deeply equal [ { id: 'r1', path: '/DATA', …(8) } ]
- Expected: {createdAt:1, enabled:true, id:'r1', lastScanAt:0, level:'space', needsReconcile:true, path:'/DATA', scanIntervalS:21600, storageMode:'inline', watchMode:'auto'}
+ Received: {aiLabel:'', lastModified:'', level:'', path:undefined, userNotesUpdatedAt:''}
Test Files  1 failed (1)
     Tests  1 failed | 12 passed (13)
```
其余 12 条(含 brief 原有的「每个方法各调一次」等 URL/动词断言)全部仍然绿——精确定位到目标用例,未误伤别处,证明该断言确有判别力。

**还原确认**:改回 `.map(normalizeRoot)`,重跑全量:
```
Test Files  26 passed (26)
     Tests  227 passed (227)
```
`git status` 干净(探针改动未提交,提交前已还原)。

## 三门/两行汇总

**Service 仓全量**(`/tmp/p5a-t2-svc-test.log`,完整落盘,未 tail):
```
Test Files  26 passed (26)
     Tests  227 passed (227)
```
基线 214/25 + 本文件 13 条 = 227/26,吻合。

**New-UI `vue-tsc --noEmit`**(`/tmp/p5a-t2-tsc.log`):`exit=0`,日志为空(无诊断输出)。

**跨仓同步步骤**(brief Step 6):
```
cd .sp8/NimoOS-Service && pnpm build   → exit 0(tsc 编译无错)
cd .sp8/NimoOS-New-UI  && pnpm install → 正常同步 file: 链接,无 New-UI 工作树改动
pnpm exec vue-tsc --noEmit             → exit 0
```
`git status`(New-UI 侧)在 `pnpm install` 前后均为空 —— **`pnpm-lock.yaml` 未被改动**,New-UI 侧无任何文件变更,故无需也未提交任何 New-UI 侧文件。

## §3(治理文件)偏离命中检查

本任务未命中 K1-K8 / P1-P4 中任何一条需要"照做并申报"的项(那些是 P5a 壳与仪表盘任务的偏离,`wiki` 域是纯数据层、无 UI)。**K1 单层取数**被本任务的「结构性偏离」小节引用为依据(非违反,是遵照)。

## §3.5(照抄不改)命中检查

- **N7**(Go nil slice → `(x||[])` 兜底不许删):`getRoots`/`getCandidates`/`getTree` 三处 `(res.data || [])` 兜底逐字保留,并有专门测试(`getRoots 对 null 响应兜底成空数组`)钉住。
- 本任务未命中 N6(`loadWikiNode`/`loadWikiRaw` 的 404→null 分层属于消费端 T7 的职责,不在本域 `wiki.ts` 里 —— 本域方法对错误一律上抛,不做任何状态码判断,这是蓝本原文行为,原样照抄)。

## 偏离清单(汇总)

1. **【已申报,依据 K1+T1 先例】** `createRoot`/`deleteRoot`/`rescanRoot`/`patchRootEnabled` 从蓝本「直接返回 axios promise」改成「`await` 后 `return res.data`」。
2. 未发现 brief 测试代码与蓝本冲突之处——brief 给的 13 条断言逐一核对蓝本行为,全部吻合,无需改测试。

无 `NEEDS_CONTEXT`。

---

## 评审返工(2026-08-01)—— 提交 `03d3028`

评审结论:Spec 合规 ✅ · 任务质量通过,原偏离(4 个写方法改 `async`+`res.data`)裁定合理。留两条待收:开放发现 1(Important,`getCandidates` 返回类型对不上 brief 声明、`WikiCandidate` 未申报未定义)、开放发现 2(Minor,该偏离缺行内注释)。本轮逐条处理如下。

### 开放发现 1 —— `WikiCandidate` 字段依据

**是否去看了 NimoOS-Wiki 后端**:去看了(只读,委托 general-purpose 子代理检索,未改该仓任何文件)。

- 路由:`NimoOS-Wiki/route/v1/router.go:45` `g.GET("/candidates", listCandidates(d))`(`GET /v1/wiki/candidates`,JWT 分组)。
- Handler:`NimoOS-Wiki/route/v1/roots.go:68-79` `listCandidates` —— 调 `roots.QueryLocalStorage(d.RuntimePath)`,`nil` 兜底成 `[]roots.Candidate{}`,`c.JSON(200, cands)` 裸数组返回(无信封,符合系统「非标准响应」惯例)。
- 响应元素结构体:`NimoOS-Wiki/service/roots/candidates.go:13-18`
  ```go
  type Candidate struct {
      Path  string `json:"path"`
      Type  string `json:"type"`
      Size  int64  `json:"size,omitempty"`
      Label string `json:"label,omitempty"`
  }
  ```
  `Path`/`Type` 无 `omitempty` → 恒有;`Size`/`Label` 有 `omitempty` → 值为零/空串时整个键从 JSON 里消失(不是 `0`/`""`)。

**与蓝本注释比对**:蓝本 `wiki.js:77` 行尾注释 `// [{path, type, size, label}]` 与后端 struct **完全吻合**,四个字段名一致,无冲突,无需「以后端为准覆盖蓝本」的情形。

**最终类型**(写进 `wiki.ts`,`WikiTreeNode` 之前):
```ts
export interface WikiCandidate {
  path: string
  type: string
  size?: number
  label?: string
}
```
`size`/`label` 标成可选(`?`)而非 `number`/`string` 恒有,如实反映 `omitempty` 语义 —— 若写成非可选,消费端读 `c.label` 在多数「System」候选(无 label)上会拿到 `undefined` 却被类型骗成「一定是 string」,属于更危险的类型谎言。

**补的行内注释原文**(`getCandidates` 上方,`WikiTreeNode` 接口之前):
```ts
/**
 * getCandidates() 的元素形状 —— **声明式断言,不是运行时保证**:
 * 蓝本 `wiki.js:77` 的行尾注释写 `// [{path, type, size, label}]`,`getCandidates`
 * 本身 `return r.data || []` 原样透传、不做任何归一化,所以这个类型只是给 TS 一个
 * 标注,后端字段真变了也不会在这里报错。
 * 已回后端复核(2026-08-01,只读,未改 NimoOS-Wiki 仓):
 * `NimoOS-Wiki/service/roots/candidates.go:13-18` 的 `Candidate` struct 与蓝本注释
 * 完全吻合 —— `Path`/`Type` 恒有(json tag 无 omitempty),`Size`/`Label` 是
 * `omitempty`(值为零/空时整个键缺失,不是空字符串/0)。
 * ⚠️ 设计 §6.3 实测:设备上 `/candidates` 现状回 `[]`(它不查库,只是当前无候选)—
 * **没有真机非空样本可对**,这条类型完全靠蓝本注释 + 后端源码推导,未经真机验证。
 */
export interface WikiCandidate {
  path: string
  type: string
  size?: number
  label?: string
}
```
`getCandidates` 方法体:
```ts
async getCandidates(): Promise<WikiCandidate[]> {
  const res = await http.get(`${PREFIX}/candidates`)
  return (res.data as WikiCandidate[] | null) || [] // [{path, type, size, label}] — see WikiCandidate doc comment
},
```

**测试**:未添加任何非空 candidate fixture(遵照要求,不编「我以为长这样」的伪真机数据)。已有的 null 兜底断言(`getRoots 对 null 响应兜底成空数组` 一条里含 `getCandidates`)覆盖了运行时行为;`WikiCandidate` 本身是类型层声明,判别力由 Service 侧 `tsc`(`pnpm build`)与消费仓 `vue-tsc` 承担 —— 两者本轮都已重跑并 exit 0(见下)。

### 开放发现 2 —— 偏离行内注释

已在 `createRoot` 方法上方补一段集中注释(四个写方法共用),原文见 `wiki.ts` 现状(commit `03d3028` diff):
```ts
/* SP8-P5a Task 2 结构性偏离(评审裁定合理): 蓝本 wiki.js:89-92 的这四个
 * 方法是 `return api.post(...)` / `return api.delete(...)` 等,直接把
 * axios 响应对象原样交给调用方(调用方自己再取 `.data`)。本包统一改成
 * `await` + `return res.data`,把「剥一层信封」的职责收进包内,与本文件
 * 其余方法(getRoots/getNode/…)及 T1 notes.ts 的既定分层一致(K1:
 * 单层取数——消费端不应再剥一层)。请求 verb/URL/body 逐行照抄蓝本,
 * 只挪了「解包」这一步,不是行为改动。*/
```

### RED 探针

本轮**无运行时行为改动**(`getCandidates` 只改了 TS 类型标注和方法签名,`res.data` 的实际取值/兜底逻辑字面未变;四个写方法只加注释)。判别力由类型检查承担:
- Service 仓 `pnpm build`(`tsc -p tsconfig.json`)→ `exit 0`(若 `WikiCandidate` 字段与调用点不匹配会在这一步报编译错)。
- New-UI `pnpm exec vue-tsc --noEmit` → `exit 0`(若类型导出断裂或与消费方假想签名冲突会在这一步报红;本批 T2 尚无消费方代码,这一步主要验证包链接与 `.d.ts` 重新生成后没有连带破坏)。

未额外做「弄坏→报红→复原」的运行时 RED 探针,因为没有新的运行时分支可破坏;如评审认为仍需要一次运行时 RED 才能收敛,请指出具体想验证的行为点,我再补。

### 重跑后的三门

**Service 仓全量**(`/tmp/p5a-t2-svc-test-round2.log`,完整落盘未 tail):
```
Test Files  26 passed (26)
     Tests  227 passed (227)
```
（与本任务第一轮完全一致,未新增/未减少用例 —— 本轮只改类型标注与注释,未新增断言,遵照「不编造非空 fixture」的要求。）

**Service `pnpm build`**:`exit=0`(`.d.ts` 已带 `WikiCandidate` 重新生成)。

**New-UI `pnpm exec vue-tsc --noEmit`**(`/tmp/p5a-t2-tsc-round2.log`):`exit=0`,日志为空。`git status`(New-UI 侧)在本轮前后均为空,未提交任何 New-UI 文件。

### 提交

`NimoOS-Service@03d3028` "fixup(wiki): 补 WikiCandidate 类型 + 四个写方法的偏离行内注释(评审 Important+Minor)"
```
$ git show --stat HEAD
 src/index.ts |  2 +-
 src/wiki.ts  | 30 ++++++++++++++++++++++++++++--
 2 files changed, 29 insertions(+), 3 deletions(-)
$ git status
On branch sp8-ai
nothing to commit, working tree clean
```
只改了 `src/wiki.ts`/`src/index.ts`(为导出新类型 `WikiCandidate`)两个文件,未动 `src/wiki.test.ts`(未新增 fixture,故无需改测试文件),显式列路径提交,未用 `git add -A`。

无 `NEEDS_CONTEXT`。

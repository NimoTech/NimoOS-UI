# SP9-P7 Search 区接真后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `SearchDialog.vue` 里两套写死的 demo 数据换成真实后端(`POST /v1/ai/search/agent/tool` 四源聚合),界面形态不变;排名、合并去重、reasons 派生、降级态映射四块纯逻辑独立成可测模块。

**Architecture:** 三层,边界互不渗透。① 共享包 `NimoOS-Service/src/search.ts` **只做归一化**(`null → []`、蛇形转驼峰、`stats`/`warnings` 归位),不产视图模型;② New-UI `src/home/search/` 四个**纯函数模块**(`reasons` / `buildSearchView` / `degrade` + 共享 `types`),零 Vue 依赖、零 i18n 依赖(**只产 i18n key 与状态码,不产文案**),全部单测;③ `useSearchQuery.ts` composable 持有请求生命周期与过期守卫,`SearchDialog.vue` 只负责渲染与交互。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · vue-i18n 9(全局单例已由 `vitest.setup.ts` 装好,**测试里不要另建 `createI18n`**)· vitest + @vue/test-utils · reka-ui(`DialogRoot`,现状不动)· 共享包 `@nimotech/nimoos-service` 新增 `search` 域

**spec:** `docs/superpowers/specs/2026-07-31-vue3-migration-sp9-final-views-design.md` **§7 全节 + §7.10(2026-08-04 开工前订正,与 §7.1–§7.9 冲突时以 §7.10 为准)** + §2(聚合入口决策)+ §1.1–§1.5(搜索实测校正,注意 §1.5 的 fixture 已过期,见 §7.10a)。**不要读 roadmap §4 SP9 的 A/B/C 三节**(07-30 探测稿,与实测多处不符)。

**起点坐标:** New-UI `master 7341e03`(P6 收尾 `cd382d5` → OSS 导出若干 → spec 订正 `7341e03`)· NimoOS-Service `master 7e84566` · 未推 origin、未部署。
**基线(2026-08-04 实测,`pnpm test` 全量):358 文件 / 3209 例 全绿,退出码 0,耗时 72s。** 每期任务门判定「相对基线不新增红」。
**⚠️ 工作树里预先就有 4 处与本期无关的改动**:3 个 `design-export/*.html` 的**未暂存删除** + `oss/files/README.md` 的修改。**它们不属于本期,不要提交、不要还原、不要 `git add -A`。**

---

## Global Constraints

每条对**每个任务**都生效,不再在各任务里重复。

1. **界面严格 1:1,逻辑照正确。** 本期的「1:1 对象」是 **New-UI 现有的 SearchDialog 界面**(不是 Vue2 `views/Search.vue`)—— 这是 spec §12 偏离 #1 已授权的。视觉结构、类名、间距、动画一律不动;只换数据源与状态。**未申报的偏离即缺陷。禁止无关重构。**
2. **文案**:能在 Vue2 `NimoOS-UI/src/assets/lang/zh_CN.json` 里找到对位的**一律照抄**(本期已核出可直接用的:`"Semantic search unavailable"→"语义搜索不可用"`、`"Photo search unavailable"→"图片搜索不可用"`、`"Filename search unavailable"→"文件名搜索不可用"`、`"No matching files"→"没有匹配的文件"`、`"Search failed"→"搜索失败"`、`"Semantic"→"语义"`、`"Filenames"→"文件名"`);找不到对位的才自拟。新 key **只落分片** `src/i18n/{zh_cn,en_us}.sp9.ts`,**不改主 locale 文件**;两个分片的 key 集合必须完全一致(`parity.test.ts` 断言)。英文值 = Vue2 那个 key 的字面量本身。
3. **颜色全走 token。** 本期理论上不需要新 token(徽标/提示条复用现有 `.rz-*` / `--accent-soft` / `--sem-*` 一套)。若确实要新增,加在 `src/styles/theme.sp9.css` 且 `:root` 与 `:root[data-theme='light']` 两块都给值。⚠️ `color-guard.test.ts` **不剥注释**,注释里写 `rgba(...)` 也翻红。
4. **测试里读 `.css` 一律用 `node:fs`**(`?raw` 对 `.css` 在 vitest 下恒为空串)。
5. **异步写共享 state 必带过期守卫**(就地 `let epoch` / 代际计数,**别抽公共 guard**),回归测试**必须走交错路径**(先发的请求后回来),不是只测顺序路径。本期唯一需要守卫的是 `useSearchQuery.run()`(Task 4)。
6. **断言必须有判别力。** 每写完一条用例问自己「把它覆盖的那行改坏会不会翻红」;拿不准就**真做变异验证**(临时拆掉被测的那根接线,确认用例精确翻红),把变异验证的实际输出写进任务报告。四次「用例空转」在 SP9-P3 被评审逮到过。
7. **fixture 不得手编。** `filenames` 组与 `warnings`/`stats` 的 fixture **逐字取自 spec §7.10a 的真机响应**(下面 Task 0 已内嵌)。`semantic` / `images` / `notes` 三组本机产不出非空结果,其 fixture **必须从 Go 结构体逐字派生**,且在测试文件注释里写明来源行号:
   - semantic 元素 = `NimoOS-Search/service/agent_tools.go:186-211` `trimHits()` 的投影(**不是** `service/search.go` 的 `Hit` 全量;`raw_score`/`collection`/`payload_extra` 都被投影掉了),`paths` 最多 3 条(`AgentMaxPaths`)、`preview.text` 最多 200 字符(`AgentMaxPreviewChar`);
   - `paths` 元素 = `service/parser_client.go:139-143` `FilePath{root_id, path, mtime_ms}`;
   - `cite` = `service/search.go:46-53` `Cite{page, offset_start, offset_end, frame_ms_start, frame_ms_end, chunk_no}`(前五个是指针,JSON 里可为 `null`);
   - images 元素 = `service/photos_client.go:13-25` `ImageHit{asset_id, name, path, score, taken_at?, thumbnail_url, caption?}`(`taken_at`/`caption` 带 `omitempty`,**可能整个键都不存在**);
   - notes 元素 = `service/notes_client.go:13-21`(本期不请求,只留类型)。
   **禁止凭印象补字段。**
8. **提交必须带显式 pathspec** —— `git add <具体路径>` **且 `git commit` 那行也带 pathspec**(写法:`git commit -m "..." -- <路径>`,`-m` 必须在 `--` 之前,否则 git 把它当 pathspec 报错)。**绝不 `add -A` / `commit -a` / `git reset`。**
9. **此工作树永远别 `git checkout` / `git stash` / `git reset`**(会卷走那 3 个 `design-export` 删除)。
10. **只在主工作树动手** —— `/home/nimo/NimoTech/NimoOS-New-UI`(master)与 `/home/nimo/NimoTech/NimoOS-Service`(master)。**不碰 `.sp7/` 和 `.sp8/`**(相册区 / AI 区并行开发中)。
11. **禁止对真机发写请求。** 本期后端调用只有一个 `POST /v1/ai/search/agent/tool`,它是只读查询。要补 fixture 就 `curl` 它或直连 `POST /v1/search/agent/tool -H 'X-NimoOS-User-ID: 1'`(免鉴权,只读)。
12. **评审禁用 haiku**,评审者必须自己读源文件,不能只看 diff 摘要。
13. **验收起 dev server:** `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273`。⛔ **不要用 `deploy.sh`** —— 设备上只有一个 `/var/lib/nimoos/www/app/`,`deploy.sh` 是 `rsync --delete`,三条并行线共用(master 5273 / `.sp7` 5277 / `.sp8` 5288),谁部署谁把另外两条的产物删掉。
14. **改了共享包必须重新构建再回来**:`cd ../NimoOS-Service && pnpm build`;New-UI 侧若报 `Module not found` 再 `pnpm install`。**dev server 的 Vite 依赖预打包缓存不看内容**,共享包改完后 dev 可能仍喂旧包 —— 本仓已用 `optimizeDeps.exclude` 修过一次,验收前仍要按第 15 条探活确认。
15. **验收前先跑 4 项探活**(P2 定的惯例):① `/app/` 返回 200;② 本期组件能被 dev 编译;③ **dev 交付的共享包 `.js` 里有 `agentTool`**;④ dev 代理真打到 `:80` 且拿到真实数据。

### 本期申报的两处规则补充(spec §7.4/§7.5 未覆盖,必须照此实现并写进台账)

- **A1 — `filenames` 的模糊命中也要有标签。** 后端 `match` 是模糊相关度(实测 `how to cook` 命中 `cookies.py`、`show.py`),spec §7.5 只写了「查询词是文件名子串」那一档。补:**既非精确、也非子串**的 `filenames` 命中给 `searchReasonFilenameFuzzy`(「文件名相关」,kind `semantic`),不能让这些行一个标签都没有。
- **A2 — 排名层 2 收所有剩余 `filenames`。** spec §7.4 层 2 写的是「文件名子串命中」,但模糊命中无处可去。补:**层 2 = 除层 1(精确)外的全部 `filenames` 命中,组内按 `match` 降序**;`match` 相同保持后端返回顺序。

### 任务门

**每个任务结束跑**:

```bash
pnpm vitest run src/home/search/ src/home/components/SearchDialog.test.ts
pnpm exec vue-tsc --noEmit
```

**例外 —— 这三种任务要跑全量 `pnpm test`**:动了共享包 `NimoOS-Service`(Task 0)、动了 `src/i18n/`(Task 5)、动了 `src/styles/`(本期预计无)。
共享包自己的门:`cd ../NimoOS-Service && pnpm test && pnpm build`。

**全量 `pnpm test` + `pnpm build` 另外在两个时点跑**:① 全分支终审前;② 交付验收前。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `NimoOS-Service/src/search.ts` | 创建 | `search` 域:打聚合端点 + 归一化。**不含视图模型** |
| `NimoOS-Service/src/search.test.ts` | 创建 | 上者的单测 |
| `NimoOS-Service/src/index.ts` | 修改 | 注册 `service.search` + 导出类型 |
| `src/home/search/types.ts` | 创建 | 视图层共享类型(`Reason` / `ResultRow` / `SearchView` / `DegradeState`),**无逻辑** |
| `src/home/search/reasons.ts` + `.test.ts` | 创建 | 命中 → reasons(**产 i18n key,不产文案**) |
| `src/home/search/buildSearchView.ts` + `.test.ts` | 创建 | 合并去重 + 五层排名 + 分类派生 + tab 计数 |
| `src/home/search/degrade.ts` + `.test.ts` | 创建 | `warnings` + 结果数 → 提示条 / 空态**状态码** |
| `src/home/search/useSearchQuery.ts` + `.test.ts` | 创建 | 请求生命周期 + 过期守卫 + 错误态 |
| `src/home/components/SearchDialog.vue` | 修改 | 删 demo、消费上述模块、渲染真实结果 |
| `src/home/components/SearchDialog.test.ts` | 重写 | 组件级行为(mock 共享包) |
| `src/i18n/zh_cn.sp9.ts` / `en_us.sp9.ts` | 修改 | 新增本期文案键 |

---

## Task 0: 共享包 `search` 域

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-Service/src/search.ts`
- Create: `/home/nimo/NimoTech/NimoOS-Service/src/search.test.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/index.ts`

**Interfaces:**
- Consumes: `AxiosInstance`(由 `index.ts` 的惰性 getter 注入,与 `createNetwork` 同型)
- Produces:
  - `createSearch(http: AxiosInstance)` → `{ agentTool(query: string, opts?: { sources?: SearchSource[]; topK?: number }): Promise<NormalizedAggregate> }`
  - 类型 `SearchSource` / `SearchFilePath` / `SearchCite` / `SemanticHit` / `FileNameHit` / `ImageHit` / `NoteHit` / `NormalizedAggregate`(下方 Step 3 有完整定义,后续任务全部依赖这组名字)

- [ ] **Step 1: 写失败的测试**

创建 `src/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSearch } from './search'

// 记录调用的 http 桩:post 记下 url + body,返回 postMap[url]
function stub(postMap: Record<string, unknown> = {}) {
  const calls: { url: string; body?: unknown }[] = []
  const http = {
    post: async (url: string, body: unknown) => {
      calls.push({ url, body })
      if (!(url in postMap)) throw new Error('unexpected url ' + url)
      return { data: postMap[url] }
    },
  } as unknown as AxiosInstance
  return { http, calls }
}

const URL = '/v1/ai/search/agent/tool'

// ── fixture ①:真机逐字响应(spec §7.10a,2026-08-04 curl,query=receipt)────────
// 注意三件事:semantic 是空数组(Parser 活着、零命中)、images/notes 是 null、
// warnings 只有 images_unavailable —— 「组为 null」与「warnings 含该源」不是同一件事。
const REAL_RECEIPT = {
  groups: {
    semantic: [],
    filenames: [
      { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtime_ms: 1784715139167, is_dir: false, match: 2 },
      { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtime_ms: 1783651328200, is_dir: false, match: 1.5 },
    ],
    images: null,
    notes: null,
  },
  stats: { fileindex_status: 'ready', total_candidates: 2 },
  warnings: ['images_unavailable'],
}

// ── fixture ②:semantic / images 组的形状(本机产不出非空组,逐字派生自 Go 结构体)──
// semantic 元素 = NimoOS-Search/service/agent_tools.go:186-211 trimHits() 的投影
//   (score/file_id/paths/mime/kind/cite/preview 七个键,没有 raw_score/collection/payload_extra)
// paths 元素   = service/parser_client.go:139-143 FilePath{root_id,path,mtime_ms}
// cite         = service/search.go:46-53 Cite(前五个字段是指针,JSON 里可为 null)
// images 元素  = service/photos_client.go:13-25 ImageHit(taken_at/caption 带 omitempty)
const SHAPED = {
  groups: {
    semantic: [
      {
        score: 0.83,
        file_id: 'a1b2c3',
        paths: [{ root_id: 'r1', path: '/DATA/Documents/Recipes/fish_recipe.docx', mtime_ms: 1783499966725 }],
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        kind: 'body',
        cite: { page: null, offset_start: null, offset_end: null, frame_ms_start: null, frame_ms_end: null, chunk_no: 3 },
        preview: { text: 'Pan-seared fish with lemon butter', thumbnail_url: null },
      },
    ],
    filenames: null,
    images: [
      { asset_id: 'asset-9', name: 'IMG_0042.jpg', path: '/DATA/Gallery/IMG_0042.jpg', score: 0.71, thumbnail_url: '/v1/photos/assets/asset-9/thumbnail' },
    ],
    notes: null,
  },
  stats: { fileindex_status: 'building', total_candidates: 2 },
  warnings: [],
}

describe('createSearch.agentTool —— 请求形状', () => {
  it('打 /v1/ai/search/agent/tool,body 是 nimoos_search 工具调用(蛇形 top_k)', async () => {
    const { http, calls } = stub({ [URL]: REAL_RECEIPT })
    await createSearch(http).agentTool('receipt')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(URL)
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'receipt', sources: ['semantic', 'filenames', 'images'], top_k: 20 },
    })
  })

  it('sources / topK 可覆盖', async () => {
    const { http, calls } = stub({ [URL]: REAL_RECEIPT })
    await createSearch(http).agentTool('receipt', { sources: ['filenames'], topK: 5 })
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'receipt', sources: ['filenames'], top_k: 5 },
    })
  })
})

describe('createSearch.agentTool —— 归一化', () => {
  it('真机响应:filenames 转驼峰,空组 null → [],stats/warnings 归位', async () => {
    const { http } = stub({ [URL]: REAL_RECEIPT })
    const agg = await createSearch(http).agentTool('receipt')
    expect(agg.filenames).toHaveLength(2)
    expect(agg.filenames[0]).toEqual({
      path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf',
      size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2,
    })
    expect(agg.semantic).toEqual([])
    expect(agg.images).toEqual([])   // null → []
    expect(agg.notes).toEqual([])    // null → []
    expect(agg.stats).toEqual({ fileindexStatus: 'ready', totalCandidates: 2 })
    expect(agg.warnings).toEqual(['images_unavailable'])
  })

  it('semantic 命中转驼峰,preview.text / paths / cite 原样带出', async () => {
    const { http } = stub({ [URL]: SHAPED })
    const agg = await createSearch(http).agentTool('fish')
    expect(agg.semantic).toHaveLength(1)
    const h = agg.semantic[0]
    expect(h.fileId).toBe('a1b2c3')
    expect(h.kind).toBe('body')
    expect(h.paths[0]).toEqual({ rootId: 'r1', path: '/DATA/Documents/Recipes/fish_recipe.docx', mtimeMs: 1783499966725 })
    expect(h.cite.chunkNo).toBe(3)
    expect(h.cite.page).toBeNull()
    expect(h.preview.text).toBe('Pan-seared fish with lemon butter')
  })

  it('images 命中转驼峰,omitempty 缺失的 takenAt / caption 退化成空串', async () => {
    const { http } = stub({ [URL]: SHAPED })
    const agg = await createSearch(http).agentTool('fish')
    expect(agg.images[0]).toEqual({
      assetId: 'asset-9', name: 'IMG_0042.jpg', path: '/DATA/Gallery/IMG_0042.jpg',
      score: 0.71, takenAt: '', thumbnailUrl: '/v1/photos/assets/asset-9/thumbnail', caption: '',
    })
    expect(agg.filenames).toEqual([])  // 这份 fixture 里 filenames 是 null
  })

  it('stats 缺键时退化成空串 / 0,不抛', async () => {
    const { http } = stub({ [URL]: { groups: { semantic: null, filenames: null, images: null, notes: null }, warnings: null } })
    const agg = await createSearch(http).agentTool('x')
    expect(agg.stats).toEqual({ fileindexStatus: '', totalCandidates: 0 })
    expect(agg.warnings).toEqual([])
  })

  it('响应里没有 groups → 抛错,绝不静默返回空结果', async () => {
    // spec §7.8 底线:AI 代理挂了/返回异形,必须让 UI 走「搜索服务不可用」而不是「没搜到」
    const { http } = stub({ [URL]: { message: 'internal error' } })
    await expect(createSearch(http).agentTool('x')).rejects.toThrow(/unexpected search response/)
  })

  it('响应体不是对象(null / 字符串)→ 同样抛错', async () => {
    const a = stub({ [URL]: null })
    await expect(createSearch(a.http).agentTool('x')).rejects.toThrow(/unexpected search response/)
    const b = stub({ [URL]: 'boom' })
    await expect(createSearch(b.http).agentTool('x')).rejects.toThrow(/unexpected search response/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run src/search.test.ts
```
预期:FAIL,`Failed to resolve import './search'`。

- [ ] **Step 3: 写实现**

创建 `src/search.ts`:

```ts
import type { AxiosInstance } from 'axios'

// search 域 = 四源聚合搜索。**入口是 NimoOS-AI 的代理**:
//   POST /v1/ai/search/agent/tool  →(AI 注入 X-NimoOS-User-ID 后转发)→ NimoOS-Search
// 直连 /v1/search/agent/tool 必 400 —— 网关从不注入 X-NimoOS-User-ID(spec §1.1),
// 而 Search 拿它做授权根目录过滤。代价:搜索从此依赖 nimoos-ai 在跑(spec §2,债务 D3)。
//
// ⚠️ 信封:**裸 JSON,零层 unwrap**(AI 代理用 c.Blob 原样透传 Search 的 AggregateResponse)。
// ⚠️ 未参与/无命中的组可能是 **null 也可能是 []**,两者都出现过(spec §7.10a):
//    null = 该源没跑(未请求/不可用);[] = 跑了但零命中。**归一化后统一成 []**,
//    「哪些源没参与」只能看 warnings,不能用「组是不是 null」去推。
export type SearchSource = 'semantic' | 'filenames' | 'images' | 'notes'

/** NimoOS-Search/service/parser_client.go:139-143 FilePath */
export interface SearchFilePath { rootId: string; path: string; mtimeMs: number }

/** NimoOS-Search/service/search.go:46-53 Cite —— 前五个字段后端是指针,JSON 里可为 null */
export interface SearchCite {
  page: number | null
  offsetStart: number | null
  offsetEnd: number | null
  frameMsStart: number | null
  frameMsEnd: number | null
  chunkNo: number
}

/** 语义命中。形状 = agent_tools.go:186-211 trimHits() 的投影(七个键),
 *  **不是** search.go 的 Hit 全量:raw_score / collection / payload_extra 都被投影掉了。
 *  paths 最多 3 条(AgentMaxPaths=3),preview.text 最多 200 字符(AgentMaxPreviewChar=200)。
 *  kind 后端是开放字符串,已知取值 body / transcript / ocr / caption / summary。 */
export interface SemanticHit {
  score: number
  fileId: string
  paths: SearchFilePath[]
  mime: string
  kind: string
  cite: SearchCite
  preview: { text: string }
}

/** NimoOS-Search/service/fileindex/index.go:29-37 FileNameHit。
 *  ⚠️ match 是**无上界**的模糊相关度(实测 2 / 1.5),不是 0–1,更不是百分比。
 *  ⚠️ is_dir=true 的目录项也会出现在结果里。 */
export interface FileNameHit {
  path: string; name: string; ext: string
  size: number; mtimeMs: number; isDir: boolean; match: number
}

/** NimoOS-Search/service/photos_client.go:13-25 ImageHit(taken_at / caption 带 omitempty) */
export interface ImageHit {
  assetId: string; name: string; path: string; score: number
  takenAt: string; thumbnailUrl: string; caption: string
}

/** NimoOS-Search/service/notes_client.go:13-21 NoteHit —— 本期不请求 notes 源(债务 D2),
 *  类型留着是为了让 NormalizedAggregate 与后端契约完整对齐。 */
export interface NoteHit {
  noteId: string; chunkNo: number; text: string
  type: string; status: string; updatedAt: number; score: number
}

export interface NormalizedAggregate {
  semantic: SemanticHit[]
  filenames: FileNameHit[]
  images: ImageHit[]
  notes: NoteHit[]
  stats: { fileindexStatus: string; totalCandidates: number }
  warnings: string[]
}

const DEFAULT_SOURCES: SearchSource[] = ['semantic', 'filenames', 'images']
const DEFAULT_TOP_K = 20

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}
function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function num(v: unknown): number { return typeof v === 'number' ? v : 0 }
function bool(v: unknown): boolean { return v === true }
function nullableNum(v: unknown): number | null { return typeof v === 'number' ? v : null }

function toFilePath(v: Record<string, unknown>): SearchFilePath {
  return { rootId: str(v.root_id), path: str(v.path), mtimeMs: num(v.mtime_ms) }
}

function toCite(v: unknown): SearchCite {
  const c = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    page: nullableNum(c.page),
    offsetStart: nullableNum(c.offset_start),
    offsetEnd: nullableNum(c.offset_end),
    frameMsStart: nullableNum(c.frame_ms_start),
    frameMsEnd: nullableNum(c.frame_ms_end),
    chunkNo: num(c.chunk_no),
  }
}

export function createSearch(http: AxiosInstance) {
  return {
    /** POST /v1/ai/search/agent/tool —— 四源聚合。只做归一化,不产视图模型(spec §7.2)。
     *  失败(HTTP 5xx / AI 不可达 / 响应异形)一律抛,由调用方渲染错误态 —— **不得静默返回空结果**。 */
    async agentTool(
      query: string,
      opts?: { sources?: SearchSource[]; topK?: number },
    ): Promise<NormalizedAggregate> {
      const res = await http.post('/v1/ai/search/agent/tool', {
        name: 'nimoos_search',
        arguments: {
          query,
          sources: opts?.sources ?? DEFAULT_SOURCES,
          top_k: opts?.topK ?? DEFAULT_TOP_K,
        },
      })
      const body = res.data as Record<string, unknown> | null
      if (!body || typeof body !== 'object' || !body.groups || typeof body.groups !== 'object') {
        // 异形响应绝不能退化成「四源全空」——那会在界面上伪装成「没搜到」。
        throw new Error('unexpected search response')
      }
      const g = body.groups as Record<string, unknown>
      const stats = (body.stats && typeof body.stats === 'object' ? body.stats : {}) as Record<string, unknown>
      return {
        semantic: arr(g.semantic).map((h) => ({
          score: num(h.score),
          fileId: str(h.file_id),
          paths: arr(h.paths).map(toFilePath),
          mime: str(h.mime),
          kind: str(h.kind),
          cite: toCite(h.cite),
          preview: { text: str((h.preview as Record<string, unknown> | undefined)?.text) },
        })),
        filenames: arr(g.filenames).map((h) => ({
          path: str(h.path), name: str(h.name), ext: str(h.ext),
          size: num(h.size), mtimeMs: num(h.mtime_ms), isDir: bool(h.is_dir), match: num(h.match),
        })),
        images: arr(g.images).map((h) => ({
          assetId: str(h.asset_id), name: str(h.name), path: str(h.path), score: num(h.score),
          takenAt: str(h.taken_at), thumbnailUrl: str(h.thumbnail_url), caption: str(h.caption),
        })),
        notes: arr(g.notes).map((h) => ({
          noteId: str(h.note_id), chunkNo: num(h.chunk_no), text: str(h.text),
          type: str(h.type), status: str(h.status), updatedAt: num(h.updated_at), score: num(h.score),
        })),
        stats: { fileindexStatus: str(stats.fileindex_status), totalCandidates: num(stats.total_candidates) },
        warnings: Array.isArray(body.warnings) ? (body.warnings as unknown[]).filter((w): w is string => typeof w === 'string') : [],
      }
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run src/search.test.ts
```
预期:PASS,10 例。

- [ ] **Step 5: 接线 `index.ts`**

三处改动,照 `kvm` 的写法:
1. 顶部 import:`import { createSearch } from './search.js'`
2. 类型导出行(`export type { KvmVM, ... } from './kvm.js'` 之后)新增一行:
   ```ts
   export type { SearchSource, SearchFilePath, SearchCite, SemanticHit, FileNameHit, ImageHit, NoteHit, NormalizedAggregate } from './search.js'
   ```
3. `service` 对象里新增惰性 getter(放在 `kvm` 之后):
   ```ts
   get search(): ReturnType<typeof createSearch> {
     return createSearch(getHttp() as AxiosInstance)
   },
   ```

- [ ] **Step 6: 共享包全量门 + 构建**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test && pnpm build
```
预期:全绿(基线 25 文件 / 188+ 例,本期 +1 文件 +10 例),`pnpm build` 零错。

- [ ] **Step 7: 变异验证**

临时把 `agentTool` 里 `if (!body || ... ) throw` 整段删掉,重跑 `pnpm vitest run src/search.test.ts` —— 预期最后两条(异形响应)翻红。确认后恢复,把实际输出写进任务报告。

- [ ] **Step 8: New-UI 侧确认能吃到新方法**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit
node -e "const s=require('../NimoOS-Service/dist/index.js'); console.log(Object.keys(s.service))" 2>/dev/null || grep -c "agentTool" ../NimoOS-Service/dist/search.js
```
预期:`vue-tsc` 零错;`dist/search.js` 里能 grep 到 `agentTool`。若 New-UI 报 `Module not found`,跑 `pnpm install` 重新同步 `file:` 链接。

- [ ] **Step 9: 提交(两个仓分别提,显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add -- src/search.ts src/search.test.ts src/index.ts
git commit -m "feat(search): search 域进共享包(agentTool 四源聚合 + 归一化)

- 入口是 AI 代理 POST /v1/ai/search/agent/tool(直连 Search 必 400,spec §1.1)
- 裸 JSON 零层信封;组为 null / [] 统一归一成 [],「哪些源没参与」只看 warnings
- 响应无 groups / 非对象一律抛错,不静默退化成四源全空(spec §7.8 底线)
- semantic/images fixture 逐字派生自 Go 结构体(本机产不出非空组),来源行号在测试注释里

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/search.ts src/search.test.ts src/index.ts
```

---

## Task 1: `types.ts` + `reasons.ts`(命中 → i18n key)

**Files:**
- Create: `src/home/search/types.ts`
- Create: `src/home/search/reasons.ts`
- Create: `src/home/search/reasons.test.ts`

**Interfaces:**
- Consumes: Task 0 的 `FileNameHit` / `SemanticHit`(从 `@nimotech/nimoos-service` 导入类型)
- Produces:
  - `types.ts`: `ReasonKind = 'primary' | 'normal' | 'semantic'`、`interface Reason { key: string; kind: ReasonKind }`、`ResultCategory`、`SourceBadge`、`ResultRow`、`SearchView`、`DegradeState`(完整定义见下,Task 2/3/4/5 全部依赖)
  - `reasons.ts`: `filenameReason(hit, query)` / `semanticReason(hit, query)` / `imageReason()`,各返回一个 `Reason`

**为什么产 key 不产文案:** 这四个模块要在 node 环境下单测,不能拖 vue-i18n 实例进来;而且文案将来改 zh/en 不该动逻辑测试。**渲染时才 `t(reason.key)`。**

- [ ] **Step 1: 写失败的测试**

创建 `src/home/search/reasons.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { FileNameHit, SemanticHit } from '@nimotech/nimoos-service'
import { filenameReason, semanticReason, imageReason } from './reasons'

function fn(name: string, over: Partial<FileNameHit> = {}): FileNameHit {
  return { path: '/DATA/x/' + name, name, ext: '', size: 0, mtimeMs: 0, isDir: false, match: 1, ...over }
}
function sem(kind: string, text: string, over: Partial<SemanticHit> = {}): SemanticHit {
  return {
    score: 0.5, fileId: 'f', paths: [{ rootId: 'r', path: '/DATA/x/a.docx', mtimeMs: 0 }],
    mime: 'application/pdf', kind,
    cite: { page: null, offsetStart: null, offsetEnd: null, frameMsStart: null, frameMsEnd: null, chunkNo: 0 },
    preview: { text }, ...over,
  }
}

describe('filenameReason', () => {
  it('文件名精确相等(忽略大小写)→ 文件名命中 primary', () => {
    expect(filenameReason(fn('Receipt.pdf'), 'receipt.pdf')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })

  it('查询词是文件名子串(忽略大小写)→ 文件名命中 primary', () => {
    expect(filenameReason(fn("Nick's receipt.jpg"), 'RECEIPT')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })

  it('既非精确也非子串(后端模糊命中)→ 文件名相关 semantic', () => {
    // 实测:query="how to cook" 后端会返回 cookies.py(match=1.5)。补充规则 A1。
    expect(filenameReason(fn('cookies.py'), 'how to cook')).toEqual({ key: 'searchReasonFilenameFuzzy', kind: 'semantic' })
  })

  it('查询词首尾空白不影响判定', () => {
    expect(filenameReason(fn('Receipt.pdf'), '  receipt  ')).toEqual({ key: 'searchReasonFilename', kind: 'primary' })
  })
})

describe('semanticReason', () => {
  it('kind=body → 正文命中 normal', () => {
    expect(semanticReason(sem('body', 'the fish was fresh'), 'fish')).toEqual({ key: 'searchReasonBody', kind: 'normal' })
  })
  it('kind=transcript → 转写命中 normal', () => {
    expect(semanticReason(sem('transcript', 'today we caught fish'), 'fish')).toEqual({ key: 'searchReasonTranscript', kind: 'normal' })
  })
  it('kind=ocr → 图片文字命中 normal', () => {
    expect(semanticReason(sem('ocr', 'HOME DEPOT receipt'), 'receipt')).toEqual({ key: 'searchReasonOcr', kind: 'normal' })
  })
  it('kind=caption → 图片内容命中 semantic', () => {
    expect(semanticReason(sem('caption', 'a plate of food'), 'fish')).toEqual({ key: 'searchReasonCaption', kind: 'semantic' })
  })
  it('查询词不出现在 preview.text 里 → 语义相关 semantic(即使 kind=body)', () => {
    expect(semanticReason(sem('body', 'salmon and tuna, no literal match'), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
  it('未知 kind(summary 等)→ 语义相关 semantic', () => {
    expect(semanticReason(sem('summary', 'this document is about fish'), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
  it('preview.text 为空 → 语义相关(无从判断字面命中)', () => {
    expect(semanticReason(sem('body', ''), 'fish')).toEqual({ key: 'searchReasonSemantic', kind: 'semantic' })
  })
})

describe('imageReason', () => {
  it('images 源 = CLIP 图片内容命中,复用 caption 那个标签', () => {
    expect(imageReason()).toEqual({ key: 'searchReasonCaption', kind: 'semantic' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/home/search/reasons.test.ts
```
预期:FAIL,`Failed to resolve import './reasons'`。

- [ ] **Step 3: 写实现**

创建 `src/home/search/types.ts`:

```ts
// Search 区视图层共享类型。**纯类型,零逻辑、零 Vue、零 i18n 依赖** ——
// reasons / buildSearchView / degrade 三个纯函数模块与组件共用这一份。
import type { ImageHit } from '@nimotech/nimoos-service'

/** 排序理由标签的语义色。沿用现有 .rz-* 样式;spec §7.5 删掉了 demote 档
 *  (后端没有任何降权信号,demo 里那个「Likely a person name · demoted」是编的)。 */
export type ReasonKind = 'primary' | 'normal' | 'semantic'

/** key = i18n 键名,**不是文案** —— 渲染时 t(key)。 */
export interface Reason { key: string; kind: ReasonKind }

export type ResultCategory = 'Documents' | 'Images' | 'Audio' | 'Videos'

/** 来源徽标三选一(spec §7.6:替换掉无法从后端诚实得出的准确率百分比)。 */
export type SourceBadge = 'semantic' | 'filename' | 'ocr'

/** 一行结果。同一真实路径命中多源时合成一行(spec §7.3)。 */
export interface ResultRow {
  /** 归并键 = 真实路径 */
  realPath: string
  name: string
  category: ResultCategory
  /** 图片 / 视频 → 走缩略图渲染(相册卡 / 媒体行) */
  isMedia: boolean
  /** filenames 源可能返回目录项(is_dir=true);目录不能预览,点击直接进文件夹 */
  isDir: boolean
  reasons: Reason[]
  badge: SourceBadge
  /** 摘要文本;只有 semantic 源有,其余为空串 */
  snippet: string
  /** 排名层(1–5,见 spec §7.4 + 本计划补充规则 A2);不展示,仅排序用 */
  layer: number
  /** 层内排序分。**跨层不可比**(filenames.match 无上界 / semantic.score 是向量相似度) */
  score: number
  /** images 源给的缩略图 URL。**本期不消费**(见 Task 5 注释),留着是为了不丢后端数据 */
  thumbnailUrl?: string
}

export interface SearchTab { key: string; count: number }

export interface SearchView {
  /** 已排序的全部行(层 → 层内分数 → 后端原序) */
  rows: ResultRow[]
  /** 非媒体行,保持 rows 的相对顺序 */
  docRows: ResultRow[]
  /** 媒体行(Images / Videos),保持 rows 的相对顺序 */
  mediaRows: ResultRow[]
  /** [全部结果, ...按命中数降序的分类];分类计数为 0 的不出现 */
  tabs: SearchTab[]
  total: number
}

/** 降级 / 空态的**状态码**,文案在组件里映射(spec §7.8)。 */
export interface DegradeState {
  /** 未参与本次搜索的源(已剥掉 _unavailable 后缀,notes 已过滤)。非空 → 结果区顶部挂提示条 */
  unavailableSources: string[]
  /** 认不出的 warning,原样透传给界面,不静默丢弃 */
  unknownWarnings: string[]
  /** 空态种类;'none' = 有结果,不显示空态 */
  empty: 'none' | 'no_roots' | 'backend_not_ready' | 'no_match'
}

export type { ImageHit }
```

创建 `src/home/search/reasons.ts`:

```ts
import type { FileNameHit, SemanticHit } from '@nimotech/nimoos-service'
import type { Reason } from './types'

// spec §7.5 的派生规则表。**产 i18n key,不产文案**(见计划 Task 1 说明)。
// 与 demo 时代写死的标签(Exact filename match / Body match ×9 / …)最大的不同:
// 那些计数(×9 / ×3)后端根本不返回,是编的,所以标签里不再有数字。

/** kind 已知取值 → 标签。后端 kind 是开放字符串,认不出的一律落「语义相关」。 */
const KIND_REASON: Record<string, Reason> = {
  body: { key: 'searchReasonBody', kind: 'normal' },
  transcript: { key: 'searchReasonTranscript', kind: 'normal' },
  ocr: { key: 'searchReasonOcr', kind: 'normal' },
  caption: { key: 'searchReasonCaption', kind: 'semantic' },
}

const SEMANTIC_REASON: Reason = { key: 'searchReasonSemantic', kind: 'semantic' }

/** filenames 源。后端 match 是模糊相关度,所以「查询词是文件名子串」不一定成立
 *  (实测 query="how to cook" 会命中 cookies.py)→ 补充规则 A1:模糊命中给「文件名相关」。 */
export function filenameReason(hit: FileNameHit, query: string): Reason {
  const q = query.trim().toLowerCase()
  const name = hit.name.toLowerCase()
  if (q && name.includes(q)) return { key: 'searchReasonFilename', kind: 'primary' }
  return { key: 'searchReasonFilenameFuzzy', kind: 'semantic' }
}

/** semantic 源。查询词字面出现在摘要里 → 按 kind 给具体标签;否则「语义相关」。 */
export function semanticReason(hit: SemanticHit, query: string): Reason {
  const q = query.trim().toLowerCase()
  const text = hit.preview.text.toLowerCase()
  if (!q || !text.includes(q)) return SEMANTIC_REASON
  return KIND_REASON[hit.kind] ?? SEMANTIC_REASON
}

/** images 源 = Photos 的 CLIP 语义命中,与 caption 同一语义,复用同一标签。 */
export function imageReason(): Reason {
  return { key: 'searchReasonCaption', kind: 'semantic' }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/home/search/reasons.test.ts && pnpm exec vue-tsc --noEmit
```
预期:PASS,12 例;`vue-tsc` 零错。

- [ ] **Step 5: 变异验证**

把 `semanticReason` 里 `if (!q || !text.includes(q)) return SEMANTIC_REASON` 临时改成直接 `return KIND_REASON[hit.kind] ?? SEMANTIC_REASON`,重跑 —— 预期「查询词不出现在 preview.text 里」与「preview.text 为空」两条翻红。恢复后把输出写进报告。

- [ ] **Step 6: 提交**

```bash
git add -- src/home/search/types.ts src/home/search/reasons.ts src/home/search/reasons.test.ts
git commit -m "feat(search): 视图层共享类型 + reasons 派生(产 i18n key 不产文案)

- spec §7.5 的规则表;demote 档按 spec 删除(后端无降权信号)
- 补充规则 A1:filenames 的模糊命中(非精确非子串)给「文件名相关」,
  否则 query=\"how to cook\" 命中 cookies.py 这类行一个标签都没有
- 标签里不再有 ×9 / ×3 这类计数 —— 后端不返回,demo 时代那是编的

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/home/search/types.ts src/home/search/reasons.ts src/home/search/reasons.test.ts
```

---

## Task 2: `buildSearchView.ts`(合并去重 + 五层排名 + 分类派生)

**Files:**
- Create: `src/home/search/buildSearchView.ts`
- Create: `src/home/search/buildSearchView.test.ts`

**Interfaces:**
- Consumes: Task 0 的 `NormalizedAggregate`;Task 1 的 `types.ts` 与 `reasons.ts`;既有 `src/files/util/fileCategories.ts` 的 `IMAGE_X_GENERIC` / `VIDEO_X_GENERIC` / `AUDIO_X_GENERIC`
- Produces: `buildSearchView(agg: NormalizedAggregate, query: string): SearchView`

**规则复述(实现必须逐条对上):**
- 归并键 = 真实路径:`semantic` 取 `paths[0].path`(**`paths` 为空的命中整条丢弃** —— 没有路径就无法预览/定位),`filenames` 取 `path`,`images` 取 `path`。
- 同路径多源 → 合成一行,`reasons` 去重累加(按 `key` 去重),`layer` 取**最小**(排名最靠前的那层),`score` 取该层对应源的分数。
- `badge` 优先级:含 `filenames` 源 → `filename`;否则含 `kind==='ocr'` 的 semantic → `ocr`;否则 `semantic`。
- 排名层:1 = 文件名**精确**(`name` 忽略大小写全等 query);2 = 其余全部 `filenames`(补充规则 A2),组内 `match` 降序;3 = `semantic` 的 `kind ∈ {body, transcript}`,`score` 降序;4 = `images` ∪ `semantic.kind==='ocr'`,`score` 降序;5 = `semantic` 其余 kind,`score` 降序。**层内相同分数保持后端返回顺序(稳定排序)。**
- 分类:`filenames` 看 `ext`;`semantic` 先看 `mime` 前缀(`image/`→Images、`video/`→Videos、`audio/`→Audio),无匹配再看路径扩展名;`images` 恒 Images。都不匹配 → Documents(**目录项也落 Documents**)。
- `tabs` = `[{key:'all', count: total}, ...计数>0 的分类按计数降序]`。

- [ ] **Step 1: 写失败的测试**

创建 `src/home/search/buildSearchView.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { buildSearchView } from './buildSearchView'

function agg(over: Partial<NormalizedAggregate> = {}): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings: [], ...over,
  }
}
function fn(name: string, match: number, over: Partial<NormalizedAggregate['filenames'][number]> = {}) {
  return { path: '/DATA/Documents/' + name, name, ext: name.split('.').pop() ?? '', size: 1, mtimeMs: 1, isDir: false, match, ...over }
}
function sem(path: string, kind: string, score: number, mime = 'application/pdf', text = '') {
  return {
    score, fileId: path, paths: [{ rootId: 'r', path, mtimeMs: 0 }], mime, kind,
    cite: { page: null, offsetStart: null, offsetEnd: null, frameMsStart: null, frameMsEnd: null, chunkNo: 0 },
    preview: { text },
  }
}
function img(path: string, score: number) {
  return { assetId: 'a', name: path.split('/').pop() ?? '', path, score, takenAt: '', thumbnailUrl: '/thumb', caption: '' }
}

describe('buildSearchView —— 排名分层', () => {
  it('层 1 精确文件名命中排在层 2 子串命中之前,哪怕 match 更低', () => {
    const v = buildSearchView(agg({ filenames: [fn('other-receipt.pdf', 9), fn('receipt.pdf', 1)] }), 'receipt.pdf')
    expect(v.rows.map((r) => r.name)).toEqual(['receipt.pdf', 'other-receipt.pdf'])
  })

  it('层 2 内部按 match 降序', () => {
    const v = buildSearchView(agg({ filenames: [fn('b-receipt.pdf', 1.5), fn('a-receipt.pdf', 2)] }), 'receipt')
    expect(v.rows.map((r) => r.name)).toEqual(['a-receipt.pdf', 'b-receipt.pdf'])
  })

  it('层 2 内 match 相同时保持后端返回顺序(稳定排序)', () => {
    const v = buildSearchView(agg({ filenames: [fn('z-receipt.pdf', 2), fn('a-receipt.pdf', 2)] }), 'receipt')
    expect(v.rows.map((r) => r.name)).toEqual(['z-receipt.pdf', 'a-receipt.pdf'])
  })

  it('全部五层的相对顺序:filenames 精确 → filenames 其余 → body/transcript → images/ocr → 其余 kind', () => {
    const v = buildSearchView(
      agg({
        filenames: [fn('fish.txt', 1), fn('other.txt', 3)],
        semantic: [
          sem('/DATA/s/summary.pdf', 'summary', 0.9),
          sem('/DATA/s/ocr.png', 'ocr', 0.4, 'image/png'),
          sem('/DATA/s/body.pdf', 'body', 0.2),
        ],
        images: [img('/DATA/g/photo.jpg', 0.95)],
      }),
      'fish.txt',
    )
    expect(v.rows.map((r) => r.realPath)).toEqual([
      '/DATA/Documents/fish.txt',   // 层 1
      '/DATA/Documents/other.txt',  // 层 2
      '/DATA/s/body.pdf',           // 层 3
      '/DATA/g/photo.jpg',          // 层 4(images 0.95 > ocr 0.4)
      '/DATA/s/ocr.png',            // 层 4
      '/DATA/s/summary.pdf',        // 层 5(分数最高也垫底 —— 跨层不比分数)
    ])
  })
})

describe('buildSearchView —— 合并去重', () => {
  it('同一路径命中 filenames + semantic → 一行,reasons 累加,层取更靠前的', () => {
    const p = '/DATA/Documents/receipt.pdf'
    const v = buildSearchView(
      agg({
        filenames: [{ path: p, name: 'receipt.pdf', ext: 'pdf', size: 1, mtimeMs: 1, isDir: false, match: 2 }],
        semantic: [sem(p, 'body', 0.8, 'application/pdf', 'the receipt total was 55.72')],
      }),
      'receipt',
    )
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].reasons.map((r) => r.key)).toEqual(['searchReasonFilename', 'searchReasonBody'])
    expect(v.rows[0].layer).toBe(2)          // filenames 子串命中的层,比 semantic 的层 3 靠前
    expect(v.rows[0].badge).toBe('filename') // filenames 参与 → 徽标是文件名
    expect(v.rows[0].snippet).toBe('the receipt total was 55.72') // 摘要来自 semantic
  })

  it('reasons 按 key 去重(同一路径两条 semantic 同 kind 只留一个标签)', () => {
    const p = '/DATA/s/a.pdf'
    const v = buildSearchView(agg({ semantic: [sem(p, 'body', 0.9, 'application/pdf', 'fish'), sem(p, 'body', 0.5, 'application/pdf', 'fish')] }), 'fish')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].reasons.map((r) => r.key)).toEqual(['searchReasonBody'])
    expect(v.rows[0].score).toBe(0.9) // 取更高分那条
  })

  it('semantic 的 paths 为空 → 整条丢弃(没有路径就无法定位/预览)', () => {
    const bad = { ...sem('/x', 'body', 0.9), paths: [] }
    const v = buildSearchView(agg({ semantic: [bad] }), 'x')
    expect(v.rows).toEqual([])
    expect(v.total).toBe(0)
  })

  it('semantic 命中 OCR 且路径同时被 images 命中 → 一行,徽标是 ocr', () => {
    const p = '/DATA/Documents/life/receipt.jpg'
    const v = buildSearchView(agg({ semantic: [sem(p, 'ocr', 0.6, 'image/jpeg', 'HOME DEPOT')], images: [img(p, 0.7)] }), 'depot')
    expect(v.rows).toHaveLength(1)
    expect(v.rows[0].badge).toBe('ocr')
    expect(v.rows[0].isMedia).toBe(true)
  })
})

describe('buildSearchView —— 分类与 tab', () => {
  it('filenames 按扩展名分类,semantic 按 mime 前缀分类', () => {
    const v = buildSearchView(
      agg({
        filenames: [fn('a.jpg', 2), fn('b.mp4', 2), fn('c.wav', 2), fn('d.pdf', 2)],
        semantic: [sem('/DATA/s/e.png', 'ocr', 0.5, 'image/png'), sem('/DATA/s/f.mp3', 'transcript', 0.5, 'audio/mpeg')],
      }),
      'x',
    )
    const cat = (p: string) => v.rows.find((r) => r.realPath.endsWith(p))!.category
    expect(cat('a.jpg')).toBe('Images')
    expect(cat('b.mp4')).toBe('Videos')
    expect(cat('c.wav')).toBe('Audio')
    expect(cat('d.pdf')).toBe('Documents')
    expect(cat('e.png')).toBe('Images')
    expect(cat('f.mp3')).toBe('Audio')
  })

  it('无 mime 的 semantic 退回看路径扩展名', () => {
    const v = buildSearchView(agg({ semantic: [sem('/DATA/s/clip.mp4', 'transcript', 0.5, '')] }), 'x')
    expect(v.rows[0].category).toBe('Videos')
  })

  it('目录项(is_dir)落 Documents 且 isDir=true、isMedia=false', () => {
    const v = buildSearchView(agg({ filenames: [{ path: '/DATA/Gallery/Fishing', name: 'Fishing', ext: '', size: 0, mtimeMs: 0, isDir: true, match: 2 }] }), 'fish')
    expect(v.rows[0].category).toBe('Documents')
    expect(v.rows[0].isDir).toBe(true)
    expect(v.rows[0].isMedia).toBe(false)
  })

  it('tabs = 全部结果 + 计数>0 的分类按计数降序,计数为 0 的分类不出现', () => {
    const v = buildSearchView(agg({ filenames: [fn('a.pdf', 2), fn('b.pdf', 2), fn('c.jpg', 2)] }), 'x')
    expect(v.tabs).toEqual([{ key: 'all', count: 3 }, { key: 'Documents', count: 2 }, { key: 'Images', count: 1 }])
    expect(v.total).toBe(3)
  })

  it('docRows / mediaRows 按 isMedia 拆分且保持 rows 的相对顺序', () => {
    const v = buildSearchView(agg({ filenames: [fn('a.jpg', 3), fn('b.pdf', 2), fn('c.jpg', 1)] }), 'x')
    expect(v.docRows.map((r) => r.name)).toEqual(['b.pdf'])
    expect(v.mediaRows.map((r) => r.name)).toEqual(['a.jpg', 'c.jpg'])
  })
})

describe('buildSearchView —— 真机响应端到端', () => {
  // spec §7.10a 的真机响应(query=receipt)归一化后的样子
  it('两条 filenames 命中 → 两行,一个文档一个图片', () => {
    const v = buildSearchView(
      agg({
        filenames: [
          { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2 },
          { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtimeMs: 1783651328200, isDir: false, match: 1.5 },
        ],
        stats: { fileindexStatus: 'ready', totalCandidates: 2 },
        warnings: ['images_unavailable'],
      }),
      'receipt',
    )
    expect(v.total).toBe(2)
    expect(v.rows.map((r) => r.badge)).toEqual(['filename', 'filename'])
    expect(v.docRows).toHaveLength(1)
    expect(v.mediaRows).toHaveLength(1)
    expect(v.rows[0].snippet).toBe('')  // filenames 源没有摘要
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run src/home/search/buildSearchView.test.ts
```
预期:FAIL,`Failed to resolve import './buildSearchView'`。

- [ ] **Step 3: 写实现**

创建 `src/home/search/buildSearchView.ts`:

```ts
import type { NormalizedAggregate, FileNameHit, SemanticHit, ImageHit } from '@nimotech/nimoos-service'
import { IMAGE_X_GENERIC, VIDEO_X_GENERIC, AUDIO_X_GENERIC } from '../../files/util/fileCategories'
import { filenameReason, semanticReason, imageReason } from './reasons'
import type { Reason, ResultCategory, ResultRow, SearchTab, SearchView, SourceBadge } from './types'

// spec §7.3/§7.4/§7.7:把四组互不可比的命中合成一份可渲染的排序列表。
//
// ⚠️ 四组分数**不做跨源归一化** —— filenames.match 无上界(实测 2 / 1.5)、
//    semantic.score 是向量相似度、images.score 是 CLIP 相似度,强行归一只会编出
//    一个假的可比性(demo 时代那个「98%」就是这么来的)。改用**分层**:层间只比层号,
//    层内才比分数。
// ⚠️ 排序必须**稳定** —— 同层同分保持后端返回顺序。Array.prototype.sort 在 V8 上
//    已是稳定排序,但这里仍显式带上入序 seq 作为最后一级比较键,不依赖引擎实现。

const LAYER_FILENAME_EXACT = 1
const LAYER_FILENAME_REST = 2
const LAYER_SEMANTIC_TEXT = 3
const LAYER_VISUAL = 4
const LAYER_SEMANTIC_REST = 5

function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i + 1).toLowerCase() : ''
}

function categoryOfExt(ext: string): ResultCategory {
  const e = ext.toLowerCase()
  if (IMAGE_X_GENERIC.includes(e)) return 'Images'
  if (VIDEO_X_GENERIC.includes(e)) return 'Videos'
  if (AUDIO_X_GENERIC.includes(e)) return 'Audio'
  return 'Documents'
}

function categoryOfMime(mime: string, path: string): ResultCategory {
  if (mime.startsWith('image/')) return 'Images'
  if (mime.startsWith('video/')) return 'Videos'
  if (mime.startsWith('audio/')) return 'Audio'
  return categoryOfExt(extOf(path))
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

// 累积中的一行。合并靠 realPath 做键。
interface Draft {
  realPath: string
  name: string
  category: ResultCategory
  isDir: boolean
  reasons: Reason[]
  snippet: string
  layer: number
  score: number
  seq: number
  fromFilename: boolean
  fromOcr: boolean
  thumbnailUrl?: string
}

function badgeOf(d: Draft): SourceBadge {
  if (d.fromFilename) return 'filename'
  if (d.fromOcr) return 'ocr'
  return 'semantic'
}

export function buildSearchView(agg: NormalizedAggregate, query: string): SearchView {
  const q = query.trim().toLowerCase()
  const byPath = new Map<string, Draft>()
  let seq = 0

  function merge(next: Omit<Draft, 'seq'>): void {
    const cur = byPath.get(next.realPath)
    if (!cur) {
      byPath.set(next.realPath, { ...next, seq: seq++ })
      return
    }
    // 层号取更靠前的那个;分数跟着被选中的层走(跨层的分数不可比,不能取 max)
    if (next.layer < cur.layer || (next.layer === cur.layer && next.score > cur.score)) {
      cur.layer = next.layer
      cur.score = next.score
    }
    for (const r of next.reasons) if (!cur.reasons.some((x) => x.key === r.key)) cur.reasons.push(r)
    if (!cur.snippet && next.snippet) cur.snippet = next.snippet
    if (!cur.thumbnailUrl && next.thumbnailUrl) cur.thumbnailUrl = next.thumbnailUrl
    cur.fromFilename = cur.fromFilename || next.fromFilename
    cur.fromOcr = cur.fromOcr || next.fromOcr
    cur.isDir = cur.isDir || next.isDir
    // category 以先到的为准:filenames 先入队,它的 ext 判定比 mime 更贴近用户看到的文件名
  }

  for (const h of agg.filenames as FileNameHit[]) {
    const exact = !!q && h.name.toLowerCase() === q
    merge({
      realPath: h.path,
      name: h.name || nameOf(h.path),
      category: h.isDir ? 'Documents' : categoryOfExt(h.ext || extOf(h.path)),
      isDir: h.isDir,
      reasons: [filenameReason(h, query)],
      snippet: '',
      layer: exact ? LAYER_FILENAME_EXACT : LAYER_FILENAME_REST,
      score: h.match,
      fromFilename: true,
      fromOcr: false,
    })
  }

  for (const h of agg.semantic as SemanticHit[]) {
    const path = h.paths[0]?.path
    if (!path) continue // 无路径 → 无法预览/定位,整条丢弃
    const isOcr = h.kind === 'ocr'
    const layer =
      h.kind === 'body' || h.kind === 'transcript' ? LAYER_SEMANTIC_TEXT
      : isOcr ? LAYER_VISUAL
      : LAYER_SEMANTIC_REST
    merge({
      realPath: path,
      name: nameOf(path),
      category: categoryOfMime(h.mime, path),
      isDir: false,
      reasons: [semanticReason(h, query)],
      snippet: h.preview.text,
      layer,
      score: h.score,
      fromFilename: false,
      fromOcr: isOcr,
    })
  }

  for (const h of agg.images as ImageHit[]) {
    merge({
      realPath: h.path,
      name: h.name || nameOf(h.path),
      category: 'Images',
      isDir: false,
      reasons: [imageReason()],
      snippet: h.caption,
      layer: LAYER_VISUAL,
      score: h.score,
      fromFilename: false,
      fromOcr: false,
      thumbnailUrl: h.thumbnailUrl,
    })
  }

  const rows: ResultRow[] = [...byPath.values()]
    .sort((a, b) => a.layer - b.layer || b.score - a.score || a.seq - b.seq)
    .map((d) => ({
      realPath: d.realPath,
      name: d.name,
      category: d.category,
      isMedia: !d.isDir && (d.category === 'Images' || d.category === 'Videos'),
      isDir: d.isDir,
      reasons: d.reasons,
      badge: badgeOf(d),
      snippet: d.snippet,
      layer: d.layer,
      score: d.score,
      thumbnailUrl: d.thumbnailUrl,
    }))

  const counts: Record<ResultCategory, number> = { Documents: 0, Images: 0, Audio: 0, Videos: 0 }
  for (const r of rows) counts[r.category]++
  const tabs: SearchTab[] = [
    { key: 'all', count: rows.length },
    ...(['Documents', 'Images', 'Audio', 'Videos'] as ResultCategory[])
      .map((k) => ({ key: k, count: counts[k] }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count),
  ]

  return {
    rows,
    docRows: rows.filter((r) => !r.isMedia),
    mediaRows: rows.filter((r) => r.isMedia),
    tabs,
    total: rows.length,
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/home/search/buildSearchView.test.ts && pnpm exec vue-tsc --noEmit
```
预期:PASS,14 例;`vue-tsc` 零错。

- [ ] **Step 5: 变异验证(两处)**

① 把 `.sort()` 的 `a.layer - b.layer ||` 去掉,重跑 —— 预期「五层相对顺序」那条翻红。
② 把 `merge()` 里 `if (next.layer < cur.layer …)` 整个 if 删掉,重跑 —— 预期「同一路径命中 filenames + semantic」那条的 `layer` 断言翻红。
两次都恢复,把实际输出写进报告。

- [ ] **Step 6: 提交**

```bash
git add -- src/home/search/buildSearchView.ts src/home/search/buildSearchView.test.ts
git commit -m "feat(search): buildSearchView(合并去重 + 五层排名 + 分类派生)

- 四源分数不做跨源归一化(spec §7.4),改分层;层内才比分数,显式带 seq 保稳定
- 补充规则 A2:层 2 收所有非精确的 filenames 命中(spec 只写了子串那一档,
  但后端 match 是模糊的,模糊命中无处可去)
- semantic 的 paths 为空整条丢弃 —— 没有路径就无法预览/定位
- 目录项(is_dir)如实保留、落 Documents、isMedia=false

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/home/search/buildSearchView.ts src/home/search/buildSearchView.test.ts
```

---

## Task 3: `degrade.ts`(降级与空态状态码)

**Files:**
- Create: `src/home/search/degrade.ts`
- Create: `src/home/search/degrade.test.ts`

**Interfaces:**
- Consumes: Task 0 的 `NormalizedAggregate`;Task 1 的 `DegradeState`
- Produces: `deriveDegrade(agg: NormalizedAggregate, totalRows: number): DegradeState`

**规则(spec §7.8):**

| 情形 | `unavailableSources` | `empty` |
|---|---|---|
| `warnings` 含 `<源>_unavailable` | 剥掉后缀的源名(`notes` 过滤掉,本期不请求) | 按下面几行 |
| `warnings` 含 `no_accessible_roots` | 同上 | `'no_roots'` |
| 结果为 0 且有 warning | 同上 | `'backend_not_ready'` |
| 结果为 0 且无 warning | `[]` | `'no_match'` |
| 结果 > 0 | 同上 | `'none'` |

认不出的 warning 进 `unknownWarnings` 原样透出,**不静默丢弃**。

- [ ] **Step 1: 写失败的测试**

创建 `src/home/search/degrade.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import { deriveDegrade } from './degrade'

function agg(warnings: string[]): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings,
  }
}

describe('deriveDegrade', () => {
  it('真机常态:images_unavailable + 有结果 → 挂提示条,不显示空态', () => {
    expect(deriveDegrade(agg(['images_unavailable']), 2)).toEqual({
      unavailableSources: ['images'], unknownWarnings: [], empty: 'none',
    })
  })

  it('多个源不可用全部列出,顺序照 warnings', () => {
    const d = deriveDegrade(agg(['semantic_unavailable', 'images_unavailable']), 1)
    expect(d.unavailableSources).toEqual(['semantic', 'images'])
  })

  it('notes_unavailable 过滤掉 —— 本期根本不请求 notes 源,报它只会让人困惑', () => {
    const d = deriveDegrade(agg(['notes_unavailable', 'images_unavailable']), 1)
    expect(d.unavailableSources).toEqual(['images'])
  })

  it('no_accessible_roots → 空态 no_roots(与「没搜到」区分),且不算进不可用源', () => {
    const d = deriveDegrade(agg(['no_accessible_roots']), 0)
    expect(d.empty).toBe('no_roots')
    expect(d.unavailableSources).toEqual([])
  })

  it('no_accessible_roots 优先于 backend_not_ready(即使同时有源不可用)', () => {
    const d = deriveDegrade(agg(['no_accessible_roots', 'images_unavailable']), 0)
    expect(d.empty).toBe('no_roots')
  })

  it('零结果 + 有 warning → backend_not_ready(不是「没找到」)', () => {
    expect(deriveDegrade(agg(['semantic_unavailable']), 0).empty).toBe('backend_not_ready')
  })

  it('零结果 + 无 warning → no_match', () => {
    expect(deriveDegrade(agg([]), 0).empty).toBe('no_match')
  })

  it('有结果 + 无 warning → 什么都不提示', () => {
    expect(deriveDegrade(agg([]), 3)).toEqual({ unavailableSources: [], unknownWarnings: [], empty: 'none' })
  })

  it('认不出的 warning 原样透出,不静默丢弃', () => {
    const d = deriveDegrade(agg(['quota_exceeded', 'images_unavailable']), 1)
    expect(d.unknownWarnings).toEqual(['quota_exceeded'])
    expect(d.unavailableSources).toEqual(['images'])
  })

  it('零结果 + 只有认不出的 warning → 仍算 backend_not_ready', () => {
    expect(deriveDegrade(agg(['quota_exceeded']), 0).empty).toBe('backend_not_ready')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run src/home/search/degrade.test.ts
```
预期:FAIL,`Failed to resolve import './degrade'`。

- [ ] **Step 3: 写实现**

创建 `src/home/search/degrade.ts`:

```ts
import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import type { DegradeState } from './types'

// spec §7.8。本区最重要的可见行为:本机四源里两源不可用,用户必须看得出
// 「这次只搜了文件名」,而不是以为搜索就这点结果。
//
// ⚠️ 「组是不是空」不能用来推「该源有没有参与」—— 实测 semantic 会返回 [](跑了,零命中),
//    也会返回 null(没跑)。**唯一可靠的信号是 warnings。**(spec §7.10a)
// ⚠️ notes 源本期不请求(债务 D2)。真收到 notes_unavailable 也不展示:
//    对用户说「笔记搜索不可用」而我们压根没搜笔记,是误导。

const UNAVAILABLE_SUFFIX = '_unavailable'
const KNOWN_SOURCES = ['semantic', 'filenames', 'images']
const NO_ROOTS = 'no_accessible_roots'

export function deriveDegrade(agg: NormalizedAggregate, totalRows: number): DegradeState {
  const unavailableSources: string[] = []
  const unknownWarnings: string[] = []
  let noRoots = false

  for (const w of agg.warnings) {
    if (w === NO_ROOTS) { noRoots = true; continue }
    if (w.endsWith(UNAVAILABLE_SUFFIX)) {
      const src = w.slice(0, -UNAVAILABLE_SUFFIX.length)
      if (src === 'notes') continue          // 本期不请求 notes,报它是误导
      if (KNOWN_SOURCES.includes(src)) { unavailableSources.push(src); continue }
    }
    unknownWarnings.push(w)                  // 认不出的原样透出,不静默丢
  }

  const empty: DegradeState['empty'] =
    noRoots ? 'no_roots'
    : totalRows > 0 ? 'none'
    : agg.warnings.length > 0 ? 'backend_not_ready'
    : 'no_match'

  return { unavailableSources, unknownWarnings, empty }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/home/search/degrade.test.ts && pnpm exec vue-tsc --noEmit
```
预期:PASS,10 例。

- [ ] **Step 5: 变异验证**

把 `if (src === 'notes') continue` 删掉重跑 —— 预期「notes_unavailable 过滤掉」翻红。恢复,输出写进报告。

- [ ] **Step 6: 提交**

```bash
git add -- src/home/search/degrade.ts src/home/search/degrade.test.ts
git commit -m "feat(search): degrade 降级态派生(warnings → 提示条 / 空态状态码)

- 「哪些源没参与」只认 warnings,不用「组是不是空」去推(spec §7.10a)
- notes_unavailable 过滤:本期不请求 notes,报它是误导
- 零结果时区分 backend_not_ready / no_roots / no_match 三种空态
- 认不出的 warning 原样透出,不静默丢弃

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/home/search/degrade.ts src/home/search/degrade.test.ts
```

---

## Task 4: `useSearchQuery.ts`(请求生命周期 + 过期守卫)

**Files:**
- Create: `src/home/search/useSearchQuery.ts`
- Create: `src/home/search/useSearchQuery.test.ts`

**Interfaces:**
- Consumes: `service.search.agentTool`(Task 0)、`buildSearchView`(Task 2)、`deriveDegrade`(Task 3)
- Produces:
  ```ts
  useSearchQuery(): {
    query: Ref<string>
    state: Ref<'idle' | 'searching' | 'done' | 'error'>
    view: Ref<SearchView | null>
    degrade: Ref<DegradeState | null>
    errorDetail: Ref<string>
    run(): Promise<void>
    reset(): void
  }
  ```

**过期守卫是本任务的核心。** 用户改词后再搜,先发的请求可能后回来;没有守卫就会用旧结果覆盖新结果。就地写 `let epoch`,**不要抽公共 guard**(过早抽象,SP9 已明令)。

- [ ] **Step 1: 写失败的测试**

创建 `src/home/search/useSearchQuery.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'

const agentTool = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { search: { agentTool: (...a: unknown[]) => agentTool(...a) } } }))

import { useSearchQuery } from './useSearchQuery'

function aggWith(names: string[], warnings: string[] = []): NormalizedAggregate {
  return {
    semantic: [], images: [], notes: [],
    filenames: names.map((n, i) => ({ path: '/DATA/Documents/' + n, name: n, ext: n.split('.').pop() ?? '', size: 1, mtimeMs: 1, isDir: false, match: 2 - i * 0.1 })),
    stats: { fileindexStatus: 'ready', totalCandidates: names.length }, warnings,
  }
}

beforeEach(() => { agentTool.mockReset() })

describe('useSearchQuery', () => {
  it('初始是 idle,view / degrade 都是 null', () => {
    const s = useSearchQuery()
    expect(s.state.value).toBe('idle')
    expect(s.view.value).toBeNull()
    expect(s.degrade.value).toBeNull()
  })

  it('空白查询词不发请求', async () => {
    const s = useSearchQuery()
    s.query.value = '   '
    await s.run()
    expect(agentTool).not.toHaveBeenCalled()
    expect(s.state.value).toBe('idle')
  })

  it('成功:searching → done,view 与 degrade 都填上,查询词已 trim', async () => {
    agentTool.mockResolvedValue(aggWith(['Receipt.pdf'], ['images_unavailable']))
    const s = useSearchQuery()
    s.query.value = '  receipt  '
    const p = s.run()
    expect(s.state.value).toBe('searching')
    await p
    expect(agentTool).toHaveBeenCalledWith('receipt')
    expect(s.state.value).toBe('done')
    expect(s.view.value?.total).toBe(1)
    expect(s.degrade.value?.unavailableSources).toEqual(['images'])
  })

  it('失败:state=error,errorDetail 取后端 message,view 不被写成空结果', async () => {
    agentTool.mockRejectedValue(new Error('ai service unreachable'))
    const s = useSearchQuery()
    s.query.value = 'receipt'
    await s.run()
    expect(s.state.value).toBe('error')
    expect(s.errorDetail.value).toBe('ai service unreachable')
    expect(s.view.value).toBeNull()   // 绝不静默显示空结果(spec §7.8)
  })

  it('过期守卫:先发的慢请求后回来,不许覆盖后发请求的结果', async () => {
    // 交错路径:run#1 挂起 → run#2 立刻完成 → run#1 才 resolve
    let resolveFirst: (v: NormalizedAggregate) => void = () => {}
    agentTool
      .mockImplementationOnce(() => new Promise<NormalizedAggregate>((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(aggWith(['NEW.pdf']))

    const s = useSearchQuery()
    s.query.value = 'old'
    const first = s.run()
    s.query.value = 'new'
    await s.run()
    expect(s.view.value?.rows[0].name).toBe('NEW.pdf')

    resolveFirst(aggWith(['OLD.pdf']))
    await first
    expect(s.view.value?.rows[0].name).toBe('NEW.pdf')  // 仍是新的
    expect(s.state.value).toBe('done')
  })

  it('过期守卫:过期的失败请求不许把界面打成 error', async () => {
    let rejectFirst: (e: Error) => void = () => {}
    agentTool
      .mockImplementationOnce(() => new Promise((_, rj) => { rejectFirst = rj }))
      .mockResolvedValueOnce(aggWith(['NEW.pdf']))

    const s = useSearchQuery()
    s.query.value = 'old'
    const first = s.run()
    s.query.value = 'new'
    await s.run()

    rejectFirst(new Error('stale failure'))
    await first
    expect(s.state.value).toBe('done')
    expect(s.errorDetail.value).toBe('')
  })

  it('reset 清回 idle 并作废在途请求', async () => {
    let resolveIt: (v: NormalizedAggregate) => void = () => {}
    agentTool.mockImplementationOnce(() => new Promise<NormalizedAggregate>((r) => { resolveIt = r }))
    const s = useSearchQuery()
    s.query.value = 'receipt'
    const p = s.run()
    s.reset()
    expect(s.state.value).toBe('idle')
    resolveIt(aggWith(['LATE.pdf']))
    await p
    expect(s.view.value).toBeNull()   // 在途结果不许落地
    expect(s.state.value).toBe('idle')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run src/home/search/useSearchQuery.test.ts
```
预期:FAIL,`Failed to resolve import './useSearchQuery'`。

- [ ] **Step 3: 写实现**

创建 `src/home/search/useSearchQuery.ts`:

```ts
import { ref, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { buildSearchView } from './buildSearchView'
import { deriveDegrade } from './degrade'
import type { DegradeState, SearchView } from './types'

// 搜索请求的生命周期。组件只管渲染,不碰请求。
//
// ⚠️ 过期守卫(就地 epoch,不抽公共 guard):用户改词后再搜,先发的请求可能后回来。
//    没有守卫 → 旧结果覆盖新结果 / 旧请求的失败把已经成功的界面打成 error。
//    reset() 同样递增 epoch,让在途结果作废(关掉面板后不许再往里写)。
// ⚠️ 失败时**不写 view** —— spec §7.8 底线:AI 不可达要显示「搜索服务不可用 + 重试」,
//    绝不能退化成一个看起来像「没搜到」的空列表。

export type SearchState = 'idle' | 'searching' | 'done' | 'error'

export function useSearchQuery(): {
  query: Ref<string>
  state: Ref<SearchState>
  view: Ref<SearchView | null>
  degrade: Ref<DegradeState | null>
  errorDetail: Ref<string>
  run: () => Promise<void>
  reset: () => void
} {
  const query = ref('')
  const state = ref<SearchState>('idle')
  const view = ref<SearchView | null>(null)
  const degrade = ref<DegradeState | null>(null)
  const errorDetail = ref('')
  let epoch = 0

  async function run(): Promise<void> {
    const q = query.value.trim()
    if (!q) return
    const mine = ++epoch
    state.value = 'searching'
    errorDetail.value = ''
    try {
      const agg = await service.search.agentTool(q)
      if (mine !== epoch) return
      const v = buildSearchView(agg, q)
      view.value = v
      degrade.value = deriveDegrade(agg, v.total)
      state.value = 'done'
    } catch (e) {
      if (mine !== epoch) return
      errorDetail.value = e instanceof Error ? e.message : String(e)
      state.value = 'error'
    }
  }

  function reset(): void {
    epoch++
    state.value = 'idle'
    view.value = null
    degrade.value = null
    errorDetail.value = ''
  }

  return { query, state, view, degrade, errorDetail, run, reset }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run src/home/search/useSearchQuery.test.ts && pnpm exec vue-tsc --noEmit
```
预期:PASS,7 例。

- [ ] **Step 5: 变异验证(守卫必须精确翻红)**

把两处 `if (mine !== epoch) return` **同时**删掉,重跑 —— 预期「过期守卫」两条 + 「reset」一条翻红,其余仍绿。恢复后把实际输出写进报告。
⚠️ 只删一处也要各试一次,确认成功路径与失败路径的守卫**各自**有覆盖(避免一条用例冒充两处覆盖)。

- [ ] **Step 6: 提交**

```bash
git add -- src/home/search/useSearchQuery.ts src/home/search/useSearchQuery.test.ts
git commit -m "feat(search): useSearchQuery(请求生命周期 + 就地 epoch 过期守卫)

- 成功/失败两条路径各自守卫,交错路径有回归测试(改词再搜时旧请求不许覆盖新结果)
- reset() 递增 epoch 作废在途结果(关面板后不许再往里写)
- 失败绝不写 view —— 不得把「服务不可用」退化成看起来像「没搜到」的空列表

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/home/search/useSearchQuery.ts src/home/search/useSearchQuery.test.ts
```

---

## Task 5: `SearchDialog.vue` 换血 + i18n

**Files:**
- Modify: `src/home/components/SearchDialog.vue`(599 行 → 删 demo 常量约 100 行,接线约 +80 行)
- Rewrite: `src/home/components/SearchDialog.test.ts`
- Modify: `src/i18n/zh_cn.sp9.ts`、`src/i18n/en_us.sp9.ts`

**Interfaces:**
- Consumes: Task 4 的 `useSearchQuery`;Task 1 的 `Reason` / `ResultRow`;既有 `toVirtualPath`(`src/files/util/pathUtils.ts`)、`useFilesStore`(`src/files/stores/files.ts`)、`useViewer`、`service.image.thumbUrl`
- Produces: 无(终端消费方)

### 删除清单(逐项确认零残留)

`DOCS` · `ALBUM` · `RECEIPTS` · `GALLERY` · `RECEIPTS_DIR` · `VIDEO_POSTER` · `isReceiptDemo` · `activeDocs` · `activeAlbum` · `suggestions` · `pickSuggestion` · `SEARCH_DELAY_MS` · `searchTimer` · `searched` · `searching` · 类型 `Category` / `DocResult` / `Media` / 本地 `Reason` / 本地 `ReasonKind` · 模板里的 `.chips` / `.chip` 块 · `<style>` 里的 `.rz-demote` / `.chips` / `.chip` 三条规则 · 文件头那段讲 demo 的注释。
⚠️ `.chip` 样式删掉前先 `grep -rn "\.chip\b" src/home/components/SearchDialog.vue` 确认只有这一处用(scoped 样式,不影响别处)。

### 新增 i18n 键(两个分片都要加,值见下)

| key | zh_cn | en_us | 来源 |
|---|---|---|---|
| `searchReasonFilename` | `文件名命中` | `Filename match` | 自拟(spec §7.5) |
| `searchReasonFilenameFuzzy` | `文件名相关` | `Filename related` | 自拟(补充规则 A1) |
| `searchReasonBody` | `正文命中` | `Body match` | 自拟(spec §7.5) |
| `searchReasonTranscript` | `转写命中` | `Transcript match` | 自拟(spec §7.5) |
| `searchReasonOcr` | `图片文字命中` | `Text in image` | 自拟(spec §7.5) |
| `searchReasonCaption` | `图片内容命中` | `Image content match` | 自拟(spec §7.5) |
| `searchReasonSemantic` | `语义相关` | `Semantically related` | 自拟(spec §7.5) |
| `searchBadgeSemantic` | `语义` | `Semantic` | Vue2 `"Semantic"` |
| `searchBadgeFilename` | `文件名` | `Filenames` | Vue2 `"Filenames"` |
| `searchBadgeOcr` | `OCR` | `OCR` | 现状沿用 |
| `searchSourceSemantic` | `语义搜索不可用` | `Semantic search unavailable` | Vue2 逐字 |
| `searchSourceImages` | `图片搜索不可用` | `Photo search unavailable` | Vue2 逐字 |
| `searchSourceFilenames` | `文件名搜索不可用` | `Filename search unavailable` | Vue2 逐字 |
| `searchNoticePrefix` | `本次未参与搜索:` | `Not included in this search:` | 自拟 |
| `searchEmptyNoMatch` | `没有匹配的文件` | `No matching files` | Vue2 逐字 |
| `searchEmptyNoRoots` | `没有可搜索的目录` | `No searchable folders` | 自拟(spec §7.8) |
| `searchEmptyNotReady` | `搜索后端未就绪` | `Search backend not ready` | 自拟(spec §7.8) |
| `searchErrorTitle` | `搜索失败` | `Search failed` | Vue2 逐字 |
| `searchErrorHint` | `搜索服务当前不可用,请稍后重试` | `The search service is unavailable, please retry` | 自拟(spec §7.8) |
| `searchRetry` | `重试` | `Retry` | 自拟 |

⚠️ 加之前先 `grep -n "searchReason\|searchBadge\|searchEmpty" src/i18n/*.ts` 确认无同名键(`parity.test.ts` 会断言分片与基座无冲突)。

### 关键接线点(逐条实现)

1. **请求**:`const s = useSearchQuery()`;`performSearch()` = `activeTab.value='all'; s.run()`。输入框 `v-model="s.query"`。
2. **面板开关**:`watch(() => homeUi.searchOpen)` 里,打开时 `s.query.value=''; s.reset(); activeTab.value='all'`,关闭时 `viewer.close(); s.reset()`。
3. **改词回空态**:`watch(s.query, () => { if (s.state.value !== 'idle') s.reset() })` —— 注意 `reset()` 会清 query 之外的一切,不清 query 本身。
4. **displayList**:改成消费 `s.view`。`all` tab = `docRows.slice(0,2)` → 相册卡(`mediaRows` 非空时)→ `docRows.slice(2)`;`Images`/`Videos` tab = 对应分类的媒体单行;其余 tab = 对应分类的文档行。**组装规则与 tab 计数逻辑不动(spec §7.7)。**
5. **来源徽标**:`.album-acc` / `.media-acc-num` 的文本从 `98%`/`OCR` 改成 `t('searchBadge' + 首字母大写(row.badge))`。**`.media-acc-label` 那行副标题删掉**(「match accuracy」已无意义),`.media-acc-num` 的 18px 字号对短徽标偏大,改 13px 并在注释里登记这处尺寸调整。
6. **reasons**:`<span v-for="rz in row.reasons" :class="'rz-' + rz.kind">{{ t(rz.key) }}</span>`。
7. **缩略图**:统一走 `service.image.thumbUrl(row.realPath)`(与现状一致、已验证)。`row.thumbnailUrl`(images 源给的 Photos URL)**本期不消费** —— Photos 缩略图的鉴权方式本机验不了(images 源恒不可用),贸然改会引入验不了的路径。**在代码里写注释登记这个决定。**
8. **打开文件夹**:
   ```ts
   const files = useFilesStore()
   onMounted(() => { void files.loadRoots() })   // displayNames 就绪后 toVirtualPath 才准
   function folderOf(realPath: string): string {
     const dir = realPath.slice(0, realPath.lastIndexOf('/')) || '/'
     return toVirtualPath(dir, files.displayNames)   // displayNames 未就绪 → 原样返回真实路径,不阻塞
   }
   function openFolder(realPath: string): void {
     window.open(`${window.location.origin}${import.meta.env.BASE_URL}#/files${folderOf(realPath)}`, '_blank', 'noopener')
   }
   ```
   ⚠️ 现有模板里 `.result-path` 显示的是 `it.row.folder.replace('/files/', '')`,改成显示 `folderOf(row.realPath)`(已经不带 `/files` 前缀)。
9. **目录行**:`row.isDir` 时点击直接 `openFolder(row.realPath + '/../')` 不对 —— 应直接进该目录本身:`window.open(... '#/files' + toVirtualPath(row.realPath, files.displayNames))`。抽一个 `openRow(row)`:`isDir` → 进目录;否则 `viewer.openItem(...)`,不支持则回退 `openFolder`。
10. **修硬编码 IP**(spec §7.9,真缺陷):`openPhotos()` 里 `http://192.168.1.115/#/photos?q=` → `` `${window.location.origin}/#/photos?q=${encodeURIComponent(q)}` ``,并把兜底词 `|| 'fish'` 去掉(demo 残留)。**在代码里注释登记这是修 bug 不是改界面。**
11. **提示条**:结果区顶部(`.results-meta` 之上)加 `.search-notice`,`v-if="s.degrade?.unavailableSources.length || s.degrade?.unknownWarnings.length"`,内容 = `t('searchNoticePrefix')` + 各源文案(`searchSource<X>`)join `、`,未知 warning 原样附在后面。样式:复用 `.rz-semantic` 的色系(`--sem-bg`/`--sem-fg`/`--sem-bd`),圆角 12px、`padding: 8px 14px`、`margin: 4px 26px`、`font-size: 12.5px`。
12. **空态**:`s.state==='done' && s.view?.total === 0` → `.search-empty` 块,文案按 `s.degrade.empty` 三选一;`backend_not_ready` 时在标题下再列一行不可用源。
13. **错误态**:`s.state==='error'` → `.search-error` 块:标题 `searchErrorTitle`、说明 `searchErrorHint`、`s.errorDetail` 非空时以 `.search-error-detail` 小字展示、`.row-open` 同款样式的重试按钮(`@click="s.run()"`)。**不要用 toast**(z-index 60,会被压住 + 糊掉)。
14. **loading**:现有 `.searching` 块的 `v-if` 从 `searching` 改成 `s.state === 'searching'`;`showResults` 改成 `s.state === 'done' && s.view && s.view.total > 0`。

- [ ] **Step 1: 先加 i18n 键并跑 parity**

按上表把 20 个键加进 `src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`(放在文件末尾,加一行注释 `// SP9-P7 Search`)。

```bash
pnpm vitest run src/i18n/parity.test.ts
```
预期:PASS。

- [ ] **Step 2: 写失败的组件测试**

重写 `src/home/components/SearchDialog.test.ts`(整文件替换):

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'

// 共享包整体 mock:search.agentTool 是本期主角;image.thumbUrl 被媒体行消费;
// folder.* 被 files store 的 loadRoots 拖进来。
const agentTool = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    search: { agentTool: (...a: unknown[]) => agentTool(...a) },
    image: { thumbUrl: (p: string) => '/thumb?path=' + encodeURIComponent(p) },
    folder: { listDisks: async () => [] },
  },
}))

import { useHomeUiStore } from '../stores/homeUi'
import SearchDialog from './SearchDialog.vue'

// i18n 已由 vitest.setup.ts 全局装好(默认 zh_cn),**不要在测试里另建 createI18n**。
let wrapper: VueWrapper | null = null

function agg(over: Partial<NormalizedAggregate> = {}): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings: [], ...over,
  }
}

// spec §7.10a 的真机响应(query=receipt)
const REAL = agg({
  filenames: [
    { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2 },
    { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtimeMs: 1783651328200, isDir: false, match: 1.5 },
  ],
  stats: { fileindexStatus: 'ready', totalCandidates: 2 },
  warnings: ['images_unavailable'],
})

async function open(): Promise<void> {
  useHomeUiStore().openSearch()
  wrapper = mount(SearchDialog, { attachTo: document.body })
  await nextTick()
}
async function search(q: string): Promise<void> {
  const input = document.body.querySelector('.searchbox') as HTMLInputElement
  input.value = q
  input.dispatchEvent(new Event('input'))
  await nextTick()
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
  await flushPromises()
  await nextTick()
}

describe('SearchDialog', () => {
  beforeEach(() => { setActivePinia(createPinia()); agentTool.mockReset() })
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

  it('关闭时 DOM 里没有搜索框', async () => {
    wrapper = mount(SearchDialog, { attachTo: document.body })
    await nextTick()
    expect(document.body.querySelector('.searchbox')).toBeNull()
  })

  it('打开时是空态:只有提示语,没有建议词(demo 期的 chips 已删)', async () => {
    await open()
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(document.body.querySelectorAll('.chip').length).toBe(0)
    expect(document.body.textContent).toContain('输入关键词')
  })

  it('回车才发请求,且用 trim 过的查询词', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = '  receipt  '
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(agentTool).not.toHaveBeenCalled()   // 输入不触发(不做输入即搜)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()
    expect(agentTool).toHaveBeenCalledWith('receipt')
  })

  it('真机响应渲染成两行:一个文档行 + 一张相册卡(图片进相册卡)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    expect(document.body.textContent).toContain('Receipt.pdf')
    expect(document.body.querySelectorAll('.album-thumb').length).toBe(1)
  })

  it('reasons 渲染成中文标签,不是写死的英文 demo 标签', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('文件名命中')
    expect(document.body.textContent).not.toContain('Exact filename match')
  })

  it('来源徽标取代准确率百分比:相册卡缩略图上不再出现 % 数字', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const acc = document.body.querySelector('.album-acc') as HTMLElement
    expect(acc.textContent).toBe('文件名')
    expect(document.body.textContent).not.toMatch(/\d+%/)
  })

  it('images_unavailable → 结果区顶部挂降级提示条(不是 toast、不遮结果)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const notice = document.body.querySelector('.search-notice') as HTMLElement
    expect(notice).not.toBeNull()
    expect(notice.textContent).toContain('图片搜索不可用')
    expect(document.body.querySelectorAll('.result').length).toBe(1)  // 结果照常显示
  })

  it('零结果且无 warning → 「没有匹配的文件」空态', async () => {
    agentTool.mockResolvedValue(agg())
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有匹配的文件')
  })

  it('零结果但有 warning → 「搜索后端未就绪」,与「没搜到」区分', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['semantic_unavailable', 'images_unavailable'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('搜索后端未就绪')
    expect(document.body.textContent).not.toContain('没有匹配的文件')
  })

  it('请求失败 → 错误态 + 重试按钮,绝不显示成空结果', async () => {
    agentTool.mockRejectedValue(new Error('ai down'))
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('搜索失败')
    expect(document.body.textContent).not.toContain('没有匹配的文件')
    const retry = document.body.querySelector('.search-retry') as HTMLElement
    expect(retry).not.toBeNull()

    agentTool.mockResolvedValue(REAL)
    retry.click()
    await flushPromises()
    await nextTick()
    expect(document.body.querySelectorAll('.result').length).toBe(1)
  })

  it('改查询词回到空态,需要再次回车', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = 'receipts'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.body.querySelector('.result')).toBeNull()
  })

  it('关闭按钮清 searchOpen', async () => {
    await open()
    ;(document.body.querySelector('.close-btn') as HTMLElement).click()
    await nextTick()
    expect(useHomeUiStore().searchOpen).toBe(false)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm vitest run src/home/components/SearchDialog.test.ts
```
预期:多条 FAIL(`.search-notice` 不存在、渲染的还是 demo 数据等)。**记下失败条数,改完要对得上。**

- [ ] **Step 4: 改 `SearchDialog.vue`**

按上面「删除清单」+「关键接口点」14 条逐条改。改完自查三件事:
- `grep -n "192.168\|RECEIPTS\|isReceiptDemo\|suggestions\|SEARCH_DELAY_MS\|rz-demote" src/home/components/SearchDialog.vue` → **零命中**。
- 文件头的注释块要重写(现在那段全是讲 demo 的),写清新的数据流:`useSearchQuery` → `buildSearchView` → 渲染;并登记三处「逻辑照正确」的偏离(硬编码 IP、`.media-acc-label` 删除、`thumbnailUrl` 不消费)。
- `<style scoped>` 里新增 `.search-notice` / `.search-empty` / `.search-error` / `.search-error-detail` / `.search-retry` 五组规则,**颜色全部用现有 token**(`--sem-*` / `--fg-muted` / `--fg-subtle` / `--accent-soft` / `--accent-soft-bd` / `--accent-text`),不写字面量。

- [ ] **Step 5: 跑测试确认通过**

```bash
pnpm vitest run src/home/components/SearchDialog.test.ts src/home/search/
pnpm exec vue-tsc --noEmit
```
预期:全绿(SearchDialog 13 例 + search 模块 43 例)。

- [ ] **Step 6: 全量门 + 构建**

```bash
pnpm test
pnpm build
```
预期:相对基线**不新增红**(基线数见任务报告),`vue-tsc` 零错,`vite build` 通过。
⚠️ 若 `color-guard.test.ts` 的用例数变了,是它按文件动态生成的正常现象。

- [ ] **Step 7: 变异验证(两处)**

① 把模板里 `.search-notice` 的 `v-if` 改成 `v-if="false"` → 预期「降级提示条」那条翻红。
② 把 `openPhotos()` 改回硬编码 IP → 预期…… **没有测试覆盖它**(它跳转外部 URL,jsdom 里断言 `window.location.href` 赋值不可靠)。→ **如实记进报告:这条只有代码注释与人工核对,无自动覆盖。** 不要为了凑覆盖率去写一条 stub 掉 `window.location` 的空转用例。

- [ ] **Step 8: 提交**

```bash
git add -- src/home/components/SearchDialog.vue src/home/components/SearchDialog.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -m "feat(search): SearchDialog 接真后端,删除两套写死 demo

- 删 DOCS/ALBUM/RECEIPTS/isReceiptDemo/建议词/1s 假延迟,不留兜底不留开关
  (留 demo 当零命中回退会让用户分不清真假结果,与 spec §7.8 冲突)
- 接 useSearchQuery:真实 loading / 降级提示条 / 三种空态 / 错误态带重试
- 准确率百分比 → 来源徽标(语义/文件名/OCR),demote 档及其 CSS 一并删
- 修真缺陷:openPhotos 写死同事机器 IP 192.168.1.115 → 同源相对跳转(spec §7.9)
- 打开文件夹改走 pathUtils.toVirtualPath,不再依赖 demo 里写死的虚拟路径

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/home/components/SearchDialog.vue src/home/components/SearchDialog.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
```

---

## Task 6: 全分支终审 + dev server 自查 + 台账

**Files:**
- Create: `.superpowers/sdd/sp9/08-p7.md`(gitignore,不进 git)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP9(重要结论同步,**别只写台账** —— SP7 的台账整目录丢过且 git 救不回)

- [ ] **Step 1: 全分支终审(opus,跨本期全部 commit)**

派一个**全新**评审 agent,给它 spec §7 + §7.10 全文与本计划,让它**自己读源文件**(不许只看 diff 摘要),逐项核:
- spec §7.1–§7.10 每一条有没有落地;两处补充规则 A1/A2 有没有按申报实现。
- **跨组件/跨任务视角**(per-task 评审的结构性盲区,P3 与 P6 各栽过一次):`.search-notice` / `.search-empty` / `.search-error` 三个新类名与既有 `.results-meta` / `.result` 有没有**层叠顺序或类名撞车**;新块在**两套主题**下都可读。
- 过期守卫的落法与仓内既有三种写法是否一致;有没有写出「被主机制兜住的空转守卫」。
- 有没有**未申报的偏离**(未申报即缺陷)。

- [ ] **Step 2: 静态配色自查(两套主题)**

用真机 fixture 拼同构 HTML(引 `theme.css` + 组件 scoped 样式),用缓存里的 chromium 截图:
```bash
~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome --headless=new --screenshot=/tmp/claude-1000/-home-nimo-NimoTech/f4f431f1-d13e-4606-85b1-508f7c21e241/scratchpad/p7-dark.png --window-size=1200,900 file:///<页面>
```
暗色 + 亮色各一张,重点看:提示条与结果行的对比度、错误块的重试按钮、徽标在缩略图上的可读性。

- [ ] **Step 3: dev server 四项探活 + 真机自查**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5273/app/
curl -s http://127.0.0.1:5273/node_modules/.vite/deps/*nimoos-service*.js | grep -c agentTool
```
浏览器开 `http://<本机IP>:5273/app/`,⌘K 打开搜索,搜 `receipt` / `invoice` / `fish`,确认:
真实结果渲染 · 降级提示条在 · 点行能预览 · 点「打开文件夹」进对的目录 · 相册卡不出现(images 源不可用,**这是预期**)。
⚠️ 若被登录守卫挡住,用 [[newui-cdp-probe-auth-bypass]] 的配方(localStorage 必须连 `version` 一起塞)+ CDP `Fetch.enable` 拦截 `/v1/users/current/custom/*` 与 `/v1/folder`(见 `sp9-p6-kvm-create-wrapup.md`)。

- [ ] **Step 4: 写台账 + 同步 roadmap**

台账 `.superpowers/sdd/sp9/08-p7.md` 记:最终坐标(两个仓的 commit)、测试计数、两处补充规则 A1/A2、新增债务(至少 **D43** 后端噪声票)、终审逮到的问题、验收清单。
roadmap §4 SP9 同步:P7 完成状态 + 「搜索从此依赖 nimoos-ai」这条耦合 + D43。

- [ ] **Step 5: 交付验收清单(给机主的版本)**

⚠️ **P6 的流程教训:验收项从计划搬到聊天版时丢过两条。搬完自己回头数一遍条数,逐项核对编号。**
⚠️ **凡「点某个东西」的项,必须先确认该元素在本机数据下真渲染成可点元素**(SP8-P5b 栽过两次)。本期特别注意:**相册卡与 Images/Videos tab 在本机不会出现**(images 源不可用),**不要把它们写进验收清单**。

清单至少覆盖:① 搜 `receipt` 出两条真实结果;② 降级提示条文案正确;③ 点文档行能就地预览 PDF;④ 点「打开文件夹」新窗口进 `Documents/Recipes`;⑤ 搜一个不存在的词 → 「没有匹配的文件」;⑥ 停掉 nimoos-ai(**需机主授权**)或断网 → 错误态 + 重试;⑦ 空态没有建议词;⑧ 两套主题下都正常。

---

## Self-Review

**Spec 覆盖核对:**

| spec 条目 | 落在 |
|---|---|
| §7.1 范围(改 SearchDialog + 新建 `src/home/search/`) | Task 1–5 |
| §7.2 `search` 域只做归一化 | Task 0 |
| §7.3 合并去重(键=真实路径 / OCR 归媒体) | Task 2 |
| §7.4 五层排名 | Task 2(+ 补充规则 A2) |
| §7.5 reasons 派生 + 删 demote | Task 1(+ 补充规则 A1)、Task 5 删 CSS |
| §7.6 准确率 → 来源徽标 | Task 2(`badge`)、Task 5(渲染) |
| §7.7 分类 tab 复用 `fileCategories` | Task 2 |
| §7.8 降级与错误态 | Task 3(状态码)、Task 4(错误态)、Task 5(渲染) |
| §7.9 修硬编码 IP | Task 5 第 10 条 |
| §7.10a fixture 重抓 | Task 0(内嵌真机响应 + Go 结构体来源行号) |
| §7.10b demo 与建议词整套删除 | Task 5 删除清单 |
| §7.10c 噪声不过滤 | 全程不实现任何过滤;D43 登记在 Task 6 |
| §7.10d 打开文件夹复用 `toVirtualPath` | Task 5 第 8 条 |
| §7.10e 不做输入即搜 | Task 5 第 1 条 + 测试「回车才发请求」 |
| §7.10f/g 降级条常驻、相册卡本机不可达 | Task 6 验收清单 |
| P7 DoD 五条 | Task 0/1/2/3/4 的单测 + Task 5 零残留自查 + Task 6 dev 验证 + 各任务显式 pathspec |

**占位符扫描:** 无 TBD / TODO;每个代码步骤都有可直接落地的完整代码。
**类型一致性核对:** `NormalizedAggregate` / `FileNameHit` / `SemanticHit` / `ImageHit`(Task 0 定义)在 Task 1/2/3/4 的引用名一致;`Reason{key,kind}` / `ResultRow` / `SearchView` / `DegradeState`(Task 1 `types.ts` 定义)在 Task 2/3/4/5 一致;`useSearchQuery` 返回的 7 个成员与 Task 5 的接线一一对上。

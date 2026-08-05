## Task 1: Service 仓 —— `notes` 域

**Files:**
- Create: `.sp8/NimoOS-Service/src/notes.ts`
- Create: `.sp8/NimoOS-Service/src/notes.test.ts`
- Modify: `.sp8/NimoOS-Service/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export function createNotes(http: AxiosInstance): {
    list(p?: {type?: string; status?: string; limit?: number}): Promise<Note[]>
    get(id: string): Promise<Note>
    create(fields: CreateNoteFields): Promise<Note>
    update(id: string, fields: UpdateNoteFields): Promise<Note>
    remove(id: string): Promise<unknown>
    curate(id: string): Promise<Note>
    archive(id: string): Promise<Note>
    backlinks(id: string): Promise<unknown[]>
    getSettings(): Promise<NotesSettings>
    putSettings(fields?: SettingsFields): Promise<NotesSettings>
    dirInfo(path: string): Promise<{exists: boolean; empty: boolean}>
    getNotesSettings(): Promise<NotesDistillSettings>
    putNotesSettings(patch: DistillSettingsPatch): Promise<NotesDistillSettings>
    distillFile(path: string): Promise<unknown>
    cancelDistillJob(path: string): Promise<unknown>
    listDistillJobs(status?: string, limit?: number): Promise<DistillJobsView>
    getDistillStatus(): Promise<{pending: number; distilled: number; quotaRemaining: number; backgroundModel: string}>
  }
  export function normalizeNote(n: Record<string, unknown>): Note
  export function buildCreateBody(f: CreateNoteFields): Record<string, unknown>
  export function buildUpdateBody(f: UpdateNoteFields): Record<string, unknown>
  export function normalizeSettings(d?: Record<string, unknown>): NotesSettings
  export function buildSettingsBody(f?: SettingsFields): Record<string, unknown>
  export function normalizeNotesSettings(raw: unknown): NotesDistillSettings
  export function buildNotesSettingsBody(p?: DistillSettingsPatch): Record<string, unknown>
  export function normalizeDistillJobs(raw: unknown): DistillJobsView
  export function isDistillableName(name: string): boolean
  export const DISTILL_EXTS: string[]
  ```
- 类型 `Note` / `NotesSettings` / `NotesDistillSettings` / `DistillJobsView` / `DistillJob` 就地导出(不进 `types.ts` —— 只此域用)。

- [ ] **Step 1: 读蓝本**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git show main:src/service/notes.js               # 203 行,全文
git show main:src/views/AI/Knowledge/__tests__/notesService.spec.js   # 原测试
```
逐行对照。**唯一的语义改动**:Vue2 每个方法内部读 `r.data`(axios 原始响应),包内 `http` 也是 axios 实例,所以 `res.data` **保留**;包对外**返回已 normalize 的值**,与 Vue2 的 `notes.list()` 等一致(Vue2 里这层就已经 normalize 过了,不是新增行为)。

- [ ] **Step 2: 写失败测试**

`src/notes.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import {
  createNotes, normalizeNote, buildCreateBody, buildUpdateBody,
  normalizeSettings, buildSettingsBody, normalizeNotesSettings,
  buildNotesSettingsBody, normalizeDistillJobs, isDistillableName, DISTILL_EXTS,
} from './notes'

type Call = { verb: string; url: string; body?: unknown; cfg?: Record<string, unknown> }
function recorder(dataFor?: (verb: string, url: string) => unknown) {
  const calls: Call[] = []
  const push = (verb: string, url: string, body: unknown, cfg: unknown) => {
    calls.push({ verb, url, body, cfg: cfg as Record<string, unknown> | undefined })
    return { data: dataFor ? dataFor(verb, url) : null }
  }
  const http = {
    get: async (u: string, c?: unknown) => push('get', u, undefined, c),
    post: async (u: string, b?: unknown, c?: unknown) => push('post', u, b, c),
    delete: async (u: string, c?: unknown) => push('delete', u, undefined, c),
    put: async (u: string, b?: unknown, c?: unknown) => push('put', u, b, c),
  } as unknown as AxiosInstance
  return { http, calls }
}

describe('createNotes — URL/动词表', () => {
  it('每个方法各调一次,URL 与动词逐条吻合', async () => {
    const { http, calls } = recorder((verb, url) => {
      if (url === '/ai/agent/notes' && verb === 'get') return { notes: [] }
      if (url.endsWith('/backlinks')) return { backlinks: [{ id: 'x' }] }
      if (url.endsWith('/dir-info')) return { exists: true, empty: false }
      if (url.endsWith('/distill/jobs')) return { jobs: [], counts: {} }
      if (url.endsWith('/distill/status')) return { pending: 1, distilled: 2, quota_remaining: 3, background_model: 'm' }
      if (url.endsWith('/settings')) return { notes_root: '/DATA/Notes', auto_extract: true }
      return { id: 'n1', title: 't', type: 'note', status: 'draft', revision: 1 }
    })
    const notes = createNotes(http)

    await notes.list({ type: 'insight', status: 'draft', limit: 5 })
    await notes.get('n1')
    await notes.create({ title: 'T', content: 'C' })
    await notes.update('n1', { expectedRevision: 2, content: 'C' })
    await notes.remove('n1')
    await notes.curate('n1')
    await notes.archive('n1')
    await notes.backlinks('n1')
    await notes.getSettings()
    await notes.putSettings({ autoExtract: false })
    await notes.dirInfo('/DATA/N')
    await notes.getNotesSettings()
    await notes.putNotesSettings({ distillDailyCap: 20 })
    await notes.distillFile('/DATA/a.pdf')
    await notes.cancelDistillJob('/DATA/a.pdf')
    await notes.listDistillJobs('failed', 200)
    await notes.getDistillStatus()

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/agent/notes',
      'get /ai/agent/notes/n1',
      'post /ai/agent/notes',
      'put /ai/agent/notes/n1',
      'delete /ai/agent/notes/n1',
      'post /ai/agent/notes/n1/curate',
      'post /ai/agent/notes/n1/archive',
      'get /ai/agent/notes/n1/backlinks',
      'get /ai/agent/notes/settings',
      'put /ai/agent/notes/settings',
      'get /ai/agent/notes/dir-info',
      'get /ai/agent/notes/settings',
      'put /ai/agent/notes/settings',
      'post /ai/agent/notes/distill',
      'post /ai/agent/notes/distill/jobs/cancel',
      'get /ai/agent/notes/distill/jobs',
      'get /ai/agent/notes/distill/status',
    ])
  })

  it('list 把查询参数放进 params,并 map 成 camelCase', async () => {
    const { http, calls } = recorder(() => ({ notes: [{ id: 'n1', title: 't', type: 'note', status: 'draft', revision: 1, source_refs: [{ session_id: 's' }] }] }))
    const out = await createNotes(http).list({ status: 'draft', limit: 200 })
    expect(calls[0].cfg).toEqual({ params: { type: '', status: 'draft', limit: 200 } })
    expect(out).toEqual([{ id: 'n1', title: 't', description: '', type: 'note', status: 'draft',
      tags: [], sourceRefs: [{ session_id: 's' }], createdBy: '', revision: 1, updatedAt: 0,
      path: '', body: undefined }])
  })

  it('list 默认参数与 Vue2 一致(type/status 空串、limit 100)', async () => {
    const { http, calls } = recorder(() => ({ notes: [] }))
    await createNotes(http).list()
    expect(calls[0].cfg).toEqual({ params: { type: '', status: '', limit: 100 } })
  })

  it('dirInfo / listDistillJobs 的查询参数', async () => {
    const { http, calls } = recorder((_v, url) =>
      url.endsWith('/dir-info') ? { exists: 1, empty: 0 } : { jobs: [], counts: {} })
    const n = createNotes(http)
    expect(await n.dirInfo('/DATA/N')).toEqual({ exists: true, empty: false })
    expect(calls[0].cfg).toEqual({ params: { path: '/DATA/N' } })
    await n.listDistillJobs('failed', 200)
    expect(calls[1].cfg).toEqual({ params: { limit: 200, status: 'failed' } })
    await n.listDistillJobs()
    expect(calls[2].cfg).toEqual({ params: { limit: 200 } })   // 无 status 键
  })

  it('backlinks / getDistillStatus 的 null 兜底', async () => {
    const { http } = recorder(() => ({}))
    const n = createNotes(http)
    expect(await n.backlinks('n1')).toEqual([])
    expect(await n.getDistillStatus()).toEqual({ pending: 0, distilled: 0, quotaRemaining: 0, backgroundModel: '' })
  })
})

describe('notes 纯函数(移植 Vue2 notesService.spec.js)', () => {
  it('normalizeNote 把 snake_case 映射成 camelCase', () => {
    expect(normalizeNote({ id: 'n1', title: 't', description: 'd', type: 'insight',
      status: 'draft', tags: ['a'], source_refs: [{ path: '/DATA/x.pdf' }],
      created_by: 'pipeline', revision: 3, updated_at: 99, path: '1/x.md', body: 'B' }))
      .toEqual({ id: 'n1', title: 't', description: 'd', type: 'insight', status: 'draft',
        tags: ['a'], sourceRefs: [{ path: '/DATA/x.pdf' }], createdBy: 'pipeline',
        revision: 3, updatedAt: 99, path: '1/x.md', body: 'B' })
  })

  it('normalizeNote 容忍缺省可选字段', () => {
    const n = normalizeNote({ id: 'n2', title: 't', type: 'note', status: 'curated', revision: 1 })
    expect(n.tags).toEqual([])
    expect(n.sourceRefs).toEqual([])
    expect(n.body).toBe(undefined)
  })

  it('buildCreateBody 发 snake_case', () => {
    expect(buildCreateBody({ title: 'T', content: 'C', noteType: 'note', tags: ['x'], sourceRefs: [], description: 'd' }))
      .toEqual({ title: 'T', content: 'C', note_type: 'note', tags: ['x'], source_refs: [], description: 'd' })
  })

  it('buildCreateBody 的默认值', () => {
    expect(buildCreateBody({ title: 'T', content: 'C' }))
      .toEqual({ title: 'T', content: 'C', note_type: 'note', tags: [], source_refs: [], description: '' })
  })

  it('buildUpdateBody 丢掉 undefined 字段但保留 revision', () => {
    expect(buildUpdateBody({ expectedRevision: 2, content: 'C' }))
      .toEqual({ expected_revision: 2, content: 'C' })
    expect(buildUpdateBody({ expectedRevision: 7, title: 'T', status: 'curated', tags: [], description: '' }))
      .toEqual({ expected_revision: 7, title: 'T', status: 'curated', tags: [], description: '' })
  })

  it('buildSettingsBody 只发给出的字段,notesRoot 带 mode', () => {
    expect(buildSettingsBody({ notesRoot: '/DATA/N', mode: 'migrate' }))
      .toEqual({ notes_root: '/DATA/N', mode: 'migrate' })
    expect(buildSettingsBody({ autoExtract: false })).toEqual({ auto_extract: false })
    expect(buildSettingsBody({ notesRoot: '/x', autoExtract: true }))
      .toEqual({ notes_root: '/x', mode: 'adopt', auto_extract: true })
    expect(buildSettingsBody()).toEqual({})
  })

  it('normalizeSettings 的默认值(auto_extract 缺省为 true)', () => {
    expect(normalizeSettings({ notes_root: '/DATA/Notes', auto_extract: false }))
      .toEqual({ notesRoot: '/DATA/Notes', autoExtract: false })
    expect(normalizeSettings({}).autoExtract).toBe(true)
    expect(normalizeSettings().notesRoot).toBe('')
  })

  it('normalizeNotesSettings 的沉淀字段默认值', () => {
    expect(normalizeNotesSettings(null))
      .toEqual({ notesRoot: '', autoExtract: true, distillRoots: [], distillDailyCap: 50, backgroundModel: '' })
    expect(normalizeNotesSettings({ distill_roots: ['/a', 1], distill_daily_cap: 0 }).distillRoots)
      .toEqual(['/a', '1'])
    expect(normalizeNotesSettings({ distill_daily_cap: 0 }).distillDailyCap).toBe(0)
    expect(normalizeNotesSettings({ distill_daily_cap: 'x' }).distillDailyCap).toBe(50)
  })

  it('buildNotesSettingsBody 只发给出的字段', () => {
    expect(buildNotesSettingsBody({ distillDailyCap: 20 })).toEqual({ distill_daily_cap: 20 })
    expect(buildNotesSettingsBody({})).toEqual({})
  })

  it('normalizeDistillJobs 映射行与 counts,并容忍非数组', () => {
    expect(normalizeDistillJobs({ jobs: [{ file_path: '/a', status: 'failed', attempts: 2, last_error: 'e', enqueued_at: 1, updated_at: 2 }], counts: { pending: 3 } }))
      .toEqual({ jobs: [{ filePath: '/a', status: 'failed', origin: 'auto', attempts: 2, lastError: 'e', enqueuedAt: 1, updatedAt: 2 }],
                 counts: { pending: 3, running: 0, failed: 0 } })
    expect(normalizeDistillJobs({ jobs: 'nope' }).jobs).toEqual([])
    expect(normalizeDistillJobs(null)).toEqual({ jobs: [], counts: { pending: 0, running: 0, failed: 0 } })
  })

  it('isDistillableName 大小写不敏感,且与 DISTILL_EXTS 同源', () => {
    expect(isDistillableName('A.PDF')).toBe(true)
    expect(isDistillableName('a.md')).toBe(true)
    expect(isDistillableName('a.png')).toBe(false)
    expect(isDistillableName('')).toBe(false)
    expect(isDistillableName(undefined as unknown as string)).toBe(false)
    expect(DISTILL_EXTS).toContain('.wps')
    expect(DISTILL_EXTS).toHaveLength(14)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm test src/notes.test.ts
```
预期:FAIL,`Failed to resolve import "./notes"`。

- [ ] **Step 4: 实现 `src/notes.ts`**

按蓝本逐行移植。文件头注释必须写:
```ts
/**
 * notes 域 —— Python agent(:8282)的知识笔记 API,经 NimoOS-AI 反代
 * `/v1/ai/agent/notes/*`(`route/v2.go:189-191` 给 settings 与 dir-info 另套了 AdminOnly)。
 *
 * 1:1 移植自 Vue2 `src/service/notes.js`(203 行)。
 * 【返回值约定】与 ai 域「body 原样不 unwrap」不同:本域**返回已归一化的 camelCase 值**
 * —— Vue2 里这层归一化就在 service 层完成(视图只见 camelCase),照搬其分层。
 * 【为什么单独成域而不并进 ai.ts】① 消费方将来含文件区右键「沉淀」(非 AI 区)
 * ② 8 个纯函数需要脱离 http 实例被单测与消费方直接 import。
 */
```
要点(逐条对齐蓝本):
- `PREFIX = '/ai/agent/notes'`
- `list` 的查询参数走 axios `{ params }`(Vue2 的 `api.get(url, obj)` 第二参就是 params;本包 `http` 是原生 axios,**必须显式包 `{ params }`**)
- `listDistillJobs(status='', limit=200)`:`status` 为空时**不放进 params**(照抄蓝本)
- `DISTILL_EXTS` 连蓝本那段「与后端 `notes_distill.py` 的 `DISTILL_EXTS` 是有意重复,改一处要改两处」的注释一起搬
- 类型:入参用具体接口,响应用 `Record<string, unknown>` 收再 normalize;**禁 `any`**(`strict: true`)

- [ ] **Step 5: 跑测试确认通过 + 全量**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service
pnpm test        > /tmp/p5a-t1-svc-test.log 2>&1; echo "exit=$?"
```
预期:全绿,`190 + 本文件用例数`。

- [ ] **Step 6: 接线 `src/index.ts`**

```ts
import { createNotes } from './notes.js'
// …
export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, sseRequest,
         isDistillableName, DISTILL_EXTS } from …   // 注意:纯函数从 './notes.js' 再导出一行
// …
  get notes(): ReturnType<typeof createNotes> {
    return createNotes(getHttp() as AxiosInstance)
  },
```
具体写法照文件既有风格(现有 `export { … }` 是一行 from './http.js' 等多行,**新增独立一行** `export { isDistillableName, DISTILL_EXTS } from './notes.js'`,不要塞进已有那行)。

- [ ] **Step 7: build + 消费仓校验**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && pnpm build 2>&1 | tail -20
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && pnpm install 2>&1 | tail -5
pnpm exec vue-tsc --noEmit > /tmp/p5a-t1-tsc.log 2>&1; echo "exit=$?"
```
预期:build 成功;New-UI tsc exit 0(本步不新增消费代码,只确认包链接没坏 —— 见记忆 `nimoos-service-pnpm-drift`)。

- [ ] **Step 8: 提交(两个仓各一个提交)**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service
git add src/notes.ts src/notes.test.ts src/index.ts
git commit -m "feat(notes): SP8-P5a notes 域进包(Python agent 知识笔记 API)"
```
若 New-UI 侧 `pnpm-lock.yaml`/`node_modules` 有变动,**不提交** New-UI 侧任何文件(lock 未变则无事;变了在报告里说明)。

---


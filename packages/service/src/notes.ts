import type { AxiosInstance } from 'axios'

/**
 * notes 域 —— Python agent(:8282)的知识笔记 API,经 NimoOS-AI 反代
 * `/v1/ai/agent/notes/*`(`route/v2.go:189-191` 给 settings 与 dir-info 另套了 AdminOnly)。
 *
 * 1:1 移植自 Vue2 `src/service/notes.js`(203 行)。
 * 【返回值约定】与 ai 域「body 原样不 unwrap」不同:本域**返回已归一化的 camelCase 值**
 * —— Vue2 里这层归一化就在 service 层完成(视图只见 camelCase),照搬其分层。
 * 【为什么单独成域而不并进 ai.ts】① 消费方将来含文件区右键「沉淀」(非 AI 区)
 * ② 8 个纯函数需要脱离 http 实例被单测与消费方直接 import。
 *
 * 【结构性偏离,SP8-P5a Task 1 申报】Vue2 里 getNotesSettings/putNotesSettings/
 * distillFile/cancelDistillJob/listDistillJobs/getDistillStatus 六个函数是模块级具名导出,
 * 不在默认导出的 `notes` 对象里(蓝本把它们放在文件下半段,单独 export）。本仓消费口径
 * 是「REST 一律经 `service.notes.*`」,一个域一个入口,故按 brief 要求把它们收进
 * `createNotes(http)` 返回对象里,成为其方法。这是包 API 形状的调整,不是界面/行为改动——
 * 方法体逐行照蓝本搬,无逻辑变化。
 */

export interface Note {
  id: string
  title: string
  description: string
  type?: string
  status?: string
  tags: unknown[]
  sourceRefs: unknown[]
  createdBy: string
  revision?: number
  updatedAt: number
  path: string
  body?: unknown
}

export interface CreateNoteFields {
  title: string
  content: string
  noteType?: string
  tags?: unknown[]
  sourceRefs?: unknown[]
  description?: string
}

export interface UpdateNoteFields {
  expectedRevision: number
  content?: string
  title?: string
  status?: string
  tags?: unknown[]
  description?: string
}

export interface NotesSettings {
  notesRoot: string
  autoExtract: boolean
}

export interface SettingsFields {
  notesRoot?: string
  mode?: string
  autoExtract?: boolean | null
}

export interface NotesDistillSettings {
  notesRoot: string
  autoExtract: boolean
  distillRoots: string[]
  distillDailyCap: number
  backgroundModel: string
}

export interface DistillSettingsPatch {
  distillRoots?: string[]
  distillDailyCap?: number
  backgroundModel?: string
}

export interface DistillJob {
  filePath: string
  status: string
  origin: string
  attempts: number
  lastError: string
  enqueuedAt: number
  updatedAt: number
}

export interface DistillJobsView {
  jobs: DistillJob[]
  counts: { pending: number; running: number; failed: number }
}

const PREFIX = '/ai/agent/notes'

/* Python agent returns snake_case JSON; normalize here so views only ever
 * see camelCase (same layering convention as wiki.js). */
export function normalizeNote(n: Record<string, unknown>): Note {
  return {
    id: n.id as string,
    title: (n.title as string) || '',
    description: (n.description as string) || '',
    type: n.type as string | undefined,
    status: n.status as string | undefined,
    tags: (n.tags as unknown[]) || [],
    sourceRefs: (n.source_refs as unknown[]) || [],
    createdBy: (n.created_by as string) || '',
    revision: n.revision as number | undefined,
    updatedAt: (n.updated_at as number) || 0,
    path: (n.path as string) || '',
    body: n.body,
  }
}

export function buildCreateBody(f: CreateNoteFields): Record<string, unknown> {
  const { title, content, noteType = 'note', tags = [], sourceRefs = [], description = '' } = f
  return { title, content, note_type: noteType, tags, source_refs: sourceRefs, description }
}

export function buildUpdateBody(f: UpdateNoteFields): Record<string, unknown> {
  const { expectedRevision, content, title, status, tags, description } = f
  const body: Record<string, unknown> = { expected_revision: expectedRevision }
  if (content !== undefined) body.content = content
  if (title !== undefined) body.title = title
  if (status !== undefined) body.status = status
  if (tags !== undefined) body.tags = tags
  if (description !== undefined) body.description = description
  return body
}

export function normalizeSettings(d?: Record<string, unknown>): NotesSettings {
  const r = d || {}
  return {
    notesRoot: (r.notes_root as string) || '',
    autoExtract: r.auto_extract !== false,
  }
}

export function buildSettingsBody(f?: SettingsFields): Record<string, unknown> {
  const { notesRoot, mode = 'adopt', autoExtract } = f || {}
  const body: Record<string, unknown> = {}
  if (notesRoot) { body.notes_root = notesRoot; body.mode = mode }
  if (autoExtract !== undefined && autoExtract !== null) body.auto_extract = !!autoExtract
  return body
}

/* Distillation settings. Server speaks snake_case; views only ever see
 * camelCase (same layering convention as the note normalizer above). */
export function normalizeNotesSettings(raw: unknown): NotesDistillSettings {
  const r = (raw || {}) as Record<string, unknown>
  return {
    notesRoot: (r.notes_root as string) || '',
    autoExtract: r.auto_extract !== false,
    distillRoots: Array.isArray(r.distill_roots) ? (r.distill_roots as unknown[]).map(String) : [],
    distillDailyCap: Number.isFinite(r.distill_daily_cap) ? (r.distill_daily_cap as number) : 50,
    backgroundModel: (r.background_model as string) || '',
  }
}

export function buildNotesSettingsBody(p?: DistillSettingsPatch): Record<string, unknown> {
  const { distillRoots, distillDailyCap, backgroundModel } = p || {}
  const body: Record<string, unknown> = {}
  if (distillRoots !== undefined) body.distill_roots = distillRoots
  if (distillDailyCap !== undefined) body.distill_daily_cap = distillDailyCap
  if (backgroundModel !== undefined) body.background_model = backgroundModel
  return body
}

/* Single source of truth for "can this file be distilled into a note".
 * Gates menu-item/button VISIBILITY only (ContextMenu.vue, FileDetailDrawer.vue) —
 * the backend has its own authoritative gate in
 * NimoOS-AI/agent/notes_distill.py's DISTILL_EXTS and re-checks on the server
 * side regardless of what the UI shows. The two lists are a deliberate
 * duplicate and MUST stay identical: edit one, edit the other. */
export const DISTILL_EXTS: string[] = [
  '.md', '.txt', '.rst', '.pdf', '.docx', '.doc', '.wps',
  '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.html', '.htm',
]

export function isDistillableName(name: string): boolean {
  const n = String(name || '').toLowerCase()
  return DISTILL_EXTS.some((e) => n.endsWith(e))
}

/* Distillation job queue listing. Server speaks snake_case; views only
 * ever see camelCase (same layering convention as the normalizers above). */
export function normalizeDistillJobs(raw: unknown): DistillJobsView {
  const r = (raw || {}) as Record<string, unknown>
  const c = (r.counts || {}) as Record<string, unknown>
  const jobsRaw = Array.isArray(r.jobs) ? (r.jobs as Record<string, unknown>[]) : []
  return {
    jobs: jobsRaw.map((j) => ({
      filePath: (j.file_path as string) || '',
      status: (j.status as string) || '',
      origin: (j.origin as string) || 'auto',
      attempts: (j.attempts as number) || 0,
      lastError: (j.last_error as string) || '',
      enqueuedAt: (j.enqueued_at as number) || 0,
      updatedAt: (j.updated_at as number) || 0,
    })),
    counts: {
      pending: (c.pending as number) || 0,
      running: (c.running as number) || 0,
      failed: (c.failed as number) || 0,
    },
  }
}

export function createNotes(http: AxiosInstance) {
  return {
    async list(p?: { type?: string; status?: string; limit?: number }): Promise<Note[]> {
      const { type = '', status = '', limit = 100 } = p || {}
      const res = await http.get(PREFIX, { params: { type, status, limit } })
      return ((res.data.notes as Record<string, unknown>[]) || []).map(normalizeNote)
    },

    async get(id: string): Promise<Note> {
      const res = await http.get(`${PREFIX}/${id}`)
      return normalizeNote(res.data)
    },

    async create(fields: CreateNoteFields): Promise<Note> {
      const res = await http.post(PREFIX, buildCreateBody(fields))
      return normalizeNote(res.data)
    },

    async update(id: string, fields: UpdateNoteFields): Promise<Note> {
      const res = await http.put(`${PREFIX}/${id}`, buildUpdateBody(fields))
      return normalizeNote(res.data)
    },

    async remove(id: string): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/${id}`)
      return res.data
    },

    async curate(id: string): Promise<Note> {
      const res = await http.post(`${PREFIX}/${id}/curate`)
      return normalizeNote(res.data)
    },

    async archive(id: string): Promise<Note> {
      const res = await http.post(`${PREFIX}/${id}/archive`)
      return normalizeNote(res.data)
    },

    async backlinks(id: string): Promise<unknown[]> {
      const res = await http.get(`${PREFIX}/${id}/backlinks`)
      return (res.data.backlinks as unknown[]) || []
    },

    async getSettings(): Promise<NotesSettings> {
      const res = await http.get(`${PREFIX}/settings`)
      return normalizeSettings(res.data)
    },

    async putSettings(fields?: SettingsFields): Promise<NotesSettings> {
      const res = await http.put(`${PREFIX}/settings`, buildSettingsBody(fields))
      return normalizeSettings(res.data)
    },

    /* Probe a candidate notes folder (admin-gated like settings).
     * Same emptiness semantics as the backend migrate guard. */
    async dirInfo(path: string): Promise<{ exists: boolean; empty: boolean }> {
      const res = await http.get(`${PREFIX}/dir-info`, { params: { path } })
      return { exists: !!res.data.exists, empty: !!res.data.empty }
    },

    async getNotesSettings(): Promise<NotesDistillSettings> {
      const res = await http.get(`${PREFIX}/settings`)
      return normalizeNotesSettings(res.data)
    },

    async putNotesSettings(patch: DistillSettingsPatch): Promise<NotesDistillSettings> {
      const res = await http.put(`${PREFIX}/settings`, buildNotesSettingsBody(patch))
      return normalizeNotesSettings(res.data)
    },

    async distillFile(path: string): Promise<unknown> {
      const res = await http.post(`${PREFIX}/distill`, { path })
      return res.data
    },

    /* Cancel a still-pending distill job. 409 means it's no longer cancellable
     * (not found / not yours / already running / terminal) — callers surface
     * that as a friendly message rather than a raw error. */
    async cancelDistillJob(path: string): Promise<unknown> {
      const res = await http.post(`${PREFIX}/distill/jobs/cancel`, { path })
      return res.data
    },

    async listDistillJobs(status = '', limit = 200): Promise<DistillJobsView> {
      const params: Record<string, unknown> = { limit }
      if (status) params.status = status
      const res = await http.get(`${PREFIX}/distill/jobs`, { params })
      return normalizeDistillJobs(res.data)
    },

    async getDistillStatus(): Promise<{ pending: number; distilled: number; quotaRemaining: number; backgroundModel: string }> {
      const res = await http.get(`${PREFIX}/distill/status`)
      const d = res.data || {}
      return {
        pending: d.pending || 0,
        distilled: d.distilled || 0,
        quotaRemaining: d.quota_remaining || 0,
        backgroundModel: d.background_model || '',
      }
    },
  }
}

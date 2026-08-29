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

describe('createNotes — URL/verb table', () => {
  it('calls each method once, URL and verb match line by line', async () => {
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

  it('list puts query params into params, and maps to camelCase', async () => {
    const { http, calls } = recorder(() => ({ notes: [{ id: 'n1', title: 't', type: 'note', status: 'draft', revision: 1, source_refs: [{ session_id: 's' }] }] }))
    const out = await createNotes(http).list({ status: 'draft', limit: 200 })
    expect(calls[0].cfg).toEqual({ params: { type: '', status: 'draft', limit: 200 } })
    expect(out).toEqual([{ id: 'n1', title: 't', description: '', type: 'note', status: 'draft',
      tags: [], sourceRefs: [{ session_id: 's' }], createdBy: '', revision: 1, updatedAt: 0,
      path: '', body: undefined }])
  })

  it('list default params match Vue2 (type/status empty string, limit 100)', async () => {
    const { http, calls } = recorder(() => ({ notes: [] }))
    await createNotes(http).list()
    expect(calls[0].cfg).toEqual({ params: { type: '', status: '', limit: 100 } })
  })

  it('dirInfo / listDistillJobs query params', async () => {
    const { http, calls } = recorder((_v, url) =>
      url.endsWith('/dir-info') ? { exists: 1, empty: 0 } : { jobs: [], counts: {} })
    const n = createNotes(http)
    expect(await n.dirInfo('/DATA/N')).toEqual({ exists: true, empty: false })
    expect(calls[0].cfg).toEqual({ params: { path: '/DATA/N' } })
    await n.listDistillJobs('failed', 200)
    expect(calls[1].cfg).toEqual({ params: { limit: 200, status: 'failed' } })
    await n.listDistillJobs()
    expect(calls[2].cfg).toEqual({ params: { limit: 200 } })   // no status key
  })

  it('backlinks / getDistillStatus fall back on null', async () => {
    const { http } = recorder(() => ({}))
    const n = createNotes(http)
    expect(await n.backlinks('n1')).toEqual([])
    expect(await n.getDistillStatus()).toEqual({ pending: 0, distilled: 0, quotaRemaining: 0, backgroundModel: '' })
  })

  // Review important: getSettings/getNotesSettings both hit /ai/agent/notes/settings,
  // so the URL/verb table alone can't tell which normalizer each one calls internally —— feeding the same backend response to both,
  // each one's field count and defaults must be pinned separately, so "used the wrong normalizer" fails precisely (instead of staying all-green).
  it('getSettings normalizes only 2 fields (notesRoot/autoExtract), no distillation fields', async () => {
    const { http } = recorder(() => ({ notes_root: '/DATA/Notes', auto_extract: true }))
    const out = await createNotes(http).getSettings()
    expect(out).toEqual({ notesRoot: '/DATA/Notes', autoExtract: true })
    expect(Object.keys(out)).toEqual(['notesRoot', 'autoExtract'])
  })

  it('getNotesSettings normalizes the same response into 5 fields, distillation fields each fall back to their default', async () => {
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

  it('putSettings sends the body via buildSettingsBody, return value has only 2 fields', async () => {
    const { http, calls } = recorder(() => ({ notes_root: '/x', auto_extract: true }))
    const out = await createNotes(http).putSettings({ notesRoot: '/x', autoExtract: true })
    expect(calls[0].body).toEqual({ notes_root: '/x', mode: 'adopt', auto_extract: true })
    expect(out).toEqual({ notesRoot: '/x', autoExtract: true })
    expect(Object.keys(out)).toEqual(['notesRoot', 'autoExtract'])
  })

  it('putNotesSettings sends the body via buildNotesSettingsBody (key names differ from buildSettingsBody), return value has 5 fields', async () => {
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
})

describe('notes pure functions (ported from Vue2 notesService.spec.js)', () => {
  it('normalizeNote maps snake_case to camelCase', () => {
    expect(normalizeNote({ id: 'n1', title: 't', description: 'd', type: 'insight',
      status: 'draft', tags: ['a'], source_refs: [{ path: '/DATA/x.pdf' }],
      created_by: 'pipeline', revision: 3, updated_at: 99, path: '1/x.md', body: 'B' }))
      .toEqual({ id: 'n1', title: 't', description: 'd', type: 'insight', status: 'draft',
        tags: ['a'], sourceRefs: [{ path: '/DATA/x.pdf' }], createdBy: 'pipeline',
        revision: 3, updatedAt: 99, path: '1/x.md', body: 'B' })
  })

  it('normalizeNote tolerates missing optional fields', () => {
    const n = normalizeNote({ id: 'n2', title: 't', type: 'note', status: 'curated', revision: 1 })
    expect(n.tags).toEqual([])
    expect(n.sourceRefs).toEqual([])
    expect(n.body).toBe(undefined)
  })

  it('buildCreateBody sends snake_case', () => {
    expect(buildCreateBody({ title: 'T', content: 'C', noteType: 'note', tags: ['x'], sourceRefs: [], description: 'd' }))
      .toEqual({ title: 'T', content: 'C', note_type: 'note', tags: ['x'], source_refs: [], description: 'd' })
  })

  it('buildCreateBody default values', () => {
    expect(buildCreateBody({ title: 'T', content: 'C' }))
      .toEqual({ title: 'T', content: 'C', note_type: 'note', tags: [], source_refs: [], description: '' })
  })

  it('buildUpdateBody drops undefined fields but keeps revision', () => {
    expect(buildUpdateBody({ expectedRevision: 2, content: 'C' }))
      .toEqual({ expected_revision: 2, content: 'C' })
    expect(buildUpdateBody({ expectedRevision: 7, title: 'T', status: 'curated', tags: [], description: '' }))
      .toEqual({ expected_revision: 7, title: 'T', status: 'curated', tags: [], description: '' })
  })

  it('buildSettingsBody only sends the given fields, notesRoot carries mode', () => {
    expect(buildSettingsBody({ notesRoot: '/DATA/N', mode: 'migrate' }))
      .toEqual({ notes_root: '/DATA/N', mode: 'migrate' })
    expect(buildSettingsBody({ autoExtract: false })).toEqual({ auto_extract: false })
    expect(buildSettingsBody({ notesRoot: '/x', autoExtract: true }))
      .toEqual({ notes_root: '/x', mode: 'adopt', auto_extract: true })
    expect(buildSettingsBody()).toEqual({})
  })

  it('normalizeSettings default values (auto_extract defaults to true)', () => {
    expect(normalizeSettings({ notes_root: '/DATA/Notes', auto_extract: false }))
      .toEqual({ notesRoot: '/DATA/Notes', autoExtract: false })
    expect(normalizeSettings({}).autoExtract).toBe(true)
    expect(normalizeSettings().notesRoot).toBe('')
  })

  it('normalizeNotesSettings default values for distillation fields', () => {
    expect(normalizeNotesSettings(null))
      .toEqual({ notesRoot: '', autoExtract: true, distillRoots: [], distillDailyCap: 50, backgroundModel: '' })
    expect(normalizeNotesSettings({ distill_roots: ['/a', 1], distill_daily_cap: 0 }).distillRoots)
      .toEqual(['/a', '1'])
    expect(normalizeNotesSettings({ distill_daily_cap: 0 }).distillDailyCap).toBe(0)
    expect(normalizeNotesSettings({ distill_daily_cap: 'x' }).distillDailyCap).toBe(50)
  })

  it('buildNotesSettingsBody only sends the given fields', () => {
    expect(buildNotesSettingsBody({ distillDailyCap: 20 })).toEqual({ distill_daily_cap: 20 })
    expect(buildNotesSettingsBody({})).toEqual({})
  })

  it('normalizeDistillJobs maps rows and counts, and tolerates non-arrays', () => {
    expect(normalizeDistillJobs({ jobs: [{ file_path: '/a', status: 'failed', attempts: 2, last_error: 'e', enqueued_at: 1, updated_at: 2 }], counts: { pending: 3 } }))
      .toEqual({ jobs: [{ filePath: '/a', status: 'failed', origin: 'auto', attempts: 2, lastError: 'e', enqueuedAt: 1, updatedAt: 2 }],
                 counts: { pending: 3, running: 0, failed: 0 } })
    expect(normalizeDistillJobs({ jobs: 'nope' }).jobs).toEqual([])
    expect(normalizeDistillJobs(null)).toEqual({ jobs: [], counts: { pending: 0, running: 0, failed: 0 } })
  })

  it('isDistillableName is case-insensitive, and stays in sync with DISTILL_EXTS', () => {
    expect(isDistillableName('A.PDF')).toBe(true)
    expect(isDistillableName('a.md')).toBe(true)
    expect(isDistillableName('a.png')).toBe(false)
    expect(isDistillableName('')).toBe(false)
    expect(isDistillableName(undefined as unknown as string)).toBe(false)
    expect(DISTILL_EXTS).toContain('.wps')
    expect(DISTILL_EXTS).toHaveLength(14)
  })
})

import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createAi } from './ai'

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
    patch: async (u: string, b?: unknown, c?: unknown) => push('patch', u, b, c),
    put: async (u: string, b?: unknown, c?: unknown) => push('put', u, b, c),
  } as unknown as AxiosInstance
  return { http, calls }
}

describe('createAi — agent session core group', () => {
  it('URL+verb table driven assertions (all methods called once)', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)

    await ai.listAgentSessions()
    await ai.createAgentSession()
    await ai.deleteAgentSession(1)
    await ai.listAgentMessages(1)
    await ai.confirmAgentAction(1, 'c1', true)
    await ai.cancelAgentRun(1)
    await ai.updateAgentSessionTitle(1, 'T')
    await ai.regenerateAgentSessionTitle(1, 'gpt-4', 'openai')
    await ai.listMounts()
    await ai.listFsEntries('/DATA')
    await ai.listVisibleResources(1)
    await ai.addVisibleResource(1, '/DATA/x')
    await ai.removeVisibleResource(1, 9)
    await ai.listAttachments(1)
    await ai.deleteAttachment(1, 2)
    await ai.listStagedChanges(1)
    await ai.commitStagedChanges(1)
    await ai.revertStagedRun(1, 5)
    await ai.revertStagedBatch(1, 'b1')
    await ai.revertStagedItems(1, ['s1', 's2'])
    await ai.patchSessionThinking(1, { thinking_enabled: true })
    await ai.getSessionThinking(1)
    await ai.getContextUsage(1, 'gpt-4')

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/agent/sessions',
      'post /ai/agent/sessions',
      'delete /ai/agent/sessions/1',
      'get /ai/agent/sessions/1/messages',
      'post /ai/agent/sessions/1/confirm',
      'post /ai/agent/sessions/1/cancel',
      'patch /ai/agent/sessions/1/title',
      'post /ai/agent/sessions/1/regenerate-title',
      'get /ai/fs/mounts',
      'get /ai/agent/fs/list',
      'get /ai/agent/sessions/1/visible-resources',
      'post /ai/agent/sessions/1/visible-resources',
      'delete /ai/agent/sessions/1/visible-resources/9',
      'get /ai/agent/sessions/1/attachments',
      'delete /ai/agent/sessions/1/attachments/2',
      'get /ai/agent/sessions/1/staged-changes',
      'post /ai/agent/sessions/1/staged-changes/commit',
      'post /ai/agent/sessions/1/staged-changes/runs/5/revert',
      'post /ai/agent/sessions/1/revert',
      'post /ai/agent/sessions/1/revert',
      'patch /ai/agent/sessions/1/thinking',
      'get /ai/agent/sessions/1/thinking',
      'get /ai/agent/context-usage',
    ])
  })

  it('createAgentSession with no args defaults to sending empty body {}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).createAgentSession()
    expect(calls[0].body).toEqual({})
  })

  it('createAgentSession passes through custom body', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).createAgentSession({ title: 'Hi' })
    expect(calls[0].body).toEqual({ title: 'Hi' })
  })

  it('confirmAgentAction body is snake_case, remember defaults to false', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).confirmAgentAction('s1', 'c1', true)
    expect(calls[0].body).toEqual({ confirm_id: 'c1', confirmed: true, remember: false })
  })

  it('confirmAgentAction remember explicitly passed true', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).confirmAgentAction('s1', 'c1', false, true)
    expect(calls[0].body).toEqual({ confirm_id: 'c1', confirmed: false, remember: true })
  })

  it('confirmAgentAction without extra, body matches exactly', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).confirmAgentAction('s1', 'c1', true)
    expect(calls[0].body).toEqual({ confirm_id: 'c1', confirmed: true, remember: false })
  })

  it('confirmAgentAction spreads extra into body (elicitation action/content goes here)', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).confirmAgentAction('s1', 'c1', true, false, { action: 'accept', content: { name: 'Ada' } })
    expect(calls[0].body).toEqual({
      confirm_id: 'c1', confirmed: true, remember: false,
      action: 'accept', content: { name: 'Ada' },
    })
  })

  it('cancelAgentRun / commitStagedChanges / revertStagedRun send empty body {}', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.cancelAgentRun('s1')
    await ai.commitStagedChanges('s1')
    await ai.revertStagedRun('s1', 'r1')
    expect(calls.map((c) => c.body)).toEqual([{}, {}, {}])
  })

  it('updateAgentSessionTitle body {title}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).updateAgentSessionTitle('s1', 'New Title')
    expect(calls[0].body).toEqual({ title: 'New Title' })
  })

  it('regenerateAgentSessionTitle carries X-Agent-Provider-Type header + body {model}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).regenerateAgentSessionTitle('s1', 'gpt-4', 'openai')
    expect(calls[0].body).toEqual({ model: 'gpt-4' })
    expect(calls[0].cfg?.headers).toEqual({ 'X-Agent-Provider-Type': 'openai' })
  })

  it('listFsEntries converts showIgnored boolean to 0|1 and puts it in params', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.listFsEntries('/DATA')
    await ai.listFsEntries('/DATA', true)
    expect((calls[0].cfg?.params as Record<string, unknown>)).toEqual({ path: '/DATA', show_ignored: 0 })
    expect((calls[1].cfg?.params as Record<string, unknown>)).toEqual({ path: '/DATA', show_ignored: 1 })
  })

  it('addVisibleResource body {path,kind,force}, kind/force have defaults', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.addVisibleResource('s1', '/DATA/x')
    await ai.addVisibleResource('s1', '/DATA/y', 'file', true)
    expect(calls[0].body).toEqual({ path: '/DATA/x', kind: 'folder', force: false })
    expect(calls[1].body).toEqual({ path: '/DATA/y', kind: 'file', force: true })
  })

  it('revertStagedBatch body {batch_id}; revertStagedItems body {staged_ids}', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.revertStagedBatch('s1', 'b1')
    await ai.revertStagedItems('s1', ['a', 'b'])
    expect(calls[0].body).toEqual({ batch_id: 'b1' })
    expect(calls[1].body).toEqual({ staged_ids: ['a', 'b'] })
    expect(calls[0].url).toBe('/ai/agent/sessions/s1/revert')
    expect(calls[1].url).toBe('/ai/agent/sessions/s1/revert')
  })

  it('getContextUsage puts session_id/model in params', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).getContextUsage('s1', 'gpt-4')
    expect((calls[0].cfg?.params as Record<string, unknown>)).toEqual({ session_id: 's1', model: 'gpt-4' })
  })

  it('attachmentRawUrl appends URL-encoded ?token= when token is present', () => {
    const ai = createAi({} as AxiosInstance, () => 'a b+c')
    expect(ai.attachmentRawUrl('s1', 'att1')).toBe(
      `/v1/ai/agent/sessions/s1/attachments/att1/raw?token=${encodeURIComponent('a b+c')}`,
    )
  })

  it('attachmentRawUrl has no query when token is absent', () => {
    const ai = createAi({} as AxiosInstance, () => null)
    expect(ai.attachmentRawUrl('s1', 'att1')).toBe('/v1/ai/agent/sessions/s1/attachments/att1/raw')
  })

  it('uploadAttachment sends multipart FormData, onUploadProgress calculates percentage', async () => {
    let cfg: { headers?: Record<string, string>; onUploadProgress?: (e: { loaded: number; total?: number }) => void } | undefined
    let body: unknown
    const http = {
      post: async (_u: string, b: unknown, c: unknown) => {
        body = b
        cfg = c as typeof cfg
        return { data: { id: 'att1' } }
      },
    } as unknown as AxiosInstance

    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    let pct: number | undefined
    const res = await createAi(http, () => null).uploadAttachment('s1', file, {
      onProgress: (p) => { pct = p },
    })

    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
    expect(cfg?.headers?.['Content-Type']).toBe('multipart/form-data')
    cfg?.onUploadProgress?.({ loaded: 50, total: 100 })
    expect(pct).toBe(50)
    expect(res).toEqual({ id: 'att1' })
  })

  it('uploadAttachment does not crash without onProgress', async () => {
    const http = {
      post: async (_u: string, _b: unknown, c: unknown) => {
        ;(c as { onUploadProgress?: (e: { loaded: number; total?: number }) => void }).onUploadProgress?.({ loaded: 1, total: 100 })
        return { data: {} }
      },
    } as unknown as AxiosInstance
    const file = new File(['x'], 'x.txt')
    await expect(createAi(http, () => null).uploadAttachment('s1', file)).resolves.toEqual({})
  })

  it('getSessionThinking: normalizes enabled/level when value is present', async () => {
    const http = { get: async () => ({ data: { thinking_enabled: 1, thinking_level: 'high' } }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).getSessionThinking('s1')).toEqual({ enabled: true, level: 'high' })
  })

  it('getSessionThinking: thinking_enabled null field → null', async () => {
    const http = { get: async () => ({ data: { thinking_enabled: null } }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).getSessionThinking('s1')).toBeNull()
  })

  it('getSessionThinking: empty body → null', async () => {
    const http = { get: async () => ({ data: null }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).getSessionThinking('s1')).toBeNull()
  })

  it('getSessionThinking: request throws → null', async () => {
    const http = { get: async () => { throw new Error('boom') } } as unknown as AxiosInstance
    expect(await createAi(http, () => null).getSessionThinking('s1')).toBeNull()
  })

  it('getSessionThinking: level defaults to medium', async () => {
    const http = { get: async () => ({ data: { thinking_enabled: true } }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).getSessionThinking('s1')).toEqual({ enabled: true, level: 'medium' })
  })

  it('all methods uniformly return res.data (envelope as-is, no unwrap)', async () => {
    const envelope = { success: 200, message: '', data: { foo: 'bar' } }
    const http = { get: async () => ({ data: envelope }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).listAgentSessions()).toEqual(envelope)
  })
})

describe('createAi — models / providers / policy / blacklist / services-status', () => {
  it('URL+verb table driven assertions (all methods called once)', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)

    await ai.listModels()
    await ai.pullModel('llama3')
    await ai.deleteModel('llama3')
    await ai.searchHFModels('llama')
    await ai.listHFFiles('org/repo')
    await ai.importHFModel('org/repo', 'model.gguf')
    await ai.getImportStatus('model.gguf')
    await ai.cancelImport('model.gguf')
    await ai.listProviders()
    await ai.createProvider({ name: 'p1' })
    await ai.updateProvider(1, { name: 'p1b' })
    await ai.deleteProvider(1)
    await ai.listProviderModels(1)
    await ai.refreshProviderModels(1)
    await ai.updateProviderModels(1, ['m1', 'm2'])
    await ai.getPolicy()
    await ai.updatePolicy({ allow_network: true })
    await ai.listBlacklist()
    await ai.addBlacklistPattern('rm -rf')
    await ai.removeBlacklistPattern(1)
    await ai.getServicesStatus()

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/models',
      'post /ai/models/pull',
      'delete /ai/models/llama3',
      'get /ai/models/hf/search',
      'get /ai/models/hf/files',
      'post /ai/models/hf/import',
      'get /ai/models/hf/import/status',
      'delete /ai/models/hf/import/cancel?filename=model.gguf',
      'get /ai/providers',
      'post /ai/providers',
      'put /ai/providers/1',
      'delete /ai/providers/1',
      'get /ai/providers/1/models',
      'post /ai/providers/1/models/refresh',
      'put /ai/providers/1/models',
      'get /ai/policy',
      'put /ai/policy',
      'get /ai/blacklist',
      'post /ai/blacklist',
      'delete /ai/blacklist/1',
      'get /ai/services/status',
    ])
  })

  it('pullModel body {name}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).pullModel('llama3')
    expect(calls[0].body).toEqual({ name: 'llama3' })
  })

  it('deleteModel applies encodeURIComponent to name', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).deleteModel('a b/c.gguf')
    expect(calls[0].url).toBe(`/ai/models/${encodeURIComponent('a b/c.gguf')}`)
  })

  it('searchHFModels puts q in params', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).searchHFModels('llama')
    expect((calls[0].cfg?.params as Record<string, unknown>)).toEqual({ q: 'llama' })
  })

  it('listHFFiles puts repo in params', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).listHFFiles('org/repo')
    expect((calls[0].cfg?.params as Record<string, unknown>)).toEqual({ repo: 'org/repo' })
  })

  it('importHFModel body {repo, filename: file}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).importHFModel('org/repo', 'model.gguf')
    expect(calls[0].body).toEqual({ repo: 'org/repo', filename: 'model.gguf' })
  })

  it('getImportStatus puts filename in params', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).getImportStatus('model.gguf')
    expect((calls[0].cfg?.params as Record<string, unknown>)).toEqual({ filename: 'model.gguf' })
  })

  it('cancelImport encodes filename and concatenates it into the query string itself (not params)', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).cancelImport('a b.gguf')
    expect(calls[0].url).toBe('/ai/models/hf/import/cancel?filename=a%20b.gguf')
    expect(calls[0].cfg).toBeUndefined()
  })

  it('createProvider / updateProvider pass through body', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.createProvider({ name: 'p1', base_url: 'https://x' })
    await ai.updateProvider(1, { name: 'p1b' })
    expect(calls[0].body).toEqual({ name: 'p1', base_url: 'https://x' })
    expect(calls[1].body).toEqual({ name: 'p1b' })
  })

  it('refreshProviderModels sends empty body {}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).refreshProviderModels(1)
    expect(calls[0].body).toEqual({})
  })

  it('updateProviderModels body {models}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).updateProviderModels(1, ['m1', 'm2'])
    expect(calls[0].body).toEqual({ models: ['m1', 'm2'] })
  })

  it('updatePolicy passes through body', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).updatePolicy({ allow_network: true })
    expect(calls[0].body).toEqual({ allow_network: true })
  })

  it('addBlacklistPattern body {pattern}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).addBlacklistPattern('rm -rf')
    expect(calls[0].body).toEqual({ pattern: 'rm -rf' })
  })

  it('this group of methods also uniformly return res.data (envelope as-is, no unwrap)', async () => {
    const envelope = { success: 200, message: '', data: { foo: 'bar' } }
    const http = { get: async () => ({ data: envelope }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).listModels()).toEqual(envelope)
  })
})

describe('createAi — skills / mcp servers / mcp tokens / channels', () => {
  it('URL+verb table driven assertions (all methods called once)', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)

    await ai.listSkills()
    await ai.getSkill('s1')
    await ai.createSkill({ name: 'Sk' })
    await ai.updateSkill('s1', { name: 'Sk2' })
    await ai.deleteSkill('s1')
    await ai.getSkillFile('s1', 'dir/file.md')
    await ai.listMCPServers()
    await ai.createMCPServer({ name: 'm1' })
    await ai.updateMCPServer(1, { name: 'm1b' })
    await ai.deleteMCPServer(1)
    await ai.testMCPServer(1)
    await ai.parseMCPCommand('npx foo')
    await ai.listMCPTokens()
    await ai.createMCPToken({ name: 't1' })
    await ai.deleteMCPToken(1)
    await ai.listChannelInstances()
    await ai.createChannelInstance({ type: 'telegram' })
    await ai.setChannelInstanceEnabled(1, true)
    await ai.deleteChannelInstance(1)
    await ai.listPairableChannelInstances()
    await ai.createChannelPairingCode(1)
    await ai.listChannelBindings()
    await ai.deleteChannelBinding(1)
    await ai.setChannelBindingModel(1, 'gpt-4')
    await ai.setChannelBindingDownloadDir(1, '/DATA/x')

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/skills',
      'get /ai/skills/s1',
      'post /ai/skills',
      'patch /ai/skills/s1',
      'delete /ai/skills/s1',
      'get /ai/skills/s1/files/dir/file.md',
      'get /ai/mcp/servers',
      'post /ai/mcp/servers',
      'put /ai/mcp/servers/1',
      'delete /ai/mcp/servers/1',
      'post /ai/mcp/servers/1/test',
      'post /ai/mcp/servers/parse',
      'get /ai/mcp-tokens',
      'post /ai/mcp-tokens',
      'delete /ai/mcp-tokens/1',
      'get /ai/agent/channels/instances',
      'post /ai/agent/channels/instances',
      'put /ai/agent/channels/instances/1',
      'delete /ai/agent/channels/instances/1',
      'get /ai/agent/channels/pairable-instances',
      'post /ai/agent/channels/pairing-code',
      'get /ai/agent/channels/bindings',
      'delete /ai/agent/channels/bindings/1',
      'put /ai/agent/channels/bindings/1/model',
      'put /ai/agent/channels/bindings/1/download-dir',
    ])
  })

  it('getSkill/updateSkill/deleteSkill applies encodeURIComponent to id', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.getSkill('a b/c')
    await ai.updateSkill('a b/c', { name: 'x' })
    await ai.deleteSkill('a b/c')
    const enc = encodeURIComponent('a b/c')
    expect(calls[0].url).toBe(`/ai/skills/${enc}`)
    expect(calls[1].url).toBe(`/ai/skills/${enc}`)
    expect(calls[2].url).toBe(`/ai/skills/${enc}`)
  })

  it('createSkill / updateSkill pass through body', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.createSkill({ name: 'Sk' })
    await ai.updateSkill('s1', { name: 'Sk2' })
    expect(calls[0].body).toEqual({ name: 'Sk' })
    expect(calls[1].body).toEqual({ name: 'Sk2' })
  })

  it('getSkillFile: id is encoded, path segments are not encoded and concatenated as-is (consistent with Vue2)', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.getSkillFile('a b', 'dir/file name.md')
    expect(calls[0].url).toBe(`/ai/skills/${encodeURIComponent('a b')}/files/dir/file name.md`)
  })

  it('exportSkillURL appends encoded ?token= when token is present', () => {
    const ai = createAi({} as AxiosInstance, () => 'a b+c')
    expect(ai.exportSkillURL('s1')).toBe(
      `/v1/ai/skills/s1/export?token=${encodeURIComponent('a b+c')}`,
    )
  })

  it('exportSkillURL has no query when token is absent; id is encodeURIComponent', () => {
    const ai = createAi({} as AxiosInstance, () => null)
    expect(ai.exportSkillURL('a b')).toBe(`/v1/ai/skills/${encodeURIComponent('a b')}/export`)
  })

  it('testMCPServer body {} + config timeout 135000 passes through', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).testMCPServer(1)
    expect(calls[0].body).toEqual({})
    expect(calls[0].cfg).toEqual({ timeout: 135000 })
  })

  // The settings panel drops an in-flight probe when the user switches
  // servers or closes the panel (McpServerDetail's testAbort). axios only
  // honours that through `signal`, so the parameter has to reach the config
  // object -- swallowed here, the request would keep running and its answer
  // would land in whatever panel is open by then.
  it('testMCPServer forwards an AbortSignal alongside the 135s timeout', async () => {
    const { http, calls } = recorder()
    const ac = new AbortController()
    await createAi(http, () => null).testMCPServer(1, ac.signal)
    expect(calls[0].cfg).toEqual({ timeout: 135000, signal: ac.signal })
  })

  it('parseMCPCommand body {command_line}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).parseMCPCommand('npx foo --bar')
    expect(calls[0].body).toEqual({ command_line: 'npx foo --bar' })
  })

  it('createMCPServer / updateMCPServer pass through body', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.createMCPServer({ name: 'm1' })
    await ai.updateMCPServer(1, { name: 'm1b' })
    expect(calls[0].body).toEqual({ name: 'm1' })
    expect(calls[1].body).toEqual({ name: 'm1b' })
  })

  it('createMCPToken passes through body', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).createMCPToken({ name: 't1' })
    expect(calls[0].body).toEqual({ name: 't1' })
  })

  it('createChannelInstance passes through body; setChannelInstanceEnabled body {enabled}', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.createChannelInstance({ type: 'telegram' })
    await ai.setChannelInstanceEnabled(1, false)
    expect(calls[0].body).toEqual({ type: 'telegram' })
    expect(calls[1].body).toEqual({ enabled: false })
  })

  it('createChannelPairingCode body {instance_id}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).createChannelPairingCode(1)
    expect(calls[0].body).toEqual({ instance_id: 1 })
  })

  it('setChannelBindingModel body {model}; setChannelBindingDownloadDir body {download_dir}', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.setChannelBindingModel(1, 'gpt-4')
    await ai.setChannelBindingDownloadDir(1, '/DATA/x')
    expect(calls[0].body).toEqual({ model: 'gpt-4' })
    expect(calls[1].body).toEqual({ download_dir: '/DATA/x' })
  })

  // Settings parity 2026-08-24 — Feishu channel card (Vue2 ai.js:55-57).
  it('Feishu channel: three verbs on one URL, empty POST body', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.getLarkChannel()
    await ai.enableLarkChannel()
    await ai.disableLarkChannel()
    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/agent/channels/lark',
      'post /ai/agent/channels/lark',
      'delete /ai/agent/channels/lark',
    ])
    expect(calls[1].body).toEqual({})
  })

  it('this group of methods also uniformly return res.data (envelope as-is, no unwrap)', async () => {
    const envelope = { success: 200, message: '', data: { foo: 'bar' } }
    const http = { get: async () => ({ data: envelope }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).listSkills()).toEqual(envelope)
  })
})

// SP8-P4/P5 progressive disclosure -- MCP tool approval endpoints. All four
// live under the same `/v1/ai` prefix as the existing `/mcp/servers*` routes
// (common.V2APIPath on the backend, `PREFIX = '/ai'` here), not `/v2/ai`.
describe('createAi — MCP tool approvals (progressive disclosure)', () => {
  it('listMCPTools hits GET /ai/mcp/servers/:id/tools and passes the tools array through', async () => {
    const { http, calls } = recorder((verb, url) => {
      if (verb === 'get' && url === '/ai/mcp/servers/1/tools') {
        return {
          tools: [
            { name: 'create_issue', approved: true, last_seen_at: 100, desc_changed: false, stale_reason: '' },
          ],
        }
      }
      return null
    })
    const res = await createAi(http, () => null).listMCPTools(1)
    expect(calls[0].verb).toBe('get')
    expect(calls[0].url).toBe('/ai/mcp/servers/1/tools')
    expect(res.tools[0].name).toBe('create_issue')
    expect(res.tools[0].stale_reason).toBe('')
  })

  it('listMCPTools passes stale_reason_key and the server_level_approved fields through unchanged', async () => {
    const { http } = recorder((verb, url) => {
      if (verb === 'get' && url === '/ai/mcp/servers/1/tools') {
        return {
          tools: [
            {
              name: 'create_issue', approved: true, last_seen_at: 100, desc_changed: false,
              stale_reason: 'config changed: server identity no longer matches the approved one',
              stale_reason_key: 'config_changed',
            },
          ],
          server_level_approved: true,
          server_level_stale_reason: 'config changed: server identity no longer matches the approved one',
          server_level_stale_reason_key: 'config_changed',
        }
      }
      return null
    })
    const res = await createAi(http, () => null).listMCPTools(1)
    expect(res.tools[0].stale_reason_key).toBe('config_changed')
    expect(res.server_level_approved).toBe(true)
    expect(res.server_level_stale_reason_key).toBe('config_changed')
  })

  // mcp-progressive-disclosure Task 21 fix round -- total_stored_approvals
  // can exceed what tools/server_level_approved alone imply (a stored
  // approval for a since-removed tool never gets a `tools` row), so it must
  // pass through unchanged rather than being derived or dropped here.
  it('listMCPTools passes total_stored_approvals through unchanged', async () => {
    const { http } = recorder((verb, url) => {
      if (verb === 'get' && url === '/ai/mcp/servers/1/tools') {
        return {
          tools: [{ name: 'create_issue', approved: true, last_seen_at: 100, desc_changed: false }],
          server_level_approved: false,
          total_stored_approvals: 2,
        }
      }
      return null
    })
    const res = await createAi(http, () => null).listMCPTools(1)
    expect(res.total_stored_approvals).toBe(2)
  })

  it('setMCPApproval PUTs /ai/mcp/servers/:id/approvals/:tool with body {approved}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).setMCPApproval(1, 'create_issue', true)
    expect(calls[0].verb).toBe('put')
    expect(calls[0].url).toBe('/ai/mcp/servers/1/approvals/create_issue')
    expect(calls[0].body).toEqual({ approved: true })
  })

  it('setMCPApproval sends the "*" tool segment raw, not percent-encoded', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).setMCPApproval(1, '*', false)
    expect(calls[0].url).toBe('/ai/mcp/servers/1/approvals/*')
    expect(calls[0].url).not.toContain('%2A')
    expect(calls[0].body).toEqual({ approved: false })
  })

  it('clearMCPApprovals DELETEs /ai/mcp/servers/:id/approvals', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).clearMCPApprovals(1)
    expect(calls[0].verb).toBe('delete')
    expect(calls[0].url).toBe('/ai/mcp/servers/1/approvals')
  })

  it('listMCPApprovals GETs /ai/mcp/approvals and passes the items array through', async () => {
    const { http, calls } = recorder((verb, url) => {
      if (verb === 'get' && url === '/ai/mcp/approvals') {
        return { items: [{ server_id: 1, server_handle: 'srv-a', tool_name: 'create_issue' }] }
      }
      return null
    })
    const res = await createAi(http, () => null).listMCPApprovals()
    expect(calls[0].verb).toBe('get')
    expect(calls[0].url).toBe('/ai/mcp/approvals')
    expect(res.items[0].tool_name).toBe('create_issue')
  })

  // Fleshes out the brief's Step 1 stub ("add a server, then probe it
  // synchronously: POST first, then test, with the 135s timeout"). The probe
  // timeout chain must nest outside-in -- axios 135s > Go 125s > Python 120s
  // -- otherwise the frontend gives up before the backend can report the real
  // failure reason. This pins the two-call contract the UI wiring relies on:
  // createMCPServer's returned id feeds straight into testMCPServer, and the
  // test call still carries its 135s timeout.
  it('probing a freshly-created server: POST /mcp/servers then POST .../:id/test with the 135s timeout', async () => {
    const { http, calls } = recorder((verb, url) => {
      if (verb === 'post' && url === '/ai/mcp/servers') return { id: 7 }
      return {}
    })
    const ai = createAi(http, () => null)
    const created = await ai.createMCPServer({ name: 'm1' })
    const id = (created as { id: number }).id
    await ai.testMCPServer(id)

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'post /ai/mcp/servers',
      'post /ai/mcp/servers/7/test',
    ])
    expect(calls[1].cfg).toEqual({ timeout: 135000 })
  })
})

describe('createAi — user-settings / memory / observability / search knowledge base group', () => {
  it('URL+verb table driven assertions (all methods called once)', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)

    await ai.getThinkingDefaults()
    await ai.putThinkingDefaults({ level: 'high' })
    await ai.getMaxTurns()
    await ai.putMaxTurns(10)
    await ai.getTracingSetting()
    await ai.putTracingSetting({ enabled: true })
    await ai.listUserMemory()
    await ai.deleteUserMemory(1)
    await ai.getMemorySettings()
    await ai.putMemorySettings({ enabled: true, compaction_enabled: false, context_window: 8000 })
    await ai.getWebSettings()
    await ai.putWebSettings({ backend: 'tavily', base_url: '', enabled: true, api_key: 'tvly-x' })
    await ai.getObservabilityCompose()
    await ai.getSearchSettings()
    await ai.putSearchSettings({ foo: 'bar' })
    await ai.getFileindexStatus()
    await ai.rescanFileindex()
    await ai.nimoosSearch('fish')
    await ai.searchText({ query: 'fish' })
    await ai.searchChunk({ file_id: 'f1' })
    await ai.parserStats()
    await ai.parserState()
    await ai.parserFiles({ root_id: 1 })
    await ai.parserFolders()
    await ai.parserJobs({ status: 'failed' })
    await ai.parserControl({ action: 'pause' })
    await ai.parserReindexFiles({ file_ids: ['f1'] })
    await ai.parserRetryJobs()
    await ai.parserClearFailedJobs()
    await ai.parserDeleteJob(1)
    await ai.parserAllowlistExtensions()
    await ai.patchParserAllowlistExtensions({ ext: '.pdf', enabled: true })
    await ai.parserAllowlistFolders()
    await ai.addParserAllowlistFolder({ root_id: 1, path_glob: '*', action: 'allow' })
    await ai.deleteParserAllowlistFolder(1)
    await ai.parserTestAnalyze(new FormData())

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/agent/user-settings/thinking',
      'put /ai/agent/user-settings/thinking',
      'get /ai/agent/user-settings/max-turns',
      'put /ai/agent/user-settings/max-turns',
      'get /ai/agent/user-settings/tracing',
      'put /ai/agent/user-settings/tracing',
      'get /ai/agent/user-memory',
      'delete /ai/agent/user-memory/1',
      'get /ai/agent/user-memory/settings',
      'put /ai/agent/user-memory/settings',
      'get /ai/agent/web-settings',
      'put /ai/agent/web-settings',
      'get /ai/agent/observability/compose',
      'get /ai/search/settings',
      'put /ai/search/settings',
      'get /ai/search/fileindex/status',
      'post /ai/search/fileindex/rescan',
      'post /ai/search/agent/tool',
      'post /ai/search/text',
      'get /ai/search/chunk',
      'get /ai/parser/stats',
      'get /ai/parser/state',
      'get /ai/parser/files',
      'get /ai/parser/folders',
      'get /ai/parser/jobs',
      'post /ai/parser/control',
      'post /ai/parser/files/reindex',
      'post /ai/parser/jobs/retry',
      'post /ai/parser/jobs/clear-failed',
      'delete /ai/parser/jobs/1',
      'get /ai/parser/allowlist/extensions',
      'patch /ai/parser/allowlist/extensions',
      'get /ai/parser/allowlist/folders',
      'post /ai/parser/allowlist/folders',
      'delete /ai/parser/allowlist/folders/1',
      'post /ai/parser/test/analyze',
    ])
  })

  it('putThinkingDefaults / putSearchSettings / parserControl / parserReindexFiles pass through body', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.putThinkingDefaults({ level: 'high' })
    await ai.putSearchSettings({ foo: 'bar' })
    await ai.parserControl({ action: 'set_concurrency', n: 3 })
    await ai.parserReindexFiles({ filter: { root_id: 1 }, reason: 'manual' })
    expect(calls[0].body).toEqual({ level: 'high' })
    expect(calls[1].body).toEqual({ foo: 'bar' })
    expect(calls[2].body).toEqual({ action: 'set_concurrency', n: 3 })
    expect(calls[3].body).toEqual({ filter: { root_id: 1 }, reason: 'manual' })
  })

  it('putMaxTurns body {max_turns}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).putMaxTurns(42)
    expect(calls[0].body).toEqual({ max_turns: 42 })
  })

  it('putTracingSetting body {enabled}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).putTracingSetting({ enabled: false })
    expect(calls[0].body).toEqual({ enabled: false })
  })

  it('putMemorySettings body {enabled, compaction_enabled, context_window}', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).putMemorySettings({
      enabled: true,
      compaction_enabled: false,
      context_window: 16000,
    })
    expect(calls[0].body).toEqual({ enabled: true, compaction_enabled: false, context_window: 16000 })
  })

  // agent web tools Task 9 — putWebSettings passes the payload through
  // verbatim, no reshaping; the key point: when api_key is omitted the
  // request body truly LACKS the key (not `api_key: undefined`), otherwise
  // the backend's "omitted = keep the old key" semantics would break.
  it('putWebSettings passes payload through; omitting api_key really omits the field', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).putWebSettings({
      backend: 'tavily',
      base_url: '',
      enabled: true,
    })
    expect(calls[0].body).toEqual({ backend: 'tavily', base_url: '', enabled: true })
    expect('api_key' in (calls[0].body as object)).toBe(false)
  })

  it('putWebSettings with api_key passes it through verbatim', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).putWebSettings({
      backend: 'searxng',
      base_url: 'http://searx.lan:8080',
      enabled: false,
      api_key: 'tvly-abc',
    })
    expect(calls[0].body).toEqual({
      backend: 'searxng',
      base_url: 'http://searx.lan:8080',
      enabled: false,
      api_key: 'tvly-abc',
    })
  })

  it('nimoosSearch body {name:"nimoos_search", arguments:{query, sources, top_k}}, topK defaults to 20', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.nimoosSearch('fish')
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'fish', sources: undefined, top_k: 20 },
    })
  })

  it('nimoosSearch passes through when sources/topK are explicitly provided', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).nimoosSearch('fish', { sources: ['files'], topK: 5 })
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'fish', sources: ['files'], top_k: 5 },
    })
  })

  it('searchText passes through body; searchChunk puts params into query params', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.searchText({ query: 'fish', top_k: 10 })
    await ai.searchChunk({ file_id: 'f1', kind: 'body', chunk_no: 3, window: 2 })
    expect(calls[0].body).toEqual({ query: 'fish', top_k: 10 })
    expect(calls[1].cfg?.params).toEqual({ file_id: 'f1', kind: 'body', chunk_no: 3, window: 2 })
  })

  it('parserFiles/parserJobs puts params into query params', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.parserFiles({ root_id: 1, sort: 'indexed_at' })
    await ai.parserJobs({ status: 'failed', limit: 5 })
    expect(calls[0].cfg?.params).toEqual({ root_id: 1, sort: 'indexed_at' })
    expect(calls[1].cfg?.params).toEqual({ status: 'failed', limit: 5 })
  })

  it('parserFolders has no query when params are not provided; puts params when provided', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.parserFolders()
    await ai.parserFolders({ limit: 20 })
    expect(calls[0].cfg).toBeUndefined()
    expect(calls[1].cfg?.params).toEqual({ limit: 20 })
  })

  it('parserRetryJobs with no args defaults to empty body {}; parserClearFailedJobs sends empty body {}', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.parserRetryJobs()
    await ai.parserClearFailedJobs()
    expect(calls[0].body).toEqual({})
    expect(calls[1].body).toEqual({})
  })

  it('parserRetryJobs passes through custom body', async () => {
    const { http, calls } = recorder()
    await createAi(http, () => null).parserRetryJobs({ file_ids: ['f1', 'f2'] })
    expect(calls[0].body).toEqual({ file_ids: ['f1', 'f2'] })
  })

  it('patchParserAllowlistExtensions / addParserAllowlistFolder pass through body', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.patchParserAllowlistExtensions({ ext: '.pdf', enabled: true })
    await ai.addParserAllowlistFolder({ root_id: 1, path_glob: '*.md', action: 'deny' })
    expect(calls[0].body).toEqual({ ext: '.pdf', enabled: true })
    expect(calls[1].body).toEqual({ root_id: 1, path_glob: '*.md', action: 'deny' })
  })

  it('parserTestAnalyze sends multipart FormData + Content-Type header + 120s timeout', async () => {
    let cfg: { headers?: Record<string, string>; timeout?: number } | undefined
    let body: unknown
    const http = {
      post: async (_u: string, b: unknown, c: unknown) => {
        body = b
        cfg = c as typeof cfg
        return { data: { chunks: [] } }
      },
    } as unknown as AxiosInstance

    const fd = new FormData()
    fd.append('file', new File(['x'], 'x.pdf'))
    const res = await createAi(http, () => null).parserTestAnalyze(fd)

    expect(body).toBe(fd)
    expect(cfg?.headers?.['Content-Type']).toBe('multipart/form-data')
    expect(cfg?.timeout).toBe(120000)
    expect(res).toEqual({ chunks: [] })
  })

  it('this group of methods also uniformly return res.data (envelope as-is, no unwrap)', async () => {
    const envelope = { success: 200, message: '', data: { foo: 'bar' } }
    const http = { get: async () => ({ data: envelope }) } as unknown as AxiosInstance
    expect(await createAi(http, () => null).getThinkingDefaults()).toEqual(envelope)
  })
})

describe('createAi — scheduled tasks / toolbox / lark group', () => {
  it('URL+verb table driven assertions (all methods called once)', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)

    await ai.listTasks()
    await ai.createTask({ name: 't' })
    await ai.getTask('t1')
    await ai.updateTask('t1', { enabled: true })
    await ai.deleteTask('t1')
    await ai.runTaskNow('t1')
    await ai.listTaskRuns('t1')
    await ai.listPromptRevisions('t1')
    await ai.continueTaskRun('t1', 'r1', 'more context')
    await ai.adoptDeniedAction('t1', 'r1', 0)
    await ai.listTaskNotifyTargets()
    await ai.resetTaskWebhookToken('t1')
    await ai.cronPreview('0 9 * * *')
    await ai.draftTaskFromSession('s1', 'm1', 'ollama')
    await ai.listToolboxComponents()
    await ai.installToolboxComponent('gh')
    await ai.upgradeToolboxComponent('gh')
    await ai.uninstallToolboxComponent('gh')
    await ai.getLarkBinding()
    await ai.startLarkBinding()
    await ai.deleteLarkBinding()

    expect(calls.map((c) => `${c.verb} ${c.url}`)).toEqual([
      'get /ai/agent/tasks',
      'post /ai/agent/tasks',
      'get /ai/agent/tasks/t1',
      'put /ai/agent/tasks/t1',
      'delete /ai/agent/tasks/t1',
      'post /ai/agent/tasks/t1/run',
      'get /ai/agent/tasks/t1/runs',
      'get /ai/agent/tasks/t1/prompt-revisions',
      'post /ai/agent/tasks/t1/runs/r1/continue',
      'post /ai/agent/tasks/t1/preauth/from-denied',
      'get /ai/agent/tasks/notify-targets',
      'post /ai/agent/tasks/t1/webhook-token/reset',
      'get /ai/agent/tasks/cron-preview',
      'post /ai/agent/tasks/draft-from-session',
      'get /ai/agent/toolbox',
      'post /ai/agent/toolbox/install',
      'post /ai/agent/toolbox/upgrade',
      'post /ai/agent/toolbox/uninstall',
      'get /ai/agent/lark/binding',
      'post /ai/agent/lark/binding',
      'delete /ai/agent/lark/binding',
    ])
  })

  it('task ids are URI-encoded; params and headers ride the config', async () => {
    const { http, calls } = recorder()
    const ai = createAi(http, () => null)
    await ai.getTask('a b/c')
    expect(calls[0].url).toBe(`/ai/agent/tasks/${encodeURIComponent('a b/c')}`)
    await ai.listTaskRuns('t1', 20)
    expect(calls[1].cfg).toEqual({ params: { limit: 20 } })
    await ai.cronPreview('*/5 * * * *')
    expect(calls[2].cfg).toEqual({ params: { expr: '*/5 * * * *' } })
    await ai.adoptDeniedAction('t1', 'r9', 3)
    expect(calls[3].body).toEqual({ run_id: 'r9', index: 3 })
    await ai.draftTaskFromSession('s1', 'm1', 'other', { 'X-Agent-Provider-Key': 'k' })
    expect(calls[4].body).toEqual({ session_id: 's1', model: 'm1' })
    expect(calls[4].cfg).toEqual({
      headers: { 'X-Agent-Provider-Type': 'other', 'X-Agent-Provider-Key': 'k' },
    })
    await ai.installToolboxComponent('gh')
    expect(calls[5].body).toEqual({ id: 'gh' })
  })
})

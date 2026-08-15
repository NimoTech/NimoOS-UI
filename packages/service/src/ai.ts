import type { AxiosInstance } from 'axios'

/** Aligns with the backend's per-tool row (`GET /mcp/servers/:id/tools`, and
 *  each item embedded in `POST .../test`'s tool list going forward). */
export interface McpToolRow {
  name: string
  approved: boolean
  last_seen_at: number
  desc_changed: boolean
  /** Non-empty when this approval is currently void (e.g. every approval for
   *  a server goes void after its URL is edited) -- the only signal that lets
   *  the UI tell "approved and in force" apart from "approved but void".
   *  The backend sends this field `omitempty`, so it may be absent or ''. */
  stale_reason?: string
  /** Machine-readable counterpart of `stale_reason` -- one of the backend's
   *  `service.StaleReasonXxx` codes (`config_changed` / `tool_removed` /
   *  `schema_changed` / `stale`), added so the UI can map it through its own
   *  i18n table (`mcpErrorKey.ts`'s `staleReasonKeyToI18nKey`) instead of
   *  rendering `stale_reason`'s English prose directly. `omitempty` on the
   *  backend, same as `stale_reason` -- may be absent or ''. */
  stale_reason_key?: string
}

/** One row of the cross-server summary (`GET /mcp/approvals`). */
export interface McpApprovalRow {
  server_id: number
  server_handle: string
  tool_name: string
}

/**
 * ai 域 —— agent 会话核心组(sessions / confirm / attachments / staged-changes / thinking)。
 *
 * 返回值约定与本包其余域(如 appstore.ts)不同:此域的方法**统一返回 `res.data`
 * (HTTP body,信封原样,不做 unwrap)**。原因是 AI 后端由 Go 服务(系统标准
 * `Result{Success,Message,Data}` 壳)与 Python agent 子服务(裸 JSON,无壳)混合拼成,
 * 信封形状并不统一,共享层强行拆壳反而会丢信息或猜错形状。拆壳这件事交给各自消费方
 * (Vue2/Vue3 store)按自己知道的形状去做。
 *
 * 唯一的例外是 `getSessionThinking`——它的 null 语义("本会话无覆盖,退回用户级默认值")
 * 是调用方直接依赖的契约,这里逐字保留 Vue2 `src/service/ai.js` 里的归一化逻辑。
 */
export function createAi(http: AxiosInstance, getToken: () => string | null) {
  const PREFIX = '/ai'

  return {
    async listAgentSessions(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/sessions`)
      return res.data
    },

    async createAgentSession(body: Record<string, unknown> = {}): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions`, body)
      return res.data
    },

    async deleteAgentSession(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/agent/sessions/${id}`)
      return res.data
    },

    async listAgentMessages(sessionId: string | number): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/sessions/${sessionId}/messages`)
      return res.data
    },

    async confirmAgentAction(
      sessionId: string | number,
      confirmId: string,
      confirmed: boolean,
      remember = false,
      // MCP elicitation's action / content pass through here: elicitation is a
      // three-state outcome (accept/decline/cancel) that can carry an answer,
      // which the two-state `confirmed` cannot express. Every other card never
      // passes this, so the existing two-state path is unchanged byte-for-byte.
      extra?: Record<string, unknown>,
    ): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/confirm`, {
        confirm_id: confirmId,
        confirmed,
        remember,
        ...(extra || {}),
      })
      return res.data
    },

    async cancelAgentRun(sessionId: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/cancel`, {})
      return res.data
    },

    async updateAgentSessionTitle(id: string | number, title: string): Promise<unknown> {
      const res = await http.patch(`${PREFIX}/agent/sessions/${id}/title`, { title })
      return res.data
    },

    async regenerateAgentSessionTitle(
      id: string | number,
      model: string,
      providerType: string,
    ): Promise<unknown> {
      const res = await http.post(
        `${PREFIX}/agent/sessions/${id}/regenerate-title`,
        { model },
        { headers: { 'X-Agent-Provider-Type': providerType } },
      )
      return res.data
    },

    async listMounts(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/fs/mounts`)
      return res.data
    },

    async listFsEntries(path: string, showIgnored = false): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/fs/list`, {
        params: { path, show_ignored: showIgnored ? 1 : 0 },
      })
      return res.data
    },

    async listVisibleResources(sessionId: string | number): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/sessions/${sessionId}/visible-resources`)
      return res.data
    },

    async addVisibleResource(
      sessionId: string | number,
      path: string,
      kind = 'folder',
      force = false,
    ): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/visible-resources`, {
        path,
        kind,
        force,
      })
      return res.data
    },

    async removeVisibleResource(sessionId: string | number, resId: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/agent/sessions/${sessionId}/visible-resources/${resId}`)
      return res.data
    },

    /** 浏览器上传的会话附件(multipart)。onProgress 接收 0-100 的整数百分比。 */
    async uploadAttachment(
      sessionId: string | number,
      file: File | Blob,
      opts?: { onProgress?: (pct: number) => void },
    ): Promise<unknown> {
      const form = new FormData()
      form.append('file', file)
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e: { loaded: number; total?: number }) => {
          if (opts?.onProgress && e.total) {
            opts.onProgress(Math.round((e.loaded / e.total) * 100))
          }
        },
      })
      return res.data
    },

    async listAttachments(sessionId: string | number): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/sessions/${sessionId}/attachments`)
      return res.data
    },

    async deleteAttachment(sessionId: string | number, attachmentId: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/agent/sessions/${sessionId}/attachments/${attachmentId}`)
      return res.data
    },

    /** 同步 URL builder(不走 axios)——供 <img src=...> / 直接下载锚点使用。
     *  浏览器发这类请求带不上 Authorization 头,故把 token 落进 ?token= 查询参数,
     *  AI 服务的 JWT 中间件在没有 Authorization 头时接受这个兜底。 */
    attachmentRawUrl(sessionId: string | number, attachmentId: string | number): string {
      const t = getToken()
      const q = t ? `?token=${encodeURIComponent(t)}` : ''
      return `/v1/ai/agent/sessions/${sessionId}/attachments/${attachmentId}/raw${q}`
    },

    async listStagedChanges(sessionId: string | number): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/sessions/${sessionId}/staged-changes`)
      return res.data
    },

    async commitStagedChanges(sessionId: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/staged-changes/commit`, {})
      return res.data
    },

    async revertStagedRun(sessionId: string | number, runId: string | number): Promise<unknown> {
      const res = await http.post(
        `${PREFIX}/agent/sessions/${sessionId}/staged-changes/runs/${runId}/revert`,
        {},
      )
      return res.data
    },

    async revertStagedBatch(sessionId: string | number, batchId: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/revert`, { batch_id: batchId })
      return res.data
    },

    async revertStagedItems(sessionId: string | number, stagedIds: (string | number)[]): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/sessions/${sessionId}/revert`, { staged_ids: stagedIds })
      return res.data
    },

    async patchSessionThinking(sessionId: string | number, payload: Record<string, unknown>): Promise<unknown> {
      const res = await http.patch(`${PREFIX}/agent/sessions/${sessionId}/thinking`, payload)
      return res.data
    },

    /** 归一化逻辑逐字对齐 Vue2 src/service/ai.js:345-357——
     *  body 空,或 thinking_enabled 为 null/undefined → null(退回用户级默认值);
     *  否则 {enabled: !!thinking_enabled, level: thinking_level || 'medium'};
     *  请求异常一律吞掉返回 null。 */
    async getSessionThinking(
      sessionId: string | number,
    ): Promise<{ enabled: boolean; level: string } | null> {
      try {
        const res = await http.get(`${PREFIX}/agent/sessions/${sessionId}/thinking`)
        const s = res.data as { thinking_enabled?: unknown; thinking_level?: string } | null | undefined
        if (!s || s.thinking_enabled === null || s.thinking_enabled === undefined) return null
        return { enabled: !!s.thinking_enabled, level: s.thinking_level || 'medium' }
      } catch {
        return null
      }
    },

    async getContextUsage(sessionId: string | number, model: string): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/context-usage`, {
        params: { session_id: sessionId, model },
      })
      return res.data
    },

    // ---- Models ----

    async listModels(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/models`)
      return res.data
    },

    async pullModel(name: string): Promise<unknown> {
      const res = await http.post(`${PREFIX}/models/pull`, { name })
      return res.data
    },

    async deleteModel(name: string): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/models/${encodeURIComponent(name)}`)
      return res.data
    },

    async searchHFModels(q: string): Promise<unknown> {
      const res = await http.get(`${PREFIX}/models/hf/search`, { params: { q } })
      return res.data
    },

    async listHFFiles(repo: string): Promise<unknown> {
      const res = await http.get(`${PREFIX}/models/hf/files`, { params: { repo } })
      return res.data
    },

    async importHFModel(repo: string, file: string): Promise<unknown> {
      const res = await http.post(`${PREFIX}/models/hf/import`, { repo, filename: file })
      return res.data
    },

    async getImportStatus(filename: string): Promise<unknown> {
      const res = await http.get(`${PREFIX}/models/hf/import/status`, { params: { filename } })
      return res.data
    },

    /** filename 拼进 query 字符串本身(而非 axios params),与 Vue2 src/service/ai.js:15 逐字对齐。 */
    async cancelImport(filename: string): Promise<unknown> {
      const res = await http.delete(
        `${PREFIX}/models/hf/import/cancel?filename=${encodeURIComponent(filename)}`,
      )
      return res.data
    },

    // ---- Providers ----

    async listProviders(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/providers`)
      return res.data
    },

    async createProvider(data: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/providers`, data)
      return res.data
    },

    async updateProvider(id: string | number, data: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`${PREFIX}/providers/${id}`, data)
      return res.data
    },

    async deleteProvider(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/providers/${id}`)
      return res.data
    },

    async listProviderModels(id: string | number): Promise<unknown> {
      const res = await http.get(`${PREFIX}/providers/${id}/models`)
      return res.data
    },

    async refreshProviderModels(id: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/providers/${id}/models/refresh`, {})
      return res.data
    },

    async updateProviderModels(id: string | number, models: unknown): Promise<unknown> {
      const res = await http.put(`${PREFIX}/providers/${id}/models`, { models })
      return res.data
    },

    // ---- Privacy Policy ----

    async getPolicy(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/policy`)
      return res.data
    },

    async updatePolicy(data: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`${PREFIX}/policy`, data)
      return res.data
    },

    // ---- Hard blacklist ----

    async listBlacklist(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/blacklist`)
      return res.data
    },

    async addBlacklistPattern(pattern: string): Promise<unknown> {
      const res = await http.post(`${PREFIX}/blacklist`, { pattern })
      return res.data
    },

    async removeBlacklistPattern(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/blacklist/${id}`)
      return res.data
    },

    // ---- Services Status ----

    async getServicesStatus(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/services/status`)
      return res.data
    },

    // ---- Skills ----

    async listSkills(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/skills`)
      return res.data
    },

    async getSkill(id: string): Promise<unknown> {
      const res = await http.get(`${PREFIX}/skills/${encodeURIComponent(id)}`)
      return res.data
    },

    async createSkill(data: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/skills`, data)
      return res.data
    },

    async updateSkill(id: string, patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.patch(`${PREFIX}/skills/${encodeURIComponent(id)}`, patch)
      return res.data
    },

    async deleteSkill(id: string): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/skills/${encodeURIComponent(id)}`)
      return res.data
    },

    /** path 段不做 encodeURIComponent,原样拼接——与 Vue2 src/service/ai.js:191-193 逐字对齐。 */
    async getSkillFile(id: string, path: string): Promise<unknown> {
      const res = await http.get(`${PREFIX}/skills/${encodeURIComponent(id)}/files/${path}`)
      return res.data
    },

    /** 同步 URL builder(不走 axios)——同 attachmentRawUrl 套路,token 走 ?token= 兜底。 */
    exportSkillURL(id: string): string {
      const t = getToken()
      const q = t ? `?token=${encodeURIComponent(t)}` : ''
      return `/v1/ai/skills/${encodeURIComponent(id)}/export${q}`
    },

    // ---- MCP servers ----

    async listMCPServers(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/mcp/servers`)
      return res.data
    },

    async createMCPServer(data: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/mcp/servers`, data)
      return res.data
    },

    async updateMCPServer(id: string | number, data: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`${PREFIX}/mcp/servers/${id}`, data)
      return res.data
    },

    async deleteMCPServer(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/mcp/servers/${id}`)
      return res.data
    },

    // The probe timeout chain must nest outside-in: axios > Go > Python, so the
    // layer holding the subprocess and socket -- the one that can report an
    // accurate reason -- always gives up first. If this axios timeout were not
    // the largest of the three, a slow-but-healthy stdio server would be cut
    // off in the browser and the accurate probe error would never reach the
    // user.
    //
    // Observed values as of NimoOS-AI main@c15e47c (2026-08-06) -- these live in
    // a separate repo and drift silently, so treat them as a snapshot, not a
    // contract: Go proxy 25s (http) / 100s (stdio) (route/v2/mcp.go:344,346);
    // Python TEST_TIMEOUT=20s / STDIO_TEST_TIMEOUT=90s
    // (agent/mcp_client/client.py:738-739). 135000 > 100s > 90s holds.
    async testMCPServer(id: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/mcp/servers/${id}/test`, {}, { timeout: 135000 })
      return res.data
    },

    async parseMCPCommand(commandLine: string): Promise<unknown> {
      const res = await http.post(`${PREFIX}/mcp/servers/parse`, { command_line: commandLine })
      return res.data
    },

    // ---- MCP tool approvals (progressive disclosure) ----
    // Same `/v1/ai` prefix as the MCP server routes above (common.V2APIPath on
    // the backend, PREFIX = '/ai' here) -- not '/v2/ai'.

    /** Zero-network on the server side -- reads the persisted tool list, does
     *  not re-probe the MCP server itself. `server_level_approved` reports
     *  whether a server-level ('*') grant exists at all -- true even if it is
     *  currently void, mirroring each tool row's own `approved` semantics
     *  (see `McpToolRow`'s doc comment) -- since the `tools` rows alone give
     *  no signal either way. */
    async listMCPTools(id: string | number): Promise<{
      tools: McpToolRow[]
      server_level_approved: boolean
      server_level_stale_reason?: string
      server_level_stale_reason_key?: string
    }> {
      const res = await http.get(`${PREFIX}/mcp/servers/${id}/tools`)
      return res.data
    },

    /** `tool` of `"*"` means server-level approval. The segment is sent raw
     *  -- not run through encodeURIComponent -- so `"*"` reaches the backend
     *  as a literal `*`; encoding it to `%2A` would make the backend see an
     *  unknown tool name instead of the server-level wildcard. */
    async setMCPApproval(id: string | number, tool: string, approved: boolean): Promise<void> {
      const res = await http.put(`${PREFIX}/mcp/servers/${id}/approvals/${tool}`, { approved })
      return res.data
    },

    /** Revokes every approval recorded for this server. */
    async clearMCPApprovals(id: string | number): Promise<void> {
      const res = await http.delete(`${PREFIX}/mcp/servers/${id}/approvals`)
      return res.data
    },

    /** Cross-server approval summary. */
    async listMCPApprovals(): Promise<{ items: McpApprovalRow[] }> {
      const res = await http.get(`${PREFIX}/mcp/approvals`)
      return res.data
    },

    // ---- MCP access tokens (this NAS as an MCP server) ----

    async listMCPTokens(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/mcp-tokens`)
      return res.data
    },

    async createMCPToken(data: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/mcp-tokens`, data)
      return res.data
    },

    async deleteMCPToken(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/mcp-tokens/${id}`)
      return res.data
    },

    // ---- Channels (Telegram etc.) — chat access to the agent ----

    async listChannelInstances(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/channels/instances`)
      return res.data
    },

    async createChannelInstance(data: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/channels/instances`, data)
      return res.data
    },

    async setChannelInstanceEnabled(id: string | number, enabled: boolean): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/channels/instances/${id}`, { enabled })
      return res.data
    },

    async deleteChannelInstance(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/agent/channels/instances/${id}`)
      return res.data
    },

    async listPairableChannelInstances(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/channels/pairable-instances`)
      return res.data
    },

    async createChannelPairingCode(instanceId: string | number): Promise<unknown> {
      const res = await http.post(`${PREFIX}/agent/channels/pairing-code`, { instance_id: instanceId })
      return res.data
    },

    async listChannelBindings(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/channels/bindings`)
      return res.data
    },

    async deleteChannelBinding(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/agent/channels/bindings/${id}`)
      return res.data
    },

    async setChannelBindingModel(id: string | number, model: string): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/channels/bindings/${id}/model`, { model })
      return res.data
    },

    async setChannelBindingDownloadDir(id: string | number, downloadDir: string): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/channels/bindings/${id}/download-dir`, {
        download_dir: downloadDir,
      })
      return res.data
    },

    // ---- User settings: thinking defaults / max-turns / tracing ----

    async getThinkingDefaults(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/user-settings/thinking`)
      return res.data
    },

    async putThinkingDefaults(payload: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/user-settings/thinking`, payload)
      return res.data
    },

    async getMaxTurns(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/user-settings/max-turns`)
      return res.data
    },

    async putMaxTurns(maxTurns: number): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/user-settings/max-turns`, { max_turns: maxTurns })
      return res.data
    },

    async getTracingSetting(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/user-settings/tracing`)
      return res.data
    },

    async putTracingSetting(payload: { enabled: boolean }): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/user-settings/tracing`, { enabled: payload.enabled })
      return res.data
    },

    // ---- Agent memory ----

    async listUserMemory(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/user-memory`)
      return res.data
    },

    async deleteUserMemory(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/agent/user-memory/${id}`)
      return res.data
    },

    async getMemorySettings(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/user-memory/settings`)
      return res.data
    },

    async putMemorySettings(payload: {
      enabled?: boolean
      compaction_enabled?: boolean
      /** null = automatic (backend infers from the model's limit). Vue2
       *  MemorySection.vue:141 sends null when the input is left blank —
       *  the original type omitted null, forcing callers under TS strict
       *  to cast. SP8-P2b Task 6 / D5. */
      context_window?: number | null
    }): Promise<unknown> {
      const res = await http.put(`${PREFIX}/agent/user-memory/settings`, {
        enabled: payload.enabled,
        compaction_enabled: payload.compaction_enabled,
        context_window: payload.context_window,
      })
      return res.data
    },

    // ---- Observability ----

    async getObservabilityCompose(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/agent/observability/compose`)
      return res.data
    },

    // ---- Search settings / file-index diagnostics (proxied to NimoOS-Search) ----

    async getSearchSettings(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/search/settings`)
      return res.data
    },

    async putSearchSettings(patch: Record<string, unknown>): Promise<unknown> {
      const res = await http.put(`${PREFIX}/search/settings`, patch)
      return res.data
    },

    async getFileindexStatus(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/search/fileindex/status`)
      return res.data
    },

    async rescanFileindex(): Promise<unknown> {
      const res = await http.post(`${PREFIX}/search/fileindex/rescan`, {})
      return res.data
    },

    /** 首页本地搜索入口——聚合语义/文件名/图片搜索的工具调用包装,与 Vue2
     *  src/service/ai.js:333-338 逐字对齐。topK 默认 20。 */
    async nimoosSearch(
      query: string,
      opts?: { sources?: unknown; topK?: number },
    ): Promise<unknown> {
      const res = await http.post(`${PREFIX}/search/agent/tool`, {
        name: 'nimoos_search',
        arguments: { query, sources: opts?.sources, top_k: opts?.topK ?? 20 },
      })
      return res.data
    },

    // ---- Knowledge base: text search / chunk context (P5 SearchView) ----

    async searchText(body: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/search/text`, body)
      return res.data
    },

    async searchChunk(params: Record<string, unknown>): Promise<unknown> {
      const res = await http.get(`${PREFIX}/search/chunk`, { params })
      return res.data
    },

    // ---- Knowledge base: parser overview / files / folders / jobs ----

    async parserStats(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/stats`)
      return res.data
    },

    async parserState(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/state`)
      return res.data
    },

    async parserFiles(params: Record<string, unknown>): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/files`, { params })
      return res.data
    },

    /** params 可选——real 调用点(parserStore.js:28)会传 {limit}, 也有调用点不传任何参数。 */
    async parserFolders(params?: Record<string, unknown>): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/folders`, params ? { params } : undefined)
      return res.data
    },

    async parserJobs(params: Record<string, unknown>): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/jobs`, { params })
      return res.data
    },

    async parserControl(body: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/parser/control`, body)
      return res.data
    },

    async parserReindexFiles(body: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/parser/files/reindex`, body)
      return res.data
    },

    async parserRetryJobs(body: Record<string, unknown> = {}): Promise<unknown> {
      const res = await http.post(`${PREFIX}/parser/jobs/retry`, body)
      return res.data
    },

    async parserClearFailedJobs(): Promise<unknown> {
      const res = await http.post(`${PREFIX}/parser/jobs/clear-failed`, {})
      return res.data
    },

    async parserDeleteJob(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/parser/jobs/${id}`)
      return res.data
    },

    // ---- Knowledge base: allowlist (extensions / folders) ----

    async parserAllowlistExtensions(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/allowlist/extensions`)
      return res.data
    },

    async patchParserAllowlistExtensions(body: Record<string, unknown>): Promise<unknown> {
      const res = await http.patch(`${PREFIX}/parser/allowlist/extensions`, body)
      return res.data
    },

    async parserAllowlistFolders(): Promise<unknown> {
      const res = await http.get(`${PREFIX}/parser/allowlist/folders`)
      return res.data
    },

    async addParserAllowlistFolder(body: Record<string, unknown>): Promise<unknown> {
      const res = await http.post(`${PREFIX}/parser/allowlist/folders`, body)
      return res.data
    },

    async deleteParserAllowlistFolder(id: string | number): Promise<unknown> {
      const res = await http.delete(`${PREFIX}/parser/allowlist/folders/${id}`)
      return res.data
    },

    /** 小样文件解析测试(ParserTest.vue)。与 Vue2 src/views/AI/Parser/ParserTest.vue:207-219
     *  逐字对齐——调用方自行组装 multipart FormData(file/query/embed/rerank/ocr/
     *  target_tokens/overlap_tokens/min_tokens),这里只负责补 multipart 头 + 单独放宽
     *  到 120s 超时(而非全局默认超时)。 */
    async parserTestAnalyze(body: FormData): Promise<unknown> {
      const res = await http.post(`${PREFIX}/parser/test/analyze`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      return res.data
    },
  }
}

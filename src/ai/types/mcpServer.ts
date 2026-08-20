// SP8-P4 Task 2 — align JSON tags byte-for-byte with backend DTO/contract. Field order and
// naming correspond one-to-one with the backend; no new fields, no omissions. Endpoint prefix
// is `/v1/ai` ("v2" is just the handler code generation/package name, not a URL version — P3b
// final review M4 hit this pitfall; see the top of types/skill.ts for details).
// All endpoints return bare (no envelope). The shared package `@nimotech/nimoos-service` already
// strips the axios layer with `return res.data`; consumers must not strip another layer (public
// constraint §4 single-layer fetch; design §3 hit 4 places).
//
// ⚠️ Review note: the actual line numbers for the http/stdio branches in `mcpparse.go` are `:39` /
// `:86` (this file cites actual line numbers throughout, not `:38,80` copied from design doc §2.1
// — verified against source and found a 1/6 line difference, reported in T2 report).

/** Align with the three transport types accepted by backend `mcp.go` `validateAndClean` (`:274-287`).
 *  Note: `McpServer.transport` / `McpParsed.transport` are bare `string` on the backend (no enum
 *  tightening), so we use `McpTransport` here to give the frontend dropdown a restricted set of
 *  literals. */
export type McpTransport = 'http' | 'sse' | 'stdio'

/** Align with backend `mcpDTO` (`mcp.go:41-51`). `GET /mcp/servers` returns bare array of this
 *  shape on 200 (`mcp.go:96`); `POST .../parse` does not return this shape (see `McpParsed`). */
export interface McpServer {
  /** Go `int64` (`mcp.go:42`), JSON-serialized as number, not string. */
  id: number
  name: string
  /** Bare string, not `McpTransport` — the backend does not validate enums; `validateAndClean`
   *  (`mcp.go:273-289`) only blocks invalid values at 400 on save. */
  transport: string
  url: string
  command: string
  /** Backend `toMcpDTO` (`mcp.go:53-64`, nil fallback at `:54-58`) guarantees non-nil, but
   *  consumers should still write `(s.args || [])` as a fallback — Go's nil slice serializes
   *  to JSON `null`, so this defensive check must be kept at the call site and not deleted just
   *  because "the backend guarantees it". */
  args: string[]
  enabled: boolean
  /** Just a boolean flag, not the secret itself — secrets (headers/env plaintext) are never
   *  sent down (`mcp.go:62`). */
  has_headers: boolean
  has_env: boolean
}

/** Align with backend `mcpparse.Parsed` (`mcpparse.go:13-20`); `POST /mcp/servers/parse`
 *  returns bare object on 200 (`mcp.go:137`). **Not persisted**, used only for "quick paste"
 *  pre-filling the form. */
export interface McpParsed {
  /** Backend **only produces `"http"` or `"stdio"`, never `"sse"`**
   *  (http branch at `mcpparse.go:39`, stdio branch at `:86`) — not a defect, SSE is
   *  user-selected in the form (N5, per design §6). */
  transport: string
  command: string
  /** Non-nil (`mcpparse.go:79-82` explicitly defaults to `[]string{}`). */
  args: string[]
  /** Non-nil map (`mcpparse.go:69` initialized to `map[string]string{}`). */
  env: Record<string, string>
  url: string
  suggested_name: string
}

/** Align with Python agent `test_server` return (`agent/mcp_client/client.py:432-461`);
 *  Go side `mcp.go:355` (fix round M3: previously mistyped as `mc.go:355`, missing one `p`)
 *  passes it through as-is with `c.JSONBlob`; `POST .../:id/test` returns bare object on 200.
 *  Success state uses only `ok/tool_count/tools`; failure state fields depend on `error_key`. */
export interface McpTestResult {
  ok: boolean
  tool_count?: number
  tools?: string[]
  /** English string assembled by backend (e.g., `"Connection failed: ..."`) — **not surfaced
   *  in this repo's UI**; always maps `error_key` to an i18n key (design §5.3 / D8). */
  error?: string
  /** Only four values: `probe_timeout` (`client.py:437`) · `connect_failed`
   *  (`:448`) · `list_timeout` (`:453`) · `list_failed` (`:456`). */
  error_key?: string
  /** Original exception `str(e)`, carried only by `connect_failed` / `list_failed`
   *  (`client.py:448,456`). */
  detail?: string
}

/** Shape of form submission payload in this repo, aligned with backend `mcpRequest` (`mcp.go:29-39`)
 *  fields consumed by `applyReq` (`:230-269`) — excludes `command_line` (that's a quick-paste-only
 *  field, parsed through `McpParsed`, not into the save payload).
 *  `POST /mcp/servers` returns **201 `{"id": <int64>}`** on success (`mcp.go:121`) —
 *  not a complete `McpServer` object; consumers cannot expect to get all fields back.
 *  `PUT /mcp/servers/:id` returns **204 no content** on success (`mcp.go:172`) — do not read
 *  the return value. */
export interface McpServerFormPayload {
  name: string
  transport: string
  enabled: boolean
  url?: string
  command?: string
  args?: string[]
  /** Omitting this field in edit mode means "keep unchanged"; backend `applyReq` only
   *  overwrites fields present in the request (`mcp.go:247-253`) — corresponds to N3 (edit mode
   *  cannot clear existing headers/env, as copied). */
  headers?: Record<string, string>
  env?: Record<string, string>
}

/** View type newly created this sprint (no Vue2 equivalent). `util/mcpErrorKey.ts` (T3) maps
 *  `McpTestResult` / HTTP errors to this shape; detail components (T6/T7) consume only this type,
 *  never touching `McpTestResult` directly — ensuring the UI always gets i18n keys, never raw
 *  backend text (public constraint: "UI never echoes raw backend text"). */
export type McpTestView =
  | {
      ok: true; toolCount: number; tools: string[]
      // #141: the protocol negotiation result from the backend's 200 body. Older
      // backends omit these three fields entirely — normalized to '' / [].
      protocolEra: string; protocolVersion: string; supportedVersions: string[]
      /** The probe this result came from was already running when the server
       *  was edited, so it describes the pre-edit config (backend
       *  `config_changed`, only sent on its woken-waiter path). Normalized to
       *  false when absent. */
      configChanged: boolean
    }
  | { ok: false; msgKey: string; detail: string }

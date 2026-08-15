<!--
  Task 20 (2026-08-13 mcp-progressive-disclosure plan) -- per-server MCP tool
  list with per-tool and server-level ("approve this whole server, including
  tools it adds later") approval toggles.

  This is the screen where a user sees what an MCP server can actually do
  and decides what it may do without asking. The backend endpoint behind it
  (`GET /v1/ai/mcp/servers/:id/tools`, wired to `serverId`/`tools` by the
  caller) is zero-network on the server side -- it reads the persisted tool
  list rather than re-dialing the MCP server, which is why this page opens
  instantly even when the server is down.

  Both the per-tool switch and the server-level switch call
  `service.ai.setMCPApproval` directly from this component -- no `approve`
  event is bubbled to a parent. This mirrors the self-contained pattern
  already used one file over: `McpServerDetail.vue`'s "test connection"
  button owns its own `service.ai.testMCPServer` call rather than asking
  `McpSection.vue` to make it on its behalf.

  Staleness threshold (`is-missing` grey-out): a tool not reported by the
  server's own handshake in more than 30 days. This is deliberately looser
  than the backend's own 7-day APPROVAL-voiding window
  (`NimoOS-AI/service/mcp_approvals.go`'s `staleWindowSec`, which drives
  `stale_reason`'s "stale: tool not seen in the last 7 days" case) -- that
  gate answers "is this approval still safe to trust?", a security question
  the backend already enforces server-side regardless of what this component
  renders. This component's `is-missing` class answers a softer, purely
  informational question -- "has this tool plausibly stopped existing?" -- and
  a multi-week gap is a better signal for that than a one-week one; a brief
  network hiccup during a single handshake shouldn't greyest-out a tool the
  user approved yesterday. The brief's own fixture data only pins a boundary
  somewhere between "just now" and 40 days; 30 days is a human-legible
  "about a month" cutoff inside that range.

  `stale_reason` (non-empty only for an approval that is currently void --
  e.g. every approval for a server goes void after its URL is edited, so the
  identity fingerprint the approval was granted for no longer matches) is
  rendered verbatim. This differs from `McpServerDetail.vue`'s test-connection
  error panel (its "D8" deviation), which maps backend errors through an
  `error_key` before ever showing English on screen -- but there is no such
  key here to map through: grepping `NimoOS-AI/service/mcp_approvals.go`
  shows the backend only ever sends the English sentence itself ("config
  changed: ...", "tool no longer offered by the server", "interface changed:
  ...", "stale: tool not seen in the last 7 days"). Showing it as-is is the
  intended shape for this diagnostic annotation, not a lapse of the
  never-echo-backend-English convention (which applies specifically where a
  localized alternative was actually built).

  Kept visually and structurally distinct from the `desc_changed` badge
  (`.mcp-tool-badge-desc-changed`, a small pill next to the tool name): the
  stale-reason explanation (`.mcp-tool-row-hint-stale`) is a full-width line
  below the name, using `data-test="stale-reason"` rather than
  `data-test="desc-changed-badge"`, and the two can appear independently of
  each other on the same row -- a tool can have a changed description while
  its approval is still in force, or a void approval on a tool whose
  description never changed.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { McpToolRow } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'

const props = withDefaults(defineProps<{
  serverId: number | string
  tools: McpToolRow[]
  showServerLevel?: boolean
}>(), {
  showServerLevel: false,
})

const { t } = useI18n()
const toast = useToast()

// See file header comment for the rationale behind this specific cutoff.
const STALE_SEEN_SECONDS = 30 * 86400

// Local mutable copies so a toggle click can update the switch optimistically
// and revert it if the request is rejected, without mutating the caller's
// prop array/objects (they may be shared with other reads of the same data).
const rows = ref<McpToolRow[]>(props.tools.map((tool) => ({ ...tool })))
watch(() => props.tools, (next) => {
  rows.value = next.map((tool) => ({ ...tool }))
})

// Tool names currently awaiting their setMCPApproval response, so a second
// click mid-flight doesn't fire a second request.
const pending = ref<Record<string, boolean>>({})

function isMissing(tool: McpToolRow): boolean {
  return Date.now() / 1000 - tool.last_seen_at > STALE_SEEN_SECONDS
}

async function toggleTool(tool: McpToolRow) {
  if (pending.value[tool.name]) return
  const next = !tool.approved
  const prev = tool.approved
  tool.approved = next
  pending.value[tool.name] = true
  try {
    await service.ai.setMCPApproval(props.serverId, tool.name, next)
  } catch {
    // Revert on rejection (e.g. a 403 for a server the caller does not own)
    // and tell the user -- otherwise the switch would silently lie about
    // what was actually granted.
    tool.approved = prev
    toast.show(t('aiMcpToolApprovalFailed'), 3000, 'danger')
  } finally {
    pending.value[tool.name] = false
  }
}

// Server-level state is a plain local toggle, not derived from `tools`:
// `listMCPTools` has no field reporting whether a wildcard ("*") approval is
// currently in force, only the named-tool rows. Turning this on always
// issues the grant; there is no persisted "currently on" signal available
// to this component to pre-check it from.
const serverLevelOn = ref(false)
const serverLevelPending = ref(false)

async function toggleServerLevel() {
  if (serverLevelPending.value) return
  const next = !serverLevelOn.value
  serverLevelOn.value = next
  serverLevelPending.value = true
  try {
    await service.ai.setMCPApproval(props.serverId, '*', next)
  } catch {
    serverLevelOn.value = !next
    toast.show(t('aiMcpToolApprovalFailed'), 3000, 'danger')
  } finally {
    serverLevelPending.value = false
  }
}
</script>

<template>
  <div class="mcp-tool-list">
    <div v-if="showServerLevel" class="mcp-tool-list-server-level">
      <div class="mcp-tool-list-server-level-main">
        <div class="lbl">{{ t('aiMcpToolServerLevelLabel') }}</div>
        <div data-test="server-level-hint" class="mcp-tool-list-server-level-hint">
          {{ t('aiMcpToolServerLevelHint') }}
        </div>
      </div>
      <div
        data-test="server-level-toggle"
        class="sw"
        role="switch"
        :data-on="serverLevelOn ? 'true' : 'false'"
        :aria-checked="serverLevelOn ? 'true' : 'false'"
        :aria-disabled="serverLevelPending ? 'true' : 'false'"
        @click="toggleServerLevel"
      />
    </div>

    <div
      v-for="tool in rows"
      :key="tool.name"
      :data-test="`tool-row-${tool.name}`"
      class="mcp-tool-row"
      :class="{ 'is-missing': isMissing(tool) }"
    >
      <div class="mcp-tool-row-main">
        <div class="mcp-tool-row-name">{{ tool.name }}</div>
        <span
          v-if="tool.desc_changed"
          data-test="desc-changed-badge"
          class="mcp-tool-badge-desc-changed"
        >{{ t('aiMcpToolDescChanged') }}</span>
      </div>
      <div v-if="isMissing(tool)" class="mcp-tool-row-hint mcp-tool-row-hint-missing">
        {{ t('aiMcpToolMissingHint') }}
      </div>
      <div v-if="tool.stale_reason" data-test="stale-reason" class="mcp-tool-row-hint mcp-tool-row-hint-stale">
        {{ tool.stale_reason }}
      </div>
      <div
        data-test="approval-toggle"
        class="sw"
        role="switch"
        :data-on="tool.approved ? 'true' : 'false'"
        :aria-checked="tool.approved ? 'true' : 'false'"
        :aria-disabled="pending[tool.name] ? 'true' : 'false'"
        @click="toggleTool(tool)"
      />
    </div>
  </div>
</template>

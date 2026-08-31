<!--
  Task 21 (2026-08-13 mcp-progressive-disclosure plan) -- cross-server
  approvals overview. Consent a user granted months ago inside one MCP
  server's tool list (a per-tool "don't ask again", or a whole-server
  wildcard grant) is otherwise invisible outside that server's own detail
  panel -- this page is the one place it is summarized across every server
  and can be revoked without hunting down which server it was.

  Backed by `service.ai.listMCPApprovals()` (`GET /v1/ai/mcp/approvals`),
  which returns the GATED set -- rows that currently pass every invalidation
  gate (McpApprovalRow, packages/service/src/ai.ts). That is the right source
  *here*: this page's job is "what is Nimo allowed to do without asking right
  now", and a stored-but-void approval (e.g. every approval for a server goes
  void after its URL is edited) is not currently granting anything, so it
  correctly does not appear. This is a different question from "what will
  CASCADE delete if I delete this server" -- that honest count needs the
  stored (ungated) set instead, and lives in `McpServerDetail.vue`'s delete
  confirmation, not here. Do not reuse this page's data source for that.

  Grouping is by `server_id` (one group per distinct server, labelled with
  `server_handle`); a server-level ('*') grant renders as
  `aiMcpApprovalsAllTools` ("all tools on this server"), never the bare
  asterisk -- a user should never have to know the backend's wildcard
  convention to understand their own grant.

  `revokeServer` calls `clearMCPApprovals(serverId)`, which revokes every
  approval for that server (not just one row) -- mirrors the single button
  the brief's test clicks (`revoke-server-<id>`), there is no per-tool revoke
  here (that already exists in `McpToolList.vue`'s per-tool switches). A
  rejection (e.g. a 403 for a server the caller no longer owns) leaves the
  group exactly where it was and surfaces a danger toast -- silently removing
  it on a failed request would make the user believe a revoke worked when it
  didn't, exactly the kind of misleading state the whole feature exists to
  prevent.
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { McpApprovalRow } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'

interface ApprovalGroup {
  serverId: number
  serverHandle: string
  toolNames: string[]
}

const { t } = useI18n()
const toast = useToast()

const items = ref<McpApprovalRow[]>([])
const loading = ref(true)
const error = ref(false)
const revoking = ref<Record<number, boolean>>({})

const groups = computed<ApprovalGroup[]>(() => {
  const byId = new Map<number, ApprovalGroup>()
  for (const row of items.value) {
    let g = byId.get(row.server_id)
    if (!g) {
      g = { serverId: row.server_id, serverHandle: row.server_handle, toolNames: [] }
      byId.set(row.server_id, g)
    }
    g.toolNames.push(row.tool_name)
  }
  return Array.from(byId.values())
})

onMounted(() => { void load() })

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = await service.ai.listMCPApprovals()
    items.value = Array.isArray(res?.items) ? res.items : []
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

/** Renders the server-level wildcard as a sentence a user understands
 *  instead of the backend's bare `"*"` convention (a deliberate design decision). */
function toolLabel(name: string): string {
  return name === '*' ? t('aiMcpApprovalsAllTools') : name
}

async function revokeServer(serverId: number) {
  if (revoking.value[serverId]) return
  revoking.value[serverId] = true
  try {
    await service.ai.clearMCPApprovals(serverId)
    items.value = items.value.filter((row) => row.server_id !== serverId)
    toast.show(t('aiMcpApprovalsRevoked', { handle: groups.value.find((g) => g.serverId === serverId)?.serverHandle ?? '' }))
  } catch {
    // Leave the group in place -- see file header comment on why a failed
    // revoke must never look like a successful one.
    toast.show(t('aiMcpApprovalsRevokeFailed'), 3000, 'danger')
  } finally {
    revoking.value[serverId] = false
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgMcpApprovals') }}</h1>
      <p class="set-desc">{{ t('aiMcpApprovalsDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="error" class="set-note">{{ t('aiCfgLoadFailed') }}</div>
        <div v-else-if="!groups.length" class="set-note">{{ t('aiMcpApprovalsEmpty') }}</div>
        <template v-else>
          <div
            v-for="g in groups"
            :key="g.serverId"
            data-test="approval-group"
            class="mcp-approvals-group"
          >
            <div class="mcp-approvals-group-head">
              <div class="mcp-approvals-group-name">{{ g.serverHandle }}</div>
              <button
                class="sk-btn ghost"
                :data-test="`revoke-server-${g.serverId}`"
                :disabled="revoking[g.serverId]"
                @click="revokeServer(g.serverId)"
              >
                {{ t('aiMcpApprovalsRevoke') }}
              </button>
            </div>
            <ul class="mcp-approvals-list">
              <li v-for="name in g.toolNames" :key="name">{{ toolLabel(name) }}</li>
            </ul>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

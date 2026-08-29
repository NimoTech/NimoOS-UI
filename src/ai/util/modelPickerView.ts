// 1:1 character-for-character port of Vue2 src/views/AI/Agent/shell/ModelPicker.vue's pure computation logic
// (computed: localModels/cloudModels/cloudGroups and methods.formatSize),
// split into standalone pure functions for ModelPicker.vue and unit tests to call directly.
import type { AgentModel } from '../stores/agentStore'

/** Vue2 ModelPicker.vue:82-83 —— split into two groups by source, preserving original order. */
export function splitModels(list: AgentModel[]): { local: AgentModel[]; cloud: AgentModel[] } {
  return {
    local: list.filter((m) => m.source === 'local'),
    cloud: list.filter((m) => m.source === 'cloud'),
  }
}

export interface CloudGroup {
  // F6 fix (review) —— original declaration was non-optional `string | number`, but actual value comes from
  // `AgentModel.providerId?: string | number | undefined`, previously hidden this fact via `as string
  // | number` assertion. Vue2 ModelPicker.vue:92-97 does **not skip** models lacking providerId ——
  // `pid = m.providerId`(undefined) when used as object key is implicitly converted to string `"undefined"`,
  // models with missing providerId still get grouped into the (same) group, just the group name is
  // undefined. Skipping such models would change Vue2's grouping behavior, so here chose to truthfully
  // loosen the declared type to match runtime, rather than filter/replace at the boundary.
  providerId: string | number | undefined
  providerName?: string
  models: AgentModel[]
}

/**
 * Vue2 ModelPicker.vue:84-100 —— when query is non-empty, **filter by displayName only** (do not search
 * providerName), then group by the order of first provider appearance (index table records the group
 * index assigned when each providerId first appears).
 */
export function cloudGroups(cloud: AgentModel[], query: string): CloudGroup[] {
  const q = query.trim().toLowerCase()
  const filtered = q ? cloud.filter((m) => m.displayName.toLowerCase().includes(q)) : cloud

  const byProvider: CloudGroup[] = []
  const index: Record<string, number> = {}
  for (const m of filtered) {
    const pid = String(m.providerId)
    if (index[pid] === undefined) {
      index[pid] = byProvider.length
      byProvider.push({ providerId: m.providerId, providerName: m.providerName, models: [] })
    }
    byProvider[index[pid]].models.push(m)
  }
  return byProvider
}

/** Vue2 ModelPicker.vue:113-118 —— show one decimal place GB if >=1GB, otherwise round MB, 0/undefined returns empty string. */
export function formatModelSize(bytes?: number): string {
  if (!bytes) return ''
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return gb.toFixed(1) + ' GB'
  return (bytes / 1024 / 1024).toFixed(0) + ' MB'
}

// Settings / System status -- grouping derivation for GET /v1/gateway/components.
// Vue2 counterpart: grouped (:46) and statusHint (:69) in components/settings/SystemStatus.vue.
// ⚠️ This endpoint returns **bare JSON with no envelope** (P1 field-verified correction 1);
// the shared package's sys.getGatewayComponents already strips .components.
import type { GatewayComponent } from '@nimotech/nimoos-service'

const GROUPS = [
  { key: 'service', labelKey: 'settingsStatusGroupService' },
  { key: 'ui', labelKey: 'settingsStatusGroupUi' },
  { key: 'external', labelKey: 'settingsStatusGroupExternal' },
] as const

export type ComponentGroupKey = (typeof GROUPS)[number]['key']

export function groupComponents(
  list: GatewayComponent[],
): Array<{ key: ComponentGroupKey; labelKey: string; items: GatewayComponent[] }> {
  return GROUPS.map((g) => ({
    key: g.key, labelKey: g.labelKey,
    items: list.filter((c) => c.category === g.key),
  })).filter((g) => g.items.length > 0)
}

/** Hover hint for offline items: raw backend error text + probe timestamp. */
export function statusHint(c: GatewayComponent): string {
  const at = c.probed_at ? `(${c.probed_at})` : ''
  return [c.error, at].filter(Boolean).join(' ')
}

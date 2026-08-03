// 设置 · 系统状态 —— GET /v1/gateway/components 的分组派生。
// Vue2 对位:components/settings/SystemStatus.vue 的 grouped(:46)与 statusHint(:69)。
// ⚠️ 该端点是**裸 JSON 无信封**(P1 实测校正①),共享包 sys.getGatewayComponents 已剥 .components。
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

/** 离线项的悬浮说明:后端错误原文 + 探测时刻。 */
export function statusHint(c: GatewayComponent): string {
  const at = c.probed_at ? `(${c.probed_at})` : ''
  return [c.error, at].filter(Boolean).join(' ')
}

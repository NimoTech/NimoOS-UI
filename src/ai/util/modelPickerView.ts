// 1:1 逐字港 Vue2 src/views/AI/Agent/shell/ModelPicker.vue 的纯计算逻辑
// (computed: localModels/cloudModels/cloudGroups 与 methods.formatSize),
// 拆成独立纯函数供 ModelPicker.vue 和单测直接调用。
import type { AgentModel } from '../stores/agentStore'

/** Vue2 ModelPicker.vue:82-83 —— 按 source 拆成两组,保持原顺序。 */
export function splitModels(list: AgentModel[]): { local: AgentModel[]; cloud: AgentModel[] } {
  return {
    local: list.filter((m) => m.source === 'local'),
    cloud: list.filter((m) => m.source === 'cloud'),
  }
}

export interface CloudGroup {
  // F6 修复(review)—— 原声明为非 optional `string | number`,但实际值来自
  // `AgentModel.providerId?: string | number | undefined`,此前靠 `as string
  // | number` 断言掩盖了这个事实。Vue2 ModelPicker.vue:92-97 对缺 providerId 的
  // 模型**不跳过**——`pid = m.providerId`(undefined)当对象 key 用时被隐式转成
  // 字符串 `"undefined"`,同 providerId 缺失的模型仍会被分进（同一个）组,只是
  // 组名是 undefined。跳过这类模型会改变 Vue2 的分组行为,所以这里选择如实放宽
  // 声明类型以匹配运行时,而不是在边界处过滤/替换。
  providerId: string | number | undefined
  providerName?: string
  models: AgentModel[]
}

/**
 * Vue2 ModelPicker.vue:84-100 —— query 非空时**只按 displayName** 过滤(不搜索
 * providerName),然后按 provider 首次出现的顺序分组(index 表记录每个
 * providerId 第一次出现时分配到的组下标)。
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

/** Vue2 ModelPicker.vue:113-118 —— >=1GB 显示一位小数的 GB,否则取整 MB,0/undefined 返回空串。 */
export function formatModelSize(bytes?: number): string {
  if (!bytes) return ''
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return gb.toFixed(1) + ' GB'
  return (bytes / 1024 / 1024).toFixed(0) + ' MB'
}

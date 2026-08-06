// SP8-P2b Task 6 —— 抽自 Vue2 src/views/AI/Settings/sections/MemorySection.vue:78-79/98-99
// 的 KIND_LABELS / SOURCE_LABELS 映射 + kindLabel/sourceLabel 两个方法。抽成纯函数是
// 为了能单独测「未知取值原样返回」这条兜底(brief Step 2 #14),<script setup> 没有
// methods 对象可借,单测只能靠导出纯函数直调。做法与 Task 9 formatModelSize.ts 同款。
//
// 值从 Vue2 的字面英文串(如 'Preference')换成了 i18n 键名(如 'aiCfgMemKindPreference')
// ——组件里再过一次 t()。未知取值仍然原样返回,不查 i18n:vue-i18n 9 对不存在的键
// t(key) 会原样渲染 key 本身(控制台有 missing key 告警),视觉结果与 Vue2
// `$t('weird')` → 'weird' 一致。

/** 对齐 Vue2 MemorySection.vue:78 KIND_LABELS。 */
export const KIND_LABEL_KEYS: Record<string, string> = {
  preference: 'aiCfgMemKindPreference',
  fact: 'aiCfgMemKindFact',
  goal: 'aiCfgMemKindGoal',
}

/** 对齐 Vue2 MemorySection.vue:79 SOURCE_LABELS。 */
export const SOURCE_LABEL_KEYS: Record<string, string> = {
  auto: 'aiCfgMemSourceAuto',
  tool: 'aiCfgMemSourceTool',
  user: 'aiCfgMemSourceUser',
}

/** 对齐 Vue2 MemorySection.vue:98(`kindLabel`)。 */
export function kindLabel(k: string): string {
  return KIND_LABEL_KEYS[k] || k
}

/** 对齐 Vue2 MemorySection.vue:99(`sourceLabel`)。 */
export function sourceLabel(s: string): string {
  return SOURCE_LABEL_KEYS[s] || s
}

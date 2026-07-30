// SP8-P2a Task 3 —— 1:1 移植自 Vue2 `src/views/AI/Settings/sections.js`(64 行)。
//
// 左侧导航把分区归进可折叠的四个大类;右侧内容区一次渲染一个大类。
// `stack: true` 的组把组内所有分区竖排在同一个滚动页里(点导航 → 滚过去;
// 滚动 → 反过来更新高亮 = scroll-spy)。`stack: false` 的组一次只换一个分区,
// 这是双栏满高布局(Skills / MCP 的列表+详情)必须的,竖排装不下。
//
// section id 必须与 SettingsPage.vue 的组件映射表、以及 `?section=` 深链契约
// 三方同步。
//
// 与 Vue2 的两处差异(均为位置/类型,无行为改动):
//  1. `SPLIT_SECTIONS` 在 Vue2 里定义在 `Settings.vue:92`,这里挪到本档与其它
//     导航常量同处 —— 它描述的是导航配置的性质,理应和 GROUPS 住一起。
//  2. `labelKey` 全部换成本仓 `aiCfg` 前缀的新键(Vue2 混用了 i18n 键与英文
//     字面量作 key,例如 `'Local models'`;本仓统一 i18n 化,见 P1a 之后的既定政策)。

export type SectionId =
  | 'models' | 'providers' | 'privacy' | 'thinking'
  | 'blacklist' | 'execution' | 'search' | 'memory' | 'observability'
  | 'skills' | 'mcp' | 'mcptokens' | 'channels'

export interface SectionItem {
  id: SectionId
  icon: string
  labelKey: string
}

export interface SectionGroup {
  id: string
  labelKey: string
  stack: boolean
  items: SectionItem[]
}

export const GROUPS: SectionGroup[] = [
  {
    id: 'model',
    labelKey: 'aiCfgGroupModel',
    stack: true,
    items: [
      { id: 'models', icon: 'cpu', labelKey: 'aiCfgLocalModels' },
      { id: 'providers', icon: 'cloud', labelKey: 'aiCfgCloudProviders' },
      { id: 'privacy', icon: 'lock', labelKey: 'aiCfgPrivacyCloud' },
      { id: 'thinking', icon: 'gauge', labelKey: 'aiCfgThinkingIntensity' },
    ],
  },
  {
    id: 'agent',
    labelKey: 'aiCfgGroupAgent',
    stack: true,
    items: [
      { id: 'blacklist', icon: 'folder', labelKey: 'aiCfgFilesystem' },
      { id: 'execution', icon: 'steps', labelKey: 'aiCfgExecutionSteps' },
      { id: 'search', icon: 'search', labelKey: 'aiCfgSearch' },
      { id: 'memory', icon: 'book', labelKey: 'aiCfgMemory' },
      { id: 'observability', icon: 'waves', labelKey: 'aiCfgObservability' },
    ],
  },
  {
    id: 'plugin',
    labelKey: 'aiCfgGroupPlugin',
    stack: false,
    items: [
      { id: 'skills', icon: 'layers', labelKey: 'aiCfgSkills' },
      { id: 'mcp', icon: 'grid', labelKey: 'aiCfgMcpConnections' },
      { id: 'mcptokens', icon: 'key', labelKey: 'aiCfgMcpTokens' },
    ],
  },
  {
    id: 'channel',
    labelKey: 'aiCfgGroupChannel',
    stack: false,
    items: [
      { id: 'channels', icon: 'grid', labelKey: 'aiCfgChannels' },
    ],
  },
]

export const ALL_ITEMS: SectionItem[] = GROUPS.reduce<SectionItem[]>(
  (acc, g) => acc.concat(g.items),
  [],
)

export const VALID_SECTIONS: SectionId[] = ALL_ITEMS.map((i) => i.id)

/** 双栏满高布局(左列表 + 右详情),不能竖排。Vue2 `Settings.vue:92`。 */
export const SPLIT_SECTIONS: SectionId[] = ['skills', 'mcp']

/**
 * 留给后续阶段、内容区仍渲染 `SectionPlaceholder` 并弹一条 info toast 的分区。
 * `skills` 已于 SP8-P3a 接入真组件（`SkillsSection`），从本列表移出；
 * `mcp` 仍待 P4。导航里照 Vue2 1:1 显示（用户 2026-07-28 决定）。
 */
export const DEFERRED_SECTIONS: SectionId[] = ['mcp']

/** 某个分区所属的组;未知 id 回落到第一个组(Vue2 `sections.js:62-64` 同款兜底)。 */
export function groupOf(sectionId: string): SectionGroup {
  return GROUPS.find((g) => g.items.some((i) => i.id === sectionId)) || GROUPS[0]
}

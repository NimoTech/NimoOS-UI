// SP8-P2a Task 3 — 1:1 ported from Vue2 `src/views/AI/Settings/sections.js` (64 lines).
//
// Left navigation groups sections into four collapsible categories; right content area renders one category at a time.
// `stack: true` groups stack all sections within them vertically on one scrolling page (click nav → scroll;
// scroll → update highlight in reverse = scroll-spy). `stack: false` groups switch one section at a time,
// required for two-column full-height layout (Skills / MCP list+details), can't fit vertically.
//
// section id must stay in sync across three places: SettingsPage.vue component map, and `?section=` deep link contract.
//
// Two differences from Vue2 (both location/type only, no behavior change):
//  1. `SPLIT_SECTIONS` is defined in `Settings.vue:92` in Vue2, moved here to live with other
//     navigation constants — describes the nature of navigation config, should live with GROUPS.
//  2. All `labelKey` values changed to new keys with `aiCfg` prefix in this repo (Vue2 mixed i18n keys with English
//     literals as key, e.g. `'Local models'`; this repo unified to i18n, see established policy after P1a).

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

/** Two-column full-height layout (left list + right details), can't stack vertically. Vue2 `Settings.vue:92`. */
export const SPLIT_SECTIONS: SectionId[] = ['skills', 'mcp']

/**
 * Deferred for future phases, content area still renders `SectionPlaceholder` and pops info toast.
 * Empty from SP8-P4 onward — all 13 sections connected to real components (mcp is last, P4 closure).
 * Mechanism itself retained (user explicit 2026-07-31 "reverse not delete"): when adding incomplete sections later,
 * add id back to this array to restore placeholder behavior, branches in `SettingsPage.vue` and
 * `SectionPlaceholder.vue` kept as-is.
 */
export const DEFERRED_SECTIONS: SectionId[] = []

/** The group a section belongs to; unknown id falls back to first group (Vue2 `sections.js:62-64` same fallback). */
export function groupOf(sectionId: string): SectionGroup {
  return GROUPS.find((g) => g.items.some((i) => i.id === sectionId)) || GROUPS[0]
}

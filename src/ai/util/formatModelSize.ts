// SP8-P2a Task 9 —— 抽自 Vue2 src/views/AI/Settings/sections/ModelsSection.vue
// 的两个组件 methods(结构调整,非行为改动 —— 抽出是为了能精确测边界,组件里
// 原本混在 `methods` 对象上,单测不到)。

/**
 * 逐字对齐 Vue2 ModelsSection.vue:170-175(`formatSize`)。
 * 注意:`!bytes` 是真值判断,`0` 也落这条分支返回破折号——Vue2 如此,照搬,
 * 不"改好"(brief 明确点名)。
 */
export function formatModelSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return gb.toFixed(1) + ' GB'
  return (bytes / 1024 / 1024).toFixed(0) + ' MB'
}

/**
 * 逐字对齐 Vue2 ModelsSection.vue:176-180(`etaLabel`)的分支/取整逻辑,但返回
 * 结构体而非已格式化的字符串——单位文案要在组件里过 `$t`(单位是 sec/min/hr
 * 三选一,复数形式因 locale 而异),纯函数不持本地化文本。与 P1c2 Task 10
 * `formatDuration` 的处理同款(见该文件头注释)。
 */
export function formatEtaSeconds(secs: number): { unit: 'sec' | 'min' | 'hr'; n: number } {
  if (secs < 60) return { unit: 'sec', n: Math.round(secs) }
  if (secs < 3600) return { unit: 'min', n: Math.round(secs / 60) }
  return { unit: 'hr', n: Number((secs / 3600).toFixed(1)) }
}

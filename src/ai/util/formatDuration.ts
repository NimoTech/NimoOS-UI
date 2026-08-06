// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/ActivityTab.vue:47-52(formatDuration
// 方法),抽成纯函数供 ActivityTab.vue 消费 + 独立单测。
//
// Vue2 原文 falsy 分支直接 `return 'Done'`(未 i18n 的英文字面量)。本期政策
// (2026-07-27 拍板)是给这类字面量补中文键——但翻译属于渲染层职责,不属于这个
// 纯函数。所以这里改用 `null` 作为"完成"状态的哨兵值,由调用方
// (ActivityTab.vue)在渲染时把 `null` 映射成 `t('aiActivityDone')`;毫秒/秒的
// 数字格式化部分(ms/s 单位)不在本期 i18n 清单里,原样保留字面量后缀。
export function formatDuration(ms?: number | null): string | null {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`
  const s = ms / 1000
  return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`
}

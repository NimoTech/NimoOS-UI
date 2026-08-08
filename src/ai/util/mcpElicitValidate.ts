// SP14 T4 —— 前端唯一一条手写的 elicitation 校验规则。1:1 移植自 Vue2
// src/views/AI/Agent/blocks/mcpElicitValidate.js。
//
// 这里**故意**没有别的:其余全部约束由控件结构(select / checkbox 只产合法值)与
// 浏览器原生约束(required / minlength / maxlength / min / max / step / type=email
// / type=date / type=datetime-local)执行,权威规则只有后端
// agent/mcp_client/elicitation_schema.py::validate_content 那一份。
//
// 为什么不在这里把后端规则再写一遍:那就是两份实现,而 NimoOS-AI 与本仓是两个独立
// 发版的 git 仓库,靠人工同步必然漂移,而漂移的后果曾经是「用户填的答案被后端静默
// 丢弃、卡片已 resolve、没有回头路」。现在是:规则一份 + 浏览器执行 + 后端退回时
// 带原因重问(见 elicitation.py::MAX_ANSWER_ATTEMPTS)。
//
// 数组是唯一没有原生对应物的:checkbox 组没有有意义的 required,minItems/maxItems
// HTML 也表达不了。所以只有它落在这里。
import type { ElicitField } from '../types/mcpElicit'

type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * 全部数组字段合法时返回 null,否则返回一条已翻译的 "Title: reason"。
 *
 * `t` 由调用方传入(组件里就是 useI18n 的 t)。为什么要传而不是在这里写死英文:
 * 这条 reason 会直接显示成 submitError,而卡片里其余每一条文案都走了 i18n ——
 * 只有错误路径给中文用户看英文,恰好是最需要看懂的那一条。文案字面量留在 t('…')
 * 调用里,提取脚本照样扫得到。默认值 s => s 保持这个 helper 单独可测。
 */
export function validateArrayFields(
  fields: ElicitField[] | null | undefined,
  values: Record<string, unknown> | null | undefined,
  t: Translate = (s) => s,
): string | null {
  for (const f of fields || []) {
    if (f.type !== 'multi_enum') continue
    const raw = values ? values[f.key] : undefined
    const v = Array.isArray(raw) ? raw : []
    const label = f.title || f.key
    if (f.required && v.length === 0) return t('{label}: is required', { label })
    // 注意:这里**不**对空数组 continue —— min_items 独立于 required,
    // 一个 required:false 但 min_items:1 的字段选了 0 项时仍然违规。
    if (f.min_items !== null && f.min_items !== undefined && v.length < f.min_items)
      return t('{label}: pick at least {n}', { label, n: f.min_items })
    if (f.max_items !== null && f.max_items !== undefined && v.length > f.max_items)
      return t('{label}: pick at most {n}', { label, n: f.max_items })
  }
  return null
}

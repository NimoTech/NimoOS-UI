// SP14 T4 -- The one hand-written elicitation validation rule on the frontend. Ported
// 1:1 from Vue2's src/views/AI/Agent/blocks/mcpElicitValidate.js.
//
// There is deliberately nothing else here: every other constraint is enforced either
// by the control's own structure (a select / checkbox can only ever produce a valid
// value) or by native browser constraints (required / minlength / maxlength / min /
// max / step / type=email / type=date / type=datetime-local). The authoritative copy
// of the rules lives solely in the backend's
// agent/mcp_client/elicitation_schema.py::validate_content.
//
// Why not restate the backend rules here too: that would be a second implementation,
// and NimoOS-AI and this repo are two independently released git repos -- keeping them
// in sync by hand is bound to drift, and the last time they drifted the consequence
// was the user's answers being silently dropped by the backend after the card had
// already resolved, with no way back. The current setup is: one copy of the rules +
// browser enforcement + the backend re-asking with a reason when it rejects an answer
// (see elicitation.py::MAX_ANSWER_ATTEMPTS).
//
// Arrays are the one case with no native equivalent: a checkbox group has no
// meaningful `required`, and HTML has no way to express minItems/maxItems either. So
// that is the only rule that lives on this side.
import type { ElicitField } from '../types/mcpElicit'

type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * Returns null when every array field is valid, otherwise a translated
 * "Title: reason" string.
 *
 * `t` is passed in by the caller (in components, that is useI18n's `t`). Why pass it
 * in instead of hardcoding English here: this reason string is displayed directly as
 * submitError, and every other piece of copy on the card already goes through i18n --
 * only the error path would show a Chinese user English text, which is exactly the
 * one message they most need to understand. The copy literals stay inside the
 * `t('…')` calls, so the extraction script still picks them up. The default `s => s`
 * keeps this helper independently testable.
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
    if (f.required && v.length === 0) return t('aiMcpElicitErrRequired', { label })
    // Note: this deliberately does NOT continue on an empty array -- min_items is
    // independent of required, so a field with required: false but min_items: 1 still
    // violates the rule when 0 items are selected.
    if (f.min_items !== null && f.min_items !== undefined && v.length < f.min_items)
      return t('aiMcpElicitErrMinItems', { label, n: f.min_items })
    if (f.max_items !== null && f.max_items !== undefined && v.length > f.max_items)
      return t('aiMcpElicitErrMaxItems', { label, n: f.max_items })
  }
  return null
}

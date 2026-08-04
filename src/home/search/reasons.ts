import type { FileNameHit, SemanticHit } from '@nimotech/nimoos-service'
import type { Reason } from './types'

// spec §7.5 的派生规则表。**产 i18n key,不产文案**(见计划 Task 1 说明)。
// 与 demo 时代写死的标签(Exact filename match / Body match ×9 / …)最大的不同:
// 那些计数(×9 / ×3)后端根本不返回,是编的,所以标签里不再有数字。

/** kind 已知取值 → 标签。后端 kind 是开放字符串,认不出的一律落「语义相关」。 */
const KIND_REASON: Record<string, Reason> = {
  body: { key: 'searchReasonBody', kind: 'normal' },
  transcript: { key: 'searchReasonTranscript', kind: 'normal' },
  ocr: { key: 'searchReasonOcr', kind: 'normal' },
  caption: { key: 'searchReasonCaption', kind: 'semantic' },
}

const SEMANTIC_REASON: Reason = { key: 'searchReasonSemantic', kind: 'semantic' }

/** filenames 源。后端 match 是模糊相关度,所以「查询词是文件名子串」不一定成立
 *  (实测 query="how to cook" 会命中 cookies.py)→ 补充规则 A1:模糊命中给「文件名相关」。 */
export function filenameReason(hit: FileNameHit, query: string): Reason {
  const q = query.trim().toLowerCase()
  const name = hit.name.toLowerCase()
  if (q && name.includes(q)) return { key: 'searchReasonFilename', kind: 'primary' }
  return { key: 'searchReasonFilenameFuzzy', kind: 'semantic' }
}

/** semantic 源。已知 kind 里,只有 'normal' 档(body/transcript/ocr)承诺「摘要里能看到查询词」,
 *  所以只有这一档需要字面校验、查不到就降级成「语义相关」;'semantic' 档(caption)本来就不承诺字面
 *  对应(CLIP 图片语义匹配,摘要是图片描述而非查询词的同义转述),不需要也不应该做这个校验,否则
 *  会把「caption 命中」错误地抹平成通用「语义相关」,丢失更具体的标签。未知 kind 直接给通用标签。 */
export function semanticReason(hit: SemanticHit, query: string): Reason {
  const known = KIND_REASON[hit.kind]
  if (!known) return SEMANTIC_REASON
  if (known.kind === 'semantic') return known
  const q = query.trim().toLowerCase()
  const text = hit.preview.text.toLowerCase()
  if (!q || !text.includes(q)) return SEMANTIC_REASON
  return known
}

/** images 源 = Photos 的 CLIP 语义命中,与 caption 同一语义,复用同一标签。 */
export function imageReason(): Reason {
  return { key: 'searchReasonCaption', kind: 'semantic' }
}

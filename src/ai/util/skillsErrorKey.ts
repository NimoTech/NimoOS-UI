// SP8-P3b Task 2 —— 技能新建/更新的错误归一 + 前端预校验。
//
// createSkillErrorKey 的形状照 src/ai/util/channelsFormat.ts:65-76 (addBotErrorKey)：
// 取 e.response.data.message ?? .detail ?? data，String 化后 trim().toLowerCase()，
// 按包含匹配判定，认不出的一律落通用兜底键，后端原文永不回显
// （承 p3b-common-constraints.md §4 数据契约「HTTP 层失败不回显后端 body」）。
//
// 后端 NimoOS-AI/service/skills_store.go 的 validateSkillDescription 用
// `fmt.Errorf("%w: <reason>", ErrBadDescription)` 包装，所以串形如
// "invalid skill description: description required" —— 带前缀。匹配顺序：
// 先判更具体的 description 子类（"description required" / "longer than 256
// characters" / "must be a single line" / "'<' and '>' are not allowed" 里的
// "are not allowed" + 含 '<' / "control characters are not allowed"），
// 再判 "invalid skill description" 本身，最后落 aiSkErrCreateFailed 兜底。
//
// validateSkillForm 是【拍板偏离①，见 p3b-common-constraints.md §3.6】：Vue2
// AddSkillModal.vue:137-139 提交前只查了 name/description 非空，填完一整屏才被后端一句
// 英文顶回来。这里在前端做与后端同款的校验规则，规则逐条对
// NimoOS-AI/service/skills_store.go:37-59 的 validateSkillDescription 与
// skillIDRe（:86）——已回源核对，两处正则字面一致，见本任务报告。
//
// 【P3b 终审 C1 修复】"与后端同款"指的是校验对象要一致，不只是正则字面一致——后端
// skills_store.go:221 是 `id := slugify(r.Name)` **先转换、再拿转换结果去过
// skillIDRe**（skills_store.go:82-85 的注释明写这是故意的："allows digit-leading
// IDs so slugify of names like '123 skill' don't get rejected"）。本文件此前直接拿
// **原始 name** 去测 skillIDRe，比后端更严：像 "Invoice Tagger" / "invoice_tagger"
// 这类后端 slugify 后能建成功（Vue2 也能建，Vue2 只查非空）的名字，会被这里直接堵死、
// 请求都发不出去——这是可复现的功能回退，不是"同款校验"该有的行为。
// 修法：移植一份 `slugify`（逐行对齐 Go 版 skills_store.go:17-35），validateSkillForm
// 改成校验 `slugify(name)` 而非原始 name。

/** 对齐 channelsFormat.ts:66-70 的取错误串形状：response.data.message ?? .detail ?? data。 */
function extractErrorString(e: unknown): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  const raw =
    data && typeof data === 'object'
      ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
      : data
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/**
 * 后端错误 → i18n 键。对齐 p3b-task-2-brief.md §2.2 的表。
 * 已回源核对 NimoOS-AI/service/skills_store.go 的错误串字面量（见任务报告）。
 */
export function createSkillErrorKey(e: unknown): string {
  const s = extractErrorString(e)

  if (s.includes('skill already exists')) return 'aiSkErrDuplicate'
  if (s.includes('invalid skill id')) return 'aiSkErrBadId'
  if (s.includes('description required')) return 'aiSkErrDescRequired'
  if (s.includes('longer than 256 characters')) return 'aiSkErrDescTooLong'
  if (s.includes('must be a single line')) return 'aiSkErrDescSingleLine'
  if (s.includes('are not allowed') && s.includes('<')) return 'aiSkErrDescAngle'
  if (s.includes('control characters are not allowed')) return 'aiSkErrDescControl'
  if (s.includes('invalid file path in bundle')) return 'aiSkErrBadPath'
  if (s.includes('bundle exceeds size limits')) return 'aiSkErrBundleTooLarge'
  if (s.includes('skill.md exceeds')) return 'aiSkErrMdTooLarge'
  return 'aiSkErrCreateFailed'
}

// 回源核对结论（NimoOS-AI/service/skills_store.go:86 与 agent/main.py:2489）：两处正则
// 字面完全一致，均为 /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/ —— 首尾必须是小写字母或数字，
// 中间可含短横线，总长 1–64。brief 表里给的这条是对的，不存在需要以 Go 为准改写的分歧。
const SKILL_ID_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

/**
 * 逐行移植自 NimoOS-AI/service/skills_store.go:17-35（`slugify`）。后端在校验前先跑
 * 这一步（skills_store.go:221 `id := slugify(r.Name)`），再拿 slug 去过 skillIDRe——
 * 本函数必须做完全一样的事，否则前端校验的对象就和后端实际校验的对象不是同一个值
 * （P3b 终审 C1）。逐条对齐 Go 版逻辑：
 *   1. 转小写 + 去首尾空白（Go: `strings.ToLower(strings.TrimSpace(s))`）。
 *   2. 逐个 code point 扫描：`[a-z0-9]` 原样保留；其余字符折叠成**单个**'-'
 *      （`dash` 标志防止连续分隔符产生多个 '-'；`out.length > 0` 这个条件让前导分隔符
 *      不产生 '-' —— 对应 Go 版 `b.Len() > 0`）。
 *   3. 最后去掉首尾的 '-'（Go: `strings.Trim(b.String(), "-")`）。
 * `for...of` 按 Unicode code point 迭代，与 Go 的 `for _, r := range s`（按 rune 迭代）
 * 语义一致，故对中日文等多字节字符的处理与后端等价（均判定为非 [a-z0-9]，折叠成 '-'）。
 */
export function slugify(s: string): string {
  let out = ''
  let dash = false
  for (const ch of s.trim().toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch
      dash = false
    } else if (!dash && out.length > 0) {
      out += '-'
      dash = true
    }
  }
  return out.replace(/^-+/, '').replace(/-+$/, '')
}

/**
 * 前端预校验，规则逐条对齐 skills_store.go 的 ValidateSkillID + validateSkillDescription。
 * 全过返回 null；否则返回对应的 i18n 错误键。
 *
 * 【P3b 终审 C1】校验对象是 `slugify(name)`，不是原始 name——见上方 `slugify` 注释与
 * NimoOS-AI/service/skills_store.go:221（`id := slugify(r.Name)`）+ :91-96
 * （`ValidateSkillID` 拿 slug 后的 id 去过 `skillIDRe`）。名字全是非法字符时
 * slug 为空串，空串不满足 `skillIDRe`（至少需要 1 个 `[a-z0-9]` 字符），
 * 自然落回 'aiSkErrBadId'，与后端 `ValidateSkillID('')` 拒绝的结论一致。
 */
export function validateSkillForm(name: string, description: string): string | null {
  const id = slugify(name)
  if (!SKILL_ID_RE.test(id)) return 'aiSkErrBadId'

  const trimmedDescription = description.trim()
  if (trimmedDescription === '') return 'aiSkErrDescRequired'
  // Array.from(...).length counts Unicode code points, matching Go's
  // utf8.RuneCountInString(d) in skills_store.go:49 more closely than
  // JS's native .length (UTF-16 code units, which over-counts astral chars).
  if (Array.from(trimmedDescription).length > 256) return 'aiSkErrDescTooLong'
  if (/[\n\r]/.test(trimmedDescription)) return 'aiSkErrDescSingleLine'
  if (trimmedDescription.includes('<') || trimmedDescription.includes('>')) return 'aiSkErrDescAngle'
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(trimmedDescription)) return 'aiSkErrDescControl'

  return null
}

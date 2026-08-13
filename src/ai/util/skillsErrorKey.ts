// SP8-P3b Task 2 — Unify error keys for skill create/update + frontend pre-validation.
//
// createSkillErrorKey's shape follows src/ai/util/channelsFormat.ts:65-76 (addBotErrorKey):
// extract e.response.data.message ?? .detail ?? data, stringify then trim().toLowerCase(),
// match by containment, unrecognized ones all fall back to generic catchall key, backend
// original text never displayed (per p3b-common-constraints.md §4 data contract
// "HTTP layer failures do not echo backend body").
//
// Backend NimoOS-AI/service/skills_store.go's validateSkillDescription uses
// `fmt.Errorf("%w: <reason>", ErrBadDescription)` wrapping, so strings are like
// "invalid skill description: description required" — with prefix. Matching order:
// first check more specific description subtypes ("description required" / "longer than 256
// characters" / "must be a single line" / "'<' and '>' are not allowed" containing
// "are not allowed" + contains '<' / "control characters are not allowed"),
// then check "invalid skill description" itself, finally fall back to aiSkErrCreateFailed.
//
// validateSkillForm is design decision variant ① (see p3b-common-constraints.md §3.6):
// Vue2's AddSkillModal.vue:137-139 only checked name/description non-empty before submit,
// users got hit with one English line from the backend after filling a whole screen. Here
// we do the same validation rules as the backend on the frontend, matching rule-by-rule
// with NimoOS-AI/service/skills_store.go:37-59's validateSkillDescription and
// skillIDRe (:86) — already cross-referenced, both regex literals match, see task report.
//
// P3b final review C1 fix: "same as backend" means validation objects must be consistent,
// not just regex literal match — backend skills_store.go:221 is `id := slugify(r.Name)`
// **transform first, then take the result and test it against skillIDRe** (skills_store.go
// :82-85 comment explicitly says this is intentional: "allows digit-leading IDs so slugify
// of names like '123 skill' don't get rejected"). This file previously tested the **raw
// name** directly against skillIDRe, stricter than backend: names like "Invoice Tagger" /
// "invoice_tagger" that the backend's slugify can successfully build (Vue2 can also, Vue2
// only checks non-empty) would be blocked here, request wouldn't even send — reproducible
// functionality regression, not what "same validation" should be. Fix: port a copy of
// `slugify` (line-by-line matching Go version skills_store.go:17-35), change
// validateSkillForm to validate `slugify(name)` instead of raw name.

/** Align with channelsFormat.ts:66-70 error string extraction: response.data.message ?? .detail ?? data. */
function extractErrorString(e: unknown): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  const raw =
    data && typeof data === 'object'
      ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
      : data
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/**
 * Backend error → i18n key. Aligns with p3b-task-2-brief.md §2.2 table.
 * Already cross-referenced error string literals from NimoOS-AI/service/skills_store.go (see task report).
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

// Cross-reference conclusion (NimoOS-AI/service/skills_store.go:86 and agent/main.py:2489):
// regex literals are identical, both /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/ — first and last
// must be lowercase letter or digit, middle can contain hyphen, total length 1–64. The brief
// table is correct, no discrepancies requiring rewrite based on Go version.
const SKILL_ID_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

/**
 * Ported line-by-line from NimoOS-AI/service/skills_store.go:17-35 (`slugify`). Backend
 * runs this step before validation (skills_store.go:221 `id := slugify(r.Name)`), then tests
 * the slug against skillIDRe — this function must do exactly the same, otherwise what the
 * frontend validates and what the backend actually validates are different values
 * (P3b final review C1). Align with Go version logic step by step:
 *   1. Lowercase + trim leading/trailing whitespace (Go: `strings.ToLower(strings.TrimSpace(s))`).
 *   2. Scan each code point: keep `[a-z0-9]` as-is, collapse other chars into **single** '-'
 *      (`dash` flag prevents consecutive separators creating multiple '-'; `out.length > 0`
 *      condition prevents leading separators producing '-' — matches Go `b.Len() > 0`).
 *   3. Finally strip leading/trailing '-' (Go: `strings.Trim(b.String(), "-")`).
 * `for...of` iterates by Unicode code point, semantically identical to Go's `for _, r := range s`
 * (iterates by rune), so multi-byte character handling (Chinese, Japanese, etc.) matches
 * backend exactly (both classify as non-[a-z0-9] and collapse to '-').
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
 * Frontend pre-validation, rules align item-by-item with skills_store.go's ValidateSkillID
 * + validateSkillDescription. Return null if all pass; otherwise return the corresponding
 * i18n error key.
 *
 * P3b final review C1: validation object is `slugify(name)`, not raw name — see `slugify`
 * comment above and NimoOS-AI/service/skills_store.go:221 (`id := slugify(r.Name)`) + :91-96
 * (`ValidateSkillID` tests slug-transformed id against `skillIDRe`).
 *
 * P3b acceptance patch A1 (user reported 2026-07-31: long name shows "only lowercase
 * letters, digits, and hyphens", wrong answer): name failure reasons must be reported
 * separately. **After slugify, character set issues are structurally impossible** — slugify
 * guarantees output contains only `[a-z0-9-]`, no consecutive hyphens, no leading/trailing
 * hyphens, so its output can fail `SKILL_ID_RE` for only two reasons:
 *   ① Empty string (name has no `[a-z0-9]` at all, e.g. pure Chinese/pure symbols)
 *   ② Length > 64
 * In other words, the previous unified fallback 'aiSkErrBadId' (about character set) is
 * **never the real reason**. Here we dispatch dedicated keys for the two real reasons;
 * 'aiSkErrBadId' is reserved for `createSkillErrorKey` mapping the backend's `invalid skill id`
 * string (backend doesn't distinguish reasons, that string is mapped as-is).
 */
export function validateSkillForm(name: string, description: string): string | null {
  const id = slugify(name)
  if (id === '') return 'aiSkErrNameNoAlnum'
  if (id.length > 64) return 'aiSkErrNameTooLong'
  // Catchall: slugify output theoretically never reaches here (see comment above), kept
  // just in case slugify or backend regex changes in the future and the two no longer imply each other.
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

// "Nimo understood" structured token extraction — extract three categories of information from natural language
// search queries that can be mapped to real filter conditions (people / media type / time), to display chips in the
// search bar and apply them as filter conditions with one click.
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue:474-497
// (`understood` computed), but the criteria for name matching has been corrected; see hasWordBoundedMatch below.

import type { QuickKey } from './dateRange'
import { QUICK_LABEL_KEYS } from './dateRange'

// Person candidates passed in by the caller — only contains "named" real people (equivalent to Vue2's realPeopleList
// after filtering out unnamed), no named field because the caller has already done the filtering.
export interface PersonOption {
  id: string
  name: string
  count: number
  coverFaceId: string
}

export type UnderstoodKind = 'person' | 'type' | 'time'

export interface UnderstoodToken {
  k: UnderstoodKind
  v: string
  id?: string
  // Deviation registration (brief §7e-5 + structure spec condition 1): Vue2 uses the English string v to reverse-lookup
  // quickRange (e.g. case 'Today'); after i18n, v becomes an i18n key name / year string awaiting t(), and can no longer
  // be reverse-looked up. New-UI adds a quick field to carry the "machine-readable" information; QuickKey comes from
  // dateRange.ts (five shortcut key literals), year uses number. Callers branch on quick: if it's a QuickKey, call
  // quickRange(quick, now, t(v)); if it's a number, call yearRange(quick, v).
  //
  // fix round 1 · M5 (spillover impact of handoff to T16, notation only, no code changes): queryParts' keywords come
  // from understood(...).map(t => t.v.toLowerCase()) (brief structure spec condition 2). In Vue2, time token v is an
  // English label, and exactly three of them — 'Last year' / 'This year' / 'Today' — happen to match verbatim in the
  // original query text, so Vue2 highlights those terms in the search box. Here v is changed to i18n key names
  // (e.g. photosSearchLastYear); after toLowerCase() it becomes 'photossearchlastyear', which will never match 'last year'
  // in the original query text. Even if downstream passes t(v), "去年" under Chinese locale won't match the English query
  // term 'last year'. Highlighting of person / type / year tokens is unaffected (their v is the original query term or
  // year string itself) — only these three shortcut time tokens inevitably lose highlighting in New-UI, which is a necessary
  // side effect of deviation 2 (v changed to i18n key), not a bug for this task to fix (fixing it would require dual
  // Chinese-English lookup tables, which is out of scope).
  quick?: QuickKey | number
}

// \b only works at ASCII word-character / non-word-character boundaries; Chinese names usually have Chinese on both
// sides ⇒ Vue2 version never matches Chinese names (§7e-5). Changed to: find the substring position first, then check
// if the surrounding characters form "word continuation". Word character is defined as [A-Za-z0-9_] (same as \w); CJK
// is not a word character, so Chinese names have boundaries on both sides regardless of whether the surrounding text
// is Chinese or punctuation — semantically exactly what we want.
const WORDISH = /[A-Za-z0-9_]/

function hasWordBoundedMatch(haystack: string, needle: string): boolean {
  if (!needle) return false
  let from = 0
  for (;;) {
    const i = haystack.indexOf(needle, from)
    if (i < 0) return false
    const before = i > 0 ? haystack[i - 1] : ''
    const after = i + needle.length < haystack.length ? haystack[i + needle.length] : ''
    // The third condition in beforeOk/afterOk — when needle's first/last character is not a word character itself
    // (e.g. a Chinese name), the boundary is always valid — this is the key to the fix: Chinese names only need to
    // avoid "English/digit/underscore followed by English/digit/underscore", which is true word continuation;
    // otherwise they should count as a match.
    const beforeOk = !before || !WORDISH.test(before) || !WORDISH.test(needle[0])
    const afterOk = !after || !WORDISH.test(after) || !WORDISH.test(needle[needle.length - 1])
    if (beforeOk && afterOk) return true
    from = i + 1
  }
}

export function understood(query: string, people: PersonOption[]): UnderstoodToken[] {
  // fix round 1 · M4: Vue2 :475 is `(this.query || '').toLowerCase()` — queryParts/searchStateMatchesQuery in the same
  // batch both mirror this guard, which was omitted here before; adding it now (downstream's actual call point is likely
  // route.query.q, which can be undefined in type).
  const q = (query || '').toLowerCase()
  if (!q.trim()) return []
  const tokens: UnderstoodToken[] = []

  // person: match named people in the order provided by the caller.
  for (const p of people) {
    const name = p.name.toLowerCase()
    if (hasWordBoundedMatch(q, name)) {
      tokens.push({ k: 'person', v: p.name, id: p.id })
    }
  }

  // media type — v is an internal enum value (for comparison with filters.type), not display text;
  // consumers should call t() when displaying. These two regexes match English words, keeping \b is correct.
  // Chinese query "视频" won't match — this is existing Vue2 behavior, mirrored and registered as a known limitation
  // (fixing it would require dual Chinese-English lookup tables, out of scope for this task).
  if (/\bvideos?\b/.test(q)) tokens.push({ k: 'type', v: 'Videos' })
  else if (/\bphotos?\b/.test(q)) tokens.push({ k: 'type', v: 'Photos' })

  // time — criterion order mirrored (else-if chain, first match wins). v is for display: five shortcuts take the
  // corresponding i18n key name (consumers call t(v)), year's v is the year string itself.
  if (/last week/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.last7, quick: 'last7' })
  } else if (/last month/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.last30, quick: 'last30' })
  } else if (/last year/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.lastYear, quick: 'lastYear' })
  } else if (/this year/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.thisYear, quick: 'thisYear' })
  } else if (/\btoday\b/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.today, quick: 'today' })
  } else {
    const yr = q.match(/\b20[12][0-9]\b/)
    if (yr) tokens.push({ k: 'time', v: yr[0], quick: Number(yr[0]) })
  }

  return tokens
}

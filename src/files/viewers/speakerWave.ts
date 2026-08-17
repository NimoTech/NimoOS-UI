// Waveform × speakers: pure functions (bar assignment / color token mapping / filter predicate).
// Design: docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md §3/§4/§7
import { parseTimestamp } from './audioTranscripts'

/** Speaker index → color token (5-color cycle, token defined in theme.css, both themes have values). */
export function speakerToken(idx: number): string {
  return `var(--spk-${(idx % 5) + 1})`
}

/**
 * For each bar's time window [a,b), assign speaker with largest cumulative coverage duration;
 * on tie, assign to globally fewer-segment speaker (gives short interjections some presence).
 * No speakers in window → null.
 * Early version was "any appearance in window is candidate, fewest segments globally wins" — designed
 * for coarse merged segment data. After switching to fine-grained speaker-turn-split annotation,
 * each window has 3–5 speakers; fewest-first would fill progress bar with brief interjections,
 * while most-talking speaker gets no bars, so switched to cumulative coverage duration assignment.
 * duration<=0 (metadata not ready) → all null, caller reactively recalculates after loadedmetadata.
 */
export function barSpeakers(
  segments: { t: string; speaker?: string }[],
  duration: number,
  n: number,
): (string | null)[] {
  const out = new Array<string | null>(Math.max(0, n)).fill(null)
  if (!(duration > 0) || n <= 0) return out
  // Segment interval [start,end): end = next segment start, last segment to duration. Segments without speaker don't participate.
  const spans: { start: number; end: number; speaker: string }[] = []
  const freq = new Map<string, number>()
  for (let i = 0; i < segments.length; i++) {
    const speaker = segments[i].speaker
    const start = parseTimestamp(segments[i].t)
    const end = i + 1 < segments.length ? parseTimestamp(segments[i + 1].t) : duration
    if (!speaker) continue
    spans.push({ start, end, speaker })
    freq.set(speaker, (freq.get(speaker) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * duration
    const b = ((i + 1) / n) * duration
    const overlap = new Map<string, number>()
    for (const s of spans) {
      const o = Math.min(b, s.end) - Math.max(a, s.start)
      if (o > 0) overlap.set(s.speaker, (overlap.get(s.speaker) ?? 0) + o)
    }
    let best: string | null = null
    let bestO = 0
    for (const [sp, o] of overlap) {
      if (
        o > bestO ||
        (o === bestO && best !== null && (freq.get(sp) as number) < (freq.get(best) as number))
      ) {
        best = sp
        bestO = o
      }
    }
    out[i] = best
  }
  return out
}

/**
 * Single segment filter predicate: picked = currently selected speakers set (master-checkbox
 * semantics: all selected = show all, empty set = all unselected = hide all segments with speaker;
 * pass null means this audio has no speaker data, skip speaker filtering), ANDed with
 * highlightsOnly.
 * MediaViewer's transcript row filtering and waveform .dim logic share the same picked set
 * to ensure consistent logic in both places.
 */
export function segMatches(
  seg: { speaker?: string; highlight?: boolean },
  picked: ReadonlySet<string> | null,
  highlightsOnly: boolean,
): boolean {
  if (highlightsOnly && !seg.highlight) return false
  if (picked && (!seg.speaker || !picked.has(seg.speaker))) return false
  return true
}

/**
 * Each segment (by original index) → its chapter index. Segment start time in [chapter k.t, chapter k+1.t)
 * assigns to k; before first chapter → -1; chapters empty → all -1.
 * Both chapters/segments must be in chronological order (existing precondition).
 */
export function segChapterIndex(segments: { t: string }[], chapters: { t: string }[]): number[] {
  const starts = chapters.map((c) => parseTimestamp(c.t))
  return segments.map((s) => {
    const ts = parseTimestamp(s.t)
    let idx = -1
    for (let k = 0; k < starts.length; k++) {
      if (starts[k] <= ts) idx = k
      else break
    }
    return idx
  })
}

/**
 * Each bar (by midpoint time) → its chapter index; duration<=0 / chapters empty → all -1 (length max(0,n)).
 * Chapter intervals are much longer than bars (~25s/bar), midpoint sampling suffices,
 * no need for speaker's minority-first logic.
 */
export function barChapterIndex(chapters: { t: string }[], duration: number, n: number): number[] {
  const out = new Array<number>(Math.max(0, n)).fill(-1)
  if (!(duration > 0) || n <= 0 || !chapters.length) return out
  const starts = chapters.map((c) => parseTimestamp(c.t))
  for (let i = 0; i < n; i++) {
    const mid = ((i + 0.5) / n) * duration
    let idx = -1
    for (let k = 0; k < starts.length; k++) {
      if (starts[k] <= mid) idx = k
      else break
    }
    out[i] = idx
  }
  return out
}

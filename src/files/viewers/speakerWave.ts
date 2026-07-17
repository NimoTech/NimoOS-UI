// 音频波形 × 说话人:纯函数(竖条归属 / 颜色 token 映射 / 过滤谓词)。
// 设计:docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md §3/§4/§7
import { parseTimestamp } from './audioTranscripts'

/** 说话人序号 → 颜色 token(5 色循环,token 定义在 theme.css,两套主题都有值)。 */
export function speakerToken(idx: number): string {
  return `var(--spk-${(idx % 5) + 1})`
}

/**
 * 每根竖条的时间窗 [a,b) 内,取「累计覆盖时长最大」的说话人;时长打平时取全局分段数少的一方
 * (给短插话一点存在感)。窗口内无人 → null。
 * 早期版本是「窗口内出现即候选、全局段数最少者优先」——那是为大段合并的段落数据设计的;
 * 换成按说话轮次拆分的细粒度标注后,每个窗口内会出现三五个说话人,少数优先会让插话
 * 刷满整条进度条、话最多的人反而一根竖条都分不到,故改为按时长占比归属。
 * duration<=0(元数据未就绪)→ 全 null,调用方在 loadedmetadata 后靠响应式重算。
 */
export function barSpeakers(
  segments: { t: string; speaker?: string }[],
  duration: number,
  n: number,
): (string | null)[] {
  const out = new Array<string | null>(Math.max(0, n)).fill(null)
  if (!(duration > 0) || n <= 0) return out
  // 段区间 [start,end):end = 下一段起始,最后一段到 duration。无 speaker 的段不参与归属。
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
 * 单段过滤谓词:picked = 当前选中的说话人集合(master-checkbox 语义:全选=全显,
 * 空集=全不选=隐藏所有带说话人的段;传 null 表示本音频无说话人数据,不做说话人过滤),
 * 与 highlightsOnly AND 叠加。
 * MediaViewer 的转录行过滤与波形 .dim 判断共用同一 picked 集合,保证两处口径一致。
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
 * 每个段落(按原始索引) → 所属章节序号。段落起始时间落在 [章节k.t, 章节k+1.t) 即属 k;
 * 早于第一章 → -1;chapters 空 → 全 -1。chapters/segments 均要求按时间升序(既有前提)。
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
 * 每根竖条(按中点时间) → 所属章节序号;duration<=0 / chapters 空 → 全 -1(长度 max(0,n))。
 * 章节区间远长于竖条(~25s/根),中点采样即可,不需要说话人那套少数优先逻辑。
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

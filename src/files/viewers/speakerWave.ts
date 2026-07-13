// 音频波形 × 说话人:纯函数(竖条归属 / 颜色 token 映射 / 过滤谓词)。
// 设计:docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md §3/§4/§7
import { parseTimestamp } from './audioTranscripts'

/** 说话人序号 → 颜色 token(5 色循环,token 定义在 theme.css,两套主题都有值)。 */
export function speakerToken(idx: number): string {
  return `var(--spk-${(idx % 5) + 1})`
}

/**
 * 每根竖条的时间窗 [a,b) 内出现过的说话人里,取「全局分段数最少」的那位。
 * 理由:竖条约 25s 一根,学生几秒的插话按中点采样/时长占比都会被平均掉;
 * 少数说话人优先保证短插话在波形上留下有色竖条。窗口内无人 → null。
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
    let best: string | null = null
    for (const s of spans) {
      if (Math.min(b, s.end) - Math.max(a, s.start) > 0) {
        if (best === null || (freq.get(s.speaker) as number) < (freq.get(best) as number)) best = s.speaker
      }
    }
    out[i] = best
  }
  return out
}

/**
 * 单段过滤谓词:picked(说话人多选集,空=全部)与 highlightsOnly AND 叠加。
 * MediaViewer 的转录行过滤与波形 .dim 判断共用同一 picked 集合,保证两处口径一致。
 */
export function segMatches(
  seg: { speaker?: string; highlight?: boolean },
  picked: ReadonlySet<string>,
  highlightsOnly: boolean,
): boolean {
  if (highlightsOnly && !seg.highlight) return false
  if (picked.size > 0 && (!seg.speaker || !picked.has(seg.speaker))) return false
  return true
}

const H = 32

// engine.js 66-72:0–100 序列 → polyline 点串
export function sparklinePoints(points: number[]): string {
  if (!points || points.length < 2) return ''
  const n = points.length
  const stepX = 100 / (n - 1)
  return points
    .map((v, i) => (i * stepX).toFixed(2) + ',' + (H - Math.max(0, Math.min(100, v)) / 100 * (H - 2) - 1).toFixed(1))
    .join(' ')
}

// engine.js 87-88:速率序列按窗口峰值定标
export function netChartPoints(arr: number[], max: number): string {
  if (!arr || arr.length < 2) return ''
  const m = max < 1 ? 1 : max
  return arr
    .map((v, i) => (i * 100 / (arr.length - 1)).toFixed(2) + ',' + (H - Math.max(0, v) / m * (H - 2) - 1).toFixed(2))
    .join(' ')
}

// engine.js 79-85:两序列峰值(≥1)
export function netPeak(up: number[], down: number[]): number {
  let max = 1
  for (const v of up) if (v > max) max = v
  for (const v of down) if (v > max) max = v
  return max
}

export function chartYAxis(maxLabel: string, midLabel: string): { max: string; mid: string; zero: '0' } {
  return { max: maxLabel, mid: midLabel, zero: '0' }
}

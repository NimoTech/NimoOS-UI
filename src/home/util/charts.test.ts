import { describe, it, expect } from 'vitest'
import { sparklinePoints, netChartPoints, netPeak } from './charts'

describe('sparklinePoints', () => {
  it('returns empty for <2 points', () => { expect(sparklinePoints([5])).toBe('') })
  it('maps 0..100 to a 100x32 polyline (x step, y inverted)', () => {
    const s = sparklinePoints([0, 100])
    // 2 点:x=0 和 x=100;y(0%)=31, y(100%)=1
    expect(s).toBe('0.00,31.0 100.00,1.0')
  })
})
describe('netChartPoints + netPeak', () => {
  it('peak is max of both series, min 1', () => {
    expect(netPeak([10, 30], [5, 20])).toBe(30)
    expect(netPeak([], [])).toBe(1)
  })
  it('scales values by max', () => {
    const s = netChartPoints([0, 100], 100)
    expect(s).toBe('0.00,31.00 100.00,1.00')
  })
})

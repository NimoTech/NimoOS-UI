import { describe, it, expect } from 'vitest'
import { WAVE_N, synthWaveform, bucketPeaks, waveCacheKey, getCachedWave, setCachedWave } from './waveform'

describe('synthWaveform', () => {
  it('同 seed 输出稳定、长度 = n、值域 [0,1]', () => {
    const a = synthWaveform('demo.mp3', WAVE_N)
    const b = synthWaveform('demo.mp3', WAVE_N)
    expect(a).toEqual(b)
    expect(a).toHaveLength(WAVE_N)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('不同 seed 输出不同', () => {
    expect(synthWaveform('a.mp3', WAVE_N)).not.toEqual(synthWaveform('b.mp3', WAVE_N))
  })
})

describe('bucketPeaks', () => {
  it('输出长度 = n;峰桶归一化为 1、静音桶为 0、半峰桶为 0.5', () => {
    // 4 桶 × 每桶 100 样本:桶0 峰 0.4、桶1 全 0、桶2 峰 0.8(全局最大)、桶3 峰 -0.8(取绝对值)
    const s = new Float32Array(400)
    s[10] = 0.4
    s[250] = 0.8
    s[350] = -0.8
    const out = bucketPeaks(s, 4)
    expect(out).toHaveLength(4)
    expect(out[0]).toBeCloseTo(0.5)
    expect(out[1]).toBe(0)
    expect(out[2]).toBeCloseTo(1)
    expect(out[3]).toBeCloseTo(1)
  })
  it('全零输入 → 全零输出(不除以 0)', () => {
    expect(bucketPeaks(new Float32Array(100), 4)).toEqual([0, 0, 0, 0])
  })
  it('len < n 的边界不崩,输出仍是 n 条 [0,1]', () => {
    const out = bucketPeaks(new Float32Array([0.5, -1, 0.25]), 8)
    expect(out).toHaveLength(8)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...out)).toBe(1)
  })
  it('空输入 → 全零输出', () => {
    expect(bucketPeaks(new Float32Array(0), 4)).toEqual([0, 0, 0, 0])
  })
})

describe('wave cache', () => {
  it('waveCacheKey 用 path|size|date;size/date 缺失时该位留空', () => {
    expect(waveCacheKey({ path: '/DATA/a.mp3', size: 123, date: '2026-07-01' })).toBe('/DATA/a.mp3|123|2026-07-01')
    expect(waveCacheKey({ path: '/DATA/a.mp3' })).toBe('/DATA/a.mp3||')
  })
  it('set 后 get 命中;未 set 的键 → undefined', () => {
    expect(getCachedWave('nope')).toBeUndefined()
    setCachedWave('k1', [0, 0.5, 1])
    expect(getCachedWave('k1')).toEqual([0, 0.5, 1])
  })
})

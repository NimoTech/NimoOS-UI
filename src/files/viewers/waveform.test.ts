import { describe, it, expect } from 'vitest'
import { WAVE_N, synthWaveform, bucketPeaks, waveCacheKey, getCachedWave, setCachedWave } from './waveform'

describe('synthWaveform', () => {
  it('same seed produces stable output, length = n, range [0,1]', () => {
    const a = synthWaveform('demo.mp3', WAVE_N)
    const b = synthWaveform('demo.mp3', WAVE_N)
    expect(a).toEqual(b)
    expect(a).toHaveLength(WAVE_N)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('different seeds produce different output', () => {
    expect(synthWaveform('a.mp3', WAVE_N)).not.toEqual(synthWaveform('b.mp3', WAVE_N))
  })
})

describe('bucketPeaks', () => {
  it('output length = n; peak buckets normalize to 1, silence buckets to 0, half-peak buckets to 0.5', () => {
    // 4 buckets × 100 samples per bucket: bucket 0 peak 0.4, bucket 1 all 0, bucket 2 peak 0.8 (global max), bucket 3 peak -0.8 (absolute value)
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
  it('all-zero input → all-zero output (no division by zero)', () => {
    expect(bucketPeaks(new Float32Array(100), 4)).toEqual([0, 0, 0, 0])
  })
  it('boundary where len < n does not crash, output is still n values in [0,1]', () => {
    const out = bucketPeaks(new Float32Array([0.5, -1, 0.25]), 8)
    expect(out).toHaveLength(8)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...out)).toBe(1)
  })
  it('empty input → all-zero output', () => {
    expect(bucketPeaks(new Float32Array(0), 4)).toEqual([0, 0, 0, 0])
  })
})

describe('wave cache', () => {
  it('waveCacheKey uses path|size|date; when size/date is missing, leave that position empty', () => {
    expect(waveCacheKey({ path: '/DATA/a.mp3', size: 123, date: '2026-07-01' })).toBe('/DATA/a.mp3|123|2026-07-01')
    expect(waveCacheKey({ path: '/DATA/a.mp3' })).toBe('/DATA/a.mp3||')
  })
  it('after set, get hits; unset keys → undefined', () => {
    expect(getCachedWave('nope')).toBeUndefined()
    setCachedWave('k1', [0, 0.5, 1])
    expect(getCachedWave('k1')).toEqual([0, 0.5, 1])
  })
})

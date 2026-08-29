import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import PhotosMiniMap from '../../components/PhotosMiniMap.vue'
import { MAP_H, MAP_W, WORLD_DOTS, project } from '../worldMap'

describe('project', () => {
  it('(0,0) projects to the exact center of the canvas', () => {
    expect(project(0, 0)).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
  })

  it('(-180,90) projects to the top-left origin', () => {
    expect(project(-180, 90)).toEqual({ x: 0, y: 0 })
  })

  it('(180,-90) projects to the bottom-right corner', () => {
    expect(project(180, -90)).toEqual({ x: MAP_W, y: MAP_H })
  })
})

describe('WORLD_DOTS', () => {
  it('is non-empty (the land mask parses out at least one point)', () => {
    expect(WORLD_DOTS.length).toBeGreaterThan(0)
  })

  it('every point\'s projected coordinates fall within the canvas bounds', () => {
    for (const d of WORLD_DOTS) {
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThanOrEqual(MAP_W)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeLessThanOrEqual(MAP_H)
    }
  })
})

/* P6a-T2: fills in the viewBox minimum-span clamp branch parked from P5-T4.
   PhotosMiniMap.vue's internal constants: LON_PAD=20 / LAT_PAD=15 / MIN_LON_SPAN=40 / MIN_LAT_SPAN=30.
   The clamp kicks in when the span after padding is still < MIN_*_SPAN; in the single-point
   case the span after padding lands exactly on the threshold (LON_PAD*2 === MIN_LON_SPAN),
   so it does not trigger — only when a point sits close enough to ±180 / ±90 that padding
   gets clipped off on one side does the span fall below the threshold, which is the only
   path by which the "clamp branch" is actually reachable.

   The expected viewBox in every case below is hand-derived from PhotosMiniMap.vue's
   algorithm (not read back from a mounted component): first compute minLon/maxLon/minLat/
   maxLat by hand after padding+clamp+widen (integers or half-integers, worked out in the
   comments inside each it block), then convert to pixel coordinates using the
   **already-trusted** project() — project itself is already pinned down by the
   describe('project') block above, and is not the subject under test here.

   Found while double-checking: the draft comment's "widened back to a 40-degree span" is
   not precise — the widen step expands symmetrically around the new midpoint by
   ±MIN_SPAN/2, but the new midpoint itself is still pinned against the boundary, so after
   widening it gets clipped on the same side again, and the final span ends up < MIN_SPAN
   (it converges toward but never reaches it). Logged as a finding in the report. */
describe('PhotosMiniMap viewBox minimum-span clamp (boundary point positions)', () => {
  function viewBoxNums(points: Array<{ latitude: number, longitude: number, color?: string }>): number[] {
    const w = mount(PhotosMiniMap, { props: { points: points.map(p => ({ color: '#fff', ...p })) } })
    const vb = w.get('svg').attributes('viewBox') ?? ''
    return vb.split(' ').map(Number)
  }

  it('longitude close to +180 clips the right-side padding, triggering the lon clamp (latitude unaffected)', () => {
    // Single point (lon=179, lat=0).
    // lon: raw [179,179] → pad → min=max(159,-180)=159, max=min(199,180)=180
    //      span=21<40 → widen: mid=169.5, min=max(149.5,-180)=149.5, max=min(189.5,180)=180
    //      final [149.5, 180] (span=30.5, still <40 — see the finding noted in the comment above)
    // lat: raw [0,0] → pad → min=-15, max=15, span=30, not <30 → doesn't trigger, kept as-is
    const [vx, vy, vw, vh] = viewBoxNums([{ latitude: 0, longitude: 179 }])
    const topLeft = project(149.5, 15)
    const bottomRight = project(180, -15)
    expect(vx).toBe(topLeft.x)
    expect(vy).toBe(topLeft.y)
    expect(vw).toBe(bottomRight.x - topLeft.x)
    expect(vh).toBe(bottomRight.y - topLeft.y)
    // The right boundary does hit +180 (project(180,_).x === MAP_W), direct evidence the clamp triggered
    expect(vx + vw).toBe(MAP_W)
    // After widening the span is less than 40 degrees (see the finding above), but still greater than the pre-clip 21 degrees
    expect(vw).toBeLessThan((40 / 360) * MAP_W)
    expect(vw).toBeGreaterThan((21 / 360) * MAP_W)
  })

  it('latitude close to +90 clips the top-side padding, triggering the lat clamp (longitude unaffected)', () => {
    // Single point (lon=0, lat=89).
    // lat: raw [89,89] → pad → min=max(74,-90)=74, max=min(104,90)=90
    //      span=16<30 → widen: mid=82, min=max(67,-90)=67, max=min(97,90)=90
    //      final [67,90] (span=23, still <30)
    // lon: raw [0,0] → pad → [-20,20], span=40, not <40 → doesn't trigger
    const [vx, vy, vw, vh] = viewBoxNums([{ latitude: 89, longitude: 0 }])
    const topLeft = project(-20, 90)
    const bottomRight = project(20, 67)
    expect(vx).toBe(topLeft.x)
    expect(vy).toBe(topLeft.y)
    expect(vw).toBe(bottomRight.x - topLeft.x)
    expect(vh).toBe(bottomRight.y - topLeft.y)
    // The top boundary does hit +90 (project(_,90).y === 0)
    expect(vy).toBe(0)
    expect(vh).toBeLessThan((30 / 180) * MAP_H)
    expect(vh).toBeGreaterThan((16 / 180) * MAP_H)
  })

  it('the opposite side, close to -180 / -90, also triggers the clamp (both axes at once)', () => {
    // Single point (lon=-179, lat=-89).
    // lon: raw [-179,-179] → pad → min=max(-199,-180)=-180 (clipped), max=min(-159,180)=-159
    //      span=21<40 → widen: mid=-169.5, min=max(-189.5,-180)=-180 (clipped again), max=min(-149.5,180)=-149.5
    //      final [-180,-149.5] (span=30.5)
    // lat: raw [-89,-89] → pad → min=max(-104,-90)=-90 (clipped), max=min(-74,90)=-74
    //      span=16<30 → widen: mid=-82, min=max(-97,-90)=-90 (clipped again), max=min(-67,90)=-67
    //      final [-90,-67] (span=23)
    const [vx, vy, vw, vh] = viewBoxNums([{ latitude: -89, longitude: -179 }])
    const topLeft = project(-180, -67)
    const bottomRight = project(-149.5, -90)
    expect(vx).toBe(topLeft.x)
    expect(vy).toBe(topLeft.y)
    expect(vw).toBe(bottomRight.x - topLeft.x)
    expect(vh).toBe(bottomRight.y - topLeft.y)
    // The left boundary hits -180, the bottom boundary hits -90
    expect(vx).toBe(0)
    expect(vy + vh).toBe(MAP_H)
  })
})

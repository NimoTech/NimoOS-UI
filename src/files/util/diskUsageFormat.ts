import type { DiskSpace } from './raidSpaceFallback'

// A disk with a little data on it must not round down to a 0%-wide bar that
// reads as "empty"; and a backend overshoot must not overflow the track.
export function usedPercent(space: DiskSpace | null | undefined): number {
  if (!space || !(space.total > 0)) return 0
  const p = Math.round((space.used / space.total) * 100)
  if (space.used > 0 && p < 1) return 1
  return Math.max(0, Math.min(100, p))
}

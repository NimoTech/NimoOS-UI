export interface DiskSpace {
  used: number
  total: number
  avail: number
}

// GET /storage builds the mount-point -> space map the sidebar reads. When it
// omits a RAID array's mount point that array shows up with no usage at all, so
// re-derive it from GET /v2/raid/:id/status.
//
// A total of 0 means "not reported yet / not ready", not "an empty array" --
// returning a 0/0 space there would render a fake, permanently-full-looking bar.
export function raidFallbackSpaceFrom(
  status: { total_bytes?: number; used_bytes?: number; free_bytes?: number } | null | undefined,
): DiskSpace | null {
  const total = status?.total_bytes
  if (!(typeof total === 'number' && total > 0)) return null
  return { used: status?.used_bytes || 0, total, avail: status?.free_bytes || 0 }
}

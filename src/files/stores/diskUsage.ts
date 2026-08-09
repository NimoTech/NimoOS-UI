import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { retryRequest } from '../../util/retryRequest'
import { raidFallbackSpaceFrom, type DiskSpace } from '../util/raidSpaceFallback'

export interface RaidInfo {
  id: number | string
  name?: string
  level?: string | number
  mount_point?: string
}

export interface DiskDetail {
  space: DiskSpace | null
  raid: RaidInfo | null
}

// GET /storage reports the system partition as mount_point "/", but the product
// never browses from the real filesystem root -- everywhere else calls it /DATA.
const SYSTEM_MOUNT = '/'
const SYSTEM_MOUNT_AS = '/DATA'

interface StoragePartition {
  mount_point?: string
  // Verified against this device on 2026-08-09: these arrive as strings.
  size?: string | number
  used?: string | number
  avail?: string | number
}
interface StorageGroup {
  type?: string
  children?: StoragePartition[]
}

export const useDiskUsageStore = defineStore('files-disk-usage', () => {
  const details = ref<Record<string, DiskDetail>>({})

  function detailFor(mountPoint: string): DiskDetail | null {
    return details.value[mountPoint] ?? null
  }

  async function load(): Promise<void> {
    // The storage list is the primary source and worth retrying; the RAID list
    // is supplementary, so a machine with no RAID service still gets plain disk
    // usage instead of an empty popup.
    const groups = (await retryRequest(() => service.storage.list({ system: 'show' }) as Promise<StorageGroup[]>).catch(
      (e) => {
        console.warn('[files] storage list failed', e)
        return [] as StorageGroup[]
      },
    )) as StorageGroup[]
    const raidList = (await (service.raid.list() as unknown as Promise<RaidInfo[]>).catch((e) => {
      console.warn('[files] raid list failed', e)
      return [] as RaidInfo[]
    })) as RaidInfo[]

    const spaceByMount: Record<string, DiskSpace> = {}
    for (const g of groups || []) {
      for (const part of g?.children || []) {
        const raw = part?.mount_point
        const mp = raw === SYSTEM_MOUNT ? SYSTEM_MOUNT_AS : raw
        if (!mp) continue
        const total = Number(part.size)
        // A partition with no reported size would render as a 0-byte disk.
        if (!(total > 0)) continue
        spaceByMount[mp] = { used: Number(part.used) || 0, total, avail: Number(part.avail) || 0 }
      }
    }

    const raidByMount: Record<string, RaidInfo> = {}
    for (const r of raidList || []) if (r?.mount_point) raidByMount[r.mount_point] = r

    // Only for arrays the storage list left out. Each failure is swallowed on
    // its own so one bad array cannot blank the others.
    const fallback: Record<string, DiskSpace> = {}
    await Promise.all(
      (raidList || [])
        .filter((r) => r?.mount_point && !spaceByMount[r.mount_point as string])
        .map((r) =>
          (service.raid.getStatus(r.id) as unknown as Promise<unknown>)
            .then((st) => {
              const space = raidFallbackSpaceFrom(st as Parameters<typeof raidFallbackSpaceFrom>[0])
              if (space) fallback[r.mount_point as string] = space
            })
            .catch((e) => console.warn('[files] raid status failed', r.id, e)),
        ),
    )

    const next: Record<string, DiskDetail> = {}
    for (const mp of new Set([...Object.keys(spaceByMount), ...Object.keys(raidByMount)])) {
      next[mp] = { space: spaceByMount[mp] || fallback[mp] || null, raid: raidByMount[mp] || null }
    }
    details.value = next
  }

  return { details, load, detailFor }
})

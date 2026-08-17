import { service } from '@nimotech/nimoos-service'

/** The key for server-side custom storage. Same one used by Vue2 (SettingsPanel.vue's systemConfigName) and stores/locale.ts. */
export const SYSTEM_KEY = 'system'

/**
 * The server-side shape of Vue2's `barData` (SettingsPanel.vue L938-946).
 * The index signature isn't laziness — read-modify-write must carry unrecognised fields
 * back through untouched, otherwise one save from the new UI would wipe out fields
 * written by the old UI / a future version.
 */
export interface SystemBlob {
  lang?: string
  timezone?: string
  search_switch?: boolean
  recommend_switch?: boolean
  /**
   * Vue2 has this field, but the corresponding "show other Docker container apps" toggle
   * row never renders (notImportList is always an empty array, SET_NOTIMPORT_LIST is
   * never committed). Not building that row this cycle (debt D15), but the field must be
   * kept so read-modify-write doesn't drop it.
   */
  existing_apps_switch?: boolean
  rss_switch?: boolean
  disk_standby?: string
  [k: string]: unknown
}

/**
 * Defaults follow Vue2 L938-946, **but deliberately exclude `lang`** —
 * Vue2 defaults to en_us, New-UI defaults to zh_cn, and language is owned by
 * stores/locale.ts; giving a default here would incorrectly "correct" the user's
 * language on read.
 */
export const SYSTEM_DEFAULTS: Readonly<SystemBlob> = Object.freeze({
  timezone: 'America/New_York',
  search_switch: true,
  recommend_switch: true,
  existing_apps_switch: true,
  rss_switch: false,
  disk_standby: 'never',
})

function coerce(raw: unknown): Record<string, unknown> {
  let data = raw
  // The backend sometimes stores this block back as a string, not always an object (stores/locale.ts already has this compatibility branch)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

/** Reads the raw whole block (without merging defaults) — for internal use by patch only, to guarantee what's written back is the server's true full state. */
async function readRaw(): Promise<Record<string, unknown>> {
  return coerce(await service.users.getCustomStorage(SYSTEM_KEY))
}

/**
 * Reads config (with defaults merged in). **Never throws on failure** — the settings
 * page must still render even when config can't be fetched; showing defaults that get
 * written on the user's first edit beats a blank page.
 */
export async function readSystemConfig(): Promise<SystemBlob> {
  try {
    return { ...SYSTEM_DEFAULTS, ...(await readRaw()) }
  } catch (e) {
    console.warn('[systemConfig] read failed, using defaults', e)
    return { ...SYSTEM_DEFAULTS }
  }
}

/**
 * Serialization queue. Vue2's saveData() overwrites the whole block, and this repo has
 * multiple call sites (4 controls on the general page + the language setting in
 * stores/locale.ts) doing read-modify-write on the same key —
 * without serialization, concurrent saves would clobber each other (porting rule #3).
 * The queue re-reads the server **internally**, so it doesn't depend on a stale
 * snapshot held by the caller.
 */
let queue: Promise<unknown> = Promise.resolve()

export async function patchSystemConfig(patch: SystemBlob): Promise<SystemBlob> {
  // Keep chaining regardless of whether the previous link succeeded or failed — a single failure must not stall the whole queue
  const run = queue.then(
    () => apply(patch),
    () => apply(patch),
  )
  queue = run.catch(() => undefined)
  return run
}

async function apply(patch: SystemBlob): Promise<SystemBlob> {
  const current = await readRaw()
  const next = { ...current, ...patch }
  await service.users.setCustomStorage(SYSTEM_KEY, next)
  return { ...SYSTEM_DEFAULTS, ...next }
}

/** Test-only: clears the queue so test cases don't chain into each other. */
export function __resetSystemConfigQueue(): void {
  queue = Promise.resolve()
}

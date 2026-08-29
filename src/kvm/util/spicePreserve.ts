import type { KvmVM } from '@nimotech/nimoos-service'

type SpicePorts = Pick<KvmVM, 'spicePort' | 'spiceTlsPort'>

/**
 * SPICE port keep-alive merging.
 *
 * Why it is needed: `GET /v1/kvm/vms` list API **does return** spicePort/spiceTlsPort,
 * but that value comes from a backend memory snapshot — `ListVMs` returns the snapshot
 * directly, and only when `GetVMVNCInfo` (the `/vnc` endpoint for a single VM) is called
 * will the real port be written back into this snapshot. So spicePort from list refresh
 * **may be stale or even 0** (after KVM service restart, or when the console has never
 * been opened), and is not a reliable data source; the only authoritative source is
 * `GET /v1/kvm/vms/:id/vnc`. Without this workaround, periodic list refresh would
 * overwrite the real port obtained from /vnc with 0, causing the SPICE indicator to
 * flash briefly and then disappear.
 *
 * Vue2 uses a workaround of "if new value <= 0 and old value > 0, keep using old value"
 * (KVMFullPage.vue:890-892 / :916-919 / :928-931, same logic copied three times).
 * **This is a workaround for backend field staleness, not a bug**, so we replicate it;
 * here it is extracted into a pure function for reuse across three call sites.
 */
export function preserveSpice(fresh: KvmVM, old: SpicePorts | null | undefined): KvmVM {
  if (!old) return fresh
  if (fresh.spicePort > 0 || !(old.spicePort > 0)) return fresh
  return { ...fresh, spicePort: old.spicePort, spiceTlsPort: old.spiceTlsPort }
}

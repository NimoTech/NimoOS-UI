// crypto.randomUUID() only exists in a SECURE context (HTTPS or localhost).
// NimoOS is a self-hosted NAS typically reached over plain HTTP at a LAN
// address (e.g. http://192.168.x.x/app/) — a NON-secure context where
// crypto.randomUUID is undefined and calling it throws. Vue2's clientId.js
// guarded this ("non-secure context fallback"); the P3a port dropped the guard, which
// made addFilesToQueue throw before enqueuing (no panel, no upload). This
// restores the fallback for every upload-side id generator.
export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
}

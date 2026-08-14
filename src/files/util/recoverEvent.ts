// Strip quotes from both ends (aligned with Vue2 /^["|'](.*)["|']$/g).
function strip(v: unknown): string {
  const s = v == null ? '' : String(v)
  const m = /^["'](.*)["']$/.exec(s)
  return m ? m[1] : s
}

export interface RecoverInfo {
  status: string
  driver: string
  message: string
}

// ⚠️ useMessageBus has unpacked Properties → callback gets {status,driver,message} directly (not props.Properties).
export function parseRecover(props: unknown): RecoverInfo | null {
  const p = props as Record<string, unknown> | null | undefined
  if (!p || (p.status == null && p.driver == null && p.message == null)) return null
  return { status: strip(p.status), driver: strip(p.driver), message: strip(p.message) }
}

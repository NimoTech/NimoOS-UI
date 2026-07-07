// 剥值两端引号(对齐 Vue2 /^["|'](.*)["|']$/g)。
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

// ⚠️ useMessageBus 已解包 Properties → 回调直接拿到 {status,driver,message}(非 props.Properties)。
export function parseRecover(props: unknown): RecoverInfo | null {
  const p = props as Record<string, unknown> | null | undefined
  if (!p || (p.status == null && p.driver == null && p.message == null)) return null
  return { status: strip(p.status), driver: strip(p.driver), message: strip(p.message) }
}

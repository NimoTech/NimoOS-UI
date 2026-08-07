import type { Utilization, UtilSection } from './types.js'

// socket 传 JSON 字符串;HTTP 已是对象。统一解析为对象或 null。
function jget(v: unknown): UtilSection {
  if (v == null) return null
  if (typeof v === 'string') {
    try { return JSON.parse(v) as Record<string, unknown> } catch { return null }
  }
  if (typeof v === 'object') return v as Record<string, unknown>
  return null
}

// socket 用 sys_*;HTTP 用裸键。sys_* 优先。
function pick(src: Record<string, unknown>, a: string, b: string): unknown {
  return src[a] != null ? src[a] : src[b]
}

export function parseUtil(src: Record<string, unknown> | null | undefined): Utilization {
  const s = src ?? {}
  return {
    cpu: jget(pick(s, 'sys_cpu', 'cpu')),
    mem: jget(pick(s, 'sys_mem', 'mem')),
    disk: jget(pick(s, 'sys_disk', 'disk')),
    gpu: jget(pick(s, 'sys_gpu', 'gpu')),
    net: jget(pick(s, 'sys_net', 'net')),
    usb: jget(pick(s, 'sys_usb', 'usb')),
  }
}

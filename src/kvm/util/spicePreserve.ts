import type { KvmVM } from '@nimotech/nimoos-service'

type SpicePorts = Pick<KvmVM, 'spicePort' | 'spiceTlsPort'>

/**
 * spicePort 保活合并。
 *
 * 为什么需要它:`GET /v1/kvm/vms` 列表接口**确实会返回** spicePort/spiceTlsPort,
 * 但那个值来自后端内存快照——`ListVMs` 直接吐快照,只有 `GetVMVNCInfo`(单台 VM 的
 * `/vnc` 接口)被调用时才会把真实端口回写进这份快照。所以列表刷新拿到的 spicePort
 * **可能陈旧、也可能是 0**(KVM 服务重启后、或从未打开过控制台时),并非稳定可信
 * 的数据源;唯一权威来源是 `GET /v1/kvm/vms/:id/vnc`。若不做兜底,定时刷新列表时
 * 会把之前从 /vnc 拿到的真实端口冲成 0,SPICE 提示条闪一下就消失。
 *
 * Vue2 用「新值 <= 0 且旧值 > 0 就沿用旧值」兜底(KVMFullPage.vue:890-892 / :916-919 /
 * :928-931,同一段逻辑抄了三遍)。**这是后端字段可能陈旧的兜底,不是 bug**,照抄;
 * 这里抽成一个纯函数,三处调用点共用。
 */
export function preserveSpice(fresh: KvmVM, old: SpicePorts | null | undefined): KvmVM {
  if (!old) return fresh
  if (fresh.spicePort > 0 || !(old.spicePort > 0)) return fresh
  return { ...fresh, spicePort: old.spicePort, spiceTlsPort: old.spiceTlsPort }
}

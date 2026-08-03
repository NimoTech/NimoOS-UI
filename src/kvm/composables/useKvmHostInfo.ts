import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// KVM 全局设置数据层。GET /kvm/settings 单层信封(共享包 kvmUnwrap 已剥好),一次请求
// 拆成"只读宿主机规格"(host)与"可写全局设置"(settings)两半——两者是同一个后端对象的
// 不同字段子集,不是两次请求。本 composable 除了 Task 2(全局设置弹窗)自己消费,也是
// Task 7(创建弹窗默认值/宿主机规格展示)与 Task 9(VM 设置弹窗)的地基,返回签名必须
// 与 brief 的 Interfaces 块逐字一致。
//
// 照 Vue2 KVMFullPage.vue showGlobalSettings(:1075-1088)/saveGlobalSettings(:1090-1106)。

export interface KvmHostReadonly {
  cpuCores: number
  availableMemoryMB: number
  availableDiskGB: number
  networkInterfaces: string[]
  defaultDiskSize: number
}

export interface KvmWritableSettings {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
}

export function useKvmHostInfo() {
  // 授权偏离(spec §12 #6,已申报):Vue2 hostInfo 初值是硬编码假值
  // (cpuCores:16 / availableMemoryMB:11673 / availableDiskGB:959,KVMFullPage.vue:619-627)——
  // 那是当年写占位时留下的残留,会让 CPU 核心格子首帧闪出 16 个再变真值 6 个(真机
  // 2026-08-03 实测 cpuCores 其实是 6)。这里改成全 0/[]——fetch 完成前渲染出的是
  // "0 核心"而不是一个会闪烁的假数字,对消费方(Task 7/9)更安全。
  const host: Ref<KvmHostReadonly> = ref({
    cpuCores: 0,
    availableMemoryMB: 0,
    availableDiskGB: 0,
    networkInterfaces: [],
    defaultDiskSize: 0,
  })

  const settings: Ref<KvmWritableSettings> = ref({
    storagePath: '',
    defaultVcpu: 0,
    defaultMemory: 0,
    autostart: false,
  })

  const loaded = ref(false)

  // 就地过期守卫(硬约束 5:别抽公共 guard 工具)。dispose() 置 false,fetch/save 的
  // await 之后先判 alive 再写 ref——组件卸载后到达的响应不再污染已经不存在的视图状态。
  let alive = true

  async function fetch(): Promise<void> {
    // 照 Vue2 showGlobalSettings(:1077-1087)的 .catch(() => {}):吞掉错误,不写 lastError、
    // 不改 loaded(保持 false)。
    try {
      const res = await service.kvm.getSettings()
      if (!alive) return // 过期守卫:组件已卸载,这份迟到的响应不再写 state
      host.value = {
        cpuCores: res.cpuCores,
        availableMemoryMB: res.availableMemoryMB,
        availableDiskGB: res.availableDiskGB,
        networkInterfaces: res.networkInterfaces,
        defaultDiskSize: res.defaultDiskSize,
      }
      settings.value = {
        storagePath: res.storagePath,
        defaultVcpu: res.defaultVcpu,
        defaultMemory: res.defaultMemory,
        autostart: res.autostart,
      }
      loaded.value = true
    } catch {
      // 吞错,不写任何 state——loaded 保持 false,host/settings 保持上一次(或初始)的值。
    }
  }

  // 返回值(''=成功,非空=这次调用失败的文案):照 P5 ejectInstallMedia 已立好的契约,
  // 避免调用方读共享 lastError 造成串味(本 composable 目前只有一个消费点,但契约统一
  // 更利于 Task 7/9 复用同一个模式)。失败文案优先取后端 Error.message 原文(硬约束 7),
  // 空则回退 i18n 键名,由消费方 te()/t() 判定。
  async function save(next: KvmWritableSettings): Promise<string> {
    try {
      await service.kvm.updateSettings({
        storagePath: next.storagePath,
        defaultVcpu: next.defaultVcpu,
        defaultMemory: next.defaultMemory,
        autostart: next.autostart,
      })
      if (!alive) return '' // dispose 之后到达的结果不再写 state,没有观众也谈不上"成功"
      return ''
    } catch (e) {
      if (!alive) return ''
      return (e instanceof Error && e.message) || 'kvmFailedToSaveSettings'
    }
  }

  function dispose(): void {
    alive = false
  }

  return { host, settings, loaded, fetch, save, dispose }
}

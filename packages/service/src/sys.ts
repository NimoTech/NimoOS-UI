import type { AxiosInstance } from 'axios'
import type {
  Utilization, HardwareInfo, UpdateCheck, SysBaseInfo, SystemPaths,
  SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, MigrateStatus,
} from './types.js'
import { parseUtil } from './parseUtil.js'
import { unwrap } from './unwrap.js'

export function createSys(http: AxiosInstance) {
  // trigger_download 只在显式传参时下发,避免给所有 GET 都挂上空 params
  const q = (params?: { trigger_download?: 1 }) => (params ? { params } : undefined)

  return {
    async getUtilization(): Promise<Utilization> {
      const res = await http.get('/sys/utilization')
      return parseUtil(unwrap<Record<string, unknown>>(res.data))
    },
    async hardwareInfo(): Promise<HardwareInfo> {
      const res = await http.get('/sys/hardware')
      return unwrap<HardwareInfo>(res.data)
    },

    // ⚠️ 命名陷阱:Vue2 的 getVersion() 打的是 os_version、getAppVersion() 才是 version。
    // 包里一律用语义名。os = 固件/系统镜像版本;app = NimoOS 应用自身版本。
    async getOsVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/os_version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    async getAppVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    /** @deprecated 用 getAppVersion()。SP1 起已有调用方,不能删。 */
    async getVersion(): Promise<{ current_version: string }> {
      const res = await http.get('/sys/version')
      return unwrap<{ current_version: string }>(res.data)
    },

    async getBaseInfo(): Promise<SysBaseInfo> {
      const res = await http.get('/sys/baseinfo')
      return unwrap<SysBaseInfo>(res.data)
    },
    async getLogs(): Promise<string> {
      const res = await http.get('/sys/logs')
      return unwrap<string>(res.data) ?? ''
    },
    async getSystemPaths(): Promise<SystemPaths> {
      const res = await http.get('/sys/paths')
      return unwrap<SystemPaths>(res.data)
    },

    // ⚠️ migrate 两个方法本期只进包,消费在 P3。类型依据是 Go struct
    // (NimoOS/service/migrate.go:46-57),**没有 curl 实证**(开发机上不能真跑迁移)。
    // P3 消费前必须抓一次真实响应复核字段。
    async migrateAppPath(type: string, targetMount: string): Promise<{ job_id: string }> {
      const res = await http.post('/sys/migrate', { type, target_mount: targetMount })
      return unwrap<{ job_id: string }>(res.data)
    },
    async getMigrateStatus(jobId: string): Promise<MigrateStatus> {
      const res = await http.get(`/sys/migrate/${jobId}`)
      return unwrap<MigrateStatus>(res.data)
    },

    // 后端对未知 state 也返 200 但什么都不做(NimoOS/route/v1/system.go:552-560),
    // 所以这里把类型收窄,让打错字在编译期就炸。
    async power(action: 'off' | 'restart'): Promise<void> {
      await http.put(`/sys/state/${action}`)
    },
    async setDiskStandby(input: { minutes: number }): Promise<void> {
      await http.put('/sys/disk/standby', input)
    },
    // ⚠️ 这两个端点**失败时也返回 HTTP 200**,错误只写在信封里
    // (NimoOS/route/v1/system.go:93-102 FirmwareUpdate 与 :149-158 SystemUpdate
    //  的错误分支都是 ctx.JSON(common_err.SUCCESS, Result{Success: SERVICE_ERROR, ...}))。
    // axios 不会 reject,所以必须自己查信封 —— 否则升级失败会被当成成功。
    // Vue2 的 UpdateModal.updateSystem() 也是查 res.data.success !== 200 的,
    // 不查等于比 Vue2 更糟(移植纪律:吞错不照抄)。
    // 对比:/gateway/port 与 /gateway/ssl 的写操作返回真实 4xx/5xx,axios 自己会 reject;
    //      /sys/download/cancel 无失败分支(system.go:167-171 恒 SUCCESS)。
    async updateApp(): Promise<void> {
      const res = await http.post('/sys/update')
      unwrap<unknown>(res.data)
    },
    async updateOs(): Promise<void> {
      const res = await http.post('/sys/os_update')
      unwrap<unknown>(res.data)
    },
    async cancelDownload(): Promise<void> {
      await http.post('/sys/download/cancel')
    },

    async getServerPort(): Promise<string> {
      const res = await http.get('/gateway/port')
      return unwrap<string>(res.data)
    },
    async editServerPort(input: { port: string }): Promise<void> {
      await http.put('/gateway/port', input)
    },
    async getSSLConfig(): Promise<SSLConfig> {
      const res = await http.get('/gateway/ssl')
      return unwrap<SSLConfig>(res.data)
    },
    async setSSLConfig(cfg: SSLConfigInput): Promise<void> {
      await http.put('/gateway/ssl', cfg)
    },
    async uploadSSLCert(form: FormData): Promise<void> {
      await http.post('/gateway/ssl/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    },

    // ⚠️ 这两个是**裸 JSON,没有 success/message/data 信封**(curl 实证 2026-07-31)。
    // 同前缀下 /gateway/port 与 /gateway/ssl 却有信封 —— 信封层数按端点不同,别统一套 unwrap。
    async getGatewayComponents(): Promise<GatewayComponent[]> {
      const res = await http.get('/gateway/components')
      const body = res.data as { components?: GatewayComponent[] } | null
      return body?.components ?? []
    },
    async getDeviceInfo(): Promise<GatewayDeviceInfo> {
      const res = await http.get('/gateway/device-info')
      return res.data as GatewayDeviceInfo
    },

    // 后端存的是字符串 "True"/"False"(NimoOS-LocalStorage/route/v1/usb.go:37/40),
    // 在包里归一成布尔,别让每个消费方各自记这个坑。
    async getUsbStatus(): Promise<boolean> {
      const res = await http.get('/usb/usb-auto-mount')
      return unwrap<string>(res.data) === 'True'
    },
    async toggleUsbAutoMount(input: { state: 'on' | 'off' }): Promise<void> {
      await http.put('/usb/usb-auto-mount', input)
    },
  }
}

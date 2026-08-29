import type { AxiosInstance } from 'axios'
import type {
  Utilization, HardwareInfo, UpdateCheck, SysBaseInfo, SystemPaths,
  SSLConfig, SSLConfigInput, GatewayComponent, GatewayDeviceInfo, LanDiscovery, MigrateStatus,
} from './types.js'
import { parseUtil } from './parseUtil.js'
import { unwrap } from './unwrap.js'

export function createSys(http: AxiosInstance) {
  // trigger_download is sent only when explicitly passed, to avoid attaching empty params to every GET
  const q = (params?: { trigger_download?: 1 }) => (params ? { params } : undefined)

  return {
    async getUtilization(): Promise<Utilization> {
      const res = await http.get('/sys/utilization')
      return parseUtil(unwrap<Record<string, unknown>>(res.data))
    },

    // Returns the host's IANA zone name, e.g. "Asia/Shanghai". Deliberately not
    // the `timezone` field of the user's system config blob: that one is a
    // display preference the old UI's settings page wrote, and nothing keeps it
    // in step with the host. unwrap() throws on a non-200 envelope, which is what
    // callers use to decide the reading is unavailable.
    async getTimeZone(): Promise<string> {
      const res = await http.get('/sys/timezone')
      return unwrap<{ timezone: string }>(res.data)?.timezone ?? ''
    },
    async hardwareInfo(): Promise<HardwareInfo> {
      const res = await http.get('/sys/hardware')
      return unwrap<HardwareInfo>(res.data)
    },

    // ⚠️ Naming trap: Vue2's getVersion() hits os_version, and getAppVersion() is the one hitting version.
    // This package uses semantic names throughout. os = firmware/system image version; app = the NimoOS application's own version.
    async getOsVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/os_version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    async getAppVersion(params?: { trigger_download?: 1 }): Promise<UpdateCheck> {
      const res = await http.get('/sys/version', q(params))
      return unwrap<UpdateCheck>(res.data)
    },
    /** @deprecated Use getAppVersion(). Has callers since SP1, cannot be removed. */
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

    // ⚠️ The two migrate methods only land in the package this sprint; consumption is in P3. Types are based on the Go struct
    // (NimoOS/service/migrate.go:46-57), **not verified via curl** (a real migration can't run on the dev machine).
    // Before P3 consumes them, a real response must be captured to re-verify the fields.
    async migrateAppPath(type: string, targetMount: string): Promise<{ job_id: string }> {
      const res = await http.post('/sys/migrate', { type, target_mount: targetMount })
      return unwrap<{ job_id: string }>(res.data)
    },
    async getMigrateStatus(jobId: string): Promise<MigrateStatus> {
      const res = await http.get(`/sys/migrate/${jobId}`)
      return unwrap<MigrateStatus>(res.data)
    },

    // The backend also returns 200 for an unknown state but does nothing (NimoOS/route/v1/system.go:552-560),
    // so the type is narrowed here to make typos blow up at compile time.
    async power(action: 'off' | 'restart'): Promise<void> {
      await http.put(`/sys/state/${action}`)
    },
    async setDiskStandby(input: { minutes: number }): Promise<void> {
      await http.put('/sys/disk/standby', input)
    },
    // ⚠️ These two endpoints **return HTTP 200 even on failure**; the error lives only in the envelope
    // (the error branches of NimoOS/route/v1/system.go:93-102 FirmwareUpdate and :149-158 SystemUpdate
    //  are both ctx.JSON(common_err.SUCCESS, Result{Success: SERVICE_ERROR, ...})).
    // axios will not reject, so the envelope must be checked here — otherwise a failed upgrade is treated as success.
    // Vue2's UpdateModal.updateSystem() also checks res.data.success !== 200;
    // not checking would be worse than Vue2 (porting discipline: don't copy error-swallowing).
    // Contrast: the /gateway/port and /gateway/ssl writes return real 4xx/5xx and axios rejects on its own;
    //      /sys/download/cancel has no failure branch (system.go:167-171 always SUCCESS).
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

    // ⚠️ These two are **bare JSON, no success/message/data envelope** (verified via curl 2026-07-31).
    // Under the same prefix, /gateway/port and /gateway/ssl DO have envelopes — envelope depth varies per endpoint, don't blanket-apply unwrap.
    async getGatewayComponents(): Promise<GatewayComponent[]> {
      const res = await http.get('/gateway/components')
      const body = res.data as { components?: GatewayComponent[] } | null
      return body?.components ?? []
    },
    async getDeviceInfo(): Promise<GatewayDeviceInfo> {
      const res = await http.get('/gateway/device-info')
      return res.data as GatewayDeviceInfo
    },
    // Bare JSON as well -- {"devices":[…],"truncated":false}, no success/message/data
    // envelope (verified with curl on the device 2026-08-09). unwrap() would throw here
    // because it treats a missing `success: 200` as a failed request.
    async getLanDiscovery(): Promise<LanDiscovery> {
      const res = await http.get('/gateway/lan-discovery')
      const body = res.data as Partial<LanDiscovery> | null
      return { devices: body?.devices ?? [], truncated: body?.truncated ?? false }
    },

    // The backend stores the strings "True"/"False" (NimoOS-LocalStorage/route/v1/usb.go:37/40);
    // normalize to a boolean in the package so each consumer doesn't have to remember this pitfall.
    async getUsbStatus(): Promise<boolean> {
      const res = await http.get('/usb/usb-auto-mount')
      return unwrap<string>(res.data) === 'True'
    },
    async toggleUsbAutoMount(input: { state: 'on' | 'off' }): Promise<void> {
      await http.put('/usb/usb-auto-mount', input)
    },
  }
}

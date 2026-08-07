import type { AxiosInstance } from 'axios'
import type { ComposeAppWithStoreInfo } from './types.js'
import { v2Data } from './v2.js'

export interface ComposeContainerSummary { ID: string; Name?: string; State?: string }
export interface ComposeContainersInfo { main?: string; containers: Record<string, ComposeContainerSummary> }

const BASE = '/v2/app_management/compose'
const idPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export function createCompose(http: AxiosInstance) {
  return {
    async list(): Promise<Record<string, ComposeAppWithStoreInfo>> {
      const res = await http.get(BASE)
      // 判原始信封而非解包后对象的键名——store app 若恰好叫 "message" 不该被误判成错误信封。
      const body = res.data as { data?: unknown } | null
      const d = body && typeof body === 'object' && 'data' in body ? body.data : undefined
      return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, ComposeAppWithStoreInfo>) : {}
    },

    async get(id: string): Promise<ComposeAppWithStoreInfo | undefined> {
      // 404(应用不存在)按契约返回 undefined,不抛——调用方(如 installProgress 看门狗)
      // 要能区分「确定不存在」与「网络错」;抛 404 会被当网络抖动无限重试(幽灵进度卡)。
      try {
        const res = await http.get(idPath(id))
        return v2Data<ComposeAppWithStoreInfo>(res.data)
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return undefined
        throw e
      }
    },

    /** 已装应用 compose 的 YAML 原文(Accept: application/yaml,裸文本非信封)。
     *  YAML 是 PUT 的原生往返格式,且对无扩展块的应用也稳定返回(JSON GET 对无 x-nimoos 的应用会 500);
     *  YAML 还完整保留 service 级嵌套扩展(JSON 只留顶层 x-nimoos/x-casaos,丢 service 内嵌 envs/ports/volumes 描述)——
     *  设置面板编辑必须走这条。
     *  transformResponse 置空:axios 默认会把疑似 JSON 的文本 parse 掉(getAppCompose 同款)。 */
    async getYaml(id: string): Promise<string> {
      const res = await http.get(idPath(id), {
        headers: { Accept: 'application/yaml' },
        responseType: 'text',
        transformResponse: [(d: unknown) => d],
      })
      return typeof res.data === 'string' ? res.data : ''
    },

    /** 安装。yaml = compose 原文;dryRun=true 只校验不执行(安装前校验用)。
     *  安装是异步任务:2xx 只代表受理,进度/完成走 MessageBus app:install-*(P3 消费)。 */
    async install(yaml: string, opts?: { dryRun?: boolean; checkPortConflict?: boolean }): Promise<void> {
      await http.post(BASE, yaml, {
        headers: { 'Content-Type': 'application/yaml' },
        params: { dry_run: opts?.dryRun, check_port_conflict: opts?.checkPortConflict },
      })
    },

    /** 修改已装应用设置(PUT 整份 compose YAML,支持 dryRun 预校验)。 */
    async applySettings(id: string, yaml: string, opts?: { dryRun?: boolean; checkPortConflict?: boolean }): Promise<void> {
      await http.put(idPath(id), yaml, {
        headers: { 'Content-Type': 'application/yaml' },
        params: { dry_run: opts?.dryRun, check_port_conflict: opts?.checkPortConflict },
      })
    },

    /** 更新到商店版本。200 的 message 是人话结果(「已是最新」/「异步更新中」),
     *  Vue2 直接 toast 它,故透传;真在更新时后续走 app:update-begin/-end/-error 事件。 */
    async update(id: string, opts?: { force?: boolean }): Promise<string> {
      const res = await http.patch(idPath(id), undefined, { params: { force: opts?.force } })
      const body = res.data as { message?: unknown } | null
      return body && typeof body === 'object' && typeof body.message === 'string' ? body.message : ''
    },

    /** 卸载。deleteConfigFolder 后端默认 true(连数据目录一起删),
     *  UI 的「保留数据」选项传 false。异步,完成走 app:uninstall-end/-error。 */
    async uninstall(id: string, opts?: { deleteConfigFolder?: boolean }): Promise<void> {
      await http.delete(idPath(id), { params: { delete_config_folder: opts?.deleteConfigFolder } })
    },

    /** 启停重启。body 是裸 JSON 字符串("start"),直接传字面量会被 axios
     *  当 text/plain 发出、echo Bind 解析失败——apps.start 同款坑。 */
    async setStatus(id: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
      await http.put(`${idPath(id)}/status`, JSON.stringify(action), {
        headers: { 'Content-Type': 'application/json' },
      })
    },

    /** 日志(data 是整段字符串)。lines=-1 取全部,默认后端 1000。 */
    async logs(id: string, opts?: { lines?: number }): Promise<string> {
      const res = await http.get(`${idPath(id)}/logs`, { params: { lines: opts?.lines } })
      return v2Data<string>(res.data) ?? ''
    },

    /** 每个 compose service 的运行容器(后端 workaround:每服务只回第一个容器)。
     *  404(应用不存在)返回 undefined 不抛——与 get() 同契约(见其注释)。 */
    async containers(id: string): Promise<ComposeContainersInfo | undefined> {
      try {
        const res = await http.get(`${idPath(id)}/containers`)
        const d = v2Data<{ main?: string; containers?: Record<string, ComposeContainerSummary> }>(res.data)
        if (!d) return undefined
        return { main: d.main, containers: d.containers ?? {} }
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return undefined
        throw e
      }
    },

    /** 健康检查:2xx→true,任何失败→false(AppLauncherCheck 语义)。 */
    async healthcheck(id: string): Promise<boolean> {
      try {
        await http.get(`${idPath(id)}/healthcheck`)
        return true
      } catch {
        return false
      }
    },
  }
}

import type { AxiosInstance } from 'axios'
import type { DockerNetwork, PruneReport } from './types.js'
import { unwrap } from './unwrap.js'

export function createContainer(http: AxiosInstance) {
  return {
    /** GET /v1/container/networks(v1 标准信封)。data 异形退化空数组。 */
    async getNetworks(): Promise<DockerNetwork[]> {
      const res = await http.get('/container/networks')
      const d = unwrap<unknown>(res.data)
      return Array.isArray(d) ? (d as DockerNetwork[]) : []
    },

    /** POST /v1/container/prune(v1 标准信封)。
     *  ⚠️ 与 NimoOS-UI/src/service/sys.js:154 的同名 prune() 不是一回事 —— 那个打 /v1/sys/prune。
     *  ⚠️ 后端是 ContainersPrune(空过滤器) + ImagesPrune(空过滤器):
     *     **删掉全部已停止的容器** + 悬空镜像。调用方必须有二次确认。 */
    async prune(): Promise<PruneReport> {
      const res = await http.post('/container/prune')
      const d = unwrap<Partial<PruneReport> | null>(res.data)
      return { containers: d?.containers ?? null, images: d?.images ?? null }
    },
  }
}

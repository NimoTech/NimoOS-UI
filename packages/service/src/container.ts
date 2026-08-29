import type { AxiosInstance } from 'axios'
import type { DockerNetwork, PruneReport } from './types.js'
import { unwrap } from './unwrap.js'

export function createContainer(http: AxiosInstance) {
  return {
    /** GET /v1/container/networks (v1 standard envelope). Malformed data degrades to an empty array. */
    async getNetworks(): Promise<DockerNetwork[]> {
      const res = await http.get('/container/networks')
      const d = unwrap<unknown>(res.data)
      return Array.isArray(d) ? (d as DockerNetwork[]) : []
    },

    /** POST /v1/container/prune (v1 standard envelope).
     *  ⚠️ Not the same as the identically named prune() in the Vue 2 panel's src/service/sys.js:154 — that one hits /v1/sys/prune.
     *  ⚠️ The backend runs ContainersPrune (empty filter) + ImagesPrune (empty filter):
     *     **deletes ALL stopped containers** + dangling images. Callers must have a second confirmation. */
    async prune(): Promise<PruneReport> {
      const res = await http.post('/container/prune')
      const d = unwrap<Partial<PruneReport> | null>(res.data)
      return { containers: d?.containers ?? null, images: d?.images ?? null }
    },
  }
}

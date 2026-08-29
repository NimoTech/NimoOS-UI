import type { AxiosInstance } from 'axios'
import type { BatchDetail, CreateBatchInput, UploadBatch, UploadBatchItem } from './types.js'

const BASE = '/v2/nimoos/file/upload-batches'

export function createUploadBatches(http: AxiosInstance, getToken: () => string | null) {
  return {
    // Registers the manifest before the upload starts. Idempotent server-side:
    // resubmitting the same id returns 201 without creating a duplicate.
    async createBatch(input: CreateBatchInput): Promise<void> {
      await http.post(BASE, { id: input.id, targetPath: input.targetPath, items: input.items })
    },

    // RAW envelope {batch, missing} — no `success` field, so unwrap() would
    // always throw. Degrade to an empty manifest rather than propagating a
    // shape error; the caller renders "failed to load" off batch === null.
    async getBatch(id: string): Promise<BatchDetail> {
      const res = await http.get(`${BASE}/${id}`)
      const raw = res.data as { batch?: unknown; missing?: unknown } | null
      const missing = raw?.missing
      return {
        batch: (raw?.batch as UploadBatch | undefined) ?? null,
        missing: Array.isArray(missing) ? (missing as UploadBatchItem[]) : [],
      }
    },

    async abandonBatch(id: string): Promise<void> {
      await http.post(`${BASE}/${id}/abandon`)
    },

    // Abandons EVERY interrupted batch whose missing files sit at or under
    // path (the badged entry). The badge carries a single batch id while
    // several interrupted batches can stack on one folder, so abandoning by id
    // makes the badge come back with the next batch's id on the next listing.
    async abandonUnder(path: string): Promise<void> {
      await http.post(`${BASE}/abandon-under`, { path })
    },

    // Drops canceled files from the batch manifest so the batch can still
    // complete without them; a stale manifest leaves the batch permanently
    // incomplete and resurrects the broken badge two minutes later.
    async removeBatchItems(id: string, relativePaths: string[]): Promise<void> {
      await http.post(`${BASE}/${id}/remove-items`, { relativePaths })
    },

    // Sent from pagehide, where axios/XHR is unreliable during page unload and
    // sendBeacon cannot carry an Authorization header — hence raw fetch with
    // keepalive. Fire-and-forget: if the signal is lost (no keepalive support,
    // process killed), the server's idle-timeout sweep covers it.
    interruptBatch(id: string): void {
      const token = getToken() || ''
      try {
        void fetch(`${BASE}/${id}/interrupt`, {
          method: 'POST',
          keepalive: true,
          headers: { Authorization: token },
        })
      } catch {
        /* old browsers without keepalive: give up the signal, rely on the server timeout */
      }
    },
  }
}

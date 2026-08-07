import type { AxiosInstance } from 'axios'
import type { FileContent, ServerUploadTask, UploadPrecheckResult } from './types.js'
import { unwrap } from './unwrap.js'

export const UPLOAD_TUS_ENDPOINT = '/v2/nimoos/file/upload-tus/'

export function createFile(http: AxiosInstance, getToken: () => string | null) {
  return {
    async getContent(path: string): Promise<FileContent> {
      const res = await http.get('/file/content', { params: { path, timestamp: Date.now() } })
      return unwrap<FileContent>(res.data)
    },
    async download(path: string): Promise<unknown> {
      const res = await http.get('/file', { params: { path, timestamp: Date.now() } })
      return unwrap<unknown>(res.data)
    },
    async create(path: string): Promise<unknown> {
      const res = await http.post('/file', { path })
      return unwrap<unknown>(res.data)
    },
    async rename(oldPath: string, newPath: string): Promise<unknown> {
      const res = await http.put('/file/name', { old_path: oldPath, new_path: newPath })
      return unwrap<unknown>(res.data)
    },
    async update(path: string, content: string): Promise<unknown> {
      const res = await http.put('/file', { path, content })
      return unwrap<unknown>(res.data)
    },
    async uploadPrecheck(targetPath: string, files: { relativePath: string; size: number }[]): Promise<UploadPrecheckResult> {
      const res = await http.post('/v2/nimoos/file/upload-precheck', { targetPath, files })
      // Core returns a RAW envelope {results:[...]} with NO standard `success`
      // field, so unwrap() would always throw. Tolerate raw + a standard wrap,
      // degrade to empty. (Same non-standard-envelope trap as /web/appgrid; Vue2
      // reads json.results directly too.)
      const raw = res.data as { results?: unknown; data?: { results?: unknown } } | null
      const results = raw?.results ?? raw?.data?.results
      return { results: Array.isArray(results) ? (results as UploadPrecheckResult['results']) : [] }
    },
    async listActiveUploads(): Promise<{ tasks: ServerUploadTask[] }> {
      const res = await http.get('/v2/nimoos/file/uploads?status=active')
      // RAW envelope {tasks:[...]} (no `success`) — do not unwrap.
      const raw = res.data as { tasks?: unknown; data?: { tasks?: unknown } } | null
      const tasks = raw?.tasks ?? raw?.data?.tasks
      return { tasks: Array.isArray(tasks) ? (tasks as ServerUploadTask[]) : [] }
    },
    async cancelUpload(id: string): Promise<unknown> {
      const res = await http.post(`/v2/nimoos/file/uploads/${id}/cancel`)
      // RAW envelope {canceled:bool} (no `success`) — return as-is; callers
      // ignore the value (cancel is fire-and-forget, idempotent server-side).
      return res.data
    },
    async getBytes(path: string): Promise<ArrayBuffer> {
      // 走共享 axios(Authorization header + 401 单飞刷新)→ /v1/file(GetDownloadSingleFile,
      // http.ServeContent 出原始字节 + checkPathAccess 权限校验)。ServeContent 非标准信封,
      // 不能 unwrap;直接返回 res.data(ArrayBuffer)。真实路径进 param(下载/内容 API 铁律)。
      const res = await http.get('/file', { params: { path }, responseType: 'arraybuffer' })
      return res.data as ArrayBuffer
    },
    async getPreviewBytes(path: string): Promise<ArrayBuffer> {
      // 旧版 Office → 后端 LibreOffice 转 PDF(/v1/file/preview)。转换慢(~3s+),
      // 覆盖 axios 默认 60s 超时为 150s(后端 120s 超时 + 余量)。走拦截器 401 自愈。
      const res = await http.get('/file/preview', { params: { path }, responseType: 'arraybuffer', timeout: 150000 })
      return res.data as ArrayBuffer
    },
    fileUrl(path: string): string {
      const t = getToken()
      const tok = t ? `token=${encodeURIComponent(t)}&` : ''
      return `/v3/file?${tok}path=${encodeURIComponent(path)}`
    },
  }
}

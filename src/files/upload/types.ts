export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'conflict' | 'paused'

export interface UploadItem {
  id: string
  file: File | Blob | null
  fileName: string
  fileType: string
  size: number
  targetPath: string
  relativePath: string
  status: UploadStatus
  progress: number
  bytesSent: number
  speed: number
  tusUploadUrl: string | null
  retryCount: number
  error: string
  createdAt: number
  doneAt?: number
  batchId: string
  batchTotal: number
  conflictPolicy: '' | 'overwrite' | 'rename' | 'skip'
  thumbUrl?: string
}

export interface SelectedFile {
  file: File
  targetPath: string
  relativePath: string
}

export interface TusArgs {
  file: File | Blob
  fileName: string
  fileType: string
  targetPath: string
  relativePath: string
  batchId: string
  batchTotal: number
  resumed: boolean
  conflictPolicy: string
  resumeUrl?: string | null
  onProgress?: (sent: number, total: number) => void
  onUrlAvailable?: (url: string) => void
  onStart?: (handle: { abort: () => Promise<void>; pause: () => Promise<void> }) => void
}

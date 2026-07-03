export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'needs_file' | 'conflict'

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
  restored: boolean
  conflictPolicy: '' | 'overwrite' | 'rename' | 'skip'
  oversize: boolean
  thumbUrl?: string
}

export interface SelectedFile {
  file: File
  targetPath: string
  relativePath: string
}

// FileDigester:逐字移植 Vue2 Network.js(含 NaN 进度归一)。
import type { ReceivedFile } from './protocol'

export class FileDigester {
  private buffer: ArrayBuffer[] = []
  private bytesReceived = 0
  progress = 0

  constructor(
    private meta: { name: string; mime: string; size: number },
    private callback: (file: ReceivedFile) => void,
  ) {}

  unchunk(chunk: ArrayBuffer): void {
    this.buffer.push(chunk)
    this.bytesReceived += chunk.byteLength
    this.progress = this.bytesReceived / this.meta.size
    if (Number.isNaN(this.progress)) this.progress = 1
    if (this.bytesReceived < this.meta.size) return
    const mime = this.meta.mime || 'application/octet-stream'
    const blob = new Blob(this.buffer, { type: mime })
    this.callback({ name: this.meta.name, mime, size: this.meta.size, blob })
  }
}

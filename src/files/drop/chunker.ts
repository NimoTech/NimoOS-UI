// FileChunker:逐字移植 Vue2 Network.js(64KB 块 / 1MB 分区流控)。
// 不移植 repeatPartition(Vue2 死代码,内部调不存在的 _nextPartition)。
import { CHUNK_SIZE, MAX_PARTITION_SIZE } from './protocol'

export class FileChunker {
  private offset = 0
  private partitionSize = 0
  private reader = new FileReader()

  constructor(
    private file: File,
    private onChunk: (chunk: ArrayBuffer) => void,
    private onPartitionEnd: (offset: number) => void,
  ) {
    this.reader.addEventListener('load', (e) =>
      this.onChunkRead((e.target as FileReader).result as ArrayBuffer),
    )
  }

  nextPartition(): void {
    this.partitionSize = 0
    this.readChunk()
  }

  private readChunk(): void {
    const chunk = this.file.slice(this.offset, this.offset + CHUNK_SIZE)
    this.reader.readAsArrayBuffer(chunk)
  }

  private onChunkRead(chunk: ArrayBuffer): void {
    this.offset += chunk.byteLength
    this.partitionSize += chunk.byteLength
    this.onChunk(chunk)
    if (this.isPartitionEnd() || this.isFileEnd()) {
      this.onPartitionEnd(this.offset)
      return
    }
    this.readChunk()
  }

  private isPartitionEnd(): boolean {
    return this.partitionSize >= MAX_PARTITION_SIZE
  }

  isFileEnd(): boolean {
    return this.offset >= this.file.size
  }
}

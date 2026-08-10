// FileChunker: the read/emit loop (64 KB chunks, 1 MB partition flow control) is
// a faithful port of Vue2 Network.js -- those numbers are wire-visible, do not
// change them. Two deliberate divergences: Vue2's repeatPartition is not ported
// (dead code there; it called a non-existent _nextPartition), and abort() is new
// -- the FileReader's load callback closes over this chunker, so a cancelled or
// broken transfer needs a way to stop the loop that dropping the reference alone
// does not provide.
import { CHUNK_SIZE, MAX_PARTITION_SIZE } from './protocol'

export class FileChunker {
  private offset = 0
  private partitionSize = 0
  private reader = new FileReader()
  private aborted = false

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

  /** Stops the read loop. The FileReader's load callback holds its own
   *  reference to this chunker, so nulling the caller's handle is not enough
   *  to stop bytes from flowing. */
  abort(): void {
    this.aborted = true
    try { this.reader.abort() } catch { /* reader may already be idle */ }
  }

  private readChunk(): void {
    const chunk = this.file.slice(this.offset, this.offset + CHUNK_SIZE)
    this.reader.readAsArrayBuffer(chunk)
  }

  private onChunkRead(chunk: ArrayBuffer): void {
    if (this.aborted) return
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

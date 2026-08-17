import { describe, it, expect, vi } from 'vitest'
import { FileChunker } from './chunker'

function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'a.bin', { type: 'application/octet-stream' })
}

describe('FileChunker', () => {
  it('file smaller than one partition: chunk out by 64KB, emit partitionEnd(offset=size) once at end of file', async () => {
    const chunks: number[] = []
    const partitions: number[] = []
    const c = new FileChunker(makeFile(100_000), (ch) => chunks.push(ch.byteLength), (o) => partitions.push(o))
    c.nextPartition()
    await vi.waitFor(() => expect(partitions).toEqual([100_000]))
    expect(chunks).toEqual([64000, 36000])
    expect(c.isFileEnd()).toBe(true)
  })
  it('across partitions: stop and wait at 1MB boundary for nextPartition, then continue to file end', async () => {
    const partitions: number[] = []
    const c = new FileChunker(makeFile(1_500_000), () => {}, (o) => partitions.push(o))
    c.nextPartition()
    await vi.waitFor(() => expect(partitions.length).toBe(1))
    expect(partitions[0]).toBeGreaterThanOrEqual(1_000_000) // 64KB granularity, first >= 1MB boundary
    expect(c.isFileEnd()).toBe(false)
    c.nextPartition()
    await vi.waitFor(() => expect(partitions.length).toBe(2))
    expect(partitions[1]).toBe(1_500_000)
    expect(c.isFileEnd()).toBe(true)
  })
  it('abort() called from inside onChunk stops the read loop, so no further chunks are delivered', async () => {
    const chunks: number[] = []
    let c!: FileChunker
    c = new FileChunker(
      makeFile(200_000),
      () => { chunks.push(chunks.length); c.abort() },
      () => {},
    )
    c.nextPartition()
    await vi.waitFor(() => expect(chunks.length).toBeGreaterThanOrEqual(1))
    // Give the reader loop a chance to keep going if abort() didn't actually stop it.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(chunks.length).toBe(1)
  })
})

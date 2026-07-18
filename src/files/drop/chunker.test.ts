import { describe, it, expect, vi } from 'vitest'
import { FileChunker } from './chunker'

function makeFile(size: number): File {
  return new File([new Uint8Array(size)], 'a.bin', { type: 'application/octet-stream' })
}

describe('FileChunker', () => {
  it('小于一个分区的文件:逐 64KB 出块,文件末尾发一次 partitionEnd(offset=size)', async () => {
    const chunks: number[] = []
    const partitions: number[] = []
    const c = new FileChunker(makeFile(100_000), (ch) => chunks.push(ch.byteLength), (o) => partitions.push(o))
    c.nextPartition()
    await vi.waitFor(() => expect(partitions).toEqual([100_000]))
    expect(chunks).toEqual([64000, 36000])
    expect(c.isFileEnd()).toBe(true)
  })
  it('跨分区:1MB 边界处停下等 nextPartition,再续到文件末尾', async () => {
    const partitions: number[] = []
    const c = new FileChunker(makeFile(1_500_000), () => {}, (o) => partitions.push(o))
    c.nextPartition()
    await vi.waitFor(() => expect(partitions.length).toBe(1))
    expect(partitions[0]).toBeGreaterThanOrEqual(1_000_000) // 64KB 粒度,首个 ≥1MB 边界
    expect(c.isFileEnd()).toBe(false)
    c.nextPartition()
    await vi.waitFor(() => expect(partitions.length).toBe(2))
    expect(partitions[1]).toBe(1_500_000)
    expect(c.isFileEnd()).toBe(true)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { Peer, type PeerEvents } from './rtcPeer'
import { encodeText } from './protocol'

// 测试用子类:捕获 sendRaw,免 WebRTC
class TestPeer extends Peer {
  out: (string | ArrayBuffer)[] = []
  protected sendRaw(d: string | ArrayBuffer) { this.out.push(d) }
}
function makeEvents(): PeerEvents {
  return { onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(), onTransferComplete: vi.fn() }
}
const jsonOut = (p: TestPeer) => p.out.filter((x): x is string => typeof x === 'string').map((s) => JSON.parse(s))

describe('Peer 传输状态机(wire 形状=Vue2)', () => {
  it('sendFiles 先发 header{name,mime,size,from},分区末发 partition;收 partition-received 续下一分区', async () => {
    const p = new TestPeer({ send: vi.fn() }, 'peer2', makeEvents())
    const file = new File([new Uint8Array(70000)], 'a.bin', { type: 'application/x-test' })
    p.sendFiles([file], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
    const header = jsonOut(p).find((m) => m.type === 'header')
    expect(header).toEqual({ type: 'header', name: 'a.bin', mime: 'application/x-test', size: 70000, from: 'self1' })
    expect(p.out.filter((x) => typeof x !== 'string').length).toBe(2) // 64000+6000 两块
  })
  it('接收:header→二进制块→组装回调 onFileReceived + 回发 transfer-complete;进度按 ≥1% 阈值回发', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'b.bin', mime: '', size: 8, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).toHaveBeenCalledOnce()
    const received = (ev.onFileReceived as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(received.from).toBe('peer2')
    expect(received.file.blob.size).toBe(8)
    expect(jsonOut(p).some((m) => m.type === 'transfer-complete')).toBe(true)
    expect(ev.onFileProgress).toHaveBeenCalled() // 接收侧进度上报给 UI
  })
  it('收 transfer-complete:busy 复位、出队下一个、onTransferComplete', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const f = (n: string) => new File([new Uint8Array(10)], n)
    p.sendFiles([f('1'), f('2')], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))
    p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))
    expect(ev.onTransferComplete).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(2)) // 第二个文件开始
  })
  it('sendText base64;收 text 解码回调', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.sendText('2')
    expect(jsonOut(p)).toContainEqual({ type: 'text', text: encodeText('2') })
    p.handleChannelMessage(JSON.stringify({ type: 'text', text: encodeText('中文') }))
    expect(ev.onTextReceived).toHaveBeenCalledWith({ text: '中文', sender: 'peer2' })
  })
})

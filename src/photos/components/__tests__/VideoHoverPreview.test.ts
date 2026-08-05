import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoHoverPreview from '../VideoHoverPreview.vue'

// jsdom 的 HTMLMediaElement.play/pause/load 都是"抛同步异常"的 not-implemented 桩
// （不是像浏览器那样返回被拒绝的 Promise），组件里 `v.play().catch(...)` 若不 mock
// 会在测试里直接抛出未捕获异常。fastSeek 在 jsdom 里根本不存在（typeof undefined），
// 这恰好符合验证 currentTime 兜底分支所需的默认环境。
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLMediaElement.prototype.pause = vi.fn()
  HTMLMediaElement.prototype.load = vi.fn()
})

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    visible: true,
    spriteUrl: 'https://x/sprite.jpg',
    frameCount: 10,
    frameW: 240,
    frameH: 135,
    currentFrame: 0,
    durationMs: 10000,
    videoSrc: 'https://x/video.mp4',
    scrubRatio: -1,
    ...overrides,
  }
}

// canplay 场景下 video.duration 是 jsdom 的只读 getter(默认 NaN)，测试里用
// Object.defineProperty 逐实例打桩，与仓库里 ImageViewer.test.ts 覆盖
// offsetWidth/offsetHeight 的手法同源。
function stubDuration(video: HTMLVideoElement, seconds: number) {
  Object.defineProperty(video, 'duration', { value: seconds, configurable: true })
}

describe('VideoHoverPreview', () => {
  it('visible=false 时整个覆盖层不渲染', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ visible: false }) })
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('spriteUrl 为空(未就绪)时不渲染 sprite-window/video 占位——底层缩略图透出', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ spriteUrl: '' }) })
    expect(w.find('[data-test="overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="sprite-window"]').exists()).toBe(false)
    expect(w.find('video').exists()).toBe(false)
  })

  it('sprite-window 宽高由 frameW/frameH 换算(contain 居中，横屏铺满宽)', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ frameW: 200, frameH: 100 }) })
    const style = w.get('[data-test="sprite-window"]').attributes('style')
    expect(style).toContain('width: 100%')
    expect(style).toContain('height: 50%')
  })

  it('sprite-strip 的 translateX 随 frameCount/currentFrame 正确换算', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ frameCount: 10, currentFrame: 3 }) })
    const style = w.get('.sprite-strip').attributes('style')
    expect(style).toContain('width: 1000%')
    expect(style).toContain('translateX(-30%)')
  })

  it('currentFrame 变化时 strip translateX 同步更新', async () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ frameCount: 10, currentFrame: 0 }) })
    await w.setProps({ currentFrame: 5 })
    expect(w.get('.sprite-strip').attributes('style')).toContain('translateX(-50%)')
  })

  describe('video 接管态 v-if 切换', () => {
    it('挂载初始:videoSrc 存在则渲染 video,但未 canplay 前不带 on class(未接管)', () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video')
      expect(video.classes()).not.toContain('on')
    })

    it('videoSrc 为空:不渲染 video 元素', () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ videoSrc: '' }) })
      expect(w.find('video').exists()).toBe(false)
    })

    it('canplay 后接管:video 带 on class 且 muted=true', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(w.get('video').classes()).toContain('on')
      expect(video.muted).toBe(true)
    })

    it('canplay 后首次就绪(未曾拖动过,scrubRatio=-1)立即调用 play,不等待', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(video.play).toHaveBeenCalledTimes(1)
    })

    it('视频错误后 videoFailed=true,video 因 v-if 从 DOM 移除(降级回 sprite)', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      await video.dispatchEvent(new Event('error'))
      expect(w.find('video').exists()).toBe(false)
    })
  })

  describe('scrubRatio watcher → seek', () => {
    it('videoReady 前 scrubRatio 变化不触发任何 seek(fastSeek/currentTime 均未调用)', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      const fastSeek = vi.fn()
      ;(video as unknown as { fastSeek: typeof fastSeek }).fastSeek = fastSeek
      await w.setProps({ scrubRatio: 0.5 })
      expect(fastSeek).not.toHaveBeenCalled()
    })

    it('videoReady 后 scrubRatio 变化:优先调用 fastSeek(裁到 0.999 防溢出), 并先 pause', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10) // 10s
      await video.dispatchEvent(new Event('canplay'))
      const fastSeek = vi.fn()
      ;(video as unknown as { fastSeek: typeof fastSeek }).fastSeek = fastSeek

      await w.setProps({ scrubRatio: 0.5 })
      expect(video.pause).toHaveBeenCalled()
      expect(fastSeek).toHaveBeenCalledWith(5) // 0.5 * 10s = 5s

      await w.setProps({ scrubRatio: 2 }) // 超界 ratio 裁到 0.999
      expect(fastSeek).toHaveBeenLastCalledWith(9.99)
    })

    it('fastSeek 不可用时退回 currentTime 赋值', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay')) // fastSeek 在 jsdom 里本就不存在
      await w.setProps({ scrubRatio: 0.25 })
      expect(video.currentTime).toBe(2.5)
    })

    it('拖动就绪前已拖过(canplay 时 scrubRatio>=0):补种一次 seek 而非从 0 秒起播', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: 0.4 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(video.currentTime).toBe(4)
      // 补种 seek 语义上等价于"刚拖完一次"——不立即 play,走 300ms 停顿续播闸。
      expect(video.play).not.toHaveBeenCalled()
    })
  })

  describe('scrub 停顿 300ms 续播', () => {
    beforeEach(() => vi.useFakeTimers())

    it('scrubRatio 变化后 300ms 无再拖动才续播;期间再拖动会重新计时', async () => {
      vi.useRealTimers() // canplay/setProps 走真实微任务更省心，计时器部分单独切 fake
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(video.play).toHaveBeenCalledTimes(1) // 首次就绪立即播放

      vi.useFakeTimers()
      await w.setProps({ scrubRatio: 0.2 })
      vi.advanceTimersByTime(200)
      expect(video.play).toHaveBeenCalledTimes(1) // 尚未到 300ms，未续播

      await w.setProps({ scrubRatio: 0.3 }) // 期间再拖动，重新计时
      vi.advanceTimersByTime(200)
      expect(video.play).toHaveBeenCalledTimes(1) // 累计 400ms 但因重新计时仍未到

      vi.advanceTimersByTime(100) // 补满第二次计时的 300ms
      expect(video.play).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })
  })

  describe('组件卸载清理', () => {
    it('卸载时 pause 视频并清空 src(中止在途下载)', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      w.unmount()
      expect(video.pause).toHaveBeenCalled()
      expect(video.load).toHaveBeenCalled()
      expect(video.getAttribute('src')).toBeNull()
    })
  })

  describe('进度/文案(未接管态走 sprite 帧算法)', () => {
    it('未接管:currentLabel 按 currentFrame/frameCount*durationMs 换算,bar-fill 按 currentFrame/(frameCount-1)', () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ frameCount: 10, currentFrame: 5, durationMs: 20000 }) })
      expect(w.get('[data-test="time-label"]').text()).toBe('0:10') // 5/10 * 20000ms = 10000ms
      expect(w.get('[data-test="bar-fill"]').attributes('style')).toContain('55.55555555555556%')
    })
  })
})

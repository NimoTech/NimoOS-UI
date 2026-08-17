import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoHoverPreview from '../VideoHoverPreview.vue'

// jsdom's HTMLMediaElement.play/pause/load are all "throw synchronous exception" not-implemented stubs
// (not like browser returning rejected Promise), component's `v.play().catch(...)` without mock
// throws uncaught exception in tests. fastSeek doesn't exist in jsdom at all(typeof undefined),
// this exactly fits the default environment needed to verify currentTime fallback branch.
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

// Under canplay scenario video.duration is jsdom's read-only getter(default NaN), in tests use
// Object.defineProperty to stub per instance, same technique as ImageViewer.test.ts covering
// offsetWidth/offsetHeight in this repo.
function stubDuration(video: HTMLVideoElement, seconds: number) {
  Object.defineProperty(video, 'duration', { value: seconds, configurable: true })
}

describe('VideoHoverPreview', () => {
  it('When visible=false, entire overlay doesn\'t render', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ visible: false }) })
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('When spriteUrl is empty(not ready), sprite-window/video placeholder doesn\'t render—underlying thumbnail shows', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ spriteUrl: '' }) })
    expect(w.find('[data-test="overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="sprite-window"]').exists()).toBe(false)
    expect(w.find('video').exists()).toBe(false)
  })

  it('sprite-window width/height calculated from frameW/frameH(contain centered, landscape fills width)', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ frameW: 200, frameH: 100 }) })
    const style = w.get('[data-test="sprite-window"]').attributes('style')
    expect(style).toContain('width: 100%')
    expect(style).toContain('height: 50%')
  })

  it('sprite-strip translateX calculated correctly from frameCount/currentFrame', () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ frameCount: 10, currentFrame: 3 }) })
    const style = w.get('.sprite-strip').attributes('style')
    expect(style).toContain('width: 1000%')
    expect(style).toContain('translateX(-30%)')
  })

  it('When currentFrame changes, strip translateX updates in sync', async () => {
    const w = mount(VideoHoverPreview, { props: baseProps({ frameCount: 10, currentFrame: 0 }) })
    await w.setProps({ currentFrame: 5 })
    expect(w.get('.sprite-strip').attributes('style')).toContain('translateX(-50%)')
  })

  describe('video takeover state v-if toggle', () => {
    it('Initial mount: if videoSrc exists render video, but before canplay no on class(not taken over)', () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video')
      expect(video.classes()).not.toContain('on')
    })

    it('When videoSrc is empty: video element doesn\'t render', () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ videoSrc: '' }) })
      expect(w.find('video').exists()).toBe(false)
    })

    it('After canplay takeover: video has on class and muted=true', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(w.get('video').classes()).toContain('on')
      expect(video.muted).toBe(true)
    })

    it('After canplay first ready(never scrubbed, scrubRatio=-1) immediately calls play, doesn\'t wait', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(video.play).toHaveBeenCalledTimes(1)
    })

    it('After video error videoFailed=true, video removed from DOM by v-if(degrades to sprite)', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps() })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      await video.dispatchEvent(new Event('error'))
      expect(w.find('video').exists()).toBe(false)
    })
  })

  describe('scrubRatio watcher → seek', () => {
    it('Before videoReady, scrubRatio change doesn\'t trigger any seek(fastSeek/currentTime both not called)', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      const fastSeek = vi.fn()
      ;(video as unknown as { fastSeek: typeof fastSeek }).fastSeek = fastSeek
      await w.setProps({ scrubRatio: 0.5 })
      expect(fastSeek).not.toHaveBeenCalled()
    })

    it('After videoReady, scrubRatio change: prefer fastSeek(clamped to 0.999 to prevent overflow), pause first', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10) // 10 seconds
      await video.dispatchEvent(new Event('canplay'))
      const fastSeek = vi.fn()
      ;(video as unknown as { fastSeek: typeof fastSeek }).fastSeek = fastSeek

      await w.setProps({ scrubRatio: 0.5 })
      expect(video.pause).toHaveBeenCalled()
      expect(fastSeek).toHaveBeenCalledWith(5) // 0.5 * 10s = 5s

      await w.setProps({ scrubRatio: 2 }) // Out-of-bounds ratio clamped to 0.999
      expect(fastSeek).toHaveBeenLastCalledWith(9.99)
    })

    it('When fastSeek unavailable, fall back to currentTime assignment', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay')) // fastSeek doesn't exist in jsdom to begin with
      await w.setProps({ scrubRatio: 0.25 })
      expect(video.currentTime).toBe(2.5)
    })

    it('Already scrubbed before ready(scrubRatio>=0 at canplay): reseed seek once, not start from 0s', async () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: 0.4 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(video.currentTime).toBe(4)
      // Reseeded seek semantically equals 'just finished scrubbing once'—doesn't play immediately, goes through 300ms pause-resume gate.
      expect(video.play).not.toHaveBeenCalled()
    })
  })

  describe('Scrub pause 300ms resume', () => {
    beforeEach(() => vi.useFakeTimers())

    it('After scrubRatio change, resume only if no more scrubbing for 300ms; scrubbing again resets timer', async () => {
      vi.useRealTimers() // canplay/setProps prefer real microtasks, only fake the timer part
      const w = mount(VideoHoverPreview, { props: baseProps({ scrubRatio: -1 }) })
      const video = w.get('video').element as HTMLVideoElement
      stubDuration(video, 10)
      await video.dispatchEvent(new Event('canplay'))
      expect(video.play).toHaveBeenCalledTimes(1) // First ready play immediately

      vi.useFakeTimers()
      await w.setProps({ scrubRatio: 0.2 })
      vi.advanceTimersByTime(200)
      expect(video.play).toHaveBeenCalledTimes(1) // Not yet 300ms, hasn't resumed

      await w.setProps({ scrubRatio: 0.3 }) // Scrub again in between, reset timer
      vi.advanceTimersByTime(200)
      expect(video.play).toHaveBeenCalledTimes(1) // Total 400ms but reset timer still not reached

      vi.advanceTimersByTime(100) // Complete second timer's 300ms
      expect(video.play).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })
  })

  describe('Component unmount cleanup', () => {
    it('On unmount, pause video and clear src(abort in-progress download)', async () => {
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

  describe('Progress/text(non-takeover state uses sprite frame algorithm)', () => {
    it('Not taken over: currentLabel calculated from currentFrame/frameCount*durationMs, bar-fill from currentFrame/(frameCount-1)', () => {
      const w = mount(VideoHoverPreview, { props: baseProps({ frameCount: 10, currentFrame: 5, durationMs: 20000 }) })
      expect(w.get('[data-test="time-label"]').text()).toBe('0:10') // 5/10 * 20000ms = 10000ms
      expect(w.get('[data-test="bar-fill"]').attributes('style')).toContain('55.55555555555556%')
    })
  })
})

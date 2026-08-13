import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import AvatarCropper from './AvatarCropper.vue'

const saveAvatar = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: { saveAvatar: (...a: unknown[]) => saveAvatar(...a) } },
}))

// cropper is a canvas library; real rendering can't run in jsdom — stub the components only, keeping their props and change contract.
vi.mock('vue-advanced-cropper', () => ({
  Cropper: {
    name: 'Cropper',
    props: ['src', 'stencilProps', 'canvas', 'defaultSize', 'minWidth', 'minHeight', 'debounce', 'checkOrientation'],
    emits: ['change'],
    template: '<div data-test="cropper-stub" :data-src="src"></div>',
  },
  Preview: {
    name: 'Preview',
    props: ['width', 'height', 'image', 'coordinates'],
    template: '<div data-test="preview-stub"></div>',
  },
}))
vi.mock('vue-advanced-cropper/dist/style.css', () => ({}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// ⚠️ Use braces; do not write `beforeEach(() => mock.mockReset().mockResolvedValue(x))` —
// that chained form returns the mock to vitest as a teardown callback, which gets called
// again after the test; the rejected promise from a throwing implementation is never
// awaited → reported as Unknown Error (ChangePasswordForm hit this in this sprint).
beforeEach(() => {
  saveAvatar.mockReset()
  saveAvatar.mockResolvedValue(undefined)
})

function mountCropper(src = 'blob:x') {
  return mount(AvatarCropper, { props: { src }, global: { plugins: [i18n] } })
}
type Exposed = { submit(): Promise<boolean> }
const submitOf = (w: ReturnType<typeof mountCropper>) => (w.vm as unknown as Exposed).submit()

function emitChange(w: ReturnType<typeof mountCropper>, toDataURL = () => 'data:image/png;base64,PNGDATA') {
  const canvas = { toDataURL: vi.fn(toDataURL) }
  w.findComponent({ name: 'Cropper' }).vm.$emit('change', { coordinates: { left: 0 }, image: {}, canvas })
  return canvas
}

describe('AvatarCropper —— 对位 Vue2 state 4(:746-760)+ saveAvatar(:442-462)', () => {
  it('把 src 透给 Cropper,并渲染右侧圆形预览与「预览」字样', () => {
    const w = mountCropper('blob:abc')
    expect(w.find('[data-test="cropper-stub"]').attributes('data-src')).toBe('blob:abc')
    expect(w.find('[data-test="preview-stub"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsAccPreview)
  })

  it('stencil 是 1:1 方形、canvas 输出 160×160、最小 80×80(Vue2 props 逐字)', () => {
    const c = mountCropper().findComponent({ name: 'Cropper' })
    expect(c.props('stencilProps')).toEqual({ aspectRatio: 1 })
    expect(c.props('canvas')).toEqual({ height: 160, width: 160 })
    expect(c.props('minWidth')).toBe(80)
    expect(c.props('minHeight')).toBe(80)
    expect(c.props('debounce')).toBe(false)
  })

  it('defaultSize 优先可见区域,没有则用整图尺寸(Vue2 :383-388)', () => {
    const c = mountCropper().findComponent({ name: 'Cropper' })
    const fn = c.props('defaultSize') as (a: unknown) => unknown
    expect(fn({ imageSize: { width: 10, height: 20 }, visibleArea: { width: 3, height: 4 } })).toEqual({ width: 3, height: 4 })
    expect(fn({ imageSize: { width: 10, height: 20 } })).toEqual({ width: 10, height: 20 })
  })

  it('还没 change 过(无 canvas)时 submit 直接失败,不发请求', async () => {
    const w = mountCropper()
    expect(await submitOf(w)).toBe(false)
    expect(saveAvatar).not.toHaveBeenCalled()
  })

  it('change 后 submit 上传 canvas.toDataURL() 的 PNG dataURL', async () => {
    const w = mountCropper()
    const canvas = emitChange(w)
    await w.vm.$nextTick()
    expect(await submitOf(w)).toBe(true)
    // The backend only strips `data:image/png;base64,` — toDataURL must take no args (defaults to PNG)
    expect(canvas.toDataURL).toHaveBeenCalledWith()
    expect(saveAvatar).toHaveBeenCalledWith('data:image/png;base64,PNGDATA')
  })

  it('上传失败返回 false,并把错误内联显示(C6,不用 toast)', async () => {
    saveAvatar.mockImplementation(async () => {
      throw Object.assign(new Error('req failed'), { response: { data: { message: '写盘失败' } } })
    })
    const w = mountCropper()
    emitChange(w)
    await w.vm.$nextTick()
    expect(await submitOf(w)).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-crop-error"]').text()).toBe('写盘失败')
  })

  it('后端没给 message 时回退成 axios 的 message', async () => {
    saveAvatar.mockImplementation(async () => { throw new Error('Network Error') })
    const w = mountCropper()
    emitChange(w)
    await w.vm.$nextTick()
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-crop-error"]').text()).toBe('Network Error')
  })

  it('上传在途时不许再次提交', async () => {
    let resolve!: () => void
    saveAvatar.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const w = mountCropper()
    emitChange(w)
    await w.vm.$nextTick()
    const p = submitOf(w)
    expect(await submitOf(w)).toBe(false)
    expect(saveAvatar).toHaveBeenCalledTimes(1)
    resolve()
    await p
  })

  it('重新提交会清掉上一次的错误提示', async () => {
    saveAvatar.mockImplementationOnce(async () => { throw new Error('X') })
    const w = mountCropper()
    emitChange(w)
    await w.vm.$nextTick()
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-crop-error"]').exists()).toBe(true)
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-crop-error"]').exists()).toBe(false)
  })
})

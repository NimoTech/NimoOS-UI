import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useTimelineStore } from '../../stores/timeline'
import NimoTaskBar from './NimoTaskBar.vue'

describe('NimoTaskBar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders nothing when there are no tasks', () => {
    const wrapper = mount(NimoTaskBar, { props: { expanded: false } })
    expect(wrapper.find('.nimo-tb').exists()).toBe(false)
  })

  it('collapsed strip shows the task count label', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'index', status: 'running', current: 3, total: 10 }] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: false } })
    expect(wrapper.find('.nimo-tb-label').text()).toBe('1 个后台任务')
  })

  it('clicking the top row emits update:expanded toggled', async () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'index', status: 'running', current: 1, total: 2 }] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: false } })
    await wrapper.find('.nimo-tb-top').trigger('click')
    expect(wrapper.emitted('update:expanded')).toEqual([[true]])
  })

  it('only non-done tasks count toward a group\'s progress', () => {
    const tl = useTimelineStore()
    tl.tasks = [
      { id: 1, type: 'index', status: 'done', current: 10, total: 10 },
      { id: 2, type: 'index', status: 'running', current: 2, total: 10 },
    ] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    expect(wrapper.find('.nimo-tb-type-pct').text()).toContain('20%')
  })

  it('a fully-done group shows 100% with no count', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'ocr', status: 'done', current: 5, total: 5 }] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    const pct = wrapper.find('.nimo-tb-type-pct')
    expect(pct.text()).toContain('100%')
    expect(pct.find('.nimo-tb-type-count').exists()).toBe(false)
  })

  it('groups are ordered index -> embedding -> ocr -> face -> rebuild -> aesthetic, unknown last', () => {
    const tl = useTimelineStore()
    tl.tasks = [
      { id: 1, type: 'weird', status: 'running', current: 1, total: 2 },
      { id: 2, type: 'face', status: 'running', current: 1, total: 2 },
      { id: 3, type: 'index', status: 'running', current: 1, total: 2 },
    ] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    const labels = wrapper.findAll('.nimo-tb-type-label').map((n) => n.text())
    expect(labels).toEqual(['索引照片', '识别人物', 'weird'])
  })

  it('a task with .error shows the "Failed" pct label and the error-detail line', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'face', status: 'error', error: 'boom', current: 0, total: 0 }] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    expect(wrapper.find('.nimo-tb-type-pct').text()).toContain('已失败')
    expect(wrapper.find('.nimo-tb-error-detail').text()).toBe('boom')
  })

  it('errorKey/errorParams renders through i18n in preference to the raw error string', () => {
    const tl = useTimelineStore()
    tl.tasks = [{ id: 1, type: 'face', status: 'error', error: 'raw', errorKey: 'photosTaskFailed', current: 0, total: 0 }] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    expect(wrapper.find('.nimo-tb-error-detail').text()).toBe('已失败')
  })

  it('picks the error-detail line by raw array order, not by group sort order', () => {
    // Vue2 NimoTaskBar.vue:52 is a flat `this.tasks.find(t => t.error)` scan over the raw
    // list -- 'ocr' (TYPE_META order 3) appears first in the array here, while 'index'
    // (order 1) appears second and would sort first among taskGroups. The displayed detail
    // must follow array order (ocr), not group sort order (index).
    const tl = useTimelineStore()
    tl.tasks = [
      { id: 1, type: 'ocr', status: 'error', error: 'ocr-error', current: 0, total: 0 },
      { id: 2, type: 'index', status: 'error', error: 'index-error', current: 0, total: 0 },
    ] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    expect(wrapper.find('.nimo-tb-error-detail').text()).toBe('ocr-error')
  })

  it('sums current/total across all running tasks in a group unconditionally, including total=0 tasks', () => {
    // Vue2 NimoTaskBar.vue:88-91: runCur/runTot accumulate every running task in the group
    // regardless of whether that individual task reports a total, so a total=0 task still
    // contributes (0 current, 0 total) to the sum rather than being shunted into a separate
    // progress-average path. Here one running task has a real total (2/10) and a second
    // running task of the same type has total=0 -- expected sum is current=2, total=10 (the
    // total=0 task adds nothing to either side), so pct is 2/10 = 20%, not an average.
    const tl = useTimelineStore()
    tl.tasks = [
      { id: 1, type: 'face', status: 'running', current: 2, total: 10 },
      { id: 2, type: 'face', status: 'running', current: 0, total: 0, progress: 0.5 },
    ] as any
    const wrapper = mount(NimoTaskBar, { props: { expanded: true } })
    const pct = wrapper.find('.nimo-tb-type-pct')
    expect(pct.text()).toContain('20%')
    expect(pct.text()).toContain('2/10')
  })
})

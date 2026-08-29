// SP8-P1b Task 8 — Block renderer batch A smoke tests: 17 ported renderers
// (includes 4 confirmation cards + MaxTurnsCard store interaction) + full BLOCK_MAP dispatch.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import { useAgentStore } from '../../stores/agentStore'
import BlockRenderer from './BlockRenderer.vue'
import ActionsRow from './ActionsRow.vue'
import McpWarningCard from './McpWarningCard.vue'
import StorageCard from './StorageCard.vue'
import SearchResultsCard from './SearchResultsCard.vue'
import ProgressCard from './ProgressCard.vue'
import VideoCard from './VideoCard.vue'
import FileListCard from './FileListCard.vue'
import ThinkingBlock from './ThinkingBlock.vue'
import MaxTurnsCard from './MaxTurnsCard.vue'
import ImageGridCard from './ImageGridCard.vue'
import ToolCard from './ToolCard.vue'
import ConfirmCard from './ConfirmCard.vue'
import PermissionRequestCard from './PermissionRequestCard.vue'
import McpCallCard from './McpCallCard.vue'
import McpPermissionCard from './McpPermissionCard.vue'
import McpInstallCard from './McpInstallCard.vue'
import PhotoGridCard from './PhotoGridCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const globalOpts = { plugins: [i18n] }

describe('BlockRenderer — full BLOCK_MAP dispatch', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('mapped types (e.g. tool/thinking) dispatch to actual renderers, no longer degrade to chip', () => {
    const w1 = mount(BlockRenderer, { props: { block: { type: 'tool', name: 'x' } } }, )
    expect(w1.find('.block-chip').exists()).toBe(false)
    expect(w1.find('.tool-card').exists()).toBe(true)

    const w2 = mount(BlockRenderer, { props: { block: { type: 'thinking', text: 'hi' } } })
    expect(w2.find('.block-chip').exists()).toBe(false)
    expect(w2.find('.thinking').exists()).toBe(true)
  })

  it('unmapped types still degrade to gray chip', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'still_unmapped' } } })
    expect(w.find('.block-chip').text()).toBe('[still_unmapped]')
  })

  it('mcp_elicit_form dispatches to McpElicitFormCard (not gray chip, form card not URL card)', () => {
    const w = mount(BlockRenderer, {
      props: { block: { type: 'mcp_elicit_form', confirmId: 'c1', fields: [] } },
      global: globalOpts,
    })
    expect(w.find('.block-chip').exists()).toBe(false)
    // .mcc-perm is the root class shared by both cards, not sufficient to distinguish which one.
    // Use card-specific structure: form card has .mcc-fields / <form>, URL card does not.
    expect(w.find('.mcc-fields').exists()).toBe(true)
    expect(w.find('form').exists()).toBe(true)
    expect(w.find('.mcc-url').exists()).toBe(false)
  })

  it('mcp_elicit_url dispatches to McpElicitUrlCard (not gray chip, URL card not form card)', () => {
    const w = mount(BlockRenderer, {
      props: { block: { type: 'mcp_elicit_url', confirmId: 'c2', url: 'https://x.example' } },
      global: globalOpts,
    })
    expect(w.find('.block-chip').exists()).toBe(false)
    // Same as above: use URL card-specific .mcc-url structure to distinguish, not the shared .mcc-perm root class.
    expect(w.find('.mcc-url').exists()).toBe(true)
    expect(w.find('.mcc-fields').exists()).toBe(false)
    expect(w.find('form').exists()).toBe(false)
  })
})

describe('ActionsRow', () => {
  it('render items list, each item displays label', () => {
    const w = mount(ActionsRow, { props: { items: [{ label: 'Do it', icon: 'check', primary: true }] } })
    expect(w.text()).toContain('Do it')
    expect(w.findAll('button').length).toBe(1)
  })
})

describe('McpWarningCard', () => {
  it('display server/error interpolated text', () => {
    const w = mount(McpWarningCard, { props: { server: 'my-mcp', error: 'timeout' }, global: globalOpts })
    expect(w.text()).toContain('my-mcp')
    expect(w.text()).toContain('timeout')
  })
})

describe('StorageCard', () => {
  it('render used/total and category breakdown', () => {
    const w = mount(StorageCard, {
      props: { used: 2.5, total: 10, label: 'NIMO HOME', breakdown: [{ name: 'Photos', value: 1.2, color: '#000' }] },
    })
    expect(w.text()).toContain('2.5 TB')
    expect(w.text()).toContain('Photos')
  })
})

describe('SearchResultsCard', () => {
  it('render query/kind and result entries', () => {
    const w = mount(SearchResultsCard, {
      props: { query: 'invoice', kind: 'Files', results: [{ title: 'a.pdf', snippet: 'snip', path: '/a.pdf', score: 0.8 }] },
    })
    expect(w.text()).toContain('invoice')
    expect(w.text()).toContain('a.pdf')
    expect(w.text()).toContain('match 80%')
  })
})

describe('ProgressCard', () => {
  it('render title and completion count', () => {
    const w = mount(ProgressCard, {
      props: { title: 'Uploading', items: [{ name: 'f1', pct: 100 }, { name: 'f2', pct: 40 }] },
    })
    expect(w.text()).toContain('Uploading')
    expect(w.text()).toContain('1 of 2 complete')
  })
})

describe('VideoCard', () => {
  it('render title/duration', () => {
    const w = mount(VideoCard, { props: { title: 'Clip', duration: '01:30', seed: 2 } })
    expect(w.text()).toContain('Clip')
    expect(w.text()).toContain('01:30')
  })
})

describe('FileListCard', () => {
  it('render title and file entries', () => {
    const w = mount(FileListCard, {
      props: { title: 'Results', files: [{ name: 'a.txt', path: '/a.txt', size: '1KB', kind: 'txt' }] },
    })
    expect(w.text()).toContain('Results')
    expect(w.text()).toContain('a.txt')
  })
})

describe('ThinkingBlock', () => {
  it('show Thinking + content always expanded when streaming', () => {
    const w = mount(ThinkingBlock, { props: { text: 'reasoning...', streaming: true } })
    expect(w.text()).toContain('Thinking')
    expect(w.find('.thinking-content').exists()).toBe(true)
  })

  it('when not streaming, default collapsed, click to expand and show text', async () => {
    const w = mount(ThinkingBlock, { props: { text: 'reasoning...', streaming: false } })
    expect(w.find('.thinking-content').exists()).toBe(false)
    await w.find('.thinking').trigger('click')
    expect(w.find('.thinking-content').exists()).toBe(true)
    expect(w.text()).toContain('reasoning...')
  })
})

describe('ImageGridCard', () => {
  it('render title and image grid count', () => {
    const w = mount(ImageGridCard, {
      props: { title: 'Sunsets', images: [{ seed: 1 }, { seed: 2 }], count: 12 },
    })
    expect(w.text()).toContain('Sunsets')
    expect(w.text()).toContain('Showing 2 of 12 matches')
  })
})

describe('ToolCard', () => {
  it('render tool name, click to expand and show sections', async () => {
    const w = mount(ToolCard, {
      props: { name: 'read_file', state: 'success', sections: [{ label: 'OUTPUT', code: 'hello' }] },
    })
    expect(w.text()).toContain('read_file')
    expect(w.find('.tool-body').exists()).toBe(false)
    await w.find('.tool-head').trigger('click')
    expect(w.find('.tool-body').exists()).toBe(true)
    expect(w.text()).toContain('hello')
  })
})

// ---- Confirm-style cards: mounted against the real 'general' agentStore
// (useProvidedAgentStore falls back to it when nothing is provided), with
// confirmAgentAction/continueRun spied so no network call actually happens. ----

describe('ConfirmCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('clicking Accept calls store.confirmAgentAction(confirmId, true)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(ConfirmCard, {
      props: { confirmId: 'c1', action: 'rm -rf', description: 'delete stuff' },
      global: globalOpts,
    })
    expect(w.text()).toContain('delete stuff')
    const buttons = w.findAll('button')
    await buttons[0].trigger('click')
    expect(spy).toHaveBeenCalledWith('c1', true)
  })

  it('clicking Deny calls store.confirmAgentAction(confirmId, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(ConfirmCard, { props: { confirmId: 'c1', description: 'x' }, global: globalOpts })
    await w.findAll('button')[1].trigger('click')
    expect(spy).toHaveBeenCalledWith('c1', false)
  })

  it('a 409 collapses the whole card to a single line, with no buttons left', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'confirmAgentAction')
      .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mount(ConfirmCard, { props: { confirmId: 'c1', description: 'x' }, global: globalOpts })
    await w.findAll('button')[0].trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('a 500 leaves the buttons in place, so the user can retry', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'confirmAgentAction')
      .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }))
    const w = mount(ConfirmCard, { props: { confirmId: 'c1', description: 'x' }, global: globalOpts })
    await w.findAll('button')[0].trigger('click')
    await flushPromises()
    expect(w.findAll('button')).toHaveLength(2)
  })
})

describe('PermissionRequestCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('clicking Allow calls store.confirmAgentAction(confirmId, true)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(PermissionRequestCard, {
      props: { confirmId: 'c2', path: '/DATA/x', kind: 'folder' },
      global: globalOpts,
    })
    await w.findAll('button')[0].trigger('click')
    expect(spy).toHaveBeenCalledWith('c2', true)
  })

  it('clicking Deny calls store.confirmAgentAction(confirmId, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(PermissionRequestCard, { props: { confirmId: 'c2', path: '/DATA/x' }, global: globalOpts })
    await w.findAll('button')[1].trigger('click')
    expect(spy).toHaveBeenCalledWith('c2', false)
  })
})

describe('McpPermissionCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('clicking Allow once calls store.confirmAgentAction(confirmId, true, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpPermissionCard, {
      props: { confirmId: 'c3', server: 'srv', tool: 'search' },
      global: globalOpts,
    })
    expect(w.text()).toContain('srv')
    await w.find('.mcc-allow-once').trigger('click')
    expect(spy).toHaveBeenCalledWith('c3', true, false)
  })

  it('clicking Always allow calls store.confirmAgentAction(confirmId, true, true)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpPermissionCard, { props: { confirmId: 'c3', server: 'srv', tool: 'search' }, global: globalOpts })
    await w.find('.mcc-allow-always').trigger('click')
    expect(spy).toHaveBeenCalledWith('c3', true, true)
  })

  it('clicking Deny calls store.confirmAgentAction(confirmId, false, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpPermissionCard, { props: { confirmId: 'c3', server: 'srv', tool: 'search' }, global: globalOpts })
    await w.find('.mcc-deny').trigger('click')
    expect(spy).toHaveBeenCalledWith('c3', false, false)
  })
})

describe('McpInstallCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('clicking Register calls store.confirmAgentAction(confirmId, true, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpInstallCard, {
      props: { confirmId: 'c4', name: 'my-server', transport: 'stdio', command: 'npx', args: ['foo'] },
      global: globalOpts,
    })
    expect(w.text()).toContain('my-server')
    await w.find('.mcc-allow').trigger('click')
    expect(spy).toHaveBeenCalledWith('c4', true, false)
  })

  it('clicking Deny calls store.confirmAgentAction(confirmId, false, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpInstallCard, { props: { confirmId: 'c4', name: 'my-server' }, global: globalOpts })
    await w.find('.mcc-deny').trigger('click')
    expect(spy).toHaveBeenCalledWith('c4', false, false)
  })

  it('the resolved state no longer offers a "Change" action (it would only send the user into another 409)', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpInstallCard, { props: { confirmId: 'c4', name: 'my-server' }, global: globalOpts })
    await w.find('.mcc-allow').trigger('click')
    await flushPromises()
    expect(w.find('.undo').exists()).toBe(false)
  })

  it('a 409 collapses the whole card to a single line, with no buttons left', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'confirmAgentAction')
      .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mount(McpInstallCard, { props: { confirmId: 'c4', name: 'my-server' }, global: globalOpts })
    await w.find('.mcc-allow').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('a 500 leaves the buttons in place, so the user can retry', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'confirmAgentAction')
      .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }))
    const w = mount(McpInstallCard, { props: { confirmId: 'c4', name: 'my-server' }, global: globalOpts })
    await w.find('.mcc-allow').trigger('click')
    await flushPromises()
    expect(w.find('.mcc-allow').exists()).toBe(true)
  })
})

describe('MaxTurnsCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('clicking Resume calls store.continueRun()', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'continueRun').mockResolvedValue(undefined)
    const w = mount(MaxTurnsCard, { props: { maxTurns: 25 }, global: globalOpts })
    expect(w.text()).toContain('25')
    await w.find('.mt-continue').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('when resumed=true, button is disabled and no longer triggers continueRun', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'continueRun').mockResolvedValue(undefined)
    const w = mount(MaxTurnsCard, { props: { maxTurns: 25, resumed: true }, global: globalOpts })
    const btn = w.find('.mt-continue')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('McpCallCard', () => {
  it('render server/tool, click to expand and show args', async () => {
    const w = mount(McpCallCard, {
      props: { server: 'drive', tool: 'list_files', args: '{"path":"/"}', state: 'success', result: '[]' },
      global: globalOpts,
    })
    expect(w.text()).toContain('drive')
    expect(w.text()).toContain('list_files')
    expect(w.find('.mcc-call-body').exists()).toBe(false)
    await w.find('.mcc-call-head').trigger('click')
    expect(w.find('.mcc-call-body').exists()).toBe(true)
    expect(w.text()).toContain('{"path":"/"}')
  })
})

describe('PhotoGridCard', () => {
  it('render photo grid count, show empty state when there are no photos', () => {
    const w = mount(PhotoGridCard, { props: { query: 'sunset', photos: [] }, global: globalOpts })
    expect(w.find('.pg-empty').exists()).toBe(true)
  })

  it('render thumbnail grid when photos are present', () => {
    const w = mount(PhotoGridCard, {
      props: { photos: [{ id: 'p1', name: 'a.jpg', thumbUrl: '/thumb/p1' }] },
      global: globalOpts,
    })
    expect(w.findAll('.pg-cell').length).toBe(1)
    expect(w.find('.pg-img').attributes('src')).toBe('/thumb/p1')
  })
})

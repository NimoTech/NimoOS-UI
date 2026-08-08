// SP8-P1b Task 8 —— 块渲染器批次 A 冒烟测试:17 个 1:1 移植的渲染器
// (含 4 张确认卡 + MaxTurnsCard 的 store 交互)+ BlockRenderer 全量 BLOCK_MAP 分发。
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
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

  it('已映射类型(如 tool/thinking)分发到真实渲染器,不再降级为 chip', () => {
    const w1 = mount(BlockRenderer, { props: { block: { type: 'tool', name: 'x' } } }, )
    expect(w1.find('.block-chip').exists()).toBe(false)
    expect(w1.find('.tool-card').exists()).toBe(true)

    const w2 = mount(BlockRenderer, { props: { block: { type: 'thinking', text: 'hi' } } })
    expect(w2.find('.block-chip').exists()).toBe(false)
    expect(w2.find('.thinking').exists()).toBe(true)
  })

  it('未映射类型仍降级为灰 chip', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'still_unmapped' } } })
    expect(w.find('.block-chip').text()).toBe('[still_unmapped]')
  })

  it('mcp_elicit_form 分发到 McpElicitFormCard,不降级为灰 chip', () => {
    const w = mount(BlockRenderer, {
      props: { block: { type: 'mcp_elicit_form', confirmId: 'c1', fields: [] } },
      global: globalOpts,
    })
    expect(w.find('.block-chip').exists()).toBe(false)
    expect(w.find('.mcc-perm').exists()).toBe(true)
  })

  it('mcp_elicit_url 分发到 McpElicitUrlCard,不降级为灰 chip', () => {
    const w = mount(BlockRenderer, {
      props: { block: { type: 'mcp_elicit_url', confirmId: 'c2', url: 'https://x.example' } },
      global: globalOpts,
    })
    expect(w.find('.block-chip').exists()).toBe(false)
    expect(w.find('.mcc-perm').exists()).toBe(true)
  })
})

describe('ActionsRow', () => {
  it('渲染 items 列表,每项显示 label', () => {
    const w = mount(ActionsRow, { props: { items: [{ label: 'Do it', icon: 'check', primary: true }] } })
    expect(w.text()).toContain('Do it')
    expect(w.findAll('button').length).toBe(1)
  })
})

describe('McpWarningCard', () => {
  it('展示 server/error 插值文案', () => {
    const w = mount(McpWarningCard, { props: { server: 'my-mcp', error: 'timeout' }, global: globalOpts })
    expect(w.text()).toContain('my-mcp')
    expect(w.text()).toContain('timeout')
  })
})

describe('StorageCard', () => {
  it('渲染 used/total 及分类明细', () => {
    const w = mount(StorageCard, {
      props: { used: 2.5, total: 10, label: 'NIMO HOME', breakdown: [{ name: 'Photos', value: 1.2, color: '#000' }] },
    })
    expect(w.text()).toContain('2.5 TB')
    expect(w.text()).toContain('Photos')
  })
})

describe('SearchResultsCard', () => {
  it('渲染 query/kind 与结果条目', () => {
    const w = mount(SearchResultsCard, {
      props: { query: 'invoice', kind: 'Files', results: [{ title: 'a.pdf', snippet: 'snip', path: '/a.pdf', score: 0.8 }] },
    })
    expect(w.text()).toContain('invoice')
    expect(w.text()).toContain('a.pdf')
    expect(w.text()).toContain('match 80%')
  })
})

describe('ProgressCard', () => {
  it('渲染 title 与完成计数', () => {
    const w = mount(ProgressCard, {
      props: { title: 'Uploading', items: [{ name: 'f1', pct: 100 }, { name: 'f2', pct: 40 }] },
    })
    expect(w.text()).toContain('Uploading')
    expect(w.text()).toContain('1 of 2 complete')
  })
})

describe('VideoCard', () => {
  it('渲染 title/duration', () => {
    const w = mount(VideoCard, { props: { title: 'Clip', duration: '01:30', seed: 2 } })
    expect(w.text()).toContain('Clip')
    expect(w.text()).toContain('01:30')
  })
})

describe('FileListCard', () => {
  it('渲染 title 与文件条目', () => {
    const w = mount(FileListCard, {
      props: { title: 'Results', files: [{ name: 'a.txt', path: '/a.txt', size: '1KB', kind: 'txt' }] },
    })
    expect(w.text()).toContain('Results')
    expect(w.text()).toContain('a.txt')
  })
})

describe('ThinkingBlock', () => {
  it('streaming 时显示 Thinking + 内容常展开', () => {
    const w = mount(ThinkingBlock, { props: { text: 'reasoning...', streaming: true } })
    expect(w.text()).toContain('Thinking')
    expect(w.find('.thinking-content').exists()).toBe(true)
  })

  it('非 streaming 时默认折叠,点击展开显示 text', async () => {
    const w = mount(ThinkingBlock, { props: { text: 'reasoning...', streaming: false } })
    expect(w.find('.thinking-content').exists()).toBe(false)
    await w.find('.thinking').trigger('click')
    expect(w.find('.thinking-content').exists()).toBe(true)
    expect(w.text()).toContain('reasoning...')
  })
})

describe('ImageGridCard', () => {
  it('渲染 title 与图片格数', () => {
    const w = mount(ImageGridCard, {
      props: { title: 'Sunsets', images: [{ seed: 1 }, { seed: 2 }], count: 12 },
    })
    expect(w.text()).toContain('Sunsets')
    expect(w.text()).toContain('Showing 2 of 12 matches')
  })
})

describe('ToolCard', () => {
  it('渲染工具名,点击展开显示 sections', async () => {
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

  it('点击 Accept 调用 store.confirmAgentAction(confirmId, true)', async () => {
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

  it('点击 Deny 调用 store.confirmAgentAction(confirmId, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(ConfirmCard, { props: { confirmId: 'c1', description: 'x' }, global: globalOpts })
    await w.findAll('button')[1].trigger('click')
    expect(spy).toHaveBeenCalledWith('c1', false)
  })
})

describe('PermissionRequestCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('点击 Allow 调用 store.confirmAgentAction(confirmId, true)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(PermissionRequestCard, {
      props: { confirmId: 'c2', path: '/DATA/x', kind: 'folder' },
      global: globalOpts,
    })
    await w.findAll('button')[0].trigger('click')
    expect(spy).toHaveBeenCalledWith('c2', true)
  })

  it('点击 Deny 调用 store.confirmAgentAction(confirmId, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(PermissionRequestCard, { props: { confirmId: 'c2', path: '/DATA/x' }, global: globalOpts })
    await w.findAll('button')[1].trigger('click')
    expect(spy).toHaveBeenCalledWith('c2', false)
  })
})

describe('McpPermissionCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('点击 Allow once 调用 store.confirmAgentAction(confirmId, true, false)', async () => {
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

  it('点击 Always allow 调用 store.confirmAgentAction(confirmId, true, true)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpPermissionCard, { props: { confirmId: 'c3', server: 'srv', tool: 'search' }, global: globalOpts })
    await w.find('.mcc-allow-always').trigger('click')
    expect(spy).toHaveBeenCalledWith('c3', true, true)
  })

  it('点击 Deny 调用 store.confirmAgentAction(confirmId, false, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpPermissionCard, { props: { confirmId: 'c3', server: 'srv', tool: 'search' }, global: globalOpts })
    await w.find('.mcc-deny').trigger('click')
    expect(spy).toHaveBeenCalledWith('c3', false, false)
  })
})

describe('McpInstallCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('点击 Register 调用 store.confirmAgentAction(confirmId, true, false)', async () => {
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

  it('点击 Deny 调用 store.confirmAgentAction(confirmId, false, false)', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'confirmAgentAction').mockResolvedValue(undefined)
    const w = mount(McpInstallCard, { props: { confirmId: 'c4', name: 'my-server' }, global: globalOpts })
    await w.find('.mcc-deny').trigger('click')
    expect(spy).toHaveBeenCalledWith('c4', false, false)
  })
})

describe('MaxTurnsCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('点击 Resume 调用 store.continueRun()', async () => {
    const store = useAgentStore()
    const spy = vi.spyOn(store, 'continueRun').mockResolvedValue(undefined)
    const w = mount(MaxTurnsCard, { props: { maxTurns: 25 }, global: globalOpts })
    expect(w.text()).toContain('25')
    await w.find('.mt-continue').trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('resumed=true 时按钮禁用,不再触发 continueRun', async () => {
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
  it('渲染 server/tool,点击展开显示 args', async () => {
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
  it('渲染照片格数,无照片时展示空态', () => {
    const w = mount(PhotoGridCard, { props: { query: 'sunset', photos: [] }, global: globalOpts })
    expect(w.find('.pg-empty').exists()).toBe(true)
  })

  it('有照片时渲染缩略图格子', () => {
    const w = mount(PhotoGridCard, {
      props: { photos: [{ id: 'p1', name: 'a.jpg', thumbUrl: '/thumb/p1' }] },
      global: globalOpts,
    })
    expect(w.findAll('.pg-cell').length).toBe(1)
    expect(w.find('.pg-img').attributes('src')).toBe('/thumb/p1')
  })
})

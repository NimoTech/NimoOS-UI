// Regression for the finished-run "0 steps" header. A finished run replays
// the persisted turn from /messages — no SSE activity events ever fire, so
// sink.state.steps stays empty; the header must count the RENDERED rail
// instead. (TaskRunsPanel.test.ts stubs this component; the event vocabulary
// itself is covered by runTranscript.test.ts.)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  listAgentMessages: vi.fn(),
  attachAgentStream: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { listAgentMessages: h.listAgentMessages } },
}))
vi.mock('../services/agentTransport', () => ({
  attachAgentStream: h.attachAgentStream,
}))

import TaskRunTranscript from './TaskRunTranscript.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountRun() {
  return mount(TaskRunTranscript, {
    props: {
      run: { id: 'r1', status: 'succeeded', session_id: 's1' } as never,
    },
    global: { plugins: [i18n] },
  })
}

describe('TaskRunTranscript replayed step count', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts steps from the replayed rail, not the live-only state.steps', async () => {
    h.listAgentMessages.mockResolvedValue([
      { id: 'h-u-1', role: 'user', content: 'do the thing' },
      {
        id: 'h-a-2',
        role: 'assistant',
        streaming: false,
        blocks: [
          { type: 'thinking', text: 'plan' },
          { type: 'tool', name: 'get_system_logs', state: 'success', sections: [] },
          { type: 'tool', name: 'check_services', state: 'success', sections: [] },
          { type: 'md', text: 'done' },
        ],
      },
    ])
    const w = mountRun()
    await flushPromises()
    expect(h.attachAgentStream).not.toHaveBeenCalled()
    // zh aiTasksTranscriptSteps = '{n} 步'; must reflect the 2 tool steps.
    expect(w.find('.rt-counts').text()).toContain('2 步')
    expect(w.find('.rt-counts').text()).not.toContain('0 步')
  })
})

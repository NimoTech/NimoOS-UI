// Ported from Vue2 src/views/AI/Agent/services/__tests__/agentStream.spec.js
// Covers the mapper family (not dispatchEvent/runAgentRun/SSE transport parts, which belong to Task 6).
import { describe, it, expect } from 'vitest'
import {
  migrateLegacyMessages,
  expandHistoryBlock,
  parseMcpToolName,
  parseShellResult,
  buildPhotoGridBlock,
} from './streamMappers'
import { buildSemanticSearchBlock } from './searchMapper'
import type { AgentBlock, AgentMessage } from '../types'

function nimoosSearchToolBlock(query: string, result: unknown): AgentBlock {
  return {
    type: 'tool',
    name: 'nimoos_search',
    sections: [
      { label: 'ARGUMENTS', code: JSON.stringify({ query }) },
      { label: 'RESULT', code: JSON.stringify(result) },
    ],
  }
}

const RESULT_WITH_HITS = {
  groups: {
    images: [{ asset_id: 'a1', name: 'cat.jpg', path: '/DATA/cat.jpg', score: 0.9 }],
    filenames: [{ name: 'notes.md', path: '/DATA/notes.md', ext: 'md', match: 0.7 }],
    semantic: [],
  },
  stats: { total_candidates: 2, fileindex_status: 'ready' },
  warnings: [],
}

describe('migrateLegacyMessages — nimoos_search history reconstruction', () => {
  it('reconstructs a semantic_search card after a persisted nimoos_search tool block', () => {
    const persisted: AgentMessage[] = [
      { id: 'm1', role: 'assistant', blocks: [nimoosSearchToolBlock('cat photos', RESULT_WITH_HITS)] },
    ]
    const out = migrateLegacyMessages(persisted)
    const blocks = out[0].blocks!
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('tool') // original tool block preserved
    expect(blocks[1].type).toBe('semantic_search')
    expect(blocks[1].query).toBe('cat photos')
    expect(blocks[1].terms).toEqual(['cat', 'photos'])
    expect((blocks[1] as any).images).toHaveLength(1)
    expect((blocks[1] as any).images[0].assetId).toBe('a1')
    expect((blocks[1] as any).files).toHaveLength(1)
    expect(blocks[1].total).toBe(2)
  })

  it('does not add a semantic_search block when the search returned nothing', () => {
    const empty = { groups: { images: [], filenames: [], semantic: [] }, stats: { total_candidates: 0 }, warnings: [] }
    const persisted: AgentMessage[] = [{ id: 'm1', role: 'assistant', blocks: [nimoosSearchToolBlock('nothing', empty)] }]
    const out = migrateLegacyMessages(persisted)
    expect(out[0].blocks).toHaveLength(1)
    expect(out[0].blocks![0].type).toBe('tool')
  })

  it('leaves the tool block alone when RESULT is missing (run still in flight when persisted)', () => {
    const block: AgentBlock = { type: 'tool', name: 'nimoos_search', sections: [{ label: 'ARGUMENTS', code: JSON.stringify({ query: 'x' }) }] }
    const out = migrateLegacyMessages([{ id: 'm1', role: 'assistant', blocks: [block] }])
    expect(out[0].blocks).toHaveLength(1)
    expect(out[0].blocks![0].type).toBe('tool')
  })

  it('still migrates run_command tool blocks to terminal (regression)', () => {
    const rc: AgentBlock = {
      type: 'tool',
      name: 'run_command',
      sections: [
        { label: 'ARGUMENTS', code: JSON.stringify({ command: 'ls' }) },
        { label: 'RESULT', code: '[exit 0]\nfile.txt' },
      ],
    }
    const out = migrateLegacyMessages([{ id: 'm1', role: 'assistant', blocks: [rc] }])
    expect(out[0].blocks).toHaveLength(1)
    expect(out[0].blocks![0].type).toBe('terminal')
    expect(out[0].blocks![0].command).toBe('ls')
    expect(out[0].blocks![0].cwd).toBe('/work')
    expect(out[0].blocks![0].shell).toBe('bash')
  })
})

function searchPhotosToolBlock(query: string, result: unknown): AgentBlock {
  return {
    type: 'tool',
    name: 'search_photos',
    sections: [
      { label: 'ARGUMENTS', code: JSON.stringify({ query }) },
      { label: 'RESULT', code: JSON.stringify(result) },
    ],
  }
}

describe('migrateLegacyMessages — search_photos history reconstruction', () => {
  it('reconstructs a photo_grid card after a persisted search_photos tool block', () => {
    const result = {
      query: 'beach',
      count: 2,
      results: [
        { id: 'p1', name: 'a.jpg', takenAt: '2024-01-01' },
        { id: 'p2', name: 'b.jpg', takenAt: '2024-01-02' },
      ],
    }
    const out = migrateLegacyMessages([{ id: 'm1', role: 'assistant', blocks: [searchPhotosToolBlock('beach', result)] }])
    const blocks = out[0].blocks!
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('tool')
    expect(blocks[1].type).toBe('photo_grid')
    expect(blocks[1].query).toBe('beach')
    expect((blocks[1] as any).photos).toHaveLength(2)
    expect((blocks[1] as any).photos[0].id).toBe('p1')
    expect((blocks[1] as any).photos[0].thumbUrl).toBe('/v1/photos/assets/p1/thumbnail?size=small')
  })

  it('does not add a photo_grid block when search_photos returned nothing', () => {
    const empty = { query: 'x', count: 0, results: [] }
    const out = migrateLegacyMessages([{ id: 'm1', role: 'assistant', blocks: [searchPhotosToolBlock('x', empty)] }])
    expect(out[0].blocks).toHaveLength(1)
    expect(out[0].blocks![0].type).toBe('tool')
  })
})

describe('buildPhotoGridBlock', () => {
  it('returns null when there are no results', () => {
    expect(buildPhotoGridBlock({ query: 'q', results: [] }, 'q')).toBeNull()
  })

  it('maps results into a photo_grid block with thumbnail urls', () => {
    const block = buildPhotoGridBlock({ query: 'cats', results: [{ id: 'a1', name: 'c.jpg', takenAt: '2024' }] }, '')!
    expect(block.type).toBe('photo_grid')
    expect(block.query).toBe('cats')
    expect((block as any).photos[0].thumbUrl).toBe('/v1/photos/assets/a1/thumbnail?size=small')
  })

  it('falls back to the passed query when the result omits it', () => {
    const block = buildPhotoGridBlock({ results: [{ id: 'a1', name: 'c.jpg' }] }, 'fallback')!
    expect(block.query).toBe('fallback')
  })
})

describe('buildSemanticSearchBlock', () => {
  it('returns null when there are no results', () => {
    expect(buildSemanticSearchBlock({ groups: {}, stats: {}, warnings: [] }, 'q')).toBeNull()
  })

  it('maps groups into a semantic_search block', () => {
    const block = buildSemanticSearchBlock(RESULT_WITH_HITS, 'cat photos')!
    expect(block.type).toBe('semantic_search')
    expect((block as any).images[0].assetId).toBe('a1')
    expect((block as any).files[0].kind).toBe('md')
    expect((block as any).scope).toContain('DATA')
  })
})

describe('parseMcpToolName', () => {
  it('parses a well-formed mcp tool name', () => {
    expect(parseMcpToolName('mcp__server__tool')).toEqual({ server: 'server', tool: 'tool' })
  })

  it('returns null for a non-mcp tool name', () => {
    expect(parseMcpToolName('run_command')).toBeNull()
  })

  it('returns null when not a string', () => {
    expect(parseMcpToolName(undefined as unknown as string)).toBeNull()
  })
})

describe('expandHistoryBlock', () => {
  it('expands a nimoos_search tool block into [tool, semantic_search]', () => {
    const block = nimoosSearchToolBlock('cat photos', RESULT_WITH_HITS)
    const out = expandHistoryBlock(block)
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(block)
    expect(out[1].type).toBe('semantic_search')
  })
})

describe('parseShellResult', () => {
  it('parses a successful exit', () => {
    expect(parseShellResult('[exit 0]\nfile.txt')).toEqual({
      state: 'success',
      exitCode: 0,
      lines: [{ text: 'file.txt', stream: 'stdout' }],
    })
  })

  it('parses a non-zero exit as error', () => {
    expect(parseShellResult('[exit 1]\nboom')).toEqual({
      state: 'error',
      exitCode: 1,
      lines: [{ text: 'boom', stream: 'stdout' }],
    })
  })

  it('parses a timeout kill as error with exitCode 124', () => {
    expect(parseShellResult('[killed: timeout 30s]\npartial output')).toEqual({
      state: 'error',
      exitCode: 124,
      lines: [{ text: 'partial output', stream: 'stdout' }],
    })
  })

  it('treats unrecognized content as raw stdout success', () => {
    expect(parseShellResult('plain output')).toEqual({
      state: 'success',
      exitCode: 0,
      lines: [{ text: 'plain output', stream: 'stdout' }],
    })
  })
})

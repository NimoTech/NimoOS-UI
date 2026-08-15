import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createRaid } from './raid'

function fakeHttp(log: Array<[string, string, unknown]>, data: unknown = {}) {
  return {
    get: async (u: string, cfg?: { params?: unknown }) => { log.push(['get', u, cfg?.params]); return { data: { success: 200, data } } },
    post: async (u: string, b?: unknown) => { log.push(['post', u, b]); return { data: { success: 200, data } } },
    delete: async (u: string, cfg?: { data?: unknown }) => { log.push(['delete', u, cfg?.data]); return { data: { success: 200, data } } },
  } as unknown as AxiosInstance
}

describe('createRaid', () => {
  it('list unwraps RAIDStatus array', async () => {
    const log: Array<[string, string, unknown]> = []
    const arr = [{ live_state: 'clean', rebuild_pct: 0, total_bytes: 1, used_bytes: 0, free_bytes: 1, members: [] }]
    const res = await createRaid(fakeHttp(log, arr)).list()
    expect(log).toEqual([['get', '/v2/raid', undefined]])
    expect(res).toEqual(arr)
  })

  // 2026-08-12 contract (NimoOS-LocalStorage PR #22): recover's Data is {state, readded};
  // status can carry reattachable_members (only when degraded and a member disk has been reinserted) — standard envelope, unwrap as usual.
  it('recover unwraps {state, readded}', async () => {
    const log: Array<[string, string, unknown]> = []
    const res = await createRaid(fakeHttp(log, { state: 'rebuilding', readded: ['/dev/sdc'] })).recover(3)
    expect(log).toEqual([['post', '/v2/raid/3/recover', undefined]])
    expect(res).toEqual({ state: 'rebuilding', readded: ['/dev/sdc'] })
  })

  it('getStatus passes reattachable_members through the envelope', async () => {
    const log: Array<[string, string, unknown]> = []
    const status = {
      live_state: 'clean, degraded', rebuild_pct: -1, total_bytes: 1, used_bytes: 0, free_bytes: 1, members: [],
      reattachable_members: [{ path: '/dev/sdc', serial: 'WD-1', role: 'Active device 1', last_update: 'Wed Aug 12 03:43:02 2026' }],
    }
    const res = await createRaid(fakeHttp(log, status)).getStatus(3)
    expect(res.reattachable_members).toEqual(status.reattachable_members)
  })

  it('urls and verbs match Vue2 raid.js exactly', async () => {
    const log: Array<[string, string, unknown]> = []
    const r = createRaid(fakeHttp(log))
    // create/replaceDisk body shape is the contract (RaidCreateBody/RaidReplaceDiskBody):
    // wipe_raid_residue was added on the backend on 2026-08-11 — a residue disk without true gets rejected with a 500.
    const createBody = { name: 'md0', level: 1, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'btrfs', enable_snapshots: true, wipe_raid_residue: false }
    const replaceBody = { old_disk_path: '/dev/sda', old_disk_serial: 'OLD-1', new_disk_path: '/dev/sdb', wipe_raid_residue: false }
    await r.create(createBody); await r.remove(3); await r.getStatus(3); await r.getUsage(3)
    await r.replaceDisk(3, replaceBody); await r.recover(3)
    await r.listTasks(); await r.getTask('t1')
    expect(log).toEqual([
      ['post', '/v2/raid', createBody],
      ['delete', '/v2/raid/3', undefined],
      ['get', '/v2/raid/3/status', undefined],
      ['get', '/v2/raid/3/usage', undefined],
      ['post', '/v2/raid/3/disk', replaceBody],
      ['post', '/v2/raid/3/recover', undefined],
      ['get', '/v2/raid/tasks', undefined],
      ['get', '/v2/raid/tasks/t1', undefined],
    ])
  })
})

// POST /v2/raid, GET /v2/raid/tasks, and GET /v2/raid/tasks/:id all return raw JSON with no
// success field (route/v2/raid.go: CreateRAIDArray 187-190 uses ctx.JSON(202, map[string]string{...});
// ListCreateTasks 299 uses ctx.JSON(200, tasks), a bare array; GetCreateTask on 200 at 309 uses ctx.JSON(200,
// buildTaskResponse(t)), a bare object, and on 404 at 307 uses ctx.JSON(404, map[string]string{"error":...})).
// unwrap() requires success===200 or it throws — create() used to throw on this bare body, misreporting a
// successful create as a failed one (caught in the 07-28 real-device acceptance: all three backend steps
// passed, task status=done, yet the frontend still popped a failure toast).
// This verifies all three methods tolerate the bare body while still staying compatible with the standard
// envelope (in case the backend adds one later).
// Note: the domain's other methods (list/remove/getStatus/getUsage/replaceDisk/recover) are confirmed by the
// backend to use the standard envelope (model.Result{Success,Message,Data}) — don't relax them the same way,
// doing so would swallow real errors too.
describe('createRaid create/listTasks/getTask tolerate raw (non-standard) envelopes', () => {
  it('create returns a raw {task_id,status} body (real backend: HTTP 202, no success field)', async () => {
    const http = { post: async () => ({ data: { task_id: 'abc', status: 'creating' } }) } as unknown as AxiosInstance
    const res = await createRaid(http).create({ name: 'md0', level: 1, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'btrfs', enable_snapshots: false })
    expect(res).toEqual({ task_id: 'abc', status: 'creating' })
  })

  it('create also tolerates a standard {success,data:{task_id,status}} envelope', async () => {
    const http = { post: async () => ({ data: { success: 200, data: { task_id: 'xyz', status: 'creating' } } }) } as unknown as AxiosInstance
    const res = await createRaid(http).create({ name: 'md0', level: 1, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'btrfs', enable_snapshots: false })
    expect(res).toEqual({ task_id: 'xyz', status: 'creating' })
  })

  it('listTasks returns a raw array body directly', async () => {
    const arr = [{ task_id: 't1', status: 'done', progress: 100 }]
    const http = { get: async () => ({ data: arr }) } as unknown as AxiosInstance
    const res = await createRaid(http).listTasks()
    expect(res).toEqual(arr)
  })

  it('listTasks also tolerates a standard {success,data:[...]} envelope', async () => {
    const arr = [{ task_id: 't2' }]
    const http = { get: async () => ({ data: { success: 200, data: arr } }) } as unknown as AxiosInstance
    const res = await createRaid(http).listTasks()
    expect(res).toEqual(arr)
  })

  it('listTasks degrades to an empty array on an unexpected body (never throws)', async () => {
    const http = { get: async () => ({ data: null }) } as unknown as AxiosInstance
    const res = await createRaid(http).listTasks()
    expect(res).toEqual([])
  })

  it('getTask returns a raw task object body (200, no success field)', async () => {
    const task = { task_id: 't1', status: 'done', progress: 100 }
    const http = { get: async () => ({ data: task }) } as unknown as AxiosInstance
    const res = await createRaid(http).getTask('t1')
    expect(res).toEqual(task)
  })

  it('getTask also tolerates a standard {success,data:{...}} envelope', async () => {
    const task = { task_id: 't1', status: 'done' }
    const http = { get: async () => ({ data: { success: 200, data: task } }) } as unknown as AxiosInstance
    const res = await createRaid(http).getTask('t1')
    expect(res).toEqual(task)
  })

  it('getTask propagates a 404 rejection untouched (route/v2/raid.go:307) so callers can clear the task card', async () => {
    const err = Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: { error: 'task not found' } } })
    const http = { get: async () => { throw err } } as unknown as AxiosInstance
    await expect(createRaid(http).getTask('missing')).rejects.toBe(err)
  })
})

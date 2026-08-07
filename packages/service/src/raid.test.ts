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

  it('urls and verbs match Vue2 raid.js exactly', async () => {
    const log: Array<[string, string, unknown]> = []
    const r = createRaid(fakeHttp(log))
    await r.create({ name: 'md0' }); await r.remove(3); await r.getStatus(3); await r.getUsage(3)
    await r.replaceDisk(3, { old: '/dev/sda', new: '/dev/sdb' }); await r.recover(3)
    await r.listTasks(); await r.getTask('t1')
    expect(log).toEqual([
      ['post', '/v2/raid', { name: 'md0' }],
      ['delete', '/v2/raid/3', undefined],
      ['get', '/v2/raid/3/status', undefined],
      ['get', '/v2/raid/3/usage', undefined],
      ['post', '/v2/raid/3/disk', { old: '/dev/sda', new: '/dev/sdb' }],
      ['post', '/v2/raid/3/recover', undefined],
      ['get', '/v2/raid/tasks', undefined],
      ['get', '/v2/raid/tasks/t1', undefined],
    ])
  })
})

// POST /v2/raid、GET /v2/raid/tasks、GET /v2/raid/tasks/:id 三个端点返回裸 JSON,没有
// success 字段(route/v2/raid.go: CreateRAIDArray 187-190 用 ctx.JSON(202, map[string]string{...});
// ListCreateTasks 299 用 ctx.JSON(200, tasks) 裸数组; GetCreateTask 200 时 309 用 ctx.JSON(200,
// buildTaskResponse(t)) 裸对象、404 时 307 用 ctx.JSON(404, map[string]string{"error":...}))。
// unwrap() 要求 success===200 否则必抛 —— 之前 create() 对这个裸体必抛,把"创建成功"误报成
// "创建失败"(真机验收 07-28 抓到:后端三步全过、任务 status=done,前端仍弹失败 toast)。
// 这里验证三个方法都能容忍裸体,同时不放弃对标准信封的兼容(万一后端将来补上信封)。
// 注意:同域其余方法(list/remove/getStatus/getUsage/replaceDisk/recover)后端确认是标准信封
// (model.Result{Success,Message,Data}),不要照这个模式放宽,放宽了会把真错误也吞掉。
describe('createRaid create/listTasks/getTask tolerate raw (non-standard) envelopes', () => {
  it('create returns a raw {task_id,status} body (real backend: HTTP 202, no success field)', async () => {
    const http = { post: async () => ({ data: { task_id: 'abc', status: 'creating' } }) } as unknown as AxiosInstance
    const res = await createRaid(http).create({ name: 'md0' })
    expect(res).toEqual({ task_id: 'abc', status: 'creating' })
  })

  it('create also tolerates a standard {success,data:{task_id,status}} envelope', async () => {
    const http = { post: async () => ({ data: { success: 200, data: { task_id: 'xyz', status: 'creating' } } }) } as unknown as AxiosInstance
    const res = await createRaid(http).create({ name: 'md0' })
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

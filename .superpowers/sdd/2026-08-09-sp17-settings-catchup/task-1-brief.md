### Task 1: service 层 `getLanDiscovery`(裸 JSON,不能套 unwrap)

**Files:**
- Modify: `packages/service/src/types.ts`(接在 `GatewayDeviceInfo` 之后,约 267 行)
- Modify: `packages/service/src/sys.ts:110-121`(紧挨既有两个裸 JSON 方法)
- Test: `packages/service/src/sys.test.ts`(接在 `getDeviceInfo 读裸 JSON` 用例之后,约 250 行)

**Interfaces:**
- Consumes: 无(本任务是最底层)
- Produces:
  ```ts
  export interface LanDevice { ip: string; hostname: string; version: string; self: boolean }
  export interface LanDiscovery { devices: LanDevice[]; truncated: boolean }
  // service.sys.getLanDiscovery(): Promise<LanDiscovery>
  ```
  Task 2 只用这两个类型名与这个方法名。

- [ ] **Step 1: Write the failing tests**

在 `packages/service/src/sys.test.ts` 里,`getDeviceInfo 读裸 JSON` 那个 `it` 之后加(注意本文件既有用例的 `http({...})` helper 已在文件顶部定义,直接用):

```ts
  it('getLanDiscovery reads bare JSON -- it must not go through unwrap', async () => {
    // Real response captured on the device 2026-08-09: no success/message/data envelope.
    const s = createSys(http({ '/gateway/lan-discovery': {
      devices: [
        { ip: '192.168.1.49', hostname: 'NimoOS', version: 'dev', self: false },
        { ip: '192.168.1.143', hostname: 'NimoOS', version: '1.9.3-alpha1+28.g0dc16d6', self: true },
        { ip: '192.168.1.189', hostname: 'debian', version: '1.9.4-alpha1+430', self: false },
      ],
      truncated: false,
    } }))
    const res = await s.getLanDiscovery()
    expect(res.devices).toHaveLength(3)
    expect(res.devices[1].self).toBe(true)
    expect(res.devices[2].hostname).toBe('debian')
    expect(res.truncated).toBe(false)
  })

  it('getLanDiscovery keeps truncated true', async () => {
    const s = createSys(http({ '/gateway/lan-discovery': { devices: [], truncated: true } }))
    expect(await s.getLanDiscovery()).toEqual({ devices: [], truncated: true })
  })

  it('getLanDiscovery tolerates a body without devices/truncated', async () => {
    const s = createSys(http({ '/gateway/lan-discovery': {} }))
    expect(await s.getLanDiscovery()).toEqual({ devices: [], truncated: false })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/service/src/sys.test.ts -t getLanDiscovery`
Expected: FAIL —— `s.getLanDiscovery is not a function`

- [ ] **Step 3: Add the types**

`packages/service/src/types.ts`,接在 `export interface GatewayDeviceInfo …` 那一行之后:

```ts
// Gateway LAN discovery (GET /gateway/lan-discovery). Bare JSON, see sys.ts.
export interface LanDevice { ip: string; hostname: string; version: string; self: boolean }
export interface LanDiscovery { devices: LanDevice[]; truncated: boolean }
```

- [ ] **Step 4: Implement the method**

`packages/service/src/sys.ts` —— 先把 `LanDiscovery` 加进文件顶部那个 `import type { … } from './types.js'` 列表,然后紧接在 `getDeviceInfo` 之后插入:

```ts
    // Bare JSON as well -- {"devices":[…],"truncated":false}, no success/message/data
    // envelope (verified with curl on the device 2026-08-09). unwrap() would throw here
    // because it treats a missing `success: 200` as a failed request.
    async getLanDiscovery(): Promise<LanDiscovery> {
      const res = await http.get('/gateway/lan-discovery')
      const body = res.data as Partial<LanDiscovery> | null
      return { devices: body?.devices ?? [], truncated: body?.truncated ?? false }
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/service/src/sys.test.ts -t getLanDiscovery`
Expected: PASS(3 passed)

- [ ] **Step 6: Mutation check —— 证明测试确实钉住了「不能套 unwrap」**

临时把实现改成 `return unwrap<LanDiscovery>(res.data)`,重跑上面那条命令,**必须红**(报 `request failed (undefined)`)。确认后改回 Step 4 的实现,再跑一次确认绿。这一步不提交任何东西,只是验证测试不是空转。

- [ ] **Step 7: Commit**

```bash
git add packages/service/src/types.ts packages/service/src/sys.ts packages/service/src/sys.test.ts
git commit -m "feat(service): read the gateway LAN discovery endpoint

The endpoint answers with bare JSON, so it takes the same shape as
getGatewayComponents rather than the standard envelope; unwrap() would
reject it outright."
```

---


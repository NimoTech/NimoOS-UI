### Task 1: 共享包 — `sys.hardwareInfo()` + 类型补强

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/types.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/sys.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/index.ts`(类型导出行,现第 23 行)
- Test: `/home/nimo/NimoTech/NimoOS-Service/src/sys.test.ts`

**Interfaces:**
- Consumes: 既有 `unwrap`(标准信封)、`createSys(http)` 工厂。
- Produces: `service.sys.hardwareInfo(): Promise<HardwareInfo>`;`HardwareInfo { arch: string; [k: string]: unknown }`;`StoreAppInfo.architectures?: string[]`、`StoreAppInfo.tips?: { before_install?: Record<string, string> | null } | null`。Task 2/4/5/6/7 消费。

- [ ] **Step 1: 写失败测试**(`src/sys.test.ts` 追加到既有 describe 后)

```ts
describe('createSys.hardwareInfo', () => {
  it('unwraps standard envelope to HardwareInfo', async () => {
    // curl 实证 2026-07-21:GET /v1/sys/hardware → {"success":200,"message":"ok","data":{"arch":"amd64","cpu_cores":6,...}}
    const s = createSys(http({ '/sys/hardware': { success: 200, message: 'ok', data: { arch: 'amd64', cpu_cores: 6 } } }))
    const h = await s.hardwareInfo()
    expect(h.arch).toBe('amd64')
    expect(h.cpu_cores).toBe(6)
  })

  it('throws on non-200 envelope', async () => {
    const s = createSys(http({ '/sys/hardware': { success: 500, message: 'boom' } }))
    await expect(s.hardwareInfo()).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm test -- sys`
Expected: FAIL(`hardwareInfo is not a function`)

- [ ] **Step 3: 实现**

`src/types.ts` 在 `CloudDriver` 后追加(SP5 区块附近):

```ts
/** GET /v1/sys/hardware(核心服务,标准信封)——P3 只消费 arch,其余字段透传 */
export interface HardwareInfo {
  arch: string
  [k: string]: unknown
}
```

`src/types.ts` 修改 `StoreAppInfo`(现 123-138 行):`tips?: unknown` 一行替换为下面两行,并在 `port_map?: string` 后新增 architectures:

```ts
  architectures?: string[]
  /** 安装前须知:多语言 markdown map(curl 实证形如 {before_install:{en_US:"…",zh_CN:"…"}} 或 null) */
  tips?: { before_install?: Record<string, string> | null } | null
```

`src/sys.ts` 在 `getVersion` 后追加方法(import 行补 `HardwareInfo` 类型):

```ts
    async hardwareInfo(): Promise<HardwareInfo> {
      const res = await http.get('/sys/hardware')
      return unwrap<HardwareInfo>(res.data)
    },
```

`src/index.ts` 第 23 行类型导出列表追加 `HardwareInfo`。

- [ ] **Step 4: 全量测试 + 构建通过**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm test && pnpm build`
Expected: 全绿(105+2),tsc 无错误。

- [ ] **Step 5: New-UI 刷新 file: 快照并回归(P0 铁律)**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm install && pnpm test`
Expected: New-UI 全量绿(880/880,零代码改动本步只是护栏)。

- [ ] **Step 6: Commit(Service 仓)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/types.ts src/sys.ts src/index.ts src/sys.test.ts
git commit -m "feat(sys): hardwareInfo() + StoreAppInfo architectures/tips types for SP5-P3"
```

---


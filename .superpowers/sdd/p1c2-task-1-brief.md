### Task 1: 共享包 —— `disks.list()`

**Files:** Modify `../NimoOS-Service/src/disks.ts`;Test `../NimoOS-Service/src/disks.test.ts`(不存在则新建,照 `src/ai.test.ts` 的 mock-http 写法)

**Interfaces:** Produces `list(): Promise<unknown>` —— `GET /disks`,**body-level 返回**(与 `ai` 域同约定:`Array.isArray(d) ? d : unwrap(d)`,照 `storage.ts:6-10` 的写法保持一致)。

- [ ] **Step 1: 写失败测试** —— 断言调用 `GET /disks`、数组直出、信封体走 unwrap。
- [ ] **Step 2: 跑 `pnpm test -- src/disks.test.ts`(在 `../NimoOS-Service`)确认失败**(`list is not a function`)。
- [ ] **Step 3: 实现** —— 在 `createDisks` 工厂内部、`umountUsb` **之后**追加(不重排既有代码,压低与 SP6 的冲突面)。
- [ ] **Step 4: 跑测试通过 + `pnpm build`**;回 New-UI `pnpm install`(刷 `file:` 快照)后跑 `pnpm test -- src/ai` 确认消费端零回归。
- [ ] **Step 5: Commit**(Service 仓)`SP8-P1c2: disks.list() for the Agent system tab storage card`

---


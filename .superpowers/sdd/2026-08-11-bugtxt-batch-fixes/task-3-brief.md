### Task 3: Bug 7 — 已共享文件夹被误判"受保护"而删不掉

`src/files/util/protect.ts:44` 的 `canOperate` 把"已被 Samba 共享"(`isAlreadyShared`)当作不可删除/剪切/重命名。这是 New-UI 把 Vue2 里仅用于隐藏右键菜单项的判断提升成了操作闸门 —— 后端本来就支持删除共享文件夹并自行清理共享记录(`NimoOS/route/v1/file.go:1039-1057` 删除后调 `DeleteShareByPath`;重命名有 `RewriteSharePathPrefix`),Vue2 从不拦截。RAID 机器上共享文件夹密集,于是表现为"未知原因删不掉"。修法:从 `canOperate` 移除 shared 这一条(系统默认文件夹、挂载点两条保留)。

**Files:**
- Modify: `src/files/util/protect.ts`(删除第 44 行 `if (isAlreadyShared(entry)) return false` 及第 2 行 import)
- Modify: `src/files/util/protect.test.ts`(现有用例把"已分享不可操作"固化为期望,需反转)
- Test: `src/views/__tests__/Files.deleteGate.test.ts`、`src/files/composables/useFileOps.test.ts`(检查是否有依赖 shared-block 行为的用例,一并更新)

**Interfaces:**
- Consumes: `isAlreadyShared`(`src/files/util/shareGate.ts:12-14`)—— **保留该文件**,它仍被分享菜单状态使用;只是 `protect.ts` 不再 import。
- Produces: `canOperate(entry)` 语义变更:shared 条目返回 `true`。所有调用方(`FileContextMenu.vue`、`useFileOps.ts`、`Files.vue askDelete`)自动放行,无需改动。

- [ ] **Step 1: 反转测试期望(红)**

在 `src/files/util/protect.test.ts` 中找到断言 shared 条目 `canOperate === false` 的用例,改为断言 `true`,并把用例名改成说明性的,例如:

```ts
it('已共享目录可以删除/剪切/重命名(后端会自行清理共享记录,Vue2 也从不拦截)', () => {
  const shared = { name: 'aaa', path: '/media/RAID_x/aaa', is_dir: true, extensions: { share: { shared: 'true' } } } as unknown as FileEntry
  expect(canOperate(shared)).toBe(true)
})
```

Run: `pnpm vitest run src/files/util/protect.test.ts`
Expected: FAIL(实现还没改)

- [ ] **Step 2: 改实现**

`src/files/util/protect.ts`:删除 `import { isAlreadyShared } from './shareGate'` 与 `canOperate` 里的 `if (isAlreadyShared(entry)) return false // 已分享` 行,原位补注释:

```ts
// 已分享 ≠ 受保护(bug.txt #7):后端删除时自行清理共享记录(DeleteShareByPath)、
// 重命名有 RewriteSharePathPrefix;Vue2 也只在右键菜单里隐藏入口、从不拦截操作。
// 曾把它列入本闸门,导致 RAID 上的共享文件夹"未知原因删不掉"。
```

- [ ] **Step 3: 跑测试并清理连带断言**

Run: `pnpm vitest run src/files/util/protect.test.ts src/views/__tests__/Files.deleteGate.test.ts src/files/composables/useFileOps.test.ts`
Expected: PASS。若 deleteGate/useFileOps 里有 shared-block 用例,按新语义更新(shared 条目应进入删除确认弹窗而不是被 toast 拦截)。

- [ ] **Step 4: Commit**

```bash
git add src/files/util/protect.ts src/files/util/protect.test.ts src/views/__tests__/Files.deleteGate.test.ts src/files/composables/useFileOps.test.ts
git commit -m "fix(files): stop treating shared folders as protected

canOperate() blocked delete/cut/rename on any Samba-shared entry, which the
backend fully supports (it cleans up share records itself on delete and
rewrites share paths on rename). Vue2 only hid context-menu entries and
never gated the operation. On RAID machines, where large volumes are where
shares live, this surfaced as folders that could not be deleted at all."
```

---


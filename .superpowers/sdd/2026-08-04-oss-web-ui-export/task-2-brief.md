### Task 2: 修掉 `pnpm test` 的退出码 1

**Files:**
- Modify: `src/settings/views/SettingsPage.test.ts`

**Interfaces:**
- Produces: `pnpm test` 退出码 0。后续每个任务的门都靠它判定。

**为什么在本项目里做**:spec §7.4 把这件事挂在「等 sp7/sp8 合回 master 再做」上;而验收门(§7.5 第一道)靠退出码判定,不修就得靠人肉数 "Errors 1"。这是**测试文件里的一行 mock 缺失**,不是产品代码重构,不违反「禁无关重构」。

- [ ] **Step 1: 先复现,确认失败形态**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test 2>&1 | tail -8; echo "EXIT=${PIPESTATUS[0]}"
```

Expected:`Test Files 352 passed` / `Tests 3078 passed` / `Errors 1 error` / `EXIT=1`,
且错误文案指向 `src/settings/panels/AccountPanel.vue:181` 与 `SettingsPage.test.ts` 的
`用户块跳到 /settings/account`。

- [ ] **Step 2: 定位根因(读代码确认,别猜)**

```bash
sed -n '43p' src/settings/panels/AccountPanel.vue      # avatarSrc computed 调 service.users.avatarPath
sed -n '19,22p' src/settings/views/SettingsPage.test.ts # users mock 只有 getCustomStorage/setCustomStorage
```

结论:`AccountPanel` 挂载后 `avatarSrc` 求值 → mock 上没有 `avatarPath` → TypeError,在用例判定完成之后才浮出,所以用例绿、进程红。

- [ ] **Step 3: 给 mock 补上那个方法**

在 `src/settings/views/SettingsPage.test.ts` 的 `users: {` 块里加一行(与 `AccountPanel.test.ts:25` 的既有 mock 形状保持一致):

```ts
    users: {
      getCustomStorage: async () => ({}),
      setCustomStorage: async () => {},
      // AccountPanel 的 avatarSrc computed 在挂载时求值;缺这行会在用例结束后
      // 抛 unhandled TypeError,表现为「3078 例全绿但进程退出码 1」。
      avatarPath: (v: number, t: string | null) => `/v1/users/avatar?${t ? `token=${t}&` : ''}v=${v}`,
    },
```

- [ ] **Step 4: 验证退出码变 0**

```bash
pnpm test 2>&1 | tail -8; echo "EXIT=${PIPESTATUS[0]}"
```

Expected:`Tests 3078 passed`、**没有** `Errors` 行、`EXIT=0`。

- [ ] **Step 5: 提交**

```bash
git add src/settings/views/SettingsPage.test.ts
git commit -m "fix(test): SettingsPage mock 补 users.avatarPath,消掉全量测试的退出码 1"
```

---


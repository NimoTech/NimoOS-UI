### Task 7: 类 3 补丁 —— 设置侧 + Service 侧 + 注释洗白 + `.gitignore`

**Files:**
- Modify: `oss/manifest.mjs`(`PATCH` / `SERVICE_PATCH`)
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Consumes: T6 的 `PATCH` 数组
- Produces: rail 7→6 项;Service 不再导出 photos;两处注释洗白;`search_switch` 移除

- [ ] **Step 1: 写失败断言**

追加到 `oss/tree.test.mjs`:

```js
describe('类 3 · 设置与 Service 侧补丁', () => {
  it('设置 tab 从 9 降到 8,rail 从 7 降到 6,folder-permissions 全无', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).not.toMatch(/folder-permissions|FolderPermissions/)
    expect(s).toContain('SETTINGS_TABS.slice(0, 6)')
    expect(read('src/settings/panels/index.ts')).not.toMatch(/FolderPermissions/)
  })

  it('railTabsFor 退化为恒等(不再按 admin 过滤)', () => {
    const s = read('src/settings/util/tabs.ts')
    expect(s).toContain('export function railTabsFor(): readonly SettingsTab[] {')
    expect(s).not.toMatch(/role === 'admin'/)
  })

  it('E2:systemConfig 不再有 search_switch', () => {
    expect(read('src/settings/util/systemConfig.ts')).not.toMatch(/search_switch/)
  })

  it('E13:Service 不再导出 photos / PhotoAsset', () => {
    const i = read('packages/service/src/index.ts')
    expect(i).not.toMatch(/createPhotos|PhotoAsset|get photos/)
    expect(read('packages/service/src/types.ts')).not.toMatch(/PhotoAsset/)
    // 保留面
    expect(read('packages/service/src/types.ts')).toContain('UserFolderPermission')
  })

  it('注释洗白:两处不再点名 AI agent / Photos ML / photos_data', () => {
    expect(read('src/apps/util/systemApp.ts')).not.toMatch(/AI agent|Photos ML/)
    expect(read('src/settings/util/appPaths.ts')).not.toMatch(/photos_data/)
  })

  it('E9:.gitignore 洗掉 4 行,加 .export-report.txt', () => {
    const g = read('.gitignore')
    for (const bad of ['.claude/', '.superpowers/', 'scripts/tmlab/', 'vite.config.tmlab.ts']) {
      expect(g, bad).not.toContain(bad)
    }
    expect(g).toContain('.export-report.txt')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs -t '设置与 Service'`
Expected: FAIL(6 例全红)

- [ ] **Step 3: 往 `PATCH` 追加设置侧条目**

```js
  // ── tabs.ts:去 folder-permissions,rail 7→6,railTabsFor 退化为恒等 ──────
  { path: 'src/settings/util/tabs.ts',
    find: "  'system-status',\n  'folder-permissions',\n  'account',",
    replace: "  'system-status',\n  'account'," },
  { path: 'src/settings/util/tabs.ts',
    find: "/** 侧栏 rail 上可见的 7 项(account / developer 有各自入口,不在 rail 上)。 */\nexport const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 7)",
    replace: "/** 侧栏 rail 上可见的 6 项(account / developer 有各自入口,不在 rail 上)。 */\nexport const RAIL_TABS: readonly SettingsTab[] = SETTINGS_TABS.slice(0, 6)" },
  { path: 'src/settings/util/tabs.ts',
    find: "  'folder-permissions': 'settingsTabFolderPermissions',\n", replace: '' },
  { path: 'src/settings/util/tabs.ts',
    find: "/** Vue2 visibleTabs:只有 admin 能看到 folder-permissions。role 缺失按非 admin 处理。 */\nexport function railTabsFor(role: string | undefined): readonly SettingsTab[] {\n  if (role === 'admin') return RAIL_TABS\n  return RAIL_TABS.filter((t) => t !== 'folder-permissions')\n}",
    replace: "/** rail 上没有按角色隐藏的项,直接返回全集(保留函数形状以免调用处发散)。 */\nexport function railTabsFor(): readonly SettingsTab[] {\n  return RAIL_TABS\n}" },
  // ⚠️ railTabsFor 的调用处会因为少一个实参而 tsc 报错 —— 用 grep 找出来一并补丁:
  //    grep -rn "railTabsFor(" src --include=*.vue --include=*.ts | grep -v util/tabs

  // ── panels/index.ts ─────────────────────────────────────────────────────
  { path: 'src/settings/panels/index.ts',
    find: "import FolderPermissionsPanel from './FolderPermissionsPanel.vue'\n", replace: '' },
  { path: 'src/settings/panels/index.ts',
    find: "  'folder-permissions': FolderPermissionsPanel,\n", replace: '' },

  // ── E2:systemConfig 的 search_switch(索引签名已保证读改写不丢未知字段)──
  { path: 'src/settings/util/systemConfig.ts',
    find: '  search_switch?: boolean\n', replace: '' },
  { path: 'src/settings/util/systemConfig.ts',
    find: '  search_switch: true,\n', replace: '' },

  // ── 注释洗白(代码一个字节不动)────────────────────────────────────────
  { path: 'src/apps/util/systemApp.ts',
    find: " *  compose 任一 service 的 label `nimoos.system == \"true\"` 即幕后组件(AI agent 运行时 /\n *  Photos ML 后端等),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。",
    replace: " *  compose 任一 service 的 label `nimoos.system == \"true\"` 即幕后组件(供其他应用使用的\n *  内部服务容器),桌面 appgrid 已按此隐藏;应用管理页也须隐藏,不然会漏出用户没主动装的容器。" },
  // appPaths.ts 那句的原文用 sed -n '12,16p' src/settings/util/appPaths.ts 现场取,
  // 把「photos_data」那段改成「后端可能返回更多 key,界面只渲染前 3 个」。

  // ── .gitignore(E9:用户 2026-08-04 拍板)─────────────────────────────────
  { path: '.gitignore',
    find: '\n# Claude Code 本地状态(隔离 worktree、会话配置),不入库\n.claude/\n.superpowers/\n',
    replace: '' },
  { path: '.gitignore',
    find: '\n# 时间机器验收测试台(T12):假后端 + 专用 vite 配置,只在本机验收用,不进版本库\nscripts/tmlab/\nvite.config.tmlab.ts',
    replace: '\n# 导出报告(含上游 commit hash),仅供本地追溯\n.export-report.txt' },
```

- [ ] **Step 4: 填 `SERVICE_PATCH`(E13)**

```js
export const SERVICE_PATCH = [
  { path: 'src/index.ts', find: "import { createPhotos } from './photos.js'\n", replace: '' },
  { path: 'src/index.ts', find: 'PhotoAsset, ', replace: '' },
  // get photos() 整块:用 sed -n '46,52p' ../NimoOS-Service/src/index.ts 现场取逐字锚点
  { path: 'src/types.ts',
    find: 'export interface PhotoAsset { id: string | number; [k: string]: unknown }\n', replace: '' },
]
```

- [ ] **Step 5: 找出 `railTabsFor` 的调用处并补丁**

```bash
grep -rn "railTabsFor(" src --include=*.vue --include=*.ts | grep -v "util/tabs"
```

对每个调用处加一条 PATCH,把实参去掉(例如 `railTabsFor(session.user?.role)` → `railTabsFor()`)。**这一步不能跳** —— 少一个实参在 TS 里是错误,T15 的 `vue-tsc` 会红。

- [ ] **Step 6: 跑产出树测试**

Run: `pnpm exec vitest run oss/tree.test.mjs`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add oss/manifest.mjs oss/tree.test.mjs
git commit -m "feat(oss): 设置/Service/注释/.gitignore 锚点补丁"
```

---


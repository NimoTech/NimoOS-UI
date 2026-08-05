# SP9-P8 cutover 实施计划（SP9 收官期）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把系统设置、KVM、搜索三个入口从 Vue 2 绞杀到 New-UI，每处都带可逆回退 flag，SP9 全区收官。

**Architecture:** 两侧对称落地。Vue 2 侧改 `src/router/strangler.js` 一张表两个数组：`/kvm`（真路由，全局守卫整页重定向）与 `/search`（真路由，但新应用里搜索是桌面面板不是页面，所以落到桌面 `/` 并透传 `?q=`，需给精确条目新增查询串透传能力）进 `migratedRoutes`；`/settings`（Vue 2 侧是无路由的 buefy 模态，守卫拦不到）进 `migratedEntries`，由两个调用处自己 `resolveEntryTarget` → `window.location.href`。New-UI 侧改 `useOpenAction.ts` 把 `vm` / `settings` 两个桌面磁贴翻成 `router.push`，各带自己的 `cutoverDisabled()` 判定；`SearchDialog.vue` 自己消费桌面路由上的 `?q=`（开面板 + 种词 + 自动搜一次）。全程不删任何 Vue 2 代码。

**Tech Stack:** Vue 2.7 + vitest 4（NimoOS-UI，分支 `docs/vue3-migration-sp3`）· Vue 3 + TypeScript + Vite + vitest 4 + vue-router 4 hash 模式（NimoOS-New-UI，分支 `master`）· Node 脚本 + vitest（`oss/` 开源导出机制）

---

## Global Constraints

以下每条都适用于**每一个任务**，任务正文不再重复。

### 仓库与分支

- 代码横跨两个仓，**分支不同**：
  - `/home/nimo/NimoTech/NimoOS-New-UI` → `master`
  - `/home/nimo/NimoTech/NimoOS-UI` → **`docs/vue3-migration-sp3`**（⚠️ 不是 master，别 checkout）
- **不碰 `.sp7/` 与 `.sp8/`**（相册线与 AI 线的独立工作树）。

### git 纪律（本期最容易出事的地方）

- New-UI 工作树里**预先就有** 3 个 `design-export/*.html` 未暂存删除 + `oss/files/README.md` 修改；NimoOS-UI 里有未跟踪的 `FRONTEND_API_GUIDE.md`。**都不属本期，不要提交、不要还原、不要 `git add`。**
- 提交一律带显式 pathspec：`git commit -m "…" -- <路径> [<路径>…]`。
- **禁**：`git add -A`、`git commit -a`、`git checkout`、`git stash`、`git reset`、`git restore`。
- 新建文件先 `git add <该文件路径>`，再用 pathspec 提交。
- 每次提交前先 `git status --short` 确认没有夹带。

### 测试命令（两仓不同，别混）

| 仓 | 全量 | 单文件 |
|---|---|---|
| NimoOS-New-UI | `pnpm test`（= `vitest run`） | `pnpm vitest run <路径>` |
| NimoOS-UI | ⚠️ `pnpm test` 是**监听模式**（`vitest`），不要用 | `pnpm vitest run <路径>` |

NimoOS-UI 跑全量用 `pnpm vitest run`（不带路径）。

### 任务门

- **New-UI**：`pnpm test` + `pnpm exec vue-tsc --noEmit`，判定标准是「**相对基线不新增红**」（spec §9.4 第 5 条）。已知基线红：`AccountPanel.vue:181` 读 `avatarPath` 那个 Error（P4 遗留，master 已在 `721117f` 修过一次，若仍在则属基线）。
- **NimoOS-UI**：`pnpm vitest run` 全绿或相对基线不新增红。
- **本期额外一门**（Task 5 起）：`pnpm vitest run oss/tree.test.mjs` —— 含「产物树能构建」（P7 新增，`pnpm install` + `vue-tsc --noEmit` 跑在导出产物树上，约 9.4s / timeout 600s）。**只扫词的守卫抓不到构建断裂，这道门才是判据。**

### 硬约束（spec §10）

- **界面严格 1:1，逻辑照正确**。Vue 2 的 bug / 竞态 / 吞错不照抄，改正确并在代码里注释登记。**未申报的偏离即缺陷。禁止无关重构。**
- **不删任何 Vue 2 代码**（roadmap §3.2 铁律，删除全部归 SP10）。本期只**新增**登记行与分支，老弹窗 / 老页面全部原样留着当回退路径。
- 颜色只能用 theme token（`color-guard.test.ts` **不剥注释**，注释里的 `#xxx` 也会被抓）。**本期预期不新增任何 CSS。**
- i18n 新 key 必须同时加 `zh_cn.sp9.ts` 与 `en_us.sp9.ts`（`parity.test.ts` 否则立红）。**本期预期不新增任何 i18n key。**
- 验收起 **dev server**：`cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273`。
  ⛔ **绝不 `deploy.sh`** —— 设备上只有一个 `/var/lib/nimoos/www/app/`，deploy 是 `rsync --delete`，三条并行线（master 5273 / `.sp7` 5277 / `.sp8` 5288）共用它，谁部署谁把另外两条的产物删掉。
- 台账落 `NimoOS-New-UI/.superpowers/sdd/sp9/09-p8.md`。**台账 2026-08-05 起已入库进 git**（`505e3bf`），按 `.md` 入库处理，用 pathspec 提交。
- 若新增会被开源导出带走的文件，**同步 `oss/manifest.mjs`**（本期 Task 5 专门处理）。

### 回退 flag 命名（两侧共用同一把键，同源共享 localStorage）

| 键 | 置 `'1'` 后 |
|---|---|
| `strangler:disabled:/kvm` | Vue 2 `/kvm` 路由不再被守卫重定向 **且** New-UI 桌面 vm 磁贴退回 `/#/kvm` |
| `strangler:disabled:/settings` | Vue 2 两处设置弹窗恢复弹老模态 **且** New-UI 桌面 settings 磁贴退回 `/#/legacy` |
| `strangler:disabled:/search` | Vue 2 `/search` 路由不再被守卫重定向（回到老全页搜索页） |

⚠️ **吸取 SP6-P1 教训**：磁贴翻新路由与给回退 flag **必须在同一个任务内完成**。SP6 存储磁贴 P1 就翻了路由却没留 flag，部署后浏览器侧无法回滚，直到 P6 才补。本计划里 Task 3 一次落齐两个磁贴 + 两个 flag 判定。

---

## ⚠️ 待机主拍板项（不要自己选，开工前必须先问）

### 决策 1 · 与 SP7 P8b Part B 的合并顺序

SP7 的 **P8b Part B**（把 `sp7-photos` 合进 master + Vue 2 `strangler.js` 加 `/photos` 行 + 相册 i18n 抽分片 + 开源清单扩张）当初因「P7 正在 master 上活跃提交」被机主暂缓。**现在 P7 已关账，那个阻塞解除了。**

两者相撞的具体面：

| 文件 | P8 要改 | Part B 要改 |
|---|---|---|
| `NimoOS-New-UI/src/home/composables/useOpenAction.ts` | `SYS_ROUTE` 的 `vm` / `settings` + `openApp` 里加两个 cutover 分支 | `SYS_ROUTE` 的 `photos` + `openItem` 的 photo 分支 | 
| `NimoOS-UI/src/router/strangler.js` | `migratedRoutes` 加 2 行、`migratedEntries` 加 1 行、`resolveTarget` 加 passQuery 分支 | `migratedRoutes` 加 `/photos` 行 |
| `NimoOS-New-UI/oss/manifest.mjs` | 改若干失效锚点（Task 5） | 为 `src/photos/**` 整个功能区扩张 |

`useOpenAction.ts` 正是 **SP6 合并时唯一冲突过的那个文件**。

**两个选项：**
- **(a) 先合 SP7 再做 P8** —— P8 在已含 `/photos` 行的表上加行，冲突归零；代价是 P8 开工被合并（含 4 个冲突文件 triage）挡住。
- **(b) 先做 P8 再合 SP7** —— P8 立即可开工、SP9 更早收官；代价是 Part B 合并时 `useOpenAction.ts` / `strangler.js` / `oss/manifest.mjs` 三处冲突要手工 triage。

### ✅ 已拍板（2026-08-05，机主）：选 **(a) 先合 SP7 再做 P8**

机主自行执行 `sp7-photos` 合并进 master。**合并完成后、Task 1 开工前，必须先跑一遍下面的坐标复核** —— 本计划正文里的行号与逐字锚点全是在**合并前**的工作树上实测的，SP7 P8b Part B 会动到其中三个文件，锚点很可能已经漂了。

**坐标复核清单（Task 1 的 Step 0，不是可选项）：**

```bash
# ① Vue2 绞杀表:Part B 会加 /photos 行,确认表的形状与 resolveTarget 的返回段
cd /home/nimo/NimoTech/NimoOS-UI
git log --oneline -1 && git status --short
cat -n src/router/strangler.js          # 核对:migratedRoutes 现有几条?resolveTarget 的两行返回段还在不在?
wc -l src/router/__tests__/strangler.spec.js   # 计划写的是 91 行,变了就以实际为准

# ② Vue2 两个调用处的行号
grep -n "component: SettingsPanel" src/views/Home.vue src/components/Apps/AppCard.vue
grep -n "resolveEntryTarget" src/views/Home.vue src/components/Apps/AppCard.vue

# ③ New-UI 磁贴:Part B 会改 SYS_ROUTE 的 photos 与 openItem 的 photo 分支
cd /home/nimo/NimoTech/NimoOS-New-UI
git log --oneline -1 && git status --short
cat -n src/home/composables/useOpenAction.ts   # 核对 SYS_ROUTE 内容、cutoverDisabled 注释、openApp 分支顺序

# ④ 开源清单:Part B 会为 src/photos/** 整个功能区扩张,manifest 行号必然全变
grep -n "useOpenAction\|homeUi.ts\|views/Home.vue" oss/manifest.mjs

# ⑤ 基线:合并后的基线红是什么,先记下来(任务门判定是"相对基线不新增红")
pnpm test 2>&1 | tail -20
pnpm exec vue-tsc --noEmit
pnpm vitest run oss/tree.test.mjs 2>&1 | tail -20    # ⚠️ Part B 若没把 oss 清单扩张做完,这道门本来就红
cd /home/nimo/NimoTech/NimoOS-UI && pnpm vitest run 2>&1 | tail -20
```

**复核结论要写进台账 `09-p8.md` 的「开工基线」一节**，并把正文里漂掉的行号/锚点就地改掉再开工。
⚠️ 特别注意第 ⑤ 项：若 SP7 合并后 `oss/tree.test.mjs` 本来就红（Part B 的开源清单扩张是它自己的活），**那是基线红，不是 Task 5 的活**。Task 5 只负责 P8 自己打断的那几个锚点，别去替 Part B 收尾 —— 混在一起会让「谁弄红的」查不清。

### 决策 2 · P5 遗漏验收（Task 6 产出的清单）由谁在什么时候跑 —— **仍未拍板**

Task 6 只**编制**清单，不代跑。机主可以选：跟本期 P8 验收一起跑（一次开 dev server 跑完）／单独排一轮／明确放弃某几条并记债。
**这条不阻塞任何编码任务**（Task 6 产出文档即算完成），到验收阶段再定即可。

---

## File Structure

### NimoOS-UI（分支 `docs/vue3-migration-sp3`）

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/router/strangler.js`（68 行） | 绞杀登记表 + 两个解析函数 | **改**：`resolveTarget` 加 `passQuery` 分支；`migratedRoutes` 加 `/kvm` `/search`；`migratedEntries` 加 `/settings` |
| `src/router/__tests__/strangler.spec.js`（91 行） | 上表的全部行为 | **改**：加三节（`/kvm`、`/search`、`/settings`）+ 精确条目零回归断言 |
| `src/views/Home.vue:101` `showSettingsPanel()` | 老桌面上的设置模态入口（EventBus `showSettingsPanel` 触发；**当前无 emitter，是死路径，仍照 SP6-P6 同规格接线**） | **改**：先 `resolveEntryTarget('/settings')` |
| `src/components/Apps/AppCard.vue:219` `showSettings()` | 老桌面 Settings 磁贴的**真活入口**（`openSystemApps` 的 `case 'Settings'`） | **改**：加 import + 先 `resolveEntryTarget('/settings')` |
| `src/views/__tests__/Home.settingsCutover.spec.js` | Home 侧设置 cutover | **新建** |
| `src/components/Apps/__tests__/AppCard.settingsCutover.spec.js` | AppCard 侧设置 cutover | **新建**（目录也要新建） |

### NimoOS-New-UI（分支 `master`）

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/home/composables/useOpenAction.ts`（60 行） | 桌面磁贴点击去哪 | **改**：`SYS_ROUTE` 注释 + `openApp` 加 vm/settings 两个 cutover 分支 |
| `src/home/composables/useOpenAction.test.ts`（109 行） | 上者的行为 | **改**：重写 settings 那条用例 + 新增 vm 与两把 flag 的用例 |
| `src/home/components/SearchDialog.vue` | 搜索面板（本期加 `?q=` 深链自消费） | **改**：2 个 import + 文件尾 1 个 watch |
| `src/home/components/SearchDialog.test.ts`（27 例） | 上者的行为 | **改**：mount helper 装 memory router + 新增「深链 ?q=」一节 |
| `oss/manifest.mjs` | 开源导出的删除/补丁清单 | **改**：修 6 处失效锚点 |
| `oss/tree.test.mjs` | 导出产物树的断言 + 构建门 | **改**：更新 3 条随锚点变化的断言 |
| `.superpowers/sdd/sp9/09-p8.md` | 本期台账 | **新建** |
| `docs/superpowers/specs/2026-07-31-…-sp9-final-views-design.md` | spec | **改**：§8 补实测订正 + P8 验收结果 |
| `docs/superpowers/2026-08-05-sp9-p5-missed-acceptance.md` | P5 遗漏验收补跑清单 | **新建**（Task 6） |

### NimoOS-UI 文档

| 文件 | 动作 |
|---|---|
| `docs/vue3-migration-roadmap.md` §4 SP9 | **改**：P8 关账 + SP9 收官（改前先 `git log -1`，改动尽量小、改完立刻提交） |

---

## Task 1: Vue 2 绞杀表 —— `/kvm` 行、`/search` 行（查询串透传）、`/settings` 入口行

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/router/strangler.js`
- Test: `/home/nimo/NimoTech/NimoOS-UI/src/router/__tests__/strangler.spec.js`

**Interfaces:**
- Consumes: 无（本期第一个任务）
- Produces:
  - `migratedRoutes` 新增两条：`{ from: '/kvm', to: '/app/#/kvm', enabled: true }` 与 `{ from: '/search', to: '/app/#/', passQuery: true, defaultQuery: '?q=', enabled: true }`
  - `migratedEntries` 新增一条：`{ from: '/settings', to: '/app/#/settings', enabled: true }`
  - `resolveTarget(fullPath, storage) → string | null` 行为扩展：命中 `passQuery` 条目时返回 `entry.to + (查询串 || entry.defaultQuery || '')`
  - `resolveEntryTarget('/settings', storage) → '/app/#/settings' | null` —— Task 2 消费

**背景（实测，别重新推导）：**
- 现有 `resolveTarget` **只在 `entry.prefix` 分支拼查询串**，精确条目（无 `prefix`）直接 `return entry.to`，查询串丢掉。
- Vue 2 `/search` 是真路由（`route.js:52`，`views/Search.vue`），用的查询参数名就是 **`q`**（`SearchBar.vue:27` 与 `Search.vue:312` 都 `push({ path: '/search', query: { q } })`，`Search.vue:208/220` 读 `this.$route.query.q`）—— 与 New-UI 要消费的参数名天然一致，不需要改名。
- Vue 2 `/kvm` 也是真路由（`route.js:137`，`components/KVM/KVMFullPage.vue`），老桌面从 `AppCard.vue:191` 的 `case 'KVM'` 用 `window.open(this.$router.resolve('/kvm').href)` 新标签打开 → 新标签加载时全局守卫（`router/index.js:48-55`）就会命中并 `window.location.replace()`。
- Vue 2 **没有** `/settings` 路由 —— 设置是 buefy 模态，所以只能进 `migratedEntries`。
- ⚠️ 为什么 `/search` 的 `to` 是桌面 `/app/#/` 而不是某个 `/app/#/search`：**New-UI 里没有 search 页面**，搜索是挂在桌面（路由 `/`，`views/Home.vue:9` 无条件挂 `<SearchDialog />`）上的面板。
- ⚠️ 为什么要 `defaultQuery: '?q='`：Vue 2 裸 `/search`（不带查询串）是一个**空的搜索页**。若透传出来是 `/app/#/`，用户落到的就只是普通桌面、面板不会开，行为对不上。带上 `?q=`（值为空）让 New-UI 判定「`q` 键存在 → 开面板」，词为空则不自动搜。**Task 4 依赖这个约定。**

- [ ] **Step 1: 写失败测试（`/kvm` 一节）**

在 `src/router/__tests__/strangler.spec.js` 末尾追加：

```js
describe('/kvm 路由行(SP9-P8 cutover)', () => {
  it('登记形状:精确条目,目标 /app/#/kvm', () => {
    expect(migratedRoutes.find((e) => e.from === '/kvm'))
      .toEqual({ from: '/kvm', to: '/app/#/kvm', enabled: true })
  })

  it('未回退时 /kvm 重定向到 /app/#/kvm', () => {
    expect(resolveTarget('/kvm', noStore)).toBe('/app/#/kvm')
    expect(isEnabled('/kvm', noStore)).toBe(true)
  })

  it('回退 flag strangler:disabled:/kvm === "1" → null(Vue2 原页仍可打开)', () => {
    const off = offStore('strangler:disabled:/kvm')
    expect(isEnabled('/kvm', off)).toBe(false)
    expect(resolveTarget('/kvm', off)).toBeNull()
  })

  it('不吞相似路径,也不前缀扩散(KVM 是精确条目)', () => {
    expect(resolveTarget('/kvmX', noStore)).toBeNull()
    expect(resolveTarget('/kvm/vms/1', noStore)).toBeNull()
  })

  it('/kvm 不进 migratedEntries(它是真路由,由守卫接管)', () => {
    expect(resolveEntryTarget('/kvm', noStore)).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-UI && pnpm vitest run src/router/__tests__/strangler.spec.js`
Expected: FAIL —— `/kvm 路由行` 一节里除最后一条外全红（`find` 返回 `undefined`、`resolveTarget('/kvm')` 返回 `null`）。

- [ ] **Step 3: 加 `/kvm` 行**

`src/router/strangler.js` 的 `migratedRoutes` 数组末尾追加（⚠️ 本仓库这个文件用 **Tab 缩进**，照抄现有风格）：

```js
	{ from: '/kvm', to: '/app/#/kvm', enabled: true }, // SP9-P8:KVM 全页(Vue2 是真路由,守卫接管)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/router/__tests__/strangler.spec.js`
Expected: PASS（全文件，含既有 `/`、`/files`、`/storage` 三节）。

- [ ] **Step 5: 写失败测试（`/search` 一节）**

继续追加：

```js
describe('/search 路由行 + 查询串透传(SP9-P8 cutover)', () => {
  it('登记形状:落桌面 /app/#/,passQuery 透传,裸路径兜底 ?q=', () => {
    expect(migratedRoutes.find((e) => e.from === '/search'))
      .toEqual({ from: '/search', to: '/app/#/', passQuery: true, defaultQuery: '?q=', enabled: true })
  })

  it('带关键词:查询串原样透传到桌面', () => {
    expect(resolveTarget('/search?q=fish', noStore)).toBe('/app/#/?q=fish')
    expect(resolveTarget('/search?q=%E5%8F%91%E7%A5%A8', noStore)).toBe('/app/#/?q=%E5%8F%91%E7%A5%A8')
  })

  it('多参数与空值一并原样透传(不重排、不丢键)', () => {
    expect(resolveTarget('/search?q=a&from=bar', noStore)).toBe('/app/#/?q=a&from=bar')
    expect(resolveTarget('/search?q=', noStore)).toBe('/app/#/?q=')
  })

  it('裸 /search(无查询串)也带上 ?q=,让新桌面把面板开起来', () => {
    expect(resolveTarget('/search', noStore)).toBe('/app/#/?q=')
  })

  it('回退 flag strangler:disabled:/search === "1" → null(Vue2 老搜索页仍可打开)', () => {
    const off = offStore('strangler:disabled:/search')
    expect(resolveTarget('/search?q=fish', off)).toBeNull()
    expect(resolveTarget('/search', off)).toBeNull()
  })

  it('不吞相似路径,也不前缀扩散', () => {
    expect(resolveTarget('/searchX', noStore)).toBeNull()
    expect(resolveTarget('/search/deep?q=x', noStore)).toBeNull()
  })

  it('★ 零回归:passQuery 是逐条开关,精确条目 / 与 /storage 的行为一个字没变', () => {
    // / 是精确条目且没有 passQuery —— 带查询串来也只回 /app/#/,与 SP3 上线时完全一致
    expect(resolveTarget('/', noStore)).toBe('/app/#/')
    expect(resolveTarget('/?foo=1', noStore)).toBe('/app/#/')
    expect(resolveTarget('/legacy', noStore)).toBeNull()
    // prefix 条目仍走原分支(剩余路径 + 查询串)
    expect(resolveTarget('/files/a/b?highlight=x', noStore)).toBe('/app/#/files/a/b?highlight=x')
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm vitest run src/router/__tests__/strangler.spec.js`
Expected: FAIL —— `/search` 一节前 5 条红（登记不存在 → `undefined` / `null`）；最后那条「零回归」应当**已经绿**（它断言的是现状），若它红说明 Step 3 改坏了既有行为，先修那个。

- [ ] **Step 7: 加 `passQuery` 分支 + `/search` 行**

改 `src/router/strangler.js` 三处。

① 文件头注释（第 5-6 行）改成：

```js
 * prefix: true 的条目按路径前缀命中(含子路径),并把剩余路径 + 查询串透传给新应用;
 * passQuery: true 的精确条目只命中该路径本身,但把查询串透传(无查询串时用 defaultQuery 兜底);
 * 其余精确条目保持原语义:只命中该路径本身,查询不透传。
```

② `migratedRoutes` 末尾追加（接在 Step 3 那行之后）：

```js
	// SP9-P8:搜索。新应用里没有 /search 页面 —— 搜索是**桌面上的面板**(Home.vue 无条件挂
	// SearchDialog),所以落点是桌面 '/',靠查询串 ?q= 让桌面自动把面板开起来并搜一次。
	// passQuery:精确条目也透传查询串(默认只有 prefix 条目透传)。
	// defaultQuery:裸 /search(没带查询串)也要带上 '?q=' —— Vue2 的 /search 无关键词时是
	//   一个空的搜索页,若只跳 /app/#/ 用户落到的就是普通桌面、面板不会开,行为对不上。
	{ from: '/search', to: '/app/#/', passQuery: true, defaultQuery: '?q=', enabled: true },
```

③ `resolveTarget` 的返回段（现为两行 `if (!entry.prefix) return entry.to` / `return entry.to + …`）改成三分支：

```js
	if (entry.prefix) return entry.to + path.slice(entry.from.length) + query
	if (entry.passQuery) return entry.to + (query || entry.defaultQuery || '')
	return entry.to
```

- [ ] **Step 8: 跑测试确认通过**

Run: `pnpm vitest run src/router/__tests__/strangler.spec.js`
Expected: PASS，全文件。

- [ ] **Step 9: 变异验证（证明新测试有判别力，不是空转）**

依次做下面两个变异，各跑一次测试，确认**指定用例变红**，然后还原：

1. 把 `if (entry.passQuery) return entry.to + (query || entry.defaultQuery || '')` 里的 `|| entry.defaultQuery || ''` 删掉 → 「裸 /search 也带上 ?q=」必红。
2. 把 `passQuery` 分支整行删掉 → 「带关键词」「多参数」「裸 /search」三条必红，而「零回归」那条仍绿（证明它锁的是**别人的**行为）。

还原后再跑一次确认 PASS。把这两次变异的实际输出摘一行进任务报告。

- [ ] **Step 10: 写失败测试（`/settings` 入口一节）**

继续追加：

```js
describe('/settings 无路由入口(SP9-P8 cutover)', () => {
  it('登记形状:目标 /app/#/settings', () => {
    expect(migratedEntries.find((e) => e.from === '/settings'))
      .toEqual({ from: '/settings', to: '/app/#/settings', enabled: true })
  })

  it('未回退时 resolveEntryTarget 返回目标 URL', () => {
    expect(resolveEntryTarget('/settings', noStore)).toBe('/app/#/settings')
  })

  it('回退 flag strangler:disabled:/settings === "1" → null(调用处走老模态)', () => {
    expect(resolveEntryTarget('/settings', offStore('strangler:disabled:/settings'))).toBeNull()
  })

  it('两把 flag 互不干扰:关 /storage 不影响 /settings', () => {
    const off = offStore('strangler:disabled:/storage')
    expect(resolveEntryTarget('/settings', off)).toBe('/app/#/settings')
    expect(resolveEntryTarget('/storage', off)).toBeNull()
  })

  it('/settings 不进 migratedRoutes(Vue2 侧是模态、没有这个路由,守卫无从拦截)', () => {
    expect(migratedRoutes.some((e) => e.from === '/settings')).toBe(false)
    expect(resolveTarget('/settings', noStore)).toBeNull()
  })
})
```

- [ ] **Step 11: 跑测试确认失败**

Run: `pnpm vitest run src/router/__tests__/strangler.spec.js`
Expected: FAIL —— 前 4 条红，最后一条（`/settings` 不在路由表）已绿。

- [ ] **Step 12: 加 `/settings` 入口行**

`migratedEntries` 数组末尾追加：

```js
	{ from: '/settings', to: '/app/#/settings', enabled: true }, // SP9-P8:两处系统设置弹窗入口
```

同时把 `migratedEntries` 上方的块注释里那句 `SP6-P6 存储区是第一条;SP7/SP8 若也有模态型入口,在此续行` 补一句（**只加，不改原句**）：

```js
 * SP9-P8 的系统设置是第二条(Vue2 侧是 buefy 模态,调用处见 views/Home.vue 与 Apps/AppCard.vue)。
```

- [ ] **Step 13: 跑测试确认通过 + 跑全量**

Run: `pnpm vitest run src/router/__tests__/strangler.spec.js`
Expected: PASS

Run: `cd /home/nimo/NimoTech/NimoOS-UI && pnpm vitest run`
Expected: 相对基线不新增红（`strangler.js` 的三个消费方 `Home.vue` / `widgets/Disks.vue` / `MountActionButton.vue` 都只用 `/storage`，不该受影响）。

- [ ] **Step 14: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git status --short   # 确认只有本任务两个文件 + 那个不该动的 FRONTEND_API_GUIDE.md(??)
git commit -m "feat(strangler): SP9-P8 登记 /kvm 与 /search 路由 + /settings 模态入口,精确条目支持查询串透传" -- src/router/strangler.js src/router/__tests__/strangler.spec.js
```

---

## Task 2: Vue 2 两处设置弹窗调用处接线

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/views/Home.vue:101-112`（`showSettingsPanel`）
- Modify: `/home/nimo/NimoTech/NimoOS-UI/src/components/Apps/AppCard.vue:12`（加 import）+ `:219-230`（`showSettings`）
- Test: `/home/nimo/NimoTech/NimoOS-UI/src/views/__tests__/Home.settingsCutover.spec.js`（新建）
- Test: `/home/nimo/NimoTech/NimoOS-UI/src/components/Apps/__tests__/AppCard.settingsCutover.spec.js`（新建，目录也新建）

**Interfaces:**
- Consumes: Task 1 的 `resolveEntryTarget('/settings')`（`'/app/#/settings'` 或 `null`）
- Produces: 无（下游无消费方）

**背景（实测，别重新找）：**
- Vue 2 打开 `SettingsPanel.vue` 模态的调用处**只有两处**（全仓 grep 过）：
  1. `src/components/Apps/AppCard.vue:219 showSettings()` —— **真活入口**，被 `openSystemApps()` 的 `case 'Settings'`（`:188-190`）调用，即老桌面上的「设置」磁贴。
  2. `src/views/Home.vue:101 showSettingsPanel()` —— 由 `mounted()` 里的 `$EventBus.$on(events.SHOW_SETTINGS_PANEL, …)`（`:87-89`）触发。**全仓没有任何地方 emit 这个事件**（`events.js:30` 只定义了 `SHOW_SETTINGS_PANEL: 'showSettingsPanel'`），所以它当前是**死路径**。⚠️ 仍然照同规格接线：它是活的代码、随时可能被重新接上，漏掉它就等于留一条绕过 cutover 的暗门。**这不是"顺手重构"，是把 cutover 做完整。**
- `Home.vue` 已经 `import { resolveEntryTarget } from '@/router/strangler'`（`:12`，SP6-P6 加的），**不要重复 import**。`AppCard.vue` 没有，要加。
- 抄的模板就是 `Home.vue:262-273` 的 `showStorageManagerPanelModal()`（SP6-P6 落的），形状完全一致。
- ⚠️ `AppCard.vue` 的 `case 'Settings'` 之外，`case 'KVM'`（`:191-195`）走 `window.open(this.$router.resolve('/kvm').href)` —— **不要动它**，Task 1 已经让守卫在新标签里接管了。`AppCard.vue:232 showKVM()`（emit `SHOW_KVM_PANEL`）当前零调用方，同样**不动**（登记成债务，见 Task 7）。

- [ ] **Step 1: 写失败测试（Home 侧）**

新建 `src/views/__tests__/Home.settingsCutover.spec.js`。⚠️ 顶部那批 `vi.mock` 不是可选的：`Home.vue` 静态 import 的子组件用 webpack 专有的无扩展名 `.vue` import / `require.context`，Vitest 的 resolver 解析不了，**光是 `import Home from '@/views/Home.vue'` 这一行就会在模块加载期崩溃**（照 `Home.storageCutover.spec.js:8-19` 的既有注释与做法）：

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// mock 清单与 Home.storageCutover.spec.js 逐字相同,理由见那份文件顶部的长注释:
// Home.vue 静态 import 的子组件(及其子依赖)大量使用 webpack 专有写法,Vitest 解析不了,
// 不 mock 的话模块加载期就崩,与是否 shallowMount 无关。
vi.mock('@/components/SideBar.vue', () => ({ default: { name: 'SideBarStub', render: () => null } }))
vi.mock('@/components/SearchBar.vue', () => ({ default: { name: 'SearchBarStub', render: () => null } }))
vi.mock('@/components/CoreService.vue', () => ({ default: { name: 'CoreServiceStub', render: () => null } }))
vi.mock('@/components/Apps/AppSection.vue', () => ({ default: { name: 'AppSectionStub', render: () => null } }))
vi.mock('@/components/settings/UpdateCompleteModal.vue', () => ({ default: { name: 'UpdateCompleteModalStub', render: () => null } }))
vi.mock('@/components/settings/SettingsPanel.vue', () => ({ default: { name: 'SettingsPanelStub', render: () => null } }))
vi.mock('@/components/KVM/KVMFullPage.vue', () => ({ default: { name: 'KVMFullPageStub', render: () => null } }))

import Home from '@/views/Home.vue'

// 与 storageCutover 同一取舍:测的是 showSettingsPanel 里的 cutover 分支,在桩 this 上直调。
function stubThis() {
  return { $buefy: { modal: { open: vi.fn() } } }
}

let savedLocation
let hrefs
beforeEach(() => {
  hrefs = []
  savedLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { set href(v) { hrefs.push(v) }, get href() { return '' } },
  })
  localStorage.removeItem('strangler:disabled:/settings')
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: savedLocation })
  localStorage.removeItem('strangler:disabled:/settings')
})

describe('Home.vue 设置入口 cutover(SP9-P8)', () => {
  it('未回退时整页跳 /app/#/settings,不开老模态', () => {
    const vm = stubThis()
    Home.methods.showSettingsPanel.call(vm)
    expect(hrefs).toEqual(['/app/#/settings'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('回退 flag strangler:disabled:/settings === "1" 时开老模态,不跳转', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const vm = stubThis()
    Home.methods.showSettingsPanel.call(vm)
    expect(hrefs).toEqual([])
    expect(vm.$buefy.modal.open).toHaveBeenCalledTimes(1)
    // 老模态的关键参数一个都没丢(界面 1:1 的回退路径)
    const opts = vm.$buefy.modal.open.mock.calls[0][0]
    expect(opts.customClass).toBe('settings-modal-wrapper')
    expect(opts.hasModalCard).toBe(true)
    expect(opts.canCancel).toEqual([])
  })

  it('flag 为其他值不算回退', () => {
    localStorage.setItem('strangler:disabled:/settings', '0')
    const vm = stubThis()
    Home.methods.showSettingsPanel.call(vm)
    expect(hrefs).toEqual(['/app/#/settings'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-UI && pnpm vitest run src/views/__tests__/Home.settingsCutover.spec.js`
Expected: FAIL —— 第 1、3 条红（`hrefs` 是 `[]`、`modal.open` 被调了一次）；第 2 条已绿（现状就是开模态）。

- [ ] **Step 3: 改 `Home.vue:101`**

把 `showSettingsPanel()` 改成（**`$buefy.modal.open` 那一整块参数一个字不改**）：

```js
    showSettingsPanel() {
      // SP9-P8 cutover:系统设置已迁到 New-UI(/app/#/settings)。
      // localStorage['strangler:disabled:/settings'] === '1' 时返回 null,落到下面的老模态(可逆回退)。
      const target = resolveEntryTarget('/settings')
      if (target) {
        window.location.href = target
        return
      }
      this.$buefy.modal.open({
        parent: this,
        component: SettingsPanel,
        hasModalCard: true,
        customClass: 'settings-modal-wrapper',
        trapFocus: true,
        animation: 'zoom-in',
        scroll: 'keep',
        canCancel: [],
      })
    },
```

⚠️ **不要**动 `:12` 的 import（`resolveEntryTarget` 已在），**不要**删 `import SettingsPanel`（回退路径还要用它）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/views/__tests__/Home.settingsCutover.spec.js src/views/__tests__/Home.storageCutover.spec.js`
Expected: PASS（两份都过 —— 后者是回归，证明没碰坏 SP6-P6 那条路）。

- [ ] **Step 5: 写失败测试（AppCard 侧）**

新建目录 `src/components/Apps/__tests__/` 与文件 `AppCard.settingsCutover.spec.js`。⚠️ 那三个 `vi.mock` 是**实测出来的最小集**（已在本机验证足够，`AppCard.vue` 另外还静态 import 了 lodash / yaml / file-saver / 三个 mixin / common-i18n，这些不需要 mock）：

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// AppCard.vue 静态 import 的三个 .vue 子依赖在 Vitest 下解析不了(同 Home.*Cutover.spec.js 的理由),
// 只 mock 到能加载模块为止 —— 本机实测这三个就够。
vi.mock('@/components/settings/SettingsPanel.vue', () => ({ default: { name: 'SettingsPanelStub', render: () => null } }))
vi.mock('@/components/Apps/TipEditorModal.vue', () => ({ default: { name: 'TipEditorModalStub', render: () => null } }))
vi.mock('@/components/basicComponents/tooltip/tooltip.vue', () => ({ default: { name: 'CTooltipStub', render: () => null } }))

import AppCard from '@/components/Apps/AppCard.vue'

function stubThis() {
  return { $buefy: { modal: { open: vi.fn() } } }
}

let savedLocation
let hrefs
beforeEach(() => {
  hrefs = []
  savedLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { set href(v) { hrefs.push(v) }, get href() { return '' } },
  })
  localStorage.removeItem('strangler:disabled:/settings')
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: savedLocation })
  localStorage.removeItem('strangler:disabled:/settings')
})

describe('AppCard.vue 设置磁贴 cutover(SP9-P8)', () => {
  it('未回退时整页跳 /app/#/settings,不开老模态', () => {
    const vm = stubThis()
    AppCard.methods.showSettings.call(vm)
    expect(hrefs).toEqual(['/app/#/settings'])
    expect(vm.$buefy.modal.open).not.toHaveBeenCalled()
  })

  it('回退 flag === "1" 时开老模态,且 buefy 参数一字未改', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const vm = stubThis()
    AppCard.methods.showSettings.call(vm)
    expect(hrefs).toEqual([])
    const opts = vm.$buefy.modal.open.mock.calls[0][0]
    expect(opts.customClass).toBe('settings-modal')  // ⚠️ AppCard 用的是 settings-modal,不是 Home 的 settings-modal-wrapper
    expect(opts.canCancel).toEqual(['escape'])
    expect(opts.hasModalCard).toBe(true)
  })

  it('openSystemApps 的 Settings 分支走的就是 showSettings(入口没被绕开)', () => {
    const vm = { ...stubThis(), showSettings: vi.fn() }
    AppCard.methods.openSystemApps.call(vm, { name: 'Settings' })
    expect(vm.showSettings).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm vitest run src/components/Apps/__tests__/AppCard.settingsCutover.spec.js`
Expected: FAIL —— 第 1 条红；第 2、3 条已绿。

- [ ] **Step 7: 改 `AppCard.vue`**

① `:12` 之后（`import SettingsPanel …` 那行下面）加一行 import：

```js
import { resolveEntryTarget } from '@/router/strangler'
```

② `showSettings()` 改成（**`$buefy.modal.open` 参数块一个字不改**）：

```js
    showSettings() {
      // SP9-P8 cutover:系统设置已迁到 New-UI(/app/#/settings)。
      // localStorage['strangler:disabled:/settings'] === '1' 时返回 null,落到下面的老模态(可逆回退)。
      const target = resolveEntryTarget('/settings')
      if (target) {
        window.location.href = target
        return
      }
      this.$buefy.modal.open({
        parent: this,
        component: SettingsPanel,
        hasModalCard: true,
        customClass: 'settings-modal',
        trapFocus: true,
        canCancel: ['escape'],
        scroll: 'keep',
        animation: 'zoom-in',
      })
    },
```

- [ ] **Step 8: 跑测试确认通过 + 全量**

Run: `pnpm vitest run src/components/Apps/__tests__/AppCard.settingsCutover.spec.js`
Expected: PASS

Run: `cd /home/nimo/NimoTech/NimoOS-UI && pnpm vitest run`
Expected: 相对基线不新增红。

- [ ] **Step 9: 反向检查（不删 Vue 2 代码 + 没有别的调用处漏网）**

逐条跑并把输出贴进任务报告：

```bash
cd /home/nimo/NimoTech/NimoOS-UI
# ① SettingsPanel 的两个调用处都已接线,没有第三处
grep -rn "component: SettingsPanel" src --include=*.vue
# 预期恰好 2 处:views/Home.vue 与 components/Apps/AppCard.vue,且各自上方 6 行内有 resolveEntryTarget
grep -rn -B8 "component: SettingsPanel" src --include=*.vue | grep -c "resolveEntryTarget"   # 预期 2

# ② 没有删任何 Vue2 代码:SettingsPanel.vue 本体与两处 import 都还在
test -f src/components/settings/SettingsPanel.vue && echo "SettingsPanel.vue 在"
grep -c "import SettingsPanel" src/views/Home.vue src/components/Apps/AppCard.vue   # 各 1

# ③ KVM 那两处按计划未动
grep -n "case 'KVM'" -A 4 src/components/Apps/AppCard.vue
grep -n "showKVM()" src/components/Apps/AppCard.vue
```

- [ ] **Step 10: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/views/__tests__/Home.settingsCutover.spec.js src/components/Apps/__tests__/AppCard.settingsCutover.spec.js
git status --short
git commit -m "feat(settings): SP9-P8 两处设置模态入口走绞杀跳转,回退 flag 命中时仍开老模态" -- src/views/Home.vue src/components/Apps/AppCard.vue src/views/__tests__/Home.settingsCutover.spec.js src/components/Apps/__tests__/AppCard.settingsCutover.spec.js
```

---

## Task 3: New-UI 桌面磁贴翻 `/kvm` 与 `/settings`（含两个回退 flag）

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/composables/useOpenAction.ts:6-12`（注释 + `SYS_ROUTE`）、`:14-20`（`cutoverDisabled` 注释）、`:31-33`（`openApp` 分支）
- Test: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/composables/useOpenAction.test.ts`

**Interfaces:**
- Consumes: Task 1 落的两把 flag 键名（`strangler:disabled:/kvm`、`strangler:disabled:/settings`）
- Produces: 无（下游无消费方；但 Task 5 要为改后的文本修 OSS 锚点）

**背景：**
- 现状：`SYS_ROUTE = { photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm', settings: '/#/legacy' }`，`openApp` 里已有 `/apps`（SP5-P8）与 `/storage`（SP6-P6）两处 `cutoverDisabled` 用法可照抄。
- New-UI 侧目标路由：`/kvm`（`router/index.ts:45`，`kvm/views/KvmPage.vue`）与 `/settings`（`settings/settingsRoutes.ts:10`，会 redirect 到 `/settings/<上次的 tab>`）。**两条都已存在**，本任务不新增路由。
- 回退时各自去哪：
  - `vm` → `SYS_ROUTE.vm` = `/#/kvm`（Vue 2 KVM 全页）。同一把 flag 也关掉了 Task 1 的 `/kvm` 绞杀行，所以 Vue 2 页真的会渲染出来，不会被守卫弹回来。
  - `settings` → `SYS_ROUTE.settings` = `/#/legacy`（Vue 2 老桌面）。用户在老桌面点「设置」磁贴 → Task 2 的 `resolveEntryTarget('/settings')` 因同一把 flag 返回 `null` → 弹老模态。与 SP6-P6 存储的回退形态一致（两步到位）。
- ⚠️ `SYS_ROUTE` 里 `vm` 与 `settings` 两个值**保持原样不动** —— 它们现在的角色从"默认去处"变成"回退去处"，值恰好都对。改值反而会破回退。

- [ ] **Step 1: 写失败测试**

改 `src/home/composables/useOpenAction.test.ts`。

① `beforeEach`（`:18-19`）里补两把 flag 的清理：

```ts
  localStorage.removeItem('strangler:disabled:/apps')
  localStorage.removeItem('strangler:disabled:/storage')
  localStorage.removeItem('strangler:disabled:/kvm')
  localStorage.removeItem('strangler:disabled:/settings')
```

② 把 `:32-36` 那条 `it('settings 维持 /#/legacy(P8 cutover 不动它)', …)` **整块替换**成下面四条（它的名字已经与事实相反，本期就是来改它的）：

```ts
  it('settings 磁贴应用内 router.push /settings(SP9-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/settings==1 时 settings 退回 /#/legacy 老桌面', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
  })
  it('vm 磁贴应用内 router.push /kvm(SP9-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(router.push).toHaveBeenCalledWith('/kvm')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/kvm==1 时 vm 退回 Vue2 全页 /#/kvm', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(hrefs[0]).toBe('/#/kvm')
    expect(router.push).not.toHaveBeenCalled()
  })
```

③ 在既有的「storage 与 apps 两把 flag 互不干扰」（`:65-72`）之后追加一条四把 flag 的隔离断言：

```ts
  it('四把 flag 逐条独立:只关 /kvm 不影响 settings / storage / appstore', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('settings'); expect(router.push).toHaveBeenCalledWith('/settings')
    openApp('storage'); expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore'); expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
  })
```

⚠️ `openApp('vm')` / `openApp('settings')` 要走进 `a.system` 分支，需要 apps store 里有这两个应用。先确认既有测试怎么让 `openApp('settings')` 命中 system 分支（现有那条 `settings 维持 /#/legacy` 用例没有 `setApps` 就通过了 → `apps.app(key)` 对系统应用有内建来源）。**若新加的 `openApp('vm')` 因 `a` 为 `undefined` 直接 return 导致断言红**，照 `useOpenAction.test.ts` 现有的 `s.setApps([...])` 写法给 `vm` 补一条 `{ name: 'vm', system: true }`，并在任务报告里说明这一处 fixture 的来源（**不要**猜字段名，先读 `src/home/stores/apps.ts` 里 `app()` 与 system 应用清单的真实形状）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/home/composables/useOpenAction.test.ts`
Expected: FAIL —— 新增的 settings/vm 两条 push 用例红（现状是整页跳 `/#/legacy` 与 `/#/kvm`），两条回退用例已绿。

- [ ] **Step 3: 改 `useOpenAction.ts`**

① 顶部注释 + `SYS_ROUTE`（`:6-12`）改成：

```ts
// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)、存储区(/storage,SP6-P1)、
// 系统设置(/settings)与 KVM(/kvm,两者 SP9-P8)已活在本应用;
// 其余系统入口仍指 Vue2,各自 SP 迁移时再改。
// ⚠️ SYS_ROUTE 里 vm / settings 两项**保持指向 Vue2**:cutover 之后它们的角色从
//    "默认去处"变成"回退去处"(flag 命中时走这里),改值会把回退路径破掉。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}
```

② `cutoverDisabled` 上方注释（`:14-17`）补两行（**保留原有三行**）：

```ts
// 回退 flag(与 Vue2 strangler.js 的 strangler:disabled:<from> 命名一致):
// == '1' 时磁贴退回 Vue2 老页面,可逆 cutover。
// /apps = SP5-P8;/storage = SP6-P6(Vue2 桌面那三个存储入口共用同一把键,
// 同源共享 localStorage,所以置一次即两侧同时回退)。
// /kvm 与 /settings = SP9-P8,同理:一把键同时关掉本磁贴与 Vue2 侧的绞杀登记
// (/kvm 在 migratedRoutes、/settings 在 migratedEntries)。
```

⚠️ 原第 15 行 `// == '1' 时磁贴退回 Vue2 /#/legacy 老桌面,可逆 cutover。` 里的 `/#/legacy` 已不准确（vm 退回的是 `/#/kvm`），按上面改成「Vue2 老页面」。**这是文字订正，不是行为改动，仍要在任务报告里登记一句。**

③ `openApp` 的 system 分支（`:31-33`）加两行（**顺序按 files → appstore → storage → settings → kvm，最后落 SYS_ROUTE 兜底**）：

```ts
      if (key === 'appstore' && !cutoverDisabled('/apps')) { router.push('/apps/store'); return }
      if (key === 'storage' && !cutoverDisabled('/storage')) { router.push('/storage'); return }
      if (key === 'settings' && !cutoverDisabled('/settings')) { router.push('/settings'); return }
      if (key === 'vm' && !cutoverDisabled('/kvm')) { router.push('/kvm'); return }
      window.location.href = SYS_ROUTE[key] || '/#/legacy'
      return
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/home/composables/useOpenAction.test.ts`
Expected: PASS，全文件。

- [ ] **Step 5: 变异验证**

1. 把 `settings` 那行的 `&& !cutoverDisabled('/settings')` 删掉 → 「回退 flag …settings==1」必红。
2. 把 `vm` 那行的 `'/kvm'` 写成 `'/settings'`（flag 键写错） → 「回退 flag …kvm==1」必红，且「四把 flag 逐条独立」也红。

各跑一次、还原、再跑一次确认 PASS，把输出摘一行进报告。**这一步是本期唯一直接锁住"flag 与磁贴同任务落齐"的证据，不能跳。**

- [ ] **Step 6: 任务门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test
pnpm exec vue-tsc --noEmit
```
Expected: 相对基线不新增红；vue-tsc 零错。
⚠️ 此时 `pnpm vitest run oss/tree.test.mjs` **预期会红**（`useOpenAction.ts` 的锚点被本任务改动了）—— 这是 Task 5 的活，在报告里明确写出「已知 oss 门红，留给 Task 5」，**不要**在本任务里顺手改 `oss/`。

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short   # 只应有本任务 2 个文件 + 那 4 个预先存在的条目
git commit -m "feat(home): SP9-P8 设置与 KVM 磁贴翻应用内路由,各带 strangler:disabled 回退 flag" -- src/home/composables/useOpenAction.ts src/home/composables/useOpenAction.test.ts
```

---

## Task 4: New-UI 首页 `?q=` 深链自动开搜索面板

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/components/SearchDialog.vue`（2 处 import + 文件尾追加 1 个 watch）
- Test: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/components/SearchDialog.test.ts`（mount helper 装 memory router + 新增一节）

**Interfaces:**
- Consumes: Task 1 的 `/search → /app/#/?q=<词>` 约定（含裸 `/search` → `?q=` 空值）
- Produces: 无（下游无消费方）

**为什么落在 `SearchDialog.vue` 而不是 `views/Home.vue`：** 面板本来就无条件挂在桌面路由 `/` 上（`Home.vue:9`），深链参数就是给它的。放在这里的额外好处是**开源导出侧零成本** —— `SearchDialog.vue` 整个文件已在 `oss/manifest.mjs` 的 `DELETE` 表里，放 `Home.vue` 反而要新增 `PATCH` 条目。

**⚠️ 两个已有 watcher 构成的顺序陷阱（本机已实测，两个变异都验过）：**

`SearchDialog.vue` 文件尾已有两个 watcher：
1. `watch(() => homeUi.searchOpen, …)` —— 面板**打开时** `query.value = ''` + `reset()`。
2. `watch(query, …)` —— query 一变且 `state !== 'idle'` 就 `reset()`（`reset()` 会 `epoch++`，让在途请求的结果作废）。

所以「开面板 → 种词 → 搜一次」这三步之间**必须各让一个 watcher 冲刷完**，否则：
- 不等 ①：种进去的词被它抹成 `''`，输入框空、不搜。（实测：`expected '' to be 'receipt'`）
- 不等 ②：请求发出去了，但 ② 看到 `state === 'searching'` 就 `reset()`，结果被丢弃 —— 面板停在空态提示语上，**外观酷似"搜了但什么都没搜到"**。（实测：`expected '搜索Ask Nimo输入关键词并回车…' to contain 'Receipt.pdf'`）

- [ ] **Step 1: 改测试的 mount helper（先让既有 27 例在有 router 的情况下仍全绿）**

改 `src/home/components/SearchDialog.test.ts`：

① 顶部加 import：

```ts
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
```

② 新增 helper（放在 `seedDisks()` 之后）：

```ts
// SearchDialog 从 P8 起用 useRoute()/useRouter() 消费深链 ?q=,所以挂载必须带 router 插件。
// 用 memory history 起一个只有 '/' 的最小路由表:本组件不用 <RouterView>,只要能承载 query。
// ⚠️ 不要 import 真实的 src/router —— 那会把整张路由表(全部页面组件)拖进单测。
async function mountDialog(url = '/'): Promise<Router> {
  const r = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  r.push(url)
  await r.isReady()
  wrapper = mount(SearchDialog, { attachTo: document.body, global: { plugins: [r] } })
  return r
}
```

③ 把两处裸 `mount(SearchDialog, { attachTo: document.body })` 换成 helper：
- `open()`（现 `:66`）内那一处 → `await mountDialog()`
- 用例「关闭时 DOM 里没有搜索框」（现 `:85`）那一处 → `await mountDialog()`

- [ ] **Step 2: 跑测试确认既有用例零回归**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/home/components/SearchDialog.test.ts --reporter=verbose`
Expected: PASS，**27 例全绿**（数一下条数 —— 这一步的意义就是证明装 router 没碰坏任何既有行为）。
⚠️ 用 `--reporter=verbose`：默认 reporter 不打印通过用例的 stderr，`[Vue warn]` 会隐形。若出现 Vue warn，先查清再往下走。

- [ ] **Step 3: 写失败测试（深链一节）**

在文件末尾追加：

```ts
describe('深链 ?q=(SP9-P8 cutover:Vue2 /search 绞杀到桌面)', () => {
  beforeEach(() => { setActivePinia(createPinia()); agentTool.mockReset() })
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

  // 深链场景不能复用 open():那个 helper 会先手动 openSearch() 再挂载,而深链要测的正是
  // "组件自己把面板开起来"。这里只挂载,等两轮微任务 + 两次 tick 让 watcher 链跑完。
  async function deepLink(url: string): Promise<Router> {
    seedDisks()
    const r = await mountDialog(url)
    await flushPromises(); await nextTick(); await flushPromises(); await nextTick()
    return r
  }

  it('?q=receipt:自动开面板 + 种词 + 搜一次 + 结果真的渲染出来', async () => {
    agentTool.mockResolvedValue(REAL)
    await deepLink('/?q=receipt')
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('receipt')
    expect(agentTool).toHaveBeenCalledTimes(1)
    expect(agentTool).toHaveBeenCalledWith('receipt')
    // ⚠️ 必须断言结果渲染,不能只断言"发过请求":漏掉第二次 nextTick 时请求照样发,
    //    但结果会被 query watcher 的 reset() 丢掉,只看请求次数抓不到。
    expect(document.body.textContent).toContain('Receipt.pdf')
  })

  it('消费后立刻把 q 从地址栏摘掉(关掉面板再刷新不会又弹出来)', async () => {
    agentTool.mockResolvedValue(REAL)
    const r = await deepLink('/?q=receipt')
    expect(r.currentRoute.value.query.q).toBeUndefined()
    expect(agentTool).toHaveBeenCalledTimes(1) // 摘 query 不会触发第二轮
  })

  it('?q= 空值(裸 /search 绞杀来的):开面板但不发请求', async () => {
    await deepLink('/?q=')
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })

  it('没有 q 键:面板不自动开(普通进桌面不受影响)', async () => {
    await deepLink('/')
    expect(document.body.querySelector('.searchbox')).toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })

  it('?q=a&q=b 数组形态取第一个(不把 "a,b" 当查询词发出去)', async () => {
    agentTool.mockResolvedValue(REAL)
    await deepLink('/?q=a&q=b')
    expect(agentTool).toHaveBeenCalledWith('a')
  })

  it('?q= 全空白:trim 后为空,不发请求(与 run() 的 trim 语义一致)', async () => {
    await deepLink('/?q=%20%20')
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm vitest run src/home/components/SearchDialog.test.ts --reporter=verbose`
Expected: FAIL —— 深链一节里前 3 条 + 数组那条红（面板压根不开，`.searchbox` 为 `null`）；「没有 q 键」与「全空白」两条已绿。

- [ ] **Step 5: 实现**

① `SearchDialog.vue:2` 的 vue import 加 `nextTick`：

```ts
import { ref, computed, watch, onMounted, nextTick } from 'vue'
```

② `:3` 之后加一行：

```ts
import { useRoute, useRouter } from 'vue-router'
```

③ `<script setup>` **末尾**（现有 `watch(query, …)` 之后、`</script>` 之前）追加：

```ts

// ── 深链 ?q=(SP9-P8 cutover)────────────────────────────────────────────────
// Vue2 的 /search?q=… 被绞杀到 /app/#/?q=…(strangler.js 的 passQuery 条目):新应用里没有
// 搜索页面,搜索就是桌面上的这个面板,所以深链参数落在桌面路由 '/' 上,由本组件自己消费。
// 「q 键存在」就开面板(值为空也开 —— 对位 Vue2 裸 /search 那张空搜索页);词非空才自动搜一次。
//
// ⚠️ 两次 await nextTick() 各在等一个**已有 watcher** 冲刷完,顺序不能合并、不能省:
//   ① 等上面那个 searchOpen watcher —— 它在开面板时会把 query 清空(`query.value = ''`)。
//      不等它跑完就种词,种进去的词会被它抹掉:输入框空、不搜。
//   ② 等 query watcher —— 它看到 query 变化且 state !== 'idle' 就 reset(),而 reset() 会
//      epoch++ 让在途请求的结果作废。若在它冲刷前就 performSearch(),请求照样发出去,
//      结果却被丢掉,面板停在空态提示语上 —— **外观酷似"搜了但什么都没搜到"**。
//   两条都有专门的回归用例(SearchDialog.test.ts「深链 ?q=」一节),删掉任一 tick 必红。
// 消费后立即把 q 从地址栏摘掉:① 用户关掉面板再刷新不会又弹出来;② 重新输入同一个 ?q=
// 时 watcher 仍能再次触发(值没有被卡在旧值上)。
const route = useRoute()
const router = useRouter()
watch(() => route.query.q, (raw) => {
  if (raw === undefined) return
  const seed = Array.isArray(raw) ? (raw[0] ?? '') : raw
  homeUi.openSearch()
  void (async () => {
    await nextTick() // ① 让 searchOpen watcher 先把 query 清空
    query.value = seed
    await nextTick() // ② 让 query watcher 冲刷完(此刻 state 仍是 idle,它不会 reset 掉下面这一轮)
    if (seed.trim()) performSearch()
  })()
  void router.replace({ query: { ...route.query, q: undefined } })
}, { immediate: true })
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/home/components/SearchDialog.test.ts --reporter=verbose`
Expected: PASS，**33 例全绿**（原 27 + 新 6）。

- [ ] **Step 7: 变异验证（两个 tick 各自的判别力，本机已预演过预期输出）**

1. 删掉 ①（`await nextTick()` 那行，让 `query.value = seed` 紧跟 `openSearch()`）→ 预期红：
   `AssertionError: expected '' to be 'receipt'`（第 1 条）+ 数组那条 `expected … to be called with [ 'a' ]`。
2. 删掉 ②（第二个 `await nextTick()`）→ 预期红：**只有第 1 条**，且失败信息是
   `expected '搜索Ask Nimo输入关键词并回车,搜索图片、文档、视频、音频与设置' to contain 'Receipt.pdf'`
   —— 正是"请求发了、结果被 reset 掉"的形态。

各跑一次、还原、再跑一次确认 PASS。把两次的实际失败信息摘进任务报告（用来证明这不是照抄计划，而是真的复现了）。

- [ ] **Step 8: 任务门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test
pnpm exec vue-tsc --noEmit
```
Expected: 相对基线不新增红；vue-tsc 零错。
本任务不新增 CSS、不新增 i18n key → `color-guard.test.ts` 与 `parity.test.ts` 不应有变化；若它们红，说明改多了。
⚠️ `oss/tree.test.mjs` 仍预期红（Task 3 遗留 + 本任务无新增锚点破坏）—— 留 Task 5。

- [ ] **Step 9: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short
git commit -m "feat(search): 桌面消费深链 ?q=,自动开面板并搜一次(SP9-P8 承接 Vue2 /search 绞杀)" -- src/home/components/SearchDialog.vue src/home/components/SearchDialog.test.ts
```

---

## Task 5: 开源导出清单同步 + 「产物树能构建」门

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/oss/manifest.mjs`
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/oss/tree.test.mjs`
- Test: 同上（`oss/tree.test.mjs` 自己就是测试）

**Interfaces:**
- Consumes: Task 3 改后的 `useOpenAction.ts` / `useOpenAction.test.ts` 文本，Task 4 改后的 `SearchDialog.vue`
- Produces: 无

**为什么必须有这个任务：** `oss/apply.mjs` 的 `applyPatch` 要求每个 `find` 锚点在目标文件里**恰好命中 1 次**，否则 `throw`（`apply.mjs:81/89/95`）。Task 3 改的三段文本正是三个锚点的内容，改完导出会直接报错。记忆里那句「替换会静默失效、补丁会报错」说的就是这个。

**本期受影响的锚点（Task 3/4 改动后逐一核对，不要凭这张表照抄 —— 以 `git diff` 为准）：**

| 文件 | manifest 位置 | 为什么失效 |
|---|---|---|
| `useOpenAction.ts` | `manifest.mjs:144` `SYS_ROUTE` 整块（含 3 行注释） | Task 3 把注释改成 5 行 |
| `useOpenAction.ts` | `:157` `cutoverDisabled` 整块（含 4 行注释） | Task 3 注释改成 6 行、`/#/legacy` 改成「老页面」 |
| `useOpenAction.ts` | `:166` `openApp` 三行 if 块 | Task 3 加了 settings / vm 两行 |
| `useOpenAction.test.ts` | `:584` 删「settings 维持 /#/legacy」那条用例 | Task 3 把那条用例整块换掉了 |
| `useOpenAction.test.ts` | `:592` 起两条删 flag 用例 | 检查是否被 Task 3 的 `beforeEach` 改动波及 |
| `SearchDialog.vue` | 无（整文件在 `DELETE` 表） | Task 4 的改动**零成本** |

- [ ] **Step 1: 先让门红出来，看清全部报错**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run oss/tree.test.mjs 2>&1 | tail -40`
Expected: FAIL。把**完整报错**存进 scratchpad（`/tmp/claude-1000/-home-nimo-NimoTech/*/scratchpad/oss-before.txt`），它列出的锚点缺失就是本任务的工作清单。
⚠️ 报错可能来自 `beforeAll` 里的 `export.mjs` 直接抛（锚点缺失 → 整个文件 fail 而非单条用例红）。若是那样，逐个修完再跑，一次只看第一个报错。

- [ ] **Step 2: 逐条修锚点**

对 Step 1 报出的每一处：
1. 用 `git diff -- <目标文件>` 看清改后的**逐字文本**（含全角/半角标点、缩进）。
2. 把 `manifest.mjs` 里对应的 `find` 更新成新文本。**`replace` 侧也要跟着想清楚**：开源版的语义是「系统入口全部活在本应用内、没有 cutover flag」，所以：
   - `SYS_ROUTE` 那条的 `replace` 目前是 `{ vm: '/kvm', settings: '/settings' }`，**语义不变**，只需把 `find` 换成新注释文本。
   - `cutoverDisabled` 那条 `replace: ''`（整块删）**不变**，只换 `find`。
   - `openApp` 三行块那条的 `replace` 现为「去掉 cutoverDisabled 的三行 + `router.push(SYS_ROUTE[key] || '/')`」，Task 3 加了两行 → `find` 变五行，`replace` 相应变成：
     ```
     if (key === 'appstore') { router.push('/apps/store'); return }
     if (key === 'storage') { router.push('/storage'); return }
     if (key === 'settings') { router.push('/settings'); return }
     if (key === 'vm') { router.push('/kvm'); return }
     router.push(SYS_ROUTE[key] || '/')
     return
     ```
     ⚠️ 注意 `SYS_ROUTE` 在开源版里已经是 `{ vm: '/kvm', settings: '/settings' }`，所以后两行 if 其实与兜底重复。**判断权交给实现者**：要么保留两行（与私有版形状一致、可读）、要么只留兜底（更简）。**无论选哪个，都要在任务报告里说明理由，并让 `tree.test.mjs` 的断言与之一致。** 这不是"顺手简化"，是补丁必须做的取舍。
3. `useOpenAction.test.ts` 的两条 `PATCH`：Task 3 把「settings 维持 /#/legacy」换成了四条新用例，其中两条断言回退到 `/#/legacy` / `/#/kvm` —— 开源版没有 flag，这两条行为已不存在，**照既有先例整块删除**（新增 2 条 `PATCH`，`find` 用新用例的逐字文本、`replace: ''`），并删掉那条已不存在的旧锚点。同理检查新加的「四把 flag 逐条独立」是否也要删。

- [ ] **Step 3: 更新 `tree.test.mjs` 的断言**

至少这三条会随 Step 2 变化，逐条读源、按实际产物改：
- `:109` `it('SYS_ROUTE 指内部路由,cutoverDisabled 死代码整块删除,sendToAI 整个没了', …)`
- `:133` `it('layout store 去掉 bindPhotos,homeUi 去掉 search 四项', …)`（homeUi 本期未改，应仍绿 —— 若红说明 Task 4 误碰了 homeUi）
- `:139` `it('顶栏没有搜索胶囊与 ⌘K 监听,Home.vue 不挂 SearchDialog', …)`（本期未改 Home.vue/HomeTopbar，应仍绿）

新增一条正面断言，锁住本期的产物形态：

```js
  it('SP9-P8:开源版桌面 vm/settings 磁贴走应用内路由,且产物里不留任何 strangler 回退 flag', () => {
    const s = read('src/home/composables/useOpenAction.ts')
    expect(s).toContain("router.push('/kvm')")
    expect(s).toContain("router.push('/settings')")
    expect(s).not.toContain('cutoverDisabled')
    expect(s).not.toContain('strangler:disabled')
  })
```

- [ ] **Step 4: 跑门确认全绿**

Run: `pnpm vitest run oss/tree.test.mjs 2>&1 | tail -30`
Expected: PASS，含「产物树能构建」那条（`pnpm install` + `vue-tsc --noEmit` 在产物树上全绿，约 9.4s；冷 pnpm store 会回落到网络下载，慢但不算失败）。

- [ ] **Step 5: 跑 oss 全套 + 变异验证**

```bash
pnpm vitest run oss/
```
Expected: PASS（`forbidden.test.mjs` / `apply.test.mjs` / `dist-scan.test.mjs` / `export-rsync.test.mjs` / `media-wave.test.mjs` / `tree.test.mjs`）。

变异：把 Step 2 里 `openApp` 那条 `PATCH` 的 `replace` 改回三行（漏掉 settings / vm 两行）→ 预期「产物树能构建」或 Step 3 新增的断言变红（产物里 `SYS_ROUTE[key]` 兜底虽能跑但 `cutoverDisabled` 会残留 → `not.toContain('cutoverDisabled')` 红）。还原后再跑。

- [ ] **Step 6: 任务门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit
git status --short
git commit -m "chore(oss): SP9-P8 cutover 剥离补账 —— useOpenAction 三处锚点跟改 + 产物形态断言" -- oss/manifest.mjs oss/tree.test.mjs
```

⚠️ `oss/files/README.md` 那处**预先存在**的修改不要一起提交（不在 pathspec 里就不会）。

---

## Task 6: P5 遗漏验收补跑清单（独立交付物）

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-New-UI/docs/superpowers/2026-08-05-sp9-p5-missed-acceptance.md`

**Interfaces:**
- Consumes: 无（纯文档任务，与 Task 1-5 的代码无依赖，可并行）
- Produces: 一份可直接交机主执行的清单，Task 7 的验收章节引用它

**为什么单独一个任务：** 这批**不是机主跳过的，是 P6 控制器把计划第 45 项整理成聊天版清单时把条目丢掉了**（台账 `07-p6.md` 原话：「不是机主跳过，是交付清单的遗漏」）。P6、P7 都没补，`08-p7.md` §11 点名留给 P8。混进 P8 自己的验收清单里会重犯同一个错（长清单压缩排版时丢条目），所以单独成文、单独编号。

**内容来源（逐字取自 `docs/superpowers/plans/2026-08-02-vue3-migration-sp9-p5-kvm-console.md` 的「真机验收清单」表与「本期没能验的」表 + `2026-08-03-…-p6-kvm-create.md:2133`）。**

- [ ] **Step 1: 建文件，写前置与背景**

```markdown
# SP9-P5 遗漏验收补跑清单(P8 顺带补)

**为什么有这份文件**:P5(KVM 列表 + 控制台 + 电源)的 22 条真机验收清单,机主实际只跑到
第 3 条。第 4-22 条**没有回报** —— 台账 `.superpowers/sdd/sp9/07-p6.md` 已查明:P6 控制器把
计划的第 45 项(验收清单)整理成聊天版交付给机主时**把这批漏掉了**,不是机主跳过。P6 / P7
都没补,`08-p7.md` §11 点名留给 P8。另有 P6 清单第 39 条与债务 D34 / D35 同样悬着。

**前置**:`cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273`,
浏览器开 `http://<本机IP>:5273/app/#/kvm`。
⛔ **不要 `deploy.sh`**(三条并行线共用 `/var/lib/nimoos/www/app/`,deploy 是 rsync --delete)。

**控制台黑屏排障**:浏览器直连 `ws://<本机IP>:5700`,不走网关、无鉴权。若黑屏,先在浏览器
控制台看有没有 WebSocket 连接失败;有的话是防火墙挡了 5700,不是前端问题。

**⚠️ 破坏性提示**:第 6 条会触发 Alpine 重启序列、第 13/15 条会真的停机/重启那台 VM。
不想动本机那台 `sp9-alpine-test` 就跳过对应条目并注明「跳过」,别硬跑。
```

- [ ] **Step 2: 抄 P5 第 4-22 条(逐字，编号保持原样)**

```markdown
## A · P5 清单第 4-22 条(工具条 / 六个电源动作 / 就地二次确认 / 进度遮罩 / 侧栏折叠)

| # | 点击路径 | 预期 |
|---|---|---|
| 4 | 鼠标移到控制台**右侧边缘 80px 内** | 竖排工具条从右侧滑出:Ctrl / Alt / Shift / ⊞ / Tab / Esc / ─ / Ctrl+Alt+Del / 全屏 |
| 5 | 点 `Ctrl` | 按钮变紫底白字(按住态);再点一次复原 |
| 6 | 点 `Ctrl+Alt+Del` | Alpine 控制台应有反应(通常触发重启序列);**若你不想重启这台机器就跳过此项** |
| 7 | 点全屏按钮 | 控制台铺满屏幕、圆角消失,工具条仍在;按 Esc 或再点一次退出 |
| 8 | 点控制台头右上 `⋮` | 菜单弹出。running 态应看到:强制关机 / 强制重启 / 暂停 / 开机自启。**不应有**「开机」和「删除」 |
| 9 | 点「暂停」 | 立即执行(无需确认)。VM 状态变「已暂停」、点变黄呼吸、控制台断开并出现**继续大按钮** |
| 10 | 点控制台中央的继续大按钮 | VM 回到「运行中」,控制台画面重新出现 |
| 11 | `⋮` → 点「强制关机」**一次** | 文字原地变红色「确定吗?」,**不发请求**、VM 不停 |
| 12 | 点页面别处 | 菜单收起;再打开菜单,文字应已复原成「强制关机」(确认态被清掉) |
| 13 | `⋮` → 「强制关机」点**两次** | 弹出「正在停止」遮罩;完成后 VM 变「已停止」、灰点、控制台出现**开机大按钮** |
| 14 | 点开机大按钮 | VM 回到「运行中」,控制台画面出现 |
| 15 | `⋮` → 「强制重启」点两次 | 弹出「正在重启」遮罩;VM 保持运行,控制台**先断开,几秒后自动重连**(这是修过 Vue2 竞态的地方,重点看它会不会卡在红字错误上) |
| 16 | `⋮` → 点「开机自启」 | 左侧小圆点由灰变绿;再点一次变回灰 |
| 17 | 停机后 `⋮` | 应出现「开机」和「删除」,且「删除」上方有一条分隔线 |
| 18 | 点「删除」**一次** | 文字变红「确定吗?」。**⛔ 到此为止,不要点第二次**(第二次删除已由 P6 第 42 条验过) |
| 19 | 看左栏底部「添加虚拟机」按钮 与 头部齿轮 | ⚠️ **本条已过期**:P5 时两者是灰色「即将支持」,P6 已解禁。现在应当**可点**,点了分别开创建向导与全局设置 |
| 20 | 看控制台头的齿轮(Settings) | ⚠️ **同样已过期**:P6 已解禁,应可点并打开 VM 设置弹窗 |
| 21 | 点左栏与控制台之间那个竖条按钮 | 侧栏收起、按钮翻转到最左;鼠标移到最左侧栏区域,侧栏**临时滑出**,移开又收回 |
| 22 | 把浏览器拖窄到 ~420px | 侧栏变成全宽抽屉;控制台不横向溢出 |
```

⚠️ 第 19/20 条**必须带上那两句「已过期」订正** —— P5 写清单时那三个入口还是灰的，P6 把它们解禁了。照抄原文会让机主按错的预期去验，然后报一个假缺陷。**这正是「具体计数/状态有保质期」那条教训的同款场景。**

- [ ] **Step 3: 抄 P6 第 39 条 + D34 / D35**

```markdown
## B · P6 清单第 39 条

| # | 点击路径 | 预期 |
|---|---|---|
| 39 | 选一台**运行中**的 VM(本机 `sp9-alpine-test`),齿轮若是灰的就先建/启一台可编辑的 VM,进设置弹窗的「快照」tab | 「恢复」按钮**灰色不可点**(照 Vue2 `:368`:`vmState !== 'stopped'` 时 disabled) |

## C · 两条挂账债务(能造出条件就验,造不出就维持挂账)

| 编号 | 内容 | 需要的条件 | 造不出时的处置 |
|---|---|---|---|
| **D34** | `wakeup`(唤醒) | VM 处于 `suspended` 态 —— 需 libvirt managedsave / S3,本机造不出 | 按交付政策二不列验收项,维持单测覆盖派生与调用。**明确记「仍未验」,不要写成通过** |
| **D35** | SPICE 提示条(显示条件 + 180s 自动收起) | `bootFromDisk=true` **且** `spicePort>0` | P6 第 41 条点完「我已完成安装」后 `bootFromDisk` 确实变 true,理论上存在可验窗口。若本机 `spicePort` 仍为 0,记「仍未验」 |
```

- [ ] **Step 4: 写回报格式 + 交付说明**

```markdown
## 回报格式

请按编号逐条回 `✅` / `❌ + 现象` / `⏭ 跳过 + 原因`。**编号别合并、别压缩** —— 这份清单本身
就是因为「整理成聊天版时丢条目」才出现的。

## 交付说明

本清单与 P8 自己的验收清单**分开跑、分开回报**。可以一次开 dev server 跑完两份,
但回报时请分成两段,免得又出现"某一批整体没被回报"。
```

- [ ] **Step 5: 自检条目数**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
# A 节应恰好 19 行数据行(第 4-22 条)
awk '/^## A ·/,/^## B ·/' docs/superpowers/2026-08-05-sp9-p5-missed-acceptance.md | grep -c '^| [0-9]'
# 预期 19
# 编号连续性:应打印 4..22 无缺号
awk '/^## A ·/,/^## B ·/' docs/superpowers/2026-08-05-sp9-p5-missed-acceptance.md | grep -o '^| [0-9]*' | tr -d '| '
```
Expected: `19`，且编号 4,5,…,22 连续无缺。**这一步就是"逐项核对编号"教训的程序化落实，不能只肉眼看。**

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add docs/superpowers/2026-08-05-sp9-p5-missed-acceptance.md
git commit -m "docs(sp9): 编制 P5 遗漏验收补跑清单(第 4-22 条 + P6 第 39 条 + D34/D35)" -- docs/superpowers/2026-08-05-sp9-p5-missed-acceptance.md
```

⚠️ `docs/` 整个目录在 `oss/manifest.mjs` 的 `DELETE` 表里（E7「一份文档都不带」），新增文档**不需要**改 manifest。

---

## Task 7: 台账 / spec / roadmap 落盘 + SP9 收官

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp9/09-p8.md`
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp9-final-views-design.md`（§8 与 §11）
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md`（§4 SP9）

**Interfaces:**
- Consumes: Task 1-6 的全部坐标 commit 与实测结论
- Produces: 无

- [ ] **Step 1: 写台账 `09-p8.md`**

必须包含这些节（内容以实际执行结果为准，不要照抄计划的预期）：

1. **最终坐标** —— 两仓各任务的 commit hash + 分支 + 「未推 origin / 未部署」状态。
2. **测试计数（附取数命令）** —— New-UI `pnpm test` 的文件数/例数、NimoOS-UI 的同样两个数。⚠️ **数字有保质期，随行写下取数命令**。
3. **spec §8 的实测订正** —— 至少这三条已在计划阶段查实，实现时若有新增一并补：
   - spec §8 只写了「加 `passQuery: true` 分支，或做成 prefix 条目」，没提**裸 `/search`（无查询串）落到桌面后面板不会开**。本期加了 `defaultQuery: '?q='` 解决，属计划阶段发现的 spec 缺口。
   - spec §8 说「Vue2 侧弹设置模态的调用处改成 …」但没说是**哪几处**。实测是 2 处：`AppCard.vue:219`（真活入口）与 `Home.vue:101`（**EventBus 无 emitter，是死路径**，仍按同规格接线）。
   - spec §8 完全没提**开源导出清单会被打断**（`useOpenAction.ts` 三个锚点）。P8 因此多一个任务。
4. **申报偏离登记** —— 本期预期只有一处文字订正（`useOpenAction.ts` 注释里 `/#/legacy` → 「Vue2 老页面」，因为 vm 回退去的是 `/#/kvm` 不是 legacy）。若实现中出现别的，逐条登记。
5. **两个 nextTick 的实测证据** —— Task 4 Step 7 两次变异的实际失败信息原文。**这是本期最容易被后人"简化掉"的代码，证据必须留在台账里。**
6. **新增债务** —— 编号接台账最大值往后取（P7 用到 D43，本期从 **D44** 开始）。已知候选：
   - `AppCard.vue:232 showKVM()` + `Home.vue:253 showKVMPanel()` + `events.SHOW_KVM_PANEL` 是一条**零调用方的死链**（emit 只在 `showKVM` 里、而 `showKVM` 没有调用方）。本期按「不删 Vue2 代码」原样保留、也没接 cutover —— 若将来被重新接上，它会绕过 `/kvm` 绞杀直接弹 Vue2 面板。归 SP10 删除批。
   - `Home.vue:87 SHOW_SETTINGS_PANEL` 监听同样无 emitter（本期已接线，风险已消，仅记形态）。
   - Esc 缺陷（预览开着按一次 Esc 连搜索面板一起关，`08-p7.md` §8 D-A，先于本期存在）—— 本期未修，确认仍挂账。
7. **验收结果** —— 机主回报后回填（含 Task 6 那份清单的结果，分两段记）。
8. **SP9 收官小结** —— P0-P8 全期一句话状态表。

- [ ] **Step 2: 改 spec**

- §8 末尾追加一小节「P8 实测订正（2026-08-05）」，把 Step 1 第 3 项的三条写进去。**不要改 §8 原有文字** —— 后人对照的是原文加订正，直接改会丢掉"spec 曾经这么写"的信息（这条规矩来自 `08-p7.md` §7）。
- §11 债务表**不回填**（表头已声明 D16 起登记在台账与 roadmap，不回填本表）。
- 机主验收通过后，在 §8 之后追加「P8 验收结果」小节（照 §6 「P6 验收结果」的格式）。

- [ ] **Step 3: 改 roadmap（改前先看对方 HEAD）**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git log --oneline -1 -- docs/vue3-migration-roadmap.md
git status --short
```
然后在 §4 SP9 里补 P8 关账段 + **SP9 全区收官**声明，并同步 §3.3 追踪表里 P8 相关的行（D10 那条列的更新项）。**改动尽量小、改完立刻提交**（sp7 会话也在写这个文件）。

- [ ] **Step 4: 提交（两仓分别提交）**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add .superpowers/sdd/sp9/09-p8.md
git status --short
git commit -m "docs(sp9): P8 cutover 台账 + spec §8 实测订正" -- .superpowers/sdd/sp9/09-p8.md docs/superpowers/specs/2026-07-31-vue3-migration-sp9-final-views-design.md

cd /home/nimo/NimoTech/NimoOS-UI
git status --short
git commit -m "docs(roadmap): SP9-P8 cutover 关账,SP9 收尾视图全区收官" -- docs/vue3-migration-roadmap.md
```

⚠️ `.superpowers` 整个目录在 `oss/manifest.mjs` 的 `DELETE` 表里（`1c80ae1` 加的），新增台账**不需要**改 manifest。

---

## 真机验收清单（P8 自己的，交机主；与 Task 6 那份分开回报）

**前置**：`cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host --port 5273`，浏览器开 `http://<本机IP>:5273/app/`。
⛔ **不要 `deploy.sh`**。
⚠️ **开工前先 `rm -rf node_modules/.vite`**（或 `pnpm dev --force`）：Vite 给包内模块 import 拼的 `?v=<depHash>` 带 `immutable` 缓存，而 depHash 算的是依赖清单不是文件内容 —— P7 就因此让机主看到一个假的"搜索服务不可用"。本期虽未改共享包，但成本为零，照做。

**A · cutover 正向（默认状态，不设任何 flag）**

| # | 点击路径 | 预期 |
|---|---|---|
| 1 | 新桌面点「设置」磁贴 | **不整页跳**，应用内进设置页；地址栏 `#/settings/<上次的 tab>` |
| 2 | 新桌面点「虚拟机」磁贴 | 应用内进 KVM 页；地址栏 `#/kvm` |
| 3 | 地址栏手输 `http://<IP>/#/kvm`（**Vue 2 侧的地址，注意没有 `/app`**） | 整页跳到 `/app/#/kvm`，看到新 KVM 页 |
| 4 | 地址栏手输 `http://<IP>/#/search?q=receipt` | 整页跳到 `/app/#/?q=receipt`；**搜索面板自动打开、输入框里是 `receipt`、结果已经出来了**（不用再按回车） |
| 5 | 看第 4 条跳完后的地址栏 | `?q=` 已被摘掉（只剩 `/app/#/`）；此时按 Esc 关面板再刷新，面板**不会**又弹出来 |
| 6 | 地址栏手输 `http://<IP>/#/search`（不带 `?q=`） | 跳到 `/app/#/?q=`；面板打开、输入框空、**没有发起搜索**（不显示"搜索中"也不显示结果） |
| 7 | 老桌面（`http://<IP>/#/legacy`）点「设置」磁贴 | 整页跳到 `/app/#/settings`，**不弹**老的设置模态 |
| 8 | 老桌面点「KVM」磁贴 | 新标签打开，落到 `/app/#/kvm`（Vue 2 的 `window.open('/#/kvm')` 被守卫接管） |

**B · 回退可逆（逐条来：设 flag → 验 → 清 flag）**

在浏览器控制台（**Vue 2 与新应用同源，一次设置两侧同时生效**）执行，每验完一条就 `localStorage.removeItem(...)` 清掉再验下一条。

| # | 设置 | 预期 |
|---|---|---|
| 9 | `localStorage.setItem('strangler:disabled:/settings','1')` 后刷新 | 新桌面「设置」磁贴 → 整页跳 `/#/legacy` 老桌面；在老桌面点「设置」磁贴 → **弹出 Vue 2 老设置模态**（能正常打开、能操作、能关） |
| 10 | `localStorage.setItem('strangler:disabled:/kvm','1')` 后刷新 | 新桌面「虚拟机」磁贴 → 整页跳 `/#/kvm`，看到 **Vue 2 老 KVM 全页**（不再被弹回新应用）；老桌面点「KVM」磁贴 → 新标签也停在 Vue 2 老页 |
| 11 | `localStorage.setItem('strangler:disabled:/search','1')` 后刷新 | 地址栏输 `http://<IP>/#/search?q=receipt` → **停在 Vue 2 老全页搜索页**，词是 `receipt`，能正常出结果 |
| 12 | 三把 flag 一起设上 | 三条老路都走得通；`/files`（SP4）、`/`（SP3）、存储与应用商店（SP5/SP6）**照旧走新应用**，没被顺带关掉 |
| 13 | 三把 flag 全清掉后刷新 | 回到 A 节的行为，第 1-8 条重跑一遍应全部一致（**证明回退是真可逆，不是单向门**） |

**C · 没碰坏别人**

| # | 点击路径 | 预期 |
|---|---|---|
| 14 | 新桌面 ⌘K / Ctrl+K 开搜索面板，输 `invoice` 回车 | 与 P7 验收时行为一致（结果、降级提示条、亮/暗两套主题都不变） |
| 15 | 新桌面点文件 / 存储 / 应用商店三个磁贴 | 各自照旧进 `/files`、`/storage`、`/apps/store` |
| 16 | 亮色 / 暗色主题各看一遍第 1、2、4 条 | 无配色异常（本期不新增 CSS，若有异常即缺陷） |

**回报格式**：按编号逐条回 `✅` / `❌ + 现象` / `⏭ 跳过 + 原因`。编号别合并、别压缩。

---

## 自查（写 plan 时已跑）

**spec 覆盖（§8 逐项对照）：**

| spec §8 要求 | 落点 |
|---|---|
| `migratedRoutes` 加 `/kvm → /app/#/kvm` | Task 1 Step 3 |
| `migratedRoutes` 加 `/search → /app/#/?q=`，新增查询串透传能力 | Task 1 Step 7 |
| 连 `__tests__/strangler.spec.js` 一起补测试 | Task 1 Step 1/5/10 |
| New-UI 首页支持 `?q=` 自动开面板搜索 | Task 4 |
| `migratedEntries` 加 `/settings`，Vue 2 调用处改 `resolveEntryTarget` + `window.location.href` | Task 1 Step 12 + Task 2 |
| `SYS_ROUTE` 的 `vm` / `settings` 翻新路由，各带 `cutoverDisabled('/kvm')` / `cutoverDisabled('/settings')` | Task 3 Step 3 |
| 吸取 SP6-P1 教训：磁贴与 flag 同任务落齐 | Task 3（一个任务里两个磁贴 + 两个 flag + 变异验证 Step 5） |
| 逐条验证回退可逆（三把 flag） | Task 1 Step 1/5/10 的单测 + Task 2 Step 1/5 的单测 + Task 3 Step 1 的单测 + 验收清单 B 节 9-13 条 |
| 不删任何 Vue 2 代码 | Global Constraints + Task 2 Step 9 的反向检查 |
| P5 验收清单第 4-22 条 + 第 39 条 + D34/D35 补跑（`08-p7.md` §11） | Task 6（独立任务） |
| spec §9 三线并发约束 | Global Constraints「git 纪律」+「不碰 .sp7/.sp8」+ 任务门「相对基线不新增红」 |
| spec §10 全程硬约束 | Global Constraints「硬约束」整节 |

**spec 未覆盖、本计划补上的：**
- `defaultQuery` —— spec 没考虑裸 `/search` 落到桌面后面板不开（Task 1 背景已说明理由）。
- Vue 2 设置模态调用处的**具体位置与数量**（2 处，其中 1 处是死路径）—— spec 只说"调用处"。
- **开源导出清单会被 `useOpenAction.ts` 的改动打断** —— spec §8 完全没提，Task 5 专门处理。
- 两个 `nextTick` 的顺序陷阱 —— spec 只说"支持 `?q=` 自动开面板搜索"，没提这是两个已有 watcher 的交互；已在本机实测并给出两个变异的预期输出。

**类型/命名一致性核对：**
- `passQuery` / `defaultQuery` 在 Task 1 定义（`strangler.js` 的条目字段 + `resolveTarget` 分支），只被 `resolveTarget` 自己消费，无跨任务签名。
- `resolveEntryTarget('/settings')` 在 Task 1 落表、Task 2 两处消费，参数与返回（`string | null`）一致。
- flag 键名三处必须逐字一致：`strangler:disabled:/kvm` / `:/settings` / `:/search` —— Task 1（Vue 2 侧 `flagKey()` 拼）、Task 3（New-UI 侧 `cutoverDisabled()` 拼）、验收清单 B 节。已逐字比对。
- `SYS_ROUTE` 的 key 是 `vm`（不是 `kvm`），路由是 `/kvm`。Task 3 的 `openApp('vm')` 与 `cutoverDisabled('/kvm')` 两者故意不同名 —— 磁贴 key 来自 apps store，flag 名来自路由路径。已在 Task 3 变异验证里专门锁住（写错键名必红）。
- `mountDialog` 在 Task 4 Step 1 定义、Step 3 的 `deepLink` 消费，签名 `(url?: string) => Promise<Router>` 一致。

**已在本机实测、不是推测的部分：**
- `strangler.js` / `strangler.spec.js` / `useOpenAction.ts` / `useOpenAction.test.ts` / `SearchDialog.vue` / `homeUi.ts` / `settingsRoutes.ts` / Vue 2 `route.js` `Home.vue` `AppCard.vue` `Search.vue` `SearchBar.vue` 的行号与逐字内容 —— 全部读过。
- Vue 2 `/search` 用的查询参数名是 `q`（与 New-UI 要消费的一致）。
- Vue 2 打开 `SettingsPanel` 的调用处恰好 2 处，`SHOW_SETTINGS_PANEL` / `SHOW_KVM_PANEL` 都无 emitter。
- `AppCard.vue` 在 Vitest 下只需 mock 3 个 `.vue` 子依赖即可加载并直调 `methods.showSettings`（跑通过）。
- `SearchDialog.vue` 挂 memory router 插件可用；`?q=` 四种形态（有词 / 空 / 无 / 数组）行为如 Task 4 所述，且 `router.replace` 摘 `q` 不会触发第二轮请求（4 条探针全绿）。
- 两个 `nextTick` 的变异输出与 Task 4 Step 7 写的一字不差（都实跑过）。
- New-UI 是 hash 路由（`createWebHashHistory('/app/')`），`#/?q=x` 能被 `route.query.q` 读到。

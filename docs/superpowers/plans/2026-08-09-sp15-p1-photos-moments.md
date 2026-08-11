# SP15-P1 相册区 Moments 整块 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 的 Moments（时刻）整块补迁到 New-UI —— 智能视图页顶部的「Moments · For You」分区（马赛克卡片 + 拖拽排序）与时刻详情页（路由化，含 pin/exclude/删除/导出相册）。

**Architecture:** 数据层新增 8 个 service 方法 + 一个 Pinia store；马赛克尺寸/模板计算抽成无副作用的纯函数模块单独单测；列表分区挂进现有 `PhotosSmartViews.vue`；详情页是**新路由** `/photos/moments/:id`，复用 `PhotosSmartViewDetail.vue` 已有的 `sv-detail-*` 两栏骨架与样式类。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia（setup 风格）· vue-router 4（hash）· vue-i18n 9 · sortablejs（已是依赖）· Vitest + @vue/test-utils + jsdom

---

## Global Constraints

以下每条对**每个任务**都成立，任务正文不再重复。

1. **1:1 靶子是 Vue2 `899af59b`（`#111`），不是 `origin/main`。** `#112` 把智能视图整个搬去了 Albums 页、`PhotosSmartViewsView.vue` 从 728 行缩到 346 行成为纯 Moments 页 —— 那是 **P2** 的范围。照 `origin/main` 做会把 P2 的 IA 改动提前带进来。取源码一律：`git -C ../../../../NimoOS-UI show 899af59b:<path>`（相对本 worktree；绝对路径 `/home/nimo/NimoTech/NimoOS-UI`）。
2. **颜色一律 theme token，禁裸色字面量**（`#fff` / `rgba()` / 具名色）。本期需要的橙色语义用已存在的 `--warn-fg` / `--warn-bg` / `--warn-border`（两套主题都有取值，`src/styles/theme.css:155-157` 与 `:511-513`）。发际线用 `--divider`。确实必须固定色的（压在照片上的文字）写 `/* theme-exception: … */` 注释说明理由，照 `SmartViewCard.vue:171-174` 的先例。
3. **CSS 注释里禁止出现 `*` 紧贴 `/`**（如 `2*/3`、`*/`）—— 会提前关闭注释、错误恢复吃到下一个块结束、**吞掉整条规则**，而 tsc / build / jsdom / color-guard 五道门全部照不出来。写比例请用「三分之二」或 `2 / 3`（带空格）。
4. **新增 i18n 键必须同时进 `src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts`**，键名前缀 `photosMo*`。`src/i18n/parity.test.ts` 会断言两侧键完全一致。中文文案**以 Vue2 的 `zh_CN.json` 为准，不要自己译**；Vue2 组件内联的 `zh:` 字段也要查。
5. **`toLocaleString` / `toLocaleDateString` 必须传 BCP-47 标签**：本仓 locale 是 `zh_cn`/`en_us`（下划线），裸传会抛 `RangeError`。写法 `locale.value.replace('_', '-')`，先例 `SmartViewCard.vue:38`。
6. **异步写共享 state 必须带过期守卫**（epoch/uuid），且回归测试要走**交错路径**（先发 A、再发 B、让 A 后返回，断言 A 的结果没有覆盖 B）。这类竞态在本仓已被终审逮过四次。
7. **测试证据一律 `--reporter=verbose` 并数条数** —— 默认 reporter 不打印通过用例的 stderr，`[Vue warn]` 会隐形。测试里**不要另建 `createI18n` 之外的第二个 i18n 实例挂到全局**（与 setup 单例重复安装）。
8. **测试里读 `.css` / `.vue` 源文本一律用 `node:fs`**，`?raw` 在本仓恒为空（color-guard 曾因此空转）。
9. **提交信息全英文**，祈使句主题行 + 解释「为什么」的正文。
10. **不碰 `src/files/**`** —— `sp12-files-fixes` 分支正在那里工作。唯一的共享面是 `src/i18n/*.base.ts`（本期不改它，只改 `*.photos.ts`）。

### 后端契约（已回源核对 `NimoOS-Photos/route/v1/moments.go`，**不要凭印象改**）

| 端点 | 响应 |
|---|---|
| `GET /photos/moments` | `{ "moments": [ … ] }` |
| `GET /photos/moments/:id/assets?featured=1&with_members=1` | 带 `with_members=1` → `{ assets, members:[{asset_id,manual,featured}], places:[{name,count}] }`；**不带 → 裸数组** |
| `POST /photos/moments/:id/assets` `{ids}` | `{ ok: true, asset_count: n }` |
| `DELETE /photos/moments/:id/assets` `{ids}` | 同上 |
| `DELETE /photos/moments/:id` | — |
| `POST /photos/moments/:id/album` | **201** `{ albumId, name, count }` |
| `PUT /photos/moments/order` `{ids}` | — |
| `POST /photos/moments/recompute` | 202（**本期不接 UI 入口**） |

`momentResponse` 字段（snake_case，与本文件其它 camelCase 端点不同，这是后端有意为之）：
`id` · `title` · `subtitle` · `cover_asset_id?` · `asset_count` · `time_from?` · `time_to?` · `place?` · `recipe_key` · `named_by_llm` · `sort_order?` · `featured_asset_ids`（**恒是数组**）· `added_this_week`（**恒输出**）· `cover_ratio`（**恒输出**，0 = 未知）。

> **⚠️ 后端不返 `updated_at`。** Vue2 的 `lastUpdated` 读 `moment.updated_at`，该字段在 `momentResponse` 里**根本不存在** ⇒ Vue2 顶栏的「Last updated」与右栏 Stats 的「Last update」格**永远显示 `—`**。这不是本期引入的缺陷，是 Vue2 的既有死路径。处理办法见 Task 7 Step 1 的注释要求：**保留 `—` 的渲染结果（视觉 1:1），把类型字段留成可选并写明后端当前不发**，不要为它引入永远不会执行的 `relTime` 调用。

### 收尾门（Task 11 统一跑，控制器亲自复跑，不转述实现者的话）

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/1bca60c8-eec9-4053-a989-93051553eaf2/scratchpad/oss-out --no-commit --allow-dirty-oss
pnpm build
```

**已知非缺陷，看到别去追**：全量套件的 jsdom `Not implemented: navigation` 噪声；`src/home/components/DesktopContextMenu.test.ts` 只在单跑该文件时失败（SP11 遗留 reka-ui 隔离 flake）；`src/files/upload/persist.test.ts:55` 偶发红（SP4 期既有 flake）。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `packages/service/src/photos.ts` | HTTP 层：8 个 moments 方法 | 修改（在「智能视图」段之后、「回收站」段之前插入） |
| `packages/service/src/photos.moments.test.ts` | 上述 8 个方法的 URL / 参数 / 解包断言 | 新建 |
| `src/photos/util/momentLayout.ts` | 马赛克尺寸与模板的**纯函数**（无 Date/random/DOM） | 新建 |
| `src/photos/util/__tests__/momentLayout.test.ts` | 上述纯函数 | 新建 |
| `src/photos/stores/moments.ts` | Moment 类型 + 归一 + 列表/详情状态 + 全部写操作 | 新建 |
| `src/photos/stores/__tests__/moments.test.ts` | store | 新建 |
| `src/photos/components/MomentCard.vue` | 单张时刻卡（五种拼贴形态） | 新建 |
| `src/photos/components/__tests__/MomentCard.test.ts` | 卡片 | 新建 |
| `src/photos/composables/useAlbumDragSort.ts` | 拖拽排序（**加三个可选参数**，默认值保持相册页行为不变） | 修改 |
| `src/photos/composables/__tests__/useAlbumDragSort.test.ts` | 补新参数的用例 | 修改 |
| `src/views/PhotosSmartViews.vue` | 顶部挂 For You 分区 + 拖拽 | 修改 |
| `src/views/PhotosSmartViews.test.ts`（或既有同名测试） | 分区门控与排序 | 修改/新建 |
| `src/views/PhotosMomentDetail.vue` | 时刻详情页（路由页） | 新建 |
| `src/views/PhotosMomentDetail.test.ts` | 详情页 | 新建 |
| `src/router/index.ts` | 追加 `/photos/moments/:id` | 修改 |
| `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts` | `photosMo*` 文案 | 修改 |

---

## Task 1: service 层 —— 8 个 moments 方法

**Files:**
- Modify: `packages/service/src/photos.ts`（在 `exportSmartViewAlbum` 之后、`// ─── 回收站 ───` 之前插入新段）
- Test: `packages/service/src/photos.moments.test.ts`（新建）

**Interfaces:**
- Consumes: 同文件已有的 `body<T>()` 解包helper 与 `http`
- Produces: `service.photos.listMoments()` · `getMomentAssets(id, featured?, withMembers?)` · `pinMomentAssets(id, ids)` · `excludeMomentAssets(id, ids)` · `deleteMoment(id)` · `exportMomentAlbum(id)` · `reorderMoments(ids)` · `recomputeMoments()`

- [ ] **Step 1: 写失败的测试**

新建 `packages/service/src/photos.moments.test.ts`：

```ts
// SP15-P1-T1: moments HTTP 层。回源核对 NimoOS-Photos/route/v1/moments.go —
// List 返回 {moments:[…]}(带包裹键,不是裸数组);Assets 带 with_members=1 时返回
// {assets,members,places},不带时是裸数组;Pin/Exclude 返回 {ok,asset_count};
// CreateAlbum 返回 201 {albumId,name,count}。
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; params?: unknown; body?: unknown; cfg?: unknown }

function harness(reply: unknown = {}) {
  const calls: Call[] = []
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => {
      calls.push({ method: 'get', url, params: cfg?.params }); return { data: reply }
    },
    post: async (url: string, body?: unknown) => {
      calls.push({ method: 'post', url, body }); return { data: reply }
    },
    put: async (url: string, body?: unknown) => {
      calls.push({ method: 'put', url, body }); return { data: reply }
    },
    delete: async (url: string, cfg?: unknown) => {
      calls.push({ method: 'delete', url, cfg }); return { data: reply }
    },
  } as unknown as AxiosInstance
  return { calls, photos: createPhotos(http, () => 'TOK') }
}

describe('photos moments API', () => {
  it('listMoments 解出 moments 数组,缺字段时兜底空数组', async () => {
    const a = harness({ moments: [{ id: 'm1' }] })
    expect(await a.photos.listMoments()).toEqual([{ id: 'm1' }])
    expect(a.calls[0]).toMatchObject({ method: 'get', url: '/photos/moments' })

    const b = harness({})
    expect(await b.photos.listMoments()).toEqual([])
  })

  it('getMomentAssets 只在为真时才带 featured / with_members 查询参数', async () => {
    const a = harness([])
    await a.photos.getMomentAssets('m1')
    expect(a.calls[0]).toMatchObject({ url: '/photos/moments/m1/assets', params: {} })

    const b = harness({ assets: [], members: [], places: [] })
    await b.photos.getMomentAssets('m1', true, true)
    expect(b.calls[0].params).toEqual({ featured: 1, with_members: 1 })
  })

  it('getMomentAssets 原样返回两种形状(裸数组 / {assets,members,places}),不在这层归一', async () => {
    const bare = harness([{ id: 'a1' }])
    expect(await bare.photos.getMomentAssets('m1')).toEqual([{ id: 'a1' }])

    const wrapped = harness({ assets: [{ id: 'a1' }], members: [{ asset_id: 'a1', manual: true, featured: false }], places: [{ name: 'X', count: 2 }] })
    expect(await wrapped.photos.getMomentAssets('m1', true, true)).toEqual({
      assets: [{ id: 'a1' }],
      members: [{ asset_id: 'a1', manual: true, featured: false }],
      places: [{ name: 'X', count: 2 }],
    })
  })

  it('pinMomentAssets / excludeMomentAssets 传 {ids} 并回传 asset_count', async () => {
    const a = harness({ ok: true, asset_count: 7 })
    expect(await a.photos.pinMomentAssets('m1', ['x', 'y'])).toEqual({ ok: true, asset_count: 7 })
    expect(a.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/m1/assets', body: { ids: ['x', 'y'] } })

    const b = harness({ ok: true, asset_count: 5 })
    expect(await b.photos.excludeMomentAssets('m1', ['x'])).toEqual({ ok: true, asset_count: 5 })
    // axios 的 delete 请求体必须放在 config.data 里,不能当第二位置参数
    expect(b.calls[0]).toMatchObject({ method: 'delete', url: '/photos/moments/m1/assets', cfg: { data: { ids: ['x'] } } })
  })

  it('deleteMoment / exportMomentAlbum / reorderMoments / recomputeMoments 打对 URL', async () => {
    const a = harness({})
    await a.photos.deleteMoment('m1')
    expect(a.calls[0]).toMatchObject({ method: 'delete', url: '/photos/moments/m1' })

    const b = harness({ albumId: 'al1', name: 'Trip', count: 12 })
    expect(await b.photos.exportMomentAlbum('m1')).toEqual({ albumId: 'al1', name: 'Trip', count: 12 })
    expect(b.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/m1/album', body: {} })

    const c = harness({})
    await c.photos.reorderMoments(['b', 'a'])
    expect(c.calls[0]).toMatchObject({ method: 'put', url: '/photos/moments/order', body: { ids: ['b', 'a'] } })

    const d = harness({})
    await d.photos.recomputeMoments()
    expect(d.calls[0]).toMatchObject({ method: 'post', url: '/photos/moments/recompute', body: {} })
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run packages/service/src/photos.moments.test.ts --reporter=verbose`
Expected: FAIL —— `a.photos.listMoments is not a function`

- [ ] **Step 3: 实现**

在 `packages/service/src/photos.ts` 的 `exportSmartViewAlbum` 之后插入：

```ts
    // ─── Moments(自动聚合的高光时刻,智能视图页 "For You" 分区)───
    // 回源核对 NimoOS-Photos/route/v1/moments.go:List 用 {moments:[…]} 包裹键(与本文件
    // 其它裸数组端点不同);字段是 snake_case(后端注释写明是有意为之)。归一到驼峰在
    // store 层做,这一层只负责取出包裹键。
    async listMoments(): Promise<unknown[]> {
      const res = await http.get('/photos/moments')
      return body<{ moments?: unknown[] } | undefined>(res.data)?.moments ?? []
    },
    // withMembers=true 时后端返回 {assets,members,places};不带时是裸数组。
    // 两种形状原样上抛,由 store 分辨——这层不做归一,免得两个消费方口径分叉。
    async getMomentAssets(id: string, featured = false, withMembers = false): Promise<unknown> {
      const params: Record<string, number> = {}
      if (featured) params.featured = 1
      if (withMembers) params.with_members = 1
      const res = await http.get(`/photos/moments/${id}/assets`, { params })
      return body<unknown>(res.data)
    },
    async pinMomentAssets(id: string, ids: string[]): Promise<{ ok?: boolean; asset_count?: number }> {
      const res = await http.post(`/photos/moments/${id}/assets`, { ids })
      return body<{ ok?: boolean; asset_count?: number }>(res.data) ?? {}
    },
    // axios 的 delete 没有 body 位置参数,请求体必须走 config.data。
    async excludeMomentAssets(id: string, ids: string[]): Promise<{ ok?: boolean; asset_count?: number }> {
      const res = await http.delete(`/photos/moments/${id}/assets`, { data: { ids } })
      return body<{ ok?: boolean; asset_count?: number }>(res.data) ?? {}
    },
    async deleteMoment(id: string): Promise<unknown> {
      const res = await http.delete(`/photos/moments/${id}`)
      return body<unknown>(res.data)
    },
    async exportMomentAlbum(id: string): Promise<{ albumId?: string; name?: string; count?: number }> {
      const res = await http.post(`/photos/moments/${id}/album`, {})
      return body<{ albumId?: string; name?: string; count?: number }>(res.data) ?? {}
    },
    async reorderMoments(ids: string[]): Promise<unknown> {
      const res = await http.put('/photos/moments/order', { ids })
      return body<unknown>(res.data)
    },
    // 后端 202 + 异步重算。本期**不接 UI 入口**(Vue2 也没有,见 spec §1.2);
    // 保留方法是为验收时能在浏览器控制台里调用。
    async recomputeMoments(): Promise<unknown> {
      const res = await http.post('/photos/moments/recompute', {})
      return body<unknown>(res.data)
    },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run packages/service/src/photos.moments.test.ts --reporter=verbose`
Expected: PASS，5 个用例

- [ ] **Step 5: 提交**

```bash
git add packages/service/src/photos.ts packages/service/src/photos.moments.test.ts
git commit -m "feat(photos): add the moments HTTP methods

Ported from Vue 2 src/service/photos.js:164-183. The list endpoint wraps its
payload in a \"moments\" key rather than returning a bare array, and the assets
endpoint changes shape depending on with_members, so both quirks are asserted
rather than assumed. Normalisation to camelCase is deliberately left to the
store so the two callers cannot drift apart."
```

---

## Task 2: 马赛克布局纯函数

**Files:**
- Create: `src/photos/util/momentLayout.ts`
- Test: `src/photos/util/__tests__/momentLayout.test.ts`

**Interfaces:**
- Consumes: 无（不 import 任何东西，纯计算）
- Produces:
  - `type MomentSize = 'standard' | 'wide' | 'tall'`
  - `type MomentTemplate = 'T1' | 'T2' | 'T3' | 'T4' | 'single'`
  - `interface MomentLayoutInput { id: string; recipeKey: string; assetCount: number; coverRatio: number; featuredAssetIds: string[] }`
  - `classifyMomentSize(m: MomentLayoutInput): MomentSize`
  - `pickMomentTemplate(size: MomentSize, featuredCount: number): MomentTemplate`
  - `assignMomentSizes(list: MomentLayoutInput[]): Record<string, { size: MomentSize; template: MomentTemplate }>`

- [ ] **Step 1: 写失败的测试**

新建 `src/photos/util/__tests__/momentLayout.test.ts`：

```ts
// SP15-P1-T2: 马赛克尺寸/模板纯函数。逐条照 Vue2 899af59b:src/views/Photos/
// PhotosSmartViewsView.vue:322-357(classifyMomentSize/pickMomentTemplate/
// assignMomentSizes)移植,规则一字不改。
import { describe, it, expect } from 'vitest'
import { classifyMomentSize, pickMomentTemplate, assignMomentSizes, type MomentLayoutInput } from '../momentLayout'

function m(over: Partial<MomentLayoutInput> = {}): MomentLayoutInput {
  return { id: 'x', recipeKey: 'theme:food', assetCount: 10, coverRatio: 1.5, featuredAssetIds: ['a', 'b'], ...over }
}

describe('classifyMomentSize', () => {
  it('竖版封面(0 < ratio < 0.85)判 tall,且优先于 wide', () => {
    expect(classifyMomentSize(m({ coverRatio: 0.6 }))).toBe('tall')
    // 同时满足 tall 与 wide 条件时,先判 tall(Vue2 是顺序判定,首个命中即返回)
    expect(classifyMomentSize(m({ coverRatio: 0.6, recipeKey: 'trip:1', assetCount: 200 }))).toBe('tall')
  })
  it('ratio 恰为 0 表示未知,不算 tall', () => {
    expect(classifyMomentSize(m({ coverRatio: 0 }))).toBe('standard')
  })
  it('ratio 恰为 0.85 是开区间上界,不算 tall', () => {
    expect(classifyMomentSize(m({ coverRatio: 0.85 }))).toBe('standard')
  })
  it('trip 前缀且 assetCount >= 100 判 wide;99 张不算', () => {
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'trip', assetCount: 100 }))).toBe('wide')
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'trip', assetCount: 99 }))).toBe('standard')
  })
  it('recipeKey 只是包含 trip(不是以它开头)不算 wide', () => {
    expect(classifyMomentSize(m({ coverRatio: 1.5, recipeKey: 'theme:trip', assetCount: 500 }))).toBe('standard')
  })
})

describe('pickMomentTemplate', () => {
  it('featured >= 2 时按档取 T2/T4/T1', () => {
    expect(pickMomentTemplate('tall', 2)).toBe('T2')
    expect(pickMomentTemplate('wide', 3)).toBe('T4')
    expect(pickMomentTemplate('standard', 2)).toBe('T1')
  })
  it('featured == 1 时任意档都落 T3(不掉单图)', () => {
    expect(pickMomentTemplate('tall', 1)).toBe('T3')
    expect(pickMomentTemplate('wide', 1)).toBe('T3')
    expect(pickMomentTemplate('standard', 1)).toBe('T3')
  })
  it('featured == 0 时落 single', () => {
    expect(pickMomentTemplate('wide', 0)).toBe('single')
  })
})

describe('assignMomentSizes', () => {
  it('间隔配额:距上一张 wide 不足 3 位的 wide 降级为 standard', () => {
    const wide = (id: string) => m({ id, coverRatio: 1.5, recipeKey: 'trip', assetCount: 200 })
    const out = assignMomentSizes([wide('a'), wide('b'), wide('c'), wide('d')])
    // idx0 通过(lastWide = -Infinity);idx1/idx2 距离不足 3 → 降级;idx3 距 idx0 恰好 3 → 通过
    expect([out.a.size, out.b.size, out.c.size, out.d.size]).toEqual(['wide', 'standard', 'standard', 'wide'])
  })
  it('间隔配额:距上一张 tall 不足 2 位的 tall 降级为 standard', () => {
    const tall = (id: string) => m({ id, coverRatio: 0.6 })
    const out = assignMomentSizes([tall('a'), tall('b'), tall('c')])
    expect([out.a.size, out.b.size, out.c.size]).toEqual(['tall', 'standard', 'tall'])
  })
  it('被降级的那张不更新"上一张 wide/tall 的位置"', () => {
    // 只有真正保留下来的尺寸才计入位置基准 —— 若降级项也计入,第 4 项会被错误降级
    const wide = (id: string) => m({ id, coverRatio: 1.5, recipeKey: 'trip', assetCount: 200 })
    const out = assignMomentSizes([wide('a'), wide('b'), wide('c'), wide('d')])
    expect(out.d.size).toBe('wide')
  })
  it('降级为 standard 后,模板按 standard 档重算', () => {
    const tall = (id: string) => m({ id, coverRatio: 0.6, featuredAssetIds: ['p', 'q'] })
    const out = assignMomentSizes([tall('a'), tall('b')])
    expect(out.a.template).toBe('T2')
    expect(out.b.template).toBe('T1') // 降级成 standard ⇒ T1 而不是 T2
  })
  it('featuredAssetIds 缺失时按 0 计,落 single', () => {
    const out = assignMomentSizes([{ id: 'a', recipeKey: 'theme:food', assetCount: 3, coverRatio: 1.5, featuredAssetIds: [] }])
    expect(out.a.template).toBe('single')
  })
  it('空列表返回空映射,不抛', () => {
    expect(assignMomentSizes([])).toEqual({})
  })
  it('是纯函数:同一输入两次调用结果深相等', () => {
    const list = [m({ id: 'a' }), m({ id: 'b', coverRatio: 0.6 })]
    expect(assignMomentSizes(list)).toEqual(assignMomentSizes(list))
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/util/__tests__/momentLayout.test.ts --reporter=verbose`
Expected: FAIL —— 找不到模块 `../momentLayout`

- [ ] **Step 3: 实现**

新建 `src/photos/util/momentLayout.ts`：

```ts
// SP15-P1-T2: Moments 马赛克布局引擎 —— 纯函数,无 Date/random/DOM 依赖。
// 逐行照 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:322-357
// 移植(那边就是 module-level `export function`,本就是为可单测设计的),只做
// snake_case → camelCase 的字段改名与类型标注,规则一字不改。

export type MomentSize = 'standard' | 'wide' | 'tall'
export type MomentTemplate = 'T1' | 'T2' | 'T3' | 'T4' | 'single'

/** 布局只需要这五个字段;刻意不收整个 Moment,让本模块与 store 解耦、便于构造测试夹具。 */
export interface MomentLayoutInput {
  id: string
  recipeKey: string
  assetCount: number
  /** 封面宽高比 w/h。后端约定 0 = 未知(封面尚未 EXIF 索引),不参与判定。 */
  coverRatio: number
  featuredAssetIds: string[]
}

/**
 * 尺寸分档 —— 只看单条时刻自身内容,按顺序判定、首个命中即返回:
 *   tall:     coverRatio ∈ (0, 0.85) —— 竖版封面
 *   wide:     recipeKey 以 'trip' 开头 且 assetCount >= 100 —— 大行程
 *   standard: 其余
 * 不含"间隔配额"(那是序列级规则,见 assignMomentSizes)。
 */
export function classifyMomentSize(moment: MomentLayoutInput): MomentSize {
  const ratio = typeof moment.coverRatio === 'number' ? moment.coverRatio : 0
  if (ratio > 0 && ratio < 0.85) return 'tall'
  const key = moment.recipeKey || ''
  const count = moment.assetCount || 0
  if (key.startsWith('trip') && count >= 100) return 'wide'
  return 'standard'
}

/**
 * 模板选择 —— 由尺寸档 + 精选张数 n 决定,随 n 递减回落:
 *   n >= 2 → 该档自己的模板(tall→T2 / wide→T4 / standard→T1)
 *   n == 1 → 任意档都落 T3(封面与唯一精选左右对半),而不是直接掉单图
 *   n == 0 → single
 */
export function pickMomentTemplate(size: MomentSize, featuredCount: number): MomentTemplate {
  if (featuredCount >= 2) return size === 'tall' ? 'T2' : size === 'wide' ? 'T4' : 'T1'
  if (featuredCount === 1) return 'T3'
  return 'single'
}

/**
 * 主分配函数 —— 按序遍历,在内容驱动的候选尺寸之上叠加"间隔配额"打散:
 * 距上一张 wide 不足 3 位、或距上一张 tall 不足 2 位,降级为 standard,
 * 避免宽卡/高卡挤在一起。
 *
 * 关键:**只有降级之后仍然保留的尺寸才更新"上一张的位置"** —— 若把降级项
 * 也计入基准,后续项会被连锁错误降级(测试里有一条专门钉死这点)。
 */
export function assignMomentSizes(
  moments: MomentLayoutInput[],
): Record<string, { size: MomentSize; template: MomentTemplate }> {
  const map: Record<string, { size: MomentSize; template: MomentTemplate }> = {}
  let lastWideIdx = -Infinity
  let lastTallIdx = -Infinity
  ;(moments || []).forEach((m, idx) => {
    let size = classifyMomentSize(m)
    if (size === 'wide' && idx - lastWideIdx < 3) size = 'standard'
    else if (size === 'tall' && idx - lastTallIdx < 2) size = 'standard'
    if (size === 'wide') lastWideIdx = idx
    if (size === 'tall') lastTallIdx = idx
    const featuredCount = Array.isArray(m.featuredAssetIds) ? m.featuredAssetIds.length : 0
    map[m.id] = { size, template: pickMomentTemplate(size, featuredCount) }
  })
  return map
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/util/__tests__/momentLayout.test.ts --reporter=verbose`
Expected: PASS，13 个用例

- [ ] **Step 5: 提交**

```bash
git add src/photos/util/momentLayout.ts src/photos/util/__tests__/momentLayout.test.ts
git commit -m "feat(photos): port the moments mosaic layout rules

Vue 2 already had these as module-level exported functions, so they move over
as a standalone pure module rather than component internals. The spacing quota
has one non-obvious rule worth locking down: a card that gets downgraded must
not advance the \"last wide/tall\" cursor, otherwise later cards cascade into
wrong downgrades. That is what the fourth test pins."
```

---

## Task 3: moments store

**Files:**
- Create: `src/photos/stores/moments.ts`
- Test: `src/photos/stores/__tests__/moments.test.ts`

**Interfaces:**
- Consumes: `service.photos.*`（Task 1）· `assignMomentSizes`（Task 2）· `assetToPhoto` / `Photo`（既有 `src/photos/util/assetToPhoto.ts`）
- Produces：
  - `export interface Moment { id: string; title: string; subtitle: string; place: string; recipeKey: string; coverAssetId: string; featuredAssetIds: string[]; assetCount: number; addedThisWeek: number; coverRatio: number; timeFrom: string; timeTo: string; updatedAt: string }`
  - `export interface MomentMember { assetId: string; manual: boolean; featured: boolean }`
  - `export interface MomentPlace { name: string; count: number }`
  - `export interface MomentDetailAssets { assets: Photo[]; members: MomentMember[]; places: MomentPlace[] }`
  - `usePhotosMoments()` 暴露：`moments` · `listLoading` · `listLoaded` · `sizeMap` · `fetchMoments()` · `byId(id)` · `ensureLoaded()` · `setOrder(ids)` · `reorder(ids)` · `loadDetail(id)` · `loadAll(id)` · `pin(id, ids)` · `exclude(id, ids)` · `remove(id)` · `exportAlbum(id)` · `applyAssetCount(id, n)`

- [ ] **Step 1: 写失败的测试**

新建 `src/photos/stores/__tests__/moments.test.ts`：

```ts
// SP15-P1-T3: moments store。回源核对 NimoOS-Photos/route/v1/moments.go 的
// momentResponse —— featured_asset_ids / added_this_week / cover_ratio 恒输出,
// cover_asset_id / time_from / time_to / place / sort_order 带 omitempty 可缺,
// **updated_at 后端根本不发**(见 plan Global Constraints)。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const listMoments = vi.fn()
const getMomentAssets = vi.fn()
const pinMomentAssets = vi.fn()
const excludeMomentAssets = vi.fn()
const deleteMoment = vi.fn()
const exportMomentAlbum = vi.fn()
const reorderMoments = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listMoments: (...a: unknown[]) => listMoments(...a),
      getMomentAssets: (...a: unknown[]) => getMomentAssets(...a),
      pinMomentAssets: (...a: unknown[]) => pinMomentAssets(...a),
      excludeMomentAssets: (...a: unknown[]) => excludeMomentAssets(...a),
      deleteMoment: (...a: unknown[]) => deleteMoment(...a),
      exportMomentAlbum: (...a: unknown[]) => exportMomentAlbum(...a),
      reorderMoments: (...a: unknown[]) => reorderMoments(...a),
      thumbnailUrl: (id: string, size: string) => `mock://${id}/${size}`,
    },
  },
}))

import { usePhotosMoments } from '../moments'

const RAW = {
  id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', cover_asset_id: 'c1',
  asset_count: 42, time_from: '2016-11-20T00:46:46Z', time_to: '2016-11-22T04:04:35Z',
  place: 'Bozeman', recipe_key: 'trip:1', named_by_llm: false, sort_order: 0,
  featured_asset_ids: ['f1', 'f2'], added_this_week: 3, cover_ratio: 1.5,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('归一', () => {
  it('snake_case 逐字段转驼峰', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0]).toEqual({
      id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
      recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
      assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
      timeFrom: '2016-11-20T00:46:46Z', timeTo: '2016-11-22T04:04:35Z', updatedAt: '',
    })
  })

  it('omitempty 缺席的字段兜底,不产生 undefined', async () => {
    listMoments.mockResolvedValue([{ id: 'm2', title: 'T', asset_count: 0, recipe_key: 'theme:food', featured_asset_ids: [], added_this_week: 0, cover_ratio: 0 }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0]).toMatchObject({ subtitle: '', place: '', coverAssetId: '', timeFrom: '', timeTo: '', updatedAt: '' })
  })

  it('id 一律 String 归一(后端若给数字 id 也不炸)', async () => {
    listMoments.mockResolvedValue([{ ...RAW, id: 7 }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.moments[0].id).toBe('7')
  })
})

describe('列表与 sizeMap', () => {
  it('sizeMap 跟着 moments 走,是 assignMomentSizes 的结果', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(s.sizeMap.m1).toEqual({ size: 'standard', template: 'T1' })
  })

  it('fetchMoments 失败时保留旧列表并置 listLoaded,不把界面清空', async () => {
    listMoments.mockResolvedValueOnce([RAW])
    const s = usePhotosMoments()
    await s.fetchMoments()
    listMoments.mockRejectedValueOnce(new Error('boom'))
    await s.fetchMoments()
    expect(s.moments).toHaveLength(1)
    expect(s.listLoaded).toBe(true)
  })

  it('ensureLoaded 只拉一次;byId 在未加载时返回 undefined', async () => {
    listMoments.mockResolvedValue([RAW])
    const s = usePhotosMoments()
    expect(s.byId('m1')).toBeUndefined()
    await s.ensureLoaded()
    await s.ensureLoaded()
    expect(listMoments).toHaveBeenCalledTimes(1)
    expect(s.byId('m1')?.title).toBe('Bozeman')
  })
})

describe('排序', () => {
  it('reorder 乐观更新在前,成功后不回滚', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    reorderMoments.mockResolvedValue({})
    const s = usePhotosMoments()
    await s.fetchMoments()
    const ok = await s.reorder(['m2', 'm1'])
    expect(ok).toBe(true)
    expect(s.moments.map((m) => m.id)).toEqual(['m2', 'm1'])
    expect(reorderMoments).toHaveBeenCalledWith(['m2', 'm1'])
  })

  it('reorder 失败时重拉列表整体还原,并返回 false', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    reorderMoments.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments()
    await s.fetchMoments()
    const ok = await s.reorder(['m2', 'm1'])
    expect(ok).toBe(false)
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('ids 与当前列表对不齐时保守放弃,不发请求也不丢条目', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.reorder(['m2'])).toBe(false)
    expect(await s.reorder(['m2', 'nope'])).toBe(false)
    expect(reorderMoments).not.toHaveBeenCalled()
    expect(s.moments.map((m) => m.id)).toEqual(['m1', 'm2'])
  })
})

describe('详情资产', () => {
  it('loadDetail 解 {assets,members,places} 并把 members 转驼峰', async () => {
    getMomentAssets.mockResolvedValue({
      assets: [{ id: 'a1', takenAt: '2016-11-20T00:00:00Z' }],
      members: [{ asset_id: 'a1', manual: true, featured: true }],
      places: [{ name: 'Bozeman', count: 323 }],
    })
    const s = usePhotosMoments()
    const d = await s.loadDetail('m1')
    expect(getMomentAssets).toHaveBeenCalledWith('m1', true, true)
    expect(d.members).toEqual([{ assetId: 'a1', manual: true, featured: true }])
    expect(d.places).toEqual([{ name: 'Bozeman', count: 323 }])
    expect(d.assets).toHaveLength(1)
  })

  it('loadDetail 容忍旧后端的裸数组形状(members/places 兜底空数组)', async () => {
    getMomentAssets.mockResolvedValue([{ id: 'a1' }])
    const s = usePhotosMoments()
    const d = await s.loadDetail('m1')
    expect(d.members).toEqual([])
    expect(d.places).toEqual([])
    expect(d.assets).toHaveLength(1)
  })

  it('loadAll 不带 featured/withMembers,返回展平的 Photo 数组', async () => {
    getMomentAssets.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments()
    const list = await s.loadAll('m1')
    expect(getMomentAssets).toHaveBeenCalledWith('m1', false, false)
    expect(list).toHaveLength(2)
  })
})

describe('写操作', () => {
  it('pin 成功后把返回的 asset_count 写回列表项', async () => {
    listMoments.mockResolvedValue([RAW])
    pinMomentAssets.mockResolvedValue({ ok: true, asset_count: 50 })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.pin('m1', ['x'])).toBe(50)
    expect(s.byId('m1')?.assetCount).toBe(50)
  })

  it('exclude 同理', async () => {
    listMoments.mockResolvedValue([RAW])
    excludeMomentAssets.mockResolvedValue({ ok: true, asset_count: 41 })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.exclude('m1', ['x'])).toBe(41)
    expect(s.byId('m1')?.assetCount).toBe(41)
  })

  it('后端没回 asset_count 时保持原值,不写入 undefined', async () => {
    listMoments.mockResolvedValue([RAW])
    pinMomentAssets.mockResolvedValue({ ok: true })
    const s = usePhotosMoments()
    await s.fetchMoments()
    expect(await s.pin('m1', ['x'])).toBeNull()
    expect(s.byId('m1')?.assetCount).toBe(42)
  })

  it('remove 成功后把该条从列表摘掉,sizeMap 随之重算', async () => {
    listMoments.mockResolvedValue([RAW, { ...RAW, id: 'm2' }])
    deleteMoment.mockResolvedValue({})
    const s = usePhotosMoments()
    await s.fetchMoments()
    await s.remove('m1')
    expect(s.moments.map((m) => m.id)).toEqual(['m2'])
    expect(s.sizeMap.m1).toBeUndefined()
  })

  it('remove 失败时抛出且不动列表', async () => {
    listMoments.mockResolvedValue([RAW])
    deleteMoment.mockRejectedValue(new Error('nope'))
    const s = usePhotosMoments()
    await s.fetchMoments()
    await expect(s.remove('m1')).rejects.toThrow()
    expect(s.moments).toHaveLength(1)
  })

  it('exportAlbum 原样上抛 {albumId,name,count}', async () => {
    exportMomentAlbum.mockResolvedValue({ albumId: 'al1', name: 'Bozeman', count: 42 })
    const s = usePhotosMoments()
    expect(await s.exportAlbum('m1')).toEqual({ albumId: 'al1', name: 'Bozeman', count: 42 })
  })
})

describe('并发过期守卫', () => {
  it('两次 fetchMoments 交错返回时,后发的赢(先发的迟到结果被丢弃)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    listMoments.mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    listMoments.mockResolvedValueOnce([{ ...RAW, id: 'second' }])

    const s = usePhotosMoments()
    const pA = s.fetchMoments()   // 先发,挂起
    const pB = s.fetchMoments()   // 后发,立刻返回
    await pB
    resolveA([{ ...RAW, id: 'first' }])  // 先发的迟到
    await pA

    expect(s.moments.map((m) => m.id)).toEqual(['second'])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose`
Expected: FAIL —— 找不到模块 `../moments`

- [ ] **Step 3: 实现**

新建 `src/photos/stores/moments.ts`：

```ts
// SP15-P1-T3: Moments store。
// 移植自 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:553-624
// (fetchMoments/persistMomentsOrder/onMomentDeleted/onMomentAssetCountChanged)与
// PhotosMomentDetail.vue:307-338(loadFeatured/loadAll)。
// 后端契约回源核对 NimoOS-Photos/route/v1/moments.go:39-73 momentResponse。
//
// 与 Vue2 的两处刻意差异(逐条登记):
//  1) Vue2 把列表状态放在视图组件里、把详情资产放在详情组件里,两边各自维护一份
//     asset_count 并靠 $emit('asset-count-changed') 手工同步。这里收进一个 store:
//     详情页写完直接调 applyAssetCount,列表项就是同一份数据,不存在同步这回事。
//  2) fetchMoments 带 epoch 过期守卫(Global Constraints §6)。Vue2 没有——它的
//     fetchMoments 只在 mounted 调一次,撞不上;New-UI 详情页返回列表会再拉一次,
//     两次交错时迟到的响应会覆盖新数据。
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
import { assignMomentSizes, type MomentSize, type MomentTemplate } from '../util/momentLayout'

export interface Moment {
  id: string
  title: string
  subtitle: string
  place: string
  recipeKey: string
  coverAssetId: string
  featuredAssetIds: string[]
  assetCount: number
  addedThisWeek: number
  /** 封面宽高比 w/h;后端约定 0 = 未知。 */
  coverRatio: number
  timeFrom: string
  timeTo: string
  /** ⚠️ 后端 momentResponse **不含** updated_at,这里恒为空串;详情页据此渲染 '—'。
   *  保留字段是为后端将来补上时无需改类型,不是当下有数据。 */
  updatedAt: string
}

export interface MomentMember { assetId: string; manual: boolean; featured: boolean }
export interface MomentPlace { name: string; count: number }
export interface MomentDetailAssets { assets: Photo[]; members: MomentMember[]; places: MomentPlace[] }

interface RawMoment {
  id?: unknown; title?: unknown; subtitle?: unknown; place?: unknown
  recipe_key?: unknown; cover_asset_id?: unknown; featured_asset_ids?: unknown
  asset_count?: unknown; added_this_week?: unknown; cover_ratio?: unknown
  time_from?: unknown; time_to?: unknown; updated_at?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function toMoment(raw: RawMoment): Moment {
  return {
    id: str(raw.id),
    title: str(raw.title),
    subtitle: str(raw.subtitle),
    place: str(raw.place),
    recipeKey: str(raw.recipe_key),
    coverAssetId: str(raw.cover_asset_id),
    featuredAssetIds: Array.isArray(raw.featured_asset_ids) ? raw.featured_asset_ids.map(str) : [],
    assetCount: num(raw.asset_count),
    addedThisWeek: num(raw.added_this_week),
    coverRatio: num(raw.cover_ratio),
    timeFrom: str(raw.time_from),
    timeTo: str(raw.time_to),
    updatedAt: str(raw.updated_at),
  }
}

export const usePhotosMoments = defineStore('photosMoments', () => {
  const moments = ref<Moment[]>([])
  const listLoading = ref(false)
  const listLoaded = ref(false)
  // 过期守卫:每次 fetchMoments 自增,只有最新那一发的响应才准写 moments。
  let fetchEpoch = 0

  const sizeMap = computed(() =>
    assignMomentSizes(
      moments.value.map((m) => ({
        id: m.id, recipeKey: m.recipeKey, assetCount: m.assetCount,
        coverRatio: m.coverRatio, featuredAssetIds: m.featuredAssetIds,
      })),
    ) as Record<string, { size: MomentSize; template: MomentTemplate }>,
  )

  function byId(id: string): Moment | undefined {
    return moments.value.find((m) => m.id === String(id))
  }

  async function fetchMoments(): Promise<void> {
    const epoch = ++fetchEpoch
    listLoading.value = true
    try {
      const raw = await service.photos.listMoments()
      if (epoch !== fetchEpoch) return          // 迟到的响应,丢弃
      moments.value = (raw as RawMoment[]).map(toMoment)
    } catch (e) {
      // 失败保留旧列表(Vue2 同样只 console.error 不清空)——把界面清空会让一次网络
      // 抖动看起来像"时刻全没了"。
      console.error('[photos-moments] listMoments', e)
    } finally {
      if (epoch === fetchEpoch) {
        listLoading.value = false
        listLoaded.value = true
      }
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (listLoaded.value || listLoading.value) return
    await fetchMoments()
  }

  /** 只改本地顺序,不发请求 —— 供 reorder 内部与测试使用。 */
  function setOrder(ids: string[]): boolean {
    const byIdMap = new Map(moments.value.map((m) => [m.id, m]))
    const next = ids.map((id) => byIdMap.get(id)).filter((m): m is Moment => m != null)
    if (next.length !== moments.value.length) return false  // 对不齐时保守放弃,避免丢条目
    moments.value = next
    return true
  }

  async function reorder(ids: string[]): Promise<boolean> {
    if (!setOrder(ids)) return false
    try {
      await service.photos.reorderMoments(ids)
      return true
    } catch (e) {
      console.error('[photos-moments] reorderMoments', e)
      await fetchMoments()   // 整体还原为服务端顺序
      return false
    }
  }

  async function loadDetail(id: string): Promise<MomentDetailAssets> {
    const data = await service.photos.getMomentAssets(String(id), true, true)
    // 旧后端(或部署窗口期)返回裸数组;两种形状都要能收。
    if (Array.isArray(data)) {
      return { assets: data.map(assetToPhoto), members: [], places: [] }
    }
    const d = (data ?? {}) as { assets?: unknown[]; members?: unknown[]; places?: unknown[] }
    return {
      assets: (d.assets ?? []).map(assetToPhoto),
      members: (d.members ?? []).map((m) => {
        const r = m as { asset_id?: unknown; manual?: unknown; featured?: unknown }
        return { assetId: str(r.asset_id), manual: !!r.manual, featured: !!r.featured }
      }),
      places: (d.places ?? []).map((p) => {
        const r = p as { name?: unknown; count?: unknown }
        return { name: str(r.name), count: num(r.count) }
      }),
    }
  }

  async function loadAll(id: string): Promise<Photo[]> {
    const data = await service.photos.getMomentAssets(String(id), false, false)
    return (Array.isArray(data) ? data : []).map(assetToPhoto)
  }

  /** 把最新张数写回列表项;后端没回 asset_count 时保持原值。 */
  function applyAssetCount(id: string, count: number | null | undefined): void {
    if (count == null) return
    const m = byId(id)
    if (m) m.assetCount = count
  }

  async function pin(id: string, assetIds: string[]): Promise<number | null> {
    const res = await service.photos.pinMomentAssets(String(id), assetIds)
    const count = typeof res.asset_count === 'number' ? res.asset_count : null
    applyAssetCount(id, count)
    return count
  }

  async function exclude(id: string, assetIds: string[]): Promise<number | null> {
    const res = await service.photos.excludeMomentAssets(String(id), assetIds)
    const count = typeof res.asset_count === 'number' ? res.asset_count : null
    applyAssetCount(id, count)
    return count
  }

  async function remove(id: string): Promise<void> {
    await service.photos.deleteMoment(String(id))
    moments.value = moments.value.filter((m) => m.id !== String(id))
  }

  async function exportAlbum(id: string): Promise<{ albumId?: string; name?: string; count?: number }> {
    return await service.photos.exportMomentAlbum(String(id))
  }

  return {
    moments, listLoading, listLoaded, sizeMap,
    fetchMoments, ensureLoaded, byId, setOrder, reorder,
    loadDetail, loadAll, pin, exclude, remove, exportAlbum, applyAssetCount,
  }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose`
Expected: PASS，18 个用例

- [ ] **Step 5: 提交**

```bash
git add src/photos/stores/moments.ts src/photos/stores/__tests__/moments.test.ts
git commit -m "feat(photos): add the moments store

Vue 2 spread this state across two components and kept their asset counts in
sync by hand, through an asset-count-changed event. Folding it into one store
removes the synchronisation problem rather than reimplementing it.

fetchMoments carries a staleness epoch that Vue 2 does not need: it only ever
fetched once on mount, whereas the routed detail page here refetches on the way
back to the list, so two overlapping calls are reachable and a late response
would otherwise clobber the newer one."
```

---

## Task 4: MomentCard.vue

**Files:**
- Create: `src/photos/components/MomentCard.vue`
- Test: `src/photos/components/__tests__/MomentCard.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `Moment`（Task 3）· `MomentSize` / `MomentTemplate`（Task 2）· `service.photos.thumbnailUrl`
- Produces: `<MomentCard :moment :size :template @open="(id: string) => …" />`

**新增 i18n 键**（两个 locale 都加）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoBadge` | `时刻` | `Moment` |
| `photosMoTypeTrip` | `行程` | `Trip` |
| `photosMoTypePets` | `宠物` | `Pets` |
| `photosMoTypeFamily` | `家人` | `Family` |
| `photosMoTypeTheme` | `主题` | `Theme` |
| `photosMoAddedThisWeek` | `本周 +{n}` | `+{n} this week` |

> `photosMoAddedThisWeek` 的中文取自既有 `photosSvAddedThisWeek`（`zh_cn.photos.ts:612`）的同款措辞——**不要自己另译**。

- [ ] **Step 1: 写失败的测试**

新建 `src/photos/components/__tests__/MomentCard.test.ts`：

```ts
// SP15-P1-T4: MomentCard.vue —— 逐条照 Vue2 899af59b:PhotosSmartViewsView.vue:367-433
// 内联组件 MomentCard 移植。五种拼贴形态各断言一次 img 数量与顺序。
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: { thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`) },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import MomentCard from '../MomentCard.vue'
import type { Moment } from '../../stores/moments'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function fullMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
    assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
    timeFrom: '', timeTo: '', updatedAt: '', ...over,
  }
}

function mountCard(over: Partial<Moment> = {}, size = 'standard', template = 'T1', locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return mount(MomentCard, {
    props: { moment: fullMoment(over), size, template },
    global: { plugins: [makeI18n(locale)] },
  })
}

describe('拼贴形态', () => {
  it('T1 / T2 / T4 渲染三张图:封面 + 两张精选,顺序固定', () => {
    for (const tpl of ['T1', 'T2', 'T4']) {
      const w = mountCard({}, 'standard', tpl)
      const srcs = w.findAll('.mo-collage img').map((i) => i.attributes('src'))
      expect(srcs).toEqual(['mock://c1/large', 'mock://f1/large', 'mock://f2/large'])
      expect(w.find('.sv-collage-main').exists()).toBe(true)
    }
  })

  it('T3 渲染两张图:封面 + 唯一精选', () => {
    const w = mountCard({ featuredAssetIds: ['f1'] }, 'standard', 'T3')
    expect(w.findAll('.mo-collage img').map((i) => i.attributes('src')))
      .toEqual(['mock://c1/large', 'mock://f1/large'])
  })

  it('single 只渲染封面一张,并挂 mo-collage-single', () => {
    const w = mountCard({ featuredAssetIds: [] }, 'standard', 'single')
    expect(w.findAll('.mo-collage img')).toHaveLength(1)
    expect(w.find('.mo-collage').classes()).toContain('mo-collage-single')
  })

  it('精选 id 不足时不渲染 src 为 undefined 的 img(不照抄 Vue2 的越界下标)', () => {
    // Vue2 模板在 T1 分支里硬取 featured_asset_ids[0]/[1],数组只有 1 项时第二个
    // <img> 的 src 是 undefined —— 浏览器会对当前页发一次多余请求。这里跳过缺失格。
    const w = mountCard({ featuredAssetIds: ['f1'] }, 'standard', 'T1')
    const srcs = w.findAll('.mo-collage img').map((i) => i.attributes('src'))
    expect(srcs.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)
  })
})

describe('尺寸类', () => {
  it('wide / tall 分别挂 mo-card-wide / mo-card-tall,standard 两个都不挂', () => {
    expect(mountCard({}, 'wide').find('.mo-card').classes()).toContain('mo-card-wide')
    expect(mountCard({}, 'tall').find('.mo-card').classes()).toContain('mo-card-tall')
    const std = mountCard({}, 'standard').find('.mo-card').classes()
    expect(std).not.toContain('mo-card-wide')
    expect(std).not.toContain('mo-card-tall')
  })

  it('data-id 落在卡片根节点上(拖拽排序按它读 DOM 顺序)', () => {
    expect(mountCard().find('.mo-card').attributes('data-id')).toBe('m1')
  })
})

describe('meta 行', () => {
  it('类型胶囊按 recipeKey 前缀映射四档', () => {
    expect(mountCard({ recipeKey: 'trip:1' }, 'standard', 'T1', 'en_us').text()).toContain('Trip')
    expect(mountCard({ recipeKey: 'profile:pets' }, 'standard', 'T1', 'en_us').text()).toContain('Pets')
    expect(mountCard({ recipeKey: 'profile:family' }, 'standard', 'T1', 'en_us').text()).toContain('Family')
    expect(mountCard({ recipeKey: 'theme:food' }, 'standard', 'T1', 'en_us').text()).toContain('Theme')
  })

  it('addedThisWeek 为 0 时不渲染绿色徽标', () => {
    expect(mountCard({ addedThisWeek: 0 }).find('.mo-week-badge').exists()).toBe(false)
    expect(mountCard({ addedThisWeek: 2 }).find('.mo-week-badge').exists()).toBe(true)
  })

  it('place 为空时不渲染地点胶囊', () => {
    expect(mountCard({ place: '' }).findAll('.sv-cond')).toHaveLength(1)  // 只剩类型胶囊
  })

  it('张数走 locale 千分位(不是裸 toLocaleString)', () => {
    expect(mountCard({ assetCount: 12345 }, 'standard', 'T1', 'en_us').text()).toContain('12,345')
  })
})

describe('交互', () => {
  it('点击 emit open 并只传 id', async () => {
    const w = mountCard()
    await w.find('.mo-card').trigger('click')
    expect(w.emitted('open')).toEqual([['m1']])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts --reporter=verbose`
Expected: FAIL —— 找不到 `../MomentCard.vue`

- [ ] **Step 3: 先补 i18n 键，再实现组件**

在 `src/i18n/zh_cn.photos.ts` 与 `src/i18n/en_us.photos.ts` 各加上文表格里的 6 个键（放在既有 `photosSv*` 块之后，新起一段注释 `// ── SP15-P1 Moments ──`）。

新建 `src/photos/components/MomentCard.vue`：

```vue
<script setup lang="ts">
// SP15-P1-T4: MomentCard.vue —— Moments 分区的马赛克卡片。
// 逐段照 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:367-433
// 的内联组件 MomentCard 移植;样式照 photos-smartview.scss:186-268。
// 拼贴/meta 结构与 SmartViewCard.vue 对齐(三行 meta 不变),故复用 .sv-card/.sv-collage/
// .sv-meta 这套类名,只叠加 .mo-* 覆盖规则 —— 与 Vue2 同一手法。
//
// 偏离登记:
//  1) emit('open', id) 只传 id 字符串,不传整个 moment 对象(照 SmartViewCard.vue:32 的
//     既有先例)—— 详情页从 store byId 现取,消灭引用陈旧。
//  2) 精选格越界不渲染空 <img>:Vue2 模板在 T1/T2/T4 分支硬取 featuredAssetIds[0] 与
//     [1],数组只有 1 项时第二个 <img> 的 src 是 undefined,浏览器会对当前页面 URL 再发
//     一次多余请求。这里逐格判存在,缺的格子不渲染。(界面 1:1 不受影响 —— 走到这个分支
//     本身就意味着 pickMomentTemplate 判过 n>=2,是防御。)
//  3) 张数千分位跟 i18n locale(`toLocaleString(localeTag)`),不是 Vue2 的裸
//     `toLocaleString()`(跟浏览器 locale,不确定)。
//  4) 橙色徽标:Vue2 是 `linear-gradient(135deg,#FF9F0A,#FF6B5C)` 与
//     `rgba(255,159,10,0.15)/#FF9F0A` 字面量。本仓禁裸色,改用已存在的 --warn-fg /
//     --warn-bg token(theme.css:155-157 与 :511-513,两套主题都有取值,不新增 token)。
//     渐变退为 --warn-fg 实底 —— 本仓无第二个橙色 token 可组渐变,登记为外观性偏离。
//  5) .mo-card .sv-name 的两行截断照抄(scss:254-259)。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Moment } from '../stores/moments'
import type { MomentSize, MomentTemplate } from '../util/momentLayout'

const props = defineProps<{ moment: Moment; size: MomentSize; template: MomentTemplate }>()
const emit = defineEmits<{ (e: 'open', id: string): void }>()

const { t, locale } = useI18n()
// BCP-47 转换(本仓既定写法,见 SmartViewCard.vue:38)。
const localeTag = computed(() => locale.value.replace('_', '-'))

// 三格/两格/一格的数据源,逐格判存在(偏离登记 2)。
const collageIds = computed<string[]>(() => {
  const cover = props.moment.coverAssetId
  const f = props.moment.featuredAssetIds
  if (props.template === 'single') return [cover].filter(Boolean)
  if (props.template === 'T3') return [cover, f[0]].filter(Boolean)
  return [cover, f[0], f[1]].filter(Boolean)
})

const typeLabel = computed(() => {
  const key = props.moment.recipeKey || ''
  if (key.startsWith('trip')) return t('photosMoTypeTrip')
  if (key.includes('pets')) return t('photosMoTypePets')
  if (key.includes('family')) return t('photosMoTypeFamily')
  return t('photosMoTypeTheme')
})

function thumbUrl(id: string): string {
  return service.photos.thumbnailUrl(id, 'large')
}
</script>

<template>
  <div
    class="sv-card mo-card"
    :class="{ 'mo-card-wide': size === 'wide', 'mo-card-tall': size === 'tall' }"
    :data-id="moment.id"
    @click="emit('open', moment.id)"
  >
    <div
      class="sv-collage mo-collage"
      :class="{
        'mo-collage-single': template === 'single',
        'mo-tpl-t2': template === 'T2',
        'mo-tpl-t3': template === 'T3',
        'mo-tpl-t4': template === 'T4',
      }"
    >
      <img
        v-for="(id, i) in collageIds" :key="id"
        :class="{ 'sv-collage-main': i === 0 }" :src="thumbUrl(id)" alt=""
      >
      <div class="sv-collage-overlay" />
      <div class="sv-collage-badge mo-badge">
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M12 2l2.6 6.3L21 9.6l-4.7 4.3 1.3 6.4L12 17l-5.6 3.3 1.3-6.4L3 9.6l6.4-1.3z" /></svg>
        {{ t('photosMoBadge') }}
      </div>
    </div>
    <div class="sv-meta">
      <h3 class="sv-name">
        {{ moment.title }}
      </h3>
      <div class="sv-conds">
        <span class="sv-cond">{{ typeLabel }}</span>
        <span v-if="moment.place" class="sv-cond">{{ moment.place }}</span>
      </div>
      <div class="sv-stats">
        <b>{{ moment.assetCount.toLocaleString(localeTag) }}</b> {{ t('photosSvPhotosCount') }}
        <span v-if="moment.addedThisWeek > 0" class="mo-week-badge">{{ t('photosMoAddedThisWeek', { n: moment.addedThisWeek }) }}</span>
        <span style="flex:1" />
        <span v-if="moment.subtitle" class="mo-span-mini">{{ moment.subtitle }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 卡片外壳/拼贴/meta 三块与 SmartViewCard.vue 同规格(Vue2 复用 .sv-card 类,本仓 scoped
   样式不跨组件继承,故在此重述必要的几条,而不是把 SmartViewCard 的样式提成全局)。 */
.sv-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sv-card:hover { transform: translateY(-2px); box-shadow: var(--card-shadow-hi); }

.sv-collage {
  position: relative;
  display: grid;
  gap: 2px;
  background: var(--bg);
}
/* 拼贴留白修复(照 scss:198-218):显式 1fr 轨道的 auto 最小尺寸会被竖图固有高撑破,
   同排卡片被最高者拉齐、矮卡下方留白。轨道钉死 minmax(0, 1fr) 并清零 img 最小尺寸。
   马赛克卡的拼贴高度由 .mo-grid 的固定行高单位决定,不是固定 16 比 9。 */
.mo-collage {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.mo-collage img { width: 100%; height: 100%; object-fit: cover; display: block; min-width: 0; min-height: 0; }
.sv-collage-main { grid-row: 1 / span 2; }

/* T2 上大下双(高卡专属):封面占上方两份、两张精选横排占下方一份。 */
.mo-tpl-t2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 2fr) minmax(0, 1fr); }
.mo-tpl-t2 .sv-collage-main { grid-column: 1 / span 2; grid-row: 1; }

/* T3 左右对半(n 等于 1 的兜底):只有一行,覆盖掉 .sv-collage-main 默认的跨两行。 */
.mo-tpl-t3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
.mo-tpl-t3 .sv-collage-main { grid-row: 1; }

/* T4 三联横排(宽卡专属):结构同 T1,只把列比例从 2fr 比 1fr 收窄到 11fr 比 9fr。 */
.mo-tpl-t4 { grid-template-columns: minmax(0, 11fr) minmax(0, 9fr); }

/* single:单图绝对定位铺满。 */
.mo-collage-single { display: block; }
.mo-collage-single img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.sv-collage-overlay {
  position: absolute; bottom: 0; left: 0; right: 0; height: 70%; pointer-events: none;
  /* theme-exception: 拼贴底部渐变遮罩,为压在照片上的徽标提供跨主题恒定对比度
     (同 SmartViewCard.vue .sv-collage-overlay 的先例)。 */
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
}
.sv-collage-badge {
  position: absolute; top: 10px; left: 10px;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: var(--chip-radius, 999px);
  backdrop-filter: var(--blur);
  font-size: 10.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em;
}
/* Vue2 是 #FF9F0A → #FF6B5C 的渐变;本仓无第二个橙色 token,退为 --warn-fg 实底
   (外观性偏离,已在文件头登记)。 */
.mo-badge {
  background: var(--warn-fg);
  /* theme-exception: 徽标文字压在照片拼贴之上,需要跨主题恒定浅色前景,禁用
     --on-accent(同 SmartViewCard.vue .sv-collage-badge 的先例与理由)。 */
  color: #fff;
}

.sv-meta {
  padding: 14px 16px 16px;
  /* flex 子项省略的必要条件:父级 flex-direction column 下默认 min-width auto。 */
  min-width: 0;
}
.sv-name {
  font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em;
  /* 超长标题最多两行(scss:254-259)。 */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sv-conds { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
.sv-cond { padding: 2px 8px; border-radius: var(--chip-radius, 999px); background: var(--chip-bg); color: var(--fg-muted); font-size: 11px; }
.sv-stats { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; }
.sv-stats b { color: var(--fg); font-weight: 600; }
.mo-week-badge { color: var(--success); }
.mo-span-mini {
  display: inline-flex; align-items: center;
  padding: 2px 7px; border-radius: var(--chip-radius, 999px);
  background: var(--warn-bg); color: var(--warn-fg);
  font-weight: 600; white-space: nowrap;
}
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/components/__tests__/MomentCard.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，11 个卡片用例 + parity 9/9

- [ ] **Step 5: 提交**

```bash
git add src/photos/components/MomentCard.vue src/photos/components/__tests__/MomentCard.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): add the moment card

Five collage shapes, driven entirely by the size/template props the layout
module computes. The one behavioural change from Vue 2: empty collage slots are
skipped rather than rendered as an <img> with an undefined src, which the
browser resolves against the current page and fetches for nothing.

The amber badge loses its gradient. This repo has a single warn token, and the
theming rule forbids the literal second stop Vue 2 used."
```

---

## Task 5: For You 分区接进智能视图页

**Files:**
- Modify: `src/views/PhotosSmartViews.vue`
- Test: `src/views/PhotosSmartViews.moments.test.ts`（新建；既有该页测试文件不动，避免与 `sp12-files-fixes` 之外的并发面冲突）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `usePhotosMoments`（Task 3）· `MomentCard`（Task 4）
- Produces: 页面顶部的 `.mo-section` 区块与 `.mo-grid` 容器（`ref="moGrid"`，Task 6 的拖拽挂在它上面）

**新增 i18n 键**：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoHeroTitle` | `时刻 · 为你推荐` | `Moments · For You` |
| `photosMoHeroDesc` | `Nimo 会自动把你最好的照片聚成时刻 —— 行程、人物，以及值得重温的主题。` | `Nimo automatically groups your best shots into moments — trips, people, and themes worth reliving.` |

- [ ] **Step 1: 写失败的测试**

新建 `src/views/PhotosSmartViews.moments.test.ts`：

```ts
// SP15-P1-T5: 智能视图页顶部的 Moments · For You 分区。
// 靶子是 Vue2 899af59b:PhotosSmartViewsView.vue:31-44(mo-section)+ :46(sv-hero 拿到
// sv-hero-secondary 分隔线)+ :455(showMoments 门控)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import en from '../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async () => []),
    listSmartViews: vi.fn(async () => []),
    getConfig: vi.fn(async () => ({})),
    reorderMoments: vi.fn(async () => ({})),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViews from './PhotosSmartViews.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'
import { usePhotosSettingsStore } from '../photos/stores/settings'

function makeMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1', 'f2'],
    assetCount: 42, addedThisWeek: 0, coverRatio: 1.5,
    timeFrom: '', timeTo: '', updatedAt: '', ...over,
  }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: { template: '<div/>' } },
      { path: '/photos/settings', component: { template: '<div/>' } },
    ],
  })
}

async function mountPage() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })
  const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('分区门控', () => {
  it('无时刻时整个分区不渲染(Vue2 showMoments 的核心语义)', async () => {
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
  })

  it('有时刻时渲染分区,标题与副标题来自 i18n', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(true)
    expect(w.text()).toContain('时刻 · 为你推荐')
  })

  it('aiFeatures.smartview 为 false 时,即使有时刻也不渲染分区', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const settings = usePhotosSettingsStore()
    settings.aiFeatures.smartview = false
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
  })

  it('aiFeatures.smartview 缺字段时按开启处理(不吓用户)', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const { w } = await mountPage()
    expect(w.find('[data-test="mo-section"]').exists()).toBe(true)
  })
})

describe('网格', () => {
  it('每条时刻渲染一张卡,尺寸/模板取自 store 的 sizeMap', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b', coverRatio: 0.6 })]
    const { w } = await mountPage()
    const cards = w.findAll('.mo-card')
    expect(cards).toHaveLength(2)
    expect(cards[1].classes()).toContain('mo-card-tall')
  })

  it('点击卡片跳 /photos/moments/:id', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'zz' })]
    const { w, router } = await mountPage()
    await w.find('.mo-card').trigger('click')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/photos/moments/zz')
  })
})

describe('与智能视图 hero 的关系', () => {
  it('分区出现时,下方 sv-hero 拿到 sv-hero-secondary 分隔线类', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    const { w } = await mountPage()
    expect(w.find('.sv-hero').classes()).toContain('sv-hero-secondary')
  })

  it('分区不出现时 sv-hero 不带该类', async () => {
    const { w } = await mountPage()
    expect(w.find('.sv-hero').classes()).not.toContain('sv-hero-secondary')
  })
})

describe('拉取', () => {
  it('挂载时拉一次 moments', async () => {
    await mountPage()
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-section"]` 找不到

- [ ] **Step 3: 实现**

先在两个 locale 文件加上表格里的 2 个键。

在 `src/views/PhotosSmartViews.vue` 的 `<script setup>` 里追加：

```ts
import MomentCard from '../photos/components/MomentCard.vue'
import { usePhotosMoments } from '../photos/stores/moments'

const moments = usePhotosMoments()

// 照 Vue2 899af59b:PhotosSmartViewsView.vue:455 —— 无时刻时整个分区隐藏,且跟随
// aiFeatures.smartview 开关。**真机上 moments 表常年 0 行(见 spec §2),所以"打开页面
// 看不到这个分区"是预期行为,不是缺陷。**
const showMoments = computed(() => !aiSmartViewOff.value && moments.moments.length > 0)

function onMomentOpen(id: string): void {
  router.push('/photos/moments/' + id)
}
```

`onMounted` 里追加 `void moments.fetchMoments()`。

模板里，在 AI 横幅之后、`<!-- ── hero ── -->` 之前插入：

```vue
        <!-- ── Moments · For You(Vue2 899af59b :31-44)── -->
        <div v-if="showMoments" class="mo-section" data-test="mo-section">
          <div class="mo-hero">
            <div>
              <h2>{{ t('photosMoHeroTitle') }}</h2>
              <p>{{ t('photosMoHeroDesc') }}</p>
            </div>
          </div>
          <div ref="moGrid" class="sv-grid mo-grid">
            <MomentCard
              v-for="m in moments.moments" :key="m.id" :moment="m"
              :size="moments.sizeMap[m.id]?.size ?? 'standard'"
              :template="moments.sizeMap[m.id]?.template ?? 'T1'"
              @open="onMomentOpen"
            />
          </div>
        </div>
```

把 hero 那行改成 `<div class="sv-hero" :class="{ 'sv-hero-secondary': showMoments }">`，并加 `const moGrid = ref<HTMLElement | null>(null)`。

`<style scoped>` 追加：

```css
/* ── Moments · For You 分区(Vue2 photos-smartview.scss:144-186)── */
.mo-section { margin-bottom: 36px; }
.mo-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
/* 偏离登记:Vue2 用 var(--font-display) —— 本仓 theme.css 没有这个 token(grep 零命中),
   不新增,继承页面字体。 */
.mo-hero h2 { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--fg); }
.mo-hero p { font-size: 13.5px; color: var(--fg-muted); margin: 0; max-width: 520px; line-height: 1.5; }

/* Moments 在上方时,下面的智能视图 hero 补一条分隔线。 */
.sv-hero.sv-hero-secondary { padding-top: 24px; border-top: 1px solid var(--divider); }

/* .mo-grid 与 .sv-grid 并存,只叠加马赛克专属规则,不碰 .sv-grid 本体。
   dense 密排 + 固定行高:卡高 = span 乘 132px 再加 (span - 1) 乘 16px 的 gap。 */
.mo-grid { margin-bottom: 4px; grid-auto-flow: row dense; grid-auto-rows: 132px; }
/* 三档 span。高卡用双类选择器顶掉 baseline 的单类选择器,不依赖书写顺序。 */
.mo-grid :deep(.mo-card) { grid-row: span 3; }
.mo-grid :deep(.mo-card-wide) { grid-column: span 2; }
.mo-grid :deep(.mo-card.mo-card-tall) { grid-row: span 5; }

/* 窄容器降级:sv-grid 的 auto-fill minmax(320px, 1fr) 在低于三列临界宽度时降到 1 至 2 列,
   宽卡横占两列会顶到列数上限,直接用 media 退回一列。高卡纵向占位不受列数影响。 */
@media (max-width: 1055px) {
  .mo-grid :deep(.mo-card-wide) { grid-column: span 1; }
}
```

> **注意 `:deep()`**：`.mo-card` 是子组件根节点，scoped 样式默认选不中它的 grid span——这是与 Vue2 全局 scss 的结构性差异，必须用 `:deep()`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，9 个分区用例 + parity 9/9

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosSmartViews.vue src/views/PhotosSmartViews.moments.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): show the For You moments band on the smart views page

Placement follows Vue 2 at #111, before #112 moved smart views out to the
albums page — that move is P2's job and pulling it in early would blur the two
phases together.

The grid span rules need :deep(). The card is a child component root, which
scoped styles cannot reach, so the mosaic sizing would silently do nothing
otherwise. Vue 2 had no such problem because its stylesheet was global."
```

---

## Task 6: Moments 拖拽排序

**Files:**
- Modify: `src/photos/composables/useAlbumDragSort.ts`（加三个可选参数，默认值保持相册页行为不变）
- Modify: `src/photos/composables/__tests__/useAlbumDragSort.test.ts`
- Modify: `src/views/PhotosSmartViews.vue`
- Modify: `src/views/PhotosSmartViews.moments.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `useAlbumDragSort`（既有）· `moments.reorder(ids)`（Task 3）
- Produces: 无新导出；`useAlbumDragSort` 的选项对象多出 `itemSelector?` / `ghostClass?` / `chosenClass?`

**新增 i18n 键**：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoOrderSaveFailed` | `排序保存失败` | `Failed to save order` |

- [ ] **Step 1: 写失败的测试**

在 `src/photos/composables/__tests__/useAlbumDragSort.test.ts` 末尾追加：

```ts
describe('SP15-P1-T6: 可选的选择器与 class 参数', () => {
  it('不传时保持相册页原行为(.tile[data-id] + tile-drag-ghost)', () => {
    // 既有用例已覆盖默认路径,这里只钉住"默认值没被改动"这一点
    const container = document.createElement('div')
    container.innerHTML = '<div class="tile" data-id="t1"></div>'
    const el = ref<HTMLElement | null>(container)
    const seen: string[][] = []
    const s = useAlbumDragSort({ container: el, enabled: () => true, onOrder: (ids) => seen.push(ids) })
    s.refresh()
    // 直接调 Sortable 的 onEnd 回调不现实(它是库内部的),改为断言构造参数
    expect(createSpy).toHaveBeenLastCalledWith(container, expect.objectContaining({ ghostClass: 'tile-drag-ghost' }))
    s.destroy()
  })

  it('传入时透传给 Sortable,并按新选择器读 DOM 顺序', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="mo-card" data-id="b"></div><div class="mo-card" data-id="a"></div>'
    const el = ref<HTMLElement | null>(container)
    const seen: string[][] = []
    const s = useAlbumDragSort({
      container: el, enabled: () => true, onOrder: (ids) => seen.push(ids),
      itemSelector: '.mo-card[data-id]', ghostClass: 'mo-drag-ghost', chosenClass: 'mo-drag-chosen',
    })
    s.refresh()
    const opts = createSpy.mock.calls[createSpy.mock.calls.length - 1][1]
    expect(opts).toMatchObject({ ghostClass: 'mo-drag-ghost', chosenClass: 'mo-drag-chosen' })
    opts.onEnd()
    expect(seen).toEqual([['b', 'a']])
    s.destroy()
  })
})
```

> 该文件顶部若尚无 `createSpy`（对 `Sortable.create` 的 spy），按既有 mock 写法补上；若既有测试已 mock `sortablejs`，复用它的 spy，不要再建第二个。

在 `src/views/PhotosSmartViews.moments.test.ts` 追加：

```ts
describe('拖拽排序', () => {
  it('拖完调 store.reorder,传 DOM 里的新顺序', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    const spy = vi.spyOn(s, 'reorder').mockResolvedValue(true)
    const { w } = await mountPage()
    // 模拟 Sortable 把 DOM 换了顺序后触发 onEnd
    const grid = w.find('.mo-grid').element
    grid.appendChild(grid.firstElementChild!)          // a 移到最后
    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1]
    opts.onEnd()
    expect(spy).toHaveBeenCalledWith(['b', 'a'])
  })

  it('reorder 返回 false 时弹失败 toast', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'a' }), makeMoment({ id: 'b' })]
    vi.spyOn(s, 'reorder').mockResolvedValue(false)
    const toast = useToast()
    const spy = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    const opts = sortableCreate.mock.calls[sortableCreate.mock.calls.length - 1][1]
    await opts.onEnd()
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('排序保存失败', expect.anything(), 'danger')
  })

  it('分区从隐藏变为显示时重新绑定 Sortable(容器是新挂载的 DOM 节点)', async () => {
    const s = usePhotosMoments()
    const { w } = await mountPage()
    const before = sortableCreate.mock.calls.length
    s.moments = [makeMoment()]
    await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(sortableCreate.mock.calls.length).toBeGreaterThan(before)
  })
})
```

> 该文件顶部需 mock `sortablejs`：`const sortableCreate = vi.hoisted(() => vi.fn(() => ({ destroy: vi.fn() })));  vi.mock('sortablejs', () => ({ default: { create: sortableCreate } }))`。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts src/views/PhotosSmartViews.moments.test.ts --reporter=verbose`
Expected: FAIL —— `itemSelector` 不在选项类型里；`sortableCreate` 未被调用

- [ ] **Step 3: 实现**

`src/photos/composables/useAlbumDragSort.ts` —— 选项加三个可选字段，**默认值与现状逐字相同**，相册页零改动：

```ts
export function useAlbumDragSort(opts: {
  container: Ref<HTMLElement | null>
  enabled: () => boolean
  onOrder: (ids: string[]) => void
  /** SP15-P1-T6:Moments 网格复用本 composable。三个可选项的默认值 = 相册页原值,
   *  既有调用点一行不用改;不传时行为与本次改动前逐字相同。 */
  itemSelector?: string
  ghostClass?: string
  chosenClass?: string
}): AlbumDragSort {
```

`refresh()` 里：

```ts
    const itemSelector = opts.itemSelector ?? '.tile[data-id]'
    inst = Sortable.create(el, {
      animation: 150,
      ghostClass: opts.ghostClass ?? 'tile-drag-ghost',
      ...(opts.chosenClass ? { chosenClass: opts.chosenClass } : {}),
      forceFallback: true,
      fallbackOnBody: true,
      onStart: () => { dragging = true },
      onEnd: () => {
        const ids = Array.from(el.querySelectorAll(itemSelector))
          .map((n) => n.getAttribute('data-id'))
          .filter((id): id is string => id !== null)
        opts.onOrder(ids)
        void nextTick(() => { dragging = false })
      },
    })
```

`src/views/PhotosSmartViews.vue` 追加：

```ts
import { onBeforeUnmount, watch } from 'vue'
import { useAlbumDragSort } from '../photos/composables/useAlbumDragSort'
import { useToast } from '../stores/toast'

const toast = useToast()

// ⚠️ 这里是本期最容易照抄错的一处。Vue2(899af59b:480-497)靠三个 watch 重绑 Sortable:
// 两个盯"详情态收起"(openMoment / openSv 从真变假)、一个盯 showMoments 由假转真。
// **前两个在 New-UI 没有对应物** —— 详情页是独立路由,离开本页时整个组件卸载,回来时
// 重新挂载,不存在"同一个组件实例里详情态收起"这回事。照抄那两个 watch 会得到永不
// 触发的死代码。真正需要的只有第三条:分区由隐藏变显示时,.mo-grid 是新挂载的 DOM 节点。
const drag = useAlbumDragSort({
  container: moGrid,
  enabled: () => showMoments.value,
  onOrder: (ids) => { void persistOrder(ids) },
  itemSelector: '.mo-card[data-id]',
  ghostClass: 'mo-drag-ghost',
  chosenClass: 'mo-drag-chosen',
})

async function persistOrder(ids: string[]): Promise<void> {
  const ok = await moments.reorder(ids)
  if (!ok) toast.show(t('photosMoOrderSaveFailed'), 2500, 'danger')
}

watch(showMoments, (next) => {
  if (next) void nextTick(() => drag.refresh())
  else drag.destroy()
}, { immediate: true })

onBeforeUnmount(() => drag.destroy())
```

`<style scoped>` 追加拖拽态样式：

```css
/* 拖拽态(Vue2 photos-smartview.scss:292-299)。Vue2 用 rgba(137,80,242,…) 紫色字面量;
   本仓禁裸色,改用 --accent 家族的 color-mix(与 SmartViewCard .sv-collage-badge 同款
   写法,不是裸字面量,无需 theme-exception)。 */
.mo-grid :deep(.mo-drag-ghost) {
  opacity: 0.4;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent);
}
.mo-grid :deep(.mo-drag-chosen) { cursor: grabbing; }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts src/views/PhotosSmartViews.moments.test.ts src/photos/components/__tests__ --reporter=verbose`
Expected: PASS，含既有相册拖拽用例全绿（证明默认值没改动行为）

- [ ] **Step 5: 提交**

```bash
git add src/photos/composables/useAlbumDragSort.ts src/photos/composables/__tests__/useAlbumDragSort.test.ts src/views/PhotosSmartViews.vue src/views/PhotosSmartViews.moments.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): let moments be reordered by dragging

Reuses the album drag-sort composable rather than adding a second Sortable
wrapper; the item selector and the two class names become optional parameters
whose defaults are the album page's current values, so that page is untouched.

Vue 2 rebinds Sortable from three watchers, two of which watch an inline detail
view collapsing back to the list. Those have no counterpart here — the detail
page is its own route, so leaving unmounts the whole component — and copying
them would produce watchers that can never fire. Only the third case survives:
the grid is a freshly mounted node when the band goes from hidden to shown."
```

---

## Task 7: 路由 + 详情页骨架

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/views/PhotosMomentDetail.vue`
- Test: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `usePhotosMoments`（Task 3）· `relTime`（既有 `src/photos/util/relTime.ts`）
- Produces: 路由 `photos-moment-detail` at `/photos/moments/:id`；组件内部 `momentAssetCount` / `places` 等状态给 Task 8/9/10 续接

**新增 i18n 键**（节选，其余见 Step 3 表）：`photosMoBackToAll` · `photosMoLastUpdated` · `photosMoNotFound` · `photosMoAbout` · `photosMoStats` · `photosMoType` · `photosMoTime` · `photosMoPlace` · `photosMoByMonth` · `photosMoSpan` · `photosMoSpanDays` · `photosMoLastUpdate` · `photosMoPhotos` · `photosMoFeatured`

- [ ] **Step 1: 写失败的测试**

新建 `src/views/PhotosMomentDetail.test.ts`：

```ts
// SP15-P1-T7: 时刻详情页骨架。靶子 Vue2 899af59b:PhotosMomentDetail.vue:1-121(顶栏 +
// 两栏 + About/Stats/By month)与 :203-291(computed)。
// ★ 本页是 New-UI 独有的**路由页**(Vue2 是内联子组件),因此多出一条 Vue2 不存在的路径:
//   冷深链 —— 后端没有 GET /moments/:id,必须回落到拉全量列表再按 id 查。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import en from '../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async () => []),
    getMomentAssets: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosMomentDetail from './PhotosMomentDetail.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'

const RAW = {
  id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', cover_asset_id: 'c1',
  asset_count: 42, time_from: '2016-11-20T00:00:00Z', time_to: '2016-11-22T00:00:00Z',
  place: 'Bozeman', recipe_key: 'trip:1', featured_asset_ids: ['f1'],
  added_this_week: 3, cover_ratio: 1.5,
}

function makeMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1'],
    assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
    timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z', updatedAt: '', ...over,
  }
}

async function mountDetail(id = 'm1', locale: 'zh_cn' | 'en_us' = 'en_us') {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
    ],
  })
  await router.push('/photos/moments/' + id)
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
  const w = mount(PhotosMomentDetail, { global: { plugins: [i18n, router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('冷深链(New-UI 独有路径 —— 后端无 GET /moments/:id)', () => {
  it('store 为空时拉全量列表再按 id 查出这一条', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([RAW])
    const { w } = await mountDetail('m1')
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('Bozeman')
  })

  it('store 已有该条时不再拉列表', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    s.listLoaded = true
    await mountDetail('m1')
    expect(svc.photos.listMoments).not.toHaveBeenCalled()
  })

  it('列表拉完仍查无此条时渲染"时刻不存在",不是空白页', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([])
    const { w } = await mountDetail('nope')
    expect(w.find('[data-test="mo-not-found"]').exists()).toBe(true)
  })
})

describe('顶栏与头部', () => {
  it('返回按钮回智能视图页', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-back"]').trigger('click')
    expect(router.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('后端不发 updated_at ⇒ 顶栏与 Stats 的更新时间都显示占位符', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-last-updated"]').text()).toContain('—')
  })

  it('addedThisWeek 为 0 时不渲染绿色徽标', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ addedThisWeek: 0 })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('.mo-week-badge').exists()).toBe(false)
  })
})

describe('About 侧栏', () => {
  it('时间窗:首尾同日时只显示一个日期', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T01:00:00Z', timeTo: '2016-11-20T09:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    const txt = w.find('[data-test="mo-about-time"]').text()
    expect(txt).not.toContain('–')
  })

  it('时间窗缺失时回落 subtitle,subtitle 也没有才用占位符', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '', timeTo: '', subtitle: 'Nov 2016' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-time"]').text()).toContain('Nov 2016')
  })

  it('places 非空时取前三个城市名,超出三个补 +N', async () => {
    svc.photos.getMomentAssets.mockResolvedValue({
      assets: [], members: [],
      places: [{ name: 'A', count: 9 }, { name: 'B', count: 8 }, { name: 'C', count: 7 }, { name: 'D', count: 1 }],
    })
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('A · B · C +1')
  })

  it('places 为空时回落 moment.place', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: 'Bozeman' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('Bozeman')
  })

  it('places 与 place 都没有时,行仍然渲染并显示占位符(不整行隐藏)', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: '' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('—')
  })
})

describe('Stats 与月份分布', () => {
  it('跨度按首尾日期算,含头含尾', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-stat-span"]').text()).toContain('3')
  })

  it('缺时间窗时跨度显示占位符', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ timeFrom: '', timeTo: '' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-stat-span"]').text()).toContain('—')
  })

  it('月份直方图按 YYYY-MM 分桶并升序;无 takenAt 的照片被跳过', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, featured: boolean) =>
      featured ? { assets: [], members: [], places: [] }
        : [
          { id: 'a', takenAt: '2016-12-02T00:00:00Z' },
          { id: 'b', takenAt: '2016-11-20T00:00:00Z' },
          { id: 'c', takenAt: '2016-11-21T00:00:00Z' },
          { id: 'd' },
        ],
    )
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    const bars = w.findAll('[data-test="mo-dist-bar"]')
    expect(bars).toHaveLength(2)
    expect(bars[0].attributes('title')).toContain('2')  // 11 月两张,排在前
  })

  it('没有任何 takenAt 时整个 By month 分节不渲染', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, featured: boolean) =>
      featured ? { assets: [], members: [], places: [] } : [{ id: 'a' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-dist"]').exists()).toBe(false)
  })
})

describe('路由参数变化', () => {
  it('只改 :id 不重挂载时也要重新拉数据(watch 盯 route.params.id)', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1' }), makeMoment({ id: 'm2', title: 'Other' })]
    s.listLoaded = true
    const { w, router } = await mountDetail('m1')
    svc.photos.getMomentAssets.mockClear()
    await router.push('/photos/moments/m2')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.text()).toContain('Other')
    expect(svc.photos.getMomentAssets).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— 找不到 `./PhotosMomentDetail.vue`

- [ ] **Step 3: 实现**

新增 i18n 键（两侧都加）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoBackToAll` | `全部时刻` | `All Moments` |
| `photosMoLastUpdated` | `最后更新 {time}` | `Last updated {time}` |
| `photosMoNotFound` | `找不到这个时刻` | `This moment no longer exists` |
| `photosMoAbout` | `关于` | `About` |
| `photosMoStats` | `统计` | `Stats` |
| `photosMoType` | `类型` | `Type` |
| `photosMoTime` | `时间` | `Time` |
| `photosMoPlace` | `地点` | `Place` |
| `photosMoByMonth` | `按月份` | `By month` |
| `photosMoSpan` | `跨度` | `Span` |
| `photosMoSpanDays` | `{n} 天` | `{n} days` |
| `photosMoLastUpdate` | `最后更新` | `Last update` |
| `photosMoPhotos` | `照片` | `Photos` |
| `photosMoFeatured` | `精选` | `Featured` |

新建 `src/views/PhotosMomentDetail.vue`。要点（完整实现照下述结构写）：

```vue
<script setup lang="ts">
// SP15-P1-T7: PhotosMomentDetail.vue —— 时刻详情页(路由 /photos/moments/:id)。
// 逐段照 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosMomentDetail.vue 移植;
// 复用 PhotosSmartViewDetail.vue 已有的 sv-detail-* 两栏骨架与样式类(Vue2 那边就是
// 这么复用的,顶栏注释原话 "same as sv-detail-bar")。
//
// ★★★ 与 Vue2 的结构性差异,读完再改 ★★★
// Vue2 这页是 PhotosSmartViewsView 的内联子组件,moment 对象由父组件当 prop 传进来,
// 所以它没有、也不需要"查无此条"这条路径。New-UI 是真路由:用户手改地址栏、点旧书签、
// 分区隐藏时直接访问,都会走到这里。而**后端没有 GET /moments/:id**
// (NimoOS-Photos/route/router.go 只有 GET /moments 全量与 GET /moments/:id/assets),
// 所以冷深链只能拉全量列表再按 id 查 —— 这就是 ensureLoaded() + byId() 的由来。
//
// 偏离登记:
//  1) 「查无此条」空态是 New-UI 新增(理由见上),Vue2 无对应物。
//  2) 后端 momentResponse **不含 updated_at**(已回源核对 route/v1/moments.go:39-73),
//     所以 Vue2 的 lastUpdated 恒为 '—'。这里保持同样的渲染结果,不引入永远不会命中的
//     relTime 分支;字段留在类型里是为后端将来补上时无需改类型。
//  3) 关闭 more 菜单的 document mousedown 监听照抄 Vue2 mounted/beforeDestroy,
//     换成 onMounted/onBeforeUnmount。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import { usePhotosMoments, type MomentMember, type MomentPlace } from '../photos/stores/moments'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const store = usePhotosMoments()

const momentId = computed(() => String(route.params.id ?? ''))
const moment = computed(() => store.byId(momentId.value))
const notFound = computed(() => store.listLoaded && !moment.value)

const featuredAssets = ref<Photo[]>([])
const allAssets = ref<Photo[]>([])
const allLoading = ref(false)
const manualIds = ref<Set<string>>(new Set())
const places = ref<MomentPlace[]>([])

// 过期守卫(Global Constraints §6):切 :id 时旧请求可能后返回。
let loadEpoch = 0

async function load(): Promise<void> {
  const epoch = ++loadEpoch
  await store.ensureLoaded()
  if (epoch !== loadEpoch || !moment.value) return
  allLoading.value = true
  try {
    const [detail, all] = await Promise.all([
      store.loadDetail(momentId.value),
      store.loadAll(momentId.value),
    ])
    if (epoch !== loadEpoch) return
    featuredAssets.value = detail.assets
    manualIds.value = new Set(detail.members.filter((m: MomentMember) => m.manual).map((m) => m.assetId))
    places.value = detail.places
    allAssets.value = all
  } catch (e) {
    console.error('[photos-moments] load detail', e)
  } finally {
    if (epoch === loadEpoch) allLoading.value = false
  }
}

onMounted(load)
// 只改 query/params 不 remount —— 必须 watch,不能只写在 onMounted 里(本仓既有教训)。
watch(momentId, () => { void load() })
</script>
```

模板与 computed 的其余部分逐条照 Vue2：
- `momentAssetCount` = `moment.assetCount`（Task 3 已把它收进 store，不再是本地副本）
- `typeLabel` / `timeWindowLabel` / `spanDays` / `spanLabel` / `monthBuckets` / `distMax` / `distStyle` / `placesLabel` / `placesTitle` —— 全部照 Vue2 `:203-291` 与 `:418-421`，**locale 一律传 BCP-47 标签**
- 直方图每根柱子加 `data-test="mo-dist-bar"` 与 `:title="b.label + ' · ' + b.count"`
- 顶栏返回按钮 `data-test="mo-back"` → `router.push('/photos/smart-views')`
- About / Stats 各行加 `data-test="mo-about-time"` / `mo-about-place"` / `mo-stat-span"` / `mo-last-updated"`
- 「查无此条」块 `data-test="mo-not-found"`
- 样式照 `photos-smartview.scss:269-290`（`.mo-about-row` 三行键值对），发际线用 `--divider`，橙色类型胶囊用 `--warn-bg` / `--warn-fg`

`src/router/index.ts` —— **只追加，不重排**（照 SP7-P8a-T5 的既有约束，`router/index.test.ts` 会断言顺序）：

```ts
  { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
```

插在 `/photos/smart-views/:id` 之后、`/photos/search` 之前。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/router --reporter=verbose`
Expected: PASS，17 个详情页用例 + 路由测试全绿

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/router/index.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): add the moment detail page as a route

Vue 2 renders this inline inside the smart views page and receives the moment
as a prop, so it never has to answer \"what if that id does not exist\". A real
route does, and the backend has no GET /moments/:id — only the full list and
the per-moment assets — so a cold deep link falls back to fetching the list and
looking the id up, and renders an explicit not-found state instead of a blank
page when that fails.

The last-updated line always renders a dash. momentResponse carries no
updated_at field, so Vue 2's relative-time branch could never fire either; the
field stays in the type for when the backend adds it, without dead code to
format it."
```

---

## Task 8: 详情页两段照片网格

**Files:**
- Modify: `src/views/PhotosMomentDetail.vue`
- Modify: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `featuredAssets` / `allAssets` / `manualIds`（Task 7）· `useLightbox`（既有 `src/photos/lightbox/useLightbox.ts`）
- Produces: `selecting` / `selectedIds` 两个 ref，供 Task 9 的批量移除消费

**新增 i18n 键**：`photosMoAllPhotos` · `photosMoLoading` · `photosMoNoPhotosYet`

- [ ] **Step 1: 写失败的测试**

在 `src/views/PhotosMomentDetail.test.ts` 追加：

```ts
describe('两段照片网格', () => {
  function mockAssets(featured: unknown[], all: unknown[], members: unknown[] = []) {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: featured, members, places: [] } : all)
  }

  it('Featured 有内容时渲染该分节,并在标题上显示张数', async () => {
    mockAssets([{ id: 'f1' }, { id: 'f2' }], [{ id: 'f1' }, { id: 'f2' }, { id: 'a3' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-featured-head"]').text()).toContain('2')
    expect(w.findAll('[data-test="mo-featured-tile"]')).toHaveLength(2)
  })

  it('Featured 为空时整个分节不渲染', async () => {
    mockAssets([], [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-featured-head"]').exists()).toBe(false)
  })

  it('manual 成员在 Featured 里显示 pin 角标,非 manual 不显示', async () => {
    mockAssets([{ id: 'f1' }, { id: 'f2' }], [], [
      { asset_id: 'f1', manual: true, featured: true },
      { asset_id: 'f2', manual: false, featured: true },
    ])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.findAll('[data-test="mo-pin-tag"]')).toHaveLength(1)
  })

  it('All photos 为空且加载完毕时显示"还没有照片"', async () => {
    mockAssets([], [])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-all-empty"]').exists()).toBe(true)
  })

  it('非选择态点瓦片打开灯箱;选择态点瓦片只切选中,不开灯箱', async () => {
    mockAssets([], [{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    // ⚠️ useLightbox().open 是 Ref<boolean>,不是函数;打开的方法叫 openAt。
    const lb = useLightbox()
    const openAt = vi.spyOn(lb, 'openAt')

    await w.findAll('[data-test="mo-all-tile"]')[0].trigger('click')
    expect(openAt).toHaveBeenCalledTimes(1)

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.findAll('[data-test="mo-all-tile"]')[1].trigger('click')
    expect(openAt).toHaveBeenCalledTimes(1)                     // 没有再开
    expect(w.find('[data-test="mo-select-bar"]').text()).toContain('1')
  })

  it('退出选择态会清空已选', async () => {
    mockAssets([], [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
  })
})
```

> 顶部需 `import { useLightbox } from '../photos/lightbox/useLightbox'`。
> **⚠️ 该 composable 的 `open` 是 `Ref<boolean>`，不是函数** —— 打开灯箱的方法叫
> `openAt(photo, entryList, startMs?, query?)`（`useLightbox.ts:144,155`）。上面用例里的
> `vi.spyOn(lb, 'openAt')`，别写成 `open`（写成 `open` 会 spy 到一个 ref 上，报
> `Cannot spy on a non-function value` 或静默失效）。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-featured-tile"]` 找不到

- [ ] **Step 3: 实现**

在 `PhotosMomentDetail.vue` 补：

```ts
const selecting = ref(false)
const selectedIds = ref<string[]>([])

function toggleSelecting(): void {
  selecting.value = !selecting.value
  if (!selecting.value) selectedIds.value = []
}
function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}
function onTileClick(p: Photo, list: Photo[]): void {
  if (selecting.value) toggleSelect(String(p.id))
  else lightbox.openAt(p, list)   // openAt(photo, entryList) —— open 是 Ref,不是函数
}
```

模板两段网格照 Vue2 `:52-79`，瓦片加 `data-test="mo-featured-tile"` / `mo-all-tile"`，pin 角标 `data-test="mo-pin-tag"`，选择栏 `data-test="mo-select-bar"`，Select 按钮 `data-test="mo-select-toggle"`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，累计 23 个详情页用例

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): render the moment's featured and full photo grids

Pin badges come from the with_members receipts and only overlay the featured
strip, matching Vue 2. Selection mode suppresses the lightbox so a tap during
selection cannot both select and open."
```

---

## Task 9: 加入照片 / 移出照片

**Files:**
- Modify: `src/photos/components/AlbumLibraryPicker.vue`（**泛化**，见 Step 0）
- Modify: `src/photos/components/__tests__/AlbumLibraryPicker.test.ts`
- Modify: `src/views/PhotosAlbums.vue` · `src/views/PhotosAlbumDetail.vue`（两个既有消费方适配新 props）
- Modify: `src/views/PhotosMomentDetail.vue`
- Modify: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `store.pin` / `store.exclude`（Task 3）· `useToast`
- Produces: `AlbumLibraryPicker` 的新签名
  - props: `{ open: boolean; title: string; existingIds: Set<string>; existingLabel: string; submitLabel: string }`
  - emits: `{ 'update:open': (v: boolean) => void; confirm: (ids: string[]) => void }`

> **⚠️ 这一步是计划写完后自审逮到的，原稿写的「复用 `AlbumLibraryPicker`」不成立。**
> New-UI 的 `AlbumLibraryPicker.vue`（393 行）是**相册专用**的：props 是 `{ open, albumId, albumName }`，
> `existingIds` 直接读 `albums.assetsOf(props.albumId)`（`:54`），提交时自己调
> `albums.addAssetsToAlbum`（`:136`）。时刻不是相册，这三处都对不上。
>
> Vue2 早就解决过：`#79` 把 `PhotosAlbumLibraryPicker.vue` 泛化成通用的
> `PhotosLibraryPicker.vue`（`R072` 重命名 + 43 行改动）—— 而 **`#79` 没有被 SP7 吸收**
> （New-UI 的 `pinSmartViewAssets`/`removeSmartViewAssets`/`restoreSmartViewAssets`/
> `getSmartViewExcluded` 四个方法全无），所以泛化这一步也没跟过来。
>
> **本期只做泛化，不做重命名。** 重命名是 `#79` 的一部分，跟 `#79` 的其余内容一起归 P2；
> P1 只取它必需的那一半，把文件名与「其实已经不只服务相册」的落差登记在文件头。

- [ ] **Step 0: 泛化 AlbumLibraryPicker（先跑既有测试确认基线绿）**

Run 基线：`pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts --reporter=verbose` → 记下用例数。

改三处（其余 380 余行不动）：

```ts
// props:相册专用三件套 → 通用四件套
const props = defineProps<{
  open: boolean
  title: string
  existingIds: Set<string>
  existingLabel: string
  submitLabel: string
}>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', ids: string[]): void
}>()

// :54 原本自己从 albums store 取;改为直接用 prop(调用方负责算)
const existingIds = computed(() => props.existingIds)

// :136 原本自己写库;改为把 id 交出去,由调用方决定写到哪
emit('confirm', ids)
```

同时删掉不再需要的 `usePhotosAlbums` import（若泛化后无其它用途）。

两个既有消费方各自补上原本由组件内部承担的两件事：
- `PhotosAlbums.vue:366` 与 `PhotosAlbumDetail.vue:597`：传
  `:existing-ids="new Set(albums.assetsOf(id).map(p => String(p.id)))"`、`:title`、
  `:existing-label`、`:submit-label`，并把 `@confirm` 接到 `albums.addAssetsToAlbum(...)` 上，
  成功后仍 emit 原来的 `added` 语义（toast 与计数逻辑保持不变）。

在 `AlbumLibraryPicker.test.ts` 里把 props 改成新签名，并新增一条用例：

```ts
it('SP15-P1-T9 泛化:提交时只 emit confirm,不自己写库', async () => {
  const albums = usePhotosAlbums()
  const spy = vi.spyOn(albums, 'addAssetsToAlbum')
  const w = mountPicker({ open: true, existingIds: new Set<string>() })
  // …选中一张…
  await w.find('[data-test="alp-submit"]').trigger('click')
  expect(spy).not.toHaveBeenCalled()
  expect(w.emitted('confirm')?.[0]?.[0]).toEqual(['a1'])
})
```

跑：`pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/views/PhotosAlbums src/views/PhotosAlbumDetail --reporter=verbose`
Expected: 既有用例数不减，全绿（证明相册两条路径行为未变）

提交：

```bash
git add src/photos/components/AlbumLibraryPicker.vue src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/views/PhotosAlbums.vue src/views/PhotosAlbumDetail.vue
git commit -m "refactor(photos): make the library picker album-agnostic

It hardcoded the album store for both halves of its job: reading which assets
are already in, and writing the chosen ones back. Moments need the same picker
against a different collection, so both halves move out to the caller and the
component is left with the picking.

Vue 2 made this exact change in #79, along with a rename. Only the
generalisation is needed here; the rename travels with the rest of #79 in P2."
```

**新增 i18n 键**：`photosMoAddPhotos` · `photosMoAddPhotosTitle`（`加入「{name}」`）· `photosMoAlreadyIn` · `photosMoAddSelected` · `photosMoAddedN` · `photosMoAddFailed` · `photosMoRemoveFromMoment` · `photosMoRemovedN` · `photosMoRemoveFailed` · `photosMoSelectedN`

- [ ] **Step 1: 写失败的测试**

在 `src/views/PhotosMomentDetail.test.ts` 追加：

```ts
describe('加入 / 移出照片', () => {
  it('加入成功:调 pin、刷新两段网格、张数跟着变、弹成功 toast', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [])
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    const pin = vi.spyOn(s, 'pin').mockResolvedValue(44)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail()

    await w.find('[data-test="mo-add-photos"]').trigger('click')
    w.findComponent(AlbumLibraryPicker).vm.$emit('confirm', ['x', 'y'])
    await new Promise((r) => setTimeout(r, 0))

    expect(pin).toHaveBeenCalledWith('m1', ['x', 'y'])
    expect(s.byId('m1')?.assetCount).toBe(44)
    expect(show).toHaveBeenCalled()
  })

  it('加入失败:弹失败 toast,张数不动', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [])
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    vi.spyOn(s, 'pin').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-add-photos"]').trigger('click')
    w.findComponent(AlbumLibraryPicker).vm.$emit('confirm', ['x'])
    await new Promise((r) => setTimeout(r, 0))
    expect(s.byId('m1')?.assetCount).toBe(42)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('失败'), expect.anything(), 'danger')
  })

  it('移出成功:调 exclude、退出选择态、清空已选、刷新网格', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const exclude = vi.spyOn(s, 'exclude').mockResolvedValue(41)
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(exclude).toHaveBeenCalledWith('m1', ['a1'])
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
  })

  it('移出失败:保持选择态与已选不变(用户可重试)', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exclude').mockRejectedValue(new Error('nope'))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(true)
  })

  it('已选为空时移出按钮不发请求', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const exclude = vi.spyOn(s, 'exclude')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)  // 空选时整条不渲染
    expect(exclude).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-add-photos"]` 找不到

- [ ] **Step 3: 实现**

```ts
const pickerOpen = ref(false)
const memberIds = computed(() => new Set(allAssets.value.map((p) => String(p.id))))

async function onPickPhotos(assetIds: string[]): Promise<void> {
  try {
    await store.pin(momentId.value, assetIds)
    toast.show(t('photosMoAddedN', { n: assetIds.length }))
    await load()
  } catch (e) {
    console.error('[photos-moments] pin', e)
    toast.show(t('photosMoAddFailed'), 2500, 'danger')
  }
}

async function removeSelected(): Promise<void> {
  const ids = selectedIds.value.slice()
  if (!ids.length) return
  try {
    await store.exclude(momentId.value, ids)
    toast.show(t('photosMoRemovedN', { n: ids.length }))
    // 成功才退出选择态;失败保持原状让用户重试(Vue2 :386-387 同样只在成功分支清空)
    selecting.value = false
    selectedIds.value = []
    await load()
  } catch (e) {
    console.error('[photos-moments] exclude', e)
    toast.show(t('photosMoRemoveFailed'), 2500, 'danger')
  }
}
```

模板：Add photos 按钮 `data-test="mo-add-photos"`；选择栏里的移出按钮 `data-test="mo-remove-selected"`；`<AlbumLibraryPicker>` 按 Step 0 泛化后的新签名挂载：

```vue
    <AlbumLibraryPicker
      v-model:open="pickerOpen"
      :title="t('photosMoAddPhotosTitle', { name: moment?.title ?? '' })"
      :existing-ids="memberIds"
      :existing-label="t('photosMoAlreadyIn')"
      :submit-label="t('photosMoAddSelected')"
      @confirm="onPickPhotos"
    />
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，累计 28 个详情页用例

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): add and remove photos from a moment

The count no longer has to be mirrored back to the list by hand — both views
read the same store entry — so Vue 2's asset-count-changed event has no
equivalent here.

Selection is cleared only on success. Vue 2 does the same, and it matters: on
failure the user still has their selection and can retry."
```

---

## Task 10: 导出相册 / 删除时刻

**Files:**
- Modify: `src/views/PhotosMomentDetail.vue`
- Modify: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `store.exportAlbum` / `store.remove`（Task 3）
- Produces: 无新导出

**新增 i18n 键**：`photosMoSaveAsAlbum` · `photosMoAlbumCreated`（`相册「{name}」已创建 · {count} 张照片`）· `photosMoOpen` · `photosMoAlbumExists` · `photosMoAlbumFailed` · `photosMoDeleteMoment` · `photosMoPhotosStay` · `photosMoDeleteTitle`（`删除「{name}」？`）· `photosMoDeleteBody` · `photosMoDeleted` · `photosMoDeleteFailed` · `photosMoCancel` · `photosMoDelete`

- [ ] **Step 1: 写失败的测试**

在 `src/views/PhotosMomentDetail.test.ts` 追加：

```ts
describe('导出相册', () => {
  it('成功时 toast 带"打开"动作,点它跳新相册', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exportAlbum').mockResolvedValue({ albumId: 'al1', name: 'Bozeman', count: 42 })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const action = show.mock.calls[0][2] as { label: string; onClick: () => void }
    expect(action.label).toBeTruthy()
    action.onClick()
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/photos/albums/al1')
  })

  it('重名(409)时给出专门的文案,不是笼统失败', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exportAlbum').mockRejectedValue({ response: { status: 409 } })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(show.mock.calls[0][0]).toContain('已存在')
  })

  it('导出进行中时按钮禁用,防重复点击', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    let release: () => void = () => {}
    vi.spyOn(s, 'exportAlbum').mockImplementation(() => new Promise((r) => { release = () => r({}) }))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="mo-save-album"]').attributes('disabled')).toBeDefined()
    release()
  })
})

describe('删除时刻', () => {
  it('更多菜单里点删除先弹确认框,不直接删', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const remove = vi.spyOn(s, 'remove')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('确认后删除并跳回智能视图页', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockResolvedValue(undefined)
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('删除失败时留在原页,错误提示内联在确认框里(不是 toast)', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockRejectedValue(new Error('nope'))
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/photos/moments/m1')
    expect(w.find('[data-test="mo-delete-error"]').exists()).toBe(true)
  })

  it('取消关闭确认框', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-cancel"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(false)
  })

  it('点菜单外关闭更多菜单', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="mo-delete"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-save-album"]` 找不到

- [ ] **Step 3: 实现**

```ts
const exporting = ref(false)
const moreOpen = ref(false)
const confirmDeleteOpen = ref(false)
const deleteError = ref('')

async function saveAsAlbum(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    const data = await store.exportAlbum(momentId.value)
    const name = data.name || moment.value?.title || ''
    const count = data.count ?? 0
    toast.show(t('photosMoAlbumCreated', { name, count }), 5000, {
      label: t('photosMoOpen'),
      onClick: () => { router.push('/photos/albums/' + data.albumId) },
    })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    toast.show(status === 409 ? t('photosMoAlbumExists') : t('photosMoAlbumFailed'), 2500, 'danger')
  } finally {
    exporting.value = false
  }
}

async function doDelete(): Promise<void> {
  deleteError.value = ''
  try {
    await store.remove(momentId.value)
    router.push('/photos/smart-views')
  } catch (e) {
    // 弹窗内的失败提示走内联,不用 toast —— 答的是刚按下的那个按钮,得钉在旁边、
    // 不自动消失(本仓既定做法)。Vue2 这里是 toast + 关框,用户会以为删掉了。
    console.error('[photos-moments] deleteMoment', e)
    deleteError.value = t('photosMoDeleteFailed')
  }
}
```

更多菜单的 document mousedown 关闭逻辑照 Vue2 `:295-305`，用 `onMounted` / `onBeforeUnmount`。

模板：`data-test` 依次为 `mo-save-album` / `mo-more` / `mo-delete` / `mo-delete-confirm` / `mo-delete-go` / `mo-delete-cancel` / `mo-delete-error`。确认框结构与样式照 `PhotosSmartViewDetail.vue:609` 起的既有删除确认弹窗，**不新造**。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，累计 37 个详情页用例

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): save a moment as an album, and delete a moment

A failed delete keeps its message inline in the confirmation dialog rather than
in a toast. Vue 2 closes the dialog and shows a toast, which reads as \"it
worked\" for the second or so before the message registers; the answer to a
button press belongs next to that button and should not time out.

The 409 case gets its own wording so a name clash is not reported as a generic
failure the user cannot act on."
```

---

## Task 11: 收尾门 + 验收清单

**Files:**
- Create: `docs/superpowers/2026-08-09-sp15-p1-acceptance.md`

- [ ] **Step 1: 全量跑五门**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/1bca60c8-eec9-4053-a989-93051553eaf2/scratchpad/oss-out --no-commit --allow-dirty-oss
pnpm build
```

把**实际数字**（文件数 / 用例数）记进验收文档，不要写「全绿」了事。

- [ ] **Step 2: 跑 color-guard 与 CSS 守卫**

```bash
pnpm exec vitest run src/styles --reporter=verbose
grep -rn '\*/' src/views/PhotosMomentDetail.vue src/photos/components/MomentCard.vue src/views/PhotosSmartViews.vue | grep -v '^\s*$'
```

逐条确认没有「`*` 紧贴 `/`」提前关闭注释的写法（Global Constraints §3）。

- [ ] **Step 3: 写验收清单**

新建 `docs/superpowers/2026-08-09-sp15-p1-acceptance.md`，内容包含：

> **第 0 步（必做）**：在浏览器 F12 控制台执行一次重算，否则下面每一步都只能看到空态。
>
> ```js
> await fetch('/v1/photos/moments/recompute', {
>   method: 'POST',
>   headers: { Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('token')).access_token },
> }).then(r => r.status)
> ```
> （`localStorage` 里 token 的确切键名以实机为准，先 `Object.keys(localStorage)` 看一眼。）
>
> **第 1 行提示**：若 For You 分区整块不出现，先确认 `moments` 表是否仍为 0 行 —— **那是数据不足，不是本期缺陷**。本设备 785 张照片里只有 7 张带 GPS，`trip` 聚不出行程；五条 `theme:*` 被 BE-1 卡死；只有 `profile:family` 有一个候选实体。**最好情况 1 条，最坏 0 条。**

其余步骤：分区显隐与 `aiFeatures.smartview` 门控 · 五种拼贴形态（需要多条时刻才看得全，数据不足时挂账）· 拖拽排序并刷新页面确认顺序留存 · 深链 `/app/#/photos/moments/<id>` 冷启动 · 乱填 id 看「找不到」空态 · 加入/移出照片后张数在**列表卡片上**同步 · 导出相册后点 toast 的「打开」· 删除时刻的确认框与失败内联提示 · **浅色与深色两套主题都要看**（token 映射 jsdom 照不出）。

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/2026-08-09-sp15-p1-acceptance.md
git commit -m "docs(sp15): record the P1 gate results and the acceptance list

The list opens with a console-triggered recompute because there is no UI entry
point for it — Vue 2 never exposed one either — and with a warning that an
empty For You band is the expected outcome on this device rather than a bug."
```

---

## 自审记录

**Spec 覆盖**：spec §1.1 的六项 —— 数据层 T1/T3 · 时刻卡 T2/T4 · For You 分区 T5 · 拖拽 T6 · 详情页 T7-T10 · `#106` 已按 spec 修订移出 P1（归 P4），本计划不含。spec §4 的四个「照抄会错」处 —— ① 无单条接口 → T7 冷深链用例；② Sortable 重绑 → T6 注释与用例；③ 空态藏整块 → T5 首条用例 + T11 验收首行；④ 过期守卫 → T3 与 T7 各一条交错用例。spec §5 错误处理四条 → T6/T9/T10。spec §6 五门 + color-guard → T11。

**类型一致性**：`Moment` 字段名在 T3 定义、T4/T5/T7 消费，全部驼峰；`MomentSize`/`MomentTemplate` 在 T2 定义、T4/T5 消费；`store.pin`/`exclude` 返回 `number | null`，T9 不解构 `asset_count`（那是 service 层的形状，store 已归一）。

**自审逮到并已就地修掉的两处**（原稿是 placeholder，现已查实写死）：

1. **`useLightbox().open` 是 `Ref<boolean>` 不是函数**，打开灯箱的方法叫
   `openAt(photo, entryList, startMs?, query?)`（`src/photos/lightbox/useLightbox.ts:144,155`）。
   T8 的实现与 spy 都已改成 `openAt`。
2. **`AlbumLibraryPicker` 复用不成立** —— 它是相册专用的（`props: {open, albumId, albumName}`，
   `:54` 读 `albums.assetsOf`，`:136` 自己写库）。已在 T9 前加 Step 0 做泛化，并连带更正了
   spec 与 roadmap 里「`#79` 已被 SP7 吸收」这条错误断言（`#79`/`#82` 实际未吸收，已归 P2）。

# Task 6: PhotosSidebar isActive 最长前缀匹配 + 收藏/回收站条目 — 完成报告

## 状态
✅ 完成。TDD 验证通过，全量测试 GREEN，类型检查无错，已提交。

## 实现清单

### 1. 纯函数 `activeNavId` (新建)
- **文件**: `src/photos/util/activeNavId.ts`
- **功能**: 最长前缀匹配，返回匹配 `route` 最长的 nav item 的 `id`；精确等于或以 `route+'/'` 开头
- **行数**: 24 行（含注释）

### 2. 单测 `activeNavId.test.ts` (新建)
- **文件**: `src/photos/util/__tests__/activeNavId.test.ts`
- **断言数**: 5 个（精确匹配/最长前缀/无匹配等，全部绿）
- **TDD 证据**: 
  - RED: 测试导入文件不存在 → 编译失败
  - GREEN: 实现后 5 个测试全部通过

### 3. PhotosSidebar.vue 变更
- **变更点 1**: 导入 `activeNavId` 函数
- **变更点 2**: NAV 数组从 1 项扩展为 3 项
  - library: `/photos` (既有)
  - **favorites**: `/photos/favorites` (新)
  - **trash**: `/photos/trash` (新)
- **变更点 3**: `isActive(n)` 改为 `activeNavId(route.path, NAV) === n.id`
  - 从 `startsWith` 改为最长前缀匹配
  - 修复 `/photos` 与 `/photos/favorites` 双高亮隐患

### 4. PhotosSidebar.test.ts 变更
- **测试 1**: 从断言 1 项改为断言 3 项导航项
- **测试 2 (新)**: 验证 `/photos/favorites` 时仅 favorites 高亮，library 不高亮（双高亮隐患已修复）
- **路由配置**: 补充 `/photos/favorites` 和 `/photos/trash` 路由

### 5. i18n 键值新增
#### zh_cn.ts
```typescript
photosFavorites: '收藏',
photosTrash: '回收站',
```

#### en_us.ts
```typescript
photosFavorites: 'Favorites',
photosTrash: 'Recently Deleted',
```
- **位置**: 都在 `photosLibrary` 之后、`photosStorage` 之前
- **parity 检查**: 全量测试通过（i18n parity 断言验证两文件键完全一致）

## 测试总结

| 组件 | 测试文件 | 通过 | 备注 |
|------|---------|------|------|
| activeNavId | `util/__tests__/activeNavId.test.ts` | ✅ 5/5 | 精确/最长前缀/无匹配各覆盖 |
| PhotosSidebar | `components/__tests__/PhotosSidebar.test.ts` | ✅ 8/8 | 新增 /photos/favorites 验证 |
| 全量测试 | pnpm test | ✅ 242 files / 1478 tests | i18n parity 通过 |
| 类型检查 | vue-tsc --noEmit | ✅ 无错 | 完全 strict mode |

## 提交记录
```
commit 84d281d7fc9e7c3f678c260456b32d502de47857
Author: Tiansanchuan <1312528051@qq.com>
Date:   Mon Jul 27 11:53:55 2026 +0800

feat(photos): 侧栏加收藏/回收站条目 + isActive 最长前缀匹配(修双高亮)
```
- **变更文件**: 6 files
- **插入行**: 84 行
- **删除行**: 5 行

## 关键修复说明
原先 `isActive` 使用 `route.path.startsWith(n.route)` 导致：
- `/photos/favorites` 时，既匹配 `/photos`（library）又匹配 `/photos/favorites`（favorites）
- 两个 nav 项都被高亮

新的 `activeNavId` 采用**最长前缀匹配**:
- 迭代所有 nav items，找到匹配 path 的项
- 取其中 **route 字符串最长** 的那个 id
- `/photos/favorites` 时：`/photos/favorites`(23 chars) > `/photos`(7 chars) → 返回 `favorites`
- 完全解决双高亮隐患

## 约束与备注
- **i18n 键新增**: 按 brief 要求，本任务在 zh_cn.ts/en_us.ts 中新增了 `photosFavorites` 和 `photosTrash`
  - Task 7 会后续维护这些键（标注无重复）
  - 现状已可正常渲染，无缺失问题
- **纯函数设计**: `activeNavId` 独立、无副作用、可单测、可复用
- **TDD 验证**: 测试→RED→实现→GREEN→全量→commit 完整链路

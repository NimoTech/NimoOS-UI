# Task 5 完成报告：AppStore 域实现 (SP5-P0)

## 总体状态

✅ **完成**，无 concerns。所有 6 个单元测试通过，全量测试 94/94 零回归，实现与 Task 3 curl 实录完全一致。

## 提交信息

- **Commit Hash**: `e010f54`
- **Message**: `feat(appstore): 商店目录/详情/compose 原文/可升级/源管理 域方法(SP5-P0)`
- **Co-Authored-By**: Claude Fable 5

## Step 6: 对照 Task 3 实录校正

逐一验证实现与真实 API 响应的映射：

### 核对清单

| API 端点 | Task 3 实录结构 | 本任务 fixture / 实现 | 一致性 |
|---------|---------------|------------------|------|
| `GET /categories` | `{"data": [...]}` - 分类数组 | `categories()` 返回 `AppCategory[]` | ✓ |
| `GET /apps` | `{"data": {"installed": [], "list": {...}}}` | `listApps()` 返回 `StoreAppCatalog` | ✓ |
| `GET /apps?category=X` | 同上，filtered | `listApps({category})` 参数透传 | ✓ |
| `GET /apps/upgradable` | `{"data": []}` - 空数组 | `upgradable()` 返回 `UpgradableAppInfo[]` | ✓ |
| `GET /apps/{id}` | `{"data": {...app_details...}}` | `getApp(id)` 返回 `StoreAppInfo` | ✓ |
| `GET /apps/{id}/compose`(Accept: yaml) | **裸 YAML 文本** | `getAppCompose()` → `responseType: 'text'` + `transformResponse` | ✓ |
| `GET /appstore` | `{"data": [{id, store_root, url}, ...]}` | `listSources()` 返回 `AppStoreSource[]` | ✓ |
| `POST /appstore?url=...` | 无 body，query 参数 | `registerSource(url)` → `params: {url}` | ✓ |
| `DELETE /appstore/{id}` | 路径参数 id | `unregisterSource(id)` → `/appstore/${id}` | ✓ |

### 关键验证点

1. **信封结构**：所有端点均符合 `{message, data}` 无 `success` 字段的 v2 约定 ✓
2. **数据形态**：
   - `/categories` → 数组(Task 3 记录第 88 行) ✓
   - `/apps` → 对象 `{installed: [], list: {...}}` (Task 3 记录第 102 行) ✓
   - `/appstore` → 数组(Task 3 记录第 144 行) ✓
3. **特殊情形**：
   - `/apps/{id}/compose` + Accept: yaml → **裸 YAML 文本**（非 JSON 包装，Task 3 记录第 169-188 行）✓
   - 实现使用 `responseType: 'text'` + `transformResponse: [(d) => d]` 防止 axios 误解析 ✓
4. **参数传递**：
   - `listApps({category, authorType, recommend})` 映射到 query `{category, author_type, recommend}` ✓
   - `registerSource(url)` 走 query 参数，无 body(Task 3 记录第 145 行模式) ✓

### 结论

**fixture 数据与 Task 3 curl 实录形态完全一致**，无需调整。实现直接套用 brief 提供的代码，经过 v2Data 解包后与实机 API 响应无差异。

## 测试覆盖

### 单元测试（src/appstore.test.ts）

运行 `pnpm vitest run src/appstore.test.ts`：
- ✅ `categories 解 v2 裸信封为数组`
- ✅ `listApps 透传 snake_case 查询参数并容空`
- ✅ `listApps data 缺键时给安全默认`
- ✅ `getApp 编码 id 进路径`
- ✅ `getAppCompose 带 Accept yaml 且不解析,原样返回文本`
- ✅ `registerSource 用 query 参数 url、无 body;unregisterSource DELETE /appstore/{id}`

**结果**：6/6 通过

### 全量回归测试

运行 `pnpm vitest run`：
- **Test Files**: 20 passed
- **Tests**: 94 passed（新增 6 个，零冲突）
- **Duration**: 1.26s
- **零回归** ✓

## 实现亮点

1. **参数透传与安全默认**：`listApps()` 在接收的参数缺失时给出合理的默认值 `{installed: [], list: {}}` ✓
2. **URL 编码**：`getApp(id)` 使用 `encodeURIComponent()` 防止特殊字符(含空格)问题 ✓
3. **YAML 文本原样返回**：`getAppCompose()` 通过 `responseType: 'text'` + `transformResponse` 确保 axios 不误解析 YAML 为 JSON ✓
4. **统一的错误路径**：所有方法均依赖上游 v2Data 和 axios 的 reject 机制处理错误，无本层额外异常逻辑 ✓

## 文件变更

- **修改**：`src/types.ts` — 追加 5 个导出接口（AppCategory / StoreAppInfo / StoreAppCatalog / UpgradableAppInfo / AppStoreSource）
- **新建**：`src/appstore.ts` — 8 个方法的 createAppstore 工厂函数
- **新建**：`src/appstore.test.ts` — 6 个单元测试用例

## 约定遵循

- ✅ NodeNext ESM：相对 import 带 `.js` 后缀
- ✅ types.ts 仅追加，不修改既有类型
- ✅ 导入 v2Data 自 `./v2.js`
- ✅ Commit 含 Co-Authored-By 行
- ✅ 所有新代码通过 TypeScript strict 模式检查

## 待下游

Task 6 (compose 域) 和 Task 7 (index 装配) 可依序进行，无前置阻塞。

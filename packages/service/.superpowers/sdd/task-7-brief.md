### Task 7: index 装配 + 全量验证 + New-UI 消费方回归 + 记账

**Files:**
- Modify: `NimoOS-Service/src/index.ts`
- Modify: `NimoOS-UI/docs/vue3-migration-roadmap.md`(§3.3 域表)
- Modify: `NimoOS-New-UI/package.json` 的依赖重同步(仅 `pnpm install`,无文件改动)

**Interfaces:**
- Consumes: Task 4-6 全部产物。
- Produces: `service.appstore` / `service.compose` 可从 `@nimotech/nimoos-service` 直用;类型全导出。P1 起的页面代码只 import 这两个入口。

- [ ] **Step 1: index.ts 装配**

在 import 区追加(保持 `.js` 后缀):

```typescript
import { createAppstore } from './appstore.js'
import { createCompose } from './compose.js'
```

类型导出行追加:`AppCategory, StoreAppInfo, StoreAppCatalog, UpgradableAppInfo, AppStoreSource, ComposeAppWithStoreInfo`。

`service` 对象追加 getter(照既有模式):

```typescript
  get appstore(): ReturnType<typeof createAppstore> {
    return createAppstore(getHttp() as AxiosInstance)
  },
  get compose(): ReturnType<typeof createCompose> {
    return createCompose(getHttp() as AxiosInstance)
  },
```

- [ ] **Step 2: 共享包全量验证**

Run: `cd /home/nimo/NimoTech/NimoOS-Service && pnpm vitest run && pnpm exec tsc --noEmit && pnpm build`
Expected: 全绿(既有 28+ 用例零回归)+ tsc 零错 + dist 产出。

- [ ] **Step 3: New-UI 消费方回归**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm install     # file:../NimoOS-Service 本地包重同步(nimoos-service-pnpm-drift 教训)
pnpm vitest run
pnpm exec vue-tsc --noEmit
```

Expected: New-UI 全量测试与类型检查零回归(P0 未动 New-UI 源码,纯确认包升级无破坏)。

- [ ] **Step 4: Commit(共享包)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/index.ts
git commit -m "feat(index): 装配 appstore/compose 域并导出 SP5 类型

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: roadmap 记账 + 提交(NimoOS-UI docs 分支)**

`docs/vue3-migration-roadmap.md` §3.3 域表:「已进包」行追加 `appstore`(目录+源)与 `compose`(生命周期),并注 `appCategories→appstore.categories、container(v2)→compose、image 无 UI 直调不建域`;「待迁」行相应去掉 `appCategories`、标注 `container` 已覆盖 v2 部分。SP5 段加一行 P0 完成注记(AppManagement 合并 + 共享包域,坐标写实际 commit hash)。

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit -m "docs(roadmap): SP5-P0 完成记账(AppManagement 分支合并 + 共享包 appstore/compose 域)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: 台账收尾**

progress-sp5-p0.md 补齐:各任务结果、全部 commit hash(Service/AppManagement/docs)、Task 3 实录差异汇总、P1 待办提醒(页壳 + 已装管理,需先出 P1 计划)。

---

## 计划自审记录

- **Spec 覆盖**:本计划只覆盖 spec §4 的 P0 行(前置+地基),含 §7 风险 1/2/3(漂移审计、合并冲突、curl 铁律)。P1-P8 按惯例每期验收后单独出计划。
- **发现并落定的事实修正**:`POST /convert` 实证是 appfile→compose(非 docker run),spec §3.6 的"后端 convert 优先"决策规则据此落定为"P5 用前端 composerize";compose 域不建 convert 方法(YAGNI)。
- **类型一致性**:`v2Data`(Task 4 定义,Task 5/6 消费)、`StoreAppInfo`(Task 5 定义,Task 6 `store_info` 消费)、`createAppstore`/`createCompose`(Task 7 装配)签名逐一核对一致。

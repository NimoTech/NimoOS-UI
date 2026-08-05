### Task 11: 路由 + 侧栏入口 + 全量收口

**Files:**
- Modify: `src/router/index.ts`(+1 路由)、`src/files/components/FilesSidebar.vue`(+1 入口)
- Test: 既有全量 + `src/files/components/FilesSidebar.test.ts` 若存在则补一条入口断言(不存在则跳过,路由测试覆盖)

- [ ] **Step 1: 注册路由(`/files/shares` 行后)**

```ts
import DropPage from '../files/drop/components/DropPage.vue'
// routes 数组,置于 files-path 通配符之前:
{ path: '/files/drop', name: 'files-drop', component: DropPage },
```

注意:**必须放在 `/files/:path(.*)*` 之前**注册顺序无所谓(vue-router 4 按具体度匹配,静态段优先),但与 `files-shares` 并排放最清晰。

- [ ] **Step 2: 侧栏入口(FilesSidebar.vue,共享入口 `<li>` 之后同级)**

```vue
<li class="side-item" :class="{ active: route.name === 'files-drop' }" @click="router.push('/files/drop')">
  <img class="side-icon" :src="dropNavIcon" alt="" />
  <span class="side-name">{{ t('filesDropNav') }}</span>
</li>
```

```ts
// <script setup> 内:
import { dropAsset } from '../drop/dropIcons'
const dropNavIcon = dropAsset('drop_icon')
```

- [ ] **Step 3: 全量验证**

Run: `pnpm test && pnpm exec vue-tsc --noEmit && pnpm build`
Expected: 测试全绿、tsc 0 错、build 成功(dist/ 含 drop chunk 与 8 个 svg)

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts src/files/components/FilesSidebar.vue
git commit -m "feat(drop): /files/drop 路由 + 侧栏互传入口"
```

---


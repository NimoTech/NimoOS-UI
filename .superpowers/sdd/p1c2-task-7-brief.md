### Task 7: 头像版本共享 store(为将来的头像/壁纸系统留单点接入)

**Files:** Create `src/stores/userProfile.ts` + `src/stores/userProfile.test.ts`;Modify `src/ai/components/shell/AgentSidebar.vue` + `src/ai/components/shell/AgentSidebar.test.ts`

**背景与决策(用户 2026-07-27 提问"现阶段怎么弄比较好,保证后期做完之后好接过去",这是回答):**
New-UI 目前**没有**自己的账户/头像/壁纸界面,改头像只能在老应用里做;两个应用是两次独立页面加载,浏览器事件传不过去,所以"老应用改完、新页面立刻变"在本期不可能实现,也不该为此发明跨应用通道。本期做的是**把刷新能力放到正确的位置**:
- 头像 URL 的版本号从 `AgentSidebar` 的组件局部状态**上移**到应用级共享 store(`useUserProfile`),AI 侧只是它的一个消费者。
- 暴露一个动作 `bumpAvatarVersion()`。将来 New-UI 自己的账户面板(§5 大外壳收口)上传成功后**只需调这一行**,侧栏/桌面/任何显示头像的地方全部自动刷新 —— 不需要事件总线,不需要改 AI 区代码。
- 老应用改头像的场景:新页面**刷新一下即可**看到(每次页面加载版本号从 1 开始、URL 带 token 与 v 参数)。这一点在 store 的注释里写清楚,避免后人误以为是 bug。

**Interfaces:** Produces
```ts
export const useUserProfile = defineStore('userProfile', () => {
  const avatarVersion: Ref<number>              // 初值 1
  function bumpAvatarVersion(): void            // ++,给未来的头像上传成功回调调用
  return { avatarVersion, bumpAvatarVersion }
})
```
`AgentSidebar` 删掉本地 `avatarVersion` ref,改读 store;`avatarFailed` 保持本地(它是这一个 `<img>` 的加载失败态,不是全局资料);现有"404 回落自带默认头像"的行为不许变。同时把 `:88` 那条 `// 1c: avatar-changed refresh` 注释替换成对本方案的说明(含"老应用改头像需刷新页面"这一句)。

- [ ] **Step 1: 写失败测试**:store 两例(初值 1 / bump 递增);Sidebar 两例(头像 URL 含 `&v=<store 版本>` / 调 `bumpAvatarVersion()` 后 URL 变化,证明跨组件生效)。
- [ ] **Step 2: 跑测试确认失败。**
- [ ] **Step 3: 实现。**
- [ ] **Step 4: 跑 `pnpm test -- src/stores/userProfile.test.ts src/ai/components/shell/AgentSidebar.test.ts` + tsc 通过。**
- [ ] **Step 5: Commit** `SP8-P1c2: shared avatar version store (future account-panel hook)`

---


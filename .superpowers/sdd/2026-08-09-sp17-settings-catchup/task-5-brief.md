### Task 5: roadmap 开 SP17 节 + 「不适用」结论登记

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md`(**Vue2 仓**,当前分支 `docs/vue3-migration-sp3`)
- Create: `docs/superpowers/2026-08-09-sp17-outstanding.md`(本仓)

**Interfaces:**
- Consumes: Task 1-4 的实际结果(测试数、提交号)。
- Produces: 无代码接口。

- [ ] **Step 1: 在 roadmap 里开 SP17 节**

在 `### SP15 — 相册区补迁` 那一节之后、`## 5. 大外壳收口` 之前插入一节,内容必须包含:

1. 范围三件(`#93` / `#103`+`#105` / `#125`)与各自状态。
2. **带证据的「不做/不适用」结论**(下一期的人不必再探一遍):
   - `#97` Terminal Security:2026-08-09 实测 `GET /v1/sys/wsssh` → `404 {"message":"Not Found"}`,后端仍未提供;New-UI 早已删掉旧 wsssh 终端(`TerminalPanel.vue:5-9`),债务 D7/D25 继续挂。
   - `#121` 图标死链:New-UI `src/apps/util/importNormalize.ts:76` 早已处理。
   - `#121` Discord 链接:New-UI 无 `ContactBar` 对位组件。
   - `#119` 清死域名:改的是 Vue2 的 README / 多语言 locale,New-UI 只有 zh/en 两份且无对应键。
   - `awesome.casaos.io`:Vue2 `origin/main` 的 `AppStoreSourceManagement.vue:92` **同样还在**,不是缺口。
   - `#128` 默认应用图标:New-UI 无 `default.png/svg`,走 CSS `.store-icon-fallback`,换美术是新设计不是补迁。
3. 两条实测校正,写清楚「原判据错在哪」:
   - SP12 那份清单把 `#122` 归在「零散四条」里,它其实是 Files 区、归 SP12 的 worktree;`#136` 已由 SP14 做掉。**本期真正的零散只有 `#125` 一条。**
   - Knowledge/Notes(`#78`–`#104`)SP8 移植时已吸收主体,不在本期。
4. 分支 / worktree / 基线坐标。

- [ ] **Step 2: 提交 roadmap(Vue2 仓,单独提交)**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit -m "docs(roadmap): open SP17 for the settings-area catch-up

Records what the recomputed diff set actually leaves for this area, and
why #97/#119/#121/#128 are out of scope, with the probe results behind
each call so the next session does not repeat them."
cd -   # 回本 worktree
```

- [ ] **Step 3: 写本仓挂账文档**

新建 `docs/superpowers/2026-08-09-sp17-outstanding.md`,给「接下一期的人」看,含:本期做了什么(逐 Task 的提交范围)· 收尾门实测结果(数字照抄真实输出,不写约数)· **真机验收清单**(见下)· 未做的事与原因。

真机验收清单必须写成可照做的步骤:

1. 在本 worktree 起 dev server:`pnpm dev --host --port 5279`(5273/5277/5288 被并行线占着),浏览器开 `http://<设备IP>:5279/app/`。
2. 设置 → 侧栏应出现「局域网设备」,列表应有若干台设备;本机那行带「当前设备」标签且点不动。**开工当天实测局域网有 6 台(含本机),其中一台 hostname 是 `debian`。**
3. 点「重新扫描」,列表刷新、不报错。
4. 断网或把 devtools 网络设为 offline 后点重新扫描 → 应出现「扫描失败,请稍后重试。」**而不是**「未发现其他 NimoOS 设备」。
5. 设置 → 应用 → 「App 数据存储位置」应有第四行「相册缓存」,容量与路径非空(真机为 `/DATA/.system_data/photos`,约 5.8 GB)。
6. 点第四行的更改按钮 → 弹窗浏览步骤里,目标落点显示为 `<所选目录>/.system_data/photos`;**不要真的开始迁移**。
7. 桌面:本机 KVM 服务可用(`/v1/kvm/settings` 返 200),所以 KVM 磁贴应正常显示。要验「不可用」路径,在浏览器 devtools 里把 `/v1/kvm/settings` 请求拦成失败并刷新页面,45 秒后磁贴应消失;恢复拦截后刷新,磁贴可从「添加应用」面板加回。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/2026-08-09-sp17-outstanding.md
git commit -m "docs(sp17): record the outstanding acceptance steps"
```

---


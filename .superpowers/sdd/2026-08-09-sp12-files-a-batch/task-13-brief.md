### Task 13: 删掉 `--tm-star` 死 token

**用户看到什么**：什么都看不到 —— 这是纯清理。星空效果**有意没有实现**（`timeMachineMath.ts:6` 写明 Vue2 的 `generateStarfieldShadow` 有意不移植，星点由 CSS 承担、浅色主题没有星空），但两套主题各留了一个从未被引用的 token。

**Files:**
- Modify: `src/styles/theme.css:200`、`:545-550`
- Test: `src/styles/`（既有守卫）

- [ ] **Step 1: 确认它真的是死的**

```bash
grep -rn "tm-star" src/
```
预期：只有 `src/styles/theme.css` 两处定义，零引用。**若出现任何第三处命中，停下来汇报，不要删。**

- [ ] **Step 2: 删除**

删 `:200` 的 `--tm-star: rgba(255, 255, 255, 0.85);` 与浅色块里的 `--tm-star: transparent;`。

`:545` 那条说明性注释里提到「没有星空(--tm-star 透明)」，把括号里对 token 的引用去掉，保留「浅色纸感:没有星空,背景是米白 + 极淡光晕」这个仍然成立的说明。

> **CSS 注释红线**：改注释时确认没有 `*` 紧贴 `/` —— 那会提前关闭注释块，错误恢复会吃掉后面整条规则，而五道门全瞎。`src/styles/` 下有专门守卫这个的测试，务必跑。

- [ ] **Step 3: 跑守卫**

```bash
pnpm exec vitest run src/styles/
pnpm exec vitest run src/files/snapshot/
```

- [ ] **Step 4: 提交**

```bash
git add src/styles/theme.css
git commit -m "chore(styles): drop the unused --tm-star token

The starfield was deliberately never ported (timeMachineMath.ts says so);
both themes kept defining a colour nothing reads."
```

---

## 收尾门（控制器统一跑，不在任务内）

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run
pnpm exec vitest run src/i18n/parity.test.ts
pnpm build
node oss/export.mjs --out /tmp/claude-1000/oss-preview --no-commit --allow-dirty-oss
```

**跑 oss 门前必须先提交** —— 未提交的 `src/**` 改动会让 `checkClean` 拒绝导出，表现成另外几条 export 测试变红，容易误判成新缺陷。

---

## 真机验收清单（交付时给出，本期不跑）

前四项起 dev server 验（`pnpm dev --host --port 5299`，避开 5273/5277/5288）。**非 cutover 期不要 `deploy.sh`。**

**粘贴冲突**
1. 复制一个文件到已有同名文件的目录 → 弹冲突框 → 选「覆盖」→ 目标被替换（不是多出 `xxx(1)`）
2. 同上选「保留两者」→ 出现 `xxx(1)`，原文件不动
3. 复制**文件夹**到已有同名文件夹的目录 → 弹窗里「覆盖」**置灰**并写明「文件夹不支持覆盖」
4. 一次复制 3 个都撞名的 → 第一个勾「应用于剩余全部项目」选跳过 → 不再弹第 2、3 个，toast 说「已跳过 3 项」
5. 复制一批**不撞名**的 → **完全不弹窗**，直接粘贴成功
6. 弹窗出现时按 Esc → 该项及其余全部按取消处理，已回答过的不回滚
7. 右键空白处只有一个「粘贴」，没有「粘贴(覆盖)/粘贴(跳过)」
8. 弹窗出现时点浏览器后退离开文件区 → 弹窗**仍在**且仍能回答（与票 E 同一条链）

**剪切**
9. 选一批含 1 个受保护项剪切 → 剪贴板拿到其余项，toast 说「已跳过 1 个受保护项」；粘贴过去只移动了那些
10. 选区全是受保护项剪切 → toast「此项目受保护,无法移动」，剪贴板为空

**框选**
11. 在列表里拉框到一半，不松手直接点侧栏跳走 → 落地后**页面文字能正常选中**（这是本条的全部意义）

**F9**
12. 面包屑最后一段：鼠标移上去**无** hover 反馈，点了不发生任何事
13. 表头最左复选框列 / 最右星标列：鼠标**不变手型**
14. 侧栏收藏里的 Downloads/Gallery/Media/Documents 各自显示专属图标

**时间机器**（需先起 `scripts/tmlab/`：`node scripts/tmlab/server.mjs` + `pnpm exec vite --config vite.config.tmlab.ts`，`?tmlab_set=default`）
15. 造一个快照上百条的数据集，连按 ↑ 拨到屏幕外 → **刻度尺跟着滚**，选中刻度始终可见
16. 选 10 项以上点恢复 → 看得到 `正在恢复 n/N` 在涨
17. 断网让某张卡预览失败 → 恢复网络后拨一格刻度再拨回 → 该卡**自己恢复**成有内容的预览

**主题**
18. 浅色 / 深色各看一遍冲突弹窗与恢复进度：按钮、置灰态、危险色不得白底白字或看不见

---

## 边界与不做的事

- **不做 `merge`**：后端 move/copy 无此 case（取证见开头推翻表）。
- **不改恢复的串行性**：需要后端批量接口，超出本期。
- **不做 F4 视频封面**：需要 core 加 ffmpeg 抽帧，是后端票。
- **不扩 `Favorite` 数据结构**：F9 的 USB 说法已被推翻。
- **不合并 master、不部署、不推 origin。**

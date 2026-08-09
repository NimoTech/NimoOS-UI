### Task 11: 收尾门 + 台账与 roadmap 关账

**Files:**
- Modify: `NimoOS-UI/docs/vue3-migration-roadmap.md`(§4 SP11 勾选 + 关账段)
- Modify: `NimoOS-UI/docs/vue3-pending/05-设置与KVM与搜索-SP9.md`(A1 / D5 标已修)
- Modify: `NimoOS-UI/docs/vue3-pending/06-跨区与大外壳.md`(X3 标已修;Q3 移出待拍板)
- Create: `NimoOS-New-UI/.superpowers/sdd/2026-08-07-vue3-migration-sp11-wallpaper/ledger.md`

- [ ] **Step 1: 跑全量门**

Run:
```bash
pnpm vitest run 2>&1 | tail -20
pnpm vue-tsc --noEmit
pnpm build
node oss/export.mjs --dry-run   # 确认导出产物树仍能构建;不带 --out,别写真实公开仓
```
Expected: 测试 0 失败(**记录实际用例数**,别抄旧数字——master 已被另一条会话推进过)· tsc exit 0 · build 成功 · oss dry-run 通过。
**任何一门红都不许往下走。**

- [ ] **Step 2: 手工核对首屏体积**

Run: `grep -c "wallpaper0" dist/assets/index-*.js`
Expected: `0` —— 3MB 内置图必须在懒加载 chunk 里,不在首屏。

- [ ] **Step 3: 写执行台账** `NimoOS-New-UI/.superpowers/sdd/2026-08-07-vue3-migration-sp11-wallpaper/ledger.md`

至少记:11 个任务各自的 commit hash · Step 1 实测的用例数/门结果 · 两次变异验证(T2 Step 8 的 CSS 位置守卫、T4 Step 5 的回滚快照)的实际输出 · Task 3 里三个错误码填的真实数值及其来源文件 · 遇到的与 spec 不符之处(spec 是设计意图,实测为准)。

- [ ] **Step 4: roadmap 关账** —— `NimoOS-UI/docs/vue3-migration-roadmap.md`:
- §4 阶段表里 SP11 那行状态 `⬜` → `✅`
- SP11 段落里「壁纸 / 主题选择器」那条 `- [ ]` → `- [x]`,并补一段关账记录:实现形态(`<html>` 层 + `custom/wallpaper_v3` 独立 key)· 四个入口 · 三个判断(全应用可见 / 10MB 上限 / async chunk)· 已知限制(主题不跨设备同步)· 两处守卫的存在理由 · 未部署未推 origin
- 审计文档两处(`05-…-SP9.md` 的 A1/D5、`06-跨区与大外壳.md` 的 X3)标已修,并把 `06` 里 Q3「壁纸选择器排哪一期」从待拍板清单移走

- [ ] **Step 5: Commit(两个仓分别提交,都带 pathspec)**

```bash
# New-UI:台账(gitignore 不进 git 的话跳过 add,只记录路径)
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short .superpowers   # 若被 gitignore 排除则无需提交

# 文档仓
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md docs/vue3-pending/05-设置与KVM与搜索-SP9.md docs/vue3-pending/06-跨区与大外壳.md
git commit -o docs/vue3-migration-roadmap.md docs/vue3-pending/05-设置与KVM与搜索-SP9.md docs/vue3-pending/06-跨区与大外壳.md -m "docs(sp11): close out the wallpaper stage

Records the shipped shape -- an <html> background layer with the theme gradient
as its fallback, a storage key independent of Vue2's, and four entry points --
plus the two guards that exist because their failure modes are invisible to
tsc, build and jsdom. Debt D5 / audit X3 are paid off. Theme choice still does
not sync across devices; that limitation is logged, not fixed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: 报交付状态,等机主验收**

明确报出:**未部署、未推 origin**(与 SP9/SP10/SP13 惯例一致)。验收方式按机主既有约定 —— 起 dev server:`pnpm dev --host --port 5273`,**不跑 `deploy.sh`**(本期不是 cutover 期,没有跨应用绞杀行为要验)。

**验收清单(每条都写出点击路径):**
1. 主页顶栏点半圆图标 → 菜单**三项**:蓝色 / 白色 / 照片…;当前应打勾在「蓝色」
2. 点「白色」→ 整个界面变纸感白;再点「蓝色」→ 变回深蓝玻璃
3. 顶栏 → 照片… → 弹窗从底部升起,**上半屏仍看得见桌面磁贴**
4. 弹窗里点「内置壁纸 1」→ 背景**立即**变照片,磁贴浮在照片上;点「取消」→ 背景回到点开前的样子
5. 重复 4,这次点「应用」→ 弹窗关闭,背景保持照片;**刷新页面**(F5)→ 照片仍在(且不闪一下渐变)
6. 此时顶栏菜单打勾应在「照片」;点「白色」→ 照片消失、变纸感白
7. 照片壁纸下切到「白色」纸感:**文字必须看得清**(这是 scrim 那条守卫要保的东西,肉眼确认)
8. 进设置 → 通用 → 壁纸行:「更改」按钮**可点**、行下方**没有**「暂未提供」那句话;点它开同一个弹窗
9. 桌面**空白处**右键 → 出现「更换壁纸」一项;点它开弹窗
10. 桌面**磁贴上**右键 → 出现**浏览器自己的**菜单(不是我们的),说明门控生效
11. 弹窗 →「上传图片」→ 选一张 <10MB 的图 → 背景变成它;点「应用」→ 刷新后仍在
12. 弹窗 →「上传图片」→ 选一张 >10MB 的图 → 弹窗内出现「图片不能超过 10 MB」,背景不变
13. 弹窗 →「从 NAS 选择」→ 选一张 NAS 上的图 → 背景变成它(这条**不需要**再点应用,已落盘)
14. 文件区找一张 jpg/png → 右键 → 有「设为壁纸」→ 点它 → toast「已设为壁纸」,回主页背景已换
15. 文件区右键一个**文件夹**或一个 .mp4 → **没有**「设为壁纸」这一项
16. 进文件区 / 相册区 / 应用区 → 壁纸**都在**(不是只有主页有)
17. 登出 → 登录页是主题渐变(不是壁纸);重新登录 → 壁纸回来

---

## Self-Review

**Spec 覆盖核对**

| spec 小节 | 覆盖任务 |
|---|---|
| §2.1 CSS 图层(含坑 A 简写、坑 B 顺序) | T2(含位置守卫 + 变异验证) |
| §2.2 `--wallpaper-scrim` 两套主题 | T2 |
| §2.3 数据模型(id / path / stamp) | T1 |
| §2.4 本地缓存 + mount 前应用 | T1(缓存)+ T2(接线) |
| §3 后端端点与 `unwrap` | T3 |
| §4.1 四个入口 | T7(设置)· T8(顶栏)· T9(桌面)· T10(文件区) |
| §4.2 弹窗挂 App.vue / 不用 ui/Dialog / async chunk | T5(自绘)+ T7(挂载 + async + 首屏体积核对) |
| §4.3 实时预览 + 回滚含主题 | T4(store + 变异验证)+ T5(UI) |
| §4.4 文件区门控 + 10MB 失败可读 | T10 |
| §4.5 NasImagePicker 复用与 emit 扩展 | T6 |
| §4.6 内置图原样拷贝 | T1 |
| §5 共享包两方法 + 注释改写 | T3 |
| §6 测试与守卫 | 各任务内 + T11 全量门 |
| §7 移植纪律登记 | T1(SERVER_URL/parseUrl)· T4(无 catch)· T3(simple-uploader)· T5(不做预览卡)· T9(showBackground 不移植) |
| §8 三个判断 + 已知限制 | T4(10MB)· T7(async chunk + 全应用)· T11(限制写进 roadmap) |
| §9 不做清单 | T9 Step 4 明确不给 MobileHome 加 |

**执行时需就地取值 / 就地对齐的三处(不是占位符,都给了取值命令或既有范式)**

1. T3 三个错误码数值需从 `NimoOS-Common/model/common_err/` grep 真值填入,命令已给;断言钉的是 `message`,数值只为让 `it.each` 三行可区分。
2. T10 Step 5 的「进入快照态」写法复用 `FileContextMenu.test.ts` 既有 helper,不要新造。
3. T9 的 `display: contents` + `closest` 在 jsdom 下若行为异常,已给替代接法(改绑在 trigger 上、去掉包裹 div)。

**类型一致性核对**:`WallpaperRecord` / `BuiltinId` / `UserImageResult` 三个类型在 T1/T3/T4/T5/T6 中签名一致;store action 名(`preview` / `beginPreview` / `cancelPreview` / `commit` / `load` / `uploadAndPreview` / `setFromNasPath` / `openDialog` / `closeDialog`)在 T4 定义、T5/T6/T7/T8/T9/T10 引用,无别名漂移;`canBeWallpaper` 只在 T10 内部。

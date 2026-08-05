# Task 0 Report: 清理 NimoOS-UI 工作区(P6 无关改动)

Status: **DONE_WITH_CONCERNS** (见文末「偏离说明」——git 状态与 brief 描述不符,但未阻塞任务本身)

## Step 1: 确认三处改动内容与判读一致

```
$ cd /home/nimo/NimoTech/NimoOS-UI
$ git status --short -- src/
 M src/views/AI/Agent/Agent.vue
 M src/views/Home.vue
 M src/views/Photos/PhotosTimeline.vue

$ git diff --stat -- src/views/Home.vue src/views/AI/Agent/Agent.vue src/views/Photos/PhotosTimeline.vue
 src/views/AI/Agent/Agent.vue        |  13 +++
 src/views/Home.vue                  |  60 +++++++++++
 src/views/Photos/PhotosTimeline.vue | 195 ++++++------------------------------
 3 files changed, 105 insertions(+), 163 deletions(-)
```

结果:恰好这 3 个 `src/` 下文件被修改,无第 4 个。**未触发 hard stop。**

## Step 2: 验证 `/next/` 药丸确实已在现网

```
$ grep -rl "enter-next" /var/lib/nimoos/www --include=*.js 2>/dev/null | grep -v '/app/'
/var/lib/nimoos/www/src_components_common_KIcon_vue-src_views_Home_vue.9e0fbffd.js
/var/lib/nimoos/www/src_components_common_KIcon_vue-src_views_Home_vue.5278b32c.js
```

命中,判读前提成立。

## Step 3: 提交 Home.vue 的 `/next/` 药丸

```
$ git add src/views/Home.vue
$ git commit -m "feat(home): Vue2 桌面补「进入新主页」入口药丸 ..."
[docs/vue3-migration-sp3 ea959bd8] feat(home): Vue2 桌面补「进入新主页」入口药丸
 1 file changed, 60 insertions(+)
```

**Commit hash: `ea959bd8`**

## Step 4: 提交 Agent.vue 的 `?message=` 接力

```
$ git add src/views/AI/Agent/Agent.vue
$ git commit -m "feat(ai): Agent 页接收 ?message= 种子消息 ..."
[docs/vue3-migration-sp3 7c4020d4] feat(ai): Agent 页接收 ?message= 种子消息
 1 file changed, 13 insertions(+)
```

**Commit hash: `7c4020d4`**

## Step 5: 撤回 PhotosTimeline.vue 的旧版本

```
$ git checkout -- src/views/Photos/PhotosTimeline.vue
$ git diff --stat -- src/views/Photos/PhotosTimeline.vue
(零输出)
```

文件已回到 HEAD。

## Step 6: 确认工作区干净并跑全量测试

```
$ git status --short -- src/
(零输出)
```

```
$ pnpm test 2>&1 | tail -40
...
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 收起态 > 有任务时收起态显示小图标 + 「X 个后台任务」文字,不显示总百分比/任何明细/进度条
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 收起态 > 任务数文字反映当前任务条数
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 展开后才出现按类型明细与进度条
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 不同类型各渲染一条独立进度,标签正确
 FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 某类型有错误时该类型标记失败,并显示错误详情
 FAIL  tests/settingsStore.test.js > createSettingsStore - factory + initial state > initial state has expected shape
 FAIL  tests/settingsStore.test.js > createSettingsStore - policy + services actions > loadServicesStatus normalizes nested .running into booleans
 FAIL  tests/settingsStore.test.js > createSettingsStore - policy + services actions > loadServicesStatus sets false on error

 Test Files  2 failed | 151 passed (153)
      Tests  8 failed | 1425 passed (1433)
```

**Total: 1433 tests, 1425 passed, 8 failed (2 test files: `nimoTaskBar.test.js`, `settingsStore.test.js`).**

### 失败用例是否与本任务相关?已验证:不相关,系预先存在

用 `git worktree` 在本任务的前一个提交(`5ac4bcfb`,Task 0 之前的 HEAD)上跑了同一套测试(通过符号链接复用 `node_modules`,未污染主工作区),结果**完全相同**:

```
$ cd <worktree at 5ac4bcfb> && pnpm test 2>&1 | grep -E "FAIL|Test Files|Tests "
... (与上面 8 条一模一样)
 Test Files  2 failed | 151 passed (153)
      Tests  8 failed | 1425 passed (1433)
```

即这 8 个失败与本任务的三处改动(Home.vue / Agent.vue / PhotosTimeline.vue)无关,是仓库既有缺陷(`nimoTaskBar` 与 `settingsStore`/`openvino` 相关),不在本任务处置范围内。已清理该临时 worktree(`git worktree remove --force`),未留痕迹。

## 偏离说明(重要,供下游任务核对)

Brief 与任务描述都称本仓库"on branch master",但实际情况是:

- 本仓库**没有 `master` 分支**,默认分支是 `main`。
- 当前实际检出的分支是 **`docs/vue3-migration-sp3`**(相对 `main` 领先 163 commits,0 behind,无分叉冲突)。
- 两个提交(`ea959bd8`、`7c4020d4`)都落在了 `docs/vue3-migration-sp3` 分支上,而不是任何叫 `master` 的分支(因为不存在)。

这不影响本任务的执行结果(工作区已按要求清理干净、测试已验证),但如果后续 P6 任务假设"在 master 分支上构建部署",需要先核实这个分支名差异,以免部署脚本或后续 `git` 操作因为分支名不对而失败或产生混淆。

## 最终确认

```
$ git status --short -- src/
(零输出,工作区干净)
```

## Summary

- Commit 1 (Home.vue): `ea959bd8`
- Commit 2 (Agent.vue): `7c4020d4`
- PhotosTimeline.vue: reverted to HEAD (no new commit, as expected)
- Tests: 1433 total, 1425 passed, 8 failed — all 8 failures confirmed pre-existing (present identically at parent commit `5ac4bcfb`), unrelated to this task
- `git status --short -- src/` empty at end
- Concern: current branch is `docs/vue3-migration-sp3`, not `master` (repo has no `master` branch at all; default is `main`)

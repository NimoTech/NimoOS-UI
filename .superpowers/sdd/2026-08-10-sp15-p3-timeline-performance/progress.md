# SDD ledger — plan: docs/superpowers/plans/2026-08-10-sp15-p3-timeline-performance.md

BASE (branch start for final review): 43006b9cd47d549806b60788821ad69457e88e84
Task 1: complete (commits 43006b9..8639360, review clean)
Task 2: minor (deferred): intOr does not clamp negative counts (timelineBuckets.ts:133) — brief had same gap, backend never sends negatives
Task 2: minor (deferred): parseBucketKey regex would accept a hand-built half-zero key "0-08" (timelineBuckets.ts:125) — unreachable via bucketKey round-trip
Task 2: complete (commits 8639360..bdee7d2, review clean)
Task 3: minor (deferred): estimateSectionBodyHeight recomputes columnsFor twice via tileEdge (gridMetrics.ts:60) — pure, cheap, cosmetic
Task 3: complete (commits bdee7d2..1ab9c8c, review clean; CSS parity guard mutation-verified twice)
note: controller committed the pending spec i18n correction as 148a390 (docs only, mine not a subagent's)
Task 4: complete (commits 148a390..6aa81b2, review clean; 3 implementer deviations verified legitimate incl. a broken pnpm hardlink repaired via pnpm install)
CONTROLLER-FOUND GAP (not in the plan, surfaced by T4 review) — needs a new task after T8:
  PhotosAlbums.vue:180 guards on months.length===0 then reads allPhotos -> in bucket mode months is
  non-empty while allPhotos is empty => silently creates an EMPTY album plus a fake success toast
  (the very defect that code's own comment says it was added to fix).
  PhotosLibraryPicker.vue:164 has the same guard and renders from allPhotos => picker shows an empty
  library and its guard blocks the refetch that would fill it.
  Fix approach involves an owner-facing product call (how much of the library the picker loads) ->
  batched question to the owner before that task is written.
Task 5: minor (deferred): refreshBuckets' second cleanup loop is dead under current invariants (timeline.ts:347) — remove or comment what it defends
Task 5: minor (deferred): BUCKET_MAX_PAGES truncation-warning branch has no dedicated test (timeline.ts:313) — brief specified none either
Task 5: complete (commits 6aa81b2..0243bff, review clean; test-isolation deviation verified to strengthen rather than weaken)
OWNER RULING 2026-08-11 (on the controller-found gap above): the library picker loads the newest few
  buckets when it opens and loads earlier months as the user scrolls to the bottom — not the whole
  library on open, and not recent-only-forever. Becomes task T8b, written after T8.
Task 6: minor (deferred): MONTH_HEAD_HEIGHT imported into PhotosGrid.vue but unused (plan-mandated import) — Task 7 uses or removes it
Task 6: minor (deferred): wrapWidth is measured once at mount, no resize re-measure wired (Task 7 owns the observer)
Task 6: fix round 1/5 (2 addressed, 0 open — dark-theme-invisible skeleton, false wrapWidth comment; commits 634c332..8ef1b0e)
Task 6: complete (commits 0243bff..8ef1b0e, review clean; the Important was a real-browser-only defect jsdom cannot see)
Task 7: minor (deferred): syncObserver's wanted-set filter is redundant with the template's own v-if (PhotosGrid.vue:171)
Task 7: fix round 1 dispatched — height-ordering test passes regardless of read order (test-fidelity, not behavior); measuredHeights prune folded in as optional
Task 7: fix round 1/5 (1 addressed, 0 open — height-ordering stub now returns 0 once the tiles are gone, mutation-verified RED then GREEN; measuredHeights prune folded in; commits 6aa423d..a48df46)
Task 7: complete (commits 8ef1b0e..a48df46, review clean)
CONTROLLER FINDING (branch-wide, resolve in T13): the real tab ids are all/photo/ocr/video
  (PhotosToolbar.vue:32-35). There is NO 'doc' tab, yet the plan used tab:'doc' in T3/T6/T8 tests and
  in gridMetrics.skeletonItemCount's comment. Behavior for the real 'ocr' tab is correct only by the
  final fallthrough, and no test exercises the literal 'ocr'. T13 sweeps: rename the comment, swap the
  test fixtures to 'ocr', add one real 'ocr' case.
CONTROLLER RULING: the brief's Chinese comment in Photos.vue loses to CLAUDE.md's English-only rule
  (the plan's own Global Constraint 9 said English too) -> dispatched as T8 fix round 1, no owner call
  needed since the rule is already documented in two places.
Task 8: fix round 1 dispatched — translate the gridMonths comment; bump the stale manifest count
Task 8: fix round 1/5 (2 addressed, 0 open — English comment with provenance kept, manifest counts bumped; commits 3c12c57..c634f60)
Task 8: complete (commits a48df46..c634f60, review clean; the tick fix also closed a latent dead-tick bug on the favorites page)
Task 8b: minor (deferred): the dated-bucket predicate !(year===0&&month===0) is duplicated in timeline.ts:379 and PhotosLibraryPicker.vue:90 (both from the brief) — a shared isDatedBucket() would fold it
Task 8b: minor (deferred): no dedicated tests for an all-unknown-date library or a bucket fetch failing mid-scroll (both traced correct by inspection)
Task 8b: complete (commits c634f60..e0ebbb2, review clean; brief's parallel-fetch snippet was a real ordering bug the implementer caught via TDD and sequenced)
Task 9: minor (deferred, plan-mandated): deleting a photo from Favorites/Person/Album detail whose month bucket
  was never loaded leaves that month's directory count one too high until the next fetchTimeline/refreshBuckets
  (timeline.ts:295 declines to guess which bucket to decrement, and a test pins that as intended). Residual
  staleness window across the four delete call sites — surface to the final review for a merge call.
Task 9: fix round 1 dispatched — three edited test names + one edited comment left Chinese; plus one extra
  not-called assertion so the report's "no network call at all" claim is actually proven
CONTROLLER NOTE for T13: .superpowers/sdd/.gitignore carries a blanket `*` that the sdd-workspace script
  rebuilds on every run, so the ledger and all task reports are invisible to plain `git add`. Committing this
  phase's ledger requires `git add -f` (established repo-wide convention since 2026-08-05).
Task 9: fix round 1/5 (3 addressed, 0 open — three test names + one comment now English, extra not-called assertion added; commits aa03660..2c9b86d)
Task 9: complete (commits e0ebbb2..2c9b86d, review clean)
Task 10: complete (commits 2c9b86d..b2126ee, review clean; reviewer confirmed the 3s window is not inert — Photos.vue:204 calls fetchIndexStatus off task-bus events, not only the 5s poll)
Task 11: minor (deferred): i18n keys placed in the existing New-UI-only cluster rather than true alphabetical order — the file is not globally alphabetized, reviewer accepted the judgment
Task 11: minor (deferred): loadMoreFavorites failure is console-only, no user-facing signal (the initial fetch has a retry UI) — asymmetry worth a follow-up ticket
Task 11: fix round 1 dispatched — save-as-album silently truncates to one page (load remaining pages + show exact total); toggle() resets the cursor without bumping the generation (duplicate rows)
Task 11: fix round 1/5 (2 addressed, 1 NEW open — the unconditional loadingMore reset lets a stale load-more clear a newer in-flight call's flag, enabled by fetchFavorites forcing the flag false mid-request; commits 748d79e..7418075)
Task 11: minor (deferred): loadRemainingFavoritesForSave's stuck-page detector also reports "stuck" if a concurrent toggle drops the in-flight page — fails safe (no partial album), likely unreachable behind the modal scrim
Task 11: fix round 2 dispatched — give loadingMore an explicit owner sequence, plus the missing fetchFavorites-vs-loadMore interleaving test
Task 11: fix round 2/5 (1 addressed, 0 open — loadingMore now has its own per-instance ownership sequence, four-step trace re-walked by the re-reviewer, mutation-verified; commits 7418075..13a5e95)
Task 11: complete (commits b2126ee..13a5e95, review clean)
Task 12: minor (deferred): the hero's item/photo/video counts stay silently partial while pages remain — only the size line got the subset hint (brief scoped it that way)
Task 12: minor (deferred): the rows.map(trashAssetToPhoto) line is duplicated between fetchTrash and loadMoreTrash, mirroring favorites.ts by instruction
Task 12: fix round 1 dispatched — empty-trash quoted a count smaller than what it irreversibly deletes; restore-all's Undo covered only the loaded page. Fix = page in the rest before acting, and print no number you do not have (partial copy + no Undo when paging is stuck)
Task 12: fix round 1/5 (2 addressed, 0 open — both bulk actions page in the rest before deciding what to say; stuck path prints no totals and offers no Undo; commits ae32fb6..7c59096)
Task 12: minor (deferred): in the rare stuck-paging branch restore-all's SUCCESS toast still quotes a possibly-low {count}. Re-reviewer confirmed no count-less restored-toast key exists and rated it cosmetic — the safety half (partial Undo) is closed, nothing is deleted, and it needs a page failure on a multi-page trash to reach.
Task 12: complete (commits 13a5e95..7c59096, review clean)

Task 13: complete (commit 85383b4) — 收尾任务，做了三件事：(1) 相册详情页瓷砖补
  `loading="lazy"`（`src/views/PhotosAlbumDetail.vue:817`，此前是全区唯一还在急加载缩略图的
  网格）；(2) 清扫计划里虚构的 `'doc'` tab id —— 真实 tab id 是 all/photo/ocr/video
  （`PhotosToolbar.vue:32-35`），`matchesTab` 不识别 `'doc'`，会静默落进"其他所有未识别字符串"
  那个兜底分支，导致 T3/T6/T8 里的测试从未真正跑过字面量 `'ocr'`；改了
  `gridMetrics.ts` 里 `skeletonItemCount` 的注释、`gridMetrics.test.ts` 与
  `PhotosGrid.test.ts` 里三处 `tab: 'doc'` 夹具，并把 PhotosGrid 刻度尺那个用例里"用来
  证明 tab 有内容"的月份从「普通照片」翻成「`hasOcr: true` 的照片」（因为真实的 `'ocr'`
  tab 要求 `hasOcr: true` 才匹配，方向和虚构的 `'doc'` 分支正好相反）；(3) 六道门 + 只读
  合并预演 + 验收清单 + 本节台账。

---

## 收官（Task 13）

**提交范围**：`43006b9`（计划提交）..`85383b4`（HEAD，含 Task 13）— 共 **22** 个提交。

**六道门真实数字**（在提交 `85383b4` 上、干净工作树跑的）：

| 门 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `pnpm exec vue-tsc --noEmit` | 0 错误，19.5s |
| 全量测试 | `pnpm test` | 689 个测试文件 / 11086 个用例全部通过，167.13s |
| 开源导出 | `pnpm test oss` | 21 个测试文件 / 487 个用例全部通过，18.76s |
| 构建 | `pnpm build` | 通过，总耗时 37.3s（`vite build` 本身 17.04s） |

`git test oss` 前先确认 `git status --short` 为空（约束要求）。color-guard 与开源剥离结构
守卫都跑在全量测试/开源测试里，未单独计数。

只读合并预演：`git merge-tree --write-tree master HEAD` 退出码 0，单行 tree OID
（`4a2f9f0…`），无冲突，**没有执行真正的合并**。

**计划被实测推翻的地方（本期执行期新出现、非提前预判的）：共 4 处**

1. **T4 评审发现的架构缺口**（不在计划里）：`PhotosAlbums.vue:180` 与
   `PhotosLibraryPicker.vue:164` 在分桶模式下用 `months.length === 0` 判空，但分桶模式下
   `months` 非空而 `allPhotos` 为空，会静默造出一个空相册并弹出假的成功提示（那段代码自己
   的注释说它就是为了修这个 bug 才加的）。这条缺口需要机主拍板（图库选择器该加载多少），
   拍板结果（"打开时加载最新几个桶，滚到底再加载更早月份"）写成了新任务 T8b。
2. **T8：计划里的中文注释违反仓库自己的英文注释规则**。评审裁定：CLAUDE.md 的英文注释
   硬约束（计划自己的全局约束 9 也这么写）胜过 brief 里那段中文注释，作为 T8 fix round 1
   派发修正，无需机主拍板（规则已经写在两处）。
3. **T8b：brief 里那段"并行拉取"示例代码本身有一个真实的时序 bug**——实现者用 TDD 抓到并
   改成了顺序拉取。
4. **T13（本任务）：计划用虚构的 `'doc'` tab id 当 OCR tab 的替身**，泄漏进 T3/T6/T8 三处
   测试和一处注释，导致这些用例从未真正验证过字面量 `'ocr'`。本任务连同注释和夹具一起
   清扫。

（计划自身在写作时就提前识别、并写明处置方式的两处已知坑——T2 `bucketToMonth` 的交叉
类型过渡写法、T8 刻度尺用例必须构造两个月份——不算在上面 4 处里，因为它们是"计划自己
承认的坑"而不是"执行期才发现计划错了"。）

**评审发现，按严重度**：

- **Minor（登记为可接受风险，不修）：17 处**，分布在 Task 2（2）、Task 3（1）、
  Task 5（2）、Task 6（2）、Task 7（1）、Task 8b（2）、Task 9（1）、Task 11（3）、
  Task 12（3）。逐条见上文各任务行内的 `minor (deferred)` 记录。
- **Important 及以上（评审拦下、必须修才能通过）：13 处**，全部已在对应任务的
  fix round 里修完、复审确认关闭：Task 6 一轮（2 处，含一处"暗色主题下骨架不可见"的
  真机限定缺陷）、Task 7 一轮（1 处）、Task 8 一轮（2 处）、Task 9 一轮（3 处）、
  Task 11 两轮（第一轮 2 处，其中 1 处修复本身又带出一个新缺陷，第二轮 1 处修完关闭）、
  Task 12 一轮（2 处）。
- **Critical：0 处**。
- 收尾任务（T13）自身没有走独立的"实现者写代码 + 评审挑错"两人流程（一人做完自审），
  上面的清扫工作按控制器在 Task 7 台账行里登记的 `CONTROLLER FINDING` 处理，不重复计入
  上面两档计数。

**Spec §5 已知限制登记（原样抄一遍，白纸黑字）**：

1. **§5.1 筛选只看已加载桶（D3）**：筛选栏一生效，未加载月份连骨架一起隐起，筛选结果
   只包含已滚过/已加载的月份，界面上看不出结果不完整。真正的修法是后端筛选，开后续票
   （见下方 BE-P3-1），不属本期。
2. **§5.2 照片 tab 的骨架张数必须是 `count - videoCount`**：New-UI 相册主页默认 tab 是
   `photo`，目录里只有 `count` 与 `videoCount`，没有"纯照片数"。若照片 tab 估成 0，
   首屏之外的月份永远不出骨架、永远不触发加载（Vue2 `#139` 修的正是这个 bug，New-UI
   默认 tab 与它相同，踩坑概率 100%）。
3. **§5.3 分桶与回退模式的月份归属可能差一天**：分桶按 `strftime('%Y-%m', ...)` 走 UTC
   分组，老 `/timeline` 接口按 Go 侧 `time.Time` 的本地时区分组。月末深夜拍的照片，两种
   模式下可能落在不同月份。不修、不补偿——目录与桶内容用的是同一个表达式，分桶模式内部
   自洽。
4. **§5.4 OCR tab 下未加载月份不出骨架**：目录接口没有 OCR 维度的计数，该 tab 下无法
   估算骨架高度，未加载月份不显示。与 Vue2 同（它的注释写的是"OCR tab keeps the
   documented limitation"）。修法见下方 BE-P3-3。
5. **§5.5 目录接口 404 的十分钟退避**：后端未升级时，`/timeline/buckets` 每次进页面都
   404 一次是噪音，探测失败后 10 分钟内直接走老接口。副作用：机主部署后端后，最多 10
   分钟内（或刷新页面重载 JS 后立即）才切到分桶模式。

**本期新登记的限制**（执行期发现、不在 spec §5 原始清单里）：

- `Photos.vue` 的 `filteredCount`（工具栏计数）在分桶模式下仍只数已加载照片，与顶部目录
  的精确计数口径不同——T8 明确不改，留给未来若评审认为该统一时再开票。
- Task 9：从收藏/人物页/相册详情删除一张照片，如果它所在的月份桶从未被加载过，该月份的
  目录计数会偏高一格，直到下一次 `fetchTimeline`/`refreshBuckets`——`timeline.ts:295`
  不猜该减哪个桶，有单测钉住这是有意行为。残留的过期窗口横跨四个删除调用点。
- Task 11：`loadMoreFavorites` 失败只打印到控制台，没有面向用户的提示（首次加载失败倒是
  有重试 UI）——这个不对称值得单独开一张后续票。
- Task 12：批量操作的"英雄区"统计（照片/视频张数）在分页未取完时仍悄悄偏小，只有大小
  那一行加了"基于已加载"的提示——brief 当初就把范围划在这里。
- Task 12：极端的"分页卡住"分支里，"恢复全部"成功后的 toast 仍会引用一个可能偏低的
  `{count}`——复审确认没有不带数字的"已恢复"文案 key 可用，判定为表面瑕疵：安全性那半
  （撤销只覆盖已加载页）已经堵上，不会真的丢数据，且需要"分页在多页回收站上失败"这种
  才能触发。

**Spec §8 后续票（本期不做，需要开票）**：

| 票 | 内容 |
|---|---|
| BE-P3-1 | 后端筛选（年份/相机/地点）—— 是 §5.1 那条限制的唯一真正修法 |
| BE-P3-2 | 收藏/回收站接口返回 total（现在得靠 `listFavoriteIds` 绕） |
| BE-P3-3 | 目录接口补 OCR/文档维度计数 —— §5.4 的修法 |

**状态**：分支 `sp15-photos-moments`，未部署、未推 origin、未合 master。合并预演干净，
等机主统一验收。
Task 13: complete (commits 7c59096..4e87233, code half review clean; acceptance doc fact-checked by the controller)
CONTROLLER-VERIFIED GATES (re-run independently on 4e87233, clean tree): vue-tsc 0 errors ·
  pnpm test 689 files / 11086 tests passed (166s) · pnpm test oss 21 files / 487 tests passed (18.7s) ·
  pnpm build ok (vite 17.2s). The favorites.test.ts:126 stderr trace is the known pre-existing jsdom
  "Not implemented: navigation" noise from exportZip setting location.href, not a new defect.

---

## 整支终审后的单波修复（2026-08-11）

整支终审在「任务之间的接缝」上找出 1 Critical + 5 Important + 6 minor，全部在一波内修完，
逐条报告见 **`final-fix-report.md`**（同目录）。摘要：

| 项 | 内容 | 结果 |
|---|---|---|
| Critical 1 | 切 tab 往返后观察器不再注册 ⇒ 被隐藏过的月份永久骨架 | 已修（watch 已渲染集合 + `FakeIO.fireIfObserved`） |
| Important 2 | `need-bucket` 只在进入边沿触发 ⇒ 在屏月份被判废/失败后不再重取 | 已修（电平触发 `requestPendingBuckets`） |
| Important 3 | 占位高度重复计入月头、每次 resync 棘轮（= 滚动条会跳） | 已修（量 `.grid` body + hydrate 守卫），**真 Chromium 实测证据在报告里** |
| Important 4 | 点星标产出假的 Load more 并复制第一页 | 已修（`toggle()` 不再 rewind 游标） |
| Important 5 | `fetchTimeline` 刷新目录不差分、且不退出分桶模式 | 已修（抽 `applyDirectory`） |
| Important 6 | OCR tab 在分桶模式下是死胡同（永久空） | 已修，**spec §5.4 已按新行为改写并留档原文** |
| minor 7-12 | 死常量+不可能失败的测试 / 平价闸缺 `aspect-ratio`（含变异验证）/ 首帧灰闪 / `fetchBucket` 目录守卫 / 注释说谎 / picker 不满屏不翻页 | 全部已修 |

**两处与终审意见的出入（已在报告里给证据，不是悄悄跳过）**：
1. minor 10 用**按 key 比对**而不是全局目录计数器 —— 后者会在索引期把大月份的加载饿死。
2. 同一条里「第二个清理循环因此变成 load-bearing」的判断不成立：守卫生效后没有写入方会
   造孤儿 key，`staleBucketKeys` 也已把消失的桶判 stale ⇒ 它是纵深防御。循环按指示保留，
   注释写的是实情。

**未验证项**（诚实登记，详见报告末节）：首帧灰闪只验了机制没抓帧 · 未部署故真机全未验 ·
OCR tab 在多月份大库上的并发请求数只有推算。

**台账更正**：deferred-minor #11（Task 8b「a bucket fetch failing mid-scroll ... traced
correct by inspection」）的判断**是错的** —— 那条路径当时确实不会恢复，本波 Important 2 修掉。

=== WHOLE-BRANCH REVIEW + FIX WAVE (2026-08-11) ===
Final review (Opus, range 43006b9..85383b4): 1 Critical + 5 Important + 6 Minor, all seam-level
  (per-task reviews structurally could not see them). Headline: a tab round trip left the months it
  hid permanently stuck as skeletons, because the observer resync watched a tab-independent key set
  while container existence is tab-dependent, and need-bucket was emitted only on an entering
  intersection.
Fix wave (one dispatch, Opus, commit 4a7923a8 + docs 5931ca44): all 12 addressed. Scoped re-review
  (Opus) independently re-verified every fix red-pre-fix in an out-of-tree copy, re-ran the CSS
  aspect-ratio mutation itself, and judged the real-browser evidence (group - grid = head = 31px,
  old target ratchets +31px per resync, new delta 0).
RESIDUAL — TWO NEW IMPORTANTS INTRODUCED BY THE FIX WAVE (owner approved one more pass; BOTH FIXED, see R1/R2 PASS below):
  R1 (timeline.ts:381-385) the m10 per-key guard drops in-flight pages, and Important 2's
     level-triggered re-request is swallowed by _bucketInflight dedupe before the drop, while the drop
     path touches no state the grid watches => an idle user watching August during an upload can be
     left on a shimmer indefinitely WITH A HEALTHY BACKEND. Confirmed empirically by the re-reviewer
     (getTimelineBucket call count stays 1). Fix: make the drop path touch watched state, or re-enter
     fetchBucket after _bucketInflight.delete.
  R2 (timeline.ts:202) bucketMode is set false BEFORE `await getTimeline()`, so if the legacy call
     also fails the page renders the empty state over a library that exists (timelineGroups is still
     the [] bucket mode wrote, and Photos.vue has no error branch). Fix: flip the flag after a
     successful legacy fetch.
Per the skill there is no second fix wave without the owner's call — both are load-bearing, so they went
  to the owner rather than being parked. The owner approved the pass; see R1/R2 PASS below.
R1/R2 PASS (owner-approved, 2026-08-11): both fixed in timeline.ts, one regression test each.
  R1 — the drop path now sends a signal the grid actually watches: bucketAssets is republished under
     a new identity (same content) in `finally`, AFTER the run deregisters from _bucketInflight, so the
     level-triggered request re-asks and walks the pages against the fresh directory. No re-entry, so
     nothing chains; bounded by construction (only a directory change can doom a walk => at most one
     extra walk per directory change, and those are debounced to one per 3s). Regression test is the
     full reproduction (grid + store + FakeIO) in src/views/__tests__/Photos.buckets.test.ts and
     asserts the month ends up LOADED, not merely that a second request went out. Red pre-fix
     (aug.loaded === false).
     ⚠️ Scaffolding trap found while writing it: Photos.vue paints once before onMounted flips
     store.loading, so PhotosGrid mounts, unmounts and mounts again => TWO IntersectionObserver
     instances and only the LAST one observes anything. instances[0] is a disconnected observer with
     empty targets; the first version of the test fired into it and failed for the wrong reason. The
     test now takes the last instance and asserts the container is in its targets before firing.
  R2 — bucketMode flips only after `await getTimeline()` resolves, so a double-endpoint failure keeps
     the previous directory on screen instead of rendering "No photos" over a library that exists.
     Important 5's requirement still holds (no dead-memory legacy fetch under a live bucket mode).
     Red pre-fix (bucketMode === false). Also retitled the previous wave's "leaves bucket mode before falling
     back..." test, whose wording stopped being true.
R1/R2 PASS (owner approved a second small pass 2026-08-11): commit aa3f5b83 + docs 5aff37ca.
  R1 fixed by having the dropped walk republish bucketAssets under a new identity in `finally` after it
    deregisters, so the level-trigger re-asks and walks the fresh directory; the test is the full
    grid+store+FakeIO reproduction asserting the month ends LOADED, not merely that a request re-fired.
  R2 fixed by flipping bucketMode only after getTimeline() resolves, with no await before the groups
    assignment; the test asserts a double endpoint failure keeps bucketMode true and the previous
    directory painted instead of an empty state over a real library.
  Scoped re-review (Opus): both ADDRESSED; both new tests independently verified load-bearing by
    reverting each fix in an out-of-tree copy; reviewer explicitly would not hold the branch.
    Gates on aa3f5b83: vue-tsc 0 - pnpm test 689 files / 11107 - oss 487 - focused 131 files / 2734.
  RESIDUAL MINOR (open): timeline.ts:431-433's last sentence claims that signalling from the drop branch
    would be swallowed by the armed dedupe. Disproven by mutation - the watcher flushes on a microtask,
    so republishing before the deregistration, or from the drop branch itself, also passes. The placement
    is fine; only the stated reason is wrong. Fifth instance on this branch of a comment asserting
    behavior the code does not have.
  RESIDUAL MINOR (open): bucketMode now stays true across the legacy fall-through's await, so a
    grid-issued fetchBucket can be orphaned when the flag flips - bounded to one legacy round trip,
    not user-visible.
  PRE-EXISTING, not a finding: Photos.vue gates the grid on store.loading, which onMounted flips after
    the first paint, so PhotosGrid mounts/unmounts/remounts and two observers exist (the first has no
    targets and is disconnected on unmount). Harmless at runtime, but it IS a test trap - the new R1
    test guards against firing into the dead one.
  ^ that residual is now CLOSED: commit 5c577410 rewrote the sentence (placement is for clarity, not
    necessity, since the watcher flushes on a microtask). vue-tsc 0, timeline.test.ts 64/64.

WORKSPACE KEPT ON PURPOSE (same ruling as P2c): .superpowers/sdd is a tracked artifact in this repo and
  later phases read earlier ledgers — this phase began by reading P1/P2a/P2b/P2c's. The blanket `*` in
  .superpowers/sdd/.gitignore is rebuilt by the workspace script every run, so committing anything here
  needs `git add -f`.

=== PHASE CLOSED — code-complete, NOT accepted ===
Range 43006b9..5c577410 (26 commits). Undeployed, unpushed, not merged to master.
Acceptance: docs/superpowers/2026-08-10-sp15-p3-acceptance.md — steps 1-4 runnable on the current
  backend; step 5 (legacy fallback) is no longer reachable on this device now that the new backend is
  deployed, and the document says so rather than pretending otherwise.
Reviews: 0 Critical survived; every Critical/Important found was closed. Whole-branch review found
  1 Critical + 5 Important that no per-task review could see. Fix waves introduced 2 Importants of their
  own, both then closed. Deferred minors: 18 triaged by the final reviewer, 2 promoted to fix-now (both
  fixed), the rest stay deferred with reasons.
Plan defects found during execution: 12 (four of them mine, caught by implementers via TDD).

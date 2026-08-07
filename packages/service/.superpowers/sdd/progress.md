# SP4-P0 服务域迁包 — 进度台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-01-vue3-migration-sp4-p0-service-domains.md
Repo: NimoOS-Service, branch sp3-shared-http
BASE: 2e3cf11

- [x] Task 1: file 域 (+ fileUrl) — complete (6fb3282, review clean)
- [x] Task 2: batch 域 (+ batchUrl) — complete (d2d2f11, review clean)
- [x] Task 3: 合并 folder 域 — complete (701a2f7, review clean)
- [x] Task 4: storage 域 — complete (69bac41, review clean)
- [x] Task 5: index 集成冒烟测试 — complete (4b97bc1, review clean)

## Minor findings (for final review)
- Task1 Minor: `download` has no explicit test (brief scaffold omitted it) — final review to decide if worth adding.
- Task2 Minor: deleteTask test could assert `cap.delData` undefined (regression hardening; not in brief).
- Task3 Minor: new folder tests use inline `import('axios').AxiosInstance` vs top-level; `create` test omits URL assert (both from brief examples).
- Task4 Minor: `list` unwrap-fallback branch untested from storage.test.ts alone (brief scope). Import ext consistent w/ pkg convention (non-issue).

## FINAL WHOLE-BRANCH REVIEW (opus, 2e3cf11..4b97bc1): Ready to merge
- No Critical/Important. Contracts verified vs Vue2 service/*.js AND core Echo routes.
- 4 Minors all defer-able (test polish); tracked here for a future cleanup pass:
  - file.download no explicit test (structurally identical to tested getContent)
  - batch.deleteTask test doesn't assert body-absence (source can't send one)
  - folder tests: inline import('axios') type + create test omits /folder URL assert
  - storage.list non-array unwrap branch untested locally (covered transitively)
- P0 COMPLETE. Branch sp3-shared-http @ 4b97bc1 (local, no remote — user pushes to GitHub per SP1-3 convention).

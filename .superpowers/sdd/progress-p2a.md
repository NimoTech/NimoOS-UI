# SP4-P2a 执行台账
Plan: NimoOS-UI/docs/superpowers/plans/2026-07-03-vue3-migration-sp4-p2a-file-ops-create-rename-delete.md
Base: dbee94e (P2a 起点,tree clean)

## 任务进度
- [x] T1 protect.ts (ac9c6a2, review clean)
- [x] T2 pathOps.ts (5c94ef5, review clean)
- [x] T3 useFileOps (ad64ee6, review clean)
- [x] T4 reka-ui + Dialog/AlertDialog (f4b0fea + fix 84f95db, review clean)
- [x] T5 ContextMenu 原语 (8f7916e, review clean; re-export prose 与 T7 直接 import reka-ui 一致,无需修)
- [x] T6 NewItemDialog/RenameDialog (fc4ef9d, review clean)
- [x] T7 FileContextMenu (9943f56, review clean)
- [x] T8 行/卡右键接线 (d7a9b64, review clean)
- [x] T9 Files.vue 编排 (c897967, review clean)
- [x] T10 build+deploy+真机验(用户已验收 2026-07-03,ef99dc5,233/233,已部署 /app/)

## Minor findings (供终审 triage)
- T3 Minor: remove() 任一受保护则整批中止(承 Vue2 行为,非阻断)
- T4 Minor: Dialog 无 title 时 reka-ui 会警告(P2a 消费方均传 title,未触发)
- T4 Minor: Dialog footer 插槽空时仍留 margin-top(P2a 均传 footer,未触发)
- T6 Minor: dialog 测试 afterEach 清 body 未 unmount wrapper(hygiene,未致问题)
- T8 Minor: FileRow 测试名提"阻止默认"但未断言 preventDefault(承 brief;.prevent 声明式,T10 真机验)
- T9 Minor: confirmDelete 显式关闭对话框冗余(AlertDialogAction 已 close;无害)
- T9 Minor: 新增 .files-topbar-right 布局 wrapper(未入 brief,合理)

## 终审(opus,dbee94e..c897967)= Ready to merge; 修 #1(保护提示泛化)+#3(rename 补 canOperate 守卫)@8489453
## 终审 defer Minor: #2 多选删除 all-or-nothing(承 Vue2);#4 默认名英文(后端友好,承 Vue2);#5 Dialog/AlertDialog CSS 重复(cosmetic)
## P2a HEAD: 8489453

## 真机验收第 1 轮 bug 修复(2f96d79):
- 右键项选中但菜单不弹 = 行/卡 @contextmenu.prevent 置 defaultPrevented,reka-ui ContextMenuTrigger.handleContextMenu 的 `if(!event.defaultPrevented)` 分支跳过 → 去掉 .prevent(reka-ui 自身 suppress 原生菜单)。加回归测试断言 contextmenu 不 preventDefault。
- 列表下方空白右键落原生菜单 = 触发区 .files-listwrap 只有内容高 → .files-main 改 flex 列 + .files-listwrap flex:1 铺满。
- 229/229 tsc clean 已部署,待再验。P2a HEAD: 2f96d79

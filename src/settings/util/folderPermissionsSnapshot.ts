/* folder-permissions 的数据腿 —— **本期(SP9-P4)是明确标注的空实现**。
 *
 * 为什么空:Vue2 的 folderPermissionsStore.js(132 行)是个**六路聚合器**,依赖
 *   wiki.getCandidates/getRoots/createRoot/patchRootEnabled  → `wiki` 域**无 SP 归属**,
 *                                                              用户已拍板挂账(债务 D12)
 *   api.get/post/delete('/ai/parser/allowlist/folders')       → 经 AI 代理,SP8
 *   ai.getSearchSettings / putSearchSettings                  → SP8
 *   ai.listBlacklist / addBlacklistPattern / removeBlacklistPattern → SP8
 *   photos.getConfig / updateConfig                           → SP7
 * sp7-photos 与 sp8-ai 两条分支都还没合进 master,所以按 spec §3.1 **政策三**:
 * 界面照 Vue2 做完整,数据源与写操作留空并在界面上标注,合并后**只换本文件的
 * fetchSnapshot / execute 两个函数即可接线,界面不用重做**(债务 D11)。
 *
 * ⚠️ 接线时要做的事(留给 D11 的执行者):
 *   1. fetchSnapshot:照 Vue2 folderPermissionsStore.js:25-54 的 Promise.all + safe() 六路并发,
 *      每路失败单独记 offline,不要让一路失败拖垮整屏。注意 search 的响应把值套在
 *      `settings` 下(GET /v1/search/settings → {restart_fields,runtime_fields,settings:{fileindex_roots}}),
 *      而 PUT 的 body 是**扁平** patch 形状。
 *   2. execute:照 :56-86 逐 action 派发。
 *   3. WIRED 改成 true —— 界面的「数据源待接入」说明条会自动消失
 *      (见 FolderPermissionsPanel.vue)。
 *   4. 把面板的列表行补回删除按钮 / 开关(位置已在模板里留好注释),走
 *      planToggle + execute + 全量 refresh(Vue2 :101-111 的语义:**无论成败都全量
 *      refresh**,因为超时不代表未写入)。
 */
import type { FolderPermAction, FolderPermSnapshot } from './folderPermissions'

/** 本期是否已接上真实数据源。false → 界面显示「数据源待接入」并禁用一切写操作。 */
export const WIRED = false

/** 全空 + 四路全离线的快照。四路标 offline=true 是**故意的**:
 *  Vue2 的每个分区在 offline 时渲染「服务离线」徽标并隐藏列表与添加按钮,
 *  这正好是本期「无数据」的正确视觉形态,不需要再造一种空态。 */
export function emptySnapshot(): FolderPermSnapshot {
  return {
    candidates: [],
    searchRoots: [],
    wikiRoots: [],
    denyRules: [],
    blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: true, knowledge: true, ai: true, photos: true },
  }
}

/** 本期**不打任何接口**。保持 async 是为了让接线时签名不变、消费方零改动。 */
export async function fetchSnapshot(): Promise<FolderPermSnapshot> {
  return emptySnapshot()
}

/** 本期写操作一律不许发生。抛错而不是静默 no-op —— 万一将来有人误接上调用点,
 *  要在测试/控制台里立刻看得见,而不是悄悄什么都没做。 */
export async function execute(actions: FolderPermAction[]): Promise<void> {
  void actions
  throw new Error('folder-permissions writes are not wired yet (SP9-P4, debt D11)')
}

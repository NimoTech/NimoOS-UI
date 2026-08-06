# Task 7 fix round 1 — d8078aa..HEAD

## commits
19b7f6e sp8-ai P3b Task 7 fix: D4 modal stays open until toggle succeeds; pendingTryId RED coverage

## diff --stat
 .../components/settings/skills/SkillDetail.test.ts | 75 ++++++++++++++++++++--
 src/ai/components/settings/skills/SkillDetail.vue  | 41 +++++++++---
 2 files changed, 101 insertions(+), 15 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/skills/SkillDetail.test.ts b/src/ai/components/settings/skills/SkillDetail.test.ts
index 50d92bb..5f0809b 100644
--- a/src/ai/components/settings/skills/SkillDetail.test.ts
+++ b/src/ai/components/settings/skills/SkillDetail.test.ts
@@ -513,52 +513,69 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
 
   it('D4:停用技能点「在对话中试用」不跳转,弹出确认弹窗(标题/正文命中 i18n 文案)', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
     expect(push).not.toHaveBeenCalled()
     expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
     expect(host.querySelector('.sk-modal')?.textContent).toContain('停用的技能不会被加载')
   })
 
-  it('D4「启用并试用」:emit toggle(id,true) 且此刻未 push;父组件把 enabled 改成 true 后才 push', async () => {
+  // 【评审 Important 1,任务书简化了设计文档 §9.4:「成功才跳转;失败则留在弹窗 +
+  // danger toast,不跳转」——弹窗必须保持打开直到父组件真的把 enabled 改成 true,不是
+  // 发 toggle 那一刻就关。下面三条覆盖 ①点了之后弹窗仍开且未 push ②enabled 变 true
+  // 后弹窗关闭+push ③失败(prop 不变)→ 弹窗仍开、永不 push。】
+
+  it('D4「启用并试用」:点击后弹窗仍开、未 push,只 emit toggle(id,true)', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
 
     const enableBtn = host.querySelector('.sk-btn.primary') as HTMLButtonElement
     enableBtn.click()
     await flush()
     expect(w.emitted('toggle')).toEqual([['sk-5', true]])
-    // 发 toggle 那一刻还没跳转——父组件还没告知启用是否成功,弹窗已收起。
+    // 发 toggle 那一刻还没跳转——父组件还没告知启用是否成功,弹窗必须留在原地
+    // (设计文档 §9.4,不是「发了就关」)。
     expect(push).not.toHaveBeenCalled()
-    expect(host.querySelector('.sk-modal')).toBeNull()
+    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
+  })
+
+  it('D4「启用并试用」:父组件把 enabled 真的改成 true(toggle 成功)后,弹窗关闭 + push 同一步发生', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
 
-    // 父组件把 enabled 真的改成 true(toggle 成功)之后,才补一次 push。
     await w.setProps({ skill: makeSkill({ id: 'sk-5', enabled: true }) })
     await flush()
     expect(push).toHaveBeenCalledTimes(1)
     expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-5' } })
+    expect(host.querySelector('.sk-modal')).toBeNull()
   })
 
-  it('D4:toggle 失败(父组件不改 enabled)→ 永不 push', async () => {
+  it('D4:toggle 失败(父组件不改 enabled)→ 弹窗仍开、永不 push', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-6', enabled: false }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
     ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
     await flush()
     expect(w.emitted('toggle')).toEqual([['sk-6', true]])
 
     // 父组件请求失败:enabled 原样不变(仍是 false)——不是"取消"，是失败态。
+    // 弹窗必须留在原地(设计文档 §9.4),用户能再点一次或点取消;danger toast 由
+    // 父组件(T8 SkillsSection.onToggle)负责,本组件不重复发。
     await w.setProps({ skill: makeSkill({ id: 'sk-6', enabled: false }) })
     await flush()
     expect(push).not.toHaveBeenCalled()
+    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
   })
 
   it('D4:点「取消」关闭弹窗,不 push、不 emit toggle', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-7', enabled: false }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
     ;(host.querySelector('.sk-btn.ghost') as HTMLButtonElement).click()
     await flush()
     expect(host.querySelector('.sk-modal')).toBeNull()
     expect(push).not.toHaveBeenCalled()
@@ -577,20 +594,68 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
     await w.setProps({ skill: makeSkill({ id: 'sk-11', enabled: false }) })
     await flush()
 
     // 迟到的响应此刻才把 sk-10 的 enabled 改成 true(用户又切回了 sk-10)——因为
     // 挂号已经在切换那一刻被清空,不应该被误读成"待跳转"而 push。
     await w.setProps({ skill: makeSkill({ id: 'sk-10', enabled: true }) })
     await flush()
     expect(push).not.toHaveBeenCalled()
   })
 
+  // 【评审 Important 2 之①】钉住「跳转前清空 pendingTryId」这道防线本身(与上面「残留
+  // 清除」那条不同——那条钉的是 skill.id 变化时的复位 watch;这条钉的是成功分支自己
+  // 清空 pendingTryId,同一技能不换 id 也要成立)。RED 验证:把成功分支里的
+  // `pendingTryId.value = null` 删掉 → 这条用例精确报红(第二次 push 被多算一次)。
+  it('D4:成功跳转一次后,同一技能之后被手动开关多次,push 总次数仍是 1(挂号已被消费,不会残留重复触发)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-3', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+
+    // 用户之后自己用开关把这个技能关闭再打开——不该被误读成"待跳转"而再跳一次。
+    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: false }) })
+    await flush()
+    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+  })
+
+  // 【评审 Important 2 之②】钉住 `if (enabled === true)` 这个判断本身。构造合成竞态:
+  // D4 弹窗打开期间(点确认之前),技能被别处启用(enabled 变 true)——此时 pendingTryId
+  // 还是 null,watcher 空转;随后用户仍然点了确认(pendingTryId 挂号),因为 enabled
+  // 已经是 true、不会再触发"从非 true 到 true"的变化,pendingTryId 悬而不清;紧接着
+  // enabled 被别处改回 false,watcher 第一次真正触发,newVal=false——必须不 push。
+  // RED 验证:把 `if (enabled === true)` 判断删掉(变成一进 if 块就无条件清挂号+push)
+  // → 这条用例精确报红。
+  it('D4:挂号后 watcher 第一次真正触发时 enabled 是 false(不是 true)→ 不 push(钉住 `if (enabled === true)` 判断)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-9', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    // 合成竞态:弹窗打开期间技能被别处启用(此时还没点确认,pendingTryId 仍是 null)。
+    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: true }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+    // 用户仍然点了确认——enabled 已经是 true,不构成"变化",watcher 不会再触发,
+    // pendingTryId 挂号后悬而不清。
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-9', true]])
+    // enabled 被别处改回 false——watcher 第一次真正触发,newVal 是 false。
+    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: false }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+  })
+
   it('enabled === true 时点「在对话中试用」直接跳转,不弹 D4 弹窗(P3a 既有行为未回归)', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-42', enabled: true }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
     expect(push).toHaveBeenCalledTimes(1)
     expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
     expect(host.querySelector('.sk-modal')).toBeNull()
   })
 
   it('TestPanel 的 test 事件被向上转发成本组件的 test emit', async () => {
diff --git a/src/ai/components/settings/skills/SkillDetail.vue b/src/ai/components/settings/skills/SkillDetail.vue
index 4e5b809..ecb7fd2 100644
--- a/src/ai/components/settings/skills/SkillDetail.vue
+++ b/src/ai/components/settings/skills/SkillDetail.vue
@@ -88,20 +88,32 @@
   `pendingTryId`(记录发起请求那一刻的技能 id,而不是布尔标志)而不是定时器/await emit
   (emit 是同步的、没有返回值,等不到“父组件处理完”这个事实)。三条清除路径:
   ① 跳转前(`watch` 命中 `enabled===true` 且 id 匹配时)立即置空,防止以后这个技能任何
      一次“开关开→用户手动点开”都被误读成“待跳转”而把用户重新导航走;
   ② 点「取消」立即置空;
   ③ `skill.id` 变化时置空(与既有 `menuOpen`/`confirmOpen` 复位共用同一个 watch)—— 这样
      切到另一个技能后,上一个技能的挂号不会残留、也不会在多个 watcher 之间靠触发顺序
      猜测谁先跑:`watch(enabled)` 回调里额外核对 `skill.id === pendingTryId`,两层防御
      叠加,不依赖 Vue 内部 watcher 调度顺序这个实现细节。
 
+  【评审后修订(Important 1,任务书 D4 的简化 vs 设计文档 §9.4 原话)】任务书把
+  §9.4「先 `toggle(id, true)`,**成功才跳转**;失败则**留在弹窗** + danger toast,不
+  跳转」简化成了「发 toggle 后关弹窗」,只保留了半句(失败不跳转),漏了「成功前弹窗
+  必须留在原地」——这是任务书对设计文档的简化遗漏,以设计文档为准:`confirmEnableAndTry`
+  不再在发 toggle 那一刻就关 `tryModalOpen`,而是保持打开;`watch(enabled)` 命中
+  `id 匹配 && enabled===true` 时**同一步**关弹窗 + 跳转。toggle 失败时 `enabled`
+  不变,弹窗因此保持打开,用户可以再点一次「启用并试用」或点「取消」。danger toast
+  由父组件(T8 `SkillsSection.onToggle`)负责,本组件不重复发。
+  顺带(自主判断范围,非设计文档强制):`busy[skill.id]` 为真(toggle 请求飞行中)时
+  「启用并试用」按钮 `disabled`,防止用户在请求还没返回时重复点击、叠加发出多次
+  `toggle` 请求。
+
   零 <style> 块:用到的每个 class(sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
   sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row、sw、sk-pill-more、
   sk-menu、sk-modal-bg、sk-modal、sk-confirm*、sk-modal-foot、sk-btn)均已存在于
   skills-styles.scss(Task 1)或 sk-shared.scss(既有)。
 -->
 <script setup lang="ts">
 import { computed, ref, watch } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
 import { service } from '@nimotech/nimoos-service'
@@ -275,49 +287,52 @@ function fileSize(size: string): string {
 function tryInChat() {
   const s = props.skill
   if (!s) return
   if (s.enabled === false) {
     tryModalOpen.value = true
     return
   }
   router.push({ path: '/ai/agent', query: { skill: s.id } })
 }
 
-// D4「启用并试用」:先关弹窗、记下当前技能 id 作为一次性挂号,再把意图往上冒泡。
-// 是否真的启用成功由父组件(SkillsSection)决定——本组件不直接改 `skill.enabled`,
-// 只观察 props 上的值(下面的 watch)。
+// D4「启用并试用」:记下当前技能 id 作为一次性挂号,把意图往上冒泡。**不在这里关
+// 弹窗**(评审后修订,见文件头注释「评审后修订」)——设计文档 §9.4 要求「成功才跳转」,
+// 弹窗必须保持打开直到父组件真的把 `enabled` 改成 true;失败时弹窗留在原地,用户能
+// 再点一次或点取消。是否真的启用成功由父组件(SkillsSection)决定——本组件不直接改
+// `skill.enabled`,只观察 props 上的值(下面的 watch)。
 function confirmEnableAndTry() {
   const s = props.skill
   if (!s) return
-  tryModalOpen.value = false
   pendingTryId.value = s.id
   emit('toggle', s.id, true)
 }
 
 // D4「取消」:清除路径②(见文件头注释)。不 emit toggle,不跳转。
 function cancelTryModal() {
   tryModalOpen.value = false
   pendingTryId.value = null
 }
 
 // D4 一次性跳转:只在「当前 props.skill 就是发起挂号的那个技能」且它的 `enabled`
-// 变成 true 时才跳转,随即清空挂号(清除路径①)。toggle 失败时父组件不会把 `enabled`
-// 改成 true,这里就永远不会看到 true,从而永远不跳转——不需要额外的失败分支/定时器。
-// 显式核对 `s.id === pendingTryId.value` 而不是只信任「skill.id 变化时复位」那处 watch
-// 已经清空了它:两个 watch 都挂在同一个 `props.skill` 上,不依赖 Vue 内部对同一 tick
-// 里多个 watcher 的调度顺序这个实现细节。
+// 变成 true 时才**同一步**关弹窗 + 跳转,随即清空挂号(清除路径①)。toggle 失败时
+// 父组件不会把 `enabled` 改成 true,这里就永远不会看到 true,弹窗保持打开
+// (评审后修订,见文件头注释)——不需要额外的失败分支/定时器。显式核对
+// `s.id === pendingTryId.value` 而不是只信任「skill.id 变化时复位」那处 watch 已经
+// 清空了它:两个 watch 都挂在同一个 `props.skill` 上,不依赖 Vue 内部对同一 tick 里
+// 多个 watcher 的调度顺序这个实现细节。
 watch(() => props.skill?.enabled, (enabled) => {
   const s = props.skill
   if (!s || !pendingTryId.value) return
   if (s.id !== pendingTryId.value) { pendingTryId.value = null; return }
   if (enabled === true) {
     pendingTryId.value = null
+    tryModalOpen.value = false
     router.push({ path: '/ai/agent', query: { skill: s.id } })
   }
 })
 </script>
 
 <template>
   <div class="sk-detail">
     <template v-if="!skill">
       <div class="sk-detail-empty">
         <div class="sk-detail-empty-inner">
@@ -491,16 +506,22 @@ watch(() => props.skill?.enabled, (enabled) => {
            Vue2 里不存在,没有逐像素复刻目标,所以用标准壳 SkModal,不套上面那份 reka
            原语手拼(两种外壳并存的理由见文件头注释「两种弹窗外壳并存,不是不一致」)。 -->
       <SkModal
         :open="tryModalOpen"
         :title="t('aiSkTryDisabledTitle')"
         @update:open="tryModalOpen = $event"
       >
         <p>{{ t('aiSkTryDisabledBody') }}</p>
         <template #footer>
           <button class="sk-btn ghost" @click="cancelTryModal">{{ t('aiCancel') }}</button>
-          <button class="sk-btn primary" @click="confirmEnableAndTry">{{ t('aiSkTryEnableAndTry') }}</button>
+          <!-- busy[skill.id] 为真时禁用(toggle 请求飞行中),防止重复点击叠加发出多次
+               toggle 请求——自主判断范围,见文件头注释「评审后修订」末段。 -->
+          <button
+            class="sk-btn primary"
+            :disabled="!!busy[skill.id]"
+            @click="confirmEnableAndTry"
+          >{{ t('aiSkTryEnableAndTry') }}</button>
         </template>
       </SkModal>
     </template>
   </div>
 </template>

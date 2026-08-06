# Task 8 fix round 1 — 5fd5f19..HEAD

## commits
f6792a8 sp8-ai P3b Task 8 fix: strengthen two space-blind assertions in SkillsSection.test.ts

## diff --stat
 .../settings/sections/SkillsSection.test.ts        | 44 +++++++++++++++++++---
 1 file changed, 38 insertions(+), 6 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/sections/SkillsSection.test.ts b/src/ai/components/settings/sections/SkillsSection.test.ts
index 6f948e4..e2117b2 100644
--- a/src/ai/components/settings/sections/SkillsSection.test.ts
+++ b/src/ai/components/settings/sections/SkillsSection.test.ts
@@ -393,38 +393,50 @@ describe('SkillsSection(P3b 写操作半)', () => {
 
     const detail = w.findComponent(SkillDetail)
     detail.vm.$emit('delete', 'a')
     await flush()
 
     expect(h.deleteSkill).toHaveBeenCalledWith('a')
     expect(w.findAll('.sk-item')).toHaveLength(1)
     expect(show).toHaveBeenCalledWith('已卸载 skill-a')
   })
 
-  // brief §10.2 明确点名的条件:钉住「只有删的是当前选中项才落到剩余第一项」——
-  // 这里删的是 b(非当前选中的 a),activeId 必须原地不动。
+  // brief §10.2 明确点名的条件:钉住「只有删的是当前选中项才落到剩余第一项」。
+  //
+  // 【评审 Important,已修】原 fixture 只有两项([a, b]),选中 a(默认第一项),删 b——
+  // 删完剩 [a],此时不管 `if (activeId.value === id)` 那个条件生效与否,`activeId`
+  // 落点都是 'a'(条件生效:原地不动,仍是 a;条件被删/无条件回落 skills[0]:也是 a),
+  // 两种实现给出同一结果,断言分辨不出来,是空转用例(评审 RED 探针实测:把条件整个删掉,
+  // 23 例仍全绿)。改成三项 `[a, b, c]`,先切到 **c**(不是删完后剩余列表的第一项)再删
+  // **b**——条件生效:activeId 仍是 c;条件被删(无条件回落 skills[0]):activeId 会错误
+  // 地跳成 a。两种实现在这个 fixture 下必然分道,断言才有判别力。
   it('删的不是当前选中项时 activeId 不变,详情面板仍显示原选中的技能', async () => {
     h.listSkills.mockResolvedValue([
       makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A' }),
       makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B' }),
+      makeSkill({ id: 'c', name: 'skill-c', title: 'Skill C' }),
     ])
     h.deleteSkill.mockResolvedValue(undefined)
     const w = mountSection()
     await flush()
-    expect(w.find('.sk-name span').text()).toBe('Skill A') // reload() 默认选中第一项
+    // 先切到第三项(c)——删完剩余列表 [a, c] 的第一项是 a,不是 c,两种实现的分歧点。
+    await w.findAll('.sk-item')[2].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill C')
 
     const detail = w.findComponent(SkillDetail)
-    detail.vm.$emit('delete', 'b')
+    detail.vm.$emit('delete', 'b') // 删的是 b,不是当前选中的 c
     await flush()
 
-    expect(w.findAll('.sk-item')).toHaveLength(1)
-    expect(w.find('.sk-name span').text()).toBe('Skill A') // activeId 未被 b 的删除牵动
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+    // activeId 必须仍是 c——若条件被删(无条件回落 skills[0]),这里会变成 'Skill A'。
+    expect(w.find('.sk-name span').text()).toBe('Skill C')
   })
 
   it('删除失败:danger toast,列表项存活', async () => {
     h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
     h.deleteSkill.mockRejectedValue(new Error('boom'))
     const toast = useToast()
     const show = vi.spyOn(toast, 'show')
     const w = mountSection()
     await flush()
 
@@ -507,20 +519,26 @@ describe('SkillsSection(P3b 写操作半)', () => {
       .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
     cancelBtn.click()
     await flush()
     expect(document.querySelector('.sk-modal')).toBeNull()
 
     await w.find('.sk-add-btn').trigger('click')
     await macroFlush()
     expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
   })
 
+  // 【同档自查,见任务报告「同档自查」段】原版只在 a(默认选中的第一项,index 0)上
+  // 调用一次 `test`,再切到 b 断言 b 没被污染——如果实现把 `findIndex(s =>
+  // s.id===activeId.value)` 错写成硬编码 `idx = 0`,这条测试仍然全绿(a 恰好就是
+  // index 0,断言值与"正确实现"完全相同),抓不到这类回归。补一段:切到 b 之后**也**
+  // 调用一次 `test`,断言改的是 b(index 1)而不是 a——硬编码 `idx = 0` 的实现会在
+  // 这一步改错 a,断言精确报红(RED 探针见任务报告)。
   it('onTest:只改当前选中项的 calls/last_used,不影响其它技能(乐观本地值,不落库)', async () => {
     h.listSkills.mockResolvedValue([
       makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A', calls: 3, last_used: '' }),
       makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B', calls: 5, last_used: '' }),
     ])
     const w = mountSection()
     await flush()
     expect(w.find('.sk-name span').text()).toBe('Skill A') // 默认选中第一项
 
     const detail = w.findComponent(SkillDetail)
@@ -529,12 +547,26 @@ describe('SkillsSection(P3b 写操作半)', () => {
 
     expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
     expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')
 
     // 切到 b,确认它的数据完全没被污染。
     await w.findAll('.sk-item')[1].trigger('click')
     await flush()
     expect(w.find('.sk-name span').text()).toBe('Skill B')
     expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 5 次')
     expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).not.toContain('Just now')
+
+    // 现在 b 是选中项(index 1,不是 0)——再调用一次 test,必须改的是 b。硬编码
+    // `idx = 0` 的实现会在这一步改错成 a,下面两条断言会精确报红。
+    detail.vm.$emit('test')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill B') // 仍显示 b,不受影响
+    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
+    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 6 次') // b: 5+1
+
+    // 切回 a,确认 a 的数据停在第一次调用后的值(4 次),没有被第二次 test() 误伤。
+    await w.findAll('.sk-item')[0].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill A')
+    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')
   })
 })

## Task 8: 深链 `?q` / `?album` / `?person`

**Files:**
- Modify: `src/photos/composables/usePhotosDeepLinks.ts`(扩三式)
- Test: 同上测试文件加用例

**Interfaces:**
- Consumes: `useRouter()`;`src/photos/stores/albums.ts` 的 `fetchAlbums`;`src/photos/stores/people.ts` 的 `fetchPeople`。

**回源坐标**:`?q` = Vue2 `PhotosTimeline.vue:491-494`;`?album` = `PhotosAlbumsView.vue:264`(该视图自己 mounted 里读);`?person` = `PhotosTimeline.vue:509-523`(`_applyPersonFromQuery`)。spec §6 明确 `?q` 的 Vue2 兼容入口归 P8。

**逐条契约**

1. **`?q=<词>`**:`/photos?q=x` → **`router.replace('/photos/search?q=x')`**。用 `replace` 不用 `push`(这是入口归一,不该在历史里留一条 `/photos?q=`)。P7a 已经做了 `/photos/search?q=` 那条真路由,本任务只做重定向。
2. **`?album=<id>`**:Vue2 是 `/photos?album=<id>` 让相册**列表**页自己打开那个相册。New-UI 有真路由 ⇒ `router.replace('/photos/albums/' + id)`。**id 要 `encodeURIComponent`**(Vue2 那边没编码,是缺陷 —— 相册 id 若含 `/` 会截断,按铁律修 + 注释登记)。
3. **`?person=<id>`**:Vue2 `_applyPersonFromQuery` 先 `fetchPeople` **校验 id 存在**,存在才切页,不存在**静默清掉该 query 键**。New-UI 对应:先 `fetchPeople()`,`people.some(p => String(p.id) === String(id))` 才 `router.replace('/photos/people/' + encodeURIComponent(id))`;不存在则 `router.replace({ query: { ...rest } })` 把 `person` 键摘掉。⚠️ **id 比较走 `String()` 归一**(后端 `Place.Key` 是 int32 的同类坑,全区铁律)。
4. **五式互不干扰**:`photoset`/`asset` 是开灯箱(不改路由),`q`/`album`/`person` 是改路由。**同时出现时的优先级照 Vue2**:Vue2 里 `photoset`/`asset` 在 `_applyUrlDeepLinks` **之前**执行(`:371-377`),所以灯箱先开、路由后跳。这个顺序要照搬并有用例锁住。

- [ ] **Step 1: 写失败测试**

```ts
describe('usePhotosDeepLinks · ?q / ?album / ?person', () => {
  it('?q 重定向到 /photos/search?q=,用 replace 不用 push', async () => {
    const { router } = mountWithQuery({ q: '猫' }, {})
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/photos/search', query: { q: '猫' } }),
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  it('?album 跳详情路由,id 做 URL 编码(Vue2 未编码是缺陷)', async () => {
    const { router } = mountWithQuery({ album: 'a/b' }, {})
    await flushPromises()
    const arg = router.replace.mock.calls[0][0]
    expect(String(arg.path ?? arg)).toContain(encodeURIComponent('a/b'))
  })

  it('?person 存在:校验通过后跳详情', async () => { /* people 里有该 id */ })

  it('?person 不存在:静默摘掉 person 键,不跳详情、不弹 toast', async () => { /* … */ })

  it('?person 的 id 比较走 String 归一(后端返数字 id 也认)', async () => {
    // people = [{ id: 42 }],query = { person: '42' } ⇒ 应跳详情
  })

  it('?person 的 fetchPeople 失败:静默摘键(Vue2 :521-523 的 catch)', async () => { /* … */ })

  it('photoset 与 q 同时存在:先开灯箱、后跳路由(Vue2 的执行顺序)', async () => {
    localStorage.setItem('nimo:photoset:tok', JSON.stringify({ ids: ['x'] }))
    const { lb, router } = mountWithQuery({ photoset: 'tok', q: '猫' }, { x: { id: 'x' } })
    await flushPromises()
    expect(lb.openAt).toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalled()
    // 顺序:用 invocationCallOrder 断言 openAt 的调用序号小于 replace
    expect(lb.openAt.mock.invocationCallOrder[0])
      .toBeLessThan(router.replace.mock.invocationCallOrder[0])
  })
})
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

- [ ] **Step 5: 变异验证 + Commit**

变异验证:①把 `replace` 换 `push` → 对应用例应变红 ②删掉 `encodeURIComponent` → 编码用例应变红 ③把 `String()` 归一去掉 → 数字 id 用例应变红 ④把两段执行顺序调换 → 顺序用例应变红。

```bash
git add src/photos/composables/usePhotosDeepLinks.ts \
        src/photos/composables/__tests__/usePhotosDeepLinks.test.ts
git commit -m "feat(photos): ?q / ?album / ?person 深链兼容入口(P8a-T8)

按铁律修正的 Vue2 缺陷:album/person id 未做 URL 编码;id 比较补 String() 归一。"
```

---


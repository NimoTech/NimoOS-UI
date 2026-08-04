// SP8-P5d Task 4 —— NotesMarkdownEditor.vue 单测
//
// 测试写法按附录 D §D.6(T0 实测结论,评审已重跑一遍确认):jsdom 下能真实挂载
// `new Editor({extensions:[StarterKit, Markdown]})`,本文件全程用**真 Editor**,
// 不 mock `@tiptap/vue-3` / `tiptap-markdown`。
// 等待时机(§D.6 尾注):onMounted 里建 Editor 后要 `await nextTick()` 再
// `await flushPromises()`(单个 nextTick 不够)。挂载需 `attachTo: document.body`
// (jsdom 下 ProseMirror 的 selection/getClientRects 相关路径没有真实 document 会异常)。
//
// 🔴 裁定 R5:附录 D §D.6.1 的「N29 tbTick 假依赖」那条只证了前提、没挂父组件 ——
// 本文件不引它当已证(N29 本身也不在本组件里,归 T7)。但本文件自己涉及
// `transaction` 事件的断言(§3③ onTransaction → emit('transaction'))仍按裁定要求
// 附变异证据 —— 见报告 §变异证据(删 `onTransaction` 那行后本文件对应用例复跑报红)。
//
// K38 两个 emit(拿掉任一个必须报红)与 §5.3 防回环(拿掉比对必须报红)的变异证据
// 同样见报告,不写在本文件里(本文件只装可复跑一次即通过的 GREEN 用例)。

import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import NotesMarkdownEditor from './NotesMarkdownEditor.vue'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function mountEditor(modelValue = '# hello\n\nworld') {
  const w = mount(NotesMarkdownEditor, {
    props: { modelValue },
    attachTo: document.body,
  })
  await nextTick()
  await flushPromises()
  return w
}

function getEditor(w: Awaited<ReturnType<typeof mountEditor>>): Editor {
  const readyEmits = w.emitted<Editor[]>('ready')
  expect(readyEmits).toBeTruthy()
  return readyEmits![0][0]
}

describe('NotesMarkdownEditor —— 挂载 + ready 契约', () => {
  it('真实挂载 tiptap Editor,渲染出 .nme-content .ProseMirror,内容与 markdown 一致', async () => {
    const w = await mountEditor('# hello\n\nworld')
    expect(w.find('.nme-content .ProseMirror').exists()).toBe(true)
    const ed = getEditor(w)
    expect(ed.storage.markdown.getMarkdown()).toBe('# hello\n\nworld')
    w.unmount()
  })

  it('mounted 末尾 emit("ready", editor):payload 是真实 Editor 实例', async () => {
    const w = await mountEditor('body text')
    const ed = getEditor(w)
    expect(typeof ed.storage.markdown.getMarkdown).toBe('function')
    expect(typeof ed.chain).toBe('function')
    w.unmount()
  })
})

describe('NotesMarkdownEditor —— K38:v-model 契约同时发 update:modelValue 与 input', () => {
  it('真敲一次内容后,两个 emit 各有一条,payload 都是当前 markdown', async () => {
    const w = await mountEditor('start')
    const ed = getEditor(w)
    ed.chain().focus().insertContent(' more').run()
    await nextTick()
    await flushPromises()

    const updateEmits = w.emitted<string[]>('update:modelValue')
    const inputEmits = w.emitted<string[]>('input')
    expect(updateEmits).toBeTruthy()
    expect(inputEmits).toBeTruthy()
    const md = ed.storage.markdown.getMarkdown()
    expect(updateEmits![updateEmits!.length - 1][0]).toBe(md)
    expect(inputEmits![inputEmits!.length - 1][0]).toBe(md)
    w.unmount()
  })
})

describe('NotesMarkdownEditor —— §5.3 防回环', () => {
  // ⚠️ 三条踩坑记录(报告里同步登记):
  // ① `editor.commands` 是 getter,每次访问都返回一个新构造的绑定函数对象
  //    (`@tiptap/core` `Editor.prototype` 的 `get commands()`,`Object.fromEntries(...)`
  //    现造)—— `vi.spyOn(ed.commands, 'setContent')` 只能 spy 到那一次访问返回的快照,
  //    拦不住 watch 内部 `editor.value.commands.setContent(v)` 重新取到的另一个对象,
  //    实测这条 spy 恒记 0 次调用,是假阴性断言。
  // ② 改用 `onTransaction` emit 计数作信号同样不可靠 —— 实测偶发(约 1/5)在「同值写回」
  //    分支也多出 1 次 transaction,与 setContent 有没有被调用无关(jsdom 下 ProseMirror
  //    的 selection/focus 相关事件会派发不影响文档的 transaction,时序上与 mount 后的
  //    异步收尾竞争,是噪声不是待测行为)。
  // ⇒ 改用 `editor.state.doc`(ProseMirror 不可变文档树)的引用相等性:setContent 一旦
  //   真的执行,无论新内容与旧内容是否文本相同,ProseMirror 都会产出一个新的 doc 节点
  //   对象(已用隔离脚本实测坐实:`ed.commands.setContent(sameMarkdown)` 后
  //   `docBefore === docAfter` 为 `false`)。
  // ③ 🔴 直接 `setProps({ modelValue: 初始挂载值 })` 测不出这条守卫 ——
  //   Vue 的 `watch` 源在新旧值 `Object.is` 相等时**根本不会调用回调**(与我们写没写
  //   `v !== …` 比对无关,是 Vue 自己的前置去重);实测过:删掉生产代码里的比对后,
  //   这种写法的用例仍然全绿,零判别力。真正需要防的场景是「防回环」本身的语义 ——
  //   用户敲字 → `onUpdate` 触发 `update:modelValue` → 父组件 v-model 把**同一个值**
  //   原样写回 —— 这时 prop **值确实变了**(从挂载时的初始值变成用户敲字后的新值),
  //   Vue 会调用 watch 回调,回调内部的比对才有意义。下面这条用例复刻这个真实回环。
  it('用户敲字后父组件把同一个值经 v-model 写回,不重设内容(文档引用不变);写入真正不同的值时才重设', async () => {
    const w = await mountEditor('start')
    const ed = getEditor(w)

    // 敲字:editor 内容真的变了,触发 onUpdate → emit('update:modelValue', afterType)。
    ed.chain().focus().insertContent(' more').run()
    await nextTick()
    await flushPromises()
    const afterType = ed.storage.markdown.getMarkdown()
    expect(afterType).not.toBe('start')
    const docBeforeEcho = ed.state.doc

    // 模拟父组件 v-model 把 update:modelValue 的值原样回写(真实回环场景,
    // 与初始挂载值不同,Vue 的 watch 前置去重不会拦这次调用)。
    await w.setProps({ modelValue: afterType })
    await nextTick()
    await flushPromises()
    expect(ed.state.doc).toBe(docBeforeEcho)
    expect(ed.storage.markdown.getMarkdown()).toBe(afterType)

    // 父组件写入真正不同的值 → 必须真的 setContent。
    await w.setProps({ modelValue: '# totally different' })
    await nextTick()
    await flushPromises()
    expect(ed.state.doc).not.toBe(docBeforeEcho)
    expect(ed.storage.markdown.getMarkdown()).toBe('# totally different')
    w.unmount()
  })
})

describe('NotesMarkdownEditor —— onTransaction → emit("transaction")', () => {
  it('真敲内容触发至少一次 "transaction" emit', async () => {
    const w = await mountEditor('x')
    const ed = getEditor(w)
    ed.chain().focus().insertContent('y').run()
    await nextTick()
    await flushPromises()
    const txEmits = w.emitted('transaction')
    expect(txEmits).toBeTruthy()
    expect(txEmits!.length).toBeGreaterThan(0)
    w.unmount()
  })
})

describe('NotesMarkdownEditor —— onBeforeUnmount 销毁', () => {
  it('组件卸载时调用 editor.destroy() 恰好一次', async () => {
    const w = await mountEditor('bye')
    const ed = getEditor(w)
    const spy = vi.spyOn(ed, 'destroy')
    w.unmount()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('NotesMarkdownEditor —— K44:零 <style> 块 + 缺口③模板零裸色', () => {
  // 治理 §9 缺口③手法沿用 FolderBrowser.test.ts / QueueView.test.ts 现状写法:
  // node:fs 读源文件(不用 Vite `?raw`,CSSEnablerPlugin 会把样式源换空串致假通过)。
  it('本文件零 <style> 块(样式块蓝本 :40-46,T2 已搬进 knowledge.scss 的 K44 顶层例外段)', () => {
    const src: string = readFileSync(resolve(__dirname, './NotesMarkdownEditor.vue'), 'utf8')
    expect(src).not.toMatch(/^<style/m)
  })

  it('<template> 块内(剥离 var() 之后)不含任何裸 hex / rgb / hsl 字面量', () => {
    const src: string = readFileSync(resolve(__dirname, './NotesMarkdownEditor.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]
    // 覆盖度自检:抽出的片段必须含模板首尾特征串
    expect(tmpl).toContain('class="nme"')
    expect(tmpl).toContain('nme-content')

    // 剥掉 var(...) 内部(照 color-guard.test.ts 的 stripVar 同款手法:逐字符扫描
    // 配对括号深度,支持嵌套 fallback)——本模板没有 var()/color-mix() 调用,
    // 此函数在这里是空操作,但照惯例保留与其它组件测试同款结构。
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') {
              depth--
              if (depth === 0) {
                j++
                break
              }
            }
          }
          i = j
        } else {
          out += s[i]
          i++
        }
      }
      return out
    }
    const scrubbed = stripCalls(tmpl, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})
